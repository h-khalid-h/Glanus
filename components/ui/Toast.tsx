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
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
            case 'info':
                return <Info className="w-5 h-5 text-nerve" />;
        }
    };

    const getBgColor = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-health-good/10 border-health-good/20';
            case 'error':
                return 'bg-health-critical/10 border-health-critical/20';
            case 'warning':
                return 'bg-health-warn/10 border-health-warn/20';
            case 'info':
                return 'bg-nerve/10 border-nerve/20';
        }
    };

    return (
        <div
            className={`
        ${getBgColor()}
        border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md
        transform transition-all duration-300 ease-in-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
            role="alert"
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">{getIcon()}</div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className="mt-1 text-sm text-slate-400">
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
                    className="flex-shrink-0 text-slate-500 hover:text-slate-400 transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
