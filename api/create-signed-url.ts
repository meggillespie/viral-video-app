// File: /api/create-signed-url.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = process.env.SUPABASE_URL;
// CRITICAL: Use the Service Role Key, not the Anon Key
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Supabase environment variables are missing on the backend.");
}

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Basic CORS Handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // NOTE: In a production app, you must verify the Clerk JWT here 
  // to ensure the user is authenticated before generating a URL.

  const { fileName, contentType } = req.body;
  if (!fileName || !contentType) {
      return res.status(400).json({ error: 'File name and content type are required.' });
  }

  // Create a unique path using a UUID
  const path = `uploads/${uuidv4()}-${fileName}`;
  const bucket = 'video-uploads';

  try {
    // Create the signed upload URL (Valid for 60 seconds)
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('Error creating signed upload URL:', error);
      return res.status(500).json({ error: 'Failed to create upload authorization.' });
    }

    // Return the necessary data for the client to perform the upload
    return res.status(200).json({ 
        signedUrl: data.signedUrl, 
        path: path, 
        token: data.token // Supabase requires this token in the upload header
    });

  } catch (error) {
    console.error('Server error in create-signed-url:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}