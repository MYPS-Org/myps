import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { RevisionEnums, RevisionFilter } from '../Model';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';

interface FilterDialogRevisionListProps {
    isOpen: boolean;
    onClose: () => void;
    /** The current active filter values (RevisionFilter, not the pagination wrapper). */
    currentFilters: RevisionFilter;
    revisionEnums?: RevisionEnums;
    /**
     * Called with the chosen RevisionFilter when the user clicks Apply or Clear.
     * The usePagination hook's applyFilters() already resets to page 1 and clears
     * keyset cursors, so this callback must NOT inject page/limit/cursor fields.
     */
    onApplyFilters: (filters: RevisionFilter) => void;
}

export const FilterDialogRevisionList: React.FC<FilterDialogRevisionListProps> = ({
    isOpen,
    onClose,
    currentFilters,
    revisionEnums,
    onApplyFilters
}) => {
    const [localFilters, setLocalFilters] = useState<RevisionFilter>(currentFilters);

    // Sync local state whenever the dialog opens or the parent's active filters change.
    useEffect(() => {
        setLocalFilters(currentFilters);
    }, [currentFilters, isOpen]);

    const handleApply = () => {
        // Pass filter values directly. The hook's applyFilters() handles page reset + cursor clear.
        onApplyFilters(localFilters);
        onClose();
    };

    const handleClear = () => {
        const clearedFilters: RevisionFilter = {
            ProjectId: currentFilters.ProjectId ?? '', // preserve the current search term
            TransactionId: '',
            RevisionType: '',
            RevisionStatus: '',
        };
        setLocalFilters(clearedFilters);
        onApplyFilters(clearedFilters);
        onClose();
    };

    const handleFilterChange = (field: 'TransactionId' | 'RevisionType' | 'RevisionStatus', value: string) => {
        setLocalFilters((prev: RevisionFilter) => ({
            ...prev,
            [field]: value
        }));
    };

    const hasActiveFilters = Boolean(
        localFilters.TransactionId || localFilters.RevisionType || localFilters.RevisionStatus
    );

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Filter Revisions
                        </DialogTitle>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600 mb-4">
                            Apply filters to narrow down the revision list. The search term will be preserved.
                        </p>

                        {/* Transaction ID Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Transaction ID
                            </label>
                            <input
                                type="text"
                                name="TransactionId"
                                value={localFilters.TransactionId || ''}
                                onChange={(e) => handleFilterChange('TransactionId', e.target.value)}
                                placeholder="e.g. 24-0001-1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                            />
                        </div>

                        {/* Revision Type Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Revision Type
                            </label>
                            <select
                                name="RevisionType"
                                value={localFilters.RevisionType || ''}
                                onChange={(e) => handleFilterChange('RevisionType', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="">All Types</option>
                                {revisionEnums?.RevisionTypes?.map(type => (
                                    <option key={type.RevisionGroupId} value={type.RevisionName}>
                                        {type.RevisionName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Revision Status Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                name="RevisionStatus"
                                value={localFilters.RevisionStatus || ''}
                                onChange={(e) => handleFilterChange('RevisionStatus', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="">All Statuses</option>
                                {revisionEnums?.RevisionStatuses?.map(status => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {hasActiveFilters && (
                            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-blue-900">
                                        Active Filters
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {localFilters.TransactionId && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">
                                            <span className="font-medium">Transaction ID:</span>
                                            {localFilters.TransactionId}
                                        </span>
                                    )}

                                    {localFilters.RevisionType && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">
                                            <span className="font-medium">Type:</span>
                                            {localFilters.RevisionType}
                                        </span>
                                    )}

                                    {localFilters.RevisionStatus && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">
                                            <span className="font-medium">Status:</span>
                                            {localFilters.RevisionStatus}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
                        <Button type="button" color="zinc" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="button" color="red" onClick={handleClear}>
                            Clear Filters
                        </Button>
                        <Button type="button" color="blue" onClick={handleApply}>
                            Apply Filters
                        </Button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
};
