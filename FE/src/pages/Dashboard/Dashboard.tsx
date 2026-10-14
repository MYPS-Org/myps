import React, { useState, useEffect, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom, useAtomValue } from 'jotai';
import {
  ArrowPathIcon,
  SparklesIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';

import { DashboardThemeProvider, useDashboardTheme } from './DashboardTheme';
import { useInViewport } from '../../hooks/useInViewport';
import LazySection from './components/LazySection';

import DashboardKpiCards from './components/DashboardKpiCards';
const DashboardCharts = lazy(() => import('./components/DashboardCharts'));
const DashboardMacroBudget = lazy(() => import('./components/DashboardMacroBudget'));
import DashboardTrajectoryChart from './components/DashboardTrajectoryChart';
const DashboardRegionalMatrix = lazy(() => import('./components/DashboardRegionalMatrix'));
import DashboardProjectWatchlist, { type WatchlistProject } from './components/DashboardProjectWatchlist';
import DashboardCategoryFilter, { type DashboardCategory } from './components/DashboardCategoryFilter';
import DashboardKpiDetailModal, { type DashboardKpiType } from './components/DashboardKpiDetailModal';
import ProjectQuickDetailModal from './components/ProjectQuickDetailModal';

import { useDashboardKpis } from './hooks/useDashboardKpis';
import { useDashboardTrend } from './hooks/useDashboardTrend';
import { useDashboardBudgetBreakdown } from './hooks/useDashboardBudgetBreakdown';
import { useDashboardStatuses } from './hooks/useDashboardStatuses';
import { useDashboardRegionalBreakdown } from './hooks/useDashboardRegionalBreakdown';
import { useDashboardRevisions } from './hooks/useDashboardRevisions';
import { useDashboardLsProjects } from './hooks/useDashboardLsProjects';
import { usePinnedHeader } from './hooks/usePinnedHeader';
import {
  kpisCacheAtom,
  trendCacheAtom,
  budgetBreakdownCacheAtom,
  statusesCacheAtom,
  regionalBreakdownCacheAtom,
  revisionsCacheAtom,
  emptySectionCache,
  liveAvailableYearsAtom,
} from './atoms/dashboardSectionCache.atom';

// Live DB offers whichever fiscal years actually have cost data; /Dashboard/Kpis returns that
// list as AvailableYears, so the switcher follows the database instead of a hardcoded year.
// (It used to be pinned to [2027] to match a TemporaryDashboardYear stopgap in
// DashboardController.cs, which is why only FY2027 was ever selectable.) Demo Data stays on the
// static presentation year range. LIVE_YEARS_FALLBACK is only what the switcher shows in the
// moment before the first KPI response lands.
const LIVE_YEARS_FALLBACK = [2027];
const BENCHMARK_AVAILABLE_YEARS = [2027, 2026, 2025, 2024, 2023];

/*  LIVE DB SWITCH.
    -----------------------------------------------------------------------------
    Turned off on 2026-09-13 (maintainer's call) because Dashboard/Summary returned
    every visible project uncapped — 56,722 rows, 33.5 MB and ~14 s per load on
    myps_db_dev_200 — and the stated condition for turning it back on was a paged
    or capped endpoint.

    Re-enabled 2026-09-17 because that condition is now met: the page no longer
    calls Dashboard/Summary at all. Each section loads from its own endpoint
    (Kpis, Trend, BudgetBreakdown, Statuses, RegionalBreakdown, Projects,
    Activities, Revisions), only when scrolled into view; aggregates are computed
    in SQL and return tens of rows; and the watchlist pages server-side. The
    largest response is the 20-row watchlist page at ~12 KB. See the follow-up
    section of documents/plans/dashboard-modular-data-loading.md for timings.

    The switch is kept rather than removed. Setting it to false still disables the
    Live DB control and — via `sourceMode` below — routes every section hook to
    Demo Data, so no dashboard query can go out. The e2e spec tracks this same
    constant; flip both together. */
export const LIVE_DB_ENABLED = true;

const DashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { setTheme, isLight } = useDashboardTheme();

  const [dataSourceMode, setDataSourceMode] = useState<'real' | 'benchmark'>('benchmark');
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedCategory, setSelectedCategory] = useState<DashboardCategory | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<DashboardKpiType | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [activeIslandFilter, setActiveIslandFilter] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<WatchlistProject | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // What the data hooks actually query. The disabled Live DB button is the normal way to stay
  // out of 'real' while LIVE_DB_ENABLED is false; this is what guarantees it -- a stale state
  // value, a future caller, or a restored session still cannot send a dashboard query.
  const sourceMode: 'real' | 'benchmark' = LIVE_DB_ENABLED ? dataSourceMode : 'benchmark';
  // The category narrows Live DB data only: Demo Data figures have no real categories behind them.
  const categoryId = sourceMode === 'real' ? selectedCategory?.id ?? null : null;
  useEffect(() => {
    if (!LIVE_DB_ENABLED && dataSourceMode === 'real') {
      setDataSourceMode('benchmark');
      setSelectedYear(2027);
    }
  }, [dataSourceMode]);

  // Tier 1 -- eager on mount. Always-visible KPI row; three independent requests (the revision
  // and Lump Sum tiles each resolve on their own without blocking the rest of the cards). Lump
  // Sum is eager rather than viewport-gated like Tier 2 below because the KPI tile needs its
  // total immediately and the dataset is tiny (a handful of Lump Sum Projects).
  const kpis = useDashboardKpis(selectedYear, categoryId, sourceMode, true);
  const revisions = useDashboardRevisions(selectedYear, categoryId, sourceMode, true);
  const lsProjectsSection = useDashboardLsProjects(selectedYear, categoryId, sourceMode, true);

  const liveAvailableYears = useAtomValue(liveAvailableYearsAtom);
  const availableYears = sourceMode === 'benchmark'
    ? BENCHMARK_AVAILABLE_YEARS
    : (liveAvailableYears.length ? liveAvailableYears : LIVE_YEARS_FALLBACK);

  // Switching data source can leave a year selected that the other source doesn't offer (the
  // Demo Data range and the live range are independent). Snap to the newest year it does offer
  // rather than firing requests for a year that isn't there. Guarded on `hasLoadedLiveYears` so
  // this never fires against the placeholder list while the first KPI request is still in
  // flight -- doing so would snap the user's brand-new selection straight back.
  const hasLoadedLiveYears = liveAvailableYears.length > 0;
  useEffect(() => {
    if (sourceMode === 'real' && !hasLoadedLiveYears) return;
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [sourceMode, hasLoadedLiveYears, availableYears, selectedYear]);

  // Tier 2 -- lazy on visible. One viewport observer per section: a section's data hook fetches
  // the first time that section is scrolled into view, and not before. (These were also shared
  // across the old perspective tabs, so a section appearing in more than one tab only fetched
  // once; the tabs are gone, but a callback ref still makes the observer survive remounts --
  // see useInViewport.)
  // The header (data source, category, year) stays on screen while scrolling; see usePinnedHeader.
  const pinnedHeader = usePinnedHeader();
  const isHeaderPinned = pinnedHeader.isPinned;

  const macroBudgetViewport = useInViewport<HTMLDivElement>();
  const trajectoryViewport = useInViewport<HTMLDivElement>();
  const regionalMatrixViewport = useInViewport<HTMLDivElement>();
  const chartsViewport = useInViewport<HTMLDivElement>();
  const watchlistViewport = useInViewport<HTMLDivElement>();

  // Trend feeds both the Trajectory chart and the Charts panel's trend bars -- one shared fetch,
  // enabled by whichever of the two sections is reached first.
  const trend = useDashboardTrend(selectedYear, categoryId, sourceMode, trajectoryViewport.isVisible || chartsViewport.isVisible);
  const budgetBreakdown = useDashboardBudgetBreakdown(selectedYear, categoryId, sourceMode, macroBudgetViewport.isVisible);
  const statuses = useDashboardStatuses(selectedYear, categoryId, sourceMode, chartsViewport.isVisible);
  const regionalBreakdown = useDashboardRegionalBreakdown(selectedYear, categoryId, sourceMode, regionalMatrixViewport.isVisible);

  const monthlyData = (trend.data ?? []).map((row) => ({
    month: String(row.year),
    budget: row.infrastructureBudget,
    actual: row.lsItemized,
  }));
  const trajectoryLiveData = (trend.data ?? []).map((row) => ({
    year: row.year,
    projects: row.projectCount,
    budget: row.infrastructureBudget,
  }));

  const setKpisCache = useSetAtom(kpisCacheAtom);
  const setTrendCache = useSetAtom(trendCacheAtom);
  const setBudgetBreakdownCache = useSetAtom(budgetBreakdownCacheAtom);
  const setStatusesCache = useSetAtom(statusesCacheAtom);
  const setRegionalBreakdownCache = useSetAtom(regionalBreakdownCacheAtom);
  const setRevisionsCache = useSetAtom(revisionsCacheAtom);

  // Clears every section's cache atom -- a currently-visible section's hook will see its cache
  // key no longer matches and refetch immediately; an off-screen section just stays empty until
  // it's scrolled to. The watchlist owns its own (non-atom) pagination state, so it's nudged via
  // refreshSignal instead.
  const handleRefresh = () => {
    setKpisCache(emptySectionCache());
    setTrendCache(emptySectionCache());
    setBudgetBreakdownCache(emptySectionCache());
    setStatusesCache(emptySectionCache());
    setRegionalBreakdownCache(emptySectionCache());
    setRevisionsCache(emptySectionCache());
    setRefreshSignal((value) => value + 1);
  };

  const clearCrossFilters = () => {
    setActiveIslandFilter(null);
    setActiveStatusFilter(null);
  };

  const skeletonBlock = (heightClass: string) => (
    <div
      className={`rounded-2xl border animate-pulse ${heightClass} ${
        isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900/60 border-slate-800'
      }`}
    />
  );

  // Full width since the Live Audit Feed beside it was removed: QA could not tell what it was for,
  // and it only repeated the twelve most recently edited projects.
  const watchlist = (
    <div id="watchlist-section">
      <DashboardProjectWatchlist
        year={selectedYear}
        categoryId={categoryId}
        dataSourceMode={sourceMode}
        enabled={watchlistViewport.isVisible}
        refreshSignal={refreshSignal}
        activeIslandFilter={activeIslandFilter}
        activeStatusFilter={activeStatusFilter}
        onClearFilters={clearCrossFilters}
        onSelectProject={setSelectedProject}
        onViewAll={() => navigate('/projects')}
      />
    </div>
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-300 pb-16 space-y-6 ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* 1. Header Bar with Theme & Live DB vs Benchmark Switcher.
          Pinned below the app's top bar once the page scrolls to it (usePinnedHeader), in a
          compact one-row form that keeps only the filters, so every section below stays visibly
          under the selected data source, category and fiscal year. */}
      <div>
        <div ref={pinnedHeader.markerRef} aria-hidden="true" />
        {isHeaderPinned && <div aria-hidden="true" style={{ height: pinnedHeader.spacerHeight }} />}
        <div
          ref={pinnedHeader.headerRef}
          data-pinned={isHeaderPinned ? 'true' : undefined}
          className={isHeaderPinned ? `fixed z-30 backdrop-blur-sm ${isLight ? 'bg-slate-100/90' : 'bg-slate-950/90'}` : undefined}
          style={isHeaderPinned ? pinnedHeader.pinnedStyle : undefined}
        >
          <div
            // No overflow-hidden: the category list drops below this card and was clipped.
            className={`rounded-2xl shadow-xl border relative transition-all duration-300 ${
              isHeaderPinned ? 'px-4 py-2.5' : 'p-6 sm:p-7'
            } ${
              isLight
                ? 'bg-gradient-to-r from-slate-900 via-[#0a2042] to-slate-900 text-white border-slate-800'
                : 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white border-slate-800'
            }`}
          >
            <div
              className={`relative flex justify-between ${
                isHeaderPinned ? 'flex-row flex-wrap items-center gap-3' : 'flex-col lg:flex-row lg:items-center gap-6'
              }`}
            >
              {isHeaderPinned ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-black tracking-wider uppercase text-amber-400 whitespace-nowrap">
                    Viewing FY {selectedYear}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                    dataSourceMode === 'real'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                      : 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                  }`}>
                    {dataSourceMode === 'real' ? 'Database data' : 'Demo data'}
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20">
                      DPWH Executive Command Center
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/10">
                      MYPS Infrastructure Analytics
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      dataSourceMode === 'real'
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                        : 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                    }`}>
                      {dataSourceMode === 'real' ? 'Database data' : 'Demo data'}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                    <span>National Expenditure Program & Portfolio Matrix</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                    Comprehensive executive monitoring of multi-year capital outlays, stage lifecycles, and regional infrastructure delivery.
                  </p>
                </div>
              )}

              <div className={`flex flex-wrap items-center ${isHeaderPinned ? 'gap-2' : 'gap-3'}`}>
                {/* Real DB vs Benchmark Switch Toggle */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80 shadow-inner">
                  <button
                    disabled={!LIVE_DB_ENABLED}
                    onClick={() => {
                      if (!LIVE_DB_ENABLED) return;
                      setDataSourceMode('real');
                      setSelectedYear(2027);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dataSourceMode === 'real'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                        : 'text-slate-400 hover:text-white'
                    } ${!LIVE_DB_ENABLED ? 'opacity-40 cursor-not-allowed hover:text-slate-400' : ''}`}
                    title={
                      LIVE_DB_ENABLED
                        ? 'Query projects from the configured live MYPS database'
                        : 'Live database view is temporarily unavailable while the summary endpoint is made pageable.'
                    }
                  >
                    <CircleStackIcon className="w-3.5 h-3.5" />
                    <span>Live DB</span>
                  </button>
                  <button
                    onClick={() => {
                      setDataSourceMode('benchmark');
                      setSelectedYear(2027);
                      setSelectedCategory(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dataSourceMode === 'benchmark'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="View sample figures for demonstration"
                  >
                    <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Demo Data</span>
                  </button>
                </div>

                {/* Light / Dark Mode Switcher: not a filter, so the pinned form leaves it out */}
                {!isHeaderPinned && (
                  <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80">
                    <button
                      onClick={() => setTheme('light')}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isLight
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Switch to Light Theme (Option A)"
                    >
                      <SunIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        !isLight
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Switch to Dark Theme"
                    >
                      <MoonIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Dark</span>
                    </button>
                  </div>
                )}

                {/* Category filter: narrows every section, beside the year it combines with */}
                <DashboardCategoryFilter
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  disabled={sourceMode !== 'real'}
                  disabledReason="Category filtering uses Live DB data. Switch to Live DB to filter by category."
                />

                {/* Fiscal Year Switcher */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80">
                  {availableYears.map((year) => {
                    const isSelected = selectedYear === year;
                    return (
                      <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={kpis.isLoading}
                  className={`${isHeaderPinned ? 'p-2' : 'p-2.5'} text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 disabled:opacity-50 transition-all flex items-center justify-center shadow-sm`}
                  title="Refresh dashboard"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${kpis.isLoading ? 'animate-spin' : ''}`} />
                </button>

                {!isHeaderPinned && (
                  <button
                    onClick={() => navigate('/projects')}
                    className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Project Repository</span>
                  </button>
                )}
              </div>
            </div>

            {!isHeaderPinned && dataSourceMode === 'benchmark' && (
              <div className="relative mt-4 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100">
                Demo data is for demonstration only and does not come from the live database.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key High-Impact Animated KPI Cards */}
      <DashboardKpiCards
        data={kpis.data?.kpis ?? {
          totalBudget: 0,
          activeProjects: 0,
          publishedProjects: 0,
          publishableProjects: 0,
          revisedProjects: 0,
          lsWalletReleased: 0,
          lsWalletTotal: 0,
          publicationRate: 0,
        }}
        revisions={revisions.data ?? undefined}
        isLoading={kpis.isLoading || revisions.isLoading}
        onCardClick={(type) => setSelectedKpi(type as DashboardKpiType)}
      />

      {/* 3. Main Analytics Workspaces
          One view, not three. This used to be a 'perspective' tab bar (Executive Overview /
          FY Budget Allocation / Live Database Portfolio), but the other two tabs rendered
          strict subsets of this one from the same hooks and the same dataSourceMode: the FY
          Budget tab was this list minus the trajectory chart and minus the activity feed, and
          the Live Portfolio tab was just the watchlist block below. Nothing was reachable only
          through them. Choosing what data to look at is the Live DB / Demo Data toggle's job,
          and choosing which fiscal year is the year switcher's -- the tabs duplicated neither
          and only split the same page into three partial copies. */}
      <div className="space-y-6">
          {/* Macro Budget Summary */}
          <LazySection isVisible={macroBudgetViewport.isVisible} sectionRef={macroBudgetViewport.ref} skeleton={skeletonBlock('h-96')}>
            <DashboardMacroBudget
              selectedYear={selectedYear}
              isBenchmark={sourceMode === 'benchmark'}
              liveBreakdown={budgetBreakdown.data ?? []}
              isLoading={budgetBreakdown.isLoading}
            />
          </LazySection>

          {/* 5-Year Trajectory */}
          <LazySection isVisible={trajectoryViewport.isVisible} sectionRef={trajectoryViewport.ref} skeleton={skeletonBlock('h-80')}>
            <DashboardTrajectoryChart
              selectedYear={selectedYear}
              onSelectYear={(yr) => setSelectedYear(yr)}
              isBenchmark={sourceMode === 'benchmark'}
              liveData={trajectoryLiveData}
              isLoading={trend.isLoading}
            />
          </LazySection>

          {/* Regional Capital Outlays Infographic Matrix */}
          <LazySection isVisible={regionalMatrixViewport.isVisible} sectionRef={regionalMatrixViewport.ref} skeleton={skeletonBlock('h-[500px]')}>
            <DashboardRegionalMatrix
              selectedYear={selectedYear}
              regions={regionalBreakdown.data ?? []}
              isLoading={regionalBreakdown.isLoading}
              onSelectIsland={(isl) => setActiveIslandFilter(isl)}
              activeIslandFilter={activeIslandFilter}
            />
          </LazySection>

          {/* Annual Trend & Project Stages */}
          <LazySection isVisible={chartsViewport.isVisible} sectionRef={chartsViewport.ref} skeleton={skeletonBlock('h-96')}>
            <DashboardCharts
              selectedYear={selectedYear}
              monthlyData={monthlyData}
              statusData={statuses.data?.statuses ?? []}
              islandData={statuses.data?.islands ?? []}
              isTrendLoading={trend.isLoading}
              isStatusesLoading={statuses.isLoading}
              onSelectYear={setSelectedYear}
              onStatusSelect={setActiveStatusFilter}
              activeStatusFilter={activeStatusFilter}
              onSelectIsland={setActiveIslandFilter}
              activeIslandFilter={activeIslandFilter}
            />
          </LazySection>

          {/* Project Watchlist & Activity Stream */}
          <LazySection isVisible={watchlistViewport.isVisible} sectionRef={watchlistViewport.ref} skeleton={skeletonBlock('h-96')}>
            {watchlist}
          </LazySection>
      </div>

      {/* Modals */}
      <ProjectQuickDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />

      <DashboardKpiDetailModal
        type={selectedKpi}
        selectedYear={selectedYear}
        categoryId={categoryId}
        dataSourceMode={sourceMode}
        kpiData={kpis.data?.kpis ?? undefined}
        lsProjects={lsProjectsSection.data ?? []}
        revisions={revisions.data ?? undefined}
        onClose={() => setSelectedKpi(null)}
        onOpenProject={() => {
          setSelectedKpi(null);
          navigate('/projects');
        }}
        onOpenLsProject={(project) => navigate(`/lumpsum/${project.id}`)}
      />
    </div>
  );
};

export const Dashboard: React.FC = () => {
  return (
    <DashboardThemeProvider>
      <DashboardContent />
    </DashboardThemeProvider>
  );
};

export default Dashboard;
