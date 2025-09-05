import { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../services';

// Initialize Stripe.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const clientUrl = 'https://viral-video-app-ai-plexus.vercel.app'; // Frontend URL

// ---- Price ID Maps ----

// Subscription Price IDs from .env
const priceIdMap: { [key: string]: string | undefined } = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    creator: process.env.STRIPE_CREATOR_PRICE_ID,
    influencer: process.env.STRIPE_INFLUENCER_PRICE_ID,
    agency: process.env.STRIPE_AGENCY_PRICE_ID,
};

// NEW: Top-Up Price IDs for the "5 Credit Top-Up Package" from .env
const topUpPriceIdMap: { [key: string]: string | undefined } = {
    starter: process.env.STRIPE_STARTER_TOPUP_PRICE_ID, // $7.50
    creator: process.env.STRIPE_CREATOR_TOPUP_PRICE_ID, // $6.25
    influencer: process.env.STRIPE_INFLUENCER_TOPUP_PRICE_ID, // $5.00
    agency: process.env.STRIPE_AGENCY_TOPUP_PRICE_ID,    // $4.50
};

// Create a set of valid Subscription Price IDs for validation
const validSubscriptionPriceIds = new Set(Object.values(priceIdMap).filter(id => id));

// Credit amounts for subscription tiers
const subscriptionCreditsMap: { [key: string]: number } = {};
if (priceIdMap.starter) subscriptionCreditsMap[priceIdMap.starter] = 15;
if (priceIdMap.creator) subscriptionCreditsMap[priceIdMap.creator] = 35;
if (priceIdMap.influencer) subscriptionCreditsMap[priceIdMap.influencer] = 75;
if (priceIdMap.agency) subscriptionCreditsMap[priceIdMap.agency] = 160;

// NEW: Credit amount for all top-ups
const TOP_UP_CREDIT_AMOUNT = 5;

// ---- 1. Create Checkout Session for Subscriptions ----
export const createCheckoutSessionRoute = async (req: Request, res: Response) => {
    const { userId, email, priceId } = req.body; 

    if (!priceId || priceId === 'undefined' || !validSubscriptionPriceIds.has(priceId)) {
        console.error(`Invalid or missing priceId provided: ${priceId}`);
        return res.status(400).json({ error: 'Invalid subscription plan selected. Please ensure frontend configuration is correct.' });
    }

    if (!userId || !email) {
        return res.status(400).json({ error: 'Missing userId or email.' });
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
        console.error("Error creating checkout session:", error);
        res.status(500).json({ error: error.message });
    }
};

// ---- NEW: 2. Create Checkout Session for Credit Top-Ups ----
export const createTopUpCheckoutSessionRoute = async (req: Request, res: Response) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId.' });
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
            return res.status(400).json({ error: 'User is not subscribed or missing Stripe customer ID.' });
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPriceId = subscription.items.data[0]?.price.id;
        const currentTier = Object.keys(priceIdMap).find(tier => priceIdMap[tier] === currentPriceId);

        if (!currentTier) {
            return res.status(500).json({ error: `Subscription plan (${currentPriceId}) is not recognized.` });
        }

        const topUpPriceId = topUpPriceIdMap[currentTier];

        if (!topUpPriceId) {
            return res.status(500).json({ error: `Top-up option for the ${currentTier} plan is not configured.` });
        }
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'link'],
            mode: 'payment',
            customer: customerId,
            line_items: [{ price: topUpPriceId, quantity: 1 }],
            success_url: `${clientUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: clientUrl,
            metadata: { userId, purchaseType: 'top-up' },
        });

        res.json({ sessionId: session.id });
    } catch (error: any) {
        console.error("Error creating top-up checkout session:", error);
        res.status(500).json({ error: error.message });
    }
};

// ---- 3. Create Customer Portal Session (For Cancellation/Management) ----
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

// ---- 4. Stripe Webhook Handler ----
export const stripeWebhookRoute = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;

            if (session.mode === 'subscription' && userId) {
                const subscriptionId = session.subscription as string;
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
                const planId = lineItems.data[0]?.price?.id;

                if (subscriptionId && planId) {
                    await supabaseAdmin.from('profiles').update({
                        stripe_subscription_id: subscriptionId,
                        subscription_status: 'active',
                        subscription_plan_id: planId, // Store the plan ID
                    }).eq('id', userId);
                }
            } else if (session.mode === 'payment' && session.metadata?.purchaseType === 'top-up' && userId) {
                const { error } = await supabaseAdmin.rpc('add_user_credits', {
                    user_id_to_update: userId,
                    amount_to_add: TOP_UP_CREDIT_AMOUNT
                });
                if (error) {
                    console.error("Webhook: Failed to add top-up credits:", error);
                    return res.status(500).send("Webhook: Error adding top-up credits.");
                }
            }
            break;
        }
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            if (invoice.billing_reason === 'subscription_cycle') {
                // FIX: Cast to 'any' to bypass a known strict typing issue with Stripe's SDK.
                // The 'price' object is present on subscription cycle line items, but the generic
                // InvoiceLineItem type doesn't include it.
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
                        if (error) {
                            console.error("Webhook: Failed to add renewal credits:", error);
                            return res.status(500).send("Webhook: Error adding renewal credits.");
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

