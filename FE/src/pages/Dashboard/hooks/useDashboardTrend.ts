import { fetchDashboardTrend, type DashboardFilters } from '../Service';
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

/** The trend plots every fiscal year whichever one is selected (Dashboard/Trend ignores the
 *  year, and so does Demo Data's series), so it is cached under one year: selecting another year
 *  keeps the chart as it is instead of discarding it and refetching identical data. */
const TREND_CACHE_YEAR = 0;

/** Feeds both DashboardCharts (monthlyData) and DashboardTrajectoryChart (liveData) — they
 *  derive their own shapes from this one shared TrendRow[] rather than each fetching it. A header
 *  filter change keeps the previous series on screen while the new one loads. */
export function useDashboardTrend(
  filters: DashboardFilters,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  return useSectionData({
    atom: trendCacheAtom,
    fetchFn: fetchDashboardTrend,
    map: mapTrend,
    year: TREND_CACHE_YEAR,
    filters,
    dataSourceMode,
    enabled,
    keepPreviousData: true,
  });
}
