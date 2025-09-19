import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { 
  roadDataAtom, 
  roadFiltersAtom, 
  roadClassificationsAtom,
  roadLoadingAtom,
  roadSearchInputAtom,
  updateRoadDataAtom,
  updateRoadFiltersAtom,
  clearRoadFiltersAtom,
  hasActiveRoadFiltersAtom, 
  deoListAtom
} from '../state/rbiaAtoms';
import { fetchRoads, fetchRoadInitData, fetchRoadSectionInitData } from '../Service';
import type { RoadPagination } from '../Model.d';

export const useRoadData = () => {
  const [roadData] = useAtom(roadDataAtom);
  const [roadFilters] = useAtom(roadFiltersAtom);
  const [roadClassifications, setRoadClassifications] = useAtom(roadClassificationsAtom);
  const [initRoadSections, setInitRoadSections] = useAtom(deoListAtom);
  const [isLoading, setIsLoading] = useAtom(roadLoadingAtom);
  const [searchInput, setSearchInput] = useAtom(roadSearchInputAtom);
  const [hasActiveFilters] = useAtom(hasActiveRoadFiltersAtom);
  const [, updateRoadData] = useAtom(updateRoadDataAtom);
  const [, updateRoadFilters] = useAtom(updateRoadFiltersAtom);
  const [, clearRoadFilters] = useAtom(clearRoadFiltersAtom);

  // Initialize data - fetch initial roads and classifications
  const initializeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [roadsResponse, classificationsResponse, sectionResponse] = await Promise.all([
        fetchRoads(roadFilters),
        fetchRoadInitData(),
        fetchRoadSectionInitData()
      ]);
      
      updateRoadData(roadsResponse.Data);
      // Extract Classifications array from the response
      setRoadClassifications(classificationsResponse.Data.Classifications);
      setInitRoadSections(sectionResponse.Data.DEOs);
    } catch (error) {
      console.error('Error initializing road data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [roadFilters, updateRoadData, setRoadClassifications, setIsLoading]);

  // Fetch roads with current filters
  const fetchRoadData = useCallback(async (filters?: Partial<RoadPagination>) => {
    setIsLoading(true);
    try {
      const filtersToUse: RoadPagination = {
        ...roadFilters,
        ...filters
      };
      const response = await fetchRoads(filtersToUse);
      updateRoadData(response.Data);
      
      if (filters) {
        updateRoadFilters(filters);
      }
    } catch (error) {
      console.error('Error fetching road data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [roadFilters, updateRoadData, updateRoadFilters, setIsLoading]);

  // Handle search functionality
  const handleSearch = useCallback(async (searchTerm: string) => {
    const updatedFilters = {
      ...roadFilters,
      filters: {
        ...roadFilters.filters,
        Name: searchTerm
      },
      page: 1
    };
    
    await fetchRoadData(updatedFilters);
  }, [roadFilters, fetchRoadData]);

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
    await fetchRoadData({
      filters: {
        Name: '',
        RoadId: '',
        Classification: ''
      },
      page: 1,
      limit: 20,
      sortField: '',
      sortDirection: 1
    });
  }, [clearRoadFilters, fetchRoadData]);

  // Handle pagination
  const handlePagination = useCallback(async (page: number) => {
    const updatedFilters = {
      ...roadFilters,
      page
    };
    
    await fetchRoadData(updatedFilters);
  }, [roadFilters, fetchRoadData]);

  // Handle sorting
  const handleSort = useCallback(async (field: string, direction: 'asc' | 'desc') => {
    const updatedFilters: Partial<RoadPagination> = {
      ...roadFilters,
      sortField: field,
      sortDirection: direction === 'asc' ? 0 : 1,
      page: 1 // Reset to first page when sorting
    };
    
    await fetchRoadData(updatedFilters);
  }, [roadFilters, fetchRoadData]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: Partial<RoadPagination>) => {
    const updatedFilters = {
      ...roadFilters,
      ...newFilters,
      page: 1 // Reset to first page when filtering
    };
    
    await fetchRoadData(updatedFilters);
  }, [roadFilters, fetchRoadData]);

  // Remove road from local state (for optimistic updates)
  const removeRoadFromState = useCallback((roadId: string) => {
    const updatedLists = roadData.lists.filter(road => road.RoadId !== roadId);
    updateRoadData({
      ...roadData,
      lists: updatedLists,
      total: roadData.total - 1
    });
  }, [roadData, updateRoadData]);

  // Add road to local state (for optimistic updates)
  const addRoadToState = useCallback((newRoad: any) => {
    const updatedLists = [newRoad, ...roadData.lists];
    updateRoadData({
      ...roadData,
      lists: updatedLists,
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
    fetchRoadData,
    handleSearch,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleSort,
    handleFilterChange,
    
    // Optimistic updates
    removeRoadFromState,
    addRoadToState,
    updateRoadInState,
    
    // Direct state setters
    setSearchInput,
    updateRoadFilters,
    clearRoadFilters
  };
};
