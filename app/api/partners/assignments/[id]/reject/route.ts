import { apiSuccess } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { requireAuth, withErrorHandler, runWithUserRLS } from '@/lib/api/withAuth';
import { PartnerAssignmentService } from '@/lib/services/PartnerAssignmentService';

// POST /api/partners/assignments/[id]/reject
export const POST = withErrorHandler(async (
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    const { id } = await context.params;
    const user = await requireAuth();
    return runWithUserRLS(user, async () => {
        const assignment = await PartnerAssignmentService.rejectAssignment(user.email!, id);
        return apiSuccess({ assignment, message: 'Assignment rejected' });
    });
});
