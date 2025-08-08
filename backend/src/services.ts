// File: backend/src/services.ts

import { createClient } from '@supabase/supabase-js';
// Import GoogleGenAI from @google/genai
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Environment Variable Validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --- UPDATED GOOGLE CONFIGURATION ---

// We no longer need GOOGLE_API_KEY as we will use Service Account credentials (ADC).
// We need the Project ID and Location for Vertex AI initialization.

// Get Google Cloud project and location from environment variables
// Using defaults based on the logs provided ('vyralize-backend', 'us-central1')
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'vyralize-backend';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';


if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("FATAL: Missing critical environment variables (Supabase).");
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

// Validate Google Cloud configuration
if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
    console.error("FATAL: Missing Google Cloud project or location configuration (GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION).");
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

export const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

// UPDATED: Initialize using Vertex AI authentication instead of apiKey
// When vertexai: true is set, the SDK uses Application Default Credentials (ADC)
// instead of an API key, routing requests through Vertex AI.
export const genAI = new GoogleGenAI({
  vertexai: true,
  project: GOOGLE_CLOUD_PROJECT!,
  location: GOOGLE_CLOUD_LOCATION!,
});