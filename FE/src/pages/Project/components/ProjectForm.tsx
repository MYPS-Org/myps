import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { 
  ProjectDetails, 
  ComponentCost, 
  MajorItemOfWork, 
  ProjectNote, 
  FundingProfile, 
  Activity, 
  ProgramDetails,
  ProjectFormPayload
} from '../Model';

import { Button } from '../../../components/tailwindui/button';

//Sub-components
import ProgramDetailsForm from './ProgramDetailsForm';
import ProjectDetailsForm from './ProjectDetailsForm';
import ComponentCostForm from './ComponentCostForm';
import MajorItemOfWorksForm from './MajorItemOfWorksForm';
import NotesForm from './NotesForm';
import FundingProfileForm from './FundingProfileForm';
import ActivitySection from './ActivitySection';

interface ProjectFormProps {
  initialData?: ProjectFormPayload;
  onSubmit: (payLoad: ProjectFormPayload) => void;
  onSaveSection?: (sectionName: string, data: any) => Promise<void>;
  mode?: 'add' | 'edit';
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, onSubmit, onSaveSection, mode = 'add' }) => {

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  
  // Initialize state with empty data or provided initial data
  const [programDetails, setProgramDetails] = useState<ProgramDetails>(
    initialData?.projectDetails ? {
      ProgramName: '',  // This will be populated by ProgramDetailsForm
      ProgramType: '',
      StartYear: new Date().getFullYear(),
      ProgramStage: '',
      UserGroup: '',
      DataSecurity: 0,
    } : {
      ProgramName: '',
      ProgramType: '',
      StartYear: new Date().getFullYear(),
      ProgramStage: '',
      UserGroup: '',
      DataSecurity: 0,
    }
  );

  const [projectDetails, setProjectDetails] = useState<ProjectDetails>(
    initialData?.projectDetails || {
      Id: '',
      ProjectName: '',
      CityMunicipality: '',
      ReportingRegion: '',
      Description: '',
      LegislativeDistrict: '',
      OriginatingRegion: '',
      OperatingUnit: '',
      AlternativeProjCode: '',
      Category: '',
      ImplementingOffice: '',
      ImplementationCode: '',
      Thrust: '',
      DistrictEngOffice: '',
      EmergencyCode: '',
      Origin: '',
      CreatedBy: '',
      CreatedDate: new Date().toISOString().split('T')[0],
      FeasibilityStudy: false,
      DetailedDesign: false,
      RowAvailable: false
    }
  );

  const [componentCosts, setComponentCosts] = useState<ComponentCost[]>(
    initialData?.componentCosts || []
  );

  const [majorItems, setMajorItems] = useState<MajorItemOfWork[]>(
    initialData?.majorItemsOfWork || []
  );

  const [notes, setNotes] = useState<ProjectNote[]>(
    initialData?.projectNotes || []
  );

  const [fundingProfiles, setFundingProfiles] = useState<FundingProfile[]>(
    initialData?.fundingProfiles || []
  );

  const [activities] = useState<Activity[]>(
    initialData?.activities || []
  );

  const handleGoBack = () => {
    navigate('/projects');
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const formData: ProjectFormPayload = {
        projectDetails,
        componentCosts,
        majorItemsOfWork: majorItems,
        projectNotes: notes,
        fundingProfiles,
        activities
      };
      
      await onSubmit(formData);
      navigate('/projects');
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectDetailsChange = (field: keyof ProjectDetails, value: any) => {
    setProjectDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleAddComponentCost = (newCost: ComponentCost) => {
    setComponentCosts(prev => [...prev, newCost]);
  };

  const handleEditComponentCost = (index: number, updatedCost: ComponentCost) => {
    setComponentCosts(prev => prev.map((cost, i) => i === index ? updatedCost : cost));
  };

  const handleDeleteComponentCost = (index: number) => {
    setComponentCosts(prev => prev.filter((_, i) => i !== index));
  };

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
    await handleSaveSection('projectDetails', projectDetails);
  };

  const handleSaveComponentCosts = async () => {
    await handleSaveSection('componentCosts', componentCosts);
  };

  const handleSaveMajorItems = async () => {
    await handleSaveSection('majorItemsOfWork', majorItems);
  };

  const handleSaveNotes = async () => {
    await handleSaveSection('projectNotes', notes);
  };

  const handleSaveFundingProfiles = async () => {
    await handleSaveSection('fundingProfiles', fundingProfiles);
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
                <Button 
                  color="blue" 
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : (mode === 'add' ? 'Create Project' : 'Save Changes')}
                </Button>
            </div>
        </div>

      {/* Map Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="h-64 bg-blue-100 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 text-lg">Map View - {projectDetails.ProjectName || 'New Project'}</div>
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
              onChange={setProgramDetails}
              mode={mode}
            />
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold leading-7 text-gray-900">Project Details</h3>
              <Button
                outline
                onClick={handleSaveProjectDetails}
                disabled={savingSection === 'projectDetails'}
                className="text-sm"
              >
                {savingSection === 'projectDetails' ? 'Saving...' : 'Save Section'}
              </Button>
            </div>
            <ProjectDetailsForm
              projectDetails={projectDetails}
              onChange={handleProjectDetailsChange}
              mode={mode}
            />
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
