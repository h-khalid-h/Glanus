import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { PartnerAssignmentService } from '@/lib/services/PartnerAssignmentService';

// POST /api/partners/assignments/[id]/reject
export const POST = withErrorHandler(async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const rateLimited = await withRateLimit(request, 'strict-api');
    if (rateLimited) return rateLimited;
    const { id } = await context.params;
    const user = await requireAuth();
    return runWithUserRLS(user, async () => {
        const assignment = await PartnerAssignmentService.rejectAssignment(user.email!, id);
        return apiSuccess({ assignment, message: 'Assignment rejected' });
    });
});
