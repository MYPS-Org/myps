import React from 'react';
import type { ProjectDetails } from "../Model.d";

interface ProjectDetailsFormProps {
    projectDetails: ProjectDetails;
    onChange: (field: keyof ProjectDetails, value: any) => void;
    mode?: 'add' | 'edit';
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({ 
    projectDetails, 
    onChange, 
    mode = 'edit' 
}) => {
    const handleInputChange = (field: keyof ProjectDetails, value: any) => {
        onChange(field, value);
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-left text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Project Name:</label>
                        <input
                            type="text"
                            value={projectDetails.Name}
                            onChange={(e) => handleInputChange('Name', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter project name"
                        />
                    </div>
                    
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">City/Municipality:</label>
                        <select
                            value={projectDetails.City}
                            onChange={(e) => handleInputChange('City', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                        >
                            <option value="City">City</option>
                            <option value="Municipality">Municipality</option>
                        </select>
                    </div>

                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Reporting Region:</label>
                        <select
                            value={projectDetails.Region}
                            onChange={(e) => handleInputChange('Region', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                        >
                            <option value="">Select Reporting Region</option>
                            <option value="Region 1">Region 1</option>
                            <option value="Region 2">Region 2</option>
                            <option value="Region 3">Region 3</option>
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-row text-left gap-5'>
                        <label className="flex-1/3 text-gray-600">Description:</label>
                        <textarea
                            value={projectDetails.Description}
                            onChange={(e) => handleInputChange('Description', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter project description"
                            rows={3}
                        />
                    </div>

                    <div>
                        <div className='w-full flex flex-row text-left gap-5 items-center mb-5 '>
                            <label className="flex-1/3 text-gray-600">Legislative District:</label>
                            <select
                                value={projectDetails.LegislativeDistrict}
                                onChange={(e) => handleInputChange('LegislativeDistrict', e.target.value)}
                                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            >
                                <option value="">Select Legislative District</option>
                                <option value="District 1">District 1</option>
                                <option value="District 2">District 2</option>
                                <option value="District 3">District 3</option>
                            </select>
                        </div>
                        
                        <div className='w-full flex flex-row text-left gap-5 items-center '>
                            <label className="flex-1/3 text-gray-600">Originating Agency:</label>
                            <select
                                value={projectDetails.Agency}
                                onChange={(e) => handleInputChange('Agency', e.target.value)}
                                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            >
                                <option value="">Select Originating Agency</option>
                                <option value="Agency 1">Agency 1</option>
                                <option value="Agency 2">Agency 2</option>
                                <option value="Agency 3">Agency 3</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <div className='w-full flex flex-row text-left gap-5 items-center mb-5 '>
                            <label className="flex-1/3 text-gray-600">Operating Unit:</label>
                            <select
                                value={projectDetails.OperatingUnit}
                                onChange={(e) => handleInputChange('OperatingUnit', e.target.value)}
                                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            >
                                <option value="">Select Operating Unit</option>
                                <option value="Unit 1">Unit 1</option>
                                <option value="Unit 2">Unit 2</option>
                                <option value="Unit 3">Unit 3</option>
                            </select>
                        </div>
                        <div className='w-full flex flex-row text-left gap-5 items-center'>
                            <label className="flex-1/3 text-gray-600">Alternative Project Code:</label>
                            <select
                                value={projectDetails.ProjectCode}
                                onChange={(e) => handleInputChange('ProjectCode', e.target.value)}
                                className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            >
                                <option value="">Select Project Code</option>
                                <option value="ProjCode1">ProjCode1</option>
                                <option value="ProjCode2">ProjCode2</option>
                                <option value="ProjCode3">ProjCode3</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Category:</label>
                        <select
                            value={projectDetails.Category}
                            onChange={(e) => handleInputChange('Category', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                        >
                            <option value="">Select Category</option>
                            <option value="Category1">Category1</option>
                            <option value="Category2">Category2</option>
                            <option value="Category3">Category3</option>
                        </select>
                    </div>
                    
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Implementing Office:</label>
                        <select
                            value={projectDetails.ImplementingOffice}
                            onChange={(e) => handleInputChange('ImplementingOffice', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                        >
                            <option value="">Select Implementing Office</option>
                            <option value="Office1">Office1</option>
                            <option value="Office2">Office2</option>
                            <option value="Office3">Office3</option>
                        </select>
                    </div>
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Implementation Code:</label>
                        <select
                            value={projectDetails.ImplementationMode}
                            onChange={(e) => handleInputChange('ImplementationMode', e.target.value)}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                        >
                            <option value="">Select Implementation Code</option>
                            <option value="ImplCode1">ImplCode1</option>
                            <option value="ImplCode2">ImplCode2</option>
                            <option value="ImplCode3">ImplCode3</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Thrust:</label>
                        <select name="Thrust" id="Thrust" value={projectDetails.Thrust} onChange={(e) => handleInputChange('Thrust', e.target.value)} className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'>
                            <option value="">Select Thrust</option>
                            <option value="Thrust1">Thrust1</option>
                            <option value="Thrust2">Thrust2</option>
                            <option value="Thrust3">Thrust3</option>
                        </select>
                    </div>
                    
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">District Engineering Office:</label>
                        <select name="DistrictEngOffice" id="DistrictEngOffice" 
                        value={projectDetails.DEO} onChange={(e) => handleInputChange('DEO', e.target.value)} 
                        className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'>
                            <option value="">Select District Engineering Office</option>
                            <option value="District1">District1</option>
                            <option value="District2">District2</option>
                            <option value="District3">District3</option>
                        </select>
                    </div>
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Emergency Code:</label>
                        <select name="EmergencyCode" id="EmergencyCode" 
                        value={projectDetails.EmergencyMode} onChange={(e) => handleInputChange('EmergencyMode', e.target.value)} 
                        className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'>
                            <option value="">Select Emergency Code</option>
                            <option value="Emergency1">Emergency1</option>
                            <option value="Emergency2">Emergency2</option>
                            <option value="Emergency3">Emergency3</option>
                        </select>
                    </div>
                </div>

                <div className='grid grid-cols-3 gap-5'>
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Origin:</label>
                        <select name="Origin" id="Origin" 
                        value={projectDetails.Origin} onChange={(e) => handleInputChange('Origin', e.target.value)} 
                        className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'>
                            <option value="">Select Origin</option>
                            <option value="Origin1">Origin1</option>
                            <option value="Origin2">Origin2</option>
                            <option value="Origin3">Origin3</option>
                        </select>
                    </div>
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Created By:</label>
                        <input type="text" 
                            value={projectDetails.CreatedBy} 
                            onChange={(e) => handleInputChange('CreatedBy', e.target.value)} 
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md' />
                    </div>
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Created Date:</label>
                        <input type="date" 
                            value={projectDetails.CreatedDate} 
                            onChange={(e) => handleInputChange('CreatedDate', e.target.value)} 
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md' />
                    </div>
                </div>

                <div className='grid grid-cols-3 gap-5'>
                    <div className="w-full flex flex-row text-left gap-5 items-center">
                        <label className="flex-1/3 text-gray-600">Feasibility Study:</label>
                        <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md" id="">
                            <option value="yes">{projectDetails.Feasibility ? 'Yes' : 'No'}</option>
                        </select>
                    </div>

                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Detailed Design:</label>
                        <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md" id="">
                            <option value="yes">{projectDetails.DetailedDesign ? 'Yes' : 'No'}</option>
                        </select>
                    </div>

                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">ROW Available:</label>
                        <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md" id="">
                            <option value="yes">{projectDetails.RowAvailable ? 'Yes' : 'No'}</option>
                        </select>
                    </div>
                </div>

                {mode === 'edit' && (
                    <div className="grid grid-cols-3 gap-5 pt-4 border-t">
                        <div className='flex flex-col text-left gap-2'>
                            <label className="text-gray-600">Project ID:</label>
                            <input
                                type="text"
                                value={projectDetails.Id}
                                disabled
                                className='px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
                            />
                        </div>
                        
                        <div className='flex flex-col text-left gap-2'>
                            <label className="text-gray-600">Created By:</label>
                            <input
                                type="text"
                                value={projectDetails.CreatedBy}
                                disabled
                                className='px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
                            />
                        </div>
                        
                        <div className='flex flex-col text-left gap-2'>
                            <label className="text-gray-600">Created Date:</label>
                            <input
                                type="date"
                                value={projectDetails.CreatedDate}
                                disabled
                                className='px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700'
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectDetailsForm;