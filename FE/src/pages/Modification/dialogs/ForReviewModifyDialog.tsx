import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ProjectDetails } from '../../Project/Model';
import { EnumRevisionStatus } from '../Model';
import { updateRevisionRequestStatus } from '../Service';
import { transactionIdAtom } from '../store/routeContextStore';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';

interface ForReviewModifyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
    category?: string;
    reason?: string;
    onSuccess?: () => void;
}

const ForReviewModifyDialog: React.FC<ForReviewModifyDialogProps> = ({ 
    isOpen, 
    onClose, 
    project,
    category,
    reason,
    onSuccess
}) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [reviewComments, setReviewComments] = useState<string>('');
    const transactionId = useAtomValue(transactionIdAtom);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!reviewComments.trim()) {
            showToast({
                type: 'error',
                message: 'Please provide review comments explaining what needs to be changed.'
            });
            return;
        }

        setIsSubmitting(true);
        
        try {
            await updateRevisionRequestStatus(transactionId, EnumRevisionStatus.ForCorrection, undefined, undefined, reviewComments);
            
            showToast({
                type: 'success',
                message: 'Modification request sent back for review. The requester will be notified.'
            });
            
            setReviewComments('');
            onClose();
            
            // Call onSuccess callback if provided, otherwise navigate to list
            if (onSuccess) {
                onSuccess();
            } else {
                navigate('/revision');
            }
        } catch (error) {
            console.error('Error submitting for review:', error);
            showToast({
                type: 'error',
                message: 'Failed to submit review request.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            
            {/* Full-screen container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Request Changes for {category}
                            </DialogTitle>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                            disabled={isSubmitting}
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleSubmit}>
                        <div className="p-6 space-y-6">
                            {/* Warning Message */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800 font-medium">
                                    This modification request requires additional assessment or changes.
                                </p>
                                <p className="text-sm text-amber-700 mt-2">
                                    The request will be sent back to the requester with your comments for revision.
                                </p>
                            </div>

                            {/* Project Information */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">Project Information</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Project ID:</span>
                                        <p className="text-gray-600">{project.ProjectId}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Revision Number:</span>
                                        <p className="text-gray-600">{transactionId}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-medium text-gray-700">Description:</span>
                                        <p className="text-gray-600">{project.Description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Modification Details */}
                            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">{category} Details</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {category && (
                                        <div>
                                            <span className="font-medium text-gray-700">Category:</span>
                                            <p className="text-gray-600">{category}</p>
                                        </div>
                                    )}
                                    {reason && (
                                        <div>
                                            <span className="font-medium text-gray-700">Reason:</span>
                                            <p className="text-gray-600">{reason}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Review Comments - Required */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    *Review Comments
                                </label>
                                <textarea
                                    value={reviewComments}
                                    onChange={(e) => setReviewComments(e.target.value)}
                                    placeholder="Describe what changes or additional information is needed..."
                                    rows={5}
                                    required
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    disabled={isSubmitting}
                                />
                                <p className="text-xs text-gray-500">
                                    Please provide specific details about what needs to be revised or clarified.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                            <Button
                                type="submit"
                                color="amber"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Sending...' : 'Send for Review'}
                            </Button>
                            <Button
                                type="button"
                                onClick={onClose}
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

export default ForReviewModifyDialog;
