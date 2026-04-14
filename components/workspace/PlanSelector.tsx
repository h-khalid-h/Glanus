import { CheckIcon } from 'lucide-react';
import { clsx } from 'clsx';

export type PlanType = 'FREE' | 'PERSONAL' | 'TEAM' | 'ENTERPRISE';

interface Plan {
    id: PlanType;
    name: string;
    price: string;
    features: string[];
    recommended?: boolean;
}

const PLANS: Plan[] = [
    {
        id: 'FREE',
        name: 'Free',
        price: '$0',
        features: [
            '5 Assets',
            '100 AI Credits/mo',
            '1 GB Storage',
            'Community Support',
        ],
    },
    {
        id: 'PERSONAL',
        name: 'Personal',
        price: '$9',
        features: [
            '50 Assets',
            '1,000 AI Credits/mo',
            '10 GB Storage',
            'Email Support',
            'Remote Desktop',
        ],
        recommended: true,
    },
    {
        id: 'TEAM',
        name: 'Team',
        price: '$29',
        features: [
            '200 Assets',
            '5,000 AI Credits/mo',
            '50 GB Storage',
            'Priority Support',
            'Team Collaboration',
            'API Access',
        ],
    },
    {
        id: 'ENTERPRISE',
        name: 'Enterprise',
        price: 'Custom',
        features: [
            'Unlimited Assets',
            'Unlimited AI Credits',
            'Unlimited Storage',
            '24/7 Phone Support',
            'SSO Integration',
            'Dedicated Account Manager',
        ],
    },
];

interface PlanSelectorProps {
    selectedPlan: PlanType;
    onChange: (plan: PlanType) => void;
}

export default function PlanSelector({ selectedPlan, onChange }: PlanSelectorProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
                <div
                    key={plan.id}
                    className={clsx(
                        'relative rounded-xl border p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md',
                        selectedPlan === plan.id
                            ? 'border-blue-600 ring-2 ring-blue-600 bg-nerve/10'
                            : 'border-slate-700 hover:border-nerve/50'
                    )}
                    onClick={() => onChange(plan.id)}
                >
                    {plan.recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-nerve text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                            Recommended
                        </div>
                    )}

                    <div className="flex flex-col h-full">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-foreground">
                                    {plan.price}
                                </span>
                                {plan.price !== 'Custom' && (
                                    <span className="text-slate-500">/mo</span>
                                )}
                            </div>
                        </div>

                        <ul className="space-y-3 mb-6 flex-1">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-sm text-slate-400">
                                    <CheckIcon className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <div
                            className={clsx(
                                'w-full py-2 px-4 rounded-lg text-sm font-medium text-center transition-colors',
                                selectedPlan === plan.id
                                    ? 'bg-nerve text-white'
                                    : 'bg-slate-800 text-white group-hover:bg-slate-700'
                            )}
                        >
                            {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
