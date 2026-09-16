import React from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { AnimatedNumber } from './AnimatedCounter';
import { useDashboardTheme } from '../DashboardTheme';

export interface TrajectoryYear {
  year: number;
  projects: number;
  budgetBillion: number;
  label: string;
  isProposed?: boolean;
  yoyDelta?: number;
}

const BENCHMARK_TRAJECTORY_DATA: TrajectoryYear[] = [
  { year: 2023, projects: 22836, budgetBillion: 798.1, label: 'Enacted GAA', yoyDelta: 0 },
  { year: 2024, projects: 25545, budgetBillion: 884.2, label: 'Peak Portfolio', yoyDelta: 11.9 },
  { year: 2025, projects: 25301, budgetBillion: 821.5, label: 'Consolidation', yoyDelta: -1.0 },
  { year: 2026, projects: 17861, budgetBillion: 712.4, label: 'Prioritized Focus', yoyDelta: -29.4 },
  { year: 2027, projects: 11395, budgetBillion: 643.95, label: 'NEP Proposed', isProposed: true, yoyDelta: -36.2 },
];

interface Props {
  selectedYear?: number;
  onSelectYear?: (year: number) => void;
  isBenchmark?: boolean;
  liveData?: Array<{ year: number; projects: number; budget: number }>;
  /** Only meaningful in Live DB mode — Demo Data renders from BENCHMARK_TRAJECTORY_DATA instantly. */
  isLoading?: boolean;
}

export const DashboardTrajectoryChart: React.FC<Props> = ({
  selectedYear,
  onSelectYear,
  isBenchmark = false,
  liveData = [],
  isLoading = false,
}) => {
  const { isLight } = useDashboardTheme();
  const trajectoryData: TrajectoryYear[] = isBenchmark
    ? BENCHMARK_TRAJECTORY_DATA
    : liveData.map((item, index) => {
        const previous = liveData[index - 1];
        return {
          year: item.year,
          projects: item.projects,
          budgetBillion: item.budget / 1e9,
          label: 'Live portfolio',
          yoyDelta: previous?.projects
            ? Math.round(((item.projects - previous.projects) / previous.projects) * 1000) / 10
            : 0,
        };
      });
  const maxProjects = Math.max(1, ...trajectoryData.map((item) => item.projects));
  const avgProjects = trajectoryData.length > 0
    ? Math.round(trajectoryData.reduce((sum, item) => sum + item.projects, 0) / trajectoryData.length)
    : 0;
  // Same reason as DashboardCharts' trend row: Live DB supplies one point per fiscal year with
  // data (16 today), not the five this sparkline's fixed gaps were sized for. Tighten spacing so
  // a long series stays inside the card instead of pushing its year labels out of it.
  const isDenseTrajectory = trajectoryData.length > 8;
  const trajectoryRowGap = isDenseTrajectory ? 'gap-1 sm:gap-2' : 'gap-3 sm:gap-6';
  const trajectoryLabelSize = isDenseTrajectory ? 'text-[9px]' : 'text-[11px]';

  const yearRange = trajectoryData.length > 0
    ? `${trajectoryData[0].year} to ${trajectoryData[trajectoryData.length - 1].year}`
    : 'No fiscal years';

  return (
    <div
      className={`rounded-2xl p-6 sm:p-7 shadow-md border relative overflow-hidden flex flex-col justify-between transition-all duration-200 ${
        isLight
          ? 'bg-white border-slate-200/90 text-slate-800'
          : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
      }`}
    >
      {/* Background glow */}
      {!isLight && (
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      )}

      <div>
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}
              >
                <ChartBarIcon className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                Infrastructure Volume Trajectory
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                {yearRange}
              </span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              No. of Infrastructure Projects
            </h2>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {isBenchmark
                ? 'Five-year presentation comparison of infrastructure project counts.'
                : 'Project counts calculated from persisted component-cost schedules across available fiscal years.'}
            </p>
          </div>
        </div>

        {/* Trajectory Cards Grid */}
        {isLoading && !isBenchmark ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={`h-24 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
            ))}
          </div>
        ) : trajectoryData.length === 0 ? (
          <div className={`mt-6 py-16 text-center text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            No project trajectory records are available in the database.
          </div>
        ) : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
          {trajectoryData.map((item) => {
            const isSelected = selectedYear === item.year;
            const isProposed = item.isProposed;

            return (
              <motion.button
                key={item.year}
                whileHover={{ y: -3 }}
                onClick={() => onSelectYear?.(item.year)}
                className={`relative text-left p-3.5 rounded-xl transition-all ${
                  isLight
                    ? isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-lg ring-2 ring-blue-400 border-blue-600'
                      : isProposed
                      ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                    : isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xl shadow-amber-500/25 border-2 border-amber-300 ring-2 ring-amber-400/40'
                    : isProposed
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-100 border border-slate-700/80'
                }`}
              >
                {isProposed && (
                  <div
                    className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1 mb-1 ${
                      isSelected
                        ? isLight ? 'text-blue-100' : 'text-slate-950'
                        : isLight ? 'text-amber-800' : 'text-amber-400'
                    }`}
                  >
                    <SparklesIcon className="w-2.5 h-2.5" />
                    Target FY
                  </div>
                )}

                <div
                  className={`text-xl sm:text-2xl font-black tracking-tight ${
                    isSelected
                      ? isLight ? 'text-white' : 'text-slate-950'
                      : isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  <AnimatedNumber value={item.projects} duration={1.2} />
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-current/15 text-xs">
                  <span
                    className={`font-bold ${
                      isSelected
                        ? isLight ? 'text-blue-100' : 'text-slate-900'
                        : isLight ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    FY {item.year}
                  </span>
                  {item.yoyDelta !== 0 && (
                    <span
                      className={`text-[10px] font-extrabold flex items-center gap-0.5 ${
                        isSelected
                          ? isLight ? 'text-blue-100' : 'text-slate-950'
                          : item.yoyDelta! > 0
                          ? isLight ? 'text-emerald-600' : 'text-emerald-400'
                          : isLight ? 'text-rose-600' : 'text-rose-400'
                      }`}
                    >
                      {item.yoyDelta! > 0 ? (
                        <ArrowTrendingUpIcon className="w-2.5 h-2.5 inline" />
                      ) : (
                        <ArrowTrendingDownIcon className="w-2.5 h-2.5 inline" />
                      )}
                      {Math.abs(item.yoyDelta!)}%
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>}
      </div>

      {/* Visual Comparison Chart Bar Area */}
      <div className={`mt-6 pt-5 border-t ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
        <div className={`flex items-center justify-between text-xs mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          <span>Relative Volume Density (Max: {maxProjects.toLocaleString()})</span>
          <span>Period Avg: <strong className={isLight ? 'text-slate-800' : 'text-white'}>{avgProjects.toLocaleString()}</strong> projects</span>
        </div>

        <div className={`h-28 flex items-end ${trajectoryRowGap} px-2 pt-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          {isLoading && !isBenchmark
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={`w-full max-w-[40px] rounded-t-lg animate-pulse ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}
                    style={{ height: `${30 + (index % 3) * 20}%` }}
                  />
                </div>
              ))
            : trajectoryData.map((item) => {
            const heightPercent = (item.projects / maxProjects) * 100;
            const isSelected = selectedYear === item.year;

            return (
              <div
                key={item.year}
                className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                onClick={() => onSelectYear?.(item.year)}
              >
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-950 text-white text-[10px] font-bold py-1 px-2 rounded border border-slate-700 shadow-xl pointer-events-none whitespace-nowrap z-20">
                  FY {item.year}: {item.projects.toLocaleString()}
                </div>

                {/* Animated bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPercent}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className={`w-full max-w-[40px] rounded-t-lg transition-all ${
                    isLight
                      ? isSelected
                        ? 'bg-gradient-to-t from-blue-700 to-blue-500 shadow-md shadow-blue-400/30'
                        : 'bg-gradient-to-t from-slate-400 to-slate-300 group-hover:from-blue-500 group-hover:to-blue-400'
                      : isSelected
                      ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-lg shadow-amber-500/30'
                      : 'bg-gradient-to-t from-blue-700 to-blue-500 group-hover:from-blue-600 group-hover:to-blue-400'
                  }`}
                />
                <span
                  className={`${trajectoryLabelSize} font-bold mt-1.5 ${
                    isSelected
                      ? isLight ? 'text-blue-700' : 'text-amber-400'
                      : isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {item.year}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardTrajectoryChart;
