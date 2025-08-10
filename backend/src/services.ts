// File: backend/src/services.ts

import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenAI } from '@google/genai';
import pLimit from 'p-limit';
import dotenv from 'dotenv';

dotenv.config();

// --- Environment Variables ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GOOGLE_CLOUD_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'vyralize-backend';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// --- Validations (keep your existing checks) ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('FATAL: Missing Supabase environment variables.');
}
if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
  throw new Error('FATAL: Missing Google Cloud project or location configuration.');
}
if (!GOOGLE_API_KEY) {
  throw new Error('FATAL: Missing GOOGLE_API_KEY for the Gemini File API.');
}

// --- Clients (unchanged + Vertex + helpers) ---
export const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

console.log(`[VertexAI] project=${GOOGLE_CLOUD_PROJECT} location=${GOOGLE_CLOUD_LOCATION}`);
export const vertexAI = new VertexAI({
  project: GOOGLE_CLOUD_PROJECT,
  location: GOOGLE_CLOUD_LOCATION,
});

export const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY! });

// ---- Quota-safety helpers ----

// Serialize image requests so a single user click can’t burst your small per-minute quota.
// If you raise quota later, you can use pLimit(2..5).
export const imageQueue = pLimit(1);

// Simple exponential backoff for 429/RESOURCE_EXHAUSTED from Vertex AI.
export async function withBackoff<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 500; // ms
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = Number(err?.code ?? err?.status);
      const msg = String(err?.message || '');
      const isQuota = code === 429 || /RESOURCE_EXHAUSTED|Too Many Requests/i.test(msg);
      if (!isQuota || i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('Backoff exhausted');
}
