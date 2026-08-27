import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowPathIcon, CheckBadgeIcon, CloudIcon, PlusIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDashboardSummary, type DashboardSummary } from './Service';
import DashboardKpiCards, { type KpiData } from './components/DashboardKpiCards';
import DashboardCharts, { type IslandAllocation, type MonthlyTrend, type StatusSegment } from './components/DashboardCharts';
import DashboardProjectWatchlist from './components/DashboardProjectWatchlist';
import ProjectQuickDetailModal, { type WatchlistProject } from './components/ProjectQuickDetailModal';
import DashboardActivityFeed, { type ActivityLog } from './components/DashboardActivityFeed';
import DashboardKpiDetailModal, { type DashboardKpiType, type DashboardLsProject } from './components/DashboardKpiDetailModal';

const STATUS_COLORS = ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'];
const STATUS_HOVER_COLORS = ['#000000', '#1f2937', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db'];
const EMPTY_KPIS: KpiData = { totalBudget: 0, activeProjects: 0, publishedProjects: 0, publishableProjects: 0, revisedProjects: 0, lsWalletReleased: 0, lsWalletTotal: 0, publicationRate: 0 };
const isValidFiscalYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2200;

function mapSummary(summary: DashboardSummary) {
  const kpis: KpiData = {
    totalBudget: summary.Kpis.TotalBudget,
    activeProjects: summary.Kpis.ActiveProjects,
    publishedProjects: summary.Kpis.PublishedProjects,
    publishableProjects: summary.Kpis.PublishableProjects,
    revisedProjects: summary.Kpis.RevisedProjects,
    lsWalletReleased: summary.Kpis.LsWalletReleased,
    lsWalletTotal: summary.Kpis.LsWalletTotal,
    publicationRate: summary.Kpis.PublicationRate,
  };
  const trends: MonthlyTrend[] = summary.AnnualTrend.filter((item) => isValidFiscalYear(item.Year)).map((item) => ({ month: String(item.Year), budget: item.InfrastructureBudget / 1e6, actual: item.LsItemized / 1e6 }));
  const statuses: StatusSegment[] = summary.Statuses.map((item, index) => ({ name: item.Name, count: item.Count, color: STATUS_COLORS[index % STATUS_COLORS.length], hoverColor: STATUS_HOVER_COLORS[index % STATUS_HOVER_COLORS.length] }));
  const islands: IslandAllocation[] = summary.Islands.map((item) => ({ name: item.Name, budget: item.Budget, projectCount: item.ProjectCount }));
  const projects: WatchlistProject[] = summary.Projects.map((item) => ({
    id: String(item.Id), projectPK: item.ProjectPK, projectId: item.ProjectId, description: item.Description, programName: item.ProgramName,
    region: item.Region, island: item.Island, category: item.Category, stageName: item.StageName,
    implementingOffice: item.ImplementingOffice, fundingSource: item.FundingSource,
    allocatedBudget: item.AllocatedBudget, updatedAt: new Date(item.UpdatedAt).toLocaleString(),
    isPublished: item.IsPublished, isPublishable: item.IsPublishable, isRevised: item.IsRevised,
  }));
  const activities: ActivityLog[] = summary.Activities.map((item) => ({ id: item.Id, type: item.Type, title: item.Title, description: item.Description, timestamp: new Date(item.Timestamp).toLocaleString(), user: item.User }));
  const lsProjects: DashboardLsProject[] = summary.LsProjects.map((item) => ({
    id: item.Id, projectPK: item.ProjectPK, projectId: item.ProjectId, description: item.Description,
    programName: item.ProgramName, stageName: item.StageName, totalAllocation: item.TotalAllocation,
    itemizedAmount: item.ItemizedAmount, remainingAmount: item.RemainingAmount, itemizedCount: item.ItemizedCount,
    children: (item.Children ?? []).map((child) => ({
      id: child.Id, projectPK: child.ProjectPK, projectId: child.ProjectId,
      description: child.Description, stageName: child.StageName,
      fundingTotal: child.FundingTotal, componentCostTotal: child.ComponentCostTotal,
      isPublished: child.IsPublished,
    })),
  }));
  return { kpis, trends, statuses, islands, projects, activities, lsProjects };
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number>();
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [kpiData, setKpiData] = useState<KpiData>(EMPTY_KPIS);
  const [trendData, setTrendData] = useState<MonthlyTrend[]>([]);
  const [statusSegments, setStatusSegments] = useState<StatusSegment[]>([]);
  const [islands, setIslands] = useState<IslandAllocation[]>([]);
  const [projects, setProjects] = useState<WatchlistProject[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [lsProjects, setLsProjects] = useState<DashboardLsProject[]>([]);
  const [selectedKpi, setSelectedKpi] = useState<DashboardKpiType | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<WatchlistProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchDashboardSummary(selectedYear).then((summary) => {
      if (!active) return;
      const mapped = mapSummary(summary);
      const validYears = summary.AvailableYears.filter(isValidFiscalYear);
      setSelectedYear(isValidFiscalYear(summary.SelectedYear) ? summary.SelectedYear : validYears[0]);
      setAvailableYears(validYears);
      setKpiData(mapped.kpis); setTrendData(mapped.trends); setStatusSegments(mapped.statuses);
      setIslands(mapped.islands); setProjects(mapped.projects); setActivities(mapped.activities); setLsProjects(mapped.lsProjects);
    }).catch((reason) => {
      if (active) setError(reason?.Message ?? reason?.message ?? 'Dashboard data could not be loaded.');
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [selectedYear, refreshKey]);

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 flex items-center gap-1.5"><CheckBadgeIcon className="w-4 h-4 text-gray-500" /> MYPS Command Center</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 flex items-center gap-1"><UserCircleIcon className="w-4 h-4 text-gray-400" /> Role: {user?.UserGroupNames?.join(', ') || 'No assigned group'}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 flex items-center gap-1.5"><CloudIcon className="w-3.5 h-3.5 text-gray-400" /> Database data</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Welcome back, {user?.Name || user?.UserId || 'User'}!</h1>
            <p className="mt-1 text-sm text-gray-500 max-w-2xl">Budget, project-stage, publication, and Lump Sum itemization totals from MYPS records.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
              {availableYears.map((year) => <button key={year} onClick={() => setSelectedYear(year)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedYear === year ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>FY {year}</button>)}
            </div>
            <button onClick={() => setRefreshKey((value) => value + 1)} disabled={isLoading} className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50" title="Refresh dashboard"><ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
            <button onClick={() => navigate('/projects')} className="px-4 py-2 text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg flex items-center gap-1.5"><PlusIcon className="w-4 h-4" /> Project Repository</button>
          </div>
        </div>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error} No demo data has been substituted. <button className="font-semibold underline" onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></div>}
      <DashboardKpiCards data={kpiData} isLoading={isLoading} onCardClick={(type) => setSelectedKpi(type as DashboardKpiType)} />
      <DashboardCharts selectedYear={selectedYear ?? new Date().getFullYear()} monthlyData={trendData} statusData={statusSegments} islandData={islands} onStatusSelect={setActiveStatusFilter} activeStatusFilter={activeStatusFilter} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><DashboardProjectWatchlist projects={projects} onSelectProject={setSelectedProject} activeStatusFilter={activeStatusFilter} onViewAll={() => navigate('/projects')} /></div>
        <DashboardActivityFeed activities={activities} />
      </div>
      <ProjectQuickDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />
      <DashboardKpiDetailModal
        type={selectedKpi}
        selectedYear={selectedYear ?? new Date().getFullYear()}
        projects={projects}
        lsProjects={lsProjects}
        onClose={() => setSelectedKpi(null)}
        onOpenProject={(project) => navigate(`/projects/project-details/${encodeURIComponent(project.projectPK)}:${encodeURIComponent(project.stageName)}`)}
        onOpenLsProject={(project) => navigate(`/lumpsum/${project.id}`)}
      />
    </div>
  );
};

export default Dashboard;
