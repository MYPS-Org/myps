// =============================================================================
// A portfolio's saved totals (MY-PFL-24): each one the planned, proposed and
// approved cost per term year, with the year's budget ceiling, as it stood when
// it was saved -- at a term's opening or closing, after a GAA update, or here on
// request. They are never edited; opening one shows it per project.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { SavedTotals, SavedTotalsDetails, TotalsYear } from '../Model.d';
import * as Service from '../Service';
import { formatPeso } from '../utils';
import { Field, INPUT_CLASS, ModuleDialog } from './Shared';

const YearsTable: React.FC<{ years: TotalsYear[]; showCeiling: boolean }> = ({ years, showCeiling }) => (
  <table className="min-w-full text-sm">
    <thead className="bg-gray-50 text-left text-gray-600">
      <tr>
        <th className="px-3 py-2">Year</th>
        <th className="px-3 py-2 text-right">Approved</th>
        <th className="px-3 py-2 text-right">Proposed</th>
        <th className="px-3 py-2 text-right">Planned</th>
        {showCeiling && <th className="px-3 py-2 text-right">Ceiling</th>}
      </tr>
    </thead>
    <tbody>
      {years.map((y) => (
        <tr key={y.Year} className="border-t">
          <td className="px-3 py-2">{y.Year}</td>
          <td className="px-3 py-2 text-right">{y.Approved ? formatPeso(y.Approved) : '–'}</td>
          <td className="px-3 py-2 text-right">{y.Proposed ? formatPeso(y.Proposed) : '–'}</td>
          <td className="px-3 py-2 text-right">{y.Planned ? formatPeso(y.Planned) : '–'}</td>
          {showCeiling && <td className="px-3 py-2 text-right">{y.Ceiling != null ? formatPeso(y.Ceiling) : '–'}</td>}
        </tr>
      ))}
    </tbody>
  </table>
);

const SavedTotalsTab: React.FC<{ portfolioId: number; canSave: boolean }> = ({ portfolioId, canSave }) => {
  const { showToast } = useToast();
  const [list, setList] = useState<SavedTotals[] | null>(null);
  const [details, setDetails] = useState<SavedTotalsDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await Service.fetchSavedTotals(portfolioId);
      setList(response.Data);
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to load the saved totals. Please try again.' });
    }
  }, [portfolioId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (snapshotId: number) => {
    try {
      const response = await Service.fetchSavedTotalsDetails(snapshotId);
      setDetails(response.Data);
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to open the saved totals. Please try again.' });
    }
  };

  const save = async () => {
    try {
      const response = await Service.saveTotals(portfolioId, note.trim());
      showToast({ type: 'success', message: response.Data.Message });
      setSaving(false);
      setNote('');
      await load();
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to save the totals. Please try again.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Each year counts once: Approved when an approved GAA / GAA-R of that year holds it, else Proposed when an annual program of that year holds it, else Planned.
        </p>
        {canSave && <Button color="blue" onClick={() => setSaving(true)}>Save Totals</Button>}
      </div>
      {list === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-500">No totals saved yet.</p>
      ) : (
        list.map((s) => (
          <div key={s.SnapshotId} className="rounded-md border border-gray-200">
            <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-sm">
              <span>
                <strong>{s.ReasonLabel}</strong> — {new Date(s.TakenDate).toLocaleString('en-PH')} by {s.TakenBy}
                {s.Note && <span className="text-gray-500"> · {s.Note}</span>}
              </span>
              <Button plain onClick={() => open(s.SnapshotId)}>View {s.Projects} project{s.Projects === 1 ? '' : 's'}</Button>
            </div>
            <YearsTable years={s.Years} showCeiling />
          </div>
        ))
      )}

      <ModuleDialog
        open={saving}
        onClose={() => setSaving(false)}
        title="Save Totals"
        width="max-w-md"
        footer={
          <>
            <Button outline onClick={() => setSaving(false)}>Cancel</Button>
            <Button color="green" onClick={save}>Save Totals</Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">The portfolio's totals are saved as they stand now. Saved totals are never edited.</p>
        <Field label="Note">
          <input className={INPUT_CLASS} maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </ModuleDialog>

      <ModuleDialog
        open={details !== null}
        onClose={() => setDetails(null)}
        title={details ? `${details.ReasonLabel} — ${new Date(details.TakenDate).toLocaleString('en-PH')}` : 'Saved Totals'}
        width="max-w-4xl"
        footer={<Button outline onClick={() => setDetails(null)}>Close</Button>}
      >
        {details && (
          <>
            <p className="text-sm text-gray-700">{details.PortfolioName}{details.Note ? ` · ${details.Note}` : ''}</p>
            <YearsTable years={details.Years} showCeiling />
            {details.Projects.length === 0 ? (
              <p className="text-sm text-gray-500">No project had a cost in the term when these were saved.</p>
            ) : details.Projects.map((p) => (
              <div key={p.ProjectId} className="rounded-md border border-gray-200">
                <div className="bg-gray-50 px-3 py-2 text-sm"><strong>{p.ProjectId}</strong> — {p.Description}</div>
                <YearsTable years={p.Years} showCeiling={false} />
              </div>
            ))}
          </>
        )}
      </ModuleDialog>
    </div>
  );
};

export default SavedTotalsTab;
