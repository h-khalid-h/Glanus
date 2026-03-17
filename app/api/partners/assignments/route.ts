import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerAssignmentService } from '@/lib/services/PartnerAssignmentService';

// GET /api/partners/assignments
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    const assignments = await PartnerAssignmentService.getAssignments(user.email!);
    return apiSuccess({ assignments });
});
