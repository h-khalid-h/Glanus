'use client';

import { useState, useEffect } from 'react';
import { csrfFetch } from '@/lib/api/csrfFetch';
import { useToast } from '@/lib/toast';
import {
    User, Shield, KeyRound, Building2, Mail, Calendar,
    Eye, EyeOff, CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import Link from 'next/link';

interface UserProfile {
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
    onboardingCompleted: boolean;
    workspaceMemberships: Array<{
        id: string;
        role: string;
        joinedAt: string;
        workspace: { id: string; name: string };
    }>;
}

type AccountTab = 'profile' | 'security' | 'workspaces';

export default function AccountSettingsPage() {
    const { success: toastSuccess, error: toastError } = useToast();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AccountTab>('profile');

    // Profile form
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // Password form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await csrfFetch('/api/account');
            if (!res.ok) throw new Error('Failed to load profile');
            const data = await res.json();
            const p = data.data?.profile;
            setProfile(p);
            setName(p.name || '');
            setEmail(p.email || '');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load account');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const res = await csrfFetch('/api/account', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || 'Update failed');
            toastSuccess('Profile Updated', 'Your profile has been saved.');
            fetchProfile();
        } catch (err: unknown) {
            toastError('Update Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toastError('Mismatch', 'New passwords do not match.');
            return;
        }
        if (newPassword.length < 8) {
            toastError('Too Short', 'Password must be at least 8 characters.');
            return;
        }
        setChangingPassword(true);
        try {
            const res = await csrfFetch('/api/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || data.error || 'Password change failed');
            toastSuccess('Password Changed', 'Your password has been updated.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: unknown) {
            toastError('Change Failed', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setChangingPassword(false);
        }
    };

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            OWNER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            ADMIN: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            MEMBER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            VIEWER: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        };
        return colors[role] || colors.VIEWER;
    };

    const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
        if (pw.length === 0) return { label: '', color: '', width: '0%' };
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;

        if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
        if (score <= 2) return { label: 'Fair', color: 'bg-amber-500', width: '40%' };
        if (score <= 3) return { label: 'Good', color: 'bg-blue-500', width: '60%' };
        if (score <= 4) return { label: 'Strong', color: 'bg-green-500', width: '80%' };
        return { label: 'Excellent', color: 'bg-green-400', width: '100%' };
    };

    if (loading) return <PageSpinner />;
    if (error || !profile) return <ErrorState title="Account Error" description={error || 'Could not load account.'} onRetry={() => { setError(null); setLoading(true); fetchProfile(); }} />;

    const strength = passwordStrength(newPassword);

    const tabs: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Profile', icon: <User size={16} /> },
        { id: 'security', label: 'Security', icon: <Shield size={16} /> },
        { id: 'workspaces', label: 'Workspaces', icon: <Building2 size={16} /> },
    ];

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-6 py-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-nerve/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-nerve" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
                            <p className="text-slate-400">Manage your profile, security, and workspace memberships</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-8 bg-slate-900/50 rounded-lg p-1 border border-slate-800">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-nerve text-white shadow-lg shadow-nerve/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ═══ PROFILE TAB ═══ */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <form onSubmit={handleSaveProfile} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm space-y-5">
                            <div className="flex items-center gap-2 mb-4">
                                <User className="w-5 h-5 text-nerve" />
                                <h2 className="text-xl font-semibold text-foreground">Personal Information</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-nerve/50 focus:border-nerve"
                                        placeholder="Your full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-nerve/50 focus:border-nerve"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-between">
                                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <Calendar size={12} />
                                    Account created: {new Date(profile.createdAt).toLocaleDateString()}
                                </div>
                                <button type="submit" disabled={savingProfile} className="px-6 py-2.5 bg-nerve hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                                    {savingProfile ? 'Saving...' : 'Save Profile'}
                                </button>
                            </div>
                        </form>

                        {/* Account Info Card */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="text-sm font-medium text-slate-300 mb-4">Account Details</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <div className="text-slate-500 mb-1">User ID</div>
                                    <div className="text-foreground font-mono text-xs">{profile.id.slice(0, 12)}…</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 mb-1">Role</div>
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadge(profile.role)}`}>{profile.role}</span>
                                </div>
                                <div>
                                    <div className="text-slate-500 mb-1">Workspaces</div>
                                    <div className="text-foreground font-medium">{profile.workspaceMemberships.length}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 mb-1">Last Updated</div>
                                    <div className="text-foreground">{new Date(profile.updatedAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ SECURITY TAB ═══ */}
                {activeTab === 'security' && (
                    <div className="space-y-6">
                        <form onSubmit={handleChangePassword} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm space-y-5">
                            <div className="flex items-center gap-2 mb-4">
                                <KeyRound className="w-5 h-5 text-nerve" />
                                <h2 className="text-xl font-semibold text-foreground">Change Password</h2>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPw ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-nerve/50 focus:border-nerve"
                                        placeholder="Enter current password"
                                    />
                                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label={showCurrentPw ? 'Hide password' : 'Show password'}>
                                        {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPw ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-nerve/50 focus:border-nerve"
                                        placeholder="Enter new password (min 8 characters)"
                                    />
                                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label={showNewPw ? 'Hide new password' : 'Show new password'}>
                                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {newPassword && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-slate-500">Password Strength</span>
                                            <span className="text-xs font-medium" style={{ color: strength.color.includes('red') ? '#ef4444' : strength.color.includes('amber') ? '#f59e0b' : strength.color.includes('blue') ? '#3b82f6' : '#22c55e' }}>{strength.label}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-nerve/50 focus:border-nerve"
                                        placeholder="Confirm new password"
                                    />
                                    {confirmPassword && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {confirmPassword === newPassword ? (
                                                <CheckCircle size={16} className="text-green-400" />
                                            ) : (
                                                <XCircle size={16} className="text-red-400" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button type="submit" disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword} className="px-6 py-2.5 bg-nerve hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                    {changingPassword && <Loader2 size={16} className="animate-spin" />}
                                    {changingPassword ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </form>

                        {/* Security Tips */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                <Shield size={16} className="text-nerve" />
                                Security Recommendations
                            </h3>
                            <ul className="space-y-2 text-sm text-slate-400">
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                    Use a password manager to generate and store unique passwords
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                    Choose a password with at least 12 characters, mixing letters, numbers, and symbols
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                    Never reuse passwords across different services
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                    Change your password periodically, especially after any security incidents
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* ═══ WORKSPACES TAB ═══ */}
                {activeTab === 'workspaces' && (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-nerve" />
                                <h2 className="text-xl font-semibold text-foreground">Workspace Memberships</h2>
                            </div>
                            <span className="text-xs text-slate-500">{profile.workspaceMemberships.length} workspace(s)</span>
                        </div>

                        {profile.workspaceMemberships.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>You are not a member of any workspaces.</p>
                                <Link href="/workspaces/new" className="text-nerve hover:underline text-sm mt-2 inline-block">Create a workspace</Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {profile.workspaceMemberships.map(m => (
                                    <Link key={m.id} href={`/workspaces/${m.workspace.id}/analytics`} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-nerve/10 flex items-center justify-center text-nerve font-bold">
                                                {m.workspace.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground group-hover:text-nerve transition">{m.workspace.name}</div>
                                                <div className="text-xs text-slate-500">Joined {new Date(m.joinedAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded text-xs font-medium border ${getRoleBadge(m.role)}`}>
                                            {m.role}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
