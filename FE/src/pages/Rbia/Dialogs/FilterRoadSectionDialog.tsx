import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';
import type { RoadSectionFilter } from '../Model.d';
import type { RODEOEnum } from '../../Project/Model';

interface FilterRoadSectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filterData: RoadSectionFilter) => void;
  onClear?: () => void;
  initialData?: RoadSectionFilter;
  deoList?: RODEOEnum[];
}

const FilterRoadSectionDialog: React.FC<FilterRoadSectionDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onClear,
  initialData,
  deoList = []
}) => {
  const [formData, setFormData] = useState<RoadSectionFilter>({
    RoadId: initialData?.RoadId || '',
    RoadSectionId: initialData?.RoadSectionId || '',
    DEO: initialData?.DEO || ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        RoadId: initialData?.RoadId || '',
        RoadSectionId: initialData?.RoadSectionId || '',
        DEO: initialData?.DEO || ''
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleClear = () => {
    setFormData({ RoadId: '', RoadSectionId: '', DEO: '' });
    if (onClear) onClear();
  };

  const hasValues = Boolean(formData.RoadId || formData.RoadSectionId || formData.DEO);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Filter Road Sections
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
              Filter road sections by the fields below. Leave a field empty to include all results for that field.
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
                  Engineering District (DEO)
                </label>
                <SearchableDropdown
                  options={[
                    { value: '', label: 'All Districts' },
                    ...deoList.map(deo => ({ value: deo.ParticipantId, label: `${deo.Name}` }))
                  ]}
                  value={formData.DEO || ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, DEO: String(val) }))}
                  placeholder="Select engineering district..."
                  searchPlaceholder="Search districts..."
                  allowClear
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

export default FilterRoadSectionDialog;
