import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formValidation, type FormValidationError } from '../../../../utils/FormValidation';
import { projectDetailsRules } from '../../../Project/rules/projectDetailsRules';

import type { 
  ProjectDetails, 
  ComponentCost,
  ComponentCostPerYear, 
  // ProjectNote,
  FundingProfile, 
  Activity, 
  TransactionLog,
  ProjectEnums,
  Dropdowns,
  InfraData,
  ProjectSupportingDocs
} from '../../../Project/Model.d';

import { Button } from '../../../../components/tailwindui/button';
import MapRenderer from '../../../../components/map/MapRenderer';

//Sub-components
import ProgramDetailsForm from './ProgramDetailsForm';
import ProjectDetailsForm from './ProjectDetailsForm';
import ComponentCostForm from './ComponentCostForm';
import MajorItemOfWorksForm from './MajorItemOfWorksForm';
import NotesForm from './NotesForm';
import FundingProfileForm from './FundingProfileForm';
import ActivitySection from './ActivitySection';
import { addProjectDetails, getProjectEnums, fetchProjectGeoJSON } from '../../../Project/Service';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { ProgramLatest } from '../../../Program/Model';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ReviseProjectDialog from '../../dialogs/RevisedProjectDialog';
import ApproveModifyDialog from '../../dialogs/ApproveModifyDialog';
import ForReviewModifyDialog from '../../dialogs/ForReviewModifyDialog';
// import TerminationDialog from '../../dialogs/TerminationDialog';
import ExcessPrompt from '../../dialogs/ExcessPrompt';
import RejectModifyDialog from '../../dialogs/RejectModifyDialog';

import RevisionForm from './RevisionForm';
import { checkExcessComponent } from '../../conditions/ExcessComponentAutomation';
import addExcessComponent from '../../conditions/AddExcessComponent';
import { applyTerminationNoDisbursementAutomation } from '../../conditions/TerminationNoDisbursementAutomation';

import { useAuth } from '../../../../contexts/AuthContext';
import { useFieldPermissions } from '../../hooks/useFieldPermissions';
import type { RevisionProjectPayload } from '../../Model';
// import { updateRevisionRequestStatus } from '../../Service'; 
import ResubmitRevisionDialog from '../../dialogs/ResubmitRevisionDialog';

import { useAtom } from 'jotai';
import {
  componentCostsAtom,
  componentCostPerYearAtom
} from '../../atoms/componentCosts.atom';
import { useComponentCosts } from '../../hooks/useComponentCosts';

import { useMajorItemOfWorks } from '../../hooks/useMajorItemOfWorks';
import { RevisionActionButtons } from '../../../../components/actionButtons/RevisionActionButtons';


interface ProjectFormProps {
  initialData?: RevisionProjectPayload;
  mode?: 'add' | 'edit' | 'view';
  initialProgramId?: string;
  category?: string;
  reason?: string;
  reasonId?: number;
  categoryId?: number;
  revisionGroupId?: number;
  fieldLabels?: Record<string, any>;
  onActionSuccess?: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, mode = 'add', initialProgramId, category, reason, reasonId, categoryId, revisionGroupId, fieldLabels: _fieldLabels, onActionSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
  const [updateAllProject] = useState<boolean>(false);
  const [updateApproveProject] = useState<boolean>(false);
  const [rejectDialogProject] = useState<boolean>(false);
  const [updateReviseProject] = useState<boolean>(false);
  const [updateResubmitRevision] = useState<boolean>(false);
  const [updateForReviewProject] = useState<boolean>(false);
  // const [reviseProject, setReviseProject] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormValidationError<ProjectDetails>>({});
  //toaster here
  const { showToast } = useToast();
  // DisableFields if status === approved
  const isDisabled = Number(initialData?.ProgramDetails?.Status) === 1;

  // Determine category and reason based on whether modification is submitted (in database) or not
  // If modification exists in database, use those values; otherwise use props from project module
  // Memoize these to prevent recreating on every render which causes infinite loops
  const modificationCategory = useMemo(() => 
    initialData?.Category.CategoryName || category,
    [initialData?.Category.CategoryName, category]
  );
  const modificationReason = useMemo(() => 
    initialData?.Reason.Reason || reason,
    [initialData?.Reason.Reason, reason]
  );
  const modificationReasonId = useMemo(() => 
    initialData?.Reason.ReasonId || reasonId,
    [initialData?.Reason.ReasonId, reasonId]
  );

  // toggle state for Program Details section
  const [isRevisionOpen, setIsRevisionOpen] = useState<boolean>(true);
  const [isProgramOpen, setIsProgramOpen] = useState<boolean>(true);
  const [isProjectOpen, setIsProjectOpen] = useState<boolean>(true);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(true);
  // set isRevisedProjectDialogOpen
  const [isRevisedProjectDialogOpen, setIsRevisedProjectDialogOpen] = useState<boolean>(false);
  const [isResubmitRevisionDialogOpen, setIsResubmitRevisionDialogOpen] = useState<boolean>(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState<boolean>(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState<boolean>(false);
  const [isForReviewDialogOpen, setIsForReviewDialogOpen] = useState<boolean>(false);
  // const [isTerminationDialogOpen, setIsTerminationDialogOpen] = useState<boolean>(false);
  const [isExcessPromptOpen, setIsExcessPromptOpen] = useState<boolean>(false);
  const [excessComponentData, setExcessComponentData] = useState<{ excessAmount: number; message: string } | null>(null);

  // get the status of Revision
  // #region Revision Status Text
  const revisionStatus = initialData?.ProjectStatus?.RevisionStatus;
  // #endregion

  // set GeoJSON data for map
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);
  
  // SetMaxAmount in ComponentCostForm
  const [maxAmountCost, setMaxAmountCost] = useState<number>(0);

  // Initialize state with empty data or provided initial data
  const [programDetails, setProgramDetails] = useState<ProgramLatest>(
    initialData?.ProgramDetails || {
    Id: 0,
    RevisionId: 0,
    StageFKId: 0,
    ProgramPK: '',
    ProgramId: '',
    StageId: 0,
    StageName: '',
    Name: '',
    Status: undefined,
    Type: '',
    DataSecurityGroup: '',
    UserGroup: '',
    StartYear: 0,
    YearEnd: 0,
  });

  const [projectDetails, setProjectDetails] = useState<ProjectDetails>(
    initialData?.ProjectDetails || {
      Id: 0,
      ProjectPK: '',
      ProjectType: '',
      ProgramId: '',
      ProgramName: '',
      StageName: '',
      ProjectId: '',
      AlternateId: '',
      ExternalId: '',
      MYId: '',
      UACS: '',
      MYCAApprovalDate: '',
      IslandCode: '',
      RevisionId: 0,
      Description: '',
      Category: 0,
      Thrust: 0,
      Origin: 0,
      City: '',
      LegislativeDistrict: '',
      OperatingUnit: '',
      ImplementingOffice: '',
      DEO: '',
      Region: '',
      Agency: 0,
      ImplementationMode: 0,
      EmergencyMode: 0,
      Feasibility: 0,
      DetailedDesign: 0,
      RowAvailable: 0,
      RegionWide: 0,
      Tier: 1,
      CreatedDate: '',
      RevisionCreatedBy: '',
      RevisionCreatedDate: '',
      Source: '',
    }
  );

  // Load Allowed Fields using Jotai
  // #region Modification Set Fields
  const {
    pcmaStatus,
    packageStatus,
    currentCase,
    permissions,
    fieldRules
  } = useFieldPermissions();

  // #region GEOJSON DATA FOR MAP
  // Fetch GeoJSON data for map rendering
  const loadMapData = useCallback(async () => {
    if (mode === 'edit' && initialData?.ProjectDetails?.ProjectId && initialData?.ProgramDetails?.ProgramId) {
      try {
        const response = await fetchProjectGeoJSON(
          initialData.ProjectDetails.ReferenceId || '',
          initialData.ProgramDetails.ProgramId,
          user?.UserId || '',
          initialData.ProgramDetails.StageName
        );
        if (response.Data) {
          setGeoJsonData(response.Data as GeoJSON.FeatureCollection);
        }
      } catch (error) {
        console.error('Error loading map data:', error);
        // Gracefully handle error - map will show "No data available"
      }
    }
  }, [mode, initialData?.ProjectDetails?.ProjectId, initialData?.ProgramDetails?.ProgramId, initialData?.ProgramDetails?.StageName, user?.UserId]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);
  // #endregion

  useEffect(() => {
    // Load project enums
    const loadProjectEnums = async () => {
      try {
        const response = await getProjectEnums()
        setProjectEnums(response.Data);
      } catch (error) {
        console.error('Error loading project enums:', error);
      }
    };
    loadProjectEnums();

    // Set program details if in edit mode and initialData is present
    if (mode === 'edit' && initialData?.ProgramDetails) {
      setProgramDetails(initialData.ProgramDetails);
    }
  }, [mode, initialData]);

  // Separate useEffect to handle initialProgramId
  useEffect(() => {
    if (initialProgramId && projectEnums?.Programs) {
      const selectedProgram = projectEnums.Programs.find(
        program => program.ProgramId === initialProgramId
      );
      if (selectedProgram) {
        // projectEnums.Programs is still ProgramList-shaped (see @deprecated note on ProjectEnums.Programs) — this
        // path is not currently populated by the backend, so the cast can't be structurally verified.
        setProgramDetails(selectedProgram as unknown as ProgramLatest);
        // Also update project details with the program ID
        setProjectDetails(prev => ({
          ...prev,
          ProgramId: selectedProgram.ProgramId,
          ProgramName: selectedProgram.Name,
          StageName: selectedProgram.StageName || ''
        }));
      }
    }
  }, [initialProgramId, projectEnums?.Programs]);

  // #region State and Handlers
  // Component Costs: use Jotai atoms instead of local state ===
  const [componentCosts, setComponentCosts] = useAtom(componentCostsAtom);
  const [componentCostPerYear] = useAtom(componentCostPerYearAtom);
  const { add: addComponentCost, update: updateComponentCost, removeByIndex: deleteComponentCost, seedFromInitial } = useComponentCosts();

  // Seed atoms from initialData whenever it's available (not just in edit mode)
  useEffect(() => {
    if (initialData) {
      seedFromInitial({
        ComponentCosts: (initialData.ComponentCosts || []).map(cost => ({
          ...cost,
          ProjectId: (cost.ProjectId || '').replace(/\s+/g, '')
        })),
        ComponentCostPerYear: initialData.ComponentCostPerYear || []
      });
    }
  }, [mode, initialData, seedFromInitial]);

  // Major Items of Work: use Jotai atoms instead of local state ===
  const {
    majorItems,
    seedFromInitialData,
    addMajorItem,
    editMajorItem,
    deleteMajorItem
  } = useMajorItemOfWorks();

  useEffect(() => {
    seedFromInitialData(initialData);
  }, [initialData]);

  // #region Termination - No Disbursement Automation
  // Apply automation when reasonId is 37 (Termination - No Disbursement)
  useEffect(() => {
    if (mode !== 'edit' || !initialData) return;

    const automation = applyTerminationNoDisbursementAutomation(
      reasonId,
      componentCosts,
      projectDetails.ProjectId || '',
      initialData?.ProgramDetails?.StageName || '',
      user?.UserId
    );

    if (automation.shouldApply && automation.terminatedCount > 0) {
      console.log('Applying Termination - No Disbursement automation:', {
        terminatedCount: automation.terminatedCount,
        totalAmount: automation.totalTerminatedAmount,
        excessComponent: automation.excessComponent
      });

      // Update component costs: set terminated components to 0
      setComponentCosts(automation.updatedComponents);

      // Add excess component if there's a terminated amount
      if (automation.excessComponent) {
        // Check if EXC component already exists to avoid duplicates
        const hasExcessComponent = componentCosts.some(
          c => c.ComponentId === 'EXC' && !c.IsDeleted
        );

        if (!hasExcessComponent) {
          addComponentCost(automation.excessComponent, []);
          
          showToast({
            type: 'info',
            message: `${automation.terminatedCount} terminated component(s) set to ₱0. Excess component created for ₱${automation.totalTerminatedAmount.toLocaleString('en-PH')}`
          });
        }
      }
    }
  }, [reasonId, mode, initialData?.ComponentCosts]);
  // #endregion

  const [docs, setDocs] = useState<ProjectSupportingDocs[]>(
    initialData?.Docs || []
  );

  const [fundingProfiles, setFundingProfiles] = useState<FundingProfile[]>(
    initialData?.FundingProfile || []
  );

  const [Dropdowns] = useState<Dropdowns>(
    initialData?.Dropdowns || {
    // Categories: [],
    // Thrusts: [],
    // Origins: [],
    // Cities: [],
    Programs: [],
    ComponentTypes: [],
    // LDs: [],
    // OperatingUnits: [],
    // IOs: [],
    // DEOs: [],
    // Agencies: [],
    // Feasibility: [],
    // ImplementationModes: [],
    // EmergencyModes: [],
    Agreements: [],
    Sources: [],
    ScopeOfWorks: [],
    InfraTypes: [],
    SupportingDocs: [],
    Revisions: { Headers: [], Reasons: [], Categories: [] }
  });

  const [infraData] = useState<InfraData>({
    RoadSections: [],
    Bridges: [],
    FCS: [],
    OtherInfra: []
  });

  const [activities] = useState<Activity[]>(
    initialData?.Activities || []
  );

  const [transactionLogs] = useState<TransactionLog[]>(
    initialData?.TransactionLogs || []
  );

  const handleProjectDetailsChange = (field: keyof ProjectDetails, value: any) => {
    setProjectDetails(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleProgramDetailsChange = (updatedProgramDetails: ProgramLatest) => {
    setProgramDetails(updatedProgramDetails);
    
    // Update project details with program information
    setProjectDetails(prev => ({
      ...prev,
      ProgramId: updatedProgramDetails.ProgramId,
    }));
  };

  // #region Component Costs handlers (now using atoms)
  const handleAddComponentCost = (newCost: ComponentCost, newCostPerYear: ComponentCostPerYear[]) => {
    addComponentCost(newCost, newCostPerYear);
  };

  const handleEditComponentCost = (index: number, updatedCost: ComponentCost, updatedCostPerYear: ComponentCostPerYear[]) => {
    const existingCost = componentCosts[index];
    if (existingCost?.ComponentId) {
      updateComponentCost(String(existingCost.ComponentId), updatedCost, updatedCostPerYear);
    }
  };

  const handleDeleteComponentCost = (index: number) => {
    const costToDelete = componentCosts[index];
    if (!costToDelete) return;
    
    // CASCADE DELETE: Find all related major items and their work locations
    const relatedMajorItems = majorItems.filter(
      item => item.ComponentId === costToDelete.ComponentId && !item.IsDeleted
    );
    
    if (relatedMajorItems.length > 0) {
      const confirmMessage = `Deleting this component will also delete ${relatedMajorItems.length} related major item(s) and their work locations.\n\nDo you want to proceed?`;
      if (!window.confirm(confirmMessage)) {
        return; // User cancelled
      }
    }
    
    // Delete the component cost
    deleteComponentCost(index);
    
    // Cascade delete: Delete all related major items (which will cascade to their locations)
    relatedMajorItems.forEach((item) => {
      const actualIndex = majorItems.findIndex(
        mi => mi.ComponentId === item.ComponentId && 
              mi.WorkTypeId === item.WorkTypeId && 
              mi.YearOfWork === item.YearOfWork &&
              mi.ReferenceId === item.ReferenceId
      );
      if (actualIndex !== -1) {
        deleteMajorItem(actualIndex);
      }
    });
    
    console.log('Deleted component cost and cascaded to related major items:', costToDelete);
  };
  // #endregion

  // #region Excess Component Handling
  const handleExcessPromptConfirm = () => {
    // User confirmed - create EXC component
    if (excessComponentData) {
      const excComponent = addExcessComponent({
        projectId: projectDetails.ProjectId || '',
        stageName: initialData?.ProgramDetails?.StageName || '',
        amount: excessComponentData.excessAmount,
        description: 'Excess',
        createdBy: user?.UserId || user?.UserId
      });

      // add via hook method
      addComponentCost(excComponent, []);
      showToast({
        type: 'success',
        message: 'EXC component created successfully'
      });
    }
    setExcessComponentData(null);
  };

  const handleExcessPromptCancel = () => {
    // User cancelled - do nothing, just close the dialog
    setExcessComponentData(null);
    
    showToast({
      type: 'info',
      message: 'Component addition cancelled'
    });
  };
  // #endregion
  
  // #region Docs
  const handleAddDoc = (newDoc: ProjectSupportingDocs) => {
    setDocs(prev => {
      const newDocs = [...prev, newDoc];
      console.log('ProjectForm: New docs after adding:', newDocs);
      return newDocs;
    });
  };

  const handleEditDoc = (index: number, updatedDoc: ProjectSupportingDocs) => {
    setDocs(prev => prev.map((doc, i) => i === index ? updatedDoc : doc));
  };

  const handleDeleteDoc = (doc: ProjectSupportingDocs) => {
    if (doc.Id === 0) {
      // New item - hard delete (remove from array)
      setDocs(prev => prev.filter(selected => selected.Id !== doc.Id));
    } else {
      // Existing item - soft delete (mark as deleted)
      setDocs(prev => prev.map(d => d.Id === doc.Id ? { ...d, IsDeleted: true } : d));
    }
  };
  // #endregion

  // #region Funding Profiles
  const handleAddFundingProfile = () => {
    const newProfile: FundingProfile = {
      Id: 0, // Temporary ID
      ProjectId: projectDetails.ProjectId || '',
      StageName: initialData?.ProgramDetails?.StageName || '',
      Source: '',
      Agreement: '',
      Percentage: 0,
      Amount: 0,
      CreatedBy: '',
      CreatedDate: new Date().toISOString().split('T')[0],
      IsDeleted: false,
    };
    setFundingProfiles(prev => [...prev, newProfile]);
    console.log('Added funding profile to staging:', newProfile);
  };

  const handleEditFundingProfile = (index: number, updatedProfile: FundingProfile) => {
    setFundingProfiles(prev => 
      prev.map((profile, i) => i === index ? { ...profile, ...updatedProfile } : profile)
    );
  };

  const handleDeleteFundingProfile = (index: number) => {
    const profileToDelete = fundingProfiles[index];
    if (profileToDelete.Id === 0) {
      // New item - hard delete (remove from array)
      setFundingProfiles(prev => prev.filter((_, i) => i !== index));
    } else {
      // Existing item - soft delete (mark as deleted)
      setFundingProfiles(prev => prev.map((profile, i) => 
        i === index ? { ...profile, IsDeleted: true } : profile
      ));
    }
    console.log('Deleted funding profile from staging:', profileToDelete);
  };
  // #endregion

  const handleSaveProjectDetails = async () => {
    if (mode !== 'add') return; // Only allow saving new projects in add mode
    
    // Validate form before saving
    const validationErrors = formValidation(projectDetails, projectDetailsRules);
    setErrors(validationErrors);
    
    // If there are validation errors, don't proceed with save
    if (Object.keys(validationErrors).length > 0) {
      console.log('Validation errors found:', validationErrors);
      return;
    }
    
    setSavingSection('projectDetails');
    try {
      console.log('Adding new project details:', projectDetails);
      const response = await addProjectDetails({
        ...projectDetails,
        EmergencyMode: projectDetails.EmergencyMode,
      });
      
      if (response.Data.ProjectId && response.Data.StageName) {
        navigate(`/projects/project-details/${response.Data.ProjectId}:${response.Data.StageName}`);
      }
    } catch (error) {
      console.error('Error adding project details:', error);
      showToast({
          type: 'error',
          message: 'Failed to add project details.'
      });
    } finally {
      setSavingSection(null);
    }
  };


  const handleSubmitModify = (type: string) => {
    // Validate Implementation Mode change for Mode-of-Implementation category
    const normalizedCategory = modificationCategory?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const isModeOfImplementation = normalizedCategory === 'mode-of-implementation' || revisionGroupId === 13;

    if (isModeOfImplementation) {
      const originalImplementationMode = initialData?.ProjectDetails?.ImplementationMode;
      const currentImplementationMode = projectDetails.ImplementationMode;

      if (!currentImplementationMode || currentImplementationMode === originalImplementationMode) {
        showToast({
          type: 'error',
          message: 'Implementation Mode must be changed before submitting a Mode of Implementation modification.'
        });
        setErrors(prev => ({ ...prev, ImplementationMode: 'Implementation Mode must be changed for this modification type.' }));
        return;
      }
    }

    // Check duplicate DetailedScope within each major item's work locations
    const duplicateScopeErrors: string[] = [];
    majorItems.forEach((majorItem, majorIndex) => {
      if (!majorItem.IsDeleted && majorItem.MajorItemLocations) {
        const activeLocations = majorItem.MajorItemLocations.filter(loc => !loc.IsDeleted);
        const seenScopes = new Map<string, number>();
        activeLocations.forEach((location, locIndex) => {
          const scope = location.DetailedScope?.trim();
          if (scope) {
            const key = [
              scope.toLowerCase(),
              location.StartChainage ?? '',
              location.EndChainage ?? '',
              (location.StartStationLimit ?? '').trim(),
              (location.EndStationLimit ?? '').trim(),
            ].join('|');
            if (seenScopes.has(key)) {
              duplicateScopeErrors.push(
                `Major Item ${majorIndex + 1}: Duplicate Detailed Scope "${scope}" with identical chainages and station limits found at locations ${(seenScopes.get(key)! + 1)} and ${locIndex + 1}.`
              );
            } else {
              seenScopes.set(key, locIndex);
            }
          }
        });
      }
    });

    if (duplicateScopeErrors.length > 0) {
      duplicateScopeErrors.forEach(errorMessage => {
        showToast({
          type: 'error',
          message: errorMessage
        });
      });
      return;
    }

    const totalComponentCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Total || 0), 0);
    
    // Calculate total funding profile amount
    const totalFundingAmount = fundingProfiles.reduce((sum, profile) => 
      profile.IsDeleted ? sum : sum + (profile.Amount || 0), 0
    );
    
    // Use funding profile total amount as the project cost for comparison
    const projectCost = totalFundingAmount > 0 ? totalFundingAmount : (programDetails.Cost || 0);
    
    const excessCheck = checkExcessComponent(modificationCategory, projectCost, totalComponentCost);
    
    if (excessCheck && excessCheck.shouldPrompt) {
      // Store the excess data and show prompt
      setExcessComponentData({
        excessAmount: excessCheck.excessAmount,
        message: excessCheck.message
      });
      setIsExcessPromptOpen(true);
      // We'll open the ReviseProjectDialog after user confirms
      return;
    }
    (type === 'new' || type === 'approve') ? setIsRevisedProjectDialogOpen(true) : setIsResubmitRevisionDialogOpen(true);
  }

  const handleApproveModification = async () => {
    console.log('Approving modification for:', {
      project: projectDetails,
      category: modificationCategory,
      reason: modificationReason
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showToast({
      type: 'success',
      message: 'Modification approved successfully'
    });
  }

  // const handleTerminationSubmit = async (hasUnfinishedWork: boolean) => {
  //   console.log('Termination submitted:', {
  //     project: projectDetails,
  //     category: modificationCategory,
  //     reason: modificationReason,
  //     hasUnfinishedWork: hasUnfinishedWork
  //   });
    
  //   await new Promise(resolve => setTimeout(resolve, 1000));
    
  //   alert(`Termination request submitted!\n\nHas Unfinished Work Balance: ${hasUnfinishedWork ? 'Yes' : 'No'}\n\nProject: ${projectDetails.ProjectId}\nCategory: ${modificationCategory}\nReason: ${modificationReason}`);
    
  //   showToast({
  //     type: 'success',
  //     message: 'Termination request submitted successfully'
  //   });
  // }

  const handleRejectModification = async (rejectionReason: string) => {
    console.log('Rejecting modification:', {
      project: projectDetails,
      category: modificationCategory,
      reason: modificationReason,
      rejectionReason: rejectionReason
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showToast({
      type: 'success',
      message: 'Modification rejected successfully'
    });
  }

  useEffect(() => {
    // Don't validate until initialData is fully loaded
    if (!initialData) return;

    const normalizedCategory = modificationCategory?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    if (normalizedCategory !== 'termination') return;

    const hasTerminatedComponent = 
      initialData?.ComponentsStatus?.some(comp => 
        comp.ConstructionStatusName
          ?.toLowerCase()
          .trim() === 'terminated'
      ) ||
      initialData?.ComponentCosts?.some(comp =>
        comp.ConstructionStatusName
          ?.toLowerCase()
          .trim() === 'terminated'
      ) || false;

    if (!hasTerminatedComponent) {
      showToast({
        type: 'error',
        message: 'No terminated components found for this project.'
      });
      // Use initialData directly for reliable navigation URL
      const pid = initialData?.ProjectDetails?.ProjectId || projectDetails?.ProjectId;
      const stage = initialData?.ProgramDetails?.StageName || projectDetails?.StageName;
      navigate(`/projects/project-details/${pid}:${stage}`); // Go back to previous page /project
    }
  }, [modificationCategory, mode, initialData]);

  return (
    <div className="overflow-hidden w-full mx-auto p-6 space-y-6">
      <div className='flex items-center justify-between mb-6'>
        <div className="flex flex-end space-y-3 fixed top-2 right-25 z-50">
          <RevisionActionButtons
            mode={mode}
            userGroups={user?.UserGroupNames}
            initialData={initialData}
            currentUserId={user?.UserId}
            loading={{
              revise: updateReviseProject,
              resubmit: updateResubmitRevision,
              approve: updateApproveProject,
              review: updateForReviewProject,
              reject: rejectDialogProject,
              update: updateAllProject,
            }}
            actions={{
              submit: handleSubmitModify,
              update: () => {},
              openApprove: () => setIsApproveDialogOpen(true),
              openReview: () => setIsForReviewDialogOpen(true),
              openReject: () => setIsRejectDialogOpen(true),
            }}
          />
        </div>
        {/* <div className="flex space-x-3">
          {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus == null && (user?.UserGroups === 'AUC' ) && (
            <>
              <Button color="green" className='cursor-pointer' onClick={() => handleSubmitModify('new')} disabled={updateReviseProject}>
                {updateReviseProject ? 'Submitting...' : 'Submit Revision Request to CO'}
              </Button>
            </>
          )}
          {mode === 'edit' && (initialData?.RevisionDetails?.RegionStatus == 3 || initialData?.RevisionDetails?.COStatus == 3) && (user?.UserGroups === 'DPC' ) && (
            <>
              <Button color="green" className='cursor-pointer' onClick={() => handleSubmitModify('resubmit')} disabled={updateResubmitRevision}>
                {updateReviseProject ? 'Submitting...' : 'Re-Submit Revision'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus == null && (user?.UserGroups === 'DPC' ) && (
            <>
              <Button color="green" className='cursor-pointer' onClick={() => handleSubmitModify('new')} disabled={updateReviseProject}>
                {updateReviseProject ? 'Submitting...' : 'Submit Revision Request to RO'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && (user?.UserGroups === 'DPC' ) && (
            <>
              <Button color="yellow" className='cursor-pointer' disabled={updateReviseProject}>
                {updateReviseProject ? 'Submitting...' : 'Pending RO Approval'}
              </Button>
            </>
          )}
          {mode === 'edit' && (initialData?.RevisionDetails?.COStatus === 0 && initialData?.RevisionDetails?.RegionStatus === 1) && (user?.UserGroups === 'DPC' ) && (
            <>
              <Button color="yellow" className='cursor-pointer' disabled={updateReviseProject}>
                {updateReviseProject ? 'Submitting...' : 'Pending CO Approval'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && (user?.UserGroups === 'RPC' ) && (
            <>
              <Button color="green" className='cursor-pointer' onClick={() => setIsApproveDialogOpen(true)} disabled={updateReviseProject}>
                {updateReviseProject ? 'Submitting...' : 'Submit Revision Request CO'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && user?.UserGroups === 'RPC' && (
            <>
              <Button color="amber" className='cursor-pointer' onClick={() => setIsForReviewDialogOpen(true)} disabled={updateForReviewProject}>
                {updateForReviewProject ? 'Initializing...' : 'For Correction'}
              </Button>
            </>
          )}
          {mode === 'edit' && user?.UserGroups === 'AUC' && initialData?.RevisionDetails?.COStatus == 0 && (
            <>
              <Button color="green" className='cursor-pointer' onClick={() => handleSubmitModify('approve')} disabled={updateApproveProject}>
                {updateApproveProject ? 'Approving...' : 'Approve'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.COStatus == 0 && user?.UserGroups === 'AUC' && (
            <>
              <Button color="amber" className='cursor-pointer' onClick={() => setIsForReviewDialogOpen(true)} disabled={updateForReviewProject}>
                {updateForReviewProject ? 'Initializing...' : 'For Correction'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.COStatus == 0 && user?.UserGroups === 'AUC' && (
            <>
              <Button color="red" className='cursor-pointer' onClick={() => setIsRejectDialogOpen(true)} disabled={rejectDialogProject}>
                {rejectDialogProject ? 'Rejecting...' : 'Disapprove'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && user?.UserGroups === 'RPC' && (
            <>
              <Button color="red" className='cursor-pointer' onClick={() => setIsRejectDialogOpen(true)} disabled={rejectDialogProject}>
                {rejectDialogProject ? 'Rejecting...' : 'Disapprove'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.IsActive === true && initialData?.ProgramDetails?.StageId !== 10 && (
            <>
              <Button color="orange" className='cursor-pointer' onClick={handleUpdateProject} disabled={updateAllProject}>
                {updateAllProject ? 'Updating...' : 'Update Project'}
              </Button>
            </>
          )}
          {mode === 'edit' && initialData?.IsActive === true && initialData?.IsModify === true && (
            <>
              <Button color="orange" className='cursor-pointer' onClick={handleUpdateProject} disabled={updateAllProject}>
                {updateAllProject ? 'Updating...' : 'Update Project'}
              </Button>
            </>
          )}
        </div> */}
      </div>

      {/* Map Section */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div
          className="flex justify-between items-center px-4 py-4 cursor-pointer border-b"
          onClick={() => setIsMapOpen(!isMapOpen)}
        >
          <h3 className="text-lg font-semibold leading-7 text-gray-900">
            Project Location Map
          </h3>
          {isMapOpen ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-500" />
          )}
        </div>
        {isMapOpen && (
          <div className="p-4">
            <MapRenderer 
              geoJsonData={geoJsonData}
              projectId={initialData?.ProjectDetails?.ProjectId}
              programId={initialData?.ProgramDetails?.ProgramId}
              height="500px"
            />
          </div>
        )}
      </div>

      <div>
        {category && reasonId && (
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Modification Category:</span> {category} &nbsp; | &nbsp; 
            <span className="font-semibold">Modification Reason:</span> {reasonId}
          </div>
        )}
      </div>

      {/* Revision Details */}
      <div className="grid grid-cols-1 gap-6">
        <div className='bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl'>
          <div
              className="flex justify-between items-center px-4 py-4 cursor-pointer border-b"
              onClick={() => setIsRevisionOpen(!isRevisionOpen)}
            >
            <h3 className="text-lg font-semibold leading-7 text-gray-900">Revision Details</h3>
            {isRevisionOpen ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
            {isRevisionOpen && (
            <RevisionForm
              category={permissions?.category || modificationCategory}
              reason={modificationReason}
              revisionDocs={initialData?.RevisionDocs}
              forCorrectionsDetails={initialData?.ForCorrectionsDetails}
              fieldRules={fieldRules}
              pcmaStatus={pcmaStatus}
              packageStatus={packageStatus}
              currentCase={currentCase}
              statusName={revisionStatus}
            />)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Program Details */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div
            className="flex justify-between items-center px-4 py-4 cursor-pointer border-b"
            onClick={() => setIsProgramOpen(!isProgramOpen)}
          >
            <h3 className="text-lg font-semibold leading-7 text-gray-900">Program Details</h3>
            {isProgramOpen ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
          {isProgramOpen && (
            <div className="px-4 py-6 sm:p-8">
              <ProgramDetailsForm
                programDetails={programDetails}
                setProgramDetails={setProgramDetails}
                onChange={handleProgramDetailsChange}
                mode={mode}
                projectEnums={projectEnums || undefined}
                initialData={initialData}
              />
            </div>
          )}
        </div>

        {/* Project Details */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div
            className="flex justify-between items-center px-4 py-4 cursor-pointer border-b"
            onClick={() => setIsProjectOpen(!isProjectOpen)}
          >
            <h3 className="text-lg font-semibold leading-7 text-gray-900">Project Details</h3>
            {isProjectOpen ? (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
          {isProjectOpen && (
            <>
              <div className="px-4 py-6 sm:p-8">
                <ProjectDetailsForm
                  projectDetails={projectDetails}
                  onChange={handleProjectDetailsChange}
                  projectEnums={projectEnums || undefined}
                  initialData={initialData}
                  mode={mode}
                  errors={errors}
                  disabled={isDisabled}
                  fieldRules={fieldRules}
                  pcmaStatus={pcmaStatus}
                  packageStatus={packageStatus}
                  currentCase={currentCase}
                  category={modificationCategory}
                />
              </div>
              <div className="flex justify-end px-4 pb-6 sm:px-8">
                {mode === 'add' && (
                  <Button
                    color="orange"
                    onClick={handleSaveProjectDetails}
                    disabled={savingSection === 'projectDetails'}
                    className="text-sm"
                  >
                    {savingSection === 'projectDetails' ? 'Saving...' : 'Save Project'}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {mode === 'edit' && (
        <>
          {/* Funding Profile Section */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <div className="px-4 py-6 sm:p-8">
              <div className="mb-6">
                <h3 className="text-lg font-semibold leading-7 text-gray-900">Funding Profiles</h3>
              </div>
              <FundingProfileForm
                fundingProfiles={fundingProfiles}
                onAdd={handleAddFundingProfile}
                onEdit={handleEditFundingProfile}
                onDelete={handleDeleteFundingProfile}
                initialData={initialData ? { ...initialData, Dropdowns } : undefined}
                onTotalAmountChange={setMaxAmountCost}
                disabled={isDisabled}
                fieldRules={fieldRules}
              />
            </div>
          </div>

          {/* Component Cost Section - Fill this first to populate Major Items */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <div className="px-4 py-6 sm:p-8">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold leading-7 text-gray-900">Component Costs</h2>
                <p className="text-sm text-blue-600 font-medium">⚠️ Add component costs first - they are required for Major Items of Work</p>
              </div>
              <ComponentCostForm
                componentCosts={componentCosts}
                componentCostPerYear={componentCostPerYear}
                onAdd={handleAddComponentCost}
                onEdit={handleEditComponentCost}
                onDelete={handleDeleteComponentCost}
                initialData={initialData}
                maxAmountCost={maxAmountCost}
                fieldRules={fieldRules ?? undefined}
                category={modificationCategory}
                reason={modificationReason}
                reasonId={modificationReasonId}
              />
            </div>
          </div>

          {/* Major Item of Work Section */}
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            <div className="px-4 py-6 sm:p-8">
              <div className="mb-6">
                <h3 className="text-lg font-semibold leading-7 text-gray-900">Major Items of Work</h3>
              </div>
              <MajorItemOfWorksForm
                majorItems={majorItems}
                projectId={initialData?.ProjectDetails.ProjectId || ''}
                componentCosts={componentCosts}
                infraData={infraData}
                onAdd={addMajorItem}
                onEdit={editMajorItem}
                onDelete={deleteMajorItem}
                programDetails={initialData?.ProgramDetails}
                dropDowns={initialData?.Dropdowns?.ScopeOfWorks}
                infraTypeEnums={initialData?.Dropdowns?.InfraTypes}
                fieldRules={fieldRules}
                deo={projectDetails.DEO}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Notes Section */}
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
              <div className="px-4 py-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold leading-7 text-gray-900">Supporting Documents</h3>
                </div>
                <NotesForm
                  docs={docs}
                  onAdd={handleAddDoc}
                  onEdit={handleEditDoc}
                  onDelete={handleDeleteDoc}
                  initialData={initialData}
                  dropDownOptions={initialData?.Dropdowns?.SupportingDocs}
                  disabled={isDisabled}
                />
              </div>
            </div>
          </div>

          {/* Activities Section */}
          <ActivitySection activities={activities} transactionLogs={transactionLogs} />
        </>
      )}

      {/* Modals and Dialogs */}
      {isRevisedProjectDialogOpen && (<ReviseProjectDialog
        projectStatus={initialData?.ProjectStatus}
        isOpen={isRevisedProjectDialogOpen}
        onClose={() => setIsRevisedProjectDialogOpen(false)}
        revisionCategory={permissions?.category || modificationCategory}
        revisionReason={modificationReason}
        reasonId={modificationReasonId}
        categoryId={categoryId}
        revisionGroupId={revisionGroupId}
        project={projectDetails}
        componentCosts={componentCosts}
        componentsCostPerYear={componentCostPerYear}
        majorItemOfWorks={majorItems.map(item => ({
          Id: item.Id,
          ProjectId: item.ProjectId,
          ReferenceId: item.ProjectId + "-" + item.ComponentId + "-" + initialData?.ProgramDetails.StageName,
          StageName: initialData?.ProgramDetails.StageName,
          ComponentId: item.ComponentId,
          YearOfWork: item.YearOfWork,
          WorkTypeId: item.WorkTypeId,
          InfraType: item.InfraType,
          TargetUnitId: item.TargetUnitId,
          TargetUnit: item.TargetUnit,
          CreatedBy: item.CreatedBy,
          IsDeleted: item.IsDeleted || false
        }))}
        majorItemLocations={majorItems.flatMap(item => 
          (item.MajorItemLocations || []).map(location => ({
            ...location,
            ParentId: item.ProjectId + "-" + item.ComponentId + "-" + initialData?.ProgramDetails.StageName,
            ProjectId: item.ProjectId || '',
            StageName: initialData?.ProgramDetails.StageName || ''
          }))
        )}
        fundingProfile={fundingProfiles}
      />)}

      {isResubmitRevisionDialogOpen && (<ResubmitRevisionDialog
        projectStatus={initialData?.ProjectStatus}
        isOpen={isResubmitRevisionDialogOpen}
        onClose={() => setIsResubmitRevisionDialogOpen(false)}
        revisionCategory={permissions?.category || modificationCategory}
        revisionReason={modificationReason}
        reasonId={modificationReasonId}
        categoryId={categoryId}
        revisionGroupId={revisionGroupId}
        project={projectDetails}
        componentCosts={componentCosts}
        componentsCostPerYear={componentCostPerYear}
        majorItemOfWorks={majorItems.map(item => ({
          Id: item.Id,
          ProjectId: item.ProjectId,
          ReferenceId: item.ReferenceId,
          StageName: initialData?.ProgramDetails.StageName || '',
          ComponentId: item.ComponentId,
          YearOfWork: item.YearOfWork,
          WorkTypeId: item.WorkTypeId,
          InfraType: item.InfraType,
          TargetUnitId: item.TargetUnitId,
          TargetUnit: item.TargetUnit,
          CreatedBy: item.CreatedBy,
          IsDeleted: item.IsDeleted || false
        }))}
        majorItemLocations={majorItems.flatMap(item => 
          (item.MajorItemLocations || []).map(location => ({
            ...location,
            ParentId: item.ComponentId,
            ProjectId: item.ProjectId || '',
            StageName: initialData?.ProgramDetails.StageName || ''
          }))
        )}
        fundingProfile={fundingProfiles}
      />)}

      {isApproveDialogOpen && (
        <ApproveModifyDialog
          isOpen={isApproveDialogOpen}
          onClose={() => setIsApproveDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          category={permissions?.category || modificationCategory}
          reason={modificationReason}
          onApprove={handleApproveModification}
          onSuccess={onActionSuccess}
        />
      )}

      {isForReviewDialogOpen && (
        <ForReviewModifyDialog
          isOpen={isForReviewDialogOpen}
          onClose={() => setIsForReviewDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          category={permissions?.category || modificationCategory}
          reason={modificationReason}
          onSuccess={onActionSuccess}
        />
      )}

      {isRejectDialogOpen && (
        <RejectModifyDialog
          isOpen={isRejectDialogOpen}
          onClose={() => setIsRejectDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          category={permissions?.category || modificationCategory}
          reason={modificationReason}
          onReject={handleRejectModification}
          onSuccess={onActionSuccess}
        />
      )}

      {isExcessPromptOpen && excessComponentData && (
        <ExcessPrompt
          isOpen={isExcessPromptOpen}
          onClose={() => setIsExcessPromptOpen(false)}
          onConfirm={handleExcessPromptConfirm}
          onCancel={handleExcessPromptCancel}
          projectCost={programDetails.Cost || 0}
          totalComponentCost={componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0)}
          excessAmount={excessComponentData.excessAmount}
        />
      )}

      {/* {isTerminationDialogOpen && (
        <TerminationDialog
          isOpen={isTerminationDialogOpen}
          onClose={() => setIsTerminationDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          onSubmitTermination={handleTerminationSubmit}
        />
      )} */}
    </div>
  );
};

export default ProjectForm;