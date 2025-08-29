// File: frontend/src/components/shared/MarkdownRenderer.tsx

import React from 'react';

interface MarkdownRendererProps {
    text: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ text }) => {
    const html = text
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-white">$1</h3>') // For headings
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // For bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // For italics
        .replace(/(\r\n|\n|\r)/g, '<br>'); // For line breaks
    
    return (
        <div 
            className="whitespace-pre-wrap text-sm text-brand-light/80 leading-relaxed" 
            dangerouslySetInnerHTML={{ __html: html }} 
        />
    );
};