# Excess Component Automation

## Overview
This module handles the logic for detecting when project cost is greater than total component cost and triggers the creation of an "EXC" (Excess) component for intentional project cost reductions.

## Applicable Categories
The excess component checking applies to the following modification categories:
- **Adjustment**
- **Change in Authority to Implement**
- **For Savings - Partial Unutilized Balance**
- **Non Implementable** (all types)
- **Termination**

## Workflow

### 1. Detection
When a user attempts to add a component cost in any of the applicable categories, the system checks:
- Is the **Project Cost** > **Total Component Cost** (after adding the new component)?

### 2. Warning Prompt
If the condition is met, a warning dialog (`ExcessPrompt`) is displayed with:
- Project Cost amount
- Total Component Cost amount
- Excess Amount (difference)
- Two options:
  - **OK**: Creates an "EXC" component with the excess amount
  - **Cancel**: Exits without creating the component

### 3. EXC Component Creation
If the user selects **OK**, the system automatically creates a new component with:
- **ComponentType**: `EXC`
- **ComponentId**: `EXC-{timestamp}`
- **Description**: "Excess - Intentional Project Cost Reduction"
- **Total**: The excess amount

## Usage Example

```typescript
import { checkExcessComponent } from './ExcessComponentAutomation';

const category = 'Adjustment';
const projectCost = 1000000;
const totalComponentCost = 800000;

const result = checkExcessComponent(category, projectCost, totalComponentCost);

if (result && result.shouldPrompt) {
  // Show ExcessPrompt dialog
  console.log(result.message);
  console.log(`Excess amount: ${result.excessAmount}`);
}
```

## Files

### `ExcessComponentAutomation.ts`
Contains utility functions for:
- Category validation
- Excess amount calculation
- Warning message generation
- Main checking logic

### `ExcessPrompt.tsx`
React component that displays the warning dialog and handles user interaction.

## Integration Points

### ProjectForm.tsx
The main integration point is in the `handleAddComponentCost` function:
1. Before adding a component, check if excess component prompt is needed
2. If needed, show the `ExcessPrompt` dialog
3. Handle user response (OK or Cancel)
4. If OK, create the EXC component automatically

## Testing

To test this functionality:
1. Navigate to a project modification with one of the applicable categories
2. Ensure the Project Cost is set (e.g., ₱1,000,000)
3. Add component costs that total less than the project cost (e.g., ₱800,000)
4. Try to add another component
5. Verify that the excess prompt appears
6. Test both OK and Cancel actions

## Notes
- The EXC component is created automatically and can be edited or deleted like any other component
- The excess amount is calculated as: `Project Cost - Total Component Cost`
- Category matching is case-insensitive and ignores spaces/special characters
