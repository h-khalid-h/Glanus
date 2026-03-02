'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface MetricCardProps {
    title: string;
    value: number | string;
    change?: number;
    changePercent?: number;
    suffix?: string;
    icon?: React.ComponentType<{ className?: string }>;
    format?: 'number' | 'bytes' | 'percent';
}

export default function MetricCard({
    title,
    value,
    change,
    changePercent,
    suffix = '',
    icon: Icon,
    format = 'number',
}: MetricCardProps) {
    const formatValue = (val: number | string) => {
        if (typeof val === 'string') return val;

        switch (format) {
            case 'bytes':
                if (val < 1024) return `${val} MB`;
                return `${(val / 1024).toFixed(1)} GB`;
            case 'percent':
                return `${val}%`;
            default:
                return val.toLocaleString();
        }
    };

    const getTrendIcon = () => {
        if (!change) return <Minus className="w-4 h-4" />;
        if (change > 0) return <TrendingUp className="w-4 h-4" />;
        return <TrendingDown className="w-4 h-4" />;
    };

    const getTrendColor = () => {
        if (!change || change === 0) return 'text-slate-500';
        return change > 0 ? 'text-health-good' : 'text-health-critical';
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    {title}
                </h3>
                {Icon && (
                    <div className="w-10 h-10 rounded-lg bg-nerve/10 flex items-center justify-center text-nerve">
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                    {formatValue(value)}
                </span>
                {suffix && (
                    <span className="text-lg text-slate-500">
                        {suffix}
                    </span>
                )}
            </div>

            {(change !== undefined || changePercent !== undefined) && (
                <div className={clsx('flex items-center gap-1.5 mt-3 text-sm font-medium', getTrendColor())}>
                    {getTrendIcon()}
                    <span>
                        {change !== undefined && (
                            <>
                                {change > 0 ? '+' : ''}
                                {change}
                            </>
                        )}
                        {changePercent !== undefined && change !== undefined && ' '}
                        {changePercent !== undefined && (
                            <>
                                ({changePercent > 0 ? '+' : ''}
                                {changePercent}%)
                            </>
                        )}
                    </span>
                    <span className="text-slate-500 font-normal">vs last month</span>
                </div>
            )}
        </div>
    );
}
