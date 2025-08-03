import express from 'express';
import cors from 'cors';

// Import route handlers
import { generateRoute } from './routes/generate';
import { createSignedUrlRoute, transferToGeminiRoute } from './routes/storage';
import { getVideoDurationRoute } from './routes/video';
import { clerkWebhookRoute } from './routes/clerk-webhook';

const app = express();
// GCR dynamically sets the PORT environment variable
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());

// CRITICAL: Body Parsing Middleware
// Clerk/Svix requires the raw body. We apply JSON parsing only to other routes.
app.use((req, res, next) => {
    if (req.path === '/api/clerk-webhook') {
        express.raw({ type: 'application/json' })(req, res, next);
    } else {
        express.json()(req, res, next);
    }
});

// Routes
app.post('/api/generate', generateRoute);
app.post('/api/create-signed-url', createSignedUrlRoute);
app.post('/api/transfer-to-gemini', transferToGeminiRoute);
app.post('/api/get-video-duration', getVideoDurationRoute);
app.post('/api/clerk-webhook', clerkWebhookRoute);

app.get('/', (req, res) => {
  res.send('VideoDNA Backend Service is running on Google Cloud Run.');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});