import React, { useMemo } from 'react';
import type { ThrustEnum } from '../../../Project/Model.d';

interface ThrustDropdownProps {
  value?: number | string;
  onChange?: (value: number) => void;
  thrusts: ThrustEnum[];
  infraTypeFilter?: string;   // optional: filter list by infrastructure type
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

/**
 * Reusable select component for ProjectDetails.Thrust.
 * Pass ThrustEnum[] from ProjectEnums.Thrusts as `thrusts`.
 * Optionally filter by `infraTypeFilter` to show only relevant thrust entries.
 *
 * @example
 * <ThrustDropdown
 *   value={form.Thrust}
 *   onChange={v => setForm(f => ({ ...f, Thrust: v }))}
 *   thrusts={projectEnums.Thrusts}
 *   infraTypeFilter={selectedInfraType}
 * />
 */
const ThrustDropdown: React.FC<ThrustDropdownProps> = ({
  value = '',
  onChange,
  thrusts,
  infraTypeFilter,
  placeholder = '— Select Thrust —',
  disabled = false,
  className = '',
  id,
  name,
}) => {
  const filtered = useMemo(() => {
    if (!infraTypeFilter) return thrusts;
    return thrusts.filter(t =>
      !t.InfrastructureType ||
      t.InfrastructureType.toLowerCase().includes(infraTypeFilter.toLowerCase())
    );
  }, [thrusts, infraTypeFilter]);

  // Group by ProgramName for <optgroup> layout
  const grouped = useMemo(() => {
    const map = new Map<string, ThrustEnum[]>();
    filtered.forEach(t => {
      const key = t.ProgramName || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filtered]);

  return (
    <select
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      onChange={e => onChange?.(Number(e.target.value))}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition ${className}`}
    >
      <option value="">{placeholder}</option>
      {[...grouped.entries()].map(([program, items]) => (
        <optgroup key={program} label={program}>
          {items.map(t => (
            <option key={t.Id} value={t.Id}>
              {t.SubProgramName ? `${t.SubProgramName} — ` : ''}{t.ThrustDescription}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default ThrustDropdown;
