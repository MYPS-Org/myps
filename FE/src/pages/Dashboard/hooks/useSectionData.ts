import { useAtom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { sectionCacheKey, type SectionCache } from '../atoms/dashboardSectionCache.atom';
import type { DashboardFilters } from '../Service';

interface UseSectionDataOptions<TRaw, T> {
  atom: PrimitiveAtom<SectionCache<T>>;
  fetchFn: (year: number, isBenchmark: boolean, filters: DashboardFilters) => Promise<TRaw>;
  map: (raw: TRaw) => T;
  year: number;
  /** The header filters (category, program type, stage) the section is narrowed by. */
  filters: DashboardFilters;
  dataSourceMode: 'real' | 'benchmark';
  /** Gates the fetch — pass a viewport/tab visibility flag so the section only loads once needed. */
  enabled: boolean;
  /**
   * While a new key loads, keep returning the last loaded data (with isLoading true) instead of
   * none, so the section keeps its size and content on screen and can show that it is updating.
   * Only data from the same source is kept: Demo Data is never shown while Live DB loads.
   */
  keepPreviousData?: boolean;
}

/**
 * Shared lazy-load-plus-cache wiring for one dashboard section. Renders straight from the
 * section's atom when it already holds data for the current mode/year/header-filters key —
 * this is what makes switching tabs or scrolling a section out of view and back skip a refetch,
 * since the atom lives at module scope and survives the section unmounting. Fetches (once) when
 * `enabled` is true and the key doesn't match what's cached.
 */
export function useSectionData<TRaw, T>({
  atom: cacheAtom,
  fetchFn,
  map,
  year,
  filters,
  dataSourceMode,
  enabled,
  keepPreviousData = false,
}: UseSectionDataOptions<TRaw, T>) {
  const [cache, setCache] = useAtom(cacheAtom);
  const key = sectionCacheKey(dataSourceMode, year, filters);
  // The cache key starts with the data source; previous data is kept only within the same one.
  const keepsPrevious = keepPreviousData && (cache.key?.startsWith(`${dataSourceMode}:`) ?? false);

  // Guards a fetch whose section changed (year/filters/mode/unmount) before it resolved from clobbering
  // a newer request's result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (cache.key === key && (cache.status === 'loaded' || cache.status === 'loading')) return;

    const requestId = ++requestIdRef.current;
    setCache({ key, data: keepsPrevious ? cache.data : null, status: 'loading', error: null });

    fetchFn(year, dataSourceMode === 'benchmark', filters)
      .then((raw) => {
        if (requestIdRef.current !== requestId) return;
        setCache({ key, data: map(raw), status: 'loaded', error: null });
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        console.error('Dashboard section load failed:', error);
        setCache({
          key,
          data: null,
          status: 'error',
          error: error instanceof Error ? error.message : 'This section could not be loaded.',
        });
      });
    // fetchFn/map are stable module-level exports per section (not recreated per render), so
    // they're intentionally left out — matching the mount-effect pattern in ../../../hooks/usePagination.ts.
    // `filters` is left out too: `key` encodes every field of it, so a new object with the same
    // values must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, year, dataSourceMode, cache.key, cache.status]);

  const isCurrent = cache.key === key;
  return {
    data: isCurrent || keepsPrevious ? cache.data : null,
    // With keepPreviousData, a key the effect has not fetched yet already counts as loading.
    isLoading: isCurrent ? cache.status === 'loading' : keepPreviousData && enabled,
    error: isCurrent ? cache.error : null,
  };
}
