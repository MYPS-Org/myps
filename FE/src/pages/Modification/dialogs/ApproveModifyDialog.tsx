import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import CheckCircleIcon from '@heroicons/react/24/outline/CheckCircleIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ProjectDetails } from '../../Project/Model';
import { useAtomValue } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';
import { updateRevisionRequestStatus } from '../Service';
import { useNavigate } from 'react-router-dom';

interface ApproveModifyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
    category?: string;
    reason?: string;
    onApprove: () => Promise<void>;
    onSuccess?: () => void;
}

const ApproveModifyDialog: React.FC<ApproveModifyDialogProps> = ({ 
    isOpen, 
    onClose, 
    project,
    category,
    reason,
    onApprove,
    onSuccess
}) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [remarks, setRemarks] = useState<string>('');
    const transactionId = useAtomValue(transactionIdAtom); // Get transactionId from atom

    const handleApprove = async () => {
        setIsSubmitting(true);
        
        console.log('Approving modification for Transaction ID:', transactionId);
        try {
            await updateRevisionRequestStatus(transactionId, 1); // 2 = Approved
            // await onApprove();
            
            showToast({
                type: 'success',
                message: 'Modification request approved successfully. Changes will be published to MYPS, PCMA, and other applications.'
            });
            
            onClose();
            
            // Call onSuccess callback if provided, otherwise navigate to list
            if (onSuccess) {
                onSuccess();
            } else {
                navigate('/revision');
            }
        } catch (error) {
            console.error('Error approving modification request:', error);
            showToast({
                type: 'error',
                message: 'Failed to approve modification request.'
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
                            <CheckCircleIcon className="h-6 w-6 text-green-600" />
                            <DialogTitle className="text-lg font-semibold text-gray-900">
                                Approve Modification Request
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
                    <div className="p-6 space-y-6">
                        {/* Warning Message */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-800 font-medium">
                                Are you sure you want to approve this revision?
                            </p>
                            <p className="text-sm text-green-700 mt-2">
                                This will update the project to central office.
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
                            <h4 className="text-sm font-semibold text-gray-900">Modification Details</h4>
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

                        {/* Approval Remarks */}
                        {/* <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Approval Remarks (Optional)
                            </label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Add any remarks about this approval..."
                                rows={3}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                disabled={isSubmitting}
                            />
                        </div> */}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                        <Button
                            type="button"
                            color="green"
                            onClick={handleApprove}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Approving...' : 'Approve Revision'}
                        </Button>
                        <Button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                    </div>
                </DialogPanel>
            </div>
        </Dialog>
    );
};

export default ApproveModifyDialog;
