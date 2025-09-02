// File: backend/src/index.ts

import express from 'express';
import cors from 'cors';
import multer from 'multer';

// Import route handlers
import { analyzeRoute } from './routes/analyze';
import { analyzeImageRoute } from './routes/analyze-image';
import { generateContentRoute } from './routes/generate-content';
import { generateImageContentRoute } from './routes/generate-image-content';
// import { generateImageContentRoute, generateStoryboardImageRoute } from './routes/generate-image-content';

import { createSignedUrlRoute, transferToGeminiRoute } from './routes/storage';
import { getVideoDurationRoute } from './routes/video';
import { clerkWebhookRoute } from './routes/clerk-webhook';
import { createCheckoutSessionRoute, createPortalSessionRoute, stripeWebhookRoute } from './routes/stripe';


const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

// Configure multer for in-memory storage (efficient for images)
const upload = multer({ storage: multer.memoryStorage() });


// Middleware - Define allowed origins and other CORS options
const corsOptions = {
  // Ensure this matches your frontend deployment URL
  origin: 'https://viral-video-app-ai-plexus.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply the CORS middleware with the specified options
app.use(cors(corsOptions));


// --- Body Parsing Middleware Configuration (Revised) ---

// We apply the raw parser specifically to this route before the global JSON parser.
// 1. Handle the Clerk Webhook first, as it requires the raw body.
app.post('/api/clerk-webhook', express.raw({ type: 'application/json' }), clerkWebhookRoute);
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookRoute);

// 2. Apply standard JSON parsing globally for other routes.
app.use(express.json({ limit: '50mb' }));


// --- Routes (Updated) ---

// Video Routes (JSON)
app.post('/api/analyze', analyzeRoute);
app.post('/api/generate-content', generateContentRoute);
app.post('/api/get-video-duration', getVideoDurationRoute);

// Storage Routes (JSON)
app.post('/api/create-signed-url', createSignedUrlRoute);
app.post('/api/transfer-to-gemini', transferToGeminiRoute);

// Image Routes
// Image Analysis (Multipart/Form-Data)
// FIX: Apply the Multer middleware directly to the route where the upload now occurs.
// 'sourceImage' must match the field name used in the frontend FormData.
app.post('/api/analyze-image', upload.single('sourceImage'), analyzeImageRoute);

// Image Generation (JSON)
// This route now expects JSON data (analysis results, topic, intent).
app.post('/api/generate-image-content', generateImageContentRoute);
// app.post('/api/generate-storyboard-image', generateStoryboardImageRoute);

// Add new Stripe API routes
app.post('/api/create-checkout-session', createCheckoutSessionRoute);
app.post('/api/create-portal-session', createPortalSessionRoute);


app.get('/', (req, res) => {
  res.send('Vyralize Backend Service is running on Google Cloud Run.');
});

// Listen
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});