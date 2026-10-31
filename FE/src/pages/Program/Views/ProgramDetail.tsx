"use-client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { ProgramDetailsEnums, ProgramProjectFilter, ProgramProjects } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { multiYearUpdateToast } from '../../MultiYear/utils';
import { editProgram, fetchProgramById, publishToPCMA, batchRestoreProjects, ShowProjectsInProgram, fetchDeletedProjects, restoreToCurrentStage } from '../Service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { useToast } from '../../../components/toaster/ToasterContext';
import NextStageDialog from '../dialogs/NextStageDialog';
import { getStageProgression } from '../utils/stageProgression';
// import MetroManilaMap from '../../../components/map/MetroManilaMap';
import PublishProgramDialog from '../dialogs/PublishProgramDialog';
import ActionsDropdown from '../components/programDetail/ActionsDropdown';
import BatchActionsDropdown from '../components/programDetail/BatchActionsDropdown';
import DeleteProjectButton from '../components/programDetail/DeleteProjectButton';
import DeletedProjectsPanel from '../components/programDetail/DeletedProjectsPanel';
import AddExistingProjectDialog from '../dialogs/AddExistingProjectDialog';
import BatchRestoreDialog from '../dialogs/BatchRestoreDialog';
import CheckboxList from '../../../components/ui/CheckboxList';
import { usePagination } from '@/hooks/usePagination';
import { PaginationBar } from '@/components/tailwindui/PaginationBar';
import { useAuth } from '@/contexts/AuthContext';
// import { formatCurrency } from '../../../utils/GlobalFunctions';
// import { Badge } from '../../../components/tailwindui/badge';

// RBP (NameId 8) is its own standalone stage — isTerminalStage is (correctly) always
// true there so Proceed never shows, but Add Project should still be available, so
// it's allow-listed explicitly instead of relying on isTerminalStage.
const RBP_STAGE_ID = 8;

// Mock projects data for the table
const ProgramDetail: React.FC = () => {
  const { program } = useParams<{ program: string }>();
  const id = useMemo(() => program?.split(':'), [program]);
  const navigate = useNavigate();
  const [nextStageName, setNextStageName] = useState<string | null>(null);
  const [skipStageName, setSkipStageName] = useState<string | null>(null);
  const [isTerminalStage, setIsTerminalStage] = useState(false);
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
        StageDisplayName: '',
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
    CanPublish: false,
    Dropdowns: {
      Statuses: [],
      Stages: [],
      Types: [],
      Groups: [],
      DataSecurity: []
    }
  });

  // Holds the ProgramPK from the latest /Program/ProgramDetails response (fetchProgramDetail
  // below sets it). NOT the URL's route segment and NOT Details.ProgramId (a different,
  // human-readable field) — the payload's ProgramId must carry the actual ProgramPK from the
  // program-details response. A ref (not state) so fetchProgramProjects always reads the
  // latest value the instant fetchProgramDetail resolves, without waiting on a re-render.
  const programPKRef = useRef('');

  // ShowProjectsInProgram needs ProgramId/StageName alongside the generic usePagination hook's
  // PaginatedRequest — adapt it into that shape here. The hook already threads
  // Navigation/PreviousFilteredId/NextFilteredId/PageCursorId correctly per request.
  const fetchProgramProjects = useCallback(
    async (params: PaginatedRequest<ProgramProjectFilter>) => {
      const response = await ShowProjectsInProgram({
        Filters: params.Filters,
        limit: params.limit,
        page: params.page,
        Navigation: params.Navigation ?? 0,
        PreviousFilteredId: params.PreviousFilteredId ?? null,
        NextFilteredId: params.NextFilteredId ?? null,
        PageCursorId: params.PageCursorId ?? null,
        ProgramId: programPKRef.current,
        StageName: id?.[1] ?? '',
        StageDisplayName: programEnums?.Details.StageDisplayName ?? '',
      });
      return response;
    },
    [id]
  );

  // enabled: false — this list is fetched explicitly from the [id] effect below, right after
  // fetchProgramDetail resolves and sets programPKRef.current, instead of pagination's own
  // mount-fetch (which would fire before programPKRef has a value). This way it re-fetches on
  // every stage change, not just once on mount.
  const pagination = usePagination<ProgramProjectFilter, ProgramProjects>(fetchProgramProjects, {
      initialFilters: { ProjectId: '' },
      limit: 10,
      enabled: false,
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
        StageDisplayName: '',
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
    CanPublish: false,
    Dropdowns: {
      Statuses: [],
      Stages: [],
      Types: [],
      Groups: [],
      DataSecurity: []
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const { can } = useAuth();
  // 2026-10-31: a group without Edit Program (access matrix) sees the program read-only.
  const canEditProgram = can('Program', 'UpdateProgramDetails');
  // const [searchTerm, setSearchTerm] = useState('');
  // const [isDataSecurityExpanded, setIsDataSecurityExpanded] = useState(false);
  const [isNextStageDialogOpen, setIsNextStageDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isAddExistingProjectDialogOpen, setIsAddExistingProjectDialogOpen] = useState(false);
  const [isBatchRestoreDialogOpen, setIsBatchRestoreDialogOpen] = useState(false);
  const [isDeletedPanelOpen, setIsDeletedPanelOpen] = useState(false);
  // How many projects are deleted at this stage, for the "Deleted projects (N)" button. Null hides
  // the button: not loaded yet, or the user may not list them (ShowDeletedProjects not granted).
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  useEffect(() => {
    const loadProgramDetail = async () => {
      if (id && id.length === 2) {
        try {
          await fetchProgramDetail(id[0], id[1]);
          // Recall the projects list once fetchProgramDetail has set programPKRef.current to
          // the fresh ProgramPK from the program-details response — same trigger (`id`
          // changing) and ordering as the program-details reload above, so it re-fetches on
          // every stage change (e.g. "Proceed to Next Stage"), not just once on mount.
          pagination.applyFilters(pagination.currentFilters ?? { ProjectId: '' });
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
      const normalizedData = {
        ...response.Data,
        Details: {
          ...response.Data.Details,
          UserGroup: (response.Data.Details.UserGroup || []).map(String),
        },
      };
      // Set synchronously (ref, not state) so fetchProgramProjects — read moments later in the
      // same [id] effect — sees the fresh ProgramPK without waiting on a re-render.
      programPKRef.current = normalizedData.Details.ProgramPK;
      setProgramEnums(normalizedData);
      setDefaultProgramEnums(normalizedData); // Store the original data for comparison

      // getStageProgression partitions the full stage list into TF / RBP / main tracks
      // based on where the program's *current* stage sits (see stageProgression.ts).
      // RBP/RDIP/PIP are their own separate track — not reached by "Proceed" from the
      // main BP→GAA-R track — so GAA-R stays terminal there, while a program already
      // on the RBP track proceeds normally through RBP→RDIP→PIP.
      const { nextStage, skipStage, isTerminalStage: reachedTerminalStage } = getStageProgression(
        response.Data.Dropdowns.Stages,
        response.Data.Details.StageId,
        response.Data.Details.Type
      );
      // Display label only — Name/NameId (not DisplayName) is what gets sent as the
      // payload for the actual stage transition (see handleNextStageSubmit, NextStageDialog).
      setNextStageName(nextStage ? nextStage.DisplayName || nextStage.Name : '');
      setSkipStageName(skipStage ? skipStage.DisplayName || skipStage.Name : null);
      setIsTerminalStage(reachedTerminalStage);
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
    // Source ProgramPK/StageName from the route (id[0]/id[1]) rather than programEnums.Details:
    // the /Program/ProgramDetails response's Details object doesn't currently carry ProgramPK/StageName,
    // so those were coming through as "undefined" in the query string and AddProject's dropdown-match
    // (componentDropdowns.Programs.find by ProgramPK+StageName) never found the program.
    // Note: id[0] is the route's ProgramPK segment (see Program.tsx's handleViewDetails(program.ProgramPK, ...)),
    // not the human-readable ProgramId — passing it as ProgramPK keeps this consistent with the match downstream.
    const [programPK, stageName] = id ?? [];
    if (programPK && stageName) {
      navigate(`/projects/addproject?programPK=${programPK}&stageName=${stageName}`);
    }
  };

  // const handleAddExistingProject = () => {
  //   setIsBatchRestoreDialogOpen(true);
  // };

  // The projects table is sourced separately from the program header (usePagination +
  // ShowProjectsInProgram, since b11ed1b4) — fetchProgramDetail alone never touches it. Every
  // action that mutates project rows must call this after it, or the table keeps showing the
  // pre-action rows/flags until a full page reload.
  //
  // By default the user stays on the page they are on (pagination.refresh()): Restrict/Allow
  // Publishing and Publish Program only change flags, and throwing someone on page 7 back to
  // page 1 hides the very row they just changed. An action that changes WHICH rows exist
  // (Batch Delete, Batch Restore) passes resetToFirstPage, which goes through applyFilters
  // (page 1, cursors cleared) instead: the cached keyset cursors no longer describe the pages.
  const refreshProjects = (resetToFirstPage = false) => {
    if (resetToFirstPage) {
      pagination.applyFilters(pagination.currentFilters ?? { ProjectId: '' });
      return;
    }
    pagination.refresh();
  };

  const currentProgramId = programEnums?.Details.ProgramId;
  const canListDeleted = can('Program', 'ShowDeletedProjects');
  const loadDeletedCount = useCallback(async () => {
    if (!currentProgramId || !canListDeleted) return;
    try {
      const response = await fetchDeletedProjects(currentProgramId, { silent: true });
      setDeletedCount(response.Data.Projects?.length ?? 0);
    } catch {
      setDeletedCount(null);
    }
  }, [currentProgramId, canListDeleted]);

  useEffect(() => {
    loadDeletedCount();
  }, [loadDeletedCount]);

  /** True when the restore went through (the Deleted projects panel reloads its list then). */
  const handleBatchRestoreSubmit = (programId: string, projectIds: string): Promise<boolean> =>
    runRestore(() => batchRestoreProjects({ ProgramId: programId, ProjectIds: projectIds }));

  /** Deleted at a stage the program has left: copied into the current stage. */
  const handleRestoreToCurrentStage = (projectFKs: string[]): Promise<boolean> =>
    runRestore(() => restoreToCurrentStage({ ProgramId: currentProgramId ?? '', ProjectFKs: projectFKs }));

  const runRestore = async (restore: () => ReturnType<typeof batchRestoreProjects>): Promise<boolean> => {
    setIsLoading(true);
    let restored = false;
    try {
      const response = await restore();
      // The API's message says how many came back and names the ids that did not, and why. A
      // partial restore is a warning, so refused or missing ids are not read past as "done".
      const data = response.Data;
      const partial = !!(data?.RefusedProjects?.length || data?.MissingProjectIds?.length);
      showToast({
        type: partial ? 'warning' : 'success',
        message: data?.Message || 'Projects restored successfully.',
      });
      restored = true;
    } catch (error) {
      console.error('Error restoring projects:', error);
      // The interceptor toasted (and set Message) for any API error that carried one;
      // toast only when it stayed silent (network error, 401/403/500 without a Message).
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to restore projects. Please try again.' });
      }
    }

    // Refresh is separate from the restore, as in BatchActionsDropdown: once the restore has
    // committed, a failed reload must not say "Failed to restore", or the user retries it.
    if (restored) {
      try {
        refreshProjects(true);
        await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
        await loadDeletedCount();
      } catch (error) {
        console.error('Error refreshing after batch restore:', error);
        showToast({ type: 'warning', message: 'The action completed, but the page failed to refresh. Please reload to see the latest data.' });
      }
    }
    setIsLoading(false);
    return restored;
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

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      const response = await editProgram(programEnums?.Details);
      if (response) {
        showToast({
          type: 'success',
          message: 'Program details updated successfully.',
        });
        const multiYear = multiYearUpdateToast(response.Data);
        if (multiYear) showToast(multiYear);
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

  const handleNextStageSubmit = async (data: { ProgramId: string; ProgramPK: string; Stage: number; Name?: string }) => {
    try {
      const nextStageName = programEnums?.Dropdowns.Stages.find(stage => stage.NameId === data.Stage);
      if (nextStageName) {
        // Proceeding to the next stage doesn't change the program itself, only its
        // StageName — the URL's ProgramPK segment (id[0]) stays the same. data.ProgramId is
        // the human-readable code (e.g. "DESKTOP-9OG49KJ_...", used by the updateProgramStage
        // payload), not the PK the route expects — using it here as the URL segment was the bug.
        handleViewDetails(id?.[0] ?? '', nextStageName.Name);
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
    if (programEnums?.Details.Status !== 1 || !isTerminalStage) return;
    setIsPublishDialogOpen(true);
  };

  const handleConfirmPublish = async() => {
    try {
      await publishToPCMA(programEnums?.Details.ProgramId);
      showToast({
        type: 'success',
        message: 'Program published to PCMA successfully.',
      });
      await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
      // Re-fetch the projects list so the Published/Publishable columns reflect the
      // statuses PCMA just flipped server-side (see refreshProjects).
      refreshProjects();
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

  const handleViewProject = (projectId: string) => {
    try {
      // Use the program's own StageName (programEnums.Details.StageName) rather than the
      // project row's StageName from ShowProjectsInProgram — same pattern as ProjectForm.tsx's
      // post-save navigate, which sources StageName from ProgramDetails, not the project record.
      const stageName = programEnums?.Details.StageName;
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
                  disabled
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
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 ${!programEnums?.IsActive || !canEditProgram ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!programEnums?.IsActive || !canEditProgram}
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
              disabled={!programEnums?.IsActive || !canEditProgram}
            />

            {/* Data Security Multiple Select */}
            <CheckboxList
              title="Data Security Access"
              items={(programEnums?.Dropdowns.DataSecurity || []).map(item => ({
                id: item.ParticipantId ?? '',
                name: item.Name ?? '',
                groupType: item.OrgType === 'CO' ? 'CO' :
                           item.OrgType === 'B' ? 'CO' :
                           item.OrgType === 'R' ? 'Regional Offices' :
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
              disabled={!canEditProgram}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Created Date:</label>
                <input
                  // value={programEnums?.Details.User}
                  value={programEnums?.Details.CreatedDate ? programEnums.Details.CreatedDate.StringToDate() : ''}
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
                !isTerminalStage && can('Program', 'UpdateProgramStage') && (
                  <Button color="blue" className="w-auto items-center text-nowrap" onClick={() => handleProceed(false)}>
                    Proceed to {nextStageName}
                  </Button>
              )}
              {programEnums.IsActive &&
                programEnums.Details &&
                (programEnums?.Details?.StageId === 2 || programEnums?.Details?.StageId === 4) && can('Program', 'UpdateProgramStage') && (
                  <Button color="blue" className="w-auto items-center text-nowrap" onClick={() => handleProceed(true)}>
                    Proceed to {skipStageName}
                  </Button>
              )}
              {programEnums.IsActive && canEditProgram && (
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
            {programEnums.IsActive && isTerminalStage && defaultProgramEnums.Details.Status === 1 && defaultProgramEnums.CanPublish && can('PCMA', 'PublishProgram') && (
              <Button color="yellow" onClick={handlePublishToPCMA}>
                Publish Program
              </Button>
            )}
            {programEnums.IsActive &&
              defaultProgramEnums.Details.Status === 3 &&
              (!isTerminalStage || programEnums?.Details?.StageId === RBP_STAGE_ID) && can('Project', 'AddProject') && (
              <Button color="blue" onClick={handleAddProject}>
                Add Project
              </Button>
            )}
            {/* {programEnums.IsActive &&
              defaultProgramEnums.Details.Status === 3 &&
              (!isTerminalStage || programEnums?.Details?.StageId === RBP_STAGE_ID) && (
              <Button color="blue" onClick={handleAddExistingProject}>
                Add Existing Project
              </Button>
            )} */}
            <BatchActionsDropdown
              programId={programEnums?.Details.ProgramId ?? ''}
              programName={programEnums?.Details.Name ?? ''}
              isActive={programEnums.IsActive}
              isTerminalStage={isTerminalStage}
              defaultStatus={defaultProgramEnums.Details.Status}
              onRefresh={async (action) => {
                // Batch Delete / Restrict / Allow change project rows and flags — the table
                // must be re-fetched too, or it keeps showing the pre-action state. Only a
                // delete removes rows, so only a delete goes back to page 1. The table refresh
                // runs first so a failed header refetch can't leave it stale.
                refreshProjects(action === 'delete');
                await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
                if (action === 'delete') await loadDeletedCount();
              }}
              onLoadingChange={setIsLoading}
              onBatchRestore={() => setIsBatchRestoreDialogOpen(true)}
            />
            {/* Projects soft-deleted at this stage, with Restore (a project deleted at its first
                stage is permanently deleted and is not listed). */}
            {deletedCount !== null && (
              <Button outline onClick={() => setIsDeletedPanelOpen(true)}>
                Deleted projects ({deletedCount})
              </Button>
            )}
            <ActionsDropdown
              programId={programEnums?.Details.ProgramPK ?? ''}
              programName={programEnums?.Details.Name ?? ''}
              stageName={programEnums?.Details.StageName ?? ''}
              reportProgramId={programEnums?.Details.ProgramId ?? ''}
              startYear={programEnums?.Details.StartYear ?? 0}
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
                <TableHeader className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </TableHeader>
                {/* { programEnums?.IsActive && programEnums?.Details?.StageId === 10 && (
                <TableHeader className='px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  Actions
                </TableHeader>
                )} */}
              </TableRow>
            </TableHead>
            
            <TableBody className="bg-white divide-y divide-gray-200">
              {pagination.data.lists ? pagination.data.lists.map((project) => (
                <TableRow key={project.Id} className="hover:bg-gray-50">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleViewProject(project.ProjectId)} className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                      {project.ProjectId}
                    </button>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-64">
                    {project.Description}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.CategoryName}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.ThrustName}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.ImplementingOfficeName}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-60">
                    {project.OperatingUnitName}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-20">
                    {project.IsPublishable ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-20">
                    {project.IsPublished ? 'Yes' : 'No'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-center">
                    {/* No client-side rule for which rows can be deleted: the server preview the
                        button opens says whether this project would be deleted, and why not. */}
                    {can('Program', 'BatchDelete') && (
                    <DeleteProjectButton
                      programId={programEnums?.Details.ProgramId ?? ''}
                      programName={programEnums?.Details.Name ?? ''}
                      projectId={project.ProjectId}
                      onDeleted={async () => {
                        // Same refresh as Batch Delete: the row is gone, so back to page 1.
                        refreshProjects(true);
                        await fetchProgramDetail(programEnums?.Details.ProgramPK, programEnums?.Details.StageName);
                        await loadDeletedCount();
                      }}
                      onLoadingChange={setIsLoading}
                    />
                    )}
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
                <TableCell colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  No projects available for this program.
                </TableCell>
              </TableRow>
            )}
            </TableBody>
          </Table>
          <PaginationBar
              currentPage={pagination.data.page}
              totalPages={pagination.data.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              onGoToPage={pagination.goToPage}
              onNext={pagination.goNext}
              onPrevious={pagination.goPrevious}
              onFirst={pagination.goFirst}
              onLast={pagination.goLast}
              isLoading={pagination.isLoading}
          />
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

      {isDeletedPanelOpen && (
        <DeletedProjectsPanel
          isOpen={isDeletedPanelOpen}
          onClose={() => setIsDeletedPanelOpen(false)}
          programId={programEnums?.Details.ProgramId ?? ''}
          programName={programEnums?.Details.Name ?? ''}
          stageName={programEnums?.Details.StageName ?? ''}
          onRestore={(projectIds) => handleBatchRestoreSubmit(programEnums?.Details.ProgramId ?? '', projectIds)}
          onRestoreToCurrentStage={handleRestoreToCurrentStage}
        />
      )}

      {/* Batch Restore Dialog */}
      {isBatchRestoreDialogOpen && (
        <BatchRestoreDialog
          isOpen={isBatchRestoreDialogOpen}
          onClose={() => setIsBatchRestoreDialogOpen(false)}
          onSubmit={handleBatchRestoreSubmit}
          // BatchAddExistingProject looks the program up by vProgramLatest.ProgramId, as Batch
          // Delete does; the ProgramPK it was given here answered "Program not found".
          programId={programEnums?.Details.ProgramId}
          programName={programEnums?.Details.Name}
        />
      )}


    </div>
  );
}

export default ProgramDetail;