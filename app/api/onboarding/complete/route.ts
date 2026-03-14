import { apiSuccess } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { AccountService } from '@/lib/services/AccountService';

// POST /api/onboarding/complete - Mark user's onboarding as complete
export const POST = withErrorHandler(async () => {
    const user = await requireAuth();
    const result = await AccountService.completeOnboarding(user.id);
    return apiSuccess(result);
});
