import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, requireWorkspaceRole, withErrorHandler } from '@/lib/api/withAuth';
import { WorkspacePartnerService } from '@/lib/services/WorkspacePartnerService';
import { z } from 'zod';

const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    review: z.string().min(20, 'Review must be at least 20 characters').max(1000),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/workspaces/[id]/partner/review - Rate and review partner
export const POST = withErrorHandler(async (request: NextRequest, { params }: RouteContext) => {
    const { id: workspaceId } = await params;
    const user = await requireAuth();
    await requireWorkspaceRole(workspaceId, user.id, 'ADMIN');

    const body = await request.json();
    const validation = reviewSchema.safeParse(body);
    if (!validation.success) return apiError(400, 'Validation failed', validation.error.errors);

    const result = await WorkspacePartnerService.reviewPartner(workspaceId, validation.data);
    return apiSuccess(result);
});
