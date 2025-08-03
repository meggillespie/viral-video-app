// File: /api/upload-video.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';

// Initialize Google AI client securely on the backend
const API_KEY = process.env.GOOGLE_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Vercel requires this config to disable the default body parser for multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

async function uploadAndPollGemini(filePath: string, mimeType: string) {
    const fileManager = genAI.getFileManager();
  
    console.log("Starting upload to Gemini File API...");
    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType: mimeType,
    });
  
    const fileName = uploadResult.file.name;
    console.log(`File uploaded: ${fileName}. Polling for status...`);

    // Poll for file readiness (Crucial for video)
    let file = await fileManager.getFile(fileName);
    while (file.state === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      const response = await fileManager.getFile(fileName);
      file = response.file;
    }
  
    if (file.state === 'FAILED') {
      throw new Error('Video processing failed on Gemini.');
    }
  
    console.log("Video processed successfully.");
    return { fileUri: file.uri, mimeType: file.mimeType };
  }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // (Basic CORS Handling)
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // WARNING: Vercel will reject payloads > 4.5MB before this code even runs.
  const form = formidable();

  try {
    // Parse the incoming form data
    const { files } = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const video = files.video ? (Array.isArray(files.video) ? files.video[0] : files.video) : null;

    if (!video) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }
    
    // Securely upload to Gemini from the backend
    const geminiFileData = await uploadAndPollGemini(video.filepath, video.mimetype || 'video/mp4');

    // Clean up the temporary file
    fs.unlinkSync(video.filepath);

    return res.status(200).json(geminiFileData);

  } catch (error: any) {
    console.error('Error during video upload/processing:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during upload.' });
  }
}