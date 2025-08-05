"use-client";
import React, { useState, useEffect } from 'react';
import { useParams, /*useNavigate*/ } from 'react-router-dom';

import type { ProjectGroupDetailsModel, updateProjectGroupModel, ProjectList } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { fetchProjectGroupByName, updateProjectGroup  } from '../Service';
import AddProjectDialog from '../dialogs/AddProject';
// import { editProjectGroup, fetchProjectGroupByName } from '../Service';
// import { Badge } from '../../../components/tailwindui/badge';

// Mock projects data for the table
const ProjectGroupDetails: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  // const navigate = useNavigate();
  const [projectGroupDetails, setProjectGroupDetails] = useState<ProjectGroupDetailsModel>({
    GroupDetails: {
        Id: 0,
        GroupId: '',
        Name: '',
        Description: '',
        UserGroup: 0,
        UserGroupName: '',
        CreatedBy: '',
        CreatedDate: ''
    },
    Projects: [],
    UserGroups: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState<updateProjectGroupModel>({
    GroupDetails: {
      Id: 0,
      GroupId: '',
      Name: '',
      Description: '',
      UserGroup: 0,
      UserGroupName: '',
      CreatedBy: '',
      CreatedDate: ''
    },
    Projects: []
  });

  useEffect(() => {
    const loadProjectGroupDetails = async () => {
      try {
        if (groupId) {
          await fetchProjectGroupDetails(groupId);
          console.log('Project group details loaded:', groupId);
        }
      } catch (error) {
        console.error('Error fetching project group details:', error);
      }
    };
    loadProjectGroupDetails();
  }, [groupId]);

  const fetchProjectGroupDetails = async (groupId: string) => {
    setIsLoading(true);
    try {
      const response = await fetchProjectGroupByName(groupId);
      setProjectGroupDetails(response.Data);
      setFormData({
        GroupDetails: response.Data.GroupDetails,
        Projects: response.Data.Projects
      });
    } catch (error) {
      console.error('Error fetching program details:', error);
    //   setProgramEnums(defaultProgramEnums);
    } finally {
      setIsLoading(false);
    }
  };

  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);

  // const handleBack = () => {
  //   navigate('/project-groups');
  // };

  const handleReset = () => {
    setFormData({
      GroupDetails: {
        Id: 0,
        GroupId: '',
        Name: '',
        Description: '',
        UserGroup: 0,
        UserGroupName: '',
        CreatedBy: '',
        CreatedDate: ''
      },
      Projects: []
    });
  };

  const handleChange = (field: keyof ProjectGroupDetailsModel['GroupDetails'], value: any) => {
    setFormData(prev => ({
      ...prev,
      GroupDetails: {
        ...prev.GroupDetails,
        [field]: value
      }
    }));
  };

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      // await editProgram(programEnums?.Details);
      console.log('Update program details');
      await updateProjectGroup(formData);
      // handleReset();
    } catch (error) {
      console.error('Error updating program details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = async () => {
    setIsAddProjectOpen(true);
    // Logic to open the dialog for adding a new project
    // This could involve setting state or navigating to a different route
  }

  const handleCloseDialog = () => {
    setIsAddProjectOpen(false);
  }

  const handleAddProjects = async (projects: ProjectList[]) => {
    try {
      // Add projects to the current group's project list
      const updatedProjects = [...formData.Projects, ...projects];
      
      // Update the form data
      setFormData(prev => ({
        ...prev,
        Projects: updatedProjects
      }));

      // Update the display data
      setProjectGroupDetails(prev => ({
        ...prev,
        Projects: updatedProjects
      }));

      // Optionally save to backend immediately
      // await updateProjectGroup(formData);
      
      console.log('Added projects:', projects);
    } catch (error) {
      console.error('Error adding projects:', error);
    }
  }

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left Column - Form Fields */}
            
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-left text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                    type="text"
                    onChange={(e) => handleChange('Name', e.target.value)}
                    value={formData?.GroupDetails?.Name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                    />
                </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                      <label className="block text-left text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea name="" id=""
                          onChange={(e) => handleChange('Description', e.target.value)}
                          value={formData?.GroupDetails?.Description}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                      ></textarea>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                      <label className="block text-left text-sm font-medium text-gray-700 mb-1">User Group</label>
                      <select
                      value={formData?.GroupDetails?.UserGroup}
                      onChange={(e) => handleChange('UserGroup', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                      >
                      <option value="">Select User Group</option>
                      {/* Map through user groups and create an option for each */}
                      {projectGroupDetails?.UserGroups?.map((group) => (
                          <option key={group.Id} value={group.Id}>
                          {group.GroupName}
                          </option>
                      ))}
                      </select>
                  </div>
                </div>

                <div className="pt-4 text-right">
                <Button color="green" className="w-24" onClick={handleUpdate}>
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
            <Button color="blue" onClick={handleOpenDialog}>
                Add Project
            </Button>
            </div>
            
            <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Origin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Legislative District
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operating Unit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Implementing Office
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DEO
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                    </th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {projectGroupDetails.Projects?.map((project) => (
                    <tr key={project.Id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                        {project.Id}
                        </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.ProjectId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.Description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project.CreatedDate ? project.CreatedDate.StringToDate() : ''}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>

        {/* Add Project Dialog */}
        <AddProjectDialog
          isOpen={isAddProjectOpen}
          onClose={handleCloseDialog}
          onSubmit={handleAddProjects}
        />
      </div>
  );
}

export default ProjectGroupDetails;