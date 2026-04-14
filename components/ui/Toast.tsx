'use client';

import React, { useState } from 'react';
import { useToast, Toast as ToastType } from '@/lib/toast';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

export function ToastContainer() {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

interface ToastProps {
    toast: ToastType;
    onDismiss: () => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
    const [isExiting, setIsExiting] = useState(false);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(onDismiss, 300); // Match animation duration
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-health-good" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-destructive" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-warning" />;
            case 'info':
                return <Info className="w-5 h-5 text-primary" />;
        }
    };

    const getBgColor = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-card border-health-good/20';
            case 'error':
                return 'bg-card border-destructive/20';
            case 'warning':
                return 'bg-card border-warning/20';
            case 'info':
                return 'bg-card border-primary/20';
        }
    };

    return (
        <div
            className={`
        ${getBgColor()}
        border rounded-xl p-4 min-w-[320px] max-w-md backdrop-blur-xl
        transform transition-all duration-300 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
            style={{ boxShadow: 'var(--shadow-lg)' }}
            role="alert"
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            {toast.message}
                        </p>
                    )}
                    {toast.action && (
                        <button type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toast.action!.onClick();
                                handleDismiss();
                            }}
                            className="mt-2 text-sm font-medium text-nerve hover:text-nerve/80"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>

                <button type="button"
                    onClick={handleDismiss}
                    className="flex-shrink-0 text-muted-foreground hover:text-muted-foreground transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
