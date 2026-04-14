'use client';

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface AuditLogEntry {
    id: string;
    action: string;
    resourceType?: string | null;
    resourceId?: string | null;
    createdAt: string;
    user?: {
        name?: string | null;
        email?: string | null;
    } | null;
    asset?: {
        name?: string | null;
    } | null;
    metadata?: Record<string, unknown> | null;
}

interface NarrativeFeedProps {
    activities: AuditLogEntry[];
    maxItems?: number;
}

/** ────────────────────────────────────────────────
 *  Maps raw audit log actions into narrative stories
 *  ──────────────────────────────────────────────── */
function narrativeForAction(entry: AuditLogEntry): { icon: string; text: string; accent: string } {
    const actor = entry.user?.name || entry.user?.email?.split('@')[0] || 'System';
    const asset = entry.asset?.name || entry.resourceId || '';
    const action = entry.action?.toLowerCase() || '';

    if (action.includes('create') || action.includes('added')) {
        return {
            icon: '＋',
            text: `${actor} added ${asset || 'a new resource'}`,
            accent: 'bg-reflex/10 text-reflex',
        };
    }
    if (action.includes('delete') || action.includes('removed')) {
        return {
            icon: '✕',
            text: `${actor} removed ${asset || 'a resource'}`,
            accent: 'bg-destructive/10 text-destructive',
        };
    }
    if (action.includes('update') || action.includes('modified') || action.includes('edit')) {
        return {
            icon: '↻',
            text: `${actor} updated ${asset || 'settings'}`,
            accent: 'bg-cortex/10 text-cortex',
        };
    }
    if (action.includes('invite') || action.includes('member')) {
        return {
            icon: '↗',
            text: `${actor} invited a team member`,
            accent: 'bg-primary/10 text-primary',
        };
    }
    if (action.includes('alert') || action.includes('trigger')) {
        return {
            icon: '⚡',
            text: `Alert triggered${asset ? ` on ${asset}` : ''}`,
            accent: 'bg-oracle/10 text-oracle',
        };
    }
    if (action.includes('script') || action.includes('execute')) {
        return {
            icon: '▶',
            text: `${actor} executed a script${asset ? ` on ${asset}` : ''}`,
            accent: 'bg-reflex/10 text-reflex',
        };
    }
    if (action.includes('login') || action.includes('session')) {
        return {
            icon: '→',
            text: `${actor} signed in`,
            accent: 'bg-primary/10 text-primary',
        };
    }

    // Default
    return {
        icon: '•',
        text: `${actor}: ${entry.action}`,
        accent: 'bg-muted text-muted-foreground',
    };
}

export function NarrativeFeed({ activities, maxItems = 8 }: NarrativeFeedProps) {
    const items = useMemo(() => {
        return activities.slice(0, maxItems).map(entry => ({
            ...entry,
            narrative: narrativeForAction(entry),
            timeAgo: formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true }),
        }));
    }, [activities, maxItems]);

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                    📋
                </div>
                <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                    Actions in this workspace will appear here
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {items.map((item, i) => (
                <div
                    key={item.id}
                    className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50"
                    style={{ animationDelay: `${i * 0.05}s` }}
                >
                    {/* Icon */}
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-medium ${item.narrative.accent}`}>
                        {item.narrative.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug text-foreground">
                            {item.narrative.text}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.timeAgo}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
