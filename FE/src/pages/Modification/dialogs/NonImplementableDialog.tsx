import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ComponentCost } from '../../Project/Model';

interface NonImplementableDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedComponents: string[]) => void;
    componentCosts: ComponentCost[];
    projectId?: string;
}

interface ComponentWithStatus extends ComponentCost {
    pcmaStatus?: string;
    constructionStatus?: string;
    isSelected?: boolean;
}

const NonImplementableDialog: React.FC<NonImplementableDialogProps> = ({ 
    isOpen, 
    onClose,
    onConfirm,
    componentCosts,
    projectId
}) => {
    const { showToast } = useToast();
    const [components, setComponents] = useState<ComponentWithStatus[]>(() => 
        componentCosts.map(cost => ({
            ...cost,
            // Mock statuses - replace with actual data from API
            pcmaStatus: 'Not Yet Started',
            constructionStatus: 'Not Yet Started',
            isSelected: false
        }))
    );

    const handleToggleComponent = (componentId: string) => {
        setComponents(prev => 
            prev.map(comp => 
                comp.ComponentId === componentId 
                    ? { ...comp, isSelected: !comp.isSelected }
                    : comp
            )
        );
    };

    const handleToggleAll = () => {
        const allSelected = components.every(comp => comp.isSelected);
        setComponents(prev => 
            prev.map(comp => ({ ...comp, isSelected: !allSelected }))
        );
    };

    const handleSubmit = () => {
        const selectedComponentIds = components
            .filter(comp => comp.isSelected)
            .map(comp => comp.ComponentId || '');

        if (selectedComponentIds.length === 0) {
            showToast({
                type: 'error',
                message: 'Please select at least one component to mark as non-implementable.'
            });
            return;
        }

        onConfirm(selectedComponentIds);
        onClose();
    };

    const selectedCount = components.filter(comp => comp.isSelected).length;
    const allSelected = components.length > 0 && components.every(comp => comp.isSelected);

    const getStatusBadgeClass = (status?: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'on-going':
            case 'ongoing':
                return 'bg-blue-100 text-blue-800';
            case 'packaged':
                return 'bg-purple-100 text-purple-800';
            case 'not yet started':
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-6xl bg-white rounded-lg shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Non-Implementable Components Selection
                            </DialogTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Project ID: {projectId} • Select components to mark as non-implementable
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {/* Info Banner */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Select the components that should be marked as non-implementable. 
                                This action will update the status of the selected components.
                            </p>
                        </div>

                        {/* Selection Summary */}
                        {selectedCount > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-sm text-amber-800">
                                    <strong>{selectedCount}</strong> component{selectedCount !== 1 ? 's' : ''} selected
                                </p>
                            </div>
                        )}

                        {/* Components Table */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHead className="sticky top-0 bg-gray-50 z-10">
                                        <TableRow>
                                            <TableHeader className="w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={handleToggleAll}
                                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    title="Select all"
                                                />
                                            </TableHeader>
                                            <TableHeader>Component Type</TableHeader>
                                            <TableHeader>Component ID</TableHeader>
                                            <TableHeader>Description</TableHeader>
                                            <TableHeader>PCMA Status</TableHeader>
                                            <TableHeader>Construction Status</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {components.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                                    No components available
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            components.map((component) => (
                                                <TableRow 
                                                    key={component.ComponentId}
                                                    className={component.isSelected ? 'bg-blue-50' : ''}
                                                >
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            checked={component.isSelected || false}
                                                            onChange={() => handleToggleComponent(component.ComponentId || '')}
                                                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {component.ComponentType}
                                                    </TableCell>
                                                    <TableCell>
                                                        {component.ComponentId}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="max-w-xs truncate" title={component.Description}>
                                                            {component.Description}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(component.pcmaStatus)}`}>
                                                            {component.pcmaStatus || 'N/A'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(component.constructionStatus)}`}>
                                                            {component.constructionStatus || 'N/A'}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-lg">
                        <div className="text-sm text-gray-600">
                            {selectedCount > 0 ? (
                                <span className="font-medium text-blue-600">
                                    {selectedCount} of {components.length} component{components.length !== 1 ? 's' : ''} selected
                                </span>
                            ) : (
                                <span>
                                    No components selected
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                color="blue"
                                onClick={handleSubmit}
                                disabled={selectedCount === 0}
                            >
                                Confirm Selection
                            </Button>
                        </div>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
};

export default NonImplementableDialog;
