// File: frontend/src/App.tsx

import React, { useState, useEffect, useCallback, DragEvent, ChangeEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';

// --- Client Setups & Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "example-anon-key");

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;
const MAX_DURATION_SECONDS = 120; // 2 min. limit for video

// --- Helper Components & Types ---

// Video Types (unchanged)
interface AnalysisResult {
    meta: { analyzed_style: string; primary_tone: string; };
    hook_analysis: { technique: string; pacing: string; emotional_trigger: string; };
    retention_signals: { pacing_strategy: string; narrative_structure: string; visual_style: string; };
    engagement_tactics: { ctas: string[]; interactive_elements: string; };
    [key: string]: any;
}
type VideoOutputType = 'Script' | 'AI Video Prompts';

// Image Types (Updated)
interface ImageGenerationResult {
    imageUrl: string;
    posts: { linkedin: string; twitter: string; instagram: string; facebook: string; };
    headline: string | null;
}

// New Image Analysis Types based on backend/PDF
interface ImageAnalysisResult {
    subjects: Array<{
        name: string;
        description: string;
        prominence: string;
    }>;
    setting: {
        location: string;
        time_of_day: string;
        context: string;
    };
    style_elements: {
        artistic_medium: string;
        photography_style: string;
        lighting: string;
        color_palette: {
            dominant_colors: string[];
            description: string;
        };
        composition: string;
        overall_mood: string;
    };
}

type ImageGenerationIntent = 'AdaptRemix' | 'ExtractStyle';
type AspectRatio = '1:1' | '4:5' | '9:16';


// Icons & UI Elements (unchanged)
const Spinner = () => ( <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> );
// MODIFIED: Logo now uses an SVG gradient
const Logo = () => (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#007BFF'}} />
                <stop offset="100%" style={{stopColor: '#E600FF'}} />
            </linearGradient>
        </defs>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#logoGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
);
const CopyIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg> );
// Icons for Tabs
const VideoIcon = () => (<svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553 2.276A1 1 0 0120 13.224v2.552a1 1 0 01-.447.848L15 18.9V10zM5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>);
const ImageIcon = () => (<svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);

// MODIFIED: This component now handles more markdown cases and renders cleaner rich text.
const MarkdownRenderer = ({ text }: { text: string }) => {
    const html = text
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-white">$1</h3>') // For headings
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // For bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // For italics
        .replace(/(\r\n|\n|\r)/g, '<br>'); // For line breaks
    // The 'font-mono' class was removed to provide a more natural reading experience.
    return <div className="whitespace-pre-wrap text-sm text-brand-light/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
};

// MODIFIED: The copy function now correctly creates rich text HTML for the clipboard.
const handleCopy = async (textToCopy: string, isFormatted: boolean = false, setCopyStatus: (status: string) => void, feedbackId: string = 'global') => {
    try {
        if (isFormatted) {
            // This logic mirrors the MarkdownRenderer to ensure what you see is what you copy.
            const html = textToCopy
                .replace(/^### (.*$)/gim, '<h3>$1</h3>') // Headings
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
                .replace(/(\r\n|\n|\r)/g, '<br>'); // Line breaks
            
            // A plain text version is also created as a fallback for apps that don't support rich text.
            const plainText = textToCopy
                .replace(/^### (.*$)/gim, '$1')
                .replace(/\*\*|\*/g, '');

            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobPlain = new Blob([plainText], { type: 'text/plain' });
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobPlain })]);
        } else {
            await navigator.clipboard.writeText(textToCopy);
        }
        setCopyStatus(feedbackId);
        setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
};

// --- Main App Component (Wrapper) (unchanged) ---
export default function App() {
    // (App structure remains the same)
    return (
        <>
            <div className="bg-[#111115] min-h-screen font-sans text-[#F5F5F7] relative">
                <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden z-0">
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_20%_20%,_rgba(0,123,255,0.15),_transparent_30%)] animate-[spin_20s_linear_infinite]"></div>
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_80%_70%,_rgba(230,0,255,0.1),_transparent_30%)] animate-[spin_20s_linear_infinite_reverse]"></div>
                </div>
                <header className="absolute top-0 right-0 p-6 z-20"><SignedIn><UserButton afterSignOutUrl="/" /></SignedIn></header>
                <main className="relative z-10 flex items-center justify-center min-h-screen p-4">
                    <SignedIn><VyralizePlatformManager /></SignedIn>
                    <SignedOut>
                        <div className="text-center p-16 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
                            <h2 className="text-3xl font-bold mb-4">Welcome to Vyralize AI</h2>
                            <p className="text-[#8A8A8E] my-4">Please sign in to continue.</p>
                            <SignInButton mode="modal"><button className="px-6 py-2 bg-gradient-to-r from-[#007BFF] to-[#E600FF] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity">Sign In</button></SignInButton>
                        </div>
                    </SignedOut>
                </main>
            </div>
        </>
    );
}

// ============================================================================
// Platform Manager (Handles Tabs and Shared State)
// ============================================================================

function VyralizePlatformManager() {
    const { getToken } = useAuth();
    const { user } = useUser();

    // Tab State
    // MODIFIED: Defaulting to video tab
    const [activeTab, setActiveTab] = useState<'video' | 'image'>('video');

    // Shared User/Credit State
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);

    // Load Credits (Centralized)
    useEffect(() => {
        const loadUserData = async () => {
            if (user && getToken) {
                setIsFetchingCredits(true);
                try {
                    const token = await getToken({ template: 'supabase' });
                    if (!token) throw new Error("Clerk token not found.");
                    const { data, error: funcError } = await supabase.functions.invoke('get-credits', { headers: { Authorization: `Bearer ${token}` } });
                    if (funcError) throw funcError;
                    setCreditBalance(data.credit_balance);
                } catch (err) { console.error("Error loading user data:", err); setCreditBalance(0); }
                finally { setIsFetchingCredits(false); }
            }
        };
        loadUserData();
    }, [user, getToken]);

    // Centralized credit update function passed down to workflow managers
    const updateCredits = useCallback(() => {
        setCreditBalance(prev => (prev ? prev - 1 : 0));
    }, []);

    // Determine the container size based on the active tab
    // The new image workflow requires a wider view for the configuration and results steps.
    const containerWidthClass = activeTab === 'image' ? 'max-w-5xl' : 'max-w-2xl';

    return (
        // Container width is now dynamic
        <div className={`w-full ${containerWidthClass} mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-500`}>
            <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8">
                    {/* MODIFIED: Updated branding with gradient text and tagline */}
                    <div className="flex items-center">
                        <div className="flex items-center gap-3">
                            <Logo />
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#007BFF] to-[#E600FF] bg-clip-text text-transparent">Vyralize AI</h1>
                        </div>
                         <p className="hidden sm:block text-xs text-gray-400 border-l border-gray-600 ml-3 pl-3">Create What Captivates</p>
                    </div>
                    <div className="text-sm text-[#8A8A8E] bg-black/20 border border-[rgba(255,255,255,0.1)] px-3 py-1 rounded-full">{isFetchingCredits ? '...' : creditBalance ?? 0} Credits</div>
                </div>

                {/* Tab Navigation */}
                <div className="mb-8 border-b border-gray-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('video')}
                            // Using Blue accent for Video tab
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
                            // Using Purple accent for Image tab
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

                {/* Tab Content */}
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


// ============================================================================
// Shared Workflow Props Interface
// ============================================================================
interface WorkflowManagerProps {
    creditBalance: number;
    isFetchingCredits: boolean;
    updateCredits: () => void;
    getToken: Function;
}

// ============================================================================
// Image Workflow Manager (Refactored for Multi-Step Process)
// ============================================================================

// This manager now mirrors the structure of the VideoWorkflowManager
function ImageWorkflowManager({ creditBalance, isFetchingCredits, updateCredits, getToken }: WorkflowManagerProps) {
    // Workflow State
    const [step, setStep] = useState<'input' | 'analysis' | 'generation'>('input');

    // Data State (Persists across steps)
    const [topic, setTopic] = useState('');
    const [details, setDetails] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
    const [generatedResult, setGeneratedResult] = useState<ImageGenerationResult | null>(null);


    // --- Callbacks for State Transitions ---

    // Called when analysis is successful (triggered in ImageInputForm)
    const handleAnalysisComplete = useCallback((result: ImageAnalysisResult, newTopic: string, newDetails: string, preview: string) => {
        setAnalysisResult(result);
        setTopic(newTopic);
        setDetails(newDetails);
        setImagePreview(preview);
        // Credit deduction happens in the InputForm upon successful analysis.
        setStep('analysis');
    }, []);

    // Called when generation is successful (triggered in ImageAnalysisDisplay)
    const handleGenerationComplete = useCallback((result: ImageGenerationResult) => {
        setGeneratedResult(result);
        setStep('generation');
    }, []);

    // Resets the entire workflow
    const handleReset = useCallback(() => {
        setTopic('');
        setDetails('');
        setImagePreview(null);
        setAnalysisResult(null);
        setGeneratedResult(null);
        setStep('input');
    }, []);

    // Determine which component to render based on the current step
    const renderStep = () => {
        switch (step) {
            case 'input':
                return (
                    <ImageInputForm
                        onAnalysisComplete={handleAnalysisComplete}
                        creditBalance={creditBalance}
                        isFetchingCredits={isFetchingCredits}
                        getToken={getToken}
                        updateCredits={updateCredits}
                    />
                );
            case 'analysis':
                // This step now handles the Intent configuration (PDF steps 4 & 5)
                return (
                    <ImageAnalysisDisplay
                        analysis={analysisResult!}
                        topic={topic}
                        details={details}
                        imagePreview={imagePreview!}
                        onGenerationComplete={handleGenerationComplete}
                    />
                );
            case 'generation':
                return (
                    <ImageGenerationOutput
                        result={generatedResult!}
                        onReset={handleReset}
                    />
                );
        }
    };

    return <>{renderStep()}</>;
}

// ============================================================================
// Image Workflow Components (InputForm, AnalysisDisplay, GenerationOutput)
// ============================================================================

// --- Image Input Form (Step 1: Input and Analysis API Call) ---

interface ImageInputFormProps {
    onAnalysisComplete: (result: ImageAnalysisResult, newTopic: string, newDetails: string, preview: string) => void;
    creditBalance: number;
    isFetchingCredits: boolean;
    getToken: Function;
    updateCredits: () => void;
}

function ImageInputForm({ onAnalysisComplete, creditBalance, isFetchingCredits, getToken, updateCredits }: ImageInputFormProps) {
    // Input State
    const [sourceImage, setSourceImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [topic, setTopic] = useState('');
    const [details, setDetails] = useState('');

    // Loading/Error State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            setSourceImage(file);
            const reader = new FileReader();
            reader.onloadend = () => { setImagePreview(reader.result as string); };
            reader.readAsDataURL(file);
            setError('');
        } else if (file) {
            setError('Please upload a valid image file.');
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        handleFileChange(e.target.files?.[0] || null);
    };

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileChange(file);
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);


    // Handle Analyze (Step 1 of the new workflow)
    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!BACKEND_API_URL) { setError("Configuration error."); return; }
        if (creditBalance <= 0) { setError("You have no credits left."); return; }
        if (!topic) { setError("Please enter a topic."); return; }
        if (!sourceImage || !imagePreview) { setError("Please upload a source image."); return; }

        setIsLoading(true);

        try {
            // Prepare the multipart/form-data payload for the analysis endpoint
            const formData = new FormData();
            // 'sourceImage' must match the multer configuration for the new /api/analyze-image route
            formData.append('sourceImage', sourceImage);

            // Call the backend analysis endpoint
            // Note: We are calling the new endpoint /api/analyze-image
            const response = await fetch(`${BACKEND_API_URL}/api/analyze-image`, {
                method: 'POST',
                body: formData, // Do not set Content-Type header
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(errData.error || 'Image analysis failed.');
            }

            const data = await response.json();
            if (!data.analysis) {
                throw new Error("Received unexpected format from the analysis API.");
            }

            // --- Credit Deduction (only on successful analysis, mirroring the Video workflow) ---
            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { headers: { Authorization: `Bearer ${token}` } });

            if (decrementError) {
                console.error("Credit decrement failed, but analysis succeeded.", decrementError);
                // We proceed as the analysis was successful, but log the error.
            } else {
                updateCredits();
            }

            // Transition to the next step
            onAnalysisComplete(data.analysis, topic, details, imagePreview);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Loading Overlay (Using Purple spinner for Image tab)
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-12 h-12 border-4 border-gray-700 border-t-[#E600FF] rounded-full animate-spin"></div>
                <p className="text-gray-300 font-semibold">Analyzing Image DNA...</p>
            </div>
        );
    }

    // Input Form UI (Centered layout for the input phase)
    return (
        <form onSubmit={handleAnalyze} className="space-y-6 max-w-2xl mx-auto">
            {error && (<div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert"><strong className="font-bold">Error: </strong><span>{error}</span></div>)}

            {/* 1. Image Uploader */}
            <div>
                <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">1. Upload Source Image</label>
                <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`bg-black/30 border-2 border-dashed ${isDragging ? 'border-[#E600FF]' : 'border-brand-gray/40'} rounded-lg p-6 text-center cursor-pointer hover:border-[#E600FF] transition-colors group relative flex items-center justify-center min-h-[12rem]`}>
                    <input type="file" id="imageFile" onChange={handleInputChange} accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isLoading} />
                    {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md relative z-0"/>
                    ) : (
                        <div className="relative z-0 pointer-events-none flex flex-col items-center">
                            <svg className="mx-auto h-12 w-12 text-[#8A8A8E] group-hover:text-[#E600FF] transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            <p className="mt-2 text-sm text-[#8A8A8E]">Drag & Drop or <span className="font-semibold text-[#E600FF]">Click to upload</span></p>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Topic */}
            <div>
                <label htmlFor="image-topic" className="text-sm font-medium text-[#8A8A8E] mb-2 block">2. New Content Topic</label>
                <input id="image-topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#E600FF] focus:outline-none" placeholder="e.g., 'AI in Healthcare'" disabled={isLoading} />
            </div>

            {/* 3. Details */}
             <div>
                <label htmlFor="image-details" className="text-sm font-medium text-[#8A8A8E] mb-2 block">3. Details (Optional)</label>
                <textarea id="image-details" rows={3} value={details} onChange={e => setDetails(e.target.value)} className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#E600FF] focus:outline-none" placeholder="e.g., Recent breakthroughs in diagnostics" disabled={isLoading} />
            </div>

            {/* Analyze Button (Using Gradient) */}
            <div className="pt-4">
                <button type="submit" disabled={isLoading || isFetchingCredits}
                    className="w-full px-6 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] focus:outline-none focus:ring-4 focus:ring-[#E600FF]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center">
                    Analyze & Continue (1 Credit)
                </button>
            </div>
        </form>
    );
}

// --- Icons for Aspect Ratio ---
const Icon1x1 = ({ className }: { className?: string }) => (<svg className={className} viewBox="0 0 20 20" fill="currentColor"><rect width="20" height="20" rx="2"></rect></svg>);
const Icon4x5 = ({ className }: { className?: string }) => (<svg className={className} viewBox="0 0 16 20" fill="currentColor"><rect width="16" height="20" rx="2"></rect></svg>);
const Icon9x16 = ({ className }: { className?: string }) => (<svg className={className} viewBox="0 0 9 16" fill="currentColor"><rect width="9" height="16" rx="1.5"></rect></svg>);

// --- Image Analysis Display & Intent Selection (Step 2: Configuration and Generation API Call) ---

interface ImageAnalysisDisplayProps {
    analysis: ImageAnalysisResult;
    topic: string;
    details: string;
    imagePreview: string;
    onGenerationComplete: (result: ImageGenerationResult) => void;
}

function ImageAnalysisDisplay({ analysis, topic, details, imagePreview, onGenerationComplete }: ImageAnalysisDisplayProps) {
    // State for Intent Selection (PDF Steps 4 & 5)
    const [intent, setIntent] = useState<ImageGenerationIntent>('AdaptRemix');
    const [controlLevel, setControlLevel] = useState(50);
    const [withTextOverlay, setWithTextOverlay] = useState(true);
    // NEW: State for Aspect Ratio
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');

    // Loading/Error State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!BACKEND_API_URL) {
            setError("Configuration error.");
            setIsLoading(false);
            return;
        }

        try {
            // Call the updated generate-image-content endpoint
            const response = await fetch(`${BACKEND_API_URL}/api/generate-image-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    details: details,
                    analysis: analysis,
                    intent: intent,
                    controlLevel: controlLevel,
                    withTextOverlay: withTextOverlay,
                    aspectRatio: aspectRatio, // MODIFIED: Pass aspect ratio to backend
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(errData.error || 'Image generation failed.');
            }

            const data = await response.json();
            if (!data.result) {
                throw new Error("Received unexpected format from the generation API.");
            }

            // Transition to the next step
            onGenerationComplete(data.result);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to summarize analysis for the UI Mockup suggested in the PDF
    const detectedSubjects = analysis.subjects.map(s => s.name).join(', ') || 'None';
    const detectedStyle = `${analysis.style_elements.photography_style || analysis.style_elements.artistic_medium}, ${analysis.style_elements.lighting} lighting, ${analysis.style_elements.composition}` || 'Standard Style';

    // Determine slider configuration based on intent (PDF Step 5)
    const sliderConfig = intent === 'AdaptRemix' ? {
        label: 'Creative Freedom',
        minLabel: 'Faithful Adaptation',
        maxLabel: 'Abstract Interpretation'
    } : {
        label: 'Style Adherence',
        minLabel: 'Loosely Inspired',
        maxLabel: 'Strictly Follow Style'
    };

    // Helper for aspect ratio button classes
    const getAspectRatioButtonClass = (ratio: AspectRatio) => {
        const baseClass = "flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors";
        return aspectRatio === ratio
            ? `${baseClass} bg-[#E600FF]/20 text-[#E600FF] border border-[#E600FF]`
            : `${baseClass} bg-black/30 hover:bg-black/50 border border-transparent`;
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-brand-light text-center">Analysis Complete: Select Intent</h2>

            {error && (<div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert"><strong className="font-bold">Error: </strong><span>{error}</span></div>)}

            {/* Analysis Summary (UI Mockup Idea from PDF) */}
            <div className="flex flex-col md:flex-row gap-6 bg-black/30 p-6 rounded-lg border border-[rgba(255,255,255,0.1)]">
                <div className='flex justify-center items-center md:w-1/4'>
                    <img src={imagePreview} alt="Source Preview" className="max-h-40 rounded-md shadow-lg"/>
                </div>
                <div className="md:w-3/4 space-y-4">
                    <p className="text-[#8A8A8E]">Applying insights to: <strong className="text-white">"{topic}"</strong>.</p>
                    <div>
                        <h4 className="font-semibold text-[#E600FF]">Detected Subjects:</h4>
                        <p className="text-sm text-[#F5F5F7]/80">{detectedSubjects}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-[#E600FF]">Detected Style:</h4>
                        <p className="text-sm text-[#F5F5F7]/80">{detectedStyle}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-8">

                {/* Step 4: The "Intent" Choice (New Step from PDF) */}
                <div>
                    <label className="text-lg font-medium text-white mb-4 block text-center">How do you want to use this image?</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Option A: Adapt & Remix */}
                        <div
                            onClick={() => setIntent('AdaptRemix')}
                            className={`p-6 rounded-xl border-4 cursor-pointer transition-all ${
                                intent === 'AdaptRemix' ? 'border-[#E600FF] bg-black/50 shadow-[0_0_20px_0_rgba(230,0,255,0.2)]' : 'border-transparent bg-black/30 hover:bg-black/50'
                            }`}
                        >
                            <h4 className="text-xl font-bold text-white mb-2">Adapt & Remix</h4>
                            <p className="text-sm text-[#8A8A8E]">Keep the original subjects (<span className='text-white'>{detectedSubjects}</span>) and setting, but adapt the scene to your new topic.</p>
                        </div>

                        {/* Option B: Extract & Apply Style */}
                        <div
                            onClick={() => setIntent('ExtractStyle')}
                            className={`p-6 rounded-xl border-4 cursor-pointer transition-all ${
                                intent === 'ExtractStyle' ? 'border-[#E600FF] bg-black/50 shadow-[0_0_20px_0_rgba(230,0,255,0.2)]' : 'border-transparent bg-black/30 hover:bg-black/50'
                            }`}
                        >
                            <h4 className="text-xl font-bold text-white mb-2">Extract & Apply Style</h4>
                            <p className="text-sm text-[#8A8A8E]">Create a brand new image about your topic using <span className='text-white'>only the visual style</span> of the uploaded image.</p>
                        </div>
                    </div>
                </div>

                {/* NEW: Aspect Ratio Selection */}
                <div>
                    <label className="text-lg font-medium text-white mb-4 block text-center">Select Aspect Ratio</label>
                    <div className="flex justify-center items-center gap-4">
                        <button type="button" onClick={() => setAspectRatio('1:1')} className={getAspectRatioButtonClass('1:1')}>
                            <Icon1x1 className="h-8 w-8" />
                            <span className="text-xs font-semibold">1:1</span>
                        </button>
                         <button type="button" onClick={() => setAspectRatio('4:5')} className={getAspectRatioButtonClass('4:5')}>
                            <Icon4x5 className="h-8 w-8" />
                            <span className="text-xs font-semibold">4:5</span>
                        </button>
                         <button type="button" onClick={() => setAspectRatio('9:16')} className={getAspectRatioButtonClass('9:16')}>
                            <Icon9x16 className="h-8 w-8" />
                            <span className="text-xs font-semibold">9:16</span>
                        </button>
                    </div>
                </div>


                {/* Step 5: The "Creative Control" Slider (Repurposed Slider from PDF) */}
                <div className="max-w-3xl mx-auto">
                    <label htmlFor="control-level" className="flex justify-between items-center text-lg font-medium text-white mb-4">
                        <span>{sliderConfig.label}</span>
                        {/* Using Purple accent for the slider value */}
                        <span className="text-[#E600FF] font-semibold">{controlLevel}%</span>
                    </label>
                    <input
                        id="control-level"
                        type="range"
                        min="0"
                        max="100"
                        value={controlLevel}
                        onChange={(e) => setControlLevel(Number(e.target.value))}
                        // Tailwind utility classes for styling the slider thumb (accent color)
                        className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer range-lg accent-[#E600FF]"
                        disabled={isLoading}
                    />
                     <div className="flex justify-between text-sm text-gray-400 mt-2">
                        <span>{sliderConfig.minLabel}</span>
                        <span>{sliderConfig.maxLabel}</span>
                    </div>
                </div>

                {/* Text Overlay Toggle (Moved from InputForm) */}
                <div className="flex items-center justify-center bg-black/30 p-3 rounded-lg border border-[rgba(255,255,255,0.1)] max-w-md mx-auto">
                    <span className="text-sm font-medium text-[#8A8A8E] mr-4">Generate Text Overlay Headline?</span>
                    <label htmlFor="text-overlay-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="text-overlay-toggle" className="sr-only peer" checked={withTextOverlay} onChange={() => setWithTextOverlay(!withTextOverlay)} disabled={isLoading} />
                        {/* Tailwind utility classes for the toggle switch styling */}
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-[#E600FF]/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E600FF]"></div>
                    </label>
                </div>

                {/* Generate Button */}
                <div className="pt-4 flex justify-center">
                    <button type="submit" disabled={isLoading}
                        className="px-12 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] focus:outline-none focus:ring-4 focus:ring-[#E600FF]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center">
                        {isLoading ? <Spinner /> : null}
                        {isLoading ? 'Generating Content...' : 'Generate Image & Posts'}
                    </button>
                </div>
            </form>
        </div>
    );
}


// ============================================================================
// Image Generation Output (Step 3: Results)
// ============================================================================

interface ImageGenerationOutputProps {
    result: ImageGenerationResult;
    onReset: () => void;
}

function ImageGenerationOutput({ result, onReset }: ImageGenerationOutputProps) {
    const [copyStatus, setCopyStatus] = useState('');

    // Helper to render social posts cleanly (unchanged)
    const renderPost = (platform: string, content: string) => (
        // Check if content exists before rendering the block
        content ? (
            <div className="bg-black/40 p-4 rounded-lg border border-[rgba(255,255,255,0.1)]">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-white">{platform}</h4>
                    <button
                        // Use the shared handleCopy function
                        onClick={() => handleCopy(content, false, setCopyStatus, platform)}
                        className="text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 p-2 rounded-md"
                    >
                        {copyStatus === platform ? 'Copied!' : <CopyIcon />}
                    </button>
                </div>
                <p className="text-sm text-[#F5F5F7]/80 whitespace-pre-wrap">{content}</p>
            </div>
        ) : null
    );

    // Function to handle image download (unchanged)
    const downloadImage = () => {
        const link = document.createElement('a');
        link.href = result.imageUrl;
        link.download = `vyralize-generated-image.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Layout uses a two-column view for better presentation of results
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <h2 className="text-2xl font-bold text-brand-light lg:col-span-2">Generation Complete</h2>

            {/* Left Panel: Image Display */}
            <div className="space-y-6">
                <div className="relative group">
                    <img src={result.imageUrl} alt="Generated Content" className="w-full rounded-lg shadow-xl"/>

                    {/* Optional Headline Overlay (For visual representation) */}
                    {result.headline && (
                        <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50 rounded-lg">
                            {/* Simple text shadow styling added for readability */}
                            <p className="text-white text-2xl lg:text-3xl font-bold text-center" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>{result.headline}</p>
                        </div>
                    )}

                    {/* Download Button (Appears on hover) */}
                    <button
                        onClick={downloadImage}
                        // Uses the Purple accent
                        className="absolute top-2 right-2 bg-[#E600FF] text-white p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#b300c7]"
                        title="Download Image"
                    >
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                </div>
                
                <div className="w-full rounded-lg bg-gradient-to-r from-[#007BFF] to-[#E600FF] p-[2px] transition-all duration-300 hover:shadow-[0_0_15px_0_rgba(128,0,255,0.4)] mt-4">
                    <button
                        onClick={onReset}
                        className="w-full px-6 py-3 font-bold text-white bg-[#111115] rounded-md hover:bg-gray-800 transition-all duration-300"
                    >
                        Start New Analysis (1 Credit)
                    </button>
                </div>
            </div>

            {/* Right Panel: Social Posts */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Social Media Posts</h3>
                {renderPost("LinkedIn", result.posts.linkedin)}
                {renderPost("X", result.posts.twitter)}
                {renderPost("Instagram", result.posts.instagram)}
                {renderPost("Facebook", result.posts.facebook)}
            </div>
        </div>
    );
}


// ============================================================================
// Video Workflow Manager (Previously VyralizeWorkflowManager)
// ============================================================================

// (The entire Video Workflow section remains unchanged from the provided files, pasted below for completeness)

function VideoWorkflowManager({ creditBalance, isFetchingCredits, updateCredits, getToken }: WorkflowManagerProps) {
    // Workflow State
    const [step, setStep] = useState<'input' | 'analysis' | 'generation'>('input');

    // Data State (Persists across steps)
    const [topic, setTopic] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [generatedContent, setGeneratedContent] = useState<string | string[] | null>(null);
    const [generatedType, setGeneratedType] = useState<VideoOutputType | null>(null);

    // --- Callbacks for State Transitions ---

    // Called when analysis is successful
    const handleAnalysisComplete = useCallback((result: AnalysisResult, newTopic: string) => {
        setAnalysisResult(result);
        setTopic(newTopic);
        // Credit deduction is handled in the InputForm, which calls updateCredits.
        setStep('analysis');
    }, []);

    // Called when generation is successful
    const handleGenerationComplete = useCallback((content: string | string[], type: VideoOutputType) => {
        setGeneratedContent(content);
        setGeneratedType(type);
        setStep('generation');
    }, []);

    // Resets the entire workflow
    const handleReset = useCallback(() => {
        setTopic('');
        setAnalysisResult(null);
        setGeneratedContent(null);
        setGeneratedType(null);
        setStep('input');
    }, []);

    // Determine which component to render based on the current step
    const renderStep = () => {
        switch (step) {
            case 'input':
                return (
                    <VideoInputForm
                        onAnalysisComplete={handleAnalysisComplete}
                        creditBalance={creditBalance}
                        isFetchingCredits={isFetchingCredits}
                        getToken={getToken}
                        updateCredits={updateCredits}
                    />
                );
            case 'analysis':
                return (
                    <VideoAnalysisDisplay
                        analysis={analysisResult!}
                        topic={topic}
                        onGenerationComplete={handleGenerationComplete}
                    />
                );
            case 'generation':
                return (
                    <VideoGenerationOutput
                        content={generatedContent!}
                        type={generatedType!}
                        onReset={handleReset}
                    />
                );
        }
    };

    return <>{renderStep()}</>;
}

// ============================================================================
// Video Workflow Components (InputForm, AnalysisDisplay, GenerationOutput)
// ============================================================================

interface VideoInputFormProps {
    onAnalysisComplete: (result: AnalysisResult, newTopic: string) => void;
    creditBalance: number;
    isFetchingCredits: boolean;
    getToken: Function;
    updateCredits: () => void;
}

function VideoInputForm({ onAnalysisComplete, creditBalance, isFetchingCredits, getToken, updateCredits }: VideoInputFormProps) {
    // (State definitions remain the same)
    const [videoSource, setVideoSource] = useState('');
    const [topic, setTopic] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // (File Handling Logic - checkFileDuration, handleFileChange, handleDrop, etc. - remains the same)
    const checkFileDuration = (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > MAX_DURATION_SECONDS) {
                    const durationMins = (video.duration / 60).toFixed(1);
                    reject(new Error(`Video is too long (${durationMins} mins). Max 2 mins.`));
                } else { resolve(); }
            };
            video.onerror = () => reject(new Error('Could not read video file metadata.'));
            video.src = window.URL.createObjectURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setError(''); setVideoFile(null); setVideoSource('');
            try { await checkFileDuration(file); setVideoFile(file); setVideoSource(file.name); }
            catch (err: any) { setError(err.message); }
        }
    };

    const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setError(''); setVideoFile(null); setVideoSource('');
            try { await checkFileDuration(file); setVideoFile(file); setVideoSource(file.name); }
            catch (err: any) { setError(err.message); }
        } else { setError('Please drop a valid video file.'); }
    }, []);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);

    // --- Handle Analyze (The core logic for Step 1) ---
    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setStatusMessage('');

        // (Validation checks)
        if (!BACKEND_API_URL) { setError("Configuration error."); return; }
        if (creditBalance <= 0) { setError("You have no credits left."); return; }
        if (!topic) { setError("Please enter a topic."); return; }
        if (!videoSource && !videoFile) { setError("Please provide a source video."); return; }

        setIsLoading(true);

        try {
            let finalFileUri = '';
            let finalMimeType = '';

            // --- Video Upload/Validation ---
            if (videoFile) {
                // Flow A: Signed URL Upload & Transfer
                setStatusMessage('Authorizing secure upload...');
                const authResponse = await fetch(`${BACKEND_API_URL}/api/create-signed-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: videoFile.name, contentType: videoFile.type }),
                });
                if (!authResponse.ok) throw new Error('Failed to get authorization.');
                const { signedUrl, path, token } = await authResponse.json();

                setStatusMessage('Uploading video...');
                const uploadResponse = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': videoFile.type, 'Authorization': `Bearer ${token}`, 'x-upsert': 'true' },
                    body: videoFile,
                });
                if (!uploadResponse.ok) throw new Error('Failed to upload video.');

                setStatusMessage('Processing video (this may take time)...');
                const transferResponse = await fetch(`${BACKEND_API_URL}/api/transfer-to-gemini`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: path, mimeType: videoFile.type }),
                });
                if (!transferResponse.ok) throw new Error(`Video transfer failed.`);
                const transferData = await transferResponse.json();
                finalFileUri = transferData.fileUri;
                finalMimeType = transferData.mimeType;

            } else {
                // Flow B: YouTube Link
                setStatusMessage('Checking video duration...');
                const durationResponse = await fetch(`${BACKEND_API_URL}/api/get-video-duration`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: videoSource }),
                });
                if (!durationResponse.ok) throw new Error('Could not validate video URL.');
                const { duration } = await durationResponse.json();

                if (duration > MAX_DURATION_SECONDS) {
                    const durationMins = (duration / 60).toFixed(1);
                    throw new Error(`Video is too long (${durationMins} mins). Max 2 mins.`);
                }
                finalFileUri = videoSource;
                finalMimeType = 'video/youtube';
            }

            // --- Call the Analyze Endpoint ---
            setStatusMessage('Analyzing Viral DNA...');
            const response = await fetch(`${BACKEND_API_URL}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoSource: finalFileUri,
                    mimeType: finalMimeType
                }),
            });

            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || `Analysis request failed`); }
            const data = await response.json();

             if (!data.analysis) {
                throw new Error("Received unexpected format from the analysis API.");
            }

            // --- Credit Deduction ---
            const authToken = await getToken({ template: 'supabase' });
            if (!authToken) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { headers: { Authorization: `Bearer ${authToken}` } });

            if (decrementError) {
                console.error("Credit decrement failed, but analysis succeeded.", decrementError);
            } else {
                updateCredits();
            }

            // Transition to the next step
            onAnalysisComplete(data.analysis, topic);

        } catch (err: any) {
            setError(err.message);
        }
        finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    // Loading Overlay
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                {/* Spinner colored blue for this tab */}
                <div className="w-12 h-12 border-4 border-gray-700 border-t-[#007BFF] rounded-full animate-spin"></div>
                <p className="text-gray-300 font-semibold">{statusMessage || "Processing..."}</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleAnalyze} className="space-y-6">
            {error && (<div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert"><strong className="font-bold">Error: </strong><span>{error}</span></div>)}

            <div>
                <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">1. Source Video (Max 2 Mins)</label>
                <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={`bg-black/30 border-2 border-dashed ${isDragging ? 'border-[#007BFF]' : 'border-brand-gray/40'} rounded-lg p-6 text-center cursor-pointer hover:border-[#007BFF] transition-colors group relative`}>
                    <input type="file" id="videoFile" onChange={handleFileChange} accept="video/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isLoading} />
                    <div className="relative z-0 pointer-events-none"><svg className="mx-auto h-12 w-12 text-[#8A8A8E] group-hover:text-[#007BFF] transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg><p className="mt-2 text-sm text-[#8A8A8E]">Drag & Drop or <span className="font-semibold text-[#007BFF]">paste a link</span></p></div>
                    <input
                        id="video-link"
                        type="text"
                        value={videoSource}
                        onChange={(e) => {
                            setVideoSource(e.target.value);
                            if (videoFile) setVideoFile(null);
                        }}
                        className="relative z-20 mt-4 w-full bg-brand-dark/50 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" placeholder="https://youtube.com/watch?v=..." disabled={isLoading} />
                </div>
            </div>
            <div>
                <label htmlFor="new-topic" className="text-sm font-medium text-[#8A8A8E] mb-2 block">2. New Topic (Short Form)</label>
                <input id="new-topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" placeholder="e.g., 'The Future of AI Assistants'" disabled={isLoading} />
            </div>

            <div className="pt-4">
                <button type="submit" disabled={isLoading || isFetchingCredits} className="w-full px-6 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] focus:outline-none focus:ring-4 focus:ring-brand-blue/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center">
                    Analyze & Continue (1 Credit)
                </button>
            </div>
        </form>
    );
}

interface VideoAnalysisDisplayProps {
    analysis: AnalysisResult;
    topic: string;
    onGenerationComplete: (content: string | string[], type: VideoOutputType) => void;
}

function VideoAnalysisDisplay({ analysis, topic, onGenerationComplete }: VideoAnalysisDisplayProps) {
    // (State and logic remains the same as previous implementation)
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingType, setLoadingType] = useState<VideoOutputType | null>(null);

    const handleGenerate = async (type: VideoOutputType) => {
        setIsLoading(true);
        setLoadingType(type);
        setError('');

        if (!BACKEND_API_URL) {
            setError("Configuration error.");
            setIsLoading(false);
            return;
        }

        try {
            // Call the generate-content endpoint
            const response = await fetch(`${BACKEND_API_URL}/api/generate-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    outputType: type,
                    analysis: analysis
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Generation failed');
            }

            const data = await response.json();
            if (!data.content) {
                throw new Error("Received empty content from generation API.");
            }

            // Transition to the next step
            onGenerationComplete(data.content, type);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setLoadingType(null);
        }
    };

    // Helper to render analysis sections cleanly
    const renderAnalysisSection = (title: string, content: React.ReactNode) => (
        <div className="bg-black/30 p-4 rounded-lg border border-[rgba(255,255,255,0.1)]">
            <h4 className="font-semibold text-[#007BFF] mb-2">{title}</h4>
            <div className="text-sm text-[#F5F5F7]/80 space-y-1">
                {content}
            </div>
        </div>
    );

    // Analysis Display UI
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-brand-light">Viral DNA Analysis Complete</h2>
            <p className="text-[#8A8A8E]">Applying these insights to: <strong className="text-white">"{topic}"</strong>.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderAnalysisSection("Meta Data", (
                    <>
                        <p><strong>Style:</strong> {analysis.meta.analyzed_style}</p>
                        <p><strong>Tone:</strong> {analysis.meta.primary_tone}</p>
                    </>
                ))}
                {renderAnalysisSection("Hook (First 3s)", (
                     <>
                        <p><strong>Technique:</strong> {analysis.hook_analysis.technique}</p>
                        <p><strong>Pacing:</strong> {analysis.hook_analysis.pacing}</p>
                    </>
                ))}
                {renderAnalysisSection("Retention Signals", (
                     <>
                        <p><strong>Pacing:</strong> {analysis.retention_signals.pacing_strategy}</p>
                        <p><strong>Structure:</strong> {analysis.retention_signals.narrative_structure}</p>
                    </>
                ))}
                 {renderAnalysisSection("Visual Style", analysis.retention_signals.visual_style)}
            </div>

            {error && (<div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert"><strong className="font-bold">Error: </strong><span>{error}</span></div>)}

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <button
                    onClick={() => handleGenerate('Script')}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] disabled:opacity-50 flex items-center justify-center"
                >
                    {isLoading && loadingType === 'Script' ? <Spinner /> : null}
                    Generate Script
                </button>
                <button
                    onClick={() => handleGenerate('AI Video Prompts')}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] disabled:opacity-50 flex items-center justify-center"
                >
                    {isLoading && loadingType === 'AI Video Prompts' ? <Spinner /> : null}
                    Generate VEO Prompts
                </button>
            </div>
        </div>
    );
}

interface VideoGenerationOutputProps {
    content: string | string[];
    type: VideoOutputType;
    onReset: () => void;
}

function VideoGenerationOutput({ content, type, onReset }: VideoGenerationOutputProps) {
    const [copyStatus, setCopyStatus] = useState('');

    const isPromptArray = Array.isArray(content);

    // Generation Output UI
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-brand-light">Generation Complete: {type}</h2>

            <div className="mt-6 bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-lg p-4">
                {isPromptArray ? (
                    // VEO Prompts Display
                    <div className="space-y-4">
                        {content.map((prompt, index) => (
                            <div key={index} className="bg-black/40 p-3 rounded-md border border-white/10 flex justify-between items-start gap-3">
                                 <textarea
                                    className="w-full bg-transparent text-sm text-brand-light/80 resize-y focus:outline-none"
                                    rows={3}
                                    value={prompt}
                                    readOnly
                                />
                                <button
                                    onClick={() => handleCopy(prompt, false, setCopyStatus, `prompt-${index}`)}
                                    className="text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 p-2 rounded-md"
                                    title="Copy prompt"
                                >
                                    {copyStatus === `prompt-${index}` ? 'Copied!' : <CopyIcon />}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Script Display
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => handleCopy(content, true, setCopyStatus, 'script')}
                                className="flex items-center gap-2 text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-md"
                            >
                                <CopyIcon /> {copyStatus === 'script' ? 'Copied!' : 'Copy Script'}
                            </button>
                        </div>
                        <MarkdownRenderer text={content} />
                    </div>
                )}
            </div>

            <div className="w-full rounded-lg bg-gradient-to-r from-[#007BFF] to-[#E600FF] p-[2px] transition-all duration-300 hover:shadow-[0_0_15px_0_rgba(128,0,255,0.4)]">
                <button
                    onClick={onReset}
                    className="w-full px-6 py-3 font-bold text-white bg-[#111115] rounded-md hover:bg-gray-800 transition-all duration-300"
                >
                    Start New Analysis (1 Credit)
                </button>
            </div>
        </div>
    );
}