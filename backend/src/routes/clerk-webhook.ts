import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { supabaseAdmin } from '../services';

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export const clerkWebhookRoute = async (req: Request, res: Response) => {
  if (!CLERK_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Server configuration error: Missing CLERK_WEBHOOK_SECRET.' });
  }

  const svix_id = req.headers['svix-id'] as string;
  const svix_timestamp = req.headers['svix-timestamp'] as string;
  const svix_signature = req.headers['svix-signature'] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing Svix headers' });
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  
  try {
    // The body is already raw (Buffer) thanks to the middleware in index.ts
    const payload: any = wh.verify(req.body, {
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
      
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert({ id: id, email: email, credit_balance: 3, subscription_tier: 'free' });

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({ error: 'Failed to create user profile.' });
      }

      return res.status(201).json({ message: 'User created successfully.' });
    }

    return res.status(200).json({ message: 'Webhook received.' });

  } catch (err: any) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
};