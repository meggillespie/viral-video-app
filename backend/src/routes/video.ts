import { Request, Response } from 'express';
import playdl from 'play-dl';

const youtubeCookie = process.env.YOUTUBE_COOKIE;

if (youtubeCookie) {
    (async () => {
        await playdl.setToken({
            youtube: {
                cookie: youtubeCookie // We use the new variable here, which TypeScript now knows is a string.
            }
        });
        console.log("YouTube cookie has been set for play-dl.");
    })();
} else {
    console.warn("WARNING: YOUTUBE_COOKIE environment variable not set. play-dl may be rate-limited or blocked.");
}

export const getVideoDurationRoute = async (req: Request, res: Response) => {
    try {
        const { videoUrl } = req.body;
        if (!videoUrl || playdl.yt_validate(videoUrl) !== 'video') {
          return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
        }
    
        const info = await playdl.video_info(videoUrl);
        const durationInSeconds = info.video_details.durationInSec;
    
        return res.status(200).json({ duration: durationInSeconds });
    
      } catch (error) {
        console.error("ERROR IN /api/get-video-duration:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({ 
            error: 'Failed to fetch video information.',
            details: errorMessage 
        });
    }
};