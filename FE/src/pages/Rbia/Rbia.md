# RBIA — Developer Reference

**RBIA (Road and Bridge Information Administration)** manages the future infrastructure inventory for the MYPS system — specifically future roads, road sections, and bridges. It is a three-tab interface backed by Jotai atoms, three custom hooks, and a dedicated service layer that calls both the MYPS backend and an external GIS API.

> **Related internal docs already in this folder:**
> - `README_State_Management.md` — architecture overview of the Jotai atom/hook pattern
> - `DELETE_OPERATIONS.md` — delete dialog contract, toast notifications, and optimistic state removal

---

## Folder Structure

```
Rbia/
  Model.d.ts                         # All TypeScript interfaces
  Service.ts                         # All API call functions (MYPS backend + GIS API)
  DELETE_OPERATIONS.md               # Delete pattern reference (existing)
  README_State_Management.md         # State architecture reference (existing)
  state/
    rbiaAtoms.ts                     # Jotai atoms — all shared state for Roads, Sections, Bridges
  hooks/
    index.ts                         # Re-exports all hooks + types
    useRoadData.ts                   # Custom hook for Road CRUD, search, filter, sort, pagination
    useRoadSectionData.ts            # Custom hook for Road Section operations
    useBridgeData.ts                 # Custom hook for Bridge operations
  components/
    Road.tsx                         # Roads tab component — full table CRUD
    RoadSection.tsx                  # Road Sections tab component
    Bridge.tsx                       # Bridges tab component
  Dialogs/
    FutureRoadDialog.tsx             # Add / Edit road
    FutureRoadSectionDialog.tsx      # Add / Edit road section (pre-fills from parent road)
    FutureBridgeDialog.tsx           # Add / Edit bridge (pre-fills from parent section)
    DeleteRoadDialog.tsx             # Confirm-delete road (type "delete")
    DeleteRoadSectionDialog.tsx      # Confirm-delete road section
    DeleteBridgeDialog.tsx           # Confirm-delete bridge
    FilterRoadDialog.tsx             # Filter roads by ID / Name / Classification
    FilterRoadSectionDialog.tsx      # Filter road sections by ID / Road ID / DEO
    FilterBridgeDialog.tsx           # Filter bridges by Section ID / Bridge ID / Name
    ImportDialog.tsx                 # Grouped checkbox import from GIS + Admin Areas + Internal Org
  Views/
    Rbia.tsx                         # Root view — tab nav, count badges, Import button
```

---

## Routes

| Path | Component | Description |
|---|---|---|
| `/infrastructure` (or similar) | `Rbia.tsx` | Single-page three-tab infrastructure admin |

`Rbia.tsx` is the root. It renders one of three child components (`Road.tsx`, `RoadSection.tsx`, `Bridge.tsx`) based on `selectedTab`. There is no routing per tab — all three live at the same URL.

---

## Architecture Overview

```
Rbia.tsx
  ├── RoadList         (Road.tsx)        ← useRoadData hook         ← roadDataAtom, roadFiltersAtom, ...
  ├── RoadSectionList  (RoadSection.tsx) ← useRoadSectionData hook  ← roadSectionDataAtom, ...
  └── BridgeList       (Bridge.tsx)      ← useBridgeData hook       ← bridgeDataAtom, ...
```

Each component is **self-contained**: it mounts, calls `initializeData()` on its hook, and manages its own loading/pagination/filter/sort lifecycle independently. Tabs do **not** share state between each other (except `deoListAtom` which is read by both Road and Road Section hooks).

The **`selectedItemAtom`** is the cross-hook atom used to pass the currently edited/deleted item into Add/Edit dialogs. It is set to the item before opening the dialog, then cleared on close.

---

## `state/rbiaAtoms.ts` — Jotai Atoms

### Data Atoms (primary state)

| Atom | Type | Purpose |
|---|---|---|
| `roadDataAtom` | `PaginationResponse<FutureRoads>` | Paginated road list |
| `roadFiltersAtom` | `RoadPagination` | Current road filter + sort + page |
| `roadClassificationsAtom` | `FutureRoadsClassification[]` | Classification enum (loaded on road init) |
| `deoListAtom` | `RODEOEnum[]` | DEO list shared by Road Section and Road hooks |
| `roadLoadingAtom` | `boolean` | Loading flag for roads |
| `roadSearchInputAtom` | `string` | Inline search input value |
| `roadSectionDataAtom` | `PaginationResponse<FutureRoadSections>` | Paginated road section list |
| `roadSectionFiltersAtom` | `RoadSectionPagination` | Road section filter + sort + page |
| `roadSectionLoadingAtom` | `boolean` | Loading flag for road sections |
| `roadSectionSearchInputAtom` | `string` | Inline search input value |
| `bridgeDataAtom` | `PaginationResponse<FutureBridge>` | Paginated bridge list |
| `bridgeFiltersAtom` | `BridgePagination` | Bridge filter + sort + page |
| `bridgeInitDataAtom` | `{ DEOs: RODEOEnum[] }` | DEO list for bridge (separate atom from `deoListAtom`) |
| `bridgeLoadingAtom` | `boolean` | Loading flag for bridges |
| `bridgeSearchInputAtom` | `string` | Inline search input value |
| `selectedItemAtom` | `FutureRoads \| FutureRoadSections \| FutureBridge \| null` | Cross-component selection for edit/delete dialogs |

### Derived (Computed) Atoms

| Atom | Derived from | Purpose |
|---|---|---|
| `hasActiveRoadFiltersAtom` | `roadFiltersAtom` | `true` if any road filter field is non-empty |
| `hasActiveRoadSectionFiltersAtom` | `roadSectionFiltersAtom` | `true` if any section filter field is non-empty |
| `hasActiveBridgeFiltersAtom` | `bridgeFiltersAtom` | `true` if any bridge filter field is non-empty |
| `roadsCountAtom` | `roadDataAtom.total` | Tab badge count |
| `roadSectionsCountAtom` | `roadSectionDataAtom.total` | Tab badge count |
| `bridgesCountAtom` | `bridgeDataAtom.total` | Tab badge count |

### Write-Only (Action) Atoms

| Atom | Effect |
|---|---|
| `updateRoadDataAtom` | Sets `roadDataAtom` AND updates legacy `roadsAtom` |
| `updateRoadFiltersAtom` | Merges partial `RoadPagination` into `roadFiltersAtom` |
| `clearRoadFiltersAtom` | Resets `roadFiltersAtom` + clears `roadSearchInputAtom` |
| `updateRoadSectionDataAtom` | Sets `roadSectionDataAtom` |
| `updateRoadSectionFiltersAtom` | Merges partial filters |
| `clearRoadSectionFiltersAtom` | Resets section filters + search |
| `updateBridgeDataAtom` | Sets `bridgeDataAtom` |
| `updateBridgeFiltersAtom` | Merges partial bridge filters |
| `clearBridgeFiltersAtom` | Resets bridge filters + search |

### Legacy Atoms (backwards compatibility)

`roadsAtom`, `roadSectionsAtom`, `bridgesAtom` — plain arrays, kept so dialog components that were written before the paginated atoms still work. `updateRoadDataAtom` automatically syncs `roadsAtom` when paginated data is updated.

---

## `Service.ts` — API Functions

All MYPS backend calls use `httpClient.post<T>(url, body)`. Import calls use `gisClient.put<T>(url, body)` directly against `VITE_API_GIS_URL`.

### MYPS Backend Endpoints

| Function | Endpoint | Body | Return |
|---|---|---|---|
| `fetchRoadInitData()` | `POST /futureInfra/initfilterFutureRoads` | — | `{ Classifications: FutureRoadsClassification[] }` |
| `fetchRoads(data)` | `POST /futureInfra/ShowFutureRoads` | `RoadPagination` | `PaginationResponse<FutureRoads>` |
| `addFutureRoad(road)` | `POST /futureInfra/addFutureRoads` | `RoadFilter` (Id/Name/Classification) | `RoadFilter` |
| `editFutureRoad(road)` | `POST /futureInfra/editFutureRoads` | `FutureRoads` | `FutureRoads` |
| `deleteFutureRoad(roadId)` | `POST /futureinfra/DeleteFutureRoad` | `{ RoadId: string }` | `{ success: boolean }` |
| `fetchRoadSectionInitData()` | `POST /futureinfra/InitFilterFutureRoadSections` | — | `{ DEOs: RODEOEnum[] }` |
| `fetchRoadSectionData(data)` | `POST /futureinfra/ShowFutureRoadSections` | `RoadSectionPagination` | `PaginationResponse<FutureRoadSections>` |
| `addFutureRoadSection(section)` | `POST /futureinfra/addFutureRoadSections` | `RoadSectionFilter` | — |
| `editFutureRoadSection(section)` | `POST /futureinfra/editFutureRoadSections` | `FutureRoadSections` | `FutureRoadSections` |
| `deleteFutureRoadSection(id)` | `POST /futureinfra/DeleteFutureRoadSection` | `{ RoadSectionId: string }` | `{ success: boolean }` |
| `fetchBridgeInitData()` | `POST /futureinfra/InitFilterFutureBridge` | — | `{ DEOs: RODEOEnum[] }` |
| `fetchBridgeData(data)` | `POST /futureinfra/ShowFutureBridge` | `BridgePagination` | `PaginationResponse<FutureBridge>` |
| `addFutureBridge(bridge)` | `POST /futureinfra/addFutureBridge` | `BridgeFilter` | — |
| `editFutureBridge(bridge)` | `POST /futureinfra/editFutureBridge` | `FutureBridge` | `FutureBridge` |
| `deleteFutureBridge(id)` | `POST /futureinfra/DeleteFutureBridge` | `{ BridgeId: string }` | `{ success: boolean }` |
| `getInfraCounts()` | `POST FutureInfra/GetInfraInfo` | — | `{ Roads: number; RoadSections: number; Bridge: number }` |

### GIS API Endpoints (`gisClient.put` via `VITE_API_GIS_URL`)

All GIS calls append `?username={encodeURIComponent(userName)}` as a query param (username sourced from `useAuth`). Headers include `ngrok-skip-browser-warning: true`. The GIS service (see its `/docs` OpenAPI schema) only exposes two import endpoints — there is no per-entity import, so `ImportDialog` collapses all checkbox selections down to these two calls.

| Function | Path | Purpose | Triggered by (ImportDialog checkboxes) |
|---|---|---|---|
| `importAllInfrastructure(userName)` | `PUT /infra_inventory/import_all` | Imports roads, road sections, and bridges from GIS in one call | Roads, Road Section, Bridges, Region (any one checked fires this once) |
| `importAdminOrgLookups(userName)` | `PUT /admin_org_mgmt/import_aams_ioms` | Imports admin area + implementing office lookup data in one call | City/Municipality-Legislative District, DEO-Implementing Office (any one checked fires this once) |

---

## `Model.d.ts` — Type Reference

### `FutureRoads`

```ts
interface FutureRoads {
  Id: number;
  NetworkStatusId: number;
  InfraExistingOrFutureId: number;
  RoadId: string;              // Format: FR{5digits}{IslandCode}  e.g. FR00001LZ
  Name: string;
  Classification: number;      // 1=Primary, 2=Secondary, 3=Tertiary, 4=Quaternary
  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string;
}
```

### `FutureRoadSections`

```ts
interface FutureRoadSections {
  Id: number;
  NetworkStatusId: number;
  InfraExistingOrFutureId: number;
  RoadId: string;              // FK to parent FutureRoads.RoadId
  RoadSectionId: string;       // Format: FS{5digits}{IslandCode}  e.g. FS00001LZ
  RoadLength: number;          // in metres
  DEO: string;                 // FK to RODEOEnum.ParticipantId
  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string;
}
```

### `FutureBridge`

```ts
interface FutureBridge {
  Id: number;
  NetworkStatusId: number;
  InfraExistingOrFutureId: number;
  RoadSectionId: string;       // FK to parent FutureRoadSections.RoadSectionId
  BridgeId: string;            // Format: FB{5digits}{IslandCode}  e.g. FB00001LZ
  Name: string;
  From: number;                // Starting chainage in metres
  Length: number;              // Bridge length in metres
  CarriageWay?: number;        // Number of carriage ways
  OverallWidth: number;        // Total width in metres
  CreatedBy: string;
  CreatedDate: string | null;
  UpdatedBy?: string;
  UpdatedDate?: string;
}
```

### Filter / Pagination Interfaces

```ts
interface RoadFilter     { RoadId?: string; Name?: string; Classification?: string; }
interface RoadSectionFilter { RoadId?: string; RoadSectionId?: string; DEO?: string; RoadLength?: string; }
interface BridgeFilter   { RoadSectionId?: string; BridgeId?: string; Name?: string; From?: number; Length?: number; CarriageWay?: number; }

interface RoadPagination extends PaginationParams        { filters?: RoadFilter; sortField?: string; sortDirection?: 0 | 1; }
interface RoadSectionPagination extends PaginationParams { filters?: RoadSectionFilter; sortField?: string; sortDirection?: 0 | 1; }
interface BridgePagination extends PaginationParams      { filters?: BridgeFilter; sortField?: string; sortDirection?: 0 | 1; }
```

### `FutureRoadsClassification`

```ts
interface FutureRoadsClassification { Id: number; Classification: number; Description: string; CreatedBy: string; CreatedDate: string; }
```

---

## Custom Hooks

All three hooks follow the same contract pattern. Here is `useRoadData` as the canonical reference:

### Common Hook Return Shape

```ts
{
  // State (read from atoms)
  roadData: PaginationResponse<FutureRoads>;
  roadFilters: RoadPagination;
  roadClassifications: FutureRoadsClassification[];
  initRoadSections: RODEOEnum[];       // DEO list, shared with road section hook
  isLoading: boolean;
  searchInput: string;
  hasActiveFilters: boolean;           // Derived atom — true if any filter is non-empty

  // Data actions
  initializeData(): Promise<void>;     // Fetches init enums + initial page data in parallel
  fetchRoadData(filters?): Promise<void>;
  handleSearch(searchTerm): Promise<void>;
  handleSearchInputChange(value): void;
  handleSearchSubmit(): Promise<void>;
  handleClearSearch(): Promise<void>;
  handlePagination(page): Promise<void>;
  handleSort(field, direction: 'asc'|'desc'): Promise<void>;
  handleFilterChange(newFilters): Promise<void>;

  // Optimistic updates (modify atom state without re-fetch)
  removeRoadFromState(roadId): void;
  addRoadToState(newRoad): void;
  updateRoadInState(updatedRoad): void;

  // Direct setters (escape hatch)
  setSearchInput(value): void;
  updateRoadFilters(partial): void;
  clearRoadFilters(): void;
}
```

### Initialization Pattern

Each hook's `initializeData` fires multiple parallel requests:

- **`useRoadData`**: `Promise.all([fetchRoadInitData(), fetchRoadSectionInitData(), fetchRoads(filters)])`
  - Loads road classifications + DEO list + first page of roads simultaneously.
- **`useRoadSectionData`**: `Promise.all([fetchRoadSectionData(filters), fetchRoadSectionInitData()])`
- **`useBridgeData`**: `Promise.all([fetchBridgeData(filters), fetchBridgeInitData()])`

### Optimistic Update Pattern

On delete:
1. Dialog calls API → success → calls `onSubmit(id)`.
2. Component calls `removeXFromState(id)` → write-only atom removes row from current paginated list.
3. No re-fetch triggered. `total` is decremented by 1.

On add/edit:
- `addRoadToState` prepends to `lists`, increments `total`.
- `updateRoadInState` replaces matching row in `lists` by `RoadId`.

---

## `Views/Rbia.tsx` — Root Component

### State

| State | Purpose |
|---|---|
| `selectedTab` | `'roads' \| 'roadSections' \| 'bridges'` — controls which component is rendered |
| `importDialogOpen` | `boolean` — controls `ImportDialog` |
| `roadCount`, `roadSectionCount`, `bridgeCount` | `number` — badge counts on tab buttons |

### Initialization

On mount: `getInfraCounts()` → `POST FutureInfra/GetInfraInfo` → sets all three badge counts.

> Counts come from the server, not from the paginated atoms. This is intentional — counts represent the total inventory, not just the current filtered page.

### Tab Switching

`getTableData(tabName)` sets `selectedTab`. Individual components call their own `initializeData()` on mount via `useEffect`. Switching tabs does re-mount the component (no keep-alive), so returning to a tab re-fetches its data.

---

## Components

### `Road.tsx` (`FutureRoadList`)

**Dialog triggers per row:**
- Yellow pencil → `handleEdit(road)` → sets `selectedItemAtom = road` → opens `FutureRoadDialog`
- Red trash → `handleDelete(road)` → opens `DeleteRoadDialog` with `roadToDelete` state
- Blue "Add Section" → `handleAddSection(road)` → opens `FutureRoadSectionDialog` with `road` prop pre-filled

**Table columns:** Road ID (blue badge) | Road Name | Classification (green badge, label-mapped) | Actions

**Add Road button**: enabled. Calls `handleCreate()` → clears `selectedItemAtom` → opens `FutureRoadDialog` in add mode.

**Columns sortable:** Road ID, Road Name, Classification (local `sortField`/`sortDirection` state, passed to `handleSort`).

### `RoadSection.tsx` (`RoadSectionList`)

**Dialog triggers per row:**
- Yellow pencil → `handleEdit(section)` → opens `FutureRoadSectionDialog` in edit mode
- Red trash → `handleDelete(section)` → opens `DeleteRoadSectionDialog`
- Blue "Add Bridge" → `handleAddBridge(section)` → opens `FutureBridgeDialog` with `roadSection` prop pre-filled

**Table columns:** Section Road ID (purple badge) | Road ID (blue badge) | Length (m) | Engineering District (orange badge, resolved via `initRoadSections.find(d => d.ParticipantId === section.DEO)?.Name`) | Actions

**Add Road Section standalone button**: commented out. Sections can only be created from the Road tab's "Add Section" button.

### `Bridge.tsx` (`FutureBridgeList`)

**Dialog triggers per row:**
- Yellow pencil → `handleEdit(bridge)` → opens `FutureBridgeDialog` in edit mode
- Red trash → `handleDelete(bridge)` → opens `DeleteBridgeDialog`

**Table columns:** Section Road ID (blue badge) | Bridge Name | Bridge ID (purple badge) | From (m) | Length (m) | Carriage Way | Actions

**No "Add Bridge" standalone button** — bridges are created from the Road Sections tab's "Add Bridge" button only.

---

## Dialog Catalog

### `FutureRoadDialog`

- Dual-mode: add (when `selectedItemAtom === null`) or edit (when `selectedItemAtom` is a `FutureRoads`).
- Required fields: Road ID, Road Name, Classification (dropdown from `roadClassificationsAtom`).
- Road ID format guidance: `FR{5-digit-number}{IslandCode}` (e.g., `FR00001LZ`, `FR00002VS`).
- Add payload sent to `addFutureRoad`: `{ RoadId, Name, Classification: string }`.
- Edit payload sent to `editFutureRoad`: full `FutureRoads` object.

### `FutureRoadSectionDialog`

- Can be opened two ways:
  - From a Road row ("Add Section"): `road` prop provided — `RoadId` pre-filled + read-only display shows `RoadId - Name`.
  - From Road Section row (edit): `selectedItemAtom` populated — form pre-filled from selected section.
- **RoadSectionId auto-generation**: user types 5 digits (`sectionDigits` state). Island code is extracted from `formData.RoadId` via regex `/[A-Za-z]+$/`. Combined: `FS{padded(5)}{islandCode}` — updates live as user types.
- DEO field: `SearchableDropdown` populated from `initRoadSections` (from `deoListAtom`).
- Add payload: `{ RoadId, RoadSectionId, RoadLength: string, DEO }`.
- Edit payload: full `FutureRoadSections` object.

### `FutureBridgeDialog`

- Can be opened two ways:
  - From a Road Section row ("Add Bridge"): `roadSection` prop provided — `RoadSectionId` pre-filled + read-only.
  - From Bridge row (edit): `selectedItemAtom` populated.
- **BridgeId auto-generation**: user types 5 digits (`bridgeDigits` state). Island code extracted from `formData.RoadSectionId`. Combined: `FB{padded(5)}{islandCode}`.
- Required fields (checked on submit): `RoadSectionId`, `Name`, `From`, `Length`, `CarriageWay`.
- Add payload: `{ RoadSectionId, BridgeId, Name, From, OverallWidth, NetworkStatusId, InfraExistingOrFutureId, Length, CarriageWay }`.

### Delete Dialogs (all three follow same pattern)

See `DELETE_OPERATIONS.md` for the full pattern. Summary:
1. User types `delete` (case-insensitive) in the confirmation field.
2. API call made inside the dialog.
3. On success: `onSubmit(id)` called → parent calls `removeXFromState(id)` → success toast.
4. On error: error toast, state unchanged.

### Filter Dialogs

| Dialog | Fields |
|---|---|
| `FilterRoadDialog` | Road ID (text), Road Name (text), Classification (text — numeric value) |
| `FilterRoadSectionDialog` | Road ID (text), Section Road ID (text), DEO (`SearchableDropdown` from `deoList` prop) |
| `FilterBridgeDialog` | Section Road ID (text), Bridge ID (text), Bridge Name (text) |

All three re-sync from `initialData` on open. Clear button resets fields + calls `onClear`. Active filter count badge shown on Filter button in orange.

### `ImportDialog`

Tree-grouped checkbox selection dialog with three groups:

| Group | Items |
|---|---|
| Import Road Network Data from RBIA | Roads, Road Section, Bridges, Region |
| Import Lookup tables from Admin Areas | City/Municipality, Legislative District |
| Import Lookup tables from Internal Org | DEO, Implementing Office |

- Each group has an `IndeterminateCheckbox` (select-all / partial) header.
- On submit: `Promise.all` fires `importAllInfrastructure` (if any of Roads/Road Section/Bridges/Region checked) and/or `importAdminOrgLookups` (if any of City/Municipality-Legislative District/DEO-Implementing Office checked) — at most one call per group regardless of how many items within it are checked. Username from `useAuth` context.
- Calls GIS API directly via `gisClient` (PUT) with `ngrok-skip-browser-warning` header (development/staging environment assumption).

---

## ID Convention Reference

| Entity | Format | Example | Island Code source |
|---|---|---|---|
| Road | `FR{5d}{IslandCode}` | `FR00001LZ` | Entered by user |
| Road Section | `FS{5d}{IslandCode}` | `FS00001LZ` | Auto-extracted from parent Road ID |
| Bridge | `FB{5d}{IslandCode}` | `FB00001LZ` | Auto-extracted from parent Road Section ID |

Island code is the trailing alphabetic suffix: regex `/[A-Za-z]+$/`.

---

## Classification Label Map

| Value | Label |
|---|---|
| 1 | Primary |
| 2 | Secondary |
| 3 | Tertiary |
| 4 | Quaternary |

---

## Known Issues / Notes

- **Tab re-mounts on switch**: Each time a tab is clicked, the component re-mounts and `initializeData()` re-fetches data. There is no keep-alive or data caching between tab switches.
- **Counts vs. paginated totals**: `roadCount`, `roadSectionCount`, `bridgeCount` on the tab badges come from `getInfraCounts()` (fetched once on mount). They do not update after add/delete operations. The paginated `total` inside the data atom is updated optimistically and shown in the per-component footer.
- **Add Road Section / Add Bridge standalone**: Both "Add Road Section" and "Add Bridge" standalone buttons are commented out in `RoadSection.tsx` and `Bridge.tsx`. These entities can only be created from their parent entity row ("Add Section" on Road, "Add Bridge" on Road Section).
- **Import checkboxes are UI-only granularity**: The GIS API has no per-entity import — only "import all infrastructure" and "import all admin/org lookups". So checking just "Roads" still imports road sections and bridges too (and vice versa); same for the two admin/org checkboxes.
- **`FutureRoadDialog` optimistic add**: After `addFutureRoad` succeeds, the dialog pushes `formData` to the legacy `roadsAtom` array but does NOT update the paginated `roadDataAtom`. This means the table does not show the new road until a re-fetch. The `addRoadToState` optimistic helper exists in the hook but is not called from the dialog currently.
- **Classification in add payload is sent as string**: `addFutureRoad` sends `{ Classification: formData.Classification.toString() }`. Edit sends the numeric value. Inconsistency with the API — may cause issues.
- **`deoListAtom` shared between Road and Road Section hooks**: Both `useRoadData.initializeData` and `useRoadSectionData.initializeData` both call `fetchRoadSectionInitData()` and write to `deoListAtom`. Whichever resolves last wins. Since both fetch the same data, this is harmless but redundant.