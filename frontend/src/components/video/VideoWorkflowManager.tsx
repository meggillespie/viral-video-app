// File: frontend/src/components/video/VideoWorkflowManager.tsx

import React, { useState, useCallback } from 'react';
import { VideoInputForm } from './VideoInputForm';
import { VideoAnalysisDisplay } from './VideoAnalysisDisplay';
import { VideoGenerationOutput } from './VideoGenerationOutput';
import { WorkflowManagerProps } from '../../types/shared';
import { AnalysisResult, VideoOutputType } from '../../types/video';

export const VideoWorkflowManager: React.FC<WorkflowManagerProps> = ({ 
    creditBalance, 
    isFetchingCredits, 
    updateCredits, 
    getToken 
}) => {
    const [step, setStep] = useState<'input' | 'analysis' | 'generation'>('input');
    const [topic, setTopic] = useState('');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [generatedContent, setGeneratedContent] = useState<string | string[] | null>(null);
    const [generatedType, setGeneratedType] = useState<VideoOutputType | null>(null);

    const handleAnalysisComplete = useCallback((result: AnalysisResult, newTopic: string) => {
        setAnalysisResult(result);
        setTopic(newTopic);
        setStep('analysis');
    }, []);

    const handleGenerationComplete = useCallback((content: string | string[], type: VideoOutputType) => {
        setGeneratedContent(content);
        setGeneratedType(type);
        setStep('generation');
    }, []);

    const handleUpdateGeneration = useCallback((content: string | string[], type: VideoOutputType) => {
        setGeneratedContent(content);
        setGeneratedType(type);
    }, []);

    const handleReset = useCallback(() => {
        setTopic('');
        setAnalysisResult(null);
        setGeneratedContent(null);
        setGeneratedType(null);
        setStep('input');
    }, []);

    const renderStep = () => {
        switch (step) {
            case 'input':
                return (
                    <VideoInputForm
                        onAnalysisComplete={handleAnalysisComplete}
                        creditBalance={creditBalance}
                        isFetchingCredits={isFetchingCredits}
                        getToken={getToken}
                        updateCredits={updateCredits}
                    />
                );
            case 'analysis':
                return (
                    <VideoAnalysisDisplay
                        analysis={analysisResult!}
                        topic={topic}
                        onGenerationComplete={handleGenerationComplete}
                    />
                );
            case 'generation':
                return (
                    <VideoGenerationOutput
                        content={generatedContent!}
                        type={generatedType!}
                        onReset={handleReset}
                        analysis={analysisResult!}
                        topic={topic}
                        getToken={getToken}
                        updateCredits={updateCredits}
                        onUpdateGeneration={handleUpdateGeneration}
                        creditBalance={creditBalance}
                    />
                );
        }
    };

    return <>{renderStep()}</>;
};