import React, { useState, useCallback, useMemo } from "react";
import type { ComponentCost, ComponentCostPerYear } from "../../../Project/Model.d";
import type { FieldRules } from "../../Model";
import { Button } from "../../../../components/tailwindui/button";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from "../../../../components/tailwindui/table";
import ComponentCostDialog from "../../dialogs/ComponentCostDialog";
import DeleteComponentDialog from "../../dialogs/deleteDialog/DeleteComponentDialog";

import { useComponentCosts } from "../../hooks/useComponentCosts";
import { useMajorItemOfWorks } from "../../hooks/useMajorItemOfWorks";

interface ComponentCostFormProps {
  componentCosts?: ComponentCost[];
  componentCostPerYear?: ComponentCostPerYear[];
  onAdd?: (cost: ComponentCost, costPerYear: ComponentCostPerYear[]) => void;
  onEdit?: (index: number, updatedCost: ComponentCost, updatedCostPerYear: ComponentCostPerYear[]) => void;
  onDelete?: (index: number) => void;
  initialData?: any;
  maxAmountCost?: number;
  fieldRules?: FieldRules;
  category?: string;
  reason?: string;
  reasonId?: number;
}

const ComponentCostForm: React.FC<ComponentCostFormProps> = ({
  componentCosts: _componentCostsProp,
  componentCostPerYear: _componentCostPerYearProp,
  onAdd: _onAdd,
  onEdit: _onEdit,
  onDelete: _onDelete,
  initialData,
  maxAmountCost,
  fieldRules,
  category,
  reason,
  reasonId,
}) => {
  // Get component costs and mutations from the hook
  const { 
    costs: componentCosts,
    costPerYear: componentCostPerYear,
    add, 
    update, 
    // Delete dialog state & actions from hook
    isDeleteOpen,
    selectedForDelete,
    deleteIndex,
    openDelete,
    closeDelete,
    confirmDelete
  } = useComponentCosts();

  // Get major items to calculate cascade delete count
  const { majorItems } = useMajorItemOfWorks();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  const normalizedCategory = category?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const isChangeOfCreditor = normalizedCategory === 'changeofcreditor';

  // Calculate related major items count for the selected component
  const relatedMajorItemsCount = useMemo(() => {
    if (!selectedForDelete) return 0;
    return majorItems.filter(
      item => item.ComponentId === selectedForDelete.ComponentId && !item.IsDeleted
    ).length;
  }, [selectedForDelete, majorItems]);

  const formatCurrency = (amount: number) => amount.toLocaleString('en-PH');

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingIndex(null);
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

  const isFromDatabase = useCallback((cost: ComponentCost) => {
    if (cost.Id && cost.Id > 0) return true;
    return false;
  }, []);

  const canAddComponentCost = useCallback(() => {
    if (!fieldRules) return false;
    if (!fieldRules.ComponentCostRules) return false;
    if (!fieldRules.ComponentCostRules.CRUD) return false;
    return fieldRules.ComponentCostRules.CRUD.CanAdd ?? false;
  }, [fieldRules]);

  const canDelete = useCallback((cost: ComponentCost) => {
    if (!isFromDatabase(cost)) return true;
    if (!fieldRules) return false;
    if (!fieldRules.ComponentCostRules) return false;
    if (!fieldRules.ComponentCostRules.CRUD) return false;
    return fieldRules.ComponentCostRules.CRUD.CanDelete ?? false;
  }, [isFromDatabase, fieldRules]);

  const handleSaveCost = (cost: ComponentCost, costPerYear: ComponentCostPerYear[]) => {
    // Budget validation
    if (maxAmountCost && maxAmountCost > 0) {
      let newTotalCost = 0;
      
      if (modalMode === 'add') {
        // For add mode, calculate total with the new cost added
        newTotalCost = componentCosts
          .filter(c => !c.IsDeleted)
          .reduce((sum, existingCost) => sum + (existingCost.Total || 0), 0) + (cost.Total || 0);
      } else if (modalMode === 'edit' && editingIndex !== null) {
        // For edit mode, replace the existing cost with the new one
        newTotalCost = componentCosts.reduce((sum, existingCost, index) => {
          if (existingCost.IsDeleted) return sum;
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
      add(cost, costPerYear);
    } else if (modalMode === 'edit' && editingIndex !== null) {
      const componentId = cost.ComponentId || componentCosts[editingIndex]?.ComponentId;
      if (componentId) {
        update(componentId, cost, costPerYear);
      }
    }

    handleCloseModal();
  };

  const calculateTotalCosts = () => {
    const totalCost = componentCosts
      .filter(cost => !cost.IsDeleted)
      .reduce((sum, cost) => sum + (cost.Total || 0), 0);
    return { totalCost };
  };

  const totalCosts = calculateTotalCosts();

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
          Add Component
        </Button>
      </div>

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
            <div className="text-xs text-green-500 mt-1">Budget limit reached</div>
          )}
          {budgetStatus === 'warning' && (
            <div className="text-xs text-orange-500 mt-1">Near budget limit</div>
          )}
          {budgetStatus === 'caution' && (
            <div className="text-xs text-yellow-500 mt-1">Approaching budget limit</div>
          )}
        </div>

        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-sm text-gray-600">Max Cost</div>
          <div className="text-lg font-semibold text-green-600">{maxAmountCost && maxAmountCost > 0 ? `₱${formatCurrency(maxAmountCost)}` : ""}</div>
          {maxAmountCost && maxAmountCost > 0 ? (
            <div className="text-xs text-gray-500 mt-1">
              Remaining: ₱{formatCurrency(Math.max(0, maxAmountCost - totalCosts.totalCost))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-1">No remaining budget</div>
          )}
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Component ID</TableHeader>
            <TableHeader>Component Type</TableHeader>
            <TableHeader>Description</TableHeader>
            <TableHeader>Total Cost</TableHeader>
            <TableHeader>Created By</TableHeader>
            <TableHeader>Created Date</TableHeader>
            <TableHeader>PCMA Status</TableHeader>
            <TableHeader>Package Type</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {componentCosts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                No component costs added yet. Click "Add Cost" to get started.
              </TableCell>
            </TableRow>
          ) : (
            componentCosts.map((cost, index) => {
              if (cost.IsDeleted) return null;
              return (
              <TableRow key={cost.Id || cost.ComponentId || index}>
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
                <TableCell>{cost.ConstructionStatusName}</TableCell>
                <TableCell>{cost.PackedStatusName}</TableCell>
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
                      onClick={() => { if (canDelete(cost)) openDelete(cost, index); }}
                      className={`text-red-600 hover:text-red-800 ${!canDelete(cost) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={canDelete(cost) ? "Delete component" : "Cannot delete component"}
                      disabled={!canDelete(cost)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <ComponentCostDialog
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCost}
        editingCost={editingIndex !== null ? componentCosts[editingIndex] : undefined}
        editingCostPerYear={editingIndex !== null ? componentCostPerYear.filter(cost => cost.ComponentCostId === componentCosts[editingIndex]?.CostId) : undefined}
        mode={modalMode}
        componentTypes={initialData?.Dropdowns?.ComponentTypes}
        componentCosts={componentCosts}
        ProjectId={initialData?.ProjectDetails?.ProjectId}
        maxAmountCost={maxAmountCost}
        categoryDesc={category}
        reasonDesc={reason}
        reasonId={reasonId}
        isChangeOfCreditor={isChangeOfCreditor}
        programDetails={initialData?.ProgramDetails}
      />

      <DeleteComponentDialog
        isOpen={isDeleteOpen}
        component={selectedForDelete}
        index={deleteIndex}
        onClose={closeDelete}
        onConfirmDelete={confirmDelete}
        projectId={initialData?.ProjectDetails?.ProjectId}
        relatedMajorItemsCount={relatedMajorItemsCount}
      />
    </div>
  );
};

export default ComponentCostForm;