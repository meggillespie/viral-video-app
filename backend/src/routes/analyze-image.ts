// File: backend/src/routes/analyze-image.ts

import { Request, Response } from 'express';
import { Part } from '@google-cloud/vertexai';
// UPDATE: Import the regional client
import { vertexAIRegional } from '../services';

const GEMINI_MODEL = 'gemini-2.5-flash';

// Define the structure based on the PDF requirements
export interface ImageAnalysis {
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


// The analysis prompt requested in the PDF (Step 1).
const ANALYSIS_PROMPT_INSTRUCTIONS = `
You are an expert image analyst. Analyze the user-uploaded image and return a JSON object with the following schema. Be as detailed and specific as possible in your descriptions.

Do NOT include any introductory text or markdown formatting. The output must be strictly JSON.

The JSON schema:
{
  "subjects": [
    {
      "name": "string", // Name of the primary person, object, or character. If unknown, use a descriptive title like "Man in a suit".
      "description": "string", // Detailed description of the subject's appearance, clothing, action, and expression.
      "prominence": "string" // e.g., "primary", "secondary", "background"
    }
  ],
  "setting": {
    "location": "string", // e.g., "Outdoors, lush forest", "Indoor, political rally stage"
    "time_of_day": "string", // e.g., "Daytime", "Golden Hour", "Night"
    "context": "string" // What is happening in the scene? e.g., "A tense political speech", "A quiet moment of reflection"
  },
  "style_elements": {
    "artistic_medium": "string", // e.g., "Digital Photograph", "Oil Painting", "3D Render", "Watercolor"
    "photography_style": "string", // If a photo. e.g., "Candid shot", "News photography", "Macro photography", "Portrait", "Vintage photo"
    "lighting": "string", // e.g., "Harsh direct flash", "Soft natural light", "Dramatic chiaroscuro", "Rim lighting"
    "color_palette": {
      "dominant_colors": ["hex_code_1", "hex_code_2"],
      "description": "string" // e.g., "High contrast, saturated reds and blues, stark whites", "Muted earth tones", "Vibrant pastels"
    },
    "composition": "string", // e.g., "Medium close-up", "Rule of thirds", "Centered subject", "Dutch angle", "Leading lines"
    "overall_mood": "string" // e.g., "Energetic and tense", "Calm and serene", "Joyful and celebratory", "Mysterious"
  }
}
`;


export const analyzeImageRoute = async (req: Request, res: Response) => {
    try {
        // Handle Image Upload (Assumes Multer or similar middleware is configured for this route)
        const sourceImage: any =
            (req as any).file ||
            (req as any).files?.sourceImage ||
            (Array.isArray((req as any).files) ? (req as any).files[0] : undefined);

        if (!sourceImage) return res.status(400).json({ error: 'Source image file is required.' });

        // Prepare Image Buffer
        const buf: Buffer =
            sourceImage.buffer ||
            sourceImage.data ||
            (typeof sourceImage.arrayBuffer === 'function'
                ? Buffer.from(await sourceImage.arrayBuffer())
                : undefined);

        if (!buf) return res.status(400).json({ error: 'Could not read uploaded image.' });
        const mimeType = sourceImage.mimetype || 'image/png';

        console.log("[Image Analysis] Starting Analysis via Vertex AI...");

        // Configure the model for JSON output.
        // UPDATE: Use the Regional client
        const model = vertexAIRegional.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const imagePart: Part = {
            inlineData: {
                data: buf.toString('base64'),
                mimeType: mimeType,
            },
        };

        // The prompt structure is [Instructions, Image to Analyze]
        const response = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: ANALYSIS_PROMPT_INSTRUCTIONS }, imagePart] }],
        });

        const text = response.response?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '{}';

        try {
            const parsed: ImageAnalysis = JSON.parse(text);
            // Basic validation of the structure
            if (!parsed.subjects || !parsed.setting || !parsed.style_elements) {
                console.error("Analysis JSON did not meet the required schema:", text);
                throw new Error("Analysis JSON did not meet the required schema.");
            }
            return res.status(200).json({ analysis: parsed });
        } catch (error) {
            console.error("Style analysis failed or returned invalid JSON:", text, error);
            return res.status(500).json({ error: 'Failed to analyze image structure or returned invalid JSON.' });
        }

    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/analyze-image ---', error);
        const code = Number(error?.code || error?.status) || 500;
        let message = error?.message || 'An internal server error occurred during analysis.';

        if (code === 429 || /RESOURCE_EXHAUSTED|Too Many Requests|Quota exceeded/i.test(message)) {
            message = "The service is currently overloaded (429). Please wait and try again.";
        }

        return res.status(code >= 400 && code < 600 ? code : 500).json({ error: message });
    }
};