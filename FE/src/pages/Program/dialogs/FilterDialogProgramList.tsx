import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from '../../../components/tailwindui/dialog';
import { Button } from '../../../components/tailwindui/button';
import { Field, Label } from '../../../components/tailwindui/fieldset';
import { Select } from '../../../components/tailwindui/select';
import type { ProgramEnums, ProgramPagination } from '../Model.d';
import type { TableEnum } from '../../Project/Model';

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
        <Dialog open={isOpen} onClose={onClose} size="2xl">
            <DialogTitle>Filter Programs</DialogTitle>
            <DialogDescription>
                Apply filters to narrow down the program list. The search term will be preserved.
            </DialogDescription>
            <DialogBody>
                <div className="space-y-4">
                    {/* Year Start Filter */}
                    <Field>
                        <Label>Start Year</Label>
                        <Select
                            name="YearStart"
                            value={localFilters.filters?.YearStart || ''}
                            onChange={(e) => handleFilterChange('YearStart', e.target.value)}
                        >
                            <option value="">All Years</option>
                            {yearOptions.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </Select>
                    </Field>

                    {/* Program Group Filter */}
                    <Field>
                        <Label>Program Group</Label>
                        <Select
                            name="GroupName"
                            value={localFilters.filters?.GroupName || ''}
                            onChange={(e) => handleFilterChange('GroupName', e.target.value)}
                        >
                            <option value="">All Groups</option>
                            {programEnums?.Groups?.map(group => (
                                <option key={group.Id} value={group.Name}>
                                    {group.Name}
                                </option>
                            ))}
                        </Select>
                    </Field>

                    {/* Program Stage Filter */}
                    <Field>
                        <Label>Program Stage</Label>
                        <Select
                            name="StageName"
                            value={localFilters.filters?.StageName || ''}
                            onChange={(e) => handleFilterChange('StageName', e.target.value)}
                        >
                            <option value="">All Stages</option>
                            {programEnums?.Stages?.map(stage => (
                                <option key={stage.Id} value={stage.Name}>
                                    {stage.Name}
                                </option>
                            ))}
                        </Select>
                    </Field>

                    {hasActiveFilters && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800 font-medium">Active Filters:</p>
                            <ul className="mt-2 space-y-1 text-sm text-blue-700">
                                {localFilters.filters?.YearStart && (
                                    <li>• Start Year: {localFilters.filters.YearStart}</li>
                                )}
                                {localFilters.filters?.GroupName && (
                                    <li>• Group: {localFilters.filters.GroupName}</li>
                                )}
                                {localFilters.filters?.StageName && (
                                    <li>• Stage: {localFilters.filters.StageName}</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </DialogBody>
            <DialogActions>
                <Button color="zinc" onClick={onClose}>
                    Cancel
                </Button>
                <Button color="red" onClick={handleClear}>
                    Clear Filters
                </Button>
                <Button color="blue" onClick={handleApply}>
                    Apply Filters
                </Button>
            </DialogActions>
        </Dialog>
    );
};
