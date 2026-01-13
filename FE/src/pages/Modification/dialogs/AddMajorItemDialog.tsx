import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentCost, ScopeOfWorkEnum } from '../../Project/Model.d';
import type { ProgramList } from '../../Program/Model';
import { useFieldPermissionState } from '../hooks/useFieldPermissions';

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
  programDetails?: ProgramList;
  dropDowns?: ScopeOfWorkEnum[];
  mode: 'add' | 'edit';
  initialData?: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
  };
  existingMajorItems?: Array<{ ComponentId: string }>;
}

const AddMajorItemDialog: React.FC<AddMajorItemDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  componentCosts,
  programDetails,
  dropDowns = [],
  mode,
  initialData,
  existingMajorItems = [],
}) => {
  const defaultFormData = {
    ComponentId: '',
    YearOfWork: programDetails?.YearStart || new Date().getFullYear(),
    WorkTypeId: 0,
    InfraType: '',
  };

  const [formData, setFormData] = useState(defaultFormData);

  const [availableWorkTypes, setAvailableWorkTypes] = useState<ScopeOfWorkEnum[]>([]);

  // Get field permissions state
  const permissionState = useFieldPermissionState();

  // Helper function to check if a field is editable based on fieldRules from API
  const fieldPermissionsMap = useMemo(() => {
    // EXCEPTION: When adding new major item (mode === 'add'), all fields should be editable
    if (mode === 'add') {
      return {
        ComponentId: true,
        YearOfWork: true,
        WorkTypeId: true,
        InfraType: true,
      };
    }

    if (!permissionState.fieldRules) return {};

    const permissions: Record<string, boolean> = {};

    // Get MajorItemOfWorkRules fields
    const majorItemFields = permissionState.fieldRules.MajorItemOfWorkRules?.Fields;
    if (majorItemFields) {
      Object.assign(permissions, majorItemFields);
    }

    return permissions;
  }, [permissionState.fieldRules, mode]);

  // Function to check if a specific field is editable
  const isFieldEditable = useCallback((field: string) => {
    return fieldPermissionsMap[field] === true;
  }, [fieldPermissionsMap]);

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData(initialData);
    } else {
      setFormData(defaultFormData);
    }
  }, [mode, initialData, isOpen, programDetails]);

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
  }, [formData.InfraType, formData.WorkTypeId, dropDowns]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setFormData(defaultFormData);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.ComponentId) {
      alert('Please select a component');
      return;
    }
    
    // Check if there are available components for add mode
    if (mode === 'add' && availableComponentCosts.length === 0) {
      alert('No components available. Please add more components first.');
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

  // Filter out already selected ComponentIds (but allow the current one when editing)
  const availableComponentCosts = componentCosts.filter(cost => {
    // Always exclude EAO, EXC, SAV component IDs regardless of mode or reason
    const excludedComponents = ['EAO', 'EXC', 'SAV'];
    const componentId = cost.ComponentId?.toUpperCase();
    const isExcluded = excludedComponents.includes(componentId);
    
    // Don't show excluded components even in edit mode
    if (isExcluded) {
      return false;
    }
    
    // When editing, allow the current ComponentId to remain in the list
    if (mode === 'edit' && initialData && cost.ComponentId === initialData.ComponentId) {
      return true;
    }
    
    // For add mode or other components in edit mode, filter out already selected ones
    const notAlreadySelected = !existingMajorItems.some(item => item.ComponentId === cost.ComponentId);
    
    return notAlreadySelected;
  });

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
                <span className="text-xs text-gray-500 ml-2">{isFieldEditable('ComponentId') ? '✓ Editable' : '✗ Not Editable'}</span>
              </label>
              <select
                value={formData.ComponentId}
                onChange={(e) => handleInputChange('ComponentId', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${
                  !isFieldEditable('ComponentId') ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!isFieldEditable('ComponentId')}
                required
              >
                <option value="">Select Component</option>
                {availableComponentCosts.map((cost) => (
                  <option key={cost.Id} value={cost.ComponentId}>
                    {cost.ComponentId}
                  </option>
                ))}
              </select>
              {mode === 'add' && availableComponentCosts.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  All components have been selected. Please add more components first.
                </p>
              )}
            </div>

            {/* Year of Work */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year of Work <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">{isFieldEditable('YearOfWork') ? '✓ Editable' : '✗ Not Editable'}</span>
              </label>
              <input
                type="number"
                value={formData.YearOfWork}
                onChange={(e) => handleInputChange('YearOfWork', parseInt(e.target.value))}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${
                  !isFieldEditable('YearOfWork') ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!isFieldEditable('YearOfWork')}
                min={programDetails?.YearStart}
                max="2100"
                required
              />
            </div>

            {/* Infrastructure Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Infrastructure Type <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">{isFieldEditable('InfraType') ? '✓ Editable' : '✗ Not Editable'}</span>
              </label>
              <select
                value={formData.InfraType}
                onChange={(e) => handleInputChange('InfraType', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${
                  !isFieldEditable('InfraType') ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!isFieldEditable('InfraType')}
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
                <span className="text-xs text-gray-500 ml-2">{isFieldEditable('WorkTypeId') ? '✓ Editable' : '✗ Not Editable'}</span>
              </label>
              <select
                value={formData.WorkTypeId}
                onChange={(e) => handleInputChange('WorkTypeId', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${
                  !isFieldEditable('WorkTypeId') || !formData.InfraType ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!isFieldEditable('WorkTypeId') || !formData.InfraType}
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
              <Button 
                type="submit" 
                color="orange"
                disabled={mode === 'add' && availableComponentCosts.length === 0}
              >
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
