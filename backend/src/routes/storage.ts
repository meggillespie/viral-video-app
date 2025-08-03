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
      return res.status(500).json({ error: 'Failed to create upload authorization.' });
    }

    return res.status(200).json({ 
        signedUrl: data.signedUrl, 
        path: filePath, 
        token: data.token
    });

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// --- Handler 2: Transfer to Gemini (Long-Running) ---
export const transferToGeminiRoute = async (req: Request, res: Response) => {
    const { filePath, mimeType } = req.body;

    // Use the OS temp directory provided by the GCR environment
    const tempLocalPath = path.join(os.tmpdir(), path.basename(filePath));

    try {
        // 1. Get secure download URL (5 min validity)
        const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(filePath, 300); 

        if (urlError || !signedUrlData) throw new Error('Failed to get secure download URL.');

        // 2. Download from Supabase to container temp storage (Streaming)
        console.log("Starting download from Supabase to container temp storage...");
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
        
        // Type compatibility handling for node-fetch v2 stream and Node.js pipeline
        await pipeline(response.body as NodeJS.ReadableStream, fs.createWriteStream(tempLocalPath));

        // 3. Upload to Gemini File API
        console.log("Download complete. Starting upload to Gemini...");
        const fileManager = genAI.getFileManager();
        const uploadResult = await fileManager.uploadFile(tempLocalPath, { mimeType });
        const fileName = uploadResult.file.name;

        // 4. Poll for processing (Safe due to GCR's long timeout)
        console.log("Upload complete. Polling Gemini...");
        let file = await fileManager.getFile(fileName);
        while (file.state === 'PROCESSING') {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
          const response = await fileManager.getFile(fileName);
          file = response.file;
        }
      
        if (file.state === 'FAILED') {
          throw new Error('Video processing failed on Gemini.');
        }

        console.log("Gemini processing complete.");
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