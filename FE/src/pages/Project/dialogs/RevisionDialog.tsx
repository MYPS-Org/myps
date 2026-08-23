import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useNavigate } from 'react-router-dom';
import type { OptionRevisionCategory, OptionRevisionReasons, OptionRevisionHeader } from '../Model.d';
import { getRevisionNavigationPath } from '../../Modification/utils/revisionNavigation';

interface ReviseProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedRevHeaderId?: number;
    revHeaders?: OptionRevisionHeader[];
    categories?: OptionRevisionCategory[];
    reasons?: OptionRevisionReasons[];
    projectId?: string;
    stageName?: string;
}

const ReviseDialog: React.FC<ReviseProjectDialogProps> = ({ 
    isOpen, 
    onClose,
    projectId,
    stageName,
    selectedRevHeaderId,
    revHeaders,
    categories = [],
    reasons = []
}) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
    const [selectedReason, setSelectedReason] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Get the selected header's RevisionGroupId
    const selectedRevisionGroupId = useMemo(() => {
        return revHeaders?.find(header => header.Id === selectedRevHeaderId)?.RevisionGroupId;
    }, [revHeaders, selectedRevHeaderId]);

    // Filter categories based on RevisionGroupId
    const filteredCategories = useMemo(() => {
        if (!selectedRevisionGroupId) return [];
        return categories.filter(cat => cat.RevisionGroupId === selectedRevisionGroupId);
    }, [categories, selectedRevisionGroupId]);

    // Check if category dropdown should be shown
    const showCategoryDropdown = filteredCategories.length > 0;

    // Filter reasons based on RevisionGroupId and optionally by CategoryId
    const filteredReasons = useMemo(() => {
        if (!selectedRevisionGroupId) return [];

        return reasons.filter(reason => {
            // First check: must match RevisionGroupId
            if (reason.RevisionGroupId !== selectedRevisionGroupId) return false;
            
            // Second check: if category is selected, and this reason is restricted to specific
            // categories, it must match. Reasons with no CategoryId entries are unrestricted
            // and apply to any category in the group.
            if (selectedCategory && reason.CategoryId && reason.CategoryId.length > 0 && !reason.CategoryId.includes(selectedCategory)) return false;
            
            return true;
        });
    }, [reasons, selectedRevisionGroupId, selectedCategory]);

    // Reset selections when dialog opens or header changes
    useEffect(() => {
        if (isOpen) {
            setSelectedCategory('');
            setSelectedReason('');
        }
    }, [isOpen, selectedRevHeaderId]);

    // Reset reason when category changes (only if there's a value to reset)
    useEffect(() => {
        if (selectedReason) {
            setSelectedReason('');
        }
    }, [selectedCategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (showCategoryDropdown && !selectedCategory) {
            showToast({
                type: 'error',
                message: 'Please select a category.'
            });
            return;
        }

        if (!selectedReason) {
            showToast({
                type: 'error',
                message: 'Please select a reason.'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Get selected header name
            const selectedHeader = revHeaders?.find(h => h.Id === selectedRevHeaderId);
            const revisionTypeName = selectedHeader?.RevisionName || 'Revision';
            
            // Get category name if category was selected, otherwise use revision type name
            const categoryName = selectedCategory
                ? filteredCategories.find(cat => cat.CategoryId === selectedCategory)?.CategoryName || ''
                : '';
            
            // Use category name if available, otherwise use revision type name
            const categoryToSend = categoryName || revisionTypeName;
            
            // Get reason name
            const reasonName = filteredReasons.find(r => r.ReasonId === selectedReason)?.Reason || '';

            console.log('Selected revision type:', revisionTypeName);
            console.log('Selected category:', categoryName);
            console.log('Category to send:', categoryToSend);
            console.log('Selected reason:', reasonName);
            console.log('Revision Group ID:', selectedRevisionGroupId);

            // Get navigation path using utility function
            const navigationPath = getRevisionNavigationPath(
                selectedRevisionGroupId || 0,
                projectId || '',
                stageName || ''
            );

            console.log('Navigating to:', navigationPath);
            console.log('Navigation state being passed:', {
                stageName, 
                revisionTypeId: selectedRevHeaderId,
                revisionGroupId: selectedRevisionGroupId,
                revisionTypeDescription: revisionTypeName,
                categoryDesc: categoryToSend,
                reasonDesc: reasonName,
                categoryId: selectedCategory || null,
                reasonId: selectedReason
            });

            // Navigate with state
            navigate(navigationPath, { 
                state: { 
                    stageName, 
                    revisionTypeId: selectedRevHeaderId,
                    revisionGroupId: selectedRevisionGroupId,
                    revisionTypeDescription: revisionTypeName,
                    categoryDesc: categoryToSend,
                    reasonDesc: reasonName,
                    categoryId: selectedCategory || null,
                    reasonId: selectedReason
                } 
            });

            onClose();
        } catch (error) {
            console.error('Error processing revision request:', error);
            showToast({
                type: 'error',
                message: 'Failed to process revision request.'
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">

            <DialogPanel className="w-full max-w-3xl bg-white rounded-lg shadow-xl p-2">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            {revHeaders?.find(h => h.Id === selectedRevHeaderId)?.RevisionName || 'Revision'}
                        </DialogTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            Project ID: {projectId}
                        </p>
                    </div>
                    <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 "
                    >
                    <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Project Info */}
                    <div className='bg-gray-50 p-4 rounded-lg space-y-2'>
                        <h4 className="text-sm font-medium text-gray-900">Project Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Project ID:</span>
                                <p className="text-gray-600">{projectId}</p>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Revision Type:</span>
                                <p className="text-gray-600">
                                    {revHeaders?.find(h => h.Id === selectedRevHeaderId)?.RevisionName || 'Revision'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Revision Details */}
                    <div className='space-y-2'>
                        {showCategoryDropdown && (
                        <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                *Category:
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                                required
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            >
                                <option value="">Select Category</option>
                                {filteredCategories.map((cat) => (
                                    <option key={cat.Id} value={cat.CategoryId}>
                                        {cat.CategoryName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        )}

                        <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                *Reason:
                            </label>
                            <select
                                value={selectedReason}
                                onChange={(e) => setSelectedReason(e.target.value ? Number(e.target.value) : '')}
                                required
                                disabled={filteredReasons.length === 0}
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed'
                            >
                                <option value="">Select Reason</option>
                                {filteredReasons.map((reason) => (
                                    <option key={reason.Id} value={reason.ReasonId}>
                                        {reason.Reason}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className='pt-4 border border-gray-100 rounded-2xl px-4 flex justify-end gap-5'>
                        <Button
                            type="submit"
                            color="blue"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </Button>
                        <Button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >Cancel</Button>
                    </div>
                </form>
            </DialogPanel>
            </div>
        </Dialog>
    );
}
export default ReviseDialog;