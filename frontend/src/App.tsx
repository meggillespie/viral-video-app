// File: frontend/src/App.tsx

import { useState, useEffect, useCallback } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { supabase } from './utils/supabase';
import { VideoWorkflowManager } from './components/video/VideoWorkflowManager';
import { ImageWorkflowManager } from './components/image/ImageWorkflowManager';
import { Logo, VideoIcon, ImageIcon } from './components/shared/Icons';
// import { PricingPage } from './components/shared/PricingPage';

function VyralizePlatformManager() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<'video' | 'image'>('video');
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);

    useEffect(() => {
        const loadUserData = async () => {
            if (user && getToken) {
                setIsFetchingCredits(true);
                try {
                    const token = await getToken({ template: 'supabase' });
                    if (!token) throw new Error("Clerk token not found.");
                    const { data, error: funcError } = await supabase.functions.invoke('get-credits', { 
                        headers: { Authorization: `Bearer ${token}` } 
                    });
                    if (funcError) throw funcError;
                    setCreditBalance(data.credit_balance);
                } catch (err) { 
                    console.error("Error loading user data:", err); 
                    setCreditBalance(0); 
                } finally { 
                    setIsFetchingCredits(false); 
                }
            }
        };
        loadUserData();
    }, [user, getToken]);

    const updateCredits = useCallback((amount: number = 1) => {
        setCreditBalance(prev => (prev !== null ? prev - amount : 0));
    }, []);
    
    // FIX: The container width is now determined ONLY by the active tab.
    // The premature redirect logic has been completely removed.
    const containerWidthClass = activeTab === 'image' ? 'max-w-5xl' : 'max-w-2xl';

    return (
        <div className={`w-full ${containerWidthClass} mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-500`}>
            <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <div className="flex items-center gap-3">
                            <Logo />
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#007BFF] to-[#E600FF] bg-clip-text text-transparent">Vyralize AI</h1>
                        </div>
                            <p className="hidden sm:block text-xs text-gray-400 border-l border-gray-600 ml-3 pl-3">Create What Captivates</p>
                    </div>
                    <div className="text-sm text-[#8A8A8E] bg-black/20 border border-[rgba(255,255,255,0.1)] px-3 py-1 rounded-full">
                        {isFetchingCredits ? '...' : creditBalance ?? 0} Credits
                    </div>
                </div>

                <div className="mb-8 border-b border-gray-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('video')}
                            className={`flex items-center whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'video'
                                    ? 'border-[#007BFF] text-[#007BFF]'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                            }`}
                        >
                            <VideoIcon />
                            Video Lab
                        </button>
                        <button
                            onClick={() => setActiveTab('image')}
                            className={`flex items-center whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'image'
                                    ? 'border-[#E600FF] text-[#E600FF]'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                            }`}
                        >
                            <ImageIcon />
                            Image Lab
                        </button>
                    </nav>
                </div>

                {/* The correct workflow manager is always rendered. It will be responsible
                    for showing the pricing page when a user with 0 credits tries to start a new action. */}
                {activeTab === 'video' && (
                    <VideoWorkflowManager
                        creditBalance={creditBalance ?? 0}
                        isFetchingCredits={isFetchingCredits}
                        updateCredits={updateCredits}
                        getToken={getToken}
                    />
                )}
                {activeTab === 'image' && (
                    <ImageWorkflowManager
                        creditBalance={creditBalance ?? 0}
                        isFetchingCredits={isFetchingCredits}
                        updateCredits={updateCredits}
                        getToken={getToken}
                    />
                )}
            </div>
        </div>
    );
}

// Main App Component remains the same
export default function App() {
    /* ... */
    return (
        <>
            <div className="bg-[#111115] min-h-screen font-sans text-[#F5F5F7] relative">
                <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden z-0">
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_20%_20%,_rgba(0,123,255,0.15),_transparent_30%)] animate-[spin_20s_linear_infinite]"></div>
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_80%_70%,_rgba(230,0,255,0.1),_transparent_30%)] animate-[spin_20s_linear_infinite_reverse]"></div>
                </div>
                <header className="absolute top-0 right-0 p-6 z-20">
                    <SignedIn>
                        <UserButton afterSignOutUrl="/" />
                    </SignedIn>
                </header>
                <main className="relative z-10 flex items-center justify-center min-h-screen p-4">
                    <SignedIn>
                        <VyralizePlatformManager />
                    </SignedIn>
                    <SignedOut>
                        <div className="text-center p-16 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
                            <h2 className="text-3xl font-bold mb-4">Welcome to Vyralize AI</h2>
                            <p className="text-[#8A8A8E] my-4">Please sign in to continue.</p>
                            <SignInButton mode="modal">
                                <button className="px-6 py-2 bg-gradient-to-r from-[#007BFF] to-[#E600FF] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity">
                                    Sign In
                                </button>
                            </SignInButton>
                        </div>
                    </SignedOut>
                </main>
            </div>
        </>
    );
}