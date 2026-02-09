import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { Bridge } from '../state/rbiaAtoms';

interface DeleteBridgeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bridgeKey: string) => void;
  bridge: Bridge;
}

const DeleteBridgeDialog: React.FC<DeleteBridgeDialogProps> = ({ isOpen, onClose, onSubmit, bridge }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmText.toLowerCase() !== 'delete') {
      return;
    }

    if (!bridge.RoadSectionId || !bridge.Name) {
      console.error('Bridge identification is incomplete');
      return;
    }

    setIsDeleting(true);
    try {
      // Use a combination of RoadSectionId and Name as unique identifier
      const bridgeKey = `${bridge.RoadSectionId}-${bridge.Name}`;
      onSubmit(bridgeKey); // Call the onSubmit prop with the bridge key
      handleClose();
    } catch (error) {
      console.error('Error deleting bridge:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setIsDeleting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Delete Bridge
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Warning Message */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Warning: This action cannot be undone
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Deleting this bridge will permanently remove it from the system and all related infrastructure data.
                  </p>
                </div>
              </div>
            </div>

            {/* Bridge Information */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Bridge to be deleted:</h4>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Bridge Name:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{bridge.Name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Section Road ID:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{bridge.RoadSectionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">From Chainage:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{bridge.From} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Length:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{bridge.Length} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Carriage Ways:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{bridge.CarriageWay}</span>
                </div>
              </div>
            </div>

            {/* Confirmation Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <span className="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button color="zinc" onClick={handleClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                color="red" 
                disabled={confirmText.toLowerCase() !== 'delete' || isDeleting}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Bridge'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default DeleteBridgeDialog;
