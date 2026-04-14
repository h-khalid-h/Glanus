'use client';

import { useState } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';

interface Props {
    workspaceId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function MdmProfileForm({ workspaceId, onSuccess, onCancel }: Props) {
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        platform: 'WINDOWS',
        profileType: 'SECURITY',
        configPayload: '{\n  "policies": {}\n}',
    });

    const [nativeSettings, setNativeSettings] = useState({
        // Windows
        requireBitLocker: false,
        enableFirewall: true,
        disableUsbStorage: false,
        // macOS
        requireFileVault: false,
        requireGatekeeper: true,
        disableAirDrop: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let finalPayload;

            const isVisualBuilder = formData.profileType === 'SECURITY' || formData.profileType === 'RESTRICTION';

            if (isVisualBuilder) {
                if (formData.platform === 'WINDOWS') {
                    finalPayload = {
                        policies: {
                            bitLocker: { enabled: nativeSettings.requireBitLocker },
                            firewall: { enabled: nativeSettings.enableFirewall },
                            usbMassStorage: { disabled: nativeSettings.disableUsbStorage }
                        }
                    };
                } else if (formData.platform === 'MACOS') {
                    finalPayload = {
                        policies: {
                            fileVault: { enabled: nativeSettings.requireFileVault },
                            gatekeeper: { enabled: nativeSettings.requireGatekeeper },
                            airDrop: { disabled: nativeSettings.disableAirDrop }
                        }
                    };
                } else {
                    finalPayload = { policies: {} };
                }
            } else {
                try {
                    finalPayload = JSON.parse(formData.configPayload);
                } catch (err: unknown) {
                    throw new Error('Invalid JSON payload: ' + (err as Error).message);
                }
            }

            const res = await csrfFetch(`/api/workspaces/${workspaceId}/mdm/profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    configPayload: finalPayload
                }),
            });

            if (res.ok) {
                success('MDM profile created successfully');
                onSuccess();
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create profile');
            }
        } catch (err: unknown) {
            showError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const isVisualBuilder = formData.profileType === 'SECURITY' || formData.profileType === 'RESTRICTION';

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Profile Name</label>
                        <input
                            type="text"
                            required
                            disabled={loading}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                            placeholder="e.g. Enforce Device Encryption"
                            value={formData.name}
                            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Description (Optional)</label>
                        <textarea
                            disabled={loading}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary h-20 disabled:opacity-50"
                            placeholder="Provide details about what this profile enforces."
                            value={formData.description}
                            onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Platform</label>
                            <select
                                disabled={loading}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary [&>option]:bg-surface-1 disabled:opacity-50"
                                value={formData.platform}
                                onChange={(e) => setFormData(p => ({ ...p, platform: e.target.value }))}
                            >
                                <option value="WINDOWS">Windows</option>
                                <option value="MACOS">macOS</option>
                                <option value="LINUX">Linux</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Profile Type</label>
                            <select
                                disabled={loading}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:border-primary [&>option]:bg-surface-1 disabled:opacity-50"
                                value={formData.profileType}
                                onChange={(e) => setFormData(p => ({ ...p, profileType: e.target.value }))}
                            >
                                <option value="SECURITY">Security policy</option>
                                <option value="RESTRICTION">Restriction</option>
                                <option value="APPLICATION">Application deployment</option>
                                <option value="WIFI">Wi-Fi configuration</option>
                                <option value="VPN">VPN Gateway</option>
                            </select>
                        </div>
                    </div>
                </div>

                {isVisualBuilder && formData.platform === 'WINDOWS' && (
                    <div className="space-y-3 pt-2">
                        <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">Windows Security Policies</h3>

                        <div className="flex items-center justify-between bg-background border border-border/60 rounded-xl p-4">
                            <div>
                                <p className="font-medium text-foreground">Enforce BitLocker Encryption</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Requires OS and data drives to be encrypted via BitLocker.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={nativeSettings.requireBitLocker} onChange={(e) => setNativeSettings({ ...nativeSettings, requireBitLocker: e.target.checked })} />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between bg-background border border-border/60 rounded-xl p-4">
                            <div>
                                <p className="font-medium text-foreground">Enable Windows Defender Firewall</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Forces the host firewall to remain active across all network profiles.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={nativeSettings.enableFirewall} onChange={(e) => setNativeSettings({ ...nativeSettings, enableFirewall: e.target.checked })} />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between bg-background border border-border/60 rounded-xl p-4">
                            <div>
                                <p className="font-medium text-foreground">Disable USB Mass Storage</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Blocks reads and writes to external removable drives.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={nativeSettings.disableUsbStorage} onChange={(e) => setNativeSettings({ ...nativeSettings, disableUsbStorage: e.target.checked })} />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                )}

                {isVisualBuilder && formData.platform === 'MACOS' && (
                    <div className="space-y-3 pt-2">
                        <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">macOS Security Policies</h3>

                        <div className="flex items-center justify-between bg-background border border-border/60 rounded-xl p-4">
                            <div>
                                <p className="font-medium text-foreground">Enforce FileVault</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Requires the startup disk to be secured with XTS-AES-128 encryption.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={nativeSettings.requireFileVault} onChange={(e) => setNativeSettings({ ...nativeSettings, requireFileVault: e.target.checked })} />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between bg-background border border-border/60 rounded-xl p-4">
                            <div>
                                <p className="font-medium text-foreground">Require Gatekeeper</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Prevents users from bypassing Gatekeeper for unnotarized apps.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={nativeSettings.requireGatekeeper} onChange={(e) => setNativeSettings({ ...nativeSettings, requireGatekeeper: e.target.checked })} />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between bg-background border border-border/60 rounded-xl p-4">
                            <div>
                                <p className="font-medium text-foreground">Disable AirDrop</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Blocks inbound and outbound file transfers via AirDrop.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={nativeSettings.disableAirDrop} onChange={(e) => setNativeSettings({ ...nativeSettings, disableAirDrop: e.target.checked })} />
                                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                )}

                {isVisualBuilder && formData.platform === 'LINUX' && (
                    <div className="bg-background/50 border border-border/60 rounded-xl p-8 text-center">
                        <p className="text-muted-foreground">Native UI builder for Linux is coming soon. Please use APPLICATION deployment for custom Linux configurations.</p>
                    </div>
                )}

                {!isVisualBuilder && (
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Configuration Payload (JSON)</label>
                        <textarea
                            required
                            disabled={loading}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-muted-foreground font-mono text-xs focus:outline-none focus:border-primary h-48 disabled:opacity-50"
                            value={formData.configPayload}
                            onChange={(e) => setFormData(p => ({ ...p, configPayload: e.target.value }))}
                            spellCheck={false}
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-black px-6 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Create Profile'}
                </button>
            </div>
        </form>
    );
}
