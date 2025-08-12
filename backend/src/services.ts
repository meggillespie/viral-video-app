// File: backend/src/services.ts

import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// --- Environment Variables ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'vyralize-backend';
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-east4';
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

export const vertexAI = new VertexAI({
  project: GOOGLE_CLOUD_PROJECT,
  location: GOOGLE_CLOUD_LOCATION,
});

export const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY! });

// ---- Quota-safety helpers ----

// Dependency-free replacement for p-limit (Concurrency = 1)
// This serializes requests to prevent quota bursts using a Promise chain.
class SimpleQueue {
    private queue: Promise<any> = Promise.resolve();

    add<T>(task: () => Promise<T>): Promise<T> {
        const previous = this.queue;
        const execute = () => task();
        // The new task waits for the previous one to finish (using finally).
        const current = previous.finally(execute);
        this.queue = current;
        return current;
    }
}

const imageQueueInstance = new SimpleQueue();

// Export the queue function wrapper (maintains the same interface as p-limit)
export const imageQueue = <T>(task: () => Promise<T>): Promise<T> => imageQueueInstance.add(task);


// Simple exponential backoff for 429/RESOURCE_EXHAUSTED from Vertex AI.
// Updated strategy to handle extremely low default quotas (e.g., 1-5 RPM).
export async function withBackoff<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  // Start with a significant delay, as per-minute quotas take time to reset.
  let delay = 8000; // 8 seconds
  const growthFactor = 1.8; // Slower growth factor (8s, 14.4s, 25.9s, ...)

  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = Number(err?.code ?? err?.status);
      const msg = String(err?.message || '');
      // Check specifically for the 429 error code or messages indicating quota exhaustion.
      const isQuota = code === 429 || /RESOURCE_EXHAUSTED|Too Many Requests|Quota exceeded/i.test(msg);
      
      if (!isQuota || i === tries - 1) {
        // If it's not a quota error, or if we've run out of tries, fail immediately.
        if (isQuota) {
            console.error(`[Backoff Exhausted] Quota error persisted after ${tries} attempts. Failing request. Model may be overloaded or quota is too low.`);
        }
        throw err;
      }
      
      // Log the backoff event so it's visible in Cloud Logging.
      console.warn(`[Attempt ${i+1}/${tries}] Quota hit (429/Resource Exhausted). Backing off for ${(delay/1000).toFixed(1)}s. Error: ${msg}`);
      
      // Wait for the delay duration.
      await new Promise((r) => setTimeout(r, delay));
      
      // Increase the delay for the next attempt.
      delay *= growthFactor;
    }
  }
  // This line is technically unreachable because the loop throws on the last iteration.
  throw new Error('Backoff exhausted');
}