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
import type { ProgramList } from '../../../Program/Model.d';
import type { FieldRules } from '../../Model';
import { getDisabledClass } from '../../../../utils/GlobalFunctions';
import { useMajorItemOfWorks } from '../../hooks/useMajorItemOfWorks';
import { useMajorItemLocations } from '../../hooks/useMajorItemLocations';

interface MajorItemOfWorksFormProps {
  majorItems: MajorItemOfWorksWithDropdown[];
  projectId: string;
  componentCosts: ComponentCost[];
  infraData?: InfraData;
  programDetails?: ProgramList;
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
      // console.log(`Item ${index} - WorkTypeId:`, item.WorkTypeId, 'InfraType:', item.InfraType, 'DropdownData length:', item.DropdownData?.length);
      if (item.InfraType) {
        /*const filtered = */dropDowns?.filter(x => x.InfraType.includes(item.InfraType));
        // console.log(`Filtered dropdowns for InfraType '${item.InfraType}':`, filtered);
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

    // Generate a unique temporary ReferenceId for the copied major item
    const tempReferenceId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create a copy of the major item with the new component ID (without locations initially)
    const copiedMajorItem: MajorItemOfWorksWithDropdown = {
      ...majorItemToCopy,
      Id: 0, // New item, so reset ID
      ComponentId: newComponentId, // Use the selected component
      ReferenceId: tempReferenceId, // New reference ID for linking
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
        Id: 0, // Reset ID for new location
        ParentId: tempReferenceId, // Link to new major item
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
    if (isAddingNewMajorItem) {
      // Generate a unique temporary ReferenceId for linking WorkLocations
      const tempReferenceId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new major item
      const newMajorItem: MajorItemOfWorksWithDropdown = {
        Id: 0, // Temporary ID
        ProjectId: projectId,
        ReferenceId: tempReferenceId, // Use generated temp ID
        ComponentId: majorItemData.ComponentId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeId: majorItemData.WorkTypeId,
        InfraType: majorItemData.InfraType,
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
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeId: majorItemData.WorkTypeId,
        InfraType: majorItemData.InfraType,
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
    const parentId = items[majorItemIndex].ReferenceId;
    if (!parentId) return;
    editWorkLocation(parentId, workLocationIndex, workLocation);
  };

  const handleDeleteWorkLocation = (majorItemIndex: number, workLocationIndex: number) => {
    const parentId = items[majorItemIndex].ReferenceId;
    if (!parentId) return;
    deleteWorkLocation(parentId, workLocationIndex);
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
              {/* <TableHeader className='min-w-[100px]'> Unit Cost</TableHeader> */}
              <TableHeader className="min-w-[100px]">Target Unit</TableHeader>
              <TableHeader className="min-w-[120px]">Work Locations</TableHeader>
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
                      {getWorkTypeDescription(item.WorkTypeId)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{getInfraName(item.InfraType)}</div>
                  </TableCell>
                  {/* <TableCell>
                    Unit cost here
                  </TableCell> */}
                  <TableCell>
                    <div className="text-sm">{getTargetUnitName(item.WorkTypeId)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {(item.MajorItemLocations?.length || 0)} Target(s)
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
                    <TableCell colSpan={8} className="p-4">
                      <WorkLocationTable
                        majorItemOfWorks={item}
                        workLocations={getLocationsByParentId(item.ReferenceId)}
                        onAdd={(workLocation) => handleAddWorkLocation(index, workLocation)}
                        onEdit={(workLocationIndex, workLocation) => 
                          handleEditWorkLocation(index, workLocationIndex, workLocation)
                        }
                        onDelete={(workLocationIndex) => handleDeleteWorkLocation(index, workLocationIndex)}
                        programDetails={programDetails}
                        infraData={infraData}
                        infraType={item.InfraType}
                        workTypeId={item.WorkTypeId}
                        targetUnit={item.TargetUnit}
                        maxAmount={getMinMaxAmounts(item.WorkTypeId).max}
                        minAmount={getMinMaxAmounts(item.WorkTypeId).min}
                        parentId={item.ReferenceId}
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
          WorkTypeId: items[editingMajorItemIndex].WorkTypeId,
          InfraType: items[editingMajorItemIndex].InfraType,
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
        majorItem={majorItemToDelete}
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
        componentCosts={componentCosts}
        existingMajorItems={items.map(item => ({ ComponentId: item.ComponentId }))}
      />
    </div>
  );
};

export default MajorItemOfWorksForm;
