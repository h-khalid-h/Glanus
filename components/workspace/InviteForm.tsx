'use client';
import { csrfFetch } from '@/lib/api/csrfFetch';

import { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { Button } from '@/components/ui/Button';
import { Mail, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { clsx } from 'clsx';

const ROLES = [
    { id: 'ADMIN', name: 'Admin', description: 'Can manage members and settings' },
    { id: 'MEMBER', name: 'Member', description: 'Can access assets and run scripts' },
    { id: 'VIEWER', name: 'Viewer', description: 'Read-only access' },
];

export default function InviteForm({ workspaceId }: { workspaceId: string }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState(ROLES[1]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRoleOpen, setIsRoleOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const { currentWorkspace } = useWorkspaceStore();
    const roleRef = useRef<HTMLDivElement>(null);

    // Close role dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
                setIsRoleOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setMessage(null);

        try {
            const response = await csrfFetch(`/api/workspaces/${workspaceId}/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role: role.id }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send invitation');
            }

            setMessage({ type: 'success', text: `Invitation sent to ${email}` });
            setEmail('');

            // Trigger refresh of pending list
            window.dispatchEvent(new Event('refresh-invitations'));

            // Clear success message after 3s
            setTimeout(() => setMessage(null), 3000);

        } catch (error: unknown) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong' });
        } finally {
            setIsLoading(false);
        }
    };

    const currentRole = currentWorkspace?.userRole;
    const canInvite = currentRole === 'OWNER' || currentRole === 'ADMIN';

    if (!canInvite) return null;

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl shadow-sm border border-slate-800 p-6 mb-8">
            <h3 className="text-lg font-medium text-white mb-4">Invite New Member</h3>

            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="flex-1 w-full relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="pl-10 block w-full rounded-lg border border-slate-700 bg-slate-900/50 backdrop-blur-sm shadow-sm focus:border-nerve/50 focus:ring-nerve/50 sm:text-sm py-2.5 text-white transition-colors"
                        required
                    />
                </div>

                <div className="w-full sm:w-48 relative" ref={roleRef}>
                    <button type="button"
                        onClick={() => setIsRoleOpen(!isRoleOpen)}
                        className="relative w-full cursor-default rounded-lg bg-slate-900/50 backdrop-blur-sm py-2.5 pl-3 pr-10 text-left text-white border border-slate-700 focus:outline-none focus-visible:border-nerve focus-visible:ring-2 focus-visible:ring-white/75 sm:text-sm shadow-sm"
                        aria-expanded={isRoleOpen}
                        aria-haspopup="listbox"
                    >
                        <span className="block truncate">{role.name}</span>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronsUpDown className="h-5 w-5 text-slate-500" aria-hidden="true" />
                        </span>
                    </button>

                    {isRoleOpen && (
                        <ul
                            className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-slate-900/50 backdrop-blur-sm py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-20 border border-slate-700 animate-in fade-in duration-100"
                            role="listbox"
                        >
                            {ROLES.map((r) => (
                                <li
                                    key={r.id}
                                    onClick={() => { setRole(r); setIsRoleOpen(false); }}
                                    className={clsx(
                                        'relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors',
                                        'hover:bg-nerve/10 hover:text-nerve',
                                        role.id === r.id ? 'text-nerve' : 'text-white'
                                    )}
                                    role="option"
                                    aria-selected={role.id === r.id}
                                >
                                    <span className={clsx('block truncate', role.id === r.id ? 'font-medium' : 'font-normal')}>
                                        {r.name}
                                    </span>
                                    {role.id === r.id && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-nerve">
                                            <Check className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <Button type="submit" isLoading={isLoading} className="mt-0 w-full sm:w-auto min-w-[120px]">
                    <Plus className="w-4 h-4 mr-2" />
                    Invite
                </Button>
            </form>

            {message && (
                <div className={clsx(
                    "mt-4 p-3 rounded-lg text-sm flex items-center gap-2 border",
                    message.type === 'success'
                        ? 'bg-health-good/10 text-health-good border-health-good/20'
                        : 'bg-health-critical/10 text-health-critical border-health-critical/20'
                )}>
                    {message.text}
                </div>
            )}
        </div>
    );
}
