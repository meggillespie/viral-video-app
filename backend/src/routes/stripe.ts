import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../services';

// Initialize Stripe. Ensure the secret key is non-null with '!'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const clientUrl = 'https://viral-video-app-ai-plexus.vercel.app'; // Your frontend URL

// ---- Price ID Maps ----

// Subscription Price IDs from .env
const priceIdMap: { [key: string]: string | undefined } = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    creator: process.env.STRIPE_CREATOR_PRICE_ID,
    influencer: process.env.STRIPE_INFLUENCER_PRICE_ID,
    agency: process.env.STRIPE_AGENCY_PRICE_ID,
};

// Top-Up Price IDs for the "5 Credit Top-Up Package" from .env
const topUpPriceIdMap: { [key: string]: string | undefined } = {
    starter: process.env.STRIPE_STARTER_TOPUP_PRICE_ID,
    creator: process.env.STRIPE_CREATOR_TOPUP_PRICE_ID,
    influencer: process.env.STRIPE_INFLUENCER_TOPUP_PRICE_ID,
    agency: process.env.STRIPE_AGENCY_TOPUP_PRICE_ID,
};

// Create a set of valid Subscription Price IDs for easy validation
const validSubscriptionPriceIds = new Set(Object.values(priceIdMap).filter(id => id));

// Map subscription price IDs to the number of credits they provide
const subscriptionCreditsMap: { [key: string]: number } = {};
if (priceIdMap.starter) subscriptionCreditsMap[priceIdMap.starter] = 15;
if (priceIdMap.creator) subscriptionCreditsMap[priceIdMap.creator] = 35;
if (priceIdMap.influencer) subscriptionCreditsMap[priceIdMap.influencer] = 75;
if (priceIdMap.agency) subscriptionCreditsMap[priceIdMap.agency] = 160;

// All top-ups grant a fixed number of credits
const TOP_UP_CREDIT_AMOUNT = 5;

// ---- 1. Create Checkout Session for Subscriptions ----
export const createCheckoutSessionRoute = async (req: Request, res: Response) => {
    const { userId, email, priceId } = req.body; 

    if (!priceId || !validSubscriptionPriceIds.has(priceId)) {
        console.error(`Invalid or missing priceId provided: ${priceId}`);
        return res.status(400).json({ error: 'Invalid subscription plan selected.' });
    }

    if (!userId || !email) {
        return res.status(400).json({ error: 'Missing user identification.' });
    }

    try {
        const { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', userId).single();

        let customerId = profile?.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({ email, metadata: { userId } });
            customerId = customer.id;
            await supabaseAdmin.from('profiles').upsert({ id: userId, stripe_customer_id: customerId }, { onConflict: 'id' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'link'],
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${clientUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: clientUrl,
            metadata: { userId },
        });

        res.json({ sessionId: session.id });
    } catch (error: any) {
        console.error("Error creating subscription checkout session:", error);
        res.status(500).json({ error: "Failed to create checkout session." });
    }
};

// ---- 2. Create Checkout Session for Credit Top-Ups ----
export const createTopUpCheckoutSessionRoute = async (req: Request, res: Response) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing user identification.' });
    }

    try {
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id, stripe_subscription_id')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        const { stripe_customer_id: customerId, stripe_subscription_id: subscriptionId } = profile;

        if (!customerId || !subscriptionId) {
            return res.status(400).json({ error: 'User is not subscribed or is missing Stripe data.' });
        }

        // Retrieve the subscription to determine the current plan
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPriceId = subscription.items.data[0]?.price.id;
        const currentTier = Object.keys(priceIdMap).find(tier => priceIdMap[tier] === currentPriceId);

        if (!currentTier) {
            return res.status(500).json({ error: `Current subscription plan (${currentPriceId}) is not recognized.` });
        }

        const topUpPriceId = topUpPriceIdMap[currentTier];

        if (!topUpPriceId) {
            return res.status(500).json({ error: `Top-up option for the ${currentTier} plan is not configured.` });
        }
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'link'],
            mode: 'payment', // One-time payment
            customer: customerId,
            line_items: [{ price: topUpPriceId, quantity: 1 }],
            success_url: `${clientUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: clientUrl,
            metadata: { userId, purchaseType: 'top-up' }, // Metadata to identify purchase type in webhook
        });

        res.json({ sessionId: session.id });
    } catch (error: any) {
        console.error("Error creating top-up checkout session:", error);
        res.status(500).json({ error: "Failed to create top-up session." });
    }
};

// ---- 3. Create Customer Portal Session ----
export const createPortalSessionRoute = async (req: Request, res: Response) => {
    const { userId } = req.body;
    try {
        const { data: profile } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', userId).single();
        if (!profile?.stripe_customer_id) {
            return res.status(404).json({ error: 'Stripe customer not found for this user.' });
        }
        
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: clientUrl,
        });

        res.json({ url: portalSession.url });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to create customer portal session." });
    }
};

// ---- 4. Stripe Webhook Handler ----
export const stripeWebhookRoute = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;

    try {
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

            if (!userId) break;

            // Handle successful subscription creation
            if (session.mode === 'subscription') {
                const subscriptionId = session.subscription as string;
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
                const planId = lineItems.data[0]?.price?.id;

                if (subscriptionId && planId) {
                    await supabaseAdmin.from('profiles').update({
                        stripe_subscription_id: subscriptionId,
                        subscription_status: 'active',
                        subscription_plan_id: planId, // Save the plan's priceId
                    }).eq('id', userId);
                }
            } 
            // Handle successful one-time top-up purchase
            else if (session.mode === 'payment' && session.metadata?.purchaseType === 'top-up') {
                const { error } = await supabaseAdmin.rpc('add_user_credits', {
                    user_id_to_update: userId,
                    amount_to_add: TOP_UP_CREDIT_AMOUNT
                });
                if (error) console.error("Webhook: Failed to add top-up credits:", error);
            }
            break;
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            // Handle recurring subscription payment (credit refill)
            if (invoice.billing_reason === 'subscription_cycle') {
                const priceId = (invoice.lines.data[0] as any)?.price?.id;
                const customerId = invoice.customer as string;

                if (priceId && customerId && subscriptionCreditsMap[priceId]) {
                    const creditsToAdd = subscriptionCreditsMap[priceId];
                    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('stripe_customer_id', customerId).single();

                    if (profile) {
                        const { error } = await supabaseAdmin.rpc('add_user_credits', {
                            user_id_to_update: profile.id,
                            amount_to_add: creditsToAdd
                        });
                        if (error) console.error("Webhook: Failed to add renewal credits:", error);
                    }
                }
            }
            break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': { // Handles cancellations
            const subscription = event.data.object as Stripe.Subscription;
            await supabaseAdmin.from('profiles').update({
                subscription_status: subscription.status,
            }).eq('stripe_subscription_id', subscription.id);
            break;
        }
    }

    res.status(200).send({ received: true });
};
