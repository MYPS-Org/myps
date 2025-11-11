import React, { useEffect, useState, useCallback } from 'react';
import type { ProjectDetails, ProjectEnums } from "../../../Project/Model.d";
import type { FormValidationError } from "../../../../utils/FormValidation";
import { getDisabledClass, formatDropdownOptions } from '../../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../../components/ui/SearchableDropdown';

interface ProjectDetailsFormProps {
    projectDetails: ProjectDetails;
    onChange: (field: keyof ProjectDetails, value: any) => void;
    mode?: string; // 'add' or 'edit'
    projectEnums?: ProjectEnums;
    initialData?: any;
    errors?: FormValidationError<ProjectDetails>;
    disabled?: boolean;
    fieldPermissions?: any;
    category?: string;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({ 
    projectDetails, 
    onChange, 
    projectEnums,
    mode = '',
    errors = {},
    disabled = false,
    fieldPermissions,
    category
}) => {
    const [ filteredCities, setFilteredCities ] = useState<ProjectEnums['Cities']>([]);
    const [ filteredLegislativeDistricts, setFilteredLegislativeDistricts ] = useState<ProjectEnums['LDs']>([]);
    const [ filteredDEOs, setFilteredDEOs ] = useState<ProjectEnums['DEOs']>([]);

    // Helper function to check if a field is editable based on fieldPermissions
    const isFieldEditable = useCallback((fieldName: string) => {
        if (!fieldPermissions) {
            return !disabled;
        }
        // check if isEditable is true in fieldPermissions
        const isEditable = fieldPermissions.editableFields?.includes(fieldName);
        
        return isEditable || !disabled;

    }, [fieldPermissions, disabled]);

    // Initialize filtered data when projectEnums change
    useEffect(() => {
        if (projectEnums) {
            updateFilteredData();
        }
    }, [projectEnums, projectDetails?.Province, projectDetails?.City, projectDetails?.LegislativeDistrict, projectDetails?.DEO]);

    const updateFilteredData = () => {
        if (!projectEnums) return;

        let availableCities = projectEnums.Cities || [];
        let availableLDs = projectEnums.LDs || [];
        let availableDEOs = projectEnums.DEOs || [];

        // If province is selected, filter cities and LDs by province
        if (projectDetails?.Province) {
            // Use Id for filtering since you're storing Id values
            const ProvinceId = projectDetails.Province;
            availableCities = projectEnums.Cities?.filter(
                (city) => city.ProvinceId === ProvinceId
            ) || [];
            availableLDs = projectEnums.LDs?.filter(
                (ld) => ld.ProvinceId === ProvinceId
            ) || [];
            availableDEOs = projectEnums.DEOs?.filter(
                (deo) => deo.ProvinceId === ProvinceId
            ) || [];

            console.log('Filtered Cities and LDs by Province:', projectDetails.Province, availableCities, availableLDs, availableDEOs);
        }
        // If city is selected but no province, filter LDs by city's province
        else if (projectDetails?.City) {
            const selectedCity = projectEnums.Cities?.find((city) => city.GdbId === projectDetails.City);
            if (selectedCity) {
                availableLDs = projectEnums.LDs?.filter(
                    (ld) => ld.ProvinceId === selectedCity.ProvinceId
                ) || [];
            }
            console.log('Filtered City:', projectDetails.City);
            console.log('Filtered LDs:', availableLDs);
        }
        // If LD is selected but no province/city, filter cities by LD's province
        else if (projectDetails?.LegislativeDistrict) {
            const selectedLD = projectEnums.LDs?.find((ld) => ld.GdbId === projectDetails.LegislativeDistrict);
            if (selectedLD) {
                availableCities = projectEnums.Cities?.filter(
                    (city) => city.ProvinceId === selectedLD.ProvinceId
                ) || [];
            }
            console.log('Filtered Cities by LD:', projectDetails.LegislativeDistrict, availableCities);
        }
        else if (projectDetails?.DEO) {
            const selectedDEO = projectEnums.DEOs?.find((deo) => deo.ParticipantId === projectDetails.DEO?.toString());
            if (selectedDEO) {
                availableCities = projectEnums.Cities?.filter(
                    (city) => city.ProvinceId === selectedDEO.ProvinceId
                ) || [];
            }
        }

        setFilteredCities(availableCities);
        setFilteredLegislativeDistricts(availableLDs);
        setFilteredDEOs(availableDEOs);
    };

    const handleInputChange = (field: keyof ProjectDetails, value: any) => {
            console.log('ProjectDetailsForm - handleInputChange:', field, value, typeof value);
            // if (disabled) return; // Prevent changes if disabled
    
            if (field === 'Province') {
                // When province changes, clear city and LD if they don't belong to the new province
                const newProvince = value;
                let newCity = projectDetails?.City;
                let newLD = projectDetails?.LegislativeDistrict;
                let newDEO = projectDetails?.DEO;
                
                if (newCity) {
                    const cityBelongsToProvince = projectEnums?.Cities?.find(
                        (city) => city.GdbId === newCity && city.ProvinceId === newProvince
                    );
                    if (!cityBelongsToProvince) {
                        newCity = undefined;
                    }
                }
    
                if (newLD) {
                    const ldBelongsToProvince = projectEnums?.LDs?.find(
                        (ld) => ld.GdbId === newLD && ld.ProvinceId === newProvince
                    );
                    if (!ldBelongsToProvince) {
                        newLD = undefined;
                    }
                }
    
                if (newDEO) {
                    const deoBelongsToProvince = projectEnums?.DEOs?.find(
                        (deo) => deo.ParticipantId === newDEO && deo.ProvinceId === newProvince
                    );
                    if (!deoBelongsToProvince) {
                        newDEO = undefined;
                    }
                }
    
                onChange('Province', newProvince);
                if (newCity !== projectDetails?.City) onChange('City', newCity);
                if (newLD !== projectDetails?.LegislativeDistrict) onChange('LegislativeDistrict', newLD);
                if (newDEO !== projectDetails?.DEO) onChange('DEO', newDEO);
            }
            else if (field === 'City') {
                const selectedCity = projectEnums?.Cities?.find((city) => city.GdbId === value);
                if (selectedCity) {
                    const selectedProvince = projectEnums?.Provinces.find(p => p.GdbId === selectedCity.ProvinceId);
                    console.log('City auto-set to ' + selectedCity.Name + ' (Province ID: ' + selectedCity.ProvinceId + ')');
                    if (selectedProvince && selectedProvince.GdbId !== projectDetails?.Province) {
                        onChange('Province', selectedProvince.GdbId);
                        console.log('Province auto-set to ' + selectedProvince.Name + ' (ID: ' + selectedProvince.Id + ')');
                    }
                    
                    // Clear LD if it doesn't belong to the same province
                    if (projectDetails?.LegislativeDistrict) {
                        const currentLD = projectEnums?.LDs?.find(
                            (ld) => ld.GdbId === projectDetails.LegislativeDistrict
                        );
                        if (currentLD && currentLD.ProvinceId !== selectedCity.ProvinceId) {
                            onChange('LegislativeDistrict', undefined);
                        }
                    }
                }
                onChange(field, value);
            }
            else if (field === 'LegislativeDistrict') {
                const selectedLD = projectEnums?.LDs?.find((ld) => ld.GdbId === value);
                if (selectedLD) {
                    // Auto-set province if not set or different
                    const currentProvinceId = projectDetails?.Province;
                    const selectedProvince = projectEnums?.Provinces.find(p => p.GdbId === selectedLD.ProvinceId);
                    
                    if (currentProvinceId !== selectedLD.ProvinceId && selectedProvince) {
                        onChange('Province', selectedProvince.GdbId);
                        console.log('Province auto-set from LD to:', selectedProvince.Name);
                    }
                    
                    // Clear city if it doesn't belong to the same province
                    if (projectDetails?.City) {
                        const currentCity = projectEnums?.Cities?.find((city) => city.GdbId === projectDetails.City);
                        if (currentCity && currentCity.ProvinceId !== selectedLD.ProvinceId) {
                            onChange('City', undefined);
                        }
                    }
                }
                onChange(field, value);
            }
            else if (field === 'DEO') {
                const selectedDEO = projectEnums?.DEOs?.find((deo) => deo.ParticipantId === value?.toString());
                if (selectedDEO) {
                    // Auto-set province if not set or different
                    const currentProvinceId = projectDetails?.Province;
                    const selectedProvince = projectEnums?.Provinces.find(p => p.GdbId === selectedDEO.ProvinceId);
    
                    if (currentProvinceId !== selectedDEO.ProvinceId && selectedProvince) {
                        onChange('Province', selectedProvince.GdbId);
                        console.log('Province auto-set from DEO to:', selectedProvince.Name);
                    }
                    
                    // Clear city if it doesn't belong to the same province
                    if (projectDetails?.City) {
                        const currentCity = projectEnums?.Cities?.find(
                            (city) => city.GdbId === projectDetails.City
                        );
                        if (currentCity && currentCity.ProvinceId !== selectedDEO.ProvinceId) {
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
            {/* Debug section for field permissions */}
            {fieldPermissions && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Field Permissions Debug ({category}):</h4>
                    <p className="text-xs text-blue-700">
                        PCMA Status: <span className="font-medium">{fieldPermissions.pcmaStatus}</span> | 
                        Package Status: <span className="font-medium">{fieldPermissions.packageStatus}</span> | 
                        Case: <span className="font-medium">{fieldPermissions.case}</span> |
                        Category: <span className="font-medium">{fieldPermissions.category || category}</span>
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                        Editable Fields ({fieldPermissions.editableFields?.length || 0}): 
                        <span className="font-mono text-xs"> {fieldPermissions.editableFields?.join(', ')}</span>
                    </p>
                </div>
            )}
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
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(
                                            projectEnums?.Categories?.filter(x => x.ValidUntil === 0 || x.ValidUntil > new Date().getFullYear()) || [], 
                                            'Enum', 
                                            'Name', 
                                            'Id'
                                        )}
                                        value={projectDetails?.Category || ''}
                                        onChange={(value) => handleInputChange('Category', value === '' ? undefined : parseInt(value.toString()))}
                                        placeholder="Select Category"
                                        disabled={disabled}
                                        error={!!errors.Category}
                                        allowClear={true}
                                        searchPlaceholder="Search categories..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Thrust ? 'text-red-500' : 'text-gray-600'}`}>*Sub-Category:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(
                                            projectEnums?.Thrusts?.filter(x => x.ValidFromDate < new Date().getFullYear() && x.ValidToDate > new Date().getFullYear() || x.ValidToDate === 0) || [],
                                            'PAPKey',
                                            'ThrustDescription',
                                            'Id'
                                        )}
                                        value={projectDetails?.Thrust || ''}
                                        onChange={(value) => handleInputChange('Thrust', value === '' ? undefined : parseInt(value.toString()))}
                                        placeholder="Select Sub-Category"
                                        disabled={disabled}
                                        error={!!errors.Thrust}
                                        allowClear={true}
                                        searchPlaceholder="Search sub-categories..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.MYCAApprovalDate ? 'text-red-500' : 'text-gray-600'}`}>MYCA Approval Date:</label>
                                <input 
                                    type="date"
                                    value={projectDetails?.MYCAApprovalDate ? new Date(projectDetails?.MYCAApprovalDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => handleInputChange('MYCAApprovalDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYCAApprovalDate ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!isFieldEditable('MYCAApprovalDate'))} rounded-md truncate`}
                                    disabled={!isFieldEditable('MYCAApprovalDate')}
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
                                    className={`w-full mt-1 px-3 py-2 border ${errors.Description ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!isFieldEditable('Description'))} rounded-md`}
                                    placeholder="Enter project description"
                                    rows={3}
                                    disabled={!isFieldEditable('Description')}
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
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.Provinces || [], 'GdbId', 'Name', 'Id')}
                                        value={projectDetails?.Province || ''}
                                        onChange={(value) => handleInputChange('Province', value === '' ? undefined : value.toString())}
                                        placeholder="Select Province"
                                        disabled={disabled}
                                        error={!!errors.Province}
                                        allowClear={true}
                                        searchPlaceholder="Search provinces..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>*City/Municipality:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredCities || [], 'GdbId', 'Name', 'Id')}
                                        value={projectDetails?.City || ''}
                                        onChange={(value) => handleInputChange('City', value === '' ? undefined : value.toString())}
                                        placeholder="Select City/Municipality"
                                        disabled={!isFieldEditable('City')}
                                        error={!!errors.City}
                                        allowClear={true}
                                        searchPlaceholder="Search cities/municipalities..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>*Legislative District:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredLegislativeDistricts || [], 'GdbId', 'Name', 'Id')}
                                        value={projectDetails?.LegislativeDistrict || ''}
                                        onChange={(value) => handleInputChange('LegislativeDistrict', value === '' ? undefined : value.toString())}
                                        placeholder="Select Legislative District"
                                        disabled={!isFieldEditable('LegislativeDistrict')}
                                        error={!!errors.LegislativeDistrict}
                                        allowClear={true}
                                        searchPlaceholder="Search legislative districts..."
                                    />
                                </div>
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
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredDEOs || [], 'ParticipantId', 'Name')}
                                        value={projectDetails?.DEO || ''}
                                        onChange={(value) => handleInputChange('DEO', value === '' ? undefined : value.toString())}
                                        placeholder="Select District Engineering Office"
                                        disabled={mode === 'edit' || !isFieldEditable('DEO')}
                                        error={!!errors.DEO}
                                        allowClear={true}
                                        searchPlaceholder="Search district engineering offices..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}>Region:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(
                                            projectEnums?.DEOs?.filter(x => x.ParticipantId === projectDetails?.DEO) || [],
                                            'ParticipantId',
                                            'RegionName',
                                            'Id'
                                        )}
                                        value={projectDetails?.Region || ''}
                                        onChange={(value) => handleInputChange('Region', value === '' ? undefined : value.toString())}
                                        placeholder="Select Regional Office"
                                        disabled={mode === 'edit' || disabled}
                                        error={!!errors.Region}
                                        allowClear={true}
                                        searchPlaceholder="Search regional offices..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}>*Operating Unit:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.OperatingUnits || [], 'ParticipantId', 'Name')}
                                        value={projectDetails?.OperatingUnit || ''}
                                        onChange={(value) => handleInputChange('OperatingUnit', value === '' ? undefined : value.toString())}
                                        placeholder="Select Operating Unit"
                                        disabled={!isFieldEditable('OperatingUnit')}
                                        error={!!errors.OperatingUnit}
                                        allowClear={true}
                                        searchPlaceholder="Search operating units..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>*Implementing Office:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(
                                            projectEnums?.IOs?.filter(x => {
                                                // If no Operating Unit selected, show nothing
                                                if (!projectDetails?.OperatingUnit || projectDetails?.OperatingUnit === "") return false;
                                                
                                                // If Central Office (OI10) is selected as Operating Unit, show all IOs
                                                if (projectDetails?.OperatingUnit === "OI10") return true;
                                                
                                                // Otherwise, filter by matching Operating Unit or allow Central Office
                                                return x.ParticipantId === projectDetails?.OperatingUnit;
                                            }) || [], 
                                            'ParticipantId', 
                                            'Name',
                                        )}
                                        value={projectDetails?.ImplementingOffice || ''}
                                        onChange={(value) => handleInputChange('ImplementingOffice', value === '' ? undefined : value.toString())}
                                        placeholder="Select Implementing Office"
                                        disabled={!isFieldEditable('ImplementingOffice')}
                                        error={!!errors.ImplementingOffice}
                                        allowClear={true}
                                        searchPlaceholder="Search implementing offices..."
                                    />
                                </div>
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
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.Origins || [],
                                            'Enum',
                                            'Name',
                                            'Id'
                                        )}
                                        value={projectDetails?.Origin || ''}
                                        onChange={(value) => handleInputChange('Origin', value === '' ? undefined : parseInt(value.toString()))}
                                        placeholder="Select Origin"
                                        disabled={!isFieldEditable('Origin')}
                                        error={!!errors.Origin}
                                        allowClear={true}
                                        searchPlaceholder="Search origins..."
                                    />
                                </div>
                                {/* <select 
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
                                </select> */}
                            </div>
                        </div>
                        
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}>Originating Agency:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.Agencies || [],
                                            'Id',
                                            'AgencyName',
                                        )}
                                        value={projectDetails?.Agency || ''}
                                        onChange={(value) => handleInputChange('Agency', value === '' ? undefined : parseInt(value.toString()))}
                                        placeholder="Select Originating Agency"
                                        disabled={!isFieldEditable('Agency')}
                                        error={!!errors.Agency}
                                        allowClear={true}
                                        searchPlaceholder="Search agencies..."
                                    />
                                </div>
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
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.EmergencyMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!isFieldEditable('EmergencyMode'))} rounded-md truncate`}
                                    disabled={!isFieldEditable('EmergencyMode')}
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