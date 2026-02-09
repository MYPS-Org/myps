import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { 
  bridgeDataAtom, 
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
import type { BridgePagination } from '../Model.d';

export const useBridgeData = () => {
  const [bridgeData] = useAtom(bridgeDataAtom);
  const [bridgeFilters] = useAtom(bridgeFiltersAtom);
  const [bridgeInitData, setBridgeInitData] = useAtom(bridgeInitDataAtom);
  const [isLoading, setIsLoading] = useAtom(bridgeLoadingAtom);
  const [searchInput, setSearchInput] = useAtom(bridgeSearchInputAtom);
  const [hasActiveFilters] = useAtom(hasActiveBridgeFiltersAtom);
  const [, updateBridgeData] = useAtom(updateBridgeDataAtom);
  const [, updateBridgeFilters] = useAtom(updateBridgeFiltersAtom);
  const [, clearBridgeFilters] = useAtom(clearBridgeFiltersAtom);

  // Initialize data - fetch initial bridges and DEOs
  const initializeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bridgesResponse, initResponse] = await Promise.all([
        fetchBridgeData(bridgeFilters),
        fetchBridgeInitData()
      ]);
      
      updateBridgeData(bridgesResponse.Data);
      setBridgeInitData(initResponse.Data);
    } catch (error) {
      console.error('Error initializing bridge data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [bridgeFilters, updateBridgeData, setBridgeInitData, setIsLoading]);

  // Fetch bridges with current filters
  const fetchBridgeDataWithFilters = useCallback(async (filters?: Partial<BridgePagination>) => {
    setIsLoading(true);
    try {
      const filtersToUse: BridgePagination = {
        ...bridgeFilters,
        ...filters
      };
      const response = await fetchBridgeData(filtersToUse);
      updateBridgeData(response.Data);
      
      if (filters) {
        updateBridgeFilters(filters);
      }
    } catch (error) {
      console.error('Error fetching bridge data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [bridgeFilters, updateBridgeData, updateBridgeFilters, setIsLoading]);

  // Handle search functionality
  const handleSearch = useCallback(async (searchTerm: string) => {
    const updatedFilters = {
      ...bridgeFilters,
      filters: {
        ...bridgeFilters.filters,
        Name: searchTerm
      },
      page: 1
    };
    
    await fetchBridgeDataWithFilters(updatedFilters);
  }, [bridgeFilters, fetchBridgeDataWithFilters]);

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
    await fetchBridgeDataWithFilters({
      filters: {
        RoadSectionId: '',
        BridgeId: '',
        Name: ''
      },
      page: 1,
      limit: 20,
      sortField: '',
      sortDirection: 1
    });
  }, [clearBridgeFilters, fetchBridgeDataWithFilters]);

  // Handle pagination
  const handlePagination = useCallback(async (page: number) => {
    const updatedFilters = {
      ...bridgeFilters,
      page
    };
    
    await fetchBridgeDataWithFilters(updatedFilters);
  }, [bridgeFilters, fetchBridgeDataWithFilters]);

  // Handle sorting
  const handleSort = useCallback(async (field: string, direction: 'asc' | 'desc') => {
    const updatedFilters: Partial<BridgePagination> = {
      ...bridgeFilters,
      sortField: field,
      sortDirection: direction === 'asc' ? 0 : 1,
      page: 1 // Reset to first page when sorting
    };
    
    await fetchBridgeDataWithFilters(updatedFilters);
  }, [bridgeFilters, fetchBridgeDataWithFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: Partial<BridgePagination>) => {
    const updatedFilters = {
      ...bridgeFilters,
      ...newFilters,
      page: 1 // Reset to first page when filtering
    };
    
    await fetchBridgeDataWithFilters(updatedFilters);
  }, [bridgeFilters, fetchBridgeDataWithFilters]);

  // Remove bridge from local state (for optimistic updates)
  const removeBridgeFromState = useCallback((bridgeId: string) => {
    const updatedLists = bridgeData.lists.filter(bridge => bridge.BridgeId !== bridgeId);
    updateBridgeData({
      ...bridgeData,
      lists: updatedLists,
      total: bridgeData.total - 1
    });
  }, [bridgeData, updateBridgeData]);

  // Add bridge to local state (for optimistic updates)
  const addBridgeToState = useCallback((newBridge: any) => {
    const updatedLists = [newBridge, ...bridgeData.lists];
    updateBridgeData({
      ...bridgeData,
      lists: updatedLists,
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
    fetchBridgeDataWithFilters,
    handleSearch,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleSort,
    handleFilterChange,
    
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
