// =============================================================================
// ReplenishLumpSumDialog.tsx — raise a Lump Sum Project's allocation.
//
// NewAmount is the new TOTAL, not the delta, and it must exceed the current
// total: replenishing appends a funding line, it never edits an existing one,
// so there is no way to express a decrease.
//
// LOCAL UNTIL SAVE (2026-09-08). This dialog makes no request. It resolves the
// new line's Source and Agreement the way ReplenishLumpSum did, builds a draft
// funding line with Id 0, and hands it to the form through onSubmit. The form
// appends it, every figure that depends on the lines moves at once (marked as
// unsaved), and "Save Lump Sum Project" is the one commit point — UpdateLumpSum
// inserts the Id-0 line, applies the same stage gate, pair rule and Amount > 0,
// and writes the audit note. So the checks below are no longer a courtesy
// ahead of a round trip: nothing follows them until Save, and a draft that
// slipped through with a blank half would only be refused minutes later, on a
// save that also carries the user's other edits. Each refusal here is final.
//
// "Current Allocation" is the LOCAL funded total — the live lines the form
// holds, pending adds and removals included — so two unsaved top-ups stack
// correctly and the strictly-increasing rule is checked against the figure the
// user is looking at, not the server's.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { getComponentsEnums } from '../../Project/Service';
import { firstFundingLine, sameSource } from '../utils/firstFundingLine';
import type { Dropdowns } from '../../Project/Model.d';
import type { LumpSumFundingProfile } from '../Model.d';

interface ReplenishLumpSumDialogProps {
  open: boolean;
  onClose: () => void;
  /** The resolved draft line, Id 0. The form appends it; nothing is saved. */
  onSubmit: (draft: LumpSumFundingProfile) => void;
  /**
   * The form's LIVE local funding lines — persisted rows, pending removals
   * (flagged IsDeleted) and pending top-ups (Id 0) alike. The dialog derives
   * the current allocation from them and names the FIRST one as the line a
   * blank top-up copies from. An empty array means "no line", never "unknown":
   * the form always holds an array once the detail fetch has landed, and the
   * page bumps the form's dataVersion on that fetch.
   */
  fundingProfiles: LumpSumFundingProfile[];
  /** What is left to itemize, with any pending delta already added in. */
  remaining: number;
  /**
   * The allocation as the SERVER holds it — vLumpSumBalance.Total, which is the
   * LS component's cost, not the sum of the funding lines (2026-09-10).
   *
   * Normally the two agree, because every save re-derives the component from the
   * lines. Where they do not — the funding-gap shape LumpSum.Repair.FundingGap
   * exists for — a top-up sized against the lines alone would be an increase on
   * this screen and a DECREASE in the database, with an audit note saying
   * increased. So the new total must beat both figures, which is exactly what
   * UpdateLumpSum now refuses on (Title "Allocation Mismatch").
   */
  savedAllocation: number;
}

/*  Agreement codes are compared the way source codes are (firstFundingLine.ts's
    sameSource): trimmed and case-insensitively. A stored code with padding —
    which the server defends against explicitly, trimming SourceOrg before it
    compares — would otherwise miss a `===` lookup here and make the dialog
    refuse a top-up the server accepts, or skip the ownership check silently.
    SQL Server's own `=` ignores trailing spaces; JavaScript's does not. */
const sameCode = (a?: string, b?: string): boolean =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/*  WHY THE BLANK AGREEMENT OPTION IS OR IS NOT AVAILABLE — one value, derived
    once, that the option's disabled state, its label and the submit guard all
    read. Deriving the same three-way condition in three places is how an
    enabled option ends up refused on submit, or a disabled one labelled as
    available. */
type BlankAgreementProblem = 'none' | 'other-source' | null;

const ReplenishLumpSumDialog: React.FC<ReplenishLumpSumDialogProps> = ({
  open,
  onClose,
  onSubmit,
  fundingProfiles,
  remaining,
  savedAllocation,
}) => {
  const { showToast } = useToast();

  const [newAmount, setNewAmount] = useState<number | ''>('');

  /*  WHERE THE TOP-UP COMES FROM. The draft carries the difference as a new
      line; these two say which source and agreement it carries. Both optional.
      THE FIRST FUNDING LINE IS THE ONLY LINE A BLANK COPIES FROM (2026-09-08;
      the largest line before that): blank and blank take both halves from it;
      a Source with a blank Agreement takes the first line's agreement ONLY if
      the first line is under that source, and any other source is refused
      until the agreement is named — even when later lines exist under it. The
      rule is firstFundingLine.ts's, mirrored by ReplenishLumpSum for API
      callers; this dialog applies it, and UpdateLumpSum re-checks the pair. */
  const [source, setSource] = useState<string>('');
  const [agreement, setAgreement] = useState<string>('');
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);

  useEffect(() => {
    if (!open || dropdowns) return;
    getComponentsEnums()
      .then((response) => setDropdowns(response.Data))
      .catch(() => {
        // httpClient's interceptor already raised the toast; the selects stay
        // empty and only a blank top-up (copying the first line) can go through.
      });
  }, [open, dropdowns]);

  /** The local funded total: Σ live lines, pending changes included. */
  const currentAllocation = fundingProfiles
    .filter((line) => !line.IsDeleted)
    .reduce((sum, line) => sum + (line.Amount || 0), 0);

  /*  THE FIGURE A TOP-UP HAS TO BEAT. The draft is still SIZED against the local
      lines — that arithmetic has to hold, since the save posts the lines — but it
      is CHECKED against whichever figure is higher, so a save can never land at
      or below the allocation the server already holds. The two differ only on a
      funding-gap parent, and the notice below says so in that case. */
  const floorToBeat = Math.max(currentAllocation, savedAllocation);
  const fundingGap = savedAllocation - currentAllocation;

  const first = firstFundingLine(fundingProfiles);
  const sourceIsFirst = sameSource(source, first?.Source);

  /*  Agreements belong to a source. Once a source is chosen only its agreements
      are offered; with no source chosen the full list is. Same comparator as the
      first-line check, so the two halves of this dialog agree on "same source". */
  const agreementOptions = (dropdowns?.Agreements ?? []).filter(
    (a) => !source || sameSource(a.SourceOrg, source),
  );

  const blankAgreementProblem: BlankAgreementProblem = !first
    ? 'none'
    : source && !sourceIsFirst
      ? 'other-source'
      : null;

  /*  Disabled when a blank would be refused AND there is something else to pick.
      With no agreements to offer (the lookup failed, or the source owns none) a
      disabled blank option would be a dead end; the option stays selectable so
      the user lands on its label, and the submit guard below says why it cannot
      go through. The guard fires either way — see the header. */
  const blankAgreementDisabled = blankAgreementProblem !== null && agreementOptions.length > 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setNewAmount('');
      return;
    }
    const parsed = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(parsed)) setNewAmount(parsed);
  };

  const formatCurrency = (value: number | '') =>
    value === ''
      ? ''
      : new Intl.NumberFormat('en-PH', {
          style: 'currency',
          currency: 'PHP',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);

  const reset = () => {
    setNewAmount('');
    setSource('');
    setAgreement('');
  };

  /*  Closed from OUTSIDE — the form hides this dialog when the program closes
      while it is open — the draft must go too, or the next legitimate open
      shows a stale amount and pair the user never confirmed. */
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  /**
   * ReplenishLumpSum's four branches, client-side, in the server's order. Returns
   * the pair or the refusal — never a pair with a blank half, and never a pair
   * whose agreement belongs to another source.
   */
  const resolvePair = (): { Source: string; Agreement: string } | { error: string } => {
    let resolvedSource = source.trim();
    let resolvedAgreement = agreement.trim();

    if (!resolvedSource && !resolvedAgreement) {
      // Neither given: the first funding line, both halves of it.
      if (!first) {
        return {
          error:
            'Choose a Funding Source and Agreement — this project has no funding line to copy them from.',
        };
      }
      resolvedSource = first.Source;
      resolvedAgreement = first.Agreement;
    } else if (!resolvedAgreement) {
      // A source without an agreement: the FIRST line's agreement, only when
      // the first line is under that source.
      if (!first) {
        return {
          error: 'Choose a Funding Agreement — this project has no funding line to copy one from.',
        };
      }
      if (!sourceIsFirst) {
        return {
          error: `Choose a Funding Agreement — the first funding line is under ${first.Source}, not ${resolvedSource}.`,
        };
      }
      resolvedAgreement = first.Agreement;
    } else if (!resolvedSource) {
      // An agreement without a source: the agreement's own owner.
      const owner = dropdowns?.Agreements.find((a) => sameCode(a.Code, resolvedAgreement))?.SourceOrg;
      if (!owner) {
        return {
          error: `Choose a Funding Source — the owner of ${resolvedAgreement} could not be determined.`,
        };
      }
      resolvedSource = owner;
    }

    /*  The pair must belong together. When both were chosen the agreement list
        was already filtered by source, so this only ever refuses a copy from a
        first line whose stored pair is itself wrong — and UpdateLumpSum would
        refuse that save, so better here. Unknown to the lookup (it failed, or an
        old code) is let through: the server owns the code table. */
    const owner = dropdowns?.Agreements.find((a) => sameCode(a.Code, resolvedAgreement))?.SourceOrg;
    if (owner && !sameSource(owner, resolvedSource)) {
      return {
        error: `Funding Agreement ${resolvedAgreement} does not belong to Funding Source ${resolvedSource}. Choose an agreement under that source.`,
      };
    }

    return { Source: resolvedSource, Agreement: resolvedAgreement };
  };

  const handleSubmit = () => {
    if (newAmount === '' || typeof newAmount !== 'number') {
      showToast({ type: 'error', message: 'Enter a valid amount.' });
      return;
    }

    if (newAmount <= floorToBeat) {
      showToast({
        type: 'error',
        message:
          `The new total must be greater than the current allocation ` +
          `(₱${floorToBeat.toLocaleString('en-PH')}). Decreases are not allowed.`,
      });
      return;
    }

    const pair = resolvePair();
    if ('error' in pair) {
      showToast({ type: 'error', message: pair.error });
      return;
    }

    onSubmit({
      Id: 0,
      Source: pair.Source,
      Agreement: pair.Agreement,
      /*  Rounded to centavos: this is a subtraction of two doubles read off the
          screen, and an unrounded 499.9000000000233 would reach the column and
          the audit note as typed. */
      Amount: Math.round((newAmount - currentAllocation) * 100) / 100,
      Percentage: 0, // re-derived by the table's effect with the rest
      IsDeleted: false,
    });

    showToast({
      type: 'success',
      message: 'Funding line added. Press "Save Lump Sum Project" to apply it.',
    });

    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const blankSourceLabel = first
    ? `Same as the first funding line (${first.Source})`
    : "The agreement's own source";

  const blankAgreementLabel =
    blankAgreementProblem === 'none'
      ? 'No funding line to copy from — choose an agreement'
      : blankAgreementProblem === 'other-source'
        ? `Not available — the first funding line is under ${first!.Source}; choose an agreement`
        : `Same as the first funding line (${first!.Agreement})`;

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Replenish Lump Sum Project
          </DialogTitle>

          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Allocation</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(currentAllocation)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Remaining</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>

            {/*  THE LINES DO NOT ADD UP TO THE ALLOCATION (2026-09-10). Every save
                 re-derives the allocation from the lines, so the two normally agree;
                 where they do not, a top-up sized against the lines alone would read
                 as an increase here and write the allocation DOWN. The server refuses
                 that outright, so say what is wrong before the user types a figure
                 that cannot be accepted. */}
            {fundingGap > 0.005 && (
              <div
                data-funding-gap
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>
                  The funding lines add up to {formatCurrency(currentAllocation)}, but the recorded
                  allocation is {formatCurrency(savedAllocation)}. A top-up has to reach past the
                  higher figure, or the save is refused — repair the funding profile to clear this.
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-red-500">*</span>New Total Allocation
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">₱</span>
                <input
                  type="text"
                  value={typeof newAmount === 'number' ? newAmount.toLocaleString('en-PH') : ''}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be greater than the current allocation. The difference is added to the Funding
                Profile as a new line, marked unsaved until you press Save Lump Sum Project.
              </p>
            </div>

            {/* Source and agreement for the new line — optional, defaulting to the first funding line */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Funding Source</label>
                <select
                  value={source}
                  onChange={(e) => { setSource(e.target.value); setAgreement(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  {/*  Always selectable. With no first line a blank source means "the
                       agreement's own source", resolved from the lookup. */}
                  <option value="">{blankSourceLabel}</option>
                  {(dropdowns?.Sources ?? []).map((s) => (
                    <option key={s.Organization} value={s.Organization}>{s.Organization} — {s.Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Funding Agreement</label>
                <select
                  value={agreement}
                  onChange={(e) => setAgreement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                >
                  {/*  Disabled, not removed, when a blank would be refused: the
                       source-change handler has already cleared the box, so the user
                       lands on this text and picks from the list beneath it. Removing
                       the option while `agreement` is '' would leave a controlled
                       select showing a choice that is not in state. */}
                  <option value="" disabled={blankAgreementDisabled}>
                    {blankAgreementLabel}
                  </option>
                  {agreementOptions.map((a) => (
                    <option key={a.Code} value={a.Code}>{a.Code} — {a.Name}</option>
                  ))}
                </select>
              </div>
            </div>

            {typeof newAmount === 'number' && newAmount > currentAllocation && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Increase:</strong> {formatCurrency(newAmount - currentAllocation)}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-6 mt-6">
            <Button color="zinc" onClick={handleClose}>
              Cancel
            </Button>
            <Button color="orange" onClick={handleSubmit}>
              Replenish
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ReplenishLumpSumDialog;
