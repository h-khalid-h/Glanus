'use client';

import { useState } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore, Workspace } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/lib/toast';

export default function DangerZone({ workspace }: { workspace: Workspace }) {
    const router = useRouter();
    const { fetchWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
    const { error: showError } = useToast();

    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = async () => {
        if (confirmText !== workspace.name) return;

        setIsDeleting(true);
        try {
            const response = await csrfFetch(`/api/workspaces/${workspace.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete workspace');
            }

            await fetchWorkspaces();
            setCurrentWorkspace(null);
            router.push('/workspaces/new');
        } catch (_error: unknown) {
            showError('Delete Failed', 'Could not delete workspace. Please try again.');
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-health-critical">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">
                    Destructive actions that cannot be undone.
                </p>
            </div>

            <div className="border border-health-critical/20 rounded-xl bg-health-critical/10 p-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-health-critical/10 rounded-lg text-health-critical shrink-0">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-health-critical">Delete Workspace</h3>
                        <p className="mt-1 text-sm text-health-critical">
                            Permanently remove this workspace and all of its data. This action is not reversible.
                            All assets, members, and settings will be deleted.
                        </p>

                        {!showConfirm ? (
                            <Button
                                variant="danger"
                                className="mt-4"
                                onClick={() => setShowConfirm(true)}
                            >
                                Delete this workspace
                            </Button>
                        ) : (
                            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="max-w-md">
                                    <label className="block text-sm font-medium text-health-critical mb-2">
                                        To confirm, type "<span className="font-bold select-all">{workspace.name}</span>" below:
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        className="w-full rounded-lg border-red-300 focus:ring-red-500 focus:border-health-critical bg-slate-900"
                                        placeholder="Enter workspace name"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="danger"
                                        onClick={handleDelete}
                                        disabled={confirmText !== workspace.name || isDeleting}
                                        isLoading={isDeleting}
                                    >
                                        I understand, delete this workspace
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setShowConfirm(false);
                                            setConfirmText('');
                                        }}
                                        disabled={isDeleting}
                                        className="text-health-critical hover:text-health-critical hover:bg-health-critical/15"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
