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

interface Props {
  selectedYear: number;
  monthlyData: MonthlyTrend[];
  statusData: StatusSegment[];
  islandData: IslandAllocation[];
  onStatusSelect?: (name: string | null) => void;
  activeStatusFilter?: string | null;
  onSelectIsland?: (island: string | null) => void;
  activeIslandFilter?: string | null;
}

const STAGE_NAME_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  BP: { bg: 'bg-sky-500', text: 'text-sky-600', hex: '#0284c7' },
  NEP: { bg: 'bg-amber-500', text: 'text-amber-600', hex: '#f59e0b' },
  'NEP-Errata': { bg: 'bg-purple-500', text: 'text-purple-600', hex: '#8b5cf6' },
  HGAB: { bg: 'bg-cyan-500', text: 'text-cyan-600', hex: '#06b6d4' },
  'HGAB-Amendments': { bg: 'bg-pink-500', text: 'text-pink-600', hex: '#ec4899' },
  GAA: { bg: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' },
  'GAA-Revisions': { bg: 'bg-rose-500', text: 'text-rose-600', hex: '#f43f5e' },
};

export const DashboardCharts: React.FC<Props> = ({
  selectedYear,
  monthlyData,
  statusData,
  islandData,
  onStatusSelect,
  activeStatusFilter,
  onSelectIsland,
  activeIslandFilter,
}) => {
  const { isLight } = useDashboardTheme();
  const [hoveredTrend, setHoveredTrend] = useState<MonthlyTrend | null>(null);

  const maxTrend = Math.max(1, ...monthlyData.flatMap((item) => [item.budget || 0, item.actual || 0]));
  const visibleStatuses = statusData.filter((s) => s.count > 0);
  const displayStatuses = visibleStatuses.length > 0 ? visibleStatuses : statusData;
  const totalStatuses = displayStatuses.reduce((sum, item) => sum + item.count, 0);
  const totalIslandBudget = islandData.reduce((sum, item) => sum + item.budget, 0);

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

          {monthlyData.length === 0 ? (
            <div className={`h-64 grid place-items-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No historical budget records available in database.
            </div>
          ) : (
            <div className={`mt-6 h-64 flex items-end gap-3 sm:gap-6 border-b px-3 pb-1 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              {monthlyData.map((item) => {
                const isSelected = Number(item.month) === selectedYear;
                const bVal = item.budget || 0;
                const aVal = item.actual || 0;
                const budgetHeight = Math.max(bVal > 0 ? 3 : 0, (bVal / maxTrend) * 100);
                const actualHeight = Math.max(aVal > 0 ? 3 : 0, (aVal / maxTrend) * 100);

                return (
                  <div
                    key={item.month}
                    className="relative flex-1 h-full flex flex-col justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredTrend(item)}
                    onMouseLeave={() => setHoveredTrend(null)}
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
                    <div className="flex items-end justify-center gap-1.5 h-[200px]">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${budgetHeight}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                        className={`w-4 sm:w-6 rounded-t-md transition-all ${
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
                        className={`w-4 sm:w-6 rounded-t-md transition-all ${
                          isSelected
                            ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-md shadow-amber-400/30'
                            : isLight
                            ? 'bg-amber-500/80 group-hover:bg-amber-500'
                            : 'bg-amber-500/50 group-hover:bg-amber-400'
                        }`}
                      />
                    </div>

                    <div
                      className={`text-center text-xs py-2 transition-colors ${
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'}`}>
          <span>Active Scope: <strong className={isLight ? 'text-blue-700' : 'text-amber-400'}>FY {selectedYear}</strong></span>
          <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Amounts shown in standard valuation</span>
        </div>
      </section>

      {/* 2. Project Stages Breakdown (Col 4) */}
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
                <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Project Stages</h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>FY {selectedYear} Legislative Stage Breakdown</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isLight ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-slate-800 text-amber-400 border-slate-700'
              }`}
            >
              {totalStatuses.toLocaleString()} Projects
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {displayStatuses.length === 0 ? (
              <div className={`py-12 text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                No staged projects recorded for FY {selectedYear}.
              </div>
            ) : (
              displayStatuses.map((item) => {
                const pct = totalStatuses ? Math.round((item.count / totalStatuses) * 100) : 0;
                const isSelected = activeStatusFilter === item.name;
                const theme = STAGE_NAME_COLORS[item.name] || {
                  bg: 'bg-blue-500',
                  text: 'text-blue-600',
                  hex: '#3b82f6',
                };

                return (
                  <button
                    key={item.name}
                    onClick={() => onStatusSelect?.(isSelected ? null : item.name)}
                    className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                      isLight
                        ? isSelected
                          ? 'bg-blue-50 border-blue-500/60 ring-1 ring-blue-500/30 shadow-sm'
                          : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200'
                        : isSelected
                        ? 'bg-slate-800 border-amber-500/60 ring-2 ring-amber-500/30 shadow-md'
                        : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${theme.bg}`} />
                        <span className={`font-bold tracking-wide truncate ${isSelected ? (isLight ? 'text-blue-700' : 'text-amber-300') : (isLight ? 'text-slate-800' : 'text-slate-100')}`}>
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.count.toLocaleString()}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            isLight
                              ? 'bg-white text-slate-700 border-slate-200'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    <div className={`mt-2 w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-900'}`}>
                      <motion.div
                        className={`h-full rounded-full ${theme.bg}`}
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

        {activeStatusFilter && (
          <div className={`mt-3 pt-2 border-t flex items-center justify-between text-xs ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
            <span className={`font-medium truncate ${isLight ? 'text-blue-700' : 'text-amber-300'}`}>Filtering: {activeStatusFilter}</span>
            <button
              onClick={() => onStatusSelect?.(null)}
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

          <div className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Total Outlay: <strong className={isLight ? 'text-blue-700' : 'text-amber-400'}>{formatCompactMoney(totalIslandBudget)}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {islandData.length === 0 ? (
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
                      {item.name} Group
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
