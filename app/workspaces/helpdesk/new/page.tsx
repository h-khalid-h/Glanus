'use client';
import { useState, Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceId } from '@/lib/workspace/context';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.push(`/workspaces/helpdesk`)}
                    className="text-slate-400 hover:text-white transition-colors p-1 -ml-1"
                >
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-2xl font-bold text-foreground">Submit a Ticket</h1>
            </div>

            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-800">
                    <CardTitle>Request IT Support</CardTitle>
                    <CardDescription>Describe your issue in detail. You can bind hardware devices or software licenses to help IT Staff diagnose the problem.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleCreateTicket} className="space-y-6">

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Ticket Subject <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="E.g., Cannot access office VPN"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Detailed Description <span className="text-rose-500">*</span></label>
                            <textarea
                                required
                                rows={6}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                                placeholder="Describe step-by-step what is happening..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Urgency Level</label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="LOW">Low - No rush</option>
                                    <option value="NORMAL">Normal - Standard issue</option>
                                    <option value="HIGH">High - Affecting productivity</option>
                                    <option value="URGENT">Urgent - Complete work stoppage</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Related Asset (Optional)</label>
                                <select
                                    value={assetId}
                                    onChange={e => setAssetId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="secondary" onClick={() => router.push(`/workspaces/helpdesk`)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading || !title.trim() || !description.trim()} className="gap-2">
                                <Save size={16} /> {loading ? 'Submitting...' : 'Submit Support Request'}
                            </Button>
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
