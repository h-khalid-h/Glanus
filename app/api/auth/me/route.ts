/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile, workspace memberships,
 * and email verification status. Used by the frontend AuthProvider for
 * SSR-safe hydration.
 */

import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { prisma } from '@/lib/db';

export const GET = withErrorHandler(async (_request: NextRequest) => {
    const user = await requireAuth();

    const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isStaff: true,
            emailVerified: true,
            onboardingCompleted: true,
            createdAt: true,
            workspaceMemberships: {
                select: {
                    id: true,
                    role: true,
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            logo: true,
                        },
                    },
                },
            },
            ownedWorkspaces: {
                where: { deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logo: true,
                },
            },
        },
    });

    if (!profile) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    return apiSuccess({
        user: {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            isStaff: profile.isStaff,
            emailVerified: profile.emailVerified,
            onboardingCompleted: profile.onboardingCompleted,
            createdAt: profile.createdAt,
        },
        workspaces: [
            ...profile.ownedWorkspaces.map((w) => ({ ...w, role: 'OWNER' as const })),
            ...profile.workspaceMemberships.map((m) => ({
                id: m.workspace.id,
                name: m.workspace.name,
                slug: m.workspace.slug,
                logo: m.workspace.logo,
                role: m.role,
            })),
        ],
    });
});
