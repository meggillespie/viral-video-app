// File: frontend/src/components/shared/PricingPage.tsx
import { useState } from 'react';
import { useUser } from "@clerk/clerk-react";
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

const pricingTiers = [
    { name: 'Starter', price: '$19.99', credits: '15', priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID },
    { name: 'Creator', price: '$39.99', credits: '35', priceId: import.meta.env.VITE_STRIPE_CREATOR_PRICE_ID },
    { name: 'Influencer', price: '$79.99', credits: '75', priceId: import.meta.env.VITE_STRIPE_INFLUENCER_PRICE_ID },
    { name: 'Agency', price: '$139.99', credits: '160', priceId: import.meta.env.VITE_STRIPE_AGENCY_PRICE_ID },
];

export const PricingPage = () => {
    const { user, isLoaded } = useUser();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubscribe = async (priceId: string | undefined) => {
        setError(null);
        if (!priceId || priceId === 'undefined') {
            setError("This plan is not configured correctly. Please check frontend environment variables.");
            return;
        }
        if (!user) {
            setError("User not found. Please try refreshing the page.");
            return;
        }
        setLoading(priceId);
        try {
            const response = await fetch(`${BACKEND_API_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    email: user.primaryEmailAddress?.emailAddress,
                    priceId: priceId,
                }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create checkout session.');
            }
            const { sessionId } = await response.json();
            const stripe = await stripePromise;
            if (!stripe) throw new Error("Stripe.js failed to load.");
            await stripe.redirectToCheckout({ sessionId });
        } catch (err: any) {
            console.error("Subscription failed:", err);
            setError(err.message);
        } finally {
            setLoading(null);
        }
    };

    if (!isLoaded) {
        return <div className="text-center p-8"><p className="text-lg text-gray-400">Loading plans...</p></div>;
    }

    return (
        <div className="text-center p-8 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
            <h2 className="text-3xl font-bold mb-2 text-white">You're out of credits!</h2>
            <p className="text-lg text-gray-400 mb-8">Choose a plan to continue creating.</p>
            {error && (
                <div className="mb-6 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong><span>{error}</span>
                </div>
            )}

            {/* FIX: Replaced responsive breakpoints with a fluid, container-aware grid layout.
                This tells each column to be at least 200px wide and to automatically fit
                as many columns as possible in the available space before wrapping.
            */}
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                {pricingTiers.map(tier => (
                    <div key={tier.name} className="bg-black/30 p-6 rounded-lg border border-white/10 flex flex-col">
                        <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                        <p className="text-3xl font-bold my-4 text-white">{tier.price}<span className="text-sm font-normal text-gray-400">/mo</span></p>
                        <p className="text-lg text-gray-300 mb-6">{tier.credits} credits</p>
                        <button 
                            onClick={() => handleSubscribe(tier.priceId)}
                            disabled={!isLoaded || loading !== null}
                            className="mt-auto px-6 py-2 bg-gradient-to-r from-[#007BFF] to-[#E600FF] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading === tier.priceId ? 'Redirecting...' : 'Choose Plan'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};