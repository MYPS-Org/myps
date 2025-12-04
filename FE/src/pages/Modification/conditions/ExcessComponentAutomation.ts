/**
 * ExcessComponentAutomation.ts
 * 
 * This module handles the logic for detecting when project cost is greater than 
 * total component cost and determines if an EXC (Excess) component should be created.
 * 
 * Applicable for: Adjustment, Change in Authority to Implement, For Savings - Partial Unutilized Balance,
 * Non Implementable (all types), Termination
 */

/**
 * Categories and reasons that require excess component checking
 */
const APPLICABLE_CATEGORIES = [
  'adjustment',
  'changeinauthoritytoimplement',
  'forsavingspartialunutilizedbalance',
  'nonimplementable',
  'termination'
];

/**
 * Normalizes a string by removing spaces, special characters, and converting to lowercase
 */
const normalizeString = (str: string | undefined): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
};

/**
 * Checks if the given category requires excess component validation
 */
export const shouldCheckExcessComponent = (category: string | undefined): boolean => {
  if (!category) return false;
  const normalized = normalizeString(category);
  return APPLICABLE_CATEGORIES.includes(normalized);
};

/**
 * Calculates the difference between project cost and total component cost
 */
export const calculateExcessAmount = (
  projectCost: number,
  totalComponentCost: number
): number => {
  return projectCost - totalComponentCost;
};

/**
 * Checks if there's an excess (project cost > total component cost)
 */
export const hasExcessAmount = (
  projectCost: number,
  totalComponentCost: number
): boolean => {
  return projectCost > totalComponentCost;
};

/**
 * Formats currency for display
 */
export const formatCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Creates the warning message for excess component
 */
export const createExcessWarningMessage = (
  projectCost: number,
  totalComponentCost: number
): string => {
  return `The Project Cost (${formatCurrency(projectCost)}) is greater than the Total Project Component Cost (${formatCurrency(totalComponentCost)}). Is this an intentional reduction of Project Cost?`;
};

/**
 * Main function to check if excess component prompt should be shown
 * Returns null if no check needed, or an object with excess details if check is needed
 */
export const checkExcessComponent = (
  category: string | undefined,
  projectCost: number,
  totalComponentCost: number
): { shouldPrompt: boolean; excessAmount: number; message: string } | null => {
  // Check if this category requires excess component checking
  if (!shouldCheckExcessComponent(category)) {
    return null;
  }

  // Check if there's an excess amount
  if (!hasExcessAmount(projectCost, totalComponentCost)) {
    return null;
  }

  const excessAmount = calculateExcessAmount(projectCost, totalComponentCost);
  const message = createExcessWarningMessage(projectCost, totalComponentCost);

  return {
    shouldPrompt: true,
    excessAmount,
    message
  };
};

export default {
  shouldCheckExcessComponent,
  calculateExcessAmount,
  hasExcessAmount,
  formatCurrency,
  createExcessWarningMessage,
  checkExcessComponent
};
