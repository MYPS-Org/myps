import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";
import { useState } from "react";
import type { BatchDeletePreview } from "../Model";

type BatchAction = 'tag' | 'delete' | 'unpublish' | 'publish' | 'restore';

interface ConfirmDialogBatchProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: BatchAction;
  programName: string;
  projectIds: string;
  projectCount: number;
  /** Delete only: what the server says the delete will do. Without it the dialog falls back to the typed list. */
  deletePreview?: BatchDeletePreview;
  /** Replace the action's default title and confirm-button text, e.g. for a single-project delete from its row. */
  title?: string;
  buttonText?: string;
}

/** The delete wording follows the preview: permanent only when something will really be removed. */
const describeDelete = (preview: BatchDeletePreview) => {
  const hard = preview.HardProjectIds.length;
  const soft = preview.SoftProjectIds.length;
  if (hard > 0) {
    return {
      message: `You are about to permanently delete ${hard} project(s). This cannot be undone.` +
        (soft > 0 ? ` ${soft} other project(s) will be deleted at the current stage and can be restored.` : ''),
      warningLevel: 'critical' as const,
    };
  }
  if (soft > 0) {
    return {
      message: `You are about to delete ${soft} project(s) at the current stage. They can be restored with Batch Restore.`,
      warningLevel: 'warning' as const,
    };
  }
  return {
    message: 'None of these projects can be deleted from this program and stage.',
    warningLevel: 'info' as const,
  };
};

const ConfirmDialogBatch: React.FC<ConfirmDialogBatchProps> = ({
  isOpen,
  onClose,
  onConfirm,
  action,
  programName,
  projectIds,
  projectCount,
  deletePreview,
  title,
  buttonText,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const getActionConfig = () => {
    switch (action) {
      case 'delete':
        return {
          title: 'Confirm Batch Delete',
          ...(deletePreview
            ? describeDelete(deletePreview)
            : {
                message: 'You are about to permanently delete the following projects. This action cannot be undone.',
                warningLevel: 'critical' as const,
              }),
          icon: ExclamationTriangleIcon,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-100',
          buttonText: 'Yes, Delete Projects',
          buttonColor: 'red' as const,
          requireConfirmation: true,
          confirmationWord: 'DELETE',
        };
      case 'unpublish':
        return {
          title: 'Confirm Restriction of Projects',
          message: 'You are about to mark the following projects as "Do Not Publish". They will be hidden from published reports.',
          warningLevel: 'warning' as const,
          icon: ExclamationTriangleIcon,
          iconColor: 'text-orange-600',
          iconBg: 'bg-orange-100',
          buttonText: 'Yes, Restrict Publishing',
          buttonColor: 'orange' as const,
          requireConfirmation: false,
          confirmationWord: '',
        };
      case 'publish':
        return {
          title: 'Confirm Publish Projects',
          message: 'You are about to mark the following projects as "Ready to Publish". They will be included in published reports.',
          warningLevel: 'info' as const,
          icon: InformationCircleIcon,
          iconColor: 'text-green-600',
          iconBg: 'bg-green-100',
          buttonText: 'Yes, Mark as Ready',
          buttonColor: 'green' as const,
          requireConfirmation: false,
          confirmationWord: '',
        };
      case 'restore':
        return {
          title: 'Confirm Batch Restore',
          message: 'You are about to restore the following deleted projects back to this program.',
          warningLevel: 'info' as const,
          icon: InformationCircleIcon,
          iconColor: 'text-indigo-600',
          iconBg: 'bg-indigo-100',
          buttonText: 'Yes, Restore Projects',
          buttonColor: 'indigo' as const,
          requireConfirmation: false,
          confirmationWord: '',
        };
      default: // tag
        return {
          title: 'Confirm Batch Tagging',
          message: 'You are about to apply tags to the following projects.',
          warningLevel: 'info' as const,
          icon: InformationCircleIcon,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100',
          buttonText: 'Yes, Apply Tags',
          buttonColor: 'blue' as const,
          requireConfirmation: false,
          confirmationWord: '',
        };
    }
  };

  const config = { ...getActionConfig(), ...(title && { title }), ...(buttonText && { buttonText }) };

  // With a preview, only projects the server will actually delete count, and nothing to
  // delete means nothing to confirm.
  const actionableCount = deletePreview
    ? deletePreview.HardProjectIds.length + deletePreview.SoftProjectIds.length
    : projectCount;
  const nothingToDo = !!deletePreview && actionableCount === 0;

  const handleConfirm = () => {
    if (nothingToDo) return;
    if (config.requireConfirmation) {
      if (confirmText !== config.confirmationWord) {
        setError(`Please type "${config.confirmationWord}" to confirm this action.`);
        return;
      }
    }
    
    setError('');
    onConfirm();
    handleClose();
  };

  const handleClose = () => {
    setConfirmText('');
    setError('');
    onClose();
  };

  // Parse project IDs to display them nicely
  const projectIdArray = projectIds
    .split(/[,;\s\n]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0);

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-lg w-full rounded-lg bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-4">

            {/* Content */}
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <config.icon className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
                {config.title}
              </DialogTitle>
              
              <div className="mt-3 space-y-4">
                {/* Warning Message */}
                <p className="text-sm text-gray-600">
                  {config.message}
                </p>

                {/* Program Info */}
                <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                  <p><span className="font-medium text-gray-700">Program Name:</span> {programName}</p>
                  <p><span className="font-medium text-gray-700">Projects to be affected:</span> {actionableCount}</p>
                </div>

                {deletePreview ? (
                  /* Server preview: what will happen to each id. */
                  <div className="border border-gray-200 rounded-md p-3 max-h-60 overflow-y-auto bg-gray-50 space-y-3">
                    <PreviewGroup
                      title="Permanently deleted (first stage entry)"
                      ids={deletePreview.HardProjectIds}
                      chipClass="bg-red-100 text-red-800"
                    />
                    <PreviewGroup
                      title="Deleted at this stage (can be restored)"
                      ids={deletePreview.SoftProjectIds}
                      chipClass="bg-amber-100 text-amber-800"
                    />
                    {deletePreview.RefusedProjects.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">
                          Not deleted ({deletePreview.RefusedProjects.length})
                        </p>
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          {deletePreview.RefusedProjects.slice(0, 10).map((r) => (
                            <li key={r.ProjectId}>
                              <span className="font-medium text-gray-800">{r.ProjectId}</span>: {r.Reason}
                            </li>
                          ))}
                          {deletePreview.RefusedProjects.length > 10 && (
                            <li>+{deletePreview.RefusedProjects.length - 10} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <PreviewGroup
                      title="Not found in this program and stage"
                      ids={deletePreview.MissingProjectIds}
                      chipClass="bg-gray-200 text-gray-700"
                    />
                  </div>
                ) : (
                <div className="border border-gray-200 rounded-md p-3 max-h-32 overflow-y-auto bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 mb-2">Project IDs:</p>
                  <div className="flex flex-wrap gap-1">
                    {projectIdArray.slice(0, 10).map((id, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {id}
                      </span>
                    ))}
                    {projectIdArray.length > 10 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                        +{projectIdArray.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
                )}

                {/* Confirmation Input for Critical Actions */}
                {config.requireConfirmation && !nothingToDo && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Type <span className="font-bold text-red-600">{config.confirmationWord}</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => {
                        setConfirmText(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder={config.confirmationWord}
                      className={`w-full px-3 py-2 border ${
                        error ? 'border-red-500' : 'border-gray-300'
                      } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500`}
                    />
                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                  </div>
                )}

                {/* Critical Action Warning */}
                {config.warningLevel === 'critical' && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ This action cannot be undone. Please proceed with caution.
                    </p>
                  </div>
                )}
                {action === 'delete' && config.warningLevel === 'warning' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="text-sm text-amber-800 font-medium">
                      These projects are only removed from this stage and can be restored.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  color="zinc"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  color={config.buttonColor}
                  onClick={handleConfirm}
                  disabled={nothingToDo}
                >
                  {config.buttonText}
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

/** One group of the delete preview: a heading with its count and up to ten id chips. Renders nothing when empty. */
const PreviewGroup: React.FC<{ title: string; ids: string[]; chipClass: string }> = ({ title, ids, chipClass }) => {
  if (ids.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">{title} ({ids.length})</p>
      <div className="flex flex-wrap gap-1">
        {ids.slice(0, 10).map((id) => (
          <span key={id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${chipClass}`}>
            {id}
          </span>
        ))}
        {ids.length > 10 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
            +{ids.length - 10} more
          </span>
        )}
      </div>
    </div>
  );
};

export default ConfirmDialogBatch;
