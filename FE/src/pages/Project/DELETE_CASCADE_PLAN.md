# Delete Cascade Fix Plan

## Overview

Three-level hierarchy: **ComponentCost → MajorItemOfWork → MajorItemLocations (WorkLocations)**

Delete rule: **If `Id === 0` (unsaved/user-created) → hard delete (remove from array). If `Id > 0` (from database) → soft delete (`IsDeleted: true`).**

---

## Current State & Issues

### Level 1: ComponentCost Delete (`ProjectForm.handleDeleteComponentCost`)
**File:** `ProjectForm.tsx` lines 388–449

| Scenario | Current Behavior | Status |
|----------|-----------------|--------|
| Hard delete (`Id === 0`) | Removes cost from array, removes per-year costs, **cascades hard delete to MajorItems** (filters out by `ComponentId`) | ⚠️ BUG — hard-deletes ALL matching MajorItems regardless of their own `Id`. Items with `Id > 0` should be soft-deleted, not removed. |
| Soft delete (`Id > 0`) | Sets `IsDeleted: true`, soft-deletes per-year costs, **cascades soft delete to MajorItems AND their MajorItemLocations** | ⚠️ BUG — soft-deletes ALL matching MajorItems/Locations regardless of their `Id`. Items with `Id === 0` should be hard-deleted (removed), not soft-deleted. |
| Confirmation dialog | Shows count of related major items via `DeleteComponentDialog` | ✅ OK |

### Level 1.5: ComponentCostPerYear Delete (inside ComponentCostDialog & cascade)
**Files:** `ComponentCostDialog.tsx` (handleDeletePerYearCost) & `ProjectForm.tsx` (cascade in handleDeleteComponentCost)

**Model:** `ComponentCostPerYear` has `Id: number` and `IsDeleted: boolean` — same pattern as other entities.

| Scenario | Current Behavior | Status |
|----------|-----------------|--------|
| Dialog delete (`handleDeletePerYearCost`) | Always sets `IsDeleted: true` regardless of `Id` | ⚠️ BUG — items with `Id === 0` should be hard-deleted (removed from array), not soft-deleted. The soft-deleted `Id === 0` items will be sent to backend unnecessarily. |
| Cascade from ComponentCost hard delete (`Id === 0`) | Removes ALL per-year costs matching `ComponentCostId` from array | ⚠️ PARTIAL — removes everything, which is fine for `Id === 0` children but loses `Id > 0` children that need soft-delete for backend. |
| Cascade from ComponentCost soft delete (`Id > 0`) | Sets `IsDeleted: true` on ALL per-year costs matching `ComponentCostId` | ⚠️ BUG — items with `Id === 0` should be hard-deleted (removed), not soft-deleted. |

### Level 2: MajorItemOfWork Delete (`ProjectForm.handleDeleteMajorItem`)
**File:** `ProjectForm.tsx` lines 488–505

| Scenario | Current Behavior | Status |
|----------|-----------------|--------|
| Hard delete (`Id === 0`) | Removes item from array | ⚠️ BUG — does NOT cascade to MajorItemLocations. If any child locations have `Id > 0`, they are lost (never sent to backend for soft-delete). |
| Soft delete (`Id > 0`) | Sets `IsDeleted: true` on the MajorItem only | ⚠️ BUG — does NOT cascade to MajorItemLocations. Child locations remain with `IsDeleted: false`, so backend may not know to delete them. |
| Confirmation dialog | `DeleteMajorItemDialog` shows work location count warning | ✅ OK (warning shown, but delete logic is incomplete) |

### Level 3: WorkLocation Delete (`MajorItemOfWorksForm.handleDeleteWorkLocation`)
**File:** `MajorItemOfWorksForm.tsx` lines 241–260

| Scenario | Current Behavior | Status |
|----------|-----------------|--------|
| Hard delete (`Id === 0`) | Removes location from array (`.filter`) | ✅ OK |
| Soft delete (`Id > 0`) | Sets `IsDeleted: true` | ✅ OK |

---

## Fixes Required

### Fix 1: `handleDeleteComponentCost` — Mixed Id cascade (ComponentCost → PerYear + MajorItem → Locations)
**Problem:** When a ComponentCost is deleted, the cascade to PerYear costs, MajorItems, and WorkLocations does not respect the `Id` of each child entity individually.

**Fix — unified cascade logic regardless of parent Id:**
```
Step 1: Delete ComponentCost itself
  - If ComponentCost.Id === 0 → remove from array (hard delete)
  - If ComponentCost.Id > 0 → set IsDeleted: true (soft delete)

Step 2: Cascade to ComponentCostPerYear (matching by ComponentCostId)
  - For each PerYear cost:
      - If PerYear.Id === 0 → remove from array (hard delete)
      - If PerYear.Id > 0 → set IsDeleted: true (soft delete)

Step 3: Cascade to MajorItems (matching by ComponentId)
  - For each related MajorItem:
      - First, cascade to its MajorItemLocations (Step 3a)
      - Then decide MajorItem fate (Step 3b)

  Step 3a: Cascade MajorItem → MajorItemLocations
      - For each Location:
          - If Location.Id === 0 → remove from Locations array (hard delete)
          - If Location.Id > 0 → set IsDeleted: true (soft delete)

  Step 3b: Delete MajorItem itself
      - If MajorItem.Id === 0 AND no remaining soft-deleted children (all were hard-deleted)
          → remove MajorItem from array (hard delete)
      - If MajorItem.Id === 0 BUT has soft-deleted children (Id > 0 locations)
          → keep MajorItem, set IsDeleted: true (must preserve for backend)
      - If MajorItem.Id > 0
          → set IsDeleted: true (soft delete)
```

### Fix 2: `handleDeleteMajorItem` — Missing cascade to WorkLocations
**Problem:** Deleting a MajorItem does not cascade to its MajorItemLocations at all.

**Fix — same pattern as cascade logic above:**
```
Step 1: Cascade to MajorItemLocations first
  - For each Location:
      - If Location.Id === 0 → remove from array (hard delete)
      - If Location.Id > 0 → set IsDeleted: true (soft delete)

Step 2: Delete MajorItem itself
  - If MajorItem.Id === 0 AND no remaining soft-deleted children
      → remove from array (hard delete)
  - If MajorItem.Id === 0 BUT has soft-deleted children (Id > 0 locations)
      → keep MajorItem, set IsDeleted: true (preserve for backend)
  - If MajorItem.Id > 0
      → set IsDeleted: true (soft delete)
```

### Fix 3: `handleDeletePerYearCost` in ComponentCostDialog — Always soft-deletes
**Problem:** Inside the ComponentCostDialog, when a user deletes a per-year cost row, it always sets `IsDeleted: true` even for `Id === 0` items. These ghost soft-deleted items with `Id === 0` get sent to the backend unnecessarily.

**Fix:**
```
  - If PerYear.Id === 0 → remove from local state array (hard delete)
  - If PerYear.Id > 0 → set IsDeleted: true (soft delete)
```

### Fix 4: No changes needed for WorkLocation delete (Level 3)
Already correctly implements hard/soft delete in `MajorItemOfWorksForm.handleDeleteWorkLocation`. ✅

---

## Helper Function (DRY)
Since the same "cascade delete with Id check" pattern repeats in multiple places, consider extracting a reusable helper:

```typescript
/** Process MajorItemLocations for delete: hard-delete Id===0, soft-delete Id>0 */
function cascadeDeleteLocations(locations: MajorItemLocations[]): MajorItemLocations[] {
  return locations
    .filter(loc => loc.Id !== 0) // Remove hard-deletable items
    .map(loc => ({ ...loc, IsDeleted: true })); // Soft-delete the rest
}

/** Process a MajorItem for delete: cascade to locations first, then decide fate */
function cascadeDeleteMajorItem(item: MajorItemOfWorksWithDropdown): MajorItemOfWorksWithDropdown | null {
  const processedLocations = cascadeDeleteLocations(item.MajorItemLocations || []);
  
  if (item.Id === 0 && processedLocations.length === 0) {
    return null; // Hard delete — caller should filter out nulls
  }
  
  return {
    ...item,
    IsDeleted: true,
    MajorItemLocations: processedLocations
  };
}
```

---

## Implementation Checklist

- [x] **Fix `handleDeletePerYearCost` in `ComponentCostDialog.tsx`** — Hard-delete `Id === 0`, soft-delete `Id > 0`
- [x] **Fix `handleDeleteComponentCost` in `ProjectForm.tsx`** — Respect individual child `Id` values when cascading to PerYear costs, MajorItems, and Locations
- [x] **Fix `handleDeleteMajorItem` in `ProjectForm.tsx`** — Add cascade to MajorItemLocations with proper hard/soft logic
- [ ] **Test scenarios:**
  - Delete per-year cost (Id=0) in dialog → removed from array, not soft-deleted
  - Delete per-year cost (Id>0) in dialog → IsDeleted: true
  - Delete new ComponentCost (Id=0) with new PerYear (Id=0), new MajorItems (Id=0), new Locations (Id=0) → all hard-deleted
  - Delete new ComponentCost (Id=0) with existing PerYear/MajorItems (Id>0) and mixed Locations → proper mixed handling
  - Delete existing ComponentCost (Id>0) with new PerYear (Id=0) → new per-year removed, existing soft-deleted
  - Delete existing ComponentCost (Id>0) with new MajorItems (Id=0) → new items hard-deleted, existing soft-deleted
  - Delete existing MajorItem (Id>0) with mixed Locations → locations properly cascaded
  - Delete new MajorItem (Id=0) with existing Locations (Id>0) → MajorItem kept as soft-delete to preserve child soft-deletes
  - Delete new MajorItem (Id=0) with only new Locations (Id=0) → all hard-deleted

---

## Files to Modify

1. `FE/src/pages/Project/dialogs/ComponentCostDialog.tsx`
   - `handleDeletePerYearCost` — add Id check for hard vs soft delete
2. `FE/src/pages/Project/components/ProjectForm.tsx`
   - `handleDeleteComponentCost` (lines ~388–449) — fix cascade to PerYear, MajorItems, Locations
   - `handleDeleteMajorItem` (lines ~488–505) — add cascade to MajorItemLocations
