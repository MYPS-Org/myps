# Plan: Component Targets per Program Stage on Project Details

Status: Implemented
Created: 2026-08-23
Source: User request — let a planner on /projects/project-details/{ProjectId}:{StageName} see component targets (Source, Component ID, Component Description, Type of Work, Target, Target Unit) per Program Stage the project has undergone, in a new panel right after MajorItemOfWorksForm, grouped by Component ID.


## Context

A planner opening a project (e.g. `/projects/project-details/P00999004VS:TF-R`) can see that project's
*current-stage* work items in **Major Items of Work**, but has no way to see the component-level
physical **targets** the project carried at each stage it has passed through (BP → NEP → GAA → …).
The legacy desktop app had a per-project "Targets" tab with exactly six columns — Source, Component ID,
Component Description, Type of Work, Target, Target Unit — and that view has no equivalent in the web app.

The new panel groups by **Component ID**: one accordion row per component the project has ever carried,
expanding to that component's targets **per Program Stage**. The `Source` column is what identifies
which stage each row came from, so grouping by component turns the panel into a
"how did this component's target move across stages" view.

**Prior art — read this first.** A sibling feature exists for the **programs list** on
`origin/feat/program-stage-targets`, commit `f6cc5bf8` ("feat(program): add stage-level Targets
expansion to the programs list"). It is *not* on the current branch. It contributes the target-SUM SQL,
the `Source` vs `Provenance` distinction, the endpoint shape, and the paginated panel component — all
reused here, but re-scoped from *program → its projects, one stage* to *one project → one component,
all stages*. Inspect it with:

```
git show f6cc5bf8 -- Main/Resources/Internal/SQLScripts/Program.StageTargets.sql \
                     DBHelper/Models/Functions/Program/ProgramStageTargets.cs \
                     WebAPI/Controllers/Programs/ProgramController.cs \
                     WebAPI/Controllers/Programs/DTOProgram.cs \
                     FE/src/pages/Program/components/programList/StageTargetsPanel.tsx \
                     FE/src/pages/Program/Model.d.ts FE/src/pages/Program/Service.ts
```

Do **not** cherry-pick it. Build the project-scoped twin so this branch does not depend on
`feat/program-stage-targets` landing, and so the query never fans out across a whole program.

**Outcome:** a **Component Targets** panel on the project details page, immediately after
`MajorItemOfWorksForm`, listing every component the project has carried. Expanding a component reveals
its keyset-paginated per-stage targets.

## Acceptance Criteria

- [ ] `/projects/project-details/P00999004VS:TF-R` renders a **Component Targets** panel directly after the Major Items of Work section.
- [ ] The panel's top-level rows are **Component IDs**, one per distinct component, labelled `{ComponentId}` (e.g. `CW1`) with the component description beside it. One component expands at a time. The fully-qualified `{ProjectId}-{ComponentId}` form appears only inside the expanded table, where it is per-stage and therefore meaningful.
- [ ] The component list is the **union across every Program Stage the project has undergone** — a component that exists only in an earlier stage still appears.
- [ ] Expanding a component shows a table with exactly: Source, Component ID, Component Description, Type of Work, Target, Target Unit.
- [ ] Inside a component, there is one row per work item **per stage**, ordered by stage progression (BP → … → GAA-R).
- [ ] `Target` = `SUM(PhysicalTarget)` of that work item's non-deleted work locations, rendered with thousands separators and **2 decimals** (`1,250.00`); `null` renders as `—`.
- [ ] `Source` is the composed stage label (`"NEP 2026 OO-1"`), **not** the raw `Base`/`Revision` flag — that is exposed separately as `Provenance` and is not displayed.
- [ ] The list is keyset-paginated with a `PaginationBar` inside the panel; First/Previous/Next/Last and page jumps all work.
- [ ] A component with no targets shows a single "No targets available for this component" row — no crash, no blank panel. A project with no components shows "No component targets available for this project".
- [ ] A user who cannot see the project (`fUserVisibleProjects` under `ApplyFilter`) gets the same non-disclosing rejection `ShowProjectStages` returns; they cannot read targets.
- [ ] Everything already on `/projects/project-details` behaves exactly as before.

## Approach

Four layers. The SQL is the one place that departs meaningfully from `f6cc5bf8`.

### 1. SQL — `dbo.fProjectStageTargets(@ProjectFK)`

New file `Main/Resources/Internal/SQLScripts/Project.StageTargets.sql`. Modelled on
`Program.StageTargets.sql` from `f6cc5bf8` — read it, since the OO-parsing `OUTER APPLY`, the
`COALESCE(t.TargetUnit, sw.Measure)` fallback, and the header comment carry over unchanged.

Two structural differences from the program version:

1. **No `@StageId` parameter.** The function fans out over `dbo.fProjectStages(@ProjectFK)` — every stage
   the project has undergone — and applies the per-stage TVFs inside. Grouping by component only makes
   sense against all stages at once.
2. **`Id` is a `ROW_NUMBER`, not `wi.Id`.** A work item id is unique within a revision, and distinct
   stages *usually* map to distinct revisions — but that is not guaranteed, and a duplicate key would make
   `FilterDataCursor` skip or repeat rows at a page boundary. A dense `ROW_NUMBER` over
   `(StageHierarchy, ComponentId, wi.Id)` is unique by construction and gives the required stage
   ordering for free. The real work item id is still exposed as `WorkItemId`.

```sql
CREATE OR ALTER FUNCTION dbo.fProjectStageTargets
(
    @ProjectFK NVARCHAR(200)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        -- Dense, stable key: keyset pagination key AND the stage-progression sort order.
        ROW_NUMBER() OVER (
            ORDER BY ISNULL(ops.StageHierarchy, 999), s.StageId, wi.ComponentId, wi.Id
        )                                           AS Id,
        wi.Id                                       AS WorkItemId,
        @ProjectFK                                  AS ProjectPK,
        pd.ProjectId                                AS ProjectId,
        s.StageId                                   AS StageId,
        s.StageName                                 AS StageName,
        LTRIM(RTRIM(
            s.StageName + N' ' + CAST(ps.StartYear AS NVARCHAR(4))
            + ISNULL(N' ' + oo.Code, N'')
        ))                                          AS Source,       -- "NEP 2026 OO-1"
        wi.Source                                   AS Provenance,   -- Base | Revision
        wi.ComponentId                              AS ComponentId,
        pd.ProjectId + N'-' + wi.ComponentId        AS ComponentCode,
        cc.Description                              AS ComponentDescription,
        sw.Description                              AS TypeOfWork,
        t.PhysicalTarget                            AS Target,
        COALESCE(t.TargetUnit, sw.Measure)          AS TargetUnit
    FROM dbo.fProjectStages(@ProjectFK) s
    CROSS APPLY dbo.fProjectMajorWorkItem(@ProjectFK, s.StageId) wi
    -- TOP 1: fProjectDetails can union Base + Revision; we only want the identity columns.
    OUTER APPLY (
        SELECT TOP 1 d.ProjectId, d.ProgramFK, d.CategoryName
        FROM dbo.fProjectDetails(@ProjectFK, s.StageId) d
        ORDER BY d.Id
    ) pd
    OUTER APPLY (
        SELECT SUM(l.PhysicalTarget) AS PhysicalTarget,
               MAX(l.TargetUnit)     AS TargetUnit
        FROM dbo.fProjectMajorWorkLocations(@ProjectFK, s.StageId) l
        WHERE l.WorkItemFK = wi.Id AND l.IsDeleted = 0
    ) t
    OUTER APPLY (
        SELECT TOP 1 c.Description
        FROM dbo.fProjectComponentCost(@ProjectFK, s.StageId) c
        WHERE c.ComponentId = wi.ComponentId AND c.IsDeleted = 0
        ORDER BY c.Id
    ) cc
    OUTER APPLY (
        SELECT TOP 1 g.StartYear
        FROM dbo.fProgramStages(pd.ProgramFK) g
        WHERE g.StageId = s.StageId
    ) ps
    OUTER APPLY (        -- copy the OO-code CASE verbatim from Program.StageTargets.sql,
        SELECT ...       -- substituting pd.CategoryName for p.CategoryName
    ) oo
    LEFT JOIN dbo.tOptionProgramStage ops ON ops.NameId = s.StageId
    LEFT JOIN dbo.tOptionScopeOfWork  sw  ON sw.Id      = wi.WorkTypeFK
    WHERE wi.IsDeleted = 0
);
```

All dependencies already exist on this branch (`fProjectStages`, `fProjectMajorWorkItem`,
`fProjectMajorWorkLocations`, `fProjectComponentCost`, `fProjectDetails`, `fProgramStages`,
`tOptionProgramStage.StageHierarchy`, `tOptionScopeOfWork`). Confirm the `tOptionProgramStage` join
column (`NameId`, inherited from `TableEnum`) against
[OptionProgramStage.cs](DBHelper/Models/Table/Lookups/OptionProgramStage.cs) before writing the join.

**No migration runner** — the script is applied by hand, same posture as
`Main/Resources/Internal/SQLScripts/Revision.Queue.sql`. Say so in the file header.

### 2. Read model + DbSet

- New `DBHelper/Models/Functions/Project/ProjectStageTargets.cs` — same shape as `ProgramStageTargets`
  in `f6cc5bf8`, plus `WorkItemId`, `StageId`, `StageName`: `[Key] long Id`, `int WorkItemId`,
  `ProjectPK`, `ProjectId`, `int StageId`, `StageName`, `Source`, `Provenance`, `ComponentId`,
  `ComponentCode`, `ComponentDescription`, `TypeOfWork`, `Double? Target`, `TargetUnit`.
  Note `ROW_NUMBER()` returns `BIGINT` → map `Id` as `long`; check `FilterDataCursor`'s cursor
  parameters are `long`-compatible, and cast to `INT` in the TVF if they are not.
- Register in [MYPSDbContext.cs](DBHelper/Data/MYPSDbContext.cs) in the project-TVF region (~lines 143–152,
  beside `fProjectMajorWorkItem`).

### 3. Endpoints

Both go in [ProjectController.cs](WebAPI/Controllers/Projects/ProjectController.cs), immediately after
`ShowProjectStages` (~line 285), marked `[AllowAnonymous] [HttpPost]` to match their siblings
`ShowProjectStages` and `ShowProjectDetails` — so neither needs RBAC "Sync API" registration.

Both open with the **same visibility gate**, copied verbatim from `ShowProjectStages`
([ProjectController.cs:256-268](WebAPI/Controllers/Projects/ProjectController.cs#L256-L268)): under
`_Session.ApplyFilter`, `AnyAsync` against `dbo.fUserVisibleProjects({_Session.UserId})` on
`ProjectPK == dto.ProjectId`, returning the identical non-disclosing `BadRequestObjectResult`. Factor it
into a small private helper on the controller rather than pasting it twice.

**`ShowProjectTargetComponents`** — the accordion's top-level rows. Not paginated; a project carries a
handful of components. Query the TVF and project distinct components in SQL:

```csharp
var components = await _db.fProjectStageTargets
    .FromSqlInterpolated($"SELECT * FROM dbo.fProjectStageTargets({dto.ProjectId})")
    .AsNoTracking()
    .GroupBy(x => x.ComponentId)
    .Select(g => new {
        ComponentId = g.Key,
        ComponentDescription = g.Last().ComponentDescription,
        StageCount = g.Select(x => x.StageId).Distinct().Count()
    })
    .OrderBy(x => x.ComponentId)
    .ToListAsync(cancellationToken);
return Ok(new { Components = components });
```

DTO: `ShowProjectTargetComponentsDTO { [Required] string ProjectId }` — ProjectPK, same convention as
`ShowProjectStagesDTO`.

**`ShowProjectStageTargets`** — the paginated per-stage rows for one component:

```csharp
public class ShowProjectStageTargetsDTO : EnumPagination<ShowProjectStageTargetsFilterDTO>
{
    // ProjectPK, matching ShowProjectStagesDTO.ProjectId — the FE sends ProjectDetails.ProjectFK.
    [Required] public string ProjectId { get; set; } = string.Empty;
}
public class ShowProjectStageTargetsFilterDTO
{
    public string ComponentId { get; set; } = string.Empty;
    public string StageName { get; set; } = string.Empty;
}
```

Body after the gate:

1. Filters: `("v.ComponentId = @componentId", "@componentId", …)` when `dto.Filters.ComponentId` is non-empty; likewise `v.StageName` (unused by this UI, but it keeps the endpoint useful and costs one line).
2. `_db.FilterDataCursor<ProjectStageTargets, ShowProjectStageTargetsFilterDTO>(tableName: "fProjectStageTargets", sourceParameters: [("@ProjectFK", dto.ProjectId)], isTableValuedFunction: true, dto, filter, keyColumn: "Id", descending: false, includeTotal: true, ct)` — `descending: false` so `Id` ascending yields the stage-progression order baked into the `ROW_NUMBER`.
3. `result.HasError` → 400 `ErrorResult`; else `Ok(result.Data)`. Standard `try/catch` → `_exceptionHandler.Handle(ex, dto, _Session.UserId.ToString())`.

Reference call site for `FilterDataCursor` over a TVF with source parameters:
`ProgramController.ShowProjectsInProgram`
([ProgramController.cs:316-382](WebAPI/Controllers/Programs/ProgramController.cs#L316-L382)).
Engine: [Helpers/CursorPagination.cs](Helpers/CursorPagination.cs).

### 4. Frontend

**Types** — [FE/src/pages/Project/Model.d.ts](FE/src/pages/Project/Model.d.ts): add
`ProjectTargetComponent` (`ComponentId`, `ComponentDescription`, `StageCount`),
`ProjectStageTargetFilter` (`ComponentId?`, `StageName?`), `ShowProjectStageTargetsRequest`,
`ProjectStageTarget`, and `ProjectStageTargetsPaginationResponse` — the last three copied from the
`Program/Model.d.ts` block in `f6cc5bf8` with `WorkItemId`/`StageId`/`StageName` added.

**Service** — [FE/src/pages/Project/Service.ts](FE/src/pages/Project/Service.ts): add
`fetchProjectTargetComponents` and `fetchProjectStageTargets` in a new *Component Targets* region after
the *Project Stages* region (~line 225), following the existing `httpClient.post` + `preloaderMessage`
shape. No `catch` toasts — the interceptor already surfaces API errors (see [FE/CLAUDE.md](FE/CLAUDE.md)).

**Panel component** — new `FE/src/pages/Project/components/ComponentTargetsPanel.tsx`. This is
`StageTargetsPanel.tsx` from `f6cc5bf8` with props `{ projectPK: string; componentId: string }` and the
fetcher swapped. Keep its two load-bearing properties:

- It owns its own `usePagination` instance ([FE/src/hooks/usePagination.ts](FE/src/hooks/usePagination.ts)); mounting on expand / unmounting on collapse is what resets pagination to page 1 — no manual cursor clearing in the parent.
- The `useCallback` fetcher adapts `PaginatedRequest<T>` into the endpoint shape (`ProjectId` alongside the cursor fields, `ComponentId` inside `Filters`), same as `ProgramDetail.tsx` does for `ShowProjectsInProgram`.

Changes from the program version: **2-decimal** target formatting, and a component-flavoured empty state.

```ts
const formatTarget = (target?: number | null) =>
    target === null || target === undefined
        ? '—'
        : target.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

Six columns in order, `colSpan={6}` empty-state row reading "No targets available for this component" /
"Loading targets…". Component ID cell renders `target.ComponentCode || target.ComponentId || '—'`.

**Component accordion** — new `FE/src/pages/Project/components/ComponentTargetsForm.tsx`, props
`{ projectPK: string }`:

- On mount (guarded on a non-empty `projectPK`), call `fetchProjectTargetComponents(projectPK)` into local state, with an `isLoading` flag and a `catch` that leaves the list empty.
- Render with `CollapsibleTable<ProjectTargetComponent>` ([FE/src/components/tailwindui/collapsible-table.tsx](FE/src/components/tailwindui/collapsible-table.tsx)): first column an `ExpandToggleButton` labelled `component.ComponentId` — the bare id, e.g. `CW1`; the project-qualified form belongs in the expanded table, where it varies per stage — then Component Description and a Stages count column. `emptyMessage="No component targets available for this project"`.
- Single-open state: `const [expandedComponentId, setExpandedComponentId] = useState<string | null>(null)`, toggled with `setExpandedComponentId(prev => prev === c.ComponentId ? null : c.ComponentId)`. Component ids are unique within a project, so the id alone is a sufficient key (unlike the program list, which had to pair `ProgramPK:StageName`).
- `renderExpandedContent={(c) => <ComponentTargetsPanel projectPK={projectPK} componentId={c.ComponentId} />}`.

**Wiring** — [FE/src/pages/Project/components/ProjectForm.tsx](FE/src/pages/Project/components/ProjectForm.tsx):
insert a new section immediately after the Major Items of Work block (which closes at ~line 1244, just
before the Supporting Documents grid), reusing the identical wrapper the surrounding sections use:

```tsx
{/* Component Targets Section */}
<div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
  <div className="px-4 py-6 sm:p-8">
    <div className="mb-6">
      <h3 className="text-lg font-semibold leading-7 text-gray-900">Component Targets</h3>
    </div>
    <ComponentTargetsForm projectPK={initialData?.ProjectDetails.ProjectFK || ''} />
  </div>
</div>
```

`ProjectDetails.ProjectFK` **is** the ProjectPK — the same value `ShowProjectStages` expects. This is a
read-only panel: it takes no `disabled` prop and is unaffected by lock/revise state.

## Tasks

**Senior**
- `Main/Resources/Internal/SQLScripts/Project.StageTargets.sql` — the all-stages TVF, with the manual-deployment note in the header.
- `DBHelper/Models/Functions/Project/ProjectStageTargets.cs` + `MYPSDbContext` DbSet; confirm the `long` vs `int` cursor-key question against `FilterDataCursor`.
- `ShowProjectTargetComponents` + `ShowProjectStageTargets` + DTOs, with the shared visibility-gate helper.

**Junior**
- `Model.d.ts` types and the two `Service.ts` fetchers.
- `ComponentTargetsPanel.tsx` (port of `StageTargetsPanel.tsx`, 2-decimal formatter, component-scoped fetch).
- `ComponentTargetsForm.tsx` (component accordion) and the `ProjectForm.tsx` section insert.

**Documentation**
- Note the new panel in `FE/UserManual.md` under the project details walkthrough.
- Record the manual-SQL deployment step wherever `Revision.Queue.sql` is already called out.

## Files Touched

| File | Change |
|---|---|
| `Main/Resources/Internal/SQLScripts/Project.StageTargets.sql` | new — `dbo.fProjectStageTargets(@ProjectFK)` |
| `DBHelper/Models/Functions/Project/ProjectStageTargets.cs` | new — read model |
| `DBHelper/Data/MYPSDbContext.cs` | +1 DbSet in the project-TVF region |
| `WebAPI/Controllers/Projects/DTOProject.cs` | +3 DTOs |
| `WebAPI/Controllers/Projects/ProjectController.cs` | +2 actions after `ShowProjectStages`, +1 private gate helper |
| `FE/src/pages/Project/Model.d.ts` | +5 interfaces |
| `FE/src/pages/Project/Service.ts` | +2 fetchers |
| `FE/src/pages/Project/components/ComponentTargetsPanel.tsx` | new |
| `FE/src/pages/Project/components/ComponentTargetsForm.tsx` | new |
| `FE/src/pages/Project/components/ProjectForm.tsx` | +1 section after Major Items of Work |

## Verification

1. **Apply the SQL by hand** (there is no migration runner), then sanity-check it directly:
   ```sql
   SELECT * FROM dbo.fProjectStageTargets('<ProjectPK of P00999004VS>') ORDER BY Id;
   ```
   Confirm: `Id` is dense and gap-free from 1; rows are ordered BP → … → GAA-R; the same `ComponentId` appears once per stage it exists in; `Source` looks like `TF 2026 OO-1` (not `Base`/`Revision`); `ComponentCode` is `P00999004VS-CW1`; `Target` matches a hand-run `SUM(PhysicalTarget)` over that work item's locations.
2. **Endpoints** — `POST /api/Project/ShowProjectTargetComponents` with `{ ProjectId: "<ProjectPK>" }` → the distinct component list. Then `POST /api/Project/ShowProjectStageTargets` with `{ ProjectId: "<ProjectPK>", limit: 10, page: 1, Navigation: 0, PreviousFilteredId: 0, NextFilteredId: 0, PageCursorId: 0, Filters: { ComponentId: "CW1" } }` → 200 with `lists`/`page`/`totalPages`/`HasNext`/`HasPrevious`, rows only for `CW1`.
3. **Pagination correctness** — pick a component with more rows than the page size (or drop `limit` to 2). Walk Next through every page and confirm the union of pages equals the unfiltered TVF rows for that component with no duplicates and no gaps. Then exercise every control: First, Previous, Next, Last, and a numbered jump to a page never visited (`usePagination.goToPage` silently chains Next/Previous hops for unvisited pages, so this is the path most likely to break) — each must land on the same rows the sequential walk produced for that page. This is the check that validates the `ROW_NUMBER` key.
4. **Visibility** — sign in as a user in a group with `ApplyFilter = true` that cannot see the project; both endpoints must return the same "Project not found" rejection `ShowProjectStages` gives, and the panel must render no rows.
5. **UI** — start the app (`/run`, or the FE dev server + API) and open `/projects/project-details/P00999004VS:TF-R`. Check: the Component Targets panel sits directly under Major Items of Work; top-level rows are bare component ids like `CW1`, and the expanded rows show the project-qualified `P00999004VS-CW1` form; expanding a second component collapses the first; the six columns are present and correctly ordered; rows run in stage order; `Target` reads e.g. `1,250.00`; the `PaginationBar` sits inside the expanded panel and First/Previous/Next/Last plus numbered page jumps all change rows without a full-page reload; re-expanding a component starts back at page 1.
6. **Empty states** — a component with no work-location targets shows the "No targets available for this component" row; a project with no components shows "No component targets available for this project".
7. **Regression** — on the same page, confirm Major Items of Work still expands its work locations, Update Project still saves, and the lock/revise actions are unchanged. If the page has an existing Playwright spec under `e2e/tests/`, run it; a narrated spec for this panel (modelled on `programs-stage-targets.narrated.spec.ts` in `f6cc5bf8`) is a good addition — see [e2e/CLAUDE.md](e2e/CLAUDE.md).

## Risks

- **`ROW_NUMBER` as a keyset key.** It is stable only for a fixed underlying dataset. If a work item is added or soft-deleted mid-session, an open pagination walk can shift by one row. Acceptable for a read-only panel on a page that already remounts on refresh, and strictly better than a possibly-duplicated `wi.Id`. Verification step 3 is what proves the key sound; do not skip it.
- **`Id` type.** `ROW_NUMBER()` is `BIGINT`. If `FilterDataCursor`'s cursor fields are `int`, cast the column to `INT` in the TVF and keep the model property `int`. Resolve this while writing the read model, not at debug time.
- **Cost of the all-stages fan-out.** The TVF applies four per-stage TVFs across every stage of the project, and `ShowProjectTargetComponents` runs the whole thing to build the accordion. Bounded by one project (a handful of stages × tens of work items), so fine — but do not later reuse this function program-wide; that is what `fProgramStageTargets` on `f6cc5bf8` is for.
- **`fProjectDetails` cardinality.** If it returns both Base and Revision rows, the `OUTER APPLY … TOP 1 … ORDER BY d.Id` is what keeps one row per work item per stage. Verify against a project that has an approved revision, not just a base-only project.
- **`Source` label depends on `fProgramStages(pd.ProgramFK)`.** If the program has no row for a stage (drift between `tProjectStages` and `tProgramStages`), `Source` degrades to a whitespace string rather than failing. Confirm it renders as `—` in the UI.
- **Duplicate work with `feat/program-stage-targets`.** If that branch later merges, `Program.StageTargets.sql` and `Project.StageTargets.sql` will coexist with related but differently-shaped bodies. That is intentional — flag it at merge time so nobody "de-duplicates" by routing the project page through the program TVF.

## Completion Log
Date: 2026-08-23
- Implementation: All 3 backend and 3 frontend tasks done. New TVF `dbo.fProjectStageTargets(@ProjectFK)` (`Main/Resources/Internal/SQLScripts/Project.StageTargets.sql`), read model `ProjectStageTargets` + DbSet, three DTOs, and two endpoints (`ShowProjectTargetComponents`, `ShowProjectStageTargets`) sharing a new private `RejectIfProjectNotVisible` gate helper. Frontend: 5 new types, 2 service fetchers, `ComponentTargetsPanel.tsx` (paginated per-stage targets for one component), `ComponentTargetsForm.tsx` (component accordion), wired into `ProjectForm.tsx` directly after the Major Items of Work section. `dotnet build WebAPI` → 0 errors, no new warnings. `tsc --noEmit` and `eslint` → no errors in any new or changed file (3 pre-existing `tsc` errors and 2 pre-existing `eslint` findings remain in untouched files).
- Documentation: New User Manual section 5.3.6 "Component Targets" (purpose, both column tables, step-by-step, common outcomes); former 5.3.6/5.3.7 renumbered to 5.3.7/5.3.8 with the one cross-reference updated; manual bumped 3.8 → 3.9 with a revision-history row. New "Manual database scripts" section in `documents/docs/README.md` listing all three hand-applied SQL scripts. XML doc comments on the new C# model/DTOs/endpoints and JSDoc on the new TSX components.

Deviations / flags:
- `ShowProjectTargetComponents` groups components **in memory** rather than in SQL. The plan sketched an EF `GroupBy` with `Select(...).Distinct().Count()`; that translates to `COUNT(DISTINCT)` over a composed TVF, which EF is liable to fail on at runtime. The TVF is already scoped to one project, so materializing first is cheap and certain. Description now uses `g.Last()` (latest stage) instead of `Max()`, which is more meaningful once grouping is client-side.
- `Id` is `long` in the read model, not `int`. Resolved the plan's open question: `EnumPagination` cursors are already `long?` and `GetKeyValue` uses `Convert.ToInt64`, so `ROW_NUMBER()`'s `BIGINT` needs no cast.
- The `Source` label omits the year entirely when `fProgramStages` has no matching row, rather than emitting `NULL`/blank — `ISNULL(N' ' + CAST(...), N'')` instead of concatenating unconditionally.
- Documentation task said "record the manual-SQL deployment step wherever `Revision.Queue.sql` is already called out". The only project doc that mentions it is a revision-specific spec, which is the wrong home for a project-targets note, so the step was recorded as a new table in the documentation index (`documents/docs/README.md`) covering all three scripts instead.
- Two defects found and fixed after applying the script to a real database (2026-08-24, `server.local/myps_db_dev`):
  1. **`Msg 8115, arithmetic overflow converting int to numeric`** on any call. `tOptionProgramStage.StageHierarchy` is `decimal(7,5)` — two integer digits — and `ISNULL` takes its type from the first argument, so the sentinel `999` could not be converted. It fires even when no row is NULL, because the constant must be convertible at all. Fixed by widening first: `ISNULL(CAST(ops.StageHierarchy AS DECIMAL(12,5)), 999)`.
  2. **Components split into duplicate accordion rows.** A project's ProjectId changes when it leaves the BP stage (`BP01000002VS` → `P01000002VS`), so the same component carries a different `ComponentCode` per stage. `ShowProjectTargetComponents` grouped on `(ComponentId, ComponentCode)`, which would have shown `CW1` twice. Now groups on `ComponentId` alone, ordering by `Id` first so `Last()` reliably means "as at the latest stage" for both the code and the description.

- Follow-up change (2026-08-24, user request): the accordion's top-level rows now show the **bare** `{ComponentId}` (`CW1`) rather than the project-qualified `{ProjectId}-{ComponentId}`. The qualified form is retained inside the expanded table, where it is per-stage and carries real information. `ComponentCode` was dropped from the `ShowProjectTargetComponents` response and from `ProjectTargetComponent`, having lost its only consumer; the ordering-before-`Last()` in that projection remains, since the description still depends on it.

- Two further defects found on 2026-08-24 while investigating a duplicate-rows report, both caused by the **same upstream problem**: `dbo.fProjectMajorWorkItem` and `dbo.fProjectMajorWorkLocations` can each return byte-identical duplicate rows (observed on `BP01100001MN`: work item 104 returned 4x at every stage after BP, and its location 116 likewise). Neither TVF is checked into this repo, so the root cause could not be fixed at source; `fProjectStageTargets` now defends against it:
  1. **Duplicated target rows.** `BP01100001MN` returned 25 rows for 7 (stage, component) pairs. The `CROSS APPLY` over `fProjectMajorWorkItem` is now a derived table that keeps `ROW_NUMBER() OVER (PARTITION BY w.Id ...) = 1`, guaranteeing one row per work item per stage. 25 -> 7.
  2. **Inflated `Target` figures — the more serious of the two.** Because the duplicated *location* rows were all inside the `SUM`, the target was multiplied by the duplication factor: `BP01100001MN` read 120,000 where the true figure is 30,000. The sum now runs over locations deduplicated on `l.Id`. This one produced wrong numbers on screen, not just repeated rows.
  Post-fix sweep over all 145 projects: zero projects return more than one row per (stage, component); `BP01000002VS` unchanged at 14 rows with unchanged targets.
- **Note for the wider codebase:** `ShowProjectDetails` calls `fProjectMajorWorkItem` and `fProjectMajorWorkLocations` directly, with no such deduplication, so the existing Major Items of Work and Work Locations tables are likely showing the same duplicated rows for the 6 affected projects. Out of scope here, but worth a ticket.
- A duplicate-accordion report on the same day turned out to be a **stale API process**, not a code defect: the running `Main.exe` predated the ComponentId-only grouping fix and was still returning `ComponentCode`, so the two `CW1` entries it emitted both rendered as `CW1` under the new bare-id label. No code change needed; the process needs restarting to pick up the rebuilt binaries.

## Verification Log
Date: 2026-08-24 — run against `server.local/myps_db_dev` via sqlcmd.

- **Step 1 (TVF)** PASS. Script applied. `fProjectStageTargets('BP01000002VS')` returns 14 dense rows, Ids 1–14, ordered BP → NEP → NEP-E → HGAB → HGAB-I → GAA → GAA-R; `Source` renders `"NEP-E 2026 OO-1"` (OO parsed from `OO1: Ensure Safe and Reliable National Road System`); `ComponentCode` is `P01000002VS-CW1`. A project whose category is not OO-shaped degrades to `"BP 2027"` with no OO, as designed.
- **Step 3 (pagination key)** PASS — the check the plan called load-bearing. Simulated `FilterDataCursor`'s exact emitted SQL for `ComponentId='CW1'`, limit 2: total 7; pages `{1,3} {5,7} {9,11} {13}` tile the full set with no gaps or duplicates; Previous from page 3 returns page 2; Last (DESC) resolves correctly. The `ROW_NUMBER` key is sound.
- **Read-model mapping** PASS. `sys.dm_exec_describe_first_result_set` confirms all 14 columns match `ProjectStageTargets` by name and type — `Id bigint`→`long`, `Target float`→`Double?`, every string within its `MaxLength`.
- **Component grouping** PASS (after fix 2): two rows, `CW1` and `ROW`, 7 stages each.
- **Step 6 (empty state)** PASS. An unknown ProjectPK returns 0 rows rather than erroring.
- **Still unverified — needs the running app:** Step 2 (endpoint responses through EF/`FilterDataCursor`), Step 4 (visibility gate under `ApplyFilter`), Step 5 (UI), Step 7 (regression). `ComponentDescription` is an empty string in this dataset, so the column renders `—` throughout; worth confirming against a project that has descriptions populated.

Files changed:
- `Main/Resources/Internal/SQLScripts/Project.StageTargets.sql` (new)
- `DBHelper/Models/Functions/Project/ProjectStageTargets.cs` (new)
- `DBHelper/Data/MYPSDbContext.cs`
- `WebAPI/Controllers/Projects/DTOProject.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`
- `FE/src/pages/Project/Model.d.ts`
- `FE/src/pages/Project/Service.ts`
- `FE/src/pages/Project/components/ComponentTargetsPanel.tsx` (new)
- `FE/src/pages/Project/components/ComponentTargetsForm.tsx` (new)
- `FE/src/pages/Project/components/ProjectForm.tsx`
- `FE/UserManual.md`
- `documents/docs/README.md`

Not part of this task (pre-existing local working-tree changes, left untouched): `FE/.env.development`, `Main/appsettings.Development.json`, `FE/package-lock.json`.
