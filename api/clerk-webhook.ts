// api/clerk-webhook.ts

import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This helper function reads the raw request body from the stream
async function buffer(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!CLERK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Server configuration error: Missing environment variables.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const svix_id = req.headers['svix-id'] as string;
  const svix_timestamp = req.headers['svix-timestamp'] as string;
  const svix_signature = req.headers['svix-signature'] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing Svix headers' });
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  
  try {
    const body = await buffer(req); // Use our helper to get the raw body
    const payload: any = wh.verify(body.toString('utf8'), {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
    });

    if (payload.type === 'user.created') {
      const { id, email_addresses } = payload.data;
      const email = email_addresses[0]?.email_address;
      
      if (!id || !email) {
        return res.status(400).json({ error: 'Missing user ID or email.' });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      const { error } = await supabase
        .from('profiles')
        .insert({ id: id, email: email, credit_balance: 3, subscription_tier: 'free' });

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({ error: 'Failed to create user profile.' });
      }

      console.log(`Successfully created profile for user ${id}`);
      return res.status(201).json({ message: 'User created successfully.' });
    }

    return res.status(200).json({ message: 'Webhook received.' });

  } catch (err: any) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
}