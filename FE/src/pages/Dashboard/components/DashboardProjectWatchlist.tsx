import React, { useEffect, useState, useCallback } from 'react';
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
import { usePagination } from '../../../hooks/usePagination';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { fetchDashboardProjects, type DashboardFilters, type DashboardProjectsFilter } from '../Service';

interface Props {
  year: number;
  /** Header filters (category, program type, stage); memoised by the parent. */
  filters: DashboardFilters;
  dataSourceMode: 'real' | 'benchmark';
  /** Gates the first fetch — pass viewport visibility so this section only loads once reached. */
  enabled: boolean;
  /** Bump this (e.g. on the header Refresh click) to force a refetch of the current page/filters —
   *  this component's pagination state isn't atom-backed like the other sections', so the parent
   *  can't just clear a cache atom to trigger it. */
  refreshSignal?: number;
  activeIslandFilter?: string | null;
  onClearFilters?: () => void;
  onSelectProject: (project: WatchlistProject) => void;
  onViewAll: () => void;
}

// Debounce delay for the search box — avoids firing a server request per keystroke.
const SEARCH_DEBOUNCE_MS = 300;

export const DashboardProjectWatchlist: React.FC<Props> = ({
  year,
  filters,
  dataSourceMode,
  enabled,
  refreshSignal = 0,
  activeIslandFilter,
  onClearFilters,
  onSelectProject,
  onViewAll,
}) => {
  const { isLight } = useDashboardTheme();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchFn = useCallback(
    (params: Parameters<typeof fetchDashboardProjects>[0]) =>
      fetchDashboardProjects(params, year, dataSourceMode === 'benchmark', filters),
    [year, dataSourceMode, filters]
  );

  // enabled: false — this component drives every fetch itself (below), keyed off viewport
  // visibility plus search/filter/year/mode changes, rather than usePagination's own one-shot
  // mount fetch (which can't react to those changes on its own).
  const pagination = usePagination<DashboardProjectsFilter, WatchlistProject>(fetchFn, {
    limit: 10,
    enabled: false,
  });

  useEffect(() => {
    if (!enabled) return;
    pagination.applyFilters({
      Search: debouncedSearch || undefined,
      Island: activeIslandFilter ?? undefined,
    });
    // pagination.applyFilters is stable unless year/dataSourceMode/filters change (it's rebuilt
    // from fetchFn, which depends on those) — safe to omit here, matching usePagination.ts's own
    // mount-effect convention.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, year, filters, dataSourceMode, refreshSignal, debouncedSearch, activeIslandFilter]);

  const projects = pagination.data.lists;
  // The server's total is a count of projects, one row each (QA read it as regions: "8460 Regions?").
  const totalProjects = pagination.data.total ?? 0;
  const projectCountLabel = `${totalProjects.toLocaleString()} ${totalProjects === 1 ? 'project' : 'projects'}`;
  const pageBudget = projects.reduce((sum, project) => sum + project.allocatedBudget, 0);
  const isInitialLoad = pagination.isLoading && projects.length === 0;

  const getSubtitle = () => {
    if (activeIslandFilter) {
      return `Filtered: ${activeIslandFilter} Group (${projectCountLabel})`;
    }
    return `Strategic Regional Capital Investment Portfolio (${projectCountLabel})`;
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search project or region..."
                className={`pl-7 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 transition-all w-32 sm:w-40 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-500/30 focus:border-blue-500'
                    : 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500 focus:ring-amber-500/30 focus:border-amber-500'
                }`}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
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
        {(activeIslandFilter || searchInput) && (
          <div className={`flex items-center gap-2 px-6 py-2.5 border-b text-xs flex-wrap ${isLight ? 'bg-slate-50/80 border-slate-100' : 'bg-slate-950/80 border-slate-800'}`}>
            <span className={`font-medium text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Active Filter:</span>
            {activeIslandFilter && (
              <span className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
                {activeIslandFilter} Island Group ({projectCountLabel})
              </span>
            )}
            {searchInput && (
              <span className={`px-2 py-0.5 rounded-full border font-semibold text-[10px] ${isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                "{searchInput}"
              </span>
            )}
            {onClearFilters && (
              <button
                onClick={() => {
                  setSearchInput('');
                  onClearFilters();
                }}
                className={`ml-auto text-[11px] font-bold underline ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                Reset Filter
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
              {isInitialLoad ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td className="pl-6 pr-4 py-3.5" colSpan={5}>
                      <div className={`h-6 rounded animate-pulse ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} />
                    </td>
                  </tr>
                ))
              ) : (
                projects.map((project, idx) => (
                <tr key={project.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60'}`}>
                  <td className="pl-6 pr-4 py-3.5 max-w-[260px] sm:max-w-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${isLight ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-slate-900 text-amber-400 border-slate-700'}`}>
                        #{(pagination.data.page - 1) * pagination.data.limit + idx + 1}
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
                ))
              )}
            </tbody>
          </table>

          {!isInitialLoad && projects.length === 0 && (
            <div className={`px-6 py-12 text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              No projects match the selected search and filter criteria.
            </div>
          )}

          <div className="px-4">
            <PaginationBar
              currentPage={pagination.data.page}
              totalPages={pagination.data.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              onGoToPage={pagination.goToPage}
              onNext={pagination.goNext}
              onPrevious={pagination.goPrevious}
              onFirst={pagination.goFirst}
              onLast={pagination.goLast}
              isLoading={pagination.isLoading}
            />
          </div>
        </div>
      </div>

      <div className={`px-6 py-3.5 border-t text-[11px] flex items-center justify-between font-medium ${isLight ? 'border-slate-100 bg-slate-50/50 text-slate-600' : 'border-slate-800 bg-slate-950/50 text-slate-400'}`}>
        <span className="flex items-center gap-1.5">
          <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
          Showing <strong>{projects.length}</strong> of <strong>{totalProjects.toLocaleString()}</strong> {totalProjects === 1 ? 'project' : 'projects'}
        </span>
        <span className="text-xs font-black">
          Page Total: <span className={isLight ? 'text-blue-700' : 'text-amber-400'}>{formatCompactMoney(pageBudget)}</span>
        </span>
      </div>
    </section>
  );
};

export default DashboardProjectWatchlist;
