import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import {
  bridgeFiltersAtom,
  bridgeLoadingAtom,
  bridgeSearchInputAtom,
  bridgeInitDataAtom,
  updateBridgeDataAtom,
  updateBridgeFiltersAtom,
  clearBridgeFiltersAtom,
  hasActiveBridgeFiltersAtom
} from '../state/rbiaAtoms';
import { fetchBridgeData, fetchBridgeInitData } from '../Service';
import type { FutureBridge, BridgeFilter, BridgePagination } from '../Model.d';
import { usePagination } from '../../../hooks/usePagination';

// The BE's ShowFutureBridge endpoint uses keyset pagination (Helpers.QueryPaginationExtensions.
// FilterDataCursor) — a request must carry Navigation (+ the matching cursor) or the BE silently
// forces page 1 (its DTO default is Navigation.First). This adapter translates usePagination's
// PaginatedRequest<BridgeFilter> shape into the lowercase-`filters` request shape fetchBridgeData
// already expects, forwarding the keyset fields through untouched.
const fetchBridgesForPagination = (params: PaginatedRequest<BridgeFilter>) =>
  fetchBridgeData({
    filters: params.Filters,
    sortField: params.SortField ?? '',
    sortDirection: params.sortDirection ?? 1,
    page: params.page,
    limit: params.limit,
    Navigation: params.Navigation,
    PreviousFilteredId: params.PreviousFilteredId,
    NextFilteredId: params.NextFilteredId,
    PageCursorId: params.PageCursorId,
  } as BridgePagination);

export const useBridgeData = () => {
  const [bridgeFilters] = useAtom(bridgeFiltersAtom);
  const [bridgeInitData, setBridgeInitData] = useAtom(bridgeInitDataAtom);
  const [isInitLoading, setIsInitLoading] = useAtom(bridgeLoadingAtom);
  const [searchInput, setSearchInput] = useAtom(bridgeSearchInputAtom);
  const [hasActiveFilters] = useAtom(hasActiveBridgeFiltersAtom);
  const [, updateBridgeData] = useAtom(updateBridgeDataAtom);
  const [, updateBridgeFilters] = useAtom(updateBridgeFiltersAtom);
  const [, clearBridgeFilters] = useAtom(clearBridgeFiltersAtom);

  const pagination = usePagination<BridgeFilter, FutureBridge>(fetchBridgesForPagination, {
    initialFilters: bridgeFilters.filters,
    limit: bridgeFilters.limit,
    sortField: bridgeFilters.sortField,
    sortDirection: bridgeFilters.sortDirection,
  });

  // Mirror usePagination's data into bridgeDataAtom so other code reading it
  // (bridgesCountAtom, etc.) keeps working unchanged.
  useEffect(() => {
    updateBridgeData(pagination.data);
  }, [pagination.data, updateBridgeData]);

  const bridgeData = pagination.data;
  const isLoading = isInitLoading || pagination.isLoading;

  // Initialize data - fetch DEOs (bridges themselves are fetched by usePagination on mount)
  const initializeData = useCallback(async () => {
    setIsInitLoading(true);
    try {
      const initResponse = await fetchBridgeInitData();
      setBridgeInitData(initResponse.Data);
    } catch (error) {
      console.error('Error initializing bridge data:', error);
      throw error;
    } finally {
      setIsInitLoading(false);
    }
  }, [setBridgeInitData, setIsInitLoading]);

  // Handle search functionality
  const handleSearch = useCallback(async (searchTerm: string) => {
    const newFilters: BridgeFilter = {
      ...bridgeFilters.filters,
      Name: searchTerm
    };
    updateBridgeFilters({ filters: newFilters, page: 1 });
    pagination.applyFilters(newFilters);
  }, [bridgeFilters, updateBridgeFilters, pagination]);

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
    clearBridgeFilters();
    const clearedFilters: BridgeFilter = {
      RoadSectionId: '',
      BridgeId: '',
      Name: ''
    };
    pagination.applyFilters(clearedFilters);
  }, [clearBridgeFilters, pagination]);

  // Handle pagination
  const handlePagination = useCallback((page: number) => {
    pagination.goToPage(page);
  }, [pagination]);

  // Handle sorting. NOTE: usePagination's sortField/sortDirection are frozen at hook-init time
  // (by design — no column-sort UI wires this yet), so applyFilters here re-fetches with the
  // *previous* sort order, not the new one. Not fixed here — Bridge.tsx never calls this (its
  // sort headers only update local arrow-indicator state), pre-existing and out of scope for the
  // pagination fix. Would need usePagination itself extended to support dynamic sort.
  const handleSort = useCallback(async (field: string, direction: 'asc' | 'desc') => {
    const sortDirection = direction === 'asc' ? 0 : 1;
    updateBridgeFilters({ sortField: field, sortDirection, page: 1 });
    pagination.applyFilters(bridgeFilters.filters ?? {});
  }, [bridgeFilters, updateBridgeFilters, pagination]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: Partial<BridgePagination>) => {
    updateBridgeFilters({ ...newFilters, page: 1 });
    pagination.applyFilters(newFilters.filters ?? bridgeFilters.filters ?? {});
  }, [bridgeFilters, updateBridgeFilters, pagination]);

  // Remove bridge from local state (for optimistic updates) — re-fetches from the BE instead of
  // splicing locally: a keyset page's cursors can't be trusted after a local splice. Uses
  // applyFilters (page 1, cursors cleared) rather than refresh(): if the deleted row was the last
  // one on the last page, refresh() would re-request that now-nonexistent page with a stale
  // cursor (see FE/src/pages/Program/Views/ProgramDetail.tsx's refreshProjects for the same fix).
  const removeBridgeFromState = useCallback((bridgeId: string) => {
    void bridgeId; // kept for call-site compatibility
    pagination.applyFilters(pagination.currentFilters ?? {});
  }, [pagination]);

  // Add bridge to local state (for optimistic updates)
  const addBridgeToState = useCallback((newBridge: any) => {
    updateBridgeData({
      ...bridgeData,
      lists: [newBridge, ...bridgeData.lists],
      total: bridgeData.total + 1
    });
  }, [bridgeData, updateBridgeData]);

  // Update bridge in local state (for optimistic updates)
  const updateBridgeInState = useCallback((updatedBridge: any) => {
    const updatedLists = bridgeData.lists.map(bridge =>
      bridge.BridgeId === updatedBridge.BridgeId ? updatedBridge : bridge
    );
    updateBridgeData({
      ...bridgeData,
      lists: updatedLists
    });
  }, [bridgeData, updateBridgeData]);

  return {
    // State
    bridgeData,
    bridgeFilters,
    bridgeInitData,
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
    removeBridgeFromState,
    addBridgeToState,
    updateBridgeInState,

    // Direct state setters
    setSearchInput,
    updateBridgeFilters,
    clearBridgeFilters
  };
};
