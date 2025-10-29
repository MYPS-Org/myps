import React, { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { nextStage as proceedToNextStage } from '../Service';
import type { ProgramDetails, ProgramEnums } from '../Model';

interface NextStageDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { ProgramId: string; Stage: number; Name?: string }) => void;
    program: ProgramDetails;
    stages: ProgramEnums[];
}

const NextStageDialog: React.FC<NextStageDialogProps> = ({ 
    isOpen,
    onClose,
    onSubmit,
    program,
    stages 
}) => {
    
    const { showToast } = useToast();
    const nextStageId = program.StageId + 1;
    const nextStage = stages.find(stage => stage.Id === nextStageId);
    
    // Function to parse existing program name and split it
    const parseExistingName = (currentName: string) => {
        // Look for pattern like "StageName YYYY -" or "StageName YYYY - additional text"
        const dashIndex = currentName.indexOf(' -');
        if (dashIndex !== -1) {
            const baseName = currentName.substring(0, dashIndex); // Don't include " -"
            const additionalName = currentName.substring(dashIndex + 2).trim(); // Get text after " -"
            return {
                baseName: baseName,
                additionalName: additionalName
            };
        }
        // If no dash found, treat the whole name as base name
        return {
            baseName: currentName,
            additionalName: ''
        };
    };

    // Parse the current program name
    const parsedName = parseExistingName(program?.Name || '');
    
    const [formData, setFormData] = useState({
        ProgramId: program?.ProgramId || '',
        Name: parsedName.baseName,
        AddedName: parsedName.additionalName,
        Stage: nextStageId,
        StageName: nextStage?.Name || 'Final Stage',
        YearStart: program?.YearStart || new Date().getFullYear()
    });

    const [isLoading, setIsLoading] = useState(false);

    // Auto-generate suggested name based on next stage and year
    const generateSuggestedName = () => {
        if (nextStage && formData.YearStart) {
            return `${nextStage.Name} ${formData.YearStart}`;
        }
        return parsedName.baseName;
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => {
            const newFormData = { ...prev, [field]: value };
            
            // Auto-generate name when Stage or YearStart changes
            if (field === 'YearStart') {
                newFormData.Name = generateSuggestedName();
            }
            
            return newFormData;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        try {
            const payload = {
                ProgramId: formData.ProgramId,
                Stage: formData.Stage,
                Name: formData.AddedName && formData.AddedName.trim() 
                    ? `${formData.Name} - ${formData.AddedName}` 
                    : formData.Name
            };

            await proceedToNextStage({ ProgramId: payload.ProgramId, Stage: payload.Stage, Name: payload.Name });
            
            showToast({
                type: 'success',
                message: `Successfully proceeded to ${formData.StageName}!`,
            });
            
            onSubmit(payload);
            handleClose();
        } catch (error) {
            showToast({
                type: 'error',
                message: 'Failed to proceed to next stage. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        const resetParsedName = parseExistingName(program?.Name || '');
        setFormData({
            ProgramId: program?.ProgramId || '',
            Name: resetParsedName.baseName,
            AddedName: resetParsedName.additionalName,
            Stage: nextStageId,
            StageName: nextStage?.Name || 'Final Stage',
            YearStart: program?.YearStart || new Date().getFullYear()
        });
        onClose();
    };

    // Initialize suggested name on component mount and when program changes
    React.useEffect(() => {
        const currentParsedName = parseExistingName(program?.Name || '');
        setFormData(prev => ({
            ...prev,
            Name: generateSuggestedName(),
            AddedName: currentParsedName.additionalName
        }));
    }, [nextStageId, program.YearStart, program.Name]);

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-[9999] inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl p-6">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Proceed to Next Stage
                        </DialogTitle>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Stage
                                </label>
                                <input
                                    type="text"
                                    value={program.StageName}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Next Stage
                                </label>
                                <input
                                    type="text"
                                    value={formData.StageName}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-blue-50 text-blue-900 font-medium"
                                />
                            </div>

                            {/* <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Year
                                </label>
                                <input
                                    type="number"
                                    value={formData.YearStart}
                                    onChange={(e) => handleChange('YearStart', Number(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                                    required
                                />
                            </div> */}
                            
                            <div className="w-full">
                                    <div className='flex flex-row mb-4'>
                                        <div className='w-1/3'>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Base Program Name</label>
                                            <div className="items-center space-x-3">
                                            <input
                                                type="text"
                                                value={formData.Name}
                                                onChange={(e) => handleChange('Name', e.target.value)}
                                                className='w-full px-3 py-2 border rounded-l-md shadow-sm focus:outline-none focus:ring-2 bg-gray-200'
                                                required
                                                disabled
                                                placeholder="Auto-generated Name"
                                            />
                                            </div>
                                        </div>
                                        <div className='w-2/3'>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Name</label>
                                            <div className="items-center space-x-3">
                                            <input
                                                type="text"
                                                value={formData.AddedName}
                                                onChange={(e) => handleChange('AddedName', e.target.value)}
                                                className='w-full px-3 py-2 border-y border-r rounded-r-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                                                placeholder="Enter additional name (Optional)"
                                            />
                                            </div>
                                            {/* <p className="text-xs text-gray-500 mt-1">This was parsed from current name: "{parsedName.additionalName || 'None'}"</p> */}
                                        </div>
                                    </div>
                            </div>
                            {formData.AddedName && formData.AddedName.trim() && (
                                <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                                    <label className="block text-sm font-medium text-blue-700 mb-1">
                                        Final Program Name Preview:
                                    </label>
                                    <p className="text-blue-900 font-medium">
                                        {formData.Name} - {formData.AddedName}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <Button type="button" onClick={handleClose} color='zinc' disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" color='blue' disabled={isLoading}>
                                {isLoading ? 'Processing...' : `Proceed to ${formData.StageName}`}
                            </Button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
}

export default NextStageDialog;
    