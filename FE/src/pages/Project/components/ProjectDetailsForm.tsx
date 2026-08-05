import React from 'react';
import type { ProjectDetails, ProjectEnums } from "../Model.d";
import type { ProgramList } from "../../Program/Model.d";
import type { FormValidationError } from "../../../utils/FormValidation";
import { getDisabledClass, formatDropdownOptions } from '../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';
import { DateInput } from '../../../components/tailwindui/date-input';
import { useLocationFilters } from '../filteringLocations';

interface ProjectDetailsFormProps {
    projectDetails: ProjectDetails;
    onChange: (field: keyof ProjectDetails, value: any) => void;
    mode?: string; // 'add' or 'edit'
    projectEnums?: ProjectEnums;
    programDetails?: ProgramList;
    errors?: FormValidationError<ProjectDetails>;
    disabled?: boolean;
}

const ProjectDetailsForm: React.FC<ProjectDetailsFormProps> = ({ 
    programDetails,
    projectDetails, 
    onChange, 
    projectEnums,
    mode = '',
    errors = {},
    disabled = false,
}) => {
    const isLumpSum = projectDetails?.IslandCode === 'LS';

    const {
        cities: filteredCities,
        legislativeDistricts: filteredLegislativeDistricts,
        deos: filteredDEOs,
        ios: filteredIOs,
        ous: filteredOUs,
        regions: filteredRegions,
    } = useLocationFilters(projectEnums, projectDetails, isLumpSum);

    const handleInputChange = (field: keyof ProjectDetails, value: any) => {
        console.log('ProjectDetailsForm - handleInputChange:', field, value, typeof value);
        if (disabled) return; // Prevent changes if disabled

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
                const ldBelongsToProvince = projectEnums?.LDs?.find(
                    (ld) => ld.Code === newLD && ld.ProvinceCode === newProvince
                );
                if (!ldBelongsToProvince) {
                    newLD = undefined;
                }
            }

            if (newDEO) {
                const deoBelongsToProvince = projectEnums?.DEOs?.find(
                    (deo) => deo.ParticipantId === newDEO && deo.RegionCode === newProvince
                );
                if (!deoBelongsToProvince) {
                    newDEO = undefined;
                }
            }

            onChange('Province', newProvince);
            if (newCity !== projectDetails?.City) console.log('pumasok'); onChange('City', newCity);
            if (newLD !== projectDetails?.LegislativeDistrict) onChange('LegislativeDistrict', newLD);
            if (newDEO !== projectDetails?.DEO) onChange('DEO', newDEO);
        }
        else if (field === 'City') {
            const selectedCity = projectEnums?.Cities?.find((city) => city.Code === value);
            if (selectedCity) {
                const selectedProvince = projectEnums?.Provinces.find(p => p.Code === selectedCity.ProvinceCode);
                console.log('City auto-set to ' + selectedCity.Name + ' (Province ID: ' + selectedCity.ProvinceCode + ')');
                if (selectedProvince && selectedProvince.Code !== projectDetails?.Province) {
                    onChange('Province', selectedProvince.Code);
                    console.log('Province auto-set to ' + selectedProvince.Name + ' (ID: ' + selectedProvince.Code + ')');
                }
                
                // Clear LD if it doesn't belong to the same province
                if (projectDetails?.LegislativeDistrict) {
                    const currentLD = projectEnums?.LDs?.find(
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
            const selectedLD = projectEnums?.LDs?.find((ld) => ld.Code === value);
            if (selectedLD) {
                // Auto-set province if not set or different
                const currentProvinceGdbId = projectDetails?.Province;
                const selectedProvince = projectEnums?.Provinces.find(p => p.Code === selectedLD.ProvinceCode);
                
                if (currentProvinceGdbId !== selectedLD.ProvinceCode && selectedProvince) {
                    onChange('Province', selectedProvince.Code);
                    console.log('Province auto-set from LD to:', selectedProvince.Name);
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
                    console.log('Province auto-set from DEO to:', selectedProvince.Name);
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
        else if (field === 'ImplementingOffice') {
            // When IO changes, clear OU if it doesn't belong to the new IO
            let newOU = projectDetails?.OperatingUnit;
            
            if (newOU && value) {
                const selectedIO = projectEnums?.IOs?.find((io) => io.ParticipantId === value.toString());
                if (selectedIO) {
                    // Check if current OU belongs to the new IO
                    const ouBelongsToIO = projectEnums?.OperatingUnits?.find(
                        (ou) => ou.ParticipantId === newOU && 
                        (ou.ParticipantId === selectedIO.ParticipantId || (selectedIO.OrgType === 'UPMO' && ou.OrgType === 'CO'))
                    );
                    if (!ouBelongsToIO) {
                        newOU = undefined;
                    }
                }
            } else if (!value) {
                // If IO is cleared, also clear OU
                newOU = undefined;
            }
            
            onChange(field, value);
            if (newOU !== projectDetails?.OperatingUnit) {
                onChange('OperatingUnit', newOU);
            }
        }
        else {
            onChange(field, value);
        }
    };


    const handleBoxClick = (boxValue: string) => {
        if (mode === 'edit') return; // Prevent clicking in edit mode
        
        const newValue = projectDetails?.IslandCode === boxValue ? null : boxValue;
        handleInputChange('IslandCode', newValue);

        // When switching to Lump Sum, clear geographic fields that are no longer required
        if (newValue === 'LS') {
            onChange('Province', undefined);
            onChange('City', undefined);
            onChange('LegislativeDistrict', undefined);
            onChange('DEO', undefined);
            onChange('Region', undefined);
        }
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

                        <div className="w-full flex flex-row gap-5 items-center">
                            <label
                                className={`w-1/3 text-sm font-medium ${
                                errors.Tier ? 'text-red-500' : 'text-gray-700'
                                }`}
                            >
                                Tier
                            </label>
                            <select
                                value={projectDetails?.Tier}
                                onChange={(e) => handleInputChange('Tier', parseInt(e.target.value))}
                                className={`w-2/3 mt-1 px-3 py-2 border ${
                                errors.Tier ? 'border-red-500' : 'border-gray-300'
                                } ${getDisabledClass(disabled)} rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                                disabled={disabled}
                            >
                                <option value={1}>Tier I</option>
                                <option value={2}>Tier II</option>
                            </select>
                            </div>
                            {programDetails?.StageId === 3 && (
                            <div className="flex flex-row gap-5 items-center">
                                <label
                                className={`w-1/3 text-sm font-medium ${
                                    errors.Rank ? 'text-red-500' : 'text-gray-700'
                                }`}
                                >
                                Rank
                                </label>
                                <input
                                type="number"
                                value={projectDetails?.Rank || ''}
                                onChange={(e) =>
                                    handleInputChange(
                                    'Rank',
                                    e.target.value ? parseInt(e.target.value) : undefined
                                    )
                                }
                                className={`w-2/3 mt-1 px-3 py-2 border ${
                                    errors.Rank ? 'border-red-500' : 'border-gray-300'
                                } ${getDisabledClass(disabled)} rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                                disabled={disabled}
                                min={1}
                                />
                            </div>
                            )}
                    </div>

                    <div className="grid grid-cols-3 gap-5 border-t-2 pt-4 border-gray-200">
                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Category ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Category:</label>
                                <div className="w-2/3 min-w-0">
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
                                        disabled={disabled}
                                        error={!!errors.Category}
                                        allowClear={true}
                                        searchPlaceholder="Search"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Thrust ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Sub-Category:</label>
                                <div className='w-2/3 min-w-0'>
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
                                <DateInput
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
                            <label className={`w-1/9 ${errors.Description ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Description:</label>
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
                                <label className={`w-1/3 ${errors.Province ? 'text-red-500' : 'text-gray-600'}`}>{!isLumpSum && <span className='text-red-500 text-lg'>*</span>}Province:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.Provinces || [], 'Code', 'Name', 'Id')}
                                        value={projectDetails?.Province}
                                        onChange={(value) => handleInputChange('Province', value === '' ? undefined : value.toString())}
                                        placeholder="Select Province"
                                        disabled={mode === 'edit' || disabled}
                                        error={!!errors.Province}
                                        allowClear={true}
                                        searchPlaceholder="Search provinces..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>{!isLumpSum && <span className='text-red-500 text-lg'>*</span>}City/Municipality:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredCities || [], 'Code', 'Name', 'Id')}
                                        value={projectDetails?.City}
                                        onChange={(value) => handleInputChange('City', value === '' ? undefined : value.toString())}
                                        placeholder="Select City/Municipality"
                                        disabled={disabled}
                                        error={!!errors.City}
                                        allowClear={true}
                                        searchPlaceholder="Search cities/municipalities..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>{!isLumpSum && <span className='text-red-500 text-lg'>*</span>}Legislative District:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                       options={formatDropdownOptions(filteredLegislativeDistricts || [], 'Code', 'Name', 'Id')}
                                        value={projectDetails?.LegislativeDistrict}
                                        onChange={(value) => handleInputChange('LegislativeDistrict', value === '' ? undefined : value.toString())}
                                        placeholder="Select Legislative District"
                                        disabled={disabled}
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
                                <label className={`w-1/3 ${errors.DEO ? 'text-red-500' : 'text-gray-600'}`}>{!isLumpSum && <span className='text-red-500 text-lg'>*</span>}District Engineering Office:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredDEOs || [], 'ParticipantId', 'Name')}
                                        value={projectDetails?.DEO}
                                        onChange={(value) => handleInputChange('DEO', value === '' ? undefined : value.toString())}
                                        placeholder="Select District Engineering Office"
                                        disabled={mode === 'edit' || disabled}
                                        error={!!errors.DEO}
                                        allowClear={true}
                                        searchPlaceholder="Search district engineering offices..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Region:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredRegions, 'ParticipantId', 'Name')}
                                        value={projectDetails?.Region}
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
                                <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>{!isLumpSum && <span className='text-red-500 text-lg'>*</span>}Implementing Office:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(
                                            filteredIOs || [], 
                                            'ParticipantId', 
                                            'Name',
                                        )}
                                        value={projectDetails?.ImplementingOffice || ''}
                                        onChange={(value) => handleInputChange('ImplementingOffice', value === '' ? undefined : value.toString())}
                                        placeholder="Select Implementing Office"
                                        disabled={disabled}
                                        error={!!errors.ImplementingOffice}
                                        allowClear={true}
                                        searchPlaceholder="Search implementing offices..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Operating Unit:</label>
                                <div className="w-2/3">
                                    <SearchableDropdown
                                        options={formatDropdownOptions(filteredOUs || [], 'ParticipantId', 'Name')}
                                        value={projectDetails?.OperatingUnit || ''}
                                        onChange={(value) => handleInputChange('OperatingUnit', value === '' ? undefined : value.toString())}
                                        placeholder="Select Operating Unit"
                                        disabled={disabled || (!isLumpSum && !projectDetails?.ImplementingOffice)}
                                        error={!!errors.OperatingUnit}
                                        allowClear={true}
                                        searchPlaceholder="Search operating units..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-5'>
                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.RegionWide ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Region Wide:</label>
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
                                <label className={`w-1/3 ${errors.Origin ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Origin:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.Origins || [],
                                            'NameId',
                                            'Name',
                                            'Id'
                                        )}
                                        value={projectDetails?.Origin || ''}
                                        onChange={(value) => handleInputChange('Origin', value === '' ? undefined : parseInt(value.toString()))}
                                        placeholder="Select Origin"
                                        disabled={disabled}
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
                                <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Originating Agency:</label>
                                <div className='w-2/3'>
                                    <SearchableDropdown
                                        options={formatDropdownOptions(projectEnums?.Agencies || [],
                                            'NameId',
                                            'Name',
                                        )}
                                        value={projectDetails?.Agency || ''}
                                        onChange={(value) => handleInputChange('Agency', value === '' ? undefined : parseInt(value.toString()))}
                                        placeholder="Select Originating Agency"
                                        disabled={disabled}
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
                                <label className={`w-1/3 ${errors.ImplementationMode ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Implementation Mode:</label>
                                <select
                                    value={projectDetails?.ImplementationMode}
                                    onChange={(e) => handleInputChange('ImplementationMode', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementationMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select Implementation Mode</option>
                                    {projectEnums?.ImplementationModes?.map((mode) => (
                                        <option key={mode.Id} value={mode.NameId}>
                                            {mode.Name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.EmergencyMode ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Emergency Mode:</label>
                                <select 
                                    name="EmergencyMode" 
                                    id="EmergencyMode" 
                                    value={projectDetails?.EmergencyMode} 
                                    onChange={(e) => handleInputChange('EmergencyMode', parseInt(e.target.value))} 
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.EmergencyMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                <option value="">Select Emergency Mode</option>
                                {projectEnums?.EmergencyModes?.map((mode) => (
                                    <option key={mode.Id} value={mode.NameId}>
                                        {mode.Name}
                                    </option>
                                ))}
                                </select>
                            </div>
                        </div>

                        <div className='w-full flex flex-col text-left gap-2'>
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`flex-1/3 ${errors.RowAvailable ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>ROW Available:</label>
                                <select 
                                    value={projectDetails?.RowAvailable} 
                                    onChange={(e) => handleInputChange('RowAvailable', parseInt(e.target.value))}
                                    className={`flex-2/3 mt-1 px-3 py-2 border ${errors.RowAvailable ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md`}
                                    disabled={disabled}
                                >
                                    <option value="">Select ROW Availability</option>
                                    {projectEnums?.RowsAvailable?.map((row) => (
                                        <option key={row.Id} value={row.NameId}>
                                            {row.Name}
                                        </option>
                                    ))}
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
                                <label className={`w-1/3 ${errors.Feasibility ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500'>*</span>Feasibility Study:</label>
                                <select 
                                    value={projectDetails?.Feasibility} 
                                    onChange={(e) => handleInputChange('Feasibility', e.target.value ? parseInt(e.target.value) : undefined)}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.Feasibility ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select Feasibility Study</option>
                                    {projectEnums?.Feasibility?.map((feasibility) => (
                                        <option key={feasibility.Id} value={feasibility.NameId}>
                                            {feasibility.Name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.FeasibilityDate ? 'text-red-500' : 'text-gray-600'}`}>Feasibility Date:</label>
                                <DateInput
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
                                <label className={`w-1/3 ${errors.DetailedDesign ? 'text-red-500' : 'text-gray-600'}`}><span className='text-red-500 text-lg'>*</span>Detailed Design:</label>
                                <select 
                                    value={projectDetails?.DetailedDesign} 
                                    onChange={(e) => handleInputChange('DetailedDesign', parseInt(e.target.value))}
                                    className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesign ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                                    disabled={disabled}
                                >
                                    <option value="">Select Detailed Design</option>
                                    {projectEnums?.DetailedDesign?.map((design) => (
                                        <option key={design.Id} value={design.NameId}>
                                            {design.Name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="w-full flex flex-col text-left gap-2">
                            <div className="flex flex-row gap-5 items-center">
                                <label className={`w-1/3 ${errors.DetailedDesignDate ? 'text-red-500' : 'text-gray-600'}`}>Detailed Design Date:</label>
                                <DateInput
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