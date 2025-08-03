// File: /api/generate.ts
// This is a Vercel Serverless Function that securely handles Gemini API calls.

// Corrected import to use the full backend SDK
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// By default, the Google AI library will automatically look for an
// environment variable named GOOGLE_API_KEY. We don't need to pass it manually.
const genAI = new GoogleGenerativeAI();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Handle CORS preflight request for browser security
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Set CORS headers for the main request
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get the data from the frontend request body
    const { topic, outputDetail, outputType, videoSource } = req.body;

    // --- Input Validation ---
    if (!topic || !outputDetail || !outputType || !videoSource) {
      return res.status(400).json({ error: 'Missing required fields in request.' });
    }

    // --- Prompt Engineering ---
    let prompt = '';
    if (outputType === 'Script & Analysis') {
      prompt = `Create a viral video script.
      - Topic: "${topic}"
      - Format: ${outputDetail}
      - Inspired by this video: ${videoSource}
      
      Generate a complete script with a hook, main points, and a call to action.`;
    } else { // AI Video Prompts
      prompt = `Create a series of AI video prompts for a tool like Google Veo.
      - Topic: "${topic}"
      - Format: ${outputDetail}
      - Inspired by this video: ${videoSource}

      Generate 5-7 distinct, detailed prompts that form a cohesive narrative.`;
    }

    // --- AI Model Call ---
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // --- Send Success Response ---
    return res.status(200).json({ result: text });

  } catch (error: any) {
    console.error('--- FATAL ERROR in /api/generate ---');
    console.error('Error Message:', error.message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
