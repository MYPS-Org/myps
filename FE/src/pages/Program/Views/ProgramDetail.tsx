"use-client";
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { ProgramDetailsEnums, AIPReportParams } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { editProgram, fetchProgramById, publishToPCMA, downloadAIPReport, batchAllowPublishing, batchDeleteProjects, batchRestrictPublishing } from '../Service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { ChevronDownIcon, Cog6ToothIcon, TagIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../components/toaster/ToasterContext';
import NextStageDialog from '../dialogs/NextStageDialog';
// import MetroManilaMap from '../../../components/map/MetroManilaMap';
import AIPReportDialog from '../dialogs/AIPReportDialog';
import PublishProgramDialog from '../dialogs/PublishProgramDialog';
import BatchTagDialog from '../dialogs/BatchTagDialog';
import CheckboxList from '../../../components/ui/CheckboxList';
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
      IsPublished: false,
        SkipReason: '',
        UserGroup: [],
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
        IsPublished: false,
        UserGroup: [],
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
  // const [searchTerm, setSearchTerm] = useState('');
  // const [isDataSecurityExpanded, setIsDataSecurityExpanded] = useState(false);
  const [isNextStageDialogOpen, setIsNextStageDialogOpen] = useState(false);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [isAIPReportDialogOpen, setIsAIPReportDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isBatchTagDialogOpen, setIsBatchTagDialogOpen] = useState(false);
  const [isBatchTagDropDownOpen, setIsBatchTagDropDownOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<'tag' | 'delete' | 'unpublish' | 'publish'>('tag');
  
  // Group data security by OrgType
  // const groupedDataSecurity = useMemo(() => {
  //   return (programEnums?.Dropdowns.DataSecurity || []).reduce((acc, item) => {
  //     const orgType = item.OrgType || 'Other';
  //     if (!acc[orgType]) {
  //       acc[orgType] = [];
  //     }
  //     acc[orgType].push(item);
  //     return acc;
  //   }, {} as {[key: string]: typeof programEnums.Dropdowns.DataSecurity});
  // }, [programEnums?.Dropdowns.DataSecurity]);

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
      navigate(`/projects/addproject?programId=${programEnums?.Details.ProgramId}&stageName=${programEnums?.Details.StageName}`);
  };

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

  const handleUserGroupToggle = (userGroupId: string) => {
    const numericId = parseInt(userGroupId);
    setProgramEnums(prev => ({
      ...prev,
      Details: {
        ...prev.Details,
        UserGroup: (prev.Details.UserGroup || []).includes(numericId)
          ? (prev.Details.UserGroup || []).filter(id => id !== numericId)
          : [...(prev.Details.UserGroup || []), numericId]
      }
    }));
  };

  // Helper function to check if all items in a group are selected
  // const isGroupSelected = (orgType: string): boolean => {
  //   const groupItems = groupedDataSecurity[orgType] || [];
  //   const currentDataSecurityGroup = programEnums?.Details.DataSecurityGroup || [];
  //   return groupItems.length > 0 && groupItems.every(item => 
  //     currentDataSecurityGroup.includes(item.ParticipantId ?? '')
  //   );
  // };

  // Helper function to check if some items in a group are selected
  // const isGroupPartiallySelected = (orgType: string): boolean => {
  //   const groupItems = groupedDataSecurity[orgType] || [];
  //   const currentDataSecurityGroup = programEnums?.Details.DataSecurityGroup || [];
  //   return groupItems.some(item => 
  //     currentDataSecurityGroup.includes(item.ParticipantId ?? '')
  //   ) && !isGroupSelected(orgType);
  // };

  // Helper function to toggle all items in a group
  // const handleGroupToggle = (orgType: string) => {
  //   const groupItems = groupedDataSecurity[orgType] || [];
  //   const groupItemIds = groupItems.map(item => item.ParticipantId ?? '');
  //   const currentDataSecurityGroup = programEnums?.Details.DataSecurityGroup || [];
    
  //   if (isGroupSelected(orgType)) {
  //     // Remove all group items
  //     setProgramEnums(prev => ({
  //       ...prev,
  //       Details: {
  //         ...prev.Details,
  //         DataSecurityGroup: currentDataSecurityGroup.filter(id => !groupItemIds.includes(id))
  //       }
  //     }));
  //   } else {
  //     // Add all group items
  //     setProgramEnums(prev => ({
  //       ...prev,
  //       Details: {
  //         ...prev.Details,
  //         DataSecurityGroup: [...new Set([...currentDataSecurityGroup, ...groupItemIds])]
  //       }
  //     }));
  //   }
  // };

  // Get program location for map display
  // const getProgramLocation = () => {
  //   // You can map region codes or program data to coordinates later
  //   // For now, return a sample location in Metro Manila
  //   return {
  //     lat: 14.6091,
  //     lng: 121.0223,
  //     name: programEnums?.Details.Name || "Program Location"
  //   };
  // };

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
      if (!Array.isArray(arr1) || !Array.isArray(arr2)) return arr1 === arr2;
      if (arr1.length !== arr2.length) return false;
      const sorted1 = [...arr1].sort();
      const sorted2 = [...arr2].sort();
      return sorted1.every((val, index) => val === sorted2[index]);
    };

    // Helper function to compare number arrays
    const numberArraysEqual = (arr1: number[] | number = [], arr2: number[] | number = []) => {
      // Handle if they're not arrays (backward compatibility)
      if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
        return arr1 === arr2;
      }
      if (arr1.length !== arr2.length) return false;
      const sorted1 = [...arr1].sort((a, b) => a - b);
      const sorted2 = [...arr2].sort((a, b) => a - b);
      return sorted1.every((val, index) => val === sorted2[index]);
    };
    
    // Check if any editable field has changed
    return (
      currentDetails.Name === defaultDetails.Name &&
      currentDetails.YearStart === defaultDetails.YearStart &&
      currentDetails.YearEnd === defaultDetails.YearEnd &&
      currentDetails.Status === defaultDetails.Status &&
      currentDetails.Type === defaultDetails.Type &&
      numberArraysEqual(currentDetails.UserGroup, defaultDetails.UserGroup) &&
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
    if (programEnums?.Details.Status !== 1 || programEnums?.Details.StageId !== 10) return;
    setIsPublishDialogOpen(true);
  };

  const handleConfirmPublish = async() => {
    try {
      await publishToPCMA(programEnums?.Details.ProgramId);
      showToast({
        type: 'success',
        message: 'Program published to PCMA successfully.',
      });
      await fetchProgramDetail(programEnums?.Details.ProgramId, programEnums?.Details.StageName);
    } catch (error) {
      console.error('Error publishing program to PCMA:', error);
      showToast({
        type: 'error',
        message: 'Failed to publish program to PCMA. Please try again.',
      });
    }
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

  // const handleModifyProject = (projectId: string, stageName: string) => {
  //   alert('Modify Project clicked'+ ' ' + projectId + ' at stage ' + stageName);
  // };

  const handleDownloadTemplate = () => {
    // TODO: Implement download template functionality
    console.log('Download Template clicked');
    setIsActionDropdownOpen(false);
  };

  const handleBatchTagging = (action: 'tag' | 'delete' | 'unpublish' | 'publish' = 'tag') => {
    setBatchAction(action);
    setIsBatchTagDialogOpen(true);
    setIsActionDropdownOpen(false);
    setIsBatchTagDropDownOpen(false);
  };

  const handleBatchTagSubmit = async ( programId: string, projectIds: string, action: 'tag' | 'delete' | 'unpublish' | 'publish') => {
    try {
      setIsLoading(true);
      
      // TODO: Call your API endpoint here based on action type
      switch (action) {
        case 'delete':
          await batchDeleteProjects({ ProgramId: programId, ProjectIds: projectIds });
          console.log('Batch deleting projects:', projectIds);
          showToast({
            type: 'success',
            message: 'Projects deleted successfully.',
          });
          break;
        case 'unpublish':
          await batchRestrictPublishing({ ProgramId: programId, ProjectIds: projectIds });
          console.log('Batch restricting publishing of projects:', projectIds);
          showToast({
            type: 'success',
            message: 'Projects publishing restricted successfully.',
          });
          break;
        case 'publish':
          await batchAllowPublishing({ ProgramId: programId, ProjectIds: projectIds });
          console.log('Batch allowing publishing of projects:', projectIds);
          showToast({
            type: 'success',
            message: 'Projects publishing allowed successfully.',
          });
          break;
        default:
          // await batchTagProjects(programEnums?.Details.ProgramId, projectIds);
          console.log('Batch tagging projects with:', projectIds);
          showToast({
            type: 'success',
            message: 'Tags applied successfully to all projects.',
          });
      }
      
      // Refresh the program details to show updated data
      await fetchProgramDetail(programEnums?.Details.ProgramId, programEnums?.Details.StageName);
    } catch (error) {
      console.error(`Error performing batch ${action}:`, error);
      showToast({
        type: 'error',
        message: `Failed to ${action} projects. Please try again.`,
      });
    } finally {
      setIsLoading(false);
    }
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

  const handleViewAIP = () => {
    setIsAIPReportDialogOpen(true);
    setIsActionDropdownOpen(false);
  };

  const handleGenerateAIPReport = async (params: AIPReportParams) => {
    try {
      setIsLoading(true);
      
      // Download PDF blob from API
      const { blob, filename } = await downloadAIPReport(params);

      console.log(blob, filename)
      
      // Create download link for PDF
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast({
        type: 'success',
        message: 'AIP Report PDF downloaded successfully.',
      });
      
      setIsAIPReportDialogOpen(false);
    } catch (error) {
      console.error('Error downloading AIP report:', error);
      showToast({
        type: 'error',
        message: 'Failed to download AIP report. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
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
                  disabled
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
                  className="w-full text-left px-3 py-2 border border-gray-300 rounded-md bg-gray-200 text-gray-900"
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
                      <option key={status.Id} value={status.NameId}>
                        {status.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* User Group Multiple Select */}
            <CheckboxList
              title="User Groups"
              items={(programEnums?.Dropdowns.Groups || []).map(group => ({
                id: group.Id?.toString() || '',
                name: group.GroupName ?? '',
              }))}
              selectedIds={(Array.isArray(programEnums?.Details.UserGroup) ? programEnums.Details.UserGroup : []).map(id => id?.toString() || '')}
              onToggle={handleUserGroupToggle}
              onSelectAll={() => {
                const allGroupIds = programEnums?.Dropdowns.Groups.map(g => g.Id) || [];
                handleChange('UserGroup', allGroupIds);
              }}
              onClearAll={() => handleChange('UserGroup', [])}
              idKey="id"
              nameKey="name"
              searchPlaceholder="Search user groups..."
              emptyMessage="No user groups available"
              disabled={!programEnums?.IsActive}
            />

            {/* Data Security Multiple Select */}
            <CheckboxList
              title="Data Security Access"
              items={(programEnums?.Dropdowns.DataSecurity || []).map(item => ({
                id: item.ParticipantId ?? '',
                name: item.Name ?? '',
                groupType: item.OrgType === 'C' ? 'Central Office' : 
                           item.OrgType === 'R' ? 'Regional Offices' : 
                           item.OrgType === 'B' ? 'Bureaus' :
                           item.OrgType === 'PMO' ? 'Project Management Offices' : 
                           item.OrgType || 'Other'
              }))}
              selectedIds={programEnums?.Details.DataSecurityGroup || []}
              onToggle={handleDataSecurityToggle}
              onSelectAll={() => {
                const allDataSecurityIds = programEnums?.Dropdowns.DataSecurity.map(item => item.ParticipantId ?? '') || [];
                handleChange('DataSecurityGroup', allDataSecurityIds);
              }}
              onClearAll={() => handleChange('DataSecurityGroup', [])}
              groupBy="groupType"
              idKey="id"
              nameKey="name"
              searchPlaceholder="Search organizations..."
              emptyMessage="No data security options available"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Created Date:</label>
                <input
                  // value={programEnums?.Details.User}
                  value={programEnums?.Details.CreatedDate.StringToDate()}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-200 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Created By:</label>
                <input
                  // value={programEnums?.Details.User}
                  value={programEnums?.Details.CreatedBy}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-200 text-gray-900"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-4">
              {programEnums.IsActive &&
                programEnums.Details &&
                programEnums.Details.StageId >= 4 &&
                programEnums.Details.StageId < 10 && (
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
                  Program Location
                </h3>
              </div>
              <div className="p-4 h-[400px] text-lg flex items-center justify-center border border-gray-200 rounded-b-lg bg-gray-100">
                This section is for Future Map Integration 
                {/* <MetroManilaMap 
                  projectLocation={getProgramLocation()}
                  height="400px"
                /> */}
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
            {programEnums.IsActive && programEnums.Details.StageId === 10 && defaultProgramEnums.Details.Status === 1 && (
              <Button color="yellow" onClick={handlePublishToPCMA}>
                Publish Program
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
                onClick={() => setIsBatchTagDropDownOpen(!isBatchTagDropDownOpen)}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-100 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <TagIcon  className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                Batch Actions
                <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
              </button>

              {isBatchTagDropDownOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsBatchTagDropDownOpen(false)}
                  />
                  
                  {/* Batch Actions Menu */}
                  <div className="absolute left-0 top-full z-20 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                      {/* <button
                        onClick={() => handleBatchTagging('tag')}
                        className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                        </svg>
                        Batch Tag
                      </button> */}
                      <button
                        onClick={() => handleBatchTagging('delete')}
                        className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-red-500 hover:text-white"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Batch Delete
                      </button>
                      {programEnums.IsActive && programEnums.Details.StageId === 10 && defaultProgramEnums.Details.Status === 1 && (
                        <>
                        <button
                          onClick={() => handleBatchTagging('unpublish')}
                          className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-500 hover:text-white"
                        >
                          <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                          Restrict Publishing
                        </button>
                        <button
                          onClick={() => handleBatchTagging('publish')}
                          className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-green-500 hover:text-white"
                        >
                          <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Allow Publishing
                        </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-100 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
                  
                  {/* Import Export Menu */}
                  <div className="absolute right-0 top-full z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
                      <button
                        onClick={handleViewAIP}
                        className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        View AIP Report
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
                  Implementing Office
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operating Unit
                </TableHeader>
                {/* <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Project Cost
                </TableHeader> */}
                <TableHeader className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Publishable
                </TableHeader>
                {/* { programEnums?.IsActive && programEnums?.Details?.StageId === 10 && (
                <TableHeader className='px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </TableHeader>
                )} */}
              </TableRow>
            </TableHead>
            
            <TableBody className="bg-white divide-y divide-gray-200">
              {programEnums?.Projects ? programEnums.Projects.map((project) => (
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
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.ImplementingOffice}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.OperatingUnit}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-20">
                    {project.IsPublishable ? 'Yes' : 'No'}
                  </TableCell>
                  {/* { programEnums?.IsActive && programEnums?.Details?.StageId === 10 && programEnums?.Details?.IsPublished && (
                  <TableCell className='px-6 py-4 whitespace-nowrap text-sm font-medium text-center'>
                    <Button className="w-24 items-center" onClick={() => handleModifyProject(project.ProjectId, project.StageName)}>
                      Modify
                    </Button>
                  </TableCell>
                  )} */}
                </TableRow>
              ))
            : (
              <TableRow>
                <TableCell colSpan={8} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  No projects available for this program.
                </TableCell>
              </TableRow>
            )}
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

      {/* AIP Report Dialog */}
      {isAIPReportDialogOpen && (
        <AIPReportDialog
          isOpen={isAIPReportDialogOpen}
          onClose={() => setIsAIPReportDialogOpen(false)}
          onGenerate={handleGenerateAIPReport}
          programId={programEnums?.Details.ProgramId}
          programName={programEnums?.Details.Name}
          stageName={programEnums?.Details.StageName}
        />
      )}

      {/* Publish Program Dialog */}
      {isPublishDialogOpen && (
        <PublishProgramDialog
          isOpen={isPublishDialogOpen}
          onClose={() => setIsPublishDialogOpen(false)}
          onConfirm={handleConfirmPublish}
          programName={programEnums?.Details.Name}
          programId={programEnums?.Details.ProgramId}
        />
      )}

      {/* Batch Tag Dialog */}
      {isBatchTagDialogOpen && (
        <BatchTagDialog
          isOpen={isBatchTagDialogOpen}
          onClose={() => setIsBatchTagDialogOpen(false)}
          onSubmit={handleBatchTagSubmit}
          programId={programEnums?.Details.ProgramId}
          programName={programEnums?.Details.Name}
          action={batchAction}
        />
      )}
    </div>
  );
}

export default ProgramDetail;