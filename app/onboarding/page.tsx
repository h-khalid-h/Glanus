'use client';
import { useToast } from '@/lib/toast';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Sparkles, Users, BarChart3, ArrowRight } from 'lucide-react';
import WorkspaceWizard from '@/components/WorkspaceWizard';
import { useWorkspace } from '@/lib/workspace/context';

type OnboardingStep = 'welcome' | 'create-workspace' | 'complete';

export default function OnboardingPage() {
    const { error: showError } = useToast();
    const router = useRouter();
    useSession();
    const { refetchWorkspaces } = useWorkspace();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
    const [_isLoading, setIsLoading] = useState(false);

    const handleCompleteOnboarding = async (workspaceId?: string) => {
        setIsLoading(true);
        try {
            await csrfFetch('/api/onboarding/complete', { method: 'POST' });
            if (workspaceId) {
                localStorage.setItem('currentWorkspaceId', workspaceId);
            }
            // Refresh the workspace context so the dashboard sees the newly
            // created workspace immediately (otherwise the provider holds an
            // empty list and the dashboard renders "No workspace selected"
            // until the user reloads the page).
            try {
                await refetchWorkspaces();
            } catch {
                // Non-fatal — the provider will retry on next mount/reload.
            }
            router.push('/dashboard');
        } catch (error: unknown) {
            showError('Failed to complete onboarding:', error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = () => {
        handleCompleteOnboarding();
    };

    if (currentStep === 'welcome') {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-grid opacity-10" />

                {/* Ambient glows */}
                <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full opacity-5 blur-3xl bg-primary" />
                <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full opacity-4 blur-3xl bg-cortex" />

                <div className="relative z-10 max-w-3xl w-full">
                    <div className="text-center mb-12 animate-fade-in">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-6">
                            <Sparkles className="w-10 h-10" />
                        </div>
                        <h1 className="text-4xl font-extrabold text-foreground mb-4">
                            Welcome to <span className="text-gradient">Glanus</span>
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Let&apos;s get you set up in just a few minutes
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-12">
                        <FeatureCard
                            icon={Users}
                            title="Team Collaboration"
                            description="Invite teammates and manage workspace access with role-based permissions"
                            color="nerve"
                        />
                        <FeatureCard
                            icon={BarChart3}
                            title="Asset Tracking"
                            description="Monitor and manage all your assets with real-time insights and analytics"
                            color="cortex"
                        />
                        <FeatureCard
                            icon={CheckCircle2}
                            title="RMM & Alerts"
                            description="Deploy agents and get instant alerts for system health and performance"
                            color="oracle"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up">
                        <button type="button"
                            onClick={() => setCurrentStep('create-workspace')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground
                                       transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.97]"
                        >
                            Get Started
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button type="button"
                            onClick={handleSkip}
                            className="rounded-xl border border-border px-8 py-3 text-sm font-medium text-muted-foreground
                                       transition-all hover:border-primary/30 hover:text-foreground hover:bg-accent"
                        >
                            Skip for Now
                        </button>
                    </div>

                    <p className="text-center text-xs text-muted-foreground/60 mt-8">
                        You can always configure these settings later in your dashboard
                    </p>
                </div>
            </div>
        );
    }

    if (currentStep === 'create-workspace') {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden py-12 px-4">
                <div className="absolute inset-0 bg-grid opacity-8" />
                <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Create Your First Workspace
                        </h2>
                        <p className="text-muted-foreground">
                            Workspaces help you organize assets, team members, and settings
                        </p>
                    </div>

                    <WorkspaceWizard
                        onComplete={(workspaceId) => handleCompleteOnboarding(workspaceId)}
                        showSampleDataOption={true}
                    />

                    <div className="mt-6 text-center">
                        <button type="button"
                            onClick={handleSkip}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Skip and create workspace later
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Fallback while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                <p className="text-muted-foreground">Redirecting...</p>
            </div>
        </div>
    );
}

function FeatureCard({
    icon: Icon,
    title,
    description,
    color,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        nerve: 'bg-nerve/10 text-nerve border-nerve/20',
        cortex: 'bg-cortex/10 text-cortex border-cortex/20',
        oracle: 'bg-oracle/10 text-oracle border-oracle/20',
    };

    return (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6
                        transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg animate-fade-in">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-4 ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
    );
}
