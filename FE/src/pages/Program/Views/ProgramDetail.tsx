"use-client";
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { ProgramDetailsEnums } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { editProgram, fetchProgramById } from '../Service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { ChevronDownIcon, ChevronRightIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../components/toaster/ToasterContext';
import NextStageDialog from '../dialogs/NextStageDialog';
import MetroManilaMap from '../../../components/map/MetroManilaMap';
// import { formatCurrency } from '../../../utils/GlobalFunctions';
// import { Badge } from '../../../components/tailwindui/badge';

// Mock projects data for the table
const ProgramDetail: React.FC = () => {
  const { program } = useParams<{ program: string }>();
  const id = useMemo(() => program?.split(':'), [program]);
  const navigate = useNavigate();
  const [nextStageName, setNextStageName] = useState<string | null>(null);
  const { showToast } = useToast();
  const [programEnums, setProgramEnums] = useState<ProgramDetailsEnums>({
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
      Statuses: [],
      Stages: [],
      Types: [],
      Groups: [],
      DataSecurity: []
    }
  });
  const [defaultProgramEnums, setDefaultProgramEnums] = useState<ProgramDetailsEnums>({
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
      Statuses: [],
      Stages: [],
      Types: [],
      Groups: [],
      DataSecurity: []
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDataSecurityExpanded, setIsDataSecurityExpanded] = useState(false);
  const [isNextStageDialogOpen, setIsNextStageDialogOpen] = useState(false);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  
  // Group data security by OrgType
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

  useEffect(() => {
    const loadProgramDetail = async () => {
      if (id && id.length === 2) {
        try {
          await fetchProgramDetail(id[0], id[1]);
        } catch (error) {
          console.error('Error fetching program details:', error);
        }
      } else {
        console.error('Invalid program ID:', id);
      }
    };

    loadProgramDetail();
  }, [id]);

  const fetchProgramDetail = async (programId: string, stageName: string) => {
    setIsLoading(true);
    try {
      const response = await fetchProgramById(programId, stageName);
      setProgramEnums(response.Data);
      setDefaultProgramEnums(response.Data); // Store the original data for comparison

      const nextStageId = response.Data.Details.StageId + 1;
      const nextStage = response.Data.Dropdowns.Stages.find(stage => stage.Id === nextStageId);
      setNextStageName(nextStage ? nextStage.Name : 'Final Stage');
    } catch (error) {
      console.error('Error fetching program details:', error);
      setProgramEnums(defaultProgramEnums);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = async (programId: string, stageName: string) => {
      try {
          if (programId && stageName) {
              const programWithStage = programId + ':' + stageName;
              navigate(`/programs/programdetails/${programWithStage}`);
          }
      } catch (error) {
          console.error('Error navigating to program details:', error);
      }
    };

  const handleAddProject = () => {
      navigate(`/projects/addproject?programId=${programEnums?.Details.ProgramId}`);
  };

  // const handleBack = () => {
  //   navigate('/programs');
  // };

  const handleChange = (field: string, value: any) => {
    setProgramEnums(prev => ({
      ...prev,
      Details: {
        ...prev.Details,
        [field]: value
      }
    }));
  };

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

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      const response = await editProgram(programEnums?.Details);
      if (response) {
        showToast({
          type: 'success',
          message: 'Program details updated successfully.',
        });
      }
      console.log('Update program details');
      await fetchProgramDetail(programEnums?.Details.ProgramId, programEnums?.Details.StageName);
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to update program details. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const preventUpdate = () => {
    // Compare the editable fields between current and default values
    const currentDetails = programEnums?.Details;
    const defaultDetails = defaultProgramEnums?.Details;
    
    if (!currentDetails || !defaultDetails) return true;
    
    // Helper function to compare arrays
    const arraysEqual = (arr1: string[] = [], arr2: string[] = []) => {
      if (arr1.length !== arr2.length) return false;
      return arr1.sort().every((val, index) => val === arr2.sort()[index]);
    };
    
    // Check if any editable field has changed
    return (
      currentDetails.Name === defaultDetails.Name &&
      currentDetails.YearStart === defaultDetails.YearStart &&
      currentDetails.YearEnd === defaultDetails.YearEnd &&
      currentDetails.Status === defaultDetails.Status &&
      currentDetails.Type === defaultDetails.Type &&
      currentDetails.UserGroup === defaultDetails.UserGroup &&
      arraysEqual(currentDetails.DataSecurityGroup, defaultDetails.DataSecurityGroup)
    );
  };

  const handleProceed = async () => {
    setIsNextStageDialogOpen(true);
  };

  const handleNextStageSubmit = async (data: { ProgramId: string; Stage: number; Name?: string }) => {
    try {
      const nextStageName = programEnums?.Dropdowns.Stages.find(stage => stage.Id === data.Stage);
      if (nextStageName) {
        handleViewDetails(data.ProgramId, nextStageName.Name);
      }
    } catch (error) {
      console.error('Error handling next stage submission:', error);
      showToast({
        type: 'error',
        message: 'Failed to proceed to next stage. Please try again.',
      });
    }
  };

  const handlePublishToPCMA = () => {
    console.log('Publish to PCMA clicked');
  };

  const handleCloseNextStageDialog = () => {
    setIsNextStageDialogOpen(false);
  };

  const handleViewProject = (projectId: string, stageName: string) => {
    try {
      if (projectId && stageName) {
        navigate(`/projects/project-details/${projectId}:${stageName}`);
      }
    } catch (error) {
      console.error('Error navigating to project details:', error);
    }
  };

  const handleModifyProject = (projectId: string, stageName: string) => {
    alert('Modify Project clicked'+ ' ' + projectId + ' at stage ' + stageName);
  };

  const handleDownloadTemplate = () => {
    // TODO: Implement download template functionality
    console.log('Download Template clicked');
    setIsActionDropdownOpen(false);
  };

  const handleImportProjects = () => {
    // TODO: Implement import projects functionality
    console.log('Import Projects clicked');
    setIsActionDropdownOpen(false);
  };

  const handleExportProjects = () => {
    // TODO: Implement export projects functionality
    console.log('Export Projects clicked');
    setIsActionDropdownOpen(false);
  };

  if (isLoading) {
    return (
      <div className="mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

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

            <div className="pt-4 flex justify-end gap-4">
              {programEnums.IsActive && programEnums.Details.StageId >= 4 && programEnums.Details.StageId <= 9 && (
                <Button color="blue" className="w-auto items-center text-nowrap" onClick={handleProceed}>
                  Proceed to {nextStageName}
                </Button>
              )}
              {programEnums.IsActive && (
                <Button 
                  color="green" 
                  className="w-24 items-center" 
                  onClick={handleUpdate}
                  disabled={preventUpdate() || isLoading}
                >
                  Update
                </Button>
              )}
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

      {/* Projects Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <div className="flex items-center gap-4">
            {programEnums.IsActive && programEnums.Details.StageId === 10 && (
              <Button color="yellow" onClick={handlePublishToPCMA}>
                Publish to PCMA
              </Button>
            )}
            {programEnums.IsActive && programEnums?.Details?.StageId < 10 && (
              <Button color="blue" onClick={handleAddProject}>
                Add Project
              </Button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <Cog6ToothIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                Actions
                <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
              </button>

              {isActionDropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsActionDropdownOpen(false)}
                  />
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                      <button
                        onClick={handleDownloadTemplate}
                        className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download Template
                      </button>
                      <button
                        onClick={handleImportProjects}
                        className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Import Projects
                      </button>
                      <button
                        onClick={handleExportProjects}
                        className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                        </svg>
                        Export Projects
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="w-full overflow-x-auto">
          <Table className="min-w-full px-5">
            <TableHead>
              <TableRow>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project ID
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SubProgram
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Legislative District
                </TableHeader>
                {/* <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Project Cost
                </TableHeader> */}
                <TableHeader className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created Date
                </TableHeader>
                { programEnums?.IsActive && programEnums?.Details?.StageId === 10 && (
                <TableHeader className='px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </TableHeader>
                )}
              </TableRow>
            </TableHead>
            
            <TableBody className="bg-white divide-y divide-gray-200">
              {programEnums.Projects.map((project) => (
                <TableRow key={project.Id} className="hover:bg-gray-50">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleViewProject(project.ProjectId, project.StageName)} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                      {project.ProjectId}
                    </button>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-64">
                    {project.Description}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.Category}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.Thrust}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.City}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.LegislativeDistrict}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-20">
                    {project.CreatedDate.StringToDate()}
                  </TableCell>
                  { programEnums?.IsActive && programEnums?.Details?.StageId === 10 && (
                  <TableCell className='px-6 py-4 whitespace-nowrap text-sm font-medium text-center'>
                    <Button className="w-24 items-center" onClick={() => handleModifyProject(project.ProjectId, project.StageName)}>
                      Modify
                    </Button>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Next Stage Dialog */}
      {isNextStageDialogOpen && (
        <NextStageDialog
          isOpen={isNextStageDialogOpen}
          onClose={handleCloseNextStageDialog}
          onSubmit={handleNextStageSubmit}
          program={programEnums?.Details}
          stages={programEnums?.Dropdowns.Stages || []}
        />
      )}
    </div>
  );
}

export default ProgramDetail;