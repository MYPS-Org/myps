# Plan: Category: an unchanged retired Category always saves; in-use Category / Thrust can be retired (#482)

Status: Implemented
Created: 2026-10-28
Source: Gitea #482 (part of #478), with the user's decisions of 2026-10-28 (AskUserQuestion):
- **Keep the documented OR rule.** Fix only the lock-out.
- **Relax the in-use guard** for Category **and** Thrust.

Stacked on PR #486 (#481), which is stacked on #485 (#480) and #483 (#479).

## Context
#482 asked to change the Category save rule from `IsActive OR not expired` to AND. The user chose to **keep OR**: it is the documented, intended behaviour (`FE/UserManual.md` §5.7.6, from PR #457). Validity decides what can be picked, and Inactive only matters once a row has expired.

The real defect #478 is about is the **lock-out**. `ValidateProjectDetailsLookups` (`Helpers/ProjectHelper.cs`, around L542) applies the rule to every save, and the form posts the whole project. So a project whose Category is **expired and Inactive** can't be saved for any reason, even when the Category is unchanged. Thrust already has this exception through `PreviousThrust`/`PreviousCategory`; Category doesn't use it for its own check.

**Second problem: retiring an in-use Category or Thrust is impossible from Code Tables.**
- Category (CodeTableController around L561) and Thrust (around L698) refuse every Update of a row a project uses: *"…currently in use and cannot be updated or deleted"*. That blocks moving Valid Until/To to a past year, which the manual names as the way to retire one, and blocks setting it Inactive.
- Category's toggle only gets through by accident: its payload has no `CategoryId`, and the guard is keyed on the incoming value.
- Category's **edit** form sends no `IsActive`, so saving an edit silently deactivates the Category. That's the #397 bug class, never fixed for Category.

## Acceptance Criteria
As a PS user and PS Admin, I want a project whose Category was retired to keep saving with it, and I want to retire an in-use Category or Thrust from Code Tables, so that retiring codes never locks projects out and is actually possible.

- [ ] **S04-TC039:** a project has Category C, and C is set Inactive **and** its Valid Until moves to last year. The project opens with C still shown and saves with no other change. The same holds on ResubmitRevision when the request keeps the project's own Category.
- [ ] **S04-TC038 (rewritten for the kept OR rule):** a Category that is **Inactive and expired** is refused for a new or changed selection (*"Selected Category '…' is not valid."*). A Category that is only Inactive (still valid), or only expired (still Active), stays accepted as documented in §5.7.6.
- [ ] **Code Tables, Category:** an in-use Category can be set Inactive and have its Valid Until changed. Deleting it or changing its Name, Minimum or Maximum while in use is refused.
- [ ] **Code Tables, Thrust:** an in-use Thrust can be set Inactive and have its Valid From/To and Infra Type changed. Deleting it or changing its Description, Program, Sub-Program, Activity or Seq # while in use is refused.
- [ ] "In use" counts projects **and** modification requests (`tProjectRevisions`, `tRevisionProjects`), judged by the stored row's CategoryId / PAPKey.
- [ ] Editing a Category in Code Tables keeps its Active status.

## Approach
**1. Lock-out fix** (`Helpers/ProjectHelper.cs`, `ValidateProjectDetailsLookups`):
- Load the Category by `CategoryId` first; if it doesn't exist, keep "not valid".
- Apply the OR rule (`IsActive || ValidUntil == 0 || ValidUntil >= year`) **only when** `p.PreviousCategory == null || p.Category != p.PreviousCategory`, the same gate Thrust uses.
- Callers already pass `PreviousCategory` (UpdateProjectDetails), and AddProject passes none.
- Lump Sum: `ValidateTierAndCategoryAsync` is only used by CreateLumpSum, which is always new, so it stays as is. UpdateLumpSum doesn't re-check Category validity, so it needs no change.

**2. Modification:**
- **ResubmitRevision:** keep its existing check, gated on a change against the request. Also skip it when the Category equals the **project's stored** Category, snapshotted before `UpdateRevisionData` like #481's `StoredLookups`.
- **RequestRevision:** no Category check exists today. Add the same OR check when the merged Category differs from the stored snapshot, rolling back on refusal.

**3. Code Tables guards** (`CodeTableController`, `ProjectCategory` and `ProjectThrust`, same shape as #481's Origin/Agency):
- Remove the blanket guard.
- After `CheckUpdate` loads, refuse only when the stored row is in use (`tProjectRevisions` or `tRevisionProjects` by stored CategoryId / PAPKey) **and** the request is a Delete or changes an identity field:
  - Category: CategoryName, Minimum, Maximum.
  - Thrust: ThrustDescription, ProgramName, SubProgramName, ActivityName, SequenceNumber.
- New message: *"…currently in use, so it cannot be deleted or renamed. You can still set it Inactive or change its validity."*

**4. FE** (`CategoryTable.tsx`): the edit payload includes `IsActive: original?.IsActive !== false`, as AgencyTable and ThrustTable already do.

## Tasks
### Implementation
- [ ] `ValidateProjectDetailsLookups`: an unchanged Category skips the OR rule; unknown still fails. Add a unit test where possible; the gate is a one-line condition, so it can be extracted as a pure `CategoryNeedsValidityCheck(category, previous)` if that's cleaner.
- [ ] RevisionController: in ResubmitRevision, also keep the project's stored Category. In RequestRevision, add the OR check on a changed Category, with rollback.
- [ ] CodeTableController: relax the Category and Thrust guards as described.
- [ ] `FE/src/pages/CodeTables/tables/projectDetails/CategoryTable.tsx`: send IsActive on edit.
- [ ] e2e `e2e/tests/code-table-retired-category.spec.ts`:
  - **TC039:** a BP project (Category 1, Thrust 1142, plus a component and 100% funding) whose Category 1 is set Inactive with Valid Until = last year, through `UpdateCodeTable` with the CategoryTable payload. The page still shows it, and Update Project succeeds. Restore IsActive and Valid Until in `afterEach`.
  - **TC038:** re-sending the save with Category set to another Category made Inactive and expired gets 400 "Invalid Category". The same Category only Inactive (still valid) gets 200.
  - **Thrust guard:** setting the in-use Thrust 1142 Inactive with the ThrustTable toggle payload gets 200 (it used to be "In Use"); restore it. Renaming it gets 400 "In Use".
  - Check it fails on the pre-#482 API (the #481 branch).

### Documentation
- [ ] `FE/UserManual.md` §5.7.6:
  - Under "What Valid and Active/Inactive do for Category and Thrust": a project that already has a fully retired Category still saves while the Category is unchanged.
  - The "To stop a Category…" line: retiring works for in-use rows too; delete and rename stay refused.
- [ ] `e2e/CLAUDE.md` coverage map row.

## Files / Components Touched
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/RetiredLookupRuleTests.cs`
- `WebAPI/Controllers/Revision/RevisionController.cs`, `WebAPI/Controllers/CodeTable/CodeTableController.cs`
- `FE/src/pages/CodeTables/tables/projectDetails/CategoryTable.tsx`
- `e2e/tests/code-table-retired-category.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`

## Verification
- Build; MYPS.UnitTests; MYPS.ApiIntegrationTests with `MYPS_HTTP_TEST_MYPSDB`. `ProjectHelperValidateLookupsContractTests` asserts source text of the Category/Thrust gate, so update its expectations if the text moves.
- tsc against the 21 baseline.
- e2e on local myps_db_dev, all four `code-table-retired-*` specs. Restore Category 1 (IsActive, ValidUntil) and Thrust 1142. It fails on the pre-#482 API.

## Risks / Open Questions / Assumptions
- **Not changed:** the documented OR rule is kept on purpose (user decision); #482's original AND expectation for TC038 doesn't apply, and the PR says so.
- **Assumption:** Thrust's identity fields (Description, Program, Sub-Program, Activity, Seq #) stay locked while in use, since they describe what the PAP *is*. Validity, Active status and Infra Type can change.
- **Not covered:** the e2e changes Category 1, which many local projects use, for a few seconds (local DB only; restored in `afterEach`).
- **Stacked:** merge order is #483, then #485, then #486, then this one.

## Completion Log
Date: 2026-10-28
- **Implementation:**
  - `ProjectHelper`:
    - `CategoryNeedsValidityCheck` and `CategoryIsSelectable` (pure, 5 unit cases).
    - `ValidateProjectDetailsLookups` loads the Category by id and applies the documented OR rule only to a new or changed Category (`PreviousCategory`).
  - RevisionController: both endpoints snapshot `StoredCategory` before `UpdateRevisionData`.
    - RequestRevision now checks a changed Category (it never did), with rollback.
    - ResubmitRevision also keeps the project's own Category.
  - CodeTableController: the blanket in-use guards for ProjectCategory and ProjectThrust are replaced. Refused while in use (by the stored CategoryId / PAPKey, projects or modification requests) are only Delete or a change to Category Name/Minimum/Maximum, or to Thrust Description/Program/Sub-Program/Activity/Seq #.
  - `CategoryTable.tsx`: an edit keeps IsActive.
  - New e2e spec `code-table-retired-category.spec.ts` (3 tests).
- **Documentation:** `FE/UserManual.md` §5.7.6 Category/Thrust: a fully retired Category is kept by projects that already have it, and in-use rows can be retired (delete and rename refused). `e2e/CLAUDE.md` has a coverage row.
- **Verification:**
  - Build clean; unit 63/63; integration 88/88; tsc 21 before and after.
  - e2e 3/3 on local myps_db_dev, and 12/12 with all four `code-table-retired-*` specs.
  - On the pre-#482 API (the #481 branch): TC039 and the Thrust test fail; TC038 passes, as intended, since that behaviour is kept.

Deviations / flags:
- **The first e2e run left Category 1 Inactive.** The API refuses to switch it back on (RISK-072: its range 1-20000 overlaps the active Category "OO1", a legacy local state), and no active unrestricted Category on the local DB is free of overlap. I restored it with SQL (IsActive = 1, its value before the test), and deleted the one orphan test program through DeleteProgram. TC039 now flips Category 1 with sqlcmd (`E2E_SQL_*`; skips without them). Each test resets program/projectPK first, and API restores assert their status.
- **Category is locked after a project is created** ("Category Locked": part of the Project ID). So "new or changed Category" happens only on AddProject and in modification requests; TC038 uses AddProject.
- **TC038 is rewritten for the kept OR rule** (the user's decision): #482's original AND expectation doesn't apply.
- **Not run at runtime:** Modification (no revision fixture).

Files changed:
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/RetiredLookupRuleTests.cs`
- `WebAPI/Controllers/Revision/RevisionController.cs`, `WebAPI/Controllers/CodeTable/CodeTableController.cs`
- `FE/src/pages/CodeTables/tables/projectDetails/CategoryTable.tsx`
- `e2e/tests/code-table-retired-category.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`, `documents/plans/category-retired-lockout-482.md`

### Code review (2026-10-28, /code-review medium): 9 findings, 6 fixed
- **Fixed:** `CategoryTable` **add** omitted IsActive too, so every new Category was created Inactive. It now sends `IsActive: true`.
- **Fixed:** the Modification dropdowns (RevisionController L473/L781) dropped expired Categories, so a project's own expired Category showed blank there. They now return the full list; the form already narrows new picks to valid ones and keeps the selected value.
- **Fixed:** ResubmitRevision's Category refusal now rolls back its transaction.
- **Fixed:** Minimum/Maximum are no longer locked on an in-use Category; only delete and rename (CategoryName) are refused. They only bound ProjectIds still to be minted, and locking them made an overlap like Category 1's impossible to correct.
- **Fixed:** one shared `ProjectHelper.ValidateCategoryAsync(category, previous, ct, alsoKept)` replaces the three inline copies (ValidateProjectDetailsLookups, RequestRevision, ResubmitRevision) and Lump Sum's `ValidateTierAndCategoryAsync` copy.
- **Not changed:**
  - A Thrust edit that changes PAPKey reports success but saves nothing (pre-existing; PAPKey is never written).
  - The two AnyAsync queries in the guard.
  - Rejected modification requests still count as "in use" (conservative).
- **Re-verified:** build clean; unit 63/63; integration 88/88; tsc 21 before and after; e2e 12/12 (all four `code-table-retired-*` specs) on local myps_db_dev, with data restored.
