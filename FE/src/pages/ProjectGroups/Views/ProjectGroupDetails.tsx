"use-client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { ProjectGroupDetailsModel, updateProjectGroupModel, ProjectList } from '../Model.d'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
import { fetchProjectGroupByName, updateProjectGroup  } from '../Service';
import { AddProjectDialog, RemoveProjectsDialog } from '../dialogs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
// import { editProjectGroup, fetchProjectGroupByName } from '../Service';
// import { Badge } from '../../../components/tailwindui/badge';

// Mock projects data for the table
const ProjectGroupDetails: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  // 2026-10-31: Update, Add Projects and Remove only for the groups that manage project groups (access matrix).
  const { can } = useAuth();
  const canUpdateGroup = can('ProjectGroup', 'UpdateProjectGroupDetails');
  const canAddProjects = can('ProjectGroup', 'AddProject');
  const canRemoveProjects = can('ProjectGroup', 'DeleteProject');
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

  // Only the latest load may fill the form. A load that finishes after its effect was cleaned up
  // (another group opened, or StrictMode's second mount in dev) is dropped: applied late, it
  // overwrote whatever had been typed since the first load showed the form.
  useEffect(() => {
    if (!groupId) return;
    let current = true;
    setIsLoading(true);
    fetchProjectGroupByName(groupId)
      .then((response) => {
        if (!current) return;
        setProjectGroupDetails(response.Data);
        setFormData({
          GroupDetails: response.Data.GroupDetails,
          Projects: response.Data.Projects
        });
      })
      .catch((error) => console.error('Error fetching project group details:', error))
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
  }, [groupId]);

  // Reloads only the Projects table after an add/remove. It must not reload the way the page
  // first loads: isLoading swaps the page for the skeleton (unmounting any open dialog), and it
  // would overwrite unsaved Name/Description edits in formData.
  const refreshProjects = async () => {
    if (!groupId) return;
    try {
      const response = await fetchProjectGroupByName(groupId);
      setProjectGroupDetails(prev => ({ ...prev, Projects: response.Data.Projects }));
      setFormData(prev => ({ ...prev, Projects: response.Data.Projects }));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error refreshing projects:', error);
      // The interceptor already toasted any API error that carried a Message.
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to refresh projects. Please try again.' });
      }
    }
  };

  // Set Dialog Open/Close State
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  // Project IDs awaiting the remove confirm; the dialog is open while this is non-null.
  const [removeIds, setRemoveIds] = useState<string[] | null>(null);

  // Row selection for "Remove selected", keyed by ProjectId.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const projects = projectGroupDetails.Projects ?? [];
  // Distinct, because vProjectLatest can return more than one row for a project.
  const projectIds = Array.from(new Set(projects.map((p) => p.ProjectId)));
  const allSelected = projectIds.length > 0 && projectIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, isLoading]);

  const toggleRow = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projectIds));
    }
  };

  // const handleBack = () => {
  //   navigate('/project-groups');
  // };

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
    if (!formData.GroupDetails.Name?.trim()) {
      showToast({ type: 'error', message: 'Project Group Name is required.' });
      return;
    }

    if (formData.GroupDetails.Name.length > 200) {
      showToast({ type: 'error', message: 'Project Group Name cannot exceed 200 characters.' });
      return;
    }

    if ((formData.GroupDetails.Description?.length ?? 0) > 500) {
      showToast({ type: 'error', message: 'Description cannot exceed 500 characters.' });
      return;
    }

    setIsLoading(true);
    try {
      // Only the group's own fields. Membership is saved by Add Projects / Remove, and sending the
      // project rows here made Update fail validation (400) for any group that had projects.
      const response = await updateProjectGroup({ GroupDetails: formData.GroupDetails });
      // The API saves Name and Description trimmed. Show those, and keep the saved copy in step:
      // the dialogs show the saved name.
      const saved = {
        ...formData.GroupDetails,
        Name: formData.GroupDetails.Name.trim(),
        Description: formData.GroupDetails.Description?.trim() ?? '',
      };
      setFormData(prev => ({ ...prev, GroupDetails: saved }));
      setProjectGroupDetails(prev => ({ ...prev, GroupDetails: saved }));
      showToast({ type: 'success', message: response.Data.Message });
    } catch (error) {
      console.error('Error updating program details:', error);
      // httpClient interceptor already showed the API error toast
    } finally {
      setIsLoading(false);
    }
  };

  // Same routes as the Projects list (Project.tsx): the details page needs "ProjectId:StageName",
  // and a bare ProjectId opened "Project Not Available". A Lump Sum Project opens its own page.
  const openProject = (project: ProjectList) => {
    if (project.IsLumpSum) {
      navigate(`/lumpsum/${project.Id}`);
      return;
    }
    if (!project.ProjectId || !project.StageName) {
      showToast({ type: 'info', message: `Project ${project.ProjectId ?? ''} has no stage to open.` });
      return;
    }
    navigate(`/projects/project-details/${encodeURIComponent(project.ProjectId)}:${encodeURIComponent(project.StageName)}`);
  };

  const handleAddClose = (changed: boolean) => {
    setIsAddProjectOpen(false);
    if (changed) refreshProjects();
  };

  const handleRemoveClose = (changed: boolean) => {
    setRemoveIds(null);
    if (changed) refreshProjects();
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
                    maxLength={200}
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
                          maxLength={500}
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

                {canUpdateGroup && (
                <div className="pt-4 text-right">
                <Button color="green" className="w-24" onClick={handleUpdate}>
                    Update
                </Button>
                </div>
                )}
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
                <p className="text-xs text-gray-400">This section is for Future Map Integration </p>
                </div>
            </div>
            </div>
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
            <div className="flex gap-2">
              {canRemoveProjects && (
              <Button
                color="red"
                disabled={selectedIds.size === 0}
                onClick={() => setRemoveIds(Array.from(selectedIds))}
              >
                  Remove selected ({selectedIds.size})
              </Button>
              )}
              {canAddProjects && (
              <Button color="blue" onClick={() => setIsAddProjectOpen(true)}>
                  Add Projects
              </Button>
              )}
            </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableRow>
                      <TableHeader className="px-6 py-3 w-10">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          disabled={projects.length === 0}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          title="Select all"
                          aria-label="Select all projects"
                        />
                      </TableHeader>
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
                      Implementing Office
                      </TableHeader>
                      <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Region
                      </TableHeader>
                      <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created Date
                      </TableHeader>
                      <TableHeader>
                        Actions
                      </TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                {projects.map((project) => (
                    <TableRow key={project.Id} className={selectedIds.has(project.ProjectId) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <TableCell className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(project.ProjectId)}
                            onChange={() => toggleRow(project.ProjectId)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`Select ${project.ProjectId}`}
                          />
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                          <button className="text-blue-600 hover:text-blue-800 font-medium" onClick={() => openProject(project)}>
                            {project.ProjectId}
                          </button>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {project.CategoryName || project.Category}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {project.Description}
                      </TableCell>
                      <TableCell>
                          {project.ImplementingOffice}
                      </TableCell>
                      <TableCell>
                          {project.Region}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {project.CreatedDate ? project.CreatedDate.StringToDate() : ''}
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {canRemoveProjects && (
                          <Button onClick={() => setRemoveIds([project.ProjectId])} color="red" className="px-2 py-1" aria-label={`Remove ${project.ProjectId}`}>
                            <TrashIcon />
                          </Button>
                          )}
                      </TableCell>
                    </TableRow>
                ))}
                </TableBody>
              </Table>
            </div>
        </div>

        {/* Add Projects Dialog */}
        <AddProjectDialog
          isOpen={isAddProjectOpen}
          onClose={handleAddClose}
          groupId={projectGroupDetails.GroupDetails.GroupId}
          groupName={projectGroupDetails.GroupDetails.Name}
        />
        {/* Remove Projects Dialog */}
        <RemoveProjectsDialog
          projectIds={removeIds}
          onClose={handleRemoveClose}
          groupId={projectGroupDetails.GroupDetails.GroupId}
          groupName={projectGroupDetails.GroupDetails.Name}
        />
      </div>
  );
}

export default ProjectGroupDetails;