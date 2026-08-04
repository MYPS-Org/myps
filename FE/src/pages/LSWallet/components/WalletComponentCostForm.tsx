// =============================================================================
// WalletComponentCostForm.tsx — Component cost table for an LSWallet.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/components/ComponentCostForm.tsx
//
// KEY DIFFERENCES from ComponentCostForm:
//   1. No majorItems prop — LSWallet has no Major Item of Works.
//   2. relatedMajorItemsCount is hardcoded to 0 (safe for DeleteComponentDialog).
//   3. Uses WalletComponentCostDialog (not ComponentCostDialog).
//   4. Typed to WalletComponentCost / WalletComponentCostPerYear.
//   5. maxAmountCost is wired to wallet.Amount (the budget cap).
//   6. WalletComponentCost is cast to ComponentCost for DeleteComponentDialog reuse.
//      The two types are structurally compatible except for ProjectId vs WalletId —
//      DeleteComponentDialog only reads ComponentId, ComponentType, Total, Description,
//      so the cast is safe.
//   7. componentTypes are passed as a prop, sourced from
//      ShowProjectComponentDropdowns (Dropdowns.ComponentTypes) — includes the
//      'LS' (Lump Sum) type, unlike the regular Project ComponentCostDialog
//      which excludes it via WALLET_EXCLUSIVE_COMPONENT_TYPES.
// =============================================================================

import React, { useState } from 'react';
import type { WalletComponentCost, WalletComponentCostPerYear } from '../Model.d';
import type { ComponentCost, ComponentTypeEnum } from '../../Project/Model';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
} from '../../../components/tailwindui/table';
import WalletComponentCostDialog from '../dialogs/WalletComponentCostDialog';
import DeleteComponentDialog from '../../Project/dialogs/deleteDialogs/DeleteComponentDialog';
import { getDisabledClass } from '../../../utils/GlobalFunctions';

interface WalletComponentCostFormProps {
  componentCosts: WalletComponentCost[];
  componentCostPerYear?: WalletComponentCostPerYear[];
  onAdd: (cost: WalletComponentCost, costPerYear: WalletComponentCostPerYear[]) => void;
  onEdit: (index: number, updatedCost: WalletComponentCost, costPerYear: WalletComponentCostPerYear[]) => void;
  onDelete: (index: number) => void;
  /** Component types list — from ShowProjectComponentDropdowns (Dropdowns.ComponentTypes). */
  componentTypes: ComponentTypeEnum[];
  /** wallet.Amount — the total funded budget cap. */
  maxAmountCost?: number;
  walletId?: number;
  disabled?: boolean;
  programDetails?: { YearStart?: number; YearEnd?: number };
}

const WalletComponentCostForm: React.FC<WalletComponentCostFormProps> = ({
  componentCosts,
  componentCostPerYear = [],
  onAdd,
  onEdit,
  onDelete,
  componentTypes,
  maxAmountCost,
  walletId,
  disabled = false,
  programDetails,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingComponent, setDeletingComponent] = useState<WalletComponentCost | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const formatCurrency = (amount: number) => amount.toLocaleString('en-PH');

  // -------------------------------------------------------------------------
  // Modal handlers
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Delete handlers
  // -------------------------------------------------------------------------
  const handleOpenDeleteDialog = (index: number) => {
    setDeletingComponent(componentCosts[index]);
    setDeletingIndex(index);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingComponent(null);
    setDeletingIndex(null);
  };

  const handleConfirmDelete = async (index?: number) => {
    if (index !== null && index !== undefined) {
      onDelete(index);
    }
    handleCloseDeleteDialog();
  };

  // -------------------------------------------------------------------------
  // Save handler — budget-cap warning lives inside WalletComponentCostDialog
  // -------------------------------------------------------------------------
  const handleSaveCost = (cost: WalletComponentCost, costPerYear: WalletComponentCostPerYear[]) => {
    if (modalMode === 'add') {
      onAdd(cost, costPerYear);
    } else if (modalMode === 'edit' && editingIndex !== null) {
      onEdit(editingIndex, cost, costPerYear);
    }
    handleCloseModal();
  };

  // -------------------------------------------------------------------------
  // Budget status helpers (same thresholds as ComponentCostForm)
  // -------------------------------------------------------------------------
  const totalCost = componentCosts
    .filter(c => !c.IsDeleted)
    .reduce((sum, c) => sum + (c.Total || 0), 0);

  const getBudgetStatus = () => {
    if (!maxAmountCost || maxAmountCost <= 0) return 'normal';
    const pct = (totalCost / maxAmountCost) * 100;
    if (pct > 100) return 'exceeded';
    if (pct === 100) return 'reach';
    if (pct >= 90) return 'warning';
    if (pct >= 75) return 'caution';
    return 'normal';
  };

  const budgetStatus = getBudgetStatus();

  const getBudgetStatusColor = () => {
    switch (budgetStatus) {
      case 'exceeded': return 'bg-red-50 text-red-600';
      case 'reach':    return 'bg-green-50 text-green-600';
      case 'warning':  return 'bg-orange-50 text-orange-600';
      case 'caution':  return 'bg-yellow-50 text-yellow-600';
      default:         return 'bg-blue-50 text-blue-600';
    }
  };

  // -------------------------------------------------------------------------
  // Editing context for dialog
  // -------------------------------------------------------------------------
  const editingCost =
    editingIndex !== null ? componentCosts[editingIndex] : undefined;
  const editingCostPerYear =
    editingIndex !== null && editingCost
      ? componentCostPerYear.filter(
          c => c.ComponentCostId === editingCost.CostId && !c.IsDeleted
        )
      : [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Component Cost</h2>
        <Button color="blue" onClick={handleOpenAddModal} disabled={disabled}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Component
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-lg text-center ${getBudgetStatusColor()}`}>
          <div className="text-sm text-gray-600">Total Cost</div>
          <div className="text-lg font-semibold">₱{formatCurrency(totalCost)}</div>
          {budgetStatus === 'exceeded' && (
            <div className="text-xs text-red-500 mt-1">
              Exceeds budget by ₱{formatCurrency(totalCost - (maxAmountCost || 0))}
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
          <div className="text-sm text-gray-600">Max Cost (Wallet Amount)</div>
          <div className="text-lg font-semibold text-green-600">
            {maxAmountCost && maxAmountCost > 0 ? `₱${formatCurrency(maxAmountCost)}` : '—'}
          </div>
          {maxAmountCost && maxAmountCost > 0 ? (
            <div className="text-xs text-gray-500 mt-1">
              Remaining: ₱{formatCurrency(Math.max(0, maxAmountCost - totalCost))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-1">No budget limit set</div>
          )}
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Component ID</TableHeader>
            <TableHeader>Component Type</TableHeader>
            <TableHeader>Description</TableHeader>
            <TableHeader>Total Cost</TableHeader>
            <TableHeader>Created By</TableHeader>
            <TableHeader>Created Date</TableHeader>
            <TableHeader>Updated By</TableHeader>
            <TableHeader>Updated Date</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {componentCosts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                No component costs added yet. Click "Add Component" to get started.
              </TableCell>
            </TableRow>
          ) : (
            componentCosts.map((cost, index) => {
              if (cost.IsDeleted) return null;
              return (
                <TableRow key={cost.CostId || `cost-${index}`}>
                  <TableCell className="font-medium">{cost.ComponentId}</TableCell>
                  <TableCell>{cost.ComponentType}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate" title={cost.Description}>
                      {cost.Description}
                    </div>
                  </TableCell>
                  <TableCell>₱{formatCurrency(cost.Total || 0)}</TableCell>
                  <TableCell>{cost.CreatedBy || '-'}</TableCell>
                  <TableCell>
                    {cost.CreatedDate
                      ? new Date(cost.CreatedDate).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>{cost.UpdatedBy || '-'}</TableCell>
                  <TableCell>
                    {cost.UpdatedDate
                      ? new Date(cost.UpdatedDate).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(index)}
                        className={`text-blue-600 hover:text-blue-800 ${getDisabledClass(disabled)}`}
                        title="Edit"
                        disabled={disabled}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDeleteDialog(index)}
                        className={`text-red-600 hover:text-red-800 ${getDisabledClass(disabled)}`}
                        title="Delete"
                        disabled={disabled}
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

      {/* Add/Edit dialog */}
      <WalletComponentCostDialog
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCost}
        editingCost={editingCost}
        editingCostPerYear={editingCostPerYear}
        mode={modalMode}
        componentTypes={componentTypes}
        componentCosts={componentCosts}
        walletId={walletId}
        maxAmountCost={maxAmountCost}
        disabled={disabled}
        programDetails={programDetails}
      />

      {/* Delete dialog — WalletComponentCost cast to ComponentCost.
          DeleteComponentDialog only reads ComponentId, ComponentType, Total, Description
          from the component object, all of which WalletComponentCost also has.
          WalletId (number) vs ProjectId (string) is the only structural difference,
          but is not accessed by DeleteComponentDialog, so the cast is safe. */}
      <DeleteComponentDialog
        isOpen={isDeleteDialogOpen}
        component={deletingComponent as unknown as ComponentCost}
        index={deletingIndex}
        onClose={handleCloseDeleteDialog}
        onConfirmDelete={handleConfirmDelete}
        relatedMajorItemsCount={0}
        // relatedMajorItemsCount is always 0: LSWallet has no Major Item of Works
      />
    </div>
  );
};

export default WalletComponentCostForm;
