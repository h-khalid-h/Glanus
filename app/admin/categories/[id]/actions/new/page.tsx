'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NewActionPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        label: '',
        slug: '',
        description: '',
        handlerType: 'MANUAL',
        icon: '⚡',
        requiresConfirmation: false,
        confirmationMessage: '',
        isDestructive: false,
        sortOrder: 0,
    });

    useEffect(() => {
        const init = async () => {
            const resolvedParams = await params;
            setCategoryId(resolvedParams.id);
        };
        init();
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await csrfFetch(`/api/admin/categories/${categoryId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create action');
            }

            router.push(`/admin/categories/${categoryId}/actions`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="mb-6">
                <Link
                    href={`/admin/categories/${categoryId}/actions`}
                    className="inline-flex items-center gap-2 text-nerve hover:text-nerve mb-4"
                >
                    <ArrowLeft size={20} />
                    Back to Actions
                </Link>
                <h1 className="text-3xl font-bold text-white">Create New Action</h1>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-health-critical/10 border border-health-critical/20 rounded-lg">
                    <p className="text-sm text-health-critical">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6">
                <div className="space-y-6">
                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="e.g., Restart Device"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Label *</label>
                                <input
                                    value={form.label}
                                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="e.g., Restart"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Slug *</label>
                            <input
                                value={form.slug}
                                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                placeholder="e.g., restart_device"
                                required
                            />
                            <p className="mt-1 text-sm text-slate-500">Lowercase with underscores/hyphens</p>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                placeholder="What does this action do?"
                            />
                        </div>
                    </div>

                    <div className="pb-6 border-b border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Handler Type</label>
                                <select
                                    value={form.handlerType}
                                    onChange={(e) => setForm({ ...form, handlerType: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50"
                                >
                                    <option value="MANUAL">Manual</option>
                                    <option value="API">API</option>
                                    <option value="WEBHOOK">Webhook</option>
                                    <option value="SCRIPT">Script</option>
                                    <option value="REMOTE_COMMAND">Remote Command</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Icon</label>
                                <input
                                    value={form.icon}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50 focus:border-nerve/50"
                                    placeholder="⚡"
                                />
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={form.requiresConfirmation}
                                    onChange={(e) => setForm({ ...form, requiresConfirmation: e.target.checked })}
                                    className="h-4 w-4 text-nerve border-slate-700 rounded"
                                    id="requiresConfirmation"
                                />
                                <label htmlFor="requiresConfirmation" className="ml-2 text-sm text-slate-300">
                                    Requires confirmation before executing
                                </label>
                            </div>

                            {form.requiresConfirmation && (
                                <div className="ml-6">
                                    <input
                                        value={form.confirmationMessage}
                                        onChange={(e) => setForm({ ...form, confirmationMessage: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-700 rounded-lg bg-transparent text-white focus:ring-1 focus:ring-nerve/50"
                                        placeholder="Are you sure you want to..."
                                    />
                                </div>
                            )}

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={form.isDestructive}
                                    onChange={(e) => setForm({ ...form, isDestructive: e.target.checked })}
                                    className="h-4 w-4 text-red-500 border-slate-700 rounded"
                                    id="isDestructive"
                                />
                                <label htmlFor="isDestructive" className="ml-2 text-sm text-slate-300">
                                    Destructive action (shown with warning styling)
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-800">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-nerve text-white rounded-lg hover:brightness-110 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Creating...' : 'Create Action'}
                    </button>
                    <Link
                        href={`/admin/categories/${categoryId}/actions`}
                        className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-900/30 transition-colors text-center"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
