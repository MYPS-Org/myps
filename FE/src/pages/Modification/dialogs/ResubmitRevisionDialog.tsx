import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { DateInput } from '../../../components/tailwindui/date-input';
import { XMarkIcon, DocumentArrowUpIcon, DocumentIcon } from '@heroicons/react/24/outline';
import type { ProjectDetails, ComponentCost, MajorItemOfWork, MajorItemLocations, FundingProfile, ComponentCostPerYear } from '../../Project/Model';
import { ResubmitRevisionRequest } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';
import { usePdfUpload } from '../hooks/usePdfUpload';
import { normalizeTempIds } from '../../../utils/GlobalFunctions';

interface ReviseProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
    componentCosts: ComponentCost[];
    componentsCostPerYear: ComponentCostPerYear[];
    majorItemOfWorks: MajorItemOfWork[];
    majorItemLocations: MajorItemLocations[];
    fundingProfile: FundingProfile[];
    revisionCategory?: string;
    revisionReason?: string;
    reasonId?: number;
    categoryId?: number;
    revisionGroupId?: number;
    projectStatus?: any;
}

const ResubmitRevisionDialog: React.FC<ReviseProjectDialogProps> = ({ 
    isOpen, 
    onClose, 
    project,
    componentCosts,
    componentsCostPerYear,
    majorItemOfWorks,
    majorItemLocations,
    fundingProfile,
    revisionCategory,
    revisionReason,
    reasonId,
    categoryId,
    // revisionGroupId,
    projectStatus
}) => {
    const navigate = useNavigate()
    const { showToast } = useToast();
    const { user } = useAuth(); // Get user from auth context
    const [revisionType] = useState<string>('');
    const [approvalDate, setApprovalDate] = useState<string>('');
    const { file: approvalDocument, handleFileChange, reset: resetApprovalDocument } = usePdfUpload();
    const [isCertified, setIsCertified] = useState<boolean>(false);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const transactionId = useAtomValue(transactionIdAtom); // Get transactionId from atom

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setApprovalDate('');
            resetApprovalDocument();
            setIsCertified(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Calculate totals for validation
        const totalComponentCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Total || 0), 0);
        const totalFundingAmount = fundingProfile.reduce((sum, funding) => sum + (funding.Amount || 0), 0);

        if (Math.abs(totalFundingAmount - totalComponentCost) > 0.01) {
            showToast({
                type: 'error',
                message: `Funding profile total (₱${totalFundingAmount.toLocaleString()}) must equal component costs total (₱${totalComponentCost.toLocaleString()}).`
            });
            return;
        }

        if (!approvalDate) {
            showToast({
                type: 'error',
                message: 'Please select an approval date.'
            });
            return;
        }

        if (!approvalDocument) {
            showToast({
                type: 'error',
                message: 'Please upload an approval document.'
            });
            return;
        }

        // const isDPC = user?.UserGroupNames === 'DPC';
        // if (isDPC && !isCertified) {
        //     showToast({
        //         type: 'error',
        //         message: 'Please certify that the attached document is accurate and aligned with the revisions.'
        //     });
        //     return;
        // }

        setIsSubmitting(true);

        try {
            // Prepare the payload
            const payload = {
                TransactionId: transactionId,
                RevisionDetails: {
                    CategoryId: categoryId ?? null,
                    ReasonId: reasonId || 0,
                    ApprovalDate: approvalDate,
                    ApprovedDocument: {
                        Name: approvalDocument.Name,
                        Extension: approvalDocument.Extension,
                        ContentType: approvalDocument.ContentType,
                        DataUrl: approvalDocument.DataUrl
                    },
                    PackageStatus: projectStatus?.PackageStatus,
                    ConstructionStatus: projectStatus?.ConstructionStatus
                },
                ProjectDetails: project,
                ComponentCosts: normalizeTempIds(componentCosts),
                ComponentCostPerYear: normalizeTempIds(componentsCostPerYear || []),
                MajorItemOfWorks: normalizeTempIds(majorItemOfWorks),
                MajorItemLocations: normalizeTempIds(majorItemLocations),
                FundingProfile: normalizeTempIds(fundingProfile),
            };

            console.log('Submitting resubmit request with payload:', payload);

            await ResubmitRevisionRequest(payload);
                
            showToast({
                type: 'success',
                message: 'Modification request resubmitted successfully.'
            });

            setApprovalDate('');
            resetApprovalDocument();
            setIsCertified(false);

            onClose();
            navigate('/revision');
        } catch (error) {
            console.error('Error submitting modification request:', error);
            showToast({
                type: 'error',
                message: 'Failed to submit modification request.'
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
                            Resubmit Project
                        </DialogTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            {project.ProjectId}
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
                                <p className="text-gray-600">{project.ProjectId}</p>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Current Revision:</span>
                                <p className="text-gray-600">{revisionType}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium text-gray-700">Description:</span>
                                <p className="text-gray-600">{project.Description}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Modification Details */}
                    {(revisionCategory || revisionReason) && (
                        <div className='bg-blue-50 p-4 rounded-lg space-y-2'>
                            <h4 className="text-sm font-medium text-gray-900">Modification Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {revisionCategory && (
                                    <div>
                                        <span className="font-medium text-gray-700">Category:</span>
                                        <p className="text-gray-600">{revisionCategory}</p>
                                    </div>
                                )}
                                {revisionReason && (
                                    <div>
                                        <span className="font-medium text-gray-700">Reason:</span>
                                        <p className="text-gray-600">{revisionReason}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Revision Details */}
                    <div className='space-y-2'>
                        <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                *Date of Approval :
                            </label>
                            <DateInput
                                value={approvalDate}
                                onChange={(e) => setApprovalDate(e.target.value)}
                                required
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
                        </div>
                        <div className='space-y-2'>
                            <label className='block text-sm font-medium text-gray-700'>
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
                                        required
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Certification Checkbox */}
                    {approvalDocument && (
                    <div className='bg-amber-50 border border-amber-200 p-4 rounded-lg'>
                        <label className='flex items-start gap-3 cursor-pointer'>
                            <input 
                                type="checkbox"
                                checked={isCertified}
                                onChange={(e) => setIsCertified(e.target.checked)}
                                className='mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-sm text-gray-700 flex-1'>
                                I hereby certify that the attached approval document is accurate, complete, and aligned with the revisions being submitted for this project.
                            </span>
                        </label>
                    </div>
                    )}

                    <div className='pt-4 border border-gray-100 rounded-2xl px-4 flex justify-end gap-5'>
                        <Button
                            type="submit"
                            color="blue"
                            disabled={isSubmitting || (user?.UserGroupNames.find((x) => x === 'DPC') && !isCertified)}
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
export default ResubmitRevisionDialog;