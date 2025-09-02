// File: backend/src/routes/generate-content.ts
import { Request, Response } from 'express';
import { genAI } from '../services';

// Helper function to extract a JSON array string from a raw model response
const cleanJsonArrayString = (rawString: string): string => {
    const firstBracket = rawString.indexOf('[');
    const lastBracket = rawString.lastIndexOf(']');
    if (firstBracket === -1 || lastBracket === -1) {
        return '[]';
    }
    return rawString.substring(firstBracket, lastBracket + 1);
};

const GEMINI_MODEL = 'gemini-2.5-flash';

const SCRIPT_GENERATION_TEMPLATE = `
You are an expert video scriptwriter specializing in short-form, vertical content (TikTok, Reels, Shorts). Use the provided viral analysis blueprint to write a new video script.

Source Analysis Blueprint (Reference DNA):
\${ANALYSIS_JSON}

New Topic: \${USER_TOPIC}

Instructions:
1. Create a complete short-form script (approx. 35-80 seconds).
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
1. Storyboard the New Topic for a short-form video (35-80 seconds), breaking it down into 5-10 distinct scenes.
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

export const generateContentRoute = async (req: Request, res: Response) => {
    try {
        const { topic, outputType, analysis } = req.body;
        if (!topic || !outputType || !analysis) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        const analysisString = JSON.stringify(analysis);
        let generationPrompt = '';

        if (outputType === 'Script') {
            generationPrompt = SCRIPT_GENERATION_TEMPLATE
                .replace('${ANALYSIS_JSON}', analysisString)
                .replace('${USER_TOPIC}', topic);
        } else { // AI Video Prompts
            generationPrompt = VEO_GENERATION_TEMPLATE
                .replace('${ANALYSIS_JSON}', analysisString)
                .replace('${USER_TOPIC}', topic);
        }

        const result = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
        });

        const generationText = result.text ?? '';

        if (!generationText) {
            return res.status(500).json({ error: 'AI generation returned an empty response.' });
        }

        let finalContent;
        if (outputType === 'AI Video Prompts') {
             try {
                const cleanedText = cleanJsonArrayString(generationText);
                finalContent = JSON.parse(cleanedText);
            } catch (parseError) {
                console.error("Failed to parse VEO prompts JSON. Raw Text:", generationText, parseError);
                return res.status(500).json({ error: 'Failed to generate structured VEO prompts.' });
            }
        } else {
            finalContent = generationText;
        }

        return res.status(200).json({ content: finalContent });

    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/generate-content ---', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
