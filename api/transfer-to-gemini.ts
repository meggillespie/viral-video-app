// File: /api/transfer-to-gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';

// Initialize clients securely
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // (CORS/Method checks)
  res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { filePath, mimeType } = req.body;

  if (!filePath || !mimeType) {
    return res.status(400).json({ error: 'filePath and mimeType are required.' });
  }

  // Define a temporary local path within Vercel's writable /tmp directory
  const tempLocalPath = path.join('/tmp', path.basename(filePath));

  try {
    // 1. Get a secure download URL from Supabase
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
        .from('video-uploads')
        .createSignedUrl(filePath, 60); // Valid for 60s

    if (urlError || !signedUrlData) throw new Error('Failed to get secure download URL.');

    // 2. Download from Supabase to Vercel's local /tmp storage
    console.log("Starting download from Supabase to /tmp...");
    const response = await fetch(signedUrlData.signedUrl);
    if (!response.ok) throw new Error(`Failed to download file from storage: ${response.statusText}`);
    
    // Stream the download to the file system (Memory Efficient)
    await pipeline(response.body, fs.createWriteStream(tempLocalPath));
    console.log("Download complete. Starting upload to Gemini...");

    // 3. Upload from local /tmp to Gemini File API
    const fileManager = genAI.getFileManager();
    const uploadResult = await fileManager.uploadFile(tempLocalPath, {
        mimeType: mimeType,
    });

    const fileName = uploadResult.file.name;
    console.log("Upload complete. Polling Gemini for processing status...");

    // 4. Poll for processing (This is time-consuming and where timeouts may occur)
    let file = await fileManager.getFile(fileName);
    while (file.state === 'PROCESSING') {
      // Vercel might time out here
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      const response = await fileManager.getFile(fileName);
      file = response.file;
    }
  
    if (file.state === 'FAILED') {
      throw new Error('Video processing failed on Gemini.');
    }

    console.log("Gemini processing complete.");
    return res.status(200).json({ fileUri: file.uri, mimeType: file.mimeType });

  } catch (error: any) {
    console.error('Error during Supabase to Gemini transfer:', error);
    return res.status(500).json({ error: error.message || 'Transfer failed. The process may have timed out.' });
  } finally {
    // 5. Clean up: Delete the temp file and the file from Supabase
    if (fs.existsSync(tempLocalPath)) {
        fs.unlinkSync(tempLocalPath);
    }
    // Optionally delete from Supabase immediately, or set up bucket lifecycle rules
    // await supabaseAdmin.storage.from('video-uploads').remove([filePath]);
  }
}