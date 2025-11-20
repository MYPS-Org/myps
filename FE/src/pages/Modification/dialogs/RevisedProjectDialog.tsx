import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { useDropDownData } from "../hooks/useDropDown";
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';
import type { ProjectDetails, ComponentCost, ComponentCostYear, MajorItemOfWork, MajorItemLocations, FundingProfile } from '../../Project/Model';
import { submitModificationRequest } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface ReviseProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectDetails;
    componentCosts: ComponentCost[];
    componentCostYear: ComponentCostYear[];
    majorItemOfWorks: MajorItemOfWork[];
    majorItemLocations: MajorItemLocations[];
    fundingProfile: FundingProfile[];
}

const ReviseProjectDialog: React.FC<ReviseProjectDialogProps> = ({ 
    isOpen, 
    onClose, 
    project,
    componentCosts,
    componentCostYear,
    majorItemOfWorks,
    majorItemLocations,
    fundingProfile
}) => {
    const {
        initializeData
    } = useDropDownData();

    const { showToast } = useToast();
    const [approvalDate, setApprovalDate] = useState<string>('');
    const [approvalDocument, setApprovalDocument] = useState<File | null>(null);
    const [revisionReason, setRevisionReason] = useState<string>('');
    const [revisionType] = useState<string>('modification');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        initializeData();
    }, [initializeData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setApprovalDocument(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
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

        setIsSubmitting(true);

        try {
            // Prepare the payload
            const payload = {
                ProjectDetails: project,
                ComponentCosts: componentCosts,
                ComponentCostYear: componentCostYear,
                MajorItemOfWorks: majorItemOfWorks,
                MajorItemLocations: majorItemLocations,
                FundingProfile: fundingProfile,
                RevisionReason: revisionReason,
                RevisionType: revisionType,
                ApprovalDate: approvalDate,
                FileAttachments: [approvalDocument.name] // You may need to handle file upload separately
            };

            console.log('Submitting modification request with payload:', payload);

            await submitModificationRequest(payload);

            showToast({
                type: 'success',
                message: 'Modification request submitted successfully.'
            });

            onClose();
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
                            Modify Project
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
                                <p className="text-gray-600">Modification</p>
                            </div>
                            <div className="col-span-2">
                                <span className="font-medium text-gray-700">Description:</span>
                                <p className="text-gray-600">{project.Description}</p>
                            </div>
                        </div>
                    </div>

                    {/* Revision Details */}
                    <div className='space-y-2'>
                        <div className='flex justify-between gap-5 items-center'>
                            <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                *Date of Approval :
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
                                *Approval Document :
                            </label>
                            <input 
                                type="file" 
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileChange}
                                required
                                className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                            />
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
export default ReviseProjectDialog;