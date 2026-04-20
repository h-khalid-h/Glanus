'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, X, LogOut } from 'lucide-react';
import { csrfFetch } from '@/lib/api/csrfFetch';

const IMPERSONATION_COOKIE = 'glanus-impersonation';

interface ImpersonationMeta {
    adminId: string;
    adminEmail: string;
    adminName: string | null;
    targetUserId: string;
    targetEmail: string;
    targetName: string | null;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    logId: string;
    startedAt: string;
    expiresAt: string;
}

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * A sticky top banner displayed during admin impersonation sessions.
 * Reads the impersonation metadata cookie (non-httpOnly) to show
 * who is being impersonated and provides a "Stop Impersonation" button.
 *
 * Auto-detects when the impersonation expires and clears itself.
 */
export function ImpersonationBanner() {
    const [meta, setMeta] = useState<ImpersonationMeta | null>(null);
    const [stopping, setStopping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remaining, setRemaining] = useState('');

    // Read the impersonation cookie on mount and on navigation
    useEffect(() => {
        function readMeta() {
            const raw = getCookie(IMPERSONATION_COOKIE);
            if (!raw) {
                setMeta(null);
                return;
            }
            try {
                const parsed: ImpersonationMeta = JSON.parse(raw);
                // Check if expired
                if (new Date(parsed.expiresAt) <= new Date()) {
                    setMeta(null);
                    return;
                }
                setMeta(parsed);
            } catch {
                setMeta(null);
            }
        }

        readMeta();
        // Re-check every 5 seconds for expiry or cookie removal
        const interval = setInterval(readMeta, 5000);
        return () => clearInterval(interval);
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!meta) return;

        function updateCountdown() {
            const expiresAt = new Date(meta!.expiresAt).getTime();
            const now = Date.now();
            const diff = Math.max(0, expiresAt - now);

            if (diff === 0) {
                setMeta(null);
                setRemaining('Expired');
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
        }

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [meta]);

    const handleStop = useCallback(async () => {
        if (stopping) return;
        setStopping(true);
        setError(null);

        try {
            const res = await csrfFetch('/api/admin/stop-impersonation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            }

            setMeta(null);
            // Full page load so the browser picks up the restored admin session cookie
            window.location.href = '/super-admin/workspaces';
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to stop impersonation');
            setStopping(false);
        }
    }, [stopping]);

    if (!meta) return null;

    const displayName = meta.targetName || meta.targetEmail;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 shadow-lg">
            <div className="mx-auto flex items-center justify-between px-4 py-2 max-w-screen-2xl">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-semibold">
                        You are acting as{' '}
                        <span className="font-bold underline decoration-amber-700/40">{displayName}</span>
                        {' '}in workspace{' '}
                        <span className="font-bold">{meta.workspaceName}</span>
                    </span>
                    <span className="text-xs font-mono bg-amber-600/30 rounded px-1.5 py-0.5">
                        {remaining} remaining
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {error && (
                        <span className="text-xs text-amber-900 bg-amber-400/50 rounded px-2 py-0.5 flex items-center gap-1">
                            {error}
                            <button onClick={() => setError(null)}>
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    )}
                    <button
                        onClick={handleStop}
                        disabled={stopping}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900 disabled:opacity-50 transition-colors"
                    >
                        {stopping ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                        ) : (
                            <LogOut className="h-3 w-3" />
                        )}
                        Stop Impersonation
                    </button>
                </div>
            </div>
        </div>
    );
}
