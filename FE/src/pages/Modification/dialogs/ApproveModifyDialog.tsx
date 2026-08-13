import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import CheckCircleIcon from '@heroicons/react/24/outline/CheckCircleIcon';
import DocumentArrowUpIcon from '@heroicons/react/24/outline/DocumentArrowUpIcon';
import DocumentIcon from '@heroicons/react/24/outline/DocumentIcon';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ProjectDetails } from '../../Project/Model';
import type { FileUpload } from '../Model';
import { EnumRevisionStatus } from '../Model';
import { useAtomValue } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';
import { updateRevisionRequestStatus } from '../Service';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB, matches backend's max upload size

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
    const [approvalDocument, setApprovalDocument] = useState<FileUpload | null>(null);
    const transactionId = useAtomValue(transactionIdAtom); // Get transactionId from atom

    // CO (AUC) approval requires an approval document; RO (RPC) approval does not.
    const isCentralOffice = !!user?.UserGroupNames.find((x) => x === 'AUC');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                showToast({
                    type: 'error',
                    message: 'Please select a PDF file only.'
                });
                e.target.value = '';
                return;
            }

            if (file.size > MAX_FILE_SIZE_BYTES) {
                showToast({
                    type: 'error',
                    message: 'File size must not exceed 50 MB.'
                });
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setApprovalDocument({
                    Name: file.name,
                    Extension: file.name.split('.').pop() || '',
                    ContentType: file.type,
                    DataUrl: reader.result as string,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleApprove = async () => {
        if (isCentralOffice && !approvalDocument) {
            showToast({
                type: 'error',
                message: 'Please upload the CO approval document.'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await updateRevisionRequestStatus(
                transactionId,
                EnumRevisionStatus.Approved,
                isCentralOffice ? approvalDocument ?? undefined : undefined
            );

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

                        {/* CO Approval Document - required for Central Office (AUC) approval only */}
                        {isCentralOffice && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    *CO Approval Document (PDF only)
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
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                        <Button
                            type="button"
                            color="green"
                            onClick={handleApprove}
                            disabled={isSubmitting || (isCentralOffice && !approvalDocument)}
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
