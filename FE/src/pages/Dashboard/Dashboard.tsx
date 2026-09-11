import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

import { fetchDashboardSummary, type DashboardRevisionSummary, type DashboardSummary } from './Service';
import { DashboardThemeProvider, useDashboardTheme } from './DashboardTheme';
import DashboardKpiCards, { type KpiData } from './components/DashboardKpiCards';
import DashboardCharts, { type IslandAllocation, type MonthlyTrend, type StatusSegment } from './components/DashboardCharts';
import DashboardMacroBudget from './components/DashboardMacroBudget';
import DashboardTrajectoryChart from './components/DashboardTrajectoryChart';
import DashboardRegionalMatrix from './components/DashboardRegionalMatrix';
import DashboardProjectWatchlist from './components/DashboardProjectWatchlist';
import { type WatchlistProject } from './components/DashboardProjectWatchlist';
import DashboardActivityFeed, { type ActivityLog } from './components/DashboardActivityFeed';
import DashboardKpiDetailModal, { type DashboardKpiType, type DashboardLsProject } from './components/DashboardKpiDetailModal';
import ProjectQuickDetailModal from './components/ProjectQuickDetailModal';

const MINIMUM_FISCAL_YEAR = 2000;
const MAXIMUM_FISCAL_YEAR = 2200;

function isValidFiscalYear(year: number): boolean {
  return Number.isInteger(year) && year >= MINIMUM_FISCAL_YEAR && year <= MAXIMUM_FISCAL_YEAR;
}

const EMPTY_KPIS: KpiData = {
  totalBudget: 0,
  activeProjects: 0,
  publishedProjects: 0,
  publishableProjects: 0,
  revisedProjects: 0,
  lsWalletReleased: 0,
  lsWalletTotal: 0,
  publicationRate: 0,
};

type ViewPerspective = 'overview' | 'nep_briefing' | 'live_portfolio';

const EMPTY_REVISIONS: DashboardRevisionSummary = {
  ForReview: 0,
  ForApproval: 0,
  ForCorrection: 0,
  Approved: 0,
  Disapproved: 0,
  Total: 0,
  ByStatus: [],
  ByImplementingOffice: [],
  ByGroup: [],
  Items: [],
};

function mapSummary(summary: DashboardSummary) {
  const kpis: KpiData = {
    totalBudget: summary.Kpis?.TotalBudget ?? 0,
    activeProjects: summary.Kpis?.ActiveProjects ?? 0,
    publishedProjects: summary.Kpis?.PublishedProjects ?? 0,
    publishableProjects: summary.Kpis?.PublishableProjects ?? 0,
    revisedProjects: summary.Kpis?.RevisedProjects ?? 0,
    lsWalletReleased: summary.Kpis?.LsWalletReleased ?? 0,
    lsWalletTotal: summary.Kpis?.LsWalletTotal ?? 0,
    publicationRate: summary.Kpis?.PublicationRate ?? 0,
  };

  const trends: MonthlyTrend[] = (summary.AnnualTrend ?? []).map((item) => ({
    month: item.Year.toString(),
    budget: item.InfrastructureBudget ?? 0,
    actual: item.LsItemized ?? 0,
  }));

  const trajectory = (summary.AnnualTrend ?? []).map((item) => ({
    year: item.Year,
    projects: item.ProjectCount ?? 0,
    budget: item.InfrastructureBudget ?? 0,
  }));

  const budgetBreakdown = (summary.BudgetBreakdown ?? []).map((item) => ({
    name: item.Name,
    budget: item.Budget ?? 0,
    projectCount: item.ProjectCount ?? 0,
  }));

  const statuses: StatusSegment[] = (summary.Statuses ?? []).map((item) => ({
    name: item.Name,
    count: item.Count,
    color: '#3b82f6',
    hoverColor: '#2563eb',
  }));

  const islands: IslandAllocation[] = (summary.Islands ?? []).map((item) => ({
    name: item.Name,
    budget: item.Budget ?? 0,
    projectCount: item.ProjectCount ?? 0,
  }));

  const projects: WatchlistProject[] = (summary.Projects ?? []).map((item) => ({
    id: item.Id.toString(),
    projectPK: item.ProjectPK,
    projectId: item.ProjectId,
    description: item.Description,
    programName: item.ProgramName,
    region: item.Region,
    island: item.Island,
    category: item.Category,
    stageName: item.StageName,
    implementingOffice: item.ImplementingOffice,
    fundingSource: item.FundingSource,
    allocatedBudget: item.AllocatedBudget,
    updatedAt: item.UpdatedAt,
    isPublished: item.IsPublished,
    isPublishable: item.IsPublishable,
    isRevised: item.IsRevised,
  }));

  const activities: ActivityLog[] = (summary.Activities ?? []).map((item) => ({
    id: item.Id,
    type: item.Type,
    title: item.Title,
    description: item.Description,
    timestamp: item.Timestamp,
    user: item.User,
  }));

  const lsProjects: DashboardLsProject[] = (summary.LsProjects ?? []).map((item) => ({
    id: item.Id,
    projectPK: item.ProjectPK,
    projectId: item.ProjectId,
    description: item.Description,
    programName: item.ProgramName,
    stageName: item.StageName,
    totalAllocation: item.TotalAllocation,
    itemizedAmount: item.ItemizedAmount,
    remainingAmount: item.RemainingAmount,
    itemizedCount: item.ItemizedCount,
    children: (item.Children ?? []).map((child) => ({
      id: child.Id,
      projectPK: child.ProjectPK,
      projectId: child.ProjectId,
      description: child.Description,
      stageName: child.StageName,
      fundingTotal: child.FundingTotal,
      componentCostTotal: child.ComponentCostTotal,
      isPublished: child.IsPublished,
    })),
  }));

  const revisions: DashboardRevisionSummary = summary.Revisions ?? {
    ForReview: 0,
    ForApproval: 0,
    ForCorrection: 0,
    Approved: 0,
    Disapproved: 0,
    Total: 0,
    ByStatus: [],
    ByImplementingOffice: [],
    ByGroup: [],
    Items: [],
  };

  return {
    kpis,
    revisions,
    trends,
    trajectory,
    budgetBreakdown,
    statuses,
    islands,
    projects,
    activities,
    lsProjects,
  };
}

const DashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { setTheme, isLight } = useDashboardTheme();

  const [dataSourceMode, setDataSourceMode] = useState<'real' | 'benchmark'>('benchmark');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [kpiData, setKpiData] = useState<KpiData>(EMPTY_KPIS);
  const [trendData, setTrendData] = useState<MonthlyTrend[]>([]);
  const [statusSegments, setStatusSegments] = useState<StatusSegment[]>([]);
  const [islands, setIslands] = useState<IslandAllocation[]>([]);
  const [projects, setProjects] = useState<WatchlistProject[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [lsProjects, setLsProjects] = useState<DashboardLsProject[]>([]);
  const [revisions, setRevisions] = useState<DashboardRevisionSummary>(EMPTY_REVISIONS);
  const [trajectoryData, setTrajectoryData] = useState<Array<{ year: number; projects: number; budget: number }>>([]);
  const [budgetBreakdown, setBudgetBreakdown] = useState<Array<{ name: string; budget: number; projectCount: number }>>([]);

  const [selectedKpi, setSelectedKpi] = useState<DashboardKpiType | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [activeIslandFilter, setActiveIslandFilter] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<WatchlistProject | null>(null);

  const [viewPerspective, setViewPerspective] = useState<ViewPerspective>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const skipResolvedYearFetch = useRef(false);
  const displayYear = selectedYear ?? new Date().getFullYear();
  const clearFigures = useCallback(() => {
    setKpiData(EMPTY_KPIS);
    setTrendData([]);
    setTrajectoryData([]);
    setBudgetBreakdown([]);
    setStatusSegments([]);
    setIslands([]);
    setProjects([]);
    setActivities([]);
    setLsProjects([]);
    setRevisions(EMPTY_REVISIONS);
    setSelectedProject(null);
  }, []);

  useEffect(() => {
    if (skipResolvedYearFetch.current) {
      skipResolvedYearFetch.current = false;
      return;
    }

    let active = true;
    setIsLoading(true);
    setLoadError(null);
    clearFigures();

    fetchDashboardSummary(selectedYear ?? undefined, dataSourceMode === 'benchmark')
      .then((summary) => {
        if (!active) return;
        const mapped = mapSummary(summary);
        const validYears = summary.AvailableYears.filter(isValidFiscalYear);
        setAvailableYears(validYears);
        if (selectedYear === null) {
          skipResolvedYearFetch.current = true;
          setSelectedYear(summary.SelectedYear);
        }
        setKpiData(mapped.kpis);
        setTrendData(mapped.trends);
        setTrajectoryData(mapped.trajectory);
        setBudgetBreakdown(mapped.budgetBreakdown);
        setStatusSegments(mapped.statuses);
        setIslands(mapped.islands);
        setProjects(mapped.projects);
        setActivities(mapped.activities);
        setLsProjects(mapped.lsProjects);
        setRevisions(mapped.revisions);
      })
      .catch((err) => {
        console.error('Dashboard load issue:', err);
        if (!active) return;
        setLoadError(dataSourceMode === 'real'
          ? 'Live dashboard data could not be loaded. No presentation or fallback figures have been substituted.'
          : 'The demo data could not be loaded.');
        setAvailableYears([]);
        clearFigures();
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedYear, refreshKey, dataSourceMode, clearFigures]);

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
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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
                  setSelectedYear(null);
                  setAvailableYears([]);
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
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={isLoading}
              className="p-2.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 disabled:opacity-50 transition-all flex items-center justify-center shadow-sm"
              title="Refresh dashboard"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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
          <div className="relative z-10 mt-4 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100">
            Demo data is for demonstration only and does not come from the live database.
          </div>
        )}

        {/* Perspective View Switcher Tabs */}
        <div className="relative z-10 flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto">
          {[
            { id: 'overview', label: 'Executive Overview & Analytics', icon: SparklesIcon },
            { id: 'nep_briefing', label: `FY ${displayYear} DPWH Budget Allocation`, icon: ChartPieIcon },
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

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {loadError}
        </div>
      )}

      {!loadError && <>
      {/* 2. Key High-Impact Animated KPI Cards */}
      <DashboardKpiCards
        data={kpiData}
        revisions={revisions}
        isLoading={isLoading}
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
            <DashboardMacroBudget
              selectedYear={displayYear}
              isBenchmark={dataSourceMode === 'benchmark'}
              liveBreakdown={budgetBreakdown}
            />

            {/* 5-Year Trajectory */}
            <DashboardTrajectoryChart
              selectedYear={displayYear}
              onSelectYear={(yr) => setSelectedYear(yr)}
              isBenchmark={dataSourceMode === 'benchmark'}
              liveData={trajectoryData}
            />

            {/* Regional Capital Outlays Infographic Matrix */}
            <DashboardRegionalMatrix
              selectedYear={displayYear}
              projects={projects}
              islands={islands}
              onSelectIsland={(isl) => setActiveIslandFilter(isl)}
              activeIslandFilter={activeIslandFilter}
            />

            {/* Annual Trend & Project Stages */}
            <DashboardCharts
              selectedYear={displayYear}
              monthlyData={trendData}
              statusData={statusSegments}
              islandData={islands}
              onStatusSelect={setActiveStatusFilter}
              activeStatusFilter={activeStatusFilter}
              onSelectIsland={setActiveIslandFilter}
              activeIslandFilter={activeIslandFilter}
            />

            {/* Project Watchlist & Activity Stream */}
            <div id="watchlist-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-2">
                <DashboardProjectWatchlist
                  projects={projects}
                  onSelectProject={setSelectedProject}
                  activeIslandFilter={activeIslandFilter}
                  activeStatusFilter={activeStatusFilter}
                  onClearFilters={() => {
                    setActiveIslandFilter(null);
                    setActiveStatusFilter(null);
                  }}
                  onViewAll={() => navigate('/projects')}
                />
              </div>
              <div className="lg:col-span-1">
                <DashboardActivityFeed activities={activities} />
              </div>
            </div>
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
            <DashboardMacroBudget
              selectedYear={displayYear}
              isBenchmark={dataSourceMode === 'benchmark'}
              liveBreakdown={budgetBreakdown}
            />
            <DashboardRegionalMatrix
              selectedYear={displayYear}
              projects={projects}
              islands={islands}
              onSelectIsland={(isl) => setActiveIslandFilter(isl)}
              activeIslandFilter={activeIslandFilter}
            />
            <DashboardCharts
              selectedYear={displayYear}
              monthlyData={trendData}
              statusData={statusSegments}
              islandData={islands}
              onStatusSelect={setActiveStatusFilter}
              activeStatusFilter={activeStatusFilter}
              onSelectIsland={setActiveIslandFilter}
              activeIslandFilter={activeIslandFilter}
            />
            <DashboardProjectWatchlist
              projects={projects}
              onSelectProject={setSelectedProject}
              activeIslandFilter={activeIslandFilter}
              activeStatusFilter={activeStatusFilter}
              onClearFilters={() => {
                setActiveIslandFilter(null);
                setActiveStatusFilter(null);
              }}
              onViewAll={() => navigate('/projects')}
            />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DashboardProjectWatchlist
                  projects={projects}
                  onSelectProject={setSelectedProject}
                  activeIslandFilter={activeIslandFilter}
                  activeStatusFilter={activeStatusFilter}
                  onClearFilters={() => {
                    setActiveIslandFilter(null);
                    setActiveStatusFilter(null);
                  }}
                  onViewAll={() => navigate('/projects')}
                />
              </div>
              <div className="lg:col-span-1">
                <DashboardActivityFeed activities={activities} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ProjectQuickDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />

      <DashboardKpiDetailModal
        type={selectedKpi}
        selectedYear={displayYear}
        kpiData={kpiData}
        projects={projects}
        lsProjects={lsProjects}
        revisions={revisions}
        onClose={() => setSelectedKpi(null)}
        onOpenProject={() => {
          setSelectedKpi(null);
          navigate('/projects');
        }}
        onOpenLsProject={(project) => navigate(`/lumpsum/${project.id}`)}
      />
      </>}
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
