// File: backend/src/services.ts

import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenAI } from '@google/genai';
// import pLimit from 'p-limit'; // REMOVED due to ESM issues
import dotenv from 'dotenv';

dotenv.config();

// --- Environment Variables ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'vyralize-backend';
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

// console.log(`[VertexAI] project=${GOOGLE_CLOUD_PROJECT} location=${GOOGLE_CLOUD_LOCATION}`);
export const vertexAI = new VertexAI({
  project: GOOGLE_CLOUD_PROJECT,
  location: GOOGLE_CLOUD_LOCATION,
});

export const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY! });

// ---- Quota-safety helpers ----

// FIX: Dependency-free replacement for p-limit (Concurrency = 1)
// This serializes requests to prevent quota bursts using a Promise chain.
class SimpleQueue {
    private queue: Promise<any> = Promise.resolve();

    add<T>(task: () => Promise<T>): Promise<T> {
        // Capture the state of the queue when the task is added
        const previous = this.queue;

        // The execution logic for the new task
        const execute = () => task();

        // The new task waits for the previous one to finish (using finally) before executing.
        // 'finally' ensures the next task runs even if the previous one failed.
        const current = previous.finally(execute);

        // Update the internal queue pointer to the new task
        this.queue = current;

        // Return the promise representing the current task's completion
        return current;
    }
}

const imageQueueInstance = new SimpleQueue();

// Export the queue function wrapper (maintains the same interface as p-limit)
export const imageQueue = <T>(task: () => Promise<T>): Promise<T> => imageQueueInstance.add(task);


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
      // Added logging so you can monitor this in Cloud Logging
      console.warn(`Quota hit (429/Resource Exhausted). Backing off for ${delay}ms.`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('Backoff exhausted');
}