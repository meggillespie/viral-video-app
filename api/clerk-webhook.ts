// api/clerk-webhook.ts

import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';
import type { IncomingHttpHeaders } from 'http';

// This is a Vercel-specific configuration object.
// It tells Vercel how to handle the request body.
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: { headers: IncomingHttpHeaders; body: any }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { message?: string; error?: string }): any; new(): any }; end: { (): any; new(): any } } }) {
  // We only care about POST requests for this webhook
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // These secret keys will be stored as Environment Variables on your hosting platform (e.g., Vercel).
  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!CLERK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Server configuration error: Missing environment variables.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Create a new Svix webhook instance for verification
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    // Read the raw request body
    const body = await buffer(req.body);
    // Verify the webhook signature comes from Clerk
    const payload = wh.verify(body, req.headers);

    // We only care about the 'user.created' event type
    if (payload.type === 'user.created') {
      const { id, email_addresses } = payload.data;
      const email = email_addresses[0]?.email_address;
      
      if (!id || !email) {
        return res.status(400).json({ error: 'Missing user ID or email in webhook payload.' });
      }

      // Create a Supabase admin client using the secret service_role key
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Insert a new user row into our 'profiles' table with 3 free credits
      const { error } = await supabase
        .from('profiles')
        .insert({ id: id, email: email, credit_balance: 3, subscription_tier: 'free' });

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({ error: 'Failed to create user profile in database.' });
      }

      console.log(`Successfully created profile for user ${id}`);
      return res.status(201).json({ message: 'User created successfully.' });
    }

    // If it's a different event type, just acknowledge it successfully.
    return res.status(200).json({ message: 'Webhook received.' });

  } catch (err) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: 'Webhook verification failed.' });
  }
}

// Helper function to convert the request stream to a buffer
async function buffer(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}