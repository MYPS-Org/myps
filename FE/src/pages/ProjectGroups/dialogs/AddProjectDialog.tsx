import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { addProjectToGroup } from '../Service';
import type { AddProjectsToGroupResult } from '../Model.d';
import IdChipGroup from '../components/IdChipGroup';

// Same cap as ProjectGroupController.MaxProjectsPerAdd.
const MAX_PROJECTS_PER_ADD = 500;

/** Splits pasted text on commas, semicolons and whitespace, dropping empties and case-insensitive duplicates (first spelling wins). */
const parseProjectIds = (text: string): string[] => {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of text.split(/[,;\s]+/)) {
    const id = part.trim();
    if (id && !seen.has(id.toLowerCase())) {
      seen.add(id.toLowerCase());
      ids.push(id);
    }
  }
  return ids;
};

interface AddProjectDialogProps {
  isOpen: boolean;
  groupId: string;
  groupName: string;
  /** `changed` is true when at least one project was added while the dialog was open. */
  onClose: (changed: boolean) => void;
}

const AddProjectDialog: React.FC<AddProjectDialogProps> = ({ isOpen, groupId, groupName, onClose }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AddProjectsToGroupResult | null>(null);
  const [changed, setChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setError('');
      setResult(null);
      setChanged(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const projectIds = useMemo(() => parseProjectIds(text), [text]);

  const handleClose = () => {
    // Closing mid-request would lose `changed` and skip the table refresh.
    if (isSubmitting) return;
    onClose(changed);
  };

  const handleSubmit = async () => {
    if (projectIds.length === 0) {
      setError('Please enter at least one Project ID.');
      return;
    }
    if (projectIds.length > MAX_PROJECTS_PER_ADD) {
      setError(`You can add at most ${MAX_PROJECTS_PER_ADD} projects at a time.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await addProjectToGroup({ GroupId: groupId, ProjectId: projectIds });
      setResult(response.Data);
      if (response.Data.AddedProjectIds.length > 0) setChanged(true);
    } catch (err) {
      console.error('Error adding projects to group:', err);
      // The interceptor already toasted any API error that carried a Message.
      if (!(err as { Message?: string } | undefined)?.Message) {
        setError('Could not add projects. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMore = () => {
    setText('');
    setError('');
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Add Projects to Group
            </DialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-md p-3 mb-4">
              <p><span className="font-medium">Project Group:</span> {groupName}</p>
            </div>

            {result ? (
              <div className="space-y-3" data-testid="add-projects-result">
                <p className="text-sm font-medium text-gray-900">{result.Message}</p>
                <IdChipGroup title="Added" ids={result.AddedProjectIds} chipClass="bg-green-100 text-green-800" />
                <IdChipGroup title="Already in this group" ids={result.AlreadyInGroupProjectIds} chipClass="bg-blue-100 text-blue-800" />
                <IdChipGroup
                  title="In another group (not moved)"
                  ids={result.InOtherGroupProjects.map((p) => `${p.ProjectId} — ${p.GroupName}`)}
                  chipClass="bg-amber-100 text-amber-800"
                />
                {result.InOtherGroupProjects.length > 0 && (
                  <p className="text-xs text-gray-500">To move these projects here, remove them from their current group first.</p>
                )}
                <IdChipGroup title="Not found" ids={result.NotFoundProjectIds} chipClass="bg-gray-200 text-gray-700" />
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="projectGroupProjectIds" className="block text-sm font-medium text-gray-700">
                  Project IDs <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="projectGroupProjectIds"
                  rows={6}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={'Enter Project IDs\n\nYou can enter multiple project IDs separated by commas, semicolons, spaces, or line breaks.\nExample: P0011xxxxx, P0011yyyyy'}
                  className={`w-full px-3 py-2 border ${
                    error ? 'border-red-500' : 'border-gray-300'
                  } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                />
                <p className="text-xs text-gray-500" data-testid="project-id-count">
                  {projectIds.length} project ID(s)
                </p>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <p className="text-xs text-gray-500">
                  <strong>Tip:</strong> You can copy list of projects from your list and paste it here.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            {result ? (
              <>
                <Button color="zinc" onClick={handleAddMore}>
                  Add more
                </Button>
                <Button color="blue" onClick={handleClose}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button color="zinc" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button color="blue" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add'}
                </Button>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddProjectDialog;
