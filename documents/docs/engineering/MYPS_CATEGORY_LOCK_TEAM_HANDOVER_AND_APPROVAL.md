# Category-lock fix — team handover and approval request

> **Status as of 2026-09-15:** Code fix is complete, built, and typecheck-clean — **uncommitted**,
> awaiting review/merge. Two database scripts are prepared and **not executed** — awaiting explicit
> team approval below. Nothing in this document has touched the database or been pushed anywhere.

## Who needs to read this, and what they're approving

- **Anyone reviewing the code change** (Part 2): a normal code review of 4 files, already built and
  typechecked clean.
- **Whoever owns `myps_db_dev` data decisions**: two independent yes/no calls in Part 4 — one
  recommended, one genuinely open and needing business input, not a technical one.

All referenced files, exact paths:

| Artifact | Path | State |
|---|---|---|
| Full technical fix writeup | `documents/docs/engineering/MYPS_CATEGORY_LOCKED_POST_CREATION_AND_SUBCATEGORY_FIX.md` | Already written |
| Code fix — backend | `WebAPI/Controllers/Projects/ProjectController.cs` | Modified, uncommitted |
| Code fix — backend (shared helper) | `Helpers/Functions.cs` | Modified, uncommitted |
| Code fix — frontend | `FE/src/pages/Project/components/ProjectDetailsForm.tsx` | Modified, uncommitted |
| Code fix — frontend | `FE/src/pages/Modification/projectmodification/components/ProjectDetailsForm.tsx` | Modified, uncommitted |
| DB script — Decision 1 | `Main/Resources/Internal/SQLScripts/RevisionRules.LockCategoryRegion.2026-09-15.sql` | Written, **not run** |
| DB script — Decision 2 (optional) | `Main/Resources/Internal/SQLScripts/Project.RevertCategoryDesync.BP01026495LZ.2026-09-15.sql` | Written, **not run** |

## Executive summary

A Project's `Category` could be changed at any time after creation — through direct editing and,
separately, through the Formal Revision workflow for 16 specific configurations — even though
`Category` is permanently baked into that project's `ProjectId` at creation and the ID is never
regenerated. Changing Category after the fact silently and permanently desyncs the ID from its own
meaning, with no way to reconcile it afterward. This is now fixed in code on both paths. A full
audit of live data found **exactly one already-affected project** (fully documented in Part 3, with
a name, a user, and two timestamps) and confirmed the Revision-path route was **never actually
exercised** historically. Two small, optional database actions remain for the team to decide on —
neither is required for the code fix to be safe or complete.

---

## Part 1 — The vulnerability

### How a ProjectId is actually built

`Helpers/ProjectHelper.cs:150-229`, `GenerateProjectID`, is called from **exactly one place in the
entire codebase** — `ProjectController.cs:601`, inside `AddProject`. It is never called again for
a given project. It calls `dbo.pReserveProjectIdBlock` (the existing atomic ID-block allocator),
passing the project's `Category`, and the stored procedure returns a **Category-specific** numeric
range (from `tOptionProjectCategory.Minimum`/`Maximum`) — the returned value becomes the middle
digits of the `ProjectId` (e.g. `P01093011LZ`: `P` = stage prefix, `010` = year offset, `93011` =
the Category-allocated sequence, `LZ` = island code, itself derived from `Region` at the same
moment). Region and Category are therefore both **permanently encoded** into the ID the instant a
project is created.

### Why that makes any later change dangerous

`tProjects` (`DBHelper/Models/Table/Project/Projects.cs`) — the table holding the stable
`ProjectPK` — has **no `Category` column at all**. Category lives only on `tProjectRevisions`, a
table designed to be edited. Since the ID is generated exactly once and never regenerated, nothing
ever re-syncs the ID to a later Category change. Every subsequent edit to Category, through any
mechanism, permanently pulls the project's classification away from what its own identifier says —
with no way to detect or repair it later except a manual audit like the one in Part 3.

### Finding 1 — the direct-edit path had no protection at all

`ProjectController.cs`, `UpdateProjectDetails`, before this fix:
```csharp
if (Project.Category != dto.ProjectDetails?.Category)
{
    // ...validated the new Category exists, logged the change, then:
    Project.Category = dto.ProjectDetails!.Category;
}
```
Deliberate, logged, and completely unguarded. Worth noting: this field's own siblings in the same
form — `Province`, `Region`, `DEO` — were **already** locked from editing after creation
(`disabled={mode === 'edit' || disabled}` in the frontend, and never reassigned server-side).
Category was the one field of this exact shape left open — reads as an oversight in whatever pass
locked the others, not a deliberate design choice.

### Finding 2 — CONFIRMED LIVE: the Formal Revision workflow could do this too

The Modification (Revision-editing) form gates Category/Region editability through a separate,
legitimate, data-driven mechanism — `tRevisionRules.Field` (JSON), keyed by
`(ReasonId, PCMA_Status, Package_Status)`. This exists for good reason: the Revision workflow is
supposed to be the *governed* path for correcting otherwise-locked fields, subject to RO/CO
approval. A direct, read-only query against `myps_db_dev` found:

```sql
SELECT Id, ReasonId, PCMA_Status, Package_Status,
       JSON_VALUE(Field,'$.ProjectDetailsRules.Category') AS CategoryEditable,
       JSON_VALUE(Field,'$.ProjectDetailsRules.Region')   AS RegionEditable
FROM dbo.tRevisionRules WHERE IsActive = 1;
```

**16 active rows currently mark `Category` and/or `Region` as `true`** — `ReasonId=1`
("Not yet started"+"Packaged"), one status combo each for `ReasonId=10` and `12`, and both fields
`true` across all 4 status combos for `ReasonId=41, 44, 45, 47`. This was not theoretical: under
these live configurations, a Formal Revision could be submitted with a changed Category or Region,
approved by RO/CO, and permanently desync the project's ID — no code bug required to trigger it,
just a matching revision reason/status.

### Finding 3 — the exact mechanism

`RequestRevision` (`RevisionController.cs:878`) and `ResubmitRevision` (`:2576`) both funnel
submitted field changes through **`Helpers/Functions.cs:734-801`, `UpdateRevisionData`** — one
shared, generic, reflection-based field copier used for every revision-side field update (Project
details, and the same helper backs Funding/Component-cost updates too, via a different
`AffectedTable`). This single chokepoint is why Fix B (Part 2) only needed to change one file.

---

## Part 2 — The fix (already shipped, code-complete)

### Fix A — lock Category on the direct-edit path

**Backend** (`ProjectController.cs`, `UpdateProjectDetails`) — replaced the change-and-log block
with a refusal:
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
**Frontend** (`FE/src/pages/Project/components/ProjectDetailsForm.tsx`) — Category dropdown now
`disabled={mode === 'edit' || disabled}`, matching `Province`/`Region`/`DEO`'s pre-existing
convention exactly. `AddProject` is untouched — Category must stay freely selectable at creation.

### Fix B — lock Category/Region at the shared Revision chokepoint

`Helpers/Functions.cs`, inside `UpdateRevisionData`'s field-copy loop:
```csharp
if (key == "Category" || key == "Region")
    continue;
```
Unconditional — does not depend on `tRevisionRules` data being correct (see Decision 1, Part 4, for
why the data should still be corrected too). Protects `RequestRevision` and `ResubmitRevision`
identically, and any future caller of this helper inherits the same protection automatically. Safe
for the helper's other, unrelated callers: the guard only matches when the key literally equals
`"Category"`/`"Region"` *and* the entity actually has that property — for unrelated shapes
(Funding, Component-cost, etc.) the reflection lookup already finds nothing, so this is inert there
by construction.

### Fix C — stale Sub-Category (`Thrust`) value on Category change

Independent bug, same forms: the Sub-Category dropdown could show a leftover value from the
*previous* Category after a new one was picked, because the old conditional clear-on-change guard
(`isThrustAllowedForCategory`) returns "still valid" for *any* value when the new Category happens
to have zero restriction rows. Fixed to clear unconditionally on any actual Category value change,
matching an already-correct, already-shipped pattern in `FE/src/pages/LumpSum/components/LumpSumForm.tsx`.

### Build/test evidence

- `dotnet build WebAPI/WebAPI.csproj` — **0 errors**, 0 new warnings, nothing in either edited
  backend file.
- `npx tsc -b` (FE) — **0 new errors**; the 21 errors present before and after this change are all
  confined to the pre-existing, separately-tracked `Rbac` module.

### What this fix explicitly does NOT change

- `AddProject` — Category remains freely selectable at creation, as it must.
- `Province`/`Region`/`DEO` on the direct-edit form — already correctly locked before this fix,
  untouched.
- `isThrustAllowedForCategory`'s other call site (filtering which Sub-Category *options* are shown)
  — correct, untouched.
- `Thrust`/Sub-Category itself is not locked anywhere — confirmed it's not an input to ID
  generation, so no lock is needed for it.

---

## Part 3 — Historical impact audit (live data, `myps_db_dev`, read-only throughout)

Two independent mechanisms could have caused a desync before this fix shipped. Both were checked
against live data, not assumed.

### Scenario A — direct edit

**Method**: for every live project with a well-formed, system-generated `ProjectPK`, extract its
embedded numeric sequence and check it against the *current* Category's own allocated range
(`tOptionProjectCategory.Minimum`/`Maximum`).

**A trap caught before trusting results**: a first, naive pass across all 56,789 live projects
returned ~251 "mismatches." Inspecting them showed most `ProjectPK` values aren't system-generated
at all — e.g. `MP_P_CO-PS-634_02272023_144107_BP00830339LZ` — clearly legacy-migration-imported
records with a totally different ID scheme. Extracting a "sequence" from those produces meaningless
numbers. **These were false positives**, filtered out before drawing any conclusion.

**Filtered, trustworthy result**: only **26 of 56,789** live projects have a well-formed,
system-generated `ProjectPK` (the ID-consistency question doesn't meaningfully apply to the other
56,763 — their IDs were never derived from a Category range). Of those 26, **25 match**, and
**exactly 1 does not**:

| ProjectPK | Current Category | Current range | Embedded sequence | Range that actually owns it |
|---|---|---|---|---|
| `BP01026495LZ` | 22 — "Contingent Fund" | 91001–91500 | 26495 | Category 17 — "OO2: Protect Lives and Properties Against Major Floods" (20001–30000) |

**Full history, reconstructed from `tTransactionLog`** (not guessed):

| When | Who | Field | From | To |
|---|---|---|---|---|
| 2026-09-11 18:43:50 | `jimeneznr` | Thrust | Construction/Maintenance of Flood Mitigation Structures and Drainage Systems | Rehabilitation/Reconstruction/Upgrading of Damaged Paved Roads |
| 2026-09-11 18:43:50 | `jimeneznr` | **Category** | OO2: Protect Lives and Properties Against Major Floods | OO1: Ensure Safe and Reliable National Road System |
| 2026-09-11 18:44:28 | `jimeneznr` | Thrust | Rehabilitation/Reconstruction/Upgrading of Damaged Paved Roads | Fund Subsidies for Contingencies |
| 2026-09-11 18:44:28 | `jimeneznr` | **Category** | OO1: Ensure Safe and Reliable National Road System | Contingent Fund *(current)* |

Confirms definitively: the project's Category at creation ("OO2: Protect Lives...") is exactly the
one whose range legitimately contains its ID's embedded sequence. It was correct when created. A
real user made two edits within about 40 seconds, four days before this fix shipped, through the
exact path Fix A now closes.

**A second historical edit was found in the log sweep but is not a currently-affected record**:
`BP01069001LZ`, changed by `caldokp` on 2026-09-08. A direct lookup confirms this `ProjectPK` no
longer exists in `vProjectLatest` or `tProjectRevisions` — the project has since been removed from
the live dataset entirely. Closed historical trace, not something requiring action.

**A false alarm ruled out explicitly**: several well-formed IDs share the same numeric sequence
(e.g. `BP01093001LZ`/`BP01193001LZ`/`BP01293001LZ` all show `93001`). Checked against
`pReserveProjectIdBlock`'s own allocation key (`CategoryId, Suffix, IslandCode, YearStart`) —
confirmed **not** a collision: each belongs to a different `YearStart` bucket, which independently
restarts its own sequence counter by design.

### Scenario B — Formal Revision path

Checked whether the 16-row `tRevisionRules` gap (Finding 2) was ever actually used, not just
configured:
```sql
SELECT * FROM dbo.tTransactionLog
WHERE AffectedColumn IN ('Category','Region') AND AffectedTable = 'tRevisionProjects';
```
**Zero rows returned.** The Formal Revision workflow has never, in this database's history, been
used to change a Category or Region — despite being technically possible under 16 live
configurations the whole time. Real and live, but never triggered in practice.

### What this audit does not cover

The equivalent check for `Region`/`IslandCode` was not attempted. `IslandCode` isn't a stored
column — it's derived from `Region` through `ValidateProjectDetailsLookups`' own lookup logic at
creation time, and reproducing that correctly in a standalone audit query risks the same kind of
false-positive trap already caught once for Category. Flagged as an honest limitation, not silently
skipped.

---

## Part 4 — Two decisions for the team

Neither is required for the code fix (Part 2) to be complete, safe, or effective — both are
optional cleanups the audit (Part 3) surfaced. Both scripts are read-verified (before/after
queries built in) and neither has been executed.

### Decision 1 — correct the 16 `tRevisionRules` rows

**What it does**: flips the `Category`/`Region` JSON flags to `false` on the 16 rows identified in
Finding 2, so the Modification form stops *showing* these fields as editable when Fix B already
silently blocks any such change from taking effect.

**Why it matters even though Fix B already blocks the change**: without this, a user can still fill
in a new Category during specific revisions, submit successfully, see no error — and have nothing
actually change. That's a live UX inconsistency (config says one thing, code enforces another), not
just a historical footnote.

**Script**: `Main/Resources/Internal/SQLScripts/RevisionRules.LockCategoryRegion.2026-09-15.sql`
— scoped to the exact 16 row IDs (`Id IN (1, 76, 92, 322, 324, 326, 328, 346, 348, 350, 352, 354,
356, 358, 360, 369)`), not a broad pattern match. Includes before/after `SELECT`s and a final
sweep query that should return zero rows.

**Risk**: low. Two boolean JSON keys on 16 rows, no schema change, idempotent (safe to re-run).

**Recommendation**: **yes, run this one.** It's a pure configuration-correctness fix with no
ambiguity about intent.

> **Decision 1 — Approved to run? ☐ Yes ☐ No ☐ Defer**
> Approved by: _______________________ Date: _______________

### Decision 2 — revert `BP01026495LZ`'s Category (and Thrust)

**What it does**: reverts the one confirmed-desynced project back to its Category-at-creation value
(17, "OO2: Protect Lives and Properties Against Major Floods") and its pre-edit Thrust, restoring
consistency between the project's data and its permanent ID.

**Why this one is NOT simply recommended**: the audit can confirm *what* changed and *when*, but
not *why*. `jimeneznr`'s edit might have been a genuine, wanted business correction — "Contingent
Fund" may now be the operationally correct classification for this project, and reverting would be
the wrong move. This is a business-intent question, not a technical one.

**Script**: `Main/Resources/Internal/SQLScripts/Project.RevertCategoryDesync.BP01026495LZ.2026-09-15.sql`
— includes a guard that aborts if the row's Category has changed again since this script was
written (rather than blindly overwriting), and before/after verification queries.

**Risk**: low technically (one row, one project, easily reversible via the same transaction-log
evidence used to build the script) — the real risk is business, not technical: reverting a
deliberate, wanted change would itself be a mistake.

**Recommendation**: **the team's call.** Suggested path: ask `jimeneznr` (or whoever owns this
project) whether the 2026-09-11 change was intentional before deciding.

> **Decision 2 — Approved to run? ☐ Revert to Category 17 ☐ Leave as "Contingent Fund" (documented exception) ☐ Defer, ask `jimeneznr` first**
> Approved by: _______________________ Date: _______________

---

## Part 5 — Verification & rollback readiness

**Already proven** (this session, evidence above): backend build clean, frontend typecheck clean,
live-data audit complete for Category (both scenarios), zero live exploitation of the Revision-path
gap, the one Category-path incident fully reconstructed with user/timestamp attribution.

**Still to prove, if Decision 1 and/or 2 are approved**: re-run the same sweep queries immediately
after each script (both scripts print their own before/after state and a final zero-row sanity
check — nothing extra needs to be written, just executed and the output reviewed).

**Rollback**: the code fix (Part 2) is 4 files of pure C#/TypeScript logic, no schema change,
trivially revertible via `git revert`. Decision 1's script is idempotent and reversible by flipping
the same two JSON keys back. Decision 2's script reverts one row using log-confirmed values — its
own "before" state is captured in this document's Part 3 table, so reverting the revert (if ever
needed) is just as well-documented as the revert itself.

---

## Part 6 — Sign-off

| Item | Decision | Approved by | Date |
|---|---|---|---|
| Code fix (Parts 1–2) — merge as-is | ☐ Approved ☐ Changes requested | | |
| Decision 1 — `tRevisionRules` correction | ☐ Yes ☐ No ☐ Defer | | |
| Decision 2 — `BP01026495LZ` revert | ☐ Revert ☐ Leave as-is ☐ Ask `jimeneznr` first | | |
