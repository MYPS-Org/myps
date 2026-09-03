import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";

interface ExportConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  programName: string;
  stageName: string;
}

const ExportConfirmDialog: React.FC<ExportConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  programName,
  stageName,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-lg w-full rounded-lg bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-4">

            {/* Content */}
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ArrowDownTrayIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                Confirm Export Projects
              </DialogTitle>

              <div className="mt-3 space-y-4">
                {/* Message */}
                <p className="text-sm text-gray-600">
                  You are about to export all projects for the following program. The export runs in the background — you'll get a notification with a download link once it's ready.
                </p>

                {/* Program Info */}
                <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                  <p><span className="font-medium text-gray-700">Program:</span> {programName}</p>
                  <p><span className="font-medium text-gray-700">Stage:</span> {stageName}</p>
                </div>

                {/* Info note */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    The exported file will contain all project data under this program at the current stage.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <Button color="zinc" onClick={onClose}>
                  Cancel
                </Button>
                <Button color="blue" onClick={handleConfirm}>
                  Yes, Export Projects
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ExportConfirmDialog;
