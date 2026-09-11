import { fetchDashboardKpis } from '../Service';
import { kpisCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';
import type { KpiData } from '../components/DashboardKpiCards';

function mapKpis(raw: Awaited<ReturnType<typeof fetchDashboardKpis>>): KpiData {
  return {
    totalBudget: raw.Kpis?.TotalBudget ?? 0,
    activeProjects: raw.Kpis?.ActiveProjects ?? 0,
    publishedProjects: raw.Kpis?.PublishedProjects ?? 0,
    publishableProjects: raw.Kpis?.PublishableProjects ?? 0,
    revisedProjects: raw.Kpis?.RevisedProjects ?? 0,
    lsWalletReleased: raw.Kpis?.LsWalletReleased ?? 0,
    lsWalletTotal: raw.Kpis?.LsWalletTotal ?? 0,
    publicationRate: raw.Kpis?.PublicationRate ?? 0,
  };
}

export function useDashboardKpis(year: number, dataSourceMode: 'real' | 'benchmark', enabled: boolean) {
  return useSectionData({
    atom: kpisCacheAtom,
    fetchFn: fetchDashboardKpis,
    map: mapKpis,
    year,
    dataSourceMode,
    enabled,
  });
}
