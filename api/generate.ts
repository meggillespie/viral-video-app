// File: /api/generate.ts
// This is a Vercel Serverless Function that securely handles Gemini API calls.

import { GoogleGenerativeAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Enhanced Logging: Check if the API key is available at startup ---
console.log('Function starting up...');
console.log('Is GEMINI_API_KEY available:', !!process.env.GEMINI_API_KEY);

// Initialize the Gemini client with the API key from a secure environment variable.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
    console.log('Received POST request to /api/generate');
    // Get the data from the frontend request body
    const { topic, outputDetail, outputType, videoSource } = req.body;

    // --- Input Validation ---
    if (!topic || !outputDetail || !outputType || !videoSource) {
      console.error('Validation failed: Missing required fields.');
      return res.status(400).json({ error: 'Missing required fields in request.' });
    }
    console.log('Validation passed. Body:', req.body);

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
    console.log('Generated prompt for Gemini.');

    // --- AI Model Call ---
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('Calling Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('Successfully received response from Gemini.');

    // --- Send Success Response ---
    return res.status(200).json({ result: text });

  } catch (error: any) {
    // --- Enhanced Logging: Print the full error object ---
    console.error('--- FATAL ERROR in /api/generate ---');
    console.error('Error Message:', error.message);
    console.error('Full Error Object:', JSON.stringify(error, null, 2));
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
