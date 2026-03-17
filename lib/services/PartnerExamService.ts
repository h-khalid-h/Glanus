import { ApiError } from '@/lib/errors';
/**
 * PartnerExamService — Partner certification exam lifecycle.
 *
 * Responsibilities:
 *  - startExam: randomise 20 questions from the pool and create an exam record
 *  - submitExam: grade answers, update exam record, upgrade certification level on pass
 *  - getExamHistory: retrieve a partner's past exam records
 *
 * Note: partner CRUD/directory lives in PartnerService,
 * assignments in PartnerAssignmentService, earnings/Stripe in PartnerEarningsService.
 */
import { prisma } from '@/lib/db';

export class PartnerExamService {
    /**
     * Start a new certification exam for the given level.
     * Validates partner status, checks for active/duplicate exams, and
     * selects 20 randomised questions from the active question pool.
     */
    static async startExam(userEmail: string, level: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM') {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw new ApiError(404, 'Partner profile not found');
        }
        const partner = dbUser.partnerProfile;

        if (partner.status !== 'ACTIVE' && partner.status !== 'VERIFIED') {
            throw new ApiError(403, 'Partner must be verified or active to take exams');
        }

        const activeExam = await prisma.partnerExam.findFirst({ where: { partnerId: partner.id, status: 'STARTED' } });
        if (activeExam) {
            throw new ApiError(409, 'You already have an exam in progress');
        }

        const passedExam = await prisma.partnerExam.findFirst({ where: { partnerId: partner.id, level, status: 'PASSED' } });
        if (passedExam && partner.certificationLevel === level) {
            throw new ApiError(409, `You are already certified at ${level} level`);
        }

        const allQuestions = await prisma.examQuestion.findMany({ where: { level, isActive: true } });
        if (allQuestions.length < 20) {
            throw new ApiError(500, `Not enough questions for ${level} exam (need 20, have ${allQuestions.length})`);
        }

        const selectedQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, 20);
        const exam = await prisma.partnerExam.create({
            data: {
                partnerId: partner.id,
                level,
                status: 'STARTED',
                questions: selectedQuestions.map(q => q.id),
                answers: {},
                score: 0,
                passingScore: 80,
                timeLimit: 60,
            },
        });

        const questionsForExam = selectedQuestions.map((q, index) => ({
            index, question: q.question, options: q.options, category: q.category, difficulty: q.difficulty,
        }));

        return {
            exam: { id: exam.id, level: exam.level, timeLimit: exam.timeLimit, passingScore: exam.passingScore, startedAt: exam.startedAt, questionCount: selectedQuestions.length },
            questions: questionsForExam,
        };
    }

    /**
     * Grade submitted answers, update certification level on pass.
     * Enforces time limit and single-submission rules.
     */
    static async submitExam(userEmail: string, examId: string, answers: Record<string, number>) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw new ApiError(404, 'Partner profile not found');
        }

        const exam = await prisma.partnerExam.findUnique({ where: { id: examId } });
        if (!exam) throw new ApiError(404, 'Exam not found');
        if (exam.partnerId !== dbUser.partnerProfile.id) throw new ApiError(403, 'Unauthorized');
        if (exam.status !== 'STARTED') throw new ApiError(409, 'Exam already submitted');

        const timeElapsed = Date.now() - exam.startedAt.getTime();
        if (timeElapsed > exam.timeLimit * 60 * 1000) {
            throw new ApiError(400, 'Exam time limit exceeded');
        }

        const questionIds = exam.questions as string[];
        const questions = await prisma.examQuestion.findMany({ where: { id: { in: questionIds } } });

        let correctCount = 0;
        const results = questions.map((question, index) => {
            const userAnswer = answers[index.toString()];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctCount++;
            return { index, question: question.question, userAnswer, correctAnswer: question.correctAnswer, isCorrect, explanation: question.explanation };
        });

        const score = Math.round((correctCount / questions.length) * 100);
        const passed = score >= exam.passingScore;

        const updatedExam = await prisma.partnerExam.update({
            where: { id: examId },
            data: { answers: answers as object, score, status: passed ? 'PASSED' : 'FAILED', completedAt: new Date() },
        });

        let updatedPartner = dbUser.partnerProfile;
        if (passed) {
            const maxWorkspacesByLevel: Record<string, number> = { BRONZE: 10, SILVER: 50, GOLD: 200, PLATINUM: 1000 };
            const newMaxWorkspaces = maxWorkspacesByLevel[exam.level];
            updatedPartner = await prisma.partner.update({
                where: { id: dbUser.partnerProfile.id },
                data: { certificationLevel: exam.level, certifiedAt: new Date(), maxWorkspaces: newMaxWorkspaces, availableSlots: newMaxWorkspaces },
            });
        }

        return {
            exam: updatedExam,
            results: { score, passed, correctCount, totalQuestions: questions.length, passingScore: exam.passingScore },
            partner: passed ? updatedPartner : undefined,
            breakdown: results,
        };
    }

    /**
     * Retrieve a partner's full exam history, most recent first.
     */
    static async getExamHistory(userEmail: string) {
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            include: { partnerProfile: true },
        });
        if (!dbUser || !dbUser.partnerProfile) {
            throw new ApiError(404, 'Partner profile not found');
        }
        return prisma.partnerExam.findMany({
            where: { partnerId: dbUser.partnerProfile.id },
            orderBy: { startedAt: 'desc' },
        });
    }
}
