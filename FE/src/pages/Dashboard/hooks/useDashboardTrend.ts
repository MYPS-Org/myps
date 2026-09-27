import { fetchDashboardTrend } from '../Service';
import { trendCacheAtom, type TrendRow } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';

function mapTrend(raw: Awaited<ReturnType<typeof fetchDashboardTrend>>): TrendRow[] {
  return (raw.AnnualTrend ?? []).map((item) => ({
    year: item.Year,
    infrastructureBudget: item.InfrastructureBudget ?? 0,
    lsItemized: item.LsItemized ?? 0,
    projectCount: item.ProjectCount ?? 0,
  }));
}

/** Feeds both DashboardCharts (monthlyData) and DashboardTrajectoryChart (liveData) — they
 *  derive their own shapes from this one shared TrendRow[] rather than each fetching it. */
export function useDashboardTrend(year: number, dataSourceMode: 'real' | 'benchmark', enabled: boolean) {
  return useSectionData({
    atom: trendCacheAtom,
    fetchFn: fetchDashboardTrend,
    map: mapTrend,
    year,
    dataSourceMode,
    enabled,
  });
}
