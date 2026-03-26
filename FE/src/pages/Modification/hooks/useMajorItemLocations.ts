import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { MajorItemLocationsAtom } from '../atoms/majorItemOfWorks.atom';
import type { MajorItemLocations } from '../../Project/Model';

/**
 * Hook for managing Major Item Locations independently from Major Items
 * This decouples work location state management to avoid unnecessary re-renders
 * and provides better scalability for future updates.
 */
export const useMajorItemLocations = () => {
  const [locations, setLocations] = useAtom(MajorItemLocationsAtom);

  /**
   * Seed locations from initial data
   */
  const seedLocations = useCallback((initialLocations: MajorItemLocations[]) => {
    setLocations(initialLocations ?? []);
  }, [setLocations]);

  /**
   * Get all locations for a specific major item (by ParentId)
   */
  const getLocationsByParentId = useCallback((parentId: string): MajorItemLocations[] => {
    return locations.filter(loc => loc.ParentId === parentId);
  }, [locations]);

  /**
   * Add a new work location
   */
  const addWorkLocation = useCallback((workLocation: MajorItemLocations) => {
    setLocations(prev => [...prev, workLocation]);
  }, [setLocations]);

  /**
   * Edit an existing work location by ParentId and index within that parent's locations
   */
  const editWorkLocation = useCallback((
    parentId: string,
    locationIndex: number,
    updatedLocation: MajorItemLocations
  ) => {
    setLocations(prev => {
      // Get all locations for this parent
      const parentLocations = prev.filter(loc => loc.ParentId === parentId);
      const otherLocations = prev.filter(loc => loc.ParentId !== parentId);
      
      // Update the specific location
      if (locationIndex >= 0 && locationIndex < parentLocations.length) {
        parentLocations[locationIndex] = updatedLocation;
      }
      
      // Combine and return
      return [...otherLocations, ...parentLocations];
    });
  }, [setLocations]);

  /**
   * Delete a work location by ParentId and index
   */
  const deleteWorkLocation = useCallback((
    parentId: string,
    locationIndex: number
  ) => {
    setLocations(prev => {
      // Get all locations for this parent
      const parentLocations = prev.filter(loc => loc.ParentId === parentId);
      const otherLocations = prev.filter(loc => loc.ParentId !== parentId);
      
      // Get the location to delete
      const locationToDelete = parentLocations[locationIndex];
      if (!locationToDelete) return prev;
      
      if (locationToDelete.Id === 0) {
        // New item - hard delete (remove from array)
        parentLocations.splice(locationIndex, 1);
      } else {
        // Existing item - soft delete (mark as deleted)
        parentLocations[locationIndex] = { ...locationToDelete, IsDeleted: true };
      }
      
      // Combine and return
      return [...otherLocations, ...parentLocations];
    });
  }, [setLocations]);

  /**
   * Delete all work locations for a specific major item (when major item is deleted)
   */
  const deleteLocationsByParentId = useCallback((parentId: string) => {
    setLocations(prev => prev.filter(loc => loc.ParentId !== parentId));
  }, [setLocations]);

  /**
   * Update ParentId for all locations when a major item's ReferenceId changes
   */
  const updateParentId = useCallback((oldParentId: string, newParentId: string) => {
    setLocations(prev => 
      prev.map(loc => 
        loc.ParentId === oldParentId 
          ? { ...loc, ParentId: newParentId } 
          : loc
      )
    );
  }, [setLocations]);

  return {
    locations,
    getLocationsByParentId,
    seedLocations,
    addWorkLocation,
    editWorkLocation,
    deleteWorkLocation,
    deleteLocationsByParentId,
    updateParentId,
  };
};