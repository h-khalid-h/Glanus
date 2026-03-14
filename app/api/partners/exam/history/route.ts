import { apiSuccess, apiError } from '@/lib/api/response';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { PartnerExamService } from '@/lib/services/PartnerExamService';

// GET /api/partners/exam/history
export const GET = withErrorHandler(async () => {
    const user = await requireAuth();
    try {
        const exams = await PartnerExamService.getExamHistory(user.email!);

        type ExamSummary = (typeof exams)[number];
        const byLevel = exams.reduce((acc: Record<string, ExamSummary[]>, exam: ExamSummary) => {
            if (!acc[exam.level]) acc[exam.level] = [];
            acc[exam.level].push(exam);
            return acc;
        }, {});

        return apiSuccess({
            exams,
            byLevel,
            summary: {
                totalAttempts: exams.length,
                passed: exams.filter((e: ExamSummary) => e.status === 'PASSED').length,
                failed: exams.filter((e: ExamSummary) => e.status === 'FAILED').length,
                inProgress: exams.filter((e: ExamSummary) => e.status === 'STARTED').length,
            },
        });
    } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        return apiError(e.statusCode || 500, e.message || 'Error');
    }
});
