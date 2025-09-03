import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../services';

// Initialize Stripe.
// The `apiVersion` is removed to resolve a TypeScript build error. The library will default
// to the API version set in your Stripe account dashboard.
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

// Create a set of valid Price IDs for validation (filter out any undefined values)
const validPriceIds = new Set(Object.values(priceIdMap).filter(id => id));

// Credit amounts for each tier
// FIX: Initialize safely. The previous implementation could crash if environment variables were missing.
const creditsMap: { [key: string]: number } = {};

if (priceIdMap.starter) creditsMap[priceIdMap.starter] = 15;
if (priceIdMap.creator) creditsMap[priceIdMap.creator] = 35;
if (priceIdMap.influencer) creditsMap[priceIdMap.influencer] = 75;
if (priceIdMap.agency) creditsMap[priceIdMap.agency] = 160;


// ---- 1. Create Checkout Session for Subscriptions ----
export const createCheckoutSessionRoute = async (req: Request, res: Response) => {
    // In a real app, you would get userId from a verified Clerk JWT
    const { userId, email, priceId } = req.body; 

    // FIX (Issue 2): Validate the incoming priceId.
    // Check if it's missing, the literal string "undefined" (a common frontend error when configuration is missing), 
    // or if it doesn't match known valid Price IDs.
    if (!priceId || priceId === 'undefined' || !validPriceIds.has(priceId)) {
        console.error(`Invalid or missing priceId provided: ${priceId}`);
        // Return a 400 error instead of crashing with a 500 error.
        return res.status(400).json({ error: 'Invalid subscription plan selected. Please ensure the frontend configuration (environment variables) is correct.' });
    }

    if (!userId || !email) {
        return res.status(400).json({ error: 'Missing userId or email.' });
    }

    try {
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            console.error("User profile not found for userId:", userId, error);
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
            // priceId is now validated
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${clientUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: clientUrl,
            metadata: { userId }, // Pass userId to the webhook
        });

        res.json({ sessionId: session.id });
    } catch (error: any) {
        console.error("Error creating checkout session:", error);
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

    if (!webhookSecret) {
        console.error("Stripe webhook secret is not configured.");
        return res.status(500).send("Server configuration error.");
    }

    try {
        // Ensure req.body is the raw buffer for signature verification
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
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
                    // PROACTIVE FIX: The original code passed the Stripe Customer ID (customerId) to the RPC.
                    // The RPC 'add_user_credits' expects the actual User ID (UUID).
                    // We must look up the User ID associated with this customerId first.
                    const { data: profile, error } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', customerId)
                        .single();

                    if (error || !profile) {
                        console.error(`Could not find user associated with Stripe Customer ID: ${customerId}`, error);
                        // Return 500 so Stripe retries the webhook
                        return res.status(500).send("Error finding user for credit update.");
                    } else {
                        const { error: rpcError } = await supabaseAdmin.rpc('add_user_credits', {
                            user_id_to_update: profile.id, // Use the actual user ID (UUID)
                            amount_to_add: creditsToAdd
                        });

                        if (rpcError) {
                            console.error("Failed to add credits via RPC:", rpcError);
                            return res.status(500).send("Error executing credit update RPC.");
                        }
                    }
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

    res.status(200).send({ received: true });
};