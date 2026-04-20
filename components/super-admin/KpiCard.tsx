'use client';

import { ReactNode } from 'react';

interface KpiCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: ReactNode;
    trend?: { value: number; label: string };
    accent?: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'cyan';
    loading?: boolean;
}

const accentMap = {
    emerald: {
        icon: 'bg-emerald-500/10 text-emerald-400',
        glow: 'hover:shadow-emerald-500/10',
        badge: 'text-emerald-400 bg-emerald-500/10',
        border: 'hover:border-emerald-500/20',
    },
    blue: {
        icon: 'bg-cortex/10 text-cortex',
        glow: 'hover:shadow-blue-500/10',
        badge: 'text-cortex bg-cortex/10',
        border: 'hover:border-cortex/20',
    },
    violet: {
        icon: 'bg-cortex/10 text-cortex',
        glow: 'hover:shadow-cortex/10',
        badge: 'text-cortex bg-cortex/10',
        border: 'hover:border-cortex/20',
    },
    amber: {
        icon: 'bg-amber-500/10 text-warning',
        glow: 'hover:shadow-amber-500/10',
        badge: 'text-warning bg-amber-500/10',
        border: 'hover:border-amber-500/20',
    },
    rose: {
        icon: 'bg-destructive/10 text-destructive',
        glow: 'hover:shadow-destructive/10',
        badge: 'text-destructive bg-destructive/10',
        border: 'hover:border-destructive/20',
    },
    cyan: {
        icon: 'bg-cortex/10 text-cortex',
        glow: 'hover:shadow-cortex/10',
        badge: 'text-cortex bg-cortex/10',
        border: 'hover:border-cortex/20',
    },
};

export function KpiCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    accent = 'blue',
    loading = false,
}: KpiCardProps) {
    const colors = accentMap[accent];

    if (loading) {
        return (
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 backdrop-blur-sm animate-pulse">
                <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-xl bg-muted" />
                    <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
                <div className="mt-4 space-y-2">
                    <div className="h-8 w-24 rounded-lg bg-muted" />
                    <div className="h-4 w-32 rounded bg-muted" />
                </div>
            </div>
        );
    }

    return (
        <div
            className={[
                'group relative overflow-hidden rounded-2xl border border-border/60 bg-card',
                'p-5 backdrop-blur-sm transition-all duration-300',
                'hover:shadow-lg hover:-translate-y-0.5',
                colors.glow,
                colors.border,
            ].join(' ')}
        >
            {/* Subtle gradient shimmer */}
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(ellipse at top left, rgba(255,255,255,0.03), transparent 70%)' }}
            />

            <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.icon}`}>
                    {icon}
                </div>
                {trend && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
                    </span>
                )}
            </div>

            <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-foreground">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{title}</p>
                {subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground/60">{subtitle}</p>
                )}
            </div>
        </div>
    );
}
