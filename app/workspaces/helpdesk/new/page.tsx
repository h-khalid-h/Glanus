'use client';
import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ArrowLeft, Save } from 'lucide-react';

interface Asset {
    id: string;
    name: string;
    assetType: string;
}

function NewTicketContent() {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
    const { success, error: showError } = useToast();

    const [assets, setAssets] = useState<Asset[]>([]);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('NORMAL');
    const [assetId, setAssetId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (workspaceId) {
            // Pre-fetch assets so users can bind tickets to computers/licenses
            csrfFetch(`/api/workspaces/${workspaceId}/assets?limit=100`)
                .then(res => { if (!res.ok) throw new Error('Failed to fetch assets'); return res.json(); })
                .then(data => setAssets(data.data?.assets || []))
                .catch(() => { setAssets([]); });
        }
    }, [workspaceId]);

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = {
                title,
                description,
                priority,
                assetId: assetId || undefined
            };

            const res = await csrfFetch(`/api/workspaces/${workspaceId}/tickets`, {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create support ticket');
            }

            const data = await res.json();
            success('Ticket Created', `Your support request #${data.data.number} has been submitted.`);
            router.push(`/workspaces/helpdesk/${data.data.id}`);

        } catch (err: any) {
            showError('Submission Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.push(`/workspaces/helpdesk`)}
                    className="btn-ghost h-9 w-9 p-0 -ml-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Submit a Ticket</h1>
            </div>

            <Card className="border-border bg-surface-container shadow-sm border-none">
                <CardHeader className="border-b border-border/50 pb-5">
                    <CardTitle className="text-lg">Request IT Support</CardTitle>
                    <CardDescription className="text-muted-foreground mt-1">
                        Describe your issue in detail. You can bind hardware devices or software licenses to help IT Staff diagnose the problem.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleCreateTicket} className="space-y-6">

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-on-surface">Ticket Subject <span className="text-destructive">*</span></label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container placeholder:text-muted-foreground transition-all"
                                placeholder="E.g., Cannot access office VPN"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-on-surface">Detailed Description <span className="text-destructive">*</span></label>
                            <textarea
                                required
                                rows={6}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container resize-y placeholder:text-muted-foreground transition-all"
                                placeholder="Describe step-by-step what is happening..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-on-surface">Urgency Level</label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(e.target.value)}
                                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all appearance-none"
                                >
                                    <option value="LOW">Low - No rush</option>
                                    <option value="NORMAL">Normal - Standard issue</option>
                                    <option value="HIGH">High - Affecting productivity</option>
                                    <option value="URGENT">Urgent - Complete work stoppage</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-on-surface flex items-center justify-between">
                                    <span>Related Asset</span>
                                    <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                                </label>
                                <select
                                    value={assetId}
                                    onChange={e => setAssetId(e.target.value)}
                                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all appearance-none"
                                >
                                    <option value="">No specific asset</option>
                                    {assets.map(asset => (
                                        <option key={asset.id} value={asset.id}>
                                            {asset.name} ({asset.assetType})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
                            <button type="button" className="btn-secondary h-10 px-5" onClick={() => router.push(`/workspaces/helpdesk`)}>
                                Cancel
                            </button>
                            <button type="submit" disabled={loading || !title.trim() || !description.trim()} className="btn-primary h-10 px-6 gap-2">
                                <Save className="h-4 w-4" /> {loading ? 'Submitting...' : 'Submit Support Request'}
                            </button>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewTicketPage() {
    return (
        <WorkspaceLayout>
            <Suspense fallback={<PageSpinner />}>
                <NewTicketContent />
            </Suspense>
        </WorkspaceLayout>
    );
}
