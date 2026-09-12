// =============================================================================
// LumpSumComponentCostForm.tsx — the one component cost of a Lump Sum Project.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/components/ComponentCostForm.tsx
//
// KEY DIFFERENCES from ComponentCostForm:
//   1. No majorItems prop — LumpSum has no Major Item of Works.
//   2. Uses LumpSumComponentCostDialog (not ComponentCostDialog).
//   3. Typed to LumpSumComponentCost / LumpSumComponentCostPerYear.
//   4. componentTypes are passed as a prop, sourced from
//      ShowProjectComponentDropdowns (Dropdowns.ComponentTypes) — includes the
//      'LS' (Lump Sum) type, unlike the regular Project ComponentCostDialog
//      which excludes it via LUMPSUM_EXCLUSIVE_COMPONENT_TYPES.
//
//   5. NO ADD, NO DELETE (2026-09-06). A Lump Sum Project holds exactly ONE
//      component — the allocation itself — created with the project and derived
//      on every save from the funding lines. A second one would be money the
//      funding does not cover; deleting the only one would leave nothing to
//      itemize against. UpdateLumpSum refuses both ("Single Component"), so the
//      buttons could only ever have produced a rejected save. Edit remains: the
//      Description is the one thing on it a person still chooses.
//
//   6. TWO FIGURES, NOT ONE. The component's Total is the FULL allocation (kept
//      equal to Σ the live funding lines) and its per-year row's Amount is the
//      REMAINING balance, drawn down by imports and restored by child deletes.
//      Both are shown; neither is typed. There is no "budget cap" to check
//      against any more — Total IS the funded total, by construction.
// =============================================================================

import React, { useState } from 'react';
import type { LumpSumComponentCost, LumpSumComponentCostPerYear } from '../Model.d';
import type { ComponentTypeEnum } from '../../Project/Model';
import { PencilIcon } from '@heroicons/react/24/outline';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
} from '../../../components/tailwindui/table';
import LumpSumComponentCostDialog from '../dialogs/LumpSumComponentCostDialog';
import { getDisabledClass } from '../../../utils/GlobalFunctions';

/** Every data cell in this table: centred, and free to wrap inside the nowrap Table wrapper. */
const CELL = 'text-center whitespace-normal break-words align-middle';

interface LumpSumComponentCostFormProps {
  componentCosts: LumpSumComponentCost[];
  componentCostPerYear?: LumpSumComponentCostPerYear[];
  onEdit: (index: number, updatedCost: LumpSumComponentCost, costPerYear: LumpSumComponentCostPerYear[]) => void;
  /** Component types list — from ShowProjectComponentDropdowns (Dropdowns.ComponentTypes). */
  componentTypes: ComponentTypeEnum[];
  disabled?: boolean;
  /** Why `disabled` — the pencil's tooltip, and a notice inside the dialog. */
  disabledReason?: string;
  /** The project's UACS as the details form holds it — shown read-only in the dialog. */
  projectUacs?: string;
}

const LumpSumComponentCostForm: React.FC<LumpSumComponentCostFormProps> = ({
  componentCosts,
  componentCostPerYear = [],
  onEdit,
  componentTypes,
  disabled = false,
  disabledReason,
  projectUacs,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const formatCurrency = (amount: number) => amount.toLocaleString('en-PH');

  // -------------------------------------------------------------------------
  // Modal handlers — edit only
  // -------------------------------------------------------------------------
  const handleOpenEditModal = (index: number) => {
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
  };

  const handleSaveCost = (cost: LumpSumComponentCost, costPerYear: LumpSumComponentCostPerYear[]) => {
    if (editingIndex !== null) onEdit(editingIndex, cost, costPerYear);
    handleCloseModal();
  };

  // -------------------------------------------------------------------------
  // The three figures, read off the rows the server derived
  // -------------------------------------------------------------------------
  const liveCosts = componentCosts.filter(c => !c.IsDeleted);

  /** A component's live per-year rows. For a Lump Sum component there is exactly one. */
  const rowsOf = (costId: string) =>
    componentCostPerYear.filter(c => c.ComponentCostId === costId && !c.IsDeleted);

  /** What is LEFT on a component: its per-year Amount. */
  const balanceOf = (costId: string) =>
    rowsOf(costId).reduce((sum, c) => sum + (c.Amount || 0), 0);

  const allocation = liveCosts.reduce((sum, c) => sum + (c.Total || 0), 0);
  const remaining = liveCosts.reduce((sum, c) => sum + balanceOf(c.CostId), 0);
  const itemized = allocation - remaining;

  /*  A component's UACS. Stored per-year rather than per-cost, but every row of a
      component carries the same value, so the first one answers for all. */
  const findCostUacs = (costId: string): string | undefined =>
    componentCostPerYear.find(c => c.ComponentCostId === costId && !c.IsDeleted && c.UACS)?.UACS;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header. No "Add Component": the one component is created with the project. */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Component Cost</h2>
      </div>

      {/* Summary cards — the same three figures the balance panel shows, read off
          the component rather than the view, so a disagreement is visible here. */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-sm text-gray-600">Allocation</div>
          <div className="text-lg font-semibold text-blue-600">₱{formatCurrency(allocation)}</div>
          <div className="text-xs text-gray-500 mt-1">Set by the Funding Profile</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg text-center">
          <div className="text-sm text-gray-600">Itemized</div>
          <div className="text-lg font-semibold text-amber-600">₱{formatCurrency(itemized)}</div>
          <div className="text-xs text-gray-500 mt-1">Drawn by imported projects</div>
        </div>
        <div className={`p-4 rounded-lg text-center ${remaining > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
          <div className="text-sm text-gray-600">Remaining</div>
          <div className={`text-lg font-semibold ${remaining > 0 ? 'text-green-600' : 'text-gray-500'}`}>
            ₱{formatCurrency(remaining)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {remaining > 0 ? 'Available to itemize' : 'Fully itemized'}
          </div>
        </div>
      </div>

      {/* Table */}
      {/*  Every column centred and allowed to wrap. The shared <Table> wrapper sets
           whitespace-nowrap so wide tables scroll rather than fold; these cells
           opt back out of that so a long Description or UACS breaks onto a
           second line instead of forcing a horizontal scrollbar. */}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader justify="center">Component ID</TableHeader>
            <TableHeader justify="center">Component Type</TableHeader>
            <TableHeader justify="center">UACS</TableHeader>
            <TableHeader justify="center">Description</TableHeader>
            <TableHeader justify="center">Allocation</TableHeader>
            <TableHeader justify="center">Remaining</TableHeader>
            <TableHeader justify="center">Created By</TableHeader>
            <TableHeader justify="center">Created Date</TableHeader>
            <TableHeader justify="center">Updated By</TableHeader>
            <TableHeader justify="center">Updated Date</TableHeader>
            <TableHeader justify="center">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {liveCosts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-gray-500 py-8">
                This Lump Sum Project has no component. It is created with the project — if this
                row is empty, the project was not created through this module.
              </TableCell>
            </TableRow>
          ) : (
            componentCosts.map((cost, index) => {
              if (cost.IsDeleted) return null;
              return (
                <TableRow key={cost.CostId || `cost-${index}`}>
                  <TableCell className={`${CELL} font-medium`}>{cost.ComponentId}</TableCell>
                  <TableCell className={CELL}>{cost.ComponentType}</TableCell>
                  {/*  UACS has no column on the cost itself — it lives on the per-year
                      rows, all of which carry the same value. Read the first one. */}
                  <TableCell className={CELL}>{findCostUacs(cost.CostId) || '-'}</TableCell>
                  <TableCell className={CELL}>
                    <div className="max-w-xs mx-auto" title={cost.Description}>
                      {cost.Description}
                    </div>
                  </TableCell>
                  <TableCell className={CELL}>₱{formatCurrency(cost.Total || 0)}</TableCell>
                  <TableCell className={CELL}>₱{formatCurrency(balanceOf(cost.CostId))}</TableCell>
                  <TableCell className={CELL}>{cost.CreatedBy || '-'}</TableCell>
                  <TableCell className={CELL}>
                    {cost.CreatedDate
                      ? new Date(cost.CreatedDate).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell className={CELL}>{cost.UpdatedBy || '-'}</TableCell>
                  <TableCell className={CELL}>
                    {cost.UpdatedDate
                      ? new Date(cost.UpdatedDate).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell className={CELL}>
                    {/* Edit only. The component cannot be deleted — see the header note. */}
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(index)}
                        className={`text-blue-600 hover:text-blue-800 ${getDisabledClass(disabled)}`}
                        title={disabled && disabledReason ? disabledReason : 'Edit'}
                        disabled={disabled}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Edit dialog */}
      <LumpSumComponentCostDialog
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCost}
        editingCost={editingIndex !== null ? componentCosts[editingIndex] : undefined}
        editingCostPerYear={
          editingIndex !== null
            ? rowsOf(componentCosts[editingIndex].CostId)
            : []
        }
        componentTypes={componentTypes}
        disabled={disabled}
        disabledReason={disabledReason}
        projectUacs={projectUacs}
      />
    </div>
  );
};

export default LumpSumComponentCostForm;
