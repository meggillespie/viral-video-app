import React, { useState, useEffect, useCallback, DragEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';

// --- Supabase Client Setup ---
// This replaces the need for a separate './supabaseClient.ts' file.
// Make sure your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file for local development
// and as Environment Variables in your Vercel project settings.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Using placeholders for the preview environment if the variables are not set.
const supabase = createClient(
    supabaseUrl || "https://example.supabase.co",
    supabaseAnonKey || "example-anon-key"
);


// --- Helper Components ---

// SVG Icon for the loading spinner
const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// Logo Icon
const Logo = () => (
    <svg className="w-8 h-8 text-[#007BFF]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
);

// --- Main App Component ---
export default function App() {
    return (
        <div className="bg-[#111115] min-h-screen font-sans text-[#F5F5F7] relative">
            {/* Aurora Background Effect */}
            <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden z-0">
                 <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_20%_20%,_rgba(0,123,255,0.15),_transparent_30%)] animate-[spin_20s_linear_infinite]"></div>
                 <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_80%_70%,_rgba(230,0,255,0.1),_transparent_30%)] animate-[spin_20s_linear_infinite_reverse]"></div>
            </div>

            <header className="absolute top-0 right-0 p-6 z-20">
                <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                </SignedIn>
            </header>
            
            <main className="relative z-10 flex items-center justify-center min-h-screen">
                <SignedIn>
                    <VideoDNAGenerator />
                </SignedIn>
                <SignedOut>
                    <div className="text-center p-16 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
                        <h2 className="text-3xl font-bold mb-4">Welcome to VideoDNA</h2>
                        <p className="text-[#8A8A8E] my-4">Please sign in to continue.</p>
                        <SignInButton mode="modal">
                            <button className="px-6 py-2 bg-[#007BFF] text-white font-semibold rounded-lg hover:bg-[#0056b3] transition-colors">
                                Sign In
                            </button>
                        </SignInButton>
                    </div>
                </SignedOut>
            </main>
        </div>
    );
}


// --- The Core Application Logic & UI ---
function VideoDNAGenerator() {
    const { user } = useUser();
    const { getToken } = useAuth();

    // --- STATE MANAGEMENT ---
    // User & Credits
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);
    
    // Form Inputs
    const [videoSource, setVideoSource] = useState(''); // Can be URL or file name
    const [topic, setTopic] = useState('');
    const [outputDetail, setOutputDetail] = useState('Short Form');
    const [outputType, setOutputType] = useState('AI Video Prompts');
    const [videoFile, setVideoFile] = useState<File | null>(null);

    // UI & Generation State
    const [isLoading, setIsLoading] = useState(false);
    const [generatedResult, setGeneratedResult] = useState('');
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // --- DATA FETCHING ---
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

    // --- FILE HANDLING ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setVideoFile(e.target.files[0]);
            setVideoSource(e.target.files[0].name); // Show file name
        }
    };

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            if (e.dataTransfer.files[0].type.startsWith('video/')) {
                setVideoFile(e.dataTransfer.files[0]);
                setVideoSource(e.dataTransfer.files[0].name);
                setError('');
            } else {
                setError('Please drop a valid video file.');
            }
        }
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    // --- CORE LOGIC ---
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setGeneratedResult('');
        
        // TODO: Implement Phase 2 Logic
        // 1. Check creditBalance > 0
        // 2. Validate inputs (topic, videoSource/videoFile)
        // 3. Check video duration (will require a backend helper)
        // 4. Set isLoading(true)
        // 5. Call the new `api/generate` Vercel function
        // 6. Call the `decrement-credits` Supabase function on success
        // 7. Set result or error
        // 8. Set isLoading(false)

        console.log({
            videoSource,
            topic,
            outputDetail,
            outputType,
            videoFile
        });

        // Placeholder for now
        setError("Generation logic not yet implemented.");
    };

    // --- UI RENDERING ---
    return (
        <div className="w-full max-w-lg mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Logo />
                        <h1 className="text-2xl font-bold text-brand-light">VideoDNA</h1>
                    </div>
                    <div className="text-sm text-[#8A8A8E] bg-black/20 border border-[rgba(255,255,255,0.1)] px-3 py-1 rounded-full">
                        {isFetchingCredits ? '...' : creditBalance ?? 0} Credits
                    </div>
                </div>

                {/* Main Form */}
                <form onSubmit={handleGenerate} className="space-y-6">
                    {/* Step 1: Video Input */}
                    <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">1. Source Video</label>
                        <div className={`bg-black/30 border-2 border-dashed ${isDragging ? 'border-[#007BFF]' : 'border-brand-gray/40'} rounded-lg p-6 text-center cursor-pointer hover:border-[#007BFF] transition-colors group relative`}>
                             <input
                                type="file"
                                id="videoFile"
                                onChange={handleFileChange}
                                accept="video/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={isLoading}
                            />
                            <svg className="mx-auto h-12 w-12 text-[#8A8A8E] group-hover:text-[#007BFF] transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            <p className="mt-2 text-sm text-[#8A8A8E]">Drag & Drop or <span className="font-semibold text-[#007BFF]">paste a link</span></p>
                            <input 
                                id="video-link" 
                                type="text" 
                                value={videoSource}
                                onChange={(e) => {
                                    setVideoSource(e.target.value);
                                    setVideoFile(null);
                                }}
                                className="mt-4 w-full bg-brand-dark/50 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" 
                                placeholder="https://youtube.com/watch?v=..."
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Step 2: New Topic */}
                    <div>
                        <label htmlFor="new-topic" className="text-sm font-medium text-[#8A8A8E] mb-2 block">2. New Topic</label>
                        <input id="new-topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" placeholder="e.g., 'The Future of AI Assistants'" disabled={isLoading} />
                    </div>

                    {/* Step 3 & 4: Segmented Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">3. Output Detail</label>
                            <div className="flex bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md p-1 segmented-control">
                                <input type="radio" name="output-detail" id="detail-short" checked={outputDetail === 'Short Form'} onChange={() => setOutputDetail('Short Form')} disabled={isLoading} />
                                <label htmlFor="detail-short" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer">Short Form</label>
                                <input type="radio" name="output-detail" id="detail-long" checked={outputDetail === 'Long Form'} onChange={() => setOutputDetail('Long Form')} disabled={isLoading} />
                                <label htmlFor="detail-long" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer">Long Form</label>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">4. Desired Output</label>
                            <div className="flex bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md p-1 segmented-control">
                                <input type="radio" name="output-type" id="type-script" checked={outputType === 'Script & Analysis'} onChange={() => setOutputType('Script & Analysis')} disabled={isLoading} />
                                <label htmlFor="type-script" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer text-xs sm:text-sm">Script & Analysis</label>
                                <input type="radio" name="output-type" id="type-prompts" checked={outputType === 'AI Video Prompts'} onChange={() => setOutputType('AI Video Prompts')} disabled={isLoading} />
                                <label htmlFor="type-prompts" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer text-xs sm:text-sm">AI Video Prompts</label>
                            </div>
                        </div>
                    </div>
                    
                    {/* Action Button */}
                    <div className="pt-4">
                        <button type="submit" disabled={isLoading} className="w-full px-6 py-3 font-bold text-white bg-[#007BFF] rounded-lg hover:bg-[#0056b3] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(0,123,255,0.3)] focus:outline-none focus:ring-4 focus:ring-brand-blue/50 disabled:bg-[#0056b3]/50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center">
                            {isLoading ? <Spinner /> : null}
                            {isLoading ? 'Generating...' : 'Generate'}
                        </button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                            <strong className="font-bold">Error: </strong>
                            <span>{error}</span>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
