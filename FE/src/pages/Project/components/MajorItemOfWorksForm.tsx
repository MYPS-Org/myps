import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '../../../components/tailwindui/table';
import AddMajorItemDialog from '../dialogs/AddMajorItemDialog';
import DeleteMajorItemDialog from '../dialogs/deleteDialogs/DeleteMajorItemDialog';
import WorkLocationTable from './WorkLocationTable';
import type { 
  MajorItemOfWorksWithDropdown, 
  ComponentCost, 
  InfraData, 
  ScopeOfWorkEnum,
  MajorItemLocations,
} from '../Model.d';
import type { ProgramList } from '../../Program/Model';
import { getDisabledClass } from '../../../utils/GlobalFunctions';

interface MajorItemOfWorksFormProps {
  majorItems: MajorItemOfWorksWithDropdown[];
  projectId: string;
  componentCosts: ComponentCost[];
  infraData?: InfraData;
  programDetails?: ProgramList;
  onAdd: () => void;
  onEdit: (index: number, updatedItem: MajorItemOfWorksWithDropdown) => void;
  onDelete: (index: number) => void;
  dropDowns?: ScopeOfWorkEnum[];
  disabled?: boolean;
}

const MajorItemOfWorksForm: React.FC<MajorItemOfWorksFormProps> = ({
  majorItems,
  projectId,
  componentCosts,
  infraData,
  programDetails,
  onAdd,
  onEdit,
  onDelete,
  disabled = false,
  dropDowns
}) => {
  const [majorItemDialogOpen, setMajorItemDialogOpen] = useState(false);
  const [editingMajorItemIndex, setEditingMajorItemIndex] = useState<number | null>(null);
  const [isAddingNewMajorItem, setIsAddingNewMajorItem] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingMajorItem, setDeletingMajorItem] = useState<MajorItemOfWorksWithDropdown | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // Debug: Monitor when majorItems prop changes
  useEffect(() => {
    // console.log('MajorItemOfWorksForm: majorItems prop changed:', majorItems);
    // console.log('Available dropDowns:', dropDowns);
    majorItems.forEach((item/*, index*/) => {
      // console.log(`Item ${index} - WorkTypeId:`, item.WorkTypeId, 'InfraType:', item.InfraType, 'DropdownData length:', item.DropdownData?.length);
      if (item.InfraType) {
        /*const filtered = */dropDowns?.filter(x => x.InfraType === item.InfraType);
        // console.log(`Filtered dropdowns for InfraType '${item.InfraType}':`, filtered);
      }
    });
  }, [majorItems, dropDowns]);

  // Debug: Monitor when componentCosts prop changes
  useEffect(() => {
    console.log('MajorItemOfWorksForm: componentCosts prop changed:', componentCosts);
    console.log('ComponentCosts count:', componentCosts?.length || 0);
  }, [componentCosts]);

  // Update dropdown data for items that have InfraType but no DropdownData (from backend)
  useEffect(() => {
    if (majorItems.length > 0 && dropDowns?.length) {
      let hasUpdates = false;
      const updatedItems = majorItems.map((item, index) => {
        // If item has InfraType but no or empty DropdownData, update it
        if (item.InfraType && (!item.DropdownData || item.DropdownData.length === 0)) {
          const filteredDropdowns = dropDowns.filter(x => x.InfraType === item.InfraType);
          console.log(`Updating DropdownData for item ${index} with InfraType '${item.InfraType}':`, filteredDropdowns);
          hasUpdates = true;
          return {
            ...item,
            DropdownData: filteredDropdowns,
          };
        }
        return item;
      });
      
      if (hasUpdates) {
        console.log('Updating majorItems with proper DropdownData');
        // We need to call onEdit for each updated item
        updatedItems.forEach((item, index) => {
          if (item.InfraType && item.DropdownData && item.DropdownData.length > 0 && 
              (!majorItems[index].DropdownData || majorItems[index].DropdownData.length === 0)) {
            onEdit(index, item);
          }
        });
      }
    }
  }, [majorItems, dropDowns, onEdit]);

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

  const handleOpenDeleteDialog = (index: number) => {
    setDeletingMajorItem(majorItems[index]);
    setDeletingIndex(index);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingMajorItem(null);
    setDeletingIndex(null);
  };

  const handleConfirmDelete = (index: number) => {
    onDelete(index);
    handleCloseDeleteDialog();
  };

  const handleMajorItemDialogSubmit = (majorItemData: {
    ComponentId: string;
    YearOfWork: number;
    WorkTypeId: number;
    InfraType: string;
    IsDeleted: boolean;
  }) => {
    if (isAddingNewMajorItem) {
      // Generate a unique temporary ReferenceId for linking WorkLocations
      const tempReferenceId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new major item
      const newMajorItem: MajorItemOfWorksWithDropdown = {
        Id: 0, // Temporary ID
        ProjectId: projectId,
        ReferenceId: tempReferenceId, // Use generated temp ID for linking work locations
        ComponentId: majorItemData.ComponentId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeId: majorItemData.WorkTypeId,
        InfraType: majorItemData.InfraType,
        TargetUnitId: majorItemData.WorkTypeId, // Same as WorkTypeId for now
        TargetUnit: getTargetUnitName(majorItemData.WorkTypeId),
        CreatedBy: '',
        DropdownData: dropDowns?.filter(x => x.InfraType === majorItemData.InfraType) || [],
        MajorItemLocations: [], // Initialize empty work locations array
        IsDeleted: majorItemData.IsDeleted,
      };
      
      // Use the parent's onAdd method first, then update the last item
      onAdd();
      
      // We need to wait for the parent to update the majorItems array, then update it
      setTimeout(() => {
        const lastIndex = majorItems.length; // This will be the index of the new item
        onEdit(lastIndex, newMajorItem);
      }, 10);
    } else if (editingMajorItemIndex !== null) {
      // Update existing major item
      const updatedItem: MajorItemOfWorksWithDropdown = {
        ...majorItems[editingMajorItemIndex],
        ComponentId: majorItemData.ComponentId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeId: majorItemData.WorkTypeId,
        InfraType: majorItemData.InfraType,
        TargetUnitId: majorItemData.WorkTypeId,
        TargetUnit: getTargetUnitName(majorItemData.WorkTypeId),
        DropdownData: dropDowns?.filter(x => x.InfraType === majorItemData.InfraType) || [],
      };
      onEdit(editingMajorItemIndex, updatedItem);
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
    console.log('Looking for component with ID:', componentId, 'in componentCosts:', componentCosts);
    const component = componentCosts?.find(cost => cost.ComponentId === componentId);
    console.log('Found component:', component);
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

  // Work Location handlers
  const handleAddWorkLocation = (majorItemIndex: number, workLocation: MajorItemLocations) => {
    const updatedItem = {
      ...majorItems[majorItemIndex],
      MajorItemLocations: [...(majorItems[majorItemIndex].MajorItemLocations || []), workLocation]
    };
    onEdit(majorItemIndex, updatedItem);
  };

  const handleEditWorkLocation = (majorItemIndex: number, workLocationIndex: number, workLocation: MajorItemLocations) => {
    const updatedWorkLocations = [...(majorItems[majorItemIndex].MajorItemLocations || [])];
    updatedWorkLocations[workLocationIndex] = workLocation;
    
    const updatedItem = {
      ...majorItems[majorItemIndex],
      MajorItemLocations: updatedWorkLocations
    };
    onEdit(majorItemIndex, updatedItem);
  };

  const handleDeleteWorkLocation = (majorItemIndex: number, workLocationIndex: number) => {
    const locationToDelete = majorItems[majorItemIndex].MajorItemLocations?.[workLocationIndex];
    
    let updatedWorkLocations;
    if (locationToDelete?.Id === 0) {
      // Hard delete for new items not yet saved to database
      updatedWorkLocations = (majorItems[majorItemIndex].MajorItemLocations || []).filter((_, i) => i !== workLocationIndex);
    } else {
      // Soft delete for existing database items
      updatedWorkLocations = (majorItems[majorItemIndex].MajorItemLocations || []).map((loc, i) => 
        i === workLocationIndex ? { ...loc, IsDeleted: true } : loc
      );
    }
    
    const updatedItem = {
      ...majorItems[majorItemIndex],
      MajorItemLocations: updatedWorkLocations
    };
    onEdit(majorItemIndex, updatedItem);
  };

  const getMinMaxAmounts = (workTypeId: number) => {
    const workType = dropDowns?.find(option => option.Enum === workTypeId);
    return {
      max: workType?.MaxAmount,
      min: workType?.MinAmount
    };
  };

  // Calculate total physical target for a major item
  const getTotalPhysicalTarget = (majorItem: MajorItemOfWorksWithDropdown): number => {
    return majorItem.MajorItemLocations
      ?.filter(location => !location.IsDeleted)
      .reduce((total, location) => {
        return total + (location.PhysicalTarget || 0);
      }, 0) || 0;
  };

  // Calculate per unit cost for a major item
  const getPerUnitCost = (majorItem: MajorItemOfWorksWithDropdown): number => {
    const totalPhysicalTarget = getTotalPhysicalTarget(majorItem);
    if (totalPhysicalTarget === 0) return 0;
    
    // Find the corresponding component cost
    const componentCost = componentCosts?.find(cost => cost.ComponentId === majorItem.ComponentId);
    if (!componentCost || !componentCost.Amount) return 0;
    
    return componentCost.Amount / totalPhysicalTarget;
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
        <Button color="blue" onClick={handleAddMajorItem} disabled={disabled}>
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
              <TableHeader className='min-w-[100px]'>Infra Type</TableHeader>
              <TableHeader className='min-w-[120px]'>Unit Cost</TableHeader>
              <TableHeader className="min-w-[100px]">Target Unit</TableHeader>
              <TableHeader className="min-w-[100px]">Total Unit</TableHeader>
              {/* <TableHeader className="min-w-[120px]">Work Locations</TableHeader> */}
              <TableHeader className="min-w-[80px]">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {majorItems.map((item, index) => {
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
                    <div className="text-sm">{item.InfraType}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      ₱{formatCurrency(getPerUnitCost(item))}
                    </div>
                    <div className="text-xs text-gray-500">per {getTargetUnitName(item.WorkTypeId)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{getTargetUnitName(item.WorkTypeId)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-blue-600">
                      {getTotalPhysicalTarget(item).toLocaleString('en-PH')} {getTargetUnitName(item.WorkTypeId)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(item.MajorItemLocations?.length || 0)} location(s)
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        color="blue"
                        onClick={() => handleEditMajorItem(index)}
                        className={`text-xs px-2 py-1 ${getDisabledClass(disabled)}`}
                        disabled={disabled}
                      >
                        <PencilIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        color="red"
                        onClick={() => handleOpenDeleteDialog(index)}
                        className={`text-xs px-2 py-1 ${getDisabledClass(disabled)}`}
                        disabled={disabled}
                      >
                        <TrashIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                
                {/* Expanded row for work locations */}
                {expandedRows.has(index) && (
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={10} className="p-4">
                      <WorkLocationTable
                        majorItemOfWorks={item}
                        workLocations={item.MajorItemLocations || []}
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
                        disabled={disabled}
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
        mode={isAddingNewMajorItem ? 'add' : 'edit'}
        initialData={editingMajorItemIndex !== null ? {
          ComponentId: majorItems[editingMajorItemIndex].ComponentId,
          YearOfWork: majorItems[editingMajorItemIndex].YearOfWork,
          WorkTypeId: majorItems[editingMajorItemIndex].WorkTypeId,
          InfraType: majorItems[editingMajorItemIndex].InfraType,
          IsDeleted: majorItems[editingMajorItemIndex].IsDeleted,
        } : undefined}
        existingMajorItems={majorItems.map(item => ({ ComponentId: item.ComponentId }))}
        programDetails={programDetails}
      />

      {/* Delete Major Item Dialog */}
      <DeleteMajorItemDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirmDelete={handleConfirmDelete}
        majorItem={deletingMajorItem ? {
          ComponentId: deletingMajorItem.ComponentId,
          WorkTypeId: deletingMajorItem.WorkTypeId,
          YearOfWork: deletingMajorItem.YearOfWork,
          InfraType: deletingMajorItem.InfraType,
          TargetUnit: deletingMajorItem.TargetUnit,
          MajorItemLocations: deletingMajorItem.MajorItemLocations
        } : null}
        deleteIndex={deletingIndex}
      />
    </div>
  );
};

export default MajorItemOfWorksForm;
