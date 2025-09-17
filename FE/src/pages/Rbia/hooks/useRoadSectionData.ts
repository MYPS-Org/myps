import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { 
  roadSectionDataAtom, 
  roadSectionFiltersAtom, 
  roadSectionLoadingAtom,
  roadSectionSearchInputAtom,
  updateRoadSectionDataAtom,
  updateRoadSectionFiltersAtom,
  clearRoadSectionFiltersAtom,
  hasActiveRoadSectionFiltersAtom 
} from '../state/rbiaAtoms';
import { fetchRoadSectionData } from '../Service';
import type { RoadSectionPagination } from '../Model.d';

export const useRoadSectionData = () => {
  const [roadSectionData] = useAtom(roadSectionDataAtom);
  const [roadSectionFilters] = useAtom(roadSectionFiltersAtom);
  const [isLoading, setIsLoading] = useAtom(roadSectionLoadingAtom);
  const [searchInput, setSearchInput] = useAtom(roadSectionSearchInputAtom);
  const [hasActiveFilters] = useAtom(hasActiveRoadSectionFiltersAtom);
  const [, updateRoadSectionData] = useAtom(updateRoadSectionDataAtom);
  const [, updateRoadSectionFilters] = useAtom(updateRoadSectionFiltersAtom);
  const [, clearRoadSectionFilters] = useAtom(clearRoadSectionFiltersAtom);

  // Initialize data - fetch initial road sections
  const initializeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchRoadSectionData(roadSectionFilters);
      updateRoadSectionData(response.Data);
    } catch (error) {
      console.error('Error initializing road section data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [roadSectionFilters, updateRoadSectionData, setIsLoading]);

  // Fetch road sections with current filters
  const fetchRoadSectionDataWithFilters = useCallback(async (filters?: Partial<RoadSectionPagination>) => {
    setIsLoading(true);
    try {
      const filtersToUse: RoadSectionPagination = {
        ...roadSectionFilters,
        ...filters
      };
      const response = await fetchRoadSectionData(filtersToUse);
      updateRoadSectionData(response.Data);
      
      if (filters) {
        updateRoadSectionFilters(filters);
      }
    } catch (error) {
      console.error('Error fetching road section data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [roadSectionFilters, updateRoadSectionData, updateRoadSectionFilters, setIsLoading]);

  // Handle search functionality
  const handleSearch = useCallback(async (searchTerm: string) => {
    const updatedFilters = {
      ...roadSectionFilters,
      filters: {
        ...roadSectionFilters.filters,
        RoadSectionId: searchTerm
      },
      page: 1
    };
    
    await fetchRoadSectionDataWithFilters(updatedFilters);
  }, [roadSectionFilters, fetchRoadSectionDataWithFilters]);

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
    await fetchRoadSectionDataWithFilters({
      filters: {
        RoadId: '',
        RoadSectionId: '',
        DEO: ''
      },
      page: 1,
      limit: 20,
      sortField: '',
      sortDirection: 1
    });
  }, [clearRoadSectionFilters, fetchRoadSectionDataWithFilters]);

  // Handle pagination
  const handlePagination = useCallback(async (page: number) => {
    const updatedFilters = {
      ...roadSectionFilters,
      page
    };
    
    await fetchRoadSectionDataWithFilters(updatedFilters);
  }, [roadSectionFilters, fetchRoadSectionDataWithFilters]);

  // Handle sorting
  const handleSort = useCallback(async (field: string, direction: 'asc' | 'desc') => {
    const updatedFilters: Partial<RoadSectionPagination> = {
      ...roadSectionFilters,
      sortField: field,
      sortDirection: direction === 'asc' ? 0 : 1,
      page: 1 // Reset to first page when sorting
    };
    
    await fetchRoadSectionDataWithFilters(updatedFilters);
  }, [roadSectionFilters, fetchRoadSectionDataWithFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (newFilters: Partial<RoadSectionPagination>) => {
    const updatedFilters = {
      ...roadSectionFilters,
      ...newFilters,
      page: 1 // Reset to first page when filtering
    };
    
    await fetchRoadSectionDataWithFilters(updatedFilters);
  }, [roadSectionFilters, fetchRoadSectionDataWithFilters]);

  // Remove road section from local state (for optimistic updates)
  const removeRoadSectionFromState = useCallback((roadSectionId: string) => {
    const updatedLists = roadSectionData.lists.filter(section => section.RoadSectionId !== roadSectionId);
    updateRoadSectionData({
      ...roadSectionData,
      lists: updatedLists,
      total: roadSectionData.total - 1
    });
  }, [roadSectionData, updateRoadSectionData]);

  // Add road section to local state (for optimistic updates)
  const addRoadSectionToState = useCallback((newRoadSection: any) => {
    const updatedLists = [newRoadSection, ...roadSectionData.lists];
    updateRoadSectionData({
      ...roadSectionData,
      lists: updatedLists,
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
    isLoading,
    searchInput,
    hasActiveFilters,
    
    // Actions
    initializeData,
    fetchRoadSectionDataWithFilters,
    handleSearch,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleSort,
    handleFilterChange,
    
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
