import { atom } from 'jotai';
import type {
  ComponentCost
} from '../../Project/Model';

/**
 * Source atom for component costs
 */
export const componentCostsAtom = atom<ComponentCost[]>([]);
