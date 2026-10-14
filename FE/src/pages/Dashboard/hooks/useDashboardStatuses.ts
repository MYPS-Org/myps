import { fetchDashboardStatuses, type DashboardFilters } from '../Service';
import { statusesCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';
import type { StatusSegment, IslandAllocation, CategoryShare } from '../components/DashboardCharts';

function mapStatuses(raw: Awaited<ReturnType<typeof fetchDashboardStatuses>>): {
  statuses: StatusSegment[];
  islands: IslandAllocation[];
  categories: CategoryShare[];
} {
  return {
    statuses: (raw.Statuses ?? []).map((item) => ({
      name: item.Name,
      count: item.Count,
      color: '#3b82f6',
      hoverColor: '#2563eb',
    })),
    islands: (raw.Islands ?? []).map((item) => ({
      name: item.Name,
      budget: item.Budget ?? 0,
      projectCount: item.ProjectCount ?? 0,
    })),
    categories: (raw.Categories ?? []).map((item) => ({
      id: item.CategoryId,
      name: item.Name,
      projectCount: item.ProjectCount ?? 0,
      budget: item.Budget ?? 0,
    })),
  };
}

export function useDashboardStatuses(
  year: number,
  filters: DashboardFilters,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  return useSectionData({
    atom: statusesCacheAtom,
    fetchFn: fetchDashboardStatuses,
    map: mapStatuses,
    year,
    filters,
    dataSourceMode,
    enabled,
    // Kept on screen while a new year or filter loads, so the page does not shift.
    keepPreviousData: true,
  });
}
