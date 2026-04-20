/**
 * POST /api/auth/force-reset-password
 *
 * Allows a user whose mustChangePassword flag is true to set a new password.
 * On success: clears the flag, issues a fresh access-token cookie (without
 * the mustChangePassword claim), and returns 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';
import {
    encodeAccessToken,
    getSessionCookieName,
    getAccessCookieOptions,
} from '@/lib/auth/jwt-helpers';
import { logInfo, logWarn } from '@/lib/logger';

const resetSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirmation: z.string(),
}).refine((d) => d.password === d.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
});

export async function POST(request: NextRequest) {
    try {
        // 1. Verify the caller is authenticated and actually needs a reset
        const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
        if (!token?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (token.mustChangePassword !== true) {
            return NextResponse.json({ error: 'Password reset not required' }, { status: 400 });
        }

        // 2. Parse & validate body
        const body = await request.json();
        const parsed = resetSchema.safeParse(body);
        if (!parsed.success) {
            const firstError = parsed.error.errors[0]?.message ?? 'Invalid input';
            return NextResponse.json({ error: firstError }, { status: 422 });
        }

        const { password } = parsed.data;

        // 3. Fetch user and prevent reuse of the current password
        const user = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, email: true, name: true, role: true, isStaff: true, password: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isSame = await bcrypt.compare(password, user.password);
        if (isSame) {
            return NextResponse.json(
                { error: 'New password must be different from the current password' },
                { status: 422 },
            );
        }

        // 4. Hash and persist
        const hashed = await bcrypt.hash(password, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashed,
                mustChangePassword: false,
                passwordChangedAt: new Date(),
            },
        });

        // 5. Audit log (non-fatal)
        try {
            await prisma.auditLog.create({
                data: {
                    action: 'USER_FORCE_PASSWORD_RESET',
                    resourceType: 'User',
                    resourceId: user.id,
                    userId: user.id,
                    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
                    metadata: { changedAt: new Date().toISOString() },
                },
            });
        } catch (err) {
            logWarn('[AUTH] Audit log failed for force password reset', {
                error: err instanceof Error ? err.message : String(err),
            });
        }

        logInfo(`[AUTH] User ${user.email} completed forced password reset`);

        // 6. Issue a fresh access token WITHOUT the mustChangePassword claim
        const accessJwt = await encodeAccessToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isStaff: user.isStaff,
            sid: token.sid as string | undefined,
        });

        const response = NextResponse.json({ ok: true });
        response.cookies.set(getSessionCookieName(), accessJwt, getAccessCookieOptions());

        return response;
    } catch (err) {
        logWarn('[AUTH] Force password reset error', {
            error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
