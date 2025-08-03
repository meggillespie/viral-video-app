// File: /api/generate.ts
// This version uses the correct syntax and initialization for the '@google/genai' package.

import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Manually pass the API key from the secure environment variable to the constructor.
// This is the most robust way to initialize the client in a serverless environment.
const ai = new GoogleGenAI(process.env.GOOGLE_API_KEY || '');

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { topic, outputDetail, outputType, videoSource } = req.body;

    if (!topic || !outputDetail || !outputType || !videoSource) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // --- Prompt Engineering (Text Part) ---
    let textPrompt = '';
    if (outputType === 'Script & Analysis') {
      textPrompt = `Analyze the provided video's key elements (hook, pacing, style, etc.). Then, using those 'viral' elements as inspiration, generate a complete ${outputDetail} video script for the topic of '${topic}'. The script should include a strong hook, clear sections, and calls to action.`;
    } else { // AI Video Prompts
      textPrompt = `Analyze the provided video's key elements (hook, pacing, style, etc.). Then, using those 'viral' elements as inspiration, generate a series of 5-7 distinct, detailed AI video prompts for a tool like Google Veo. The prompts should cover the topic of '${topic}' in a ${outputDetail} format and form a cohesive narrative.`;
    }

    // --- Multimodal Input (Video Part) ---
    const videoPart = {
      fileData: {
        mimeType: 'video/youtube', // Assuming YouTube for now
        fileUri: videoSource,
      },
    };

    // --- CORRECT API Call using the '@google/genai' syntax ---
    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: textPrompt }, videoPart] }],
    });

    // --- Send Success Response ---
    return res.status(200).json({ result: response.text });

  } catch (error: any) {
    console.error('--- FATAL ERROR in /api/generate ---');
    console.error('Error Message:', error.message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
