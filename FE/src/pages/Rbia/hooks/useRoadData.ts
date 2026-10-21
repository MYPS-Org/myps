import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import {
  roadFiltersAtom,
  roadClassificationsAtom,
  roadIslandCodesAtom,
  roadLoadingAtom,
  roadSearchInputAtom,
  updateRoadDataAtom,
  updateRoadFiltersAtom,
  clearRoadFiltersAtom,
  hasActiveRoadFiltersAtom,
  deoListAtom
} from '../state/rbiaAtoms';
import { fetchRoads, fetchRoadInitData, fetchRoadSectionInitData } from '../Service';
import type { FutureRoads, RoadFilter, RoadPagination } from '../Model.d';
import { usePagination } from '../../../hooks/usePagination';

// The BE's ShowFutureRoads endpoint uses keyset pagination (Helpers.QueryPaginationExtensions.
// FilterDataCursor) — a request must carry Navigation (+ the matching cursor) or the BE silently
// forces page 1 (its DTO default is Navigation.First). This adapter translates usePagination's
// PaginatedRequest<RoadFilter> shape into the lowercase-`filters` request shape fetchRoads already
// expects, forwarding the keyset fields through untouched.
const fetchRoadsForPagination = (params: PaginatedRequest<RoadFilter>) =>
  fetchRoads({
    filters: params.Filters,
    sortField: params.SortField ?? '',
    sortDirection: params.sortDirection ?? 1,
    page: params.page,
    limit: params.limit,
    Navigation: params.Navigation,
    PreviousFilteredId: params.PreviousFilteredId,
    NextFilteredId: params.NextFilteredId,
    PageCursorId: params.PageCursorId,
  } as RoadPagination);

export const useRoadData = () => {
  const [roadFilters] = useAtom(roadFiltersAtom);
  const [roadClassifications, setRoadClassifications] = useAtom(roadClassificationsAtom);
  const [, setRoadIslandCodes] = useAtom(roadIslandCodesAtom);
  const [initRoadSections, setInitRoadSections] = useAtom(deoListAtom);
  const [isInitLoading, setIsInitLoading] = useAtom(roadLoadingAtom);
  const [searchInput, setSearchInput] = useAtom(roadSearchInputAtom);
  const [hasActiveFilters] = useAtom(hasActiveRoadFiltersAtom);
  const [, updateRoadData] = useAtom(updateRoadDataAtom);
  const [, updateRoadFilters] = useAtom(updateRoadFiltersAtom);
  const [, clearRoadFilters] = useAtom(clearRoadFiltersAtom);

  const pagination = usePagination<RoadFilter, FutureRoads>(fetchRoadsForPagination, {
    initialFilters: roadFilters.filters,
    limit: roadFilters.limit,
    sortField: roadFilters.sortField,
    sortDirection: roadFilters.sortDirection,
  });

  // Mirror usePagination's data into roadDataAtom so other code reading it
  // (roadsCountAtom, legacy roadsAtom, etc.) keeps working unchanged.
  useEffect(() => {
    updateRoadData(pagination.data);
  }, [pagination.data, updateRoadData]);

  const roadData = pagination.data;
  const isLoading = isInitLoading || pagination.isLoading;

  // Initialize data - fetch classifications and DEO sections (roads themselves are fetched by usePagination on mount)
  const initializeData = useCallback(async () => {
    setIsInitLoading(true);
    try {
      const [classificationsResponse, sectionResponse] = await Promise.all([
        fetchRoadInitData(),
        fetchRoadSectionInitData()
      ]);

      // Extract Classifications array from the response
      setRoadClassifications(classificationsResponse.Data.Classifications);
      setRoadIslandCodes(classificationsResponse.Data.IslandCodes ?? []);
      setInitRoadSections(sectionResponse.Data.DEOs);
    } catch (error) {
      console.error('Error initializing road data:', error);
      throw error;
    } finally {
      setIsInitLoading(false);
    }
  }, [setRoadClassifications, setRoadIslandCodes, setInitRoadSections, setIsInitLoading]);

  // Handle search functionality
  const handleSearch = useCallback(async (searchTerm: string) => {
    const newFilters: RoadFilter = {
      ...roadFilters.filters,
      Name: searchTerm
    };
    updateRoadFilters({ filters: newFilters, page: 1 });
    pagination.applyFilters(newFilters);
  }, [roadFilters, updateRoadFilters, pagination]);

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
    clearRoadFilters();
    const clearedFilters: RoadFilter = {
      Name: '',
      RoadId: '',
      Classification: ''
    };
    pagination.applyFilters(clearedFilters);
  }, [clearRoadFilters, pagination]);

  // Handle pagination
  const handlePagination = useCallback((page: number) => {
    pagination.goToPage(page);
  }, [pagination]);

  // Column sort (S06-TC001-P001): store the order; usePagination sees the new sortField /
  // sortDirection, drops its cursors and re-fetches page 1 in that order. 0 = asc, 1 = desc.
  const handleSort = useCallback((field: string, direction: 0 | 1) => {
    updateRoadFilters({ sortField: field, sortDirection: direction, page: 1 });
  }, [updateRoadFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: Partial<RoadPagination>) => {
    updateRoadFilters({ ...newFilters, page: 1 });
    pagination.applyFilters(newFilters.filters ?? roadFilters.filters ?? {});
  }, [roadFilters, updateRoadFilters, pagination]);

  // Remove road from local state (for optimistic updates) — re-fetches from the BE instead of
  // splicing locally: a keyset page's cursors can't be trusted after a local splice. Uses
  // applyFilters (page 1, cursors cleared) rather than refresh(): if the deleted row was the last
  // one on the last page, refresh() would re-request that now-nonexistent page with a stale
  // cursor (see FE/src/pages/Program/Views/ProgramDetail.tsx's refreshProjects for the same fix).
  const removeRoadFromState = useCallback((roadId: string) => {
    void roadId; // kept for call-site compatibility
    pagination.applyFilters(pagination.currentFilters ?? {});
  }, [pagination]);

  // Add road to local state (for optimistic updates)
  const addRoadToState = useCallback((newRoad: any) => {
    updateRoadData({
      ...roadData,
      lists: [newRoad, ...roadData.lists],
      total: roadData.total + 1
    });
  }, [roadData, updateRoadData]);

  // Update road in local state (for optimistic updates)
  const updateRoadInState = useCallback((updatedRoad: any) => {
    const updatedLists = roadData.lists.map(road =>
      road.RoadId === updatedRoad.RoadId ? updatedRoad : road
    );
    updateRoadData({
      ...roadData,
      lists: updatedLists
    });
  }, [roadData, updateRoadData]);

  return {
    // State
    initRoadSections,
    roadData,
    roadFilters,
    roadClassifications,
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
    removeRoadFromState,
    // Re-fetch the current page with the current filters, e.g. after a dialog saved a row.
    refresh: () => removeRoadFromState(''),
    addRoadToState,
    updateRoadInState,

    // Direct state setters
    setSearchInput,
    updateRoadFilters,
    clearRoadFilters
  };
};
