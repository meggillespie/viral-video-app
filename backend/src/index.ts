// File: backend/src/index.ts (Updated File)

import express from 'express';
import cors from 'cors';

// Import route handlers (Updated)
import { analyzeRoute } from './routes/analyze';
// Import the renamed generate-content route
import { generateContentRoute } from './routes/generate-content'; 
import { createSignedUrlRoute, transferToGeminiRoute } from './routes/storage';
import { getVideoDurationRoute } from './routes/video';
import { clerkWebhookRoute } from './routes/clerk-webhook';

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0'; 

// Middleware - Define allowed origins and other CORS options
const corsOptions = {
  origin: 'https://viral-video-app-ai-plexus.vercel.app', // Your Vercel frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply the CORS middleware with the specified options
app.use(cors(corsOptions));


// CRITICAL: Body Parsing Middleware
// Clerk/Svix requires the raw body. We apply JSON parsing only to other routes.
app.use((req, res, next) => {
    if (req.path === '/api/clerk-webhook') {
        // Ensure the type is correct for the raw parser
        express.raw({ type: 'application/json' })(req, res, next);
    } else {
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

app.get('/', (req, res) => {
  res.send('Vyralize Backend Service is running on Google Cloud Run.');
});

// Listen
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});