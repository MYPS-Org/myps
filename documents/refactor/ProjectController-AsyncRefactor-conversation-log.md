# Conversation Log — ProjectController Async Refactor

Branch: `BE-refactor-update-project-details` · Date: 2026-08-09

## 1. Initial request

> Currently, this is one big async task and needs optimization. Refactor so independent
> tables can be updated asynchronously. Output refactored code to a separate file.

Target file: [WebAPI/Controllers/Projects/ProjectController.cs](../../WebAPI/Controllers/Projects/ProjectController.cs).
The "one big async task" is `UpdateProjectDetails`, spanning roughly 2,240 lines
(originally lines 553–2793 of the file).

## 2. Constraint flagged before starting

`_db` is a single EF Core `DbContext` shared for the whole request, and it is **not
thread-safe** — concurrent queries or `SaveChangesAsync()` calls against the same
instance throw `InvalidOperationException` ("A second operation was started on this
context before a previous operation completed"). True concurrent **writes** inside one
SQL transaction also aren't achievable without a distributed transaction (MSDTC), which
is heavy infra most hosts disable.

So "make independent tables update asynchronously" could not mean literal parallel
`SaveChangesAsync()` calls. What *can* be parallelized safely:
- Independent read-only lookup/validation queries, via short-lived `DbContext` instances
  from `IDbContextFactory<MYPSDbContext>`, run concurrently with `Task.WhenAll`.
- Collapsing redundant mid-method `SaveChangesAsync()` calls into fewer round trips.
- Eliminating N+1 query patterns (one DB round trip per row to resolve a reference-table
  name) via bulk prefetch into in-memory dictionaries.

## 3. Scoping questions asked and answered

**Q1 — Which part of the controller to target?**
Answer: **UpdateProjectDetails + AddProject** (not the dropdown-loading methods).

**Q2 — What should "asynchronous/parallel" mean in practice?**
Answer: **Parallelize independent reads only** — writes stay sequential on `_db` (the only
safe option within one transaction); use `IDbContextFactory` + `Task.WhenAll` for
independent lookup/validation queries.

## 4. Investigation before writing code

- Read the full `ProjectController.cs` (2,927 lines) to map out `AddProject` and
  `UpdateProjectDetails`.
- Checked `Main/ServiceRegistration.cs` — only `AddDbContext<MYPSDbContext>` was
  registered, no factory.
- Checked `WebAPI/Controllers/CoreController.cs` for the base class's `_db`/`_Session`/
  `_hubContext` fields and constructor shape.
- Read `Helpers/ProjectHelper.cs` (`ValidateProjectId`, `GenerateProjectId`,
  `ValidateProjectDetailsLookups`) and `Helpers/ProgramHelper.cs` (`ValidateProgramId`) —
  confirmed both are pure `AsNoTracking()` reads, safe to run on an isolated context.
- Checked `DBHelper/Models/Table/Project/*.cs` for navigation properties
  (`ProjectComponentCost.CostsPerYear`, `.WorkItem`; `ProjectMajorWorkItem.WorkLocations`)
  and `DBHelper/Data/MYPSDbContext.cs`'s `OnModelCreating` — confirmed these relationships
  ARE configured via `HasMany/WithOne/HasForeignKey`, meaning EF can auto-wire child FKs
  through navigation collections on a single `SaveChangesAsync()` — a genuine option for
  removing intermediate saves, later reconsidered (see §6).
- Checked `WebAPI/WebAPI.csproj` — no explicit compile globs, confirming a reference file
  placed under `documents/` (outside the project folder) would not be swept into the build.

## 5. Changes made

### 5a. `Main/ServiceRegistration.cs` (applied directly, real file)
Added `Services.AddPooledDbContextFactory<MYPSDbContext>(...)` alongside the existing
`AddDbContext<MYPSDbContext>()` registration, so `IDbContextFactory<MYPSDbContext>` can be
injected for short-lived, isolated read contexts.

### 5b. `documents/refactor/ProjectController.AsyncRefactor.cs` (new reference file, not
wired into the build)
Contains a refactored `AddProject` and `UpdateProjectDetails`:
- **AddProject**: `ValidateProgramId` and `ValidateProjectDetailsLookups` now run
  concurrently (previously sequential) since neither depends on the other's result. Same
  error-priority order preserved (a bad ProgramId still surfaces before a bad field lookup).
- **UpdateProjectDetails**:
  - ~15–20 independent validation/lookup reads (funding source/agreement validity,
    component/work-type/infra validity, "old vs new" lookups for the audit log) now fire
    as one concurrent batch via `IDbContextFactory`, each on its own isolated context.
  - Five small reference tables (component types, work types, infra types, funding
    sources/agreements) are bulk-loaded once into dictionaries instead of queried per row
    inside the "Update X" loops (N+1 fix).
  - The "New Component Cost → Cost Per Year / Major Work Item → Work Location" block and
    its two satellite blocks ("New Major Item of Works", "New Major Work Locations") were
    **left byte-for-byte identical to the original**, including its mid-method
    `SaveChangesAsync()` calls — see §6 for why a navigation-property rewrite was
    attempted and then reverted there.

A self-check during drafting caught that an early attempt had silently "improved" some
join logic (switching join sources and eliminating saves) in ways that changed behavior
rather than just adding concurrency — this was reverted to match the original exactly,
byte for byte, before the file was finalized.

A real compile issue was also caught and fixed: the per-field "old vs new" lookup tasks
each have a different named-tuple generic type (`Task<(TCategory?, TCategory?)>` vs
`Task<(TThrust?, TThrust?)>`, etc.), so they can't share an array element type as
`Task<T>` — fixed by typing the array as `Task?[]` and filtering with `.OfType<Task>()`
before `Task.WhenAll`.

## 6. Bugs found while investigating (not fixed, flagged instead)

While working out whether the "New Component Cost" block's mid-method
`SaveChangesAsync()` calls could be removed via navigation properties, three pre-existing
issues were found in that block (and its two satellite blocks) of the **real**
`ProjectController.cs`:

1. `ComponentCostFK`/`WorkItemFK` on some newly-inserted rows are copied from the incoming
   DTO field (0/unset for a brand-new row) instead of the just-generated parent entity's
   real `Id`.
2. The "New Major Item of Works" and "New Major Work Locations" sub-blocks inside "New
   Component Cost with components relations" are gated on `NewCostYears.Count() > 0` (a
   different collection) instead of their own collection's count, so they can be silently
   skipped.
3. A deeper issue found once the fix was worked out in more detail: the DTOs
   (`ProjectComponentCostDTO`, `ProjectMajorWorkItemDTO`, `ProjectMajorWorkLocationsDTO` in
   `WebAPI/Controllers/Projects/DTOProject.cs`) have client-generated `ClientId` /
   `ComponentClientId` / `WorkItemClientId` GUID fields explicitly documented as existing
   "to maintain parent-child relationships before database IDs exist." The controller
   code ignores them and matches new rows by `ComponentId` (a shared component-*type*
   code) instead, which cross-links data whenever a single request adds multiple new work
   items to one component, or multiple new locations to one work item.

Because fixing this properly is a correctness change (not a perf one) and bigger/riskier
than the async refactor itself, it was **not** bundled into the refactor. The navigation-
property optimization for that block was reverted specifically to avoid silently changing
this behavior as a side effect.

I asked whether to do the full correct fix (rewire matching to use the Client Id fields)
or a narrower fix (just issues 1–2, keeping the `ComponentId`-based matching and its
cross-linking risk). **User's answer: skip this for now, but remind later.**

A memory entry was saved
(`bug_new_component_clientid_matching.md`, indexed in `MEMORY.md`) documenting the bug,
its location, why it was deferred, and what to test (a request adding multiple new work
items to one new component, and multiple new locations to one new work item) before
implementing the fix in a future session.

## 7. Current state / outstanding items

- ✅ `documents/refactor/ProjectController.AsyncRefactor.cs` — refactor complete, not yet
  merged into the real controller. Awaiting review.
- ✅ `Main/ServiceRegistration.cs` — `IDbContextFactory<MYPSDbContext>` registration
  applied to the real file.
- ⏳ `ClientId`/`ComponentClientId`/`WorkItemClientId` matching bug in the real
  `ProjectController.cs` — **deferred**, memory reminder saved for a future session.
