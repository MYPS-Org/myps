# Jotai State Management for Field Permissions

## Overview

The field permission system now uses **Jotai** for state management, making it easier to share status and permissions across components without prop drilling.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Jotai Atom Store                    │
│  (fieldPermissionStore.ts)                  │
│                                             │
│  • pcmaStatusAtom                           │
│  • packageStatusAtom                        │
│  • modificationContextAtom                  │
│  • fieldPermissionsAtom (derived)           │
│  • currentCaseAtom (derived)                │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Custom Hooks                        │
│  (useFieldPermissions.ts)                   │
│                                             │
│  • useFieldPermissions()                    │
│  • useIsFieldEditable()                     │
│  • useFieldEditStatus()                     │
│  • useDebugControls()                       │
│  • useAPIIntegration()                      │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│         Components                          │
│                                             │
│  • ProjectForm (sets context)               │
│  • ComponentCostDialog (checks permissions) │
│  • FieldPermissionDebugPanel (debug UI)     │
└─────────────────────────────────────────────┘
```

## Quick Start

### 1. Initialize Context in Parent Component

```typescript
import { useInitializeModificationContext } from '../../hooks/useFieldPermissions';

// In your component (e.g., ProjectForm or ModificationDetails)
const ModifyProject: React.FC = () => {
    const categoryDesc = 'adjustment';
    const reasonDesc = 'Input of missing Planned Start/End Date (only if null or zero)';
    const reasonId = 123;

    // Initialize context - this sets up the modification rules
    useInitializeModificationContext(categoryDesc, reasonDesc, reasonId);

    return <ProjectForm />;
};
```

### 2. Check Field Permissions in Child Components

```typescript
import { useIsFieldEditable, useFieldEditStatus } from '../hooks/useFieldPermissions';

const MyFormComponent: React.FC = () => {
    const [startDate, setStartDate] = useState('');
    
    // Check if field is editable
    const isStartDateEditable = useIsFieldEditable('StartDate', startDate);
    
    // Get detailed status
    const startDateStatus = useFieldEditStatus('StartDate', startDate);
    
    return (
        <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={!isStartDateEditable}
            title={startDateStatus.reason}
        />
    );
};
```

### 3. Set Status (Development vs Production)

#### For Development (Manual Testing):

```typescript
import { useDebugControls } from '../hooks/useFieldPermissions';

const MyComponent: React.FC = () => {
    const { setCaseA, setCaseB, setCaseC, randomize } = useDebugControls();
    
    return (
        <div>
            <button onClick={() => setCaseA()}>Set Case A</button>
            <button onClick={() => setCaseB()}>Set Case B</button>
            <button onClick={() => setCaseC()}>Set Case C</button>
            <button onClick={() => randomize()}>Randomize</button>
        </div>
    );
};
```

#### For Production (API Integration):

```typescript
import { useAPIIntegration } from '../hooks/useFieldPermissions';

const MyComponent: React.FC = () => {
    const { setStatusFromAPI, setModificationContext } = useAPIIntegration();
    
    useEffect(() => {
        // Fetch from external API
        const fetchStatus = async () => {
            const response = await getProjectStatusFromExternalAPI();
            
            // Set status from API response
            setStatusFromAPI(
                response.pcmaStatus,    // e.g., "On-going"
                response.packageStatus  // e.g., "packaged"
            );
            
            // Set modification context
            setModificationContext({
                category: 'adjustment',
                reason: 'Input of missing Planned Start/End Date',
                reasonId: 123
            });
        };
        
        fetchStatus();
    }, []);
    
    return <div>Loading...</div>;
};
```

## Available Hooks

### `useFieldPermissions()`

Returns complete state and actions for field permissions.

```typescript
const {
    // State
    pcmaStatus,      // Current PCMA status
    packageStatus,   // Current package status
    currentCase,     // Determined case (CaseA/B/C)
    permissions,     // Full permissions object
    context,         // Modification context

    // Actions
    setCaseA,        // Set to Case A
    setCaseB,        // Set to Case B
    setCaseC,        // Set to Case C
    randomize,       // Randomize status
    setFromAPI,      // Set from API response
    reset            // Reset all state
} = useFieldPermissions();
```

### `useIsFieldEditable(fieldName, currentValue)`

Check if a specific field is editable.

```typescript
const isStartDateEditable = useIsFieldEditable('StartDate', startDate);
// Returns: boolean
```

### `useFieldEditStatus(fieldName, currentValue)`

Get detailed status about field editability.

```typescript
const status = useFieldEditStatus('StartDate', startDate);
// Returns: { canEdit: boolean, reason: string }

console.log(status.canEdit);  // true or false
console.log(status.reason);   // "Field is editable" or explanation
```

### `useFieldPermissionState()`

Read-only access to permission state.

```typescript
const { pcmaStatus, packageStatus, currentCase, permissions, context } = useFieldPermissionState();
```

### `useDebugControls()`

Debug controls for manual testing.

```typescript
const { setCaseA, setCaseB, setCaseC, randomize, reset } = useDebugControls();
```

### `useAPIIntegration()`

Functions for API integration.

```typescript
const { setStatusFromAPI, setModificationContext } = useAPIIntegration();
```

## Debug Panel Component

A floating debug panel for easy testing during development:

```typescript
import FieldPermissionDebugPanel from '../components/FieldPermissionDebugPanel';

// Add to your layout (conditionally for development)
const App = () => (
    <>
        <YourMainContent />
        {process.env.NODE_ENV === 'development' && <FieldPermissionDebugPanel />}
    </>
);
```

## Migration from Old System

### Before (Props Drilling):

```typescript
// Parent
<ChildComponent
    category={category}
    reason={reason}
    currentCase={currentCase}
    pcmaStatus={pcmaStatus}
    packageStatus={packageStatus}
/>

// Child
const ChildComponent = ({ category, reason, currentCase, pcmaStatus, packageStatus }) => {
    const isEditable = RuleManager.isFieldEditableWithValue(...);
    // ...
};
```

### After (Jotai):

```typescript
// Parent - just initialize context
useInitializeModificationContext(category, reason, reasonId);

<ChildComponent />

// Child - access directly from Jotai
const ChildComponent = () => {
    const isEditable = useIsFieldEditable('FieldName', currentValue);
    // No props needed!
};
```

## Benefits

✅ **No Prop Drilling** - Access state from any component
✅ **Automatic Updates** - All components react to state changes
✅ **Type Safe** - Full TypeScript support
✅ **Persistent** - Status persisted to localStorage (dev mode)
✅ **Derived State** - Automatic calculation of permissions
✅ **Testable** - Easy to test with Jotai's testing utilities

## Status Flow

```
1. Component Initialization
   ↓
2. useInitializeModificationContext(category, reason, reasonId)
   ↓
3. modificationContextAtom updated
   ↓
4. For Development:
   - Manual: setCaseA/B/C or randomize
   - Updates: pcmaStatusAtom, packageStatusAtom
   ↓
5. For Production:
   - API fetch
   - setStatusFromAPI(pcmaStatus, packageStatus)
   ↓
6. Derived Atoms Calculate:
   - currentCaseAtom (from status)
   - fieldPermissionsAtom (from case + context)
   ↓
7. Components Subscribe:
   - useIsFieldEditable('FieldName', value)
   - useFieldEditStatus('FieldName', value)
   ↓
8. UI Updates Automatically
```

## Production Integration Example

```typescript
// In your main modification component
const ModificationDetails: React.FC = () => {
    const { setStatusFromAPI, setModificationContext } = useAPIIntegration();
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const initialize = async () => {
            try {
                // 1. Fetch project details
                const project = await getProjectDetails(projectId);
                
                // 2. Fetch PCMA status from external API
                const pcmaData = await fetchPCMAStatus(projectId);
                
                // 3. Set status from API
                setStatusFromAPI(
                    pcmaData.status,        // "On-going", "Completed", etc.
                    pcmaData.packageStatus  // "packaged", "not packaged"
                );
                
                // 4. Set modification context from navigation
                setModificationContext({
                    category: location.state?.categoryDesc,
                    reason: location.state?.reasonDesc,
                    reasonId: location.state?.reasonId
                });
                
                setIsLoading(false);
            } catch (error) {
                console.error('Error initializing:', error);
            }
        };
        
        initialize();
    }, [projectId]);
    
    if (isLoading) return <div>Loading...</div>;
    
    return <ProjectForm />;
};
```

## Atoms Reference

| Atom | Type | Description |
|------|------|-------------|
| `pcmaStatusAtom` | Writable | PCMA status string |
| `packageStatusAtom` | Writable | Package status string |
| `modificationContextAtom` | Writable | Category, reason, reasonId |
| `currentCaseAtom` | Derived | Calculated case (A/B/C) |
| `fieldPermissionsAtom` | Derived | Full permissions object |
| `setCaseAAtom` | Action | Set to Case A |
| `setCaseBAtom` | Action | Set to Case B |
| `setCaseCAtom` | Action | Set to Case C |
| `randomizeStatusAtom` | Action | Randomize status |
| `setStatusFromAPIAtom` | Action | Set from API |
| `resetStatusAtom` | Action | Reset all state |

## Best Practices

1. **Initialize Early** - Call `useInitializeModificationContext` as early as possible
2. **Use Hooks** - Prefer custom hooks over direct atom access
3. **Debug Panel** - Use the debug panel during development
4. **API Integration** - Replace debug buttons with API calls in production
5. **Error Handling** - Handle cases where permissions aren't set yet
6. **Loading States** - Show loading UI while permissions are being determined

## Troubleshooting

### Fields not updating

```typescript
// Check if context is initialized
const { context } = useFieldPermissionState();
console.log('Context:', context);

// Check if status is set
const { pcmaStatus, packageStatus } = useFieldPermissionState();
console.log('Status:', { pcmaStatus, packageStatus });
```

### Permissions not calculated

```typescript
// Check if derived atoms are working
const { currentCase, permissions } = useFieldPermissionState();
console.log('Case:', currentCase);
console.log('Permissions:', permissions);
```

### Values persisting between sessions

```typescript
// Clear localStorage for development
localStorage.removeItem('modification-pcma-status');
localStorage.removeItem('modification-package-status');

// Or use reset
const { reset } = useDebugControls();
reset();
```
