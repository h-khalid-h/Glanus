/**
 * CSRF Token API Endpoint
 * 
 * Generates and returns a CSRF token for client-side forms
 */

import { NextRequest } from 'next/server';
import { getOrCreateCSRFToken } from '@/lib/security/csrf';
import { createSecureResponse } from '@/lib/security/headers';

export async function GET(request: NextRequest) {
    try {
        const token = await getOrCreateCSRFToken();

        return createSecureResponse(
            JSON.stringify({ token }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch {
        return createSecureResponse(
            JSON.stringify({ error: 'Failed to generate CSRF token' }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
    }
}
