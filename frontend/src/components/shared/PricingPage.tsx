import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { loadStripe } from '@stripe/stripe-js';

// This is your backend API URL, ensure it's configured correctly.
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

// This should be your Stripe publishable key, loaded from your .env.local file
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!STRIPE_PUBLISHABLE_KEY) {
    console.error("Missing VITE_STRIPE_PUBLISHABLE_KEY in your environment variables.");
}
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY!);

// These price IDs must match the ones on your Stripe dashboard and in your .env.local file
// Make sure your frontend .env.local file has these variables (e.g., VITE_STRIPE_STARTER_PRICE_ID=price_xxxx)
const plans = [
    { name: 'Starter', price: '$19.99', credits: '15 credits', priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID },
    { name: 'Creator', price: '$39.99', credits: '35 credits', priceId: import.meta.env.VITE_STRIPE_CREATOR_PRICE_ID },
    { name: 'Influencer', price: '$79.99', credits: '75 credits', priceId: import.meta.env.VITE_STRIPE_INFLUENCER_PRICE_ID },
    { name: 'Agency', price: '$139.99', credits: '160 credits', priceId: import.meta.env.VITE_STRIPE_AGENCY_PRICE_ID },
];

export const PricingPage: React.FC = () => {
    const { user } = useUser();
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleChoosePlan = async (priceId: string | undefined) => {
        setError(null);
        if (!priceId || priceId === 'undefined') {
            setError("This plan is not configured correctly. Please check frontend environment variables.");
            return;
        }
        if (!user) {
            setError("You must be signed in to subscribe.");
            return;
        }

        setIsLoading(priceId);

        try {
            // Call the backend endpoint to create a checkout session
            const response = await fetch(`${BACKEND_API_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: priceId,
                    userId: user.id,
                    email: user.primaryEmailAddress?.emailAddress,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create checkout session.');
            }

            const { sessionId } = await response.json();
            const stripe = await stripePromise;
            if (stripe) {
                // Redirect the user to Stripe's checkout page
                await stripe.redirectToCheckout({ sessionId });
            } else {
                 throw new Error("Stripe.js has not loaded yet.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 sm:p-8 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white">You're out of credits!</h2>
                <p className="mt-2 text-lg text-gray-400">Choose a plan to continue creating.</p>
            </div>
            
            {error && (
                 <div className="mt-6 bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm text-center" role="alert">
                    <strong className="font-bold">Error: </strong><span>{error}</span>
                </div>
            )}

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <div key={plan.name} className="bg-black/30 border border-white/10 rounded-lg p-6 flex flex-col items-center text-center transition-all hover:border-white/20 hover:scale-105">
                        <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                        <p className="mt-4 text-4xl font-bold text-white">{plan.price}<span className="text-base font-normal text-gray-400">/mo</span></p>
                        <p className="mt-2 text-gray-400">{plan.credits}</p>
                        <button
                            onClick={() => handleChoosePlan(plan.priceId)}
                            disabled={isLoading !== null}
                            className="mt-6 w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            {isLoading === plan.priceId ? 'Redirecting...' : 'Choose Plan'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};