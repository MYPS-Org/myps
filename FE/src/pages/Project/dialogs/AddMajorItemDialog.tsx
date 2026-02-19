import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentCost, ScopeOfWorkEnum, InfraTypeEnum } from '../Model.d';
import type { ProgramList } from '../../Program/Model';
import { getDisabledClass } from '../../../utils/GlobalFunctions';

interface AddMajorItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (majorItem: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
    IsDeleted: boolean;
  }) => void;
  componentCosts: ComponentCost[];
  programDetails?: ProgramList;
  dropDowns?: ScopeOfWorkEnum[];
  infraTypeEnums?: InfraTypeEnum[];
  mode: 'add' | 'edit';
  initialData?: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
    IsDeleted: boolean; 
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
  infraTypeEnums = [],
  mode,
  initialData,
  existingMajorItems = []
}) => {
  const [formData, setFormData] = useState({
    ComponentId: '',
    YearOfWork: programDetails?.YearStart || new Date().getFullYear(),
    WorkTypeId: 0,
    InfraType: '',
    IsDeleted: false
  });

  // const [availableWorkTypes, setAvailableWorkTypes] = useState<ScopeOfWorkEnum[]>([]);

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        ComponentId: '',
        YearOfWork: programDetails ? programDetails.YearStart : new Date().getFullYear(),
        WorkTypeId: 0,
        InfraType: '',
        IsDeleted: false
      });
    }
  }, [mode, initialData, isOpen, programDetails]);

  // Filter available work types based on selected InfraType (InfraCode)
  const availableWorkTypes = useMemo<ScopeOfWorkEnum[]>(() => {
    if (!formData.InfraType || !dropDowns) return [];

    return dropDowns.filter(
      scope =>
        scope.InfraType.includes(formData.InfraType) &&
        (formData.ComponentId !== "ROW" ||
          scope.Description === "ROW Acquisition")
    );
  }, [formData.InfraType, formData.ComponentId, dropDowns]);


  const handleInputChange = (field: string, value: any) => {
    // If changing InfraType, reset WorkTypeId
    if (field === 'InfraType' && value !== formData.InfraType) {
      setFormData(prev => ({ ...prev, [field]: value, WorkTypeId: 0 }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleClose = () => {
    setFormData({
      ComponentId: '',
      YearOfWork: new Date().getFullYear(),
      WorkTypeId: 0,
      InfraType: '',
      IsDeleted: false
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

  // Get infrastructure types: use InfraTypeEnum master list if available,
  // otherwise fall back to extracting unique codes from ScopeOfWorks
  const infraTypeOptions: InfraTypeEnum[] = infraTypeEnums.length > 0
    ? infraTypeEnums
    : [...new Set(dropDowns?.flatMap(scope => scope.InfraType) || [])]
        .map((code, i) => ({ Id: i, InfraId: i, InfraCode: code, InfraName: code }));
  
  // Filter out already selected ComponentIds (but allow the current one when editing)
  const availableComponentCosts = componentCosts.filter(cost => {
    // Always exclude EAO, EXC, SAV component IDs regardless of mode or reason
    const excludedComponents = ['EAO', 'EXC', 'SAV', 'COS'];
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
              </label>
              <select
                value={formData.ComponentId}
                onChange={(e) => handleInputChange('ComponentId', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${getDisabledClass(mode === 'edit')}`}
                required
                disabled={mode === 'edit'} // Disable component selection in edit mode
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
              </label>
              <input
                type="number"
                value={formData.YearOfWork}
                onChange={(e) => handleInputChange('YearOfWork', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                min={programDetails?.YearStart}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${getDisabledClass(mode === 'edit')}`}
                required
                disabled={mode === 'edit'} // Disable infrastructure type selection in edit mode
              >
                <option value="">Select Infrastructure Type</option>
                {infraTypeOptions.map((infraType) => (
                  <option key={infraType.InfraCode} value={infraType.InfraCode}>
                    {infraType.InfraName}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${getDisabledClass(mode === 'edit')}`}
                disabled={!formData.InfraType || mode === 'edit'}
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
