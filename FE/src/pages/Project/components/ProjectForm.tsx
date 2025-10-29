import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formValidation, type FormValidationError } from '../../../utils/FormValidation';
import { projectDetailsRules } from '../rules/projectDetailsRules';
import type { 
  ProjectDetails, 
  ComponentCost, 
  // ProjectNote,
  FundingProfile, 
  Activity, 
  TransactionLog,
  ProjectFormPayload,
  ProjectEnums,
  Dropdowns,
  ComponentCostYear,
  InfraData,
  MajorItemOfWorksWithDropdown,
  MajorItemOfWork,
  MajorItemLocations,
  ProjectSupportingDocs
} from '../Model.d';

import { Button } from '../../../components/tailwindui/button';
import MetroManilaMap from '../../../components/map/MetroManilaMap';

//Sub-components
import ProgramDetailsForm from './ProgramDetailsForm';
import ProjectDetailsForm from './ProjectDetailsForm';
import ComponentCostForm from './ComponentCostForm';
import MajorItemOfWorksForm from './MajorItemOfWorksForm';
import NotesForm from './NotesForm';
import FundingProfileForm from './FundingProfileForm';
import ActivitySection from './ActivitySection';
import { addProjectDetails, getProjectEnums, updateEntireProject } from '../Service';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { ProgramList } from '../../Program/Model';
import { useToast } from '../../../components/toaster/ToasterContext';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { categoryData } from '../../Modification/mockData/Dropdown';

interface ProjectFormProps {
  initialData?: ProjectFormPayload;
  mode?: 'add' | 'edit';
  initialProgramId?: string;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, mode = 'add', initialProgramId }) => {

  const navigate = useNavigate();

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
  const [updateAllProject, setUpdateAllProject] = useState<boolean>(false);
  const [updateUnlockProject, setUpdateUnlockProject] = useState<boolean>(false);
  // const [reviseProject, setReviseProject] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormValidationError<ProjectDetails>>({});
  //toaster here
  const { showToast } = useToast();
  // DisableFields if status === approved
  const isDisabled = Number(initialData?.ProgramDetails?.Status) === 1;

  // toggle state for Program Details section
  const [isProgramOpen, setIsProgramOpen] = useState<boolean>(true);
  const [isProjectOpen, setIsProjectOpen] = useState<boolean>(true);
  const [isMapOpen, setIsMapOpen] = useState<boolean>(true);
  
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
      // MYCAApprovalDate: '',
      IslandCode: '',
      RevisionNumber: 0,
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
      EmergencyMode: false,
      Feasibility: 0,
      DetailedDesign: false,
      RowAvailable: false,
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

    // Load infrastructure data
    // const loadInfrastructureData = async () => {
    //   try {
    //     const response = await getInfrastructureData();
    //     console.log('Infrastructure Data:', response.Data);
    //     setInfraData(response.Data);
    //   } catch (error) {
    //     console.error('Error loading infrastructure data:', error);
    //     // Set empty data on error to prevent crashes
    //     setInfraData({
    //       RoadSections: [],
    //       Bridges: [],
    //       FCS: [],
    //       OtherInfra: []
    //     });
    //   }
    // };

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
  }, [componentCosts, componentCostsWithYears]);

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

  // Debug effect to monitor majorItems state changes  
  useEffect(() => {
    console.log('MajorItems state changed:', majorItems);
  }, [majorItems]);

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
    SupportingDocs: []
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
  const getProjectLocation = () => {
    // You can map city codes or project data to coordinates later
    // For now, return a sample location in Metro Manila
    return {
      lat: 14.6091,
      lng: 121.0223,
      name: projectDetails.Description || "Project Location"
    };
  };

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
      Agreement: 0,
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
        Province: projectDetails.Province ? projectDetails.Province.toString() : '',
        City: projectDetails.City ? projectDetails.City.toString() : '',
        LegislativeDistrict: projectDetails.LegislativeDistrict ? projectDetails.LegislativeDistrict.toString() : '',
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
          Province: projectDetails.Province ? projectDetails.Province.toString() : '',
          City: projectDetails.City ? projectDetails.City.toString() : '',
          LegislativeDistrict: projectDetails.LegislativeDistrict ? projectDetails.LegislativeDistrict.toString() : '',
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

  const handleReviseProject = (projectId: string, stageName: string, revisionTypeId: number, revisionTypeDescription: string) => {
    // navigate(`/projects/modify-project/${projectId}:${stageName}`);
    if (!projectId || !stageName || !revisionTypeId || !revisionTypeDescription) {
      alert('Project ID, Stage Name, Revision Type ID or Revision Type Description is missing. Cannot revise project.');
      return;
    }
    if (revisionTypeId === 19 ){
      navigate(`/revision/modification-details/${projectId}:${stageName}`, { state: { stageName, revisionTypeId, revisionTypeDescription } });
    } else {
      navigate(`/revision/${projectId}`, { state: { stageName, revisionTypeId, revisionTypeDescription } });
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
                {mode === 'edit' && initialData?.IsActive === true && initialData?.IsUnlock === true && initialData?.ProgramDetails?.StageId !== 10 && (
                  <>
                    <Button color="red" className='cursor-pointer' onClick={() => handleLock(initialData?.ProjectDetails?.ProjectId ?? '', initialData?.ProgramDetails?.StageName ?? '')} disabled={updateAllProject}>
                      {updateUnlockProject ? 'Unlocking...' : 'UnLock Project'}
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
                {/* {mode === 'edit' && initialData?.ProgramDetails?.StageId === 9 && (
                  <Button color="yellow" className='cursor-pointer' onClick={() => handleReviseProject(initialData?.ProjectDetails?.ProjectId ?? '', initialData?.ProgramDetails?.StageName ?? '')} disabled={updateAllProject}>
                    {reviseProject ? 'Revisioning...' : 'Revise Project'}
                  </Button>
                )} */}
                {mode === 'edit' && initialData?.ProgramDetails?.StageId === 10 && (
                  <Menu as="div" className="relative inline-block text-left">
                    <MenuButton
                      as={Button}
                      color='yellow' 
                      className='cursor-pointer'
                    >
                     {updateAllProject ? 'Revisioning...' : 'Revise Project'}
                      <ChevronDownIcon className="h-4 w-4" />
                    </MenuButton>
                    <MenuItems className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="py-1">
                        {categoryData.filter((revisionType) => revisionType.Obsolete !== true).map((revisionType) => (
                          <MenuItem key={revisionType.Id}>
                            {({ active }) => (
                              <button
                                onClick={() => handleReviseProject(
                                  initialData?.ProjectDetails?.ProjectId ?? '', 
                                  initialData?.ProgramDetails?.StageName ?? '',
                                  revisionType.Id,
                                  revisionType.CodeDescription
                                )}
                                className={`${
                                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                } group flex w-full items-center px-4 py-2 text-sm text-left hover:bg-gray-50`}
                                disabled={updateAllProject}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{revisionType.CodeDescription}</span>
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
            Project Location - Metro Manila
          </h3>
          {isMapOpen ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-500" />
          )}
        </div>
        {isMapOpen && (
          <div className="p-4">
            <MetroManilaMap 
              projectLocation={getProjectLocation()}
              height="400px"
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
    </div>
  );
};

export default ProjectForm;
