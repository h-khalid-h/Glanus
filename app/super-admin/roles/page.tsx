'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Shield, ShieldCheck, Plus, RefreshCw, ChevronRight,
    Check, X, Pencil, Trash2, Save, Lock, Search,
} from 'lucide-react';
import { useToast } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PermissionRow {
    id: string;
    resource: string;
    action: string;
    scope: 'PLATFORM' | 'WORKSPACE';
    key: string;
    description: string | null;
}

interface RoleRow {
    id: string;
    name: string;
    label: string;
    description: string | null;
    isStaff: boolean;
    color: string;
    userCount: number;
    permissions: PermissionRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCsrfToken(): Promise<string | null> {
    try {
        const res = await fetch('/api/csrf');
        if (!res.ok) return null;
        const data = await res.json();
        return data.token || null;
    } catch {
        return null;
    }
}

async function csrfHeaders(): Promise<Record<string, string>> {
    const token = await getCsrfToken();
    return token ? { 'x-csrf-token': token } : {};
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...opts });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    const json = await res.json();
    return json.data as T;
}

// ---------------------------------------------------------------------------
// Permission Matrix component
// ---------------------------------------------------------------------------

function PermissionMatrix({
    role,
    allPermissions,
    scope,
    onSave,
    saving,
}: {
    role: RoleRow;
    allPermissions: PermissionRow[];
    scope: 'PLATFORM' | 'WORKSPACE';
    onSave: (roleId: string, permissionIds: string[]) => void;
    saving: boolean;
}) {
    const scopePerms = allPermissions.filter((p) => p.scope === scope);
    const rolePermIds = new Set(role.permissions.map((p) => p.id));
    const [selected, setSelected] = useState<Set<string>>(new Set(rolePermIds));
    const [dirty, setDirty] = useState(false);

    // Reset when role changes
    useEffect(() => {
        const ids = new Set(role.permissions.map((p) => p.id));
        setSelected(ids);
        setDirty(false);
    }, [role]);

    const toggle = (permId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(permId)) next.delete(permId);
            else next.add(permId);
            return next;
        });
        setDirty(true);
    };

    // Group by resource
    const grouped: Record<string, PermissionRow[]> = {};
    for (const p of scopePerms) {
        if (!grouped[p.resource]) grouped[p.resource] = [];
        grouped[p.resource].push(p);
    }

    const resources = Object.keys(grouped).sort();

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border/50">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                            <th className="px-4 py-3 text-center font-medium text-muted-foreground w-20">Granted</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resources.map((resource) =>
                            grouped[resource].map((perm, idx) => (
                                <tr
                                    key={perm.id}
                                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                                >
                                    {idx === 0 && (
                                        <td
                                            rowSpan={grouped[resource].length}
                                            className="px-4 py-2 align-top font-mono text-xs font-semibold text-foreground capitalize border-r border-border/30"
                                        >
                                            {resource}
                                        </td>
                                    )}
                                    <td className="px-4 py-2">
                                        <span className="inline-flex items-center rounded-md bg-muted/50 px-2 py-0.5 text-xs font-mono">
                                            {perm.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">
                                        {perm.description ?? '—'}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => toggle(perm.id)}
                                            className={[
                                                'h-5 w-5 rounded-md border-2 inline-flex items-center justify-center transition-all',
                                                selected.has(perm.id)
                                                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                                    : 'border-border/50 hover:border-muted-foreground/40',
                                            ].join(' ')}
                                        >
                                            {selected.has(perm.id) && <Check className="h-3 w-3" />}
                                        </button>
                                    </td>
                                </tr>
                            )),
                        )}
                    </tbody>
                </table>
            </div>

            {dirty && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <span className="text-xs text-amber-400">Unsaved changes</span>
                    <button
                        type="button"
                        onClick={() => onSave(role.id, Array.from(selected))}
                        disabled={saving}
                        className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                        <Save className="h-3 w-3" />
                        {saving ? 'Saving…' : 'Save Permissions'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline Permission Picker (reusable for create / edit)
// ---------------------------------------------------------------------------

function PermissionPicker({
    allPermissions,
    selected,
    onToggle,
    filter,
    onFilterChange,
}: {
    allPermissions: PermissionRow[];
    selected: Set<string>;
    onToggle: (id: string) => void;
    filter: string;
    onFilterChange: (v: string) => void;
}) {
    const filtered = useMemo(() => {
        if (!filter) return allPermissions;
        const q = filter.toLowerCase();
        return allPermissions.filter(
            (p) => p.resource.toLowerCase().includes(q) || p.action.toLowerCase().includes(q) || p.key.toLowerCase().includes(q),
        );
    }, [allPermissions, filter]);

    const grouped: Record<string, PermissionRow[]> = {};
    for (const p of filtered) {
        if (!grouped[p.resource]) grouped[p.resource] = [];
        grouped[p.resource].push(p);
    }
    const resources = Object.keys(grouped).sort();

    const toggleAll = (resource: string) => {
        const perms = grouped[resource];
        const allSelected = perms.every((p) => selected.has(p.id));
        perms.forEach((p) => {
            if (allSelected && selected.has(p.id)) onToggle(p.id);
            if (!allSelected && !selected.has(p.id)) onToggle(p.id);
        });
    };

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                    className="w-full rounded-lg border border-border bg-muted/30 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                    placeholder="Filter permissions…"
                    value={filter}
                    onChange={(e) => onFilterChange(e.target.value)}
                />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/30">
                {resources.length === 0 && (
                    <p className="px-4 py-6 text-xs text-muted-foreground text-center">No permissions match</p>
                )}
                {resources.map((resource) => {
                    const perms = grouped[resource];
                    const allSel = perms.every((p) => selected.has(p.id));
                    const someSel = !allSel && perms.some((p) => selected.has(p.id));
                    return (
                        <div key={resource} className="px-4 py-2">
                            <button
                                type="button"
                                onClick={() => toggleAll(resource)}
                                className="flex items-center gap-2 w-full text-left group"
                            >
                                <div className={[
                                    'h-4 w-4 rounded border-2 flex items-center justify-center transition-all text-[10px]',
                                    allSel ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' :
                                    someSel ? 'border-amber-500 bg-amber-500/20 text-amber-400' :
                                    'border-border/50 group-hover:border-muted-foreground/40',
                                ].join(' ')}>
                                    {allSel && <Check className="h-2.5 w-2.5" />}
                                    {someSel && <span>–</span>}
                                </div>
                                <span className="font-mono text-xs font-semibold capitalize text-foreground">{resource}</span>
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                    {perms.filter((p) => selected.has(p.id)).length}/{perms.length}
                                </span>
                            </button>
                            <div className="ml-6 mt-1.5 flex flex-wrap gap-1.5">
                                {perms.map((perm) => (
                                    <button
                                        key={perm.id}
                                        type="button"
                                        onClick={() => onToggle(perm.id)}
                                        className={[
                                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono transition-all border',
                                            selected.has(perm.id)
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                                        ].join(' ')}
                                    >
                                        {selected.has(perm.id) && <Check className="h-2.5 w-2.5" />}
                                        {perm.action}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-[10px] text-muted-foreground">
                {selected.size} permission{selected.size !== 1 ? 's' : ''} selected
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Create Role Dialog (inline) — now with permission assignment step
// ---------------------------------------------------------------------------

function CreateRoleForm({ allPermissions, onCreated, onCancel }: {
    allPermissions: PermissionRow[];
    onCreated: (roleId: string) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#6366f1');
    const [isStaff, setIsStaff] = useState(false);
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
    const [permFilter, setPermFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { success: toastSuccess, error: toastError } = useToast();

    const togglePerm = (id: string) => {
        setSelectedPerms((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const created = await apiFetch<{ role: RoleRow }>('/api/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                body: JSON.stringify({ name, label, description: description || undefined, color, isStaff }),
            });

            // If permissions selected, assign them immediately
            if (selectedPerms.size > 0 && created.role?.id) {
                await apiFetch(`/api/admin/roles/${created.role.id}/permissions`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                    body: JSON.stringify({ permissionIds: Array.from(selectedPerms) }),
                });
            }

            toastSuccess('Role created', `"${label}" has been created with ${selectedPerms.size} permission${selectedPerms.size !== 1 ? 's' : ''}`);
            onCreated(created.role?.id);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to create role';
            setError(msg);
            toastError('Failed to create role', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Create Platform Role</h3>
                <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Machine Name</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                        placeholder="e.g. SUPPORT_AGENT"
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Display Label</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                        placeholder="e.g. Support Agent"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                        placeholder="What does this role do?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-8 w-8 rounded border border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{color}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsStaff(!isStaff)}
                        className={[
                            'h-5 w-5 rounded-md border-2 inline-flex items-center justify-center transition-all',
                            isStaff
                                ? 'border-cortex bg-cortex/20 text-cortex'
                                : 'border-border/50',
                        ].join(' ')}
                    >
                        {isStaff && <Check className="h-3 w-3" />}
                    </button>
                    <label className="text-xs text-muted-foreground">Grants Super Admin access</label>
                </div>
            </div>

            {/* Permission assignment */}
            <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">Assign Permissions</label>
                <PermissionPicker
                    allPermissions={allPermissions}
                    selected={selectedPerms}
                    onToggle={togglePerm}
                    filter={permFilter}
                    onFilterChange={setPermFilter}
                />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!name || !label || loading}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
                >
                    {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Create Role
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Edit Role Inline Form
// ---------------------------------------------------------------------------

function EditRoleForm({
    role,
    onSaved,
    onCancel,
}: {
    role: RoleRow;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [label, setLabel] = useState(role.label);
    const [description, setDescription] = useState(role.description ?? '');
    const [color, setColor] = useState(role.color);
    const [isStaff, setIsStaff] = useState(role.isStaff);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { success: toastSuccess, error: toastError } = useToast();

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            await apiFetch(`/api/admin/roles/${role.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                body: JSON.stringify({ label, description: description || undefined, color, isStaff }),
            });
            toastSuccess('Role updated', `"${label}" has been saved`);
            onSaved();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to update role';
            setError(msg);
            toastError('Failed to update role', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Display Label</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Description</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Color</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-7 w-7 rounded border border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{color}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-4">
                    <button
                        type="button"
                        onClick={() => setIsStaff(!isStaff)}
                        className={[
                            'h-4 w-4 rounded border-2 inline-flex items-center justify-center transition-all',
                            isStaff ? 'border-cortex bg-cortex/20 text-cortex' : 'border-border/50',
                        ].join(' ')}
                    >
                        {isStaff && <Check className="h-2.5 w-2.5" />}
                    </button>
                    <span className="text-xs text-muted-foreground">Super Admin access</span>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!label || loading}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                >
                    {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save Changes
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SuperAdminRolesPage() {
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [permScope, setPermScope] = useState<'PLATFORM' | 'WORKSPACE'>('PLATFORM');
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const { success: toastSuccess, error: toastError } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Seed permissions first (idempotent)
            await apiFetch('/api/admin/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                body: JSON.stringify({ action: 'seed' }),
            }).catch(() => { /* ignore seed errors */ });

            const [rolesData, permsData] = await Promise.all([
                apiFetch<{ roles: RoleRow[] }>('/api/admin/roles'),
                apiFetch<{ permissions: PermissionRow[] }>('/api/admin/permissions'),
            ]);

            // Enrich roles with permissions
            const enrichedRoles = await Promise.all(
                rolesData.roles.map(async (r) => {
                    try {
                        const detail = await apiFetch<{ role: RoleRow }>(`/api/admin/roles/${r.id}`);
                        return detail.role;
                    } catch {
                        return { ...r, permissions: [] };
                    }
                }),
            );

            setRoles(enrichedRoles);
            setAllPermissions(permsData.permissions);
            if (!selectedRoleId && enrichedRoles.length > 0) {
                setSelectedRoleId(enrichedRoles[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [selectedRoleId]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchData(); }, []);

    const handleSavePermissions = async (roleId: string, permissionIds: string[]) => {
        setSaving(true);
        try {
            await apiFetch(`/api/admin/roles/${roleId}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                body: JSON.stringify({ permissionIds }),
            });
            toastSuccess('Permissions saved', `Updated ${permissionIds.length} permission${permissionIds.length !== 1 ? 's' : ''}`);
            await fetchData();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save';
            setError(msg);
            toastError('Failed to save permissions', msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Delete this role? This cannot be undone.')) return;
        const roleName = roles.find((r) => r.id === roleId)?.label ?? 'Role';
        try {
            await apiFetch(`/api/admin/roles/${roleId}`, {
                method: 'DELETE',
                headers: await csrfHeaders(),
            });
            if (selectedRoleId === roleId) setSelectedRoleId(null);
            toastSuccess('Role deleted', `"${roleName}" has been removed`);
            await fetchData();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to delete';
            setError(msg);
            toastError('Failed to delete role', msg);
        }
    };

    const selectedRole = roles.find((r) => r.id === selectedRoleId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage platform roles and their permission assignments
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 rounded-xl bg-primary/15 border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New Role
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {showCreate && (
                <CreateRoleForm
                    allPermissions={allPermissions}
                    onCreated={(roleId) => { setShowCreate(false); setSelectedRoleId(roleId); fetchData(); }}
                    onCancel={() => setShowCreate(false)}
                />
            )}

            {/* Two-column layout: role list + permission matrix */}
            <div className="grid grid-cols-12 gap-6">
                {/* Role list */}
                <div className="col-span-4 space-y-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Roles</h2>
                    {loading && roles.length === 0 ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        roles.map((role) => (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => setSelectedRoleId(role.id)}
                                className={[
                                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                                    selectedRoleId === role.id
                                        ? 'border-primary/30 bg-primary/5 shadow-sm shadow-primary/10'
                                        : 'border-border/50 hover:border-border hover:bg-muted/20',
                                ].join(' ')}
                            >
                                <div
                                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${role.color}20`, color: role.color }}
                                >
                                    {role.isStaff ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{role.label}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {role.permissions.length} permissions · {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                {selectedRoleId === role.id && (
                                    <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Permission matrix */}
                <div className="col-span-8">
                    {selectedRole ? (
                        <div className="space-y-4">
                            {editingRoleId === selectedRole.id ? (
                                <EditRoleForm
                                    role={selectedRole}
                                    onSaved={() => { setEditingRoleId(null); fetchData(); }}
                                    onCancel={() => setEditingRoleId(null)}
                                />
                            ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-10 w-10 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: `${selectedRole.color}20`, color: selectedRole.color }}
                                    >
                                        {selectedRole.isStaff ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground">{selectedRole.label}</h2>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedRole.description ?? selectedRole.name}
                                            {selectedRole.isStaff && (
                                                <span className="ml-2 inline-flex items-center gap-1 text-cortex">
                                                    <Lock className="h-2.5 w-2.5" /> Super Admin
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Scope toggle */}
                                    <div className="flex rounded-lg border border-border/50 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setPermScope('PLATFORM')}
                                            className={[
                                                'px-3 py-1.5 text-xs font-medium transition-colors',
                                                permScope === 'PLATFORM' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                                            ].join(' ')}
                                        >
                                            Platform
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPermScope('WORKSPACE')}
                                            className={[
                                                'px-3 py-1.5 text-xs font-medium transition-colors',
                                                permScope === 'WORKSPACE' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                                            ].join(' ')}
                                        >
                                            Workspace
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingRoleId(selectedRole.id)}
                                        className="flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                                        title="Edit role"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteRole(selectedRole.id)}
                                        className="flex items-center gap-1 rounded-lg border border-destructive/20 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                                        title="Delete role"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                            )}

                            <PermissionMatrix
                                role={selectedRole}
                                allPermissions={allPermissions}
                                scope={permScope}
                                onSave={handleSavePermissions}
                                saving={saving}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">
                                Select a role to manage its permissions
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
