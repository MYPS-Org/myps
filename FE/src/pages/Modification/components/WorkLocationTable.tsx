import React from 'react';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface WorkLocation {
    id: number;
    infraId: string;
    detailedScope: string;
    from?: number;
    to?: number;
    physicalTarget: number;
}

interface WorkLocationTableProps {
    workLocations: WorkLocation[];
    onAdd?: () => void;
    onEdit?: (locationId: number, field: string, value: any) => void;
    onDelete?: (locationId: number) => void;
    readOnly?: boolean;
}

const WorkLocationTable: React.FC<WorkLocationTableProps> = ({
    workLocations,
    onAdd,
    onEdit,
    onDelete,
    readOnly = false
}) => {
    const handleFieldChange = (locationId: number, field: string, value: any) => {
        if (onEdit && !readOnly) {
            onEdit(locationId, field, value);
        }
    };

    const handleDelete = (locationId: number) => {
        if (onDelete && !readOnly) {
            onDelete(locationId);
        }
    };

    const handleAdd = () => {
        if (onAdd && !readOnly) {
            onAdd();
        }
    };

    return (
        <div className="space-y-4">
            {workLocations.map((location) => (
                <div key={location.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div>
                        <div className="flex space-x-1 justify-between mb-2">
                            <h5 className="text-sm font-medium text-gray-700">Work Location ID: {location.id}</h5>
                            {!readOnly && onDelete && (
                                <Button 
                                    color="red" 
                                    className="text-xs px-2 py-1"
                                    onClick={() => handleDelete(location.id)}
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Infrastructure ID</label>
                            <input
                                type="text"
                                value={location.infraId}
                                onChange={(e) => handleFieldChange(location.id, 'infraId', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                readOnly={readOnly}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Physical Target</label>
                            <input
                                type="number"
                                value={location.physicalTarget}
                                onChange={(e) => handleFieldChange(location.id, 'physicalTarget', Number(e.target.value))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                readOnly={readOnly}
                            />
                        </div>
                        {location.from !== undefined && location.to !== undefined && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">From (km)</label>
                                    <input
                                        type="number"
                                        value={location.from}
                                        onChange={(e) => handleFieldChange(location.id, 'from', Number(e.target.value))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        readOnly={readOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">To (km)</label>
                                    <input
                                        type="number"
                                        value={location.to}
                                        onChange={(e) => handleFieldChange(location.id, 'to', Number(e.target.value))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        readOnly={readOnly}
                                    />
                                </div>
                            </>
                        )}
                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Detailed Scope</label>
                            <textarea
                                value={location.detailedScope}
                                onChange={(e) => handleFieldChange(location.id, 'detailedScope', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                rows={2}
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                </div>
            ))}
            {!readOnly && onAdd && (
                <div className="flex justify-center">
                    <Button 
                        color="blue" 
                        className="text-sm px-3 py-1"
                        onClick={handleAdd}
                    >
                        <PlusIcon className="w-4 h-4 mr-1" />
                        Add Work Location
                    </Button>
                </div>
            )}
        </div>
    );
};

export default WorkLocationTable;
