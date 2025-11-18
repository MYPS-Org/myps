# Adjustment Category - Dynamic Field Rules Guide

## Overview

The Adjustment category now supports **reason-specific field rules** that work within the existing case-based system. This creates a two-tier filtering system:

1. **Case-based rules** (Case A, B, or C) - determined by PCMA status and Package status
2. **Reason-specific rules** - further refines which fields are editable based on the specific reason

## How It Works

### Flow Diagram
```
Category: Adjustment
    ↓
Determine Case (A, B, or C) based on PCMA + Package Status
    ↓
Get Base Editable Fields for the Case
    ↓
Apply Reason Filter (if reason provided)
    ↓
Final Editable Fields = Intersection of Case Fields AND Reason Fields
```

### Case Rules (First Level)

**Case A** - Not yet started AND not packaged
- **Most Permissive**: All project detail, funding, component, major item, and physical target fields are editable

**Case B** - (Not yet started OR On-going) AND packaged
- **Moderately Restrictive**: Only Description, EmergencyMode, Origin, Agency, FundingProfile, ComponentCostEdit, WorkLocationEdit

**Case C** - Completed OR Terminated
- **Most Restrictive**: No fields are editable

### Reason Rules (Second Level)

When a reason is provided, it further restricts the fields allowed by the case. Only fields that are:
- Allowed by the Case **AND**
- Allowed by the Reason

will be editable.

## Reason-Specific Field Rules

### 1. "Correction of MYPS typographical error for consistency with GAA"
**Allowed Fields:**
- `Description` only

**Use Case:** Minor typo corrections in project description to match GAA

**Example:**
```typescript
// Case A with this reason
Case A allows: All fields
Reason allows: Description only
Final editable: Description only

// Case B with this reason
Case B allows: Description, EmergencyMode, Origin, etc.
Reason allows: Description only
Final editable: Description only
```

---

### 2. "Correction of MYPS for null or zero targets"
**Allowed Fields:**
- `PhysicalTarget`
- `WorkLocation`
- `WorkLocationEdit`
- `TargetUnit`

**Use Case:** Fixing missing or zero target values

---

### 3. "Move funds between existing Project Components"
**Allowed Fields:**
- `ComponentCost`

**Use Case:** Reallocating budget between components without changing descriptions

---

### 4. "Input of missing Location, Work Location data (if null or zero)"
**Allowed Fields:**
- `City`
- `LegislativeDistrict`
- `WorkLocation`
- `WorkLocationAdd`
- `PhysicalTarget`

**Use Case:** Adding location data that was missing in the original entry

---

### 5. "Input of missing Planned Start/End Date (only if null or zero)"
**Allowed Fields:**
- `PlannedStartDate`
- `PlannedEndDate`

**Use Case:** Adding missing date information

---

### 6. "Excess Amount due to Revised Estimate"
**Allowed Fields:**
- `ComponentCost`
- `ComponentDescription`

**Use Case:** Adjusting component costs and descriptions due to revised estimates

---

### 7. "New Component needed - movement of funds also required"
**Allowed Fields:**
- `ComponentCost`
- `ComponentDescription`
- `ComponentAdd`
- `ComponentDelete`

**Use Case:** Adding new components and redistributing funds

---

## Implementation in Code

### In AdjustProject.tsx
```typescript
const AdjustProject: React.FC = () => {
    const location = useLocation();
    
    // Get category and reason from navigation state
    const categoryDesc = location.state?.categoryDesc || 'adjustment';
    const reasonDesc = location.state?.reasonDesc || '';

    return (
        <ProjectForm
            initialData={initialData}
            mode="edit"
            category={categoryDesc}
            reason={reasonDesc}  // Pass reason to ProjectForm
        />
    );
};
```

### In ProjectForm.tsx
```typescript
useEffect(() => {
    if (pcmaStatus && packageStatus) {
      const currentCase = RuleManager.determineCase(pcmaStatus, packageStatus, category);
      const editableFields = RuleManager.getEditableFieldsForCase(currentCase, category, reason);
      setFieldPermissions({
          pcmaStatus,
          packageStatus,
          case: currentCase,
          category: category || 'modification',
          reason: reason,  // Include reason in field permissions
          editableFields
      });
    }
}, [pcmaStatus, packageStatus, category, reason]);
```

### Using RuleManager
```typescript
// Check if a field is editable
const isEditable = RuleManager.isFieldEditable(
    'Description', 
    'CaseA', 
    'adjustment',
    'Correction of MYPS typographical error for consistency with GAA'
);
// Returns: true (Description is allowed by both Case A and the reason)

// Get all editable fields for Case A with a specific reason
const fields = RuleManager.getEditableFieldsForCase(
    'CaseA',
    'adjustment',
    'Correction of MYPS typographical error for consistency with GAA'
);
// Returns: ['Description']

// Get available reasons for adjustment category
const reasons = RuleManager.getAvailableReasons('adjustment');
// Returns: Array of all reason strings with specific rules

// Get fields for a specific reason (independent of case)
const reasonFields = RuleManager.getFieldsForReason(
    'Move funds between existing Project Components',
    'adjustment'
);
// Returns: ['ComponentCost']
```

## Adding New Reasons

To add a new reason-specific rule:

1. Open `AdjustmentFields.ts`
2. Add to the `reasonSpecificFields` object:

```typescript
const reasonSpecificFields: Record<string, string[]> = {
    // ... existing reasons ...
    
    // New reason
    'Your New Reason Description': [
        'Field1',
        'Field2',
        'Field3'
    ]
};
```

3. The new reason will automatically work with all cases (A, B, C)

## Testing

Use the testing buttons in the UI to test different scenarios:

```typescript
// Test with randomization
const result = RuleManager.runRandomization('adjustment', reasonDesc);

// Test specific case with reason
const caseAResult = RuleManager.setCaseA('adjustment', reasonDesc);
const caseBResult = RuleManager.setCaseB('adjustment', reasonDesc);
const caseCResult = RuleManager.setCaseC('adjustment', reasonDesc);
```

## Important Notes

1. **Intersection Logic**: The reason filter creates an intersection with case fields. If a field is not allowed by the case, it won't be editable even if the reason allows it.

2. **Backward Compatibility**: If no reason is provided, the system falls back to case-only rules (original behavior).

3. **Case C Override**: Case C (Completed/Terminated) returns no editable fields, so no reason can override this.

4. **Dynamic Updates**: Field permissions update automatically when category, reason, pcmaStatus, or packageStatus change.

## Real-World Example

**Scenario:** Project is "Not yet started" and "not packaged" (Case A) with reason "Correction of MYPS typographical error for consistency with GAA"

```typescript
// Without reason (original behavior)
Case A → All fields editable (50+ fields)

// With reason
Case A + Reason → Only 'Description' field editable

// This prevents users from accidentally modifying other fields
// when they only need to fix a typo in the description
```

This ensures users can only edit what's necessary for the specific reason, reducing errors and maintaining data integrity.
