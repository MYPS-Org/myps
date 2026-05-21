/**
 * TerminationNoDisbursementAutomation.ts
 * 
 * This module handles the automation for Termination - No Disbursement (reasonId === 37).
 * When this reason is selected:
 * 1. Check all components to see if their ConstructionStatus is 'terminated'
 * 2. Set the amount of terminated components to 0
 * 3. Create an EXC (Excess) component equal to the sum of all terminated component amounts
 */

import type { ComponentCost } from '../../Project/Model';
import addExcessComponent from './AddExcessComponent';

const TERMINATION_NO_DISBURSEMENT_REASON_ID = 37;

/**
 * Checks if the given reason ID is for Termination - No Disbursement
 */
export const isTerminationNoDisbursement = (reasonId: number | undefined): boolean => {
  return reasonId === TERMINATION_NO_DISBURSEMENT_REASON_ID;
};

/**
 * Checks if a component's construction status is 'terminated'
 */
export const isComponentTerminated = (component: ComponentCost): boolean => {
  const status = component.ConstructionStatusName?.toLowerCase().trim();
  return status === 'terminated';
};

/**
 * Processes components for Termination - No Disbursement:
 * - Sets terminated component amounts to 0
 * - Returns the sum of original amounts that were set to 0
 */
export const processTerminatedComponents = (
  components: ComponentCost[]
): { 
  updatedComponents: ComponentCost[];
  totalTerminatedAmount: number;
  terminatedComponents: ComponentCost[];
} => {
  let totalTerminatedAmount = 0;
  const terminatedComponents: ComponentCost[] = [];
  
  const updatedComponents = components.map(component => {
    if (!component.IsDeleted && isComponentTerminated(component)) {
      const originalAmount = component.Total || 0;
      totalTerminatedAmount += originalAmount;
      terminatedComponents.push(component);
      
      return {
        ...component,
        Total: 0
      };
    }
    return component;
  });

  return {
    updatedComponents,
    totalTerminatedAmount,
    terminatedComponents
  };
};

/**
 * Creates an excess component from terminated component amounts
 */
export const createExcessFromTerminated = (
  totalAmount: number,
  projectId: string,
  stageName: string,
  createdBy?: string
): ComponentCost | null => {
  if (totalAmount <= 0) {
    return null;
  }

  return addExcessComponent({
    projectId,
    stageName,
    amount: totalAmount,
    description: 'Excess from Terminated Components',
    createdBy
  });
};

/**
 * Main function to handle Termination - No Disbursement automation
 * Returns updated components and the excess component if applicable
 */
export const applyTerminationNoDisbursementAutomation = (
  reasonId: number | undefined,
  components: ComponentCost[],
  projectId: string,
  stageName: string,
  createdBy?: string
): {
  shouldApply: boolean;
  updatedComponents: ComponentCost[];
  excessComponent: ComponentCost | null;
  totalTerminatedAmount: number;
  terminatedCount: number;
} => {
  // Check if this automation should apply
  if (!isTerminationNoDisbursement(reasonId)) {
    return {
      shouldApply: false,
      updatedComponents: components,
      excessComponent: null,
      totalTerminatedAmount: 0,
      terminatedCount: 0
    };
  }

  // Process terminated components
  const { 
    updatedComponents, 
    totalTerminatedAmount,
    terminatedComponents 
  } = processTerminatedComponents(components);

  // Create excess component if there are terminated amounts
  const excessComponent = createExcessFromTerminated(
    totalTerminatedAmount,
    projectId,
    stageName,
    createdBy
  );

  return {
    shouldApply: true,
    updatedComponents,
    excessComponent,
    totalTerminatedAmount,
    terminatedCount: terminatedComponents.length
  };
};

export default {
  isTerminationNoDisbursement,
  isComponentTerminated,
  processTerminatedComponents,
  createExcessFromTerminated,
  applyTerminationNoDisbursementAutomation
};
