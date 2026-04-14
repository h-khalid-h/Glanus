'use client';

import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import type { WorkspaceUsage, DayActivity } from '@/lib/services/SuperAdminService';

// ─────────────────────────────────────────────────────────────────────────────
// Top Workspaces Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

interface TopWorkspacesChartProps {
    data: WorkspaceUsage[];
    metric: 'assetCount' | 'userCount' | 'auditEvents' | 'openTickets';
    label: string;
    color?: string;
    loading?: boolean;
}

const COLORS = [
    '#6366f1', '#8b5cf6', '#a78bfa', '#818cf8',
    '#7c3aed', '#4f46e5', '#4338ca', '#3730a3',
    '#312e81', '#1e1b4b',
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-surface-1 px-3 py-2 shadow-xl text-sm">
            <p className="text-foreground font-medium truncate max-w-[180px]">{label}</p>
            <p className="text-violet-400 font-bold">{payload[0].value.toLocaleString()}</p>
        </div>
    );
};

export function TopWorkspacesChart({
    data,
    metric,
    label,
    color = '#6366f1',
    loading = false,
}: TopWorkspacesChartProps) {
    const chartData = useMemo(() =>
        data.slice(0, 10).map((ws) => ({
            name: ws.workspaceName.length > 14 ? ws.workspaceName.slice(0, 14) + '…' : ws.workspaceName,
            fullName: ws.workspaceName,
            value: ws[metric],
        })),
        [data, metric]
    );

    if (loading) {
        return (
            <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
        );
    }

    return (
        <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Top 10 by {label}</h3>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis
                        type="number"
                        tick={{ fill: '#475569', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={1 - i * 0.05} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Activity Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

interface DailyActivityChartProps {
    data: DayActivity[];
    days: number;
    loading?: boolean;
}

export function DailyActivityChart({ data, days, loading = false }: DailyActivityChartProps) {
    // Aggregate all workspaces by day
    const aggregated = useMemo(() => {
        const map = new Map<string, number>();
        for (const row of data) {
            map.set(row.day, (map.get(row.day) ?? 0) + row.events);
        }
        // Fill missing days
        const result: { day: string; events: number }[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            result.push({ day: label, events: map.get(key) ?? 0 });
        }
        return result;
    }, [data, days]);

    if (loading) {
        return <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />;
    }

    return (
        <div className="rounded-2xl border border-border/60 bg-card backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Platform Activity</h3>
            <p className="text-xs text-muted-foreground/60 mb-4">Total audit events across all workspaces · last {days} days</p>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={aggregated} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                        dataKey="day"
                        tick={{ fill: '#475569', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={Math.floor(days / 7)}
                    />
                    <YAxis
                        tick={{ fill: '#475569', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                    />
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="events" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
