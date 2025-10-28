import React, { useEffect } from 'react';
import type { ProjectDetails, ProjectEnums } from "../Model.d";
import type { FormValidationError } from "../../../utils/FormValidation";
import { getDisabledClass } from '../../../utils/GlobalFunctions';

interface ProjectDetailsFormProps {
    projectDetails: ProjectDetails;
    onChange: (field: keyof ProjectDetails, value: any) => void;
    mode?: string; // 'add' or 'edit'
    projectEnums?: ProjectEnums;
    initialData?: any;
    errors?: FormValidationError<ProjectDetails>;
    disabled?: boolean;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({ 
    projectDetails, 
    onChange, 
    projectEnums,
    mode = '',
    errors = {},
    disabled = false
}) => {
    const [ filteredCities, setFilteredCities ] = React.useState<ProjectEnums['Cities']>([]);
    const [ filteredLegislativeDistricts, setFilteredLegislativeDistricts ] = React.useState<ProjectEnums['LDs']>([]);

    // Initialize filtered data when projectEnums change
    useEffect(() => {
        if (projectEnums) {
            updateFilteredData();
        }
    }, [projectEnums, projectDetails?.Province, projectDetails?.City, projectDetails?.LegislativeDistrict]);

    const updateFilteredData = () => {
        if (!projectEnums) return;

        let availableCities = projectEnums.Cities || [];
        let availableLDs = projectEnums.LDs || [];

        // If province is selected, filter cities and LDs by province
        if (projectDetails?.Province) {
            let ProvinceId = projectEnums.Provinces.find(p => p.Code == projectDetails.Province)?.Id ?? projectDetails.Province;
            availableCities = projectEnums.Cities?.filter(
                (city) => city.ProvinceFkId === ProvinceId
            ) || [];
            availableLDs = projectEnums.LDs?.filter(
                (ld) => ld.ProvinceFkId === ProvinceId
            ) || [];

            console.log('Filtered Cities and LDs by Province:', projectDetails.Province, availableCities, availableLDs);
        }
        // If city is selected but no province, filter LDs by city's province
        else if (projectDetails?.City) {
            const selectedCity = projectEnums.Cities?.find((city) => city.Code === projectDetails.City?.toString());
            if (selectedCity) {
                availableLDs = projectEnums.LDs?.filter(
                    (ld) => ld.ProvinceFkId === selectedCity.ProvinceFkId
                ) || [];
            }
            console.log('Filtered City:', projectDetails.City);
            console.log('Filtered LDs:', availableLDs);
        }
        // If LD is selected but no province/city, filter cities by LD's province
        else if (projectDetails?.LegislativeDistrict) {
            const selectedLD = projectEnums.LDs?.find((ld) => ld.Code === projectDetails.LegislativeDistrict?.toString());
            if (selectedLD) {
                availableCities = projectEnums.Cities?.filter(
                    (city) => city.ProvinceFkId === selectedLD.ProvinceFkId
                ) || [];
            }
            console.log('Filtered Cities by LD:', projectDetails.LegislativeDistrict, availableCities);
        }

        setFilteredCities(availableCities);
        setFilteredLegislativeDistricts(availableLDs);
    };

    const handleInputChange = (field: keyof ProjectDetails, value: any) => {
        if (disabled) return; // Prevent changes if disabled

        if (field === 'Province') {
            // When province changes, clear city and LD if they don't belong to the new province
            const newProvince = value;
            let newCity = projectDetails?.City;
            let newLD = projectDetails?.LegislativeDistrict;
            let ProvinceId = projectEnums?.Provinces.find(p => p.Code === projectDetails.Province)?.Id;
            if (newCity) {
                const cityBelongsToProvince = projectEnums?.Cities?.find(
                    (city) => city.Code === newCity?.toString() && city.ProvinceFkId === ProvinceId
                );
                if (!cityBelongsToProvince) {
                    newCity = undefined;
                }
            }

            if (newLD) {
                const ldBelongsToProvince = projectEnums?.LDs?.find(
                    (ld) => ld.Code === newLD?.toString() && ld.ProvinceFkId === ProvinceId
                );
                if (!ldBelongsToProvince) {
                    newLD = undefined;
                }
            }

            onChange('Province', newProvince);
            if (newCity !== projectDetails?.City) onChange('City', newCity);
            if (newLD !== projectDetails?.LegislativeDistrict) onChange('LegislativeDistrict', newLD);
        }
        else if (field === 'City') {
            const selectedCity = projectEnums?.Cities?.find((city) => city.Code === value?.toString());
            if (selectedCity) {
                let ProvinceCode = projectEnums?.Provinces.find(p => p.Id === selectedCity.ProvinceFkId)?.Code ?? selectedCity.ProvinceFkId;
                // Auto-set province if not set or different
                if (ProvinceCode !== selectedCity.ProvinceFkId) {
                    onChange('Province', ProvinceCode);
                }

                // Clear LD if it doesn't belong to the same province
                if (projectDetails?.LegislativeDistrict) {
                    const currentLD = projectEnums?.LDs?.find(
                        (ld) => ld.Code === projectDetails.LegislativeDistrict?.toString()
                    );
                    if (currentLD && currentLD.ProvinceFkId !== selectedCity.ProvinceFkId) {
                        onChange('LegislativeDistrict', undefined);
                    }
                }
            }
            onChange(field, value);
        }
        else if (field === 'LegislativeDistrict') {
            const selectedLD = projectEnums?.LDs?.find((ld) => ld.Code === value?.toString());
            if (selectedLD) {
                // Auto-set province if not set or different
                let ProvinceId = projectEnums?.Provinces.find(p => p.Code === projectDetails.Province)?.Id ?? projectDetails.Province;
                let ProvinceCode = projectEnums?.Provinces.find(p => p.Id === selectedLD.ProvinceFkId)?.Code ?? selectedLD.ProvinceFkId;
                if (ProvinceId !== selectedLD.ProvinceFkId) {
                    onChange('Province', ProvinceCode);
                }
                // Clear city if it doesn't belong to the same province
                if (projectDetails?.City) {
                    const currentCity = projectEnums?.Cities?.find(
                        (city) => city.Code === projectDetails.City?.toString()
                    );
                    if (currentCity && currentCity.ProvinceFkId !== selectedLD.ProvinceFkId) {
                        onChange('City', undefined);
                    }
                }
            }
            onChange(field, value);
        }
        else {
            onChange(field, value);
        }
    };


    const handleBoxClick = (boxValue: string) => {
        if (mode === 'edit') return; // Prevent clicking in edit mode
        
        const newValue = projectDetails?.IslandCode === boxValue ? null : boxValue;
        handleInputChange('IslandCode', newValue);
    };

    const regionWideData = [
        { id: 1, enum: 1, name: "Region Wide" },
        { id: 2, enum: 2, name: "Non-Region Wide" },
        { id: 3, enum: 3, name: "Region Wide AIP ignores DEO" },
    ];

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className='w-full flex flex-row items-end justify-end mb-6'>
                { [{ label: "Lump Sum", value: "LS"}, { label: "Non Project", value: "NP"}].map((item, index) => (
                    <label key={index} className={`flex-row items-center ${mode === 'edit' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} mr-4`}>
                        <input className='mr-1'
                            type="checkbox" 
                            checked={projectDetails?.IslandCode === item.value}
                            disabled={ mode === 'edit'}
                            onChange={() => handleBoxClick(item.value)} />
                        {item.label}
                    </label>
                ))}
            </div>
            <div className="space-y-8 text-sm">
                
                {/* General Information Section */}
                <div className="space-y-4">
                    <h3 className="text-lg text-left font-semibold text-gray-800 pt-2 pb-2">
                        General Information:
                    </h3>
                    <div className="grid grid-cols-3 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className="flex-1/3 text-gray-600">Project ID:</label>
                                <input
                                    type="text"
                                    value={projectDetails?.ProjectId}
                                    onChange={(e) => handleInputChange('ProjectId', (e.target.value))}
                                    className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate'
                                    readOnly
                                    placeholder="Auto-generated Project ID"
                                />
                            </div>
                        </div>
                        
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.MYId ? 'text-red-500' : 'text-gray-600'}`}>Multi Year ID:</label>
                                <input 
                                    type="text" 
                                    value={projectDetails?.MYId || ''}
                                    onChange={(e) => handleInputChange('MYId', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.AlternateId ? 'text-red-500' : 'text-gray-600'}`}>Alternate ID:</label>
                                <input 
                                    type="text" 
                                    value={projectDetails?.AlternateId || ''}
                                    onChange={(e) => handleInputChange('AlternateId', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.AlternateId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    </div>

                    <div className='grid grid-cols-3 gap-5'>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.ExternalId ? 'text-red-500' : 'text-gray-600'}`}>External ID:</label>
                                <input 
                                    type="text"
                                    value={projectDetails?.ExternalId || ''}
                                    onChange={(e) => handleInputChange('ExternalId', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.ExternalId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.UACS ? 'text-red-500' : 'text-gray-600'}`}>OA Project Code (UACS):</label>
                                <input 
                                    type="text" 
                                    value={projectDetails?.UACS || ''}
                                    onChange={(e) => handleInputChange('UACS', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.UACS ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className='flex flex-row gap-5 items-center'>
                                <label className={`w-1/3 ${errors.Tier ? 'text-red-500' : 'text-gray-600'}`}>Tier</label>
                                <select
                                    value={projectDetails?.Tier}
                                    onChange={(e) => handleInputChange('Tier', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Tier ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value={1}>Tier I</option>
                                    <option value={2}>Tier II</option>
                                </select>
                            </div>
                        </div>

                    </div>

                    <div className="grid grid-cols-3 gap-5 border-t-2 pt-4 border-gray-200">
                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Category ? 'text-red-500' : 'text-gray-600'}`}>*Category:</label>
                                <select
                                    value={projectDetails?.Category}
                                    onChange={(e) => handleInputChange('Category', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Category ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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
                                <label className={`w-1/3 ${errors.Thrust ? 'text-red-500' : 'text-gray-600'}`}>*Sub-Category:</label>
                                <select 
                                    name="Thrust" 
                                    id="Thrust" 
                                    value={projectDetails?.Thrust} 
                                    onChange={(e) => handleInputChange('Thrust', parseInt(e.target.value))} 
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Thrust ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.MYCAApprovalDate ? 'text-red-500' : 'text-gray-600'}`}>MYCA Approval Date:</label>
                                <input 
                                    type="date"
                                    value={projectDetails?.MYCAApprovalDate ? new Date(projectDetails?.MYCAApprovalDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleInputChange('MYCAApprovalDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYCAApprovalDate ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <div className='w-full flex text-left gap-2'>
                            <label className={`w-1/9 ${errors.Description ? 'text-red-500' : 'text-gray-600'}`}>*Description:</label>
                            <div className="w-8/9">
                                <textarea
                                    value={projectDetails?.Description}
                                    onChange={(e) => handleInputChange('Description', e.target.value)}
                                    className={`w-full mt-1 px-3 py-2 border ${errors.Description ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md`}
                                    placeholder="Enter project description"
                                    rows={3}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location Details Section */}
                <div className="space-y-4">
                    <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 pt-2 border-blue-500 pb-2">
                        Location Details:
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className="w-1/3 text-gray-600">Province:</label>
                                <select
                                    value={projectDetails?.Province}
                                    onChange={(e) => handleInputChange('Province', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Province ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select Province</option>
                                    {projectEnums?.Provinces?.map((province) => (
                                        <option key={province.Id} value={province.Code}>
                                            {province.Name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>*City/Municipality:</label>
                                <select
                                    value={projectDetails?.City}
                                    onChange={(e) => handleInputChange('City', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.City ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select City/Municipality</option>
                                    {filteredCities?.map((city) => (
                                        <option key={city.Id} value={city.Code}>
                                            {city.Name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>*Legislative District:</label>
                                <select
                                    value={projectDetails?.LegislativeDistrict}
                                    onChange={(e) => handleInputChange('LegislativeDistrict', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.LegislativeDistrict ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select Legislative District</option>
                                    {filteredLegislativeDistricts?.map((ld) => (
                                        <option key={ld.Id} value={ld.Code}>
                                            {ld.Name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Organizational Responsibilities Section */}
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
                                    value={projectDetails?.DEO} 
                                    onChange={(e) => handleInputChange('DEO', e.target.value)} 
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.DEO ? 'border-red-500' : 'border-gray-300'} ${mode === 'edit' ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={mode === 'edit' || disabled}
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

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}>Regional Office:</label>
                                <select
                                    value={projectDetails?.Region}
                                    onChange={(e) => handleInputChange('Region', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Region ? 'border-red-500' : 'border-gray-300'} ${mode === 'edit' ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={mode === 'edit' || disabled}
                                >
                                    <option value="">Select Regional Office</option>
                                    {projectEnums?.DEOs?.filter(x => x.DeoCode === projectDetails?.DEO).map((region) => (
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
                                    value={projectDetails?.OperatingUnit}
                                    onChange={(e) => handleInputChange('OperatingUnit', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.OperatingUnit ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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
                                <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>*Implementing Office:</label>
                                <select
                                    value={projectDetails?.ImplementingOffice}
                                    onChange={(e) => handleInputChange('ImplementingOffice', e.target.value)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementingOffice ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select Implementing Office</option>
                                    {projectEnums?.IOs?.filter(x => projectDetails?.OperatingUnit != "" && (x.ParticipantId === projectDetails?.OperatingUnit || x.ParticipantId === "OI10")).map((office) => (
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
                                    value={projectDetails?.RegionWide} 
                                    onChange={(e) => handleInputChange('RegionWide', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.RegionWide ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                 <option value={0}>Select Region Wide</option>
                                    {/* {projectEnums?.RegionWide?.map((region) => (
                                        <option key={region.Id} value={region.Enum}>
                                            {region.Name}
                                        </option>
                                    ))}  */}
                                    {regionWideData.map((region) => (
                                        <option key={region.id} value={region.enum}>
                                            {region.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Source Section */}
                <div className="space-y-4">
                    <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
                        Project Source
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Origin ? 'text-red-500' : 'text-gray-600'}`}>Origin:</label>
                                <select 
                                    name="Origin" 
                                    id="Origin" 
                                    value={projectDetails?.Origin} 
                                    onChange={(e) => handleInputChange('Origin', parseInt(e.target.value))} 
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Origin ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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
                        
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}>Originating Agency:</label>
                                <select
                                    value={projectDetails?.Agency}
                                    onChange={(e) => handleInputChange('Agency', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Agency ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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
                    </div>
                </div>

                {/* Implementation Readiness and Modality Section */}
                <div className="space-y-4">
                    <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
                        Implementation Readiness and Modality
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.ImplementationMode ? 'text-red-500' : 'text-gray-600'}`}>Implementation Mode:</label>
                                <select
                                    value={projectDetails?.ImplementationMode}
                                    onChange={(e) => handleInputChange('ImplementationMode', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementationMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.EmergencyMode ? 'text-red-500' : 'text-gray-600'}`}>Emergency Mode:</label>
                                <select 
                                    name="EmergencyCode" 
                                    id="EmergencyCode" 
                                    value={projectDetails?.EmergencyMode ? 'true' : 'false'} 
                                    onChange={(e) => handleInputChange('EmergencyMode', e.target.value === 'true')} 
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.EmergencyMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`flex-1/3 ${errors.RowAvailable ? 'text-red-500' : 'text-gray-600'}`}>ROW Available:</label>
                                <select 
                                    value={projectDetails?.RowAvailable ? 'true' : 'false'} 
                                    onChange={(e) => handleInputChange('RowAvailable', e.target.value === 'true')}
                                    className={`flex-2/3 mt-1 px-3 py-2 border ${errors.RowAvailable ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md`}
                                    disabled={disabled}
                                >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Modality */}
                <div className='space-y-4'>
                    <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-gray-200"></h3>

                    <div className='grid grid-cols-2 gap-5'>
                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Feasibility ? 'text-red-500' : 'text-gray-600'}`}>Feasibility Study:</label>
                                <select 
                                    value={projectDetails?.Feasibility || ''} 
                                    onChange={(e) => handleInputChange('Feasibility', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Feasibility ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
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

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.FeasibilityDate ? 'text-red-500' : 'text-gray-600'}`}>Feasibility Date:</label>
                                <input 
                                    type="date"
                                    value={projectDetails?.FeasibilityDate ? new Date(projectDetails?.FeasibilityDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleInputChange('FeasibilityDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.FeasibilityDate ? 'border-red-500' : 'border-gray-300'} ${!(projectDetails?.Feasibility === 1) ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={!(projectDetails?.Feasibility === 1) || disabled}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.DetailedDesign ? 'text-red-500' : 'text-gray-600'}`}>Detailed Design:</label>
                                <select 
                                    value={projectDetails?.DetailedDesign ? 'true' : 'false'} 
                                    onChange={(e) => handleInputChange('DetailedDesign', e.target.value === 'true')}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesign ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.DetailedDesignDate ? 'text-red-500' : 'text-gray-600'}`}>Detailed Design Date:</label>
                                <input 
                                    type="date"
                                    value={projectDetails?.DetailedDesignDate ? new Date(projectDetails?.DetailedDesignDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleInputChange('DetailedDesignDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesignDate ? 'border-red-500' : 'border-gray-300'} ${!(projectDetails?.DetailedDesign) ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={!(projectDetails?.DetailedDesign) || disabled}
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Administrative Information Section - Only show in edit mode */}
                {mode === 'edit' && (
                    <div className="space-y-4">
                        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-gray-500">
                            Administrative Information:
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-5">
                            <div className='w-full flex flex-col text-left gap-2'>
                                <div className="flex flex-row gap-5 items-center">
                                    <label className={`flex-1/3 ${errors.CreatedBy ? 'text-red-500' : 'text-gray-600'}`}>Created By:</label>
                                    <input 
                                        type="text" 
                                        value={projectDetails?.CreatedBy} 
                                        onChange={(e) => handleInputChange('CreatedBy', e.target.value)} 
                                        className={`flex-2/3 mt-1 px-3 py-2 border ${errors.CreatedBy ? 'border-red-500' : 'border-gray-300'} rounded-md bg-gray-100`}
                                        disabled 
                                    />
                                </div>
                            </div>
                            
                            <div className='w-full flex flex-col text-left gap-2'>
                                <div className="flex flex-row gap-5 items-center">
                                    <label className={`flex-1/3 ${errors.CreatedDate ? 'text-red-500' : 'text-gray-600'}`}>Created Date:</label>
                                    <input 
                                        type="text" 
                                        value={projectDetails?.CreatedDate ? projectDetails?.CreatedDate.StringToDate() : projectDetails?.CreatedDate} 
                                        className={`flex-2/3 mt-1 px-3 py-2 border ${errors.CreatedDate ? 'border-red-500' : 'border-gray-300'} rounded-md bg-gray-100`} 
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectDetailsForm;