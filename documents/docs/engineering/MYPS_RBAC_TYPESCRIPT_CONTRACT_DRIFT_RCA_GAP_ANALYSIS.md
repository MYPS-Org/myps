# RBAC TypeScript Contract Drift — RCA & Gap Analysis

**Date:** 2026-09-09
**Scope:** `FE/src/pages/Rbac/` — 22 `tsc -b` compile errors, found while verifying an unrelated fix
**Status:** Root-caused, not fixed. This document is a handoff for whoever picks up the fix.

## Summary

`npm run typecheck` (`tsc -b`) currently fails with 22 errors, all inside the RBAC module. They trace
to exactly **3 root causes**, not 22 independent bugs:

| # | Errors | Files | Cause | Fix complexity |
|---|---|---|---|---|
| 1 | 7 | `ApiPermissionsTab.tsx`, `FilterPermissionDialog.tsx` | `PermissionFilter` fields renamed on 2026-08-30, these 2 files missed | Low — mechanical 3-field rename |
| 2 | 8 | `UserGroupsTab.tsx`, `FilterUserGroupDialog.tsx`, `Rbac.tsx`, `useRbac.ts` | `UserGroupFilter` fields renamed on 2026-08-30, **and** the backend never implemented filtering on the new fields | Medium/High — needs backend work + a UI redesign, not just a rename |
| 3 | 1 | `AppModuleTab.tsx` | Unrelated, ~5-month-old type-looseness bug (`RouteName` optional when it's always set) | Low — tighten a type or add a non-null assertion |

**Production builds have been broken since 2026-08-30** (`npm run build` runs `tsc -b && vite build` —
`tsc -b` fails, so `vite build` never runs). **`npm run dev` is unaffected** — Vite/SWC transpiles
per-file without type-checking, so the app runs fine in dev mode; the RBAC filter UI just silently
sends dead JSON keys the backend ignores. That's almost certainly why this went unnoticed for over a
week — nobody hit a broken production build until this typecheck was run tonight for an unrelated
reason.

**Recommended fix order:** #3 first (fully isolated, zero dependencies) → #1 (mechanical, safe) → #2
last (needs a product/backend decision before the UI work is worth doing — see below).

---

## Root Cause 1 — `PermissionFilter` field rename, frontend not updated

**7 errors**, in `FE/src/pages/Rbac/components/ApiPermissionsTab.tsx` and
`FE/src/pages/Rbac/dialogs/FilterPermissionDialog.tsx`.

### What changed

Commit `204a909f` (2026-08-30, *"Refactor User Management and Add Validation"*) renamed the fields on
`PermissionFilter` in `FE/src/pages/Rbac/Model.d.ts`:

```diff
 export interface PermissionFilter {
-    Module?: string;
-    ModuleFunction?: string;
-    ModuleFunctionDescription?: string;
+    ControllerName?: string;
+    ActionName?: string;
+    ControllerDescription?: string;
 }
```

This was a **deliberate, correct contract change** — the same commit renamed the matching backend DTO
(`WebAPI/Controllers/Settings/UserManagement/DTOPermissions.cs`):

```csharp
public class ShowPermissionFilterDTO
{
    public string? ControllerName { get; set; }
    public string? ActionName { get; set; }
    public string? ControllerDescription { get; set; }
}
```

`ApiPermissionsTab.tsx` and `FilterPermissionDialog.tsx` were simply not updated in that commit.

### Confirmed: the backend already works with the new names

`WebAPI/Controllers/Settings/UserManagement/UserManagementController.cs:953-960` already filters on
`ControllerName`/`ActionName`/`ControllerDescription`. Filtering will work correctly the moment the
frontend catches up — this is not blocked on any backend work.

### Where it breaks

**`ApiPermissionsTab.tsx`** (lines 41-48) — an "active filter" badge/count reads the old field names:

```ts
const hasActiveFilter =
    !!(filter.filters?.Module || filter.filters?.ModuleFunction || filter.filters?.ModuleFunctionDescription);

const activeFilterCount = [
    filter.filters?.Module,
    filter.filters?.ModuleFunction,
    filter.filters?.ModuleFunctionDescription,
].filter(Boolean).length;
```

**`FilterPermissionDialog.tsx`** — the filter dialog's local form state, its reset effect, `handleClear`,
and the final submit are all built around the old names:

```ts
const [formData, setFormData] = useState({
  Module: initialData?.Module || '',
  ModuleFunction: initialData?.ModuleFunction || '',
  ModuleFunctionDescription: initialData?.ModuleFunctionDescription || ''
});
...
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onSubmit(formData);   // TS2559: shares zero keys with the current PermissionFilter
  onClose();
};
```

The 3 `<input>` fields in this dialog's JSX are also wired to these dead state keys, and are labeled
"Module" / "Module Function" / "Description" — those labels should become something like "Controller
Name" / "Action Name" / "Description" to match the new backend semantics.

### Fix

Rename `Module`→`ControllerName`, `ModuleFunction`→`ActionName`, `ModuleFunctionDescription`→
`ControllerDescription` throughout both files — state keys, JSX bindings, and (for the dialog) the
visible field labels. No backend changes needed. Low risk.

---

## Root Cause 2 — `UserGroupFilter` field rename, and a backend feature gap underneath

**8 errors**, in `FE/src/pages/Rbac/components/UserGroupsTab.tsx`,
`FE/src/pages/Rbac/dialogs/FilterUserGroupDialog.tsx`, `FE/src/pages/Rbac/Rbac.tsx`, and
`FE/src/pages/Rbac/useRbac.ts` (3 separate call sites).

### What changed

The same commit (`204a909f`, 2026-08-30) also changed `UserGroupFilter`:

```diff
 export interface UserGroupFilter {
     GroupName?: string;
-    PermissionNames?: string; // Use string for searching permission names
+    PermissionActionIds?: number[];
+    PermissionViewIds?: number[];
 }
```

paired with the backend DTO (`WebAPI/Controllers/Settings/UserManagement/DTOUserGroups.cs`):

```csharp
public class UserGroupFilterDTO
{
    public string? GroupName { get; set; }
    public int[]? PermissionActionIds { get; set; }
    public int[]? PermissionViewIds { get; set; }
}
```

**This is not a like-for-like rename** — it's a genuine shape change, from "search by permission name
text" to "filter by specific permission ID arrays."

### The real gap: the backend doesn't act on the new fields either

`UserManagementController.cs`'s `ShowUserGroups` endpoint (`:1311-1317`) — the endpoint that actually
answers "show me user groups matching this filter" — only ever wires `GroupName` into its SQL filter.
`PermissionActionIds`/`PermissionViewIds` exist on the DTO, but nothing in `ShowUserGroups` reads them.
They're only consumed elsewhere, in `UpdateUserGroup`, for a completely different purpose (assigning
role/permission grants to a group after it's found — not for finding groups in the first place).

**Practical consequence: "filter user groups by permission" is a dead feature end-to-end, both before
and after any frontend fix.** Fixing only the frontend compile errors would make the code build, but
the filter would still do nothing, because the backend has never implemented it.

### Where it breaks (frontend)

**`UserGroupsTab.tsx`** (lines 51-53) — same "active filter" badge pattern as Root Cause 1:

```ts
const hasActiveFilter = !!(filter.filters?.GroupName || filter.filters?.PermissionNames);
const activeFilterCount = [filter.filters?.GroupName, filter.filters?.PermissionNames].filter(Boolean).length;
```

**`FilterUserGroupDialog.tsx`** — a free-text "Permission Name" input, which doesn't match the new
ID-array shape at all:

```ts
const [formData, setFormData] = useState({
  GroupName: initialData?.GroupName || '',
  PermissionNames: initialData?.PermissionNames || '',
});
...
<input type="text" value={formData.PermissionNames} onChange={(e) => handleChange('PermissionNames', e.target.value)}
  placeholder="Enter permission name" .../>
```

This dialog needs an actual UI redesign — a multi-select against `PermissionActionIds`/
`PermissionViewIds` (the same permission-action/permission-view lists `useRbac.ts` already fetches for
other dropdowns), not a text input.

**`Rbac.tsx`** (line 333) and **`useRbac.ts`** (lines 57, 86, 159) — 4 more sites constructing
`{ GroupName: '', PermissionNames: '' }`-shaped filter objects (initial state, initial fetch, and the
`handleClear` reset).

### Fix — needs a decision before UI work starts

This isn't just a frontend patch. Two things need to happen, and the order matters:

1. **Backend**: add `PermissionActionIds`/`PermissionViewIds` filtering logic to `ShowUserGroups` (a
   join against whatever table maps groups to their granted permission actions/views).
2. **Frontend**: redesign `FilterUserGroupDialog.tsx`'s permission filter as a multi-select of IDs, and
   update the 4 other call sites to the new field names.

Doing only the frontend rename (to unblock the build) without the backend work would compile clean but
ship a filter that silently does nothing — worth flagging to whoever owns this, so it's a conscious
choice, not a surprise later. Recommend confirming with the operator/product owner whether this filter
is actually wanted before investing in the redesign, or whether it should just be removed from
`FilterUserGroupDialog.tsx` for now (in which case only the 4 mechanical `useRbac.ts`/`Rbac.tsx`/
`UserGroupsTab.tsx` reference removals are needed, which is safe and low-risk on its own).

---

## Root Cause 3 — `AppModuleTab.tsx:161`, unrelated and older

**1 error**, unconnected to the other two — different commits, ~5 months earlier.

```
src/pages/Rbac/components/AppModuleTab.tsx(161,46): error TS2345:
Argument of type '{ RouteName: string | undefined; path: string; }[]' is not assignable to
parameter of type '{ RouteName: string; path: string; }[]'.
```

### The code

`FE/src/pages/Rbac/components/AppModuleTab.tsx`, lines 155-161:

```ts
const handleSyncViews = async () => {
    setIsSyncingViews(true);
    try {
        const payload = protectedRoutes
            .filter(r => r.path)
            .map(({ RouteName, path }) => ({ RouteName, path: path! }));   // line 161
        const res = await callSyncViewPermissions(payload);
```

`protectedRoutes` comes from `FE/src/components/Routes.tsx`:

```ts
export type AppRoute = RouteObject & {
  RouteName?: string; // matches keys returned by your session/API
};
const protectedRoutes: AppRoute[] = [
  { RouteName: 'Dashboard', path: '/dashboard', element: <Dashboard /> },
  ...
```

`RouteName` is declared **optional**, even though every route literal in the array always sets it.
Because the array is typed as `AppRoute[]`, TypeScript widens to the declared (optional) type instead
of inferring "always present" from the literal — so `.map(...)` produces `RouteName: string | undefined`,
which then fails against `callSyncViewPermissions`'s stricter signature
(`FE/src/pages/Rbac/service.ts:207`):

```ts
export const callSyncViewPermissions = async (routes: { RouteName: string; path: string }[]) => {
```

### Why this is unrelated to Root Causes 1-2

- `AppRoute.RouteName` has been optional since commit `acc2caff` (2026-03-31).
- `handleSyncViews` (the only place this actually causes a problem) was added 5 days later, commit
  `adfceb52` (2026-04-05).
- Both predate the `204a909f` refactor (2026-08-30) by about 5 months. This has almost certainly been
  a broken `tsc -b` since April — nobody ran `npm run build`/`typecheck` as a gate until now.

### Fix

Either:
- Tighten `RouteName?: string` → `RouteName: string` in `Routes.tsx` (check `AppSidebar.tsx` and
  `usePermittedRoutes.ts` first — both also consume `protectedRoutes`/`AppRoute`, confirm neither
  relies on the optionality before tightening), or
- A local fix at the call site: `.map(({ RouteName, path }) => ({ RouteName: RouteName!, path: path! }))`.

No backend involvement either way. Simplest of the 3 root causes.

---

## Runtime Impact

Checked `FE/vite.config.ts` and `FE/package.json` directly:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "typecheck": "tsc -b"
}
```

`vite.config.ts`'s plugins are only `react()` (via `@vitejs/plugin-react-swc`), `tailwindcss()`, and
`svgr()` — no TS-gating plugin (e.g. `vite-plugin-checker`) is configured.

- **`npm run dev`**: unaffected. SWC transpiles per-file without type-checking. The app runs; the RBAC
  filter UI renders and doesn't crash — it just silently sends field names the backend no longer
  recognizes (ASP.NET model binding ignores unrecognized JSON keys rather than erroring), so filtering
  quietly does nothing.
- **`npm run build`**: hard-blocked. Reproduced directly — `npx tsc -b` returns all 22 errors verbatim
  with a non-zero exit code. Because the script is `tsc -b && vite build`, the shell short-circuits on
  failure and `vite build` never runs. **Production builds have been broken since 2026-08-30.**
- **`npm run typecheck`**: same `tsc -b`, same failure — this is what surfaced the issue tonight.

---

## Recommended Fix Order

1. **Root Cause 3** (`AppModuleTab.tsx`) — fully isolated, zero dependencies on the other two, safest
   to land first and immediately shrinks the error count from 22 to 21.
2. **Root Cause 1** (`PermissionFilter`) — mechanical, backend already supports it, no design decision
   needed. Low risk.
3. **Root Cause 2** (`UserGroupFilter`) — do this last. Get a decision first (backend filtering support
   vs. removing the permission-filter UI for now) before investing in the dialog redesign.

## Rollback-Readiness Note

This report recommends no code changes itself — it's a handoff document. Whoever picks this up should
give each root cause its own change with its own verification (`npm run typecheck` after each, plus a
manual check that the RBAC filter/dialog screens still render and submit correctly), rather than one
bundled commit — consistent with how the rest of this session's fixes were verified individually.
