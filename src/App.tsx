import React, { useState, useEffect, useCallback, DragEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai'; // We need this on the frontend ONLY for file uploads

// --- Client Setups ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseAnonKey || "example-anon-key");

// Initialize Google AI client for file uploads. This key is safe to be public.
const genAIFileClient = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// --- Helper Components ---
const Spinner = () => ( <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> );
const Logo = () => ( <svg className="w-8 h-8 text-[#007BFF]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg> );
const CopyIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg> );
const MarkdownRenderer = ({ text }: { text: string }) => { const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(\r\n|\n|\r)/g, '<br>'); return <div dangerouslySetInnerHTML={{ __html: html }} />; };

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
    const { user, getToken } = useAuth();
    const [creditBalance, setCreditBalance] = useState<number | null>(null);
    const [isFetchingCredits, setIsFetchingCredits] = useState(true);
    const [videoSource, setVideoSource] = useState('');
    const [topic, setTopic] = useState('');
    const [outputDetail, setOutputDetail] = useState('Short Form');
    const [outputType, setOutputType] = useState('AI Video Prompts');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [generatedResult, setGeneratedResult] = useState('');
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [copyButtonText, setCopyButtonText] = useState('Copy');

    useEffect(() => { /* Fetches credits, unchanged */ }, [user, getToken]);

    const checkFileDuration = (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > 600) {
                    reject(new Error(`Video is too long (${Math.floor(video.duration / 60)} mins). Please use a video under 10 minutes.`));
                } else {
                    resolve();
                }
            };
            video.onerror = () => reject(new Error('Could not read video file metadata.'));
            video.src = window.URL.createObjectURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                await checkFileDuration(file);
                setVideoFile(file);
                setVideoSource(file.name);
                setError('');
            } catch (err: any) {
                setError(err.message);
                setVideoFile(null);
                setVideoSource('');
            }
        }
    };

    const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('video/')) {
            try {
                await checkFileDuration(file);
                setVideoFile(file);
                setVideoSource(file.name);
                setError('');
            } catch (err: any) {
                setError(err.message);
                setVideoFile(null);
                setVideoSource('');
            }
        } else { setError('Please drop a valid video file.'); }
    }, []);
    
    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleCopy = async () => { /* Copy logic, unchanged */ };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setGeneratedResult(''); setStatusMessage('');
        if ((creditBalance ?? 0) <= 0) { setError("You have no credits left."); return; }
        if (!topic) { setError("Please enter a topic."); return; }
        if (!videoSource && !videoFile) { setError("Please provide a source video."); return; }
        
        setIsLoading(true);

        try {
            let fileUri = '';
            let mimeType = '';

            if (videoFile) {
                // Handle file upload
                setStatusMessage('Uploading video...');
                const uploadedFile = await genAIFileClient.files.upload({ file: videoFile });
                let file = await genAIFileClient.files.get({ name: uploadedFile.name });
                while (file.state === 'PROCESSING') {
                    setStatusMessage('Processing video...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    file = await genAIFileClient.files.get({ name: uploadedFile.name });
                }
                if (file.state === 'FAILED') throw new Error('Video processing failed.');
                fileUri = file.uri;
                mimeType = file.mimeType || 'video/mp4';
            } else {
                // Handle YouTube URL
                setStatusMessage('Checking video duration...');
                const durationResponse = await fetch('/api/get-video-duration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoUrl: videoSource }),
                });
                if (!durationResponse.ok) throw new Error('Could not validate video URL.');
                const { duration } = await durationResponse.json();
                if (duration > 600) throw new Error(`Video is too long (${Math.floor(duration / 60)} mins). Please use a video under 10 minutes.`);
                mimeType = 'video/youtube';
            }

            setStatusMessage('Generating content...');
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, outputDetail, outputType, videoSource: videoFile ? fileUri : videoSource, mimeType }),
            });
            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || `Request failed`); }
            const data = await response.json();
            setGeneratedResult(data.result);

            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { headers: { Authorization: `Bearer ${token}` } });
            if (decrementError) throw new Error("Failed to decrement credits.");
            setCreditBalance(prev => (prev ? prev - 1 : 0));

        } catch (err: any) { setError(err.message); }
        finally { setIsLoading(false); setStatusMessage(''); }
    };

    return (
        <div className="w-full max-w-lg mx-auto bg-[rgba(38,38,42,0.6)] rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8">
                {/* Header and Form structure remains the same */}
                {/* ... */}
                 {statusMessage && isLoading && (
                    <div className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-4 py-3 rounded-lg text-sm" role="status">
                        <p>{statusMessage}</p>
                    </div>
                )}
                {/* ... */}
            </div>
        </div>
    );
}
