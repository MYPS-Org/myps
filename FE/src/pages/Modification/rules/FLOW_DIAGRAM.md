# Dynamic Field Permission Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                                │
│  User attempts to edit a field (e.g., "Planned Start Date")             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT VALIDATION CALL                            │
│  isFieldEditable('StartDate', currentValue)                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      RuleManager.isFieldEditableWithValue()             │
│  Parameters:                                                            │
│  - fieldName: 'StartDate'                                               │
│  - currentCase: 'CaseA' / 'CaseB' / 'CaseC'                             │
│  - currentValue: null or '2024-01-15'                                   │
│  - category: 'adjustment'                                               │
│  - reason: 'Input of missing Planned Start/End Date...'                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
    ┌────────────────────────────┐   ┌────────────────────────────┐
    │  STEP 1: PERMISSION CHECK  │   │  STEP 2: VALUE CHECK       │
    │  (Case + Reason Rules)     │   │  (Field Value Conditions)  │
    └────────────────────────────┘   └────────────────────────────┘
                    │                               │
                    ▼                               ▼
    ┌────────────────────────────┐   ┌────────────────────────────┐
    │ getEditableFieldsForCase() │   │ canEditFieldBasedOnValue() │
    │                            │   │                            │
    │ Checks if 'StartDate' is   │   │ Runs validation function:  │
    │ in allowed fields for:     │   │                            │
    │ - CaseA + Reason           │   │ (value) => value === null  │
    │                            │   │    || value === undefined  │
    │ Returns: true/false        │   │    || value === ''         │
    └────────────────────────────┘   │                            │
                    │                │ Returns: true/false        │
                    │                └────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                    ┌────────────────────────────────┐
                    │    COMBINE RESULTS (AND)       │
                    │                                │
                    │  Permission ✓  AND  Value ✓   │
                    └────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │   Result: TRUE    │           │   Result: FALSE   │
        │                   │           │                   │
        │ Field is editable │           │ Field is disabled │
        └───────────────────┘           └───────────────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │  UI: ENABLED      │           │  UI: DISABLED     │
        │  - Input active   │           │  - Grayed out     │
        │  - Can type/click │           │  - Tooltip shown  │
        └───────────────────┘           └───────────────────┘
```

## Example Scenarios

### Scenario 1: NULL Start Date
```
Input:
  - StartDate value: null
  - Reason: "Input of missing Planned Start/End Date (only if null or zero)"
  - Case: CaseA

Flow:
  1. Permission Check: ✓ (StartDate is in CaseA allowed fields)
  2. Value Check: ✓ (null passes condition)
  3. Result: EDITABLE

UI: Input field is ENABLED
```

### Scenario 2: Existing Start Date
```
Input:
  - StartDate value: "2024-01-15"
  - Reason: "Input of missing Planned Start/End Date (only if null or zero)"
  - Case: CaseA

Flow:
  1. Permission Check: ✓ (StartDate is in CaseA allowed fields)
  2. Value Check: ✗ (date exists, fails condition)
  3. Result: NOT EDITABLE

UI: Input field is DISABLED
Message: "Field already has a value and cannot be edited per the modification reason"
```

### Scenario 3: Field Not in Allowed List
```
Input:
  - Description value: "Some text"
  - Reason: "Input of missing Planned Start/End Date (only if null or zero)"
  - Case: CaseA

Flow:
  1. Permission Check: ✗ (Description not in allowed fields for this reason)
  2. Value Check: (skipped - permission already failed)
  3. Result: NOT EDITABLE

UI: Input field is DISABLED
Message: "Field is not editable for this case/reason combination"
```

## Data Flow Diagram

```
AdjustmentFields.ts
├── reasonSpecificFields (Permission Rules)
│   └── "Reason" → ['Field1', 'Field2', ...]
│
└── fieldValueConditions (Value Validation Rules)
    └── "Reason" → { 
          'Field1': (value) => boolean,
          'Field2': (value) => boolean 
        }

                    ↓
                    
RuleManager.ts (Orchestrator)
├── isFieldEditableWithValue()
│   ├── Calls: getEditableFieldsForCase()
│   └── Calls: canEditFieldBasedOnValue()
│
└── getFieldEditStatus()
    └── Returns: { canEdit: boolean, reason: string }

                    ↓
                    
ComponentCostDialog.tsx (Consumer)
├── isFieldEditable() callback
└── Applied to <input disabled={...} />
```

## Configuration Example

```typescript
// In AdjustmentFields.ts

// 1. Define which fields are allowed for each reason (Permission)
reasonSpecificFields: {
    'Input of missing Planned Start/End Date (only if null or zero)': [
        'PlannedStartDate',  // ← These fields are allowed
        'PlannedEndDate'     //   for this reason
    ]
}

// 2. Define when those fields can be edited (Value Condition)
fieldValueConditions: {
    'Input of missing Planned Start/End Date (only if null or zero)': {
        'PlannedStartDate': (value) => value === null || value === '',  // ← Only if null
        'PlannedEndDate': (value) => value === null || value === ''     //   or empty
    }
}
```

## Decision Tree

```
Is field editable?
│
├─ Is field in reasonSpecificFields[reason]?
│  ├─ NO → ❌ Not editable (Permission denied)
│  └─ YES → Continue to value check
│      │
│      ├─ Does reason have value conditions?
│      │  ├─ NO → ✅ Editable (Permission granted, no value restrictions)
│      │  └─ YES → Does field pass value condition?
│      │      ├─ NO → ❌ Not editable (Value condition failed)
│      │      └─ YES → ✅ Editable (Both permission and value condition passed)
```

## Summary

**Two-Layer Validation:**
1. **Permission Layer**: Is the field allowed to be edited for this case/reason?
2. **Value Layer**: Does the current field value meet the condition for editing?

**Both must pass** for the field to be editable.
