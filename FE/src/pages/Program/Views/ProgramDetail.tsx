"use-client";
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { ProgramDetailsEnums } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { editProgram, fetchProgramById, publishToPCMA, batchRestoreProjects } from '../Service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { useToast } from '../../../components/toaster/ToasterContext';
import NextStageDialog from '../dialogs/NextStageDialog';
// import MetroManilaMap from '../../../components/map/MetroManilaMap';
import PublishProgramDialog from '../dialogs/PublishProgramDialog';
import ActionsDropdown from '../components/programDetail/ActionsDropdown';
import BatchActionsDropdown from '../components/programDetail/BatchActionsDropdown';
import AddExistingProjectDialog from '../dialogs/AddExistingProjectDialog';
import BatchRestoreDialog from '../dialogs/BatchRestoreDialog';
import CheckboxList from '../../../components/ui/CheckboxList';
// import { formatCurrency } from '../../../utils/GlobalFunctions';
// import { Badge } from '../../../components/tailwindui/badge';

// Mock projects data for the table
const ProgramDetail: React.FC = () => {
  const { program } = useParams<{ program: string }>();
  const id = useMemo(() => program?.split(':'), [program]);
  const navigate = useNavigate();
  const [nextStageName, setNextStageName] = useState<string | null>(null);
  const [skipStageName, setSkipStageName] = useState<string | null>(null);
  const [isSkipStage, setIsSkip] = useState(false);
  const { showToast } = useToast();
  const [programEnums, setProgramEnums] = useState<ProgramDetailsEnums>({
    Details: {
        StageFKId: 0,
        ProgramPK: '',
        ProgramId: '',
        RevisionId: 0,
        Name: '',
        StageId: 0,
        StageName: '',
        IsSkipped: false,
        IsPublished: false,
        IsDeleted: false,
        UserGroup: [],
        Status: 0,
        Type: 0,
        Cost: 0,
        DataSecurityGroup: [],
        StartYear: 0,
        CreatedBy: '',
        CreatedDate: '',
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
        StageFKId: 0,
        ProgramPK: '',
        ProgramId: '',
        RevisionId: 0,
        Name: '',
        StageId: 0,
        StageName: '',
        IsSkipped: false,
        IsPublished: false,
        IsDeleted: false,
        UserGroup: [],
        Status: 0,
        Type: 0,
        Cost: 0,
        DataSecurityGroup: [],
        StartYear: 0,
        CreatedBy: '',
        CreatedDate: '',
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
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isAddExistingProjectDialogOpen, setIsAddExistingProjectDialogOpen] = useState(false);
  const [isBatchRestoreDialogOpen, setIsBatchRestoreDialogOpen] = useState(false);
  
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

      const skipStageId = response.Data.Details.StageId + 2;
      const skipStage = response.Data.Dropdowns.Stages.find(stage => stage.Id === skipStageId);
      setSkipStageName(skipStage ? skipStage.Name : null);
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
    navigate(`/projects/addproject?programId=${programEnums?.Details.ProgramPK}&stageName=${programEnums?.Details.StageName}`);
  };

  const handleAddExistingProject = () => {
    setIsBatchRestoreDialogOpen(true);
  };

  const handleBatchRestoreSubmit = async (programId: string, projectIds: string) => {
    try {
      setIsLoading(true);
      await batchRestoreProjects({ ProgramId: programId, ProjectIds: projectIds });
      showToast({
        type: 'success',
        message: 'Projects restored successfully.',
      });
      await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
    } catch (error) {
      console.error('Error restoring projects:', error);
      showToast({
        type: 'error',
        message: 'Failed to restore projects. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExistingProjectSubmit = async (projectIds: string[]) => {
    try {
      setIsLoading(true);
      // TODO: Call API to link selected projects to this program
      console.log('Adding existing projects to program:', programEnums?.Details.ProgramPK, projectIds);
      showToast({
        type: 'success',
        message: `${projectIds.length} project${projectIds.length !== 1 ? 's' : ''} added successfully.`,
      });
      await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
    } catch (error) {
      console.error('Error adding existing projects:', error);
      showToast({
        type: 'error',
        message: 'Failed to add projects. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
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
    setProgramEnums(prev => ({
      ...prev,
      Details: {
        ...prev.Details,
        UserGroup: (prev.Details.UserGroup || []).includes(userGroupId)
          ? (prev.Details.UserGroup || []).filter(id => id !== userGroupId)
          : [...(prev.Details.UserGroup || []), userGroupId]
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
      await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
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

    // Check if any editable field has changed
    return (
      currentDetails.Name === defaultDetails.Name &&
      currentDetails.StartYear === defaultDetails.StartYear &&
      currentDetails.Status === defaultDetails.Status &&
      currentDetails.Type === defaultDetails.Type &&
      arraysEqual(currentDetails.UserGroup, defaultDetails.UserGroup) &&
      arraysEqual(currentDetails.DataSecurityGroup, defaultDetails.DataSecurityGroup)
    );
  };

  const handleProceed = async (isSkip: boolean) => {
    setIsNextStageDialogOpen(true);
    setIsSkip(isSkip);
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
      await publishToPCMA(programEnums?.Details.ProgramPK);
      showToast({
        type: 'success',
        message: 'Program published to PCMA successfully.',
      });
      await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
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
                  onChange={(e) => handleChange('StartYear', e.target.value)}
                  value={programEnums?.Details.StartYear}
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
              selectedIds={programEnums?.Details.UserGroup || []}
              onToggle={handleUserGroupToggle}
              onSelectAll={() => {
                const allGroupIds = (programEnums?.Dropdowns.Groups || []).map(g => g.Id?.toString() || '');
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
                           item.OrgType === 'R' ? (item.RegionName ?? 'Regional Offices') :
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
                  <Button color="blue" className="w-auto items-center text-nowrap" onClick={() => handleProceed(false)}>
                    Proceed to {nextStageName}
                  </Button>
              )}
              {programEnums.IsActive &&
                programEnums.Details &&
                (programEnums?.Details?.StageId === 5 || programEnums?.Details?.StageId === 7) && (
                  <Button color="blue" className="w-auto items-center text-nowrap" onClick={() => handleProceed(true)}>
                    Proceed to {skipStageName}
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
            {programEnums.IsActive && defaultProgramEnums.Details.Status === 3 && programEnums?.Details?.StageId <= 10 && (
              <Button color="blue" onClick={handleAddProject}>
                Add Project
              </Button>
            )}
            {programEnums.IsActive && programEnums?.Details?.StageId < 10 && (
              <Button color="blue" onClick={handleAddExistingProject}>
                Add Existing Project
              </Button>
            )}
            <BatchActionsDropdown
              programId={programEnums?.Details.ProgramPK ?? ''}
              programName={programEnums?.Details.Name ?? ''}
              isActive={programEnums.IsActive}
              stageId={programEnums?.Details.StageId ?? 0}
              defaultStatus={defaultProgramEnums.Details.Status}
              onRefresh={() => fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName)}
              onLoadingChange={setIsLoading}
            />
            <ActionsDropdown
              programId={programEnums?.Details.ProgramPK ?? ''}
              programName={programEnums?.Details.Name ?? ''}
              stageName={programEnums?.Details.StageName ?? ''}
              stageId={programEnums?.Details.StageId ?? 0}
              stages={programEnums?.Dropdowns.Stages || []}
              onRefresh={() => fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName)}
              onLoadingChange={setIsLoading}
            />
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
                <TableHeader className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Published
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
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-20">
                    {project.IsPublished ? 'Yes' : 'No'}
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
          isSkip={isSkipStage}
        />
      )}

      {/* Publish Program Dialog */}
      {isPublishDialogOpen && (
        <PublishProgramDialog
          isOpen={isPublishDialogOpen}
          onClose={() => setIsPublishDialogOpen(false)}
          onConfirm={handleConfirmPublish}
          programName={programEnums?.Details.Name}
          programId={programEnums?.Details.ProgramPK}
        />
      )}

      {/* Batch Tag Dialog is now inside BatchActionsDropdown */}

      {/* Add Existing Project Dialog */}
      {isAddExistingProjectDialogOpen && (
        <AddExistingProjectDialog
          isOpen={isAddExistingProjectDialogOpen}
          onClose={() => setIsAddExistingProjectDialogOpen(false)}
          onSubmit={handleAddExistingProjectSubmit}
          programId={programEnums?.Details.ProgramPK}
          programName={programEnums?.Details.Name}
        />
      )}

      {/* Batch Restore Dialog */}
      {isBatchRestoreDialogOpen && (
        <BatchRestoreDialog
          isOpen={isBatchRestoreDialogOpen}
          onClose={() => setIsBatchRestoreDialogOpen(false)}
          onSubmit={handleBatchRestoreSubmit}
          programId={programEnums?.Details.ProgramPK}
          programName={programEnums?.Details.Name}
        />
      )}


    </div>
  );
}

export default ProgramDetail;