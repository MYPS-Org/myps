// =============================================================================
// MembershipFieldsEditor — a project's planning fields in one portfolio
// (MY-PFL-14): Basis for Implementation (one), NEDA Project Status (one, no
// default), Readiness Level (several), RDP Results Matrix outcomes (several, one
// output each), Tier and MCA score.
//
// A value is offered when it is Active OR valid for the membership's start year
// (isCodeSelectable, the server's rule). A value already saved stays shown even
// once retired, and saves unchanged; only a NEW pick must be selectable.
// =============================================================================

import React from 'react';
import type { CodeListItem, MembershipFields, PlanningFormOptions } from '../Model.d';
import { isCodeSelectable } from '../utils';
import { Field, INPUT_CLASS } from './Shared';

type Options = Pick<PlanningFormOptions, 'BasisForImplementation' | 'NedaProjectStatus' | 'ReadinessLevels' | 'RdpOutcomes' | 'RdpOutputs' | 'Tiers'>;

interface Props {
  value: MembershipFields;
  onChange: (value: MembershipFields) => void;
  options: Options;
  /** The membership's start year: what validity is judged for. */
  year: number;
  /** The values saved before this edit, kept even when retired. */
  saved?: MembershipFields | null;
  disabled?: boolean;
}

const offered = (items: CodeListItem[], year: number, keep: (id: number) => boolean) =>
  items.filter((item) => isCodeSelectable(item, year) || keep(item.Id));

const MembershipFieldsEditor: React.FC<Props> = ({ value, onChange, options, year, saved, disabled }) => {
  const set = (patch: Partial<MembershipFields>) => onChange({ ...value, ...patch });
  const savedReadiness = new Set(saved?.ReadinessLevelIds ?? []);
  const savedRdp = new Set((saved?.RdpOutcomes ?? []).map((p) => `${p.OutcomeId}:${p.OutputId}`));

  const basis = offered(options.BasisForImplementation, year, (id) => id === saved?.BasisForImplementationId);
  const neda = offered(options.NedaProjectStatus, year, (id) => id === saved?.NedaProjectStatusId);
  const readiness = offered(options.ReadinessLevels, year, (id) => savedReadiness.has(id));
  const outcomes = offered(options.RdpOutcomes, year, (id) => (saved?.RdpOutcomes ?? []).some((p) => p.OutcomeId === id));

  const toggleReadiness = (id: number, on: boolean) =>
    set({ ReadinessLevelIds: on ? [...value.ReadinessLevelIds, id] : value.ReadinessLevelIds.filter((x) => x !== id) });

  const pickOutput = (outcomeId: number, outputId: number | null) =>
    set({
      RdpOutcomes: outputId
        ? [...value.RdpOutcomes.filter((p) => p.OutcomeId !== outcomeId), { OutcomeId: outcomeId, OutputId: outputId }]
        : value.RdpOutcomes.filter((p) => p.OutcomeId !== outcomeId),
    });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Basis for Implementation">
        <select
          className={INPUT_CLASS}
          disabled={disabled}
          value={value.BasisForImplementationId ?? ''}
          onChange={(e) => set({ BasisForImplementationId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Not set</option>
          {basis.map((b) => <option key={b.Id} value={b.Id}>{b.Name}</option>)}
        </select>
      </Field>

      <Field label="NEDA Project Status">
        <select
          className={INPUT_CLASS}
          disabled={disabled}
          value={value.NedaProjectStatusId ?? ''}
          onChange={(e) => set({ NedaProjectStatusId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Not set</option>
          {neda.map((n) => <option key={n.Id} value={n.Id}>{n.Name}</option>)}
        </select>
      </Field>

      <Field label="Tier">
        <select
          className={INPUT_CLASS}
          disabled={disabled}
          value={value.Tier ?? ''}
          onChange={(e) => set({ Tier: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Not set</option>
          {options.Tiers.filter((t) => t.IsActive !== false || t.NameId === saved?.Tier).map((t) => (
            <option key={t.NameId} value={t.NameId}>{t.Name}</option>
          ))}
        </select>
      </Field>

      <Field label="MCA Score" hint="0 to 100.">
        <input
          type="number"
          min={0}
          max={100}
          step="0.0001"
          className={INPUT_CLASS}
          disabled={disabled}
          value={value.McaScore ?? ''}
          onChange={(e) => set({ McaScore: e.target.value === '' ? null : Number(e.target.value) })}
        />
      </Field>

      <Field label="Readiness Level" className="md:col-span-2" hint={readiness.length ? 'Choose every level the project has reached.' : 'No Readiness Levels yet: add them in Code Tables > Multi-Year.'}>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {readiness.map((r) => (
            <label key={r.Id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                disabled={disabled}
                checked={value.ReadinessLevelIds.includes(r.Id)}
                onChange={(e) => toggleReadiness(r.Id, e.target.checked)}
              />
              {r.Name}
            </label>
          ))}
        </div>
      </Field>

      <Field label="RDP Results Matrix" className="md:col-span-2" hint={outcomes.length ? 'For each outcome the project serves, choose its output.' : 'No RDP outcomes yet: add them in Code Tables > Multi-Year.'}>
        <div className="space-y-2">
          {outcomes.map((outcome) => {
            const pick = value.RdpOutcomes.find((p) => p.OutcomeId === outcome.Id);
            const outputs = options.RdpOutputs.filter(
              (o) => o.OutcomeFK === outcome.Id && (isCodeSelectable(o, year) || savedRdp.has(`${outcome.Id}:${o.Id}`)),
            );
            return (
              <div key={outcome.Id} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                <span className="text-sm text-gray-700">{outcome.Name}</span>
                <select
                  aria-label={`Output for ${outcome.Name}`}
                  className={INPUT_CLASS}
                  disabled={disabled}
                  value={pick?.OutputId ?? ''}
                  onChange={(e) => pickOutput(outcome.Id, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Not served</option>
                  {outputs.map((o) => <option key={o.Id} value={o.Id}>{o.Name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </Field>
    </div>
  );
};

export default MembershipFieldsEditor;
