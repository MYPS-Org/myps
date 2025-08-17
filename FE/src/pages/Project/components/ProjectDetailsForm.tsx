import React, { useState } from 'react';
import type { ProjectDetails, ProjectEnums } from "../Model.d";
import type { FormValidationError } from "../../../utils/FormValidation";

interface ProjectDetailsFormProps {
    projectDetails: ProjectDetails;
    onChange: (field: keyof ProjectDetails, value: any) => void;
    mode?: string; // 'add' or 'edit'
    projectEnums?: ProjectEnums;
    initialData?: any;
    errors?: FormValidationError<ProjectDetails>;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({ 
    projectDetails, 
    onChange, 
    projectEnums,
    mode = '',
    errors = {}
}) => {
    const handleInputChange = (field: keyof ProjectDetails, value: any) => {
        onChange(field, value);
    };
    const [selectedBox, setSelectedBox] = useState<string | null>(null);

    const handleBoxClick = (boxValue: string) => {
        if (mode === 'edit') return; // Prevent clicking in edit mode
        
        const newValue = selectedBox === boxValue ? null : boxValue;
        setSelectedBox(newValue);
        handleInputChange('IslandCode', newValue);
    };



    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className='w-full flex flex-row items-end justify-end mb-4'>
                { [{ label: "Lump Sum", value: "LS"}, { label: "Non Project", value: "N"}].map((item, index) => (
                    <label key={index} className={`flex-row items-center ${mode === 'edit' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} mr-4`}>
                        <input className='mr-1'
                            type="checkbox" 
                            checked={selectedBox === item.value}
                            disabled={ mode === 'edit'}
                            onChange={() => handleBoxClick(item.value)} />
                        {item.label}
                    </label>
                ))}
            </div>
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-row text-left gap-5 items-center'>
                        <label className="flex-1/3 text-gray-600">Project ID:</label>
                        <input
                            type="text"
                            value={projectDetails.ProjectId}
                            onChange={(e) => handleInputChange('ProjectId', (e.target.value))}
                            className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
                            readOnly
                            placeholder="Auto-generated Project ID"
                        />
                    </div>
                    
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>City/Municipality:</label>
                            <select
                                value={projectDetails.City}
                                onChange={(e) => handleInputChange('City', parseInt(e.target.value))}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.City ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select City/Municipality</option>
                                {projectEnums?.Cities?.map((city) => (
                                    <option key={city.Id} value={city.Enum}>
                                        {city.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>Legislative District:</label>
                            <select
                                value={projectDetails.LegislativeDistrict}
                                onChange={(e) => handleInputChange('LegislativeDistrict', parseInt(e.target.value))}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.LegislativeDistrict ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Legislative District</option>
                                {projectEnums?.LDs?.map((district) => (
                                    <option key={district.Id} value={district.Enum}>
                                        {district.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex text-left gap-5'>
                            <label className={`w-1/3 ${errors.Description ? 'text-red-500' : 'text-gray-600'}`}>Description:</label>
                        
                        <div className="w-2/3">
                            <textarea
                                value={projectDetails.Description}
                                onChange={(e) => handleInputChange('Description', e.target.value)}
                                className={`w-full mt-1 px-3 py-2 border ${errors.Description ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                                placeholder="Enter project description"
                                rows={3}
                            />
                        </div>
                    </div>

                    <div>
                        <div className='w-full flex flex-col text-left gap-2 mb-4'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}>Operating Unit:</label>
                                <select
                                    value={projectDetails.OperatingUnit}
                                    onChange={(e) => handleInputChange('OperatingUnit', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.OperatingUnit ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                    style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                                >
                                    <option value="">Select Operating Unit</option>
                                    {projectEnums?.OperatingUnits?.map((unit) => (
                                        <option key={unit.Id} value={unit.ParticipantId}>
                                            {unit.OrgName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.DEO ? 'text-red-500' : 'text-gray-600'}`}>District Engineering Office:</label>
                                <select 
                                    name="DistrictEngOffice" 
                                    id="DistrictEngOffice" 
                                    value={projectDetails.DEO} 
                                    onChange={(e) => handleInputChange('DEO', e.target.value)} 
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.DEO ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                    style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                                >
                                    <option value="">Select District Engineering Office</option>
                                    {projectEnums?.DEOs?.map((deo) => (
                                        <option key={deo.Id} value={deo.DeoCode}>
                                            {deo.DeoName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <div className='w-full flex flex-row text-left gap-5 items-center mb-4'>
                            <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>Implementing Office:</label>
                            <select
                                value={projectDetails.ImplementingOffice}
                                onChange={(e) => handleInputChange('ImplementingOffice', e.target.value)}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementingOffice ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Implementing Office</option>
                                {projectEnums?.IOs?.filter(x => projectDetails.OperatingUnit != "" && (x.ParticipantId === projectDetails.OperatingUnit || x.ParticipantId === "OI10")).map((office) => (
                                    <option key={office.Id} value={office.ParticipantId}>
                                        {office.OrgName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className='w-full flex flex-row text-left gap-5 items-center'>
                            <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}>Reporting Region:</label>
                            <select
                                value={projectDetails.Region}
                                onChange={(e) => handleInputChange('Region', e.target.value)}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Region ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Reporting Region</option>
                                {projectEnums?.DEOs?.filter(x => x.DeoCode === projectDetails.DEO).map((region) => (
                                    <option key={region.Id} value={region.ROCode}>
                                        {region.ROName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                    <div className="w-full flex flex-col text-left gap-2">
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.Category ? 'text-red-500' : 'text-gray-600'}`}>Category:</label>
                            <select
                                value={projectDetails.Category}
                                onChange={(e) => handleInputChange('Category', parseInt(e.target.value))}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Category ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Category</option>
                                {projectEnums?.Categories?.filter(x => x.ValidUntil === 0 || x.ValidUntil > new Date().getFullYear()).map((category) => (
                                <option key={category.Id} value={category.Enum}>
                                    {category.Name}
                                </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}>Originating Agency:</label>
                            <select
                                value={projectDetails.Agency}
                                onChange={(e) => handleInputChange('Agency', parseInt(e.target.value))}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Agency ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Originating Agency</option>
                                {projectEnums?.Agencies?.map((agency) => (
                                    <option key={agency.Id} value={agency.Id}>
                                        {agency.AgencyName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.ImplementationMode ? 'text-red-500' : 'text-gray-600'}`}>Implementation Mode:</label>
                            <select
                                value={projectDetails.ImplementationMode}
                                onChange={(e) => handleInputChange('ImplementationMode', parseInt(e.target.value))}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementationMode ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Implementation Mode</option>
                                {projectEnums?.ImplementationModes?.map((mode) => (
                                    <option key={mode.Id} value={mode.Enum}>
                                        {mode.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-5">
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.Thrust ? 'text-red-500' : 'text-gray-600'}`}>Thrust:</label>
                            <select 
                                name="Thrust" 
                                id="Thrust" 
                                value={projectDetails.Thrust} 
                                onChange={(e) => handleInputChange('Thrust', parseInt(e.target.value))} 
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Thrust ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Thrust</option>
                                {projectEnums?.Thrusts?.filter(x => x.ValidFromDate < new Date().getFullYear() && x.ValidToDate > new Date().getFullYear() || x.ValidToDate === 0).map((thrust) => (
                                    <option key={thrust.Id} value={thrust.PAPKey}>
                                        {thrust.ThrustDescription}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`flex-1/3 ${errors.RowAvailable ? 'text-red-500' : 'text-gray-600'}`}>ROW Available:</label>
                            <select 
                                value={projectDetails.RowAvailable ? 'true' : 'false'} 
                                onChange={(e) => handleInputChange('RowAvailable', e.target.value === 'true')}
                                className={`flex-2/3 mt-1 px-3 py-2 border ${errors.RowAvailable ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                            >
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                            </select>
                        </div>
                    </div>
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.EmergencyMode ? 'text-red-500' : 'text-gray-600'}`}>Emergency Mode:</label>
                            <select 
                                name="EmergencyCode" 
                                id="EmergencyCode" 
                                value={projectDetails.EmergencyMode.toString()} 
                                onChange={(e) => handleInputChange('EmergencyMode', (e.target.value))} 
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.EmergencyMode ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Emergency Mode</option>
                                {projectEnums?.EmergencyModes?.map((emergency) => (
                                    <option key={emergency.Id} value={emergency.Enum.toString()}>
                                        {emergency.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className='grid grid-cols-3 gap-5'>
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.Origin ? 'text-red-500' : 'text-gray-600'}`}>Origin:</label>
                            <select 
                                name="Origin" 
                                id="Origin" 
                                value={projectDetails.Origin} 
                                onChange={(e) => handleInputChange('Origin', parseInt(e.target.value))} 
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Origin ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Origin</option>
                                {projectEnums?.Origins?.map((origin) => (
                                    <option key={origin.Id} value={origin.Enum}>
                                        {origin.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="w-full flex flex-col text-left gap-2">
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.Feasibility ? 'text-red-500' : 'text-gray-600'}`}>Feasibility Study:</label>
                            <select 
                                value={projectDetails.Feasibility || ''} 
                                onChange={(e) => handleInputChange('Feasibility', e.target.value ? parseInt(e.target.value) : undefined)}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Feasibility ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="">Select Feasibility Study</option>
                                {projectEnums?.Feasibility?.map((feasibility) => (
                                    <option key={feasibility.Id} value={feasibility.Enum}>
                                        {feasibility.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            <label className={`w-1/3 ${errors.DetailedDesign ? 'text-red-500' : 'text-gray-600'}`}>Detailed Design:</label>
                            <select 
                                value={projectDetails.DetailedDesign ? 'true' : 'false'} 
                                onChange={(e) => handleInputChange('DetailedDesign', e.target.value === 'true')}
                                className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesign ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                                style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            >
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className='grid grid-cols-3 gap-5'>
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className={`flex flex-row gap-5 items-center ${mode === 'add' ? 'hidden' : ''}`}>
                            <label className={`flex-1/3 ${errors.CreatedBy ? 'text-red-500' : 'text-gray-600'}`}>Created By:</label>
                            <input type="text" 
                                value={projectDetails.CreatedBy} 
                                onChange={(e) => handleInputChange('CreatedBy', e.target.value)} 
                                className={`flex-2/3 mt-1 px-3 py-2 border ${errors.CreatedBy ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                                disabled={mode === 'edit'} />
                        </div>
                    </div>
                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className={`flex flex-row gap-5 items-center ${mode === 'add' ? 'hidden' : ''}`}>
                            <label className={`flex-1/3 ${errors.CreatedDate ? 'text-red-500' : 'text-gray-600'}`}>Created Date:</label>
                            <input type="date" 
                                value={projectDetails.CreatedDate} 
                                // onChange={(e) => handleInputChange('CreatedDate', e.target.value)} 
                                disabled
                                className={`flex-2/3 mt-1 px-3 py-2 border ${errors.CreatedDate ? 'border-red-500' : 'border-gray-300'} rounded-md`} />
                        </div>
                    </div>

                    <div className='w-full flex flex-col text-left gap-2'>
                        <div className="flex flex-row gap-5 items-center">
                            
                        </div>
                    </div>
                </div>

                {/* {mode === 'edit' && (
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
                )} */}
            </div>
        </div>
    );
};

export default ProjectDetailsForm;