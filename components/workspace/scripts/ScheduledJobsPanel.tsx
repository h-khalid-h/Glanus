'use client';

import { useState, useEffect } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { Calendar, PlayCircle, Plus, Trash2, Clock, X, Power, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';

interface Script {
    id: string;
    name: string;
    language: string;
}

interface ScriptSchedule {
    id: string;
    name: string;
    description: string | null;
    cronExpression: string;
    enabled: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    runCount: number;
    script: Script;
    targetIds: string[];
}

interface Agent {
    id: string;
    hostname: string;
    platform: string;
    status: string;
}

export function ScheduledJobsPanel({ workspaceId, availableScripts }: { workspaceId: string; availableScripts: Script[] }) {
    const { success, error: showError } = useToast();
    const [schedules, setSchedules] = useState<ScriptSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loadingAgents, setLoadingAgents] = useState(false);

    const [confirmState, setConfirmState] = useState<{ open: boolean; scheduleId: string | null }>({ open: false, scheduleId: null });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        scriptId: '',
        cronExpression: '0 0 * * *', // daily midnight
        targetIds: [] as string[],
    });

    useEffect(() => {
        fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId]);

    const fetchSchedules = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/schedules`);
            if (!res.ok) throw new Error('Failed to fetch scheduled jobs');
            const data = await res.json();
            setSchedules(data.data?.schedules || []);
        } catch {
            showError('Load Error', 'Failed to fetch scheduled jobs');
        } finally {
            setLoading(false);
        }
    };

    const fetchAgents = async () => {
        setLoadingAgents(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/agents`);
            if (!res.ok) throw new Error('Failed to load target agents');
            const data = await res.json();
            setAgents(data.data?.agents || []);
        } catch {
            showError('Error', 'Failed to load target agents');
        } finally {
            setLoadingAgents(false);
        }
    };

    const handleCreateOpen = () => {
        setFormData({ name: '', description: '', scriptId: availableScripts[0]?.id || '', cronExpression: '0 0 * * *', targetIds: [] });
        setIsCreating(true);
        if (agents.length === 0) fetchAgents();
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.targetIds.length === 0) {
            return showError('Validation Error', 'You must select at least one agent target.');
        }

        setIsSubmitting(true);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to create schedule');
            }

            success('Success', 'Scheduled job registered and activated.');
            setIsCreating(false);
            fetchSchedules();
        } catch (err: unknown) {
            showError('Creation Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggle = async (scheduleId: string, currentEnabled: boolean) => {
        try {
            setSchedules(schedules.map(s => s.id === scheduleId ? { ...s, enabled: !currentEnabled } : s));
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/schedules/${scheduleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !currentEnabled })
            });

            if (!res.ok) throw new Error('Failed to update schedule');
            fetchSchedules();
            success('Updated', `Schedule ${!currentEnabled ? 'enabled' : 'disabled'}.`);
        } catch {
            showError('Error', 'Could not toggle schedule');
            fetchSchedules(); // revert
        }
    };

    const handleDelete = async (scheduleId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/schedules/${scheduleId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete schedule');
            success('Deleted', 'Schedule removed successfully.');
            setSchedules(schedules.filter(s => s.id !== scheduleId));
        } catch {
            showError('Error', 'Could not delete schedule');
        }
    };

    const toggleTarget = (agentId: string) => {
        setFormData(prev => ({
            ...prev,
            targetIds: prev.targetIds.includes(agentId)
                ? prev.targetIds.filter(id => id !== agentId)
                : [...prev.targetIds, agentId]
        }));
    };

    const getFrequencyLabel = (cron: string) => {
        if (cron === '0 * * * *') return 'Hourly';
        if (cron === '0 0 * * *') return 'Daily (Midnight)';
        if (cron === '0 0 * * 0') return 'Weekly (Sundays)';
        if (cron === '* * * * *') return 'Every Minute';
        return `Cron (${cron})`;
    };

    return (
        <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden shrink-0">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Calendar size={18} className="text-primary" />
                    Scheduled Jobs
                </h2>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{schedules.length} active configurations</span>
                    <button
                        onClick={handleCreateOpen}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted text-foreground text-sm font-medium rounded-xl transition"
                    >
                        <Plus size={14} /> New Schedule
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-primary w-8 h-8" />
                </div>
            ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-b border-border">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 block text-center" />
                    <p>No automated jobs configured.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border bg-card">
                                <th className="px-6 py-3">Job Name</th>
                                <th className="px-6 py-3">Target Payload</th>
                                <th className="px-6 py-3">Frequency</th>
                                <th className="px-6 py-3">Next Execution</th>
                                <th className="px-6 py-3 text-center">Runs</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {schedules.map(schedule => (
                                <tr key={schedule.id} className={`hover:bg-muted/30 transition ${!schedule.enabled ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-foreground text-sm">{schedule.name}</div>
                                        {schedule.description && <div className="text-xs text-muted-foreground mt-0.5">{schedule.description}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-foreground flex items-center gap-2">
                                            <PlayCircle size={14} className="text-primary" />
                                            {schedule.script.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{schedule.targetIds.length} Targeted Agents</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs px-2 py-1 rounded bg-muted text-foreground font-mono">
                                            {getFrequencyLabel(schedule.cronExpression)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-mono text-foreground">
                                            {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : '—'}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            Last: {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : 'Never'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-muted-foreground font-mono">
                                        {schedule.runCount}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleToggle(schedule.id, schedule.enabled)}
                                                className={`p-1.5 rounded transition ${schedule.enabled ? 'text-success hover:bg-success/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                                aria-label={schedule.enabled ? 'Pause Job' : 'Resume Job'}
                                            >
                                                <Power size={16} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmState({ open: true, scheduleId: schedule.id })}
                                                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                                aria-label="Delete Job"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog
                open={confirmState.open}
                title="Delete Scheduled Job"
                message="Permanently delete this scheduled job? This action cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    if (confirmState.scheduleId) handleDelete(confirmState.scheduleId);
                    setConfirmState({ open: false, scheduleId: null });
                }}
                onCancel={() => setConfirmState({ open: false, scheduleId: null })}
            />

            {/* Creation Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-card">
                            <h2 id="schedule-modal-title" className="text-xl font-semibold flex items-center gap-2 text-foreground">
                                <Clock size={20} className="text-primary" />
                                Schedule Automation Job
                            </h2>
                            <button onClick={() => setIsCreating(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground transition"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Schedule Name</label>
                                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="e.g., Nightly Disk Cleanup" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Target Payload (Script)</label>
                                    <select value={formData.scriptId} onChange={e => setFormData({ ...formData, scriptId: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none">
                                        {availableScripts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.language})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Automated Frequency</label>
                                    <select value={formData.cronExpression} onChange={e => setFormData({ ...formData, cronExpression: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary outline-none">
                                        <option value="0 * * * *">Hourly (Minute 0)</option>
                                        <option value="0 0 * * *">Daily (Midnight)</option>
                                        <option value="0 0 * * 0">Weekly (Sunday)</option>
                                        <option value="0 0 1 * *">Monthly (1st)</option>
                                        <option value="* * * * *">Every Minute (Testing)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1 flex justify-between items-center">
                                    <span>Target Agents ({formData.targetIds.length} selected)</span>
                                </label>

                                {loadingAgents ? (
                                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" /></div>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-xl p-1 bg-background">
                                        {agents.map(agent => (
                                            <label key={agent.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 rounded transition ${formData.targetIds.includes(agent.id) ? 'bg-primary/10' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.targetIds.includes(agent.id)}
                                                    onChange={() => toggleTarget(agent.id)}
                                                    className="rounded border-border text-primary focus:ring-primary bg-background"
                                                />
                                                <div className="flex-1 text-sm font-medium text-foreground">{agent.hostname}</div>
                                                <div className="text-xs text-muted-foreground">{agent.platform}</div>
                                            </label>
                                        ))}
                                        {agents.length === 0 && <div className="p-3 text-center text-sm text-muted-foreground">No agents registered in workspace.</div>}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-foreground">Cancel</button>
                                <button type="submit" disabled={isSubmitting || formData.targetIds.length === 0} className="px-5 py-2 rounded-xl bg-primary text-foreground text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20">
                                    {isSubmitting ? 'Saving...' : 'Activate Cron Job'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
