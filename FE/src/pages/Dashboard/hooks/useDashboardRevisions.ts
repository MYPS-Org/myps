import { fetchDashboardRevisions, type DashboardRevisionSummary, type DashboardFilters } from '../Service';
import { revisionsCacheAtom } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';

function identity(raw: DashboardRevisionSummary): DashboardRevisionSummary {
  return raw;
}

export function useDashboardRevisions(
  year: number,
  filters: DashboardFilters,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  return useSectionData({
    atom: revisionsCacheAtom,
    fetchFn: fetchDashboardRevisions,
    map: identity,
    year,
    filters,
    dataSourceMode,
    enabled,
  });
}
