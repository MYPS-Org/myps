import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import CheckCircleIcon from '@heroicons/react/24/outline/CheckCircleIcon';
import DocumentArrowUpIcon from '@heroicons/react/24/outline/DocumentArrowUpIcon';
import DocumentIcon from '@heroicons/react/24/outline/DocumentIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ProjectDetails } from '../../Project/Model';
import { useAtomValue } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';
import { approveRevision } from '../Service';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePdfUpload } from '../hooks/usePdfUpload';

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
    // onApprove,
    onSuccess
}) => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const { file: approvalDocument, handleFileChange } = usePdfUpload();
    const [isCertified, setIsCertified] = useState<boolean>(false);
    const transactionId = useAtomValue(transactionIdAtom); // Get transactionId from atom

    // CO (AUC) approval requires an approval document; RO (RPC) approval does not.
    const isCentralOffice = !!user?.UserGroupNames.find((x) => x === 'AUC');

    const handleApprove = async () => {
        if (isCentralOffice && !approvalDocument) {
            showToast({
                type: 'error',
                message: 'Please upload the CO approval document.'
            });
            return;
        }

        if (isCentralOffice && !isCertified) {
            showToast({
                type: 'error',
                message: 'Please certify that the attached document is accurate and aligned with the revisions.'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await approveRevision(
                transactionId,
                isCentralOffice ? approvalDocument ?? undefined : undefined
            );

            showToast({
                type: 'success',
                message: isCentralOffice
                    ? 'Modification request approved successfully. Changes will be published to MYPS, PCMA, and other applications.'
                    : 'Modification request endorsed successfully. It has been forwarded to the Central Office for approval.'
            });

            onClose();

            // Call onSuccess callback if provided, otherwise navigate to list
            if (onSuccess) {
                onSuccess();
            } else {
                navigate('/revision');
            }
        } catch (error) {
            console.error(isCentralOffice ? 'Error approving modification request:' : 'Error endorsing modification request:', error);
            showToast({
                type: 'error',
                message: isCentralOffice ? 'Failed to approve modification request.' : 'Failed to endorse modification request.'
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
                                {isCentralOffice ? 'Approve Modification Request' : 'Endorse Modification Request'}
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
                                {isCentralOffice
                                    ? 'Are you sure you want to approve this revision?'
                                    : 'Are you sure you want to endorse this revision to the Central Office?'}
                            </p>
                            <p className="text-sm text-green-700 mt-2">
                                {isCentralOffice
                                    ? 'The proposed revisions will be applied and subsequently published to PCMA.'
                                    : 'This will forward the project to the Central Office (CO) for final approval.'}
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

                        {/* CO Approval Document - required for Central Office (AUC) approval only */}
                        {isCentralOffice && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    *Approval Document (PDF only)
                                </label>
                                <div className="relative">
                                    <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            {approvalDocument ? (
                                                <>
                                                    <DocumentIcon className="w-8 h-8 mb-2 text-green-500" />
                                                    <p className="text-sm text-gray-700 font-medium">{approvalDocument.Name}</p>
                                                    <p className="text-xs text-gray-500">PDF file selected</p>
                                                </>
                                            ) : (
                                                <>
                                                    <DocumentArrowUpIcon className="w-8 h-8 mb-2 text-gray-400" />
                                                    <p className="mb-2 text-sm text-gray-500">
                                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs text-gray-500">PDF files only</p>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            onChange={handleFileChange}
                                            disabled={isSubmitting}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Certification Checkbox - required for Central Office (AUC) approval only */}
                        {isCentralOffice && approvalDocument && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isCertified}
                                        onChange={(e) => setIsCertified(e.target.checked)}
                                        disabled={isSubmitting}
                                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 flex-1">
                                        I hereby certify that the attached approval document is accurate, complete, and aligned with the revisions being submitted for this project.
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                        <Button
                            type="button"
                            color="green"
                            onClick={handleApprove}
                            disabled={isSubmitting || (isCentralOffice && (!approvalDocument || !isCertified))}
                        >
                            {isCentralOffice
                                ? (isSubmitting ? 'Approving...' : 'Approve Revision')
                                : (isSubmitting ? 'Endorsing...' : 'Endorse Revision')}
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
