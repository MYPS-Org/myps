import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { ProgramEnums, ProgramPagination } from '../Model.d';
import type { TableEnum } from '../../Project/Model';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';

interface FilterDialogProgramListProps {
    isOpen: boolean;
    onClose: () => void;
    currentFilters: ProgramPagination;
    programEnums?: {
        Stages: TableEnum[];
        Types: TableEnum[];
        Groups: ProgramEnums[];
        DataSecurity: ProgramEnums[];
    };
    onApplyFilters: (filters: ProgramPagination) => void;
}

export const FilterDialogProgramList: React.FC<FilterDialogProgramListProps> = ({
    isOpen,
    onClose,
    currentFilters,
    programEnums,
    onApplyFilters
}) => {
    const [localFilters, setLocalFilters] = useState<ProgramPagination>(currentFilters);

    // Update local filters when dialog opens or currentFilters change
    useEffect(() => {
        setLocalFilters(currentFilters);
    }, [currentFilters, isOpen]);

    const handleApply = () => {
        onApplyFilters({
            ...localFilters,
            page: 1 // Reset to first page when applying filters
        });
        onClose();
    };

    const handleClear = () => {
        const clearedFilters: ProgramPagination = {
            ...currentFilters,
            filters: {
                Name: currentFilters.filters?.Name || '', // Keep the search term
                YearStart: '',
                GroupName: '',
                StageName: '',
            },
            page: 1
        };
        setLocalFilters(clearedFilters);
        onApplyFilters(clearedFilters);
        onClose();
    };

    const handleFilterChange = (field: string, value: string) => {
        setLocalFilters(prev => ({
            ...prev,
            filters: {
                ...prev.filters,
                [field]: value
            }
        }));
    };

    // Generate year options (e.g., from 2000 to current year + 10)
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: currentYear - 1999 + 10 }, (_, i) => (2000 + i).toString());

    const hasActiveFilters = localFilters.filters?.YearStart || 
                            localFilters.filters?.GroupName || 
                            localFilters.filters?.StageName;

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
                            Filter Programs
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
                            Apply filters to narrow down the program list. The search term will be preserved.
                        </p>

                        {/* Year Start Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Year
                            </label>
                            <select
                                name="YearStart"
                                value={localFilters.filters?.YearStart || ''}
                                onChange={(e) => handleFilterChange('YearStart', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="">All Years</option>
                                {yearOptions.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        {/* Program Group Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Program Group
                            </label>
                            <select
                                name="GroupName"
                                value={localFilters.filters?.GroupName || ''}
                                onChange={(e) => handleFilterChange('GroupName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="">All Groups</option>
                                {programEnums?.Groups?.map(group => (
                                    <option key={group.Id} value={group.GroupName}>
                                        {group.GroupName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Program Stage Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Program Stage
                            </label>
                            <select
                                name="StageName"
                                value={localFilters.filters?.StageName || ''}
                                onChange={(e) => handleFilterChange('StageName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                            >
                                <option value="">All Stages</option>
                                {programEnums?.Stages?.map(stage => (
                                    <option key={stage.Id} value={stage.Name}>
                                        {stage.Name}
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
                                    {localFilters.filters?.YearStart && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">
                                            <span className="font-medium">Start Year:</span>
                                            {localFilters.filters.YearStart}
                                        </span>
                                    )}

                                    {localFilters.filters?.GroupName && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">
                                            <span className="font-medium">Group:</span>
                                            {localFilters.filters.GroupName}
                                        </span>
                                    )}

                                    {localFilters.filters?.StageName && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-blue-800 ring-1 ring-blue-200">
                                            <span className="font-medium">Stage:</span>
                                            {localFilters.filters.StageName}
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
