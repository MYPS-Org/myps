// =============================================================================
// LumpSumFundingProfileForm.tsx — multi-line funding table for an LumpSum.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/components/FundingProfileForm.tsx
//
// DIFFERENCES from FundingProfileForm:
//   - Typed to LumpSumFundingProfile (not FundingProfile).
//   - No initialData prop (no dependency on ProjectFormPayload).
//   - Replaces FundingProfileSection.tsx.
//
//   - FUNDS ARE ADJUSTED BY REPLENISH, NOT HERE (2026-09-06). Source, Agreement
//     and Amount are read-only, and there is no "Add Funding": the first line is
//     written by CreateLumpSum and every later one is appended by Replenish,
//     which is also the only thing that raises the allocation. The lines are what
//     the Lump Sum component's Total is derived from on every save
//     (SyncLSToFundingAsync), so typing here would move the allocation behind
//     Replenish's back — and an amount edited to less than the children already
//     draw would put the project under water.
//
//     DELETE STAYS, deliberately. A line entered against the wrong source or
//     agreement cannot be corrected in place any more, so removing it has to
//     remain possible; the server still refuses a save that drops the allocation
//     below what the itemized projects draw ("Below Committed Draw").
//
//   - BOTH ARE LOCAL UNTIL SAVE (2026-09-08). Replenish appends a row with Id 0
//     and Delete flags one; neither reaches the server until "Save Lump Sum
//     Project". A pending row is marked "Unsaved" and tinted, and while anything
//     is pending a Discard control beside the totals puts the table back to what
//     was last fetched. The percentage effect below re-derives every share on
//     each change, which is how a pending top-up gets its share before Save.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import type { LumpSumFundingProfile } from '../Model.d';
import type { SourceEnum, AgreementEnum } from '../../Project/Model.d';
import { TrashIcon } from '@heroicons/react/24/outline';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
} from '../../../components/tailwindui/table';
import {
  getDisabledClass,
} from '../../../utils/GlobalFunctions';
import { firstFundingLine } from '../utils/firstFundingLine';

interface LumpSumFundingProfileFormProps {
  fundingProfiles: LumpSumFundingProfile[];
  /**
   * Still needed although nothing here edits a line: the percentage each line
   * carries is DERIVED from the amounts, and this is how the recomputed value
   * reaches the form's state. See the effect below.
   */
  onEdit: (index: number, updatedProfile: LumpSumFundingProfile) => void;
  onDelete: (index: number) => void;
  /** Resolved to names for display. Neither is selectable any more. */
  sources?: SourceEnum[];
  agreements?: AgreementEnum[];
  onTotalAmountChange?: (totalAmount: number) => void;
  disabled?: boolean;
  /**
   * THE FIRST FUNDING LINE IS PROTECTED WHILE THE PROJECT IS ITEMIZED (2026-09-07).
   *
   * Set on a parent that has imported projects. Every other line — each one
   * appended by a Replenish — stays removable, but the line the project was
   * created with is the allocation its children were imported against, so it
   * is not removable underneath them. With no children the whole table is
   * removable, including this line, which is the only way to correct a wrong
   * source (see LumpSum.md). Which line is "first" is firstFundingLine()'s
   * definition — the same one the Replenish dialog and the server use.
   */
  protectFirstLine?: boolean;
  /** The table holds a pending top-up or removal. Shows the Discard control. */
  isDirty?: boolean;
  /** Puts the lines back to the last fetched state. No request is made. */
  onDiscard?: () => void;
}

const LumpSumFundingProfileForm: React.FC<LumpSumFundingProfileFormProps> = ({
  fundingProfiles,
  onEdit,
  onDelete,
  sources,
  agreements,
  onTotalAmountChange = () => {},
  disabled = false,
  protectFirstLine = false,
  isDirty = false,
  onDiscard,
}) => {
  const [totalPercentage, setTotalPercentage] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [displayValues, setDisplayValues] = useState<{ [key: number]: string }>({});
  const [percentageBalancer, setPercentageBalancer] = useState(0);

  // Stable refs to avoid stale-closure dependency issues
  const onEditRef = useRef(onEdit);
  const onTotalAmountChangeRef = useRef(onTotalAmountChange);
  const previousAmountsRef = useRef<string>('');

  useEffect(() => {
    onEditRef.current = onEdit;
    onTotalAmountChangeRef.current = onTotalAmountChange;
  }, [onEdit, onTotalAmountChange]);

  // Recompute totals and auto-update percentages whenever amounts change
  useEffect(() => {
    const currentAmounts = fundingProfiles
      .map(p => `${p.Id}-${p.Amount}-${p.IsDeleted}`)
      .join('|');

    if (previousAmountsRef.current === currentAmounts) return;
    previousAmountsRef.current = currentAmounts;

    const totalAmt = fundingProfiles
      .filter(p => !p.IsDeleted)
      .reduce((sum, p) => sum + (p.Amount || 0), 0);
    setTotalAmount(totalAmt);

    let hasChanges = false;
    const updatedProfiles = fundingProfiles.map((profile) => {
      if (totalAmt === 0) {
        if (profile.Percentage !== 0) {
          hasChanges = true;
          return { ...profile, Percentage: 0 };
        }
        return profile;
      }
      const calculated = ((profile.Amount || 0) / totalAmt) * 100;
      const rounded = Math.round(calculated * 100) / 100;
      if (profile.Percentage !== rounded) {
        hasChanges = true;
        return { ...profile, Percentage: rounded };
      }
      return profile;
    });

    if (hasChanges) {
      requestAnimationFrame(() => {
        updatedProfiles.forEach((profile, index) => {
          onEditRef.current(index, profile);
        });
      });
    }

    const totalPct = updatedProfiles.reduce(
      (sum, p) => (p.IsDeleted ? sum : sum + (p.Percentage || 0)),
      0
    );
    setTotalPercentage(totalPct);

    const balancer = totalAmt > 0 ? Math.round((100 - totalPct) * 100) / 100 : 0;
    setPercentageBalancer(balancer);

    onTotalAmountChangeRef.current(totalAmt);
  }, [fundingProfiles]);

  // Sync currency display values
  useEffect(() => {
    const newDisplayValues: { [key: number]: string } = {};
    fundingProfiles.forEach((profile, index) => {
      if (profile.Amount != null && profile.Amount > 0) {
        newDisplayValues[index] = profile.Amount.FormatToCurrency();
      } else {
        newDisplayValues[index] = '';
      }
    });
    setDisplayValues(newDisplayValues);
  }, [fundingProfiles]);

  const getTotalPercentageColor = () => {
    const adjusted = totalPercentage + percentageBalancer;
    if (Math.abs(adjusted - 100) < 0.01) return 'text-green-600';
    if (adjusted > 100) return 'text-red-600';
    return 'text-yellow-600';
  };

  /*  No handleAmountChange. The amount is read-only — Replenish is what changes
      what a Lump Sum Project is funded (as a new row, pending until Save), and
      the allocation is derived from these lines. displayValues is still the
      formatted text each row shows. */

  /** A code resolved to its name for display, falling back to the code itself. */
  const sourceName = (code?: string) =>
    sources?.find((s) => s.Organization === code)?.Name ?? code ?? '';
  const agreementName = (code?: string) =>
    agreements?.find((a) => a.Code === code)?.Name ?? code ?? '';

  /*  WHICH ROW IS "THE FIRST" is firstFundingLine()'s decision, shared with the
      Replenish dialog and mirrored by the server. undefined when there is no
      saved live row — then no rendered row can match it and nothing is held. */
  const firstLineId = firstFundingLine(fundingProfiles)?.Id;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900"></h2>
        <div className="flex items-center gap-4">
          <div className={`text-sm font-medium ${getTotalPercentageColor()}`}>
            Total: {totalPercentage.toFixed(1)}%
            {totalPercentage !== 100 && (
              <span className="text-xs ml-1">
                ({totalPercentage < 100
                  ? `${(100 - totalPercentage).toFixed(1)}% remaining`
                  : `${(totalPercentage - 100).toFixed(1)}% over`})
              </span>
            )}
          </div>
          <div className={`text-sm font-medium ${getTotalPercentageColor()}`}>
            Total Amount: {totalAmount.FormatToCurrency()}
          </div>
          {/*  Only while something is pending, so the control cannot be mistaken
               for a way to undo a SAVED line — those are removed with Delete. */}
          {isDirty && onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={disabled}
              className={`text-sm font-medium text-amber-700 hover:text-amber-900 underline ${getDisabledClass(disabled)}`}
              title="Put the funding lines back to what was last saved. Nothing is sent."
            >
              Discard funding changes
            </button>
          )}
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader className="w-1/3">Source</TableHeader>
            <TableHeader className="w-1/3">Agreement</TableHeader>
            <TableHeader className="w-1/6">Amount</TableHeader>
            <TableHeader className="w-1/6">Percentage</TableHeader>
            <TableHeader className="w-auto">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {fundingProfiles.map((profile, index) => {
            if (profile.IsDeleted) return null;
            const isUnsaved = profile.Id === 0;
            return (
              <TableRow
                key={isUnsaved ? `new-${index}` : profile.Id}
                className={isUnsaved ? 'bg-amber-50' : undefined}
                data-unsaved-line={isUnsaved ? 'true' : undefined}
              >
                {/*  Read-only from here to the Amount. A funding line is written by
                     CreateLumpSum or appended by Replenish (pending until Save); the
                     code is shown with its name so the row reads without a lookup. */}
                <TableCell className="w-1/3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={profile.Source ? `${profile.Source} — ${sourceName(profile.Source)}` : ''}
                      readOnly
                      aria-readonly="true"
                      className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-50 text-gray-700 focus:outline-none"
                      placeholder="—"
                    />
                    {isUnsaved && (
                      <span
                        className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                        title="Added by Replenish. Press Save Lump Sum Project to apply it."
                      >
                        Unsaved
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-1/3">
                  <input
                    type="text"
                    value={profile.Agreement ? `${profile.Agreement} — ${agreementName(profile.Agreement)}` : ''}
                    readOnly
                    aria-readonly="true"
                    className="w-full px-2 py-1 border border-gray-300 rounded bg-gray-50 text-gray-700 focus:outline-none"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="w-1/6">
                  <input
                    type="text"
                    value={displayValues[index] || ''}
                    readOnly
                    aria-readonly="true"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-right bg-gray-50 text-gray-700 focus:outline-none"
                    placeholder="₱0.00"
                    title="Added by Replenish as a new line, not typed here"
                  />
                </TableCell>
                <TableCell className="w-1/6">
                  <input
                    type="number"
                    value={profile.Percentage?.toFixed(2) || ''}
                    className="w-full px-2 py-1 border rounded text-right bg-gray-100 border-gray-300"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.01"
                    readOnly
                    title="Percentage is automatically calculated based on amount"
                  />
                </TableCell>
                <TableCell>
                  {(() => {
                    const isFirstLine = profile.Id === firstLineId;
                    const held = protectFirstLine && isFirstLine;
                    return (
                      <button
                        onClick={() => onDelete(index)}
                        className={`text-red-600 hover:text-red-800 ${getDisabledClass(disabled || held)}`}
                        disabled={disabled || held}
                        title={
                          held
                            ? 'The line this project was created with cannot be removed while projects are itemized from it. Delete them first.'
                            : 'Remove this funding line'
                        }
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    );
                  })()}
                </TableCell>
              </TableRow>
            );
          })}
          {fundingProfiles.filter(p => !p.IsDeleted).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                This Lump Sum Project has no funding line. One is written when the project is
                created, and Replenish adds the rest — each pending until Save.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Percentage validation indicator */}
      {totalPercentage > 0 && Math.abs(totalPercentage - 100) >= 0.01 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">
            Total percentage must equal 100% (currently {totalPercentage.toFixed(2)}%).
          </p>
        </div>
      )}
    </div>
  );
};

export default LumpSumFundingProfileForm;
