// File: frontend/src/components/image/ImageWorkflowManager.tsx

import React, { useState, useCallback } from 'react';
import { ImageInputForm } from './ImageInputForm';
import { ImageAnalysisDisplay } from './ImageAnalysisDisplay';
import { ImageGenerationOutput } from './ImageGenerationOutput';
import { WorkflowManagerProps } from '../../types/shared';
import { ImageAnalysisResult, ImageGenerationResult } from '../../types/image';
import { PricingPage } from '../shared/PricingPage';

export const ImageWorkflowManager: React.FC<WorkflowManagerProps> = ({ 
    creditBalance, 
    isFetchingCredits, 
    updateCredits, 
    getToken 
}) => {
    const [step, setStep] = useState<'input' | 'analysis' | 'generation'>('input');
    const [topic, setTopic] = useState('');
    const [details, setDetails] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
    const [generatedResult, setGeneratedResult] = useState<ImageGenerationResult | null>(null);
    const [textOverlayRequested, setTextOverlayRequested] = useState(true);

    // ... (handleAnalysisComplete, handleGenerationComplete, handleReset remain the same)
    const handleAnalysisComplete = useCallback((result: ImageAnalysisResult, newTopic: string, newDetails: string, preview: string) => {
        setAnalysisResult(result);
        setTopic(newTopic);
        setDetails(newDetails);
        setImagePreview(preview);
        setStep('analysis');
    }, []);

    const handleGenerationComplete = useCallback((result: ImageGenerationResult, withTextOverlay: boolean) => {
        setGeneratedResult(result);
        setTextOverlayRequested(withTextOverlay);
        setStep('generation');
    }, []);

    const handleReset = useCallback(() => {
        setTopic('');
        setDetails('');
        setImagePreview(null);
        setAnalysisResult(null);
        setGeneratedResult(null);
        setTextOverlayRequested(true);
        setStep('input');
    }, []);

    const renderStep = () => {
        // FIX: Check if the user is out of credits AND trying to start a new input.
        // If they are already in 'analysis' or 'generation', let them finish.
        if (step === 'input' && creditBalance <= 0 && !isFetchingCredits) {
            return (
                <div className="p-8 bg-black/30 rounded-2xl shadow-lg border border-gray-700">
                    <PricingPage />
                </div>
            );
        }

        switch (step) {
            case 'input':
                return (
                    <ImageInputForm
                        onAnalysisComplete={handleAnalysisComplete}
                        creditBalance={creditBalance}
                        isFetchingCredits={isFetchingCredits}
                        getToken={getToken}
                        updateCredits={updateCredits}
                    />
                );
            case 'analysis':
                return (
                    <ImageAnalysisDisplay
                        analysis={analysisResult!}
                        topic={topic}
                        details={details}
                        imagePreview={imagePreview!}
                        onGenerationComplete={handleGenerationComplete}
                    />
                );
            case 'generation':
                return (
                    <ImageGenerationOutput
                        result={generatedResult!}
                        textOverlayRequested={textOverlayRequested}
                        onReset={handleReset}
                    />
                );
        }
    };

    return <>{renderStep()}</>;
};