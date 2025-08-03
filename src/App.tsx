import React, { useState, useEffect, useCallback, DragEvent } from 'react';
// REMOVED: useMemo, GoogleGenAI (Security Fix)
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';

// --- Client Setups ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "example-anon-key");

// --- Helper Components & Types ---
// NEW: Type definition for structured output from API
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

// --- Main App Component (Remains the same) ---
export default function App() {
    // ... (App component structure remains the same as provided file)
}

// --- The Core Application Logic & UI ---
function VideoDNAGenerator() {
    const { getToken } = useAuth();
    const { user } = useUser();

    // REMOVED: genAIFileClient initialization (Security Fix)

    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);
    const [videoSource, setVideoSource] = useState('');
    const [topic, setTopic] = useState('');
    const [outputDetail, setOutputDetail] = useState('Short Form');
    const [outputType, setOutputType] = useState('AI Video Prompts');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    // Updated state for structured results
    const [generatedResult, setGeneratedResult] = useState<GenerationResult | null>(null);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [copyStatus, setCopyStatus] = useState(''); // Manages copy feedback

    // (useEffect for loadUserData remains the same)
    // (checkFileDuration, handleFileChange, handleDrop, handleDragOver, handleDragLeave remain the same)

    // --- FIX: Modern Rich Text Copy Function ---
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

    // --- UPDATED: Secure Generation Flow ---
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setGeneratedResult(null); setStatusMessage('');
        if ((creditBalance ?? 0) <= 0) { setError("You have no credits left."); return; }
        if (!topic) { setError("Please enter a topic."); return; }
        if (!videoSource && !videoFile) { setError("Please provide a source video."); return; }
        
        setIsLoading(true);

        try {
            let finalFileUri = '';
            let finalMimeType = '';

            if (videoFile) {
                // --- SECURITY FIX: Use the secure backend upload endpoint ---
                setStatusMessage('Uploading video securely (Max 4.5MB on Vercel)...');
                const formData = new FormData();
                formData.append('video', videoFile);

                // Call the new secure upload handler (See Section 3.2)
                const uploadResponse = await fetch('/api/upload-video', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    const errData = await uploadResponse.json();
                    throw new Error(errData.error || 'Video upload failed. The file might be too large for the server.');
                }

                const uploadData = await uploadResponse.json();
                finalFileUri = uploadData.fileUri;
                finalMimeType = uploadData.mimeType;
                setStatusMessage('Video uploaded and processed by Gemini.');

            } else {
                // YouTube Link Handling (Phase 2.4)
                setStatusMessage('Checking video duration...');
                const durationResponse = await fetch('/api/get-video-duration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: videoSource }),
                });
                // ... (Duration check logic remains the same)
                
                finalFileUri = videoSource;
                finalMimeType = 'video/youtube';
            }

            setStatusMessage('Analyzing DNA & Generating content...');
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic, 
                    outputDetail, 
                    outputType, 
                    videoSource: finalFileUri, 
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

            // Decrement Credits (Phase 2.3)
            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { headers: { Authorization: `Bearer ${token}` } });
            
            if (decrementError) {
                console.error("Credit decrement failed, but generation succeeded.", decrementError);
                // Do not block the user from seeing results if generation succeeded
            } else {
                setCreditBalance(prev => (prev ? prev - 1 : 0));
            }

        } catch (err: any) { setError(err.message); }
        finally { setIsLoading(false); setStatusMessage(''); }
    };

    // --- NEW: Result Display Component (Phase 3.2) ---
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

                {/* Optional: Display Analysis Data */}
                <details className="mt-4">
                    <summary className="cursor-pointer text-blue-400 text-sm">View Viral DNA Analysis (JSON)</summary>
                    <pre className="mt-2 p-3 bg-black/50 rounded text-xs text-gray-300 overflow-x-auto font-mono">
                        {JSON.stringify(result.analysis, null, 2)}
                    </pre>
                </details>
            </div>
        );
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8">
                 {/* ... Header and Form Inputs remain visually the same as the provided file ... */}
                
                {/* ... Error/Status messages ... */}

                {/* NEW: Result Display Integration */}
                {generatedResult && !isLoading && (
                    <ResultDisplay result={generatedResult} />
                )}
            </div>
        </div>
    );
}