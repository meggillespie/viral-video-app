// File: backend/src/routes/generate-image-content.ts

import { Request, Response } from 'express';
import { vertexAI } from '../services';
// FIX: Import Part, Tool, AND SchemaType from @google-cloud/vertexai
import { Part, Tool, SchemaType } from '@google-cloud/vertexai';

const GEMINI_MODEL = 'gemini-2.5-flash';
const IMAGEN_MODEL = 'imagegeneration@006';

// FIX: Use SchemaType enum for the type definitions
const socialPostsTool: Tool = {
    functionDeclarations: [{
        name: "generate_social_posts",
        description: "Generates social media posts for different platforms.",
        parameters: {
            // FIX: Use SchemaType.OBJECT instead of "OBJECT"
            type: SchemaType.OBJECT,
            properties: {
                // FIX: Use SchemaType.STRING instead of "STRING"
                linkedin: { type: SchemaType.STRING, description: "A professional post suitable for LinkedIn (150-300 words)." },
                twitter: { type: SchemaType.STRING, description: "A concise, engaging tweet (max 280 characters)." },
                instagram: { type: SchemaType.STRING, description: "An inspiring caption for Instagram, including relevant hashtags." },
            },
            required: ["linkedin", "twitter", "instagram"]
        }
    }]
};

const geminiVisionModel = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
const geminiTextModel = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
const geminiJsonModel = vertexAI.getGenerativeModel({ model: GEMINI_MODEL, tools: [socialPostsTool] });
const imagenModel = vertexAI.getGenerativeModel({ model: IMAGEN_MODEL });

const analyzeImageStyle = async (imageBuffer: Buffer, mimeType: string): Promise<string> => {
    // FIX: Use Part type
    const imagePart: Part = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };
    const prompt = `Analyze this image's visual style and provide a comma-separated list of keywords. Focus on Aesthetic, Color Palette, and Composition. Example: minimalist, professional, blue and white, centered.`;
    const result = await geminiVisionModel.generateContent({ contents: [{ role: "user", parts: [imagePart, { text: prompt }] }] });
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
};

const generateImageHeadline = async (topic: string, details: string): Promise<string | null> => {
    const prompt = `Generate a punchy, 8-word max headline for an image about this topic. Topic: "${topic}". Details: "${details || 'None'}". Provide only the headline.`;
    const result = await geminiTextModel.generateContent(prompt);
    return result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
};

const generateSocialPosts = async (topic: string, details: string): Promise<object> => {
    const prompt = `Generate social media posts for LinkedIn, Twitter, and Instagram based on this topic. Topic: "${topic}". Details: "${details || 'None'}".`;
    const result = await geminiJsonModel.generateContent(prompt);
    const functionCall = result.response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    if (functionCall?.args) {
        return functionCall.args;
    }
    throw new Error("Failed to generate social posts JSON.");
};

const generateNewImage = async (styleDescription: string, topic: string, details: string, styleInfluence: number): Promise<string> => {
    // The logic fix from the previous step remains here
    const masterPromptForGemini = `Create an optimized prompt for an image generation model (like Imagen).
The image should be about the Topic and Details provided, and strictly adhere to the Style Description.

Topic: ${topic}
Details: ${details || 'None'}
Style Description (MUST follow): ${styleDescription}

Provide only the optimized image generation prompt.`;

    const promptGenResult = await geminiTextModel.generateContent(masterPromptForGemini);
    const finalImagePrompt = promptGenResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!finalImagePrompt) throw new Error("Failed to generate optimized image prompt.");
    
    const imageGenResult = await imagenModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: finalImagePrompt }] }]
    });

    // Handle the response from Imagen
    const imageCandidate = imageGenResult.response.candidates?.[0]?.content?.parts?.[0];

    if(imageCandidate?.inlineData?.data){
         const b64 = imageCandidate.inlineData.data;
         const mime = imageCandidate.inlineData.mimeType;
         return `data:${mime};base64,${b64}`;
    }
    
    if (imageCandidate?.fileData?.fileUri) {
        console.warn("Imagen returned a GCS URI. Further handling might be required.");
        // Handle GCS URI if necessary
    }

    throw new Error("Image generation failed (Imagen) - no data returned.");
};


// --- Express Route Handler ---
export const generateImageContentRoute = async (req: Request, res: Response) => {
    try {
        const sourceImage = req.file;
        const { topic, details, styleInfluence, withTextOverlay } = req.body;

        if (!sourceImage) return res.status(400).json({ error: 'Source image file is required.' });
        if (!topic || styleInfluence === undefined) return res.status(400).json({ error: 'Topic and Style Influence are required.' });

        const influence = parseInt(styleInfluence, 10);
        const includeText = withTextOverlay === 'true';

        console.log("Starting Image Content Pipeline...");
        
        const styleDescription = await analyzeImageStyle(sourceImage.buffer, sourceImage.mimetype);

        const [posts, headline] = await Promise.all([
            generateSocialPosts(topic, details),
            includeText ? generateImageHeadline(topic, details) : Promise.resolve(null)
        ]);
        
        const imageUrl = await generateNewImage(styleDescription, topic, details, influence);

        return res.status(200).json({ result: { imageUrl, posts, headline } });
    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/generate-image-content ---', error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
};