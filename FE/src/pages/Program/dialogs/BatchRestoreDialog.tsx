import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";
import { useState } from "react";
import ConfirmDialogBatch from "./ConfirmDialogBatch";

interface BatchRestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (programId: string, projectIds: string) => void;
  programId: string;
  programName: string;
}

const BatchRestoreDialog: React.FC<BatchRestoreDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  programId,
  programName,
}) => {
  const [projectIds, setProjectIds] = useState('');
  const [error, setError] = useState('');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const handleSubmit = () => {
    if (!projectIds.trim()) {
      setError('Please enter project IDs before submitting.');
      return;
    }
    setError('');
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = () => {
    onSubmit(programId, projectIds);
    handleClose();
  };

  const handleClose = () => {
    setProjectIds('');
    setError('');
    setIsConfirmDialogOpen(false);
    onClose();
  };

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
                <ArrowPathIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                Batch Restore Projects
              </DialogTitle>

              <div className="mt-3 text-sm text-gray-600">
                <p className="mb-4">
                  Restore multiple deleted projects back to this program. Enter the project IDs below to restore them.
                </p>

                <div className="bg-gray-50 rounded-md p-3 space-y-1 mb-4">
                  <p><span className="font-medium">Program Name:</span> {programName}</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="restoreProjectIds" className="block text-sm font-medium text-gray-700">
                    Project IDs <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="restoreProjectIds"
                    rows={4}
                    value={projectIds}
                    onChange={(e) => {
                      setProjectIds(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder={`Enter project IDs to restore...\n\nYou can enter multiple project IDs separated by commas, spaces, or line breaks.\nExample: P0011xxxxx, P0011yyyyy`}
                    className={`w-full px-3 py-2 border ${
                      error ? 'border-red-500' : 'border-gray-300'
                    } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none`}
                  />
                  {error && (
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Tip:</strong> You can copy a list of project IDs and paste them here.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button color="zinc" onClick={handleClose}>
                  Cancel
                </Button>
                <Button color="indigo" onClick={handleSubmit}>
                  Restore Projects
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
        action="restore"
        programName={programName}
        projectIds={projectIds}
        projectCount={getProjectCount()}
      />
    </Dialog>
  );
};

export default BatchRestoreDialog;
