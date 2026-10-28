import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentCost, ScopeOfWorkEnum, InfraTypeEnum } from '../../Project/Model.d';
import type { ProgramLatest } from '../../Program/Model';
import { useFieldPermissionState } from '../hooks/useFieldPermissions';
import { useToast } from '../../../components/toaster/ToasterContext';
import { filterKeepingSelected } from '../../../utils/GlobalFunctions';

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
  programDetails?: ProgramLatest;
  dropDowns?: ScopeOfWorkEnum[];
  infraTypeEnums?: InfraTypeEnum[];
  mode: 'add' | 'edit';
  initialData?: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
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
  isSavedRow = false,
}) => {
  // Stabilize defaultFormData using a primitive to avoid new object refs on every render
  const yearStart = programDetails?.StartYear || new Date().getFullYear();
  const defaultFormData = useMemo(() => ({
    ComponentId: '',
    YearOfWork: yearStart,
    WorkTypeId: 0,
    InfraType: '',
  }), [yearStart]);

  const [formData, setFormData] = useState(defaultFormData);
  const { showToast } = useToast();

  // const [availableWorkTypes, setAvailableWorkTypes] = useState<ScopeOfWorkEnum[]>([]);

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

  // Initialize form data only when the dialog opens — avoids infinite loops
  // caused by object-ref deps (initialData inline object, programDetails) changing every render
  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialData) {
      setFormData(initialData);
    } else {
      setFormData(defaultFormData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // The lists include retired (inactive) values so saved rows can still show them (#479). New
  // picks see only active values; a saved row keeps its original values even if retired since --
  // its Type of Work only while its Infra Type is unchanged, as the API checks a changed row in full.
  const keptInfraType = mode === 'edit' && isSavedRow ? initialData?.InfraType : undefined;
  const keptWorkTypeId = keptInfraType && formData.InfraType === keptInfraType ? initialData?.WorkTypeId : undefined;

  const selectableWorkTypes = useMemo<ScopeOfWorkEnum[]>(
    () => filterKeepingSelected(dropDowns, scope => scope.IsActive !== false, 'Enum', keptWorkTypeId),
    [dropDowns, keptWorkTypeId]
  );

  // Update available work types when InfraType changes
  const availableWorkTypes = useMemo<ScopeOfWorkEnum[]>(() => {
    if (!formData.InfraType) return [];

    return selectableWorkTypes.filter(
      scope =>
        scope.InfraType.includes(formData.InfraType) &&
        (formData.ComponentId !== "ROW" ||
          scope.Description === "ROW Acquisition")
    );
  }, [formData.InfraType, formData.ComponentId, selectableWorkTypes]);


  const handleInputChange = (field: string, value: any) => {
    // If changing InfraType, reset WorkTypeId
    if (field === 'InfraType' && value !== formData.InfraType) {
      setFormData(prev => ({ ...prev, [field]: value, WorkTypeId: 0 }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleClose = () => {
    setFormData(defaultFormData);
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

    if (!formData.InfraType) {
      showToast({ type: 'error', message: 'Please select an infrastructure type.' });
      return;
    }

    if (formData.WorkTypeId === 0) {
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
  const infraTypeOptions: InfraTypeEnum[] = infraTypeEnums.length > 0
    ? filterKeepingSelected(infraTypeEnums, infraType => infraType.IsActive !== false, 'InfraCode', keptInfraType)
    : [...new Set(selectableWorkTypes.flatMap(scope => scope.InfraType))]
        .map((code, i) => ({ Id: i, InfraId: i, InfraCode: code, InfraName: code }));

  // Filter out already selected ComponentIds (but allow the current one when editing)
  const availableComponentCosts = componentCosts.filter(cost => {
    // Exclude deleted components
    if (cost.IsDeleted) {
      return false;
    }
    
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
                <span className="text-xs text-gray-500 ml-2">{isFieldEditable('ComponentId') ? '✓ Editable' : '✗ Not Editable'}</span>
              </label>
              <select
                value={formData.ComponentId}
                onChange={(e) => handleInputChange('ComponentId', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${
                  !isFieldEditable('ComponentId') ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!isFieldEditable('ComponentId')}
              >
                <option value="">Select Component</option>
                {availableComponentCosts.filter(cost => !cost.IsDeleted).map((cost) => (
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
                min={programDetails?.StartYear}
                max="2100"
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
                <span className="text-xs text-gray-500 ml-2">{isFieldEditable('WorkTypeId') ? '✓ Editable' : '✗ Not Editable'}</span>
              </label>
              <select
                value={formData.WorkTypeId}
                onChange={(e) => handleInputChange('WorkTypeId', parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm ${
                  !isFieldEditable('WorkTypeId') || !formData.InfraType ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                disabled={!isFieldEditable('WorkTypeId') || !formData.InfraType}
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
