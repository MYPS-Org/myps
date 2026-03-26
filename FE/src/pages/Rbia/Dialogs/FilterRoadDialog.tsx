import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { RoadFilter } from '../Model.d';

interface FilterRoadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: RoadFilter) => void;
  onClear?: () => void;
  initialData?: RoadFilter;
}

const FilterRoadDialog: React.FC<FilterRoadDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onClear,
  initialData
}) => {
  const [formData, setFormData] = useState<RoadFilter>({
    RoadId: initialData?.RoadId || '',
    Name: initialData?.Name || '',
    Classification: initialData?.Classification || ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        RoadId: initialData?.RoadId || '',
        Name: initialData?.Name || '',
        Classification: initialData?.Classification || ''
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleClear = () => {
    setFormData({ RoadId: '', Name: '', Classification: '' });
    if (onClear) onClear();
  };

  const hasValues = Boolean(formData.RoadId || formData.Name || formData.Classification);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Filter Roads
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
              Filter roads by the fields below. Leave a field empty to include all results for that field.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Road ID
                </label>
                <input
                  type="text"
                  value={formData.RoadId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, RoadId: e.target.value }))}
                  placeholder="Filter by road ID..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Road Name
                </label>
                <input
                  type="text"
                  value={formData.Name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Name: e.target.value }))}
                  placeholder="Filter by road name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classification
                </label>
                <select
                  value={formData.Classification || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, Classification: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                >
                  <option value="">All</option>
                  <option value="1">Primary</option>
                  <option value="2">Secondary</option>
                  <option value="3">Tertiary</option>
                  <option value="4">Quaternary</option>
                </select>
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

export default FilterRoadDialog;
