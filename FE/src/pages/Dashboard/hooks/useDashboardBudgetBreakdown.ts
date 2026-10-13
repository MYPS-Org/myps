import { fetchDashboardBudgetBreakdown } from '../Service';
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
  categoryId: number | null,
  dataSourceMode: 'real' | 'benchmark',
  enabled: boolean
) {
  return useSectionData({
    atom: budgetBreakdownCacheAtom,
    fetchFn: fetchDashboardBudgetBreakdown,
    map: mapBudgetBreakdown,
    year,
    categoryId,
    dataSourceMode,
    enabled,
  });
}
