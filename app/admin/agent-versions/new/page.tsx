'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

export default function NewAgentVersionPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        version: '0.1.0',
        platform: 'WINDOWS',
        downloadUrl: '',
        checksum: '',
        status: 'ACTIVE',
        required: false,
        releaseNotes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await csrfFetch('/api/admin/agent-versions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to publish version');
            }

            success('Version published successfully');
            router.push('/admin/agent-versions');
            router.refresh();
        } catch (err: unknown) {
            showError('Publication Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Publish New Release</h1>
                <p className="text-muted-foreground">
                    Draft a new glanus-agent OTA package. Agents pinging the updater will pull the highest semantic Active release.
                </p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Semantic Version</label>
                            <Input
                                required
                                placeholder="0.1.0"
                                value={formData.version}
                                onChange={e => setFormData({ ...formData, version: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Platform</label>
                            <select
                                className="w-full h-10 px-3 py-2 bg-surface-1 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                value={formData.platform}
                                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                            >
                                <option value="WINDOWS">Windows (.msi)</option>
                                <option value="MACOS">macOS (.pkg)</option>
                                <option value="LINUX">Linux (.deb)</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Download URL</label>
                        <Input
                            required
                            type="url"
                            placeholder="https://bucket.s3.amazonaws.com/installer.exe"
                            value={formData.downloadUrl}
                            onChange={e => setFormData({ ...formData, downloadUrl: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Must be a direct, unauthenticated download link.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">SHA-256 Checksum</label>
                        <Input
                            required
                            placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                            value={formData.checksum}
                            onChange={e => setFormData({ ...formData, checksum: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">The agent daemon will abort installation if the binary hash mismatches.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Release Status</label>
                            <select
                                className="w-full h-10 px-3 py-2 bg-surface-1 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="ACTIVE">ACTIVE (Production)</option>
                                <option value="BETA">BETA (Testing)</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Enforcement</label>
                            <label className="flex items-center gap-3 p-2 bg-surface-1 border border-border rounded-xl cursor-pointer hover:border-border transition-colors">
                                <input
                                    type="checkbox"
                                    checked={formData.required}
                                    onChange={e => setFormData({ ...formData, required: e.target.checked })}
                                    className="w-4 h-4 rounded text-primary focus:ring-primary bg-muted border-border"
                                />
                                <div className="text-sm">
                                    <div className="text-foreground font-medium">Critical Update</div>
                                    <div className="text-muted-foreground text-xs">Forced OTA upgrade</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Release Notes (Markdown)</label>
                        <textarea
                            className="w-full h-32 px-3 py-2 bg-surface-1 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="- Fixed memory leak in heartbeat loop&#10;- Added WebRTC video codec support"
                            value={formData.releaseNotes}
                            onChange={e => setFormData({ ...formData, releaseNotes: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-border">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.back()}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Publishing...' : 'Publish Release'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
