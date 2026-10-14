import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { fetchDashboardKpis } from '../Service';
import { kpisCacheAtom, liveAvailableYearsAtom, type KpiSection } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';

function mapKpis(raw: Awaited<ReturnType<typeof fetchDashboardKpis>>): KpiSection {
  return {
    kpis: {
      totalBudget: raw.Kpis?.TotalBudget ?? 0,
      activeProjects: raw.Kpis?.ActiveProjects ?? 0,
      publishedProjects: raw.Kpis?.PublishedProjects ?? 0,
      publishableProjects: raw.Kpis?.PublishableProjects ?? 0,
      revisedProjects: raw.Kpis?.RevisedProjects ?? 0,
      lsWalletReleased: raw.Kpis?.LsWalletReleased ?? 0,
      lsWalletTotal: raw.Kpis?.LsWalletTotal ?? 0,
      publicationRate: raw.Kpis?.PublicationRate ?? 0,
    },
    selectedYear: raw.SelectedYear,
    availableYears: raw.AvailableYears ?? [],
  };
}

export function useDashboardKpis(
  year: number,
  categoryId: number | null,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  const section = useSectionData({
    atom: kpisCacheAtom,
    fetchFn: fetchDashboardKpis,
    map: mapKpis,
    year,
    categoryId,
    dataSourceMode,
    enabled,
  });

  // The KPI response is also where the list of selectable fiscal years comes from. Publish it
  // outside the keyed cache so it outlives a year change (see liveAvailableYearsAtom).
  const setLiveAvailableYears = useSetAtom(liveAvailableYearsAtom);
  const availableYears = section.data?.availableYears;
  useEffect(() => {
    if (dataSourceMode === 'real' && availableYears?.length) {
      setLiveAvailableYears(availableYears);
    }
  }, [dataSourceMode, availableYears, setLiveAvailableYears]);

  return section;
}
