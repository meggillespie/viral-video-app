// File: backend/src/routes/storage.ts

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, genAI } from '../services';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';
import os from 'os';

const BUCKET = 'video-uploads';

// --- Handler 1: Create Signed URL ---
export const createSignedUrlRoute = async (req: Request, res: Response) => {
  // NOTE: In production, verify the Clerk JWT here before authorizing upload.

  const { fileName, contentType } = req.body;
  if (!fileName || !contentType) {
      return res.status(400).json({ error: 'File name and content type are required.' });
  }

  const filePath = `uploads/${uuidv4()}-${fileName}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error("Supabase Signed URL Error:", error);
      return res.status(500).json({ error: 'Failed to create upload authorization.' });
    }

    return res.status(200).json({ 
        signedUrl: data.signedUrl, 
        path: filePath, 
        token: data.token
    });

  } catch (error) {
    console.error("Create Signed URL Route Error:", error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// --- Handler 2: Transfer to Gemini (Long-Running) ---
export const transferToGeminiRoute = async (req: Request, res: Response) => {
    const { filePath, mimeType } = req.body;

    if (!filePath || !mimeType) {
        return res.status(400).json({ error: 'filePath and mimeType are required.' });
    }

    const tempLocalPath = path.join(os.tmpdir(), path.basename(filePath));

    try {
        // 1. Get secure download URL
        const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(filePath, 300); 

        if (urlError || !signedUrlData) throw new Error('Failed to get secure download URL.');

        // 2. Download from Supabase to container temp storage
        console.log("Starting download from Supabase to container temp storage...");
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
        
        await pipeline(response.body as NodeJS.ReadableStream, fs.createWriteStream(tempLocalPath));

        // 3. Upload to Gemini File API
        console.log("Download complete. Starting upload to Gemini...");

        const uploadResult = await genAI.files.upload({
            file: tempLocalPath,
            config: { mimeType: mimeType },
        });

        // FIX: Access the name directly from the result object (which is of type File_2).
        const fileName = uploadResult.name; 

        if (!fileName) {
            throw new Error("Gemini upload did not return a file name.");
        }

        // 4. Poll for processing
        console.log(`Upload initiated (ID: ${fileName}). Polling Gemini...`);
        
        let file = await genAI.files.get({ name: fileName });

        // Polling loop
        while (file.state === 'PROCESSING') {
          console.log(`Polling status: ${file.state}...`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
          file = await genAI.files.get({ name: fileName });
        }
      
        if (file.state === 'FAILED') {
          // Use nullish coalescing (??) for safety when accessing optional error properties
          throw new Error(`Video processing failed on Gemini. Details: ${file.error?.message ?? 'Unknown error'}`);
        }

        // Ensure the file is ready ('ACTIVE')
        if (file.state !== 'ACTIVE') {
            throw new Error(`Video processing ended in unexpected state: ${file.state}`);
        }

        console.log("Gemini processing complete (ACTIVE).");
        
        // Ensure URI and MimeType exist before returning
        if (!file.uri || !file.mimeType) {
            throw new Error("Gemini processing succeeded but missing URI or MimeType.");
        }
        return res.status(200).json({ fileUri: file.uri, mimeType: file.mimeType });

    } catch (error: any) {
        console.error('Error during transfer:', error);
        return res.status(500).json({ error: error.message || 'Transfer failed.' });
    } finally {
        // 5. Clean up temp file
        if (fs.existsSync(tempLocalPath)) {
            fs.unlinkSync(tempLocalPath);
        }
    }
};