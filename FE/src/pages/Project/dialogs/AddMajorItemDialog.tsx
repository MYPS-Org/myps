import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentCost, ScopeOfWorkEnum, InfraTypeEnum } from '../Model.d';
import type { ProgramLatest } from '../../Program/Model';
import { getDisabledClass, filterKeepingSelected } from '../../../utils/GlobalFunctions';
import { useToast } from '../../../components/toaster/ToasterContext';

interface AddMajorItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (majorItem: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeFK: number;
    InfraTypeFK: string;
    IsDeleted: boolean;
  }) => void;
  componentCosts: ComponentCost[];
  programDetails?: ProgramLatest;
  dropDowns?: ScopeOfWorkEnum[];
  infraTypeEnums?: InfraTypeEnum[];
  mode: 'add' | 'edit';
  initialData?: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeFK: number;
    InfraTypeFK: string;
    IsDeleted: boolean; 
  };
  existingMajorItems?: Array<{ ComponentId: string }>;
  /** The row being edited is already saved (Id > 0): its own retired values stay selectable. */
  isSavedRow?: boolean;
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
  existingMajorItems = [],
  isSavedRow = false
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    ComponentId: '',
    YearOfWork: programDetails?.StartYear || new Date().getFullYear(),
    WorkTypeFK: 0,
    InfraTypeFK: '',
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
        YearOfWork: programDetails ? programDetails.StartYear : new Date().getFullYear(),
        WorkTypeFK: 0,
        InfraTypeFK: '',
        IsDeleted: false
      });
    }
  }, [mode, initialData, isOpen, programDetails]);

  // The lists include retired (inactive) values so saved rows can still show them (#479). New
  // picks see only active values; a saved row keeps its own values even if retired since -- its
  // Type of Work only while its Infra Type is unchanged, as the API checks a changed row in full.
  const keptInfraTypeFK = mode === 'edit' && isSavedRow ? initialData?.InfraTypeFK : undefined;
  const keptWorkTypeFK = keptInfraTypeFK && formData.InfraTypeFK === keptInfraTypeFK ? initialData?.WorkTypeFK : undefined;

  const selectableWorkTypes = useMemo<ScopeOfWorkEnum[]>(
    () => filterKeepingSelected(dropDowns, scope => scope.IsActive !== false, 'Enum', keptWorkTypeFK),
    [dropDowns, keptWorkTypeFK]
  );

  // Filter available work types based on selected InfraType (InfraCode)
  const availableWorkTypes = useMemo<ScopeOfWorkEnum[]>(() => {
    if (!formData.InfraTypeFK) return [];

    return selectableWorkTypes.filter(
      scope =>
        scope.InfraType.includes(formData.InfraTypeFK) &&
        (formData.ComponentId !== "ROW" ||
          scope.Description === "ROW Acquisition")
    );
  }, [formData.InfraTypeFK, formData.ComponentId, selectableWorkTypes]);


  const handleInputChange = (field: string, value: any) => {
    // If changing InfraType, reset WorkTypeId
    if (field === 'InfraTypeFK' && value !== formData.InfraTypeFK) {
      setFormData(prev => ({ ...prev, [field]: value, WorkTypeFK: 0 }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleClose = () => {
    setFormData({
      ComponentId: '',
      YearOfWork: new Date().getFullYear(),
      WorkTypeFK: 0,
      InfraTypeFK: '',
      IsDeleted: false
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.ComponentId) {
      showToast({ type: 'error', message: 'Please select a component.' });
      return;
    }

    // Check if there are available components for add mode
    if (mode === 'add' && availableComponentCosts.length === 0) {
      showToast({ type: 'error', message: 'No components available. Please add more components first.' });
      return;
    }

    if (!formData.InfraTypeFK) {
      showToast({ type: 'error', message: 'Please select an infrastructure type.' });
      return;
    }

    if (formData.WorkTypeFK === 0) {
      showToast({ type: 'error', message: 'Please select a type of work.' });
      return;
    }

    if (formData.YearOfWork < 1900 || formData.YearOfWork > 2100) {
      showToast({ type: 'error', message: 'Please enter a valid year.' });
      return;
    }

    onAdd(formData);
    handleClose();
  };

  // Get infrastructure types: use InfraTypeEnum master list if available,
  // otherwise fall back to extracting unique codes from ScopeOfWorks
  const infraTypeOptions: InfraTypeEnum[] = useMemo(() => {
  if (formData.ComponentId === "ROW") {
    // If ComponentId is "ROW", only include InfraTypes that have a "ROW Acquisition" work type
    return filterKeepingSelected(infraTypeEnums, infraType => infraType.IsActive !== false, 'InfraCode', keptInfraTypeFK).filter(infraType =>
      selectableWorkTypes.some(
        scope =>
          scope.InfraType.includes(infraType.InfraCode) &&
          scope.Description === "ROW Acquisition"
      )
    );
  }

  // Otherwise, return all active InfraTypes
  return infraTypeEnums.length > 0
    ? filterKeepingSelected(infraTypeEnums, infraType => infraType.IsActive !== false, 'InfraCode', keptInfraTypeFK)
    : [...new Set(selectableWorkTypes.flatMap(scope => scope.InfraType))]
        .map((code, i) => ({ Id: i, InfraId: i, InfraCode: code, InfraName: code }));
}, [formData.ComponentId, infraTypeEnums, selectableWorkTypes, keptInfraTypeFK]);
  
  // Filter out already selected ComponentIds (but allow the current one when editing)
  const availableComponentCosts = componentCosts.filter(cost => {
    // Always exclude EAO, EXC, SAV component IDs regardless of mode or reason
    const excludedComponents = ['EAO', 'EXC', 'SAV', 'COS', 'FS', 'DED', 'LS', 'OTH3', 'OTH4', 'OTH2', 'EXP', 'CS'];
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
                disabled={mode === 'edit'} // Disable component selection in edit mode
              >
                <option value="">Select Component</option>
                {availableComponentCosts.filter(cost => !cost.IsDeleted).map((cost) => (
                  <option key={cost.Id} value={cost.ComponentId}>
                    {cost.ComponentId}
                  </option>
                ))}
              </select>
              {mode === 'add' && availableComponentCosts.filter(cost => !cost.IsDeleted).length === 0 && (
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
                min={programDetails?.StartYear}
                max="2100"
              />
            </div>

            {/* Infrastructure Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Infrastructure Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.InfraTypeFK}
                onChange={(e) => handleInputChange('InfraTypeFK', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${getDisabledClass(mode === 'edit')}`}
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
                value={formData.WorkTypeFK}
                onChange={(e) => handleInputChange('WorkTypeFK', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${getDisabledClass(mode === 'edit')}`}
                disabled={!formData.InfraTypeFK || mode === 'edit'}
              >
                <option value={0}>
                  {!formData.InfraTypeFK ? 'Select Infrastructure Type first' : 'Select Type of Work'}
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
                disabled={mode === 'add' && availableComponentCosts.filter(cost => !cost.IsDeleted).length === 0}
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
