'use client';

import { useState, useCallback } from 'react';
import type {
    AutomationRule,
    AutomationAction,
    AutomationTrigger,
    AutonomyLevel,
    ActionQueueItem,
} from '@/lib/reflex/automation';

interface AutomationCenterProps {
    workspaceId: string;
    rules: AutomationRule[];
    queue: ActionQueueItem[];
    onCreateRule?: (rule: Omit<AutomationRule, 'id' | 'workspaceId' | 'createdBy'>) => void;
    onToggleRule?: (ruleId: string, enabled: boolean) => void;
    onDeleteRule?: (ruleId: string) => void;
    onApproveAction?: (actionId: string) => void;
    onRejectAction?: (actionId: string) => void;
}

/**
 * REFLEX Automation Center — manage automation rules,
 * view action queue, and control autonomy levels.
 */
export function AutomationCenter({
    workspaceId,
    rules,
    queue,
    onCreateRule,
    onToggleRule,
    onDeleteRule,
    onApproveAction,
    onRejectAction,
}: AutomationCenterProps) {
    const [activeTab, setActiveTab] = useState<'rules' | 'queue'>('rules');
    const [showCreateForm, setShowCreateForm] = useState(false);

    const pendingActions = queue.filter(a => a.status === 'pending');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-reflex/10">
                        <svg className="h-4 w-4 text-reflex" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Automation Center</h2>
                        <p className="text-xs text-muted-foreground">REFLEX — autonomous actions with trust</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="btn-primary text-sm"
                >
                    + New Rule
                </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 rounded-lg bg-surface-1 p-1">
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'rules'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Rules ({rules.length})
                </button>
                <button
                    onClick={() => setActiveTab('queue')}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'queue'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Action Queue
                    {pendingActions.length > 0 && (
                        <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-oracle/20 text-xs text-oracle">
                            {pendingActions.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content */}
            {activeTab === 'rules' ? (
                <RulesPanel
                    rules={rules}
                    onToggle={onToggleRule}
                    onDelete={onDeleteRule}
                />
            ) : (
                <QueuePanel
                    queue={queue}
                    onApprove={onApproveAction}
                    onReject={onRejectAction}
                />
            )}

            {/* Create form modal */}
            {showCreateForm && (
                <CreateRuleModal
                    onClose={() => setShowCreateForm(false)}
                    onCreate={(rule) => {
                        onCreateRule?.(rule);
                        setShowCreateForm(false);
                    }}
                />
            )}
        </div>
    );
}

// ─── Rules Panel ─────────────────────────────────────────

function RulesPanel({
    rules,
    onToggle,
    onDelete,
}: {
    rules: AutomationRule[];
    onToggle?: (id: string, enabled: boolean) => void;
    onDelete?: (id: string) => void;
}) {
    if (rules.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <svg className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <p className="text-sm font-medium text-muted-foreground">No automation rules yet</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Create your first rule to automate responses</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {rules.map(rule => (
                <RuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={onToggle}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

function RuleCard({
    rule,
    onToggle,
    onDelete,
}: {
    rule: AutomationRule;
    onToggle?: (id: string, enabled: boolean) => void;
    onDelete?: (id: string) => void;
}) {
    const autonomyColors: Record<AutonomyLevel, string> = {
        suggest: 'bg-nerve/10 text-nerve',
        confirm: 'bg-oracle/10 text-oracle',
        auto: 'bg-reflex/10 text-reflex',
    };

    const autonomyLabels: Record<AutonomyLevel, string> = {
        suggest: 'Suggest Only',
        confirm: 'Require Approval',
        auto: 'Auto-Execute',
    };

    const triggerLabels: Record<string, string> = {
        metric_threshold: '📊 Metric Threshold',
        alert_fired: '🔔 Alert Fired',
        pattern_detected: '🔍 Pattern Detected',
        schedule: '⏰ Scheduled',
    };

    return (
        <div className={`card flex items-start gap-4 ${!rule.enabled ? 'opacity-50' : ''}`}>
            {/* Toggle */}
            <button
                onClick={() => onToggle?.(rule.id, !rule.enabled)}
                className={`mt-1 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${rule.enabled ? 'bg-reflex' : 'bg-muted'
                    }`}
            >
                <span
                    className={`h-4 w-4 rounded-full bg-slate-900/50 backdrop-blur-sm transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                />
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{rule.name}</h4>
                    <span className={`rounded-md px-2 py-0.5 text-2xs font-medium ${autonomyColors[rule.autonomyLevel]}`}>
                        {autonomyLabels[rule.autonomyLevel]}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>

                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{triggerLabels[rule.trigger.type] || rule.trigger.type}</span>
                    <span>→</span>
                    <span>{rule.action.type.replace(/_/g, ' ')}</span>
                    {rule.cooldownMinutes > 0 && (
                        <span className="text-muted-foreground/60">· {rule.cooldownMinutes}min cooldown</span>
                    )}
                </div>
            </div>

            {/* Delete */}
            <button
                onClick={() => onDelete?.(rule.id)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
            </button>
        </div>
    );
}

// ─── Queue Panel ─────────────────────────────────────────

function QueuePanel({
    queue,
    onApprove,
    onReject,
}: {
    queue: ActionQueueItem[];
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
}) {
    if (queue.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <p className="text-sm font-medium text-muted-foreground">Action queue is empty</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Triggered actions will appear here</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {queue.map(item => (
                <div key={item.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={item.status} />
                                <h4 className="text-sm font-semibold">{item.rule.name}</h4>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {item.consequence.estimatedImpact}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground/60">
                                <span>Risk: {item.consequence.riskLevel}</span>
                                <span>·</span>
                                <span>{item.consequence.affectedAssets} affected</span>
                                <span>·</span>
                                <span>{item.consequence.reversible ? 'Reversible' : 'Irreversible'}</span>
                            </div>
                        </div>

                        {item.status === 'pending' && (
                            <div className="flex shrink-0 gap-2">
                                <button
                                    onClick={() => onApprove?.(item.id)}
                                    className="rounded-lg bg-reflex/10 px-3 py-1.5 text-xs font-medium text-reflex hover:bg-reflex/20 transition-colors"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => onReject?.(item.id)}
                                    className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
                                >
                                    Reject
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Consequence reasoning */}
                    <div className="mt-3 rounded-lg bg-surface-1 px-3 py-2">
                        <p className="text-xs text-muted-foreground">{item.consequence.reasoning}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function StatusBadge({ status }: { status: ActionQueueItem['status'] }) {
    const styles: Record<string, string> = {
        pending: 'bg-oracle/10 text-oracle',
        approved: 'bg-nerve/10 text-nerve',
        executing: 'bg-cortex/10 text-cortex',
        completed: 'bg-reflex/10 text-reflex',
        rejected: 'bg-muted text-muted-foreground',
        failed: 'bg-destructive/10 text-destructive',
    };

    return (
        <span className={`rounded-md px-2 py-0.5 text-2xs font-medium ${styles[status] || ''}`}>
            {status}
        </span>
    );
}

// ─── Create Rule Modal ───────────────────────────────────

function CreateRuleModal({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (rule: Omit<AutomationRule, 'id' | 'workspaceId' | 'createdBy'>) => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [triggerType, setTriggerType] = useState<AutomationTrigger['type']>('metric_threshold');
    const [actionType, setActionType] = useState<AutomationAction['type']>('send_notification');
    const [autonomy, setAutonomy] = useState<AutonomyLevel>('confirm');
    const [cooldown, setCooldown] = useState(15);

    const handleSubmit = useCallback(() => {
        if (!name.trim()) return;

        onCreate({
            name,
            description,
            trigger: { type: triggerType },
            action: { type: actionType },
            autonomyLevel: autonomy,
            enabled: true,
            cooldownMinutes: cooldown,
        });
    }, [name, description, triggerType, actionType, autonomy, cooldown, onCreate]);

    return (
        <div className="command-overlay" onClick={onClose}>
            <div
                className="command-dialog max-w-lg p-6"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="mb-4 text-lg font-semibold">Create Automation Rule</h3>

                <div className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. High CPU Alert"
                            className="input w-full"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="What does this rule do?"
                            className="input w-full"
                        />
                    </div>

                    {/* Trigger */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Trigger</label>
                        <select
                            value={triggerType}
                            onChange={e => setTriggerType(e.target.value as AutomationTrigger['type'])}
                            className="input w-full"
                        >
                            <option value="metric_threshold">Metric Threshold</option>
                            <option value="alert_fired">Alert Fired</option>
                            <option value="pattern_detected">Pattern Detected</option>
                            <option value="schedule">Scheduled</option>
                        </select>
                    </div>

                    {/* Action */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Action</label>
                        <select
                            value={actionType}
                            onChange={e => setActionType(e.target.value as AutomationAction['type'])}
                            className="input w-full"
                        >
                            <option value="send_notification">Send Notification</option>
                            <option value="run_script">Run Script</option>
                            <option value="restart_agent">Restart Agent</option>
                            <option value="create_alert">Create Alert</option>
                        </select>
                    </div>

                    {/* Autonomy level */}
                    <div>
                        <label className="mb-2 block text-xs font-medium text-muted-foreground">Autonomy Level</label>
                        <div className="flex gap-2">
                            {(['suggest', 'confirm', 'auto'] as const).map(level => (
                                <button
                                    key={level}
                                    onClick={() => setAutonomy(level)}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${autonomy === level
                                        ? 'border-reflex bg-reflex/10 text-reflex'
                                        : 'border-border text-muted-foreground hover:border-reflex/40'
                                        }`}
                                >
                                    {level === 'suggest' && '💡 Suggest'}
                                    {level === 'confirm' && '✅ Confirm'}
                                    {level === 'auto' && '⚡ Auto'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cooldown */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Cooldown (minutes)</label>
                        <input
                            type="number"
                            value={cooldown}
                            onChange={e => setCooldown(Number(e.target.value))}
                            min={0}
                            className="input w-24"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="btn text-sm">Cancel</button>
                    <button onClick={handleSubmit} className="btn-primary text-sm" disabled={!name.trim()}>
                        Create Rule
                    </button>
                </div>
            </div>
        </div>
    );
}
