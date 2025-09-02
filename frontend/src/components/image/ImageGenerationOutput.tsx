import React, { useState } from 'react';
import { ImageGenerationResult } from '../../types/image';

// --- Icon Component (from shared/Icons.tsx) ---
export const CopyIcon = () => (
    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

// --- Clipboard Utility (from utils/clipboard.ts) ---
export const handleCopy = (text: string, isMarkdown: boolean, setStatus: React.Dispatch<React.SetStateAction<string>>, id: string) => {
    // A simple regex to strip markdown for plain text copy if needed, though not used for social posts.
    const plainText = isMarkdown ? text.replace(/(\*\*|__|\*|_|#+\s?)/g, '') : text;
    navigator.clipboard.writeText(plainText).then(() => {
        setStatus(id);
        setTimeout(() => setStatus(''), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
};


// ============================================================================
// MAIN COMPONENT: ImageGenerationOutput
// ============================================================================

interface ImageGenerationOutputProps {
    result: ImageGenerationResult;
    textOverlayRequested: boolean;
    onReset: () => void;
}

export const ImageGenerationOutput: React.FC<ImageGenerationOutputProps> = ({ 
    result, 
    textOverlayRequested, 
    onReset 
}) => {
    const [copyStatus, setCopyStatus] = useState('');
    const [editableHeadline, setEditableHeadline] = useState(
        result.headline ?? (textOverlayRequested ? "Your Headline Here" : "")
    );

    const renderPost = (platform: string, content: string) => (
        content ? (
            <div className="bg-black/40 p-4 rounded-lg border border-[rgba(255,255,255,0.1)]">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-white">{platform}</h4>
                    <button
                        onClick={() => handleCopy(content, false, setCopyStatus, platform)}
                        className="text-sm text-[#8A8A8E] hover:text-white transition-colors bg-white/10 p-2 rounded-md"
                    >
                        {copyStatus === platform ? 'Copied!' : <CopyIcon />}
                    </button>
                </div>
                <p className="text-sm text-[#F5F5F7]/80 whitespace-pre-wrap">{content}</p>
            </div>
        ) : null
    );

    const downloadImage = () => {
        const link = document.createElement('a');
        link.href = result.imageUrl;
        link.download = `vyralize-generated-image.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <h2 className="text-2xl font-bold text-white lg:col-span-2">Generation Complete</h2>

            <div className="space-y-6">
                <div className="relative group">
                    <img src={result.imageUrl} alt="Generated Content" className="w-full h-auto block rounded-lg shadow-xl"/>

                    {textOverlayRequested && (
                        <div className="absolute inset-0 flex items-center justify-center p-4 rounded-lg">
                             <textarea
                                className="text-white text-2xl lg:text-3xl font-bold text-center bg-transparent border-2 border-dashed border-transparent hover:border-white/30 focus:border-white/70 focus:outline-none resize-none w-full h-full p-4 transition-colors"
                                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                                value={editableHeadline}
                                onChange={(e) => setEditableHeadline(e.target.value)}
                                aria-label="Editable Headline Overlay"
                            />
                        </div>
                    )}

                    <button
                        onClick={downloadImage}
                        className="absolute top-2 right-2 bg-[#E600FF] text-white p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-[#b300c7]"
                        title="Download Image"
                    >
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                </div>
                
                <div className="w-full rounded-lg bg-gradient-to-r from-[#007BFF] to-[#E600FF] p-[2px] transition-all duration-300 hover:shadow-[0_0_15px_0_rgba(128,0,255,0.4)] mt-4">
                    <button
                        onClick={onReset}
                        className="w-full px-6 py-3 font-bold text-white bg-[#111115] rounded-md hover:bg-gray-800 transition-all duration-300"
                    >
                        Start New Analysis (1 Credit)
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Social Media Posts</h3>
                {renderPost("LinkedIn", result.posts.linkedin)}
                {renderPost("X", result.posts.twitter)}
                {renderPost("Instagram", result.posts.instagram)}
                {renderPost("Facebook", result.posts.facebook)}
            </div>
        </div>
    );
};

