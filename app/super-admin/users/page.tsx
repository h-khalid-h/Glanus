'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Search, X, Shield, ShieldCheck, User,
    ChevronLeft, ChevronRight, RefreshCw,
    CheckCircle2, XCircle, Mail, Building2, Calendar,
    Crown, Users, Eye, UserPlus, Plus, Lock, Pencil,
    KeyRound,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformRole {
    id: string;
    name: string;
    label: string;
    color: string;
    isStaff: boolean;
    userCount: number;
}

interface UserRow {
    id: string;
    email: string;
    name: string | null;
    role: string;
    platformRole: Pick<PlatformRole, 'id' | 'name' | 'label' | 'color' | 'isStaff'> | null;
    isStaff: boolean;
    emailVerified: boolean;
    onboardingCompleted: boolean;
    createdAt: string;
    workspaceCount: number;
}

interface WorkspaceMembership {
    workspaceId: string;
    workspaceName: string;
    slug: string;
    role: string;
    isOwner: boolean;
    memberSince: string;
}

interface UserDetail extends Omit<UserRow, 'workspaceCount'> {
    updatedAt: string;
    workspaces: WorkspaceMembership[];
}

interface UsersData {
    users: UserRow[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WS_ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
    OWNER:  { label: 'Owner',  color: 'text-amber-400',  icon: Crown },
    ADMIN:  { label: 'Admin',  color: 'text-primary', icon: ShieldCheck },
    STAFF:  { label: 'Staff',  color: 'text-sky-400',    icon: Users },
    MEMBER: { label: 'Member', color: 'text-teal-400',   icon: User },
    VIEWER: { label: 'Viewer', color: 'text-slate-400',  icon: Eye },
};

function RoleBadge({ role }: { role: UserRow['platformRole'] }) {
    if (!role) return <span className="text-xs text-muted-foreground/70 italic">No role</span>;
    return (
        <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
            style={{
                color: role.color,
                backgroundColor: `${role.color}18`,
                borderColor: `${role.color}30`,
            }}
        >
            <Shield className="h-3 w-3" />
            {role.label}
        </span>
    );
}

function WsRoleBadge({ role }: { role: string }) {
    const cfg = WS_ROLE_CONFIG[role] ?? WS_ROLE_CONFIG.VIEWER;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cfg.color}`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
        </span>
    );
}

function StaffBadge({ isStaff }: { isStaff: boolean }) {
    return isStaff ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-cortex/20 bg-cortex/10 px-1.5 py-0.5 text-[10px] font-semibold text-cortex">
            <ShieldCheck className="h-2.5 w-2.5" /> Staff
        </span>
    ) : null;
}

// ---------------------------------------------------------------------------
// Create User Modal
// ---------------------------------------------------------------------------

function CreateUserModal({
    roles,
    onClose,
    onCreated,
}: {
    roles: PlatformRole[];
    onClose: () => void;
    onCreated: () => void;
}) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [platformRoleId, setPlatformRoleId] = useState(roles[0]?.id ?? '');
    const [emailVerified, setEmailVerified] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedRole = roles.find((r) => r.id === platformRoleId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, password, platformRoleId, emailVerified, isStaff: true }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Create failed');
            onCreated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative z-10 w-full max-w-lg rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/70 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                            <UserPlus className="h-4 w-4 text-primary" />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">Create New User</h2>
                    </div>
                    <button type="button" onClick={onClose}
                        className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Full Name *</label>
                            <input required value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="Jane Smith"
                                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email Address *</label>
                            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="jane@company.com"
                                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Password *
                        </label>
                        <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 8 characters" minLength={8}
                            className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Platform Role *</label>
                        <select required value={platformRoleId} onChange={(e) => setPlatformRoleId(e.target.value)}
                            className="role-select">
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.label}{r.isStaff ? ' — Staff Access' : ''}
                                </option>
                            ))}
                        </select>
                        {selectedRole && (
                            <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                                {selectedRole.isStaff
                                    ? '⚡ Grants super-admin dashboard access'
                                    : '🔒 Regular access — no super-admin entry'}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                        <div>
                            <p className="text-xs font-medium text-foreground">Mark email as verified</p>
                            <p className="text-[11px] text-muted-foreground">Skip the email verification step</p>
                        </div>
                        <button type="button" onClick={() => setEmailVerified((v) => !v)}
                            className={['relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                                emailVerified ? 'bg-emerald-500' : 'bg-muted'].join(' ')}>
                            <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                                emailVerified ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
                        </button>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/60 px-6 py-4">
                    <button type="button" onClick={onClose}
                        className="rounded-xl border border-border/60 bg-muted px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving}
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary disabled:opacity-50 transition-colors">
                        {saving ? <><RefreshCw className="h-3 w-3 animate-spin" /> Creating…</> : <><Plus className="h-3 w-3" /> Create User</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Edit User Modal
// ---------------------------------------------------------------------------

function EditUserModal({
    userId,
    roles,
    onClose,
    onUpdated,
}: {
    userId: string;
    roles: PlatformRole[];
    onClose: () => void;
    onUpdated: () => void;
}) {
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Editable fields
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [platformRoleId, setPlatformRoleId] = useState('');
    const [isStaffOverride, setIsStaffOverride] = useState(false);

    // Password reset
    const [newPassword, setNewPassword] = useState('');
    const [resettingPw, setResettingPw] = useState(false);
    const [pwSuccess, setPwSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/admin/users/${userId}`)
            .then((r) => r.json())
            .then((j) => {
                const u: UserDetail = j.data?.user ?? j.user;
                setUser(u);
                setEditName(u.name ?? '');
                setEditEmail(u.email);
                setPlatformRoleId(u.platformRole?.id ?? '');
                setIsStaffOverride(u.isStaff);
            })
            .catch(() => setError('Failed to load user'))
            .finally(() => setLoading(false));
    }, [userId]);

    const selectedRole = roles.find((r) => r.id === platformRoleId);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 2500);
    };

    const handleSave = async () => {
        if (!user) return;
        const body: Record<string, unknown> = {};

        // Name/email changes
        const nameVal = editName.trim();
        const emailVal = editEmail.trim().toLowerCase();
        if (nameVal && nameVal !== (user.name ?? '')) body.name = nameVal;
        if (emailVal && emailVal !== user.email) body.email = emailVal;

        // Role changes
        const roleDirty = platformRoleId !== (user.platformRole?.id ?? '');
        const staffDirty = !roleDirty && isStaffOverride !== user.isStaff;
        if (roleDirty) body.platformRoleId = platformRoleId || null;
        if (staffDirty) body.isStaff = isStaffOverride;

        if (Object.keys(body).length === 0) { onClose(); return; }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Update failed');

            const updated: UserDetail = json.data?.user;
            setUser(updated);
            setEditName(updated.name ?? '');
            setEditEmail(updated.email);
            setPlatformRoleId(updated.platformRole?.id ?? '');
            setIsStaffOverride(updated.isStaff);
            showSuccess('User updated');
            onUpdated();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setResettingPw(true);
        setError(null);
        setPwSuccess(null);
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'Reset failed');
            setNewPassword('');
            setPwSuccess('Password reset — user must change on next login');
            setTimeout(() => setPwSuccess(null), 4000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Password reset failed');
        } finally {
            setResettingPw(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-xl rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/70 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/25">
                            {(user?.name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{user?.name ?? 'Loading…'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{user?.email}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-8 animate-pulse rounded-lg bg-muted/30" />
                            ))}
                        </div>
                    ) : user && (
                        <>
                            {/* Status cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Email</p>
                                    {user.emailVerified
                                        ? <p className="flex items-center justify-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Verified</p>
                                        : <p className="flex items-center justify-center gap-1 text-xs text-destructive"><XCircle className="h-3 w-3" /> Unverified</p>}
                                </div>
                                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Onboarding</p>
                                    {user.onboardingCompleted
                                        ? <p className="flex items-center justify-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Done</p>
                                        : <p className="flex items-center justify-center gap-1 text-xs text-amber-400"><XCircle className="h-3 w-3" /> Pending</p>}
                                </div>
                                <div className="rounded-xl border border-border/60 bg-muted/10 p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Workspaces</p>
                                    <p className="text-sm font-bold text-foreground">{user.workspaces.length}</p>
                                </div>
                            </div>

                            {/* Editable name & email */}
                            <div className="rounded-xl border border-border/60 bg-muted/5 p-4 space-y-3">
                                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Profile
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                                        <input
                                            type="email"
                                            value={editEmail}
                                            onChange={(e) => setEditEmail(e.target.value)}
                                            className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">User ID</p>
                                        <p className="text-xs font-mono text-foreground truncate">{user.id}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Joined</p>
                                        <p className="text-xs text-foreground">{new Date(user.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Role editor */}
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Role Management
                                </p>

                                <div>
                                    <label className="text-xs text-muted-foreground mb-1.5 block">Platform Role</label>
                                    <select
                                        value={platformRoleId}
                                        onChange={(e) => {
                                            setPlatformRoleId(e.target.value);
                                            const role = roles.find((r) => r.id === e.target.value);
                                            if (role) setIsStaffOverride(role.isStaff);
                                        }}
                                        className="role-select"
                                    >
                                        <option value="">— No role assigned —</option>
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.label} ({r.userCount} {r.userCount === 1 ? 'user' : 'users'})
                                            </option>
                                        ))}
                                    </select>
                                    {selectedRole && (
                                        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
                                            {selectedRole.isStaff
                                                ? '⚡ Grants super-admin access'
                                                : '🔒 Regular access — no super-admin entry'}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                                    <div>
                                        <p className="text-xs font-medium text-foreground">Staff Dashboard Access</p>
                                        <p className="text-[11px] text-muted-foreground">Manual override — auto-synced by role</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsStaffOverride((v) => !v)}
                                        className={['relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                                            isStaffOverride ? 'bg-primary' : 'bg-muted'].join(' ')}
                                    >
                                        <span className={['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                                            isStaffOverride ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
                                    </button>
                                </div>
                            </div>

                            {/* Password reset */}
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                                <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                    <KeyRound className="h-3.5 w-3.5" /> Reset Password
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    User will be forced to change password on next login.
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="New password (min 8 chars)"
                                        minLength={8}
                                        className="flex-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleResetPassword}
                                        disabled={resettingPw || !newPassword || newPassword.length < 8}
                                        className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
                                    >
                                        {resettingPw ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                                        Reset
                                    </button>
                                </div>
                                {pwSuccess && (
                                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> {pwSuccess}
                                    </div>
                                )}
                            </div>

                            {/* Workspace memberships */}
                            {user.workspaces.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                        <Building2 className="h-3.5 w-3.5" /> Workspace Memberships
                                    </p>
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                        {user.workspaces.map((ws) => (
                                            <div key={ws.workspaceId}
                                                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate">{ws.workspaceName}</p>
                                                    <p className="text-[10px] text-muted-foreground font-mono">{ws.workspaceId}</p>
                                                </div>
                                                <div className="ml-2 shrink-0">
                                                    <WsRoleBadge role={ws.role} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
                    )}
                    {successMsg && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {successMsg}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border/60 px-6 py-4">
                    <button type="button" onClick={onClose}
                        className="rounded-xl border border-border/60 bg-muted px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving || loading}
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary disabled:opacity-50 transition-colors">
                        {saving ? <><RefreshCw className="h-3 w-3 animate-spin" /> Saving…</> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SuperAdminUsersPage() {
    const [data, setData] = useState<UsersData | null>(null);
    const [roles, setRoles] = useState<PlatformRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [editUserId, setEditUserId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load platform roles once on mount
    useEffect(() => {
        fetch('/api/admin/roles')
            .then((r) => r.json())
            .then((j) => setRoles(j.data?.roles ?? []))
            .catch(() => {})
            .finally(() => setRolesLoading(false));
    }, []);

    const fetchData = useCallback(async (p: number, s: string, r: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/admin/users', window.location.origin);
            url.searchParams.set('page', String(p));
            url.searchParams.set('limit', '20');
            url.searchParams.set('isStaff', 'true');
            if (s) url.searchParams.set('search', s);
            if (r) url.searchParams.set('role', r);

            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(1, '', ''); }, [fetchData]);

    const handleSearch = useCallback((value: string) => {
        setSearch(value);
        setPage(1);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchData(1, value, roleFilter), 350);
    }, [fetchData, roleFilter]);

    const handleRoleFilter = useCallback((value: string) => {
        setRoleFilter(value);
        setPage(1);
        fetchData(1, search, value);
    }, [fetchData, search]);

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
        fetchData(newPage, search, roleFilter);
    }, [fetchData, search, roleFilter]);

    const meta = data?.meta;
    const users = data?.users ?? [];

    const roleFilterPills = [
        { value: '', label: 'All Users' },
        ...roles.map((r) => ({ value: r.name, label: r.label })),
        { value: 'STAFF', label: 'Staff Access' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create platform users, assign roles, and control staff access
                        {meta && <span className="ml-2 text-muted-foreground">· {meta.total.toLocaleString()} total</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchData(page, search, roleFilter)}
                        className="flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        disabled={rolesLoading || roles.length === 0}
                        className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary disabled:opacity-40 transition-colors"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        Create User
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/80" />
                    <input
                        type="text"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full rounded-xl border border-border/60 bg-muted/20 py-2 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {search && (
                        <button type="button" onClick={() => handleSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-muted-foreground">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Role filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {roleFilterPills.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            onClick={() => handleRoleFilter(f.value)}
                            className={[
                                'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                                roleFilter === f.value
                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                    : 'border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30',
                            ].join(' ')}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/60">
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platform Role</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspaces</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
                                <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-4 w-full animate-pulse rounded-md bg-muted/20" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                                        {search ? `No users found for "${search}"` : 'No users found'}
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id}
                                        className="group hover:bg-muted/10 transition-colors cursor-pointer"
                                        onClick={() => setEditUserId(user.id)}>
                                        {/* User */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                                                    {(user.name?.[0] ?? user.email[0]).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {user.name ?? <span className="italic text-muted-foreground">No name</span>}
                                                    </p>
                                                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                                                        <Mail className="h-2.5 w-2.5 shrink-0" />
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role */}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <RoleBadge role={user.platformRole} />
                                                <StaffBadge isStaff={user.isStaff} />
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1">
                                                {user.emailVerified ? (
                                                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                                                        <CheckCircle2 className="h-3 w-3" /> Verified
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[11px] text-amber-400">
                                                        <XCircle className="h-3 w-3" /> Unverified
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Workspaces */}
                                        <td className="px-5 py-4">
                                            <span className="flex items-center gap-1.5 text-sm text-foreground">
                                                <Building2 className="h-3.5 w-3.5 text-muted-foreground/80" />
                                                {user.workspaceCount}
                                            </span>
                                        </td>

                                        {/* Joined */}
                                        <td className="px-5 py-4">
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => setEditUserId(user.id)}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                            >
                                                <Pencil className="h-3 w-3" />
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
                        <p className="text-xs text-muted-foreground">
                            Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-3 text-xs text-foreground">
                                {page} / {meta.totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= meta.totalPages}
                                className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateUserModal
                    roles={roles}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => fetchData(1, search, roleFilter)}
                />
            )}
            {editUserId && (
                <EditUserModal
                    userId={editUserId}
                    roles={roles}
                    onClose={() => setEditUserId(null)}
                    onUpdated={() => fetchData(page, search, roleFilter)}
                />
            )}
        </div>
    );
}
