'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface PaginationProps {
    pagination: PaginationMeta;
    onPageChange: (page: number) => void;
    /** Optional label, e.g. "members" → "Showing 1–20 of 54 members" */
    noun?: string;
    className?: string;
}

/**
 * Shared table pagination controls.
 * Shows "Showing X–Y of Z" info + chevron prev/next buttons with page indicator.
 * Only renders when totalPages > 1.
 */
export function Pagination({ pagination, onPageChange, noun, className }: PaginationProps) {
    const { page, limit, total, totalPages } = pagination;
    if (totalPages <= 1) return null;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    return (
        <div className={`flex items-center justify-between pt-4 border-t border-border/40 ${className ?? ''}`}>
            <p className="text-xs text-muted-foreground">
                {start}–{end} of {total.toLocaleString()}{noun ? ` ${noun}` : ''}
            </p>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="flex items-center px-3 text-xs text-muted-foreground font-medium tabular-nums">
                    {page} / {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                    aria-label="Next page"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
