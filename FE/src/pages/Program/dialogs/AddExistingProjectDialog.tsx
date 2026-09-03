import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { FolderPlusIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";
import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/tailwindui/table";
import { fetchProject } from "../../Project/Service";
import type { ProjectLists } from "../../Project/Model.d";

interface AddExistingProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectIds: string[]) => void;
  programId: string;
  programName: string;
}

const AddExistingProjectDialog: React.FC<AddExistingProjectDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  programId,
  programName,
}) => {
  const [projects, setProjects] = useState<ProjectLists[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectLists[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchProject({
        page: 1,
        limit: 500,
        Filters: {},
      });
      // Exclude projects already belonging to this program
      const available = (response.Data?.lists || []).filter(
        (p: ProjectLists) => p.ProgramId !== programId
      );
      setProjects(available);
      setFilteredProjects(available);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchTerm('');
      setError('');
      loadProjects();
    }
  }, [isOpen, loadProjects]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (!term) {
      setFilteredProjects(projects);
    } else {
      setFilteredProjects(
        projects.filter(
          (p) =>
            p.ProjectId.toLowerCase().includes(term) ||
            p.Description?.toLowerCase().includes(term) ||
            p.ImplementingOffice?.toLowerCase().includes(term) ||
            p.OperatingUnit?.toLowerCase().includes(term) ||
            p.Category?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, projects]);

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
    if (selectedIds.size === filteredProjects.length && filteredProjects.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map((p) => p.ProjectId)));
    }
  };

  const handleSubmit = () => {
    if (selectedIds.size === 0) {
      setError('Please select at least one project before submitting.');
      return;
    }
    setError('');
    onSubmit(Array.from(selectedIds));
    handleClose();
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchTerm('');
    setError('');
    setProjects([]);
    setFilteredProjects([]);
    onClose();
  };

  const allVisibleSelected =
    filteredProjects.length > 0 && selectedIds.size === filteredProjects.length;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-5xl rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-gray-200">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <FolderPlusIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Add Existing Project
              </DialogTitle>
              <p className="mt-1 text-sm text-gray-600">
                Select projects to add to <span className="font-medium text-gray-800">{programName}</span>.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-6 py-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Project ID, description, office..."
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Selection summary */}
          {selectedIds.size > 0 && (
            <div className="px-6 py-2 bg-blue-50 text-sm text-blue-700 border-b border-blue-100 flex items-center justify-between">
              <span>
                <span className="font-semibold">{selectedIds.size}</span> project{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-blue-500 hover:text-blue-700 underline text-xs"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse space-y-2 w-full px-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded" />
                  ))}
                </div>
              </div>
            ) : (
              <Table className="min-w-full">
                <TableHead>
                  <TableRow>
                    <TableHeader className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        title="Select all"
                      />
                    </TableHeader>
                    <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project ID
                    </TableHeader>
                    <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </TableHeader>
                    <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </TableHeader>
                    <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Implementing Office
                    </TableHeader>
                    <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operating Unit
                    </TableHeader>
                    <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stage
                    </TableHeader>
                  </TableRow>
                </TableHead>

                <TableBody className="bg-white divide-y divide-gray-200">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => {
                      const isSelected = selectedIds.has(project.ProjectId);
                      return (
                        <TableRow
                          key={project.Id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => toggleRow(project.ProjectId)}
                        >
                          <TableCell className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(project.ProjectId)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                            {project.ProjectId}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-900 truncate max-w-56">
                            {project.Description}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-600 truncate max-w-40">
                            {project.Category || '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-600 truncate max-w-40">
                            {project.ImplementingOffice || '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-600 truncate max-w-40">
                            {project.OperatingUnit || '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {project.StageName}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                        {searchTerm
                          ? 'No projects match your search.'
                          : 'No available projects found.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 space-y-3">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex items-center justify-between">
              {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
              <span className="text-xs text-gray-500">
                Showing {filteredProjects.length} of {projects.length} available projects
              </span>
              */}
              <div className="flex gap-3">
                <Button color="zinc" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  color="blue"
                  onClick={handleSubmit}
                  disabled={selectedIds.size === 0}
                >
                  Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}Project{selectedIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddExistingProjectDialog;
