import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";

interface ProceedAddProjectProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string | undefined;
  projectName: string | undefined;
}

const ProceedAddProject: React.FC<ProceedAddProjectProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  projectName,
}) => {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-lg w-full rounded-lg bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 bg-orange-100 rounded-full p-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Proceed with Caution
              </DialogTitle>
              
              <div className="mt-3 space-y-4">
                {/* Warning Message */}
                <p className="text-sm text-gray-600">
                  {message}
                </p>

                {/* Project Info */}
                <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                  <p><span className="font-medium text-gray-700">Project:</span> {projectName}</p>
                </div>

                {/* Additional Warning */}
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <p className="text-sm text-orange-800">
                    ⚠️ Do you want to proceed anyway?
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  color="zinc"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  color="orange"
                  onClick={onConfirm}
                >
                  Yes, Proceed Anyway
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ProceedAddProject;
