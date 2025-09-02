import React, { useState } from 'react';
import { useUser } from "@clerk/clerk-react";
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnalysisResult, VideoOutputType } from '../../types/video';

// ============================================================================
// INLINED DEPENDENCIES (to resolve build errors)
// ============================================================================

// --- Configuration & Setup (from constants.ts & supabase.ts) ---
// TODO: Replace these placeholder values with your actual environment variables.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;

// --- Supabase Client ---
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Shared Components & Utilities (from shared/* & utils/*) ---
export const CopyIcon = () => (
    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);
export const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
export const MarkdownRenderer = ({ text }: { text: string }) => (
    <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
);
export const handleCopy = (text: string, isMarkdown: boolean, setStatus: React.Dispatch<React.SetStateAction<string>>, id: string) => {
    const plainText = isMarkdown ? text.replace(/(\*\*|__|\*|_|#+\s?)/g, '') : text;
    navigator.clipboard.writeText(plainText).then(() => {
        setStatus(id);
        setTimeout(() => setStatus(''), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
};

// ============================================================================
// MAIN COMPONENT: VideoGenerationOutput
// ============================================================================

interface VideoGenerationOutputProps {
    content: string | string[];
    type: VideoOutputType;
    onReset: () => void;
    analysis: AnalysisResult;
    topic: string;
    getToken: Function;
    updateCredits: (amount?: number) => void;
    onUpdateGeneration: (content: string | string[], type: VideoOutputType) => void;
    creditBalance: number;
}

export const VideoGenerationOutput: React.FC<VideoGenerationOutputProps> = ({ 
    content, 
    type, 
    onReset, 
    analysis, 
    topic, 
    getToken, 
    updateCredits, 
    onUpdateGeneration, 
    creditBalance 
}) => {
    const { user } = useUser();
    const [copyStatus, setCopyStatus] = useState('');
    const [isCrossGenerating, setIsCrossGenerating] = useState(false);
    const [crossGenError, setCrossGenError] = useState('');

    const isPromptArray = Array.isArray(content);
    const alternateType: VideoOutputType = type === 'Script' ? 'AI Video Prompts' : 'Script';

    const handleCopyAllPrompts = () => {
        if (isPromptArray) {
            const allPrompts = content.join('\n\n');
            handleCopy(allPrompts, false, setCopyStatus, 'copy-all');
        }
    };

    const handleCrossGenerate = async () => {
        setCrossGenError('');
        
        const requiredCredits = 0.5; 

        if (creditBalance < requiredCredits) {
            setCrossGenError("You do not have enough credits for this generation.");
            return;
        }
        if (!user) {
            setCrossGenError("User not found. Please try logging in again.");
            return;
        }
        if (!BACKEND_API_URL || BACKEND_API_URL.includes("your-backend-url")) {
            setCrossGenError("Configuration error: Backend URL is not set.");
            return;
        }

        setIsCrossGenerating(true);

        try {
            const response = await fetch(`${BACKEND_API_URL}/api/generate-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    outputType: alternateType,
                    analysis: analysis
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Cross-generation failed');
            }

            const data = await response.json();
            if (!data.content) {
                throw new Error("Received empty content from generation API.");
            }
            
            const authToken = await getToken({ template: 'supabase' });
            if (!authToken) throw new Error("Could not get token to decrement credits.");

            // Create a temporary, authorized client instance (Supabase v2 standard)
            const authorizedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: {
                    headers: { Authorization: `Bearer ${authToken}` },
                },
            });

            // Use the authorized client for the RPC call
            const { error: decrementError } = await authorizedSupabase.rpc('decrement_user_credits', {
                user_id_to_update: user.id,
                amount_to_decrement: requiredCredits
            });

            if (decrementError) {
                console.error("Credit decrement failed, but generation succeeded.", decrementError);
            } else {
                updateCredits(requiredCredits);
            }

            onUpdateGeneration(data.content, alternateType);

        } catch (err: any) {
            setCrossGenError(err.message);
        } finally {
            setIsCrossGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Generation Complete: {type}</h2>

            <div className="mt-6 bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-lg p-4">
                {isPromptArray ? (
                    <>
                         <div className="flex justify-end mb-4">
                            <button
                                onClick={handleCopyAllPrompts}
                                className="flex items-center gap-2 text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 px-3 py-1 rounded-md"
                            >
                                <CopyIcon /> {copyStatus === 'copy-all' ? 'Copied All!' : 'Copy All Prompts'}
                            </button>
                        </div>
                        <div className="space-y-4">
                            {content.map((prompt, index) => (
                                <div key={index} className="bg-black/40 p-3 rounded-md border border-white/10 flex justify-between items-start gap-3">
                                    <textarea
                                        className="w-full bg-transparent text-sm text-gray-300/80 resize-y focus:outline-none"
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
                    </>
                ) : (
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

            {crossGenError && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong><span>{crossGenError}</span>
                </div>
            )}

            <div className="space-y-4">
                <button
                    onClick={handleCrossGenerate}
                    disabled={isCrossGenerating}
                    className="w-full px-6 py-3 font-bold text-white bg-gray-700 rounded-lg hover:bg-gray-600 transition-all duration-300 shadow-md disabled:opacity-50 flex items-center justify-center"
                >
                    {isCrossGenerating ? <Spinner /> : null}
                    Generate {alternateType} (0.5 Credits)
                </button>

                <div className="w-full rounded-lg bg-gradient-to-r from-[#007BFF] to-[#E600FF] p-[2px] transition-all duration-300 hover:shadow-[0_0_15px_0_rgba(128,0,255,0.4)]">
                    <button
                        onClick={onReset}
                        className="w-full px-6 py-3 font-bold text-white bg-[#111115] rounded-md hover:bg-gray-800 transition-all duration-300"
                    >
                        Start New Analysis (1 Credit)
                    </button>
                </div>
            </div>
        </div>
    );
};

