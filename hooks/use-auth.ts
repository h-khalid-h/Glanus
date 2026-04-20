/**
 * useAuth — Client-side auth hook with automatic silent token refresh.
 *
 * Wraps NextAuth's useSession() and adds:
 *  - Silent access-token refresh via /api/auth/refresh
 *  - Periodic refresh (every 12 minutes for 15-min access tokens)
 *  - Explicit logout that revokes server-side sessions
 *  - Login function that uses the custom /api/auth/login endpoint
 *  - Session management (list/revoke devices)
 */

'use client';

import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // Refresh 3 min before 15-min expiry

export interface LoginInput {
    email: string;
    password: string;
}

export interface LoginResult {
    ok: boolean;
    error?: string;
    forcePasswordReset?: boolean;
    user?: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        isStaff: boolean;
        emailVerified: boolean;
        onboardingCompleted: boolean;
    };
}

export interface AuthSession {
    id: string;
    ipAddress: string | null;
    deviceName: string | null;
    country: string | null;
    lastActiveAt: string;
    createdAt: string;
}

async function getCsrfToken(): Promise<string | null> {
    try {
        const res = await fetch('/api/csrf');
        if (!res.ok) return null;
        const data = await res.json();
        return data.token || null;
    } catch {
        return null;
    }
}

export function useAuth() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const isRefreshing = useRef(false);
    // Tracks whether we have ever started the interval for this mounted instance.
    // Prevents the effect from re-starting the interval when NextAuth's update()
    // causes status to cycle authenticated→loading→authenticated.
    const intervalStarted = useRef(false);

    // Keep update in a stable ref so it never causes refresh() to change identity.
    const updateRef = useRef(update);
    useEffect(() => { updateRef.current = update; }, [update]);

    // --- Silent refresh ---
    const refresh = useCallback(async (): Promise<boolean> => {
        if (isRefreshing.current) return false;
        isRefreshing.current = true;
        try {
            const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });

            // 204 = no refresh cookie present (session exists but has no persistent refresh
            // token — e.g. issued before the new auth system was deployed).
            // This is NOT an error; just leave the NextAuth session as-is.
            if (res.status === 204) return false;

            if (res.ok) {
                // Do NOT call update() here — it causes status to flip
                // authenticated→loading→authenticated which re-fires this effect
                // and creates an infinite refresh loop. The server already rotated
                // the session cookie; NextAuth will pick it up on the next natural
                // session check.
                return true;
            }

            // Only sign the user out if the server explicitly rejected a real token
            // (401 = expired/invalid, 403 = replay detected).
            if (res.status === 401 || res.status === 403) {
                await nextAuthSignOut({ redirect: false });
                router.push('/login?expired=true');
            }
            return false;
        } catch {
            return false;
        } finally {
            isRefreshing.current = false;
        }
    }, [router]);

    // Start the periodic refresh interval once when the user becomes authenticated.
    // We intentionally avoid putting this in a cleanup+re-run cycle — the interval
    // is cleared only when the component unmounts or the user is logged out.
    useEffect(() => {
        if (status === 'authenticated' && !intervalStarted.current) {
            intervalStarted.current = true;
            refresh();
            refreshTimer.current = setInterval(refresh, REFRESH_INTERVAL_MS);
        }

        if (status === 'unauthenticated') {
            intervalStarted.current = false;
            if (refreshTimer.current) {
                clearInterval(refreshTimer.current);
                refreshTimer.current = null;
            }
        }
    }, [status, refresh]);

    // --- Login ---
    const login = useCallback(
        async (input: LoginInput): Promise<LoginResult> => {
            const csrfToken = await getCsrfToken();

            let res: Response;
            try {
                res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                    },
                    credentials: 'include',
                    body: JSON.stringify(input),
                });
            } catch {
                return { ok: false, error: 'Network error. Please check your connection.' };
            }

            // Parse body defensively — an empty/non-JSON body (e.g., 500 with no content)
            // must not crash as a raw exception into the UI.
            let data: { ok?: boolean; error?: string | { code?: number; message?: string; retryAfter?: number }; forcePasswordReset?: boolean; user?: LoginResult['user'] } = {};
            try {
                data = await res.json() as typeof data;
            } catch {
                if (!res.ok) {
                    return { ok: false, error: `Server error (${res.status}). Please try again.` };
                }
            }

            if (!res.ok) {
                const errMsg = typeof data.error === 'string'
                    ? data.error
                    : (data.error as { message?: string } | undefined)?.message || 'Login failed';
                return { ok: false, error: errMsg };
            }

            return { ok: true, forcePasswordReset: data.forcePasswordReset ?? false, user: data.user };
        },
        []
    );

    // --- Logout ---
    const logout = useCallback(async (): Promise<void> => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch {
            // Best-effort server-side revocation
        }
        // Always clear client-side session
        await nextAuthSignOut({ redirect: false });
        router.push('/login');
    }, [router]);

    // --- Session management ---
    const listSessions = useCallback(async (): Promise<AuthSession[]> => {
        const res = await fetch('/api/auth/sessions', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.data?.sessions || [];
    }, []);

    const revokeSession = useCallback(async (sessionId: string): Promise<boolean> => {
        const csrfToken = await getCsrfToken();
        const res = await fetch(`/api/auth/sessions?id=${sessionId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
        });
        return res.ok;
    }, []);

    const revokeAllSessions = useCallback(async (): Promise<boolean> => {
        const csrfToken = await getCsrfToken();
        const res = await fetch('/api/auth/sessions?all=true', {
            method: 'DELETE',
            credentials: 'include',
            headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
        });
        return res.ok;
    }, []);

    return {
        session,
        status,
        isAuthenticated: status === 'authenticated',
        isLoading: status === 'loading',
        user: session?.user ?? null,
        login,
        logout,
        refresh,
        listSessions,
        revokeSession,
        revokeAllSessions,
    };
}
