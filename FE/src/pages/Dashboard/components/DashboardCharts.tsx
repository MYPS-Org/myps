import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ChartPieIcon,
  MapPinIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { AnimatedCurrency, formatCompactMoney } from './AnimatedCounter';
import { useDashboardTheme } from '../DashboardTheme';
import UpdatingBadge from './UpdatingBadge';

export interface MonthlyTrend {
  month: string;
  budget: number; // in Millions
  actual: number; // in Millions
}

export interface StatusSegment {
  name: string;
  count: number;
  color: string;
  hoverColor: string;
}

export interface IslandAllocation {
  name: string;
  budget: number;
  projectCount: number;
}

/** One project category's share of the fiscal year (Dashboard/Statuses Categories). */
export interface CategoryShare {
  /** tOptionProjectCategory.CategoryId: what the header Category filter takes. */
  id: number;
  name: string;
  projectCount: number;
  budget: number;
}

interface Props {
  selectedYear: number;
  monthlyData: MonthlyTrend[];
  categories: CategoryShare[];
  islandData: IslandAllocation[];
  /** Trend comes from a separate fetch (useDashboardTrend) than statuses/islands, so it gets its own flag. */
  isTrendLoading?: boolean;
  /** Categories and islands share one fetch (useDashboardStatuses). */
  isStatusesLoading?: boolean;
  /** Clicking a year's bars selects that fiscal year for the whole dashboard, as the trajectory chart does. */
  onSelectYear?: (year: number, anchor?: Element) => void;
  /** The header Category filter's value, highlighted in the categories box. */
  selectedCategoryId?: number | null;
  /** Clicking a category applies it as the header Category filter; null clears it. Omit to make the rows read-only (Demo Data). */
  onSelectCategory?: (category: { id: number; name: string } | null, anchor?: Element) => void;
  onSelectIsland?: (island: string | null) => void;
  activeIslandFilter?: string | null;
}

const CATEGORY_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500',
  'bg-sky-500', 'bg-rose-500', 'bg-teal-500', 'bg-orange-500',
];

export const DashboardCharts: React.FC<Props> = ({
  selectedYear,
  monthlyData,
  categories,
  islandData,
  isTrendLoading = false,
  isStatusesLoading = false,
  onSelectYear,
  selectedCategoryId,
  onSelectCategory,
  onSelectIsland,
  activeIslandFilter,
}) => {
  const { isLight } = useDashboardTheme();
  const [hoveredTrend, setHoveredTrend] = useState<MonthlyTrend | null>(null);

  const maxTrend = Math.max(1, ...monthlyData.flatMap((item) => [item.budget || 0, item.actual || 0]));

  // Live DB returns one point per fiscal year that has cost data -- 16 of them today, and one
  // more every budget cycle. The bar/gap sizing below was written for the five-year Demo Data
  // series and cannot shrink past its fixed widths, so beyond ~8 years the row overflowed the
  // card and the trailing year labels spilled over the panel next to it. Tighten spacing (and
  // let the bars flex) once the series gets long, instead of capping the series or scrolling it.
  const isDenseTrend = monthlyData.length > 8;
  const trendRowGap = isDenseTrend ? 'gap-1 sm:gap-2' : 'gap-3 sm:gap-6';
  const trendBarGap = isDenseTrend ? 'gap-0.5 sm:gap-1' : 'gap-1.5';
  // flex-1 + max-w lets a bar shrink when the year count grows but keeps the original width
  // when the series is short; min-w keeps a bar visible rather than collapsing it to nothing.
  const trendBarWidth = isDenseTrend
    ? 'flex-1 min-w-[3px] max-w-[10px]'
    : 'flex-1 min-w-[8px] max-w-4 sm:max-w-6';
  const trendLabelSize = isDenseTrend ? 'text-[10px] px-0' : 'text-xs';
  // Each year's two amounts are printed under its label, so they read without hovering. A dense
  // series has no room for them; the footer then carries the selected year's, and hover the rest.
  const showBarValues = !isDenseTrend;
  const trendBarArea = showBarValues ? 'h-[164px]' : 'h-[200px]';
  // The series is kept on screen while a filter change reloads it (useDashboardTrend keeps the
  // previous data); only a first load, with nothing to show yet, gets the skeleton.
  const showTrendSkeleton = isTrendLoading && monthlyData.length === 0;
  const isTrendUpdating = isTrendLoading && monthlyData.length > 0;
  const selectedTrend = monthlyData.find((item) => Number(item.month) === selectedYear);

  const visibleCategories = categories.filter((category) => category.projectCount > 0);
  const totalCategoryProjects = visibleCategories.reduce((sum, item) => sum + item.projectCount, 0);
  const selectedCategory = visibleCategories.find((category) => category.id === selectedCategoryId);
  const totalIslandBudget = islandData.reduce((sum, item) => sum + item.budget, 0);
  // Categories and islands reloading for a new year or filter, the previous ones still shown.
  const isStatusesUpdating = isStatusesLoading && (categories.length > 0 || islandData.length > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 1. Annual Budget & LS Itemization Multi-Year Trend (Col 8) */}
      <section
        className={`lg:col-span-8 rounded-2xl p-6 sm:p-7 border shadow-md flex flex-col justify-between transition-all duration-200 ${
          isLight
            ? 'bg-white border-slate-200/90 text-slate-800'
            : 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
        }`}
      >
        <div>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`p-1.5 rounded-lg border ${
                    isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}
                >
                  <ChartBarIcon className="w-4 h-4" />
                </span>
                <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Annual Budget & Lump Sum Itemization Trend
                </h3>
              </div>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Persisted component cost appropriations vs. released Lump Sum itemization across fiscal years.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              {isTrendUpdating && <UpdatingBadge isLight={isLight} />}
              <span className={`flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                <span className="w-3 h-3 rounded bg-blue-600 shadow-xs" />
                Infrastructure Budget
              </span>
              <span className={`flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                <span className="w-3 h-3 rounded bg-amber-500 shadow-xs" />
                LS Itemized
              </span>
            </div>
          </div>

          {showTrendSkeleton ? (
            <div className="mt-6 h-64 flex items-end gap-3 sm:gap-6 px-3 pb-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="relative flex-1 h-full flex items-end gap-1.5 justify-center">
                  <div
                    className={`w-4 sm:w-6 rounded-t-md animate-pulse ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}
                    style={{ height: `${30 + (index % 3) * 20}%` }}
                  />
                  <div
                    className={`w-4 sm:w-6 rounded-t-md animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`}
                    style={{ height: `${20 + (index % 4) * 15}%` }}
                  />
                </div>
              ))}
            </div>
          ) : monthlyData.length === 0 ? (
            <div className={`h-64 grid place-items-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No historical budget records available in database.
            </div>
          ) : (
            <div
              data-testid="annual-trend-chart"
              aria-busy={isTrendUpdating}
              className={`mt-6 h-64 flex items-end ${trendRowGap} border-b px-3 pb-1 transition-opacity ${isTrendUpdating ? 'opacity-60' : ''} ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
            >
              {monthlyData.map((item) => {
                const isSelected = Number(item.month) === selectedYear;
                const bVal = item.budget || 0;
                const aVal = item.actual || 0;
                const budgetHeight = Math.max(bVal > 0 ? 3 : 0, (bVal / maxTrend) * 100);
                const actualHeight = Math.max(aVal > 0 ? 3 : 0, (aVal / maxTrend) * 100);

                return (
                  <button
                    type="button"
                    key={item.month}
                    className={`relative flex-1 min-w-0 h-full flex flex-col justify-end group cursor-pointer rounded-t-md focus:outline-none focus-visible:ring-2 ${
                      isLight ? 'focus-visible:ring-blue-500' : 'focus-visible:ring-amber-400'
                    }`}
                    onClick={(event) => onSelectYear?.(Number(item.month), event.currentTarget)}
                    onMouseEnter={() => setHoveredTrend(item)}
                    onMouseLeave={() => setHoveredTrend(null)}
                    onFocus={() => setHoveredTrend(item)}
                    onBlur={() => setHoveredTrend(null)}
                    aria-pressed={isSelected}
                    aria-label={`FY ${item.month}: budget ${formatCompactMoney(item.budget)}, LS itemized ${formatCompactMoney(item.actual)}. Select this fiscal year.`}
                  >
                    {/* Tooltip */}
                    {hoveredTrend?.month === item.month && (
                      <div className="absolute z-20 -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-950 text-white text-xs p-2.5 shadow-2xl border border-slate-700 pointer-events-none">
                        <div className="font-bold text-amber-400">FY {item.month}</div>
                        <div className="text-slate-200">Budget: {formatCompactMoney(item.budget)}</div>
                        <div className="text-slate-300">LS Itemized: {formatCompactMoney(item.actual)}</div>
                      </div>
                    )}

                    {/* Bars */}
                    <div className={`flex items-end justify-center ${trendBarGap} ${trendBarArea}`}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${budgetHeight}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                        className={`${trendBarWidth} rounded-t-md transition-all ${
                          isSelected
                            ? 'bg-gradient-to-t from-blue-700 to-blue-500 shadow-md shadow-blue-500/30'
                            : isLight
                            ? 'bg-blue-600/70 group-hover:bg-blue-600'
                            : 'bg-blue-600/60 group-hover:bg-blue-500'
                        }`}
                      />
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${actualHeight}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
                        className={`${trendBarWidth} rounded-t-md transition-all ${
                          isSelected
                            ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-md shadow-amber-400/30'
                            : isLight
                            ? 'bg-amber-500/80 group-hover:bg-amber-500'
                            : 'bg-amber-500/50 group-hover:bg-amber-400'
                        }`}
                      />
                    </div>

                    <div
                      className={`text-center ${trendLabelSize} py-2 transition-colors ${
                        isSelected
                          ? isLight
                            ? 'font-black text-blue-700 bg-blue-50 rounded-b border border-blue-200'
                            : 'font-black text-amber-400 bg-slate-800 rounded-b border border-slate-700'
                          : isLight
                          ? 'font-semibold text-slate-600 group-hover:text-slate-900'
                          : 'font-semibold text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      {item.month}
                    </div>
                    {showBarValues && (
                      <div className="pt-1 text-center leading-tight whitespace-nowrap" data-testid={`trend-values-${item.month}`}>
                        <div className={`text-[11px] font-bold ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                          {formatCompactMoney(bVal)}
                        </div>
                        <div className={`text-[10px] font-semibold ${isLight ? 'text-amber-600' : 'text-amber-300'}`}>
                          {formatCompactMoney(aVal)}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
          <span>
            Active Scope: <strong className={isLight ? 'text-blue-700' : 'text-amber-400'}>FY {selectedYear}</strong>
            {selectedTrend && (
              <>
                {' · '}Budget <strong className={isLight ? 'text-blue-700' : 'text-blue-300'}>{formatCompactMoney(selectedTrend.budget || 0)}</strong>
                {' · '}LS Itemized <strong className={isLight ? 'text-amber-600' : 'text-amber-300'}>{formatCompactMoney(selectedTrend.actual || 0)}</strong>
              </>
            )}
            {onSelectYear && <span className={isLight ? 'text-slate-400' : 'text-slate-500'}> · click a year to switch</span>}
          </span>
          <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Amounts shown in standard valuation</span>
        </div>
      </section>

      {/* 2. Project Categories Breakdown (Col 4): the year's projects per category, the same
          categories the header Category filter offers. Selecting one applies that filter. */}
      <section
        className={`lg:col-span-4 rounded-2xl p-6 sm:p-7 border shadow-md flex flex-col justify-between transition-all duration-200 ${
          isLight
            ? 'bg-white border-slate-200/90 text-slate-800'
            : 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
        }`}
      >
        <div>
          <div className={`flex items-center justify-between pb-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
            <div className="flex items-center gap-2">
              <span
                className={`p-1.5 rounded-lg border ${
                  isLight ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                <ChartPieIcon className="w-4 h-4" />
              </span>
              <div>
                <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Project Categories</h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>FY {selectedYear} projects per category</p>
              </div>
            </div>
            <span className="flex flex-col items-end gap-1">
              <span
                className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isLight ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-slate-800 text-amber-400 border-slate-700'
                }`}
              >
                {totalCategoryProjects.toLocaleString()} Projects
              </span>
              {isStatusesUpdating && <UpdatingBadge isLight={isLight} />}
            </span>
          </div>

          <div className={`mt-4 space-y-2 max-h-[22rem] overflow-y-auto pr-1 transition-opacity ${isStatusesUpdating ? 'opacity-60' : ''}`}>
            {isStatusesLoading && categories.length === 0 ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={`h-14 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
              ))
            ) : visibleCategories.length === 0 ? (
              <div className={`py-12 text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                No categorized projects recorded for FY {selectedYear}.
              </div>
            ) : (
              visibleCategories.map((item, index) => {
                const pct = totalCategoryProjects ? (item.projectCount / totalCategoryProjects) * 100 : 0;
                const isSelected = selectedCategoryId === item.id;
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!onSelectCategory}
                    // The box, not the row, is held in place: rows come and go as the list reloads.
                    onClick={(event) => onSelectCategory?.(
                      isSelected ? null : { id: item.id, name: item.name },
                      event.currentTarget.closest('section') ?? undefined
                    )}
                    aria-pressed={isSelected}
                    title={onSelectCategory ? (isSelected ? 'Clear the Category filter' : 'Filter the Dashboard by this category') : undefined}
                    className={`w-full p-2.5 rounded-xl text-left border transition-all disabled:cursor-default ${
                      isLight
                        ? isSelected
                          ? 'bg-blue-50 border-blue-500/60 ring-1 ring-blue-500/30 shadow-sm'
                          : 'bg-slate-50/70 enabled:hover:bg-slate-100 border-slate-200'
                        : isSelected
                        ? 'bg-slate-800 border-amber-500/60 ring-2 ring-amber-500/30 shadow-md'
                        : 'bg-slate-800/40 enabled:hover:bg-slate-800/70 border-slate-800 enabled:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                        <span className="min-w-0">
                          <span className={`block font-bold break-words ${isSelected ? (isLight ? 'text-blue-700' : 'text-amber-300') : (isLight ? 'text-slate-800' : 'text-slate-100')}`}>
                            {item.name}
                          </span>
                          <span className={`block text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {formatCompactMoney(item.budget)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.projectCount.toLocaleString()}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            isLight
                              ? 'bg-white text-slate-700 border-slate-200'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          {pct.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className={`mt-2 w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-900'}`}>
                      <motion.div
                        className={`h-full rounded-full ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selectedCategory && onSelectCategory && (
          <div className={`mt-3 pt-2 border-t flex items-center justify-between text-xs ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
            <span className={`font-medium truncate ${isLight ? 'text-blue-700' : 'text-amber-300'}`} title={selectedCategory.name}>
              Filtering: {selectedCategory.name}
            </span>
            <button
              type="button"
              onClick={(event) => onSelectCategory(null, event.currentTarget.closest('section') ?? undefined)}
              className={`text-xs font-bold underline shrink-0 ml-2 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Clear Filter
            </button>
          </div>
        )}
      </section>

      {/* 3. Island-Group Live DB Allocation Cards (Col 12) */}
      <section
        className={`lg:col-span-12 rounded-2xl p-6 sm:p-7 border shadow-md transition-all duration-200 ${
          isLight
            ? 'bg-white border-slate-200/90 text-slate-800'
            : 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
        }`}
      >
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2">
            <span
              className={`p-1.5 rounded-lg border ${
                isLight ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}
            >
              <GlobeAltIcon className="w-4 h-4" />
            </span>
            <div>
              <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                FY {selectedYear} Island-Group Allocation
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Aggregated from project location schedules and approved component costs.
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-2 text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {isStatusesUpdating && <UpdatingBadge isLight={isLight} />}
            Total Outlay: <strong className={isLight ? 'text-blue-700' : 'text-amber-400'}>{formatCompactMoney(totalIslandBudget)}</strong>
          </div>
        </div>

        {/* Luzon, Visayas, Mindanao, plus an Unassigned card when projects resolve to no island. */}
        <div className={`grid grid-cols-1 ${islandData.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'} gap-4 mt-5 transition-opacity ${isStatusesUpdating ? 'opacity-60' : ''}`}>
          {isStatusesLoading && islandData.length === 0 ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className={`h-28 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
            ))
          ) : islandData.length === 0 ? (
            <p className={`text-xs py-6 text-center col-span-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No geographic allocation data recorded for this year.
            </p>
          ) : (
            islandData.map((item) => {
              const share = totalIslandBudget ? Math.round((item.budget / totalIslandBudget) * 100) : 0;
              const isSelected = activeIslandFilter === item.name;

              return (
                <motion.button
                  key={item.name}
                  whileHover={{ y: -3 }}
                  onClick={() => onSelectIsland?.(isSelected ? null : item.name)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    isLight
                      ? isSelected
                        ? 'bg-indigo-50 border-indigo-500 shadow-md ring-1 ring-indigo-400'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200'
                      : isSelected
                      ? 'bg-slate-800 border-indigo-400/80 ring-2 ring-indigo-500/40 shadow-xl'
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/70 hover:border-slate-600'
                  }`}
                >
                  <div className={`flex items-center justify-between text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-indigo-500" />
                      {/* Unassigned is not an island group: projects whose province resolves to no island. */}
                      {item.name === 'Unassigned' ? 'Unassigned (no island)' : `${item.name} Group`}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full border font-extrabold text-[11px] ${
                        isLight
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-900 text-indigo-300 border-slate-700'
                      }`}
                    >
                      {share}%
                    </span>
                  </div>

                  <div className={`mt-2 text-xl sm:text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <AnimatedCurrency value={item.budget} compact={true} />
                  </div>

                  <div className={`flex items-center justify-between text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span>{item.projectCount.toLocaleString()} Active Projects</span>
                    <span className={`text-[11px] font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Click to filter</span>
                  </div>

                  <div className={`mt-3 w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-900'}`}>
                    <motion.div
                      className="h-full rounded-full bg-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${share}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardCharts;
