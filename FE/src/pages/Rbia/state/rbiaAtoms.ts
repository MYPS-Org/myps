import { atom } from "jotai";

// Import the types from Model.d.ts
import type { FutureRoads, FutureRoadSections, FutureBridge } from "../Model.d";

// Type aliases for compatibility
export type Road = FutureRoads;
export type RoadSection = FutureRoadSections;
export type Bridge = FutureBridge;

// Atom for Future Roads
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
export const roadsCountAtom = atom((get) => get(roadsAtom).length);
export const roadSectionsCountAtom = atom((get) => get(roadSectionsAtom).length);
export const bridgesCountAtom = atom((get) => get(bridgesAtom).length);
