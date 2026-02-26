/**
 * CSRF-aware fetch wrapper
 *
 * Automatically fetches and injects the CSRF token for state-changing requests.
 * Use this instead of `fetch()` for POST, PUT, PATCH, and DELETE requests.
 *
 * The token is cached after the first call and reused for subsequent requests.
 * If a request fails with 403 (CSRF mismatch), the token is refreshed and retried once.
 */

let _cachedToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
    const res = await fetch('/api/csrf');
    const data = await res.json();
    _cachedToken = data.token;
    return _cachedToken!;
}

/**
 * Wrapper around fetch() that automatically includes the CSRF token
 * for state-changing HTTP methods (POST, PUT, PATCH, DELETE).
 */
export async function csrfFetch(
    url: string | URL | Request,
    init?: RequestInit
): Promise<Response> {
    const method = (init?.method || 'GET').toUpperCase();
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!needsCsrf) {
        return fetch(url, init);
    }

    // Get or fetch CSRF token
    if (!_cachedToken) {
        await fetchCsrfToken();
    }

    const headers = new Headers(init?.headers);
    headers.set('x-csrf-token', _cachedToken!);

    // Ensure JSON content type for body requests
    if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, { ...init, headers });

    // If CSRF token expired/invalid, refresh and retry once
    if (response.status === 403) {
        const body = await response.clone().json().catch(() => null);
        if (body?.error?.includes?.('CSRF')) {
            await fetchCsrfToken();
            headers.set('x-csrf-token', _cachedToken!);
            return fetch(url, { ...init, headers });
        }
    }

    return response;
}
