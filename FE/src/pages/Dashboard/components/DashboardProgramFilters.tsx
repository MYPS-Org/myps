import React, { useEffect, useState } from 'react';
import { FlagIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import { fetchDashboardFilterOptions, type DashboardFilterOptions, type DashboardStageOption } from '../Service';

interface Props {
  /** tOptionProgramType.NameId; null for all program types. */
  programType: number | null;
  onProgramTypeChange: (programType: number | null) => void;
  /** null for all budget stages. */
  stage: DashboardStageOption | null;
  onStageChange: (stage: DashboardStageOption | null) => void;
  /** Demo Data has no real program types or stages behind it, so both are off there. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * The header's Program Type and Program Stage Name filters, beside Category.
 *
 * Plain dropdowns rather than the type-3-characters-first autocomplete the pick-list rule
 * otherwise asks for: each is a short set fixed in code (the four EnumProgramType values, and
 * the nine budget stages in DashboardController.BudgetStageNames). Both lists load together,
 * the first time the filters are enabled; after a failure, focusing either one retries.
 */
const DashboardProgramFilters: React.FC<Props> = ({
  programType,
  onProgramTypeChange,
  stage,
  onStageChange,
  disabled = false,
  disabledReason,
}) => {
  const [options, setOptions] = useState<DashboardFilterOptions | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  useEffect(() => {
    if (disabled || loadState !== 'idle') return;
    setLoadState('loading');
    fetchDashboardFilterOptions()
      .then((loaded) => {
        setOptions(loaded);
        setLoadState('loaded');
      })
      .catch(() => setLoadState('error'));
  }, [disabled, loadState]);

  const retryAfterError = () => {
    if (loadState === 'error') setLoadState('idle');
  };

  const statusOption =
    loadState === 'loading' ? (
      <option disabled className="bg-slate-900 text-slate-400">Loading…</option>
    ) : loadState === 'error' ? (
      <option disabled className="bg-slate-900 text-rose-300">Could not load the list. Click again to retry.</option>
    ) : null;

  const boxClass = (isChosen: boolean) =>
    `flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border focus-within:border-amber-400/70 ${
      isChosen ? 'border-amber-400/50' : 'border-slate-700/80'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`;
  const selectClass =
    'w-32 sm:w-40 truncate bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer disabled:cursor-not-allowed';
  const optionClass = 'bg-slate-900 text-slate-100';

  return (
    <div className="flex flex-wrap items-center gap-2" title={disabled ? disabledReason : undefined}>
      <div className={boxClass(programType !== null && !disabled)}>
        <RectangleStackIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <select
          aria-label="Filter by program type"
          disabled={disabled}
          value={programType ?? ''}
          onFocus={retryAfterError}
          onChange={(event) => onProgramTypeChange(event.target.value ? Number(event.target.value) : null)}
          className={selectClass}
        >
          <option value="" className={optionClass}>All program types</option>
          {statusOption}
          {options?.ProgramTypes.map((option) => (
            <option key={option.ProgramType} value={option.ProgramType} className={optionClass}>
              {option.Name}
            </option>
          ))}
        </select>
      </div>

      <div className={boxClass(stage !== null && !disabled)}>
        <FlagIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <select
          aria-label="Filter by program stage name"
          disabled={disabled}
          value={stage?.StageName ?? ''}
          title={stage ? `${stage.StageName} · ${stage.FullName}` : undefined}
          onFocus={retryAfterError}
          onChange={(event) =>
            onStageChange(options?.Stages.find((option) => option.StageName === event.target.value) ?? null)
          }
          className={selectClass}
        >
          <option value="" className={optionClass}>All stages</option>
          {statusOption}
          {options?.Stages.map((option) => (
            <option key={option.StageName} value={option.StageName} className={optionClass}>
              {option.StageName} · {option.FullName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default DashboardProgramFilters;
