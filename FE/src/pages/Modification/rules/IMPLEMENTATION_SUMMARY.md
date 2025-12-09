# Dynamic Field Permission System - Implementation Summary

## What Was Implemented

### 1. **Value-Based Field Conditions** (`AdjustmentFields.ts`)

Added a new `fieldValueConditions` configuration object that defines validation rules based on field values:

```typescript
const fieldValueConditions: Record<string, Record<string, (value: any) => boolean>> = {
    'Input of missing Planned Start/End Date (only if null or zero)': {
        'PlannedStartDate': (value) => value === null || value === undefined || value === '',
        'PlannedEndDate': (value) => value === null || value === undefined || value === '',
        'StartDate': (value) => value === null || value === undefined || value === '',
        'EndDate': (value) => value === null || value === undefined || value === '',
    }
};
```

### 2. **New Helper Functions** (`AdjustmentFields.ts`)

Three new functions were added:

#### `canEditFieldBasedOnValue(fieldName, currentValue, reason)`
- Checks if a field can be edited based ONLY on its current value
- Ignores case/permission rules
- Returns `true` if value meets the condition for editing

#### `isFieldEditableWithValue(fieldName, currentCase, fieldValue, reason)`
- Comprehensive check considering BOTH permissions AND value conditions
- First checks if field is in editable list for case/reason
- Then validates value-based conditions
- **This is the recommended method to use**

#### `getFieldEditStatus(fieldName, currentCase, fieldValue, reason)`
- Returns detailed information about field editability
- Provides a human-readable reason why field is/isn't editable
- Useful for displaying tooltips and help text

### 3. **RuleManager Integration** (`RuleManager.ts`)

Added three new static methods to expose the functionality:

```typescript
RuleManager.canEditFieldBasedOnValue(fieldName, currentValue, category, reason)
RuleManager.isFieldEditableWithValue(fieldName, currentCase, fieldValue, category, reason)
RuleManager.getFieldEditStatus(fieldName, currentCase, fieldValue, category, reason)
```

### 4. **ComponentCostDialog Implementation** (`ComponentCostDialog.tsx`)

Updated the dialog to demonstrate usage:

- Added `currentCase`, `pcmaStatus`, `packageStatus` props
- Implemented `isFieldEditable` and `getFieldEditStatus` callbacks
- Applied dynamic validation to StartDate and EndDate fields
- Added visual feedback (disabled state, tooltips, status messages)

## How It Works

### Example Scenario: "Input of missing Planned Start/End Date (only if null or zero)"

**Case 1: Field is NULL/Empty**
```typescript
const startDate = null;
const canEdit = RuleManager.isFieldEditableWithValue(
    'StartDate', 'CaseA', startDate, 'adjustment', 
    'Input of missing Planned Start/End Date (only if null or zero)'
);
// Result: true (field is null, can be filled)
```

**Case 2: Field has a value**
```typescript
const startDate = '2024-01-15';
const canEdit = RuleManager.isFieldEditableWithValue(
    'StartDate', 'CaseA', startDate, 'adjustment',
    'Input of missing Planned Start/End Date (only if null or zero)'
);
// Result: false (field already has value, cannot be changed)
```

## Integration Steps

### Step 1: Pass Props to Dialog/Component
```typescript
<ComponentCostDialog
    categoryDesc={modificationCategory}
    reasonDesc={modificationReason}
    currentCase={currentCase}
    pcmaStatus={pcmaStatus}
    packageStatus={packageStatus}
    // ... other props
/>
```

### Step 2: Setup Validation in Component
```typescript
const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
    return RuleManager.isFieldEditableWithValue(
        fieldName,
        currentCase,
        currentValue,
        categoryDesc,
        reasonDesc
    );
}, [currentCase, categoryDesc, reasonDesc]);
```

### Step 3: Apply to Form Fields
```typescript
<input
    type="date"
    value={formData.StartDate}
    disabled={!isFieldEditable('StartDate', formData.StartDate)}
/>
```

## Benefits

1. **Dynamic Validation**: Fields are validated based on their actual values, not just static rules
2. **Flexible**: Easy to add new conditions for different reasons
3. **User-Friendly**: Provides clear feedback about why fields are disabled
4. **Maintainable**: Centralized logic in one place
5. **Type-Safe**: Full TypeScript support
6. **Backward Compatible**: Existing code continues to work

## Adding New Conditions

To add conditions for a new reason:

```typescript
// In AdjustmentFields.ts
const fieldValueConditions: Record<string, Record<string, (value: any) => boolean>> = {
    'Your New Reason': {
        'FieldName': (value) => {
            // Return true if field CAN be edited
            return value === null || value === undefined;
        }
    }
};
```

## Common Patterns

### Null/Empty Check
```typescript
'FieldName': (value) => value === null || value === undefined || value === ''
```

### Null/Zero Check
```typescript
'FieldName': (value) => value === null || value === undefined || value === 0 || value === ''
```

### Range Check
```typescript
'FieldName': (value) => {
    if (value === null || value === undefined) return true;
    return value >= 0 && value <= 1000;
}
```

### Always Allow
```typescript
'FieldName': (_value) => true
```

## Files Modified

1. `AdjustmentFields.ts` - Added value conditions and helper functions
2. `RuleManager.ts` - Added static methods to expose functionality
3. `ComponentCostDialog.tsx` - Demonstrated implementation
4. `USAGE_GUIDE.md` - Created comprehensive documentation
5. `EXAMPLE_USAGE.tsx` - Created example implementations

## Testing

To test the implementation:

1. Set reason to "Input of missing Planned Start/End Date (only if null or zero)"
2. Open ComponentCostDialog in edit mode
3. If StartDate is null/empty → field should be editable
4. If StartDate has a value → field should be disabled with explanation

## Future Enhancements

Potential improvements:
- Add support for complex multi-field validations
- Implement field-level warnings (not just enable/disable)
- Add validation for field relationships
- Support async validation (e.g., API checks)
- Add validation history/audit trail
