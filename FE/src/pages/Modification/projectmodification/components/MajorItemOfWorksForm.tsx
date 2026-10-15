import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon, ChevronDownIcon, ChevronRightIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '../../../../components/tailwindui/table';
import AddMajorItemDialog from '../../dialogs/AddMajorItemDialog';
import DeleteMajorItemDialog from '../../dialogs/deleteDialog/DeleteMajorItemDialog';
import CopyMajorItemDialog from '../../dialogs/CopyMajorItemDialog';
import WorkLocationTable from './WorkLocationTable';
import type { 
  MajorItemOfWorksWithDropdown, 
  ComponentCost, 
  InfraData, 
  ScopeOfWorkEnum,
  InfraTypeEnum,
  MajorItemLocations,
} from '../../../Project/Model.d';
import type { ProgramLatest } from '../../../Program/Model.d';
import type { FieldRules } from '../../Model';
import { getDisabledClass, generateTempId } from '../../../../utils/GlobalFunctions';
import { useMajorItemOfWorks } from '../../hooks/useMajorItemOfWorks';
import { useMajorItemLocations } from '../../hooks/useMajorItemLocations';

interface MajorItemOfWorksFormProps {
  majorItems: MajorItemOfWorksWithDropdown[];
  projectId: string;
  projectFK?: string;
  componentCosts: ComponentCost[];
  infraData?: InfraData;
  programDetails?: ProgramLatest;
  onAdd?: (newItem: MajorItemOfWorksWithDropdown) => void;
  onEdit?: (index: number, updatedItem: MajorItemOfWorksWithDropdown) => void;
  onDelete?: (index: number) => void;
  dropDowns?: ScopeOfWorkEnum[];
  infraTypeEnums?: InfraTypeEnum[];
  fieldRules?: FieldRules | null;
  deo?: string;
}

const MajorItemOfWorksForm: React.FC<MajorItemOfWorksFormProps> = ({
  majorItems: propMajorItems,
  projectId,
  projectFK,
  componentCosts,
  infraData,
  programDetails,
  onAdd: propOnAdd,
  onEdit: propOnEdit,
  onDelete: propOnDelete,
  dropDowns,
  infraTypeEnums,
  fieldRules,
  deo,
}) => {
  const { addMajorItem: hookAdd, editMajorItem: hookEdit, deleteMajorItem: hookDelete, majorItems: hookItems } = useMajorItemOfWorks();
  const { getLocationsByParentId, addWorkLocation, editWorkLocation, deleteWorkLocation } = useMajorItemLocations();
  const [majorItemDialogOpen, setMajorItemDialogOpen] = useState(false);
  const [editingMajorItemIndex, setEditingMajorItemIndex] = useState<number | null>(null);
  const [deletingMajorItemIndex, setDeletingMajorItemIndex] = useState<number | null>(null);
  const [isAddingNewMajorItem, setIsAddingNewMajorItem] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [majorItemToDelete, setMajorItemToDelete] = useState<MajorItemOfWorksWithDropdown | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [majorItemToCopy, setMajorItemToCopy] = useState<MajorItemOfWorksWithDropdown | null>(null);

  // Use props if provided, otherwise fallback to hook
  const items = propMajorItems ?? hookItems;

  // Unified handlers that call either props or hook functions
  const callAdd = (item: MajorItemOfWorksWithDropdown) => {
    if (propOnAdd) return propOnAdd(item);
    return hookAdd(item);
  };
  const callEdit = (index: number, item: MajorItemOfWorksWithDropdown) => {
    if (propOnEdit) {
      return propOnEdit(index, item);
    }
    return hookEdit(index, item);
  };
  const callDelete = (index: number) => {
    if (propOnDelete) return propOnDelete(index);
    return hookDelete(index);
  };

  // Debug: Monitor when items prop changes
  useEffect(() => {
    // console.log('MajorItemOfWorksForm: items prop changed:', items);
    // console.log('Available dropDowns:', dropDowns);
    items.forEach((item/*, index*/) => {
      // console.log(`Item ${index} - WorkTypeFK:`, item.WorkTypeFK, 'InfraTypeFK:', item.InfraTypeFK, 'DropdownData length:', item.DropdownData?.length);
      if (item.InfraTypeFK) {
        /*const filtered = */dropDowns?.filter(x => x.InfraType.includes(item.InfraTypeFK));
        // console.log(`Filtered dropdowns for InfraType '${item.InfraTypeFK}':`, filtered);
      }
    });
  }, [items, dropDowns]);

  // NOTE: DropdownData is already computed by MajorItemOfWorksWithDropdownAtom (from ScopeOfWorkEnumAtom).
  // No useEffect needed here — the atom handles it reactively without causing loops.

  // Check CRUD permissions from fieldRules
  const canAddMajorItem = useCallback(() => {
    // If no fieldRules, default to denying add
    if (!fieldRules) return false;
    
    // If MajorItemOfWorkRules doesn't exist, default to denying add
    if (!fieldRules.MajorItemOfWorkRules) return false;
    
    // If CRUD doesn't exist, default to denying add
    if (!fieldRules.MajorItemOfWorkRules.CRUD) return false;
    
    // Return the CanAdd value, defaulting to false if undefined or null
    return fieldRules.MajorItemOfWorkRules.CRUD.CanAdd ?? false;
  }, [fieldRules]);

  const canDeleteMajorItem = useCallback(() => {
    // If no fieldRules, default to denying delete
    if (!fieldRules) return false;
    
    // If MajorItemOfWorkRules doesn't exist, default to denying delete
    if (!fieldRules.MajorItemOfWorkRules) return false;
    
    // If CRUD doesn't exist, default to denying delete
    if (!fieldRules.MajorItemOfWorkRules.CRUD) return false;
    
    // Return the CanDelete value, defaulting to false if undefined or null
    return fieldRules.MajorItemOfWorkRules.CRUD.CanDelete ?? false;
  }, [fieldRules]);

  const handleAddMajorItem = () => {
    setIsAddingNewMajorItem(true);
    setEditingMajorItemIndex(null);
    setMajorItemDialogOpen(true);
  };

  const handleEditMajorItem = (index: number) => {
    setIsAddingNewMajorItem(false);
    setEditingMajorItemIndex(index);
    setMajorItemDialogOpen(true);
  };

  const handleDeleteMajorItem = (index: number) => {
    setIsDeleteOpen(true);
    setDeletingMajorItemIndex(index);
    setMajorItemToDelete(items[index]);
  };

  const handleConfirmDeleteMajorItem = (index: number) => {
    callDelete(index);
    setIsDeleteOpen(false);
    setDeletingMajorItemIndex(null);
    setMajorItemToDelete(null);
  };

  const handleCopyMajorItem = (index: number) => {
    setMajorItemToCopy(items[index]);
    setIsCopyDialogOpen(true);
  };

  const handleConfirmCopyMajorItem = (newComponentId: string) => {
    if (!majorItemToCopy) return;

    // Real ComponentCost.Id for the selected component; 0 when it can't be found.
    const componentCostId = componentCosts.find(c => c.ComponentId === newComponentId)?.Id ?? 0;
    // Unique temp Id so the copied item stays distinguishable from any other
    // unsaved major item — work locations link back to it via WorkItemFK.
    const newItemId = generateTempId();

    // Create a copy of the major item with the new component ID (without locations initially)
    const copiedMajorItem: MajorItemOfWorksWithDropdown = {
      ...majorItemToCopy,
      Id: newItemId, // New item, so reset ID
      ComponentId: newComponentId, // Use the selected component
      ComponentCostFK: componentCostId,
      MajorItemLocations: [], // Will be added separately via atoms
      CreatedBy: '', // Will be set on save
      IsDeleted: false,
    };

    // Add the copied major item first
    callAdd(copiedMajorItem);

    // Then add all work locations separately using the hook
    const locationsToAdd = majorItemToCopy.MajorItemLocations?.filter(loc => !loc.IsDeleted) || [];
    locationsToAdd.forEach(location => {
      const copiedLocation: MajorItemLocations = {
        ...location,
        Id: generateTempId(), // Reset ID for new location
        WorkItemFK: newItemId, // Link to new major item
        IsDeleted: false,
      };

      // Add each location via the hook
      addWorkLocation(copiedLocation);
    });

    // Close dialog
    setIsCopyDialogOpen(false);
    setMajorItemToCopy(null);
  };

  const handleMajorItemDialogSubmit = (majorItemData: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
  }) => {
    // Real ComponentCost.Id for the selected component; 0 when it can't be found
    // (e.g. the parent component is itself brand-new), which the backend correlates
    // by ComponentId instead.
    const componentCostId = componentCosts.find(c => c.ComponentId === majorItemData.ComponentId)?.Id ?? 0;

    if (isAddingNewMajorItem) {
      // Source is [Required] on the backend's revision-scoped MajorWorkItem model — an
      // empty string fails validation. Carry through an existing sibling component's Source
      // (mirrors the ComponentCostDialog default-Source pattern).
      const defaultSource = componentCosts.find(c => c.Source)?.Source || '';
      // Create new major item
      const newMajorItem: MajorItemOfWorksWithDropdown = {
        Id: generateTempId(), // Temporary Id
        Source: defaultSource,
        ComponentCostFK: componentCostId,
        ProjectFK: projectFK || '',
        ProjectId: projectId,
        StageName: programDetails?.StageName || '',
        ComponentId: majorItemData.ComponentId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeFK: majorItemData.WorkTypeId,
        InfraTypeFK: majorItemData.InfraType,
        TargetUnitId: majorItemData.WorkTypeId, // Same as WorkTypeId for now
        TargetUnit: getTargetUnitName(majorItemData.WorkTypeId),
        CreatedBy: '',
        DropdownData: dropDowns?.filter(x => x.InfraType.includes(majorItemData.InfraType)) || [],
        MajorItemLocations: [], // Initialize empty work locations array
        IsDeleted: false,
      };

      // Call unified add handler with complete item
      callAdd(newMajorItem);
    } else if (editingMajorItemIndex !== null) {
      // Update existing major item
      const updatedItem: MajorItemOfWorksWithDropdown = {
        ...items[editingMajorItemIndex],
        ComponentId: majorItemData.ComponentId,
        ComponentCostFK: componentCostId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeFK: majorItemData.WorkTypeId,
        InfraTypeFK: majorItemData.InfraType,
        TargetUnitId: majorItemData.WorkTypeId,
        TargetUnit: getTargetUnitName(majorItemData.WorkTypeId),
        DropdownData: dropDowns?.filter(x => x.InfraType.includes(majorItemData.InfraType)) || [],
      };
      callEdit(editingMajorItemIndex, updatedItem);
    }

    setMajorItemDialogOpen(false);
    setEditingMajorItemIndex(null);
    setIsAddingNewMajorItem(false);
  };

  const getTargetUnitName = (workTypeId: number): string => {
    const targetUnit = dropDowns?.find(option => option.Enum === workTypeId);
    return targetUnit?.Measure?.toString() || '';
  };

  const getWorkTypeDescription = (workTypeId: number): string => {
    const workType = dropDowns?.find(option => option.Enum === workTypeId);
    return workType?.Description || '';
  };

  const getComponentDescription = (componentId: string): string => {
    const component = componentCosts?.find(cost => cost.ComponentId === componentId);
    // Return the description or the componentId as fallback
    return component?.ComponentId || component?.ComponentId || componentId || 'Unknown Component';
  };

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // Work Location handlers - now using dedicated hook for better performance
  const handleAddWorkLocation = (_majorItemIndex: number, workLocation: MajorItemLocations) => {
    addWorkLocation(workLocation);
  };

  const handleEditWorkLocation = (majorItemIndex: number, workLocationIndex: number, workLocation: MajorItemLocations) => {
    const workItemId = items[majorItemIndex].Id;
    editWorkLocation(workItemId, workLocationIndex, workLocation);
  };

  const handleDeleteWorkLocation = (majorItemIndex: number, workLocationIndex: number) => {
    const workItemId = items[majorItemIndex].Id;
    deleteWorkLocation(workItemId, workLocationIndex);
  };

  const getMinMaxAmounts = (workTypeId: number) => {
    const workType = dropDowns?.find(option => option.Enum === workTypeId);
    return {
      max: workType?.MaxAmount,
      min: workType?.MinAmount
    };
  };

  const getInfraName = (infraTypeCode: string): string => {
    const infraType = infraTypeEnums?.find(infra => infra.InfraCode === infraTypeCode);
    return infraType?.InfraName || infraTypeCode;
  }

  // Calculate total physical target for a major item
  const getTotalPhysicalTarget = (majorItem: MajorItemOfWorksWithDropdown): number => {
    return getLocationsByParentId(majorItem.Id)
      .filter(location => !location.IsDeleted)
      .reduce((total, location) => total + (location.PhysicalTarget || 0), 0);
  };

  // Calculate per unit cost for a major item
  const getPerUnitCost = (majorItem: MajorItemOfWorksWithDropdown): number => {
    const totalPhysicalTarget = getTotalPhysicalTarget(majorItem);
    if (totalPhysicalTarget === 0) return 0;

    const componentCost = componentCosts?.find(cost => cost.ComponentId === majorItem.ComponentId);
    if (!componentCost || !componentCost.Total) return 0;

    return componentCost.Total / totalPhysicalTarget;
  };

  // Format currency helper function
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Major Item of Work</h2>
        <Button 
          color="blue" 
          onClick={handleAddMajorItem} 
          disabled={!canAddMajorItem()}
          className={getDisabledClass(!canAddMajorItem())}
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Major Item
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="min-w-[40px]"></TableHeader>
              <TableHeader className="min-w-[120px]">Component</TableHeader>
              <TableHeader className="min-w-[100px]">Year of Work</TableHeader>
              <TableHeader className="min-w-[140px]">Type of Work</TableHeader>
              <TableHeader className='min-w-[100px]'> Infra Type</TableHeader>
              <TableHeader className='min-w-[120px]'>Unit Cost</TableHeader>
              <TableHeader className="min-w-[100px]">Target Unit</TableHeader>
              <TableHeader className="min-w-[100px]">Total Unit</TableHeader>
              <TableHeader className="min-w-[80px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => {
              if (item.IsDeleted) return null;
              return (
              <React.Fragment key={item.Id || index}>
                <TableRow className="border-b">
                  <TableCell>
                    <button
                      onClick={() => toggleRowExpansion(index)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {expandedRows.has(index) ? (
                        <ChevronDownIcon className="w-4 h-4" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {getComponentDescription(item.ComponentId)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{item.YearOfWork}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {getWorkTypeDescription(item.WorkTypeFK)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{getInfraName(item.InfraTypeFK)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      ₱{formatCurrency(getPerUnitCost(item))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{getTargetUnitName(item.WorkTypeFK)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-blue-600">
                      {getTotalPhysicalTarget(item).toLocaleString('en-PH')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getLocationsByParentId(item.Id).filter(loc => !loc.IsDeleted).length} location(s)
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        color="blue"
                        onClick={() => handleEditMajorItem(index)}
                        className="text-xs px-2 py-1"
                        title="Edit"
                      >
                        <PencilIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        color="cyan"
                        onClick={() => handleCopyMajorItem(index)}
                        className="text-xs px-2 py-1"
                        title="Copy to another component"
                      >
                        <DocumentDuplicateIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        color="red"
                        onClick={() => handleDeleteMajorItem(index)}
                        className={`text-xs px-2 py-1 ${getDisabledClass(!canDeleteMajorItem())}`}
                        disabled={!canDeleteMajorItem()}
                        title="Delete"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                
                {/* Expanded row for work locations */}
                {expandedRows.has(index) && (
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={9} className="p-4">
                      <WorkLocationTable
                        majorItemOfWorks={item}
                        workLocations={getLocationsByParentId(item.Id)}
                        onAdd={(workLocation) => handleAddWorkLocation(index, workLocation)}
                        onEdit={(workLocationIndex, workLocation) =>
                          handleEditWorkLocation(index, workLocationIndex, workLocation)
                        }
                        onDelete={(workLocationIndex) => handleDeleteWorkLocation(index, workLocationIndex)}
                        programDetails={programDetails}
                        infraData={infraData}
                        infraType={item.InfraTypeFK}
                        workTypeId={item.WorkTypeFK}
                        targetUnit={item.TargetUnit}
                        maxAmount={getMinMaxAmounts(item.WorkTypeFK).max}
                        minAmount={getMinMaxAmounts(item.WorkTypeFK).min}
                        parentId={item.Id}
                        infraTypeEnums={infraTypeEnums}
                        dropDowns={dropDowns}
                        disabled={false}
                        fieldRules={fieldRules}
                        deo={deo}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
            })}
            </TableBody>
        </Table>
      </div>

      {/* Add Major Item Dialog */}
      <AddMajorItemDialog
        isOpen={majorItemDialogOpen}
        onClose={() => {
          setMajorItemDialogOpen(false);
          setEditingMajorItemIndex(null);
          setIsAddingNewMajorItem(false);
        }}
        onAdd={handleMajorItemDialogSubmit}
        componentCosts={componentCosts}
        dropDowns={dropDowns}
        infraTypeEnums={infraTypeEnums}
        mode={isAddingNewMajorItem ? 'add' : 'edit'}
        initialData={editingMajorItemIndex !== null ? {
          ComponentId: items[editingMajorItemIndex].ComponentId,
          YearOfWork: items[editingMajorItemIndex].YearOfWork,
          WorkTypeId: items[editingMajorItemIndex].WorkTypeFK,
          InfraType: items[editingMajorItemIndex].InfraTypeFK,
        } : undefined}
        existingMajorItems={items.map(item => ({ ComponentId: item.ComponentId }))}
        programDetails={programDetails}
      />
      
      {/* Delete Confirmation Dialog */}
      <DeleteMajorItemDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingMajorItemIndex(null);
          setMajorItemToDelete(null);
        }}
        onConfirmDelete={handleConfirmDeleteMajorItem}
        majorItem={majorItemToDelete ? {
          ComponentId: majorItemToDelete.ComponentId,
          WorkTypeId: majorItemToDelete.WorkTypeFK,
          YearOfWork: majorItemToDelete.YearOfWork,
          InfraType: getInfraName(majorItemToDelete.InfraTypeFK),
          TargetUnit: majorItemToDelete.TargetUnit,
          MajorItemLocations: majorItemToDelete.MajorItemLocations,
        } : null}
        deleteIndex={deletingMajorItemIndex}
      />

      {/* Copy Major Item Dialog */}
      <CopyMajorItemDialog
        isOpen={isCopyDialogOpen}
        onClose={() => {
          setIsCopyDialogOpen(false);
          setMajorItemToCopy(null);
        }}
        onConfirm={handleConfirmCopyMajorItem}
        majorItemToCopy={majorItemToCopy}
        infraTypeEnums={infraTypeEnums}
        componentCosts={componentCosts}
        existingMajorItems={items.map(item => ({ ComponentId: item.ComponentId }))}
      />
    </div>
  );
};

export default MajorItemOfWorksForm;
