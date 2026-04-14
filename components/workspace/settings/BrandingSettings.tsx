'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState } from 'react';
import { useWorkspaceStore, Workspace } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';

export default function BrandingSettings({ workspace }: { workspace: Workspace }) {
    const { setCurrentWorkspace, fetchWorkspaces } = useWorkspaceStore();

    const [formData, setFormData] = useState({
        primaryColor: workspace.primaryColor || '#3B82F6',
        accentColor: workspace.accentColor || '#10B981',
        logo: workspace.logo || '',
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
                throw new Error(data.error || 'Failed to update branding');
            }

            setCurrentWorkspace(data.workspace);
            await fetchWorkspaces();

            setMessage({ type: 'success', text: 'Branding updated successfully.' });
        } catch (err: unknown) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-foreground">Branding</h2>
                <p className="text-sm text-muted-foreground">
                    Customize the look and feel of your workspace.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 max-w-xl">
                {message && (
                    <div className={`p-4 rounded-xl text-sm ${message.type === 'success'
                        ? 'bg-health-good/10 text-health-good/20 border border-health-good/20'
                        : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Primary Color</label>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl shadow-sm border border-border"
                                style={{ backgroundColor: formData.primaryColor }}
                            />
                            <input
                                type="color"
                                value={formData.primaryColor}
                                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                className="flex-1 h-10 cursor-pointer bg-transparent"
                            />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">Used for buttons, links, and active states.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Accent Color</label>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl shadow-sm border border-border"
                                style={{ backgroundColor: formData.accentColor }}
                            />
                            <input
                                type="color"
                                value={formData.accentColor}
                                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                                className="flex-1 h-10 cursor-pointer bg-transparent"
                            />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">Used for highlights and secondary elements.</p>
                    </div>
                </div>

                <div className="bg-surface-1 p-6 rounded-xl border border-border">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Preview</h3>
                    <div className="flex flex-wrap gap-4 items-center">
                        <button type="button"
                            className="px-4 py-2 rounded-xl text-foreground font-medium shadow-sm transition-opacity hover:opacity-90"
                            style={{ backgroundColor: formData.primaryColor }}
                        >
                            Primary Button
                        </button>
                        <button type="button"
                            className="px-4 py-2 rounded-xl font-medium border bg-card backdrop-blur-sm transition-opacity hover:opacity-90"
                            style={{ color: formData.primaryColor, borderColor: formData.primaryColor }}
                        >
                            Secondary Button
                        </button>
                        <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${formData.accentColor}20`, color: formData.accentColor }}>
                            Accent Badge
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <Button type="submit" isLoading={isLoading}>
                        Save Branding
                    </Button>
                </div>
            </form>
        </div>
    );
}
