// File: backend/src/routes/generate-image-content.ts 

import { Request, Response } from 'express';
import { genAI } from '../services';
import { GenerationConfig, Type, Schema } from '@google/genai';

// Define the schema for the social posts generation (for JSON mode)
const socialPostsSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        linkedin: {
            type: Type.STRING,
            description: "A professional post suitable for LinkedIn (150-300 words).",
        },
        twitter: {
            type: Type.STRING,
            description: "A concise, engaging tweet (max 280 characters).",
        },
        instagram: {
            type: Type.STRING,
            description: "An inspiring caption for Instagram, including relevant hashtags.",
        },
    },
    required: ["linkedin", "twitter", "instagram"] // It's good practice to specify required fields
};

// --- AI Pipeline Functions (Adapted from Example App) ---

// 1. Analyze Image Style (Gemini Multimodal)
const analyzeImageStyle = async (imageBuffer: Buffer, mimeType: string): Promise<string> => {
    const imagePart = {
        inlineData: { data: imageBuffer.toString('base64'), mimeType: mimeType },
    };
    
    const prompt = `Analyze the provided image's visual style. Provide a concise, comma-separated list of keywords describing its core attributes. Focus on:
-   **Aesthetic & Mood**: (e.g., minimalist, corporate, vintage, playful)
-   **Color Palette**: (e.g., vibrant, pastel, monochrome)
-   **Composition**: (e.g., centered, symmetrical, dynamic)

Example output: "minimalist, professional, blue and white color palette, centered composition, clean lines"
Provide only the keyword list.`;
    
    const response = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: { parts: [imagePart, { text: prompt }] },
    });
    
    return response.text?.trim() || "";
};

// 2. Generate Image Headline (Gemini Text)
const generateImageHeadline = async (topic: string, details: string): Promise<string | null> => {
    const prompt = `Generate a punchy, attention-grabbing headline (max 8 words) for an image related to the following topic. This headline will be overlaid on the image.

Topic: "${topic}"
Details: "${details || 'None'}"

Provide only the headline text.`;

    const response = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
    });

    return response.text?.trim() || null;
};

// 3. Generate Social Posts (Gemini Text/JSON)
const generateSocialPosts = async (topic: string, details: string): Promise<object> => {
    const prompt = `Generate engaging social media posts for LinkedIn, Twitter, and Instagram based on the following topic and details. The output must be a JSON object adhering to the provided schema.

Topic: "${topic}"
Details: "${details || 'None'}"`;

    const config: GenerationConfig = {
        responseMimeType: "application/json",
        // @ts-ignore: responseSchema is expected by the SDK for structured output
        responseSchema: socialPostsSchema,
    };

    const response = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: config,
    });

    const text = response.text;
    if (!text) throw new Error("Failed to generate social posts.");

    try {
        const cleanText = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        throw new Error("Failed to parse social posts JSON.");
    }
};

// 4. Generate New Image (Gemini Prompt Engineering + Imagen)
const generateNewImage = async (styleDescription: string, topic: string, details: string, styleInfluence: number): Promise<string> => {
    // The complex prompt engineering logic from the example app
    const masterPromptForGemini = `You are an expert prompt engineer for a powerful text-to-image AI. Your task is to synthesize user requirements into a single, cohesive, and highly descriptive paragraph that will be used to generate a beautiful image **without any text**.

**User's Goal:**
- **Topic:** "${topic}"
- **Details to Include:** "${details || 'None'}"
- **Inspirational Style Keywords:** "${styleDescription}"
- **Style Influence Level:** ${styleInfluence}/100 (where 100 means the style is paramount, 50 is a balanced blend).

**Your Task:**
Based on all the above, write a single paragraph. This paragraph is the final prompt for the image AI.
- The final image must contain absolutely no text, words, or letters.
- Weave the essence of the style into the description of the scene.
- Make it vivid, evocative, and detailed.

- **CRITICAL SAFETY RULE & LIKENESS:** If the topic involves a real, recognizable person:
- **1. AVOID PHOTOREALISM:** You MUST frame the prompt as stylized/artistic (e.g., 'artistic illustration,' 'pop-art portrait').
- **2. DO NOT USE THE NAME:** You are strictly forbidden to use the person's actual name.
- **3. DESCRIBE FEATURES:** INSTEAD of using the name, describe key features for likeness (e.g., 'a political figure with distinctive blonde hair and a red suit').

Output ONLY the final prompt paragraph, and nothing else.`;

    // Step 4a: Generate the optimized prompt using Gemini
    const promptGenResponse = await genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: masterPromptForGemini,
    });
    
    const finalImagePrompt = promptGenResponse.text?.trim();
    if (!finalImagePrompt) throw new Error("Failed to generate optimized image prompt.");

    // Step 4b: Generate the image using Imagen
    const imageGenResponse = await genAI.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: finalImagePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1', // Square format suitable for most social media
        },
    });

    // Step 4c: Extract the Base64 image data
    // Safely access the generated image bytes
    const generatedImage = imageGenResponse.generatedImages?.[0]?.image;
    if (generatedImage?.imageBytes) {
        // Return as a Data URL for easy display on the frontend
        return `data:image/png;base64,${generatedImage.imageBytes}`;
    } else {
        console.error("Image generation failed. Final prompt sent to Imagen:", finalImagePrompt);
        console.error("API Response:", JSON.stringify(imageGenResponse, null, 2));
        throw new Error("Image generation failed (Imagen). This might be due to safety filters. Please adjust your topic/details.");
    }
};


// --- Express Route Handler ---
export const generateImageContentRoute = async (req: Request, res: Response) => {
    try {
        // Multer middleware adds the file buffer to req.file (handled in index.ts)
        const sourceImage = req.file;
        // Other form fields (sent as strings in multipart/form-data) are in req.body
        const { topic, details, styleInfluence, withTextOverlay } = req.body;

        if (!sourceImage) {
            return res.status(400).json({ error: 'Source image file is required.' });
        }
        if (!topic || styleInfluence === undefined) {
            return res.status(400).json({ error: 'Topic and Style Influence are required.' });
        }

        // Convert string inputs to correct types
        const influence = parseInt(styleInfluence, 10);
        // Check if the string value is 'true'
        const includeText = withTextOverlay === 'true';

        console.log("Starting Image Content Pipeline...");

        // Execute the pipeline concurrently where possible
        const styleDescriptionPromise = analyzeImageStyle(sourceImage.buffer, sourceImage.mimetype);
        const postsPromise = generateSocialPosts(topic, details);
        
        // Headline depends on user choice
        const headlinePromise = includeText 
            ? generateImageHeadline(topic, details)
            : Promise.resolve(null);

        // Wait for style analysis before starting image generation
        const styleDescription = await styleDescriptionPromise;
        
        // Start image generation (depends on style analysis)
        const imagePromise = generateNewImage(styleDescription, topic, details, influence);

        // Wait for all processes to complete
        const [imageUrl, posts, headline] = await Promise.all([imagePromise, postsPromise, headlinePromise]);

        // Return the complete result package
        return res.status(200).json({
            result: {
                imageUrl,
                posts,
                headline
            }
        });

    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/generate-image-content ---', error.message);
        return res.status(500).json({ error: error.message || 'An internal server error occurred during image content generation.' });
    }
};