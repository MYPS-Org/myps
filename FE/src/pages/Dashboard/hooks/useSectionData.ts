import { useAtom } from 'jotai';
import type { PrimitiveAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import { sectionCacheKey, type SectionCache } from '../atoms/dashboardSectionCache.atom';

interface UseSectionDataOptions<TRaw, T> {
  atom: PrimitiveAtom<SectionCache<T>>;
  fetchFn: (year: number, isBenchmark: boolean) => Promise<TRaw>;
  map: (raw: TRaw) => T;
  year: number;
  dataSourceMode: 'real' | 'benchmark';
  /** Gates the fetch — pass a viewport/tab visibility flag so the section only loads once needed. */
  enabled: boolean;
}

/**
 * Shared lazy-load-plus-cache wiring for one dashboard section. Renders straight from the
 * section's atom when it already holds data for the current `${dataSourceMode}:${year}` key —
 * this is what makes switching tabs or scrolling a section out of view and back skip a refetch,
 * since the atom lives at module scope and survives the section unmounting. Fetches (once) when
 * `enabled` is true and the key doesn't match what's cached.
 */
export function useSectionData<TRaw, T>({
  atom: cacheAtom,
  fetchFn,
  map,
  year,
  dataSourceMode,
  enabled,
}: UseSectionDataOptions<TRaw, T>) {
  const [cache, setCache] = useAtom(cacheAtom);
  const key = sectionCacheKey(dataSourceMode, year);

  // Guards a fetch whose section changed (year/mode/unmount) before it resolved from clobbering
  // a newer request's result.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (cache.key === key && (cache.status === 'loaded' || cache.status === 'loading')) return;

    const requestId = ++requestIdRef.current;
    setCache({ key, data: null, status: 'loading', error: null });

    fetchFn(year, dataSourceMode === 'benchmark')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, year, dataSourceMode, cache.key, cache.status]);

  return {
    data: cache.key === key ? cache.data : null,
    isLoading: cache.key === key && cache.status === 'loading',
    error: cache.key === key ? cache.error : null,
  };
}
