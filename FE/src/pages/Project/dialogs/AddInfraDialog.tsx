import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AddInfraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (infraId: string) => void;
  initialData?: any; // Optional initial data for dropdowns or other purposes
}

const AddInfraDialog: React.FC<AddInfraDialogProps> = ({ isOpen, onClose, onAdd, initialData }) => {
  const [infraId, setInfraId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setInfraId('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setInfraId('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (infraId.trim()) {
      onAdd(infraId);
      handleClose();
    } else {
      alert('Please enter a valid Infra ID');
    }
  };

  const handleAdd = () => {
    if (infraId.trim()) {
      onAdd(infraId);
      onClose();
    } else {
      alert('Please enter a valid Infra ID');
    }
  };

  return (
     <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        {/* Full-screen container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                    {mode === 'add' ? 'Add Infra ID' : 'Edit Infra ID'}
                </DialogTitle>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 "
                    >
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </div>
            {/* NavBar here for RoadSection, Bridge, FCS, OtherInfra */}

            <form className="p-6 space-y-6">
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <Button type="button" color="zinc" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button type="submit" color="orange" onClick={handleSubmit}>
                        {/* {mode === 'add' ? 'Add' : 'Save'} */}
                    </Button>
                </div>
            </form>
        </DialogPanel>
        </div>
    </Dialog>
  );
};