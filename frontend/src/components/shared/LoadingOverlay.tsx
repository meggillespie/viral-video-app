// File: frontend/src/components/shared/LoadingOverlay.tsx

import React from 'react';

interface LoadingOverlayProps {
    message: string;
    spinnerColor?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
    message, 
    spinnerColor = '#007BFF' 
}) => {
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div 
                className={`w-12 h-12 border-4 border-gray-700 rounded-full animate-spin`}
                style={{ borderTopColor: spinnerColor }}
            ></div>
            <p className="text-gray-300 font-semibold">{message}</p>
        </div>
    );
};