import { atom } from 'jotai';
import type { 
    MajorItemLocations
 } from '../../Project/Model.d';

 /**
  * Source atom for Major Item Locations
  */
 export const MajorItemLocationsAtom = atom<MajorItemLocations[]>([]);