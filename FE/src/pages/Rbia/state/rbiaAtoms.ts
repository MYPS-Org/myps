import { atom } from "jotai";

// Import the types from Model.d.ts
import type { 
  FutureRoads, 
  FutureRoadSections, 
  FutureBridge, 
  RoadPagination,
  RoadSectionPagination,
  BridgePagination,
  FutureRoadsClassification
} from "../Model.d";
import type { RODEOEnum } from "../../Project/Model";

// Type aliases for compatibility
export type Road = FutureRoads;
export type RoadSection = FutureRoadSections;
export type Bridge = FutureBridge;

// Define interfaces for paginated data
interface PaginatedRoadData {
  lists: FutureRoads[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedRoadSectionData {
  lists: FutureRoadSections[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedBridgeData {
  lists: FutureBridge[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Road Data State Atoms
export const roadDataAtom = atom<PaginatedRoadData>({
  lists: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
});

// Road Filters Atom
export const roadFiltersAtom = atom<RoadPagination>({
  filters: {
    Name: '',
    RoadId: '',
    Classification: ''
  },
  sortField: '',
  sortDirection: 1,
  page: 1,
  limit: 20
});

// Road Classifications Atom
export const roadClassificationsAtom = atom<FutureRoadsClassification[]>([]);

// DEO List Atom (for Road Sections and Bridges)
export const deoListAtom = atom<RODEOEnum[]>([]);

// Loading State Atoms
export const roadLoadingAtom = atom<boolean>(false);

// Search Input Atom
export const roadSearchInputAtom = atom<string>('');

// === ROAD SECTION ATOMS ===
// Road Section Data State Atoms
export const roadSectionDataAtom = atom<PaginatedRoadSectionData>({
  lists: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
});

// Road Section Filters Atom
export const roadSectionFiltersAtom = atom<RoadSectionPagination>({
  filters: {
    RoadId: '',
    RoadSectionId: '',
    DEO: ''
  },
  sortField: '',
  sortDirection: 1,
  page: 1,
  limit: 20
});

// Road Section Loading and Search
export const roadSectionLoadingAtom = atom<boolean>(false);
export const roadSectionSearchInputAtom = atom<string>('');

// === BRIDGE ATOMS ===
// Bridge Data State Atoms
export const bridgeDataAtom = atom<PaginatedBridgeData>({
  lists: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
});

// Bridge Filters Atom
export const bridgeFiltersAtom = atom<BridgePagination>({
  filters: {
    RoadSectionId: '',
    BridgeId: '',
    Name: ''
  },
  sortField: '',
  sortDirection: 1,
  page: 1,
  limit: 20
});

// Bridge Loading and Search
export const bridgeLoadingAtom = atom<boolean>(false);
export const bridgeSearchInputAtom = atom<string>('');

// Bridge Init Data (DEOs)
export const bridgeInitDataAtom = atom<{ DEOs: any[] }>({ DEOs: [] });

// Legacy atoms for backwards compatibility
export const roadsAtom = atom<FutureRoads[]>([]);

// Atom for Future Road Sections
export const roadSectionsAtom = atom<FutureRoadSections[]>([]);

// Atom for Future Bridges
export const bridgesAtom = atom<FutureBridge[]>([]);

// Atom for the currently selected item (used for editing or deleting)
export const selectedItemAtom = atom<FutureRoads | FutureRoadSections | FutureBridge | null>(null);

// Atom for dialog state management
export const dialogStateAtom = atom({
  isRoadDialogOpen: false,
  isRoadSectionDialogOpen: false,
  isBridgeDialogOpen: false,
});

// Derived atoms for counts
export const roadsCountAtom = atom((get) => get(roadDataAtom).total);
export const roadSectionsCountAtom = atom((get) => get(roadSectionDataAtom).total);
export const bridgesCountAtom = atom((get) => get(bridgeDataAtom).total);

// Derived atoms to check if there are active filters
export const hasActiveRoadFiltersAtom = atom((get) => {
  const filters = get(roadFiltersAtom).filters;
  return Boolean(filters?.Name || filters?.RoadId || filters?.Classification);
});

export const hasActiveRoadSectionFiltersAtom = atom((get) => {
  const filters = get(roadSectionFiltersAtom).filters;
  return Boolean(filters?.RoadId || filters?.RoadSectionId || filters?.DEO);
});

export const hasActiveBridgeFiltersAtom = atom((get) => {
  const filters = get(bridgeFiltersAtom).filters;
  return Boolean(filters?.RoadSectionId || filters?.BridgeId || filters?.Name);
});

// Write-only atom for updating road data
export const updateRoadDataAtom = atom(
  null,
  (_get, set, newData: PaginatedRoadData) => {
    set(roadDataAtom, newData);
    // Also update legacy atom for backwards compatibility
    set(roadsAtom, newData.lists);
  }
);

// Write-only atom for updating road filters
export const updateRoadFiltersAtom = atom(
  null,
  (get, set, newFilters: Partial<RoadPagination>) => {
    const currentFilters = get(roadFiltersAtom);
    set(roadFiltersAtom, { ...currentFilters, ...newFilters });
  }
);

// Write-only atom for clearing road filters
export const clearRoadFiltersAtom = atom(
  null,
  (_get, set) => {
    set(roadFiltersAtom, {
      filters: {
        Name: '',
        RoadId: '',
        Classification: ''
      },
      sortField: '',
      sortDirection: 1,
      page: 1,
      limit: 20
    });
    set(roadSearchInputAtom, '');
  }
);

// === ROAD SECTION ACTION ATOMS ===
// Write-only atom for updating road section data
export const updateRoadSectionDataAtom = atom(
  null,
  (_get, set, newData: PaginatedRoadSectionData) => {
    set(roadSectionDataAtom, newData);
    // Also update legacy atom for backwards compatibility
    set(roadSectionsAtom, newData.lists);
  }
);

// Write-only atom for updating road section filters
export const updateRoadSectionFiltersAtom = atom(
  null,
  (get, set, newFilters: Partial<RoadSectionPagination>) => {
    const currentFilters = get(roadSectionFiltersAtom);
    set(roadSectionFiltersAtom, { ...currentFilters, ...newFilters });
  }
);

// Write-only atom for clearing road section filters
export const clearRoadSectionFiltersAtom = atom(
  null,
  (_get, set) => {
    set(roadSectionFiltersAtom, {
      filters: {
        RoadId: '',
        RoadSectionId: '',
        DEO: ''
      },
      sortField: '',
      sortDirection: 1,
      page: 1,
      limit: 20
    });
    set(roadSectionSearchInputAtom, '');
  }
);

// === BRIDGE ACTION ATOMS ===
// Write-only atom for updating bridge data
export const updateBridgeDataAtom = atom(
  null,
  (_get, set, newData: PaginatedBridgeData) => {
    set(bridgeDataAtom, newData);
    // Also update legacy atom for backwards compatibility
    set(bridgesAtom, newData.lists);
  }
);

// Write-only atom for updating bridge filters
export const updateBridgeFiltersAtom = atom(
  null,
  (get, set, newFilters: Partial<BridgePagination>) => {
    const currentFilters = get(bridgeFiltersAtom);
    set(bridgeFiltersAtom, { ...currentFilters, ...newFilters });
  }
);

// Write-only atom for clearing bridge filters
export const clearBridgeFiltersAtom = atom(
  null,
  (_get, set) => {
    set(bridgeFiltersAtom, {
      filters: {
        RoadSectionId: '',
        BridgeId: '',
        Name: ''
      },
      sortField: '',
      sortDirection: 1,
      page: 1,
      limit: 20
    });
    set(bridgeSearchInputAtom, '');
  }
);
