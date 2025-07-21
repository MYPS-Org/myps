import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { 
  ProjectDetails, 
  ComponentCost, 
  MajorItemOfWork, 
  ProjectNote, 
  FundingProfile, 
  Activity, 
  ProgramDetails,
  ProjectFormPayload,
  ProjectEnums
} from '../Model.d';

import { Button } from '../../../components/tailwindui/button';

//Sub-components
import ProgramDetailsForm from './ProgramDetailsForm';
import ProjectDetailsForm from './ProjectDetailsForm';
import ComponentCostForm from './ComponentCostForm';
import MajorItemOfWorksForm from './MajorItemOfWorksForm';
import NotesForm from './NotesForm';
import FundingProfileForm from './FundingProfileForm';
import ActivitySection from './ActivitySection';
import { addProjectDetails, getProjectEnums } from '../Service';

interface ProjectFormProps {
  initialData?: ProjectFormPayload;
  onSaveSection?: (sectionName: string, data: any) => Promise<void>;
  mode?: 'add' | 'edit';
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, onSaveSection, mode = 'add' }) => {

  const navigate = useNavigate();

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
  
  // Initialize state with empty data or provided initial data
  const [programDetails, setProgramDetails] = useState<ProgramDetails>({
    Id: 0,
    ProgramId: '',
    RevisionNumber: 0,
    Name: '',
    StageId: 0,
    StageName: '',
    UserGroup: 0,
    RegionCode: '',
    Status: 0,
    Type: 0,
    Cost: 0,
    YearStart: 0,
    YearEnd: 0,
    CreatedBy: '',
    CreatedDate: '',
    UpdatedBy: '',
    UpdatedDate: '',
  });

  const [projectDetails, setProjectDetails] = useState<ProjectDetails>(
    initialData?.ProjectDetails || {
      Id: 0,
      ProgramId: '',
      ReferenceId: '',
      RevisionNumber: 0,
      Description: '',
      Category: 0,
      Thrust: 0,
      Origin: 0,
      City: 0,
      LegislativeDistrict: 0,
      OperatingUnit: '',
      ImplementingOffice: '',
      DEO: '',
      Region: '',
      Agency: 0,
      ProjectCode: '',
      ImplementationMode: 0,
      EmergencyMode: false,
      Feasibility: 0,
      DetailedDesign: false,
      RowAvailable: false,
    }
  );

  const [componentCosts, setComponentCosts] = useState<ComponentCost[]>(
    initialData?.ComponentCosts || []
  );

  const [majorItems, setMajorItems] = useState<MajorItemOfWork[]>(
    initialData?.MajorItemOfWorks || []
  );

  const [notes, setNotes] = useState<ProjectNote[]>(
    initialData?.ProjectNotes || []
  );

  const [fundingProfiles, setFundingProfiles] = useState<FundingProfile[]>(
    initialData?.FundingProfile || []
  );

  const [activities] = useState<Activity[]>(
    initialData?.Activities || []
  );

  // Load project enums on component mount
  useEffect(() => {
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
  }, []);

  const handleGoBack = () => {
    navigate('/projects');
  };

  const handleProjectDetailsChange = (field: keyof ProjectDetails, value: any) => {
    setProjectDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleProgramDetailsChange = (updatedProgramDetails: ProgramDetails) => {
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
  const handleAddComponentCost = (newCost: ComponentCost) => {
    setComponentCosts(prev => [...prev, newCost]);
  };

  const handleEditComponentCost = (index: number, updatedCost: ComponentCost) => {
    setComponentCosts(prev => prev.map((cost, i) => i === index ? updatedCost : cost));
  };

  const handleDeleteComponentCost = (index: number) => {
    setComponentCosts(prev => prev.filter((_, i) => i !== index));
  };
  // #endregion

  // #region Major Items of Work
  const handleAddMajorItem = () => {
    const newItem: MajorItemOfWork = {
      Id: `MW${majorItems.length + 1}`,
      ComponentId: '',
      YearOfWork: new Date().getFullYear(),
      TypeOfWork: '',
      TargetUnit: '',
      PhysicalTarget: '',
      DetailedScopeOfWork: '',
      InfraId: ''
    };
    setMajorItems(prev => [...prev, newItem]);
  };

  const handleEditMajorItem = (index: number, updatedItem: MajorItemOfWork) => {
    setMajorItems(prev => prev.map((item, i) => i === index ? updatedItem : item));
  };

  const handleDeleteMajorItem = (index: number) => {
    setMajorItems(prev => prev.filter((_, i) => i !== index));
  };
// #endregion

// #region Notes
  const handleAddNote = () => {
    const newNote: ProjectNote = {
      Id: `N${notes.length + 1}`,
      Description: '',
      CreatedDate: new Date().toISOString().split('T')[0]
    };
    setNotes(prev => [...prev, newNote]);
  };

  const handleEditNote = (index: number, updatedNote: ProjectNote) => {
    setNotes(prev => prev.map((note, i) => i === index ? updatedNote : note));
  };

  const handleDeleteNote = (index: number) => {
    setNotes(prev => prev.filter((_, i) => i !== index));
  };
// #endregion

// #region Funding Profiles
  const handleAddFundingProfile = () => {
    const newProfile: FundingProfile = {
      Id: `FP${fundingProfiles.length + 1}`,
      Source: '',
      Agreement: '',
      Percentage: 0
    };
    setFundingProfiles(prev => [...prev, newProfile]);
  };

  const handleEditFundingProfile = (index: number, updatedProfile: FundingProfile) => {
    setFundingProfiles(prev => prev.map((profile, i) => i === index ? updatedProfile : profile));
  };

  const handleDeleteFundingProfile = (index: number) => {
    setFundingProfiles(prev => prev.filter((_, i) => i !== index));
  };
// #endregion

  // Individual section save handlers
  const handleSaveSection = async (sectionName: string, data: any) => {
    if (!onSaveSection) return;
    
    setSavingSection(sectionName);
    try {
      await onSaveSection(sectionName, data);
      console.log(`${sectionName} saved successfully`);
    } catch (error) {
      console.error(`Error saving ${sectionName}:`, error);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveProgramDetails = async () => {
    await handleSaveSection('programDetails', programDetails);
  };

  const handleSaveProjectDetails = async () => {
    setSavingSection('projectDetails');
    projectDetails.EmergencyMode = projectDetails.EmergencyMode ? true : false;
    try {
      console.log('Saving project details:', projectDetails);
      // Call your addProjectDetails service
      const response = await addProjectDetails(projectDetails);
      // Update projectDetails state with the returned data
      if (response.Data.ProjectId) {
        navigate(`/projects/Edit/${response.Data.ProjectId}`);
      }
    } catch (error) {
      console.error('Error saving project details:', error);
    } finally {
      setSavingSection(null);
    }
  };
  

  const handleSaveComponentCosts = async () => {
    setSavingSection('componentCosts');
    try {
      await handleSaveSection('componentCosts', componentCosts);
    } catch (error) {
      console.error('Error saving component costs:', error);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveMajorItems = async () => {
    setSavingSection('majorItemsOfWork');
    try {
      // Call your save service for major items if needed
      await handleSaveSection('majorItemsOfWork', majorItems);
      // setMajorItems(response.Data[]);
    } catch (error) {
      console.error('Error saving major items of work:', error);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveNotes = async () => {
    setSavingSection('projectNotes');
    try {
      // Call your save service for notes if needed
      await handleSaveSection('projectNotes', notes);
      // Optionally set a state like setIsNotesSaved(true);
    } catch (error) {
      console.error('Error saving project notes:', error);
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveFundingProfiles = async () => {
    setSavingSection('fundingProfiles');
    try {
      // Call your save service for funding profiles if needed
      await handleSaveSection('fundingProfiles', fundingProfiles);
      // Optionally set a state like setIsFundingProfilesSaved(true);
    } catch (error) {
      console.error('Error saving funding profiles:', error);
    } finally {
      setSavingSection(null);
    }
  };

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
        <div className='flex items-center justify-between mb-6'>
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-left text-gray-500">
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
            </nav>
            <div className="flex space-x-3">
                {mode === 'edit' && <Button color="red">Delete Project</Button>}
            </div>
        </div>

      {/* Map Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="h-64 bg-blue-100 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 text-lg">Map View - {projectDetails.ReferenceId || 'New Project'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Program Details */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Program Details</h3>
              <Button
                outline
                onClick={handleSaveProgramDetails}
                disabled={savingSection === 'programDetails'}
                className="text-sm"
              >
                {savingSection === 'programDetails' ? 'Saving...' : 'Save Section'}
              </Button>
            </div>
            <ProgramDetailsForm 
              programDetails={programDetails}
              setProgramDetails={setProgramDetails}
              onChange={handleProgramDetailsChange}
              mode={mode}
              projectEnums={projectEnums || undefined}
            />
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Project Details</h3>
            </div>
            <ProjectDetailsForm
              projectDetails={projectDetails}
              onChange={handleProjectDetailsChange}
              mode={mode}
              projectEnums={projectEnums || undefined} // Ensure projectEnums is not undefined
            />
          </div>
          <div className="flex justify-end px-4 py-6 sm:p-8">
            <Button
              color='orange'
              onClick={handleSaveProjectDetails}
              disabled={savingSection === 'projectDetails'}
              className="text-sm"
            >
              {savingSection === 'projectDetails' ? 'Saving...' : 'Save Section'}
            </Button>
          </div>
        </div>
      </div>

      {/* Component Cost Section - Fill this first to populate Major Items */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:p-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Component Costs</h3>
              <p className="text-sm text-blue-600 font-medium">⚠️ Add component costs first - they are required for Major Items of Work</p>
            </div>
            <Button
              outline
              onClick={handleSaveComponentCosts}
              disabled={savingSection === 'componentCosts'}
              className="text-sm"
            >
              {savingSection === 'componentCosts' ? 'Saving...' : 'Save Section'}
            </Button>
          </div>
          <ComponentCostForm
            componentCosts={componentCosts}
            onAdd={handleAddComponentCost}
            onEdit={handleEditComponentCost}
            onDelete={handleDeleteComponentCost}
          />
        </div>
      </div>

      {/* Major Item of Work Section */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="px-4 py-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold leading-7 text-gray-900">Major Items of Work</h3>
            <Button
              outline
              onClick={handleSaveMajorItems}
              disabled={savingSection === 'majorItemsOfWork'}
              className="text-sm"
            >
              {savingSection === 'majorItemsOfWork' ? 'Saving...' : 'Save Section'}
            </Button>
          </div>
          <MajorItemOfWorksForm
            majorItems={majorItems}
            componentCosts={componentCosts}
            onAdd={handleAddMajorItem}
            onEdit={handleEditMajorItem}
            onDelete={handleDeleteMajorItem}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes Section */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Project Notes</h3>
              <Button
                outline
                onClick={handleSaveNotes}
                disabled={savingSection === 'projectNotes'}
                className="text-sm"
              >
                {savingSection === 'projectNotes' ? 'Saving...' : 'Save Section'}
              </Button>
            </div>
            <NotesForm
              notes={notes}
              onAdd={handleAddNote}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
            />
          </div>
        </div>

        {/* Funding Profile Section */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Funding Profiles</h3>
              <Button
                outline
                onClick={handleSaveFundingProfiles}
                disabled={savingSection === 'fundingProfiles'}
                className="text-sm"
              >
                {savingSection === 'fundingProfiles' ? 'Saving...' : 'Save Section'}
              </Button>
            </div>
            <FundingProfileForm
              fundingProfiles={fundingProfiles}
              onAdd={handleAddFundingProfile}
              onEdit={handleEditFundingProfile}
              onDelete={handleDeleteFundingProfile}
            />
          </div>
        </div>
      </div>

      {/* Activities Section */}
      <ActivitySection activities={activities} />
    </div>
  );
};

export default ProjectForm;
