import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { TagIcon, TrashIcon, EyeSlashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";
import { useState } from "react";
import ConfirmDialogBatch from "./ConfirmDialogBatch";
import { previewBatchDelete } from "../Service";
import type { BatchDeletePreview } from "../Model";

type BatchAction = 'tag' | 'delete' | 'unpublish' | 'publish';

interface BatchTagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (programId: string, projectIds: string, action: BatchAction) => void;
  programId: string;
  programName: string;
  action?: BatchAction;
}

const BatchTagDialog: React.FC<BatchTagDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  programId,
  programName,
  action = 'tag',
}) => {
  const [projectIds, setProjectIds] = useState('');
  const [error, setError] = useState('');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<BatchDeletePreview | undefined>(undefined);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const getActionConfig = () => {
    switch (action) {
      case 'delete':
        return {
          title: 'Batch Delete Projects',
          description: 'Delete multiple projects at once. Projects still on their first stage are permanently deleted; projects that have moved on with the program are deleted at the current stage and can be restored. You will see which is which before you confirm.',
          icon: TrashIcon,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-100',
          buttonText: 'Delete Projects',
          buttonColor: 'red' as const,
          placeholder: 'Enter project IDs to delete...',
        };
      case 'unpublish':
        return {
          title: 'Restrict Projects from Publishing',
          description: 'Mark multiple projects as dont publish. These projects will not be visible in published reports.',
          icon: EyeSlashIcon,
          iconColor: 'text-orange-600',
          iconBg: 'bg-orange-100',
          buttonText: 'Restrict Publishing',
          buttonColor: 'orange' as const,
          placeholder: 'Enter project IDs to unpublish...',
        };
      case 'publish':
        return {
          title: 'Mark Projects as ready to Publish',
          description: 'Mark multiple projects as ready to publish. These projects will be included in published reports.',
          icon: CheckCircleIcon,
          iconColor: 'text-green-600',
          iconBg: 'bg-green-100',
          buttonText: 'Mark as Ready to Publish',
          buttonColor: 'green' as const,
          placeholder: 'Enter project IDs to publish...',
        };
      default:
        return {
          title: 'Batch Tagging for Projects',
          description: 'Add tags to all projects within this program. Tags help categorize and organize projects for better management and reporting.',
          icon: TagIcon,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100',
          buttonText: 'Apply Tags',
          buttonColor: 'blue' as const,
          placeholder: 'Enter project IDs to tag...',
        };
    }
  };

  const config = getActionConfig();

  const handleSubmit = async () => {
    if (!projectIds.trim()) {
      setError('Please enter project IDs before submitting.');
      return;
    }

    setError('');

    /*  A delete asks the server first which projects would be permanently deleted, which
        only deleted at this stage, and which refused (published, Approved program, Lump Sum,
        not found) — the confirm dialog shows that, not a guess made from the typed list. */
    if (action === 'delete') {
      setIsPreviewing(true);
      try {
        const response = await previewBatchDelete({ ProgramId: programId, ProjectIds: projectIds });
        setDeletePreview(response.Data);
      } catch (previewError) {
        // The interceptor already toasted any API error that carried a Message.
        if (!(previewError as { Message?: string } | undefined)?.Message) {
          setError('Could not check these projects. Please try again.');
        }
        return;
      } finally {
        setIsPreviewing(false);
      }
    }

    // Open confirmation dialog instead of directly submitting
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = () => {
    onSubmit(programId, projectIds, action);
    handleClose();
  };

  const handleClose = () => {
    setProjectIds('');
    setError('');
    setDeletePreview(undefined);
    setIsConfirmDialogOpen(false);
    onClose();
  };

  // Parse project count for confirmation dialog
  const getProjectCount = (): number => {
    return projectIds
      .split(/[,;\s\n]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0).length;
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <config.icon className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
                {config.title}
              </DialogTitle>
              
              <div className="mt-3 text-sm text-gray-600">
                <p className="mb-4">
                  {config.description}
                </p>
                
                <div className="bg-gray-50 rounded-md p-3 space-y-1 mb-4">
                  <p><span className="font-medium">Program Name:</span> {programName}</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="projectIds" className="block text-sm font-medium text-gray-700">
                    Project IDs <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="projectIds"
                    rows={4}
                    value={projectIds}
                    onChange={(e) => {
                      setProjectIds(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder={`${config.placeholder}&#10;&#10;You can enter multiple project IDs separated by colons, commas, spaces, or line breaks;Example: P0011xxxxx, P0011yyyyy`}
                    className={`w-full px-3 py-2 border ${
                      error ? 'border-red-500' : 'border-gray-300'
                    } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                  />
                  {error && (
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Tip:</strong> You can copy list of projects from your list and paste it here.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  color="zinc"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  color={config.buttonColor}
                  onClick={handleSubmit}
                  disabled={isPreviewing}
                >
                  {config.buttonText}
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialogBatch
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmSubmit}
        action={action}
        programName={programName}
        projectIds={projectIds}
        projectCount={getProjectCount()}
        deletePreview={action === 'delete' ? deletePreview : undefined}
      />
    </Dialog>
  );
};

export default BatchTagDialog;