// =============================================================================
// GAA Updates (MY-PFL-21, -22): the runs of the portfolio update that follows
// every GAA / GAA-R approval, and Run GAA Update for a year. The update runs on
// its own after an approval; this is for checking it and repeating it, which
// changes nothing a run already did.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { UpdateRunCounts, UpdateRuns } from '../Model.d';
import * as Service from '../Service';
import { Field, INPUT_CLASS, ModuleDialog } from '../components/Shared';

const countsLabel = (counts: UpdateRunCounts | null) => {
  if (!counts) return '—';
  const parts = [
    `${counts.StatusMoves ?? 0} status change(s)`,
    `${counts.StartYearMoves ?? 0} start year(s) moved`,
    `${counts.AddedToPip ?? 0} added to PIP`,
    `${counts.TotalsSaved ?? 0} totals saved`,
  ];
  if (counts.NotAddedNoPip && counts.NotAddedNoPip.length > 0) parts.push(`${counts.NotAddedNoPip.length} not added (no open PIP)`);
  return parts.join(' · ');
};

export const GaaUpdatesDialog: React.FC<{ open: boolean; onClose: () => void; onRan: () => void }> = ({ open, onClose, onRan }) => {
  const { showToast } = useToast();
  const { can } = useAuth();
  const [data, setData] = useState<UpdateRuns | null>(null);
  const [year, setYear] = useState<number | ''>('');

  const load = useCallback(async () => {
    try {
      const response = await Service.fetchUpdateRuns();
      setData(response.Data);
      setYear((y) => (y === '' && response.Data.Years.length > 0 ? response.Data.Years[0] : y));
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to load the GAA updates. Please try again.' });
    }
  }, [showToast]);

  useEffect(() => {
    if (open) {
      setData(null);
      setYear('');
      load();
    }
  }, [open, load]);

  const run = async () => {
    if (year === '') return;
    try {
      const response = await Service.runGaaUpdate(year);
      showToast({ type: 'success', message: response.Data.Message });
      await load();
      onRan();
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to run the GAA update. Please try again.' });
    }
  };

  return (
    <ModuleDialog open={open} onClose={onClose} title="GAA Updates" width="max-w-4xl" footer={<Button outline onClick={onClose}>Close</Button>}>
      <p className="text-sm text-gray-700">
        When a GAA or GAA-R is approved, every open portfolio is updated: Potential projects in the GAA become Ongoing, the others go back to New
        with the next start year, New projects move their start year on, and GAA projects whose Multi Year ID matches no planning project join PIP as Ongoing.
        It also runs after a Non-Implementable revision or a Termination with No Disbursements. Running it again changes nothing it already did.
      </p>
      {can('MultiYear', 'RunGaaUpdate') && data && (
        <div className="flex items-end gap-3">
          <Field label="GAA year" className="w-48">
            <select className={INPUT_CLASS} value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}>
              {data.Years.length === 0 && <option value="">No approved GAA</option>}
              {data.Years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Button color="blue" onClick={run} disabled={year === ''}>Run GAA Update</Button>
        </div>
      )}
      <div className="max-h-96 overflow-y-auto rounded-md border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Started by</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">Loading…</td></tr>
            ) : data.Runs.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">No update has run yet.</td></tr>
            ) : data.Runs.map((r) => (
              <tr key={r.Id} className="border-t align-top">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.RunDate).toLocaleString('en-PH')}<div className="text-gray-500">{r.RunBy}</div></td>
                <td className="px-3 py-2">{r.Year}</td>
                <td className="px-3 py-2">{r.Trigger}{r.ProgramName && <div className="text-gray-500">{r.ProgramName}</div>}</td>
                <td className="px-3 py-2">{countsLabel(r.Counts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModuleDialog>
  );
};
