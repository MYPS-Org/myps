"use-client";
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { ProgramDetailsEnums } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { editProgram, fetchProgramById, nextStage } from '../Service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
// import { Badge } from '../../../components/tailwindui/badge';

// Mock projects data for the table
const ProgramDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [nextStageName, setNextStageName] = useState<string | null>(null);
  const [programEnums, setProgramEnums] = useState<ProgramDetailsEnums>({
    Details: {
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
    },
    Projects: [],
    Dropdowns: {
      Statuses: [],
      Stages: [],
      Types: [],
      Groups: []
    }
  });
  const [defaultProgramEnums, setDefaultProgramEnums] = useState<ProgramDetailsEnums>({
    Details: {
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
    },
    Projects: [],
    Dropdowns: {
      Statuses: [],
      Stages: [],
      Types: [],
      Groups: []
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProgramDetail = async () => {
      try {
        if (id) {
          await fetchProgramDetail(id);
        }
      } catch (error) {
        console.error('Error fetching program details:', error);
      }
    };

    loadProgramDetail();
  }, [id]);



  const fetchProgramDetail = async (programId: string) => {
    setIsLoading(true);
    try {
      const response = await fetchProgramById(programId);
      setProgramEnums(response.Data);
      setDefaultProgramEnums(response.Data); // Store the original data for comparison

      const nextStageId = response.Data.Details.StageId + 1;
      const nextStage = response.Data.Dropdowns.Stages.find(stage => stage.Id === nextStageId);
      setNextStageName(nextStage ? nextStage.Name : 'Final Stage');
    } catch (error) {
      console.error('Error fetching program details:', error);
      setProgramEnums(defaultProgramEnums);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProject = () => {
        navigate('/projects/addproject');
    };

  // const handleBack = () => {
  //   navigate('/programs');
  // };

  const handleChange = (field: string, value: any) => {
    setProgramEnums(prev => ({
      ...prev,
      Details: {
        ...prev.Details,
        [field]: value
      }
    }));
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      await editProgram(programEnums?.Details);
      console.log('Update program details');
      await fetchProgramDetail(programEnums?.Details.ProgramId);
    } catch (error) {
      console.error('Error updating program details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const preventUpdate = () => {
    // Compare the editable fields between current and default values
    const currentDetails = programEnums?.Details;
    const defaultDetails = defaultProgramEnums?.Details;
    
    if (!currentDetails || !defaultDetails) return true;
    
    // Check if any editable field has changed
    return (
      currentDetails.Name === defaultDetails.Name &&
      currentDetails.YearStart === defaultDetails.YearStart &&
      currentDetails.YearEnd === defaultDetails.YearEnd &&
      currentDetails.Status === defaultDetails.Status &&
      currentDetails.Type === defaultDetails.Type &&
      currentDetails.UserGroup === defaultDetails.UserGroup
    );
  };

  const handleProceed = async () => {
    setIsLoading(true);
    try {
      const nextStageId = programEnums?.Details.StageId + 1;
      console.log('Proceeding to next stage:', nextStageId);
      await nextStage({ ProgramId: programEnums?.Details.ProgramId, Stage: nextStageId });
    } catch (error) {
      console.error('Error proceeding with program details:', error);
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-left mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      {/* <nav className="text-sm text-gray-500 mb-4">
        <span>Program Management</span>
        <span className="mx-2">&gt;</span>
        <span>Programs</span>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-900">Program Details</span>
      </nav> */}

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
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Start Year</label>
                <input
                  type="number"
                  onChange={(e) => handleChange('YearStart', e.target.value)}
                  value={programEnums?.Details.YearStart}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">End Year</label>
                <input
                  type="number"
                  onChange={(e) => handleChange('YearEnd', e.target.value)}
                  value={programEnums?.Details.YearEnd}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Cost</label>
                <input
                  type="number"
                  value={programEnums?.Details.Cost}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center">
                  <select 
                    value={programEnums?.Details.Status}
                    onChange={(e) => handleChange('Status', Number(e.target.value))}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'
                  >
                    {programEnums?.Dropdowns.Statuses.map((status) => (
                      <option key={status.Id} value={status.Id}>
                        {status.Name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Program Stage</label>
                <input type="text" 
                  value={programEnums?.Details.StageName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
                {/* <select name="programStage" id="programStage" className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'>
                  {programEnums?.Dropdowns.Stages.map((stage) => (
                    <option key={stage.Id} value={stage.Id}>
                      {stage.Name}
                    </option>
                  ))}
                </select> */}
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Program Type</label>
                <select 
                  value={programEnums?.Details.Type}
                  onChange={(e) => handleChange('Type', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
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
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">User Group</label>
                <select 
                  value={programEnums?.Details.UserGroup}
                  onChange={(e) => handleChange('UserGroup', Number(e.target.value))}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'>
                  {programEnums?.Dropdowns.Groups.map((group) => (
                    <option key={group.Id} value={group.Id}>
                      {group.GroupName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Created By:</label>
                <input
                  // value={programEnums?.Details.User}
                  value={programEnums?.Details.CreatedBy}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-4">
              {programEnums?.Details.StageId >= 4 && programEnums?.Details.StageId <= 11 && (
                <Button color="blue" className="w-auto" onClick={handleProceed}>
                  Proceed to {nextStageName}
                </Button>
              )}
              <Button 
                color="green" 
                className="w-24" 
                onClick={handleUpdate}
                disabled={preventUpdate() || isLoading}
              >
                Update
              </Button>
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="col-span-2 bg-gray-100 rounded-lg flex items-center justify-center border">
            <div className="text-center text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-300 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm">Map View</p>
              <p className="text-xs text-gray-400">Interactive map would be loaded here</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <Button color="blue" onClick={handleAddProject}>
            Add Project
          </Button>
        </div>
        
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project ID
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origin
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Project Cost
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Legislative District
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operating Unit
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Implementing Office
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DEO
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Region
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agency
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created Date
                </TableHeader>
              </TableRow>
            </TableHead>
            
            <TableBody className="bg-white divide-y divide-gray-200">
              {programEnums.Projects.map((project) => (
                <TableRow key={project.Id} className="hover:bg-gray-50">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">
                      {project.ProjectId}
                    </button>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.Category}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.Description}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.Origin}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.City}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.LegislativeDistrict}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.OperatingUnit}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.ImplementingOffice}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.DEO}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.Region}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.Agency}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.CreatedBy}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.CreatedDate.StringToDate()}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.CreatedDate.StringToDate()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default ProgramDetail;