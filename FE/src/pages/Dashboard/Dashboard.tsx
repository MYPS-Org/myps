import React, { useState, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowPathIcon,
  SparklesIcon,
  ChartPieIcon,
  AdjustmentsHorizontalIcon,
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
import DashboardActivityFeed from './components/DashboardActivityFeed';
import DashboardKpiDetailModal, { type DashboardKpiType, type DashboardLsProject } from './components/DashboardKpiDetailModal';
import ProjectQuickDetailModal from './components/ProjectQuickDetailModal';

import { useDashboardKpis } from './hooks/useDashboardKpis';
import { useDashboardTrend } from './hooks/useDashboardTrend';
import { useDashboardBudgetBreakdown } from './hooks/useDashboardBudgetBreakdown';
import { useDashboardStatuses } from './hooks/useDashboardStatuses';
import { useDashboardRegionalBreakdown } from './hooks/useDashboardRegionalBreakdown';
import { useDashboardActivities } from './hooks/useDashboardActivities';
import { useDashboardRevisions } from './hooks/useDashboardRevisions';
import {
  kpisCacheAtom,
  trendCacheAtom,
  budgetBreakdownCacheAtom,
  statusesCacheAtom,
  regionalBreakdownCacheAtom,
  activitiesCacheAtom,
  revisionsCacheAtom,
  emptySectionCache,
} from './atoms/dashboardSectionCache.atom';

// Live DB is currently pinned to FY2027 only, server-side (WebAPI/Controllers/Dashboard/
// DashboardController.cs's TemporaryDashboardYear stopgap) -- Demo Data still supports the full
// presentation year range. Both lists are static, so there's no fetch needed just to know them.
const LIVE_AVAILABLE_YEARS = [2027];
const BENCHMARK_AVAILABLE_YEARS = [2027, 2026, 2025, 2024, 2023];

type ViewPerspective = 'overview' | 'nep_briefing' | 'live_portfolio';

const DashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { setTheme, isLight } = useDashboardTheme();

  const [dataSourceMode, setDataSourceMode] = useState<'real' | 'benchmark'>('benchmark');
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedKpi, setSelectedKpi] = useState<DashboardKpiType | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [activeIslandFilter, setActiveIslandFilter] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<WatchlistProject | null>(null);
  const [viewPerspective, setViewPerspective] = useState<ViewPerspective>('overview');
  const [refreshSignal, setRefreshSignal] = useState(0);

  const availableYears = dataSourceMode === 'benchmark' ? BENCHMARK_AVAILABLE_YEARS : LIVE_AVAILABLE_YEARS;
  // LS Wallet integration is disabled server-side (see DashboardController.cs) -- always empty
  // until that ships, so there's no section hook for it.
  const lsProjects: DashboardLsProject[] = [];

  // Tier 1 -- eager on mount. Always-visible KPI row; two independent requests (the revision
  // tile resolves on its own without blocking the rest of the cards).
  const kpis = useDashboardKpis(selectedYear, dataSourceMode, true);
  const revisions = useDashboardRevisions(selectedYear, dataSourceMode, true);

  // Tier 2 -- lazy on visible. One viewport observer per section, shared across tabs: a section
  // that renders in more than one tab (e.g. MacroBudget in both Overview and NEP Briefing) only
  // needs to be "seen" once for its data hook to fetch -- see useInViewport for why sharing one
  // instance across tab remounts is safe (callback ref, not useRef).
  const macroBudgetViewport = useInViewport<HTMLDivElement>();
  const trajectoryViewport = useInViewport<HTMLDivElement>();
  const regionalMatrixViewport = useInViewport<HTMLDivElement>();
  const chartsViewport = useInViewport<HTMLDivElement>();
  const watchlistViewport = useInViewport<HTMLDivElement>();

  // Trend feeds both the Trajectory chart and the Charts panel's trend bars -- one shared fetch,
  // enabled by whichever of the two sections is reached first.
  const trend = useDashboardTrend(selectedYear, dataSourceMode, trajectoryViewport.isVisible || chartsViewport.isVisible);
  const budgetBreakdown = useDashboardBudgetBreakdown(selectedYear, dataSourceMode, macroBudgetViewport.isVisible);
  const statuses = useDashboardStatuses(selectedYear, dataSourceMode, chartsViewport.isVisible);
  const regionalBreakdown = useDashboardRegionalBreakdown(selectedYear, dataSourceMode, regionalMatrixViewport.isVisible);
  const activities = useDashboardActivities(selectedYear, dataSourceMode, watchlistViewport.isVisible);

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
  const setActivitiesCache = useSetAtom(activitiesCacheAtom);
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
    setActivitiesCache(emptySectionCache());
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

  const watchlistAndActivity = (
    <div id="watchlist-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      <div className="lg:col-span-2">
        <DashboardProjectWatchlist
          year={selectedYear}
          dataSourceMode={dataSourceMode}
          enabled={watchlistViewport.isVisible}
          refreshSignal={refreshSignal}
          activeIslandFilter={activeIslandFilter}
          activeStatusFilter={activeStatusFilter}
          onClearFilters={clearCrossFilters}
          onSelectProject={setSelectedProject}
          onViewAll={() => navigate('/projects')}
        />
      </div>
      <div className="lg:col-span-1">
        <DashboardActivityFeed activities={activities.data ?? []} isLoading={activities.isLoading} />
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-300 pb-16 space-y-6 ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* 1. Header Bar with Theme & Live DB vs Benchmark Switcher */}
      <div
        className={`rounded-2xl p-6 sm:p-7 shadow-xl border relative overflow-hidden transition-all duration-300 ${
          isLight
            ? 'bg-gradient-to-r from-slate-900 via-[#0a2042] to-slate-900 text-white border-slate-800'
            : 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white border-slate-800'
        }`}
      >
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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

          <div className="flex flex-wrap items-center gap-3">
            {/* Real DB vs Benchmark Switch Toggle */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-700/80 shadow-inner">
              <button
                onClick={() => {
                  setDataSourceMode('real');
                  setSelectedYear(2027);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dataSourceMode === 'real'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Query projects from the configured live MYPS database"
              >
                <CircleStackIcon className="w-3.5 h-3.5" />
                <span>Live DB</span>
              </button>
              <button
                onClick={() => {
                  setDataSourceMode('benchmark');
                  setSelectedYear(2027);
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

            {/* Light / Dark Mode Switcher */}
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
              className="p-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 disabled:opacity-50 transition-all flex items-center justify-center shadow-sm"
              title="Refresh dashboard"
            >
              <ArrowPathIcon className={`w-4 h-4 ${kpis.isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Project Repository</span>
            </button>
          </div>
        </div>

        {dataSourceMode === 'benchmark' && (
          <div className="relative mt-4 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100">
            Demo data is for demonstration only and does not come from the live database.
          </div>
        )}

        {/* Perspective View Switcher Tabs */}
        <div className="relative flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto">
          {[
            { id: 'overview', label: 'Executive Overview & Analytics', icon: SparklesIcon },
            { id: 'nep_briefing', label: `FY ${selectedYear} DPWH Budget Allocation`, icon: ChartPieIcon },
            { id: 'live_portfolio', label: 'Live Database Portfolio & Watchlist', icon: AdjustmentsHorizontalIcon },
          ].map((tab) => {
            const active = viewPerspective === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setViewPerspective(tab.id as ViewPerspective)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-white/15 text-white border border-white/20 shadow-inner'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Key High-Impact Animated KPI Cards */}
      <DashboardKpiCards
        data={kpis.data ?? {
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

      {/* 3. Main Analytics Workspaces */}
      <AnimatePresence mode="wait">
        {viewPerspective === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Macro Budget Summary */}
            <LazySection isVisible={macroBudgetViewport.isVisible} sectionRef={macroBudgetViewport.ref} skeleton={skeletonBlock('h-96')}>
              <DashboardMacroBudget
                selectedYear={selectedYear}
                isBenchmark={dataSourceMode === 'benchmark'}
                liveBreakdown={budgetBreakdown.data ?? []}
                isLoading={budgetBreakdown.isLoading}
              />
            </LazySection>

            {/* 5-Year Trajectory */}
            <LazySection isVisible={trajectoryViewport.isVisible} sectionRef={trajectoryViewport.ref} skeleton={skeletonBlock('h-80')}>
              <DashboardTrajectoryChart
                selectedYear={selectedYear}
                onSelectYear={(yr) => setSelectedYear(yr)}
                isBenchmark={dataSourceMode === 'benchmark'}
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
                onStatusSelect={setActiveStatusFilter}
                activeStatusFilter={activeStatusFilter}
                onSelectIsland={setActiveIslandFilter}
                activeIslandFilter={activeIslandFilter}
              />
            </LazySection>

            {/* Project Watchlist & Activity Stream */}
            <LazySection isVisible={watchlistViewport.isVisible} sectionRef={watchlistViewport.ref} skeleton={skeletonBlock('h-96')}>
              {watchlistAndActivity}
            </LazySection>
          </motion.div>
        )}

        {viewPerspective === 'nep_briefing' && (
          <motion.div
            key="nep_briefing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <LazySection isVisible={macroBudgetViewport.isVisible} sectionRef={macroBudgetViewport.ref} skeleton={skeletonBlock('h-96')}>
              <DashboardMacroBudget
                selectedYear={selectedYear}
                isBenchmark={dataSourceMode === 'benchmark'}
                liveBreakdown={budgetBreakdown.data ?? []}
                isLoading={budgetBreakdown.isLoading}
              />
            </LazySection>
            <LazySection isVisible={regionalMatrixViewport.isVisible} sectionRef={regionalMatrixViewport.ref} skeleton={skeletonBlock('h-[500px]')}>
              <DashboardRegionalMatrix
                selectedYear={selectedYear}
                regions={regionalBreakdown.data ?? []}
                isLoading={regionalBreakdown.isLoading}
                onSelectIsland={(isl) => setActiveIslandFilter(isl)}
                activeIslandFilter={activeIslandFilter}
              />
            </LazySection>
            <LazySection isVisible={chartsViewport.isVisible} sectionRef={chartsViewport.ref} skeleton={skeletonBlock('h-96')}>
              <DashboardCharts
                selectedYear={selectedYear}
                monthlyData={monthlyData}
                statusData={statuses.data?.statuses ?? []}
                islandData={statuses.data?.islands ?? []}
                isTrendLoading={trend.isLoading}
                isStatusesLoading={statuses.isLoading}
                onStatusSelect={setActiveStatusFilter}
                activeStatusFilter={activeStatusFilter}
                onSelectIsland={setActiveIslandFilter}
                activeIslandFilter={activeIslandFilter}
              />
            </LazySection>
            <LazySection isVisible={watchlistViewport.isVisible} sectionRef={watchlistViewport.ref} skeleton={skeletonBlock('h-96')}>
              <DashboardProjectWatchlist
                year={selectedYear}
                dataSourceMode={dataSourceMode}
                enabled={watchlistViewport.isVisible}
                refreshSignal={refreshSignal}
                activeIslandFilter={activeIslandFilter}
                activeStatusFilter={activeStatusFilter}
                onClearFilters={clearCrossFilters}
                onSelectProject={setSelectedProject}
                onViewAll={() => navigate('/projects')}
              />
            </LazySection>
          </motion.div>
        )}

        {viewPerspective === 'live_portfolio' && (
          <motion.div
            key="live_portfolio"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <LazySection isVisible={watchlistViewport.isVisible} sectionRef={watchlistViewport.ref} skeleton={skeletonBlock('h-96')}>
              {watchlistAndActivity}
            </LazySection>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ProjectQuickDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />

      <DashboardKpiDetailModal
        type={selectedKpi}
        selectedYear={selectedYear}
        dataSourceMode={dataSourceMode}
        kpiData={kpis.data ?? undefined}
        lsProjects={lsProjects}
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
