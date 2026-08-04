// =============================================================================
// EditDrawAmountDialog.tsx — Edit funding lines for an unpublished itemized project
//
// Replaces the single "new draw amount" text input with a multi-row funding-line
// editor: the user can add, edit, or remove individual FundingLine rows
// (Source, Agreement, Amount, Percentage). The dialog computes a live total and
// submits the full updated FundingLines array via DtoUpdateDrawAmount.
//
// The mock store (updateItemizedProjectDraw) then recomputes CurrentDrawAmount
// as SUM(fundingLines.Amount) — the DRAW AMOUNT INVARIANT.
//
// Only valid before publish. Post-publish edits go through revision requests (WF-6).
//
// Balance guard (unchanged from original):
//   newTotal <= project.CurrentDrawAmount + balance.Available
// Decreasing the total always passes (returns funds to wallet Available).
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { handleCurrencyFocus, handleCurrencyBlur } from '../../../utils/GlobalFunctions';
import { updateItemizedProjectDraw } from '../Service';
import type { FundingLine, ItemizedProject, LSWallet, LSWalletBalance, DtoUpdateDrawAmount } from '../Model.d';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EditDrawAmountDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: ItemizedProject) => void;
  project: ItemizedProject;
  wallet: LSWallet;
  balance: LSWalletBalance;
}

// ---------------------------------------------------------------------------
// Helper: build a blank new FundingLine with a synthetic local ID
// ---------------------------------------------------------------------------
const blankLine = (): FundingLine => ({
  Id: Date.now() + Math.floor(Math.random() * 10000),
  Source: '',
  Agreement: '',
  Amount: 0,
  Percentage: 0,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EditDrawAmountDialog: React.FC<EditDrawAmountDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
  wallet,
  balance,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [lines, setLines] = useState<FundingLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Initialise from project's existing funding lines when dialog opens ────
  useEffect(() => {
    if (open) {
      // Deep copy so edits don't mutate the prop
      setLines(project.FundingLines.length > 0
        ? project.FundingLines.map(fl => ({ ...fl }))
        // Safety: if somehow there are no lines, start with one blank row
        : [blankLine()],
      );
    }
  }, [open, project.FundingLines]);

  // ── Derived values ────────────────────────────────────────────────────────

  const newTotal = lines.reduce((sum, fl) => sum + (fl.Amount || 0), 0);

  // Maximum new total = whatever the wallet has Available PLUS what this project
  // already holds (releasing its draw first, then reallocating).
  const maxAllowed = project.CurrentDrawAmount + balance.Available;
  const isOverDraw = newTotal > maxAllowed;

  const diff = newTotal - project.CurrentDrawAmount;

  // ── Row mutation helpers ──────────────────────────────────────────────────

  const updateField = (
    idx: number,
    field: keyof Omit<FundingLine, 'Id'>,
    value: string | number,
  ) => {
    setLines(prev =>
      prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line)),
    );
  };

  const addRow = () => setLines(prev => [...prev, blankLine()]);

  const removeRow = (idx: number) => {
    setLines(prev => {
      if (prev.length <= 1) {
        // Always keep at least one row; just clear it instead of deleting
        return [blankLine()];
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    // Validate: total must be > 0
    if (newTotal <= 0) {
      showToast({ type: 'error', message: 'Total draw amount must be greater than zero.' });
      return;
    }

    // Validate: must not overdraw the wallet
    if (isOverDraw) {
      showToast({
        type: 'error',
        message: `New total (${formatCurrency(newTotal)}) exceeds the maximum allowed (${formatCurrency(maxAllowed)}).`,
      });
      return;
    }

    const payload: DtoUpdateDrawAmount = {
      projectId: project.ProjectId,
      fundingLines: lines,
      updatedBy: user?.UserId || '',
    };

    try {
      setIsLoading(true);
      const result = await updateItemizedProjectDraw(payload);
      showToast({
        type: 'success',
        message: `Draw amount updated to ${formatCurrency(newTotal)}.`,
      });
      onSuccess(result.Data);
      handleClose();
    } catch {
      // httpClient interceptor already showed the API error toast.
    } finally {
      setIsLoading(false);
    }
  };

  // ── Close / reset ─────────────────────────────────────────────────────────

  const handleClose = () => {
    setLines([]);
    setIsLoading(false);
    onClose();
  };

  // ── Currency format helpers ───────────────────────────────────────────────

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-3xl rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <DialogTitle className="text-xl font-semibold text-gray-900 px-6 pt-6 pb-4 border-b border-gray-200">
            Edit Draw — Funding Lines
          </DialogTitle>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

            {/* Context summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Project</span>
                <span className="font-mono font-medium text-gray-800">{project.ProjectId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Wallet</span>
                <span className="font-medium text-gray-800">{wallet.ProgramName}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600">Current Draw Amount</span>
                <span className="font-medium">{formatCurrency(project.CurrentDrawAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Wallet Available Balance</span>
                <span className="font-medium">{formatCurrency(balance.Available)}</span>
              </div>
              <div className="flex justify-between text-blue-700 font-medium">
                <span>Maximum New Total</span>
                <span>{formatCurrency(maxAllowed)}</span>
              </div>
            </div>

            {/* Funding lines table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">Funding Lines</h3>
                <button
                  type="button"
                  onClick={addRow}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add Row
                </button>
              </div>

              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs whitespace-nowrap">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs whitespace-nowrap">Source</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs whitespace-nowrap">Agreement</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 text-xs whitespace-nowrap">Amount (₱)</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500 text-xs whitespace-nowrap">%</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500 text-xs whitespace-nowrap">Del.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {lines.map((line, idx) => (
                      <tr key={line.Id} className="hover:bg-gray-50">
                        {/* Row number */}
                        <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>

                        {/* Source */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            maxLength={200}
                            value={line.Source}
                            onChange={(e) => updateField(idx, 'Source', e.target.value)}
                            disabled={isLoading}
                            placeholder="Source"
                            className="w-full min-w-[120px] px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </td>

                        {/* Agreement */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            maxLength={200}
                            value={line.Agreement}
                            onChange={(e) => updateField(idx, 'Agreement', e.target.value)}
                            disabled={isLoading}
                            placeholder="Agreement"
                            className="w-full min-w-[160px] px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </td>

                        {/* Amount — currency input using the module's standard focus/blur helpers */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.Amount > 0 ? line.Amount.toLocaleString('en-PH') : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[₱,\s]/g, '');
                              const parsed = parseFloat(raw);
                              updateField(idx, 'Amount', isNaN(parsed) ? 0 : parsed);
                            }}
                            onFocus={handleCurrencyFocus}
                            onBlur={(e) =>
                              handleCurrencyBlur(e, (value) => updateField(idx, 'Amount', value))
                            }
                            disabled={isLoading}
                            placeholder="0.00"
                            className="w-full min-w-[110px] px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 font-mono"
                          />
                        </td>

                        {/* Percentage */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={line.Percentage || ''}
                            onChange={(e) =>
                              updateField(idx, 'Percentage', parseFloat(e.target.value) || 0)
                            }
                            disabled={isLoading}
                            placeholder="0"
                            className="w-20 px-2 py-1 text-xs text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 font-mono"
                          />
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={isLoading}
                            className="text-red-400 hover:text-red-600 disabled:opacity-30"
                            title="Remove row"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Total footer */}
                  <tfoot className={`border-t-2 ${isOverDraw ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
                    <tr>
                      <td colSpan={3} className={`px-3 py-2 text-xs font-semibold text-right ${isOverDraw ? 'text-red-700' : 'text-gray-700'}`}>
                        New Total
                      </td>
                      <td className={`px-3 py-2 text-xs font-bold text-right font-mono ${isOverDraw ? 'text-red-700' : 'text-gray-900'}`}>
                        {formatCurrency(newTotal)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-xs text-gray-500 mt-1.5">
                Maximum allowed: {formatCurrency(maxAllowed)} — increasing draw reduces wallet Available balance.
              </p>
            </div>

            {/* Change indicator */}
            {newTotal !== project.CurrentDrawAmount && newTotal > 0 && (
              <div
                className={`rounded-lg p-4 border text-sm ${
                  isOverDraw
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : diff > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-green-50 border-green-200 text-green-800'
                }`}
              >
                {isOverDraw ? (
                  <span>
                    <strong>Overdraw:</strong> New total exceeds the maximum allowed by{' '}
                    {formatCurrency(newTotal - maxAllowed)}.
                  </span>
                ) : diff > 0 ? (
                  <span>
                    <strong>Increase:</strong> {formatCurrency(diff)} will be drawn from the
                    wallet's available balance.
                  </span>
                ) : (
                  <span>
                    <strong>Decrease:</strong> {formatCurrency(Math.abs(diff))} will be returned
                    to the wallet's available balance.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <Button color="zinc" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              color="blue"
              onClick={handleSubmit}
              disabled={isLoading || isOverDraw || newTotal <= 0}
            >
              {isLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>

        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default EditDrawAmountDialog;
