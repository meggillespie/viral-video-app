// File: backend/src/routes/generate-image-content.ts

import { Request, Response } from 'express';
// Import Part for typing
import { Part } from '@google-cloud/vertexai';
import { vertexAI, imageQueue, withBackoff } from '../services';

// Define the models we will use in the multi-step process
const GEMINI_MODEL = 'gemini-2.5-flash';
// FIX: Switch to the standard text-to-image model to avoid the strict quota on the 'capability' model.
const IMAGEN_MODEL = 'imagen-3.0-fast-generate-001'; 


// ============================================================================
// Step 1: Analyze Image Style (Gemini 2.5 Flash)
// ============================================================================
async function analyzeImageStyle(imageBuffer: Buffer, mimeType: string): Promise<string> {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const imagePart: Part = {
        inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType,
        },
    };

    // Prompt based on the user's requirements and the AI Studio example.
    const prompt = `Analyze the provided image's visual style and content. Provide a concise, comma-separated list of keywords describing its core attributes. Focus on:
-   **Aesthetic & Medium**: (e.g., photorealistic, minimalist, corporate, vintage, futuristic, playful, cartoon, illustration, oil painting)
-   **Color Palette**: (e.g., vibrant, pastel, monochrome, high saturation, muted tones)
-   **Composition & Lighting**: (e.g., centered, symmetrical, dynamic, high contrast, dramatic lighting, soft lighting)
-   **Key Subjects/Identities**: If recognizable (e.g., "Donald Trump", "Eiffel Tower", "Specific brand logo style").

Ensure the analysis accurately captures the fundamental style (e.g., if it's a photo, explicitly say 'photorealistic').

Example output: "photorealistic, high contrast, dramatic lighting, centered composition, public figure"
Provide ONLY the keyword list.`;

    // Wrap in backoff as Gemini also has quotas.
    const response = await withBackoff(() => model.generateContent({
        contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
    }));

    const text = response.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    
    if (!text) {
        console.warn("Style analysis failed or returned empty.");
        // Fallback if analysis fails
        return "high-quality, professional, clean composition";
    }
    return text.trim();
}

// ============================================================================
// Step 2: Generate Optimized Image Prompt (Gemini 2.5 Flash)
// ============================================================================
async function buildOptimizedPrompt(styleDescription: string, topic: string, details: string, styleInfluence: number): Promise<string> {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Prompt engineering adapted from the working Google AI Studio example and user requirements.
    const masterPromptForGemini = `You are an expert prompt engineer for Imagen 3, a powerful text-to-image AI. Your task is to synthesize user requirements into a single, cohesive, and highly descriptive paragraph that will be used to generate a beautiful image.

**User's Goal:**
- **Topic:** "${topic}"
- **Details to Include:** "${details || 'None'}"
- **Inspirational Style & Subject Keywords (from source image analysis):** "${styleDescription}"
- **Style Influence Level:** ${styleInfluence}/100 (100=Strictly adhere to style/subjects; 50=Balanced blend; 0=Ignore style, use only Topic/Details).

**Your Task:**
Write a single paragraph (the final prompt for Imagen 3).
1. Weave the essence of the style and the analyzed subjects/identities into the description of the new scene based on the Topic/Details.
2. Be vivid and detailed. Describe the subject, the environment, the lighting, the aesthetic (e.g., photorealistic, cartoon), and the mood.
3. **Crucially:** If the "Style & Subject Keywords" contain specific styles (like "Cartoon" or "Photorealistic") or recognizable identities, ensure they are strongly represented in the final prompt, scaled by the Influence Level.
4. The goal is inspiration and style transfer, NOT exact duplication of the original image.
5. The final image must contain absolutely NO TEXT, WORDS, OR LETTERS unless specifically requested in the Topic/Details.

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
// Step 3: Generate Image (Imagen 3 Fast)
// ============================================================================
async function generateImageFromPrompt(finalImagePrompt: string): Promise<{ base64: string, mime: string }> {
    const model = vertexAI.getGenerativeModel({ model: IMAGEN_MODEL });

    console.log(`Starting image generation with ${IMAGEN_MODEL}...`);
    
    // Call Imagen using only the text prompt. This avoids the restricted 'capability' model.
    // This specific call is the one most likely to hit 429, so we rely heavily on withBackoff here.
    const gen = await withBackoff(() =>
        model.generateContent({
            contents: [{ role: 'user', parts: [{ text: finalImagePrompt }] }],
            generationConfig: {
                    // Optional: Add a random seed for variability
                    //seed: Math.floor(Math.random() * 1e9),
            },
        })
    );

    const imagePart = gen?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart?.inlineData?.data) {
        // This often happens if the generated prompt triggers safety filters.
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
        
        // CRITICAL: We use the imageQueue to serialize the entire pipeline (analysis + generation + text).
        // This prevents concurrent requests from exhausting the low quotas on Gemini AND Imagen.
        const result = await imageQueue(async () => {
            
            // Step 1: Analyze Style
            console.log("[Pipeline] 1. Analyzing Style (Gemini)...");
            const styleDescription = await analyzeImageStyle(buf, mimeType);
            
            // Step 2: Build Final Prompt
            console.log("[Pipeline] 2. Building Optimized Prompt (Gemini)...");
            const optimizedPrompt = await buildOptimizedPrompt(styleDescription, String(topic), String(details || ''), influence);
            
            // Step 3: Generate Image (Text-to-Image)
            console.log("[Pipeline] 3. Generating Image (Imagen 3 Fast)...");
            const imageData = await generateImageFromPrompt(optimizedPrompt);
            const imageUrl = `data:${imageData.mime};base64,${imageData.base64}`;

            // Step 4: Generate Social Text (runs after image generation due to queue)
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