'use client';

import { useState, useEffect } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { Calendar, PlayCircle, Plus, Trash2, Clock, X, Power, Loader2 } from 'lucide-react';

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
    }, [workspaceId]);

    const fetchSchedules = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/scripts/schedules`);
            const data = await res.json();
            if (res.ok) {
                setSchedules(data.data?.schedules || []);
            }
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
            const data = await res.json();
            if (res.ok) setAgents(data.data?.agents || []);
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
        if (!confirm('Permanently delete this scheduled job?')) return;
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
        <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shrink-0">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Calendar size={18} className="text-nerve" />
                    Scheduled Jobs
                </h2>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">{schedules.length} active configurations</span>
                    <button
                        onClick={handleCreateOpen}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
                    >
                        <Plus size={14} /> New Schedule
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-nerve w-8 h-8" />
                </div>
            ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border-b border-slate-800">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 block text-center" />
                    <p>No automated jobs configured.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-900/50">
                                <th className="px-6 py-3">Job Name</th>
                                <th className="px-6 py-3">Target Payload</th>
                                <th className="px-6 py-3">Frequency</th>
                                <th className="px-6 py-3">Next Execution</th>
                                <th className="px-6 py-3 text-center">Runs</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {schedules.map(schedule => (
                                <tr key={schedule.id} className={`hover:bg-slate-800/30 transition ${!schedule.enabled ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-foreground text-sm">{schedule.name}</div>
                                        {schedule.description && <div className="text-xs text-slate-500 mt-0.5">{schedule.description}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-300 flex items-center gap-2">
                                            <PlayCircle size={14} className="text-nerve" />
                                            {schedule.script.name}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">{schedule.targetIds.length} Targeted Agents</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                                            {getFrequencyLabel(schedule.cronExpression)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-mono text-slate-300">
                                            {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : '—'}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Last: {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : 'Never'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm text-slate-400 font-mono">
                                        {schedule.runCount}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleToggle(schedule.id, schedule.enabled)}
                                                className={`p-1.5 rounded transition ${schedule.enabled ? 'text-green-500 hover:bg-green-500/10' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}
                                                title={schedule.enabled ? 'Pause Job' : 'Resume Job'}
                                            >
                                                <Power size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(schedule.id)}
                                                className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition"
                                                title="Delete Job"
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

            {/* Creation Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
                                <Clock size={20} className="text-nerve" />
                                Schedule Automation Job
                            </h2>
                            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Schedule Name</label>
                                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-nerve focus:ring-1 focus:ring-nerve outline-none" placeholder="e.g., Nightly Disk Cleanup" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Target Payload (Script)</label>
                                    <select value={formData.scriptId} onChange={e => setFormData({ ...formData, scriptId: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-nerve outline-none">
                                        {availableScripts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.language})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Automated Frequency</label>
                                    <select value={formData.cronExpression} onChange={e => setFormData({ ...formData, cronExpression: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-nerve outline-none">
                                        <option value="0 * * * *">Hourly (Minute 0)</option>
                                        <option value="0 0 * * *">Daily (Midnight)</option>
                                        <option value="0 0 * * 0">Weekly (Sunday)</option>
                                        <option value="0 0 1 * *">Monthly (1st)</option>
                                        <option value="* * * * *">Every Minute (Testing)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1 flex justify-between items-center">
                                    <span>Target Agents ({formData.targetIds.length} selected)</span>
                                </label>

                                {loadingAgents ? (
                                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-nerve" /></div>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-1 bg-slate-950">
                                        {agents.map(agent => (
                                            <label key={agent.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800/50 rounded transition ${formData.targetIds.includes(agent.id) ? 'bg-nerve/10' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.targetIds.includes(agent.id)}
                                                    onChange={() => toggleTarget(agent.id)}
                                                    className="rounded border-slate-600 text-nerve focus:ring-nerve bg-slate-950"
                                                />
                                                <div className="flex-1 text-sm font-medium text-foreground">{agent.hostname}</div>
                                                <div className="text-xs text-slate-500">{agent.platform}</div>
                                            </label>
                                        ))}
                                        {agents.length === 0 && <div className="p-3 text-center text-sm text-slate-500">No agents registered in workspace.</div>}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-300">Cancel</button>
                                <button type="submit" disabled={isSubmitting || formData.targetIds.length === 0} className="px-5 py-2 rounded-lg bg-nerve text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-nerve/20">
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
