import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import WorkLocationTable from './WorkLocationTable';

interface WorkLocation {
    id: number;
    infraId: string;
    detailedScope: string;
    from?: number;
    to?: number;
    physicalTarget: number;
}

interface MajorItem {
    id: number;
    component: string;
    yearOfWork: number;
    typeOfWork: string;
    infraType: string;
    targetUnit: string;
    workLocations: WorkLocation[];
}

interface MajorItemWorkLocationTableProps {
    majorItems: MajorItem[];
    selectedItems?: number[];
    onItemSelect?: (index: number) => void;
    showSelection?: boolean;
    readOnly?: boolean;
    onWorkLocationEdit?: (majorItemIndex: number, locationId: number, field: string, value: any) => void;
    onWorkLocationDelete?: (majorItemIndex: number, locationId: number) => void;
    onWorkLocationAdd?: (majorItemIndex: number) => void;
    title?: string;
    description?: string;
}

const MajorItemWorkLocationTable: React.FC<MajorItemWorkLocationTableProps> = ({
    majorItems,
    selectedItems = [],
    onItemSelect,
    showSelection = false,
    readOnly = false,
    onWorkLocationEdit,
    onWorkLocationDelete,
    onWorkLocationAdd,
    title = "Major Items and Work Locations",
    description = "Review and manage major items with their work locations"
}) => {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const toggleRowExpansion = (index: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedRows(newExpanded);
    };

    const handleItemSelection = (index: number) => {
        if (onItemSelect && !readOnly) {
            onItemSelect(index);
        }
    };

    const handleWorkLocationEdit = (majorItemIndex: number) => (locationId: number, field: string, value: any) => {
        if (onWorkLocationEdit && !readOnly) {
            onWorkLocationEdit(majorItemIndex, locationId, field, value);
        }
    };

    const handleWorkLocationDelete = (majorItemIndex: number) => (locationId: number) => {
        if (onWorkLocationDelete && !readOnly) {
            onWorkLocationDelete(majorItemIndex, locationId);
        }
    };

    const handleWorkLocationAdd = (majorItemIndex: number) => () => {
        if (onWorkLocationAdd && !readOnly) {
            onWorkLocationAdd(majorItemIndex);
        }
    };

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="mb-4">
                <h4 className="text-md font-medium text-gray-700 mb-2">{title}</h4>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
            
            <div className="overflow-x-auto">
                <Table>
                    <TableHead>
                        <TableRow>
                            {showSelection && <TableHeader className="min-w-[40px]">Select</TableHeader>}
                            <TableHeader className="min-w-[40px]"></TableHeader>
                            <TableHeader className="min-w-[120px]">Component</TableHeader>
                            <TableHeader className="min-w-[100px]">Year of Work</TableHeader>
                            <TableHeader className="min-w-[140px]">Type of Work</TableHeader>
                            <TableHeader className="min-w-[100px]">Infra Type</TableHeader>
                            <TableHeader className="min-w-[100px]">Target Unit</TableHeader>
                            <TableHeader className="min-w-[120px]">Work Targets</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {majorItems.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <TableRow className="border-b">
                                    {showSelection && (
                                        <TableCell>
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.includes(index)}
                                                onChange={() => handleItemSelection(index)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                disabled={readOnly}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <div
                                            onClick={() => toggleRowExpansion(index)}
                                            className="p-1 hover:bg-gray-100 rounded"
                                            // disabled={readOnly && item.workLocations.length === 0}
                                        >
                                            {expandedRows.has(index) ? (
                                                <ChevronDownIcon className="w-4 h-4" />
                                            ) : (
                                                <ChevronRightIcon className="w-4 h-4" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.component}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.yearOfWork}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.typeOfWork}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.infraType}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.targetUnit}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-gray-600">
                                            {item.workLocations.length} Target(s)
                                        </div>
                                    </TableCell>
                                </TableRow>
                                
                                {/* Expanded row for work locations */}
                                {expandedRows.has(index) && (
                                    <TableRow className="bg-gray-50">
                                        <TableCell colSpan={showSelection ? 8 : 7} className="p-4">
                                            <div className="space-y-2">
                                                <h5 className="text-sm font-medium text-gray-700">Work Locations:</h5>
                                                <WorkLocationTable
                                                    workLocations={item.workLocations}
                                                    onEdit={handleWorkLocationEdit(index)}
                                                    onDelete={handleWorkLocationDelete(index)}
                                                    onAdd={handleWorkLocationAdd(index)}
                                                    readOnly={readOnly}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default MajorItemWorkLocationTable;