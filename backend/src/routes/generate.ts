// File: backend/src/routes/generate.ts

import { Request, Response } from 'express';
// UPDATED: Import GenerationConfig type for type safety
import { Part, GenerationConfig } from '@google/genai';
import { genAI } from '../services';

// --- Refined Prompts ---
// (Prompts remain the same as the previous iteration)
const ANALYSIS_PROMPT = `
You are Vyralize, an expert AI system designed to deconstruct the virality of video content. Analyze the provided source video (multimodal input: visuals, audio, pacing, transcript) and extract key performance signals.

Output the analysis strictly as a structured JSON object. Do NOT include any introductory text or markdown formatting.

The JSON structure must adhere to the following schema:
{
  "meta": {
    "analyzed_style": "e.g., Fast-paced explainer, Vlog, Documentary, Tutorial",
    "primary_tone": "e.g., Energetic, Authoritative, Humorous, Empathetic"
  },
  "hook_analysis": {
    "technique": "Describe the specific technique used in the first 3-5 seconds.",
    "pacing": "Describe the editing speed and information density of the hook.",
    "emotional_trigger": "Identify the immediate emotion evoked (e.g., Curiosity, Surprise, FOMO)."
  },
  "retention_signals": {
    "pacing_strategy": "Analyze the overall pacing. How frequently do shots change? How is B-roll used?",
    "narrative_structure": "Identify the narrative arc (e.g., Problem-Solution-Result, Listicle, Storytelling Arc).",
    "visual_style": "Describe the aesthetic (e.g., Cinematic, Lo-fi, Raw Vlog, High-Contrast, Saturated)."
  },
  "engagement_tactics": {
    "ctas": ["List specific Calls to Action used (verbal or visual)."],
    "interactive_elements": "Describe elements encouraging comments/likes."
  }
}
`;

const SCRIPT_GENERATION_TEMPLATE = `
You are an expert video scriptwriter. Use the provided viral analysis blueprint to write a new video script.

Source Analysis Blueprint (Reference DNA):
\${ANALYSIS_JSON}

New Topic: \${USER_TOPIC}
Desired Format: \${OUTPUT_DETAIL}

Instructions:
1. Create a complete script for the New Topic.
2. You MUST adapt the techniques identified in the Blueprint to the new script.
3. Hook: Replicate the style described in 'hook_analysis.technique' and 'hook_analysis.pacing'.
4. Pacing and Structure: Mirror the 'retention_signals.narrative_structure'.
5. Tone: Adopt the 'meta.primary_tone'.

Format the output as a script, including clear markers for [Visuals/B-Roll suggestions] and (Audio/Tone cues).
`;

const VEO_GENERATION_TEMPLATE = `
You are an AI Video Director. Create a sequence of highly detailed visual prompts optimized for the Google VEO text-to-video API. Use the provided viral analysis as a stylistic blueprint.

Source Analysis Blueprint:
\${ANALYSIS_JSON}

New Topic: \${USER_TOPIC}
Desired Format: \${OUTPUT_DETAIL}

Instructions:
1. Storyboard the New Topic, breaking it down into a sequence of distinct scenes (5-8 scenes for Short Form, 8-15 for Long Form).
2. Ensure the narrative flow matches the 'retention_signals.narrative_structure'.
3. The visual aesthetic MUST match 'retention_signals.visual_style'.

VEO Prompt Requirements:
- Be highly specific and visual.
- Describe lighting, camera angle (e.g., Close-up, Wide shot, Drone shot, POV), action, subject, setting, and mood.
- Example style: "Cinematic shot, golden hour lighting. Wide shot of [subject] doing [action]. [Visual Style details]. Slow motion, high detail, 4k."

Output Format:
Return the result strictly as a JSON array of strings. Do NOT include any introductory or concluding text.
Example: ["Prompt for scene 1...", "Prompt for scene 2..."]
`;


export const generateRoute = async (req: Request, res: Response) => {
    try {
        const { topic, outputDetail, outputType, videoSource, mimeType } = req.body;

        if (!topic || !outputDetail || !outputType || !videoSource || !mimeType) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        const videoPart: Part = {
            fileData: {
                mimeType: mimeType,
                fileUri: videoSource,
            },
        };

        // --- Phase 1: Viral Analysis ---
        console.log('Starting Phase 1: Analysis');

        // FIX: Define the generationConfig conforming to the SDK types
        const analysisConfig: GenerationConfig = {
            responseMimeType: "application/json"
        };
        
        const analysisResponse = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: "user", parts: [{ text: ANALYSIS_PROMPT }, videoPart] }],
            // FIX: Pass the configuration as the 'config' property to resolve TS2353
            config: analysisConfig 
        });

        const analysisText = analysisResponse.text;

        // FIX: Check if text is undefined to resolve TS18048 (Strict Null Check)
        if (!analysisText) {
            console.error("Analysis response was empty.");
            return res.status(500).json({ error: 'AI analysis returned an empty response (Phase 1).' });
        }

        let analysisJson;
        try {
            const cleanAnalysisText = analysisText.replace(/```json|```/g, '').trim();
            analysisJson = JSON.parse(cleanAnalysisText);
        } catch (parseError) {
            console.error("Failed to parse analysis JSON:", analysisText);
            return res.status(500).json({ error: 'Failed to analyze video structure (Phase 1).' });
        }

        // --- Phase 2: Content Generation ---
        console.log('Starting Phase 2: Generation');
        let generationPrompt = '';
        let responseMimeType: "text/plain" | "application/json" = 'text/plain';

        if (outputType === 'Script & Analysis') {
            generationPrompt = SCRIPT_GENERATION_TEMPLATE
                .replace('${ANALYSIS_JSON}', JSON.stringify(analysisJson))
                .replace('${USER_TOPIC}', topic)
                .replace('${OUTPUT_DETAIL}', outputDetail);
        } else { // AI Video Prompts
            responseMimeType = 'application/json';
            generationPrompt = VEO_GENERATION_TEMPLATE
                .replace('${ANALYSIS_JSON}', JSON.stringify(analysisJson))
                .replace('${USER_TOPIC}', topic)
                .replace('${OUTPUT_DETAIL}', outputDetail);
        }

        // FIX: Define the generationConfig conforming to the SDK types
        const generationConfig: GenerationConfig = {
            responseMimeType: responseMimeType
        };

        const generationResponse = await genAI.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
            // FIX: Pass the configuration as the 'config' property to resolve TS2353
            config: generationConfig
        });

        const generationText = generationResponse.text;

        // FIX: Check if text is undefined to resolve TS18048 (Strict Null Check)
        if (!generationText) {
            console.error("Generation response was empty.");
            return res.status(500).json({ error: 'AI generation returned an empty response (Phase 2).' });
        }

        // --- Output Formatting ---
        let finalContent;
        if (outputType === 'Script & Analysis') {
            finalContent = generationText;
        } else {
            try {
                const cleanGenerationText = generationText.replace(/```json|```/g, '').trim();
                finalContent = JSON.parse(cleanGenerationText);
            } catch (parseError) {
                console.error("Failed to parse generation JSON:", generationText);
                return res.status(500).json({ error: 'Failed to generate structured VEO prompts (Phase 2).' });
            }
        }

        return res.status(200).json({
            result: {
                analysis: analysisJson,
                content: finalContent
            }
        });

    } catch (error: any) {
        console.error('--- FATAL ERROR in /api/generate ---', error.message);
        return res.status(500).json({ error: 'An internal server error occurred during generation.' });
    }
};