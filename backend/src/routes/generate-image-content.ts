// File: backend/src/routes/generate-image-content.ts

import { Request, Response } from 'express';
// Removed Part import as it's no longer used for image uploads here.
import { vertexAI } from '../services';

// Define the interface locally or import if shared. Redefined here for completeness.
interface ImageAnalysis {
    subjects: Array<{
        name: string;
        description: string;
        prominence: string;
    }>;
    setting: {
        location: string;
        time_of_day: string;
        context: string;
    };
    style_elements: {
        artistic_medium: string;
        photography_style: string;
        lighting: string;
        color_palette: {
            dominant_colors: string[];
            description: string;
        };
        composition: string;
        overall_mood: string;
    };
}

const GEMINI_MODEL = 'gemini-2.5-flash';
const IMAGEN_MODEL = 'imagen-3.0-fast-generate-001';

type GenerationIntent = 'AdaptRemix' | 'ExtractStyle';


// ============================================================================
// Step 2: Generate Optimized Image Prompt (Gemini 2.5 Flash)
// ============================================================================

// Prompt Templates based on the PDF (Step 2, Case A and B)

const PROMPT_TEMPLATE_ADAPT_REMIX = `
You are an expert prompt engineer for the text-to-image model Imagen 3. Your task is to synthesize information to create a new, highly effective image prompt.

**INPUTS:**
1. **Image Analysis JSON:** \${ANALYSIS_JSON}
2. **User Topic:** "\${USER_TOPIC}"
3. **User Details:** "\${USER_DETAILS}"
4. **Creative Freedom Level:** \${CONTROL_LEVEL} (0.0 to 1.0)

**INSTRUCTIONS:**
- Your primary goal is to create a new scene that *adapts* the original image's subjects and setting to the new user topic.
- The main subject(s) from 'subjects.name' and the general context from 'setting.context' MUST be present in the new prompt.
- Integrate the 'user_topic' and 'user_details' seamlessly into this scene.
- Use the 'style_elements' from the analysis as a strong foundation for the visual description.
- The Creative Freedom Level dictates how much you should deviate from the original scene. 0.0 means a very faithful adaptation. 1.0 means a highly creative, almost abstract reinterpretation that still includes the core subjects and topic.
- **CRITICAL:** The final image must contain absolutely NO TEXT, WORDS, OR LETTERS. Do not include any instructions that might generate text.

Your output must be a single, concise, and descriptive prompt paragraph for Imagen 3, and nothing else.
`;

const PROMPT_TEMPLATE_EXTRACT_STYLE = `
You are an expert prompt engineer for the text-to-image model Imagen 3. Your task is to synthesize information to create a new, highly effective image prompt.

**INPUTS:**
1. **Image Analysis JSON:** \${ANALYSIS_JSON}
2. **User Topic:** "\${USER_TOPIC}"
3. **User Details:** "\${USER_DETAILS}"
4. **Style Adherence Level:** \${CONTROL_LEVEL} (0.0 to 1.0)

**INSTRUCTIONS:**
- Your primary goal is to create a new image about the 'user_topic' that meticulously recreates the *style* of the original image.
- **CRITICAL:** You MUST IGNORE the 'subjects' and 'setting' fields from the Image Analysis JSON. Do NOT include the original people, objects, or locations in your prompt.
- Your prompt's subject matter must ONLY come from the 'user_topic' and 'user_details'.
- You MUST use the descriptions in the 'style_elements' object (artistic_medium, lighting, color_palette, composition, etc.) to define the visual style of the new image.
- The Style Adherence Level dictates how strictly you must follow these style rules. 0.0 is loosely inspired. 1.0 is a near-perfect stylistic replication.
- **CRITICAL:** The final image must contain absolutely NO TEXT, WORDS, OR LETTERS. Do not include any instructions that might generate text.

Your output must be a single, concise, and descriptive prompt paragraph for Imagen 3, and nothing else.
`;


async function buildOptimizedPrompt(
    analysis: ImageAnalysis,
    topic: string,
    details: string,
    intent: GenerationIntent,
    controlLevel: number // Expecting 0-100 from frontend
): Promise<string> {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    const analysisJsonString = JSON.stringify(analysis);
    // Normalize control level to 0.0 - 1.0 scale required by the prompt
    const normalizedControlLevel = (controlLevel / 100).toFixed(2);

    let masterPromptForGemini = '';

    if (intent === 'AdaptRemix') {
        masterPromptForGemini = PROMPT_TEMPLATE_ADAPT_REMIX
            .replace('${ANALYSIS_JSON}', analysisJsonString)
            .replace('${USER_TOPIC}', topic)
            .replace('${USER_DETAILS}', details || 'None')
            .replace('${CONTROL_LEVEL}', normalizedControlLevel);
    } else { // ExtractStyle
        masterPromptForGemini = PROMPT_TEMPLATE_EXTRACT_STYLE
            .replace('${ANALYSIS_JSON}', analysisJsonString)
            .replace('${USER_TOPIC}', topic)
            .replace('${USER_DETAILS}', details || 'None')
            .replace('${CONTROL_LEVEL}', normalizedControlLevel);
    }

    const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: masterPromptForGemini }] }],
    });

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
// (This function remains unchanged as it was working correctly)
async function generateImageFromPrompt(finalImagePrompt: string): Promise<{ base64: string, mime: string }> {
    const model = vertexAI.getGenerativeModel({ model: IMAGEN_MODEL });

    console.log(`Starting image generation with ${IMAGEN_MODEL}...`);

    const gen = await model.generateContent(finalImagePrompt);

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

// Updated Prompt based on the PDF (Step 3) to use the structured analysis data
const SOCIAL_TEXT_PROMPT_TEMPLATE = `
You are an expert social media manager. Based on the provided information, generate compelling posts for Facebook, Instagram, X (formerly Twitter), and LinkedIn.

**CONTEXT:**
**User's Goal:** "\${USER_TOPIC}"
**Visual Prompt Used:** "\${FINAL_IMAGEN_PROMPT}"
**Original Image Inspiration (for tone/style):**
- Subjects: \${SUBJECT_NAMES}
- Style: \${STYLE_MOOD} and \${STYLE_PHOTO}

**INSTRUCTIONS:**
- **Facebook:** Write an engaging post (2-3 sentences) with relevant hashtags.
- **Instagram:** Write a visually-focused caption, suggest relevant visual hashtags, and include a call to action.
- **X:** Write a concise, impactful post under 280 characters with 2-3 key hashtags.
- **LinkedIn:** Write a professional, slightly more detailed post explaining the context or message behind the image.
\${HEADLINE_WANTED ? '- Headline: 6-10 words, bold and catchy hook for the image overlay.' : ''}

Output strictly as a JSON object with keys: linkedin, twitter, instagram, facebook\${HEADLINE_WANTED ? ', headline' : ''}.
`;

async function generateSocialText(
    topic: string,
    analysis: ImageAnalysis,
    finalImagePrompt: string,
    headlineWanted: boolean
) {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Extract relevant info from analysis for the prompt
    const subjectNames = analysis.subjects.map(s => s.name).join(', ') || 'N/A';
    const styleMood = analysis.style_elements.overall_mood || 'N/A';
    const stylePhoto = analysis.style_elements.photography_style || 'N/A';

    const prompt = SOCIAL_TEXT_PROMPT_TEMPLATE
        .replace('${USER_TOPIC}', topic)
        .replace('${FINAL_IMAGEN_PROMPT}', finalImagePrompt)
        .replace('${SUBJECT_NAMES}', subjectNames)
        .replace('${STYLE_MOOD}', styleMood)
        .replace('${STYLE_PHOTO}', stylePhoto)
        // Use regex replace with 'g' flag to ensure both replacements happen
        .replace(/\${HEADLINE_WANTED}/g, headlineWanted ? 'true' : '');


    const resp = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // Explicitly request JSON output for reliability
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

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
        // This endpoint now expects JSON input, not multipart/form-data.
        const {
            topic,
            details,
            analysis,
            intent,
            controlLevel,
            withTextOverlay
        } = req.body;

        // Input Validation
        if (!topic) return res.status(400).json({ error: 'Topic is required.' });
        if (!analysis) return res.status(400).json({ error: 'Analysis data is required.' });
        if (!intent || (intent !== 'AdaptRemix' && intent !== 'ExtractStyle')) {
            return res.status(400).json({ error: 'Valid generation intent (AdaptRemix or ExtractStyle) is required.' });
        }

        const includeText = String(withTextOverlay ?? 'true') === 'true';
        const control = Number(controlLevel || 50);


        // --- The Multi-Step Generation Process ---

        // Step 2: Build Final Prompt
        console.log(`[Pipeline] 2. Building Optimized Prompt (Gemini) - Intent: ${intent}...`);
        const optimizedPrompt = await buildOptimizedPrompt(
            analysis as ImageAnalysis,
            String(topic),
            String(details || ''),
            intent as GenerationIntent,
            control
        );

        // Step 3: Generate Image (Imagen 3)
        console.log("[Pipeline] 3. Generating Image (Imagen 3)...");
        const imageData = await generateImageFromPrompt(optimizedPrompt);
        const imageUrl = `data:${imageData.mime};base64,${imageData.base64}`;

        // Step 4: Generate Social Text
        console.log("[Pipeline] 4. Generating Social Text (Gemini)...");
        const copy = await generateSocialText(
            String(topic),
            analysis as ImageAnalysis,
            optimizedPrompt,
            includeText
        );

        const result = {
            imageUrl,
            posts: copy,
            headline: copy.headline,
        };

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

        let message = error?.message || 'An internal server error occurred.';
        if (code === 429 || /RESOURCE_EXHAUSTED|Too Many Requests|Quota exceeded/i.test(message)) {
            message = "The service is currently overloaded or the project quota limit has been reached (429). Please wait 1-2 minutes and try again.";
        }

        return res.status(code >= 400 && code < 600 ? code : 500).json({ error: message });
    }
};