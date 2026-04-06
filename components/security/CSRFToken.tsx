'use client';

/**
 * CSRF Token Component
 * 
 * Add this to all forms that perform state-changing operations.
 * Automatically fetches and includes CSRF token in form submissions.
 */

import { useEffect, useState } from 'react';

interface CSRFTokenProps {
    /**
     * Optional callback when token is loaded
     */
    onTokenLoaded?: (token: string) => void;
}

export function CSRFToken({ onTokenLoaded }: CSRFTokenProps = {}) {
    const [token, setToken] = useState<string>('');

    useEffect(() => {
        // Fetch CSRF token from API
        fetch('/api/csrf')
            .then(res => res.json())
            .then(data => {
                if (data.token) {
                    setToken(data.token);
                    onTokenLoaded?.(data.token);
                }
            })
            .catch(() => {
                // Token loading failures handled silently — UI degrades gracefully
            });
    }, [onTokenLoaded]);

    if (!token) {
        return null; // Don't render anything while loading
    }

    return (
        <input
            type="hidden"
            name="csrf_token"
            value={token}
            readOnly
        />
    );
}

/**
 * Hook to get CSRF token for fetch requests
 */
export function useCSRFToken() {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/csrf')
            .then(res => res.json())
            .then(data => {
                setToken(data.token || null);
                setLoading(false);
            })
            .catch(() => {
                // Token loading failures handled silently
                setLoading(false);
            });
    }, []);

    return { token, loading };
}

import { csrfFetch } from '@/lib/api/csrfFetch';

/**
 * Fetch wrapper that automatically includes CSRF token
 */
export async function fetchWithCSRF(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    return csrfFetch(url, options);
}
