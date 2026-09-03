import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ProjectDetails } from '../../Project/Model';
import { rejectRevision } from '../Service';
import { transactionIdAtom } from '../store/routeContextStore';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';

interface RejectModifyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
    category?: string;
    reason?: string;
    onReject: (rejectionReason: string) => Promise<void>;
    onSuccess?: () => void;
}

const RejectModifyDialog: React.FC<RejectModifyDialogProps> = ({ 
    isOpen, 
    onClose, 
    project,
    category,
    reason,
    onReject,
    onSuccess
}) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const transactionId = useAtomValue(transactionIdAtom);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!rejectionReason.trim()) {
            showToast({
                type: 'error',
                message: `Please provide a reason for rejecting this ${category} request.`
            });
            return;
        }

        setIsSubmitting(true);
        
        try {
            // BE note: RejectRevisionDTO has no Remarks field yet, so rejectionReason isn't
            // persisted server-side — still collected/required here for the UI/audit expectation
            // and passed to onReject() for local handling.
            await rejectRevision(transactionId);
            await onReject(rejectionReason);
            
            showToast({
                type: 'success',
                message: `${category} request has been rejected. The requester will be notified.`
            });
            
            setRejectionReason('');
            onClose();
            
            // Call onSuccess callback if provided, otherwise navigate to list
            if (onSuccess) {
                onSuccess();
            } else {
                navigate('/revision');
            }
        } catch (error) {
            console.error(`Error rejecting ${category}:`, error);
            showToast({
                type: 'error',
                message: `Failed to reject ${category} request.`
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
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Disapproval {category} Request
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
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-800 font-medium">
                                    You are about to Disapprove this {category} request.
                                </p>
                                <p className="text-sm text-red-700 mt-2">
                                    This action will decline the proposed changes and notify the requester. Please provide a clear reason for disapproval.
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

                            {/* Rejection Reason - Required */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    *Reason for Rejection
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder={`Explain why this ${category} request is being rejected...`}
                                    rows={5}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    disabled={isSubmitting}
                                />
                                <p className="text-xs text-gray-500">
                                    Please provide a clear and detailed explanation for the rejection.
                                </p>
                            </div>

                            {/* Confirmation Warning */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-xs text-yellow-800">
                                    <strong>Note:</strong> Once rejected, the requester will need to submit a new {category} request if changes are still needed.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                            <Button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                color="red"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Rejecting...' : 'Reject Request'}
                            </Button>
                        </div>
                    </form>
                </DialogPanel>
            </div>
        </Dialog>
    );
};

export default RejectModifyDialog;
