'use client';

import { useState } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import PlanSelector, { PlanType } from './workspace/PlanSelector';
import { CheckCircle2, ChevronRight, Layout, Palette, CreditCard } from 'lucide-react';
import { clsx } from 'clsx';
import { useSession } from 'next-auth/react';

const STEPS = [
    { id: 1, name: 'Basic Info', icon: Layout },
    { id: 2, name: 'Branding', icon: Palette },
    { id: 3, name: 'Select Plan', icon: CreditCard },
];

interface WorkspaceWizardProps {
    onComplete?: (workspaceId: string) => void;
    showSampleDataOption?: boolean;
}

export default function WorkspaceWizard({ onComplete, showSampleDataOption = false }: WorkspaceWizardProps = {}) {
    const router = useRouter();
    useSession();
    const { setCurrentWorkspace, fetchWorkspaces } = useWorkspaceStore();

    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createSampleData, setCreateSampleData] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        primaryColor: '#3B82F6',
        accentColor: '#10B981',
        plan: 'FREE' as PlanType,
    });

    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        setFormData({ ...formData, slug: value });
    };

    const handleNext = () => {
        if (currentStep === 1) {
            if (!formData.name || !formData.slug) {
                setError('Please fill in all required fields');
                return;
            }
            if (formData.slug.length < 3) {
                setError('Slug must be at least 3 characters');
                return;
            }
        }
        setError(null);
        setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    };

    const handleBack = () => {
        setError(null);
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await csrfFetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, createSampleData }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error?.message || 'Failed to create workspace');
            }

            // Update store
            await fetchWorkspaces();
            const newWorkspace = result.data?.workspace;
            setCurrentWorkspace(newWorkspace);

            // Call onComplete callback if provided (for onboarding)
            if (onComplete && newWorkspace) {
                onComplete(newWorkspace.id);
            } else if (newWorkspace) {
                // Default behavior: redirect to dashboard
                localStorage.setItem('currentWorkspaceId', newWorkspace.id);
                router.push(`/dashboard`);
                router.refresh();
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-card backdrop-blur-sm rounded-2xl shadow-xl border border-border overflow-hidden max-w-4xl w-full mx-auto">
            {/* Progress Header */}
            <div className="bg-muted/50 border-b border-border p-6">
                <div className="flex justify-between items-center max-w-2xl mx-auto">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;

                        return (
                            <div key={step.id} className="flex flex-col items-center relative z-10">
                                <div
                                    className={clsx(
                                        'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                                        isActive
                                            ? 'bg-primary text-foreground ring-4 ring-primary/20'
                                            : isCompleted
                                                ? 'bg-health-good text-foreground'
                                                : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                                </div>
                                <span
                                    className={clsx(
                                        'mt-2 text-xs font-medium uppercase tracking-wider',
                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                    )}
                                >
                                    {step.name}
                                </span>

                                {/* Connector Line */}
                                {index < STEPS.length - 1 && (
                                    <div className="absolute top-5 left-full w-full h-[2px] -translate-y-1/2 -z-10">
                                        <div className={clsx(
                                            "h-full w-[calc(100%_-_2.5rem)] ml-10 transition-colors duration-300",
                                            step.id < currentStep ? "bg-health-good" : "bg-muted"
                                        )} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-8 min-h-[400px]">
                {error && (
                    <div className="mb-6 bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-2 border border-destructive/20">
                        <span className="font-semibold">Error:</span> {error}
                    </div>
                )}

                {currentStep === 1 && (
                    <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-foreground">Let's build your workspace</h2>
                            <p className="text-muted-foreground mt-2">Give your new workspace a home.</p>
                        </div>

                        <Input
                            label="Workspace Name"
                            placeholder="e.g. Acme Corp"
                            value={formData.name}
                            onChange={(e) => {
                                setFormData({
                                    ...formData,
                                    name: e.target.value,
                                    // Auto-generate slug if slug hasn't been manually edited (simple heuristic)
                                    slug: !formData.slug || formData.slug === formData.name.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, e.target.value.length - 1)
                                        ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                        : formData.slug
                                });
                            }}
                            autoFocus
                        />

                        <div>
                            <Input
                                label="Workspace URL"
                                placeholder="acme-corp"
                                value={formData.slug}
                                onChange={handleSlugChange}
                                className="pl-[10.5rem]"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                                Your workspace will be accessible at <span className="font-mono bg-muted px-1 rounded">glanus.com/{formData.slug || 'your-slug'}</span>
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">
                                Description <span className="text-muted-foreground font-normal">(Optional)</span>
                            </label>
                            <textarea
                                className="w-full rounded-xl border border-border bg-card backdrop-blur-sm px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 min-h-[100px] resize-none"
                                placeholder="What is this workspace for?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-8 max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-foreground">Brand your workspace</h2>
                            <p className="text-muted-foreground mt-2">Choose colors that match your company identity.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Primary Color</label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-xl shadow-sm border border-border"
                                        style={{ backgroundColor: formData.primaryColor }}
                                    />
                                    <input
                                        type="color"
                                        value={formData.primaryColor}
                                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                        className="w-full h-10 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Accent Color</label>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-xl shadow-sm border border-border"
                                        style={{ backgroundColor: formData.accentColor }}
                                    />
                                    <input
                                        type="color"
                                        value={formData.accentColor}
                                        onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                                        className="w-full h-10 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/50 p-6 rounded-xl border border-border">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Preview</h3>
                            <div className="flex items-center gap-4">
                                <button type="button"
                                    className="px-4 py-2 rounded-xl text-foreground font-medium shadow-sm"
                                    style={{ backgroundColor: formData.primaryColor }}
                                >
                                    Primary Button
                                </button>
                                <button type="button"
                                    className="px-4 py-2 rounded-xl font-medium border border-border bg-muted/50"
                                    style={{ color: formData.primaryColor, borderColor: formData.primaryColor }}
                                >
                                    Secondary Button
                                </button>
                                <span style={{ color: formData.accentColor }} className="font-semibold">
                                    Accent Text
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-foreground">Select a Plan</h2>
                            <p className="text-muted-foreground mt-2">Start for free, upgrade as you grow.</p>
                        </div>

                        <PlanSelector
                            selectedPlan={formData.plan}
                            onChange={(plan) => setFormData({ ...formData, plan })}
                        />

                        {showSampleDataOption && (
                            <div className="max-w-md mx-auto mt-8 bg-primary/5 p-4 rounded-xl border border-primary/20">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={createSampleData}
                                        onChange={(e) => setCreateSampleData(e.target.checked)}
                                        className="mt-0.5 rounded border-primary/40 text-primary focus:ring-primary/50"
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-foreground">Create sample data</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            Add demo assets, locations, and alerts to help you get started
                                        </div>
                                    </div>
                                </label>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            <div className="bg-muted/50 px-8 py-5 border-t border-border flex justify-between items-center">
                <Button
                    variant="secondary"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isLoading}
                    className={currentStep === 1 ? 'invisible' : ''}
                >
                    Back
                </Button>

                {currentStep < 3 ? (
                    <Button onClick={handleNext} className="gap-2">
                        Next <ChevronRight className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        isLoading={isLoading}
                        className="gap-2 px-8 min-w-[140px]"
                    >
                        Create Workspace
                    </Button>
                )}
            </div>
        </div>
    );
}
