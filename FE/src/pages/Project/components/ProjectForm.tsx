import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { formValidation, type FormValidationError } from '../../../utils/FormValidation';
import { toDateInputValue } from '../../../utils/GlobalFunctions';
import { projectDetailsRules } from '../rules/projectDetailsRules';
import type { 
  ProjectDetails, 
  ComponentCost,
  ComponentCostPerYear, 
  // ProjectNote,
  FundingProfile, 
  Activity, 
  TransactionLog,
  ProjectFormPayload,
  ProjectEnums,
  Dropdowns,
  InfraData,
  MajorItemOfWorksWithDropdown,
  MajorItemOfWork,
  MajorItemLocations,
  ProjectSupportingDocs,
} from '../Model.d';

import { Button } from '../../../components/tailwindui/button';
import MapRenderer from '../../../components/map/MapRenderer';

//Sub-components
import ProgramDetailsForm from './ProgramDetailsForm';
import ProjectDetailsForm from './ProjectDetailsForm';
import ComponentCostForm from './ComponentCostForm';
import MajorItemOfWorksForm from './MajorItemOfWorksForm';
import ComponentTargetsForm from './ComponentTargetsForm';
import NotesForm from './NotesForm';
import FundingProfileForm from './FundingProfileForm';
import ActivitySection from './ActivitySection';
import { addProjectDetails, getProjectEnums, getComponentsEnums, updateEntireProject, fetchProjectGeoJSON } from '../Service';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { ProgramLatest } from '../../Program/Model';
import { useToast } from '../../../components/toaster/ToasterContext';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';

import RevisionDialog from '../dialogs/RevisionDialog';
import SaveProjectConfirmDialog from '../dialogs/SaveProjectConfirmDialog';
import ProceedAddProject from '../dialogs/ProceedAddProject';
import { defaultCoordinates } from '../utils/coordinates';

interface ProjectFormProps {
  initialData?: ProjectFormPayload;
  mode?: 'add' | 'edit';
  initialProgramPK?: string;
  initialStageName?: string;
  onRefresh?: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, mode = 'add', initialProgramPK, initialStageName, onRefresh }) => {

  const navigate = useNavigate();
  const { user } = useAuth();

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
  const [componentDropdowns, setComponentDropdowns] = useState<Dropdowns | null>(null);
  const [updateAllProject, setUpdateAllProject] = useState<boolean>(false);
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [reviseProject] = useState<boolean>(false);
  const [updateUnlockProject] = useState<boolean>(false);
  // const [reviseProject, setReviseProject] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormValidationError<ProjectDetails>>({});
  //toaster here
  const { showToast } = useToast();
  // DisableFields if status === approved
  // const isDisabled = Number(initialData?.ProgramDetails?.Status) === 1;
  /*  A LUMP SUM PROJECT IS DISPLAYED HERE, NEVER EDITED.

      It is an ordinary tProjects row, so this form will open and save it like any
      other project — bypassing the stage gate, the allocation arithmetic and the
      identity rules that only the Lump Sum module applies. The server refuses it
      too (ProjectController.UpdateProjectDetails); this keeps the UI honest rather
      than letting someone fill in a form that cannot be saved.

      IslandCode, not ProjectType: itemized CHILDREN also carry ProjectType 'LS',
      but they take their island code from their own Region, so only parents read
      'LS' here. Children are ordinary projects and stay editable. */
  const isLumpSumProject = initialData?.ProjectDetails?.IslandCode === 'LS';

  const isDisabled = Boolean(
    (initialData?.IsActive === false) ||
    isLumpSumProject ||
    (initialData?.ProgramDetails?.StageName === 'GAA-R' && Number(initialData?.ProgramDetails?.Status) === 1)
  );

  // toggle state for Program Details section
  const [isProgramOpen, setIsProgramOpen] = useState<boolean>(true);
  const [isProjectOpen, setIsProjectOpen] = useState<boolean>(true);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(true);

  // Dialog state
  const [ isRevisionOpen, setIsRevisionOpen ] = useState<boolean>(false);
  const [ selectedRevHeaderId, setSelectedRevHeaderId ] = useState<number>(0);
  const [ isConfirmDialogOpen, setIsConfirmDialogOpen ] = useState<boolean>(false);
  const [ isProceedDialogOpen, setIsProceedDialogOpen ] = useState<boolean>(false);
  const [ proceedMessage, setProceedMessage ] = useState<string>('');

  
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
    StageDisplayName: '',
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
      ProjectFK: '',
      ProjectId: '',
      ProjectType: '',
      ProgramFK: '',
      ProgramId: '',
      ProgramName: '',
      StageName: '',
      AlternateId: '',
      MYId: '',
      Description: '',
      Region: '',
      Province: '',
      City: '',
      LegislativeDistrict: '',
      DEO: '',
      OperatingUnit: '',
      ImplementingOffice: '',
      IslandCode: '',
      Category: 0,
      CategoryName: '',
      Thrust: undefined,
      ThrustName: '',
      Origin: 0,
      OriginName: '',
      Agency: 0,
      AgencyName: '',
      ImplementationMode: undefined,
      ImplementationModeName: '',
      EmergencyMode: undefined,
      EmergencyModeName: '',
      RegionWide: 0,
      RegionWideName: '',
      Feasibility: undefined,
      FeasibilityName: '',
      FeasibilityDate: undefined,
      DetailedDesign: undefined,
      DetailedDesignName: '',
      DetailedDesignDate: undefined,
      RowAvailable: undefined,
      RowAvailableName: '',
      Tier: 1,
      TierName: 'Tier 1',
      Rank: undefined,
      MYCAApprovalDate: undefined,
      CreatedBy: '',
      CreatedDate: undefined,
      LastUpdatedBy: '',
      LastUpdatedDate: undefined,
      Source: ''
    }
  );

  // const [majorItemsLocation] = useState<MajorItemLocations[]>(
  //   initialData?.MajorItemLocations || []
  // );

  useEffect(() => {
    // Load project details dropdowns (ShowProjectDropdowns)
    const loadProjectEnums = async () => {
      try {
        const response = await getProjectEnums();
        console.log('Project Enums:', response.Data);
        setProjectEnums(response.Data);
      } catch (error) {
        console.error('Error loading project enums:', error);
      }
    };

    // Load component dropdowns (ShowProjectComponentDropdowns) — Program Details,
    // Funding Profile, Component Cost, Major Item of Work, Work Location, Notes
    const loadComponentDropdowns = async () => {
      try {
        const response = await getComponentsEnums();
        console.log('Component Dropdowns:', response.Data);
        setComponentDropdowns(response.Data);
      } catch (error) {
        console.error('Error loading component dropdowns:', error);
      }
    };

    loadProjectEnums();
    loadComponentDropdowns();
    // loadInfrastructureData();

    // Set program details if in edit mode and initialData is present
    if (mode === 'edit' && initialData?.ProgramDetails) {
      setProgramDetails(initialData.ProgramDetails);
    }
  }, [mode, initialData]);

  // Fetch GeoJSON data for map rendering. Skipped when there are no work locations to plot —
  // the backend 400s on that ("Resource not found"), which httpClient auto-toasts, so calling
  // it anyway just surfaces a misleading error for a normal empty state.
  const loadMapData = useCallback(async () => {
    if (
      mode === 'edit' &&
      initialData?.ProjectDetails?.ProjectId &&
      initialData?.ProgramDetails?.ProgramPK &&
      (initialData?.MajorItemLocations?.length ?? 0) > 0
    ) {
      try {
        const response = await fetchProjectGeoJSON(
          initialData.ProjectDetails.ProjectFK || '',
          initialData.ProgramDetails.ProgramPK || '',
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
  }, [mode, initialData?.ProjectDetails?.ProjectId, initialData?.ProgramDetails?.ProgramId, initialData?.ProgramDetails?.StageName, initialData?.MajorItemLocations?.length, user?.UserId]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // Pre-selecting the program for initialProgramPK/initialStageName happens inside
  // ProgramDetailsForm (via its searchProgram() call + onChange), since
  // /Project/ShowProjectComponentDropdowns never returns a Programs list for us to match against here.
  const [componentCosts, setComponentCosts] = useState<ComponentCost[]>(
    initialData?.ComponentCosts || []
  );

  const [componentCostPerYear, setComponentCostPerYear] = useState<ComponentCostPerYear[]>(
    initialData?.ComponentCostPerYear || []
  );

  // Debug effect to monitor componentCosts state changes
  // useEffect(() => {
  //   console.log('ComponentCosts state changed:', componentCosts);
  // }, [componentCosts]);

  const [majorItems, setMajorItems] = useState<MajorItemOfWorksWithDropdown[]>(() => {
    if (!initialData?.MajorItemOfWorks) return [];
    
    // Transform backend MajorItemOfWork[] to MajorItemOfWorksWithDropdown[]
    // Combine with MajorItemLocations from the separate array
    return initialData.MajorItemOfWorks.map(item => {
      // Find MajorItemLocations that belong to this MajorItem via ParentId matching ComponentId
      const itemWorkLocations = (initialData.MajorItemLocations || []).filter(
        location => location.ComponentId === item.ComponentId
      );
      
      return {
        ...item,
        // Ensure required fields exist
        TargetUnitId: item.TargetUnitId || 0,
        TargetUnit: item.TargetUnit || '',
        MajorItemLocations: itemWorkLocations, // Combine WorkLocations from separate array
        // Backfilled once component dropdowns load — see MajorItemOfWorksForm's dropDowns effect
        DropdownData: []
      };
    });
  });

  // Debug effect to monitor majorItems state changes  
  // useEffect(() => {
  //   console.log('MajorItems state changed:', majorItems);
  // }, [majorItems]);

  // const [notes, setNotes] = useState<ProjectNote[]>(
  //   initialData?.ProjectNotes || []
  // );
  const [docs, setDocs] = useState<ProjectSupportingDocs[]>(
    initialData?.Docs || []
  );

  const [fundingProfiles, setFundingProfiles] = useState<FundingProfile[]>(
    initialData?.FundingProfile || []
  );

  // Calculate total percentage for funding profile validation
  const [totalPercentage, setTotalPercentage] = useState(0);

  // Calculate total percentage whenever fundingProfiles change
  useEffect(() => {
    const total = fundingProfiles.reduce((sum, profile) => profile?.IsDeleted ? sum : sum + (profile.Percentage || 0), 0);
    setTotalPercentage(total);
  }, [fundingProfiles]);

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
    console.log('Program details changed in ProjectForm:', updatedProgramDetails);
    setProgramDetails(updatedProgramDetails);

    // Update project details with program information
    setProjectDetails(prev => ({
      ...prev,
      ProgramId: updatedProgramDetails.ProgramId,
      ProgramName: updatedProgramDetails.Name,
      StageName: updatedProgramDetails.StageName,
    }));
    console.log('Project details updated with ProgramId/StageName:', updatedProgramDetails.ProgramId, updatedProgramDetails.StageName);
  };

  // #region Component Costs
  const handleAddComponentCost = (newCost: ComponentCost, newCostPerYear: ComponentCostPerYear[]) => {
    console.log('=== ADDING COMPONENT COST ===');
    console.log('New cost:', newCost);
    console.log('New cost per year:', newCostPerYear);
    console.log('Current componentCosts before add:', componentCosts);
    
    setComponentCosts(prev => {
      const updated = [...prev, newCost];
      console.log('Updated componentCosts after add:', updated);
      return updated;
    });
    
    // Add per-year costs
    setComponentCostPerYear(prev => {
      const updated = [...prev, ...newCostPerYear];
      console.log('Updated componentCostPerYear after add:', updated);
      return updated;
    });
    
    console.log('Added component cost to staging:', newCost);
  };

  const handleEditComponentCost = (index: number, updatedCost: ComponentCost, updatedCostPerYear: ComponentCostPerYear[]) => {
    console.log('=== EDITING COMPONENT COST ===');
    console.log('Index:', index);
    console.log('Updated cost:', updatedCost);
    console.log('Updated cost per year:', updatedCostPerYear);
    console.log('Current componentCosts before edit:', componentCosts);

    // Changing the Component Type changes the ComponentId (e.g. CoS -> CW1), so the
    // rows to replace must be found by the ID the component had BEFORE this edit.
    const previousComponentId = componentCosts[index]?.ComponentId ?? updatedCost.ComponentId;
    const newComponentId = updatedCost.ComponentId;

    setComponentCosts(prev => {
      const updated = prev.map((cost, i) => i === index ? updatedCost : cost);
      console.log('Updated componentCosts after edit:', updated);
      return updated;
    });

    // Update per-year costs for this component
    setComponentCostPerYear(prev => {
      // Remove existing per-year costs for this component. Rows already soft-deleted
      // (saved, IsDeleted) are kept so the delete still reaches the backend; the dialog
      // only received the active rows.
      const filteredCosts = prev.filter(cost => cost.ComponentId !== previousComponentId || (cost.IsDeleted && cost.Id > 0));
      // Add updated per-year costs
      const updated = [...filteredCosts, ...updatedCostPerYear];
      console.log('Updated componentCostPerYear after edit:', updated);
      return updated;
    });

    // Major Items and their work locations point at the component by ComponentId; a new
    // (unsaved) one is matched to its component by that ID alone, so carry the new ID over.
    if (previousComponentId !== newComponentId) {
      setMajorItems(prev => prev.map(item => item.ComponentId !== previousComponentId || item.IsDeleted ? item : {
        ...item,
        ComponentId: newComponentId,
        MajorItemLocations: item.MajorItemLocations?.map(loc =>
          loc.ComponentId === previousComponentId ? { ...loc, ComponentId: newComponentId } : loc),
      }));
    }

    console.log('Updated component cost in staging:', updatedCost);
  };

  const handleDeleteComponentCost = (ComponentId: string) => {
    const costToDelete = componentCosts.find(cost => cost.ComponentId === ComponentId);
    if (costToDelete) {
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

      if (costToDelete.Id === 0) {
        // Newly added record: remove it completely.
        setComponentCosts(prev =>
          prev.filter(cost => cost.ComponentId !== ComponentId)
        );
      } else {
        // Existing database record: mark it as deleted.
        setComponentCosts(prev =>
          prev.map(cost =>
            cost.ComponentId === ComponentId
              ? { ...cost, IsDeleted: true }
              : cost
          )
        );
      }

      // Step 2: Cascade to ComponentCostPerYear — each child's Id decides hard vs soft
      setComponentCostPerYear(prev =>
        prev
          .filter(cost => !(cost.ComponentId === costToDelete.ComponentId && cost.Id === 0))
          .map(cost =>
            cost.ComponentId === costToDelete.ComponentId
              ? { ...cost, IsDeleted: true }
              : cost
          )
      );

      // Step 3: Cascade to MajorItems — each item's and each location's Id decides hard vs soft
      setMajorItems(prev => {
        const updated = prev.map(item => {
          if (item.ComponentId !== costToDelete.ComponentId || item.IsDeleted) {
            return item;
          }
          // Step 3a: Cascade to Locations — hard-delete Id===0, soft-delete Id>0
          const processedLocations = (item.MajorItemLocations || [])
            .filter(loc => loc.Id !== 0)
            .map(loc => ({ ...loc, IsDeleted: true }));

          // Step 3b: Decide MajorItem fate
          if (item.Id === 0 && processedLocations.length === 0) {
            return null; // Fully unsaved — hard delete
          }
          return {
            ...item,
            IsDeleted: true,
            MajorItemLocations: processedLocations
          };
        });
        return updated.filter(item => item !== null) as typeof prev;
      });

      console.log('Deleted component cost with proper cascade (hard/soft per child Id):', costToDelete);
    }
  };

  // #endregion

  // #region Major Items of Work
  const handleAddMajorItem = (newItem: MajorItemOfWorksWithDropdown) => {
    setMajorItems(prev => [...prev, newItem]);
    console.log('Added major item to staging:', newItem);
  };

  const handleEditMajorItem = (index: number, updatedItem: MajorItemOfWorksWithDropdown) => {
    // console.log('ProjectForm: Editing major item at index', index);
    // console.log('ProjectForm: Updated item received:', updatedItem);
    setMajorItems(prev => {
      const newItems = prev.map((item, i) => i === index ? updatedItem : item);
      // console.log('ProjectForm: New majorItems state:', newItems);
      return newItems;
    });
    // console.log('Updated major item in staging:', updatedItem);
  };

  const handleDeleteMajorItem = (index: number) => {
    const itemToDelete = majorItems[index];
    if (itemToDelete) {
      // Step 1: Cascade to MajorItemLocations — hard-delete Id===0, soft-delete Id>0
      const processedLocations = (itemToDelete.MajorItemLocations || [])
        .filter(loc => loc.Id !== 0)
        .map(loc => ({ ...loc, IsDeleted: true }));

      // Step 2: Decide MajorItem fate
      if (itemToDelete.Id === 0 && processedLocations.length === 0) {
        // Fully unsaved — hard delete: remove from array
        setMajorItems(prev => prev.filter((_, i) => i !== index));
      } else {
        // Either item or some locations exist in DB — soft delete to preserve for backend
        setMajorItems(prev => prev.map((item, i) =>
          i === index
            ? { ...item, IsDeleted: true, MajorItemLocations: processedLocations }
            : item
        ));
      }
    }
  };
// #endregion

// #region Docs
  const handleAddDoc = (newDoc: ProjectSupportingDocs) => {
    console.log('ProjectForm: Adding doc:', newDoc);
    console.log('ProjectForm: Current docs before:', docs);
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
      // Hard delete for new items not yet saved to database
      setDocs(prev => prev.filter(selected => selected !== doc));
      console.log('Hard deleted (removed) new document:', doc);
    } else {
      // Soft delete for existing database items - mark as deleted
      setDocs(prev => prev.map(d => d.Id === doc.Id ? { ...d, IsDeleted: true } : d));
      console.log('Soft deleted (IsDeleted=true) existing document:', doc);
    }
  };
// #endregion

// #region Funding Profile
  const handleAddFundingProfile = () => {
    // The backend always re-derives ProjectRevisionFK server-side from the project's
    // current revision on save — it never trusts the client value. We just carry through
    // whatever value the backend already gave us on an existing row.
    const defaultProjectRevisionFK =
      fundingProfiles.find(f => f.ProjectRevisionFK)?.ProjectRevisionFK ||
      componentCosts.find(c => c.ProjectRevisionFK)?.ProjectRevisionFK ||
      0;
    const newProfile: FundingProfile = {
      Id: 0, // Temporary ID
      ProjectRevisionFK: defaultProjectRevisionFK,
      ProjectFK: projectDetails.ProjectFK || '',
      ProjectId: projectDetails.ProjectId || '',
      StageName: initialData?.ProgramDetails?.StageName || '',
      Source: projectDetails.Source || 'Base',
      SourceOrg: '',
      AgreementCode: '',
      Percentage: 0,
      Amount: 0,
      CreatedBy: user?.UserId || '',
      CreatedDate: toDateInputValue(new Date()),
      IsDeleted: false
    };
    setFundingProfiles(prev => [...prev, newProfile]);
    console.log('Added funding profile to staging:', newProfile);
  };

  const handleEditFundingProfile = (index: number, updatedProfile: FundingProfile) => {
    // 2026-09-11 fix: previously forced Id to 0 on every edit, treating an existing row as new.
    // FundingProfileForm's percentage-recalculation effect calls onEdit for every row whenever
    // the collection's total changes (e.g. another row was deleted) -- that reset the Id of
    // untouched rows too, so on save they were re-inserted as duplicates while the original
    // row (no longer referenced by Id) was left behind untouched. Preserve Id like every
    // sibling collection's edit handler already does (and like the Revision-side counterpart,
    // Modification/projectmodification/components/ProjectForm.tsx:560-564).
    setFundingProfiles(prev =>
      prev.map((profile, i) => i === index ? { ...profile, ...updatedProfile } : profile)
    );
  };

  const handleDeleteFundingProfile = (index: number) => {
    const profileToDelete = fundingProfiles[index];
    if (profileToDelete) {
      if (profileToDelete.Id === 0) {
        // Hard delete for new items not yet saved to database
        setFundingProfiles(prev => prev.filter((_, i) => i !== index));
        console.log('Hard deleted (removed) new funding profile:', profileToDelete);
      } else {
        // Soft delete for existing database items
        setFundingProfiles(prev => prev.map((profile, i) => 
          i === index ? { ...profile, IsDeleted: true } : profile
        ));
        console.log('Soft deleted (IsDeleted=true) existing funding profile:', profileToDelete);
      }
    }
  };
// #endregion

  // Handler for adding new project (only for 'add' mode)
  const handleSaveProjectDetails = async () => {
    if (mode !== 'add') return; // Only allow saving new projects in add mode
    
    // Validate form before saving
    const validationErrors = formValidation(projectDetails, projectDetailsRules);
    setErrors(validationErrors);
    
    // If there are validation errors, don't proceed with save
    if (Object.keys(validationErrors).length > 0) {
        // Show errors in a toast
        Object.values(validationErrors).forEach((error) => {
            showToast({
                type: 'error',
                message: error,
            });
        });
        return;
    }
    
    // Show confirmation dialog
    setIsConfirmDialogOpen(true);
  };

  // Actual save logic after confirmation
  const confirmSaveProject = async (allowProceed: boolean = false) => {
    setSavingSection('projectDetails');
    try {
      const payload = {
        ...projectDetails,
        IsAllowedToProceed: allowProceed
      };
      
      const response = await addProjectDetails(payload);
      
      if (response.Data?.Type === 'Prompt' && !allowProceed)
      {
        console.log('Showing proceed dialog...');
        // Show custom dialog instead of window.confirm
        setProceedMessage(response.Data.Message);
        setIsProceedDialogOpen(true);
        return;
      }

      if (response.Data.ProjectId && response.Data.StageName) {
        showToast({
          type: 'success',
          message: 'Project created successfully.'
        });
        navigate(`/projects/project-details/${response.Data.ProjectId}:${response.Data.StageName}`);
      }
    } catch (error) {
      console.error('Error adding project details:', error);
      showToast({
          type: 'error',
          message: 'Failed to add project details.'
      });
      throw error;
    } finally {
      setSavingSection(null);
    }
  };

  // Handler for proceed anyway confirmation
  const handleProceedAnyway = async () => {
    setIsProceedDialogOpen(false);
    if (mode === 'add') {
      await confirmSaveProject(true); // Retry with IsAllowedToProceed = true
    } else {
      await confirmUpdateProject(true); // Retry update with IsAllowedToProceed = true
    }
  };

  const handleUpdateProject = async () => {
    // Clear previous error/success states
    
    // Validate form before updating
    const validationErrors = formValidation(projectDetails, projectDetailsRules);
    setErrors(validationErrors);
    
    // If there are validation errors, don't proceed with update
    if (Object.keys(validationErrors).length > 0) {
      // Show errors in a toast
      Object.values(validationErrors).forEach((error) => {
          showToast({
              type: 'error',
              message: error,
          });
      });
      return;
    }

    // Collect all business validation errors
    const businessValidationErrors: string[] = [];

    // Check funding percentage validation with tolerance for floating-point rounding errors
    const roundedTotal = Math.round(totalPercentage * 100) / 100;
    // Use tolerance of 0.03 to account for rounding (e.g., 3 items at 33.33% = 99.99%)
    if (Math.abs(roundedTotal - 100) >= 0.03) {
      businessValidationErrors.push(`Total funding percentage must equal 100%. Current total: ${roundedTotal.toFixed(1)}%`);
    }

    // Check component cost validation
    if (maxAmountCost && maxAmountCost > 0) {
      const totalComponentCost = componentCosts.reduce((sum, cost) => cost.IsDeleted ? sum : sum + (cost.Total || 0), 0);
      
      if (totalComponentCost !== maxAmountCost) {
        if (totalComponentCost < maxAmountCost) {
          const shortfall = maxAmountCost - totalComponentCost;
          businessValidationErrors.push(`Total component cost (₱${totalComponentCost.toLocaleString('en-PH')}) is less than the required budget (₱${maxAmountCost.toLocaleString('en-PH')}) by ₱${shortfall.toLocaleString('en-PH')}`);
        } else {
          const exceeded = totalComponentCost - maxAmountCost;
          businessValidationErrors.push(`Total component cost (₱${totalComponentCost.toLocaleString('en-PH')}) exceeds the maximum budget (₱${maxAmountCost.toLocaleString('en-PH')}) by ₱${exceeded.toLocaleString('en-PH')}`);
        }
      }
    }

    // Check duplicate DetailedScope within each major item's work locations
    majorItems.forEach((majorItem, majorIndex) => {
      if (!majorItem.IsDeleted && majorItem.MajorItemLocations) {
        const activeLocations = majorItem.MajorItemLocations.filter(loc => !loc.IsDeleted);
        const seenScopes = new Map<string, number>(); // composite key -> first occurrence index
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
              businessValidationErrors.push(
                `Major Item ${majorIndex + 1}: Duplicate Detailed Scope "${scope}" with identical chainages and station limits found at locations ${(seenScopes.get(key)! + 1)} and ${locIndex + 1}.`
              );
            } else {
              seenScopes.set(key, locIndex);
            }
          }
        });
      }
    });

    // Check major item locations length validation
    majorItems.forEach((majorItem, majorIndex) => {
      if (!majorItem.IsDeleted && majorItem.MajorItemLocations) {
        majorItem.MajorItemLocations.forEach((location, locIndex) => {
          if (!location.IsDeleted) {
            const length = location.Length ?? null;
            if (length === null || length === undefined) {
              return; // Skip validation if length is null/undefined
            }
            if (length <= 0) {
              businessValidationErrors.push(
                `Major Item Component ${majorItem.ComponentId}, Location ${locIndex + 1} (${location.InfraId || 'Unknown'}): Length must be greater than 0. Current value: ${length}`
              );
            }

            // Check StartX
            if (location.StartX !== null && location.StartX !== undefined && location.StartX !== 0) {
              if (location.StartX < defaultCoordinates.minX || location.StartX > defaultCoordinates.maxX) {
                businessValidationErrors.push(
                  `Major Item ${majorIndex + 1}, Location ${locIndex + 1} (${location.InfraId || 'Unknown'}): Start X coordinate (${location.StartX}) is out of valid range (${defaultCoordinates.minX} - ${defaultCoordinates.maxX})`
                );
              }
            }

            // Check StartY
            if (location.StartY !== null && location.StartY !== undefined && location.StartY !== 0) {
              if (location.StartY < defaultCoordinates.minY || location.StartY > defaultCoordinates.maxY) {
                businessValidationErrors.push(
                  `Major Item ${majorIndex + 1}, Location ${locIndex + 1} (${location.InfraId || 'Unknown'}): Start Y coordinate (${location.StartY}) is out of valid range (${defaultCoordinates.minY} - ${defaultCoordinates.maxY})`
                );
              }
            }

            // Check EndX
            if (location.EndX !== null && location.EndX !== undefined && location.EndX !== 0) {
              if (location.EndX < defaultCoordinates.minX || location.EndX > defaultCoordinates.maxX) {
                businessValidationErrors.push(
                  `Major Item ${majorIndex + 1}, Location ${locIndex + 1} (${location.InfraId || 'Unknown'}): End X coordinate (${location.EndX}) is out of valid range (${defaultCoordinates.minX} - ${defaultCoordinates.maxX})`
                );
              }
            }

            // Check EndY
            if (location.EndY !== null && location.EndY !== undefined && location.EndY !== 0) {
              if (location.EndY < defaultCoordinates.minY || location.EndY > defaultCoordinates.maxY) {
                businessValidationErrors.push(
                  `Major Item ${majorIndex + 1}, Location ${locIndex + 1} (${location.InfraId || 'Unknown'}): End Y coordinate (${location.EndY}) is out of valid range (${defaultCoordinates.minY} - ${defaultCoordinates.maxY})`
                );
              }
            }
          }
        });
      }
    });

    // If there are any business validation errors, show each one separately and return
    if (businessValidationErrors.length > 0) {
      businessValidationErrors.forEach(errorMessage => {
        showToast({
          type: 'error',
          message: errorMessage
        });
      });
      return;
    }
    
    // Show confirmation dialog
    setIsConfirmDialogOpen(true);
  };

  // Actual update logic after confirmation
  const confirmUpdateProject = async (allowProceed: boolean = false) => {
    setUpdateAllProject(true);
    
    try {
      // console.log('=== STAGING DATA BEFORE UPDATE ===');
      // console.log('Component Costs:', componentCosts);
      // console.log('Major Items:', majorItems);
      // console.log('Funding Profiles:', fundingProfiles);
      
      // Prepare data for backend matching the expected payload structure
      
      // Transform majorItems into separate MajorItemOfWorks and WorkLocations arrays
      const majorItemsForPayload: MajorItemOfWork[] = [];
      const workLocationsForPayload: MajorItemLocations[] = [];
      
      majorItems.forEach(item => {
        // Create MajorItemOfWork without WorkLocations and DropdownData (UI-only)
        const majorItemPayload: MajorItemOfWork = {
          Id: item.Id,
          Source: initialData?.ProjectDetails.Source || '',
          ProjectFK: initialData?.ProjectDetails.ProjectFK || '',
          ProjectId: initialData?.ProjectDetails.ProjectId || '',
          StageName: initialData?.ProgramDetails.StageName || '',
          ComponentCostFK: item.ComponentCostFK,
          ComponentId: item.ComponentId,
          YearOfWork: item.YearOfWork,
          WorkTypeFK: item.WorkTypeFK,
          InfraTypeFK: item.InfraTypeFK,
          TargetUnitId: item.TargetUnitId,
          TargetUnit: item.TargetUnit,
          CreatedBy: item.CreatedBy,
          IsDeleted: item.IsDeleted
        };
        majorItemsForPayload.push(majorItemPayload);
        
        // Add MajorItemLocations with ParentId referencing the MajorItem's ComponentId
        if (item.MajorItemLocations && item.MajorItemLocations.length > 0) {
          item.MajorItemLocations.forEach(location => {
            const workLocationPayload: MajorItemLocations = {
              ...location,
              WorkItemFK: item.Id, // Link to MajorItem via Id
              ComponentId: item.ComponentId // Link to MajorItem via ComponentId
            };
            workLocationsForPayload.push(workLocationPayload);
          });
        }
      });
      
      const payload = {
        ProjectDetails: {
          ...projectDetails,
          // Add missing required fields for the expected payload
          UpdatedBy: user?.UserId, // Set current user
          UpdatedDate: new Date().toISOString(),
        },
        ComponentCosts: componentCosts.map(cost => ({
          Id: cost.Id,
          Source: projectDetails.Source || 'Base',
          ProjectRevisionFK: cost.ProjectRevisionFK,
          ProjectFK: projectDetails.ProjectFK,
          ProjectId: cost.ProjectId,
          StageName: initialData?.ProgramDetails?.StageName,
          ComponentType: cost.ComponentType,
          ComponentId: cost.ComponentId,
          Description: cost.Description,
          Total: cost.Total,
          CreatedBy: cost.CreatedBy,
          CreatedDate: cost.CreatedDate,
          UpdatedBy: '',
          UpdatedDate: new Date().toISOString(),
          IsDeleted: cost.IsDeleted || false
        })),
        ComponentCostPerYear: componentCostPerYear.map(costPerYear => ({
          Id: costPerYear.Id,
          Source: projectDetails.Source || 'Base',
          ProjectFK: projectDetails.ProjectFK,
          ProjectId: projectDetails.ProjectId,
          StageName: projectDetails.StageName,
          ComponentCostFK: costPerYear.ComponentCostFK,
          ComponentId: costPerYear.ComponentId,
          Amount: costPerYear.Amount,
          Year: costPerYear.Year,
          UACS: costPerYear.UACS,
          StartDate: costPerYear.StartDate,
          EndDate: costPerYear.EndDate,
          CreatedBy: costPerYear.CreatedBy,
          CreatedDate: costPerYear.CreatedDate,
          UpdatedBy: user?.UserId,
          UpdatedDate: new Date().toISOString(),
          IsDeleted: costPerYear.IsDeleted || false
        })),
        MajorItemOfWorks: majorItemsForPayload,
        MajorItemLocations: workLocationsForPayload,
        // ProjectNotes: notes, // Include ProjectNotes as it's in the expected payload
        FundingProfile: fundingProfiles.map(profile => ({
          ...profile,
          StageName: projectDetails.StageName,
          Amount: profile.Amount,
          CreatedBy: user?.UserId || '',
        })),
        IsAllowedToProceed: allowProceed
      };

      const response = await updateEntireProject(payload);
      
      console.log('=== UPDATE RESPONSE RECEIVED ===');
      console.log('Response Type:', response.Data?.Type);
      console.log('Response Message:', response.Data?.Message);
      
      if (response.Data?.Type === 'Prompt' && !allowProceed)
      {
        console.log('Showing proceed dialog for update...');
        // Show custom dialog instead of window.confirm
        setProceedMessage(response.Data.Message);
        setIsProceedDialogOpen(true);
        return;
      }

      showToast({
          type: 'success',
          message: 'Project updated successfully.'
      });

      if (onRefresh) {
        onRefresh();
      } else if (initialData?.ProjectDetails?.ProjectId && initialData?.ProgramDetails?.StageName) {
        navigate(`/projects/project-details/${initialData.ProjectDetails.ProjectId}:${initialData.ProgramDetails.StageName}`);
      }

    } catch {
      // httpClient interceptor already showed the API error toast
    } finally {
      setUpdateAllProject(false);
    }
  };


  const handleReviseProject = (projectId: string, stageName: string, revisionTypeId: number, revisionTypeDescription: string) => {
    // navigate(`/projects/modify-project/${projectId}:${stageName}`);
    if (!projectId || !stageName || !revisionTypeId || !revisionTypeDescription) {
      alert('Project ID, Stage Name, Revision Type ID or Revision Type Description is missing. Cannot revise project.');
      return;
    }
    if (revisionTypeId){
      // Open the modification dialog
      setSelectedRevHeaderId(revisionTypeId);
      console.log(`Opening revision dialog for Project ${projectId}, Stage ${stageName}, Revision Type ${revisionTypeDescription} (${revisionTypeId})`);
      setIsRevisionOpen(true);
    }else {
      alert('Please select a valid revision type to proceed.');
    }
    

    // alert('Modify Project feature is coming soon! ' + projectId + ':' + stageName); 
  }

  const handleLock = (projectId: string, stageName: string) => {
    // navigate(`/projects/modify-project/${projectId}:${stageName}`);
    if (!projectId || !stageName) {
      alert('Project ID or Stage Name is missing. Cannot lock project.');
      return;
    }
    alert('Lock Project feature is coming soon! ' + projectId + ':' + stageName);
  }

  return (
    
    <div className="overflow-hidden max-w-10xl mx-auto p-6 space-y-6">
        <div className='flex items-center justify-between mb-6'>
          <div className="flex flex-end fixed top-2 right-25 z-50 gap-2 items-center">
              {mode === 'edit' && initialData?.IsActive === true && initialData?.IsUnlock === true && initialData?.ProgramDetails?.StageName !== 'GAA-R' && (
                <>
                  <Button color="red" className='cursor-pointer' onClick={() => handleLock(initialData?.ProjectDetails?.ProjectId ?? '', initialData?.ProgramDetails?.StageName ?? '')} disabled={updateAllProject}>
                    {updateUnlockProject ? 'Unlocking...' : 'UnLock Project'}
                  </Button>
                </>
              )}
              {/* CanUpdate is state-aware (published + open-revision check server-side) and is
                  mutually exclusive with CanRevise below by construction — see ProjectController.cs
                  ShowProjectDetails. Number(...) !== 1 is the pre-existing, separate stage-lock
                  condition, unchanged. */}
              {mode === 'edit' && !isLumpSumProject && initialData?.CanUpdate === true && Number(initialData?.ProgramDetails?.Status) !== 1 && (
                <>
                  <Button color="orange" className='cursor-pointer' onClick={handleUpdateProject} disabled={updateAllProject}>
                    {updateAllProject ? 'Updating...' : 'Update Project'}
                  </Button>
                </>
              )}
              {/* A Lump Sum Project is not revisable — RevisionController refuses it.
                  CanRevise already encodes IsPublished + no-open-revision server-side. */}
              {mode === 'edit' && !isLumpSumProject && initialData?.ProgramDetails?.StageName === 'GAA-R' && initialData?.CanRevise && (
                <Menu as="div" className="relative inline-block text-left">
                  <MenuButton
                    as={Button}
                    color='yellow' 
                    className='cursor-pointer'
                  >
                    {reviseProject ? 'Revisioning...' : 'Revise Project'}
                    <ChevronDownIcon className="h-4 w-4" />
                  </MenuButton>
                  <MenuItems className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                      {componentDropdowns?.Revisions?.Headers.map((types) => (
                        <MenuItem key={types.Id}>
                          {({ active }) => (
                            <button
                              onClick={() => handleReviseProject(
                                initialData?.ProjectDetails?.ProjectId ?? '', 
                                initialData?.ProgramDetails?.StageName ?? '',
                                types.Id,
                                types.RevisionName
                              )}
                              className={`${
                                active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                              } group flex w-full items-center px-4 py-2 text-sm text-left hover:bg-gray-50`}
                              disabled={reviseProject}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{types.RevisionName}</span>
                                {/* <span className="text-xs text-gray-500">ID: {revisionType.Id}</span> */}
                              </div>
                            </button>
                          )}
                        </MenuItem>
                      ))}
                    </div>
                  </MenuItems>
                </Menu>
              )}
          </div>
        </div>

      {/*  Say why the form is dead. Without this a Lump Sum Project looks like an
           ordinary project whose fields have all mysteriously stopped responding. */}
      {isLumpSumProject && (
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">This is a Lump Sum Project</h3>
          <p className="mt-1 text-sm text-blue-800">
            It is shown here for reference only. Lump Sum Projects are edited in the Lump
            Sum module, which is where their allocation, itemization and identity rules
            are applied.
          </p>
          {/*  The list, not the detail page: /lumpsum/:lumpSumId takes vLumpSumSet's
               numeric Id, which this module has no way to resolve from a ProjectId.
               Searching the list for the ID below is one step and always works. */}
          <a
            href="/lumpsum"
            className="mt-2 inline-block text-sm font-medium text-blue-700 underline hover:text-blue-900"
          >
            Go to the Lump Sum module
          </a>
        </div>
      )}

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
              popupFields={[
                { label: 'Component Id', key: 'ComponentId' },
                { label: 'Start Station Limit', key: 'StartStationLimit' },
                { label: 'End Station Limit', key: 'EndStationLimit' },
              ]}
              height="500px"
            />
          </div>
        )}
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
                initialData={initialData}
                initialStageName={initialStageName}
                initialProgramPK={initialProgramPK}
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
                  programDetails={programDetails}
                  projectDetails={projectDetails}
                  onChange={handleProjectDetailsChange}
                  projectEnums={projectEnums || undefined}
                  mode={mode}
                  errors={errors}
                  disabled={isDisabled}
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
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Funding Profile</h3>
            </div>
            <FundingProfileForm
              fundingProfiles={fundingProfiles}
              onAdd={handleAddFundingProfile}
              onEdit={handleEditFundingProfile}
              onDelete={handleDeleteFundingProfile}
              sources={componentDropdowns?.Sources}
              agreements={componentDropdowns?.Agreements}
              onTotalAmountChange={setMaxAmountCost}
              disabled={isDisabled}
            />
          </div>
        </div>

      {/* Component Cost Section - Fill this first to populate Major Items */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:p-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold leading-7 text-gray-900">Component Costs</h3>
            <p className="text-sm text-blue-600 font-medium">⚠️ Add component costs first - they are required for Major Items of Work</p>
          </div>
          <ComponentCostForm
            componentCosts={componentCosts}
            componentCostPerYear={componentCostPerYear}
            majorItems={majorItems}
            onAdd={handleAddComponentCost}
            onEdit={handleEditComponentCost}
            onDelete={handleDeleteComponentCost}
            initialData={initialData}
            componentTypes={componentDropdowns?.ComponentTypes}
            maxAmountCost={maxAmountCost}
            disabled={isDisabled}
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
            onAdd={handleAddMajorItem}
            onEdit={handleEditMajorItem}
            onDelete={handleDeleteMajorItem}
            dropDowns={componentDropdowns?.ScopeOfWorks}
            infraTypeEnums={componentDropdowns?.InfraTypes}
            programDetails={initialData?.ProgramDetails}
            disabled={isDisabled}
            deo={projectDetails.DEO}
          />
        </div>
      </div>

      {/* Component Targets Section — read-only, so no `disabled` prop: it is unaffected
          by lock/revise state. Grouped by component, expanding to per-stage targets. */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold leading-7 text-gray-900">Component Targets</h3>
          </div>
          <ComponentTargetsForm projectPK={initialData?.ProjectDetails.ProjectFK || ''} />
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
              dropDownOptions={componentDropdowns?.SupportingDocs}
              disabled={isDisabled}
            />
          </div>
        </div>
      </div>

      {/* Activities Section */}
      <ActivitySection activities={activities} transactionLogs={transactionLogs} />
      </>
      )}

      {/* Revision Dialog */}
      <RevisionDialog 
        isOpen={isRevisionOpen}
        onClose={() => setIsRevisionOpen(false)}
        projectId={initialData?.ProjectDetails.ProjectId || ''}
        stageName={initialData?.ProgramDetails?.StageName || ''}
        selectedRevHeaderId={selectedRevHeaderId}
        revHeaders={componentDropdowns?.Revisions?.Headers}
        categories={componentDropdowns?.Revisions?.Categories}
        reasons={componentDropdowns?.Revisions?.Reasons}
      />

      {/* Save/Update Confirmation Dialog */}
      <SaveProjectConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={mode === 'add' ? () => confirmSaveProject(false) : () => confirmUpdateProject(false)}
        mode={mode}
        projectName={projectDetails.Description}
      />

      {/* Proceed Anyway Dialog */}
      <ProceedAddProject
        isOpen={isProceedDialogOpen}
        onClose={() => setIsProceedDialogOpen(false)}
        onConfirm={handleProceedAnyway}
        message={proceedMessage}
        projectName={projectDetails.Description}
      />

    </div>
  );
};

export default ProjectForm;
