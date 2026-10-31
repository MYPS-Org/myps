// =============================================================================
// PlanningProjectForm — a planning project's own fields (MY-PFL-16): description,
// category and sub-category, location, horizon, start / end years, its one Civil
// Works component with one major item, and its planned yearly costs.
//
// Shared by the Add page and the project page's edit mode. On edit, Category and
// Region are fixed (both are part of the MY Project ID) and Start Year follows
// canEditStartYear (only while the project is New, MY-PFL-12).
//
// An RDIP's projects are in its region; a UDIP's may be anywhere and are
// implemented by its cluster office. Options come complete from the server and
// are narrowed here, keeping a saved value visible (filterKeepingSelected).
// =============================================================================

import React, { useMemo } from 'react';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';
import { filterKeepingSelected, isCategoryValidForYear, isThrustAllowedForCategory, isThrustValidForYear } from '../../../utils/GlobalFunctions';
import type { PlanningFormOptions, PlanningProjectFields } from '../Model.d';
import { Field, INPUT_CLASS } from './Shared';
import { EditableYearlyCostGrid } from './YearlyCostGrid';

interface Props {
  options: PlanningFormOptions;
  value: PlanningProjectFields;
  onChange: (value: PlanningProjectFields) => void;
  mode: 'add' | 'edit';
  canEditStartYear: boolean;
  /** The values as saved, so a retired saved value stays offered. */
  saved?: PlanningProjectFields | null;
}

const PlanningProjectForm: React.FC<Props> = ({ options, value, onChange, mode, canEditStartYear, saved }) => {
  const set = (patch: Partial<PlanningProjectFields>) => onChange({ ...value, ...patch });
  const isRdip = options.Portfolio.Kind === 1;
  const year = value.StartYear || new Date().getFullYear();
  const region = isRdip ? options.Portfolio.OwnerParticipantId : value.Region;

  const categoryOptions = useMemo(
    () =>
      filterKeepingSelected(options.Categories, (c) => c.IsActive || isCategoryValidForYear(c, year), 'CategoryId', saved?.Category)
        .map((c) => ({ value: c.CategoryId, label: c.CategoryName ?? String(c.CategoryId) })),
    [options.Categories, year, saved?.Category],
  );
  const validThrustKeys = useMemo(() => new Set(options.Thrusts.map((t) => t.PAPKey)), [options.Thrusts]);
  const thrustOptions = useMemo(
    () =>
      filterKeepingSelected(
        options.Thrusts,
        (t) => t.PAPKey > 0 && (t.IsActive || isThrustValidForYear(t, year)) && isThrustAllowedForCategory(t.PAPKey, value.Category, options.CategoryThrustMap, validThrustKeys),
        'PAPKey',
        saved?.Thrust,
      ).map((t) => ({ value: t.PAPKey, label: t.ThrustDescription })),
    [options.Thrusts, options.CategoryThrustMap, validThrustKeys, value.Category, year, saved?.Thrust],
  );

  const provinces = options.Provinces.filter((p) => p.RegionParticipantId === region);
  const cities = options.Cities.filter((c) => c.ProvinceCode === value.Province);
  const districts = options.LegislativeDistricts.filter((d) => d.ProvinceCode === value.Province);
  const deos = options.DEOs.filter((d) => d.RegionParticipantId === region);
  const offices = isRdip ? options.ImplementingOffices.filter((o) => o.RegionParticipantId === region) : options.ImplementingOffices;
  const horizon = options.HorizonTypes.find((h) => h.Id === value.HorizonTypeId);
  const infraTypes = options.InfraTypes.filter((i) => i.IsActive || i.InfraCode === saved?.Component.InfraTypeFK);
  const scopes = options.ScopesOfWork.filter(
    (s) => (s.IsActive || s.Enum === saved?.Component.WorkTypeFK) && (!value.Component.InfraTypeFK || s.InfraType.length === 0 || s.InfraType.includes(value.Component.InfraTypeFK)),
  );
  const unit = options.ScopesOfWork.find((s) => s.Enum === value.Component.WorkTypeFK)?.Measure;
  const setComponent = (patch: Partial<PlanningProjectFields['Component']>) => set({ Component: { ...value.Component, ...patch } });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h4 className="text-base font-semibold text-gray-900">Project</h4>
        <Field label="Description" required>
          <textarea
            className={INPUT_CLASS}
            rows={2}
            maxLength={1000}
            value={value.Description}
            onChange={(e) => set({ Description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Category" required hint={mode === 'edit' ? 'Part of the Project ID; cannot change.' : undefined}>
            <SearchableDropdown
              options={categoryOptions}
              value={value.Category || undefined}
              onChange={(v) => set({ Category: Number(v), Thrust: null })}
              placeholder="Select a Category"
              disabled={mode === 'edit'}
            />
          </Field>
          <Field label="Sub-Category">
            <SearchableDropdown
              options={thrustOptions}
              value={value.Thrust ?? undefined}
              onChange={(v) => set({ Thrust: v ? Number(v) : null })}
              placeholder={value.Category ? 'Select a Sub-Category' : 'Select a Category first'}
              disabled={!value.Category}
              allowClear
            />
          </Field>
          <Field label="Horizon" required hint="Drives warnings, not limits.">
            <select
              className={INPUT_CLASS}
              value={value.HorizonTypeId || ''}
              onChange={(e) => set({ HorizonTypeId: Number(e.target.value) })}
            >
              <option value="">Select</option>
              {options.HorizonTypes.filter((h) => h.IsActive || h.Id === saved?.HorizonTypeId).map((h) => (
                <option key={h.Id} value={h.Id}>
                  {h.Name}{h.Years ? ` (${h.Years} years)` : ' (open-ended)'}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Year" required hint={mode === 'edit' && !canEditStartYear ? 'Changeable only while New.' : undefined}>
              <input
                type="number"
                min={1990}
                max={2100}
                className={INPUT_CLASS}
                disabled={!canEditStartYear}
                value={value.StartYear || ''}
                onChange={(e) => set({ StartYear: Number(e.target.value) })}
              />
            </Field>
            <Field label="End Year" hint="When known.">
              <input
                type="number"
                min={value.StartYear || 1990}
                max={2100}
                className={INPUT_CLASS}
                value={value.EndYear ?? ''}
                onChange={(e) => set({ EndYear: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-base font-semibold text-gray-900">Location</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Region" required hint={isRdip ? "The RDIP's region." : mode === 'edit' ? 'Part of the Project ID; cannot change.' : undefined}>
            {isRdip ? (
              <input className={INPUT_CLASS} disabled value={options.Portfolio.OwnerName ?? ''} />
            ) : (
              <select
                className={INPUT_CLASS}
                disabled={mode === 'edit'}
                value={value.Region ?? ''}
                onChange={(e) => set({ Region: e.target.value || null, Province: null, City: null, LegislativeDistrict: null, DEO: null })}
              >
                <option value="">Select</option>
                {options.Regions.map((r) => <option key={r.ParticipantId} value={r.ParticipantId}>{r.Name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Province">
            <select className={INPUT_CLASS} value={value.Province ?? ''} onChange={(e) => set({ Province: e.target.value || null, City: null, LegislativeDistrict: null })}>
              <option value="">Not set</option>
              {provinces.map((p) => <option key={p.Code} value={p.Code}>{p.Name}</option>)}
            </select>
          </Field>
          <Field label="City / Municipality">
            <select className={INPUT_CLASS} disabled={!value.Province} value={value.City ?? ''} onChange={(e) => set({ City: e.target.value || null })}>
              <option value="">Not set</option>
              {cities.map((c) => <option key={c.Code} value={c.Code}>{c.Name}</option>)}
            </select>
          </Field>
          <Field label="Legislative District">
            <select className={INPUT_CLASS} disabled={!value.Province} value={value.LegislativeDistrict ?? ''} onChange={(e) => set({ LegislativeDistrict: e.target.value || null })}>
              <option value="">Not set</option>
              {districts.map((d) => <option key={d.Code} value={d.Code}>{d.Name}</option>)}
            </select>
          </Field>
          <Field label="District Engineering Office">
            <select className={INPUT_CLASS} value={value.DEO ?? ''} onChange={(e) => set({ DEO: e.target.value || null })}>
              <option value="">Not set</option>
              {deos.map((d) => <option key={d.ParticipantId} value={d.ParticipantId}>{d.Name}</option>)}
            </select>
          </Field>
          <Field label="Implementing Office" hint={isRdip ? undefined : "The UDIP's cluster office."}>
            {isRdip ? (
              <select className={INPUT_CLASS} value={value.ImplementingOffice ?? ''} onChange={(e) => set({ ImplementingOffice: e.target.value || null })}>
                <option value="">Not set</option>
                {offices.map((o) => <option key={o.ParticipantId} value={o.ParticipantId}>{o.Name}</option>)}
              </select>
            ) : (
              <input className={INPUT_CLASS} disabled value={offices[0]?.Name ?? options.Portfolio.OwnerName ?? ''} />
            )}
          </Field>
          {!isRdip && (
            <Field label="Reporting Region">
              <select className={INPUT_CLASS} value={value.ReportingRegion ?? ''} onChange={(e) => set({ ReportingRegion: e.target.value || null })}>
                <option value="">Not set</option>
                {options.Regions.map((r) => <option key={r.ParticipantId} value={r.ParticipantId}>{r.Name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Region Wide">
            <select className={INPUT_CLASS} value={value.RegionWide ?? ''} onChange={(e) => set({ RegionWide: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Not set</option>
              {options.RegionWides.map((r) => <option key={r.NameId} value={r.NameId}>{r.Name}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-base font-semibold text-gray-900">Civil Works component (CW1) and its major item of work</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Infrastructure Type" required>
            <select
              className={INPUT_CLASS}
              value={value.Component.InfraTypeFK}
              onChange={(e) => setComponent({ InfraTypeFK: e.target.value, WorkTypeFK: 0 })}
            >
              <option value="">Select</option>
              {infraTypes.map((i) => <option key={i.InfraCode} value={i.InfraCode}>{i.InfraName}</option>)}
            </select>
          </Field>
          <Field label="Dominant Type of Work" required>
            <select
              className={INPUT_CLASS}
              disabled={!value.Component.InfraTypeFK}
              value={value.Component.WorkTypeFK || ''}
              onChange={(e) => setComponent({ WorkTypeFK: Number(e.target.value) })}
            >
              <option value="">Select</option>
              {scopes.map((s) => <option key={s.Enum} value={s.Enum}>{s.Description}</option>)}
            </select>
          </Field>
          <Field label={`Physical Target${unit ? ` (${unit})` : ''}`}>
            <input
              type="number"
              min={0}
              step="any"
              className={INPUT_CLASS}
              value={value.Component.PhysicalTarget ?? ''}
              onChange={(e) => setComponent({ PhysicalTarget: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label="Component Description" className="md:col-span-3">
            <input
              className={INPUT_CLASS}
              maxLength={1000}
              value={value.Component.Description}
              onChange={(e) => setComponent({ Description: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-base font-semibold text-gray-900">Planned yearly cost</h4>
        <p className="text-sm text-gray-500">
          From the Start Year{value.EndYear ? ` to the End Year (${value.EndYear})` : ''}. No year is entered with zero.
          {horizon?.Years ? ` Years past the ${horizon.Name.toLowerCase()} horizon (${value.StartYear}–${value.StartYear + horizon.Years - 1}) are saved with a warning.` : ''}
        </p>
        <EditableYearlyCostGrid
          rows={value.YearlyCosts}
          onChange={(rows) => set({ YearlyCosts: rows })}
          startYear={value.StartYear}
          endYear={value.EndYear}
        />
      </section>
    </div>
  );
};

export default PlanningProjectForm;
