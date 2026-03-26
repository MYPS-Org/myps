import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { BridgeFilter } from '../Model.d';

interface FilterBridgeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: BridgeFilter) => void;
  onClear?: () => void;
  initialData?: BridgeFilter;
}

const FilterBridgeDialog: React.FC<FilterBridgeDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onClear,
  initialData
}) => {
  const [formData, setFormData] = useState<BridgeFilter>({
    RoadSectionId: initialData?.RoadSectionId || '',
    BridgeId: initialData?.BridgeId || '',
    Name: initialData?.Name || ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        RoadSectionId: initialData?.RoadSectionId || '',
        BridgeId: initialData?.BridgeId || '',
        Name: initialData?.Name || ''
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleClear = () => {
    setFormData({ RoadSectionId: '', BridgeId: '', Name: '' });
    if (onClear) onClear();
  };

  const hasValues = Boolean(formData.RoadSectionId || formData.BridgeId || formData.Name);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Filter Bridges
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="text-sm text-gray-600">
              Filter bridges by the fields below. Leave a field empty to include all results for that field.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Section Road ID
                </label>
                <input
                  type="text"
                  value={formData.RoadSectionId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, RoadSectionId: e.target.value }))}
                  placeholder="Filter by section road ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bridge ID
                </label>
                <input
                  type="text"
                  value={formData.BridgeId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, BridgeId: e.target.value }))}
                  placeholder="Filter by bridge ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bridge Name
                </label>
                <input
                  type="text"
                  value={formData.Name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Name: e.target.value }))}
                  placeholder="Filter by bridge name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <Button type="button" onClick={handleClear} color="zinc" disabled={!hasValues}>
                Clear Filter
              </Button>
              <div className="flex space-x-3">
                <Button type="button" onClick={onClose} color="zinc">
                  Cancel
                </Button>
                <Button type="submit" color="orange">
                  Apply Filter
                </Button>
              </div>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default FilterBridgeDialog;
