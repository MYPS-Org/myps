import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { MagnifyingGlassIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { fetchProjectById } from '../Service';
import type { ProjectList } from '../Model.d';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';

interface AddProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projects: ProjectList[]) => void;
}

const AddProjectDialog: React.FC<AddProjectDialogProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProjectList | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<ProjectList[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Development mode flag - set to true to use mock data
//   const isDevelopmentMode = true;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSearchResults(null);
      setSelectedProjects([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Search for projects
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const response = await fetchProjectById(searchTerm);
      // API returns a single project object for exact ProjectId search
      setSearchResults(response.Data);
    } catch (error) {
      console.error('Error searching projects:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    //   if (!isDevelopmentMode) {
    //     setIsSearching(false);
    //   }
    }
  };

  // Handle search on Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Add project to selected list
  const handleAddProject = (project: ProjectList) => {
    // Check if project is already selected
    if (!selectedProjects.find(p => p.Id === project.Id)) {
      setSelectedProjects(prev => [...prev, project]);
    }
  };

  // Remove project from selected list
  const handleRemoveProject = (projectId: string | undefined) => {
    if (projectId) {
      setSelectedProjects(prev => prev.filter(p => p.ProjectId !== projectId));
    }
  };

  // Handle final submission
  const handleSubmit = async () => {
    if (selectedProjects.length > 0) {
      try {
        // Note: updateProjectDetails expects different format, 
        // so we'll let the parent component handle the API call
        onSubmit(selectedProjects);
        onClose();
      } catch (error) {
        console.error('Error submitting projects:', error);
      }
    }
  };

  // Reset form
  const handleReset = () => {
    setSearchTerm('');
    setSearchResults(null);
    setSelectedProjects([]);
    setHasSearched(false);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Add Projects to Group
              </DialogTitle>
              {/* {isDevelopmentMode && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Demo Mode
                </span>
              )} */}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Search Section */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search projects by ID or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <Button
                  color="blue"
                  onClick={handleSearch}
                  disabled={!searchTerm.trim() || isSearching}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            {/* Search Results */}
            {hasSearched && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">
                  Search Results ({searchResults ? '1' : '0'} found)
                </h3>
                
                {searchResults ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Project ID
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Name/Description
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stage
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr key={searchResults.Id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                              {searchResults.ProjectId}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div>
                                <div className="font-medium">{searchResults.Description || 'N/A'}</div>
                                <div className="text-gray-500 text-xs truncate max-w-xs">
                                  {searchResults.ProgramName}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              N/A
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Button
                                color="green"
                                onClick={() => handleAddProject(searchResults)}
                                disabled={selectedProjects.some(p => p.Id === searchResults.Id)}
                              >
                                <PlusIcon className="w-4 h-4 mr-1" />
                                {selectedProjects.some(p => p.Id === searchResults.Id) ? 'Added' : 'Add'}
                              </Button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MagnifyingGlassIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No projects found matching your search.</p>
                  </div>
                )}
              </div>
            )}

            {/* Selected Projects */}
            {selectedProjects.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">
                  Selected Projects ({selectedProjects.length})
                </h3>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Project
                                </TableHeader>
                                <TableHeader className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                </TableHeader>
                                <TableHeader className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Details
                                </TableHeader>
                                <TableHeader className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Action
                                </TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {selectedProjects.map((project) => (
                                <TableRow key={project.Id} className="hover:bg-gray-50">
                                    <TableCell className="px-4 py-3 text-sm font-medium text-blue-600">
                                        {project.ProjectId}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-gray-900">
                                        <div className="truncate max-w-xs">
                                            {project.Description || 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-gray-900">
                                        {project.Description || 'N/A'}
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm">
                                        <Button
                                            color="red"
                                            onClick={() => handleRemoveProject(project.ProjectId)}
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <Button
                color="zinc"
                onClick={handleReset}
                disabled={!hasSearched && selectedProjects.length === 0}
              >
                Reset
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                color="zinc"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={handleSubmit}
                disabled={selectedProjects.length === 0}
              >
                Add {selectedProjects.length} Project{selectedProjects.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddProjectDialog;
