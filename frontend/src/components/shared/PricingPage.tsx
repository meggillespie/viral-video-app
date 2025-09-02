// File: frontend/src/components/shared/PricingPage.tsx
import { useState } from 'react';
import { useUser } from "@clerk/clerk-react";
import { loadStripe } from '@stripe/stripe-js';
import { BACKEND_API_URL } from '../../config/constants';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const pricingTiers = [
    { name: 'Starter', price: '$19.99', credits: '15', priceId: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID },
    { name: 'Creator', price: '$39.99', credits: '35', priceId: import.meta.env.VITE_STRIPE_CREATOR_PRICE_ID },
    { name: 'Influencer', price: '$79.99', credits: '75', priceId: import.meta.env.VITE_STRIPE_INFLUENCER_PRICE_ID },
    { name: 'Agency', price: '$139.99', credits: '160', priceId: import.meta.env.VITE_STRIPE_AGENCY_PRICE_ID },
];

export const PricingPage = () => {
    const { user } = useUser();
    const [loading, setLoading] = useState<string | null>(null);

    const handleSubscribe = async (priceId: string) => {
        if (!user) return;
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

            const { sessionId } = await response.json();
            const stripe = await stripePromise;
            await stripe?.redirectToCheckout({ sessionId });
        } catch (error) {
            console.error("Subscription failed:", error);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="text-center p-8 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
            <h2 className="text-3xl font-bold mb-2 text-white">You're out of credits!</h2>
            <p className="text-lg text-gray-400 mb-8">Choose a plan to continue creating.</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {pricingTiers.map(tier => (
                    <div key={tier.name} className="bg-black/30 p-6 rounded-lg border border-white/10 flex flex-col">
                        <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                        <p className="text-3xl font-bold my-4 text-white">{tier.price}<span className="text-sm font-normal text-gray-400">/mo</span></p>
                        <p className="text-lg text-gray-300 mb-6">{tier.credits} credits</p>
                        <button 
                            onClick={() => handleSubscribe(tier.priceId)}
                            disabled={loading === tier.priceId}
                            className="mt-auto px-6 py-2 bg-gradient-to-r from-[#007BFF] to-[#E600FF] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading === tier.priceId ? 'Redirecting...' : 'Choose Plan'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};