# Category locked post-creation (all paths) + stale Sub-Category dropdown fix

**Files:** [`WebAPI/Controllers/Projects/ProjectController.cs`](../../../WebAPI/Controllers/Projects/ProjectController.cs),
[`Helpers/Functions.cs`](../../../Helpers/Functions.cs),
[`FE/src/pages/Project/components/ProjectDetailsForm.tsx`](../../../FE/src/pages/Project/components/ProjectDetailsForm.tsx),
[`FE/src/pages/Modification/projectmodification/components/ProjectDetailsForm.tsx`](../../../FE/src/pages/Modification/projectmodification/components/ProjectDetailsForm.tsx)
**Audited/fixed:** 2026-09-15
**Status:** Applied. Build (`dotnet build WebAPI`) 0 errors, `npx tsc -b` 0 new errors (21 pre-existing, unrelated `Rbac`-module errors unchanged).

## Summary

Two related fixes, shipped together because the second only became reachable due to the first not
existing yet:

1. **Category is now permanently locked once a Project is created — on every write path, not just
   the obvious one.** It was previously editable via direct edit (`UpdateProjectDetails`) and, more
   seriously, via the Formal Revision workflow for 16 currently-active `tRevisionRules`
   configurations — confirmed live via a read-only DB query, not a hypothetical.
2. **The Sub-Category (`Thrust`) dropdown no longer carries a stale value across a Category
   change.** A conditional clear-on-change guard had a real gap for "unrestricted" categories.

## Why Category had to be locked everywhere: the ID never regenerates

`Helpers/ProjectHelper.cs:150-229`, `GenerateProjectID`, is called from exactly **one place** in
the entire codebase — `ProjectController.cs:601`, inside `AddProject`. It calls
`dbo.pReserveProjectIdBlock` (the ADR-043/RISK-105 atomic allocator) passing `@CategoryId`, and the
proc's returned `@RangeStart` — a **Category-specific** numeric block — becomes the ID's
`ThirdSegment`: `ProjectId = {StageName-segment}{Year-segment}{RangeStart:D5}{IslandCode}`.

`tProjects` (`DBHelper/Models/Table/Project/Projects.cs`) has **no `Category` column at all** —
Category lives exclusively on `tProjectRevisions`. Since `GenerateProjectID` never runs a second
time for a given project (confirmed: no second call site anywhere, and `tProjects.ProjectPK` is
never reassigned in `UpdateProjectDetails`), the Category-derived `ThirdSegment` — and the
Region-derived `IslandCode` `FourthSegment`, resolved the same way at creation — persist unchanged
for the entire life of the project, across every stage. There is no mechanism to regenerate the ID
if Category later changes. Any edit to Category (or Region) after creation, through *any* path,
permanently desyncs the ID from its own meaning, with no way to reconcile it after the fact.

## Finding 1 — direct edit: Category was freely changeable, with an audit trail, no guard

`ProjectController.cs`, `UpdateProjectDetails`, before this fix:
```csharp
if (Project.Category != dto.ProjectDetails?.Category)
{
    var Category = await _db.tOptionProjectCategory... .FirstOrDefaultAsync(x => x.CategoryId == dto.ProjectDetails!.Category);
    if (Category == null) return new BadRequestObjectResult(new { Message = $"Selected Category '...' is not valid.", ... });
    ...
    transactionLogs.Add(new TransactionLog { ..., AffectedColumn = "Category", ... });
    Project.Category = dto.ProjectDetails!.Category;
}
```
Deliberate, logged, and completely unguarded against being run on a project that already has an
allocated, Category-specific `ProjectId`.

**Its own sibling fields already prove this was a gap, not a decision.** In the same form,
`Province`, `Region`, and `DEO` were already locked with `disabled={mode === 'edit' || disabled}`
(`FE/src/pages/Project/components/ProjectDetailsForm.tsx:505,569,587`), and confirmed via the same
grep sweep that found the Category write: neither `Province` nor `Region` is ever reassigned to the
entity inside `UpdateProjectDetails` either. Three "set once at creation" fields were already fully
locked, both sides. Category was the one left out.

## Finding 2 — CONFIRMED LIVE: the Formal Revision workflow could already do this today

The Modification form's Category/Region fields are gated by a separate, data-driven mechanism —
`<EditableField field="..." isFieldEditable={isFieldEditable}>`
(`FE/src/pages/Modification/projectmodification/components/ProjectDetailsForm.tsx:374-425`), driven
by `tRevisionRules.Field` (JSON), keyed by `(ReasonId, PCMA_Status, Package_Status)`. This is a
deliberate, legitimate mechanism for *other* fields — the Formal Revision workflow exists precisely
to allow governed, RO/CO-approved correction of otherwise-locked fields.

A direct, read-only query against `myps_db_dev` (`192.168.50.200`, the approved target) found:
```sql
SELECT Id, ReasonId, PCMA_Status, Package_Status,
       JSON_VALUE(Field,'$.ProjectDetailsRules.Category') AS CategoryEditable,
       JSON_VALUE(Field,'$.ProjectDetailsRules.Region')   AS RegionEditable
FROM dbo.tRevisionRules WHERE IsActive = 1;
```
**16 active rows currently mark `Category` and/or `Region` `true`** — `ReasonId=1`
("Not yet started"+"Packaged"), one status combo each for `ReasonId=10` and `12`, and both fields
`true` across all 4 status combos for `ReasonId=41, 44, 45, 47`. Under these live configurations, a
Formal Revision could be submitted with a changed Category or Region, get fully approved, and
permanently desync that project's already-fixed ID segments — no code change required to trigger
it, only a matching revision reason/status.

The write mechanism, traced end-to-end: `RequestRevision` (`RevisionController.cs:878`) and
`ResubmitRevision` (`:2576`) both funnel the submitted `ProjectDetails` through
`Helpers/Functions.cs:734-801`, `UpdateRevisionData<TSrc,TDest>` — a single, shared, fully generic,
reflection-based field copier: for each key in the `tRevisionRules`-derived `allowedKeys` list, if
source and destination differ, copy and log. Every revision-side field update (not just Project
details — the same helper backs Funding/Component-cost/etc. updates, keyed by a different
`AffectedTable`) passes through this one chokepoint.

## The fix

### Fix A — lock Category on the direct-edit path

`ProjectController.cs`, `UpdateProjectDetails`: replaced the change-and-log block with a refusal:
```csharp
if (Project.Category != dto.ProjectDetails?.Category)
{
    return new BadRequestObjectResult(new
    {
        Message = "Category cannot be changed after a Project has been created — it determines part of the Project's ID and cannot be modified.",
        Title = "Category Locked"
    });
}
```
`FE/src/pages/Project/components/ProjectDetailsForm.tsx`: Category dropdown now
`disabled={mode === 'edit' || disabled}`, matching `Province`/`Region`/`DEO`'s pre-existing
convention exactly. `AddProject` is untouched — Category must stay freely selectable at creation.

### Fix B — lock Category/Region at the one shared Revision chokepoint

`Helpers/Functions.cs`, `UpdateRevisionData`, inside the `foreach (var key in allowedKeys)` loop:
```csharp
if (key == "Category" || key == "Region")
    continue;
```
Unconditional — does not depend on `tRevisionRules` data being correct. Protects `RequestRevision`
and `ResubmitRevision` identically (both call this same helper), and any future write path that
reuses it inherits the same protection automatically. Safe for the helper's other, unrelated
callers (Funding/Component-cost updates, etc.): the guard only matches when the key literally
equals `"Category"`/`"Region"` *and* both source and destination types have that property via
reflection — for entity shapes that don't have it, the lookup already finds nothing, so the guard
is inert there by construction, not by luck.

### Fix C — stale Sub-Category value on Category change

`ProjectDetailsForm.tsx` (both Project and Modification): before this fix, the Sub-Category
(`Thrust`) field was only cleared when `isThrustAllowedForCategory` said the *old* value was no
longer valid under the *new* Category:
```ts
if (!map) return true;
...
if (realRestrictions.length === 0) return true;   // "unrestricted" category -> anything passes
```
For any Category with zero rows in `CategoryThrustMap` — a legitimately unrestricted category —
this returns `true` for *any* prior Sub-Category value, so a stale value from a *different*
Category silently passed the guard and was never cleared. Matches the original report exactly:
only *some* Categories exhibited it.

Fixed to clear unconditionally on any actual Category value change, matching the already-correct
pattern already shipped in `FE/src/pages/LumpSum/components/LumpSumForm.tsx:361-373`:
```tsx
if (projectDetails?.Category !== value) {
    onChange('Thrust', undefined);
}
```
`isThrustAllowedForCategory`'s other call site in each file (filtering which Sub-Category *options*
are offered for the current Category) is correct and untouched.

## Verification performed

- `dotnet build WebAPI/WebAPI.csproj` — 0 errors, 0 new warnings, nothing in the 2 edited backend
  files.
- `npx tsc -b` (FE) — 0 new errors; the 21 pre-existing errors are all confined to the unrelated,
  already-tracked `Rbac` module.
- Read `DBHelper/Models/Table/Project/Projects.cs` directly to confirm `tProjects` has no
  `Category`/`Region` column (Finding basis).
- Confirmed via grep that `GenerateProjectID` has exactly one call site codebase-wide.
- Confirmed via grep that neither `Project.Category =` nor `Project.Region =`/`Province =` exists
  as a live write inside `UpdateProjectDetails` beyond the one block this fix replaced (for
  Category) — `Province`/`Region` were already correctly absent.
- Live, read-only query against `myps_db_dev` confirming the 16-row `tRevisionRules` exposure
  (Finding 2) — not assumed, not simulated.

## Explicitly out of scope

- **The 16 `tRevisionRules` rows themselves are not corrected in this pass.** After Fix B, they
  become dead/misleading configuration: the Modification form will still show Category/Region as
  editable per `isFieldEditable` (unchanged, reads the same JSON), but a submitted change to either
  field is now silently no-op'd by `UpdateRevisionData`'s guard rather than rejected outright — the
  rest of any submitted changes still apply normally, so this is non-breaking, but it is a UX
  inconsistency (a field that looks editable but doesn't actually change) worth closing. Recommended
  follow-up: a reviewable SQL script flipping those 16 rows' `Category`/`Region` JSON keys to
  `false`, so `tRevisionRules` reflects reality — **this is a DB write and requires its own
  explicit approval**, not bundled into this fix. Row IDs found: 1, 76, 92, 322, 324, 326, 328, 346,
  348, 350, 352, 354, 356, 358, 360, 369.
- **Historical data audit.** Some already-approved revisions may have already changed Category or
  Region before this fix, under the confirmed-live gap in Finding 2. Not audited or remediated
  here — a read-only query could identify any live project whose current Category no longer falls
  within its `ProjectId`'s originally-allocated range, if the operator wants that follow-up.
- `Thrust`/Sub-Category itself — confirmed not an input to `GenerateProjectIDParams`; no lock
  needed for it.
- `StageName`/`YearStart` — the former comes from the DTO at creation and is governed by the
  separate, append-only stage-advancement mechanism; the latter comes from the Program, not the
  Project. Different domain/controller, noted as a boundary, not addressed here.

## Rollback readiness

Four files, all pure C#/TypeScript logic — no schema, no SQL, no migration. Fix A: FE
disable + BE refusal replacing a write. Fix B: a 2-line guard in one shared helper. Fix C: matches
an already-shipped, proven pattern from `LumpSumForm.tsx`. Every change is independently
revertible; none depends on the others having shipped.
