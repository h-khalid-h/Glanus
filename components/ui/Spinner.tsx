'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    text?: string;
}

export function Spinner({ size = 'md', className = '', text }: SpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
            <Loader2 className={`${sizeClasses[size]} animate-spin text-nerve`} />
            {text && (
                <p className="text-sm text-slate-400">{text}</p>
            )}
        </div>
    );
}

interface PageSpinnerProps {
    text?: string;
}

export function PageSpinner({ text = 'Loading...' }: PageSpinnerProps) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" text={text} />
        </div>
    );
}

interface OverlaySpinnerProps {
    text?: string;
}

export function OverlaySpinner({ text = 'Loading...' }: OverlaySpinnerProps) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label={text}>
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 shadow-xl">
                <Spinner size="lg" text={text} />
            </div>
        </div>
    );
}

interface ButtonSpinnerProps {
    className?: string;
}

export function ButtonSpinner({ className = '' }: ButtonSpinnerProps) {
    return <Loader2 className={`w-4 h-4 animate-spin ${className}`} />;
}
