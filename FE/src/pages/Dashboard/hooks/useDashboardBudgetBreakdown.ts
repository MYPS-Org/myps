import { fetchDashboardBudgetBreakdown, type DashboardFilters } from '../Service';
import { budgetBreakdownCacheAtom, type BudgetBreakdownRow } from '../atoms/dashboardSectionCache.atom';
import { useSectionData } from './useSectionData';

function mapBudgetBreakdown(raw: Awaited<ReturnType<typeof fetchDashboardBudgetBreakdown>>): BudgetBreakdownRow[] {
  return (raw.BudgetBreakdown ?? []).map((item) => ({
    name: item.Name,
    budget: item.Budget ?? 0,
    projectCount: item.ProjectCount ?? 0,
  }));
}

export function useDashboardBudgetBreakdown(
  year: number,
  filters: DashboardFilters,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  return useSectionData({
    atom: budgetBreakdownCacheAtom,
    fetchFn: fetchDashboardBudgetBreakdown,
    map: mapBudgetBreakdown,
    year,
    filters,
    dataSourceMode,
    enabled,
    // Kept on screen while a new year or filter loads, so the page does not shift.
    keepPreviousData: true,
  });
}
