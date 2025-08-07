// File: frontend/src/App.tsx

import React, { useState, useEffect, useCallback, DragEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';

// --- Client Setups & Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "example-anon-key");

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;
const MAX_DURATION_SECONDS = 120; // 2 minutes limit

// --- Helper Components & Types (Updated) ---

// Define the structure of the analysis JSON based on the backend prompt
interface AnalysisResult {
    meta: { analyzed_style: string; primary_tone: string; };
    hook_analysis: { technique: string; pacing: string; emotional_trigger: string; };
    retention_signals: { pacing_strategy: string; narrative_structure: string; visual_style: string; };
    engagement_tactics: { ctas: string[]; interactive_elements: string; };
    [key: string]: any; // Allow indexing
}

type OutputType = 'Script' | 'AI Video Prompts';

// (Spinner, Logo, CopyIcon remain the same)
const Spinner = () => ( <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> );
const Logo = () => ( <svg className="w-8 h-8 text-[#007BFF]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg> );
const CopyIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg> );

const MarkdownRenderer = ({ text }: { text: string }) => {
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(\r\n|\n|\r)/g, '<br>');
    return <div className="whitespace-pre-wrap font-mono text-sm text-brand-light/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- Main App Component (Wrapper) ---
export default function App() {
    // (App structure remains the same, using Vyralize branding colors)
    return (
        <>
            {/* Removed segmented control CSS as it's no longer used */}
            <div className="bg-[#111115] min-h-screen font-sans text-[#F5F5F7] relative">
                <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden z-0">
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_20%_20%,_rgba(0,123,255,0.15),_transparent_30%)] animate-[spin_20s_linear_infinite]"></div>
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_80%_70%,_rgba(230,0,255,0.1),_transparent_30%)] animate-[spin_20s_linear_infinite_reverse]"></div>
                </div>
                <header className="absolute top-0 right-0 p-6 z-20"><SignedIn><UserButton afterSignOutUrl="/" /></SignedIn></header>
                <main className="relative z-10 flex items-center justify-center min-h-screen p-4">
                    <SignedIn><VyralizeWorkflowManager /></SignedIn>
                    <SignedOut>
                        <div className="text-center p-16 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
                            <h2 className="text-3xl font-bold mb-4">Welcome to Vyralize</h2>
                            <p className="text-[#8A8A8E] my-4">Please sign in to continue.</p>
                            <SignInButton mode="modal"><button className="px-6 py-2 bg-[#007BFF] text-white font-semibold rounded-lg hover:bg-[#0056b3] transition-colors">Sign In</button></SignInButton>
                        </div>
                    </SignedOut>
                </main>
            </div>
        </>
    );
}

// --- Core Workflow Manager ---
// This component manages the overall state and transitions between the steps.
function VyralizeWorkflowManager() {
    const { getToken } = useAuth();
    const { user } = useUser();

    // Workflow State
    const [step, setStep] = useState<'input' | 'analysis' | 'generation'>('input');
    
    // Data State (Persists across steps)
    const [topic, setTopic] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [generatedContent, setGeneratedContent] = useState<string | string[] | null>(null);
    const [generatedType, setGeneratedType] = useState<OutputType | null>(null);

    // User/Credit State
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);

    // Load Credits (Remains the same)
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

    // --- Callbacks for State Transitions ---

    // Called when analysis is successful
    const handleAnalysisComplete = useCallback((result: AnalysisResult, newTopic: string) => {
        setAnalysisResult(result);
        setTopic(newTopic);
        // Credit deduction is handled within the InputForm upon successful analysis API call,
        // but we must update the balance here in the parent component.
        setCreditBalance(prev => (prev ? prev - 1 : 0)); 
        setStep('analysis');
    }, []);

    // Called when generation is successful
    const handleGenerationComplete = useCallback((content: string | string[], type: OutputType) => {
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
                    <InputForm 
                        onAnalysisComplete={handleAnalysisComplete} 
                        creditBalance={creditBalance ?? 0}
                        isFetchingCredits={isFetchingCredits}
                        // Pass getToken to InputForm for credit deduction authorization
                        getToken={getToken}
                    />
                );
            case 'analysis':
                return (
                    <AnalysisDisplay 
                        analysis={analysisResult!} 
                        topic={topic}
                        onGenerationComplete={handleGenerationComplete}
                    />
                );
            case 'generation':
                return (
                    <GenerationOutput
                        content={generatedContent!}
                        type={generatedType!}
                        onReset={handleReset}
                    />
                );
        }
    };

    // Main container UI (Keeps the Vyralize styling)
    // Increased max-w-2xl to better accommodate the analysis display inspired by the example app
    return (
        <div className="w-full max-w-2xl mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3"><Logo /><h1 className="text-2xl font-bold text-brand-light">Vyralize</h1></div>
                    <div className="text-sm text-[#8A8A8E] bg-black/20 border border-[rgba(255,255,255,0.1)] px-3 py-1 rounded-full">{isFetchingCredits ? '...' : creditBalance ?? 0} Credits</div>
                </div>
                
                {renderStep()}

            </div>
        </div>
    );
}

// ============================================================================
// STEP 1: Input Form Component
// ============================================================================
interface InputFormProps {
    onAnalysisComplete: (result: AnalysisResult, newTopic: string) => void;
    creditBalance: number;
    isFetchingCredits: boolean;
    getToken: Function;
}

function InputForm({ onAnalysisComplete, creditBalance, isFetchingCredits, getToken }: InputFormProps) {
    // Input State (Managed locally)
    const [videoSource, setVideoSource] = useState('');
    const [topic, setTopic] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    
    // Loading/Error State (Managed locally)
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // File Handling Logic (Remains the same)
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

        // (Validation checks remain the same)
        if (!BACKEND_API_URL) { setError("Configuration error."); return; }
        if (creditBalance <= 0) { setError("You have no credits left."); return; }
        if (!topic) { setError("Please enter a topic."); return; }
        if (!videoSource && !videoFile) { setError("Please provide a source video."); return; }
        
        setIsLoading(true);

        try {
            let finalFileUri = '';
            let finalMimeType = '';

            // --- Video Upload/Validation (Same logic as before, calling GCR backend) ---
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

            // --- NEW: Call the Analyze Endpoint ---
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

            // --- Credit Deduction (Crucial: Happens only on successful analysis) ---
            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { headers: { Authorization: `Bearer ${token}` } });
            
            if (decrementError) {
                console.error("Credit decrement failed, but analysis succeeded.", decrementError);
                // We proceed anyway as the core task (analysis) was successful
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

    // Input Form UI (Keeps the Vyralize styling, removes segmented controls)
    // If loading, show a loader overlay
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
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
                    <input type="file" id="videoFile" onChange={handleFileChange} accept="video/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0" disabled={isLoading} />
                    <div className="relative z-10 pointer-events-none"><svg className="mx-auto h-12 w-12 text-[#8A8A8E] group-hover:text-[#007BFF] transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg><p className="mt-2 text-sm text-[#8A8A8E]">Drag & Drop or <span className="font-semibold text-[#007BFF]">paste a link</span></p></div>
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
                <button type="submit" disabled={isLoading || isFetchingCredits} className="w-full px-6 py-3 font-bold text-white bg-[#007BFF] rounded-lg hover:bg-[#0056b3] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(0,123,255,0.3)] focus:outline-none focus:ring-4 focus:ring-brand-blue/50 disabled:bg-[#0056b3]/50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center">
                    Analyze Video (1 Credit)
                </button>
            </div>
        </form>
    );
}

// ============================================================================
// STEP 2: Analysis Display Component
// ============================================================================
interface AnalysisDisplayProps {
    analysis: AnalysisResult;
    topic: string;
    onGenerationComplete: (content: string | string[], type: OutputType) => void;
}

function AnalysisDisplay({ analysis, topic, onGenerationComplete }: AnalysisDisplayProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingType, setLoadingType] = useState<OutputType | null>(null);

    const handleGenerate = async (type: OutputType) => {
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
                    analysis: analysis // Pass the analysis JSON
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

    // Helper to render analysis sections cleanly (Adapted to Vyralize style)
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
                    className="flex-1 px-6 py-3 font-bold text-white bg-[#007BFF] rounded-lg hover:bg-[#0056b3] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(0,123,255,0.3)] disabled:bg-[#0056b3]/50 flex items-center justify-center"
                >
                    {isLoading && loadingType === 'Script' ? <Spinner /> : null}
                    Generate Script
                </button>
                <button 
                    onClick={() => handleGenerate('AI Video Prompts')} 
                    disabled={isLoading}
                    // Using the pink/purple hue from the background gradient for the secondary action
                    className="flex-1 px-6 py-3 font-bold text-white bg-[#E600FF] rounded-lg hover:bg-[#b300c7] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(230,0,255,0.3)] disabled:bg-[#b300c7]/50 flex items-center justify-center"
                >
                    {isLoading && loadingType === 'AI Video Prompts' ? <Spinner /> : null}
                    Generate VEO Prompts
                </button>
            </div>
        </div>
    );
}

// ============================================================================
// STEP 3: Generation Output Component
// ============================================================================
interface GenerationOutputProps {
    content: string | string[];
    type: OutputType;
    onReset: () => void;
}

function GenerationOutput({ content, type, onReset }: GenerationOutputProps) {
    const [copyStatus, setCopyStatus] = useState('');

    // Copy Functionality (Remains the same)
    const handleCopy = async (textToCopy: string, isFormatted: boolean = false, feedbackId: string = 'global') => {
        try {
            if (isFormatted) {
                const html = textToCopy.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(\r\n|\n|\r)/g, '<br>');
                const blobHtml = new Blob([html], { type: 'text/html' });
                const blobPlain = new Blob([textToCopy.replace(/\*\*|\*/g, '')], { type: 'text/plain' });
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
                                    readOnly // Keeping read-only for simplicity, can be made editable if needed
                                />
                                <button
                                    onClick={() => handleCopy(prompt, false, `prompt-${index}`)}
                                    className="text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 p-2 rounded-md"
                                    title="Copy prompt"
                                >
                                    {copyStatus === `prompt-${index}` ? 'Copied!' : <CopyIcon />}
                                </button>
                            </div>
                        ))}
                        {/* Phase 5 Feature Placeholder */}
                        <button className="w-full mt-4 px-4 py-2 bg-gray-500/50 text-gray-300 rounded-lg font-semibold cursor-not-allowed" disabled>
                            Send to Google VEO (Coming Soon)
                        </button>
                    </div>
                ) : (
                    // Script Display
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => handleCopy(content, true, 'script')}
                                className="flex items-center gap-2 text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-md"
                            >
                                <CopyIcon /> {copyStatus === 'script' ? 'Copied!' : 'Copy Script'}
                            </button>
                        </div>
                        <MarkdownRenderer text={content} />
                    </div>
                )}
            </div>

            <button
                onClick={onReset}
                className="w-full px-6 py-3 font-bold text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-all duration-300"
            >
                Start New Analysis (1 Credit)
            </button>
        </div>
    );
}