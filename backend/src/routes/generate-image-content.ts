// File: backend/src/routes/generate-image-content.ts
import { Request, Response } from 'express';
import { HarmCategory, HarmBlockThreshold, SafetyFilterLevel } from "@google/genai";
import { genAI } from '../services';

// Helper function to extract a JSON string from a raw model response
const cleanJsonString = (rawString: string): string => {
    const firstBracket = rawString.indexOf('{');
    const lastBracket = rawString.lastIndexOf('}');
    if (firstBracket === -1 || lastBracket === -1) {
        return '{}';
    }
    return rawString.substring(firstBracket, lastBracket + 1);
};

interface ImageAnalysis {
    subjects: Array<{ name: string; description: string; prominence: string; }>;
    setting: { location: string; time_of_day: string; context: string; };
    style_elements: {
        artistic_medium: string; photography_style: string; lighting: string;
        color_palette: { dominant_colors: string[]; description: string; };
        composition: string; overall_mood: string;
    };
}
type GenerationIntent = 'AdaptRemix' | 'ExtractStyle';

const GEMINI_MODEL = 'gemini-2.5-flash';
const IMAGEN_MODEL = 'imagen-4.0-generate-001';

// Step 2: Generate Optimized Image Prompt (Unchanged)
async function buildOptimizedPrompt(
    analysis: ImageAnalysis, topic: string, details: string,
    intent: GenerationIntent, controlLevel: number
): Promise<string> {

    // --- 1. Sanitize Inputs ---
    const sanitizedTopic = topic.replace(/adobe firefly 4|adobe firefly/gi, 'advanced digital art');
    const sanitizedAnalysisString = JSON.stringify(analysis)
        .replace(/adobe firefly 4|adobe firefly/gi, 'advanced digital art');
    const normalizedControlLevel = (controlLevel / 100).toFixed(2);
    
    // --- 2. Add New Rule to Gemini's Instructions ---
    const PROMPT_TEMPLATE_ADAPT_REMIX = `
You are an expert prompt engineer for the text-to-image model Imagen 4. Your task is to synthesize information to create a new, highly effective image prompt.

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
- **CRITICAL (Composition):** If the original image analysis mentions a "division", "overlay", or "lower section", you MUST interpret this as a **semi-transparent gradient overlay that blends seamlessly** into the main image. DO NOT create a "split screen" or a "solid panel" with harsh lines unless the original image was explicitly a split screen.
- The Creative Freedom Level dictates how much you should deviate from the original scene. 0.0 means a faithful adaptation. 1.0 means a highly creative, almost abstract reinterpretation that still includes the core subjects and topic.
- **CRITICAL:** The final image must contain absolutely no TEXT, WORDS, OR LETTERS.

Your output must be a single, concise, and descriptive prompt paragraph for Imagen 4, and nothing else.
`;
    const PROMPT_TEMPLATE_EXTRACT_STYLE = `
You are an expert prompt engineer for the text-to-image model Imagen 4. Your task is to synthesize information to create a new, highly effective image prompt.

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
- **CRITICAL (Composition):** If the original image analysis mentions a "division", "overlay", or "lower section", you MUST interpret this as a **semi-transparent gradient overlay that blends seamlessly** into the main image. DO NOT create a "split screen" or a "solid panel" with harsh lines unless the original image was explicitly a split screen.
- The Style Adherence Level dictates how strictly you must follow these style rules. 0.0 is loosely inspired. 1.0 is a near-perfect stylistic replication.
- **CRITICAL:** The final image must contain absolutely no TEXT, WORDS, OR LETTERS.

Your output must be a single, concise, and descriptive prompt paragraph for Imagen 4, and nothing else.
`;
    
    let masterPromptForGemini = intent === 'AdaptRemix' ? PROMPT_TEMPLATE_ADAPT_REMIX : PROMPT_TEMPLATE_EXTRACT_STYLE;
    
    // --- 3. Use Sanitized Inputs ---
    masterPromptForGemini = masterPromptForGemini
        .replace('${ANALYSIS_JSON}', sanitizedAnalysisString)
        .replace('${USER_TOPIC}', sanitizedTopic)
        .replace('${USER_DETAILS}', details || 'None')
        .replace('${CONTROL_LEVEL}', normalizedControlLevel);

    const result = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: masterPromptForGemini }] }]
    });
    const text = result.text ?? '';
    if (!text) throw new Error("Failed to generate the image prompt.");
    return text.trim();
}

// Step 3: Generate Image (FINAL VERSION with Safety Settings)
async function generateImageFromPrompt(finalImagePrompt: string): Promise<{ base64: string, mime: string }> {
    console.log(`[DEBUG] Final prompt sent to Imagen 4: "${finalImagePrompt}"`);

    const response = await genAI.models.generateImages({
        model: IMAGEN_MODEL,
        prompt: finalImagePrompt,
        config: {
            numberOfImages: 1,
            aspectRatio: "1:1",
            includeRaiReason: true,
            safetyFilterLevel: SafetyFilterLevel.BLOCK_ONLY_HIGH,
        },
    });

    // The rest of your proven response-handling logic remains essential
    const firstResult = response?.generatedImages?.[0];

    if (firstResult && (firstResult as any).raiReason) {
        const reason = (firstResult as any).raiReason;
        console.error(`Image generation BLOCKED by safety filters. Reason: ${reason}`);
        throw {
            status: 422,
            message: `Image generation blocked due to safety policy: ${reason}`
        };
    }

    const imageBytes = firstResult?.image?.imageBytes;

    if (!imageBytes || imageBytes.length < 1000) {
        console.error('Image generation failed or produced an invalid/tiny file. Full response:', JSON.stringify(response, null, 2));
        throw {
            status: 500,
            message: 'Image generation failed: The API returned incomplete or invalid image data.'
        };
    } else {
     //console.log('FIRST RES: ' + firstResult);
     //console.log('IMG BYTES: ' + imageBytes);
    }

    return {
        base64: imageBytes,
        mime: 'image/png',
    };
}

// Step 4: Generate Social Text & Headline in ONE call
async function generateSocialContent(topic: string, details: string, analysis: ImageAnalysis) {
    // Construct the 'styleContext' from the analysis to inform the tone
    const styleContext = [
        analysis.style_elements.artistic_medium,
        analysis.style_elements.photography_style,
        analysis.style_elements.lighting,
        analysis.style_elements.composition,
        analysis.style_elements.overall_mood
    ].filter(Boolean).join(', ');

    const prompt = `
You are an expert-level social media strategist and viral content creator. Your task is to generate a catchy headline and compelling social media posts based on a user's topic.

## CONTEXT
- **User's Topic:** "${topic}"
- **Key Details:** "${details}"
- **Tone & Style Context (from image analysis):** "${styleContext}"

## TASK
Generate a single, valid JSON object. Adhere strictly to the schema and instructions below.

## JSON OUTPUT SCHEMA
{
  "headline": "A short, catchy headline for an image text overlay (3-7 words).",
  "linkedin": "A professional post for LinkedIn.",
  "x": "A concise and impactful post for X (formerly Twitter).",
  "instagram": "An engaging post for Instagram.",
  "facebook": "A informative post for Facebook."
}

## CRITICAL INSTRUCTIONS
1.  **DO NOT DESCRIBE THE IMAGE:** Your primary focus is the **User's Topic** and **Key Details**. Absolutely do not write phrases like "This visual shows," "This image represents," or describe the style or subjects of the image. The 'Tone & Style Context' is only to help you match the mood, not to be described.
2.  **Create Platform-Specific Content:**
    -   **General:** Every post must have a strong hook, use high-value keywords, and include a clear call-to-action (like asking a question or encouraging comments) to drive engagement.
    -   **LinkedIn:** Professional tone, focused on industry impact and discussion. 
    -   **X:** Concise, punchy, and impactful post under 280 characters with 2-3 relevant hashtags.
    -   **Instagram:** Write an engaging post (2-3 sentences), suggest relevant visual hashtags, and include a call to action. Use strategic emojis where appropriate to increase readability and engagement.
    -   **Facebook:** Write a short paragraph with an engaging and accessible tone. Use strategic emojis where appropriate to increase readability and engagement.  
3.  **Headline:** The headline must be bold, intriguing, and between 3 and 7 words. It will be overlaid on an image.

4. **CRITICAL:** Do not include quotes, labels, or any other formatting.
`;

    const result = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = result.text ?? '';

    // try {
    //     const cleanedText = cleanJsonString(text);
    //     const parsed = JSON.parse(cleanedText);

    //     let instagramPost: string;
    //     if (typeof parsed.instagram === 'object' && parsed.instagram !== null) {
    //         const ig = parsed.instagram;
    //         const caption = ig.caption || '';
    //         const hashtags = Array.isArray(ig.visual_hashtags) ? ig.visual_hashtags.join(' ') : (ig.visual_hashtags || '');
    //         const cta = ig.call_to_action || '';
    //         instagramPost = [caption, hashtags, cta].filter(Boolean).join('\n\n');
    //     } else {
    //         instagramPost = parsed.instagram || '';
    //     }
    //     return {
    //         linkedin: parsed.linkedin || '',
    //         twitter: parsed.twitter || parsed.x || '',
    //         instagram: instagramPost,
    //         facebook: parsed.facebook || '',
    //     };
    // } catch (parseError) {
    //     console.error("Failed to parse social text JSON. Raw Text:", text, parseError);
    //     return { linkedin: '', twitter: '', instagram: '', facebook: ''};
    // }

    try {
        const cleanedText = cleanJsonString(text);
        const parsed = JSON.parse(cleanedText);


        let instagramPost: string;
        if (typeof parsed.instagram === 'object' && parsed.instagram !== null) {
            const ig = parsed.instagram;
            const caption = ig.caption || '';
            const hashtags = Array.isArray(ig.visual_hashtags) ? ig.visual_hashtags.join(' ') : (ig.visual_hashtags || '');
            const cta = ig.call_to_action || '';
            instagramPost = [caption, hashtags, cta].filter(Boolean).join('\n\n');
        } else {
            instagramPost = parsed.instagram || '';
        }
        return {
            headline: parsed.headline || null,
            posts: {
                linkedin: parsed.linkedin || '',
                twitter: parsed.x || '', // Look for 'x' key from the new prompt
                instagram: parsed.instagram || '',
                facebook: parsed.facebook || '',
            }
        };
    } catch (parseError) {
        console.error("Failed to parse social content JSON. Raw Text:", text, parseError);
        // Return a default object to prevent crashes
        return { 
            headline: null,
            posts: { linkedin: '', twitter: '', instagram: '', facebook: '' }
        };
    }
}

// Main Route Handler (UPDATED)
export const generateImageContentRoute = async (req: Request, res: Response) => {
    let currentStep = "Initialization";
    try {
        const { topic, details, analysis, intent, controlLevel, withTextOverlay } = req.body;
        if (!topic || !analysis || !intent) {
            return res.status(400).json({ error: 'Missing required fields: topic, analysis, and intent.' });
        }

        currentStep = "Prompt Engineering (Gemini)";
        const optimizedPrompt = await buildOptimizedPrompt(analysis, topic, details, intent, Number(controlLevel || 50));
        
        currentStep = "Image Generation (Imagen 4)";
        const imageData = await generateImageFromPrompt(optimizedPrompt);
        const imageUrl = `data:${imageData.mime};base64,${imageData.base64}`;

        // **** UPDATED SINGLE CALL ****
        currentStep = "Social Content Generation (Gemini)";
        // Note: 'details' from req.body is now passed into this function
        const socialContent = await generateSocialContent(topic, details, analysis);

        // Check if a headline was requested by the user
        const finalHeadline = (String(withTextOverlay ?? 'true') === 'true') ? socialContent.headline : null;
        
        const result = { 
            imageUrl, 
            posts: socialContent.posts, 
            headline: finalHeadline 
        };
        return res.status(200).json({ result });

    } catch (error: any) {
        console.error(`--- ERROR in /api/generate-image-content (Step: ${currentStep}) ---`);
        console.error("Error Details:", error);

        const statusCode = error.status || 500;
        const errorMessage = error.message || 'An internal server error occurred.';

        return res.status(statusCode).json({
            error: errorMessage,
            step: currentStep,
        });
    }
};






/////////////////////////////////////////////////////////////////////////////////////////////////////


// Step 4: Generate Social Text & Headline (UPDATED)
// async function generateSocialText(topic: string, analysis: ImageAnalysis, finalImagePrompt: string) {
//     const subjectNames = analysis.subjects.map(s => s.name).join(', ') || 'N/A';
//     const styleMood = analysis.style_elements.overall_mood || 'N/A';
//     const stylePhoto = analysis.style_elements.photography_style || 'N/A';
    
//     const prompt = `
// You are an expert social media manager. Based on the provided information, generate compelling posts for Facebook, Instagram, X (formerly Twitter), and LinkedIn.

// **CONTEXT:**
// **User's Goal:** "${topic}"
// **Visual Prompt Used:** "${finalImagePrompt}"
// **Original Image Inspiration (for tone/style):**
// - Subjects: ${subjectNames}
// - Style: ${styleMood} and ${stylePhoto}

// **INSTRUCTIONS:**
// - **Facebook:** Write an engaging post (2-3 sentences) with relevant hashtags.
// - **Instagram:** Write a visually-focused caption, suggest relevant visual hashtags, and include a call to action.
// - **X:** Write a concise, impactful post under 280 characters with 2-3 key hashtags.
// - **LinkedIn:** Write a professional, slightly more detailed post explaining the context or message behind the image.

// **CRITICAL:** Your output must be ONLY a valid JSON object with keys: "linkedin", "twitter", "instagram", "facebook". The instagram key should contain an object with "caption", "visual_hashtags", and "call_to_action".
// `;

//     const result = await genAI.models.generateContent({
//         model: GEMINI_MODEL,
//         contents: [{ role: 'user', parts: [{ text: prompt }] }],
//     });
//     const text = result.text ?? '';

//     try {
//         const cleanedText = cleanJsonString(text);
//         const parsed = JSON.parse(cleanedText);

//         let instagramPost: string;
//         if (typeof parsed.instagram === 'object' && parsed.instagram !== null) {
//             const ig = parsed.instagram;
//             const caption = ig.caption || '';
//             const hashtags = Array.isArray(ig.visual_hashtags) ? ig.visual_hashtags.join(' ') : (ig.visual_hashtags || '');
//             const cta = ig.call_to_action || '';
//             instagramPost = [caption, hashtags, cta].filter(Boolean).join('\n\n');
//         } else {
//             instagramPost = parsed.instagram || '';
//         }
//         return {
//             linkedin: parsed.linkedin || '',
//             twitter: parsed.twitter || parsed.x || '',
//             instagram: instagramPost,
//             facebook: parsed.facebook || '',
//         };
//     } catch (parseError) {
//         console.error("Failed to parse social text JSON. Raw Text:", text, parseError);
//         return { linkedin: '', twitter: '', instagram: '', facebook: ''};
//     }
// }

// async function generateHeadline(topic: string, finalImagePrompt: string): Promise<string | null> {
//     const prompt = `
// You are an expert copywriter specializing in creating catchy, high-impact headlines for social media images.

// **CONTEXT:**
// **Topic:** "${topic}"
// **Image Description (AI Prompt):** "${finalImagePrompt}"

// **TASK:**
// Generate a bold and catchy headline for this image.
// - **Length:** 3 to 7 words maximum.
// - **Style:** Impactful, intriguing, and relevant to the topic and image.

// **OUTPUT:**
// Provide ONLY the headline text. Do not include quotes, labels, or any other formatting.
// `;
//     try {
//         const result = await genAI.models.generateContent({
//             model: GEMINI_MODEL,
//             contents: [{ role: 'user', parts: [{ text: prompt }] }]
//         });
//         const text = result.text ?? '';
//         return text.trim().length > 0 ? text.trim() : null;
//     } catch (error) {
//         console.error("Failed to generate headline:", error);
//         return null;
//     }
// }

// // Main Route Handler (Unchanged)
// export const generateImageContentRoute = async (req: Request, res: Response) => {
//     let currentStep = "Initialization";
//     try {
//         console.log("--- BACKEND: TRY BLOCK EXECUTING ---"); // <-- ADD THIS
//         const { topic, details, analysis, intent, controlLevel, withTextOverlay } = req.body;
//         if (!topic || !analysis || !intent) {
//             return res.status(400).json({ error: 'Missing required fields: topic, analysis, and intent.' });
//         }

//         const includeHeadline = String(withTextOverlay ?? 'true') === 'true';

//         currentStep = "Prompt Engineering (Gemini)";
//         const optimizedPrompt = await buildOptimizedPrompt(analysis, topic, details, intent, Number(controlLevel || 50));
        
//         currentStep = "Image Generation (Imagen 4)";
//         const imageData = await generateImageFromPrompt(optimizedPrompt);
//         const imageUrl = `data:${imageData.mime};base64,${imageData.base64}`;

//         currentStep = "Social Text & Headline Generation (Gemini)";
//         const socialTextPromise = generateSocialText(topic, analysis, optimizedPrompt);
//         const headlinePromise = includeHeadline ? generateHeadline(topic, optimizedPrompt) : Promise.resolve(null);

//         const [posts, headline] = await Promise.all([socialTextPromise, headlinePromise]);
        
//         const result = { imageUrl, posts, headline };
//         return res.status(200).json({ result });

//     } catch (error: any) {
//         console.log("--- BACKEND: CATCH BLOCK EXECUTING ---"); 
        
//         console.error(`--- ERROR in /api/generate-image-content (Step: ${currentStep}) ---`);
//         console.error("Error Details:", error);

//         const statusCode = error.status || 500;
//         const errorMessage = error.message || 'An internal server error occurred.';

//         return res.status(statusCode).json({
//             error: errorMessage,
//             step: currentStep,
//         });
//     }
// };

