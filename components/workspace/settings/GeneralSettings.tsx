'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useWorkspaceStore, Workspace } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function GeneralSettings({ workspace }: { workspace: Workspace }) {
    const { setCurrentWorkspace, fetchWorkspaces } = useWorkspaceStore();

    const [formData, setFormData] = useState({
        name: workspace.name,
        slug: workspace.slug,
        description: '', // Description might not be in the Workspace type yet, check store definition
    });

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const response = await csrfFetch(`/api/workspaces/${workspace.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update settings');
            }

            // Update store
            setCurrentWorkspace(data.workspace);
            await fetchWorkspaces(); // Refresh list

            setMessage({ type: 'success', text: 'Workspace settings updated successfully.' });
        } catch (err: unknown) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-foreground">General Settings</h2>
                <p className="text-sm text-muted-foreground">
                    Update your workspace's basic information.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
                {message && (
                    <div className={`p-4 rounded-xl text-sm ${message.type === 'success'
                        ? 'bg-health-good/10 text-health-good border border-health-good/20'
                        : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                        {message.text}
                    </div>
                )}

                <Input
                    label="Workspace Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLoading}
                />

                <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                        Workspace URL
                    </label>
                    <div className="flex rounded-xl shadow-sm">
                        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted text-muted-foreground text-sm">
                            glanus.com/
                        </span>
                        <input
                            type="text"
                            value={formData.slug}
                            readOnly
                            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-lg border border-border bg-muted text-muted-foreground sm:text-sm focus:ring-primary/50 focus:border-primary/50 cursor-not-allowed"
                        />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Workspace URL cannot be changed after creation.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                        Description
                    </label>
                    <textarea
                        className="w-full rounded-xl border border-border bg-card backdrop-blur-sm px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 min-h-[100px] resize-none"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="What is this workspace for?"
                        disabled={isLoading}
                    />
                </div>

                <div className="pt-4 flex justify-end">
                    <Button type="submit" isLoading={isLoading}>
                        Save Changes
                    </Button>
                </div>
            </form>

            <div className="mt-12 space-y-4 max-w-xl border-t border-border pt-8">
                <div>
                    <h3 className="text-lg font-medium text-foreground">Storage & Files</h3>
                    <p className="text-sm text-muted-foreground">
                        Upload files to your workspace cache. This consumes your storage quota.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        id="workspace-upload"
                        className="hidden"
                        onChange={async (e) => {
                            if (!e.target.files?.length) return;
                            const file = e.target.files[0];
                            const uploadData = new FormData();
                            uploadData.append('file', file);

                            setIsLoading(true);
                            try {
                                const res = await csrfFetch(`/api/workspaces/${workspace.id}/storage/upload`, {
                                    method: 'POST',
                                    body: uploadData
                                });
                                if (!res.ok) {
                                    const err = await res.json();
                                    setMessage({ type: 'error', text: err.error || 'Upload failed' });
                                    return;
                                }
                                setMessage({ type: 'success', text: `Uploaded ${file.name} successfully.` });
                            } catch (_err: unknown) {
                                setMessage({ type: 'error', text: 'Upload failed due to network error' });
                            } finally {
                                setIsLoading(false);
                            }
                        }}
                        disabled={isLoading}
                    />
                    <label
                        htmlFor="workspace-upload"
                        className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-foreground bg-muted border border-border transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'}`}
                    >
                        {isLoading ? 'Uploading...' : 'Upload File to Storage'}
                    </label>
                </div>
            </div>
        </div>
    );
}
