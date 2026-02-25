import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";

interface PublishProgramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  programName: string;
  programId: string;
}

const PublishProgramDialog: React.FC<PublishProgramDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  programName,
  // programId,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-start gap-4">
            {/* <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
            </div> */}
            
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" /> Publish Program to other Applications
              </DialogTitle>
              
              <div className="mt-3 text-sm text-gray-600">
                <p className="mb-3">
                  Are you sure you want to publish this program to other applications?
                </p>
                <div className="bg-gray-50 rounded-md p-3 space-y-1">
                  {/* <p><span className="font-medium">Program ID:</span> {programId}</p> */}
                  <p><span className="font-medium">Program Name:</span> {programName}</p>
                </div>
                <p className="mt-3 text-yellow-700">
                  <strong>Warning:</strong> This action will publish the program to PCMA and will be available to other applications. Please ensure all information is correct before proceeding.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  color="zinc"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  color="yellow"
                  onClick={handleConfirm}
                >
                  Publish to PCMA
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default PublishProgramDialog;