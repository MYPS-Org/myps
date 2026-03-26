/**
 * USAGE EXAMPLES
 * 
 * This file demonstrates how to use the ExcessComponentAutomation utilities
 */

import { 
  checkExcessComponent, 
  shouldCheckExcessComponent,
  formatCurrency 
} from './ExcessComponentAutomation';

// =====================================================================
// Example 1: Check if a category requires excess component validation
// =====================================================================
const category1 = 'Adjustment';
const shouldCheck1 = shouldCheckExcessComponent(category1);
console.log(`Should check ${category1}:`, shouldCheck1); // true

const category2 = 'Regular Modification';
const shouldCheck2 = shouldCheckExcessComponent(category2);
console.log(`Should check ${category2}:`, shouldCheck2); // false

// =====================================================================
// Example 2: Format currency values
// =====================================================================
const amount = 1234567.89;
const formatted = formatCurrency(amount);
console.log('Formatted:', formatted); // ₱1,234,567.89

// =====================================================================
// Example 3: Main validation check
// =====================================================================
const projectCost = 1000000;
const totalComponentCost = 750000;
const category = 'Adjustment';

const result = checkExcessComponent(category, projectCost, totalComponentCost);

if (result && result.shouldPrompt) {
  console.log('Excess detected!');
  console.log('Message:', result.message);
  console.log('Excess Amount:', result.excessAmount);
  // Show ExcessPrompt dialog here
} else {
  console.log('No excess detected or category not applicable');
}

// =====================================================================
// Example 4: Test different scenarios
// =====================================================================

// Scenario A: Excess exists, applicable category
const scenarioA = checkExcessComponent('Adjustment', 1000000, 800000);
console.log('Scenario A (Should prompt):', scenarioA);
// Output: { shouldPrompt: true, excessAmount: 200000, message: "..." }

// Scenario B: No excess, applicable category
const scenarioB = checkExcessComponent('Adjustment', 1000000, 1200000);
console.log('Scenario B (Should not prompt):', scenarioB);
// Output: null

// Scenario C: Excess exists, non-applicable category
const scenarioC = checkExcessComponent('Regular', 1000000, 800000);
console.log('Scenario C (Should not prompt):', scenarioC);
// Output: null

// Scenario D: Equal costs
const scenarioD = checkExcessComponent('Termination', 1000000, 1000000);
console.log('Scenario D (Should not prompt):', scenarioD);
// Output: null

// =====================================================================
// Example 5: Integration with React Component
// =====================================================================

/*
import React, { useState } from 'react';
import { checkExcessComponent } from './ExcessComponentAutomation';
import ExcessPrompt from '../dialogs/ExcessPrompt';

const MyComponent = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [excessData, setExcessData] = useState(null);
  
  const handleAddComponent = (newComponent) => {
    const projectCost = 1000000;
    const currentTotal = 750000;
    const newTotal = currentTotal + newComponent.cost;
    const category = 'Adjustment';
    
    const check = checkExcessComponent(category, projectCost, newTotal);
    
    if (check && check.shouldPrompt) {
      setExcessData({
        projectCost,
        totalComponentCost: newTotal,
        excessAmount: check.excessAmount
      });
      setShowPrompt(true);
    } else {
      // Add component normally
      addComponentToState(newComponent);
    }
  };
  
  const handleConfirm = () => {
    // Create EXC component
    const excComponent = {
      ComponentType: 'EXC',
      ComponentId: `EXC-${Date.now()}`,
      Description: 'Excess - Intentional Project Cost Reduction',
      Total: excessData.excessAmount
    };
    addComponentToState(excComponent);
    setShowPrompt(false);
  };
  
  const handleCancel = () => {
    setShowPrompt(false);
  };
  
  return (
    <>
      <button onClick={handleAddComponent}>Add Component</button>
      
      {showPrompt && excessData && (
        <ExcessPrompt
          isOpen={showPrompt}
          onClose={() => setShowPrompt(false)}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          projectCost={excessData.projectCost}
          totalComponentCost={excessData.totalComponentCost}
          excessAmount={excessData.excessAmount}
        />
      )}
    </>
  );
};
*/

// =====================================================================
// Example 6: Test all applicable categories
// =====================================================================
const testCategories = [
  'Adjustment',
  'Change in Authority to Implement',
  'For Savings - Partial Unutilized Balance',
  'Non Implementable',
  'Termination'
];

testCategories.forEach(cat => {
  const shouldCheck = shouldCheckExcessComponent(cat);
  console.log(`${cat}: ${shouldCheck ? '✓ Will check' : '✗ Will not check'}`);
});

// =====================================================================
// Example 7: Edge cases
// =====================================================================

// Zero project cost
const edge1 = checkExcessComponent('Adjustment', 0, 100000);
console.log('Zero project cost:', edge1); // null (no excess)

// Negative numbers (shouldn't happen but good to test)
const edge2 = checkExcessComponent('Adjustment', -1000, 500);
console.log('Negative project cost:', edge2); // null

// Very large numbers
const edge3 = checkExcessComponent('Adjustment', 999999999999, 1000000);
console.log('Large excess:', edge3?.excessAmount); // 998999999999

// Category with special characters and spaces
const edge4 = shouldCheckExcessComponent('For Savings - Partial Unutilized Balance!!!');
console.log('Special characters in category:', edge4); // true (normalized)
