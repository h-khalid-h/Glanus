'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Themed confirmation dialog that replaces browser-native confirm().
 * Matches the Glanus dark design system.
 */
export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        },
        [onCancel]
    );

    useEffect(() => {
        if (open) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, handleKeyDown]);

    if (!open) return null;

    const confirmColors = {
        danger: 'bg-destructive hover:bg-destructive/80 text-white',
        warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        default: 'bg-nerve hover:bg-nerve/90 text-white',
    };

    const iconColors = {
        danger: 'text-health-critical bg-health-critical/10',
        warning: 'text-health-warn bg-health-warn/10',
        default: 'text-nerve bg-nerve/10',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                className="relative z-10 mx-4 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl animate-fade-in"
            >
                <div className="flex gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconColors[variant]}`}>
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <h3 id="confirm-title" className="text-base font-semibold text-white">
                            {title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                    >
                        {cancelLabel}
                    </button>
                    <button type="button"
                        onClick={onConfirm}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${confirmColors[variant]}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
