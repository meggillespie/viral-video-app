// File: backend/src/routes/generate-content.ts

import { Request, Response } from 'express';
import { GenerationConfig } from '@google/genai';
import { genAI } from '../services';

// Define the specific model version for Vertex AI compatibility
const GEMINI_MODEL = 'gemini-2.5-flash';

// Updated prompts focusing only on Short Form
const SCRIPT_GENERATION_TEMPLATE = `
You are an expert video scriptwriter specializing in short-form, vertical content (TikTok, Reels, Shorts). Use the provided viral analysis blueprint to write a new video script.

Source Analysis Blueprint (Reference DNA):
\${ANALYSIS_JSON}

New Topic: \${USER_TOPIC}

Instructions:
1. Create a complete short-form script (approx. 45-90 seconds).
2. You MUST adapt the techniques identified in the Blueprint to the new script.
3. Hook: Replicate the style described in 'hook_analysis.technique' and 'hook_analysis.pacing'.
4. Pacing and Structure: Mirror the 'retention_signals.narrative_structure'.
5. Tone: Adopt the 'meta.primary_tone'.

Format the output as a script, including clear markers for [Visuals/B-Roll suggestions] and (Audio/Tone cues).
`;

const VEO_GENERATION_TEMPLATE = `
You are an AI Video Director. Create a sequence of highly detailed visual prompts optimized for the Google VEO text-to-video API for a short-form vertical video. Use the provided viral analysis as a stylistic blueprint.

Source Analysis Blueprint:
\${ANALYSIS_JSON}

New Topic: \${USER_TOPIC}

Instructions:
1. Storyboard the New Topic for a short-form video (45-90 seconds), breaking it down into 5-10 distinct scenes.
2. Ensure the narrative flow matches the 'retention_signals.narrative_structure'.
3. The visual aesthetic MUST match 'retention_signals.visual_style' and be optimized for vertical viewing.

VEO Prompt Requirements:
- Be highly specific and visual.
- Describe lighting, camera angle (e.g., Close-up, POV, Dynamic), action, subject, setting, and mood.
- Example style: "Vertical format, dynamic close-up. [subject] doing [action]. [Visual Style details]. High energy, 4k."

Output Format:
Return the result strictly as a JSON array of strings. Do NOT include any introductory or concluding text.
Example: ["Prompt for scene 1...", "Prompt for scene 2..."]
`;

// Renamed the export to match the file name
export const generateContentRoute = async (req: Request, res: Response) => {
    try {
        // Updated inputs: Expects analysis JSON and topic, not video source
        const { topic, outputType, analysis } = req.body;

        if (!topic || !outputType || !analysis) {
            return res.status(400).json({ error: 'Missing required fields (topic, outputType, or analysis).' });
        }

        console.log('Starting Generation...');
        let generationPrompt = '';
        let responseMimeType: "text/plain" | "application/json" = 'text/plain';

        // Serialize the analysis JSON received from the client
        const analysisString = JSON.stringify(analysis);

        if (outputType === 'Script') {
            generationPrompt = SCRIPT_GENERATION_TEMPLATE
                .replace('${ANALYSIS_JSON}', analysisString)
                .replace('${USER_TOPIC}', topic);
        } else { // AI Video Prompts
            responseMimeType = 'application/json';
            generationPrompt = VEO_GENERATION_TEMPLATE
                .replace('${ANALYSIS_JSON}', analysisString)
                .replace('${USER_TOPIC}', topic);
        }

        const generationConfig: GenerationConfig = {
            responseMimeType: responseMimeType
        };

        const generationResponse = await genAI.models.generateContent({
            // UPDATED: Use the specific versioned model name
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
            config: generationConfig
        });

        const generationText = generationResponse.text;

        if (!generationText) {
            console.error("Generation response was empty.");
            return res.status(500).json({ error: 'AI generation returned an empty response.' });
        }

        // --- Output Formatting ---
        let finalContent;
        if (outputType === 'Script') {
            finalContent = generationText;
        } else {
            try {
                const cleanGenerationText = generationText.replace(/```json|```/g, '').trim();
                finalContent = JSON.parse(cleanGenerationText);
            } catch (parseError) {
                console.error("Failed to parse generation JSON:", generationText);
                return res.status(500).json({ error: 'Failed to generate structured VEO prompts.' });
            }
        }

        // Return the generated content
        return res.status(200).json({
            content: finalContent
        });

    } catch (error: any) {
        // UPDATED: Log the entire error object for better debugging
        console.error('--- FATAL ERROR in /api/generate-content ---', error);
        return res.status(500).json({ error: 'An internal server error occurred during generation.' });
    }
};