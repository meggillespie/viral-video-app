import { Request, Response } from 'express';
import ytdl from 'ytdl-core';

export const getVideoDurationRoute = async (req: Request, res: Response) => {
    try {
        const { videoUrl } = req.body;
        if (!videoUrl || !ytdl.validateURL(videoUrl)) {
          return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
        }
    
        const info = await ytdl.getInfo(videoUrl);
        const durationInSeconds = parseInt(info.videoDetails.lengthSeconds, 10);
    
        return res.status(200).json({ duration: durationInSeconds });
    
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch video information.' });
      }
};