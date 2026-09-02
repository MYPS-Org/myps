import React, { useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  EyeIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import type { WatchlistProject } from './ProjectQuickDetailModal';
export type { WatchlistProject } from './ProjectQuickDetailModal';
import { formatCompactMoney } from './AnimatedCounter';
import { useDashboardTheme } from '../DashboardTheme';

interface Props {
  projects: WatchlistProject[];
  activeStatusFilter?: string | null;
  activeIslandFilter?: string | null;
  onClearFilters?: () => void;
  onSelectProject: (project: WatchlistProject) => void;
  onViewAll: () => void;
}

export const DashboardProjectWatchlist: React.FC<Props> = ({
  projects,
  activeStatusFilter,
  activeIslandFilter,
  onClearFilters,
  onSelectProject,
  onViewAll,
}) => {
  const { isLight } = useDashboardTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (activeStatusFilter && project.stageName !== activeStatusFilter) return false;
      if (activeIslandFilter && project.island !== activeIslandFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = project.projectId?.toLowerCase().includes(q);
        const descMatch = project.description?.toLowerCase().includes(q);
        const regMatch = project.region?.toLowerCase().includes(q);
        if (!idMatch && !descMatch && !regMatch) return false;
      }
      return true;
    });
  }, [activeStatusFilter, activeIslandFilter, searchQuery, projects]);

  const totalFilteredBudget = useMemo(() => {
    return filtered.reduce((sum, p) => sum + p.allocatedBudget, 0);
  }, [filtered]);

  const getSubtitle = () => {
    if (activeIslandFilter) {
      return `Filtered: ${activeIslandFilter} Group (${filtered.length} Regions · Total: ${formatCompactMoney(totalFilteredBudget)})`;
    }
    if (activeStatusFilter) {
      return `Filtered: Stage ${activeStatusFilter} (${filtered.length} Regions · Total: ${formatCompactMoney(totalFilteredBudget)})`;
    }
    return `Strategic Regional Capital Investment Portfolio (${filtered.length} Regions · Grand Total: ${formatCompactMoney(totalFilteredBudget)})`;
  };

  return (
    <section
      className={`h-full rounded-2xl border shadow-md overflow-hidden flex flex-col justify-between transition-all duration-200 ${
        isLight
          ? 'bg-white border-slate-200/90 text-slate-800'
          : 'bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 text-slate-100 border-slate-800 shadow-xl'
      }`}
    >
      <div>
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-6 py-4 ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`p-1.5 rounded-lg border ${
                  isLight ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}
              >
                <FolderOpenIcon className="h-4 w-4" />
              </span>
              <h3 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                FY Regional Infrastructure Portfolio
              </h3>
            </div>
            <p className={`mt-0.5 text-xs font-semibold ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
              {getSubtitle()}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search region..."
                className={`pl-7 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 transition-all w-32 sm:w-40 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-500/30 focus:border-blue-500'
                    : 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500 focus:ring-amber-500/30 focus:border-amber-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={onViewAll}
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap ${
                isLight
                  ? 'text-blue-700 hover:text-blue-800 hover:bg-blue-50'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
              }`}
            >
              Full Repository <ArrowRightIcon className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {(activeStatusFilter || activeIslandFilter || searchQuery) && (
          <div className={`flex items-center gap-2 px-6 py-2.5 border-b text-xs flex-wrap ${isLight ? 'bg-slate-50/80 border-slate-100' : 'bg-slate-950/80 border-slate-800'}`}>
            <span className={`font-medium text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Active Filter:</span>
            {activeIslandFilter && (
              <span className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
                {activeIslandFilter} Island Group ({filtered.length} Regions · {formatCompactMoney(totalFilteredBudget)})
              </span>
            )}
            {activeStatusFilter && (
              <span className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                Stage: {activeStatusFilter}
              </span>
            )}
            {searchQuery && (
              <span className={`px-2 py-0.5 rounded-full border font-semibold text-[10px] ${isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                "{searchQuery}"
              </span>
            )}
            {onClearFilters && (
              <button
                onClick={onClearFilters}
                className={`ml-auto text-[11px] font-bold underline ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                Reset Filter (Show All 17 Regions)
              </button>
            )}
          </div>
        )}

        {/* Responsive Table with generous margins */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead className={`uppercase tracking-wider font-bold text-[10px] border-b ${isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-950/90 text-slate-400 border-slate-800'}`}>
              <tr>
                <th className="pl-6 pr-4 py-3 whitespace-nowrap">Regional Investment Program</th>
                <th className="px-3 py-3 hidden sm:table-cell whitespace-nowrap">Stage</th>
                <th className="px-3 py-3 hidden md:table-cell whitespace-nowrap">Island Group</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">FY Regional Outlay</th>
                <th className="pl-2 pr-6 py-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-slate-100 bg-white' : 'divide-slate-800/80 bg-slate-900/40'}`}>
              {filtered.map((project, idx) => (
                <tr key={project.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60'}`}>
                  <td className="pl-6 pr-4 py-3.5 max-w-[260px] sm:max-w-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${isLight ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-slate-900 text-amber-400 border-slate-700'}`}>
                        #{idx + 1}
                      </span>
                      <span className={`font-bold font-mono tracking-tight text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {project.region}
                      </span>
                      {project.isPublished && (
                        <span className={`px-1.5 py-0.2 text-[9px] font-black rounded border ${isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                          PUB
                        </span>
                      )}
                      {project.isRevised && (
                        <span className={`px-1.5 py-0.2 text-[9px] font-black rounded border ${isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                          REV
                        </span>
                      )}
                    </div>
                    <div className={`mt-0.5 truncate font-normal text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`} title={project.description}>
                      {project.description}
                    </div>
                  </td>

                  <td className="px-3 py-3.5 hidden sm:table-cell whitespace-nowrap">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${isLight ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {project.stageName}
                    </span>
                  </td>

                  <td className="px-3 py-3.5 hidden md:table-cell whitespace-nowrap">
                    <div className={`font-semibold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>{project.island} Group</div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{project.category}</div>
                  </td>

                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className={`font-black text-xs sm:text-sm ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
                      {formatCompactMoney(project.allocatedBudget)}
                    </div>
                  </td>

                  <td className="pl-2 pr-6 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectProject(project)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-colors shadow-xs ${
                        isLight
                          ? 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-200'
                          : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'
                      }`}
                      aria-label={`Quick view ${project.region}`}
                    >
                      <EyeIcon className={`h-3.5 w-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className={`px-6 py-12 text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No regional programs match the selected search and filter criteria.
            </div>
          )}
        </div>
      </div>

      <div className={`px-6 py-3.5 border-t text-[11px] flex items-center justify-between font-medium ${isLight ? 'border-slate-100 bg-slate-50/50 text-slate-600' : 'border-slate-800 bg-slate-950/50 text-slate-400'}`}>
        <span className="flex items-center gap-1.5">
          <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
          Showing <strong>{filtered.length}</strong> regions accounted
        </span>
        <span className="text-xs font-black">
          Total Sum: <span className={isLight ? 'text-blue-700' : 'text-amber-400'}>{formatCompactMoney(totalFilteredBudget)}</span>
        </span>
      </div>
    </section>
  );
};

export default DashboardProjectWatchlist;
