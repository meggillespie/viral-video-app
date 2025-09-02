import React, { useState, useCallback, DragEvent } from 'react';
import { useUser } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// INLINED DEPENDENCIES (to resolve build errors)
// ============================================================================

// --- Configuration & Setup (from constants.ts & supabase.ts) ---
// TODO: Replace these placeholder values with your actual environment variables.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;
const MAX_DURATION_SECONDS = 120; // 2 minutes

// --- Supabase Client ---
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- TypeScript Interfaces (from types/video.ts) ---
export interface AnalysisResult {
    headline: string;
    hooks: string[];
    talking_points: string[];
    cta: string;
    tags: string[];
}

// --- Shared Components (from shared/LoadingOverlay.tsx) ---
export const LoadingOverlay = ({ message, spinnerColor }: { message: string, spinnerColor: string }) => (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
        <svg className="animate-spin h-8 w-8 mb-4" style={{ color: spinnerColor }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-white text-lg font-semibold">{message}</p>
    </div>
);

// ============================================================================
// MAIN COMPONENT: VideoInputForm
// ============================================================================

interface VideoInputFormProps {
    onAnalysisComplete: (result: AnalysisResult, newTopic: string) => void;
    creditBalance: number;
    isFetchingCredits: boolean;
    getToken: Function;
    updateCredits: (amount?: number) => void;
}

export const VideoInputForm: React.FC<VideoInputFormProps> = ({ 
    onAnalysisComplete, 
    creditBalance, 
    isFetchingCredits, 
    getToken, 
    updateCredits 
}) => {
    const { user } = useUser();
    const [videoSource, setVideoSource] = useState('');
    const [topic, setTopic] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const checkFileDuration = (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > MAX_DURATION_SECONDS) {
                    const durationMins = (video.duration / 60).toFixed(1);
                    reject(new Error(`Video is too long (${durationMins} mins). Max 2 mins.`));
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
            setError(''); 
            setVideoFile(null); 
            setVideoSource('');
            try { 
                await checkFileDuration(file); 
                setVideoFile(file); 
                setVideoSource(file.name); 
            }
            catch (err: any) { 
                setError(err.message); 
            }
        }
    };

    const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setError(''); 
            setVideoFile(null); 
            setVideoSource('');
            try { 
                await checkFileDuration(file); 
                setVideoFile(file); 
                setVideoSource(file.name); 
            }
            catch (err: any) { 
                setError(err.message); 
            }
        } else { 
            setError('Please drop a valid video file.'); 
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

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); 
        setStatusMessage('');

        if (!BACKEND_API_URL || BACKEND_API_URL.includes("your-backend-url")) { 
            setError("Configuration error: Backend URL is not set."); 
            return; 
        }
        if (creditBalance <= 0) { 
            setError("You have no credits left."); 
            return; 
        }
        if (!topic) { 
            setError("Please enter a topic."); 
            return; 
        }
        if (!videoSource && !videoFile) { 
            setError("Please provide a source video."); 
            return; 
        }
        if (!user) {
            setError("User not found. Please try logging in again.");
            return;
        }

        setIsLoading(true);

        try {
            let finalFileUri = '';
            let finalMimeType = '';

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

            // Call the Analyze Endpoint
            setStatusMessage('Analyzing Viral DNA...');
            const response = await fetch(`${BACKEND_API_URL}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoSource: finalFileUri,
                    mimeType: finalMimeType
                }),
            });

            if (!response.ok) { 
                const errData = await response.json(); 
                throw new Error(errData.error || `Analysis request failed`); 
            }
            const data = await response.json();

            if (!data.analysis) {
                throw new Error("Received unexpected format from the analysis API.");
            }

            // Credit Deduction using the new DB function (RPC)
            const authToken = await getToken({ template: 'supabase' });
            if (!authToken) throw new Error("Could not get token to decrement credits.");
            
            supabase.auth.setAuth(authToken);
            
            const { error: decrementError } = await supabase.rpc('decrement_user_credits', {
                user_id_to_update: user.id,
                amount_to_decrement: 1.0
            });

            if (decrementError) {
                console.error("Credit decrement failed, but analysis succeeded.", decrementError);
            } else {
                updateCredits(1);
            }

            onAnalysisComplete(data.analysis, topic);

        } catch (err: any) {
            setError(err.message);
        }
        finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    if (isLoading) {
        return <LoadingOverlay message={statusMessage || "Processing..."} spinnerColor="#007BFF" />;
    }

    return (
        <form onSubmit={handleAnalyze} className="space-y-6">
            {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong><span>{error}</span>
                </div>
            )}

            <div>
                <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">1. Source Video (Max 2 Mins)</label>
                <div 
                    onDrop={handleDrop} 
                    onDragOver={handleDragOver} 
                    onDragLeave={handleDragLeave} 
                    className={`bg-black/30 border-2 border-dashed ${isDragging ? 'border-[#007BFF]' : 'border-gray-600'} rounded-lg p-6 text-center cursor-pointer hover:border-[#007BFF] transition-colors group relative`}
                >
                    <input 
                        type="file" 
                        id="videoFile" 
                        onChange={handleFileChange} 
                        accept="video/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        disabled={isLoading} 
                    />
                    <div className="relative z-0 pointer-events-none">
                        <svg className="mx-auto h-12 w-12 text-[#8A8A8E] group-hover:text-[#007BFF] transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                        <p className="mt-2 text-sm text-[#8A8A8E]">Drag & Drop or <span className="font-semibold text-[#007BFF]">paste a link</span></p>
                    </div>
                    <input
                        id="video-link"
                        type="text"
                        value={videoSource}
                        onChange={(e) => {
                            setVideoSource(e.target.value);
                            if (videoFile) setVideoFile(null);
                        }}
                        className="relative z-20 mt-4 w-full bg-black/40 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2 text-white placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" 
                        placeholder="https://youtube.com/watch?v=..." 
                        disabled={isLoading} 
                    />
                </div>
            </div>

            <div>
                <label htmlFor="new-topic" className="text-sm font-medium text-[#8A8A8E] mb-2 block">2. New Topic (Short Form)</label>
                <input 
                    id="new-topic" 
                    type="text" 
                    value={topic} 
                    onChange={e => setTopic(e.target.value)} 
                    className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-white placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#007BFF] focus:outline-none" 
                    placeholder="e.g., 'The Future of AI Assistants'" 
                    disabled={isLoading} 
                />
            </div>

            <div className="pt-4">
                <button 
                    type="submit" 
                    disabled={isLoading || isFetchingCredits} 
                    className="w-full px-6 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center"
                >
                    Analyze & Continue (1 Credit)
                </button>
            </div>
        </form>
    );
};

