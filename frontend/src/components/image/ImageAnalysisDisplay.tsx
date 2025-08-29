// File: frontend/src/components/image/ImageAnalysisDisplay.tsx

import React, { useState } from 'react';
import { Spinner } from '../shared/Icons';
import { BACKEND_API_URL } from '../../config/constants';
import { ImageAnalysisResult, ImageGenerationIntent, ImageGenerationResult } from '../../types/image';

interface ImageAnalysisDisplayProps {
    analysis: ImageAnalysisResult;
    topic: string;
    details: string;
    imagePreview: string;
    onGenerationComplete: (result: ImageGenerationResult, withTextOverlay: boolean) => void;
}

export const ImageAnalysisDisplay: React.FC<ImageAnalysisDisplayProps> = ({ 
    analysis, 
    topic, 
    details, 
    imagePreview, 
    onGenerationComplete 
}) => {
    const [intent, setIntent] = useState<ImageGenerationIntent>('AdaptRemix');
    const [controlLevel, setControlLevel] = useState(50);
    const [withTextOverlay, setWithTextOverlay] = useState(true);
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
            const cacheBustUrl = `${BACKEND_API_URL}/api/generate-image-content?timestamp=${Date.now()}`;

            const response = await fetch(cacheBustUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    details: details,
                    analysis: analysis,
                    intent: intent,
                    controlLevel: controlLevel,
                    withTextOverlay: withTextOverlay,
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

            onGenerationComplete(data.result, withTextOverlay);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const detectedSubjects = analysis.subjects.map(s => s.name).join(', ') || 'None';
    const detectedStyle = `${analysis.style_elements.photography_style || analysis.style_elements.artistic_medium}, ${analysis.style_elements.lighting} lighting, ${analysis.style_elements.composition}` || 'Standard Style';

    const sliderConfig = intent === 'AdaptRemix' ? {
        label: 'Creative Freedom',
        minLabel: 'Faithful Adaptation',
        maxLabel: 'Abstract Interpretation'
    } : {
        label: 'Style Adherence',
        minLabel: 'Loosely Inspired',
        maxLabel: 'Strictly Follow Style'
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-brand-light text-center">Analysis Complete: Select Intent</h2>

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong><span>{error}</span>
                </div>
            )}

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
                <div>
                    <label className="text-lg font-medium text-white mb-4 block text-center">How do you want to use this image?</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div
                            onClick={() => setIntent('AdaptRemix')}
                            className={`p-6 rounded-xl border-4 cursor-pointer transition-all ${
                                intent === 'AdaptRemix' ? 'border-[#E600FF] bg-black/50 shadow-[0_0_20px_0_rgba(230,0,255,0.2)]' : 'border-transparent bg-black/30 hover:bg-black/50'
                            }`}
                        >
                            <h4 className="text-xl font-bold text-white mb-2">Adapt & Remix</h4>
                            <p className="text-sm text-[#8A8A8E]">Keep the original subjects (<span className='text-white'>{detectedSubjects}</span>) and setting, but adapt the scene to your new topic.</p>
                        </div>

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

                <div className="max-w-3xl mx-auto">
                    <label htmlFor="control-level" className="flex justify-between items-center text-lg font-medium text-white mb-4">
                        <span>{sliderConfig.label}</span>
                        <span className="text-[#E600FF] font-semibold">{controlLevel}%</span>
                    </label>
                    <input
                        id="control-level"
                        type="range"
                        min="0"
                        max="100"
                        value={controlLevel}
                        onChange={(e) => setControlLevel(Number(e.target.value))}
                        className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer range-lg accent-[#E600FF]"
                        disabled={isLoading}
                    />
                     <div className="flex justify-between text-sm text-gray-400 mt-2">
                        <span>{sliderConfig.minLabel}</span>
                        <span>{sliderConfig.maxLabel}</span>
                    </div>
                </div>

                <div className="flex items-center justify-center bg-black/30 p-3 rounded-lg border border-[rgba(255,255,255,0.1)] max-w-md mx-auto">
                    <span className="text-sm font-medium text-[#8A8A8E] mr-4">Generate Text Overlay Headline?</span>
                    <label htmlFor="text-overlay-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            id="text-overlay-toggle" 
                            className="sr-only peer" 
                            checked={withTextOverlay} 
                            onChange={() => setWithTextOverlay(!withTextOverlay)} 
                            disabled={isLoading} 
                        />
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-[#E600FF]/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E600FF]"></div>
                    </label>
                </div>

                <div className="pt-4 flex justify-center">
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="px-12 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] focus:outline-none focus:ring-4 focus:ring-[#E600FF]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center"
                    >
                        {isLoading ? <Spinner /> : null}
                        {isLoading ? 'Generating Content...' : 'Generate Image & Posts'}
                    </button>
                </div>
            </form>
        </div>
    );
};