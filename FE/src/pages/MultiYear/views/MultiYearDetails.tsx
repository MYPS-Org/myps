"use-client";
import React from "react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { TableHeader, TableRow, TableCell, TableHead, TableBody, MultiSelectFilterableTable } from '../../../components/tailwindui/table';
import { MagnifyingGlassIcon, PlusIcon, ArrowLeftIcon } from '@heroicons/react/20/solid';
import { Button } from '../../../components/tailwindui/button';
import { useProjectList } from '../hooks/useProjectList';
import { useProgramList } from '../hooks/useProgramList';
import { useAtom } from 'jotai';
import { multiYearListAtom } from '../state/multiYearState';
import type { ProgramDetailsEnums } from "../Model.d";
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import MetroManilaMap from '../../../components/map/MetroManilaMap';

const MultiYearDetails: React.FC = () => {
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [searchInput, setSearchInput] = useState('');
    const [isDataSecurityExpanded, setIsDataSecurityExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Get program ID from URL parameters
    // Try different possible parameter names based on your route configuration
    const params = useParams();
    // For URL structure like /multiyear/PIP0000170, the parameter might be named differently
    const programId = params.programId || params.id || params['*'] || Object.values(params)[0] as string;
    const navigate = useNavigate();
    
    // Get program data from state
    const [programData] = useAtom(multiYearListAtom);
    
    // Also need access to program initialization
    const { initializeData: initializeProgramData } = useProgramList();
    
    // Find the selected program based on URL parameter
    const selectedProgram = programData?.lists?.find((program: any) => program.ProgramId === programId);
    
    // Debug logging
    console.log('URL params:', params);
    console.log('Extracted programId:', programId);
    console.log('Program data lists:', programData?.lists);
    console.log('Selected program:', selectedProgram);

    const {
        projectData,
        isLoading,
        initializeProjectData,
        PaginateProjects
    } = useProjectList();

    // Initialize project data when component mounts or program changes
    useEffect(() => {
        if (programId) {
            console.log('Initializing project data for programId:', programId);
            initializeProjectData(programId); // Pass the programId directly instead of selectedProgram.Name
        }
    }, [programId, initializeProjectData]);

    // Redirect to programs list if no programId in URL
    useEffect(() => {
        if (!programId) {
            navigate('/multiyear/programs'); // Adjusted to match new route
        }
    }, [programId, navigate]);

    // Initialize program data if not loaded
    useEffect(() => {
        if (!programData?.lists?.length) {
            initializeProgramData();
        }
    }, [programData?.lists?.length, initializeProgramData]);

    const [ programEnums, setProgramEnums] = useState<ProgramDetailsEnums>({
        Details: {
            Id: 0,
            ProgramId: '',
            RevisionNumber: 0,
            Name: '',
            StageId: 0,
            StageName: '',
            IsSkipped: false,
            SkipReason: '',
            UserGroup: 0,
            RegionCode: '',
            Status: 0,
            Type: 0,
            Cost: 0,
            DataSecurityGroup: [],
            YearStart: 0,
            YearEnd: 0,
            CreatedBy: '',
            CreatedDate: '',
            UpdatedBy: '',
            UpdatedDate: '',
        },
        IsActive: false,
        Projects: [],
        Dropdowns: {
            Stages: [],
            Statuses: [],
            Types: [],
            Groups: [],
            DataSecurity: []
        }
    });

    const handleDataSecurityToggle = (dataSecurityId: string) => {
        setProgramEnums(prev => ({
        ...prev,
        Details: {
            ...prev.Details,
            DataSecurityGroup: (prev.Details.DataSecurityGroup || []).includes(dataSecurityId)
            ? (prev.Details.DataSecurityGroup || []).filter(id => id !== dataSecurityId)
            : [...(prev.Details.DataSecurityGroup || []), dataSecurityId]
        }
        }));
    };

    const groupedDataSecurity = useMemo(() => {
        return (programEnums?.Dropdowns.DataSecurity || []).reduce((acc, item) => {
        const orgType = item.OrgType || 'Other';
        if (!acc[orgType]) {
            acc[orgType] = [];
        }
        acc[orgType].push(item);
        return acc;
        }, {} as {[key: string]: typeof programEnums.Dropdowns.DataSecurity});
    }, [programEnums?.Dropdowns.DataSecurity]);

    // Helper function to check if all items in a group are selected
    const isGroupSelected = (orgType: string): boolean => {
        const groupItems = groupedDataSecurity[orgType] || [];
        const currentDataSecurityGroup = programEnums?.Details.DataSecurityGroup || [];
        return groupItems.length > 0 && groupItems.every(item => 
        currentDataSecurityGroup.includes(item.ParticipantId ?? '')
        );
    };

    // Helper function to check if some items in a group are selected
    const isGroupPartiallySelected = (orgType: string): boolean => {
        const groupItems = groupedDataSecurity[orgType] || [];
        const currentDataSecurityGroup = programEnums?.Details.DataSecurityGroup || [];
        return groupItems.some(item => 
        currentDataSecurityGroup.includes(item.ParticipantId ?? '')
        ) && !isGroupSelected(orgType);
    };

    // Helper function to toggle all items in a group
    const handleGroupToggle = (orgType: string) => {
        const groupItems = groupedDataSecurity[orgType] || [];
        const groupItemIds = groupItems.map(item => item.ParticipantId ?? '');
        const currentDataSecurityGroup = programEnums?.Details.DataSecurityGroup || [];
        
        if (isGroupSelected(orgType)) {
        // Remove all group items
        setProgramEnums(prev => ({
            ...prev,
            Details: {
            ...prev.Details,
            DataSecurityGroup: currentDataSecurityGroup.filter(id => !groupItemIds.includes(id))
            }
        }));
        } else {
        // Add all group items
        setProgramEnums(prev => ({
            ...prev,
            Details: {
            ...prev.Details,
            DataSecurityGroup: [...new Set([...currentDataSecurityGroup, ...groupItemIds])]
            }
        }));
        }
    };

      // Get program location for map display
    const getProgramLocation = () => {
        // You can map region codes or program data to coordinates later
        // For now, return a sample location in Metro Manila
        return {
        lat: 14.6091,
        lng: 121.0223,
        name: programEnums?.Details.Name || "Program Location"
        };
    };

    // Get all projects first
    const allProjects = projectData?.lists || [];

    // Filter options for project status
    const statusOptions = [
        { value: 'Active', label: 'Active', count: allProjects.filter((p: any) => p.Status === 'Active').length },
        { value: 'Pending', label: 'Pending', count: allProjects.filter((p: any) => p.Status === 'Pending').length },
        { value: 'Inactive', label: 'Inactive', count: allProjects.filter((p: any) => p.Status === 'Inactive').length },
    ];

    // Filter the projects based on selected statuses
    const filteredProjects = selectedStatuses.length === 0 
        ? allProjects
        : allProjects.filter((project: any) => selectedStatuses.includes(project.Status));

    // Get current page projects for display
    const currentPage = projectData?.page || 1;
    const limit = projectData?.limit || 20;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const currentPageProjects = filteredProjects.slice(startIndex, endIndex);

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (status.toLowerCase()) {
            case 'active':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'pending':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'inactive':
                return `${baseClasses} bg-red-100 text-red-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const getTypeBadge = (type: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (type.toLowerCase()) {
            case 'infrastructure':
                return `${baseClasses} bg-blue-100 text-blue-800`;
            case 'technology':
                return `${baseClasses} bg-purple-100 text-purple-800`;
            case 'healthcare':
                return `${baseClasses} bg-pink-100 text-pink-800`;
            case 'education':
                return `${baseClasses} bg-orange-100 text-orange-800`;
            case 'energy':
                return `${baseClasses} bg-yellow-100 text-yellow-800`;
            case 'environment':
                return `${baseClasses} bg-green-100 text-green-800`;
            default:
                return `${baseClasses} bg-gray-100 text-gray-800`;
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    };
    
    const handleSearchSubmit = () => {
        console.log('Searching for:', searchInput);
    };

    const handleBackToPrograms = () => {
        navigate('/multiyear'); // Navigate back to the programs list
    };

    const formatCost = (cost?: number) => {
        if (!cost) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0
        }).format(cost);
    };

    // If no program is found or program data is not loaded, show a message
    if (!selectedProgram || !programData?.lists?.length) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg m-4">
                <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {!programData?.lists?.length ? 'Loading...' : 'Program Not Found'}
                    </h3>
                    <p className="text-gray-600">
                        {!programData?.lists?.length 
                            ? 'Please wait while we load the program data.'
                            : 'The requested program could not be found. Please go back to the Multi-Year list.'
                        }
                    </p>
                    {programData?.lists?.length > 0 && (
                        <Button 
                            color="blue" 
                            onClick={handleBackToPrograms}
                            className="mt-4"
                        >
                            Back to Programs
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const handleChange = (field: string, value: any) => {
        setProgramEnums(prev => ({
            ...prev,
            Details: {
                ...prev.Details,
                [field]: value
            }
        }));
    };

    return (
        <div className="w-full text-left mx-auto p-6 space-y-6">
            {/* Main Program Details Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                {/* Left Column - Form Fields */}
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                        type="text"
                        onChange={(e) => handleChange('Name', e.target.value)}
                        value={programEnums?.Details.Name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        disabled
                        />
                    </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Start Year</label>
                        <input
                        type="number"
                        onChange={(e) => handleChange('YearStart', e.target.value)}
                        value={programEnums?.Details.YearStart}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Program Type</label>
                        <select 
                        value={programEnums?.Details.Type}
                        onChange={(e) => handleChange('Type', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        >
                        {programEnums?.Dropdowns.Types.map((type) => (
                            <option key={type.Id} value={type.Id}>
                            {type.Name}
                            </option>
                        ))}
                        </select>
                    </div>
                    {/* <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">End Year</label>
                        <input
                        type="number"
                        onChange={(e) => handleChange('YearEnd', e.target.value)}
                        value={programEnums?.Details.YearEnd}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        />
                    </div> */}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Cost</label>
                        <input
                        type="text" // Changed to "text" to allow formatted currency strings
                        value={programEnums?.Details.Cost?.FormatToCurrency()}
                        readOnly
                        className="w-full text-left px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Status</label>
                        <div className="flex items-center">
                        <select 
                            value={programEnums?.Details.Status}
                            onChange={(e) => handleChange('Status', Number(e.target.value))}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 ${!programEnums?.IsActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!programEnums?.IsActive}
                        >
                            {programEnums?.Dropdowns.Statuses.map((status) => (
                            <option key={status.Id} value={status.Id}>
                                {status.Name}
                            </option>
                            ))}
                        </select>
                        </div>
                    </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">Program Stage</label>
                        <input type="text" 
                        value={programEnums?.Details.StageName}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                        />
                        {/* <select name="programStage" id="programStage" className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'>
                        {programEnums?.Dropdowns.Stages.map((stage) => (
                            <option key={stage.Id} value={stage.Id}>
                            {stage.Name}
                            </option>
                        ))}
                        </select> */}
                    </div>
                    <div>
                        <label className="block text-left text-sm font-medium text-gray-700 mb-1">User Group</label>
                        <select 
                        value={programEnums?.Details.UserGroup}
                        onChange={(e) => handleChange('UserGroup', Number(e.target.value))}
                        className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'>
                        {programEnums?.Dropdowns.Groups.map((group) => (
                            <option key={group.Id} value={group.Id}>
                            {group.GroupName}
                            </option>
                        ))}
                        </select>
                    </div>
                    </div>

                    {/* Data Security Multiple Select */}
                    <div className="mb-6 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                        <button
                        type="button"
                        onClick={() => setIsDataSecurityExpanded(!isDataSecurityExpanded)}
                        className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none transition-colors duration-200"
                        >
                        {isDataSecurityExpanded ? (
                            <ChevronDownIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform duration-200" />
                        ) : (
                            <ChevronRightIcon className="w-4 h-4 mr-2 text-gray-500 transition-transform duration-200" />
                        )}
                        Data Security Access
                        <span className={`ml-2 text-xs font-normal ${
                            (programEnums?.Details.DataSecurityGroup || []).length > 0 
                            ? 'text-blue-600 bg-blue-100 px-2 py-1 rounded-full' 
                            : 'text-gray-500'
                        }`}>
                            {(programEnums?.Details.DataSecurityGroup || []).length > 0 
                            ? `${(programEnums?.Details.DataSecurityGroup || []).length} selected`
                            : 'None selected'
                            }
                        </span>
                        </button>
                        {isDataSecurityExpanded && (
                        <div className="flex space-x-2">
                            <button
                            type="button"
                            onClick={() => {
                                const allDataSecurityIds = programEnums?.Dropdowns.DataSecurity.map(item => item.ParticipantId ?? '') || [];
                                handleChange('DataSecurityGroup', allDataSecurityIds);
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                            Select All
                            </button>
                            <button
                            type="button"
                            onClick={() => handleChange('DataSecurityGroup', [])}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                            Clear All
                            </button>
                        </div>
                        )}
                    </div>

                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isDataSecurityExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                        <div className="p-4">
                        <div className="mb-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search organizations..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
                        />
                        </div>

                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                        {Object.keys(groupedDataSecurity).map((orgType) => {
                        const groupItems = groupedDataSecurity[orgType].filter(item =>
                            item.OrgName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.ParticipantId?.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        
                        if (groupItems.length === 0) return null;
                        
                        return (
                            <div key={orgType} className="mb-6">
                            <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-gray-200">
                                <input
                                type="checkbox"
                                checked={isGroupSelected(orgType)}
                                ref={(input) => {
                                    if (input) input.indeterminate = isGroupPartiallySelected(orgType);
                                }}
                                onChange={() => handleGroupToggle(orgType)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <h4 className="font-semibold text-gray-800">
                                {orgType === 'C' ? 'Central Office' : 
                                orgType === 'R' ? 'Regional Offices' : 
                                orgType === 'B' ? 'Bureaus' :
                                orgType === 'PMO' ? 'Project Management Offices' : 
                                orgType}
                                </h4>
                                <span className="text-xs text-gray-500">
                                ({groupItems.length} organizations)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 ml-6">
                                {groupItems.map((item) => (
                                <label key={item.Id} className="flex items-center space-x-2">
                                    <input
                                    type="checkbox"
                                    checked={(programEnums?.Details.DataSecurityGroup || []).includes(item.ParticipantId ?? '')}
                                    onChange={() => handleDataSecurityToggle(item.ParticipantId ?? '')}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <div className="flex flex-col">
                                    <span className="text-sm text-gray-700 font-medium">
                                        {item.OrgName}
                                    </span>
                                    {/* <span className="text-xs text-gray-500">
                                        {item.ParticipantId}
                                    </span> */}
                                    </div>
                                </label>
                                ))}
                            </div>
                            </div>
                        );
                        })}
                        {(programEnums?.Dropdowns.DataSecurity || []).length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                            No data security options available
                        </div>
                        )}
                        {Object.keys(groupedDataSecurity).every(orgType => 
                        groupedDataSecurity[orgType].filter(item =>
                            item.OrgName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.ParticipantId?.toLowerCase().includes(searchTerm.toLowerCase())
                        ).length === 0
                        ) && searchTerm && (
                        <div className="text-center py-4 text-gray-500">
                            No organizations found matching "{searchTerm}"
                        </div>
                        )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Selected: {(programEnums?.Details.DataSecurityGroup || []).length} organizations
                        </p>
                        </div>
                    </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-left text-sm font-medium text-gray-700 mb-1">Created Date:</label>
                            <input
                            // value={programEnums?.Details.User}
                            value={programEnums?.Details.CreatedDate.StringToDate()}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-left text-sm font-medium text-gray-700 mb-1">Created By:</label>
                            <input
                            // value={programEnums?.Details.User}
                            value={programEnums?.Details.CreatedBy}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                            />
                    </div>
                    </div>
                </div>

                {/* Right Column - Map */}
                <div className="col-span-2">
                    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl">
                    <div className="px-4 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold leading-7 text-gray-900">
                        Program Location - Metro Manila
                        </h3>
                    </div>
                    <div className="p-4">
                        <MetroManilaMap 
                        projectLocation={getProgramLocation()}
                        height="400px"
                        />
                    </div>
                    </div>
                </div>
                </div>
            </div>
            {/* Multi-select Filterable Table */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden p-6">
                <div className="overflow-x-auto">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Button
                                    color="zinc"
                                    onClick={handleBackToPrograms}
                                    className="flex items-center text-xs px-3 py-1.5"
                                >
                                    <ArrowLeftIcon className="w-4 h-4 mr-1" />
                                    Back to Programs
                                </Button>
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">Projects</h3>
                                    <p className="text-sm text-gray-600">Program: {selectedProgram.Name}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                    <div className="relative">
                                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search Projects..."
                                            value={searchInput}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSearchSubmit();
                                                }
                                            }}
                                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <Button 
                                        color="blue" 
                                        onClick={handleSearchSubmit}
                                        disabled={isLoading}
                                        className="text-xs px-3 py-1.5"
                                    >
                                        <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                                        Search
                                    </Button>
                                </div>
                                <Button color="blue" disabled={isLoading} className="text-xs px-3 py-1.5">
                                    <PlusIcon className="w-4 h-4 mr-1" />
                                    {isLoading ? 'Loading...' : 'Add Project'}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <MultiSelectFilterableTable
                        filterOptions={statusOptions}
                        selectedFilters={selectedStatuses}
                        onFilterChange={setSelectedStatuses}
                        filterVariant="pills"
                        filterSize="md"
                        showClearAll={true}
                        label="Filter"
                        className="min-w-full"
                    >
                        <TableHead>
                            <TableRow>
                                <TableHeader className="min-w-[200px]">Project Name</TableHeader>
                                <TableHeader className="min-w-[100px]">Project ID</TableHeader>
                                <TableHeader className="min-w-[100px]">Status</TableHeader>
                                <TableHeader className="min-w-[120px]">Type</TableHeader>
                                <TableHeader className="min-w-[100px]">Region</TableHeader>
                                <TableHeader className="min-w-[120px]">Cost</TableHeader>
                                <TableHeader className="min-w-[100px]">Duration</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {currentPageProjects.length > 0 ? (
                                currentPageProjects.map(project => (
                                    <TableRow key={project.Id}>
                                        <TableCell className="min-w-[200px]">
                                            <div className="font-medium text-gray-900 truncate pr-4" title={project.Name}>
                                                {project.Name}
                                            </div>
                                            <div className="text-sm text-gray-500 truncate pr-4" title={project.Description}>
                                                {project.Description}
                                            </div>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <span className="text-gray-600 font-mono text-sm">{project.ProjectId}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <span className={getStatusBadge(project.Status)}>{project.Status}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[120px]">
                                            <span className={getTypeBadge(project.Type)}>{project.Type}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <span className="text-gray-600">{project.RegionCode}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[120px]">
                                            <span className="text-gray-600 font-semibold">{formatCost(project.Cost)}</span>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <span className="text-gray-600 whitespace-nowrap">{project.YearStart} - {project.YearEnd}</span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="min-w-full">
                                        <div className="text-center py-8 text-gray-500 whitespace-nowrap">
                                            {selectedStatuses.length > 0 
                                                ? `No projects found with status: ${selectedStatuses.join(', ')}`
                                                : 'No projects found for this program.'
                                            }
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </MultiSelectFilterableTable>
                    
                    {/* Pagination */}
                    {projectData && projectData.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-center">
                                <div className="flex space-x-1">
                                    <Button
                                        color="white"
                                        onClick={() => PaginateProjects(projectData.page - 1)}
                                        disabled={projectData.page === 1 || isLoading}
                                    >
                                        Previous
                                    </Button>
                                    
                                    {Array.from({ length: projectData.totalPages }, (_, i) => i + 1).map((pageNum) => (
                                        <Button
                                            key={pageNum}
                                            color={pageNum === projectData.page ? "blue" : "white"}
                                            onClick={() => PaginateProjects(pageNum)}
                                            disabled={isLoading}
                                        >
                                            {pageNum}
                                        </Button>
                                    ))}
                                    
                                    <Button
                                        color="white"
                                        onClick={() => PaginateProjects(projectData.page + 1)}
                                        disabled={projectData.page === projectData.totalPages || isLoading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer info */}
                    <div className='mb-3.5 px-6 py-4'>
                        {projectData && projectData.lists.length > 0 ? (
                            <p className="text-sm text-gray-500">
                                Showing {projectData.limit * (projectData.page - 1) + 1} to {Math.min(projectData.limit * projectData.page, projectData.total)} of {projectData.total} projects
                            </p>
                        ) : (
                            <p className="text-sm text-gray-500">
                                No projects found
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MultiYearDetails;