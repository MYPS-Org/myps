import React from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../conditions/ExcessComponentAutomation';

interface ExcessPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  projectCost: number;
  totalComponentCost: number;
  excessAmount: number;
}

/**
 * ExcessPrompt Dialog
 * 
 * Displays a warning when project cost is greater than total component cost.
 * User can choose to:
 * - OK: Create a new "EXC" component with the excess amount
 * - Cancel: Exit without creating the component
 */
const ExcessPrompt: React.FC<ExcessPromptProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  projectCost,
  totalComponentCost,
  excessAmount
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-10 inset-0 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Project Cost Reduction Warning
              </DialogTitle>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Warning Message */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 font-medium">
                The system has detected a difference between the project cost and total component cost.
              </p>
              <p className="text-sm text-gray-700 mt-2">
                The Project Cost <span className="font-semibold text-amber-700">{formatCurrency(projectCost)}</span> is 
                greater than the Total Project Component Cost <span className="font-semibold text-amber-700">{formatCurrency(totalComponentCost)}</span>.
              </p>
              <p className="text-sm font-bold text-gray-700 mt-2">
                Is this an intentional reduction of Project Cost?
              </p>
            </div>

            {/* Excess Amount Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Excess Amount:</span>
                <span className="text-lg font-bold text-blue-700">{formatCurrency(excessAmount)}</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Cost Breakdown</h4>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Project Cost:</span>
                <span className="font-medium text-gray-900">{formatCurrency(projectCost)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Component Cost:</span>
                <span className="font-medium text-gray-900">{formatCurrency(totalComponentCost)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Difference:</span>
                <span className="text-base font-bold text-amber-600">{formatCurrency(excessAmount)}</span>
              </div>
            </div>

            {/* Action Information */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600">
                <strong>OK - Create EXC Component:</strong> Create a new project component as "EXC" (Excess) with the excess amount.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <strong>Cancel:</strong> Exit without creating the excess component.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
            <Button
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              color="blue"
              onClick={handleConfirm}
            >
              OK - Create EXC Component
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ExcessPrompt;
