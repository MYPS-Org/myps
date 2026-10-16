import { fetchDashboardRegionalBreakdown, type DashboardFilters } from '../Service';
import { regionalBreakdownCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';
import type { RegionalBreakdownRow } from '../components/DashboardRegionalMatrix';

function mapRegionalBreakdown(raw: Awaited<ReturnType<typeof fetchDashboardRegionalBreakdown>>): RegionalBreakdownRow[] {
  return (raw.Regions ?? []).map((item) => ({
    region: item.Region,
    island: item.Island,
    hierarchy: item.Hierarchy ?? null,
    budget: item.Budget ?? 0,
    projectCount: item.ProjectCount ?? 0,
  }));
}

export function useDashboardRegionalBreakdown(
  year: number,
  filters: DashboardFilters,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  return useSectionData({
    atom: regionalBreakdownCacheAtom,
    fetchFn: fetchDashboardRegionalBreakdown,
    map: mapRegionalBreakdown,
    year,
    filters,
    dataSourceMode,
    enabled,
    // Kept on screen while a new year or filter loads, so the page does not shift.
    keepPreviousData: true,
  });
}
