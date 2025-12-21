import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formValidation, type FormValidationError } from '../../../../utils/FormValidation';
import { projectDetailsRules } from '../../../Project/rules/projectDetailsRules';

import type { 
  ProjectDetails, 
  ComponentCost, 
  // ProjectNote,
  FundingProfile, 
  Activity, 
  TransactionLog,
  ProjectEnums,
  Dropdowns,
  ComponentCostYear,
  InfraData,
  MajorItemOfWorksWithDropdown,
  MajorItemOfWork,
  MajorItemLocations,
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
import { addProjectDetails, getProjectEnums, updateEntireProject, fetchProjectGeoJSON } from '../../../Project/Service';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { ProgramList } from '../../../Program/Model';
import { useToast } from '../../../../components/toaster/ToasterContext';
import ReviseProjectDialog from '../../dialogs/RevisedProjectDialog';
import ApproveModifyDialog from '../../dialogs/ApproveModifyDialog';
import ForReviewModifyDialog from '../../dialogs/ForReviewModifyDialog';
import TerminationDialog from '../../dialogs/TerminationDialog';
import ExcessPrompt from '../../dialogs/ExcessPrompt';
import RejectModifyDialog from '../../dialogs/RejectModifyDialog';

import RevisionForm from './RevisionForm';
import { checkExcessComponent } from '../../conditions/ExcessComponentAutomation';

import { useAuth } from '../../../../contexts/AuthContext';
import { useFieldPermissions } from '../../hooks/useFieldPermissions';
import type { RevisionProjectPayload } from '../../Model';

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



  console.log('ProjectForm - Received props:', { category, reason, reasonId, categoryId, revisionGroupId });

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
  const [updateAllProject, setUpdateAllProject] = useState<boolean>(false);
  const [updateApproveProject] = useState<boolean>(false);
  const [rejectDialogProject] = useState<boolean>(false);
  const [updateReviseProject] = useState<boolean>(false);
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
  const [isProgramOpen, setIsProgramOpen] = useState<boolean>(true);
  const [isProjectOpen, setIsProjectOpen] = useState<boolean>(true);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(true);
  // set isRevisedProjectDialogOpen
  const [isRevisedProjectDialogOpen, setIsRevisedProjectDialogOpen] = useState<boolean>(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState<boolean>(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState<boolean>(false);
  const [isForReviewDialogOpen, setIsForReviewDialogOpen] = useState<boolean>(false);
  const [isTerminationDialogOpen, setIsTerminationDialogOpen] = useState<boolean>(false);
  const [isExcessPromptOpen, setIsExcessPromptOpen] = useState<boolean>(false);
  const [excessComponentData, setExcessComponentData] = useState<{ excessAmount: number; message: string } | null>(null);

  // set GeoJSON data for map
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);
  
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
    Status: '',
    Type: '',
    Cost: 0,
    YearStart: 0,
    YearEnd: 0,
    CreatedBy: '',
    CreatedDate: '',
    IsPublished: false,
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
      MYCAApprovalDate: '',
      IslandCode: '',
      RevisionNumber: 0,
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
      EmergencyMode: false,
      Feasibility: 0,
      DetailedDesign: false,
      RowAvailable: false,
      Tier: 1,
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

  // Log field permissions for debugging
  useEffect(() => {
    console.log('=== FIELD PERMISSIONS IN PROJECT FORM ===');
    console.log('PCMA Status:', pcmaStatus);
    console.log('Package Status:', packageStatus);
    console.log('Current Case:', currentCase);
    console.log('Permissions:', permissions);
    console.log('Field Rules:', fieldRules);
    if (permissions) {
      console.log('Editable Fields Count:', permissions.editableFields?.length);
      console.log('Editable Fields:', permissions.editableFields);
    }
    console.log('========================================');
  }, [pcmaStatus, packageStatus, currentCase, permissions, fieldRules]);

  // #region GEOJSON DATA FOR MAP
    // Fetch GeoJSON data for map rendering
    useEffect(() => {
      const loadMapData = async () => {
        if (mode === 'edit' && initialData?.ProjectDetails?.ProjectId && initialData?.ProgramDetails?.ProgramId) {
          try {
            const response = await fetchProjectGeoJSON(
              initialData.ProjectDetails.ProjectId,
              initialData.ProgramDetails.ProgramId
              // 'P00906380VS',
              // 'P_CO-PS-635_01302025_100232'
            );
            if (response.Data) {
              setGeoJsonData(response.Data);
            }
          } catch (error) {
            console.error('Error loading map data:', error);
            // Gracefully handle error - map will show "No data available"
          }
        }
      };
  
      loadMapData();
    }, [mode, initialData?.ProjectDetails?.ProjectId, initialData?.ProgramDetails?.ProgramId]);
    // #endregion

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

  // Separate useEffect to handle initialProgramId
  useEffect(() => {
    if (initialProgramId && projectEnums?.Programs) {
      const selectedProgram = projectEnums.Programs.find(
        program => program.ProgramId === initialProgramId
      );
      if (selectedProgram) {
        setProgramDetails(selectedProgram);
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

  const [componentCosts, setComponentCosts] = useState<ComponentCost[]>(
    initialData?.ComponentCosts || []
  );

   const [componentCostsYear, setComponentCostsYear] = useState<ComponentCostYear[]>(
    initialData?.ComponentCostPerYear || []
  );

  // Combine componentCosts and componentCostsYear for UI - using useMemo to ensure proper recalculation
  const componentCostsWithYears = React.useMemo(() => {
    console.log('Recalculating componentCostsWithYears:', { componentCosts, componentCostsYear });
    return (componentCosts || []).map(cost => ({
      ...cost,
      CostPerYear: (componentCostsYear || []).filter(year => year.ParentId === cost.ReferenceId)
    }));
  }, [componentCosts, componentCostsYear]);

  // Debug effect to monitor componentCosts state changes
  useEffect(() => {
    console.log('ComponentCosts state changed:', componentCosts);
    console.log('ComponentCostsWithYears recalculated:', componentCostsWithYears);
  }, [componentCosts, componentCostsYear]); // componentCostsWithYears is derived, don't include it

  const [majorItems, setMajorItems] = useState<MajorItemOfWorksWithDropdown[]>(() => {
    if (!initialData?.MajorItemOfWorks) return [];
    
    // Transform backend MajorItemOfWork[] to MajorItemOfWorksWithDropdown[]
    // Combine with MajorItemLocations from the separate array
    return initialData.MajorItemOfWorks.map(item => {
      // Find MajorItemLocations that belong to this MajorItem via ParentId matching ReferenceId
      const itemWorkLocations = (initialData.MajorItemLocations || []).filter(
        location => location.ParentId === item.ReferenceId
      );
      
      return {
        ...item,
        // Ensure required fields exist
        TargetUnitId: item.TargetUnitId || 0,
        TargetUnit: item.TargetUnit || '',
        MajorItemLocations: itemWorkLocations, // Combine WorkLocations from separate array
        DropdownData: initialData?.Dropdowns?.ScopeOfWorks?.filter(scope => scope.InfraType === item.InfraType) || []
      };
    });
  });

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
    const total = fundingProfiles.reduce((sum, profile) => sum + (profile.Percentage || 0), 0);
    setTotalPercentage(total);
  }, [fundingProfiles]);

  const [Dropdowns] = useState<Dropdowns>(
    initialData?.Dropdowns || {
    Categories: [],
    Thrusts: [],
    Origins: [],
    Cities: [],
    ComponentTypes: [],
    LDs: [],
    OperatingUnits: [],
    IOs: [],
    DEOs: [],
    Agencies: [],
    Feasibility: [],
    ImplementationModes: [],
    EmergencyModes: [],
    Agreements: [],
    Sources: [],
    ScopeOfWorks: [],
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

  // Sample project location (you can update this based on your project data)
  // Commented out as it's not currently used but may be needed for future map functionality
  // const getProjectLocation = () => {
  //   // You can map city codes or project data to coordinates later
  //   // For now, return a sample location in Metro Manila
  //   return {
  //     lat: 14.6091,
  //     lng: 121.0223,
  //     name: projectDetails.Description || "Project Location"
  //   };
  // };

  // const handleGoBack = () => {
  //   navigate('/projects');
  // };

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
  const handleAddComponentCost = (newCost: ComponentCost, newCostYear?: ComponentCostYear) => {
    console.log('=== ADDING COMPONENT COST ===');
    console.log('New cost:', newCost);
    console.log('New cost year:', newCostYear);
    console.log('Current componentCosts before add:', componentCosts);

    // // Check for excess component condition before adding
    // const newTotalComponentCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0) + (newCost.Total || 0);
    // const projectCost = programDetails.Cost || 0;
    
    // const excessCheck = checkExcessComponent(modificationCategory, projectCost, newTotalComponentCost);
    
    // if (excessCheck && excessCheck.shouldPrompt) {
    //   // Store the new cost temporarily and show prompt
    //   setExcessComponentData({
    //     excessAmount: excessCheck.excessAmount,
    //     message: excessCheck.message
    //   });
    //   setIsExcessPromptOpen(true);
    //   // We'll handle the actual addition after user confirmation
    //   return;
    // }
    
    // Generate a temporary ID for new cost (will be replaced when saved)
    const tempId = Date.now().toString(); // Simple temp ID
    const costWithId = { ...newCost, ReferenceId: tempId };
    
    setComponentCosts(prev => {
      const updated = [...prev, costWithId];
      console.log('Updated componentCosts:', updated);
      return updated;
    });
    
    // If ComponentCostYear data is provided, add it to the componentCostsYear array
    if (newCostYear) {
      const costYearWithParentId = { 
        ...newCostYear, 
        ParentId: tempId, // Link to the component cost
        Id: Date.now() + 1 // Ensure unique ID
      };
      setComponentCostsYear(prev => {
        const updated = [...prev, costYearWithParentId];
        console.log('Updated componentCostsYear:', updated);
        return updated;
      });
      console.log('Added component cost year to staging:', costYearWithParentId);
    }
    
    console.log('Added component cost to staging:', costWithId);
  };

  const handleEditComponentCost = (index: number, updatedCost: ComponentCost) => {
    console.log('=== EDITING COMPONENT COST ===');
    console.log('Index:', index);
    console.log('Updated cost:', updatedCost);
    console.log('Current componentCosts before edit:', componentCosts);
    
    setComponentCosts(prev => {
      const updated = prev.map((cost, i) => i === index ? updatedCost : cost);
      console.log('Updated componentCosts after edit:', updated);
      return updated;
    });
    console.log('Updated component cost in staging:', updatedCost);
  };

  const handleDeleteComponentCost = (index: number) => {
    console.log('=== DELETING COMPONENT COST ===');
    console.log('Index:', index);
    console.log('Current componentCosts before delete:', componentCosts);
    
    const costToDelete = componentCosts[index];
    if (costToDelete) {
      setComponentCosts(prev => {
        const updated = prev.filter((_, i) => i !== index);
        console.log('Updated componentCosts after delete:', updated);
        return updated;
      });
      // Also remove related ComponentCostYear entries
      setComponentCostsYear(prev => {
        const updated = prev.filter(year => year.ParentId !== costToDelete.ReferenceId);
        console.log('Updated componentCostsYear after delete:', updated);
        return updated;
      });
      console.log('Deleted component cost from staging:', costToDelete);
    }
  };

    // #region Excess Component Handling
  const handleExcessPromptConfirm = () => {
    // User confirmed - create EXC component
    if (excessComponentData) {
      const tempId  = Date.now().toString();
      const excComponent: ComponentCost = {
        Id: 0,
        ProjectId: projectDetails.ProjectId || '',
        StageName: initialData?.ProgramDetails?.StageName || '',
        ReferenceId: tempId,
        ComponentType: 'EXC',
        ComponentId: `EXC`,
        Description: 'Excess - Intentional Project Cost Reduction',
        Total: excessComponentData.excessAmount,
      };

      setComponentCosts(prev => [...prev, excComponent]);
      console.log('Created EXC component:', excComponent);
      
      showToast({
        type: 'success',
        message: 'EXC component created successfully'
      });
    }
    setExcessComponentData(null);
  };

  const handleExcessPromptCancel = () => {
    // User cancelled - do nothing, just close the dialog
    console.log('User cancelled EXC component creation');
    setExcessComponentData(null);
    
    showToast({
      type: 'info',
      message: 'Component addition cancelled'
    });
  };
  // #endregion

  // Handlers for ComponentCostYear (these will be used when we implement year-by-year cost breakdown)
  // const handleAddComponentCostYear = (parentId: number, newCostYear: ComponentCostYear) => {
  //   setComponentCostsYear(prev => [...prev, { ...newCostYear, ParentId: parentId }]);
  //   console.log('Added component cost year to staging:', newCostYear);
  // };

  // const handleEditComponentCostYear = (costYearId: number, updatedCostYear: ComponentCostYear) => {
  //   setComponentCostsYear(prev => prev.map(year => year.Id === costYearId ? updatedCostYear : year));
  //   console.log('Updated component cost year in staging:', updatedCostYear);
  // };

  // const handleDeleteComponentCostYear = (costYearId: number) => {
  //   setComponentCostsYear(prev => prev.filter(year => year.Id !== costYearId));
  //   console.log('Deleted component cost year from staging:', costYearId);
  // };
  // #endregion

  // #region Major Items of Work
  const handleAddMajorItem = () => {
    // Generate a unique temporary ReferenceId for linking WorkLocations
    const tempReferenceId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newItem: MajorItemOfWorksWithDropdown = {
      Id: 0, // Temporary ID
      ProjectId: '',
      ReferenceId: tempReferenceId, // Use generated temp ID
      ComponentId: '',
      YearOfWork: 0,
      WorkTypeId: 0,
      InfraType: '',
      TargetUnitId: 0,
      TargetUnit: '',
      CreatedBy: '',
      MajorItemLocations: [], // Initialize empty work locations
      DropdownData: []
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
    setMajorItems(prev => prev.filter((_, i) => i !== index));
    console.log('Deleted major item from staging:', itemToDelete);
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
    setDocs(prev => prev.filter(selected => selected.Id !== doc.Id));
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
      CreatedDate: new Date().toISOString().split('T')[0]
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
    
    console.log('Updated funding profile in staging:', profileWithResetId);
  };

  const handleDeleteFundingProfile = (index: number) => {
    const profileToDelete = fundingProfiles[index];
    setFundingProfiles(prev => prev.filter((_, i) => i !== index));
    console.log('Deleted funding profile from staging:', profileToDelete);
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
      console.log('Validation errors found:', validationErrors);
      return;
    }
    
    setSavingSection('projectDetails');
    try {
      console.log('Adding new project details:', projectDetails);
      const response = await addProjectDetails({
        ...projectDetails,
        EmergencyMode: projectDetails.EmergencyMode ? true : false,
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

  const handleUpdateProject = async () => {
    // Clear previous error/success states
    
    // Validate form before updating
    const validationErrors = formValidation(projectDetails, projectDetailsRules);
    setErrors(validationErrors);
    
    // If there are validation errors, don't proceed with update
    if (Object.keys(validationErrors).length > 0) {
      console.log('Validation errors found:', validationErrors);
      return;
    }

    // Collect all business validation errors
    const businessValidationErrors: string[] = [];

    // Check funding percentage validation
    const roundedTotal = Math.round(totalPercentage * 100) / 100;
    if (roundedTotal !== 100) {
      businessValidationErrors.push(`Total funding percentage must equal 100%. Current total: ${roundedTotal.toFixed(1)}%`);
    }

    // Check component cost validation
    if (maxAmountCost && maxAmountCost > 0) {
      const totalComponentCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);
      
      if (totalComponentCost > maxAmountCost) {
        const exceeded = totalComponentCost - maxAmountCost;
        businessValidationErrors.push(`Total component cost (₱${totalComponentCost.toLocaleString('en-PH')}) exceeds the maximum budget (₱${maxAmountCost.toLocaleString('en-PH')}) by ₱${exceeded.toLocaleString('en-PH')}`);
      }
    }

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
    
    setUpdateAllProject(true);
    
    try {
      console.log('=== STAGING DATA BEFORE UPDATE ===');
      console.log('Component Costs:', componentCosts);
      console.log('Component Cost Years:', componentCostsYear);
      console.log('Major Items:', majorItems);
      console.log('Funding Profiles:', fundingProfiles);
      
      // Prepare data for backend matching the expected payload structure
      
      // Transform majorItems into separate MajorItemOfWorks and WorkLocations arrays
      const majorItemsForPayload: MajorItemOfWork[] = [];
      const workLocationsForPayload: MajorItemLocations[] = [];
      
      majorItems.forEach(item => {
        // Create MajorItemOfWork without WorkLocations and DropdownData (UI-only)
        const majorItemPayload: MajorItemOfWork = {
          Id: item.Id,
          ProjectId: initialData?.ProjectDetails.ProjectId || '',
          StageName: initialData?.ProgramDetails.StageName || '',
          ComponentId: item.ComponentId,
          ReferenceId: item.ReferenceId,
          YearOfWork: item.YearOfWork,
          WorkTypeId: item.WorkTypeId,
          InfraType: item.InfraType,
          TargetUnitId: item.TargetUnitId,
          TargetUnit: item.TargetUnit,
          CreatedBy: item.CreatedBy
        };
        majorItemsForPayload.push(majorItemPayload);
        
        // Add MajorItemLocations with ParentId referencing the MajorItem's ReferenceId
        if (item.MajorItemLocations && item.MajorItemLocations.length > 0) {
          item.MajorItemLocations.forEach(location => {
            const workLocationPayload: MajorItemLocations = {
              ...location,
              ParentId: item.ReferenceId // Link to MajorItem via ReferenceId
            };
            workLocationsForPayload.push(workLocationPayload);
          });
        }
      });
      
      const payload = {
        ProjectDetails: {
          ...projectDetails,
          // Add missing required fields for the expected payload
          ProgramName: programDetails.Name || '',
          EmergencyMode: projectDetails.EmergencyMode ? true : false,
          CreatedBy: projectDetails.CreatedBy || 'SYSTEM',
          CreatedDate: projectDetails.CreatedDate || new Date().toISOString(),
          UpdatedBy: 'SYSTEM', // Set current user
          UpdatedDate: new Date().toISOString(),
        },
        ComponentCosts: componentCosts.map(cost => ({
          Id: cost.Id,
          ProjectId: cost.ProjectId || projectDetails.ProjectId || '',
          StageName: initialData?.ProgramDetails?.StageName || '',
          ReferenceId: cost.ReferenceId || '',
          ComponentType: cost.ComponentType || '',
          ComponentId: cost.ComponentId || '',
          Description: cost.Description || '',
          Total: cost.Total || 0,
          CreatedBy: cost.CreatedBy || 'SYSTEM',
          CreatedDate: cost.CreatedDate || new Date().toISOString(),
          UpdatedBy: 'SYSTEM',
          UpdatedDate: new Date().toISOString(),
        })),
        ComponentCostYear: componentCostsYear.map(year => ({
          Id: year.Id,
          ParentId: year.ParentId,
          CostYear: year.CostYear,
          Cost: year.Cost,
          StartDate: year.StartDate || new Date().toISOString(),
          EndDate: year.EndDate || new Date().toISOString()
        })),
        MajorItemOfWorks: majorItemsForPayload,
        MajorItemLocations: workLocationsForPayload,
        // ProjectNotes: notes, // Include ProjectNotes as it's in the expected payload
        FundingProfile: fundingProfiles.map(profile => ({
          ...profile, StageName: initialData?.ProgramDetails?.StageName || '',
        }))
      };

      console.log('=== SENDING TO BACKEND (MATCHING EXPECTED PAYLOAD) ===');
      console.log('Update payload:', payload);

      await updateEntireProject(payload);

      showToast({
          type: 'success',
          message: 'Project updated successfully.'
      });

      // Backend only returns success message, not the updated data
      // So we keep the current state as is after successful update
      console.log('=== PROJECT UPDATE SUCCESSFUL ===');
      console.log('Keeping current state after successful update');
      console.log('Current Component Costs:', componentCosts);
      console.log('Current Component Cost Years:', componentCostsYear);
      console.log('Current Major Items:', majorItems);
      console.log('Current Funding Profiles:', fundingProfiles);

    } catch (error) {
      showToast({
          type: 'error',
          message: 'Failed to fetch projects.'
      });
      
      // Don't use alert() - use proper error state instead
      // console.error('Update failed with error:', errorMessage);
    } finally {
      setUpdateAllProject(false);
    }
  };

  const handleSubmitModify = () => {
  // Check for excess component condition before submitting
    const totalComponentCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);
    const projectCost = programDetails.Cost || 0;
    
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
    
    // If no excess or not applicable, proceed directly
    setIsRevisedProjectDialogOpen(true);
  }

  const handleApproveModification = async () => {
    // TODO: Implement the actual approval API call
    console.log('Approving modification for:', {
      project: projectDetails,
      category: modificationCategory,
      reason: modificationReason
    });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Here you would call your actual API service
    // await approveModificationRequest(projectDetails.ProjectId, modificationCategory, modificationReason);
    
    showToast({
      type: 'success',
      message: 'Modification approved successfully'
    });
  }

  const handleForReviewModification = async (reviewComments: string) => {
    // TODO: Implement the actual review request API call
    console.log('Sending for review:', {
      project: projectDetails,
      category: modificationCategory,
      reason: modificationReason,
      comments: reviewComments
    });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Here you would call your actual API service
    // await sendForReviewModificationRequest(projectDetails.ProjectId, reviewComments);
    
    showToast({
      type: 'success',
      message: 'Request sent for review successfully'
    });
  }

  const handleTerminationSubmit = async (hasUnfinishedWork: boolean) => {
    // TODO: Implement the actual termination API call
    console.log('Termination submitted:', {
      project: projectDetails,
      category: modificationCategory,
      reason: modificationReason,
      hasUnfinishedWork: hasUnfinishedWork
    });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Alert the result for now
    alert(`Termination request submitted!\n\nHas Unfinished Work Balance: ${hasUnfinishedWork ? 'Yes' : 'No'}\n\nProject: ${projectDetails.ProjectId}\nCategory: ${modificationCategory}\nReason: ${modificationReason}`);
    
    showToast({
      type: 'success',
      message: 'Termination request submitted successfully'
    });
  }

  const handleRejectModification = async (rejectionReason: string) => {
    // TODO: Implement the actual rejection API call
    console.log('Rejecting modification:', {
      project: projectDetails,
      category: modificationCategory,
      reason: modificationReason,
      rejectionReason: rejectionReason
    });
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showToast({
      type: 'success',
      message: 'Modification rejected successfully'
    });
  }

  // Check if category is Termination and show dialog automatically
  useEffect(() => {
    const normalizedCategory = modificationCategory?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    if (normalizedCategory === 'termination' && mode === 'edit') {
      setIsTerminationDialogOpen(true);
    }
  }, [modificationCategory, mode]);

  return (
    
    <div className="overflow-hidden max-w-10xl mx-auto p-6 space-y-6">
        <div className='flex items-center justify-between mb-6'>
            {/* Breadcrumb */}
            {/* <nav className="flex items-center text-sm text-left text-gray-500">
                <span>MYPS Admin</span>
                <span className="mx-2">&gt;</span>
                <span 
                className="text-blue-600 hover:text-blue-800 cursor-pointer"
                onClick={handleGoBack}
                >
                Project Revision
                </span>
                <span className="mx-2">&gt;</span>
                <span>{mode === 'add' ? 'Add Project' : 'Edit Project'}</span>
                <span className="mx-2">&gt;</span>
            </nav> */}
            <div>
              
            </div>
            <div className="flex space-x-3">
                {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && (user?.UserGroups === 'Implementing Office' ) && (
                  <>
                    <Button color="green" className='cursor-pointer' onClick={() => handleSubmitModify()} disabled={updateReviseProject}>
                      {updateReviseProject ? 'Submitting...' : 'Submit Modify Request to RO'}
                    </Button>
                  </>
                )}
                {/* need refactor here */}
                {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && (user?.UserGroups === 'Implementing Office' ) && (
                  <>
                    <Button color="yellow" className='cursor-pointer' disabled={updateReviseProject}>
                      {updateReviseProject ? 'Submitting...' : 'Pending RO Approval'}
                    </Button>
                  </>
                )}
                {mode === 'edit' && (initialData?.RevisionDetails?.COStatus === 0 && initialData?.RevisionDetails?.RegionStatus === 1) && (user?.UserGroups === 'Implementing Office' ) && (
                  <>
                    <Button color="yellow" className='cursor-pointer' disabled={updateReviseProject}>
                      {updateReviseProject ? 'Submitting...' : 'Pending CO Approval'}
                    </Button>
                  </>
                )}
                {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && (user?.UserGroups === 'Regional Office' ) && (
                  <>
                    <Button color="green" className='cursor-pointer' onClick={() => setIsApproveDialogOpen(true)} disabled={updateReviseProject}>
                      {updateReviseProject ? 'Submitting...' : 'Submit Modify Request CO'}
                    </Button>
                  </>
                )}
                {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && user?.UserGroups === 'Regional Office' && (
                  <>
                    <Button color="amber" className='cursor-pointer' onClick={() => setIsForReviewDialogOpen(true)} disabled={updateForReviewProject}>
                      {updateForReviewProject ? 'Initializing...' : 'For Correction'}
                    </Button>
                  </>
                )}
                {mode === 'edit' && user?.UserGroups === 'Central Office' && (
                  <>
                    <Button color="green" className='cursor-pointer' onClick={() => handleSubmitModify()} disabled={updateApproveProject}>
                      {updateApproveProject ? 'Approving...' : 'Approve'}
                    </Button>
                  </>
                )}
                {mode === 'edit' && initialData?.RevisionDetails?.COStatus === 0 && user?.UserGroups === 'Central Office' && (
                  <>
                    <Button color="amber" className='cursor-pointer' onClick={() => setIsForReviewDialogOpen(true)} disabled={updateForReviewProject}>
                      {updateForReviewProject ? 'Initializing...' : 'For Correction'}
                    </Button>
                  </>
                )}
                
                {mode === 'edit' && initialData?.RevisionDetails?.COStatus === 0 && user?.UserGroups === 'Central Office' && (
                  <>
                    <Button color="red" className='cursor-pointer' onClick={() => setIsRejectDialogOpen(true)} disabled={rejectDialogProject}>
                      {rejectDialogProject ? 'Rejecting...' : 'Disapprove'}
                    </Button>
                  </>
                )}
                {mode === 'edit' && initialData?.RevisionDetails?.RegionStatus === 0 && user?.UserGroups === 'Regional Office' && (
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
            </div>
        </div>

      {/* Map Section */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div
          className="flex justify-between items-center px-4 py-4 cursor-pointer border-b"
          onClick={() => setIsMapOpen(!isMapOpen)}
        >
          <h3 className="text-lg font-semibold leading-7 text-gray-900">
            Project Location
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
      <div className='bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl'>
        <RevisionForm
          category={permissions?.category || modificationCategory}
          reason={modificationReason}
          projectDetails={projectDetails}
          componentCosts={componentCosts}
          componentCostYear={componentCostsYear}
          majorItemOfWorks={majorItems.map(item => ({
            Id: item.Id,
            ProjectId: item.ProjectId,
            StageName: initialData?.ProgramDetails.StageName || '',
            ComponentId: item.ComponentId,
            ReferenceId: item.ReferenceId,
            YearOfWork: item.YearOfWork,
            WorkTypeId: item.WorkTypeId,
            InfraType: item.InfraType,
            TargetUnitId: item.TargetUnitId,
            TargetUnit: item.TargetUnit,
            CreatedBy: item.CreatedBy
          }))}
          majorItemLocations={majorItems.flatMap(item => 
            (item.MajorItemLocations || []).map(location => ({
              ...location,
              ParentId: item.ReferenceId,
              ProjectId: item.ProjectId || '',
              StageName: initialData?.ProgramDetails.StageName || ''
            }))
          )}
          fundingProfile={fundingProfiles}
        />
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
                  fieldPermissions={permissions}
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
            componentCosts={componentCostsWithYears}
            onAdd={handleAddComponentCost}
            onEdit={handleEditComponentCost}
            onDelete={handleDeleteComponentCost}
            initialData={initialData}
            maxAmountCost={maxAmountCost}
            disabled={isDisabled}
            fieldPermissions={permissions}
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
            onAdd={handleAddMajorItem}
            onEdit={handleEditMajorItem}
            onDelete={handleDeleteMajorItem}
            dropDowns={initialData?.Dropdowns?.ScopeOfWorks}
            programDetails={initialData?.ProgramDetails}
            disabled={isDisabled}
            fieldPermissions={permissions}
            reason={modificationReason}
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

      {/* Modify Project Modal */}
      {isRevisedProjectDialogOpen && (<ReviseProjectDialog
        isOpen={isRevisedProjectDialogOpen}
        onClose={() => setIsRevisedProjectDialogOpen(false)}
        revisionCategory={modificationCategory}
        revisionReason={modificationReason}
        reasonId={modificationReasonId}
        categoryId={categoryId}
        revisionGroupId={revisionGroupId}
        project={projectDetails}
        componentCosts={componentCosts}
        componentCostYear={componentCostsYear}
        majorItemOfWorks={majorItems.map(item => ({
          Id: item.Id,
          ProjectId: item.ProjectId,
          StageName: initialData?.ProgramDetails.StageName || '',
          ComponentId: item.ComponentId,
          ReferenceId: item.ReferenceId,
          YearOfWork: item.YearOfWork,
          WorkTypeId: item.WorkTypeId,
          InfraType: item.InfraType,
          TargetUnitId: item.TargetUnitId,
          TargetUnit: item.TargetUnit,
          CreatedBy: item.CreatedBy
        }))}
        majorItemLocations={majorItems.flatMap(item => 
          (item.MajorItemLocations || []).map(location => ({
            ...location,
            ParentId: item.ReferenceId,
            ProjectId: item.ProjectId || '',
            StageName: initialData?.ProgramDetails.StageName || ''
          }))
        )}
        fundingProfile={fundingProfiles}
      />)}

      {/* Approve Modification Modal */}
      {isApproveDialogOpen && (
        <ApproveModifyDialog
          isOpen={isApproveDialogOpen}
          onClose={() => setIsApproveDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          category={modificationCategory}
          reason={modificationReason}
          onApprove={handleApproveModification}
          onSuccess={onActionSuccess}
        />
      )}

      {/* For Review Modification Modal */}
      {isForReviewDialogOpen && (
        <ForReviewModifyDialog
          isOpen={isForReviewDialogOpen}
          onClose={() => setIsForReviewDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          category={modificationCategory}
          reason={modificationReason}
          onSubmitForReview={handleForReviewModification}
          onSuccess={onActionSuccess}
        />
      )}

      {/* Reject Modification Modal */}
      {isRejectDialogOpen && (
        <RejectModifyDialog
          isOpen={isRejectDialogOpen}
          onClose={() => setIsRejectDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          category={modificationCategory}
          reason={modificationReason}
          onReject={handleRejectModification}
          onSuccess={onActionSuccess}
        />
      )}

      {/* Excess Component Prompt */}
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
      {/* Termination Dialog */}
      {isTerminationDialogOpen && (
        <TerminationDialog
          isOpen={isTerminationDialogOpen}
          onClose={() => setIsTerminationDialogOpen(false)}
          project={initialData?.ProjectDetails || projectDetails}
          onSubmitTermination={handleTerminationSubmit}
        />
      )}
    </div>
  );
};

export default ProjectForm;
