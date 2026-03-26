# CRUD Rules Usage Guide

The modification system now supports CRUD (Create, Read, Update, Delete) rules from the API. Here's how to use them:

## Type Definitions

The new rule structure includes both field-level permissions and CRUD operations:

```typescript
interface CRUDRules {
    Message: string;      // Custom message for restrictions
    CanAdd: string;       // "true"/"false" or "1"/"0"
    CanDelete: string;    // "true"/"false" or "1"/"0"
}

interface FieldRuleSection {
    Fields: Record<string, boolean>;  // Field-level edit permissions
    CRUD: CRUDRules;                  // Section-level CRUD permissions
}
```

## Available Hooks

### 1. `useCrudRules(section)`
Get the full CRUD rules for a section:

```typescript
import { useCrudRules } from '../hooks/useFieldPermissions';

const MyComponent = () => {
    const crudRules = useCrudRules('ComponentCostRules');
    
    if (crudRules) {
        console.log(crudRules.Message);    // Restriction message
        console.log(crudRules.CanAdd);     // Can add items?
        console.log(crudRules.CanDelete);  // Can delete items?
    }
};
```

### 2. `useCanAddItem(section)`
Check if items can be added to a section:

```typescript
import { useCanAddItem } from '../hooks/useFieldPermissions';

const ComponentCostForm = () => {
    const canAdd = useCanAddItem('ComponentCostRules');
    
    return (
        <button disabled={!canAdd}>
            Add Component
        </button>
    );
};
```

### 3. `useCanDeleteItem(section)`
Check if items can be deleted from a section:

```typescript
import { useCanDeleteItem } from '../hooks/useFieldPermissions';

const ComponentCostRow = () => {
    const canDelete = useCanDeleteItem('ComponentCostRules');
    
    return (
        <button disabled={!canDelete}>
            Delete
        </button>
    );
};
```

## Available Sections

- `'ComponentCostRules'`
- `'ComponentCostYearRules'`
- `'MajorItemOfWorkRules'`
- `'MajorItemLocationRules'`
- `'FundingProfileRules'`

## Example: Complete Component with CRUD Rules

```typescript
import { useCanAddItem, useCanDeleteItem, useCrudRules } from '../hooks/useFieldPermissions';

const ComponentCostManager = () => {
    const canAdd = useCanAddItem('ComponentCostRules');
    const canDelete = useCanDeleteItem('ComponentCostRules');
    const crudRules = useCrudRules('ComponentCostRules');
    
    return (
        <div>
            {crudRules?.Message && (
                <div className="alert alert-info">
                    {crudRules.Message}
                </div>
            )}
            
            <button 
                onClick={handleAdd}
                disabled={!canAdd}
                title={!canAdd ? 'Adding items is restricted' : ''}
            >
                Add Component
            </button>
            
            {components.map(component => (
                <div key={component.id}>
                    {component.name}
                    <button 
                        onClick={() => handleDelete(component.id)}
                        disabled={!canDelete}
                        title={!canDelete ? 'Deleting items is restricted' : ''}
                    >
                        Delete
                    </button>
                </div>
            ))}
        </div>
    );
};
```

## Backward Compatibility

The system maintains backward compatibility with the old format where rules were just `Record<string, boolean>`. If the API returns the old format, the CRUD hooks will return `null` or default to allowing operations.

## Field-Level Permissions

Field-level permissions continue to work as before:

```typescript
import { useIsFieldEditable } from '../hooks/useFieldPermissions';

const isDescriptionEditable = useIsFieldEditable('Description');
```

Both field-level and CRUD-level rules work together to provide comprehensive permission control.
