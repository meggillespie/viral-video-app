import React, { useState, useEffect } from 'react';
import { useUser } from "https://cdn.skypack.dev/@clerk/clerk-react";
import { loadStripe } from 'https://cdn.skypack.dev/@stripe/stripe-js';
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';

// --- Environment Variables ---
// Switched to process.env to be compatible with more build environments.
// Make sure your build tool (e.g., Vite) is configured to replace these variables.
const VITE_STRIPE_PUBLISHABLE_KEY = process.env.VITE_STRIPE_PUBLISHABLE_KEY!;
const BACKEND_API_URL = process.env.VITE_BACKEND_API_URL;

const VITE_STRIPE_STARTER_PRICE_ID = process.env.VITE_STRIPE_STARTER_PRICE_ID;
const VITE_STRIPE_CREATOR_PRICE_ID = process.env.VITE_STRIPE_CREATOR_PRICE_ID;
const VITE_STRIPE_INFLUENCER_PRICE_ID = process.env.VITE_STRIPE_INFLUENCER_PRICE_ID;
const VITE_STRIPE_AGENCY_PRICE_ID = process.env.VITE_STRIPE_AGENCY_PRICE_ID;
const VITE_STRIPE_STARTER_TOPUP_PRICE_ID = process.env.VITE_STRIPE_STARTER_TOPUP_PRICE_ID;
const VITE_STRIPE_CREATOR_TOPUP_PRICE_ID = process.env.VITE_STRIPE_CREATOR_TOPUP_PRICE_ID;
const VITE_STRIPE_INFLUENCER_TOPUP_PRICE_ID = process.env.VITE_STRIPE_INFLUENCER_TOPUP_PRICE_ID;
const VITE_STRIPE_AGENCY_TOPUP_PRICE_ID = process.env.VITE_STRIPE_AGENCY_TOPUP_PRICE_ID;

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

// --- Client Initialization ---
const stripePromise = loadStripe(VITE_STRIPE_PUBLISHABLE_KEY);
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const pricingTiers = [
    { name: 'Starter', price: '$19.99', credits: '15', priceId: VITE_STRIPE_STARTER_PRICE_ID },
    { name: 'Creator', price: '$39.99', credits: '35', priceId: VITE_STRIPE_CREATOR_PRICE_ID },
    { name: 'Influencer', price: '$79.99', credits: '75', priceId: VITE_STRIPE_INFLUENCER_PRICE_ID },
    { name: 'Agency', price: '$139.99', credits: '160', priceId: VITE_STRIPE_AGENCY_PRICE_ID },
];

const topUpOptions: { [key: string]: { price: string; priceId: string | undefined } } = {
    'Starter': { price: '$7.50', priceId: VITE_STRIPE_STARTER_TOPUP_PRICE_ID },
    'Creator': { price: '$6.25', priceId: VITE_STRIPE_CREATOR_TOPUP_PRICE_ID },
    'Influencer': { price: '$5.00', priceId: VITE_STRIPE_INFLUENCER_TOPUP_PRICE_ID },
    'Agency': { price: '$4.50', priceId: VITE_STRIPE_AGENCY_TOPUP_PRICE_ID },
};

interface SubscriptionInfo {
    status: string | null;
    planId: string | null;
}

export const PricingPage = () => {
    const { user, isLoaded: isUserLoaded } = useUser();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);

    useEffect(() => {
        const fetchSubscriptionStatus = async () => {
            if (user) {
                setIsSubscriptionLoading(true);
                try {
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('subscription_status, subscription_plan_id')
                        .eq('id', user.id)
                        .single();

                    if (profileError && profileError.code !== 'PGRST116') {
                        throw profileError;
                    }
                    
                    setSubscription({ 
                        status: profile?.subscription_status || null, 
                        planId: profile?.subscription_plan_id || null 
                    });
                } catch (err) {
                    console.error("Error fetching subscription status:", err);
                    setSubscription({ status: null, planId: null });
                } finally {
                    setIsSubscriptionLoading(false);
                }
            } else {
                setIsSubscriptionLoading(false);
            }
        };

        if (isUserLoaded) {
            fetchSubscriptionStatus();
        }
    }, [user, isUserLoaded]);

    const handleSubscribe = async (priceId: string | undefined) => {
        setError(null);
        if (!priceId) {
            setError("This plan is not configured correctly.");
            return;
        }
        if (!user) return;
        setLoading(priceId);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, email: user.primaryEmailAddress?.emailAddress, priceId }),
            });
            if (!response.ok) throw new Error((await response.json()).error);
            const { sessionId } = await response.json();
            const stripe = await stripePromise;
            await stripe?.redirectToCheckout({ sessionId });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(null);
        }
    };

    const handleTopUp = async () => {
        setError(null);
        if (!user) return;
        setLoading('top-up');
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/create-top-up-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            if (!response.ok) throw new Error((await response.json()).error);
            const { sessionId } = await response.json();
            const stripe = await stripePromise;
            await stripe?.redirectToCheckout({ sessionId });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(null);
        }
    };

    const handleManageSubscription = async () => {
        setError(null);
        if (!user) return;
        setLoading('manage');
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/create-portal-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            if (!response.ok) throw new Error((await response.json()).error);
            const { url } = await response.json();
            window.location.href = url;
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(null);
        }
    };

    if (!isUserLoaded || isSubscriptionLoading) {
        return <div className="text-center p-8"><p className="text-lg text-gray-400">Loading plans...</p></div>;
    }

    const isSubscribed = subscription?.status === 'active' && subscription?.planId;
    const currentPlan = isSubscribed ? pricingTiers.find(t => t.priceId === subscription.planId) : null;
    const topUpInfo = currentPlan ? topUpOptions[currentPlan.name] : null;

    if (isSubscribed && currentPlan) {
        return (
            <div className="text-center p-8 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
                <h2 className="text-3xl font-bold mb-2 text-white">Manage Your Subscription</h2>
                <p className="text-lg text-gray-400 mb-8">You are on the <span className="text-white font-semibold">{currentPlan.name}</span> plan.</p>
                {error && <div className="my-6 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm"><strong>Error:</strong> {error}</div>}
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                    <div className="bg-black/30 p-6 rounded-lg border border-white/10 flex flex-col flex-1 text-left">
                         <h3 className="text-xl font-semibold text-white">Need More Credits?</h3>
                         <p className="text-gray-400 mt-2">Instantly add 5 more credits to your account.</p>
                         <div className="my-6">
                            {topUpInfo ? <p className="text-3xl font-bold text-white">{topUpInfo.price}</p> : <p className="text-sm text-gray-500">Not available</p>}
                         </div>
                         <button onClick={handleTopUp} disabled={!topUpInfo || loading !== null} className="mt-auto px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading === 'top-up' ? 'Processing...' : 'Purchase 5 Credits'}
                         </button>
                    </div>
                    <div className="bg-black/30 p-6 rounded-lg border border-white/10 flex flex-col flex-1 text-left">
                         <h3 className="text-xl font-semibold text-white">Billing Portal</h3>
                         <p className="text-gray-400 mt-2">Update payment method, view invoices, or cancel your subscription.</p>
                         <button onClick={handleManageSubscription} disabled={loading !== null} className="mt-auto w-full px-6 py-2 bg-gray-600/50 text-white font-semibold rounded-lg hover:bg-gray-600/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                             {loading === 'manage' ? 'Redirecting...' : 'Manage Billing'}
                         </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="text-center p-8 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
            <h2 className="text-3xl font-bold mb-2 text-white">You're out of credits!</h2>
            <p className="text-lg text-gray-400 mb-8">Choose a plan to continue creating.</p>
            {error && <div className="mb-6 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm"><strong>Error:</strong> {error}</div>}
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {pricingTiers.map(tier => (
                    <div key={tier.name} className="bg-black/30 p-6 rounded-lg border border-white/10 flex flex-col">
                        <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                        <p className="text-3xl font-bold my-4 text-white">{tier.price}<span className="text-sm font-normal text-gray-400">/mo</span></p>
                        <p className="text-lg text-gray-300 mb-6">{tier.credits} credits</p>
                        <button onClick={() => handleSubscribe(tier.priceId)} disabled={!isUserLoaded || loading !== null} className="mt-auto px-6 py-2 bg-gradient-to-r from-[#007BFF] to-[#E600FF] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading === tier.priceId ? 'Redirecting...' : 'Choose Plan'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

