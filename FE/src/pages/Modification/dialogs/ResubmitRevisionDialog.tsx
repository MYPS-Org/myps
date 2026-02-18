import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon} from '@heroicons/react/24/outline';
import type { ProjectDetails, ComponentCost, MajorItemOfWork, MajorItemLocations, FundingProfile, ComponentCostPerYear } from '../../Project/Model';
import { ResubmitRevisionRequest } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';

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
    revisionGroupId,
    projectStatus
}) => {
    const navigate = useNavigate()
    const { showToast } = useToast();
    const { user } = useAuth(); // Get user from auth context
    const [revisionType] = useState<string>('');

    console.log('ReviseProjectDialog - Received IDs:', { categoryId, revisionGroupId, reasonId });
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const transactionId = useAtomValue(transactionIdAtom); // Get transactionId from atom


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Prepare the payload
            const payload = {
                TransactionId: transactionId,
                ProjectStatus: {
                    PackageStatus: projectStatus?.PackageStatus,
                    ConstructionStatus: projectStatus?.ConstructionStatus
                },
                ProjectDetails: project,
                ComponentCosts: componentCosts,
                ComponentCostPerYear: componentsCostPerYear || [],
                MajorItemOfWorks: majorItemOfWorks,
                MajorItemLocations: majorItemLocations,
                FundingProfile: fundingProfile,
            };

            console.log('Submitting modification request with payload:', payload);

            //adjust this later
            if (user?.UserGroups === 'DPC') {
                // Implementing Office: Submit new modification request
                await ResubmitRevisionRequest(payload);
                
                showToast({
                    type: 'success',
                    message: 'Modification request submitted successfully.'
                });

                onClose();
                // Navigate to the newly created revision view
                // navigate('/revision/view/' + (response?.Data?.TransactionId || ''));
                navigate('/revision');
            }
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
export default ResubmitRevisionDialog;