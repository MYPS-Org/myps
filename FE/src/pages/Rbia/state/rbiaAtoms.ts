import { atom } from "jotai";

// Type definitions for RBIA entities
export interface Road {
  roadId: string;
  name: string;
  classification: number;
}

export interface RoadSection {
  roadId: string;
  sectionRoadId: string;
  length: number;
  engineeringDistrict: number;
}

export interface Bridge {
  roadId: string;
  sectionRoadId: string;
  name: string;
  from: number;
  length: number;
  carriageWay: number;
}

// Atom for Future Roads
export const roadsAtom = atom<Road[]>([]);

// Atom for Future Road Sections
export const roadSectionsAtom = atom<RoadSection[]>([]);

// Atom for Future Bridges
export const bridgesAtom = atom<Bridge[]>([]);

// Atom for the currently selected item (used for editing or deleting)
export const selectedItemAtom = atom<Road | RoadSection | Bridge | null>(null);

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
