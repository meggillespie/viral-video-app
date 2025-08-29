// File: frontend/src/types/image.ts

export interface ImageGenerationResult {
    imageUrl: string;
    posts: { 
        linkedin: string; 
        twitter: string; 
        instagram: string; 
        facebook: string; 
    };
    headline: string | null;
}

export interface ImageAnalysisResult {
    subjects: Array<{
        name: string;
        description: string;
        prominence: string;
    }>;
    setting: {
        location: string;
        time_of_day: string;
        context: string;
    };
    style_elements: {
        artistic_medium: string;
        photography_style: string;
        lighting: string;
        color_palette: {
            dominant_colors: string[];
            description: string;
        };
        composition: string;
        overall_mood: string;
    };
}

export type ImageGenerationIntent = 'AdaptRemix' | 'ExtractStyle';