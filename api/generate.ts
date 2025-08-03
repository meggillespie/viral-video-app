// File: /api/generate.ts
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialization
const API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// --- Refined Prompts (Inserted) ---

const ANALYSIS_PROMPT = `
You are VideoDNA, an expert AI system designed to deconstruct the virality of video content. Analyze the provided source video (multimodal input: visuals, audio, pacing, transcript) and extract key performance signals.

Output the analysis strictly as a structured JSON object. Do NOT include any introductory text or markdown formatting.

The JSON structure must adhere to the following schema:
{
  "meta": {
    "analyzed_style": "e.g., Fast-paced explainer, Vlog, Documentary, Tutorial",
    "primary_tone": "e.g., Energetic, Authoritative, Humorous, Empathetic"
  },
  "hook_analysis": {
    "technique": "Describe the specific technique used in the first 3-5 seconds (e.g., 'Visual paradox', 'Direct address challenge', 'Startling fact').",
    "pacing": "Describe the editing speed and information density of the hook (e.g. Fast, many cuts; Slow, establishing shot).",
    "emotional_trigger": "Identify the immediate emotion evoked (e.g., Curiosity, Surprise, FOMO)."
  },
  "retention_signals": {
    "pacing_strategy": "Analyze the overall pacing. How frequently do shots change? How is B-roll used?",
    "narrative_structure": "Identify the narrative arc (e.g., Problem-Solution-Result, Listicle, Storytelling Arc).",
    "visual_style": "Describe the aesthetic (e.g., Cinematic, Lo-fi, Raw Vlog, High-Contrast, Saturated)."
  },
  "engagement_tactics": {
    "ctas": ["List specific Calls to Action used (verbal or visual)."],
    "interactive_elements": "Describe elements encouraging comments/likes (e.g., Poll suggestions, asking open-ended questions)."
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


export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // (CORS and Method checks remain the same)
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { topic, outputDetail, outputType, videoSource, mimeType } = req.body;

    if (!topic || !outputDetail || !outputType || !videoSource || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // --- Input Preparation ---
    // Gemini API handles both YouTube URLs and File API URIs using the fileData structure.
    const videoPart: Part = {
      fileData: {
        mimeType: mimeType,
        fileUri: videoSource, // This is either a Gemini URI (from transfer) or a YouTube URL
      },
    };

    // --- Phase 1: Viral Analysis ---
    console.log('Starting Phase 1: Analysis');
    // Configure model for JSON output
    const analysisModel = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: "application/json" }
    });

    const analysisResult = await analysisModel.generateContent([
        { text: ANALYSIS_PROMPT },
        videoPart
    ]);

    const analysisText = analysisResult.response.text();

    // Clean and Parse the JSON response
    let analysisJson;
    try {
        // Clean potential markdown residue just in case
        const cleanAnalysisText = analysisText.replace(/```json|```/g, '').trim();
        analysisJson = JSON.parse(cleanAnalysisText);
    } catch (parseError) {
        console.error('Failed to parse Analysis JSON:', analysisText);
        return res.status(500).json({ error: 'Failed to analyze video structure (Phase 1).' });
    }

    // --- Phase 2: Content Generation ---
    console.log('Starting Phase 2: Generation');
    let generationPrompt = '';
    let generationMimeType = 'text/plain'; // Default for script

    if (outputType === 'Script & Analysis') {
        generationPrompt = SCRIPT_GENERATION_TEMPLATE
            .replace('${ANALYSIS_JSON}', JSON.stringify(analysisJson))
            .replace('${USER_TOPIC}', topic)
            .replace('${OUTPUT_DETAIL}', outputDetail);
    } else { // AI Video Prompts
        generationMimeType = 'application/json'; // Set to JSON for VEO prompts
        generationPrompt = VEO_GENERATION_TEMPLATE
            .replace('${ANALYSIS_JSON}', JSON.stringify(analysisJson))
            .replace('${USER_TOPIC}', topic)
            .replace('${OUTPUT_DETAIL}', outputDetail);
    }

    // Configure model for the generation output type
    const generationModel = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: generationMimeType }
    });

    const generationResult = await generationModel.generateContent(generationPrompt);
    const generationText = generationResult.response.text();

    // --- Output Formatting ---
    let finalContent;
    if (outputType === 'Script & Analysis') {
        finalContent = generationText;
    } else {
        // Parse the VEO prompts JSON array
        try {
            const cleanGenerationText = generationText.replace(/```json|```/g, '').trim();
            finalContent = JSON.parse(cleanGenerationText);
        } catch (parseError) {
            console.error('Failed to parse VEO Prompts JSON:', generationText);
            return res.status(500).json({ error: 'Failed to generate structured VEO prompts (Phase 2).' });
        }
    }

    // Return structured data
    return res.status(200).json({
        result: {
            analysis: analysisJson,
            content: finalContent
        }
    });

  } catch (error: any) {
    console.error('--- FATAL ERROR in /api/generate ---');
    console.error('Error Message:', error.message);
     // Handle potential timeouts during the AI execution
    if (error.message.includes('timeout') || error.code === 'ECONNRESET') {
        return res.status(504).json({ error: 'The AI generation timed out. Please try again or use a shorter video.' });
    }
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}