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
  mode?: 'add' | 'edit';
}

const ProjectForm: React.FC<ProjectFormProps> = ({ initialData, onSubmit, mode = 'add' }) => {

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  
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

  const handleAddComponentCost = () => {
    const newCost: ComponentCost = {
      Id: `CC${componentCosts.length + 1}`,
      Description: '',
      Cost2025: 0,
      Cost2026: 0,
      MYCAApproval: '',
      UACsPAPCode: '',
      PlannedStartDate: ''
    };
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
        <ProgramDetailsForm 
          programDetails={programDetails}
          setProgramDetails={setProgramDetails}
          onChange={setProgramDetails}
          mode={mode}
        />

        {/* Project Details */}
        <ProjectDetailsForm
          projectDetails={projectDetails}
          onChange={handleProjectDetailsChange}
          mode={mode}
        />
      </div>

      {/* Component Cost Section */}
      <ComponentCostForm
        componentCosts={componentCosts}
        onAdd={handleAddComponentCost}
        onEdit={handleEditComponentCost}
        onDelete={handleDeleteComponentCost}
      />

      {/* Major Item of Work Section */}
      <MajorItemOfWorksForm
        majorItems={majorItems}
        componentCosts={componentCosts}
        onAdd={handleAddMajorItem}
        onEdit={handleEditMajorItem}
        onDelete={handleDeleteMajorItem}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes Section */}
        <NotesForm
          notes={notes}
          onAdd={handleAddNote}
          onEdit={handleEditNote}
          onDelete={handleDeleteNote}
        />

        {/* Funding Profile Section */}
        <FundingProfileForm
          fundingProfiles={fundingProfiles}
          onAdd={handleAddFundingProfile}
          onEdit={handleEditFundingProfile}
          onDelete={handleDeleteFundingProfile}
        />
      </div>

      {/* Activities Section */}
      <ActivitySection activities={activities} />
    </div>
  );
};

export default ProjectForm;
