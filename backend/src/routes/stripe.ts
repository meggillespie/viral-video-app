import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../services';

// Initialize Stripe.
// FIX: The `apiVersion` is removed to resolve a TypeScript build error caused by
// overly strict type definitions in the Stripe library. The library will default
// to the API version set in your Stripe account dashboard, which is the preferred behavior.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const clientUrl = 'https://viral-video-app-ai-plexus.vercel.app'; // Your frontend URL

// Price IDs from .env
const priceIdMap = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    creator: process.env.STRIPE_CREATOR_PRICE_ID,
    influencer: process.env.STRIPE_INFLUENCER_PRICE_ID,
    agency: process.env.STRIPE_AGENCY_PRICE_ID,
};

// Credit amounts for each tier
const creditsMap: { [key: string]: number } = {
    [priceIdMap.starter!]: 10,
    [priceIdMap.creator!]: 35,
    [priceIdMap.influencer!]: 75,
    [priceIdMap.agency!]: 160,
};

// ---- 1. Create Checkout Session for Subscriptions ----
export const createCheckoutSessionRoute = async (req: Request, res: Response) => {
    // In a real app, you would get userId from a verified Clerk JWT
    const { userId, email, priceId } = req.body; 

    try {
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        let customerId = profile.stripe_customer_id;
        // Create a new Stripe customer if one doesn't exist
        if (!customerId) {
            const customer = await stripe.customers.create({ email: email, metadata: { userId } });
            customerId = customer.id;
            await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId);
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'link'],
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${clientUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: clientUrl,
            metadata: { userId }, // Pass userId to the webhook
        });

        res.json({ sessionId: session.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ---- 2. Create Customer Portal Session ----
export const createPortalSessionRoute = async (req: Request, res: Response) => {
    const { userId } = req.body;
    try {
        const { data: profile, error } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', userId).single();
        if (error || !profile || !profile.stripe_customer_id) {
            return res.status(404).json({ error: 'Stripe customer not found for this user.' });
        }
        
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: clientUrl,
        });

        res.json({ url: portalSession.url });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ---- 3. Stripe Webhook Handler ----
export const stripeWebhookRoute = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;
            const subscriptionId = session.subscription as string;

            if (userId && subscriptionId) {
                await supabaseAdmin.from('profiles').update({
                    stripe_subscription_id: subscriptionId,
                    subscription_status: 'active',
                }).eq('id', userId);
            }
            break;
        }
        case 'invoice.payment_succeeded': {
             const invoice = event.data.object as Stripe.Invoice;

             // Casting to 'any' to bypass strict type checks which may be
             // out of sync with the actual Stripe API response structure.
             const subscriptionId = (invoice as any).subscription;
             const priceId = (invoice.lines.data[0] as any)?.price?.id;
             
             // Ensure this is a subscription payment, not a one-off invoice
             if (priceId && subscriptionId && creditsMap[priceId]) {
                 const creditsToAdd = creditsMap[priceId];
                 const customerId = typeof invoice.customer === 'string' 
                    ? invoice.customer 
                    : invoice.customer?.id;

                 if (customerId) {
                    await supabaseAdmin.rpc('add_user_credits', {
                        user_id_to_update: customerId,
                        amount_to_add: creditsToAdd
                    });
                 }
             }
             break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await supabaseAdmin.from('profiles').update({
                subscription_status: subscription.status,
            }).eq('stripe_subscription_id', subscription.id);
            break;
        }
    }

    res.status(200).send();
};

