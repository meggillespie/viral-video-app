// File: frontend/src/types/video.ts

export interface AnalysisResult {
    meta: { 
        analyzed_style: string; 
        primary_tone: string; 
    };
    hook_analysis: { 
        technique: string; 
        pacing: string; 
        emotional_trigger: string; 
    };
    retention_signals: { 
        pacing_strategy: string; 
        narrative_structure: string; 
        visual_style: string; 
    };
    engagement_tactics: { 
        ctas: string[]; 
        interactive_elements: string; 
    };
    [key: string]: any;
}

export type VideoOutputType = 'Script' | 'AI Video Prompts';