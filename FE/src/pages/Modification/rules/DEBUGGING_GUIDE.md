# Debugging Dynamic Field Permissions

## Issue: "No fields are currently editable"

If you're seeing "No fields are currently editable" when you expect fields to be editable, follow these debugging steps:

## Step 1: Check fieldPermissions Object

Open your browser's developer console and look for the `fieldPermissions` object. You should see something like:

```javascript
{
  pcmaStatus: "Not yet started",
  packageStatus: "not packaged",
  case: "CaseA",
  category: "adjustment",
  reason: "Input of missing Planned Start/End Date (only if null or zero)",
  editableFields: ["ComponentCost", "StartDate", "EndDate", ...]
}
```

**Key things to check:**
- Is `case` set correctly? (Should be "CaseA", "CaseB", or "CaseC")
- Is `editableFields` array populated?
- Does `editableFields` include the fields you expect?

## Step 2: Verify Props are Passed to ComponentCostDialog

Add this console.log in `ComponentCostDialog.tsx`:

```typescript
useEffect(() => {
  console.log('ComponentCostDialog Props:', {
    categoryDesc,
    reasonDesc,
    currentCase,
    pcmaStatus,
    packageStatus,
    determinedCase
  });
}, [categoryDesc, reasonDesc, currentCase, pcmaStatus, packageStatus]);
```

**Expected output:**
```javascript
{
  categoryDesc: "adjustment",
  reasonDesc: "Input of missing Planned Start/End Date (only if null or zero)",
  currentCase: "CaseA",
  pcmaStatus: "Not yet started",
  packageStatus: "not packaged",
  determinedCase: "CaseA"
}
```

## Step 3: Check Field Validation

Add this to test a specific field:

```typescript
useEffect(() => {
  const startDateEditable = isFieldEditable('StartDate', formData.StartDate);
  const endDateEditable = isFieldEditable('EndDate', formData.EndDate);
  
  console.log('Field Editability:', {
    StartDate: {
      value: formData.StartDate,
      editable: startDateEditable
    },
    EndDate: {
      value: formData.EndDate,
      editable: endDateEditable
    }
  });
}, [formData.StartDate, formData.EndDate, isFieldEditable]);
```

## Step 4: Test RuleManager Directly

In the browser console:

```javascript
// Import the RuleManager (if available in window/global scope)
// Or add this temporarily to your component:

const testCase = 'CaseA';
const testReason = 'Input of missing Planned Start/End Date (only if null or zero)';
const testCategory = 'adjustment';

// Check what fields should be editable
const editableFields = RuleManager.getEditableFieldsForCase(testCase, testCategory, testReason);
console.log('Editable fields for Case A with reason:', editableFields);

// Check if StartDate is editable
const canEditStartDate = RuleManager.isFieldEditableWithValue(
  'StartDate',
  testCase,
  null, // null value
  testCategory,
  testReason
);
console.log('Can edit StartDate (null):', canEditStartDate);

// Check if StartDate is editable with existing value
const canEditStartDateWithValue = RuleManager.isFieldEditableWithValue(
  'StartDate',
  testCase,
  '2024-01-15', // existing value
  testCategory,
  testReason
);
console.log('Can edit StartDate (existing):', canEditStartDateWithValue);
```

## Step 5: Check Reason-Specific Fields Configuration

In `AdjustmentFields.ts`, verify the reason configuration:

```typescript
'Input of missing Planned Start/End Date (only if null or zero)': [
    'ComponentCost',    // ← Should be here!
    'PlannedStartDate',
    'PlannedEndDate',
    'StartDate',        // ← Should be here!
    'EndDate'          // ← Should be here!
]
```

## Step 6: Common Issues and Solutions

### Issue: Fields show as not editable even in Case A

**Cause:** Reason filtering is removing the fields

**Solution:** Add the field names to the reason-specific fields in `AdjustmentFields.ts`

### Issue: Props are undefined in ComponentCostDialog

**Cause:** Props not being passed through ComponentCostForm

**Solution:** Check that ProjectForm passes to ComponentCostForm:
```typescript
<ComponentCostForm
  currentCase={fieldPermissions?.case}
  pcmaStatus={fieldPermissions?.pcmaStatus}
  packageStatus={fieldPermissions?.packageStatus}
  // ... other props
/>
```

And ComponentCostForm passes to ComponentCostDialog:
```typescript
<ComponentCostDialog
  currentCase={currentCase}
  pcmaStatus={pcmaStatus}
  packageStatus={packageStatus}
  // ... other props
/>
```

### Issue: StartDate/EndDate fields are disabled

**Cause:** Value condition failing - field might have a value

**Solution:** 
- Check if the field already has a value
- If it has a value, it's working correctly (can't edit existing dates for this reason)
- If it's null/empty and still disabled, check the field value condition in `fieldValueConditions`

## Step 7: Enable Debug Logging

Add this to `ComponentCostDialog.tsx` to see detailed validation:

```typescript
const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
    if (!categoryDesc || !reasonDesc) {
      console.log(`[${fieldName}] No restrictions - no category/reason`);
      return true;
    }
    
    const result = RuleManager.isFieldEditableWithValue(
      fieldName,
      determinedCase,
      currentValue,
      categoryDesc,
      reasonDesc
    );
    
    const status = RuleManager.getFieldEditStatus(
      fieldName,
      determinedCase,
      currentValue,
      categoryDesc,
      reasonDesc
    );
    
    console.log(`[${fieldName}] Editable: ${result}`, {
      currentValue,
      determinedCase,
      categoryDesc,
      reasonDesc,
      status
    });
    
    return result;
  }, [determinedCase, categoryDesc, reasonDesc]);
```

## Expected Behavior

### Scenario 1: Case A + "Input of missing Planned Start/End Date"
- **Component Cost:** Button should be enabled (can add/edit)
- **Start Date (null):** Should be editable
- **End Date (null):** Should be editable  
- **Start Date (has value):** Should be disabled
- **End Date (has value):** Should be disabled
- **Cost Amount:** Should NOT be editable (not in reason fields)
- **Description:** Should NOT be editable (not in reason fields)

### Scenario 2: Case A without specific reason
- **All fields:** Should be editable

### Scenario 3: Case B + any reason
- **Only specific fields:** Based on Case B intersection with reason

### Scenario 4: Case C
- **No fields:** Should be editable

## Quick Test Checklist

- [ ] fieldPermissions object exists and has `case` property
- [ ] currentCase prop is passed to ComponentCostDialog
- [ ] Reason text matches exactly in reasonSpecificFields
- [ ] Field names match exactly (case-sensitive)
- [ ] StartDate/EndDate are in the reason-specific fields array
- [ ] ComponentCost is in the reason-specific fields array
- [ ] Value conditions are checking for null/undefined/empty correctly
