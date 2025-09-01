import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentCost, ScopeOfWorkEnum } from '../Model.d';

interface AddMajorItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (majorItem: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
  }) => void;
  componentCosts: ComponentCost[];
  dropDowns?: ScopeOfWorkEnum[];
  mode: 'add' | 'edit';
  initialData?: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
  };
}

const AddMajorItemDialog: React.FC<AddMajorItemDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  componentCosts,
  dropDowns = [],
  mode,
  initialData
}) => {
  const [formData, setFormData] = useState({
    ComponentId: '',
    YearOfWork: new Date().getFullYear(),
    WorkTypeId: 0,
    InfraType: ''
  });

  const [availableWorkTypes, setAvailableWorkTypes] = useState<ScopeOfWorkEnum[]>([]);

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        ComponentId: '',
        YearOfWork: new Date().getFullYear(),
        WorkTypeId: 0,
        InfraType: ''
      });
    }
  }, [mode, initialData, isOpen]);

  // Update available work types when InfraType changes
  useEffect(() => {
    if (formData.InfraType && dropDowns) {
      const filtered = dropDowns.filter(scope => scope.InfraType === formData.InfraType);
      setAvailableWorkTypes(filtered);
      
      // Reset WorkTypeId if current selection is not available for new InfraType
      if (formData.WorkTypeId > 0) {
        const isCurrentWorkTypeValid = filtered.some(scope => scope.Enum === formData.WorkTypeId);
        if (!isCurrentWorkTypeValid) {
          setFormData(prev => ({ ...prev, WorkTypeId: 0 }));
        }
      }
    } else {
      setAvailableWorkTypes([]);
      setFormData(prev => ({ ...prev, WorkTypeId: 0 }));
    }
  }, [formData.InfraType, dropDowns]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setFormData({
      ComponentId: '',
      YearOfWork: new Date().getFullYear(),
      WorkTypeId: 0,
      InfraType: ''
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.ComponentId) {
      alert('Please select a component');
      return;
    }
    
    if (!formData.InfraType) {
      alert('Please select an infrastructure type');
      return;
    }
    
    if (formData.WorkTypeId === 0) {
      alert('Please select a type of work');
      return;
    }
    
    if (formData.YearOfWork < 1900 || formData.YearOfWork > 2100) {
      alert('Please enter a valid year');
      return;
    }

    onAdd(formData);
    handleClose();
  };

  // Get unique infrastructure types from dropdowns
  const infraTypes = [...new Set(dropDowns?.map(scope => scope.InfraType) || [])];

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {mode === 'add' ? 'Add Project Major Item of Works' : 'Edit Project Major Item of Works'}
            </DialogTitle>
            <Button plain onClick={handleClose}>
              <XMarkIcon className="h-6 w-6" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Component Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.ComponentId}
                onChange={(e) => handleInputChange('ComponentId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                required
              >
                <option value="">Select Component</option>
                {componentCosts?.map((cost) => (
                  <option key={cost.Id} value={cost.ComponentId}>
                    {cost.ComponentId}
                  </option>
                ))}
              </select>
            </div>

            {/* Year of Work */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year of Work <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.YearOfWork}
                onChange={(e) => handleInputChange('YearOfWork', parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                min="1900"
                max="2100"
                required
              />
            </div>

            {/* Infrastructure Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Infrastructure Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.InfraType}
                onChange={(e) => handleInputChange('InfraType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                required
              >
                <option value="">Select Infrastructure Type</option>
                {infraTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Type of Work */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type of Work <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.WorkTypeId}
                onChange={(e) => handleInputChange('WorkTypeId', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                disabled={!formData.InfraType}
                required
              >
                <option value={0}>
                  {!formData.InfraType ? 'Select Infrastructure Type first' : 'Select Type of Work'}
                </option>
                {availableWorkTypes.map((workType) => (
                  <option key={workType.Enum} value={workType.Enum}>
                    {workType.Description}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-8">
              <Button outline onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" color="orange">
                {mode === 'add' ? 'Add Item' : 'Update Item'}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddMajorItemDialog;
