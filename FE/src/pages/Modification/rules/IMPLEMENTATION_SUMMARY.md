# Dynamic Reason-Based Field Rules - Implementation Summary

## What Was Implemented

A two-tier dynamic field permission system for the **Adjustment** category that:

1. First applies **Case-based rules** (A, B, or C) based on PCMA and Package status
2. Then applies **Reason-based rules** to further restrict editable fields
3. Uses **intersection logic** - only fields allowed by BOTH tiers are editable

## Files Modified

### 1. `AdjustmentFields.ts`
**Changes:**
- Added `reasonSpecificFields` object mapping reasons to allowed fields
- Updated `getEditableFieldsForCase()` to accept optional `reason` parameter
- Implemented intersection logic between case and reason fields
- Updated all functions to support reason parameter: `runRandomization()`, `setCaseA()`, `setCaseB()`, `setCaseC()`, `isFieldEditable()`
- Added helper functions: `getAvailableReasons()`, `getFieldsForReason()`
- Added 7 predefined reason rules

### 2. `RuleManager.ts`
**Changes:**
- Updated `FieldPermissionRule` interface to include reason-related types
- Added reason parameter to all rule methods
- Added new methods: `getAvailableReasons()`, `getFieldsForReason()`
- All methods now pass reason parameter to underlying rule sets

### 3. `ProjectForm.tsx`
**Changes:**
- Updated `useEffect` to pass `reason` to `RuleManager` methods
- Added `reason` to field permissions state
- Updated all case testing functions to include reason
- Added reason to dependency array

### 4. `AdjustProject.tsx`
**Already passing reason:**
- The reason is already being passed from navigation state
- No changes needed - works out of the box!

## New Files Created

### 1. `ADJUSTMENT_RULES_GUIDE.md`
Comprehensive documentation covering:
- System overview and flow diagram
- Case rules explanation
- Reason-specific rules for all 7 reasons
- Implementation examples
- Testing guide
- Real-world scenarios

### 2. `AdjustmentRulesTester.tsx`
Interactive testing component with:
- Dropdown selectors for PCMA status, Package status, and Reason
- Visual results display showing case, field count, and editable fields
- Explanation of how the rules were applied
- Quick test scenarios
- Randomize functionality

## Predefined Reason Rules

### 1. "Correction of MYPS typographical error for consistency with GAA"
- **Fields:** `Description` only
- **Purpose:** Typo corrections in description

### 2. "Correction of MYPS for null or zero targets"
- **Fields:** `PhysicalTarget`, `WorkLocation`, `WorkLocationEdit`, `TargetUnit`
- **Purpose:** Fixing missing target values

### 3. "Move funds between existing Project Components"
- **Fields:** `ComponentCost`
- **Purpose:** Budget reallocation between components

### 4. "Input of missing Location, Work Location data (if null or zero)"
- **Fields:** `City`, `LegislativeDistrict`, `WorkLocation`, `WorkLocationAdd`, `PhysicalTarget`
- **Purpose:** Adding missing location data

### 5. "Input of missing Planned Start/End Date (only if null or zero)"
- **Fields:** `PlannedStartDate`, `PlannedEndDate`
- **Purpose:** Adding missing date information

### 6. "Excess Amount due to Revised Estimate"
- **Fields:** `ComponentCost`, `ComponentDescription`
- **Purpose:** Adjusting costs due to revised estimates

### 7. "New Component needed - movement of funds also required"
- **Fields:** `ComponentCost`, `ComponentDescription`, `ComponentAdd`, `ComponentDelete`
- **Purpose:** Adding new components with fund redistribution

## How to Use

### In Your Route/Navigation
```typescript
navigate('/adjust-project', {
    state: {
        categoryDesc: 'adjustment',
        reasonDesc: 'Correction of MYPS typographical error for consistency with GAA'
    }
});
```

### The Form Automatically Applies Rules
```typescript
// ProjectForm automatically:
// 1. Receives category and reason as props
// 2. Determines the case based on PCMA/Package status
// 3. Gets editable fields using case + reason
// 4. Updates field permissions state
// 5. UI components use fieldPermissions to enable/disable fields
```

### Testing the System
```typescript
// Manual testing in console
const result = RuleManager.getEditableFieldsForCase(
    'CaseA', 
    'adjustment',
    'Correction of MYPS typographical error for consistency with GAA'
);
console.log(result); // ['Description']

// Check if specific field is editable
const canEdit = RuleManager.isFieldEditable(
    'Description',
    'CaseA',
    'adjustment',
    'Correction of MYPS typographical error for consistency with GAA'
);
console.log(canEdit); // true
```

## Example Scenarios

### Scenario 1: Typo Fix
```
PCMA Status: Not yet started
Package Status: not packaged
Reason: Correction of MYPS typographical error for consistency with GAA

Result:
- Case: A (normally allows all fields)
- Reason filter: Only 'Description'
- Final: Only 'Description' editable ✓
```

### Scenario 2: No Reason (Backward Compatible)
```
PCMA Status: On-going
Package Status: packaged
Reason: (none)

Result:
- Case: B
- Reason filter: (none applied)
- Final: Description, EmergencyMode, Origin, Agency, etc. ✓
```

### Scenario 3: Case C Override
```
PCMA Status: Completed
Package Status: packaged
Reason: Any reason

Result:
- Case: C (no fields allowed)
- Reason filter: (doesn't matter)
- Final: No fields editable ✓
```

## Adding More Reasons

1. Open `AdjustmentFields.ts`
2. Add to `reasonSpecificFields`:

```typescript
const reasonSpecificFields: Record<string, string[]> = {
    // ... existing reasons ...
    
    'Your New Reason': [
        'Field1',
        'Field2'
    ]
};
```

3. That's it! The new reason works automatically with all cases.

## Key Benefits

1. **Precise Control:** Restrict exactly which fields can be edited for each reason
2. **Safety:** Prevents accidental edits to unrelated fields
3. **Flexibility:** Easy to add new reasons without changing core logic
4. **Backward Compatible:** Works without reason (falls back to case-only rules)
5. **Type Safe:** Full TypeScript support with proper interfaces
6. **Testable:** RuleManager provides methods to test any combination

## Integration Points

- ✅ Works with existing case system (A, B, C)
- ✅ Integrates with ProjectForm component
- ✅ Compatible with AdjustProject view
- ✅ No breaking changes to existing code
- ✅ All other categories (modification, termination, etc.) unaffected

## Next Steps

1. **UI Components:** Update form fields to check `fieldPermissions.editableFields`
2. **Validation:** Add validation to enforce field restrictions
3. **User Feedback:** Show why certain fields are disabled (tooltip/message)
4. **Audit Log:** Track which reason was used for each modification
5. **More Reasons:** Add additional reason-specific rules as needed

## Testing Component

Use `AdjustmentRulesTester` component to:
- Test all case/reason combinations
- Verify field restrictions
- Debug field permission issues
- Demonstrate the system to stakeholders

```typescript
import AdjustmentRulesTester from './components/AdjustmentRulesTester';

// In your test/dev route
<AdjustmentRulesTester />
```

---

**Implementation Date:** November 18, 2025
**Category:** Adjustment (other categories can adopt the same pattern)
**Status:** Complete and Ready for Testing
