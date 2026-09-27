import { atom } from 'jotai';
import type { KpiData } from '../components/DashboardKpiCards';
import type { StatusSegment, IslandAllocation } from '../components/DashboardCharts';
import type { ActivityLog } from '../components/DashboardActivityFeed';
import type { RegionalBreakdownRow } from '../components/DashboardRegionalMatrix';
import type { DashboardLsProject } from '../components/DashboardKpiDetailModal';
import type { DashboardRevisionSummary } from '../Service';

/**
 * Lazy-loading + cache convention for this page: each section owns one atom here, keyed by
 * `${dataSourceMode}:${year}`. A section's hook (see ../hooks) renders straight from the atom
 * when the key matches the current year+mode — no fetch, no skeleton — and only fetches when
 * the key changes or the section becomes visible for the first time. This is what lets switching
 * tabs, or scrolling a section out of view and back, skip a refetch: unlike component state,
 * atoms live at module scope and survive the section unmounting. See documents/plans/
 * dashboard-modular-data-loading.md for the full rationale.
 *
 * Exception: DashboardProjectWatchlist uses `usePagination` directly instead of one of these
 * atoms — its internal page/cursor state is local to that hook call (the same as every other
 * page that uses `usePagination`), so it re-fetches page 1 on remount rather than resuming the
 * exact page it was on. Documented as an accepted, disclosed gap rather than modifying the
 * shared pagination hook to add cross-remount persistence.
 */
export type SectionStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SectionCache<T> {
    key: string | null;
    data: T | null;
    status: SectionStatus;
    error: string | null;
}

export function emptySectionCache<T>(): SectionCache<T> {
    return { key: null, data: null, status: 'idle', error: null };
}

export function sectionCacheKey(dataSourceMode: 'real' | 'benchmark', year: number): string {
    return `${dataSourceMode}:${year}`;
}

export interface TrendRow {
    year: number;
    infrastructureBudget: number;
    lsItemized: number;
    projectCount: number;
}

export interface BudgetBreakdownRow {
    name: string;
    budget: number;
    projectCount: number;
}

/**
 * The KPI request is the one that also tells us which fiscal years exist, so its cache entry
 * carries that alongside the tile figures rather than costing a second round trip just to
 * populate the year switcher.
 */
export interface KpiSection {
    kpis: KpiData;
    selectedYear: number;
    availableYears: number[];
}

export const kpisCacheAtom = atom<SectionCache<KpiSection>>(emptySectionCache<KpiSection>());

/**
 * Which fiscal years Live DB offers. Deliberately NOT part of the keyed section cache: that
 * cache is per `${mode}:${year}` and reads as empty the moment the year changes, whereas this
 * list is the same whatever year is selected. Holding it here stops the year switcher from
 * momentarily falling back to its placeholder mid-request and snapping the user's selection
 * back — see the selection guard in Dashboard.tsx.
 */
export const liveAvailableYearsAtom = atom<number[]>([]);
export const trendCacheAtom = atom<SectionCache<TrendRow[]>>(emptySectionCache<TrendRow[]>());
export const budgetBreakdownCacheAtom = atom<SectionCache<BudgetBreakdownRow[]>>(emptySectionCache<BudgetBreakdownRow[]>());
export const statusesCacheAtom = atom<SectionCache<{ statuses: StatusSegment[]; islands: IslandAllocation[] }>>(
  emptySectionCache<{ statuses: StatusSegment[]; islands: IslandAllocation[] }>()
);
export const regionalBreakdownCacheAtom = atom<SectionCache<RegionalBreakdownRow[]>>(emptySectionCache<RegionalBreakdownRow[]>());
export const activitiesCacheAtom = atom<SectionCache<ActivityLog[]>>(emptySectionCache<ActivityLog[]>());
export const revisionsCacheAtom = atom<SectionCache<DashboardRevisionSummary>>(emptySectionCache<DashboardRevisionSummary>());
export const lsProjectsCacheAtom = atom<SectionCache<DashboardLsProject[]>>(emptySectionCache<DashboardLsProject[]>());
