// File: backend/src/routes/analyze.ts
import { Request, Response } from 'express';
import { Part } from '@google/genai';
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

const ANALYSIS_PROMPT = `
You are Vyralize, an expert AI system designed to deconstruct the virality of video content. Analyze the provided source video (multimodal input: visuals, audio, pacing, transcript) and extract key performance signals. Focus on elements relevant to short-form vertical video.

Output the analysis strictly as a structured JSON object. Do NOT include any introductory text or markdown formatting.

The JSON structure must adhere to the following schema:
{
  "meta": {
    "analyzed_style": "e.g., Fast-paced explainer, Vlog, Tutorial",
    "primary_tone": "e.g., Energetic, Authoritative, Humorous"
  },
  "hook_analysis": {
    "technique": "Describe the specific technique used in the first 3-5 seconds.",
    "pacing": "Describe the editing speed and information density of the hook.",
    "emotional_trigger": "Identify the immediate emotion evoked (e.g., Curiosity, Surprise)."
  },
  "retention_signals": {
    "pacing_strategy": "Analyze the overall pacing. How frequently do shots change?",
    "narrative_structure": "Identify the narrative arc (e.g., Problem-Solution-Result, Listicle).",
    "visual_style": "Describe the aesthetic (e.g., Cinematic, Lo-fi, Raw Vlog)."
  },
  "engagement_tactics": {
    "ctas": ["List specific Calls to Action used (verbal or visual)."],
    "interactive_elements": "Describe elements encouraging comments/likes."
  }
}
`;

const GEMINI_MODEL = 'gemini-2.5-flash';

export const analyzeRoute = async (req: Request, res: Response) => {
    try {
        const { videoSource, mimeType } = req.body;
        if (!videoSource || !mimeType) {
            return res.status(400).json({ error: 'Missing videoSource or mimeType.' });
        }

        const videoPart: Part = {
            fileData: {
                mimeType: mimeType,
                fileUri: videoSource,
            },
        };

        console.log('Starting Analysis via Unified Vertex AI SDK...');

        const result = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: ANALYSIS_PROMPT }, videoPart] }],
        });

        const analysisText = result.text ?? '';

        if (!analysisText) {
            return res.status(500).json({ error: 'AI analysis returned an empty response.' });
        }

        try {
            // FIX: Use the cleaning function before parsing.
            const cleanedText = cleanJsonString(analysisText);
            const analysisJson = JSON.parse(cleanedText);
            return res.status(200).json({ analysis: analysisJson });
        } catch (parseError) {
            console.error("Failed to parse analysis JSON. Raw Text:", analysisText, parseError);
            return res.status(500).json({ error: 'Failed to analyze video structure.' });
        }

    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/analyze ---', error.response?.data || error.message);
        return res.status(500).json({ error: 'An internal server error occurred during analysis.' });
    }
};
