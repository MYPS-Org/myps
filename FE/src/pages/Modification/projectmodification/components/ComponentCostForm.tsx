import React, { useState, useCallback } from "react";
import type { ComponentCost, ComponentCostWithYears, ComponentCostYear } from "../../../Project/Model.d";
import type { FieldRules } from "../../Model";
import { Button } from "../../../../components/tailwindui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../../components/tailwindui/table";
import ComponentCostDialog from "../../dialogs/ComponentCostDialog";
import { getDisabledClass } from "../../../../utils/GlobalFunctions";

interface ComponentCostFormProps {
  componentCosts: ComponentCostWithYears[];
  onAdd: (cost: ComponentCost, costYear?: ComponentCostYear) => void;
  onEdit: (index: number, updatedCost: ComponentCost) => void;
  onDelete: (index: number) => void;
  initialData?: any;
  maxAmountCost?: number;
  disabled?: boolean;
  fieldPermissions?: any;
  fieldRules?: FieldRules;
  category?: string;
  reason?: string;
  reasonId?: number;
  // Removed: currentCase, pcmaStatus, packageStatus - now from Jotai in ComponentCostDialog
}

const ComponentCostForm: React.FC<ComponentCostFormProps> = ({ 
  componentCosts, 
  onAdd, 
  onEdit, 
  onDelete,
  initialData,
  maxAmountCost,
  disabled = false,
  fieldPermissions,
  fieldRules,
  category,
  reason,
  reasonId,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };
    // console.log('Rine => ', initialData)
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingIndex(null);
    // console.log('componentTypes:', initialData?.Dropdowns?.ComponentTypes);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (index: number) => {
    setModalMode('edit');
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const isFieldEditable = useCallback((fieldName: string) => {
      if (!fieldPermissions) {
          return !disabled;
      }
      
      const isEditable = fieldPermissions.editableFields?.includes(fieldName);
      
      return isEditable && disabled; // Fixed: should be !disabled, not disabled
  }, [fieldPermissions, disabled]);

  // Check if a component cost is from database (has real Id > 0) or newly added (Id = 0 or temp ReferenceId)
  const isFromDatabase = useCallback((cost: ComponentCost) => {
    // If Id > 0, it's from database
    if (cost.Id && cost.Id > 0) {
      return true;
    }
    // If ReferenceId doesn't start with 'temp' or is a timestamp string, it might be from DB
    // Newly added items have ReferenceId like: Date.now().toString() or 'temp_...'
    if (cost.ReferenceId && (cost.ReferenceId.startsWith('temp_') || /^\d+$/.test(cost.ReferenceId))) {
      return false; // This is a newly added item
    }
    return true; // Default to assuming it's from DB to be safe
  }, []);

  // Check if user can add component cost
  const canAddComponentCost = useCallback(() => {
    return fieldRules?.ComponentCostRules?.CRUD?.CanAdd ?? true;
  }, [fieldRules]);

  // Check if delete button should be enabled for a specific component cost
  const canDelete = useCallback((cost: ComponentCost) => {
    // Exception: If component is NOT from database (newly added), always allow delete
    if (!isFromDatabase(cost)) {
      return true;
    }
    
    // For components from database, check CRUD permission
    const hasCRUDPermission = fieldRules?.ComponentCostRules?.CRUD?.CanDelete ?? false;
    
    // If user has CRUD permission, they can delete even database items
    if (hasCRUDPermission) {
      return true;
    }
    
    // Database items cannot be deleted without CRUD permission
    return false;
  }, [isFromDatabase, fieldRules]);

  const handleSaveCost = (cost: ComponentCost, costYear?: ComponentCostYear) => {
    // Validate if adding/editing would exceed max amount cost
    if (maxAmountCost && maxAmountCost > 0) {
      let newTotalCost = 0;
      
      if (modalMode === 'add') {
        // For add mode, calculate total with the new cost added
        newTotalCost = componentCosts.reduce((sum, existingCost) => sum + (existingCost.Total || 0), 0) + (cost.Total || 0);
      } else if (modalMode === 'edit' && editingIndex !== null) {
        // For edit mode, replace the existing cost with the new one
        newTotalCost = componentCosts.reduce((sum, existingCost, index) => {
          if (index === editingIndex) {
            return sum + (cost.Total || 0);
          }
          return sum + (existingCost.Total || 0);
        }, 0);
      }

      if (newTotalCost > maxAmountCost) {
        const exceeded = newTotalCost - maxAmountCost;
        const confirmMessage = `This action will exceed the maximum budget by ₱${formatCurrency(exceeded)}.\n\nTotal cost: ₱${formatCurrency(newTotalCost)}\nMax allowed: ₱${formatCurrency(maxAmountCost)}\n\nDo you want to proceed anyway?`;
        
        if (!window.confirm(confirmMessage)) {
          return; // Don't save if user cancels
        }
      }
    }

    if (modalMode === 'add') {
      onAdd(cost, costYear);
    } else if (modalMode === 'edit' && editingIndex !== null) {
      onEdit(editingIndex, cost);
      // TODO: Handle costYear updates for edit mode
    }
    handleCloseModal();
  };


  const calculateTotalCosts = () => {
    const totalCost = componentCosts.reduce((sum, cost) => sum + (cost.Total || 0), 0);

    return {
      totalCost,
    };
  };

  const totalCosts = calculateTotalCosts();
  
  // Calculate budget status for visual feedback
  const getBudgetStatus = () => {
    if (!maxAmountCost || maxAmountCost <= 0) return 'normal';
    
    const percentage = (totalCosts.totalCost / maxAmountCost) * 100;
    
    if (percentage > 100) return 'exceeded';
    if (percentage === 100) return 'reach';
    if (percentage >= 90) return 'warning';
    if (percentage >= 75) return 'caution';
    return 'normal';
  };

  const budgetStatus = getBudgetStatus();
  
  const getBudgetStatusColor = () => {
    switch (budgetStatus) {
      case 'exceeded': return 'bg-red-50 text-red-600';
      case 'reach': return 'bg-green-50 text-green-600';
      case 'warning': return 'bg-orange-50 text-orange-600';
      case 'caution': return 'bg-yellow-50 text-yellow-600';
      default: return 'bg-blue-50 text-blue-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Component Cost</h2>
            <Button color="blue" onClick={handleOpenAddModal} disabled={!canAddComponentCost()}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Cost
            </Button>
        </div>

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`p-4 rounded-lg text-center ${getBudgetStatusColor()}`}>
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-lg font-semibold">₱{formatCurrency(totalCosts.totalCost)}</div>
                {budgetStatus === 'exceeded' && (
                  <div className="text-xs text-red-500 mt-1">
                    Exceeds budget by ₱{formatCurrency(totalCosts.totalCost - (maxAmountCost || 0))}
                  </div>  
                )}
                {budgetStatus === 'reach' && (
                  <div className="text-xs text-green-500 mt-1">
                    Budget limit reached
                  </div>
                )}
                {budgetStatus === 'warning' && (
                  <div className="text-xs text-orange-500 mt-1">
                    Near budget limit
                  </div>
                )}
                {budgetStatus === 'caution' && (
                  <div className="text-xs text-yellow-500 mt-1">
                    Approaching budget limit
                  </div>
                )}
            </div>
            {/* <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Total Cost (2025)</div>
                <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(totalCosts.totalCost)}</div>
            </div> */}
            <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-sm text-gray-600">Max Cost</div>
                <div className="text-lg font-semibold text-green-600">{maxAmountCost && maxAmountCost > 0 ? `₱${formatCurrency(maxAmountCost)}` : ""}</div>
                {maxAmountCost && maxAmountCost > 0  ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Remaining: ₱{formatCurrency(Math.max(0, maxAmountCost - totalCosts.totalCost))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 mt-1">
                    No remaining budget
                  </div>
                )}
            </div>
        </div>

        {/* Budget Progress Bar */}
        {/* {maxAmountCost && maxAmountCost > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Budget Usage</span>
              <span>{Math.min(100, Math.round((totalCosts.totalCost / maxAmountCost) * 100))}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-300 ${
                  budgetStatus === 'exceeded' ? 'bg-red-500' :
                  budgetStatus === 'warning' ? 'bg-orange-500' :
                  budgetStatus === 'caution' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (totalCosts.totalCost / maxAmountCost) * 100)}%` 
                }}
              ></div>
            </div>
          </div>
        )} */}

        {/* Component Cost Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Component Type</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Total Cost</TableHeader>
              <TableHeader>Created By</TableHeader>
              <TableHeader>Created Date</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {componentCosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  No component costs added yet. Click "Add Cost" to get started.
                </TableCell>
              </TableRow>
            ) : (
              componentCosts.map((cost, index) => (
                <TableRow key={cost.Id}>
                  <TableCell className="font-medium">{cost.ComponentId}</TableCell>
                  <TableCell>{cost.ComponentType}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={cost.Description}>
                      {cost.Description}
                    </div>
                  </TableCell>
                  <TableCell>₱{formatCurrency(cost.Total || 0)}</TableCell>
                  <TableCell>{cost.CreatedBy || '-'}</TableCell>
                  <TableCell>{cost.CreatedDate ? new Date(cost.CreatedDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(index)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(index)}
                        className={`text-red-600 hover:text-red-800 ${!canDelete(cost) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isFromDatabase(cost) ? "Cannot delete component from database" : "Delete"}
                        disabled={!canDelete(cost)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Dialog */}
        <ComponentCostDialog
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveCost}
          editingCost={editingIndex !== null ? componentCosts[editingIndex] : undefined}
          mode={modalMode}
          componentTypes={initialData?.Dropdowns?.ComponentTypes}
          componentCosts={componentCosts}
          ProjectId={initialData?.ProjectDetails?.ProjectId}
          maxAmountCost={maxAmountCost}
          categoryDesc={category}
          reasonDesc={reason}
          reasonId={reasonId}
        />
      </div>
  );
};

export default ComponentCostForm;
