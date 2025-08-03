import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Environment Variable Validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_API_KEY) {
    console.error("FATAL: Missing critical environment variables (Supabase or Google).");
    // Exit if configuration is missing
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

export const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
export const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);