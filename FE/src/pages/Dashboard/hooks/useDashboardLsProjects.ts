import { fetchDashboardLsProjects } from '../Service';
import type { DashboardSummary } from '../Service';
import type { DashboardLsProject } from '../components/DashboardKpiDetailModal';
import { lsProjectsCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';

function mapLsProjects(raw: Awaited<ReturnType<typeof fetchDashboardLsProjects>>): DashboardLsProject[] {
  return (raw.LsProjects ?? []).map((project: DashboardSummary['LsProjects'][number]) => ({
    id: project.Id,
    projectPK: project.ProjectPK,
    projectId: project.ProjectId,
    description: project.Description,
    programName: project.ProgramName,
    stageName: project.StageName,
    totalAllocation: project.TotalAllocation,
    itemizedAmount: project.ItemizedAmount,
    remainingAmount: project.RemainingAmount,
    itemizedCount: project.ItemizedCount,
    children: project.Children.map((child) => ({
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
}

export function useDashboardLsProjects(year: number, dataSourceMode: 'real' | 'benchmark', enabled: boolean) {
  return useSectionData({
    atom: lsProjectsCacheAtom,
    fetchFn: fetchDashboardLsProjects,
    map: mapLsProjects,
    year,
    dataSourceMode,
    enabled,
  });
}
