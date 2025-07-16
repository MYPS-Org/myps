import React from 'react';
import type { ProjectDetails } from "../Model";

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
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Project Name:</label>
                        <input
                            type="text"
                            value={projectDetails.ProjectName}
                            onChange={(e) => handleInputChange('ProjectName', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter project name"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">City/Municipality:</label>
                        <input
                            type="text"
                            value={projectDetails.CityMunicipality}
                            onChange={(e) => handleInputChange('CityMunicipality', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter city/municipality"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Reporting Region:</label>
                        <input
                            type="text"
                            value={projectDetails.ReportingRegion}
                            onChange={(e) => handleInputChange('ReportingRegion', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter reporting region"
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-5">
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Legislative District:</label>
                        <input
                            type="text"
                            value={projectDetails.LegislativeDistrict}
                            onChange={(e) => handleInputChange('LegislativeDistrict', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter legislative district"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Originating Region:</label>
                        <input
                            type="text"
                            value={projectDetails.OriginatingRegion}
                            onChange={(e) => handleInputChange('OriginatingRegion', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter originating region"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Operating Unit:</label>
                        <input
                            type="text"
                            value={projectDetails.OperatingUnit}
                            onChange={(e) => handleInputChange('OperatingUnit', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter operating unit"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-5">
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Alternative Project Code:</label>
                        <input
                            type="text"
                            value={projectDetails.AlternativeProjCode}
                            onChange={(e) => handleInputChange('AlternativeProjCode', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter alternative project code"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Category:</label>
                        <input
                            type="text"
                            value={projectDetails.Category}
                            onChange={(e) => handleInputChange('Category', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter category"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Implementing Office:</label>
                        <input
                            type="text"
                            value={projectDetails.ImplementingOffice}
                            onChange={(e) => handleInputChange('ImplementingOffice', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter implementing office"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-5">
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Implementation Code:</label>
                        <input
                            type="text"
                            value={projectDetails.ImplementationCode}
                            onChange={(e) => handleInputChange('ImplementationCode', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter implementation code"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Thrust:</label>
                        <input
                            type="text"
                            value={projectDetails.Thrust}
                            onChange={(e) => handleInputChange('Thrust', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter thrust"
                        />
                    </div>
                    
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">District Engineering Office:</label>
                        <input
                            type="text"
                            value={projectDetails.DistrictEngOffice}
                            onChange={(e) => handleInputChange('DistrictEngOffice', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter district engineering office"
                        />
                    </div>
                </div>

                <div className='grid grid-cols-3 gap-5'>
                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Emergency Code:</label>
                        <input
                            type="text"
                            value={projectDetails.EmergencyCode}
                            onChange={(e) => handleInputChange('EmergencyCode', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter emergency code"
                        />
                    </div>

                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Origin:</label>
                        <input
                            type="text"
                            value={projectDetails.Origin}
                            onChange={(e) => handleInputChange('Origin', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter origin"
                        />
                    </div>

                    <div className='flex flex-col text-left gap-2'>
                        <label className="text-gray-600">Description:</label>
                        <textarea
                            value={projectDetails.Description}
                            onChange={(e) => handleInputChange('Description', e.target.value)}
                            className='px-3 py-2 border border-gray-300 rounded-md'
                            placeholder="Enter project description"
                            rows={3}
                        />
                    </div>
                </div>

                <div className='flex flex-row justify-evenly text-left gap-5 items-center'>
                    <div className='flex items-center gap-2'>
                        <input
                            type="checkbox"
                            checked={projectDetails.FeasibilityStudy}
                            onChange={(e) => handleInputChange('FeasibilityStudy', e.target.checked)}
                            className='h-4 w-4 text-blue-600'
                        />
                        <label className="text-gray-600">Feasibility Study</label>
                    </div>

                    <div className='flex items-center gap-2'>
                        <input
                            type="checkbox"
                            checked={projectDetails.DetailedDesign}
                            onChange={(e) => handleInputChange('DetailedDesign', e.target.checked)}
                            className='h-4 w-4 text-blue-600'
                        />
                        <label className="text-gray-600">Detailed Design</label>
                    </div>

                    <div className='flex items-center gap-2'>
                        <input
                            type="checkbox"
                            checked={projectDetails.RowAvailable}
                            onChange={(e) => handleInputChange('RowAvailable', e.target.checked)}
                            className='h-4 w-4 text-blue-600'
                        />
                        <label className="text-gray-600">ROW Available</label>
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