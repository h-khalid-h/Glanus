'use client';
import { useState, useEffect } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, FileText, Activity, Server, AlertTriangle, Plus, Trash2, Clock, Mail, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { ConfirmDialog } from '@/components/ui';

interface ReportSchedule {
    id: string;
    name: string;
    reportType: string;
    format: string;
    frequency: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    timeOfDay: string;
    timezone: string;
    recipients: string[];
    enabled: boolean;
    lastRunAt: string | null;
    lastStatus: string | null;
    runCount: number;
    createdAt: string;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
    asset_inventory: 'Asset Inventory',
    rmm_health: 'Agent Health & Uptime',
    cortex_insights: 'CORTEX Insights',
};

const FREQUENCY_LABELS: Record<string, string> = {
    daily: 'Every Day',
    weekly: 'Every Week',
    monthly: 'Every Month',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ReportsPage() {
    const workspaceId = useWorkspaceId();
    const { success, error: showError } = useToast();
    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    // Scheduled Deliveries state
    const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(true);
    const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [confirmState, setConfirmState] = useState<{ open: boolean; scheduleId: string | null }>({ open: false, scheduleId: null });

    // Form state
    const [scheduleForm, setScheduleForm] = useState({
        name: '',
        reportType: 'asset_inventory',
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: 1,
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: '',
    });

    useEffect(() => {
        if (workspaceId) fetchSchedules();
    }, [workspaceId]);

    const fetchSchedules = async () => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reports/schedules`);
            if (res.ok) {
                const data = await res.json();
                setSchedules(data.data?.schedules || []);
            }
        } catch {
            // Silent fail on load
        } finally {
            setLoadingSchedules(false);
        }
    };

    const handleDownload = async (type: string) => {
        setIsGenerating(type);
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reports?type=${type}`, {
                method: 'GET'
            });

            if (!res.ok) throw new Error('Failed to generate report');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `glanus_report_${type}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            showError('Report Generation Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsGenerating(null);
        }
    };

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const recipientList = scheduleForm.recipients
                .split(',')
                .map(r => r.trim())
                .filter(r => r.length > 0);

            if (recipientList.length === 0) {
                showError('Validation Error', 'At least one recipient email is required.');
                return;
            }

            const payload: Record<string, unknown> = {
                name: scheduleForm.name,
                reportType: scheduleForm.reportType,
                frequency: scheduleForm.frequency,
                timeOfDay: scheduleForm.timeOfDay,
                timezone: scheduleForm.timezone,
                recipients: recipientList,
            };

            if (scheduleForm.frequency === 'weekly') {
                payload.dayOfWeek = scheduleForm.dayOfWeek;
            }
            if (scheduleForm.frequency === 'monthly') {
                payload.dayOfMonth = scheduleForm.dayOfMonth;
            }

            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reports/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message || 'Failed to create schedule.');
            }

            success('Created', 'Report delivery schedule activated.');
            setIsCreatingSchedule(false);
            setScheduleForm({ name: '', reportType: 'asset_inventory', frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1, timeOfDay: '08:00', timezone: 'UTC', recipients: '' });
            fetchSchedules();
        } catch (err) {
            showError('Creation Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleSchedule = async (scheduleId: string, currentEnabled: boolean) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reports/schedules/${scheduleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !currentEnabled }),
            });
            if (res.ok) {
                setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, enabled: !currentEnabled } : s));
                success('Updated', `Schedule ${!currentEnabled ? 'enabled' : 'paused'}.`);
            }
        } catch {
            showError('Toggle Failed');
        }
    };

    const handleDeleteSchedule = async (scheduleId: string) => {
        try {
            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reports/schedules/${scheduleId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setSchedules(prev => prev.filter(s => s.id !== scheduleId));
                success('Deleted', 'Schedule removed.');
            }
        } catch {
            showError('Deletion Failed');
        }
    };

    const reports = [
        {
            id: 'asset_inventory',
            title: 'Complete Asset Inventory',
            description: 'A full CSV export of all tracked assets, dynamic attributes, lifecycles, and assigned users.',
            icon: Server,
            color: 'text-cortex'
        },
        {
            id: 'rmm_health',
            title: 'Agent Health & Uptime',
            description: 'Aggregated telemetry covering online/offline states, latency dropouts, and CPU usage norms.',
            icon: Activity,
            color: 'text-success'
        },
        {
            id: 'cortex_insights',
            title: 'AI CORTEX Diagnostic Summaries',
            description: 'Exported resolution logs and un-acknowledged infrastructure anomalies flagged by the AI engine.',
            icon: AlertTriangle,
            color: 'text-amber-500'
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Executive Reports</h1>
                <p className="text-muted-foreground">Generate, schedule, and download analytical summaries to CSV directly from the database.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map(report => (
                    <Card key={report.id} className="p-6 flex flex-col items-start gap-4 hover:border-border transition-colors">
                        <div className={`p-3 rounded-xl bg-muted ${report.color}`}>
                            <report.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground mb-2">{report.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{report.description}</p>
                        </div>
                        <Button
                            className="w-full mt-4"
                            variant="secondary"
                            onClick={() => handleDownload(report.id)}
                            disabled={isGenerating === report.id}
                        >
                            {isGenerating === report.id ? (
                                'Generating...'
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export CSV format
                                </>
                            )}
                        </Button>
                    </Card>
                ))}
            </div>

            {/* Scheduled Report Deliveries Section */}
            <div className="mt-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            Scheduled Report Deliveries
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Automate recurring CSV exports delivered directly to stakeholder inboxes.</p>
                    </div>
                    {!isCreatingSchedule && (
                        <button
                            onClick={() => setIsCreatingSchedule(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-xl hover:brightness-110 transition-colors shadow-lg shadow-primary/20"
                        >
                            <Plus size={18} />
                            <span>New Schedule</span>
                        </button>
                    )}
                </div>

                {/* Schedule Creation Form */}
                {isCreatingSchedule && (
                    <Card className="p-6 mb-6 border-primary/30">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-primary" />
                            Configure Delivery Schedule
                        </h3>
                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Schedule Name</label>
                                    <input
                                        required
                                        value={scheduleForm.name}
                                        onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="e.g., Weekly Compliance Report"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Report Type</label>
                                    <select
                                        value={scheduleForm.reportType}
                                        onChange={e => setScheduleForm({ ...scheduleForm, reportType: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="asset_inventory">Asset Inventory</option>
                                        <option value="rmm_health">Agent Health & Uptime</option>
                                        <option value="cortex_insights">AI CORTEX Insights</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
                                    <select
                                        value={scheduleForm.frequency}
                                        onChange={e => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>

                                {scheduleForm.frequency === 'weekly' && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Day of Week</label>
                                        <select
                                            value={scheduleForm.dayOfWeek}
                                            onChange={e => setScheduleForm({ ...scheduleForm, dayOfWeek: parseInt(e.target.value) })}
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            {DAY_NAMES.map((day, i) => (
                                                <option key={i} value={i}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {scheduleForm.frequency === 'monthly' && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Day of Month</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={scheduleForm.dayOfMonth}
                                            onChange={e => setScheduleForm({ ...scheduleForm, dayOfMonth: parseInt(e.target.value) })}
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Time (UTC)</label>
                                    <input
                                        type="time"
                                        value={scheduleForm.timeOfDay}
                                        onChange={e => setScheduleForm({ ...scheduleForm, timeOfDay: e.target.value })}
                                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Recipient Emails (comma-separated)</label>
                                <input
                                    required
                                    value={scheduleForm.recipients}
                                    onChange={e => setScheduleForm({ ...scheduleForm, recipients: e.target.value })}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="cto@company.com, ops-team@company.com"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2 border-t border-border">
                                <button type="button" onClick={() => setIsCreatingSchedule(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-foreground transition">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-primary text-foreground text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-2 transition">
                                    {isSubmitting ? 'Creating...' : 'Activate Schedule'}
                                </button>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Schedule List */}
                {loadingSchedules ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                ) : schedules.length === 0 && !isCreatingSchedule ? (
                    <Card className="p-8 text-center border-dashed border-border bg-muted/30">
                        <FileText className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No Scheduled Deliveries</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                            Set up automated report deliveries to receive compliance-ready CSV exports on a recurring basis directly in your inbox.
                        </p>
                        <button onClick={() => setIsCreatingSchedule(true)} className="px-5 py-2 bg-primary text-foreground rounded-md hover:brightness-110 transition text-sm font-medium">
                            Create First Schedule
                        </button>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {schedules.map(schedule => (
                            <Card key={schedule.id} className={`p-5 flex items-center justify-between hover:border-border transition-colors ${!schedule.enabled ? 'opacity-50' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleToggleSchedule(schedule.id, schedule.enabled)} className="flex-shrink-0" title={schedule.enabled ? 'Pause schedule' : 'Enable schedule'}>
                                        {schedule.enabled ? (
                                            <ToggleRight className="w-7 h-7 text-primary" />
                                        ) : (
                                            <ToggleLeft className="w-7 h-7 text-muted-foreground/60" />
                                        )}
                                    </button>
                                    <div>
                                        <h4 className="font-medium text-foreground">{schedule.name}</h4>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            <span className="bg-muted px-2 py-0.5 rounded">{REPORT_TYPE_LABELS[schedule.reportType] || schedule.reportType}</span>
                                            <span>{FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}</span>
                                            {schedule.frequency === 'weekly' && schedule.dayOfWeek !== null && (
                                                <span>on {DAY_NAMES[schedule.dayOfWeek]}</span>
                                            )}
                                            {schedule.frequency === 'monthly' && schedule.dayOfMonth !== null && (
                                                <span>on day {schedule.dayOfMonth}</span>
                                            )}
                                            <span>at {schedule.timeOfDay} UTC</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Mail className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{schedule.recipients.join(', ')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right text-xs text-muted-foreground">
                                        <div>{schedule.runCount} deliveries</div>
                                        {schedule.lastRunAt && (
                                            <div className={schedule.lastStatus === 'failed' ? 'text-destructive' : 'text-success'}>
                                                Last: {new Date(schedule.lastRunAt).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setConfirmState({ open: true, scheduleId: schedule.id })}
                                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition"
                                        title="Delete schedule"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={confirmState.open}
                title="Delete Delivery Schedule"
                message="Permanently delete this delivery schedule? This action cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    if (confirmState.scheduleId) handleDeleteSchedule(confirmState.scheduleId);
                    setConfirmState({ open: false, scheduleId: null });
                }}
                onCancel={() => setConfirmState({ open: false, scheduleId: null })}
            />
        </div>
    );
}
