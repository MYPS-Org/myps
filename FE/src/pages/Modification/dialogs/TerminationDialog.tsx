import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import QuestionMarkCircleIcon from '@heroicons/react/24/outline/QuestionMarkCircleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ProjectDetails } from '../../Project/Model';

interface TerminationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
    category?: string;
    reason?: string;
    onSubmitTermination: (hasUnfinishedWork: boolean) => Promise<void>;
}

const TerminationDialog: React.FC<TerminationDialogProps> = ({ 
    isOpen, 
    onClose, 
    project,
    category,
    reason,
    onSubmitTermination
}) => {
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [hasUnfinishedWork, setHasUnfinishedWork] = useState<boolean | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (hasUnfinishedWork === null) {
            showToast({
                type: 'error',
                message: 'Please select Yes or No.'
            });
            return;
        }

        setIsSubmitting(true);
        
        try {
            await onSubmitTermination(hasUnfinishedWork);
            
            showToast({
                type: 'success',
                message: 'Has Unfinished Work status was picked.'
            });
            
            setHasUnfinishedWork(null);
            onClose();
        } catch (error) {
            console.error('Error submitting termination:', error);
            showToast({
                type: 'error',
                message: 'Failed to submit termination request.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setHasUnfinishedWork(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onClose={handleClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <QuestionMarkCircleIcon className="h-6 w-6 text-blue-600" />
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Project Termination
                            </DialogTitle>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600"
                            disabled={isSubmitting}
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleSubmit}>
                        <div className="p-6 space-y-6">
                            {/* Project Information */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">Project Information</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Project ID:</span>
                                        <p className="text-gray-600">{project.ProjectId}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-gray-700">Description:</span>
                                        <p className="text-gray-600">{project.Description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Modification Details */}
                            {(category || reason) && (
                                <div className="bg-red-50 p-4 rounded-lg space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-900">Termination Details</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        {category && (
                                            <div>
                                                <span className="font-medium text-gray-700">Category:</span>
                                                <p className="text-gray-600">{category}</p>
                                            </div>
                                        )}
                                        {reason && (
                                            <div className="col-span-2">
                                                <span className="font-medium text-gray-700">Reason:</span>
                                                <p className="text-gray-600">{reason}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Question */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-base font-medium text-blue-900 mb-4">
                                    Is the unfinished work balance to be completed by other means?
                                </p>
                                
                                {/* Yes/No Options */}
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="hasUnfinishedWork"
                                            checked={hasUnfinishedWork === true}
                                            onChange={() => setHasUnfinishedWork(true)}
                                            disabled={isSubmitting}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-900">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="hasUnfinishedWork"
                                            checked={hasUnfinishedWork === false}
                                            onChange={() => setHasUnfinishedWork(false)}
                                            disabled={isSubmitting}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-900">No</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                            <Button
                                type="submit"
                                color="red"
                                disabled={isSubmitting || hasUnfinishedWork === null}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Termination'}
                            </Button>
                            <Button
                                type="button"
                                onClick={handleClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
};

export default TerminationDialog;