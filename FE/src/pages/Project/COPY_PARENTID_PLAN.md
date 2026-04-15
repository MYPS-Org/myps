# Plan: Fix ParentId Handling in Work Location Copy

## Problem

When a work location is copied via `handleCopyWorkLocation` in `WorkLocationTable.tsx`,
the function spreads `...locationToCopy`. This carries over `ParentId` directly from the
**source location's stored value** instead of using the current authoritative value from props.

This is inconsistent with how new work locations are added:
- `handleAddWorkLocation` → explicitly sets `ParentId: parentId` (from props ✅)
- `handleInfraSelect` (new) → explicitly sets `ParentId: parentId` (from props ✅)
- `handleCopyWorkLocation` → inherits `ParentId` via spread (from stale source ❌)

`parentId` prop is always `item.ReferenceId` — the current, authoritative identifier of
the parent `MajorItemOfWork`. The spread-sourced value can become stale.

---

## Two Scenarios

### Scenario 1 — Parent major item is NEW (not yet saved to DB)

- `MajorItemOfWork.ReferenceId = "temp_1234abc..."` (generated client-side)
- `parentId` prop = `"temp_1234abc..."`
- Source work location: `ParentId = "temp_1234abc..."`

**Expected copy behavior:**
`ParentId` of the copy = `"temp_1234abc..."` (same temp, correct parent link)

**How to achieve:**
Use `ParentId: parentId` from props. Since the prop and the source value are the same
in this scenario, the fix has no adverse effect.

---

### Scenario 2 — Parent major item EXISTS in DB (loaded from API response)

- `MajorItemOfWork.ReferenceId = "PROJ-2024-ABC"` (real DB value)
- `parentId` prop = `"PROJ-2024-ABC"`
- Source work location: `ParentId = "PROJ-2024-ABC"`

**Expected copy behavior:**
`ParentId` of the copy = `"PROJ-2024-ABC"` (real DB reference, correct parent link)

**How to achieve:**
Use `ParentId: parentId` from props — guarantees the real DB value regardless of what
the source location stored.

---

## Root Cause Summary

| Handler                | `ParentId` source   | Correct? |
|------------------------|---------------------|----------|
| `handleAddWorkLocation`| `parentId` (props)  | ✅       |
| `handleInfraSelect`    | `parentId` (props)  | ✅       |
| `handleCopyWorkLocation` | `...locationToCopy` (spread) | ❌ — can inherit stale/wrong temp ID |

---

## Fix

In `WorkLocationTable.tsx`, update `handleCopyWorkLocation` to explicitly set `ParentId`
from the prop rather than relying on the spread:

```ts
// BEFORE
const copiedLocation: MajorItemLocations = {
  ...locationToCopy,
  Id: 0,
  InfraId: ...,
  DetailedScope: ...,
  IsDeleted: false
};

// AFTER
const copiedLocation: MajorItemLocations = {
  ...locationToCopy,
  Id: 0,
  ParentId: parentId, // Always use props — not the spread value from the source location
  InfraId: ...,
  DetailedScope: ...,
  IsDeleted: false
};
```

---

## Affected File

- `FE/src/pages/Project/components/WorkLocationTable.tsx`
  — `handleCopyWorkLocation` function (~line 247)

## Out of Scope

- Copying an entire `MajorItemOfWork` row (no such feature exists yet)
- `Id: 0` uniqueness — operations use array index, not `Id`, so collisions are not an issue
- `InfraId` deduplication — already handled by `shouldAutoGenerateInfraId`
