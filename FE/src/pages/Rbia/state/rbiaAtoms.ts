import { atom } from "jotai";

// Import the types from Model.d.ts
import type { FutureRoad, FutureRoadSection, FutureBridge } from "../Model";

// Type aliases for compatibility
export type Road = FutureRoad;
export type RoadSection = FutureRoadSection;
export type Bridge = FutureBridge;

// Atom for Future Roads
export const roadsAtom = atom<FutureRoad[]>([]);

// Atom for Future Road Sections
export const roadSectionsAtom = atom<FutureRoadSection[]>([]);

// Atom for Future Bridges
export const bridgesAtom = atom<FutureBridge[]>([]);

// Atom for the currently selected item (used for editing or deleting)
export const selectedItemAtom = atom<FutureRoad | FutureRoadSection | FutureBridge | null>(null);

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
