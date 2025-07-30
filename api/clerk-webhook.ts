// api/clerk-webhook.ts

import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node'; // Import Vercel specific types

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // We only care about POST requests for this webhook
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // These secret keys will be stored as Environment Variables on Vercel.
  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!CLERK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Server configuration error: Missing environment variables.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  try {
    const payload: any = wh.verify(req.body, req.headers as Record<string, string>);

    // We only care about the 'user.created' event type
    if (payload.type === 'user.created') {
      const { id, email_addresses } = payload.data;
      const email = email_addresses[0]?.email_address;
      
      if (!id || !email) {
        return res.status(400).json({ error: 'Missing user ID or email in webhook payload.' });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
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

    return res.status(200).json({ message: 'Webhook received.' });

  } catch (err: any) { // Type the error as 'any'
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
}