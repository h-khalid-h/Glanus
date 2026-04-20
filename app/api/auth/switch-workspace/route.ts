/**
 * POST /api/auth/switch-workspace
 *
 * Embeds the target workspace ID and the user's role in that workspace
 * as JWT claims, eliminating the DB lookup on subsequent requests.
 *
 * Flow:
 *   1. Verify the user is authenticated.
 *   2. Verify the user actually has access to the requested workspace (DB check — one-time cost).
 *   3. Issue a new access token with { wid, wRole } claims.
 *   4. The refresh token family is preserved — only the access token changes.
 *
 * After this call, requireWorkspaceAccess() can satisfy requests from the
 * JWT claim alone without a DB round-trip, as long as:
 *   - The access token hasn't expired (15 min window).
 *   - The workspace ID in the URL matches token.wid.
 *
 * Membership changes (role update, removal) take effect at the next token
 * refresh (max 15 min), which is acceptable for most multi-tenant scenarios.
 * For immediate revocation, call invalidateWorkspaceClaim().
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';
import {
    encodeAccessToken,
    getSessionCookieName,
    getAccessCookieOptions,
} from '@/lib/auth/jwt-helpers';

import type { WorkspaceRole } from '@prisma/client';

const bodySchema = z.object({
    workspaceId: z.string().min(1),
});

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    OWNER: 5,
    ADMIN: 4,
    STAFF: 3,
    MEMBER: 2,
    VIEWER: 1,
};

export async function POST(request: NextRequest) {
    // 1. Authenticate
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const { workspaceId } = parsed.data;
    const userId = token.id as string;

    // 2. Verify membership (one-time DB cost)
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
            id: true,
            ownerId: true,
            deletedAt: true,
            members: { where: { userId }, select: { role: true } },
        },
    });

    if (!workspace || workspace.deletedAt) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const isOwner = workspace.ownerId === userId;
    const membership = workspace.members[0];

    if (!isOwner && !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const role: WorkspaceRole = isOwner ? 'OWNER' : membership.role;

    // 3. Issue new access token with workspace claim
    const newAccessJwt = await encodeAccessToken({
        id: userId,
        email: token.email as string,
        name: token.name as string | null,
        role: token.role as string,
        isStaff: token.isStaff as boolean,
        sid: token.sid as string | undefined,
        wid: workspaceId,
        wRole: role,
    });

    const response = NextResponse.json({
        ok: true,
        workspaceId,
        role,
        roleLevel: ROLE_HIERARCHY[role],
    });

    // Overwrite the access token cookie only; refresh token is unchanged
    response.cookies.set(getSessionCookieName(), newAccessJwt, getAccessCookieOptions());

    return response;
}
