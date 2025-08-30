// File: frontend/src/components/image/ImageInputForm.tsx

import React, { useState, useCallback, DragEvent, ChangeEvent } from 'react';
import { LoadingOverlay } from '../shared/LoadingOverlay';
import { supabase } from '../../utils/supabase';
import { BACKEND_API_URL } from '../../config/constants';
import { ImageAnalysisResult } from '../../types/image';

interface ImageInputFormProps {
    onAnalysisComplete: (result: ImageAnalysisResult, newTopic: string, newDetails: string, preview: string) => void;
    creditBalance: number;
    isFetchingCredits: boolean;
    getToken: Function;
    updateCredits: (amount?: number) => void;
}

export const ImageInputForm: React.FC<ImageInputFormProps> = ({ 
    onAnalysisComplete, 
    creditBalance, 
    isFetchingCredits, 
    getToken, 
    updateCredits 
}) => {
    const [sourceImage, setSourceImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [topic, setTopic] = useState('');
    const [details, setDetails] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            setSourceImage(file);
            const reader = new FileReader();
            reader.onloadend = () => { 
                setImagePreview(reader.result as string); 
            };
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

        if (!BACKEND_API_URL) { 
            setError("Configuration error."); 
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
        if (!sourceImage || !imagePreview) { 
            setError("Please upload a source image."); 
            return; 
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('sourceImage', sourceImage);

            const response = await fetch(`${BACKEND_API_URL}/api/analyze-image`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(errData.error || 'Image analysis failed.');
            }

            const data = await response.json();
            if (!data.analysis) {
                throw new Error("Received unexpected format from the analysis API.");
            }

            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Could not get token to decrement credits.");
            const { error: decrementError } = await supabase.functions.invoke('decrement-credits', { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            if (decrementError) {
                console.error("Credit decrement failed, but analysis succeeded.", decrementError);
            } else {
                updateCredits(1);
            }

            onAnalysisComplete(data.analysis, topic, details, imagePreview);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingOverlay message="Analyzing Image DNA..." spinnerColor="#E600FF" />;
    }

    return (
        <form onSubmit={handleAnalyze} className="space-y-6 max-w-2xl mx-auto">
            {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <strong className="font-bold">Error: </strong><span>{error}</span>
                </div>
            )}

            <div>
                <label className="text-sm font-medium text-[#8A8A8E] mb-2 block">1. Upload Source Image</label>
                <div 
                    onDrop={handleDrop} 
                    onDragOver={handleDragOver} 
                    onDragLeave={handleDragLeave} 
                    className={`bg-black/30 border-2 border-dashed ${isDragging ? 'border-[#E600FF]' : 'border-brand-gray/40'} rounded-lg p-6 text-center cursor-pointer hover:border-[#E600FF] transition-colors group relative flex items-center justify-center min-h-[12rem]`}
                >
                    <input 
                        type="file" 
                        id="imageFile" 
                        onChange={handleInputChange} 
                        accept="image/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        disabled={isLoading} 
                    />
                    {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md relative z-0"/>
                    ) : (
                        <div className="relative z-0 pointer-events-none flex flex-col items-center">
                            <svg className="mx-auto h-12 w-12 text-[#8A8A8E] group-hover:text-[#E600FF] transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                            </svg>
                            <p className="mt-2 text-sm text-[#8A8A8E]">Drag & Drop or <span className="font-semibold text-[#E600FF]">Click to upload</span></p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <label htmlFor="image-topic" className="text-sm font-medium text-[#8A8A8E] mb-2 block">2. New Content Topic</label>
                <input 
                    id="image-topic" 
                    type="text" 
                    value={topic} 
                    onChange={e => setTopic(e.target.value)} 
                    className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#E600FF] focus:outline-none" 
                    placeholder="e.g., 'AI in Healthcare'" 
                    disabled={isLoading} 
                />
            </div>

             <div>
                <label htmlFor="image-details" className="text-sm font-medium text-[#8A8A8E] mb-2 block">3. Details (Optional)</label>
                <textarea 
                    id="image-details" 
                    rows={3} 
                    value={details} 
                    onChange={e => setDetails(e.target.value)} 
                    className="w-full bg-black/20 border border-[rgba(255,255,255,0.1)] rounded-md px-4 py-2.5 text-brand-light placeholder-[#8A8A8E] focus:ring-2 focus:ring-[#E600FF] focus:outline-none" 
                    placeholder="e.g., Recent breakthroughs in diagnostics" 
                    disabled={isLoading} 
                />
            </div>

            <div className="pt-4">
                <button 
                    type="submit" 
                    disabled={isLoading || isFetchingCredits}
                    className="w-full px-6 py-3 font-bold text-white bg-gradient-to-r from-[#007BFF] to-[#E600FF] rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_0_rgba(128,0,255,0.4)] focus:outline-none focus:ring-4 focus:ring-[#E600FF]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center"
                >
                    Analyze & Continue (1 Credit)
                </button>
            </div>
        </form>
    );
};