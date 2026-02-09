// Export all custom hooks for easy importing
export { useRoadData } from './useRoadData';
export { useRoadSectionData } from './useRoadSectionData';
export { useBridgeData } from './useBridgeData';

// Re-export types for convenience
export type { 
  FutureRoads as Road,
  FutureRoadSections as RoadSection, 
  FutureBridge as Bridge,
  RoadPagination,
  RoadSectionPagination,
  BridgePagination
} from '../Model.d';
