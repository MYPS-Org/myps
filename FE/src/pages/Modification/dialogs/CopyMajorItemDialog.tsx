import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import type { ComponentCost, MajorItemOfWorksWithDropdown } from '../../Project/Model.d';

interface CopyMajorItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newComponentId: string) => void;
  majorItemToCopy: MajorItemOfWorksWithDropdown | null;
  majorItemList?: MajorItemOfWorksWithDropdown[];
  componentCosts: ComponentCost[];
  existingMajorItems: Array<{ ComponentId: string }>;
}

const CopyMajorItemDialog: React.FC<CopyMajorItemDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  majorItemToCopy,
  componentCosts,
  existingMajorItems,
  majorItemList,
}) => {
  const [selectedComponentId, setSelectedComponentId] = useState('');

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedComponentId('');
    }
  }, [isOpen]);

  // Filter available components (exclude already used ones and special types)
  const availableComponentCosts = useMemo(() => {
    return componentCosts.filter(cost => {
      // Exclude deleted components
    //   if (cost.IsDeleted) {
    //     return false;
    //   }
      
      // Always exclude EAO, EXC, SAV component IDs
      const excludedComponents = ['EAO', 'EXC', 'SAV', 'CoS'];
      const componentId = cost.ComponentId?.toUpperCase();
      if (excludedComponents.includes(componentId)) {
        return false;
      }
      
      const exemption = majorItemList?.find(m => m.IsDeleted ? true : false && m.ComponentId === cost.ComponentId);
      
      // Exclude components that already have major items
      const alreadyUsed = existingMajorItems.some(item => item.ComponentId === cost.ComponentId);
      if (alreadyUsed) {
        return false;
      }
      
      return true;
    });
  }, [componentCosts, existingMajorItems]);

  const handleConfirm = () => {
    if (!selectedComponentId) {
      alert('Please select a component for the copy');
      return;
    }
    
    onConfirm(selectedComponentId);
    handleClose();
  };

  const handleClose = () => {
    setSelectedComponentId('');
    onClose();
  };

  if (!majorItemToCopy) return null;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
              </div>
              <DialogTitle className="ml-3 text-lg font-semibold text-gray-900">
                Copy Major Item of Work
              </DialogTitle>
            </div>
            <Button plain onClick={handleClose}>
              <XMarkIcon className="h-6 w-6" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Info about what's being copied */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Copying:</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Component:</span>
                  <span className="font-medium">{majorItemToCopy.ComponentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Year of Work:</span>
                  <span className="font-medium">{majorItemToCopy.YearOfWork}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Infrastructure Type:</span>
                  <span className="font-medium">{majorItemToCopy.InfraType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Work Locations:</span>
                  <span className="font-medium text-blue-600">
                    {majorItemToCopy.MajorItemLocations?.filter(loc => !loc.IsDeleted).length || 0} location(s) will be copied
                  </span>
                </div>
              </div>
            </div>

            {/* Component selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Component for Copy <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedComponentId}
                onChange={(e) => setSelectedComponentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              >
                <option value="">Select Component</option>
                {availableComponentCosts.map((cost) => (
                  <option key={cost.Id} value={cost.ComponentId}>
                    {cost.ComponentId} - {cost.Description || 'No description'}
                  </option>
                ))}
              </select>
              {availableComponentCosts.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  No available components. All components either have major items or are excluded types.
                </p>
              )}
            </div>

            {/* Warning message */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> This will create a duplicate major item with all its work locations 
                assigned to the selected component. The original major item will remain unchanged.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <Button outline onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                color="blue"
                onClick={handleConfirm}
                disabled={!selectedComponentId || availableComponentCosts.length === 0}
              >
                <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                Copy Major Item
              </Button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default CopyMajorItemDialog;
