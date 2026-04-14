'use client';
import { ErrorState } from '@/components/ui/EmptyState';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast';

interface Question {
    index: number;
    question: string;
    options: string[];
    category: string;
    difficulty: number;
}

interface Exam {
    id: string;
    level: string;
    timeLimit: number;
    passingScore: number;
    startedAt: string;
    questionCount: number;
}

interface BreakdownItem {
    question: string;
    isCorrect: boolean;
    userAnswer: number;
    correctAnswer: number;
    explanation?: string;
}

interface ExamResult {
    results: {
        passed: boolean;
        score: number;
        passingScore: number;
        correctCount: number;
        totalQuestions: number;
    };
    partner?: {
        certificationLevel: string;
        maxWorkspaces: number;
    };
    breakdown?: BreakdownItem[];
}

export default function CertificationCenterPage() {
    const { error: showError } = useToast();
    const router = useRouter();
    const [view, setView] = useState<'select' | 'exam' | 'results'>('select');
    const [error, setError] = useState<string | null>(null);

    // Exam state
    const [exam, setExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const answersRef = useRef(answers);
    answersRef.current = answers;
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    // Results state
    const [result, setResult] = useState<ExamResult | null>(null);

    // Timer — uses answersRef to avoid stale closure when auto-submitting
    useEffect(() => {
        if (exam && timeRemaining > 0) {
            const timer = setInterval(() => {
                setTimeRemaining((t) => {
                    if (t <= 1) {
                        // Time's up - auto-submit with latest answers via ref
                        (async () => {
                            try {
                                const res = await csrfFetch('/api/partners/exam/submit', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ examId: exam.id, answers: answersRef.current }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error);
                                setResult(data);
                                setView('results');
                            } catch (err: unknown) {
                                showError('Error', err instanceof Error ? err.message : 'Auto-submit failed');
                            }
                        })();
                        return 0;
                    }
                    return t - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [exam, timeRemaining, showError]);

    const startExam = async (level: string) => {
        try {
            const res = await csrfFetch('/api/partners/exam/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setExam(data.exam);
            setQuestions(data.questions);
            setTimeRemaining(data.exam.timeLimit * 60); // Convert minutes to seconds
            setView('exam');
        } catch (err: unknown) {
            showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const handleSubmit = async () => {
        if (!exam) return;

        setSubmitting(true);

        try {
            const res = await csrfFetch('/api/partners/exam/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    examId: exam.id,
                    answers,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setResult(data);
            setView('results');
        } catch (err: unknown) {
            showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Error guard
    if (error) return <ErrorState title="Certification error" description={error} onRetry={() => { setError(null); setView('select'); }} />;

    // Select Level View
    if (view === 'select') {
        const levels = [
            {
                name: 'BRONZE',
                color: 'from-orange-600 to-amber-700',
                capacity: 10,
                description: 'Entry level certification for new partners',
            },
            {
                name: 'SILVER',
                color: 'from-gray-400 to-gray-600',
                capacity: 50,
                description: 'Intermediate certification for experienced partners',
            },
            {
                name: 'GOLD',
                color: 'from-yellow-400 to-yellow-600',
                capacity: 200,
                description: 'Advanced certification for expert partners',
            },
            {
                name: 'PLATINUM',
                color: 'from-purple-400 to-purple-600',
                capacity: 1000,
                description: 'Elite certification for top-tier partners',
            },
        ];

        return (
            <div className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold text-foreground mb-4">Certification Center</h1>
                        <p className="text-lg text-muted-foreground">
                            Advance your certification level to unlock higher capacity and better matching
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {levels.map((level) => (
                            <div
                                key={level.name}
                                className="rounded-xl border border-border bg-card backdrop-blur-sm overflow-hidden hover:shadow-xl transition"
                            >
                                <div className={`bg-gradient-to-r ${level.color} p-6 text-foreground`}>
                                    <h2 className="text-3xl font-bold mb-2">{level.name}</h2>
                                    <p className="text-sm opacity-90">{level.description}</p>
                                </div>
                                <div className="p-6">
                                    <div className="mb-4">
                                        <p className="text-sm text-muted-foreground mb-1">Workspace Capacity</p>
                                        <p className="text-2xl font-bold text-foreground">{level.capacity} workspaces</p>
                                    </div>
                                    <div className="mb-6 text-sm text-muted-foreground space-y-1">
                                        <p>✓ 20 questions</p>
                                        <p>✓ 60 minutes</p>
                                        <p>✓ 80% to pass</p>
                                    </div>
                                    <button type="button"
                                        onClick={() => startExam(level.name)}
                                        className="w-full bg-primary text-foreground py-3 rounded-md font-semibold hover:brightness-110 transition"
                                    >
                                        Start {level.name} Exam
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Exam View
    if (view === 'exam' && exam && questions.length > 0) {
        const answeredCount = Object.keys(answers).length;
        const progress = (answeredCount / questions.length) * 100;

        return (
            <div className="py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="rounded-xl border border-border bg-card backdrop-blur-sm p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">{exam.level} Certification Exam</h1>
                                <p className="text-sm text-muted-foreground">
                                    {answeredCount} / {questions.length} answered
                                </p>
                            </div>
                            <div className={`text-3xl font-bold ${timeRemaining < 300 ? 'text-destructive' : 'text-foreground'}`}>
                                {formatTime(timeRemaining)}
                            </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                            <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Questions */}
                    <div className="space-y-6">
                        {questions.map((question) => (
                            <div key={question.index} className="rounded-xl border border-border bg-card backdrop-blur-sm p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {question.index + 1}. {question.question}
                                    </h3>
                                    <span className="text-xs bg-muted/50 px-2 py-1 rounded">
                                        {question.category}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {question.options.map((option, optionIndex) => (
                                        <label
                                            key={optionIndex}
                                            className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition ${answers[question.index.toString()] === optionIndex
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-border'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`question-${question.index}`}
                                                checked={answers[question.index.toString()] === optionIndex}
                                                onChange={() =>
                                                    setAnswers({ ...answers, [question.index.toString()]: optionIndex })
                                                }
                                                className="w-4 h-4 text-primary mr-3"
                                            />
                                            <span className="text-foreground">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Submit Button */}
                    <div className="mt-8 rounded-xl border border-border bg-card backdrop-blur-sm p-6">
                        <button type="button"
                            onClick={handleSubmit}
                            disabled={answeredCount < questions.length || submitting}
                            className="w-full bg-health-good text-foreground py-4 rounded-md font-semibold hover:bg-health-good/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : `Submit Exam (${answeredCount}/${questions.length})`}
                        </button>
                        {answeredCount < questions.length && (
                            <p className="mt-2 text-sm text-destructive text-center">
                                Please answer all questions before submitting
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Results View
    if (view === 'results' && result) {
        const passed = result.results.passed;

        return (
            <div className="py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    <div className={`rounded-xl border border-border bg-card backdrop-blur-sm p-8 text-center mb-8 ${passed ? 'border-t-8 border-health-good' : 'border-t-8 border-destructive'
                        }`}>
                        <div className="mb-6">
                            {passed ? (
                                <div className="text-6xl mb-4">🎉</div>
                            ) : (
                                <div className="text-6xl mb-4">😔</div>
                            )}
                            <h1 className={`text-4xl font-bold mb-2 ${passed ? 'text-health-good' : 'text-destructive'
                                }`}>
                                {passed ? 'Congratulations!' : 'Not Quite'}
                            </h1>
                            <p className="text-xl text-foreground">
                                {passed
                                    ? `You passed the ${exam?.level} exam!`
                                    : `You scored ${result.results.score}% (need ${result.results.passingScore}%)`}
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mb-8">
                            <div>
                                <p className="text-3xl font-bold text-foreground">{result.results.score}%</p>
                                <p className="text-sm text-muted-foreground">Your Score</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">
                                    {result.results.correctCount} / {result.results.totalQuestions}
                                </p>
                                <p className="text-sm text-muted-foreground">Correct Answers</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">{result.results.passingScore}%</p>
                                <p className="text-sm text-muted-foreground">Passing Score</p>
                            </div>
                        </div>

                        {passed && result.partner && (
                            <div className="bg-health-good/10 border border-health-good/20 rounded-xl p-4 mb-6">
                                <p className="text-health-good font-semibold mb-2">Certification Upgraded!</p>
                                <p className="text-health-good">
                                    You're now a <strong>{result.partner.certificationLevel}</strong> partner with
                                    capacity for <strong>{result.partner.maxWorkspaces}</strong> workspaces!
                                </p>
                            </div>
                        )}

                        <div className="flex space-x-4 justify-center">
                            <button type="button"
                                onClick={() => router.push('/partners/dashboard')}
                                className="px-6 py-3 bg-primary text-foreground rounded-md font-semibold hover:brightness-110 transition"
                            >
                                Go to Dashboard
                            </button>
                            {!passed && (
                                <button type="button"
                                    onClick={() => {
                                        setView('select');
                                        setAnswers({});
                                        setExam(null);
                                        setQuestions([]);
                                        setResult(null);
                                    }}
                                    className="px-6 py-3 border border-border rounded-md font-semibold hover:bg-muted/30 transition"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Detailed Results */}
                    {result.breakdown && (
                        <div className="rounded-xl border border-border bg-card backdrop-blur-sm p-6">
                            <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
                            <div className="space-y-4">
                                {result.breakdown.map((item: BreakdownItem, index: number) => (
                                    <div
                                        key={index}
                                        className={`border-l-4 p-4 ${item.isCorrect ? 'border-health-good bg-health-good/10' : 'border-destructive bg-destructive/10'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="font-medium text-foreground">{item.question}</p>
                                            <span className={`text-sm font-semibold ${item.isCorrect ? 'text-health-good' : 'text-destructive'
                                                }`}>
                                                {item.isCorrect ? '✓' : '✗'}
                                            </span>
                                        </div>
                                        {!item.isCorrect && (
                                            <div className="text-sm space-y-1">
                                                <p className="text-destructive">Your answer: Option {item.userAnswer + 1}</p>
                                                <p className="text-health-good">Correct answer: Option {item.correctAnswer + 1}</p>
                                            </div>
                                        )}
                                        {item.explanation && (
                                            <p className="mt-2 text-sm text-muted-foreground italic">{item.explanation}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Fallback for edge cases (e.g., exam view with no questions loaded)
    return <ErrorState title="Something went wrong" description="Please try reloading the page." onRetry={() => { setView('select'); setExam(null); setQuestions([]); }} />;
}
