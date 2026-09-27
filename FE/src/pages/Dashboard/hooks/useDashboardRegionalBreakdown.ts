import { fetchDashboardRegionalBreakdown } from '../Service';
import { regionalBreakdownCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';
import type { RegionalBreakdownRow } from '../components/DashboardRegionalMatrix';

function mapRegionalBreakdown(raw: Awaited<ReturnType<typeof fetchDashboardRegionalBreakdown>>): RegionalBreakdownRow[] {
  return (raw.Regions ?? []).map((item) => ({
    region: item.Region,
    island: item.Island,
    budget: item.Budget ?? 0,
    projectCount: item.ProjectCount ?? 0,
  }));
}

export function useDashboardRegionalBreakdown(year: number, dataSourceMode: 'real' | 'benchmark', enabled: boolean) {
  return useSectionData({
    atom: regionalBreakdownCacheAtom,
    fetchFn: fetchDashboardRegionalBreakdown,
    map: mapRegionalBreakdown,
    year,
    dataSourceMode,
    enabled,
  });
}
