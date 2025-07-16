import React, { useEffect, useState } from 'react';
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
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon
} from '@heroicons/react/24/outline';
import Program from '../../Program/Views/Program';

//Sub-components
import ProgramDetailsForm from './ProgramDetailsForm';
// import ProgramDetail from '../../Program/Views/ProgramDetail';
// import { initProgramDetails } from '../Service';

interface ProjectDetailsProps {
  ProjectFormPayload?: ProjectFormPayload;
  onSubmit: (payLoad: ProjectFormPayload) => void;
  mode?: 'add' | 'edit';
}

const ProjectForm: React.FC<ProjectDetailsProps> = ({ ProjectFormPayload, onSubmit, mode }) => {

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };

  const handleGoBack = () => {
    navigate('/projects');
  };

  const handleSubmit = async (allFormData: ProjectFormPayload) => {
    setIsLoading(true);
    try {
      await onSubmit(allFormData);
      navigate('/projects');
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const [programDetails, setProgramDetails] = useState<ProgramDetails>({
    ProgramName: '',
    ProgramType: '',
    StartYear: new Date().getFullYear(),
    ProgramStage: '',
    UserGroup: '',
    DataSecurity: 0,
  });


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
                <span>Ongoing</span>
                <span className="mx-2">&gt;</span>
            </nav>
            <div className="flex space-x-3">
                <Button color="red">Delete Project</Button>
                <Button color="blue">Save Changes</Button>
            </div>
        </div>

      {/* Map Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="h-64 bg-blue-100 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 text-lg">Map View - {}</div>
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
      </div>

      {/* Component Cost Section */}

      {/* Major Item of Work Section */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes Section */}

        {/* Funding Profile Section */}
      </div>

      {/* Activities Section */}
    </div>
  );
};

export default ProjectForm;
