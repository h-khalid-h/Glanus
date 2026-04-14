'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

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
        danger: 'bg-destructive hover:bg-destructive/80 text-destructive-foreground',
        warning: 'bg-warning hover:bg-warning/80 text-warning-foreground',
        default: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    };

    const iconColors = {
        danger: 'text-destructive bg-destructive/10',
        warning: 'text-warning bg-warning/10',
        default: 'text-primary bg-primary/10',
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
                className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in"
            >
                <div className="flex gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconColors[variant]}`}>
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <h3 id="confirm-title" className="text-base font-semibold text-foreground">
                            {title}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        {cancelLabel}
                    </button>
                    <button type="button"
                        onClick={onConfirm}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${confirmColors[variant]}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
