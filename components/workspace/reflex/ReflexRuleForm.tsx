import { useState } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import type { AutomationRule, AutomationTrigger, AutomationAction, AutonomyLevel } from '@/lib/reflex/automation';
import { Save, X, AlertTriangle } from 'lucide-react';

interface ReflexRuleFormProps {
    workspaceId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ReflexRuleForm({ workspaceId, onSuccess, onCancel }: ReflexRuleFormProps) {
    const { success, error: showError } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        autonomyLevel: 'confirm' as AutonomyLevel,
        cooldownMinutes: 60,
    });

    const [trigger, setTrigger] = useState<Partial<AutomationTrigger>>({
        type: 'metric_threshold',
        metric: 'cpu',
        operator: 'gt',
        value: 90
    });

    const [action, setAction] = useState<Partial<AutomationAction>>({
        type: 'run_script',
        scriptName: 'High CPU Diagnostic',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload: Partial<AutomationRule> = {
                ...formData,
                trigger: trigger as AutomationTrigger,
                action: action as AutomationAction,
            };

            const res = await csrfFetch(`/api/workspaces/${workspaceId}/reflex/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save rule');
            }

            success('Automation rule created inside the Reflex Engine');
            onSuccess();
        } catch (err: unknown) {
            showError('Rule Creation Failed', err instanceof Error ? err.message : undefined);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 text-sm">
            {/* Rule Identity Section */}
            <div className="space-y-4">
                <h3 className="text-foreground font-medium border-b border-border pb-2">1. Rule Definition</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-muted-foreground font-medium ml-1">Rule Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                            placeholder="e.g., Auto-restart frozen agents"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-muted-foreground font-medium ml-1">Description (Optional)</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary transition-colors h-20"
                        placeholder="Describe the condition and intent of this rule..."
                    />
                </div>
            </div>

            {/* Trigger State */}
            <div className="space-y-4">
                <h3 className="text-foreground font-medium border-b border-border pb-2">2. Cortex Assessment Trigger</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-muted-foreground font-medium ml-1">Resource Metric</label>
                        <select
                            value={trigger.metric}
                            onChange={(e) => setTrigger({ ...trigger, metric: e.target.value as any })}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                        >
                            <option value="cpu">CPU Utilization %</option>
                            <option value="ram">RAM Usage %</option>
                            <option value="disk">Disk Space %</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-muted-foreground font-medium ml-1">Threshold Operator</label>
                        <select
                            value={trigger.operator}
                            onChange={(e) => setTrigger({ ...trigger, operator: e.target.value as any })}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                        >
                            <option value="gt">Greater Than (&gt;)</option>
                            <option value="lt">Less Than (&lt;)</option>
                            <option value="eq">Equals (==)</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-muted-foreground font-medium ml-1">Value Marker</label>
                        <input
                            type="number"
                            required
                            min="0"
                            max="100"
                            value={trigger.value}
                            onChange={(e) => setTrigger({ ...trigger, value: parseInt(e.target.value) })}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>
            </div>

            {/* Action Resolution */}
            <div className="space-y-4">
                <h3 className="text-foreground font-medium border-b border-border pb-2 flex items-center gap-2">
                    3. Consequence Action
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-muted-foreground font-medium ml-1">Action Type</label>
                        <select
                            value={action.type}
                            onChange={(e) => setAction({ ...action, type: e.target.value as any })}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                        >
                            <option value="run_script">Execute Background Script</option>
                            <option value="restart_agent">Restart Native Agent Daemon</option>
                            <option value="send_notification">Trigger Admin Webhook</option>
                        </select>
                    </div>

                    {action.type === 'run_script' && (
                        <div className="space-y-1.5">
                            <label className="text-muted-foreground font-medium ml-1">Identified Script Target</label>
                            <input
                                type="text"
                                required
                                value={action.scriptName}
                                onChange={(e) => setAction({ ...action, scriptName: e.target.value })}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                                placeholder="Reflex will execute this inside the Agent process"
                            />
                        </div>
                    )}
                </div>

                <div className="bg-background p-4 rounded-xl border border-border space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-foreground font-medium ml-1 flex items-center gap-2">
                            Autonomy Level
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className={`
                                border rounded-xl p-3 cursor-pointer transition-colors flex flex-col items-center text-center
                                ${formData.autonomyLevel === 'suggest' ? 'border-amber-500/50 bg-amber-500/5' : 'border-border hover:border-border bg-surface-1'}
                            `}>
                                <input
                                    type="radio"
                                    name="autonomy"
                                    className="hidden"
                                    checked={formData.autonomyLevel === 'suggest'}
                                    onChange={() => setFormData({ ...formData, autonomyLevel: 'suggest' })}
                                />
                                <span className={`font-medium ${formData.autonomyLevel === 'suggest' ? 'text-warning' : 'text-foreground'}`}>SUGGEST</span>
                                <span className="text-xs text-muted-foreground mt-1">Inbox Recommendation Only</span>
                            </label>

                            <label className={`
                                border rounded-xl p-3 cursor-pointer transition-colors flex flex-col items-center text-center
                                ${formData.autonomyLevel === 'confirm' ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-border bg-surface-1'}
                            `}>
                                <input
                                    type="radio"
                                    name="autonomy"
                                    className="hidden"
                                    checked={formData.autonomyLevel === 'confirm'}
                                    onChange={() => setFormData({ ...formData, autonomyLevel: 'confirm' })}
                                />
                                <span className={`font-medium ${formData.autonomyLevel === 'confirm' ? 'text-primary' : 'text-foreground'}`}>CONFIRM</span>
                                <span className="text-xs text-muted-foreground mt-1">Queue for Admin Approval</span>
                            </label>

                            <label className={`
                                border rounded-xl p-3 cursor-pointer transition-colors flex flex-col items-center text-center
                                ${formData.autonomyLevel === 'auto' ? 'border-destructive/50 bg-destructive/5' : 'border-border hover:border-border bg-surface-1'}
                            `}>
                                <input
                                    type="radio"
                                    name="autonomy"
                                    className="hidden"
                                    checked={formData.autonomyLevel === 'auto'}
                                    onChange={() => setFormData({ ...formData, autonomyLevel: 'auto' })}
                                />
                                <span className={`font-medium ${formData.autonomyLevel === 'auto' ? 'text-destructive' : 'text-foreground'}`}>AUTO</span>
                                <span className="text-xs text-muted-foreground mt-1">Immediate Execution Pipeline</span>
                            </label>
                        </div>
                        {formData.autonomyLevel === 'auto' && (
                            <div className="flex gap-2 items-start mt-3 text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="text-xs leading-relaxed">
                                    <strong>Warning:</strong> The Reflex engine will bypass human verification if the Consequence Assessment computes a Blast Radius smaller than your defined thresholds. High-impact operations will still force human validation.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn-secondary flex items-center gap-2"
                >
                    <X className="w-4 h-4" /> Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary text-black hover:bg-primary/90 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {isSubmitting ? 'Provisioning...' : 'Deploy Rule'}
                </button>
            </div>
        </form>
    );
}
