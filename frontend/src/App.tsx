import React, { useState, useEffect, useCallback, DragEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';

// --- Client Setups & Configuration ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Initialize Supabase client for frontend use (e.g., calling Edge Functions)
const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "example-anon-key");

// NEW: Define the backend URL from environment variables (Points to Google Cloud Run)
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

if (!BACKEND_API_URL) {
    console.error("CRITICAL: VITE_BACKEND_API_URL is not set. API calls will fail. Ensure this is set in your Vercel environment.");
}

const MAX_DURATION_SECONDS = 120; // 2 minutes limit for stability

// --- Helper Components & Types ---
interface GenerationResult {
    analysis: object;
    content: string | string[]; // Script (string) or VEO Prompts (string[])
}

const Spinner = () => ( <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> );
const Logo = () => ( <svg className="w-8 h-8 text-[#007BFF]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg> );
const CopyIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg> );
const MarkdownRenderer = ({ text }: { text: string }) => {
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(\r\n|\n|\r)/g, '<br>');
    return <div className="whitespace-pre-wrap font-mono text-sm text-brand-light/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
};

// --- Main App Component ---
export default function App() {
    return (
        <>
            <style>{`.segmented-control input{display:none}.segmented-control label{transition:all .2s ease-in-out}.segmented-control input:checked+label{background-color:#007BFF;color:#fff;font-weight:600;box-shadow:0 2px 4px rgba(0,0,0,.2)}`}</style>
            <div className="bg-[#111115] min-h-screen font-sans text-[#F5F5F7] relative">
                <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden z-0">
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_20%_20%,_rgba(0,123,255,0.15),_transparent_30%)] animate-[spin_20s_linear_infinite]"></div>
                     <div className="absolute w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_80%_70%,_rgba(230,0,255,0.1),_transparent_30%)] animate-[spin_20s_linear_infinite_reverse]"></div>
                </div>
                <header className="absolute top-0 right-0 p-6 z-20"><SignedIn><UserButton afterSignOutUrl="/" /></SignedIn></header>
                <main className="relative z-10 flex items-center justify-center min-h-screen p-4">
                    <SignedIn><VideoDNAGenerator /></SignedIn>
                    <SignedOut>
                        <div className="text-center p-16 bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl">
                            <h2 className="text-3xl font-bold mb-4">Welcome to VideoDNA</h2>
                            <p className="text-[#8A8A8E] my-4">Please sign in to continue.</p>
                            <SignInButton mode="modal"><button className="px-6 py-2 bg-[#007BFF] text-white font-semibold rounded-lg hover:bg-[#0056b3] transition-colors">Sign In</button></SignInButton>
                        </div>
                    </SignedOut>
                </main>
            </div>
        </>
    );
}

// --- The Core Application Logic & UI ---
function VideoDNAGenerator() {
    const { getToken } = useAuth();
    const { user } = useUser();

    // State Definitions
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);
    const [videoSource, setVideoSource] = useState('');
    const [topic, setTopic] = useState('');
    const [outputDetail, setOutputDetail] = useState('Short Form');
    const [outputType, setOutputType] = useState('AI Video Prompts');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [generatedResult, setGeneratedResult] = useState<GenerationResult | null>(null);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [copyStatus, setCopyStatus] = useState('');

    // Load User Data (Credits)
    useEffect(() => {
        const loadUserData = async () => {
            if (user && getToken) {
                setIsFetchingCredits(true);
                try {
                    const token = await getToken({ template: 'supabase' });
                    if (!token) throw new Error("Clerk token not found.");
                    // Call the Supabase Edge Function
                    const { data, error: funcError } = await supabase.functions.invoke('get-credits', { headers: { Authorization: `Bearer ${token}` } });
                    if (funcError) throw funcError;
                    setCreditBalance(data.credit_balance);
                } catch (err) { console.error("Error loading user data:", err); setCreditBalance(0); }
                finally { setIsFetchingCredits(false); }
            }
        };
        loadUserData();
    }, [user, getToken]);

    // Video Duration Check (2-minute limit)
    const checkFileDuration = (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => { 
                window.URL.revokeObjectURL(video.src); 
                if (video.duration > MAX_DURATION_SECONDS) { 
                    const durationMins = (video.duration / 60).toFixed(1);
                    reject(new Error(`Video is too long (${durationMins} mins). Max 2 mins for stability.`)); 
                } else { 
                    resolve(); 
                } 
            };
            video.onerror = () => reject(new Error('Could not read video file metadata.'));
            video.src = window.URL.createObjectURL(file);
        });
    };

    // File Handling
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
    
    // Modern Rich Text Copy Function
    const handleCopy = async (textToCopy: string, isFormatted: boolean = false, feedbackId: string = 'global') => {
        try {
            if (isFormatted) {
                // 1. Convert Markdown to HTML
                const html = textToCopy.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                       .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                       .replace(/(\r\n|\n|\r)/g, '<br>');
                
                // 2. Create Blobs
                const blobHtml = new Blob([html], { type: 'text/html' });
                const blobPlain = new Blob([textToCopy.replace(/\*\*|\*/g, '')], { type: 'text/plain' });

                // 3. Use Clipboard API
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': blobHtml,
                        'text/plain': blobPlain,
                    })
                ]);
            } else {
                // Copy plain text (for VEO prompts)
                await navigator.clipboard.writeText(textToCopy);
            }

            setCopyStatus(feedbackId);
            setTimeout(() => setCopyStatus(''), 2000);

        } catch (err) {
            console.error('Failed to copy: ', err);
            setError('Failed to copy to clipboard.');
        }
    };

    // --- Generation Flow (Updated for GCR Backend) ---
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setGeneratedResult(null); setStatusMessage('');

        if (!BACKEND_API_URL) {
            setError("Application configuration error: Backend URL is missing.");
            return;
        }

        if ((creditBalance ?? 0) <= 0) { setError("You have no credits left."); return; }
        if (!topic) { setError("Please enter a topic."); return; }
        if (!videoSource && !videoFile) { setError("Please provide a source video."); return; }
        
        setIsLoading(true);

        try {
            let finalFileUri = '';
            let finalMimeType = '';

            if (videoFile) {
                // --- Flow A: Signed URL Upload (via GCR) ---

                // Step 1: Get Authorization (Call Cloud Run)
                setStatusMessage('Authorizing secure upload...');
                const authResponse = await fetch(`${BACKEND_API_URL}/api/create-signed-url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: videoFile.name, contentType: videoFile.type }),
                });

                if (!authResponse.ok) throw new Error('Failed to get secure upload authorization.');
                const { signedUrl, path, token } = await authResponse.json();

                // Step 2: Upload directly to Supabase
                setStatusMessage('Uploading video to storage...');
                const uploadResponse = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': videoFile.type,
                        'Authorization': `Bearer ${token}`,
                        'x-upsert': 'true',
                    },
                    body: videoFile,
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload video to Supabase Storage.');
                }

                // Step 3: Backend Transfer (Call Cloud Run - The long process)
                setStatusMessage('Processing video for AI analysis...');
                const transferResponse = await fetch(`${BACKEND_API_URL}/api/transfer-to-gemini`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: path, mimeType: videoFile.type }),
                });

                if (!transferResponse.ok) {
                    const errText = await transferResponse.text().catch(() => 'Unknown transfer error');
                    throw new Error(`Video transfer failed. Details: ${errText}`);
                }

                const transferData = await transferResponse.json();
                finalFileUri = transferData.fileUri;
                finalMimeType = transferData.mimeType;


            } else {
                // --- Flow B: YouTube Link (via GCR) ---
                setStatusMessage('Checking video duration...');
                const durationResponse = await fetch(`${BACKEND_API_URL}/api/get-video-duration`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: videoSource }),
                });

                if (!durationResponse.ok) throw new Error('Could not validate video URL.');
                const { duration } = await durationResponse.json();
                
                // Enforce the 2-minute limit
                if (duration > MAX_DURATION_SECONDS) {
                    const durationMins = (duration / 60).toFixed(1);
                    throw new Error(`Video is too long (${durationMins} mins). Max 2 mins for stability.`);
                }
                
                finalFileUri = videoSource;
                finalMimeType = 'video/youtube';
            }

            // --- Flow C: Generation (via GCR) ---
            setStatusMessage('Analyzing DNA & Generating content...');
            const response = await fetch(`${BACKEND_API_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic, 
                    outputDetail, 
                    outputType, 
                    videoSource: finalFileUri, // Gemini URI or YouTube URL
                    mimeType: finalMimeType 
                }),
            });

            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || `Request failed`); }
            const data = await response.json();
            
             // Handle the structured result
             if (data.result) {
                setGeneratedResult(data.result);
            } else {
                throw new Error("Received unexpected format from the generation API.");
            }

            // Decrement Credits (via Supabase Edge Function)
            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { headers: { Authorization: `Bearer ${token}` } });
            
            if (decrementError) {
                console.error("Credit decrement failed, but generation succeeded.", decrementError);
                // Do not block the user from seeing results if generation succeeded
            } else {
                setCreditBalance(prev => (prev ? prev - 1 : 0));
            }
            
        } catch (err: any) { 
            setError(err.message); 
        }
        finally { 
            setIsLoading(false); 
            setStatusMessage(''); 
        }
    };

    // --- Result Display Component (Handles Script and VEO Prompts) ---
    const ResultDisplay = ({ result }: { result: GenerationResult }) => {
        const isPromptArray = Array.isArray(result.content);

        return (
            <div className="mt-6 bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-4">Generated Result:</h3>

                {isPromptArray ? (
                    // VEO Prompts Display (Editable List)
                    <div className="space-y-4">
                        {result.content.map((prompt, index) => (
                            <div key={index} className="bg-black/40 p-3 rounded-md border border-white/10 flex justify-between items-start gap-3">
                                <textarea
                                    className="w-full bg-transparent text-sm text-brand-light/80 resize-y focus:outline-none"
                                    rows={4}
                                    value={prompt}
                                    onChange={(e) => {
                                        // Handle editing of prompts
                                        const newContent = [...result.content];
                                        newContent[index] = e.target.value;
                                        setGeneratedResult({ ...result, content: newContent });
                                    }}
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
                        <button className="w-full mt-4 px-4 py-2 bg-gray-500/50 text-gray-300 rounded-lg font-semibold cursor-not-allowed" disabled>
                            Send to Google VEO (Phase 5 Feature)
                        </button>
                    </div>
                ) : (
                    // Script Display
                    <div>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => handleCopy(result.content as string, true, 'script')}
                                className="flex items-center gap-2 text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-md"
                            >
                                <CopyIcon /> {copyStatus === 'script' ? 'Copied!' : 'Copy Script'}
                            </button>
                        </div>
                        <MarkdownRenderer text={result.content as string} />
                    </div>
                )}

                {/* Analysis Data Display */}
                <details className="mt-4">
                    <summary className="cursor-pointer text-blue-400 text-sm">View Viral DNA Analysis (JSON)</summary>
                    <pre className="mt-2 p-3 bg-black/50 rounded text-xs text-gray-300 overflow-x-auto font-mono">
                        {JSON.stringify(result.analysis, null, 2)}
                    </pre>
                </details>
            </div>
        );
    };

    // --- Main UI Render ---
    return (
        <div className="w-full max-w-lg mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3"><Logo /><h1 className="text-2xl font-bold text-brand-light">VideoDNA</h1></div>
                    <div className="text-sm text-[#8A8A8E] bg-black/20 border border-[rgba(255,255,255,0.1)] px-3 py-1 rounded-full">{isFetchingCredits ? '...' : creditBalance ?? 0} Credits</div>
                </div>
                <form onSubmit={handleGenerate} className="space-y-6">
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
                                    if (videoFile) setVideoFile(null); // Clear file if user types URL
                                }} 
                                className="relative z-20 mt-4 w-full bg-brand-dark/50 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" placeholder="https://youtube.com/watch?v=..." disabled={isLoading} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="new-topic" className="text-sm font-medium text-[#8A8A8E] mb-2 block">2. New Topic</label>
                        <input id="new-topic" type="text" value={topic} onChange={e => setTopic(e.target.value)} className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" placeholder="e.g., 'The Future of AI Assistants'" disabled={isLoading} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">3. Output Detail</label>
                            <div className="flex bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md p-1 segmented-control">
                                <input type="radio" name="output-detail" id="detail-short" checked={outputDetail === 'Short Form'} onChange={() => setOutputDetail('Short Form')} disabled={isLoading} /><label htmlFor="detail-short" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer">Short Form</label>
                                <input type="radio" name="output-detail" id="detail-long" checked={outputDetail === 'Long Form'} onChange={() => setOutputDetail('Long Form')} disabled={isLoading} /><label htmlFor="detail-long" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer">Long Form</label>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">4. Desired Output</label>
                            <div className="flex bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md p-1 segmented-control">
                                <input type="radio" name="output-type" id="type-script" checked={outputType === 'Script & Analysis'} onChange={() => setOutputType('Script & Analysis')} disabled={isLoading} /><label htmlFor="type-script" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer text-xs sm:text-sm">Script & Analysis</label>
                                <input type="radio" name="output-type" id="type-prompts" checked={outputType === 'AI Video Prompts'} onChange={() => setOutputType('AI Video Prompts')} disabled={isLoading} /><label htmlFor="type-prompts" className="flex-1 text-center text-[#8A8A8E] py-2 px-4 rounded-md cursor-pointer text-xs sm:text-sm">AI Video Prompts</label>
                            </div>
                        </div>
                    </div>
                    
                    {/* Button shows status message while loading */}
                    <div className="pt-4"><button type="submit" disabled={isLoading || isFetchingCredits} className="w-full px-6 py-3 font-bold text-white bg-[#007BFF] rounded-lg hover:bg-[#0056b3] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(0,123,255,0.3)] focus:outline-none focus:ring-4 focus:ring-brand-blue/50 disabled:bg-[#0056b3]/50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center">{isLoading ? <Spinner /> : null}{isLoading ? statusMessage || 'Generating...' : 'Generate'}</button></div>
                    
                    {error && (<div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert"><strong className="font-bold">Error: </strong><span>{error}</span></div>)}
                    
                    {/* Result Display Integration */}
                    {generatedResult && !isLoading && (
                        <ResultDisplay result={generatedResult} />
                    )}
                </form>
            </div>
        </div>
    );
}