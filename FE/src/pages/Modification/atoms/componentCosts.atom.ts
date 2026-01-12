import { atom } from 'jotai';
import type {
  ComponentCost,
  ComponentCostYear
} from '../../Project/Model';

/**
 * Source atoms (pure state)
 */
export const componentCostsAtom = atom<ComponentCost[]>([]);
export const componentCostsYearAtom = atom<ComponentCostYear[]>([]);

/**
 * Derived atom (read-only, safe)
 * Combines costs with their yearly breakdown
 */
export const componentCostsWithYearsAtom = atom(get => {
  const costs = get(componentCostsAtom);
  const years = get(componentCostsYearAtom);

  return costs.map(cost => ({
    ...cost,
    CostPerYear: years.filter(
      y => String(y.ParentId) === String(cost.ReferenceId)
    )
  }));
});
