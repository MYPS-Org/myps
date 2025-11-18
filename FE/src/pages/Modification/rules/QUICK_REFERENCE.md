# Quick Reference - Adjustment Category Dynamic Rules

## 🔄 System Flow

```
User selects Adjustment Category + Reason
                ↓
        AdjustProject receives
        category + reason from state
                ↓
        Pass to ProjectForm component
                ↓
        ProjectForm determines PCMA & Package Status
                ↓
        RuleManager.determineCase(pcmaStatus, packageStatus, category)
                ↓
        RuleManager.getEditableFieldsForCase(case, category, reason)
                ↓
        Apply intersection: Case Fields ∩ Reason Fields
                ↓
        Update fieldPermissions state
                ↓
        UI renders with restricted fields
```

## 📊 Case Matrix

| PCMA Status     | Package Status  | Result  |
|-----------------|-----------------|---------|
| Not yet started | Not packaged    | Case A  |
| Not yet started | Packaged        | Case B  |
| On-going        | Not packaged    | Case C  |
| On-going        | Packaged        | Case B  |
| Completed       | Any             | Case C  |
| Terminated      | Any             | Case C  |

## 🎯 Case Permissions

### Case A (Most Permissive)
- ✅ All Project Detail Fields (11)
- ✅ All Funding Profile Fields (3)
- ✅ All Component Fields (4)
- ✅ All Major Item Fields (4)
- ✅ All Physical Target Fields (5)
- **Total: ~27 fields**

### Case B (Moderate)
- ✅ Description
- ✅ EmergencyMode
- ✅ Origin
- ✅ Agency
- ✅ FundingProfile
- ✅ ComponentCostEdit
- ✅ WorkLocationEdit
- **Total: 7 fields**

### Case C (Most Restrictive)
- ❌ No fields editable
- **Total: 0 fields**

## 🎯 Reason-Specific Rules

| # | Reason | Allowed Fields | Count |
|---|--------|---------------|-------|
| 1 | Correction of MYPS typographical error | Description | 1 |
| 2 | Correction of MYPS for null or zero targets | PhysicalTarget, WorkLocation, WorkLocationEdit, TargetUnit | 4 |
| 3 | Move funds between existing Components | ComponentCost | 1 |
| 4 | Input missing Location/Work Location | City, LegislativeDistrict, WorkLocation, WorkLocationAdd, PhysicalTarget | 5 |
| 5 | Input missing Planned Start/End Date | PlannedStartDate, PlannedEndDate | 2 |
| 6 | Excess Amount due to Revised Estimate | ComponentCost, ComponentDescription | 2 |
| 7 | New Component with fund movement | ComponentCost, ComponentDescription, ComponentAdd, ComponentDelete | 4 |

## 💡 Example Calculations

### Example 1: Case A + Typo Reason
```
Case A Fields:        [All 27 fields]
Reason Fields:        [Description]
Intersection (∩):     [Description]  ← Final result
```

### Example 2: Case B + No Reason
```
Case B Fields:        [7 fields]
Reason Fields:        [None - no filter applied]
Result:               [All 7 Case B fields]  ← Final result
```

### Example 3: Case C + Any Reason
```
Case C Fields:        []
Reason Fields:        [Any fields]
Intersection (∩):     []  ← Final result (Case C overrides)
```

### Example 4: Case A + Component Movement
```
Case A Fields:        [All 27 fields including ComponentCost]
Reason Fields:        [ComponentCost]
Intersection (∩):     [ComponentCost]  ← Final result
```

## 🔧 Usage in Code

### Check Field Editability
```typescript
const canEdit = RuleManager.isFieldEditable(
    'Description',      // field name
    'CaseA',           // case
    'adjustment',      // category
    'Correction of MYPS typographical error...' // reason
);
// Returns: true
```

### Get All Editable Fields
```typescript
const fields = RuleManager.getEditableFieldsForCase(
    'CaseB',           // case
    'adjustment',      // category
    'Move funds between existing Project Components' // reason
);
// Returns: [] (ComponentCost not in Case B, so intersection is empty)
```

### Get Available Reasons
```typescript
const reasons = RuleManager.getAvailableReasons('adjustment');
// Returns: Array of 7 reason strings
```

### Get Fields for a Reason
```typescript
const reasonFields = RuleManager.getFieldsForReason(
    'New Component needed - movement of funds also required',
    'adjustment'
);
// Returns: ['ComponentCost', 'ComponentDescription', 'ComponentAdd', 'ComponentDelete']
```

## ⚠️ Important Rules

1. **Intersection Logic**: Only fields allowed by BOTH case AND reason are editable
2. **Case First**: Case is determined first, then reason filter is applied
3. **Case C Override**: Case C (Completed/Terminated) always returns empty, regardless of reason
4. **Optional Reason**: If no reason provided, only case rules apply (backward compatible)
5. **Type Safety**: All functions have proper TypeScript types

## 🧪 Testing

### Via UI Component
```typescript
import AdjustmentRulesTester from './components/AdjustmentRulesTester';
```

### Via Console
```typescript
// Test randomization with reason
const result = RuleManager.runRandomization(
    'adjustment', 
    'Correction of MYPS typographical error for consistency with GAA'
);
console.log(result);

// Test specific case
const caseA = RuleManager.setCaseA('adjustment', 'Move funds between existing Project Components');
console.log(caseA.editableFields); // ['ComponentCost']
```

## 📝 Adding New Reasons

1. Open `FE/src/pages/Modification/rules/AdjustmentFields.ts`
2. Add to `reasonSpecificFields` object:

```typescript
const reasonSpecificFields: Record<string, string[]> = {
    // ... existing reasons ...
    
    'Your New Reason Description': [
        'Field1',
        'Field2',
        'Field3'
    ]
};
```

3. Save - that's it! No other changes needed.

## 🎓 Key Concepts

- **Case**: Determined by PCMA + Package status (A, B, or C)
- **Reason**: Specific adjustment reason (7 predefined)
- **Intersection**: Math operation that finds common elements
- **Filter**: Applied after case to restrict fields further
- **Backward Compatible**: Works without reason (case-only mode)

---

**Quick Tip**: Start with Case A (most permissive) when testing new reasons to see full field list, then test with actual cases.
