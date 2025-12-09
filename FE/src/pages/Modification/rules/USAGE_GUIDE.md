# Dynamic Field Permission Usage Guide

## Overview
The field permission system now supports **dynamic validation** based on the actual field values. This means you can restrict field editing based on whether a field is null, zero, or has an existing value.

## Key Features

### 1. **Value-Based Conditions**
Fields can now have conditions that check their current value before allowing edits.

### 2. **Three Validation Methods**

#### Method 1: `canEditFieldBasedOnValue`
Check if a field can be edited based ONLY on its value (ignores case/permissions).

```typescript
import RuleManager from './rules/RuleManager';

const reason = 'Input of missing Planned Start/End Date (only if null or zero)';
const category = 'adjustment';
const fieldName = 'PlannedStartDate';
const currentValue = null; // or undefined, '', 0, etc.

const canEdit = RuleManager.canEditFieldBasedOnValue(
    fieldName, 
    currentValue, 
    category, 
    reason
);

console.log(canEdit); // true if value is null/empty, false otherwise
```

#### Method 2: `isFieldEditableWithValue` (Recommended)
Check if a field is editable considering BOTH permissions AND value conditions.

```typescript
const currentCase = 'CaseA'; // or 'CaseB', 'CaseC'
const reason = 'Input of missing Planned Start/End Date (only if null or zero)';
const category = 'adjustment';

// Example with null value - should be editable
const canEditNull = RuleManager.isFieldEditableWithValue(
    'PlannedStartDate',
    currentCase,
    null, // current field value
    category,
    reason
);

// Example with existing value - should NOT be editable
const canEditExisting = RuleManager.isFieldEditableWithValue(
    'PlannedStartDate',
    currentCase,
    '2024-01-15', // existing date value
    category,
    reason
);

console.log(canEditNull); // true (field is null, can be filled)
console.log(canEditExisting); // false (field has value, cannot be changed)
```

#### Method 3: `getFieldEditStatus`
Get detailed information about why a field is or isn't editable.

```typescript
const status = RuleManager.getFieldEditStatus(
    'PlannedStartDate',
    currentCase,
    '2024-01-15', // current field value
    category,
    reason
);

console.log(status);
// {
//   canEdit: false,
//   reason: 'Field already has a value and cannot be edited per the modification reason'
// }
```

## Practical Example: ComponentCostDialog

Here's how to use it in a component:

```typescript
import React, { useCallback } from 'react';
import RuleManager from '../../rules/RuleManager';

interface ComponentCostDialogProps {
  categoryDesc?: string;
  reasonDesc?: string;
  currentCase: string;
  editingCost?: ComponentCostWithYears;
}

const ComponentCostDialog: React.FC<ComponentCostDialogProps> = ({
  categoryDesc,
  reasonDesc,
  currentCase,
  editingCost
}) => {
  
  // Check if a specific field can be edited
  const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
    return RuleManager.isFieldEditableWithValue(
      fieldName,
      currentCase,
      currentValue,
      categoryDesc,
      reasonDesc
    );
  }, [currentCase, categoryDesc, reasonDesc]);

  // Get edit status with explanation
  const getFieldStatus = useCallback((fieldName: string, currentValue?: any) => {
    return RuleManager.getFieldEditStatus(
      fieldName,
      currentCase,
      currentValue,
      categoryDesc,
      reasonDesc
    );
  }, [currentCase, categoryDesc, reasonDesc]);

  // Example usage in JSX
  return (
    <div>
      <input
        type="date"
        name="StartDate"
        value={editingCost?.CostPerYear?.[0]?.StartDate || ''}
        disabled={!isFieldEditable('StartDate', editingCost?.CostPerYear?.[0]?.StartDate)}
      />
      
      {/* Show helpful message if field is disabled */}
      {(() => {
        const status = getFieldStatus('StartDate', editingCost?.CostPerYear?.[0]?.StartDate);
        if (!status.canEdit) {
          return <p className="text-sm text-gray-500">{status.reason}</p>;
        }
        return null;
      })()}
    </div>
  );
};
```

## Adding New Conditions

To add conditions for a new reason, edit `AdjustmentFields.ts`:

```typescript
const fieldValueConditions: Record<string, Record<string, (value: any) => boolean>> = {
    'Your New Reason': {
        'FieldName': (value) => {
            // Return true if field CAN be edited
            // Return false if field CANNOT be edited
            return value === null || value === undefined || value === '';
        },
        'AnotherField': (value) => {
            // Custom logic - e.g., only edit if value is less than 100
            return value === null || value < 100;
        },
    }
};
```

## Common Validation Patterns

### Pattern 1: Null or Empty Check
```typescript
'FieldName': (value) => value === null || value === undefined || value === ''
```

### Pattern 2: Null or Zero Check
```typescript
'FieldName': (value) => value === null || value === undefined || value === 0 || value === ''
```

### Pattern 3: Always Allow (no restriction)
```typescript
'FieldName': (_value) => true
```

### Pattern 4: Never Allow (always restricted)
```typescript
'FieldName': (_value) => false
```

### Pattern 5: Custom Logic
```typescript
'FieldName': (value) => {
    // Only editable if value is within a specific range
    if (value === null || value === undefined) return true;
    return value >= 0 && value <= 1000;
}
```

## Best Practices

1. **Always provide field value**: When calling validation methods, pass the actual current value of the field
2. **Use `isFieldEditableWithValue`**: This is the most comprehensive check
3. **Show user feedback**: Use `getFieldEditStatus` to display helpful messages
4. **Handle undefined gracefully**: Always check if value is undefined before passing to validators
5. **Test edge cases**: Test with null, undefined, '', 0, and actual values

## Debugging

Enable console logging to debug permission issues:

```typescript
const fieldName = 'PlannedStartDate';
const currentValue = formData.StartDate;

console.log('Field:', fieldName);
console.log('Current Value:', currentValue);
console.log('Current Case:', currentCase);
console.log('Reason:', reasonDesc);

const status = RuleManager.getFieldEditStatus(
    fieldName,
    currentCase,
    currentValue,
    categoryDesc,
    reasonDesc
);

console.log('Edit Status:', status);
```

## Migration Guide

If you're currently using the old `isFieldEditable` method:

### Before:
```typescript
const canEdit = RuleManager.isFieldEditable(fieldName, currentCase, category, reason);
```

### After (with value checking):
```typescript
const canEdit = RuleManager.isFieldEditableWithValue(
    fieldName, 
    currentCase, 
    currentFieldValue, // Add the field's current value
    category, 
    reason
);
```

This maintains backward compatibility while adding dynamic value-based validation.
