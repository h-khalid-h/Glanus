'use client';

import React from 'react';
import { Trash2, UserPlus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/toast';

interface BulkActionsProps {
    selectedCount: number;
    onDelete: () => void;
    onUpdateStatus: (status: string) => void;
    onAssign: (userId: string) => void;
    onClearSelection: () => void;
    disabled?: boolean;
}

export function BulkActions({
    selectedCount,
    onDelete,
    onUpdateStatus,
    onAssign,
    onClearSelection,
    disabled = false,
}: BulkActionsProps) {
    const { warning } = useToast();

    const handleDelete = () => {
        warning(
            'Delete Assets',
            `Are you sure you want to delete ${selectedCount} asset(s)? This action cannot be undone.`,
            {
                label: 'Confirm Delete',
                onClick: onDelete,
            }
        );
    };

    if (selectedCount === 0) return null;

    return (
        <div className="bg-nerve/10 border border-nerve/20 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-nerve">
                        {selectedCount} asset{selectedCount > 1 ? 's' : ''} selected
                    </span>

                    <div className="flex items-center gap-2">
                        {/* Update Status */}
                        <select
                            onChange={(e) => {
                                if (e.target.value) {
                                    onUpdateStatus(e.target.value);
                                    e.target.value = ''; // Reset
                                }
                            }}
                            disabled={disabled}
                            className="px-3 py-1.5 text-sm border border-slate-700 rounded-md bg-slate-800/50 text-white focus:ring-2 focus:ring-nerve/50 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Update Status</option>
                            <option value="AVAILABLE">Available</option>
                            <option value="ASSIGNED">Assigned</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="RETIRED">Retired</option>
                        </select>

                        {/* Delete Button */}
                        <button type="button"
                            onClick={handleDelete}
                            disabled={disabled}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-health-critical bg-health-critical/10 hover:bg-health-critical/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                </div>

                <button type="button"
                    onClick={onClearSelection}
                    disabled={disabled}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Clear selection
                </button>
            </div>
        </div>
    );
}
