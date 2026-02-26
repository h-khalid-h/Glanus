'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';
import {
    CreditCard,
    Zap,
    HardDrive,
    Package,
    ArrowUpCircle,
    ExternalLink,
    CheckCircle2,
    AlertTriangle,
    XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

interface BillingData {
    plan: string;
    status: string;
    currentPeriodEnd?: string;
    usage: {
        assets: { current: number; limit: number };
        aiCredits: { current: number; limit: number };
        storage: { current: number; limit: number };
    };
}

/** Extended workspace type with subscription and counts from API */
interface WorkspaceWithSubscription {
    subscription?: {
        plan?: string;
        status?: string;
        maxAssets?: number;
        maxAICreditsPerMonth?: number;
        aiCreditsUsed?: number;
        maxStorageMB?: number;
        storageUsedMB?: number;
    };
    _count?: {
        assets?: number;
    };
}

const PLANS = [
    {
        id: 'FREE',
        name: 'Free',
        price: '$0',
        priceLabel: 'forever',
        features: ['5 assets', '100 AI credits/mo', '1 GB storage', '1 workspace member'],
        color: 'slate',
    },
    {
        id: 'PERSONAL',
        name: 'Personal',
        price: '$9',
        priceLabel: '/month',
        features: ['50 assets', '1,000 AI credits/mo', '10 GB storage', '5 workspace members'],
        color: 'blue',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PERSONAL,
    },
    {
        id: 'TEAM',
        name: 'Team',
        price: '$29',
        priceLabel: '/month',
        features: ['200 assets', '5,000 AI credits/mo', '50 GB storage', 'Unlimited members'],
        color: 'purple',
        popular: true,
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM,
    },
    {
        id: 'ENTERPRISE',
        name: 'Enterprise',
        price: 'Custom',
        priceLabel: '',
        features: ['Unlimited assets', 'Unlimited AI credits', 'Unlimited storage', 'Custom SLA'],
        color: 'amber',
    },
];

export default function BillingPage() {
    const { error: showError } = useToast();
    const params = useParams();
    const searchParams = useSearchParams();
    const workspaceId = params.id as string;
    const { currentWorkspace } = useWorkspaceStore();

    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Check for status from Stripe redirect
    useEffect(() => {
        const status = searchParams.get('status');
        if (status === 'success') {
            setNotification({ type: 'success', message: 'Payment successful! Your plan has been upgraded.' });
        } else if (status === 'canceled') {
            setNotification({ type: 'error', message: 'Payment was canceled. No changes were made.' });
        }
    }, [searchParams]);

    const ws = currentWorkspace as unknown as WorkspaceWithSubscription | null;
    const currentPlan = ws?.subscription?.plan || 'FREE';
    const subscriptionStatus = ws?.subscription?.status || 'ACTIVE';

    const handleUpgrade = async (priceId: string) => {
        setIsLoading(true);
        try {
            const response = await csrfFetch(`/api/workspaces/${workspaceId}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create checkout');
            }

            // Redirect to Stripe Checkout
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error: unknown) {
            showError('Checkout failed:', error instanceof Error ? error.message : 'An unexpected error occurred');
            setNotification({ type: 'error', message: 'Failed to start checkout. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setIsLoading(true);
        try {
            const response = await csrfFetch(`/api/workspaces/${workspaceId}/customer-portal`, {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to open billing portal');
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error: unknown) {
            showError('Portal failed:', error instanceof Error ? error.message : 'An unexpected error occurred');
            setNotification({ type: 'error', message: 'Failed to open billing portal.' });
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = () => {
        switch (subscriptionStatus) {
            case 'ACTIVE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-health-good/15/30 text-health-good">
                        <CheckCircle2 className="w-4 h-4" /> Active
                    </span>
                );
            case 'PAST_DUE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-health-warn/10 text-health-warn">
                        <AlertTriangle className="w-4 h-4" /> Past Due
                    </span>
                );
            case 'CANCELED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-health-critical/10 text-health-critical">
                        <XCircle className="w-4 h-4" /> Canceled
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Billing</h1>
                    <p className="text-slate-600">Manage your subscription and payment methods</p>
                </div>
                {currentPlan !== 'FREE' && (
                    <Button onClick={handleManageBilling} variant="secondary" disabled={isLoading}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage Billing
                    </Button>
                )}
            </div>

            {/* Notification Banner */}
            {notification && (
                <div className={clsx(
                    'p-4 rounded-lg border flex items-center gap-3',
                    notification.type === 'success'
                        ? 'bg-health-good/10 border-health-good/20 text-health-good'
                        : 'bg-health-critical/10 border-health-critical/20 text-health-critical'
                )}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {notification.message}
                    <button
                        onClick={() => setNotification(null)}
                        className="ml-auto text-sm opacity-70 hover:opacity-100"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Current Plan */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-nerve/5 flex items-center justify-center text-nerve">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                {PLANS.find(p => p.id === currentPlan)?.name || 'Free'} Plan
                            </h2>
                            <p className="text-sm text-slate-500">
                                {PLANS.find(p => p.id === currentPlan)?.price}
                                {PLANS.find(p => p.id === currentPlan)?.priceLabel}
                            </p>
                        </div>
                    </div>
                    {getStatusBadge()}
                </div>

                {/* Usage Meters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <UsageMeter
                        icon={Package}
                        label="Assets"
                        current={ws?._count?.assets || 0}
                        limit={ws?.subscription?.maxAssets || 5}
                    />
                    <UsageMeter
                        icon={Zap}
                        label="AI Credits"
                        current={ws?.subscription?.aiCreditsUsed || 0}
                        limit={ws?.subscription?.maxAICreditsPerMonth || 100}
                    />
                    <UsageMeter
                        icon={HardDrive}
                        label="Storage"
                        current={ws?.subscription?.storageUsedMB || 0}
                        limit={ws?.subscription?.maxStorageMB || 1024}
                        unit="MB"
                    />
                </div>
            </div>

            {/* Plans Comparison */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-6">Available Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {PLANS.map((plan) => {
                        const isCurrent = plan.id === currentPlan;
                        const isDowngrade = PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === currentPlan);

                        return (
                            <div
                                key={plan.id}
                                className={clsx(
                                    'rounded-xl p-6 border-2 transition-all relative',
                                    plan.popular
                                        ? 'border-purple-500 shadow-lg shadow-purple-100'
                                        : isCurrent
                                            ? 'border-nerve'
                                            : 'border-slate-200 hover:border-slate-300',
                                    'bg-slate-900/50 backdrop-blur-sm'
                                )}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-purple-500 text-white text-xs font-semibold rounded-full">
                                        Most Popular
                                    </div>
                                )}

                                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                                <div className="mt-2 mb-4">
                                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                                    <span className="text-slate-500 text-sm">{plan.priceLabel}</span>
                                </div>

                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {isCurrent ? (
                                    <Button variant="secondary" className="w-full" disabled>
                                        Current Plan
                                    </Button>
                                ) : plan.id === 'ENTERPRISE' ? (
                                    <Button variant="secondary" className="w-full">
                                        Contact Sales
                                    </Button>
                                ) : plan.id === 'FREE' ? (
                                    <Button variant="secondary" className="w-full" disabled={isDowngrade}>
                                        {isDowngrade ? 'Downgrade' : 'Free'}
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full gap-2"
                                        onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                                        disabled={isLoading || !plan.priceId || isDowngrade}
                                    >
                                        <ArrowUpCircle className="w-4 h-4" />
                                        {isDowngrade ? 'Downgrade' : 'Upgrade'}
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function UsageMeter({
    icon: Icon,
    label,
    current,
    limit,
    unit,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    current: number;
    limit: number;
    unit?: string;
}) {
    const percentage = limit > 0 ? Math.min(Math.round((current / limit) * 100), 100) : 0;
    const isNearLimit = percentage >= 80;
    const isOverLimit = percentage >= 100;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Icon className="w-4 h-4" />
                    {label}
                </div>
                <span className={clsx(
                    'text-sm font-medium',
                    isOverLimit ? 'text-health-critical' : isNearLimit ? 'text-yellow-600' : 'text-slate-600'
                )}>
                    {current.toLocaleString()}{unit ? ` ${unit}` : ''} / {limit.toLocaleString()}{unit ? ` ${unit}` : ''}
                </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        isOverLimit ? 'bg-health-critical' : isNearLimit ? 'bg-health-warn' : 'bg-nerve/50'
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className="text-xs text-slate-500">{percentage}% used</p>
        </div>
    );
}
