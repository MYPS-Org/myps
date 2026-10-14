import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fetchDashboardCategories, type DashboardCategoryOption } from '../Service';

export interface DashboardCategory {
  id: number;
  name: string;
}

interface Props {
  value: DashboardCategory | null;
  onChange: (category: DashboardCategory | null) => void;
  /** Demo Data has no real categories behind it, so the filter is off there. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Header filter that narrows every dashboard section to one project category.
 *
 * Deliberately NOT a type-3-characters-first autocomplete: the category list is short and fixed
 * (33 rows in tOptionProjectCategory) and the stakeholders asked to see all of it as soon as the
 * box is focused. It is loaded once, on first focus, and typing narrows it in the browser.
 */
const DashboardCategoryFilter: React.FC<Props> = ({ value, onChange, disabled = false, disabledReason }) => {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<DashboardCategoryOption[] | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(
    () => (categories ?? []).filter((option) => !trimmed || option.CategoryName.toLowerCase().includes(trimmed)),
    [categories, trimmed]
  );

  // Loads the list the first time the box opens; after a failure, the next open retries.
  useEffect(() => {
    if (!isOpen || loadState === 'loading' || loadState === 'loaded') return undefined;
    let active = true;
    setLoadState('loading');
    fetchDashboardCategories()
      .then((options) => {
        if (!active) return;
        setCategories(options);
        setLoadState('loaded');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
    // loadState is read only to skip a load that is already running or done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Typing changes the list; keep the highlight on its first match.
  useEffect(() => {
    setActiveIndex(matches.length > 0 ? 0 : -1);
  }, [matches]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  // Keep the highlighted option in view while moving through a long list with the arrow keys.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen, listboxId]);

  const choose = (option: DashboardCategoryOption) => {
    onChange({ id: option.CategoryId, name: option.CategoryName });
    setQuery('');
    setIsOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    // Put the user straight back in the box, list open, to choose again.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      if (!matches.length) return;
      setActiveIndex((index) =>
        event.key === 'ArrowDown'
          ? (index + 1) % matches.length
          : index <= 0 ? matches.length - 1 : index - 1
      );
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0 && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    }
  };

  if (value) {
    return (
      <div
        className="flex items-center gap-1.5 max-w-[16rem] bg-slate-950/80 pl-2.5 pr-1 py-1 rounded-xl border border-amber-400/50"
        title={value.name}
      >
        <TagIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-xs font-bold text-white truncate">
          <span className="text-slate-400 font-semibold">Category: </span>
          {value.name}
        </span>
        <button
          type="button"
          onClick={clear}
          aria-label="Clear category filter"
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const showList = isOpen && !disabled;

  return (
    <div ref={containerRef} className="relative" title={disabled ? disabledReason : undefined}>
      <div
        className={`flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-700/80 focus-within:border-amber-400/70 ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Filter by category"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={showList && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          disabled={disabled}
          value={query}
          placeholder="All categories"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          className="w-36 sm:w-44 bg-transparent text-xs font-semibold text-white placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {showList && (
        <div className="absolute right-0 z-30 mt-1.5 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-1 text-xs">
          {loadState === 'error' ? (
            <p className="px-2.5 py-2 text-rose-300">Categories could not be loaded. Click the box to try again.</p>
          ) : loadState !== 'loaded' ? (
            <p className="px-2.5 py-2 text-slate-400">Loading categories…</p>
          ) : matches.length === 0 ? (
            <p className="px-2.5 py-2 text-slate-400">No categories match “{query.trim()}”.</p>
          ) : (
            <>
              <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-slate-400">
                {trimmed
                  ? `${matches.length} of ${categories?.length ?? 0} categories`
                  : `All ${matches.length} categories. Type to narrow, or leave empty for all.`}
              </p>
              <ul id={listboxId} role="listbox" aria-label="Project categories" className="max-h-80 overflow-y-auto">
                {matches.map((option, index) => (
                  <li
                    key={option.CategoryId}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    // mousedown, not click: it lands before the input's blur closes the list.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(option);
                    }}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer font-semibold ${
                      index === activeIndex ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{option.CategoryName}</span>
                    {!option.IsActive && (
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border ${
                          index === activeIndex ? 'border-slate-950/30 text-slate-900' : 'border-slate-600 text-slate-400'
                        }`}
                      >
                        Inactive
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardCategoryFilter;
