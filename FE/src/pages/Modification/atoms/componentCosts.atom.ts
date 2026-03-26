import { atom } from 'jotai';
import type {
  ComponentCost,
  ComponentCostPerYear
} from '../../Project/Model';

/**
 * Source atom for component costs
 */
export const componentCostsAtom = atom<ComponentCost[]>([]);

/**
 * Source atom for component cost per year
 */
export const componentCostPerYearAtom = atom<ComponentCostPerYear[]>([]);
