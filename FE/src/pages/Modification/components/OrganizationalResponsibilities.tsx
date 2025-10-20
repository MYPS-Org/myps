import React, { useState } from "react";
import { deoUnits, ioUnits, operatingUnits, regionWideData } from "../../Modification/mockData/OrgResponsibility";

const OrganizationalResponsibilities: React.FC = () => {
    const [errors, setErrors] = useState<any>({});
    const [orgResponsibilities, setOrgResponsibilities] = useState<any>({
        DEO: '',
        Region: '',
        OperatingUnit: '',
        ImplementingOffice: '',
        RegionWide: undefined
    });

    const handleInputChange = (field: string, value: any) => {
        setOrgResponsibilities((prev: any) => ({
        ...prev,
        [field]: value
        }));
    }

    return (
        <div className="space-y-4">
            <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
                Organizational Responsibilities
            </h3>
            
            <div className="grid grid-cols-2 gap-5">

                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.DEO ? 'text-red-500' : 'text-gray-600'}`}>*District Engineering Office:</label>
                        <select 
                            name="DistrictEngOffice" 
                            id="DistrictEngOffice" 
                            value={orgResponsibilities?.DEO} 
                            onChange={(e) => handleInputChange('DEO', e.target.value)} 
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.DEO ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            // disabled={mode === 'edit'}
                        >
                            <option value="">Select District Engineering Office</option>
                            {deoUnits?.map((deo) => (
                                <option key={deo.Id} value={deo.DeoCode}>
                                    {deo.DeoName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}>Regional Office:</label>
                        <select
                            value={orgResponsibilities?.Region}
                            onChange={(e) => handleInputChange('Region', e.target.value)}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.Region ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                            // disabled={mode === 'edit'}
                        >
                            <option value="">Select Regional Office</option>
                            {deoUnits?.filter(x => x.DeoCode === orgResponsibilities?.DEO).map((region) => (
                                <option key={region.Id} value={region.ROCode}>
                                    {region.ROName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}>*Operating Unit:</label>
                        <select
                            value={orgResponsibilities?.OperatingUnit}
                            onChange={(e) => handleInputChange('OperatingUnit', e.target.value)}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.OperatingUnit ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        >
                            <option value="">Select Operating Unit</option>
                            {operatingUnits?.map((unit) => (
                                <option key={unit.Id} value={unit.ParticipantId}>
                                    {unit.OrgName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>*Implementing Office:</label>
                        <select
                            value={orgResponsibilities?.ImplementingOffice}
                            onChange={(e) => handleInputChange('ImplementingOffice', e.target.value)}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementingOffice ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        >
                            <option value="">Select Implementing Office</option>
                            {ioUnits.filter(x => orgResponsibilities?.OperatingUnit != "" && (x.ParticipantId === orgResponsibilities?.OperatingUnit || x.ParticipantId === "OI10")).map((office) => (
                                <option key={office.Id} value={office.ParticipantId}>
                                    {office.OrgName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className='grid grid-cols-2 gap-5'>
                <div className='w-full flex flex-col text-left gap-2'>
                    <div className="flex flex-row gap-5 items-center">
                        <label className={`w-1/3 ${errors.RegionWide ? 'text-red-500' : 'text-gray-600'}`}>Region Wide:</label>
                        <select 
                            value={orgResponsibilities?.RegionWide} 
                            onChange={(e) => handleInputChange('RegionWide', e.target.value ? parseInt(e.target.value) : undefined)}
                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.RegionWide ? 'border-red-500' : 'border-gray-300'} rounded-md truncate`}
                            style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        >
                            <option value={0}>Select Region Wide</option>
                            {/* {projectEnums?.RegionWide?.map((region) => (
                                <option key={region.Id} value={region.Enum}>
                                    {region.Name}
                                </option>
                            ))}  */}
                            {regionWideData.map((region) => (
                                <option key={region.Id} value={region.Enum}>
                                    {region.Name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
};

export default OrganizationalResponsibilities;