import { apiSuccess, apiError } from '@/lib/api/response';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, withErrorHandler } from '@/lib/api/withAuth';
import { withRateLimit } from '@/lib/security/rateLimit';
import { z } from 'zod';

const submitExamSchema = z.object({
    examId: z.string(),
    answers: z.record(z.number()),
});

// POST /api/partners/exam/submit - Submit exam answers
export const POST = withErrorHandler(async (request: NextRequest) => {
    const rateLimitResponse = await withRateLimit(request, 'strict-api');
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
        include: { partnerProfile: true },
    });

    if (!dbUser || !dbUser.partnerProfile) {
        return apiError(404, 'Partner profile not found');
    }

    const body = await request.json();
    const validation = submitExamSchema.safeParse(body);
    if (!validation.success) {
        return apiError(400, 'Validation failed', validation.error.errors);
    }

    const { examId, answers } = validation.data;

    const exam = await prisma.partnerExam.findUnique({ where: { id: examId } });
    if (!exam) return apiError(404, 'Exam not found');
    if (exam.partnerId !== dbUser.partnerProfile.id) return apiError(403, 'Unauthorized');
    if (exam.status !== 'STARTED') return apiError(409, 'Exam already submitted');

    const timeElapsed = Date.now() - exam.startedAt.getTime();
    if (timeElapsed > exam.timeLimit * 60 * 1000) {
        return apiError(400, 'Exam time limit exceeded');
    }

    const questionIds = exam.questions as string[];
    const questions = await prisma.examQuestion.findMany({
        where: { id: { in: questionIds } },
    });

    let correctCount = 0;
    const results: { index: number; question: string; userAnswer: number; correctAnswer: number; isCorrect: boolean; explanation: string | null }[] = [];

    questions.forEach((question, index) => {
        const userAnswer = answers[index.toString()];
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) correctCount++;
        results.push({
            index, question: question.question, userAnswer,
            correctAnswer: question.correctAnswer, isCorrect,
            explanation: question.explanation,
        });
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= exam.passingScore;

    const updatedExam = await prisma.partnerExam.update({
        where: { id: examId },
        data: {
            answers: answers as any, // Prisma JSON field
            score,
            status: passed ? 'PASSED' : 'FAILED',
            completedAt: new Date(),
        },
    });

    let updatedPartner = dbUser.partnerProfile;
    if (passed) {
        const maxWorkspacesByLevel: Record<string, number> = {
            BRONZE: 10, SILVER: 50, GOLD: 200, PLATINUM: 1000,
        };
        const newMaxWorkspaces = maxWorkspacesByLevel[exam.level];

        updatedPartner = await prisma.partner.update({
            where: { id: dbUser.partnerProfile.id },
            data: {
                certificationLevel: exam.level,
                certifiedAt: new Date(),
                maxWorkspaces: newMaxWorkspaces,
                availableSlots: newMaxWorkspaces,
            },
        });
    }

    return apiSuccess({
        exam: updatedExam,
        results: { score, passed, correctCount, totalQuestions: questions.length, passingScore: exam.passingScore },
        partner: passed ? updatedPartner : undefined,
        breakdown: results,
    });
});
