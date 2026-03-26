"use-client";

import React, { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';

interface RevisionState {
    projectId?: string;
    stageName?: string;
    revisionTypeId?: number;
    revisionTypeDescription?: string;
}

const ModifyProject: React.FC = () => {
    const { projectId } = useParams();
    const location = useLocation();
    const state = location.state as RevisionState;
    const { stageName = '', revisionTypeId = 0, revisionTypeDescription = '' } = state || {};

    const [searchInput, setSearchInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);


    const [projectForm, setProjectForm] = useState({
        projectId: projectId || '',
        stageName: stageName || '',
        reason: '',
        revisionTypeId: revisionTypeId || 0,
        revisionTypeDescription: revisionTypeDescription || '',
        date: new Date().toISOString().split('T')[0], // Default to today's date in YYYY-MM-DD format
    });

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    };
    const handleSearchSubmit = () => {
        // Implement search logic here
        console.log('Searching for:', searchInput);
    };
    const handleClearSearch = () => {
        setSearchInput('');
    };

    const handleChange = (field: keyof typeof projectForm, value: any) => {
        setProjectForm(prev => ({ ...prev, [field]: value }));
    }

    // const renderField = (fieldName: string, index: number, modification: any) => {
    //     const CaseComponent = getModificationCase(fieldName);
    //     return <CaseComponent fieldName={fieldName} index={index} modification={modification} />;
    // };

    return (
        
        <div className="max-w-10xl mx-auto p-6 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 py-6">Revision Type: {revisionTypeDescription}</h3>
                        <form className="flex justify-between space-x-3">
                            <div className='w-1/3 bg-gray-100 p-4 rounded-lg'>
                                <div className='bg-white p-4 text-left rounded-lg space-y-2'>
                                    <h4 className="text-md font-medium text-blue-500">Project Information</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">Project ID:</span>
                                            <p className="text-gray-600">{projectId}</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Current Revision:</span>
                                            <p className="text-gray-600">{revisionTypeDescription}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="font-medium text-gray-700">Stage Name:</span>
                                            <p className="text-gray-600">{stageName}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className='p-6 space-y-4 bg-white rounded-lg mt-6'>
                                    {revisionTypeDescription === 'Modification' && (
                                    <div className='flex justify-between gap-5 items-center'>
                                        <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                            Reasons :
                                        </label>
                                        {/* <select
                                            value={projectForm?.reason}
                                            onChange={(e) => handleChange('reason', e.target.value)}
                                            className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                                            
                                            <option value="">-- Select Reason --</option>
                                            {modReasons.map((reason) => (
                                                <option key={reason.Id} value={reason.CodeDescription}>
                                                    {reason.CodeDescription}
                                                </option>
                                            ))}
                                        </select> */}
                                    </div>
                                    ) }
                                    <div className='flex justify-between gap-5 items-center'>
                                        <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                            Date of Approval :
                                        </label>
                                        <input 
                                            type="date" 
                                            defaultValue={projectForm.date}
                                            className='w-2/3 border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        />
                                    </div>
                                    <div className='flex justify-between gap-5 items-center'>
                                        <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                            Approval Document :
                                        </label>
                                        <input 
                                            type="file" 
                                            className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        />
                                    </div>
                                    <div className='flex justify-between gap-5 items-center'>
                                        <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                            Construction Status :
                                        </label>
                                        <input 
                                            type="text" 
                                            name="" 
                                            id="" 
                                            className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                            disabled
                                            value={"Not Yet Started"}
                                        />
                                    </div>
                                    <div className='flex justify-between gap-5 items-center'>
                                        <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                            Implementation Mode :
                                        </label>
                                        <input 
                                            type="text" 
                                            name="" 
                                            id="" 
                                            className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                            disabled
                                            value={"By Contract"}
                                        />
                                    </div>
                                    <div className='flex justify-between gap-5 items-center'>
                                        <label className='w-1/3 block text-sm font-medium text-gray-700'>
                                            Permitted :
                                        </label>
                                        <input 
                                            type="text" 
                                            name="" 
                                            id="" 
                                            className='w-2/3 border border-gray-300 rounded px-4 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500'
                                            disabled
                                            value={"No"}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="w-2/3 bg-gray-100 p-6 space-y-4 rounded-lg">
                                <h3 className="text-lg font-medium text-gray-900">Modify: {projectForm.reason}</h3>
                                {/* {renderField(projectForm.reason, 0, null)} */}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModifyProject;