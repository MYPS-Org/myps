import { Dialog, DialogTitle, DialogPanel } from "@headlessui/react";
import { TagIcon } from "@heroicons/react/24/outline";
import { Button } from "../../../components/tailwindui/button";
import { useState } from "react";

interface BatchTagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tags: string) => void;
  programId: string;
  programName: string;
}

const BatchTagDialog: React.FC<BatchTagDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  programId,
  programName,
}) => {
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!tags.trim()) {
      setError('Please enter tags before submitting.');
      return;
    }
    
    setError('');
    onSubmit(tags.trim());
    handleClose();
  };

  const handleClose = () => {
    setTags('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-start gap-4">
            {/* <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <TagIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div> */}
            
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <TagIcon className="h-6 w-6 text-blue-600" aria-hidden="true" /> Batch Tagging for Projects
              </DialogTitle>
              
              <div className="mt-3 text-sm text-gray-600">
                <p className="mb-4">
                  Add tags to all projects within this program. Tags help categorize and organize projects for better management and reporting.
                </p>
                
                <div className="bg-gray-50 rounded-md p-3 space-y-1 mb-4">
                  {/* <p><span className="font-medium">Program ID:</span> {programId}</p> */}
                  <p><span className="font-medium">Program Name:</span> {programName}</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                    Project IDs <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="tags"
                    rows={4}
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Enter project IDs (e.g., P0011xxxxx)&#10;&#10;You can enter multiple project IDs separated by commas, spaces, or line breaks."
                    className={`w-full px-3 py-2 border ${
                      error ? 'border-red-500' : 'border-gray-300'
                    } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                  />
                  {error && (
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Tip:</strong> You can copy list of projects on your list and paste it here.
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
                  color="blue"
                  onClick={handleSubmit}
                >
                  Apply Tags
                </Button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default BatchTagDialog;