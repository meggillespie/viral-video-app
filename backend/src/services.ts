// File: backend/src/services.ts

import { createClient } from '@supabase/supabase-js';
// FIX: Import VertexAI from the correct package
import { VertexAI } from '@google-cloud/vertexai';
// FIX: Import the correct class (GoogleGenAI) from the modern @google/genai package
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// --- Environment Variables ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'vyralize-backend';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// --- Validations ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("FATAL: Missing Supabase environment variables.");
}
if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
    throw new Error("FATAL: Missing Google Cloud project or location configuration.");
}
if (!GOOGLE_API_KEY) {
    throw new Error("FATAL: Missing GOOGLE_API_KEY for the Gemini File API.");
}

// --- Client Exports ---
export const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

// FIX: Initialize VertexAI (This uses Google Cloud credentials, e.g., Service Account)
export const vertexAI = new VertexAI({
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
});

// FIX: Initialize GoogleGenAI with the API key in the options object
export const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY! });