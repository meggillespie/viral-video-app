// File: backend/src/routes/generate-image-content.ts

//gcloud run deploy vyralize-backend --source . --platform managed --region us-central1 --project vyralize-backend --set-env-vars="GOOGLE_CLOUD_LOCATION=us-east4,SUPABASE_URL=,SUPABASE_SERVICE_ROLE_KEY=[YOUR_SUPABASE_KEY],GOOGLE_API_KEY=[YOUR_GOOGLE_API_KEY]" --allow-unauthenticated --memory 2Gi --timeout 900s

import { Request, Response } from 'express';
import { Part } from '@google-cloud/vertexai';
import { vertexAI, imageQueue, withBackoff } from '../services';

const GEMINI_MODEL = 'gemini-2.5-flash';
const IMAGEN_MODEL = 'imagen-3.0-generate-002';

// ============================================================================
// Step 1: Analyze Image Style and Content (Gemini 2.5 Flash)
// ============================================================================

// Define the structure for the detailed analysis output
interface ImageAnalysis {
    summary: string;
    visualElements: {
        // Ensure "Composition and Style" is present, allow other flexible keys
        "Composition and Style": string;
        [key: string]: string; 
    };
    textElements: string;
    overallImpression: string;
}

// The detailed few-shot prompt requested by the user, adapted for JSON output.
const ANALYSIS_PROMPT_INSTRUCTIONS = `
**Role:** You are an AI assistant specialized in creating detailed, neutral, and structured descriptions of images for a digital content application. Your analysis must include both the content of the image and its artistic composition.

**Task:** Analyze the user-provided image and generate a comprehensive description. Your description must be objective, focusing only on what is visually and textually present. Do not interpret the truthfulness of any claims or express personal opinions.

**Instructions for Analysis:**
* **Content:** Identify all people, objects, and text.
* **Composition:** Pay close attention to graphic and artistic elements. Specifically describe the use of **lighting, shadows, focus (including blurring or depth of field), color saturation, medium (e.g., photorealistic, cartoon, illustration), and overall visual style.**

**Output Format:**
You MUST output the analysis strictly as a structured JSON object. Do NOT include any introductory text or markdown formatting. The JSON structure must adhere to the following schema:

{
  "summary": "A single, concise sentence summarizing the image's subject and style.",
  "visualElements": {
    "Composition and Style": "Description of lighting, focus, color palette, medium, and overall aesthetic.",
    "[Other Key Element 1]": "Description (e.g., Central Figure, Background, Logos, Recognizable Identities)",
    "[Other Key Element 2]": "Description"
  },
  "textElements": "A verbatim transcription of all visible text in the image. If none, state 'None'.",
  "overallImpression": "A paragraph describing the tone and likely purpose of the image based on its combined elements."
}

---
**EXAMPLE ANALYSIS (Based on a reference image description):**
---

*Reference Image Description: A political graphic with Donald Trump center frame, dark lighting, American flag background, Google and Microsoft logos on the sides, and a headline about hiring practices.*

*Example JSON Output:*
{
  "summary": "A political, social media-style graphic featuring a dramatically lit portrait of President Donald Trump.",
  "visualElements": {
    "Central Figure": "Donald Trump is the main subject, positioned in the center. He is wearing a dark suit, a white shirt, and a red tie, with a small American flag pin on his lapel. He has a stern, confrontational expression and is looking directly at the viewer.",
    "Background": "A large American flag serves as the backdrop. It is slightly out of focus and its colors are muted, which makes the central figure stand out.",
    "Logos": "On either side of Trump at shoulder level are the prominent logos of Google and Microsoft, each enclosed in a black circle with a soft white glow.",
    "Composition and Style": "Photorealistic style with graphic overlays. The image uses dramatic, high-contrast lighting (chiaroscuro) that casts strong shadows on Trump's face. The focus is sharply on his face (shallow depth of field), while the background is softly blurred. The color palette is dominated by red, white, and blue, but the overall tone is dark and serious."
  },
  "textElements": "Headline: 'DONALD TRUMP TELLS MICROSOFT AND GOOGLE TO STOP HIRING INDIANS, SAYS IT HURTS THE U.S. JOBS'. Branding: 'EVOLVING AI'. Call to Action: 'READ THE CAPTION'.",
  "overallImpression": "The image is designed to look like a news summary or a meme for a social media platform. The combination of Trump's intense gaze, the dramatic lighting, and the provocative headline creates a highly charged and attention-grabbing message."
}
---
**END OF EXAMPLE**
---

**NOW, PROCESS THE NEW IMAGE PROVIDED BY THE USER AND OUTPUT THE JSON:**
`;


async function analyzeImageStyle(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysis> {
    // We must configure the model to output JSON.
    const model = vertexAI.getGenerativeModel({ 
        model: GEMINI_MODEL,
        generationConfig: {
            responseMimeType: "application/json",
        }
    });
    
    const imagePart: Part = {
        inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType,
        },
    };

    // The prompt structure is [Instructions/Example, Image to Analyze]
    const response = await withBackoff(() => model.generateContent({
        contents: [{ role: 'user', parts: [{ text: ANALYSIS_PROMPT_INSTRUCTIONS }, imagePart] }],
    }));

    const text = response.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '{}';
    
    try {
        const parsed: ImageAnalysis = JSON.parse(text);
        // Basic validation of the structure
        if (!parsed.summary || !parsed.visualElements || !parsed.visualElements["Composition and Style"]) {
            throw new Error("Analysis JSON did not meet the required schema.");
        }
        return parsed;
    } catch (error) {
        console.error("Style analysis failed or returned invalid JSON:", text, error);
        // Fallback if analysis fails
        return {
            summary: "A high-quality image.",
            visualElements: {
                "Composition and Style": "Professional, clean composition, balanced lighting, photorealistic."
            },
            textElements: "None",
            overallImpression: "The image is intended for general use."
        };
    }
}

// ============================================================================
// Step 2: Generate Optimized Image Prompt (Gemini 2.5 Flash)
// ============================================================================
async function buildOptimizedPrompt(analysis: ImageAnalysis, topic: string, details: string, styleInfluence: number): Promise<string> {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Extract key information from the structured analysis
    const styleDetails = analysis.visualElements["Composition and Style"];
    // Combine all other visual elements (subjects, background, logos)
    const subjectDetails = Object.entries(analysis.visualElements)
        .filter(([key]) => key !== "Composition and Style")
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
    
    // Updated prompt engineering to utilize the detailed analysis and target Imagen 4.
    const masterPromptForGemini = `You are an expert prompt engineer for Imagen 4, a state-of-the-art text-to-image AI. Your task is to synthesize user requirements and a detailed image analysis into a single, cohesive, descriptive paragraph for image generation.

**User's Goal (New Content):**
- **Topic:** "${topic}"
- **Details:** "${details || 'None'}"

**Source Image Analysis (Inspiration):**
- **Summary:** "${analysis.summary}"
- **Style & Composition (CRITICAL):** "${styleDetails}"
- **Key Subjects/Objects/Identities:** "${subjectDetails}"
- **Overall Impression:** "${analysis.overallImpression}"

**Influence Level:** ${styleInfluence}/100 (100=Strictly adhere to source style/subjects; 50=Balanced blend; 0=Ignore source, use only Topic/Details).

**Your Task:**
Write a single paragraph (the final prompt for Imagen 4).
1. Weave the essence of the source **Style & Composition** into the description of the new scene based on the User's Goal.
2. Be vivid and detailed. Describe the aesthetic (e.g., photorealistic, cartoon, lighting, focus, color palette, medium) derived from the analysis.
3. The influence level dictates how closely the prompt must mirror the source analysis vs. the new topic.
4. If recognizable identities or specific styles are present in "Key Subjects", incorporate them naturally, and scale style and aesthetic by the Influence Level.
5. **CRITICAL:** The final image must contain absolutely NO TEXT, WORDS, OR LETTERS. Do not include any instructions that might generate text.

Output ONLY the final prompt paragraph, and nothing else.`;

    // Wrap this in backoff.
    const response = await withBackoff(() => model.generateContent({
        contents: [{ role: 'user', parts: [{ text: masterPromptForGemini }] }],
    }));

    const text = response.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';

    if (!text) {
        // Fallback if prompt generation fails
        throw new Error("Failed to generate the image prompt.");
    }
    return text.trim();
}


// ============================================================================
// Step 3: Generate Image (Imagen 3)
// ============================================================================
async function generateImageFromPrompt(finalImagePrompt: string): Promise<{ base64: string, mime: string }> {
    const model = vertexAI.getGenerativeModel({ model: IMAGEN_MODEL });

    console.log(`Starting image generation with ${IMAGEN_MODEL}...`);
    
    // The JSON payload for Imagen 3's predict endpoint.
    const requestPayload = {
        instances: [
            { prompt: finalImagePrompt }
        ],
        parameters: {
            sampleCount: 1
        }
    };

    const gen = await withBackoff(() =>
        model.generateContent(finalImagePrompt) // Simpler call for a single text prompt
    );

    // FIX: The response structure from generateContent is consistent.
    // The second error was because the first error broke TypeScript's ability to know the type.
    const imagePart = gen?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart?.inlineData?.data) {
        console.error("Image generation failed. Final prompt (for debugging):", finalImagePrompt);
        console.error("API Response:", JSON.stringify(gen.response, null, 2));
        throw new Error('No image returned by model. The request might have triggered safety filters. Please try adjusting the topic.');
    }

    return {
        base64: imagePart.inlineData.data,
        mime: imagePart.inlineData.mimeType || 'image/png',
    };
}


// ============================================================================
// Step 4: Generate Social Text (Gemini 2.5 Flash)
// ============================================================================
// (This function remains unchanged as it was working correctly)
async function generateSocialText(topic: string, details: string, headlineWanted: boolean) {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
    // Prompt ensures Facebook is included as requested.
    const prompt = `You are a social copywriter.

Topic: "${topic}"
${details ? `Details: ${details}` : ''}

Return concise copy for the following four platforms and an optional headline, adhering to their specific tones and formats:
- **Instagram:** Make it visual-focused, use relevant emojis, and include a strong set of hashtags.
- **Facebook:** Write an engaging post that is slightly more detailed and encourages discussion and strategic emojis.
- **X (formerly Twitter):** Keep it concise, witty, punchy, and under 270 characters. Use relevant hashtags and strategic emojis.
- **LinkedIn:** Craft an insightful, short paragraph with a CTA, in a professional tone, focusing on business or industry implications, with limited emojis.
${headlineWanted ? '- Headline: 6-10 words, bold and catchy hook.' : ''}

Output strictly as a JSON object with keys: linkedin, twitter, instagram, facebook${headlineWanted ? ', headline' : ''}.`;

    // Wrap this in backoff.
    const resp = await withBackoff(() => model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // Explicitly request JSON output for reliability
        generationConfig: {
            responseMimeType: "application/json",
        }
    }));

    const text = resp.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '{}';

    try {
        const parsed = JSON.parse(text);
        return {
            linkedin: parsed.linkedin || '',
            // Handle potential variations in the key for Twitter/X
            twitter: parsed.twitter || parsed.x || '', 
            instagram: parsed.instagram || '',
            facebook: parsed.facebook || '',
            headline: headlineWanted ? parsed.headline || null : null,
        };
    } catch (parseError) {
        console.error("Failed to parse social text JSON:", text, parseError);
        return {
            linkedin: `Sharing quick insights on ${topic}.`,
            twitter: `${topic} — thoughts and takeaways.`,
            instagram: `On ${topic} today! ✨`,
            facebook: `Discussing ${topic}. What are your thoughts?`,
            headline: headlineWanted ? topic : null,
        };
    }
}

// ============================================================================
// Main Route Handler
// ============================================================================
export const generateImageContent = async (req: Request, res: Response) => {
    try {
        const sourceImage: any =
            (req as any).file ||
            (req as any).files?.sourceImage ||
            (Array.isArray((req as any).files) ? (req as any).files[0] : undefined);

        const { topic, details, styleInfluence, withTextOverlay } = req.body;
        
        // Input Validation
        if (!topic) return res.status(400).json({ error: 'Topic is required.' });
        if (!sourceImage) return res.status(400).json({ error: 'Source image file is required.' });

        const includeText = String(withTextOverlay ?? 'true') === 'true';
        const influence = Number(styleInfluence || 50);

        // Prepare Image Buffer
        const buf: Buffer =
            sourceImage.buffer ||
            sourceImage.data ||
            (typeof sourceImage.arrayBuffer === 'function'
                ? Buffer.from(await sourceImage.arrayBuffer())
                : undefined);

        if (!buf) return res.status(400).json({ error: 'Could not read uploaded image.' });
        const mimeType = sourceImage.mimetype || 'image/png';

        // --- The Multi-Step Process ---
        
        // CRITICAL: We use the imageQueue to serialize the entire pipeline.
        const result = await imageQueue(async () => {
            
            // Step 1: Analyze Style (Now using detailed analysis)
            console.log("[Pipeline] 1. Analyzing Style (Gemini)...");
            const detailedAnalysis = await analyzeImageStyle(buf, mimeType);
            
            // Step 2: Build Final Prompt (Now using structured analysis)
            console.log("[Pipeline] 2. Building Optimized Prompt (Gemini)...");
            const optimizedPrompt = await buildOptimizedPrompt(detailedAnalysis, String(topic), String(details || ''), influence);
            
            // Step 3: Generate Image (Now using Imagen 4)
            console.log("[Pipeline] 3. Generating Image (Imagen 4)...");
            const imageData = await generateImageFromPrompt(optimizedPrompt);
            const imageUrl = `data:${imageData.mime};base64,${imageData.base64}`;

            // Step 4: Generate Social Text
            console.log("[Pipeline] 4. Generating Social Text (Gemini)...");
            const copy = await generateSocialText(String(topic), String(details || ''), includeText);

            return {
                imageUrl,
                posts: copy,
                headline: copy.headline,
            };
        });

        return res.status(200).json({
            result: {
                imageUrl: result.imageUrl,
                posts: {
                    linkedin: result.posts.linkedin,
                    twitter: result.posts.twitter,
                    instagram: result.posts.instagram,
                    facebook: result.posts.facebook,
                },
                headline: result.headline,
            }
        });

    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/generate-image-content ---', error);
        const code = Number(error?.code || error?.status) || 500;
        
        // Specific handling for Quota errors (429) after retries are exhausted
        let message = error?.message || 'An internal server error occurred.';
        if (code === 429 || /RESOURCE_EXHAUSTED|Too Many Requests|Quota exceeded|Backoff exhausted/i.test(message)) {
            // Provide a user-friendly message when the quota is hit, even after retries.
            message = "The service is currently overloaded or the project quota limit has been reached (429). Please wait 1-2 minutes and try again.";
        }
        
        // Ensure the status code is a valid HTTP error code
        return res.status(code >= 400 && code < 600 ? code : 500).json({ error: message });
    }
};