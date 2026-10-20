# RBIA State Management - Enhanced Architecture for Roads, Road Sections & Bridges

## Overview

The RBIA components (Roads, Road Sections, and Bridges) have been enhanced with a comprehensive state management system using Jotai atoms and custom hooks. This provides centralized state management, improved data fetching capabilities, and consistent patterns across all three entities.

## Architecture

### 1. Atoms (`state/rbiaAtoms.ts`)

**Road Data Atoms:**
- `roadDataAtom` - Stores paginated road data
- `roadFiltersAtom` - Stores current filter and pagination state
- `roadClassificationsAtom` - Stores road classifications for dropdowns
- `roadLoadingAtom` - Loading state management
- `roadSearchInputAtom` - Search input state

**Road Section Data Atoms:**
- `roadSectionDataAtom` - Stores paginated road section data
- `roadSectionFiltersAtom` - Stores current filter and pagination state
- `roadSectionLoadingAtom` - Loading state management
- `roadSectionSearchInputAtom` - Search input state

**Bridge Data Atoms:**
- `bridgeDataAtom` - Stores paginated bridge data
- `bridgeFiltersAtom` - Stores current filter and pagination state
- `bridgeInitDataAtom` - Stores bridge initialization data (DEOs)
- `bridgeLoadingAtom` - Loading state management
- `bridgeSearchInputAtom` - Search input state

**Derived Atoms:**
- `hasActiveRoadFiltersAtom` - Computed boolean for active road filters
- `hasActiveRoadSectionFiltersAtom` - Computed boolean for active road section filters
- `hasActiveBridgeFiltersAtom` - Computed boolean for active bridge filters
- `roadsCountAtom` - Total count from road data
- `roadSectionsCountAtom` - Total count from road section data
- `bridgesCountAtom` - Total count from bridge data

**Action Atoms:**
- Road: `updateRoadDataAtom`, `updateRoadFiltersAtom`, `clearRoadFiltersAtom`
- Road Section: `updateRoadSectionDataAtom`, `updateRoadSectionFiltersAtom`, `clearRoadSectionFiltersAtom`
- Bridge: `updateBridgeDataAtom`, `updateBridgeFiltersAtom`, `clearBridgeFiltersAtom`

### 2. Custom Hooks

**`useRoadData` Hook:**
Encapsulates all road data operations including search, pagination, filtering, and optimistic updates.

**`useRoadSectionData` Hook:**
Manages road section data with the same comprehensive feature set as roads.

**`useBridgeData` Hook:**
Handles bridge data management including DEO initialization data.

### 3. Enhanced Components

All three components (`Road.tsx`, `RoadSection.tsx`, `Bridge.tsx`) now follow the same pattern:

```tsx
const Component: React.FC = () => {
  const {
    data,
    isLoading,
    searchInput,
    hasActiveFilters,
    initializeData,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    removeFromState
  } = useEntityData(); // useRoadData, useRoadSectionData, or useBridgeData

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // Component logic...
};
```

## Usage Examples

### Basic Data Fetching (Works for all entities)

```tsx
// Roads
import { useRoadData } from '../hooks/useRoadData';

// Road Sections  
import { useRoadSectionData } from '../hooks/useRoadSectionData';

// Bridges
import { useBridgeData } from '../hooks/useBridgeData';

const MyComponent = () => {
  const { data, isLoading, initializeData } = useRoadData(); // or useRoadSectionData, useBridgeData
  
  useEffect(() => {
    initializeData();
  }, []);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {data.lists.map(item => (
        <div key={item.Id}>{item.Name}</div>
      ))}
    </div>
  );
};
```

### Search Functionality (Universal pattern)

```tsx
const SearchComponent = () => {
  const { 
    searchInput, 
    handleSearchInputChange, 
    handleSearchSubmit,
    handleClearSearch 
  } = useRoadData(); // Works the same for all hooks
  
  return (
    <div>
      <input 
        value={searchInput}
        onChange={(e) => handleSearchInputChange(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
      />
      <button onClick={handleSearchSubmit}>Search</button>
      <button onClick={handleClearSearch}>Clear</button>
    </div>
  );
};
```

### Custom Filtering

```tsx
// Road filtering
const RoadFilterComponent = () => {
  const { handleFilterChange } = useRoadData();
  
  const handleClassificationFilter = (classification: string) => {
    handleFilterChange({
      filters: { Classification: classification }
    });
  };
  
  return (
    <select onChange={(e) => handleClassificationFilter(e.target.value)}>
      <option value="">All Classifications</option>
      <option value="Class1">Class 1</option>
    </select>
  );
};

// Road Section filtering
const RoadSectionFilterComponent = () => {
  const { handleFilterChange } = useRoadSectionData();
  
  const handleDEOFilter = (deo: string) => {
    handleFilterChange({
      filters: { DEO: deo }
    });
  };
  
  return (
    <select onChange={(e) => handleDEOFilter(e.target.value)}>
      <option value="">All DEOs</option>
      <option value="DEO1">DEO 1</option>
    </select>
  );
};

// Bridge filtering  
const BridgeFilterComponent = () => {
  const { handleFilterChange } = useBridgeData();
  
  const handleRoadSectionFilter = (roadSectionId: string) => {
    handleFilterChange({
      filters: { RoadSectionId: roadSectionId }
    });
  };
  
  return (
    <select onChange={(e) => handleRoadSectionFilter(e.target.value)}>
      <option value="">All Road Sections</option>
      <option value="RS001">RS001</option>
    </select>
  );
};
```

### Optimistic Updates (Universal pattern)

```tsx
const EntityActions = ({ entity, entityType }: { entity: any, entityType: 'road' | 'roadSection' | 'bridge' }) => {
  const { 
    removeRoadFromState, 
    updateRoadInState 
  } = useRoadData();
  
  const { 
    removeRoadSectionFromState, 
    updateRoadSectionInState 
  } = useRoadSectionData();
  
  const { 
    removeBridgeFromState, 
    updateBridgeInState 
  } = useBridgeData();
  
  const handleDelete = async () => {
    // Optimistically remove from UI
    switch(entityType) {
      case 'road':
        removeRoadFromState(entity.RoadId);
        break;
      case 'roadSection':
        removeRoadSectionFromState(entity.RoadSectionId);
        break;
      case 'bridge':
        removeBridgeFromState(entity.BridgeId);
        break;
    }
    
    try {
      // Call appropriate delete service
      await deleteEntity(entity.Id);
    } catch (error) {
      console.error('Delete failed:', error);
      // Handle error - could refetch or revert
    }
  };
  
  const handleUpdate = async (updatedData: any) => {
    const updatedEntity = { ...entity, ...updatedData };
    
    // Optimistically update UI
    switch(entityType) {
      case 'road':
        updateRoadInState(updatedEntity);
        break;
      case 'roadSection':
        updateRoadSectionInState(updatedEntity);
        break;
      case 'bridge':
        updateBridgeInState(updatedEntity);
        break;
    }
    
    try {
      await updateEntity(updatedEntity);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };
  
  return (
    <div>
      <button onClick={handleDelete}>Delete</button>
      <button onClick={() => handleUpdate({ Name: 'New Name' })}>
        Update
      </button>
    </div>
  );
};
```

> **Note on `removeXFromState` (post keyset-pagination fix):** the `removeRoadFromState`/
> `removeRoadSectionFromState`/`removeBridgeFromState` calls shown above no longer just splice the
> row out of local state — they trigger a real re-fetch via `usePagination`'s `applyFilters()`
> (page 1, cursors cleared), not `refresh()`. This is because the BE's pagination is
> keyset/cursor-based: a page's cursors can't be trusted once a row has been removed out from
> under them, and `refresh()` specifically re-requests the *same* page number — if the deleted row
> was the last one on the last page, that page no longer exists and its cursor is stale. See
> `Rbia.md`'s "Pagination" section for the full keyset-pagination contract. `updateXInState` is
> unaffected and still patches local state directly (though, as noted in `Rbia.md`'s Known Issues,
> no dialog currently calls it).

## Benefits

1. **Centralized State Management**: All entity-related state is managed consistently
2. **Reusable Logic**: Custom hooks can be used across multiple components
3. **Type Safety**: Full TypeScript support with proper interfaces for all entities
4. **Performance**: Optimistic updates provide immediate UI feedback
5. **Maintainability**: Clear separation of concerns and consistent architecture
6. **Consistency**: Standardized patterns across Roads, Road Sections, and Bridges
7. **Scalability**: Easy to extend with new entities following the same pattern

## File Structure

```
src/pages/Rbia/
├── state/
│   └── rbiaAtoms.ts           # All atoms for Roads, Road Sections, Bridges
├── hooks/
│   ├── useRoadData.ts         # Road data management hook
│   ├── useRoadSectionData.ts  # Road Section data management hook
│   └── useBridgeData.ts       # Bridge data management hook
├── components/
│   ├── Road.tsx               # Enhanced Road component
│   ├── RoadSection.tsx        # Enhanced Road Section component
│   └── Bridge.tsx             # Enhanced Bridge component
├── Service.ts                 # API service calls
├── Model.d.ts                 # TypeScript interfaces
└── README_State_Management.md # This documentation
```

## API Endpoints

**Roads:**
- `GET /futureInfra/initfilterFutureRoads` - Get road classifications
- `POST /futureInfra/ShowFutureRoads` - Get paginated roads with filters
- `POST /rbia/addFutureRoad` - Add new road
- `POST /rbia/editFutureRoad` - Update road
- `POST /rbia/deleteFutureRoad` - Delete road

**Road Sections:**
- `POST /futureinfra/ShowFutureRoadSections` - Get paginated road sections with filters
- `POST /futureinfra/addFutureRoadSections` - Add new road section
- `POST /futureinfra/editFutureRoadSection` - Update road section
- `POST /futureinfra/deleteFutureRoadSection` - Delete road section

**Bridges:**
- `POST /futureinfra/InitFilterFutureBridge` - Get bridge initialization data (DEOs)
- `POST /futureinfra/ShowFutureBridge` - Get paginated bridges with filters
- `POST /rbia/editFutureBridge` - Update bridge
- `POST /rbia/deleteFutureBridge` - Delete bridge

## Migration Guide

### For Existing Components

1. Replace local state management with appropriate custom hook (`useRoadData`, `useRoadSectionData`, `useBridgeData`)
2. Remove direct service calls in components
3. Use the provided action functions instead of custom fetch logic
4. Update to use the new atom-based state structure
5. Add search functionality using the provided handlers
6. Implement pagination using the `handlePagination` function

### For New Components

1. Import and use the appropriate custom hook
2. Use the provided action functions for data operations
3. Access state through the hook's returned values
4. Follow the established patterns for consistency
5. Add search, filter, and pagination UI elements

### Example Migration

**Before:**
```tsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const response = await fetchRoads();
    setData(response.data);
  } finally {
    setLoading(false);
  }
};
```

**After:**
```tsx
const {
  roadData,
  isLoading,
  initializeData,
  handlePagination,
  handleSearch
} = useRoadData();

useEffect(() => {
  initializeData();
}, [initializeData]);
```

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data updates across all entities
2. **Advanced Filtering**: Complex filter combinations and saved filter sets
3. **Bulk Operations**: Multi-select and bulk actions support for all entities
4. **Caching Strategy**: Implement React Query or SWR for advanced caching
5. **Offline Support**: Local storage and sync capabilities
6. **Performance Optimizations**: Virtual scrolling for large datasets
7. **Export/Import**: CSV/Excel export functionality for all entities
8. **Audit Trail**: Track changes and user actions across all entities
