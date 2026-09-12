// =============================================================================
// LumpSumComponentCostDialog.tsx — edit the one component cost of a Lump Sum.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/dialogs/ComponentCostDialog.tsx
//
// TECH DEBT: Changes to ComponentCostDialog must be manually reviewed for
// propagation here. This divergence is intentional and documented.
//
// KEY DIFFERENCES from ComponentCostDialog:
//   1. EDIT ONLY, AND NOTHING ON THE COST OR THE YEAR ROW IS CHOSEN. Where
//      ComponentCostDialog offers a type picker and editable year, amount and
//      dates, this dialog derives every one of them: a Lump Sum Project holds
//      exactly one component, of type 'LS', created with the project and never
//      added or deleted (2026-09-06 — UpdateLumpSum refuses both). So Component
//      Type, Component ID, Year, Allocation, Remaining, Start Date and End Date
//      are all read-only, and there is no "Add Year". One field remains
//      editable: Description.
//   2. TWO MONEY FIGURES, BOTH DERIVED SERVER-SIDE. The cost's Total is the FULL
//      allocation (= Σ the live funding lines) and the per-year row's Amount is
//      what is LEFT (Total − what the children drew). This dialog displays both
//      and computes neither: it used to set Total = Σ Amount on every render,
//      which under this model would write the balance into the allocation. What
//      it sends back is overwritten by SyncLSToFundingAsync anyway — the
//      component is derived, not typed.
//   3. UACS IS DISPLAYED, NOT EDITED (2026-09-06). It has no column of its own —
//      it lives only on the per-year rows — and the details form is its single
//      writer: what is typed there is fanned out by the server across every
//      per-year row of the project. This dialog shows the project's code so the
//      component reads whole, and sends each row's UACS back exactly as fetched;
//      the server keeps a row's UACS when a row arrives without one.
//   4. No hasMajorLocations prop — a Lump Sum Project has no Major Item of Works.
//   5. No autoFillComponentDescription / SparklesIcon — no GIS auto-fill.
//   6. Typed to LumpSumComponentCost / LumpSumComponentCostPerYear.
//   7. No programDetails: the year comes from the stored row, not from the program.
//   8. SAVE IS DISABLED, AND EXPLAINED, WHEN `disabled` (2026-09-09). The Project
//      dialog never disables its Save and has no submit guard, so a `disabled`
//      form there can still be saved through the open dialog. Here `disabled`
//      greys Save, `disabledReason` is shown as a notice and tooltip (the dialog
//      can be open when the page's gate flips), and handleSubmit keeps a silent
//      defensive guard. Propagate to the Project dialog or record why not.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import type { LumpSumComponentCost, LumpSumComponentCostPerYear } from '../Model.d';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { ComponentTypeEnum } from '../../Project/Model.d';
import { getDisabledClass } from '../../../utils/GlobalFunctions';
import { LUMPSUM_COMPONENT_ID } from '../utils/constants';

interface LumpSumComponentCostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cost: LumpSumComponentCost, costPerYear: LumpSumComponentCostPerYear[]) => void;
  editingCost?: LumpSumComponentCost;
  editingCostPerYear?: LumpSumComponentCostPerYear[];
  componentTypes: ComponentTypeEnum[];
  disabled?: boolean;
  /**
   * Why `disabled` (2026-09-09). Shown as a notice inside the dialog and as the
   * Save button's tooltip, because this dialog can be OPEN when a focus refresh
   * flips the program to Approved or an import takes the parent — the controls
   * grey reactively, and without this the user is left with a dead dialog and
   * the explanation on a banner behind it.
   */
  disabledReason?: string;
  /**
   * The project's UACS as the details form currently holds it (possibly unsaved),
   * shown read-only here. Falls back to the first per-year row that carries one.
   */
  projectUacs?: string;
}

const LumpSumComponentCostDialog: React.FC<LumpSumComponentCostDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCost,
  editingCostPerYear,
  componentTypes,
  disabled = false,
  disabledReason,
  projectUacs,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState<LumpSumComponentCost>({
    Id: 0,
    CostId: '',
    ComponentType: '',
    ComponentId: '',
    Description: '',
    Total: 0,
    IsDeleted: false,
    CreatedBy: user?.Name || '',
    CreatedDate: new Date().toISOString(),
    UpdatedBy: user?.Name || '',
    UpdatedDate: new Date().toISOString(),
  });

  const [componentCostPerYear, setComponentCostPerYear] = useState<LumpSumComponentCostPerYear[]>([]);
  /*  DISPLAY ONLY. The rows' UACS, read off the first row that carries one, so
      the dialog can show the code the project has today when the form has none
      to offer. It is never sent: the details form is the single writer, and
      handleSubmit passes each row's UACS through untouched. */
  const [uacs, setUacs] = useState<string>('');
  const isInitializedRef = useRef<boolean>(false);

  /*  No program year range here any more. It seeded the year of a NEW row, and
      there are no new rows: the dialog edits the one the project was created with,
      shows that row's own year, and derives the dates from it. */

  /*  The one component type a Lump Sum Project may hold. Matched on ComponentId
      rather than ComponentName — the name is display text and could be reworded. */
  const lumpSumType = componentTypes?.find(
    (t) => t.ComponentId === LUMPSUM_COMPONENT_ID
  );

  /*  WHAT IS LEFT, off the row. The component's Total is the allocation; this is
      the balance. Both are shown, neither is computed here — see the header note. */
  const remainingOnComponent = componentCostPerYear
    .filter((c) => !c.IsDeleted)
    .reduce((sum, c) => sum + (c.Amount || 0), 0);

  /*  THE COMPONENT COVERS THE WHOLE PROGRAM YEAR, so its dates are 1 January to
      31 December of it and there is nothing to choose. Derived rather than typed,
      and matched by the server (CreateLumpSum writes the same pair) and by
      LumpSum.ComponentMigration.sql for rows created before it did.

      Taken from the ROW's year, which for a Lump Sum Project is the program's
      start year. The two agree by construction; using the row's own value keeps
      the dates inside the year the row records even if they ever diverge. */
  const yearBounds = (year?: number) =>
    year && year > 0
      ? { start: `${year}-01-01`, end: `${year}-12-31` }
      : { start: '', end: '' };

  /*  No buildInitialPerYearCost, and no add branch. The one component and its one
      row are written by CreateLumpSum; this dialog only ever edits what exists.

      No handleEditPerYearCost either: every field on the row — Year, Allocation,
      Remaining, Start Date, End Date — is derived, so there is nothing to edit. */

  // Reset init flag when the dialog opens or closes.
  useEffect(() => {
    isInitializedRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    if (editingCost) {
      setFormData({
        Id: editingCost.Id ?? 0,
        CostId: editingCost.CostId ?? '',
        ComponentType: editingCost.ComponentType ?? '',
        ComponentId: editingCost.ComponentId ?? '',
        Description: editingCost.Description ?? '',
        Total: editingCost.Total ?? 0,
        IsDeleted: editingCost.IsDeleted ?? false,
        CreatedBy: editingCost.CreatedBy ?? '',
        CreatedDate: editingCost.CreatedDate ?? new Date().toISOString(),
        UpdatedBy: editingCost.UpdatedBy ?? '',
        UpdatedDate: editingCost.UpdatedDate ?? new Date().toISOString(),
      });
      /*  Fill in dates a stored row is missing. Rows written before CreateLumpSum
          set them come back null, and since the fields are read-only the user
          cannot supply them — the submit guard would refuse the save with nothing
          they could do about it. Derived from the row's own year, exactly as a new
          row is, so an old component saves like a new one. */
      const LiveRows = (editingCostPerYear?.filter(c => !c.IsDeleted) ?? []).map(c => {
        const Bounds = yearBounds(c.Year);
        return {
          ...c,
          StartDate: c.StartDate ?? (Bounds.start || null),
          EndDate: c.EndDate ?? (Bounds.end || null),
        };
      });
      setComponentCostPerYear(LiveRows);
      // One UACS for the component: take the first row that carries one.
      setUacs(LiveRows.find(c => c.UACS)?.UACS ?? '');
      isInitializedRef.current = true;
    }
    /*  Deliberately not depending on lumpSumType. This effect is a one-shot
        initialiser guarded by isInitializedRef; re-running it when the dropdowns
        resolve would discard whatever the user has typed since. The effect below
        fills the pinned fields in once lumpSumType arrives. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCost, editingCostPerYear, isOpen]);

  /*  componentTypes arrives from an async dropdown fetch, so the initialiser above
      can run before the Lump Sum type is known and leave the pinned fields blank.
      Fill them in as soon as it resolves — only when empty, so this never
      overwrites what an existing component already holds. */
  useEffect(() => {
    if (!lumpSumType) return;
    setFormData(prev =>
      prev.ComponentType && prev.ComponentId
        ? prev
        : {
            ...prev,
            ComponentType: lumpSumType.ComponentName ?? '',
            ComponentId: lumpSumType.ComponentId ?? '',
          }
    );
  }, [lumpSumType]);

  /*  NO AUTO-COMPUTE OF Total FROM THE PER-YEAR AMOUNTS (removed 2026-09-06).
      That was right when Total was "the sum of the years"; under this model Total
      is the ALLOCATION and the row is the BALANCE, so summing the rows into Total
      would overwrite the allocation with what is left every time this opened. The
      server derives both on save (SyncLSToFundingAsync). */

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /*  No handleChangeComponentType. Component Type is pinned to 'LS' at
      initialisation and never changes, so the old handler — and the Civil Works
      running-suffix branch it carried, which is why existing components read
      'LS1' — has nothing left to do. */

  /*  Closing clears nothing but the init flag: the dialog always opens onto an
      existing component and re-reads it. There is no draft to discard, and the
      old reset seeded a blank add-mode row that can no longer exist. */
  const handleClose = () => {
    isInitializedRef.current = false;
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    /*  Belt and braces, NOT the mechanism. When `disabled` is true the Save
        button below is disabled and every input is disabled or readOnly, so no
        click or Enter can reach here; the explanation the user sees is the
        notice rendered at the top of the form and the Save button's tooltip,
        both from `disabledReason`. This guard only covers a programmatic
        submit, and says nothing on purpose — a toast here can never fire. */
    if (disabled) return;

    /*  Not "please select" any more — there is nothing to select. If this fires,
        the Lump Sum component type is missing from the options the server sent. */
    if (!formData.ComponentType || !formData.ComponentId) {
      showToast({
        type: 'error',
        message: 'The Lump Sum component type is unavailable. Please reload the page and try again.',
      });
      return;
    }

    const validPerYearCosts = componentCostPerYear.filter(c => !c.IsDeleted);

    if (validPerYearCosts.length === 0) {
      showToast({ type: 'error', message: 'Please add at least one per-year cost.' });
      return;
    }

    for (let i = 0; i < validPerYearCosts.length; i++) {
      const cost = validPerYearCosts[i];
      /*  Year and Amount are read-only, so a failure here is a missing input to
          the form rather than a typo — say which one, since the user cannot fix
          it in this dialog. */
      if (!cost.Year || cost.Year <= 0) {
        showToast({
          type: 'error',
          message: 'This project has no Program Start Year, so the cost year cannot be set. Select a Program first.',
        });
        return;
      }
      /*  NO "Amount must be > 0" GUARD (removed 2026-09-06). The row now holds the
          REMAINING balance, and a fully itemized Lump Sum Project legitimately has
          zero left — refusing the save would make its Description uneditable for
          exactly the projects most likely to need a correction. */
      /*  Dates are derived from the year checked just above, so they are present
          and in range by construction — "please select a Start Date" would be a
          lie, there is nothing to select. Kept as one last check rather than four
          user-facing ones: if it ever fires, the derivation is broken, not the
          user's input. */
      if (!cost.StartDate || !cost.EndDate) {
        showToast({
          type: 'error',
          message: 'The cost period could not be determined. Please reload the page and try again.',
        });
        return;
      }
    }

    /*  NO BUDGET-CAP CHECK (removed 2026-09-06). It compared the component's Total
        against the funded total — two names for one figure now, since Total IS
        Σ the funding lines and the server re-derives it on every save. There is
        nothing left that could exceed anything. */

    const costData: LumpSumComponentCost = {
      ...formData,
      CreatedBy: user?.Name || '',
      UpdatedBy: user?.Name,
      UpdatedDate: new Date().toISOString(),
    };

    /*  UACS IS NOT SET HERE (2026-09-06). Each row keeps whatever UACS it was
        fetched with; the details form's value is what the server fans out across
        every row after the merge, and the merge keeps a row's UACS when the row
        arrives without one. Setting it here again would make two writers of one
        column, and the loser would be whichever the user did not just look at. */
    const perYearCosts = componentCostPerYear.map(c => ({
      ...c,
      ComponentCostId: formData.CostId,
      CreatedBy: c.CreatedBy || user?.Name || '',
      UpdatedBy: user?.Name || '',
      UpdatedDate: new Date().toISOString(),
      StartDate: c.StartDate || null,
      EndDate: c.EndDate || null,
    }));

    onSave(costData, perYearCosts);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Edit Component Cost
            </DialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/*  The reason the controls below are grey — the same sentence the
                 page's banner or the pencil's tooltip carries, brought inside the
                 modal, where the banner cannot be read. */}
            {disabled && (
              <div
                role="status"
                data-cost-dialog-notice
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <span className="font-semibold">Read-only.</span>{' '}
                {disabledReason ?? 'The Component Cost cannot be changed right now.'}
              </div>
            )}
            {/* Component Type and ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Component Type
                </label>
                {/* Fixed, not chosen: a Lump Sum Project holds exactly one component
                    and it is always the Lump Sum one. Rendered as a read-only input so
                    it matches Component ID beside it. */}
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 focus:outline-none"
                  type="text"
                  value={formData.ComponentType}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Component ID
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 focus:outline-none"
                  type="text"
                  value={formData.ComponentId}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

            {/* UACS — the project's code, read-only here; typed on Project Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OA Project Code (UACS)
              </label>
              <input
                className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 ${getDisabledClass(true)}`}
                type="text"
                value={projectUacs ?? uacs}
                readOnly
                disabled
                aria-readonly="true"
                placeholder="—"
                maxLength={50}
              />
              <p className="mt-1 text-xs text-gray-500">
                Set on Project Details; every yearly row of this component carries it, and projects
                itemized from this Lump Sum Project inherit it.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              {/* No auto-fill button: a Lump Sum Project has no Major Item of Works / GIS linkage */}
              <textarea
                value={formData.Description || ''}
                onChange={(e) => handleChange('Description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${getDisabledClass(disabled)}`}
                placeholder="Enter description..."
                maxLength={500}
                disabled={disabled}
              />
            </div>

            {/* Per-Year Costs */}
            <div>
              {/*  No "Add Year" button. Year is fixed to the program's start year and
                   Amount to the allocation, so a second row could only duplicate the
                   first and double-count against the cap. The single row is seeded on
                   open, and every field on it is derived. */}
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Cost Breakdown by Year
                </label>
              </div>

              {componentCostPerYear.filter(c => !c.IsDeleted).length === 0 ? (
                <div className="text-center text-gray-500 py-4 border border-dashed border-gray-300 rounded-md">
                  No cost breakdown available. Select a Program and add a funding line first.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {componentCostPerYear.map((cost, index) => {
                    if (cost.IsDeleted) return null;

                    /*  No out-of-range checking any more. Both dates are derived from
                        the row's own year, so they cannot fall outside it — the red
                        "(out of range)" states existed for values a user could type,
                        and there is nothing left to type. */
                    const startDateStr = cost.StartDate ? cost.StartDate.split('T')[0] : '';
                    const endDateStr = cost.EndDate ? cost.EndDate.split('T')[0] : '';

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-[120px_1fr_1fr_1fr] gap-3 items-end p-3 bg-gray-50 rounded border"
                      >
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                          {/* Fixed to the program's start year */}
                          <input
                            type="text"
                            value={cost.Year || ''}
                            readOnly
                            aria-readonly="true"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Remaining</label>
                          {/*  Read-only, and it is the BALANCE (2026-09-06): the allocation
                              less what the imported projects have drawn. Raised by
                              Replenish, lowered by an import, restored when an itemized
                              project is deleted. Never typed. */}
                          <input
                            type="text"
                            value={cost.Amount !== undefined && cost.Amount !== null ? cost.Amount.toLocaleString('en-PH') : ''}
                            readOnly
                            aria-readonly="true"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right bg-white text-gray-700 focus:outline-none"
                            placeholder="₱0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                          {/* 1 January of the row's year. Derived, never chosen. */}
                          <input
                            type="text"
                            value={startDateStr}
                            readOnly
                            aria-readonly="true"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                          {/* 31 December of the row's year. */}
                          <input
                            type="text"
                            value={endDateStr}
                            readOnly
                            aria-readonly="true"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-700 focus:outline-none"
                          />
                        </div>
                        {/* No delete control: the single row is the component. Deleting
                            the whole component is done from the Component Cost table. */}
                      </div>
                    );
                  })}
                </div>
              )}

              {/*  THE TWO FIGURES. Allocation is the component's Total, kept equal to
                   the funding lines; Remaining is what the per-year row holds after
                   itemization. Both display-only — the server derives them on save. */}
              <div className="mt-3 p-3 bg-blue-50 rounded border space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Allocation:</span>
                  <span className="text-lg font-semibold text-blue-600">
                    ₱{formData.Total.toLocaleString('en-PH')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Remaining:</span>
                  <span
                    className={`text-lg font-semibold ${
                      remainingOnComponent > 0 ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    ₱{remainingOnComponent.toLocaleString('en-PH')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" color="zinc" onClick={handleClose}>
                Cancel
              </Button>
              {/*  The tooltip lives on a wrapper: a disabled control fires no hover. */}
              <span title={disabled ? disabledReason : undefined} className="inline-flex">
                <Button type="submit" color="orange" disabled={disabled}>
                  Save
                </Button>
              </span>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default LumpSumComponentCostDialog;
