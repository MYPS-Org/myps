import { fetchDashboardStatuses } from '../Service';
import { statusesCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';
import type { StatusSegment, IslandAllocation } from '../components/DashboardCharts';

function mapStatuses(raw: Awaited<ReturnType<typeof fetchDashboardStatuses>>): {
  statuses: StatusSegment[];
  islands: IslandAllocation[];
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
  };
}

export function useDashboardStatuses(year: number, dataSourceMode: 'real' | 'benchmark', enabled: boolean) {
  return useSectionData({
    atom: statusesCacheAtom,
    fetchFn: fetchDashboardStatuses,
    map: mapStatuses,
    year,
    dataSourceMode,
    enabled,
  });
}
