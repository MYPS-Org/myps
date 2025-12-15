

import type { 
    ProjectDetails, 
    ComponentCost, 
    ComponentCostYear,
    MajorItemOfWork,
    MajorItemLocations,
    FundingProfile
} from '../../../Project/Model.d';

interface RevisionFormProps {
    category?: string;
    reason?: string;
    projectDetails?: ProjectDetails;
    componentCosts?: ComponentCost[];
    componentCostYear?: ComponentCostYear[];
    majorItemOfWorks?: MajorItemOfWork[];
    majorItemLocations?: MajorItemLocations[];
    fundingProfile?: FundingProfile[];
}

const RevisionForm: React.FC<RevisionFormProps> = ({ 
    category, 
    reason,
    projectDetails,
    componentCosts,
    componentCostYear,
    majorItemOfWorks,
    majorItemLocations,
    fundingProfile
}) => {
    
    console.log('RevisionForm - Received props:', { category, reason });
    
    return (
        <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Revision Details</h2>
            <div className="space-y-4">
                <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 pt-2 border-blue-500 pb-2">
                    Location Details:
                </h3>
                
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className="w-1/3 text-gray-600">Category:</label>
                            <input className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate" value={category} readOnly />
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className='w-1/3 text-gray-600'>Reason</label>
                            <input className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate' value={reason} readOnly />
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className='w-1/3 text-gray-600'>Project ID:</label>
                            <input className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate' value={projectDetails?.ProjectId} readOnly />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RevisionForm;