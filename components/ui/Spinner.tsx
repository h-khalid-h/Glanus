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
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
            {text && (
                <p className="text-sm text-muted-foreground">{text}</p>
            )}
        </div>
    );
}

interface PageSpinnerProps {
    text?: string;
}

export function PageSpinner({ text = 'Loading...' }: PageSpinnerProps) {
    return (
        <div className="flex items-center justify-center min-h-[400px] animate-fade-in">
            <Spinner size="lg" text={text} />
        </div>
    );
}

interface OverlaySpinnerProps {
    text?: string;
}

export function OverlaySpinner({ text = 'Loading...' }: OverlaySpinnerProps) {
    return (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label={text}>
            <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-fade-in">
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
