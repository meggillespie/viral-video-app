// File: frontend/src/components/video/VideoGenerationOutput.tsx

import React, { useState } from 'react';
import { CopyIcon, Spinner } from '../shared/Icons';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { handleCopy } from '../../utils/clipboard';
import { supabase } from '../../utils/supabase';
import { BACKEND_API_URL } from '../../config/constants';
import { AnalysisResult, VideoOutputType } from '../../types/video';

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
        
        const requiredCredits = 1; 

        if (creditBalance < requiredCredits) {
            setCrossGenError("You do not have enough credits for this generation.");
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
            
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { 
                headers: { Authorization: `Bearer ${authToken}` } 
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
            <h2 className="text-2xl font-bold text-brand-light">Generation Complete: {type}</h2>

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
                    Generate {alternateType} (1 Credit)
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