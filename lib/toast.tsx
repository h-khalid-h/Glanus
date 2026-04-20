import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: ToastAction;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    success: (title: string, message?: string, action?: ToastAction) => void;
    error: (title: string, message?: string, action?: ToastAction) => void;
    warning: (title: string, message?: string, action?: ToastAction) => void;
    info: (title: string, message?: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    useEffect(() => {
        return () => {
                // eslint-disable-next-line react-hooks/exhaustive-deps
            timersRef.current.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: Toast = {
            ...toast,
            id,
            duration: toast.duration ?? 5000, // Default 5s
        };

        setToasts((prev) => [...prev, newToast]);

        // Auto-dismiss after duration
        if ((newToast.duration ?? 0) > 0) {
            const timer = setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
                timersRef.current.delete(id);
            }, newToast.duration);
            timersRef.current.set(id, timer);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        const timer = timersRef.current.get(id);
        if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const success = useCallback((title: string, message?: string, action?: ToastAction) => {
        addToast({ type: 'success', title, message, action });
    }, [addToast]);

    const error = useCallback((title: string, message?: string, action?: ToastAction) => {
        addToast({ type: 'error', title, message, action });
    }, [addToast]);

    const warning = useCallback((title: string, message?: string, action?: ToastAction) => {
        addToast({ type: 'warning', title, message, action });
    }, [addToast]);

    const info = useCallback((title: string, message?: string, action?: ToastAction) => {
        addToast({ type: 'info', title, message, action });
    }, [addToast]);

    return (
        <ToastContext.Provider
            value={{
                toasts,
                addToast,
                removeToast,
                success,
                error,
                warning,
                info,
            }}
        >
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

// Singleton toast manager for use outside React components
class ToastManager {
    private static instance: ToastManager;
    private listeners: ((toast: Omit<Toast, 'id'>) => void)[] = [];

    private constructor() { }

    static getInstance(): ToastManager {
        if (!ToastManager.instance) {
            ToastManager.instance = new ToastManager();
        }
        return ToastManager.instance;
    }

    subscribe(listener: (toast: Omit<Toast, 'id'>) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    notify(toast: Omit<Toast, 'id'>) {
        this.listeners.forEach((listener) => listener(toast));
    }

    success(title: string, message?: string, action?: ToastAction) {
        this.notify({ type: 'success', title, message, action });
    }

    error(title: string, message?: string, action?: ToastAction) {
        this.notify({ type: 'error', title, message, action });
    }

    warning(title: string, message?: string, action?: ToastAction) {
        this.notify({ type: 'warning', title, message, action });
    }

    info(title: string, message?: string, action?: ToastAction) {
        this.notify({ type: 'info', title, message, action });
    }
}

// Export singleton instance
export const toast = ToastManager.getInstance();
