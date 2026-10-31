// =============================================================================
// Phase 2 dialogs: Propose to RBP / UBP (MY-PFL-20), Add to PIP and Set PIP Cost
// (MY-PFL-18, -19). The server decides every rule; these dialogs show what it
// offers (InitProposeForm, ShowPipCandidates) and repeat its simple checks so
// the user hears about a blank field before the round trip.
// See documents/plans/multi-year-phase-2-annual-program-linking.md.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { DateInput } from '../../../components/tailwindui/date-input';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { NamedOption, PipCandidate, ProposeFormOptions } from '../Model.d';
import * as Service from '../Service';
import { formatPeso, STATUS_NAMES } from '../utils';
import { Field, INPUT_CLASS, MembershipStatusBadge, ModuleDialog } from '../components/Shared';

const toastIfSilent = (error: unknown, showToast: ReturnType<typeof useToast>['showToast'], action: string) => {
  if (!(error as { Message?: string } | undefined)?.Message) {
    showToast({ type: 'error', message: `Failed to ${action}. Please try again.` });
  }
};

/** The "Yes" value of Feasibility Study and Detailed Design: it needs a date (ValidateProjectDetailsLookups). */
const NEEDS_DATE = 1;

const NamedSelect: React.FC<{
  label: string;
  required?: boolean;
  value: number | '';
  options: NamedOption[];
  onChange: (value: number | '') => void;
}> = ({ label, required, value, options, onChange }) => (
  <Field label={label} required={required}>
    <select className={INPUT_CLASS} value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
      <option value="">Select</option>
      {options.map((o) => <option key={o.NameId} value={o.NameId}>{o.Name}</option>)}
    </select>
  </Field>
);

interface ProposeForm {
  ProgramPK: string;
  OperatingUnit: string;
  Origin: number | '';
  Agency: number | '';
  ImplementationMode: number | '';
  EmergencyMode: number | '';
  RowAvailable: number | '';
  Feasibility: number | '';
  FeasibilityDate: string;
  DetailedDesign: number | '';
  DetailedDesignDate: string;
  Tier: number | '';
}

const EMPTY_PROPOSE: ProposeForm = {
  ProgramPK: '', OperatingUnit: '', Origin: '', Agency: '', ImplementationMode: '', EmergencyMode: '',
  RowAvailable: '', Feasibility: '', FeasibilityDate: '', DetailedDesign: '', DetailedDesignDate: '', Tier: '',
};

/** The fields the server refuses when blank, in the dialog's own words. */
const proposeRefusal = (form: ProposeForm): string | null => {
  const missing: string[] = [];
  if (!form.ProgramPK) missing.push('Program');
  if (!form.OperatingUnit) missing.push('Operating Unit');
  if (form.Origin === '') missing.push('Origin');
  if (form.Agency === '') missing.push('Originating Agency');
  if (form.ImplementationMode === '') missing.push('Implementation Mode');
  if (form.EmergencyMode === '') missing.push('Emergency Mode');
  if (form.RowAvailable === '') missing.push('ROW Available');
  if (form.Feasibility === '') missing.push('Feasibility Study');
  if (form.Feasibility === NEEDS_DATE && !form.FeasibilityDate) missing.push('Feasibility Date');
  if (form.DetailedDesign === '') missing.push('Detailed Design');
  if (form.DetailedDesign === NEEDS_DATE && !form.DetailedDesignDate) missing.push('Detailed Design Date');
  if (form.Tier === '') missing.push('Tier');
  return missing.length === 0 ? null : `Fill in: ${missing.join(', ')}.`;
};

export const ProposeDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  memberId: number;
  onSaved: () => void;
}> = ({ open, onClose, memberId, onSaved }) => {
  const { showToast } = useToast();
  const [options, setOptions] = useState<ProposeFormOptions | null>(null);
  const [form, setForm] = useState<ProposeForm>(EMPTY_PROPOSE);
  // A ref, so a parent's inline onClose does not reload the dialog on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setOptions(null);
    Service.fetchProposeForm(memberId)
      .then((response) => {
        setOptions(response.Data);
        setForm({ ...EMPTY_PROPOSE, Tier: response.Data.Tier ?? '' });
      })
      .catch((error) => {
        toastIfSilent(error, showToast, 'load the programs');
        closeRef.current();
      });
  }, [open, memberId, showToast]);

  const set = <K extends keyof ProposeForm>(key: K, value: ProposeForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const program = options?.Programs.find((p) => p.ProgramPK === form.ProgramPK);

  const submit = async () => {
    const refusal = proposeRefusal(form);
    if (refusal) {
      showToast({ type: 'error', message: refusal });
      return;
    }
    try {
      const response = await Service.proposeToAnnualProgram({
        MemberId: memberId,
        ProgramPK: form.ProgramPK,
        OperatingUnit: form.OperatingUnit,
        Origin: Number(form.Origin),
        Agency: Number(form.Agency),
        ImplementationMode: form.ImplementationMode === '' ? null : form.ImplementationMode,
        EmergencyMode: form.EmergencyMode === '' ? null : form.EmergencyMode,
        RowAvailable: form.RowAvailable === '' ? null : form.RowAvailable,
        Feasibility: form.Feasibility === '' ? null : form.Feasibility,
        FeasibilityDate: form.Feasibility === NEEDS_DATE ? form.FeasibilityDate : null,
        DetailedDesign: form.DetailedDesign === '' ? null : form.DetailedDesign,
        DetailedDesignDate: form.DetailedDesign === NEEDS_DATE ? form.DetailedDesignDate : null,
        Tier: Number(form.Tier),
      });
      showToast({ type: 'success', message: response.Data.Message });
      onSaved();
    } catch (error) {
      toastIfSilent(error, showToast, 'propose the project');
    }
  };

  const blocked = !!options && (options.MissingFields.length > 0 || options.Programs.length === 0);

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title={options ? `Propose to RBP / UBP — ${options.ProjectId}` : 'Propose to RBP / UBP'}
      width="max-w-2xl"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="green" onClick={submit} disabled={!options || blocked || !program || program.AlreadyProposed || !program.PlannedAmount}>Propose</Button>
        </>
      }
    >
      {!options ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            {options.Description} — {options.PortfolioName}, now <strong>{STATUS_NAMES[options.Status]}</strong>.
            {options.Status === 1 ? ' Proposing makes it Potential until the GAA is approved.' : ' It stays Ongoing: this is its next year.'}
          </p>
          {options.MissingFields.length > 0 && (
            <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
              <span>An annual project needs the project's {options.MissingFields.join(', ')}. Add them with Edit Project first.</span>
            </div>
          )}
          {options.Programs.length === 0 && (
            <div className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
              <span>No RBP or UBP program can take this project: none is at the RBP stage, still Working, for this portfolio's owner and for {options.StartYear} or later.</span>
            </div>
          )}
          <Field label="Program" required hint="The RBP / UBP for the budget year. The project brings that year's planned cost.">
            <select className={INPUT_CLASS} value={form.ProgramPK} onChange={(e) => set('ProgramPK', e.target.value)} disabled={blocked}>
              <option value="">Select</option>
              {options.Programs.map((p) => (
                <option key={p.ProgramPK} value={p.ProgramPK} disabled={p.AlreadyProposed || !p.PlannedAmount}>
                  {p.Name} ({p.StartYear}) — {p.AlreadyProposed ? 'already proposed for this year' : p.PlannedAmount ? formatPeso(p.PlannedAmount) : 'no planned cost for this year'}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Operating Unit" required>
              <select className={INPUT_CLASS} value={form.OperatingUnit} onChange={(e) => set('OperatingUnit', e.target.value)} disabled={blocked}>
                <option value="">Select</option>
                {options.OperatingUnits.map((o) => <option key={o.ParticipantId} value={o.ParticipantId}>{o.Name}</option>)}
              </select>
            </Field>
            <NamedSelect label="Tier" required value={form.Tier} options={options.Tiers} onChange={(v) => set('Tier', v)} />
            <NamedSelect label="Origin" required value={form.Origin} options={options.Origins} onChange={(v) => set('Origin', v)} />
            <NamedSelect label="Originating Agency" required value={form.Agency} options={options.Agencies} onChange={(v) => set('Agency', v)} />
            <NamedSelect label="Implementation Mode" required value={form.ImplementationMode} options={options.ImplementationModes} onChange={(v) => set('ImplementationMode', v)} />
            <NamedSelect label="Emergency Mode" required value={form.EmergencyMode} options={options.EmergencyModes} onChange={(v) => set('EmergencyMode', v)} />
            <NamedSelect label="ROW Available" required value={form.RowAvailable} options={options.RowAvailables} onChange={(v) => set('RowAvailable', v)} />
            <div />
            <NamedSelect label="Feasibility Study" required value={form.Feasibility} options={options.Feasibilities} onChange={(v) => set('Feasibility', v)} />
            {form.Feasibility === NEEDS_DATE ? (
              <Field label="Feasibility Date" required>
                <DateInput className={INPUT_CLASS} value={form.FeasibilityDate} onChange={(e) => set('FeasibilityDate', e.target.value)} />
              </Field>
            ) : <div />}
            <NamedSelect label="Detailed Design" required value={form.DetailedDesign} options={options.DetailedDesigns} onChange={(v) => set('DetailedDesign', v)} />
            {form.DetailedDesign === NEEDS_DATE ? (
              <Field label="Detailed Design Date" required>
                <DateInput className={INPUT_CLASS} value={form.DetailedDesignDate} onChange={(e) => set('DetailedDesignDate', e.target.value)} />
              </Field>
            ) : <div />}
          </div>
          <p className="text-xs text-gray-500">
            The new BP project carries this project's MY id as its Multi Year ID, which is how the GAA approval finds it later. Keep it when the project moves on to BP, NEP and GAA.
            Funding and locations are added afterwards on the project in Programs.
          </p>
        </>
      )}
    </ModuleDialog>
  );
};

export const AddToPipDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  onSaved: () => void;
}> = ({ open, onClose, portfolioId, onSaved }) => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<PipCandidate[] | null>(null);
  const [chosen, setChosen] = useState<PipCandidate | null>(null);
  const [mca, setMca] = useState('');

  const load = useCallback(async (text: string) => {
    try {
      const response = await Service.fetchPipCandidates(portfolioId, text);
      setCandidates(response.Data);
    } catch (error) {
      toastIfSilent(error, showToast, 'load the projects');
    }
  }, [portfolioId, showToast]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setChosen(null);
    setMca('');
    setCandidates(null);
    load('');
  }, [open, load]);

  const mcaValue = mca.trim() === '' ? null : Number(mca);
  const mcaInvalid = mcaValue === null || Number.isNaN(mcaValue) || mcaValue < 0 || mcaValue > 100;

  const submit = async () => {
    if (!chosen) {
      showToast({ type: 'error', message: 'Choose a project.' });
      return;
    }
    if (mcaInvalid) {
      showToast({ type: 'error', message: 'MCA Score must be between 0 and 100.' });
      return;
    }
    try {
      const response = await Service.addToPip(portfolioId, chosen.SourceMemberId, mcaValue!);
      showToast({ type: 'success', message: response.Data.Message });
      onSaved();
    } catch (error) {
      toastIfSilent(error, showToast, 'add the project to PIP');
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title="Add Project to PIP"
      width="max-w-4xl"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="green" onClick={submit} disabled={!chosen || mcaInvalid}>Add to PIP</Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">New and Potential projects of every RDIP and UDIP. Adding copies the project's cost into its Original Cost, which never changes.</p>
      <div className="flex gap-2">
        <input className={INPUT_CLASS} placeholder="Search by Project ID or description" maxLength={100} value={search}
          onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(search.trim())} />
        <Button color="blue" onClick={() => load(search.trim())}>Search</Button>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">From</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {candidates === null ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Loading…</td></tr>
            ) : candidates.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">No New or Potential project can be added to this PIP.</td></tr>
            ) : candidates.map((c) => (
              <tr key={c.SourceMemberId} className={`cursor-pointer border-t ${chosen?.SourceMemberId === c.SourceMemberId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => { setChosen(c); if (mca === '' && c.McaScore !== null) setMca(String(c.McaScore)); }}>
                <td className="px-3 py-2">
                  <input type="radio" name="pip-candidate" aria-label={c.ProjectId} checked={chosen?.SourceMemberId === c.SourceMemberId} onChange={() => setChosen(c)} />
                </td>
                <td className="px-3 py-2"><div className="font-medium">{c.ProjectId}</div><div className="text-gray-500">{c.Description}</div></td>
                <td className="px-3 py-2">{c.SourcePortfolioName}</td>
                <td className="px-3 py-2"><MembershipStatusBadge status={c.Status} /></td>
                <td className="px-3 py-2">{c.StartYear}</td>
                <td className="px-3 py-2 text-right">{formatPeso(c.Cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field label="MCA Score" required hint="0 to 100.">
        <input type="number" className={INPUT_CLASS} min={0} max={100} step="0.01" value={mca} onChange={(e) => setMca(e.target.value)} />
      </Field>
    </ModuleDialog>
  );
};

export const SetPipCostDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  memberId: number;
  projectId: string;
  cost: number;
  originalCost: number | null;
  onSaved: () => void;
}> = ({ open, onClose, memberId, projectId, cost, originalCost, onSaved }) => {
  const { showToast } = useToast();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setValue(String(cost));
      setReason('');
    }
  }, [open, cost]);

  const amount = useMemo(() => Number(value), [value]);
  const invalid = value.trim() === '' || Number.isNaN(amount) || amount <= 0;

  const submit = async () => {
    if (invalid) {
      showToast({ type: 'error', message: 'The PIP cost must be more than zero.' });
      return;
    }
    try {
      const response = await Service.setPipCost(memberId, amount, reason.trim());
      showToast({ type: 'success', message: response.Data.Message });
      onSaved();
    } catch (error) {
      toastIfSilent(error, showToast, 'save the PIP cost');
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title={`Set PIP Cost — ${projectId}`}
      width="max-w-md"
      footer={
        <>
          <Button outline onClick={onClose}>Cancel</Button>
          <Button color="green" onClick={submit} disabled={invalid}>Save PIP Cost</Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">Original Cost: <strong>{formatPeso(originalCost ?? cost)}</strong> — it never changes.</p>
      <Field label="PIP Cost" required>
        <input type="number" className={INPUT_CLASS} min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Field label="Reason">
        <textarea className={INPUT_CLASS} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </ModuleDialog>
  );
};
