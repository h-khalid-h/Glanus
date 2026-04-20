'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useWorkspaceId } from '@/lib/workspace/context';
import {
    Shield, Plus, RefreshCw, ChevronRight,
    Check, X, Save, Trash2, Lock, Search, Edit2,
} from 'lucide-react';
import { useToast } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PermissionRow {
    id: string;
    resource: string;
    action: string;
    scope: string;
    key: string;
    description: string | null;
}

interface RoleRow {
    id: string;
    name: string;
    label: string;
    description: string | null;
    baseRole: string | null;
    memberCount: number;
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
// Permission Matrix
// ---------------------------------------------------------------------------

function PermissionMatrix({
    role,
    allPermissions,
    workspaceId: _workspaceId,
    onSave,
    saving,
}: {
    role: RoleRow;
    allPermissions: PermissionRow[];
    workspaceId: string;
    onSave: (roleId: string, permissionIds: string[]) => void;
    saving: boolean;
}) {
    const isBuiltIn = role.baseRole !== null;
    const rolePermIds = new Set(role.permissions.map((p) => p.id));
    const [selected, setSelected] = useState<Set<string>>(new Set(rolePermIds));
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const ids = new Set(role.permissions.map((p) => p.id));
        setSelected(ids);
        setDirty(false);
    }, [role]);

    const toggle = (permId: string) => {
        if (isBuiltIn) return; // built-in roles cannot be edited
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
    for (const p of allPermissions) {
        if (!grouped[p.resource]) grouped[p.resource] = [];
        grouped[p.resource].push(p);
    }
    const resources = Object.keys(grouped).sort();

    const toggleAll = (resource: string) => {
        if (isBuiltIn) return;
        const perms = grouped[resource];
        const allSel = perms.every((p) => selected.has(p.id));
        setSelected((prev) => {
            const next = new Set(prev);
            perms.forEach((p) => { if (allSel) next.delete(p.id); else next.add(p.id); });
            return next;
        });
        setDirty(true);
    };

    return (
        <div className="space-y-4">
            {isBuiltIn && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-400">
                    <Lock className="h-3 w-3" /> Built-in roles have fixed permissions and cannot be changed
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {resources.map((resource) => {
                    const perms = grouped[resource];
                    const grantedCount = perms.filter((p) => selected.has(p.id)).length;
                    const allSel = grantedCount === perms.length;
                    const someSel = grantedCount > 0 && !allSel;
                    return (
                        <div key={resource} className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
                            {/* Resource header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold capitalize text-foreground">{resource}</span>
                                    <span className={[
                                        'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
                                        allSel ? 'bg-emerald-500/15 text-emerald-400' :
                                        someSel ? 'bg-amber-500/15 text-amber-400' :
                                        'bg-muted text-muted-foreground',
                                    ].join(' ')}>
                                        {grantedCount}/{perms.length}
                                    </span>
                                </div>
                                {!isBuiltIn && (
                                    <button
                                        type="button"
                                        onClick={() => toggleAll(resource)}
                                        className={[
                                            'text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors',
                                            allSel
                                                ? 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10'
                                                : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10',
                                        ].join(' ')}
                                    >
                                        {allSel ? 'Revoke all' : 'Grant all'}
                                    </button>
                                )}
                            </div>
                            {/* Permission pills */}
                            <div className="flex flex-wrap gap-2 px-4 py-3">
                                {perms.map((perm) => {
                                    const on = selected.has(perm.id);
                                    return (
                                        <button
                                            key={perm.id}
                                            type="button"
                                            onClick={() => toggle(perm.id)}
                                            disabled={isBuiltIn}
                                            title={perm.description ?? perm.key}
                                            className={[
                                                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
                                                on
                                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10'
                                                    : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40',
                                                isBuiltIn ? 'cursor-not-allowed' : 'cursor-pointer',
                                            ].join(' ')}
                                        >
                                            <span className={[
                                                'h-2 w-2 rounded-full shrink-0',
                                                on ? 'bg-emerald-400' : 'bg-muted-foreground/30',
                                            ].join(' ')} />
                                            {perm.action}
                                            {on && <Check className="h-3 w-3 text-emerald-400" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {dirty && !isBuiltIn && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <span className="text-xs text-amber-400 font-medium">Unsaved changes — {Array.from(selected).length} permissions selected</span>
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
// Inline Permission Picker
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
                    className="w-full rounded-lg border border-border bg-muted/30 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-indigo-500/50 focus:outline-none"
                    placeholder="Filter permissions…"
                    value={filter}
                    onChange={(e) => onFilterChange(e.target.value)}
                />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
                {resources.length === 0 && (
                    <p className="px-4 py-6 text-xs text-muted-foreground text-center">No permissions match</p>
                )}
                {resources.map((resource) => {
                    const perms = grouped[resource];
                    const grantedCount = perms.filter((p) => selected.has(p.id)).length;
                    const allSel = grantedCount === perms.length;
                    const someSel = grantedCount > 0 && !allSel;
                    return (
                        <div key={resource} className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold capitalize text-foreground">{resource}</span>
                                    <span className={[
                                        'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
                                        allSel ? 'bg-emerald-500/15 text-emerald-400' :
                                        someSel ? 'bg-amber-500/15 text-amber-400' :
                                        'bg-muted/50 text-muted-foreground',
                                    ].join(' ')}>
                                        {grantedCount}/{perms.length}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleAll(resource)}
                                    className={[
                                        'text-[10px] font-medium px-2 py-0.5 rounded-lg border transition-colors',
                                        allSel
                                            ? 'border-rose-500/20 text-rose-400 hover:bg-rose-500/10'
                                            : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10',
                                    ].join(' ')}
                                >
                                    {allSel ? 'Revoke all' : 'Grant all'}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 px-3 py-2.5">
                                {perms.map((perm) => {
                                    const on = selected.has(perm.id);
                                    return (
                                        <button
                                            key={perm.id}
                                            type="button"
                                            onClick={() => onToggle(perm.id)}
                                            title={perm.description ?? perm.key}
                                            className={[
                                                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all',
                                                on
                                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10'
                                                    : 'border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/40',
                                            ].join(' ')}
                                        >
                                            <span className={[
                                                'h-2 w-2 rounded-full shrink-0 transition-colors',
                                                on ? 'bg-emerald-400' : 'bg-muted-foreground/30',
                                            ].join(' ')} />
                                            {perm.action}
                                            {on && <Check className="h-3 w-3" />}
                                        </button>
                                    );
                                })}
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
// Create Role Form — with inline permission assignment
// ---------------------------------------------------------------------------

function CreateRoleForm({
    workspaceId,
    allPermissions,
    onCreated,
    onCancel,
}: {
    workspaceId: string;
    allPermissions: PermissionRow[];
    onCreated: (roleId: string) => void;
    onCancel: () => void;
}) {
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
    const name = label.trim().toUpperCase().replace(/\s+/g, '_');
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
            const created = await apiFetch<{ role: { id: string } }>(`/api/workspaces/${workspaceId}/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                body: JSON.stringify({ name, label: label.trim(), description: description || undefined, permissionIds: Array.from(selectedPerms) }),
            });

            toastSuccess('Role created', `"${label.trim()}" has been created with ${selectedPerms.size} permission${selectedPerms.size !== 1 ? 's' : ''}`);
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
                <h3 className="text-sm font-bold text-foreground">Create Custom Role</h3>
                <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-indigo-500/50 focus:outline-none"
                        placeholder="e.g. Technician"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                    {label.trim() && (
                        <p className="mt-1 text-[10px] text-muted-foreground/60">Internal: <span className="font-mono">{name || '…'}</span></p>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <input
                        className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-indigo-500/50 focus:outline-none"
                        placeholder="What does this role do?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
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
                <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!label.trim() || loading}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/25 disabled:opacity-50"
                >
                    {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Create Role
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkspaceRolesPage() {
    const workspaceId = useWorkspaceId();
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionRow[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingDetails, setEditingDetails] = useState(false);
    const [editLabel, setEditLabel] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [savingDetails, setSavingDetails] = useState(false);
    const { success: toastSuccess, error: toastError } = useToast();

    const fetchData = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch<{ roles: RoleRow[]; availablePermissions: PermissionRow[] }>(
                `/api/workspaces/${workspaceId}/roles`,
            );
            setRoles(data.roles);
            setAllPermissions(data.availablePermissions);
            if (!selectedRoleId && data.roles.length > 0) {
                setSelectedRoleId(data.roles[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, selectedRoleId]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchData(); }, [workspaceId]);

    const handleSavePermissions = async (roleId: string, permissionIds: string[]) => {
        setSaving(true);
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, {
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

    const handleSaveDetails = async () => {
        if (!selectedRoleId) return;
        setSavingDetails(true);
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/roles/${selectedRoleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(await csrfHeaders()) },
                body: JSON.stringify({ label: editLabel.trim(), description: editDesc.trim() || undefined }),
            });
            toastSuccess('Role updated', 'Name and description saved');
            setEditingDetails(false);
            await fetchData();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save';
            toastError('Failed to update role', msg);
        } finally {
            setSavingDetails(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Delete this custom role? Members will lose these permissions.')) return;
        const roleName = roles.find((r) => r.id === roleId)?.name ?? 'Role';
        try {
            await apiFetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, {
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
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">Custom Roles</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create custom roles with fine-grained workspace permissions
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
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 px-3 py-2 text-xs font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/25"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New Role
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                    {error}
                </div>
            )}

            {showCreate && workspaceId && (
                <CreateRoleForm
                    workspaceId={workspaceId}
                    allPermissions={allPermissions}
                    onCreated={(roleId) => { setShowCreate(false); setSelectedRoleId(roleId); fetchData(); }}
                    onCancel={() => setShowCreate(false)}
                />
            )}

            <div className="grid grid-cols-12 gap-6">
                {/* Role list */}
                <div className="col-span-4 space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Workspace Roles</h3>
                    {loading && roles.length === 0 ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
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
                                        ? 'border-indigo-500/30 bg-indigo-500/5 shadow-sm shadow-indigo-500/10'
                                        : 'border-border/50 hover:border-border hover:bg-muted/20',
                                ].join(' ')}
                            >
                                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-muted/50 text-muted-foreground">
                                    {role.baseRole ? <Lock className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{role.label || role.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {role.permissions.length} perms · {role.memberCount ?? 0} members
                                        {role.baseRole && ' · Built-in'}
                                    </p>
                                </div>
                                {selectedRoleId === role.id && (
                                    <ChevronRight className="h-4 w-4 text-indigo-400 shrink-0" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Permission matrix */}
                <div className="col-span-8">
                    {selectedRole ? (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                {editingDetails && !selectedRole.baseRole ? (
                                    <div className="flex-1 space-y-3 mr-3">
                                        <div>
                                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Display Name</label>
                                            <input
                                                autoFocus
                                                value={editLabel}
                                                onChange={(e) => setEditLabel(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDetails(); if (e.key === 'Escape') setEditingDetails(false); }}
                                                className="w-full rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-muted-foreground mb-1">Description</label>
                                            <input
                                                value={editDesc}
                                                onChange={(e) => setEditDesc(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDetails(); if (e.key === 'Escape') setEditingDetails(false); }}
                                                className="w-full rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                                placeholder="What does this role do?"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={handleSaveDetails} disabled={!editLabel.trim() || savingDetails}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/25 disabled:opacity-50 transition-colors">
                                                {savingDetails ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                Save
                                            </button>
                                            <button type="button" onClick={() => setEditingDetails(false)}
                                                className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground">{selectedRole.label || selectedRole.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedRole.description ?? (selectedRole.baseRole ? 'Default workspace role' : 'Custom role')}
                                        </p>
                                    </div>
                                )}
                                {!selectedRole.baseRole && !editingDetails && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => { setEditLabel(selectedRole.label || selectedRole.name); setEditDesc(selectedRole.description ?? ''); setEditingDetails(true); }}
                                            className="flex items-center gap-1 rounded-lg border border-indigo-500/20 px-2.5 py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                        >
                                            <Edit2 className="h-3 w-3" /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRole(selectedRole.id)}
                                            className="flex items-center gap-1 rounded-lg border border-rose-500/20 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <PermissionMatrix
                                role={selectedRole}
                                allPermissions={allPermissions}
                                workspaceId={workspaceId}
                                onSave={handleSavePermissions}
                                saving={saving}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Shield className="h-10 w-10 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">Select a role to manage its permissions</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
