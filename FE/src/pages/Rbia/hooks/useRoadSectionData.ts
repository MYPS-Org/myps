import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import {
  roadSectionFiltersAtom,
  roadSectionLoadingAtom,
  roadSectionSearchInputAtom,
  updateRoadSectionDataAtom,
  updateRoadSectionFiltersAtom,
  clearRoadSectionFiltersAtom,
  hasActiveRoadSectionFiltersAtom,
  deoListAtom
} from '../state/rbiaAtoms';
import { fetchRoadSectionData, fetchRoadSectionInitData } from '../Service';
import type { FutureRoadSections, RoadSectionFilter, RoadSectionPagination } from '../Model.d';
import { usePagination } from '../../../hooks/usePagination';

// The BE's ShowFutureRoadSections endpoint uses keyset pagination (Helpers.QueryPaginationExtensions.
// FilterDataCursor) — a request must carry Navigation (+ the matching cursor) or the BE silently
// forces page 1 (its DTO default is Navigation.First). This adapter translates usePagination's
// PaginatedRequest<RoadSectionFilter> shape into the lowercase-`filters` request shape
// fetchRoadSectionData already expects, forwarding the keyset fields through untouched.
const fetchRoadSectionsForPagination = (params: PaginatedRequest<RoadSectionFilter>) =>
  fetchRoadSectionData({
    filters: params.Filters,
    sortField: params.SortField ?? '',
    sortDirection: params.sortDirection ?? 1,
    page: params.page,
    limit: params.limit,
    Navigation: params.Navigation,
    PreviousFilteredId: params.PreviousFilteredId,
    NextFilteredId: params.NextFilteredId,
    PageCursorId: params.PageCursorId,
  } as RoadSectionPagination);

export const useRoadSectionData = () => {
  const [roadSectionFilters] = useAtom(roadSectionFiltersAtom);
  const [isInitLoading, setIsInitLoading] = useAtom(roadSectionLoadingAtom);
  const [searchInput, setSearchInput] = useAtom(roadSectionSearchInputAtom);
  const [initRoadSections, setInitRoadSections] = useAtom(deoListAtom);
  const [hasActiveFilters] = useAtom(hasActiveRoadSectionFiltersAtom);
  const [, updateRoadSectionData] = useAtom(updateRoadSectionDataAtom);
  const [, updateRoadSectionFilters] = useAtom(updateRoadSectionFiltersAtom);
  const [, clearRoadSectionFilters] = useAtom(clearRoadSectionFiltersAtom);

  const pagination = usePagination<RoadSectionFilter, FutureRoadSections>(fetchRoadSectionsForPagination, {
    initialFilters: roadSectionFilters.filters,
    limit: roadSectionFilters.limit,
    sortField: roadSectionFilters.sortField,
    sortDirection: roadSectionFilters.sortDirection,
  });

  // Mirror usePagination's data into roadSectionDataAtom so other code reading it
  // (roadSectionsCountAtom, etc.) keeps working unchanged.
  useEffect(() => {
    updateRoadSectionData(pagination.data);
  }, [pagination.data, updateRoadSectionData]);

  const roadSectionData = pagination.data;
  const isLoading = isInitLoading || pagination.isLoading;

  // Initialize data - fetch DEO sections (road sections themselves are fetched by usePagination on mount)
  const initializeData = useCallback(async () => {
    setIsInitLoading(true);
    try {
      const responseInitData = await fetchRoadSectionInitData();
      setInitRoadSections(responseInitData.Data.DEOs);
    } catch (error) {
      console.error('Error initializing road section data:', error);
      throw error;
    } finally {
      setIsInitLoading(false);
    }
  }, [setInitRoadSections, setIsInitLoading]);

  // Handle search functionality
  const handleSearch = useCallback(async (searchTerm: string) => {
    const newFilters: RoadSectionFilter = {
      ...roadSectionFilters.filters,
      RoadSectionId: searchTerm
    };
    updateRoadSectionFilters({ filters: newFilters, page: 1 });
    pagination.applyFilters(newFilters);
  }, [roadSectionFilters, updateRoadSectionFilters, pagination]);

  // Handle search input change
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
  }, [setSearchInput]);

  // Handle search submit
  const handleSearchSubmit = useCallback(async () => {
    await handleSearch(searchInput);
  }, [handleSearch, searchInput]);

  // Handle clear search/filters
  const handleClearSearch = useCallback(async () => {
    clearRoadSectionFilters();
    const clearedFilters: RoadSectionFilter = {
      RoadId: '',
      RoadSectionId: '',
      DEO: ''
    };
    pagination.applyFilters(clearedFilters);
  }, [clearRoadSectionFilters, pagination]);

  // Handle pagination
  const handlePagination = useCallback((page: number) => {
    pagination.goToPage(page);
  }, [pagination]);

  // Handle sorting. NOTE: usePagination's sortField/sortDirection are frozen at hook-init time
  // (by design — no column-sort UI wires this yet), so applyFilters here re-fetches with the
  // *previous* sort order, not the new one. Not fixed here — RoadSection.tsx never calls this
  // (its sort headers only update local arrow-indicator state), pre-existing and out of scope for
  // the pagination fix. Would need usePagination itself extended to support dynamic sort.
  const handleSort = useCallback(async (field: string, direction: 'asc' | 'desc') => {
    const sortDirection = direction === 'asc' ? 0 : 1;
    updateRoadSectionFilters({ sortField: field, sortDirection, page: 1 });
    pagination.applyFilters(roadSectionFilters.filters ?? {});
  }, [roadSectionFilters, updateRoadSectionFilters, pagination]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: Partial<RoadSectionPagination>) => {
    updateRoadSectionFilters({ ...newFilters, page: 1 });
    pagination.applyFilters(newFilters.filters ?? roadSectionFilters.filters ?? {});
  }, [roadSectionFilters, updateRoadSectionFilters, pagination]);

  // Remove road section from local state (for optimistic updates) — re-fetches from the BE
  // instead of splicing locally: a keyset page's cursors can't be trusted after a local splice.
  // Uses applyFilters (page 1, cursors cleared) rather than refresh(): if the deleted row was the
  // last one on the last page, refresh() would re-request that now-nonexistent page with a stale
  // cursor (see FE/src/pages/Program/Views/ProgramDetail.tsx's refreshProjects for the same fix).
  const removeRoadSectionFromState = useCallback((roadSectionId: string) => {
    void roadSectionId; // kept for call-site compatibility
    pagination.applyFilters(pagination.currentFilters ?? {});
  }, [pagination]);

  // Add road section to local state (for optimistic updates)
  const addRoadSectionToState = useCallback((newRoadSection: any) => {
    updateRoadSectionData({
      ...roadSectionData,
      lists: [newRoadSection, ...roadSectionData.lists],
      total: roadSectionData.total + 1
    });
  }, [roadSectionData, updateRoadSectionData]);

  // Update road section in local state (for optimistic updates)
  const updateRoadSectionInState = useCallback((updatedRoadSection: any) => {
    const updatedLists = roadSectionData.lists.map(section =>
      section.RoadSectionId === updatedRoadSection.RoadSectionId ? updatedRoadSection : section
    );
    updateRoadSectionData({
      ...roadSectionData,
      lists: updatedLists
    });
  }, [roadSectionData, updateRoadSectionData]);

  return {
    // State
    roadSectionData,
    roadSectionFilters,
    initRoadSections,
    isLoading,
    searchInput,
    hasActiveFilters,

    // Actions
    initializeData,
    handleSearch,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleSort,
    handleFilterChange,

    // Pagination (keyset) controls — see FE/src/hooks/usePagination.ts
    hasPrevious: pagination.hasPrevious,
    hasNext: pagination.hasNext,
    goNext: pagination.goNext,
    goPrevious: pagination.goPrevious,
    goFirst: pagination.goFirst,
    goLast: pagination.goLast,

    // Optimistic updates
    removeRoadSectionFromState,
    addRoadSectionToState,
    updateRoadSectionInState,

    // Direct state setters
    setSearchInput,
    updateRoadSectionFilters,
    clearRoadSectionFilters
  };
};
