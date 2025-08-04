import express from 'express';
import cors from 'cors';

// Import route handlers
import { generateRoute } from './routes/generate';
import { createSignedUrlRoute, transferToGeminiRoute } from './routes/storage';
import { getVideoDurationRoute } from './routes/video';
import { clerkWebhookRoute } from './routes/clerk-webhook';

const app = express();
// GCR dynamically sets the PORT environment variable. We must parse it as an integer.
const PORT = parseInt(process.env.PORT || '8080', 10);

// CRUCIAL FIX: Bind to 0.0.0.0 to accept traffic within the Cloud Run environment
const HOST = '0.0.0.0'; 

// Middleware
app.use(cors());

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

// Routes
app.post('/api/generate', generateRoute);
app.post('/api/create-signed-url', createSignedUrlRoute);
app.post('/api/transfer-to-gemini', transferToGeminiRoute);
app.post('/api/get-video-duration', getVideoDurationRoute);
app.post('/api/clerk-webhook', clerkWebhookRoute);

app.get('/', (req, res) => {
  // Updated app name
  res.send('Vyralize Backend Service is running on Google Cloud Run.');
});

// UPDATED: Listen on the specified HOST and PORT
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});