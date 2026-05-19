import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { formValidation, type FormValidationError } from '../../../utils/FormValidation';
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
import NotesForm from './NotesForm';
import FundingProfileForm from './FundingProfileForm';
import ActivitySection from './ActivitySection';
import { addProjectDetails, getProjectEnums, updateEntireProject, fetchProjectGeoJSON, importProject } from '../Service';
import { ChevronDownIcon, ChevronRightIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import ImportLumpsumDialog from '../dialogs/ImportLumpsumDialog';
import type { ImportedProject } from '../Model.d';
import { transformImportedProjects } from '../../Program/utils/transformImportedProjects';
import type { ProgramList } from '../../Program/Model';
import { useToast } from '../../../components/toaster/ToasterContext';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';

import RevisionDialog from '../dialogs/RevisionDialog';
import SaveProjectConfirmDialog from '../dialogs/SaveProjectConfirmDialog';
import ProceedAddProject from '../dialogs/ProceedAddProject';
import { defaultCoordinates } from '../utils/coordinates';

interface ProjectFormProps {
  initialData?: ProjectFormPayload;
  mode?: 'add' | 'edit';
  initialProgramId?: string;
  initialStageName?: string;
  onRefresh?: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, mode = 'add', initialProgramId, initialStageName, onRefresh }) => {

  const navigate = useNavigate();
  const { user } = useAuth();

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
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
  const isDisabled = Boolean(
    (initialData?.IsActive === false) ||
    (Number(initialData?.ProgramDetails?.StageId) === 10 && initialData?.ProgramDetails?.Status === 1)
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
  const [ isImportLumpsumOpen, setIsImportLumpsumOpen ] = useState<boolean>(false);

  
  // SetMaxAmount in ComponentCostForm
  const [maxAmountCost, setMaxAmountCost] = useState<number>(0);

  // Initialize state with empty data or provided initial data
  const [programDetails, setProgramDetails] = useState<ProgramList>(
    initialData?.ProgramDetails || {
    Id: 0,
    RevisionId: 0,
    ProgramId: '',
    StageName: '',
    Name: '',
    GroupName: '',
    RegionCode: '',
    Status: 0,
    Type: '',
    Cost: 0,
    YearStart: 0,
    YearEnd: 0,
    CreatedBy: '',
    CreatedDate: '',
    IsPublishable: false,
    // IsPublished: false,
  });

  const [projectDetails, setProjectDetails] = useState<ProjectDetails>(
    initialData?.ProjectDetails || {
      Id: 0,
      ProgramId: '',
      ProgramName: '',
      StageName: '',
      ProjectId: '',
      AlternateId: '',
      ExternalId: '',
      MYId: '',
      UACS: '',
      MYCAApprovalDate: null,
      IslandCode: '',
      RevisionId: 0,
      Description: '',
      Category: 0,
      Thrust: 0,
      Origin: 0,
      City: '',
      Province: '',
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
      Tier: 1,
    }
  );

  // const [majorItemsLocation] = useState<MajorItemLocations[]>(
  //   initialData?.MajorItemLocations || []
  // );

  useEffect(() => {
    // Load project enums
    const loadProjectEnums = async () => {
      try {
        const response = await getProjectEnums();
        console.log('Project Enums:', response.Data);
        setProjectEnums(response.Data);
      } catch (error) {
        console.error('Error loading project enums:', error);
      }
    };

    loadProjectEnums();
    // loadInfrastructureData();

    // Set program details if in edit mode and initialData is present
    if (mode === 'edit' && initialData?.ProgramDetails) {
      setProgramDetails(initialData.ProgramDetails);
    }
  }, [mode, initialData]);

  // Fetch GeoJSON data for map rendering
  const loadMapData = useCallback(async () => {
    if (mode === 'edit' && initialData?.ProjectDetails?.ProjectId && initialData?.ProgramDetails?.ProgramId) {
      try {
        // alert('loading map data' + initialData?.ProjectDetails?.ProjectId + ' ' + initialData?.ProgramDetails?.ProgramId);
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

  // Separate useEffect to handle initialProgramId
  useEffect(() => {
    if (initialProgramId && projectEnums?.Programs) {
      const selectedProgram = projectEnums.Programs.find(
        program => program.ProgramId === initialProgramId && program.StageName === initialStageName
      );
      if (selectedProgram) {
        setProgramDetails(selectedProgram);
        // Also update project details with the program ID
        setProjectDetails(prev => ({
          ...prev,
          ProgramId: selectedProgram.ProgramId,
          ProgramName: selectedProgram.Name,
          StageName: initialStageName || '',
        }));
      }
    }
  }, [initialProgramId, initialStageName, projectEnums?.Programs]);
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
        location => location.ParentId === item.ReferenceId
      );
      
      return {
        ...item,
        // Ensure required fields exist
        TargetUnitId: item.TargetUnitId || 0,
        TargetUnit: item.TargetUnit || '',
        MajorItemLocations: itemWorkLocations, // Combine WorkLocations from separate array
        DropdownData: initialData?.Dropdowns?.ScopeOfWorks?.filter(scope => scope.InfraType.includes(item.InfraType)) || []
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

  const [Dropdowns] = useState<Dropdowns>(
    initialData?.Dropdowns || {
    // Categories: [],
    // Thrusts: [],
    // Origins: [],
    // Cities: [],
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

  const handleProgramDetailsChange = (updatedProgramDetails: ProgramList) => {
    console.log('Program details changed in ProjectForm:', updatedProgramDetails);
    setProgramDetails(updatedProgramDetails);
    
    // Update project details with program information
    setProjectDetails(prev => ({
      ...prev,
      ProgramId: updatedProgramDetails.ProgramId,
      // You can add other program-related fields here if needed
    }));
    console.log('Project details updated with ProgramId:', updatedProgramDetails.ProgramId);
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
    
    setComponentCosts(prev => {
      const updated = prev.map((cost, i) => i === index ? updatedCost : cost);
      console.log('Updated componentCosts after edit:', updated);
      return updated;
    });
    
    // Update per-year costs for this component
    setComponentCostPerYear(prev => {
      // Remove existing per-year costs for this component
      const filteredCosts = prev.filter(cost => cost.ComponentCostId !== updatedCost.CostId);
      // Add updated per-year costs
      const updated = [...filteredCosts, ...updatedCostPerYear];
      console.log('Updated componentCostPerYear after edit:', updated);
      return updated;
    });
    
    console.log('Updated component cost in staging:', updatedCost);
  };

  const handleDeleteComponentCost = (index: number) => {
    const costToDelete = componentCosts[index];
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

      // Step 1: Delete ComponentCost itself based on its own Id
      if (costToDelete.Id === 0) {
        setComponentCosts(prev => prev.filter((_, i) => i !== index));
      } else {
        setComponentCosts(prev => prev.map((cost, i) =>
          i === index ? { ...cost, IsDeleted: true } : cost
        ));
      }

      // Step 2: Cascade to ComponentCostPerYear — each child's Id decides hard vs soft
      setComponentCostPerYear(prev =>
        prev
          .filter(cost => !(cost.ComponentCostId === costToDelete.CostId && cost.Id === 0))
          .map(cost =>
            cost.ComponentCostId === costToDelete.CostId
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
  const handleAddMajorItem = () => {
    // Generate a unique temporary ReferenceId for linking WorkLocations
    const tempReferenceId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: MajorItemOfWorksWithDropdown = {
      Id: 0, // Temporary ID
      ProjectId: '',
      ReferenceId: tempReferenceId, // Use generated temp ID for linking work locations
      ComponentId: '',
      YearOfWork: 0,
      WorkTypeId: 0,
      InfraType: '',
      TargetUnitId: 0,
      TargetUnit: '',
      CreatedBy: '',
      MajorItemLocations: [], // Initialize empty work locations
      DropdownData: [],
      IsDeleted: false
    };
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
      IsDeleted: false
    };
    setFundingProfiles(prev => [...prev, newProfile]);
    console.log('Added funding profile to staging:', newProfile);
  };

  const handleEditFundingProfile = (index: number, updatedProfile: FundingProfile) => {
    // Force Id to 0 for all funding profiles to treat as new records
    const profileWithResetId = { ...updatedProfile, Id: 0 };
    
    setFundingProfiles(prev => 
      prev.map((profile, i) => i === index ? profileWithResetId : profile)
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
          ProjectId: initialData?.ProjectDetails.ProjectId || '',
          ReferenceId: item.ReferenceId,
          StageName: initialData?.ProgramDetails.StageName || '',
          ComponentId: item.ComponentId,
          YearOfWork: item.YearOfWork,
          WorkTypeId: item.WorkTypeId,
          InfraType: item.InfraType,
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
              ParentId: item.ReferenceId // Link to MajorItem via ComponentId
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
          ProjectId: cost.ProjectId,
          CostId: cost.CostId,
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
          ComponentCostId: costPerYear.ComponentCostId,
          Amount: costPerYear.Amount,
          Year: costPerYear.Year,
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
          StageName: initialData?.ProgramDetails?.StageName,
          Amount: profile.Amount,
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

    } catch (error) {
      showToast({
          type: 'error',
          message: 'Failed to fetch projects.'
      });
    } finally {
      setUpdateAllProject(false);
    }
  };

  // ── Lump Sum Import ──────────────────────────────────────────────────────
  const handleImportLumpsumSubmit = async (projects: ImportedProject[]) => {
    try {
      const programId = initialData?.ProgramDetails?.ProgramId ?? '';
      const stageName = initialData?.ProgramDetails?.StageName ?? '';

      const transformed = transformImportedProjects(projects, programId, stageName);

      console.group('[Lump Sum Import — Exact API Payload → /Importing/ImportProject/]');
      console.log('programDetails:',       transformed.programDetails);
      console.log('projectDetails:',       transformed.projectDetails);
      console.log('fundingProfile:',       transformed.fundingProfile);
      console.log('componentCosts:',       transformed.componentCosts);
      console.log('componentCostPerYear:', transformed.componentCostPerYear);
      console.log('majorItemOfWorks:',     transformed.majorItemOfWorks);
      console.log('majorItemLocations:',   transformed.majorItemLocations);
      console.log('── Full JSON ──', JSON.stringify(transformed, null, 2));
      console.groupEnd();

      await importProject(transformed);
      showToast({
        type: 'success',
        message: `Successfully imported ${transformed.projectDetails.length} project${transformed.projectDetails.length !== 1 ? 's' : ''}.`,
      });

      // Refresh the page after successful import
      if (initialData?.ProjectDetails?.ProjectId && stageName) {
        navigate(`/projects/project-details/${initialData.ProjectDetails.ProjectId}:${stageName}`);
      }
    } catch (error) {
      console.error('Error importing lump sum project:', error);
      showToast({
        type: 'error',
        message: 'Failed to import lump sum project. Please try again.',
      });
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
              {mode === 'edit' && initialData?.IsActive === true && initialData?.IsUnlock === true && initialData?.ProgramDetails?.StageId !== 10 && (
                <>
                  <Button color="red" className='cursor-pointer' onClick={() => handleLock(initialData?.ProjectDetails?.ProjectId ?? '', initialData?.ProgramDetails?.StageName ?? '')} disabled={updateAllProject}>
                    {updateUnlockProject ? 'Unlocking...' : 'UnLock Project'}
                  </Button>
                </>
              )}
              {mode === 'edit' && initialData?.ProgramDetails?.StageId !== 10 && initialData?.ProjectDetails?.ProjectId?.toUpperCase().endsWith('LS') && (
                <Button
                  color="blue"
                  className="cursor-pointer"
                  onClick={() => setIsImportLumpsumOpen(true)}
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Itemized Lump Sum
                </Button>
              )}
              {mode === 'edit' && initialData?.IsActive === true && initialData?.ProgramDetails?.Status !== 1 && (
                <>
                  <Button color="orange" className='cursor-pointer' onClick={handleUpdateProject} disabled={updateAllProject}>
                    {updateAllProject ? 'Updating...' : 'Update Project'}
                  </Button> 
                </>
              )}
              {mode === 'edit' && initialData?.ProgramDetails?.StageId === 10 && initialData?.ProgramDetails?.Status === 1 && (
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
                      {Dropdowns?.Revisions?.Headers.map((types) => (
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
                initialStageName={initialStageName}
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
            dropDowns={initialData?.Dropdowns?.ScopeOfWorks}
            infraTypeEnums={initialData?.Dropdowns?.InfraTypes}
            programDetails={initialData?.ProgramDetails}
            disabled={isDisabled}
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

      {/* Revision Dialog */}
      <RevisionDialog 
        isOpen={isRevisionOpen}
        onClose={() => setIsRevisionOpen(false)}
        projectId={initialData?.ProjectDetails.ProjectId || ''}
        stageName={initialData?.ProgramDetails?.StageName || ''}
        selectedRevHeaderId={selectedRevHeaderId}
        revHeaders={Dropdowns?.Revisions?.Headers}
        categories={Dropdowns?.Revisions?.Categories}
        reasons={Dropdowns?.Revisions?.Reasons}
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

      {/* Lump Sum Import Dialog */}
      <ImportLumpsumDialog
        isOpen={isImportLumpsumOpen}
        onClose={() => setIsImportLumpsumOpen(false)}
        onSubmit={handleImportLumpsumSubmit}
        projectId={initialData?.ProjectDetails?.ProjectId ?? ''}
        programId={initialData?.ProgramDetails?.ProgramId ?? ''}
        stageName={initialData?.ProgramDetails?.StageName ?? ''}
      />

    </div>
  );
};

export default ProjectForm;
