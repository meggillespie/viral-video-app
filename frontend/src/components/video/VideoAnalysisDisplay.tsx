// File: frontend/src/components/video/VideoAnalysisDisplay.tsx

import React, { useState } from 'react';
import { Spinner } from '../shared/Icons';
import { BACKEND_API_URL } from '../../config/constants';
import { AnalysisResult, VideoOutputType } from '../../types/video';

interface VideoAnalysisDisplayProps {
    analysis: AnalysisResult;
    topic: string;
    onGenerationComplete: (content: string | string[], type: VideoOutputType) => void;
}

export const VideoAnalysisDisplay: React.FC<VideoAnalysisDisplayProps> = ({ 
    analysis, 
    topic, 
    onGenerationComplete 
}) => {
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

            onGenerationComplete(data.content, type);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setLoadingType(null);
        }
    };

    const renderAnalysisSection = (title: string, content: React.ReactNode) => (
        <div className="bg-black/30 p-4 rounded-lg border border-[rgba(255,255,255,0.1)]">
            <h4 className="font-semibold text-[#007BFF] mb-2">{title}</h4>
            <div className="text-sm text-[#F5F5F7]/80 space-y-1">
                {content}
            </div>
        </div>
    );

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

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong><span>{error}</span>
                </div>
            )}

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
};