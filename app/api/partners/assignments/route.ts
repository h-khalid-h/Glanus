import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerAssignmentService } from '@/lib/services/PartnerAssignmentService';

// GET /api/partners/assignments
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    try {
        const assignments = await PartnerAssignmentService.getAssignments(user.email!);
        return apiSuccess({ assignments });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
