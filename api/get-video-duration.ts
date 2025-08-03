// File: /api/get-video-duration.ts
// This function securely fetches the duration of a YouTube video.

import ytdl from 'ytdl-core';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { videoUrl } = req.body;
    if (!videoUrl || !ytdl.validateURL(videoUrl)) {
      return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
    }

    // Fetch video info
    const info = await ytdl.getInfo(videoUrl);
    const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);

    // Send back the duration
    return res.status(200).json({ duration: durationInSeconds });

  } catch (error: any) {
    console.error('Error fetching video duration:', error);
    return res.status(500).json({ error: 'Failed to fetch video information.' });
  }
}
