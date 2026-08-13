import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ProjectDetails, ProjectEnums } from "../../../Project/Model.d";
import type { FormValidationError } from "../../../../utils/FormValidation";
import type { FieldRules } from '../../Model';
import { getDisabledClass, formatDropdownOptions, toDateInputValue } from '../../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../../components/ui/SearchableDropdown';
import { EditableField } from '../../../../components/ui/EditableField';
import { DateInput } from '../../../../components/tailwindui/date-input';

interface ProjectDetailsFormProps {
    projectDetails: ProjectDetails;
    onChange: (field: keyof ProjectDetails, value: any) => void;
    mode?: string; // 'add' or 'edit'
    projectEnums?: ProjectEnums;
    initialData?: any;
    errors?: FormValidationError<ProjectDetails>;
    disabled?: boolean;
    fieldRules?: FieldRules | null;
    pcmaStatus?: string;
    packageStatus?: string;
    currentCase?: string;
    category?: string;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({ 
    projectDetails, 
    onChange, 
    projectEnums,
    mode = '',
    errors = {},
    fieldRules,
}) => {
    const [ filteredCities, setFilteredCities ] = useState<ProjectEnums['Cities']>([]);
    const [ filteredLegislativeDistricts, setFilteredLegislativeDistricts ] = useState<ProjectEnums['LegislativeDistricts']>([]);
    const [ filteredDEOs, setFilteredDEOs ] = useState<ProjectEnums['DEOs']>([]);
    const [ filteredIOs, setFilteredIOs ] = useState<ProjectEnums['ImplementingOffices']>([]);
    const [ filteredOUs, setFilteredOUs ] = useState<ProjectEnums['OperatingUnits']>([]);

    // Helper function to check if a field is editable based on fieldRules from API
    const fieldPermissions = useMemo(() => {
        if (!fieldRules) return {};

        const permissions: Record<string, boolean> = {};

        // Extract ProjectDetailsRules specifically (these are at root level in that section)
        if (fieldRules.ProjectDetailsRules && typeof fieldRules.ProjectDetailsRules === 'object') {
            Object.assign(permissions, fieldRules.ProjectDetailsRules);
        }

        // If there are any other root-level boolean fields, include them
        for (const [key, value] of Object.entries(fieldRules)) {
            if (typeof value === 'boolean') {
                permissions[key] = value;
            }
        }
        return permissions;
    }, [fieldRules]);

    // Function to check if a specific field is editable
    const isFieldEditable = (field: string) => fieldPermissions[field] === true;

    const updateFilteredData = useCallback(() => {
        if (!projectEnums) return;

        let availableCities = projectEnums.Cities || [];
        let availableLDs = projectEnums.LegislativeDistricts || [];
        let availableDEOs = projectEnums.DEOs || [];
        let availableIOs = projectEnums.ImplementingOffices || [];
        let availableOUs = projectEnums.OperatingUnits || [];

        // If province is selected, filter cities and LDs by province
        if (projectDetails?.Province) {
            // Use Id for filtering since you're storing Id values
            const ProvinceGdbId = projectDetails.Province;
            availableCities = projectEnums.Cities?.filter(
                (city) => city.ProvinceCode === ProvinceGdbId
            ) || [];
            availableLDs = projectEnums.LegislativeDistricts?.filter(
                (ld) => ld.ProvinceCode === ProvinceGdbId
            ) || [];
            availableDEOs = projectEnums.DEOs?.filter(
                (deo) => deo.ProvinceCode === ProvinceGdbId
            ) || [];
        }
        // If city is selected but no province, filter LDs by city's province
        else if (projectDetails?.City) {
            const selectedCity = projectEnums.Cities?.find((city) => city.Code === projectDetails.City);
            if (selectedCity) {
                availableLDs = projectEnums.LegislativeDistricts?.filter(
                    (ld) => ld.ProvinceCode === selectedCity.ProvinceCode
                ) || [];
            }
        }
        // If LD is selected but no province/city, filter cities by LD's province
        else if (projectDetails?.LegislativeDistrict) {
            const selectedLD = projectEnums.LegislativeDistricts?.find((ld) => ld.Code === projectDetails.LegislativeDistrict);
            if (selectedLD) {
                availableCities = projectEnums.Cities?.filter(
                    (city) => city.ProvinceCode === selectedLD.ProvinceCode
                ) || [];
            }
        }
        else if (projectDetails?.DEO) {
            const selectedDEO = projectEnums.DEOs?.find((deo) => deo.ParticipantId === projectDetails.DEO?.toString());
            if (selectedDEO) {
                availableCities = projectEnums.Cities?.filter(
                    (city) => city.ProvinceCode === selectedDEO.ProvinceCode
                ) || [];
            }
        }

        setFilteredCities(availableCities);
        setFilteredLegislativeDistricts(availableLDs);
        setFilteredDEOs(availableDEOs);

        // Filter IOs based on DEO's RegionParticipantId or OrgType === 'UPMO'
        if (projectDetails?.DEO) {
            const selectedDEO = projectEnums.DEOs?.find((deo) => deo.ParticipantId === projectDetails.DEO?.toString());
            if (selectedDEO) {
                availableIOs = projectEnums.ImplementingOffices?.filter(
                    (io) => (io.RegionParticipantId === selectedDEO.RegionParticipantId && io.OrgType === 'R') || io.OrgType === 'UPMO' ||  io.ParticipantId === selectedDEO.ParticipantId
                ) || [];
            }
        } else {
            // If no DEO selected, show only UPMO offices
            availableIOs = projectEnums.ImplementingOffices?.filter((io) => io.OrgType === 'UPMO') || [];
        }

        setFilteredIOs(availableIOs);

        // Filter OU based on selected IO
        if(projectDetails?.ImplementingOffice) {
            const selectedIO = projectEnums.ImplementingOffices?.find((io) => io.ParticipantId === projectDetails.ImplementingOffice);
            if (selectedIO) {
                // Show OUs that belong to the selected IO or are Central Office (CO)
                availableOUs = projectEnums.OperatingUnits?.filter(
                    (ou) => ou.ParticipantId === selectedIO.ParticipantId || (selectedIO.OrgType === 'UPMO' || ou.OrgType === 'CO')
                ) || [];
            }
        } else {
            // If no IO selected, show all OUs
            availableOUs = projectEnums.OperatingUnits || [];
        }
        setFilteredOUs(availableOUs);
    }, [projectEnums, projectDetails?.Province, projectDetails?.City, projectDetails?.LegislativeDistrict, projectDetails?.DEO, projectDetails?.ImplementingOffice]);

    // Initialize filtered data when projectEnums change
    useEffect(() => {
        if (projectEnums) {
            updateFilteredData();
        }
    }, [projectEnums, updateFilteredData]);

    const handleInputChange = (field: keyof ProjectDetails, value: any) => {
            if (field === 'Province') {
                // When province changes, clear city and LD if they don't belong to the new province
                const newProvince = value;
                let newCity = projectDetails?.City;
                let newLD = projectDetails?.LegislativeDistrict;
                let newDEO = projectDetails?.DEO;
                
                if (newCity) {
                    const cityBelongsToProvince = projectEnums?.Cities?.find(
                        (city) => city.Code === newCity && city.ProvinceCode === newProvince
                    );
                    if (!cityBelongsToProvince) {
                        newCity = undefined;
                    }
                }
    
                if (newLD) {
                    const ldBelongsToProvince = projectEnums?.LegislativeDistricts?.find(
                        (ld) => ld.Code === newLD && ld.ProvinceCode === newProvince
                    );
                    if (!ldBelongsToProvince) {
                        newLD = undefined;
                    }
                }
    
                if (newDEO) {
                    const deoBelongsToProvince = projectEnums?.DEOs?.find(
                        (deo) => deo.ParticipantId === newDEO && deo.ProvinceCode === newProvince
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
                const selectedCity = projectEnums?.Cities?.find((city) => city.Code === value);
                if (selectedCity) {
                    const selectedProvince = projectEnums?.Provinces.find(p => p.Code === selectedCity.ProvinceCode);
                    if (selectedProvince && selectedProvince.Code !== projectDetails?.Province) {
                        onChange('Province', selectedProvince.Code);
                    }
                    
                    // Clear LD if it doesn't belong to the same province
                    if (projectDetails?.LegislativeDistrict) {
                        const currentLD = projectEnums?.LegislativeDistricts?.find(
                            (ld) => ld.Code === projectDetails.LegislativeDistrict
                        );
                        if (currentLD && currentLD.ProvinceCode !== selectedCity.ProvinceCode) {
                            onChange('LegislativeDistrict', undefined);
                        }
                    }
                }
                onChange(field, value);
            }
            else if (field === 'LegislativeDistrict') {
                const selectedLD = projectEnums?.LegislativeDistricts?.find((ld) => ld.Code === value);
                if (selectedLD) {
                    // Auto-set province if not set or different
                    const currentProvinceGdbId = projectDetails?.Province;
                    const selectedProvince = projectEnums?.Provinces.find(p => p.Code === selectedLD.ProvinceCode);
                    
                    if (currentProvinceGdbId !== selectedLD.ProvinceCode && selectedProvince) {
                        onChange('Province', selectedProvince.Code);
                    }
                    
                    // Clear city if it doesn't belong to the same province
                    if (projectDetails?.City) {
                        const currentCity = projectEnums?.Cities?.find((city) => city.Code === projectDetails.City);
                        if (currentCity && currentCity.ProvinceCode !== selectedLD.ProvinceCode) {
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
                    const currentProvinceGdbId = projectDetails?.Province;
                    const selectedProvince = projectEnums?.Provinces.find(p => p.Code === selectedDEO.ProvinceCode);
    
                    if (currentProvinceGdbId !== selectedDEO.ProvinceCode && selectedProvince) {
                        onChange('Province', selectedProvince.Code);
                    }
                    
                    // Clear city if it doesn't belong to the same province
                    if (projectDetails?.City) {
                        const currentCity = projectEnums?.Cities?.find(
                            (city) => city.Code === projectDetails.City
                        );
                        if (currentCity && currentCity.ProvinceCode !== selectedDEO.ProvinceCode) {
                            onChange('City', undefined);
                        }
                    }
                }
                onChange(field, value);
            }
            else if (field === 'Region') {
                // Auto-populate IslandCode from the selected region's real geographic island code
                const selectedRegion = projectEnums?.Regions?.find((region) => region.ParticipantId === value);
                onChange('IslandCode', selectedRegion?.IslandCode);
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
        // Clicking Lump Sum/Non Project overrides IslandCode regardless of the Region-derived value,
        // and drives ProjectType the same way.
        onChange('ProjectType', newValue);
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
                                <EditableField field="MYId" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <input 
                                        type="text" 
                                        value={projectDetails?.MYId || ''}
                                        onChange={(e) => handleInputChange('MYId', e.target.value)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    />
                                    )}
                                </EditableField>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.AlternateId ? 'text-red-500' : 'text-gray-600'}`}>Alternate ID:</label>
                                <EditableField field="AlternateId" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <input 
                                        type="text" 
                                        value={projectDetails?.AlternateId || ''}
                                        onChange={(e) => handleInputChange('AlternateId', e.target.value)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.AlternateId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    />
                                    )}
                                </EditableField>
                            </div>
                        </div>
                    </div>

                    <div className='grid grid-cols-3 gap-5'>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.ExternalId ? 'text-red-500' : 'text-gray-600'}`}>External ID:</label>
                                <EditableField field="ExternalId" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <input 
                                        type="text"
                                        value={projectDetails?.ExternalId || ''}
                                        onChange={(e) => handleInputChange('ExternalId', e.target.value)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.ExternalId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    />
                                    )}
                                </EditableField>
                            </div>
                        </div>
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.UACS ? 'text-red-500' : 'text-gray-600'}`}>OA Project Code (UACS):</label>
                                <EditableField field="UACS" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <input 
                                        type="text" 
                                        value={projectDetails?.UACS || ''}
                                        onChange={(e) => handleInputChange('UACS', e.target.value)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.UACS ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    />
                                    )}
                                </EditableField>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className='flex flex-row gap-5 items-center'>
                                <label className={`w-1/3 ${errors.Tier ? 'text-red-500' : 'text-gray-600'}`}>Tier</label>
                                <EditableField field="Tier" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select
                                        value={projectDetails?.Tier}
                                        onChange={(e) => handleInputChange('Tier', parseInt(e.target.value))}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.Tier ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    >
                                        <option value={1}>Tier I</option>
                                        <option value={2}>Tier II</option>
                                    </select>
                                    )}
                                </EditableField>
                            </div>
                        </div>

                    </div>

                    <div className="grid grid-cols-3 gap-5 border-t-2 pt-4 border-gray-200">
                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Category ? 'text-red-500' : 'text-gray-600'}`}>*Category:</label>
                                <div className="w-2/3 min-w-0">
                                    <EditableField field="Category" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(
                                                projectEnums?.Categories?.filter(x => x.ValidUntil === 0 || x.ValidUntil >= new Date().getFullYear()) || [], 
                                                'CategoryId', 
                                                'CategoryName', 
                                                'Id'
                                            )}
                                            value={projectDetails?.Category || ''}
                                            onChange={(value) => handleInputChange('Category', value === '' ? undefined : parseInt(value.toString()))}
                                            placeholder="Select Category"
                                            disabled={!editable}
                                            error={!!errors.Category}
                                            allowClear={true}
                                            searchPlaceholder="Search"
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Thrust ? 'text-red-500' : 'text-gray-600'}`}>*Sub-Category:</label>
                                <div className='w-2/3 min-w-0'>
                                    <EditableField field="Thrust" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
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
                                            disabled={!editable}
                                            error={!!errors.Thrust}
                                            allowClear={true}
                                            searchPlaceholder="Search sub-categories..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.MYCAApprovalDate ? 'text-red-500' : 'text-gray-600'}`}>MYCA Approval Date:</label>
                                <EditableField field='MYCAApprovalDate' isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                        <DateInput
                                            value={toDateInputValue(projectDetails?.MYCAApprovalDate)}
                                            onChange={(e) => handleInputChange('MYCAApprovalDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                            className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYCAApprovalDate ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!isFieldEditable('MYCAApprovalDate'))} rounded-md truncate`}
                                            disabled={!editable}
                                        />
                                    )}
                                </EditableField>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <div className='w-full flex text-left gap-2'>
                            <label className={`w-1/9 ${errors.Description ? 'text-red-500' : 'text-gray-600'}`}>*Description:</label>
                            <div className="w-8/9">
                            <EditableField field="Description" isFieldEditable={isFieldEditable}>
                                {(editable) => (
                                <textarea
                                    value={projectDetails?.Description}
                                    onChange={(e) => handleInputChange('Description', e.target.value)}
                                    className={`w-full mt-1 px-3 py-2 border ${errors.Description ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!isFieldEditable('Description'))} rounded-md`}
                                    placeholder="Enter project description"
                                    rows={3}
                                    disabled={!editable}
                                />
                                )}
                            </EditableField>
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
                                    <EditableField field="Province" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(projectEnums?.Provinces || [], 'GdbId', 'Name', 'Id')}
                                            value={projectDetails?.Province || ''}
                                            onChange={(value) => handleInputChange('Province', value === '' ? undefined : value.toString())}
                                            placeholder="Select Province"
                                            disabled={!editable}
                                            error={!!errors.Province}
                                            allowClear={true}
                                            searchPlaceholder="Search provinces..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>*City/Municipality:</label>
                                <div className="w-2/3">
                                    <EditableField field="City" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(filteredCities || [], 'GdbId', 'Name', 'Id')}
                                            value={projectDetails?.City || ''}
                                            onChange={(value) => handleInputChange('City', value === '' ? undefined : value.toString())}
                                            placeholder="Select City/Municipality"
                                            disabled={!editable}
                                            error={!!errors.City}
                                            allowClear={true}
                                            searchPlaceholder="Search cities/municipalities..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>*Legislative District:</label>
                                <div className="w-2/3">
                                    <EditableField field="LegislativeDistrict" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(filteredLegislativeDistricts || [], 'GdbId', 'Name', 'Id')}
                                            value={projectDetails?.LegislativeDistrict || ''}
                                            onChange={(value) => handleInputChange('LegislativeDistrict', value === '' ? undefined : value.toString())}
                                            placeholder="Select Legislative District"
                                            disabled={!editable}
                                            error={!!errors.LegislativeDistrict}
                                            allowClear={true}
                                            searchPlaceholder="Search legislative districts..."
                                        />
                                        )}
                                    </EditableField>
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
                                    <EditableField field="DEO" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(filteredDEOs || [], 'ParticipantId', 'Name')}
                                            value={projectDetails?.DEO || ''}
                                            onChange={(value) => handleInputChange('DEO', value === '' ? undefined : value.toString())}
                                            placeholder="Select District Engineering Office"
                                            disabled={mode === 'edit' || !editable}
                                            error={!!errors.DEO}
                                            allowClear={true}
                                            searchPlaceholder="Search district engineering offices..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}>Region:</label>
                                <div className='w-2/3'>
                                    <EditableField field="Region" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(
                                                projectEnums?.DEOs?.filter(x => x.ParticipantId === projectDetails?.DEO) || [],
                                                'RegionParticipantId',
                                                'RegionName',
                                                'Id'
                                            )}
                                            value={projectDetails?.Region || ''}
                                            onChange={(value) => handleInputChange('Region', value === '' ? undefined : value.toString())}
                                            placeholder="Select Regional Office"
                                            disabled={mode === 'edit' || !editable}
                                            error={!!errors.Region}
                                            allowClear={true}
                                            searchPlaceholder="Search regional offices..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>*Implementing Office:</label>
                                <div className="w-2/3">
                                    <EditableField field="ImplementingOffice" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions( filteredIOs || [], 
                                                'ParticipantId', 
                                                'Name',
                                            )}
                                            value={projectDetails?.ImplementingOffice || ''}
                                            onChange={(value) => handleInputChange('ImplementingOffice', value === '' ? undefined : value.toString())}
                                            placeholder="Select Implementing Office"
                                            disabled={!editable}
                                            error={!!errors.ImplementingOffice}
                                            allowClear={true}
                                            searchPlaceholder="Search implementing offices..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}>*Operating Unit:</label>
                                <div className="w-2/3">
                                    <EditableField field="OperatingUnit" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(filteredOUs || [], 'ParticipantId', 'Name')}
                                            value={projectDetails?.OperatingUnit || ''}
                                            onChange={(value) => handleInputChange('OperatingUnit', value === '' ? undefined : value.toString())}
                                            placeholder="Select Operating Unit"
                                            disabled={!editable || !projectDetails?.ImplementingOffice}
                                            error={!!errors.OperatingUnit}
                                            allowClear={true}
                                            searchPlaceholder="Search operating units..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-5'>
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.RegionWide ? 'text-red-500' : 'text-gray-600'}`}>Region Wide:</label>
                                <EditableField field="RegionWide" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select 
                                        value={projectDetails?.RegionWide} 
                                        onChange={(e) => handleInputChange('RegionWide', e.target.value ? parseInt(e.target.value) : undefined)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.RegionWide ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    >
                                     <option value={0}>Select Region Wide</option>
                                        {regionWideData.map((region) => (
                                            <option key={region.id} value={region.enum}>
                                                {region.name}
                                            </option>
                                        ))}
                                    </select>
                                    )}
                                </EditableField>
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
                                    <EditableField field="Origin" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(projectEnums?.Origins || [],
                                                'NameId',
                                                'Name',
                                                'Description'
                                            )}
                                            value={projectDetails?.Origin || ''}
                                            onChange={(value) => handleInputChange('Origin', value === '' ? undefined : parseInt(value.toString()))}
                                            placeholder="Select Origin"
                                            disabled={!editable}
                                            error={!!errors.Origin}
                                            allowClear={true}
                                            searchPlaceholder="Search origins..."
                                        />
                                        )}
                                    </EditableField>
                                </div>
                            </div>
                        </div>
                        
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}>Originating Agency:</label>
                                <div className='w-2/3'>
                                    <EditableField field="Agency" isFieldEditable={isFieldEditable}>
                                        {(editable) => (
                                        <SearchableDropdown
                                            options={formatDropdownOptions(projectEnums?.Agencies || [],
                                                'NameId',
                                                'Name',
                                            )}
                                            value={projectDetails?.Agency || ''}
                                            onChange={(value) => handleInputChange('Agency', value === '' ? undefined : parseInt(value.toString()))}
                                            placeholder="Select Originating Agency"
                                            disabled={!editable}
                                            error={!!errors.Agency}
                                            allowClear={true}
                                            searchPlaceholder="Search agencies..."
                                        />
                                        )}
                                    </EditableField>
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
                                <EditableField field="ImplementationMode" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select
                                        value={projectDetails?.ImplementationMode}
                                        onChange={(e) => handleInputChange('ImplementationMode', parseInt(e.target.value))}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementationMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    >
                                        <option value="">Select Implementation Mode</option>
                                        {projectEnums?.ImplementationModes?.map((mode) => (
                                            <option key={mode.Id} value={mode.NameId}>
                                                {mode.Name}
                                            </option>
                                        ))}
                                    </select>
                                    )}
                                </EditableField>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.EmergencyMode ? 'text-red-500' : 'text-gray-600'}`}>Emergency Mode:</label>
                                <EditableField field="EmergencyMode" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select 
                                        name="EmergencyMode" 
                                        id="EmergencyMode" 
                                        value={projectDetails?.EmergencyMode}
                                        onChange={(e) => handleInputChange('EmergencyMode', parseInt(e.target.value))} 
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.EmergencyMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    >
                                        <option value="">Select Emergency Mode</option>
                                        {projectEnums?.EmergencyModes?.map((mode) => (
                                            <option key={mode.Id} value={mode.NameId}>
                                                {mode.Name}
                                            </option>
                                        ))}
                                    </select>
                                    )}
                                </EditableField>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`flex-1/3 ${errors.RowAvailable ? 'text-red-500' : 'text-gray-600'}`}>ROW Available:</label>
                                <EditableField field="RowAvailable" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select 
                                        value={projectDetails?.RowAvailable}
                                        onChange={(e) => handleInputChange('RowAvailable', parseInt(e.target.value))}
                                        className={`flex-2/3 mt-1 px-3 py-2 border ${errors.RowAvailable ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md`}
                                        disabled={!editable}
                                    >
                                        <option value="">Select ROW Available</option>
                                        {projectEnums?.RowAvailables?.map((row) => (
                                            <option key={row.Id} value={row.NameId}>
                                                {row.Name}
                                            </option>
                                        ))}
                                    </select>
                                    )}
                                </EditableField>
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
                                <EditableField field="Feasibility" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select 
                                        value={projectDetails?.Feasibility || ''} 
                                        onChange={(e) => handleInputChange('Feasibility', e.target.value ? parseInt(e.target.value) : undefined)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.Feasibility ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    >
                                        <option value="">Select Feasibility Study</option>
                                        {projectEnums?.Feasibilities?.map((feasibility) => (
                                            <option key={feasibility.Id} value={feasibility.NameId}>
                                                {feasibility.Name}
                                            </option>
                                        ))}
                                    </select>
                                    )}
                                </EditableField>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.FeasibilityDate ? 'text-red-500' : 'text-gray-600'}`}>Feasibility Date:</label>
                                <EditableField field="FeasibilityDate" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <DateInput
                                        value={toDateInputValue(projectDetails?.FeasibilityDate)}
                                        onChange={(e) => handleInputChange('FeasibilityDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.FeasibilityDate ? 'border-red-500' : 'border-gray-300'} ${!(projectDetails?.Feasibility === 1) ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!(projectDetails?.Feasibility === 1) || !editable}
                                    />
                                    )}
                                </EditableField>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.DetailedDesign ? 'text-red-500' : 'text-gray-600'}`}>Detailed Design:</label>
                                <EditableField field="DetailedDesign" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <select 
                                        value={projectDetails?.DetailedDesign} 
                                        onChange={(e) => handleInputChange('DetailedDesign', parseInt(e.target.value))}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesign ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!editable}
                                    >
                                        <option value="">Select Detailed Design</option>
                                        {projectEnums?.DetailedDesigns?.map((design) => (
                                            <option key={design.Id} value={design.NameId}>
                                                {design.Name}
                                            </option>
                                        ))}
                                    </select>
                                    )}
                                </EditableField>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.DetailedDesignDate ? 'text-red-500' : 'text-gray-600'}`}>Detailed Design Date:</label>
                                <EditableField field="DetailedDesignDate" isFieldEditable={isFieldEditable}>
                                    {(editable) => (
                                    <DateInput
                                        value={toDateInputValue(projectDetails?.DetailedDesignDate)}
                                        onChange={(e) => handleInputChange('DetailedDesignDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                        className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesignDate ? 'border-red-500' : 'border-gray-300'} ${!(projectDetails?.DetailedDesign) ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(!editable)} rounded-md truncate`}
                                        disabled={!(projectDetails?.DetailedDesign) || !editable}
                                    />
                                    )}
                                </EditableField>
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
