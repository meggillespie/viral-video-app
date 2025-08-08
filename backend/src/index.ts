// File: backend/src/index.ts 

import express from 'express';
import cors from 'cors';
import multer from 'multer'; // Import multer

// Import route handlers
import { analyzeRoute } from './routes/analyze';
import { generateContentRoute } from './routes/generate-content';
import { createSignedUrlRoute, transferToGeminiRoute } from './routes/storage';
import { getVideoDurationRoute } from './routes/video';
import { clerkWebhookRoute } from './routes/clerk-webhook';
import { generateImageContentRoute } from './routes/generate-image-content'; // Import the new image route

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

// Configure multer for in-memory storage (efficient for images)
const upload = multer({ storage: multer.memoryStorage() });


// Middleware - Define allowed origins and other CORS options
const corsOptions = {
  origin: 'https://viral-video-app-ai-plexus.vercel.app', // Your Vercel frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply the CORS middleware with the specified options
app.use(cors(corsOptions));


// CRITICAL: Advanced Body Parsing Middleware
// We must selectively apply the correct parser based on the route.
app.use((req, res, next) => {
    if (req.path === '/api/clerk-webhook') {
        // 1. Clerk Webhook requires the raw body
        express.raw({ type: 'application/json' })(req, res, next);
    } else if (req.path === '/api/generate-image-content' && req.method === 'POST') {
        // 2. Image generation requires multipart/form-data parsing
        // 'sourceImage' is the field name the frontend will use
        upload.single('sourceImage')(req, res, next);
    } else {
        // 3. All other routes use standard JSON parsing
        express.json()(req, res, next);
    }
});

// Routes (Updated)
app.post('/api/analyze', analyzeRoute);
app.post('/api/generate-content', generateContentRoute);
app.post('/api/create-signed-url', createSignedUrlRoute);
app.post('/api/transfer-to-gemini', transferToGeminiRoute);
app.post('/api/get-video-duration', getVideoDurationRoute);
app.post('/api/clerk-webhook', clerkWebhookRoute);
app.post('/api/generate-image-content', generateImageContentRoute);


app.get('/', (req, res) => {
  res.send('Vyralize Backend Service is running on Google Cloud Run.');
});

// Listen
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
