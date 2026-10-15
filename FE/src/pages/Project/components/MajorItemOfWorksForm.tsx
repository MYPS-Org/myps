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
  InfraTypeEnum,
  MajorItemLocations,
} from '../Model.d';
import type { ProgramLatest } from '../../Program/Model';
import { getDisabledClass } from '../../../utils/GlobalFunctions';

interface MajorItemOfWorksFormProps {
  majorItems: MajorItemOfWorksWithDropdown[];
  projectId: string;
  componentCosts: ComponentCost[];
  infraData?: InfraData;
  programDetails?: ProgramLatest;
  onAdd: (newItem: MajorItemOfWorksWithDropdown) => void;
  onEdit: (index: number, updatedItem: MajorItemOfWorksWithDropdown) => void;
  onDelete: (index: number) => void;
  dropDowns?: ScopeOfWorkEnum[];
  infraTypeEnums?: InfraTypeEnum[];
  disabled?: boolean;
  deo?: string;
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
  dropDowns,
  infraTypeEnums = [],
  deo,
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
      if (item.InfraTypeFK) {
        /*const filtered = */dropDowns?.filter(x => x.InfraType.includes(item.InfraTypeFK));
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
        if (item.InfraTypeFK && (!item.DropdownData || item.DropdownData.length === 0)) {
          const filteredDropdowns = dropDowns.filter(x => x.InfraType.includes(item.InfraTypeFK));
          console.log(`Updating DropdownData for item ${index} with InfraType '${item.InfraTypeFK}':`, filteredDropdowns);
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
          if (item.InfraTypeFK && item.DropdownData && item.DropdownData.length > 0 && 
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
    WorkTypeFK: number;
    InfraTypeFK: string;
    IsDeleted: boolean;
  }) => {
    // Real ComponentCost.Id for the selected component; 0 when it can't be found
    // (e.g. the parent component is itself brand-new), which the backend correlates
    // by ComponentId instead.
    const componentCostId = componentCosts.find(c => c.ComponentId === majorItemData.ComponentId)?.Id ?? 0;

    if (isAddingNewMajorItem) {
      // Generate a unique temporary ReferenceId for linking WorkLocations

      // Create new major item
      const newMajorItem: MajorItemOfWorksWithDropdown = {
        Id: 0, // Temporary ID
        Source: 'Base',
        StageName: programDetails?.StageName || '',
        ProjectId: projectId,
        ProjectFK: projectId, // Use generated temp ID for linking work locations
        ComponentCostFK: componentCostId,
        ComponentId: majorItemData.ComponentId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeFK: majorItemData.WorkTypeFK,
        InfraTypeFK: majorItemData.InfraTypeFK,
        TargetUnitId: majorItemData.WorkTypeFK, // Same as WorkTypeFK for now
        TargetUnit: getTargetUnitName(majorItemData.WorkTypeFK),
        CreatedBy: '',
        DropdownData: dropDowns?.filter(x => x.InfraType.includes(majorItemData.InfraTypeFK)) || [],
        MajorItemLocations: [], // Initialize empty work locations array
        IsDeleted: majorItemData.IsDeleted,
      };
      
      // Pass the fully-built item straight to the parent in one atomic update.
      // (Previously this called onAdd(ComponentId) then guessed the new item's
      // index via setTimeout to onEdit it — a race that could overwrite the
      // wrong item when the parent's re-render didn't land within 10ms.)
      onAdd(newMajorItem);
    } else if (editingMajorItemIndex !== null) {
      // Update existing major item
      const updatedItem: MajorItemOfWorksWithDropdown = {
        ...majorItems[editingMajorItemIndex],
        ComponentCostFK: componentCostId,
        ComponentId: majorItemData.ComponentId,
        YearOfWork: majorItemData.YearOfWork,
        WorkTypeFK: majorItemData.WorkTypeFK,
        InfraTypeFK: majorItemData.InfraTypeFK,
        //TargetUnitId: majorItemData.WorkTypeFK,
        //TargetUnit: getTargetUnitName(majorItemData.WorkTypeFK),
        DropdownData: dropDowns?.filter(x => x.InfraType.includes(majorItemData.InfraTypeFK)) || [],
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
    // console.log('Looking for component with ID:', componentId, 'in componentCosts:', componentCosts);
    const component = componentCosts?.find(cost => cost.ComponentId === componentId);
    // console.log('Found component:', component);
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

  const getInfraTypeName = (infraCode: string): string => {
    const infraType = infraTypeEnums.find(x => x.InfraCode === infraCode);
    return infraType?.InfraName || infraCode;
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
                      {getWorkTypeDescription(item.WorkTypeFK)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{getInfraTypeName(item.InfraTypeFK)}</div>
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
                        infraType={item.InfraTypeFK}
                        workTypeId={item.WorkTypeFK}
                        targetUnit={item.TargetUnit}
                        maxAmount={getMinMaxAmounts(item.WorkTypeFK).max}
                        minAmount={getMinMaxAmounts(item.WorkTypeFK).min}
                        parentId={item.ComponentId}
                        infraTypeEnums={infraTypeEnums}
                        dropDowns={dropDowns}
                        disabled={disabled}
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
          ComponentId: majorItems[editingMajorItemIndex].ComponentId,
          YearOfWork: majorItems[editingMajorItemIndex].YearOfWork,
          WorkTypeFK: majorItems[editingMajorItemIndex].WorkTypeFK,
          InfraTypeFK: majorItems[editingMajorItemIndex].InfraTypeFK,
          IsDeleted: majorItems[editingMajorItemIndex].IsDeleted,
        } : undefined}
        existingMajorItems={majorItems.filter(item => !item.IsDeleted).map(item => ({ ComponentId: item.ComponentId }))}
        programDetails={programDetails}
      />

      {/* Delete Major Item Dialog */}
      <DeleteMajorItemDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirmDelete={handleConfirmDelete}
        majorItem={deletingMajorItem ? {
          ComponentId: deletingMajorItem.ComponentId,
          WorkTypeFK: deletingMajorItem.WorkTypeFK,
          YearOfWork: deletingMajorItem.YearOfWork,
          InfraTypeFK: getInfraTypeName(deletingMajorItem.InfraTypeFK),
          TargetUnitId: deletingMajorItem.TargetUnitId,
          TargetUnit: deletingMajorItem.TargetUnit,
          MajorItemLocations: deletingMajorItem.MajorItemLocations
        } : null}
        deleteIndex={deletingIndex}
      />
    </div>
  );
};

export default MajorItemOfWorksForm;
