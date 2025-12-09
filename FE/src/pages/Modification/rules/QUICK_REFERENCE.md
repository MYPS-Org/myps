# Quick Reference: Dynamic Field Permission System

## TL;DR

Fields can now be validated based on their actual values (null, zero, etc.) in addition to case/reason permissions.

## Main Function (Use This)

```typescript
const canEdit = RuleManager.isFieldEditableWithValue(
    'FieldName',      // Field to check
    currentCase,      // 'CaseA', 'CaseB', or 'CaseC'
    currentValue,     // The actual value of the field
    category,         // 'adjustment', 'modification', etc.
    reason            // The modification reason
);
```

## Quick Setup in Component

```typescript
import RuleManager from '../rules/RuleManager';

// 1. Determine case
const currentCase = RuleManager.determineCase(pcmaStatus, packageStatus, category);

// 2. Create validation callback
const isFieldEditable = useCallback((fieldName: string, currentValue?: any) => {
    return RuleManager.isFieldEditableWithValue(
        fieldName,
        currentCase,
        currentValue,
        categoryDesc,
        reasonDesc
    );
}, [currentCase, categoryDesc, reasonDesc]);

// 3. Use in JSX
<input
    type="date"
    value={formData.StartDate}
    disabled={!isFieldEditable('StartDate', formData.StartDate)}
/>
```

## Adding New Conditions

Edit `AdjustmentFields.ts`:

```typescript
const fieldValueConditions: Record<string, Record<string, (value: any) => boolean>> = {
    'Your Reason Description': {
        'FieldName': (value) => value === null || value === undefined || value === '',
    }
};
```

## Validation Patterns

| Pattern | Code |
|---------|------|
| Null/Empty | `(value) => value === null \|\| value === undefined \|\| value === ''` |
| Null/Zero | `(value) => value === null \|\| value === undefined \|\| value === 0 \|\| value === ''` |
| Always Allow | `(_value) => true` |
| Never Allow | `(_value) => false` |

## Get Status Message

```typescript
const getFieldEditStatus = useCallback((fieldName: string, currentValue?: any) => {
    return RuleManager.getFieldEditStatus(
        fieldName,
        currentCase,
        currentValue,
        categoryDesc,
        reasonDesc
    );
}, [currentCase, categoryDesc, reasonDesc]);

// Usage
const status = getFieldEditStatus('StartDate', formData.StartDate);
console.log(status.canEdit);   // true or false
console.log(status.reason);    // "Field is editable" or "Field already has a value..."
```

## Complete Example

```typescript
<div>
    <label>
        Start Date
        {(() => {
            const status = getFieldEditStatus('StartDate', formData.StartDate);
            if (!status.canEdit && formData.StartDate) {
                return <span className="text-xs text-gray-500"> ({status.reason})</span>;
            }
            return null;
        })()}
    </label>
    <input
        type="date"
        value={formData.StartDate}
        onChange={(e) => handleChange('StartDate', e.target.value)}
        disabled={!isFieldEditable('StartDate', formData.StartDate)}
        className={!isFieldEditable('StartDate', formData.StartDate) ? 'bg-gray-100' : ''}
        title={getFieldEditStatus('StartDate', formData.StartDate).reason}
    />
</div>
```

## Debugging

```typescript
console.log('Field:', fieldName);
console.log('Value:', currentValue);
console.log('Case:', currentCase);
console.log('Category:', categoryDesc);
console.log('Reason:', reasonDesc);
console.log('Status:', RuleManager.getFieldEditStatus(fieldName, currentCase, currentValue, categoryDesc, reasonDesc));
```

## Files

- **Main Logic**: `FE/src/pages/Modification/rules/AdjustmentFields.ts`
- **Manager**: `FE/src/pages/Modification/rules/RuleManager.ts`
- **Example**: `FE/src/pages/Modification/dialogs/ComponentCostDialog.tsx`
- **Full Docs**: `USAGE_GUIDE.md` and `IMPLEMENTATION_SUMMARY.md`
