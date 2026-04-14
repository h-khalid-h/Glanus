'use client';

import { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Search, Calendar, StickyNote, Loader2, Check } from 'lucide-react';
import { csrfFetch } from '@/lib/api/csrfFetch';

interface WorkspaceMember {
    id: string;
    userId: string;
    role: string;
    user: { id: string; name: string; email: string };
}

interface Props {
    assetId: string;
    workspaceId: string;
    currentAssigneeId?: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

/** Deterministic color index from a string so each user always gets the same colour. */
function avatarColorClass(str: string): string {
    const palette = [
        'bg-blue-500',
        'bg-violet-500',
        'bg-emerald-500',
        'bg-rose-500',
        'bg-amber-500',
        'bg-cyan-500',
        'bg-pink-500',
        'bg-indigo-500',
        'bg-teal-500',
        'bg-orange-500',
    ];
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
}

export function AssetAssignDialog({ assetId, workspaceId, currentAssigneeId, onClose, onSuccess }: Props) {
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        csrfFetch(`/api/workspaces/${workspaceId}/members`)
            .then((r) => r.json())
            .then((d) => {
                const raw: WorkspaceMember[] = d.data?.members ?? d.members ?? [];
                // Deduplicate by user.id — owner is injected by the API plus exists as a member row
                const seen = new Set<string>();
                const unique = raw.filter((m) => {
                    if (seen.has(m.user.id)) return false;
                    seen.add(m.user.id);
                    return true;
                });
                setMembers(unique);
            })
            .catch(() => setError('Failed to load workspace members'))
            .finally(() => setLoadingMembers(false));
    }, [workspaceId]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const filteredMembers = members.filter((m) => {
        const q = search.toLowerCase();
        return m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q);
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) { setError('Please select a user.'); return; }
        setSubmitting(true);
        setError(null);
        try {
            const body: Record<string, string> = { userId: selectedUserId };
            if (startDate) body.startDate = new Date(startDate).toISOString();
            if (notes.trim()) body.notes = notes.trim();

            const res = await csrfFetch(`/api/assets/${assetId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error?.message ?? data.error ?? 'Assignment failed');
            }
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const roleBadge: Record<string, string> = {
        OWNER:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        ADMIN:  'bg-violet-500/10 text-violet-600 dark:text-violet-400',
        MEMBER: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        VIEWER: 'bg-slate-500/10 text-slate-500',
    };

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className="detail-panel w-full max-w-md animate-slide-up">
                {/* ── Header ── */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <UserPlus size={16} className="text-primary" />
                        {currentAssigneeId ? 'Reassign Asset' : 'Assign Asset'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-ghost h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ── Member picker ── */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Assign to <span className="text-destructive">*</span>
                        </label>

                        {loadingMembers ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                <Loader2 size={14} className="animate-spin" />
                                Loading members…
                            </div>
                        ) : (
                            <>
                                {/* Search box */}
                                <div className="relative mb-2">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search members…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="input pl-8 h-8 text-sm rounded-xl"
                                    />
                                </div>

                                {/* List */}
                                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-2 scrollbar-thin">
                                    {filteredMembers.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-5">No members found</p>
                                    ) : (
                                        <ul className="divide-y divide-border/40">
                                            {filteredMembers.map((m) => {
                                                const selected  = selectedUserId === m.user.id;
                                                const isCurrent = currentAssigneeId === m.user.id;
                                                const initials  = (m.user.name ?? '?').charAt(0).toUpperCase();
                                                const color     = avatarColorClass(m.user.id);

                                                return (
                                                    <li key={m.user.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedUserId(m.user.id)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                                                                selected ? 'bg-primary/10' : 'hover:bg-surface-2/80'
                                                            }`}
                                                        >
                                                            {/* Coloured avatar */}
                                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ${color}`}>
                                                                {initials}
                                                            </div>

                                                            {/* Name + email */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-foreground truncate leading-snug">{m.user.name}</p>
                                                                <p className="text-[11px] text-muted-foreground truncate">{m.user.email}</p>
                                                            </div>

                                                            {/* Role pill */}
                                                            <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${roleBadge[m.role] ?? 'bg-muted text-muted-foreground'}`}>
                                                                {m.role}
                                                            </span>

                                                            {/* State indicator */}
                                                            {isCurrent && !selected && (
                                                                <span className="shrink-0 text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-md">
                                                                    Current
                                                                </span>
                                                            )}
                                                            {selected && (
                                                                <div className="shrink-0 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                                                    <Check size={11} className="text-white" strokeWidth={3} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── Start Date ── */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            <Calendar size={12} />
                            Start Date
                            <span className="normal-case font-normal text-muted-foreground/60">(defaults to now)</span>
                        </label>
                        <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input h-9 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </div>

                    {/* ── Notes ── */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            <StickyNote size={12} />
                            Notes
                            <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Reason for assignment, location, etc."
                            rows={2}
                            maxLength={1000}
                            className="input text-sm resize-none py-2.5 min-h-[72px]"
                        />
                    </div>

                    {/* ── Error ── */}
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="btn-outline h-9 text-sm px-4">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !selectedUserId}
                            className="btn-primary h-9 text-sm px-4 inline-flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting && <Loader2 size={13} className="animate-spin" />}
                            {currentAssigneeId ? 'Reassign' : 'Assign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

