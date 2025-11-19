import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import { categoryData as mockCategoryData, reasonData as mockReasonData } from '../../Modification/mockData/Dropdown';
import { useNavigate } from 'react-router-dom';

interface ReviseProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    category?: number;
    reason?: string;
    projectId?: string;
    stageName?: string;
}

const ReviseDialog: React.FC<ReviseProjectDialogProps> = ({ 
    isOpen, 
    onClose,
    projectId,
    stageName,
    category,
}) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
    const [selectedReason, setSelectedReason] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Filter categories to only show obsoleteFlag = 0
    const activeCategories = mockCategoryData.filter(cat => cat.ObsoleteFlag === 1);

    // Filter reasons based on selected category or category prop
    const effectiveCategory = category && category !== 19 ? category : selectedCategory;
    const filteredReasons = effectiveCategory 
        ? mockReasonData.filter(reason => reason.CodeGroupId === effectiveCategory)
        : [];

    // Set initial category if provided and not modification (19)
    useEffect(() => {
        if (category && category !== 19) {
            setSelectedCategory(category);
        }
    }, [category]);

    // Reset reason when category changes
    useEffect(() => {
        setSelectedReason('');
    }, [selectedCategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Use category prop if not modification, otherwise use selected category
        const finalCategory = category && category !== 19 ? category : selectedCategory;
        
        // Validation
        if (!finalCategory) {
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
            // Find category and reason descriptions
            const categoryDesc = mockCategoryData.find(cat => cat.Id === finalCategory)?.CodeDescription || '';
            const reasonDesc = mockReasonData.find(r => r.Id === selectedReason)?.CodeDescription || '';
            const categoryCodeGroupId = mockCategoryData.find(cat => cat.Id === finalCategory)?.CodeGroupId || 0;

            console.log('Selected category:', categoryDesc);
            console.log('Selected reason:', reasonDesc);
            console.log('Category CodeGroupId:', categoryCodeGroupId);

            // Determine navigation route based on category CodeGroupId
            let navigationPath = '';
            let revisionTypeId = 19; // Default to modification
            let revisionTypeDescription = categoryDesc;

            // Map CodeGroupId to routes based on your App.tsx routes
            switch (categoryCodeGroupId) {
                case 6: // Adjustment
                    navigationPath = `/revision/adjustment-details/${projectId}:${stageName}`;
                    revisionTypeId = 6;
                    break;
                case 7: // Change in Authority to Implement
                    navigationPath = `/revision/change-in-authority/${projectId}:${stageName}`;
                    revisionTypeId = 7;
                    break;
                case 10: // Additional Funding
                    navigationPath = `/revision/additional-funding/${projectId}:${stageName}`;
                    revisionTypeId = 10;
                    break;
                case 9: // Termination
                    navigationPath = `/revision/termination/${projectId}:${stageName}`;
                    revisionTypeId = 9;
                    break;
                default: // All other categories go to modification-details
                    navigationPath = `/revision/modification-details/${projectId}:${stageName}`;
                    revisionTypeId = 19;
                    break;
            }

            console.log('Navigating to:', navigationPath);

            // Navigate with state
            navigate(navigationPath, { 
                state: { 
                    stageName, 
                    revisionTypeId, 
                    revisionTypeDescription,
                    categoryDesc,
                    reasonDesc,
                    selectedCategoryId: finalCategory,
                    selectedReasonId: selectedReason
                } 
            });

            onClose();
        } catch (error) {
            console.error('Error processing modification request:', error);
            showToast({
                type: 'error',
                message: 'Failed to process modification request.'
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
                            Modify Project
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
                                    {mockCategoryData.find(cat => cat.Id === category)?.CodeDescription || 'Modification'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Revision Details */}
                    <div className='space-y-2'>
                        {category === 19 && (
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
                                {activeCategories.map((cat) => (
                                    <option key={cat.Id} value={cat.Id}>
                                        {cat.CodeDescription}
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
                                disabled={!effectiveCategory}
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed'
                            >
                                <option value="">Select Reason</option>
                                {filteredReasons.map((reason) => (
                                    <option key={reason.Id} value={reason.Id}>
                                        {reason.CodeDescription}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                *Date of Approval:
                            </label>
                            <input 
                                type="date" 
                                value={approvalDate}
                                onChange={(e) => setApprovalDate(e.target.value)}
                                required
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </div>
                        <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                *Approval Document:
                            </label>
                            <input 
                                type="file" 
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileChange}
                                required
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </div> */}
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