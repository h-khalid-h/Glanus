'use client';

/**
 * Reusable Loading Skeleton Components
 * 
 * Provides shimmer-animated placeholders while content is loading.
 * Prevents layout shift and provides a premium loading experience.
 */

import React from 'react';

// Base skeleton with shimmer animation
function SkeletonBase({ className = '' }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-lg bg-muted ${className}`}
        />
    );
}

// Text line skeleton
export function SkeletonText({
    lines = 1,
    className = '',
    widths,
}: {
    lines?: number;
    className?: string;
    widths?: string[];
}) {
    return (
        <div className={`space-y-2.5 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonBase
                    key={i}
                    className={`h-4 ${widths?.[i] || (i === lines - 1 ? 'w-3/4' : 'w-full')}`}
                />
            ))}
        </div>
    );
}

// Card skeleton (for dashboard cards)
export function SkeletonCard({ className = '' }: { className?: string }) {
    return (
        <div className={`rounded-2xl border border-border bg-card p-6 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <SkeletonBase className="h-4 w-24" />
                <SkeletonBase className="h-8 w-8 rounded-full" />
            </div>
            <SkeletonBase className="h-8 w-32 mb-2" />
            <SkeletonBase className="h-3 w-20" />
        </div>
    );
}

// Table row skeleton
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
    return (
        <tr className="border-b border-border">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-4 py-3.5">
                    <SkeletonBase className={`h-4 ${i === 0 ? 'w-32' : 'w-20'}`} />
                </td>
            ))}
        </tr>
    );
}

// Full table skeleton
export function SkeletonTable({
    rows = 5,
    columns = 4,
    className = '',
}: {
    rows?: number;
    columns?: number;
    className?: string;
}) {
    return (
        <div className={`overflow-hidden rounded-2xl border border-border ${className}`}>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border bg-surface-1">
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="px-4 py-3 text-left">
                                <SkeletonBase className="h-3 w-16" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Avatar skeleton
export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-14 w-14',
    };

    return <SkeletonBase className={`${sizeClasses[size]} rounded-full`} />;
}

// Metric card skeleton (for analytics)
export function SkeletonMetricCard() {
    return (
        <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
                <SkeletonBase className="h-10 w-10 rounded-xl" />
                <div className="flex-1">
                    <SkeletonBase className="h-3 w-24 mb-2" />
                    <SkeletonBase className="h-6 w-16" />
                </div>
            </div>
            <SkeletonBase className="h-2 w-full rounded-full" />
        </div>
    );
}

// Dashboard page skeleton
export function SkeletonDashboard() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <SkeletonBase className="h-8 w-48" />
                <SkeletonBase className="h-10 w-32 rounded-lg" />
            </div>

            {/* Metric cards grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonMetricCard key={i} />
                ))}
            </div>

            {/* Content area */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <SkeletonTable rows={5} columns={4} />
                </div>
                <div>
                    <SkeletonCard />
                </div>
            </div>
        </div>
    );
}

// Empty state component
export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
            {icon && (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-foreground">
                {title}
            </h3>
            {description && (
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {description}
                </p>
            )}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
