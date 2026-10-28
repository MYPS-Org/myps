# Plan: Retired Project Details lookups keep showing and saving (#481)

Status: Implemented
Created: 2026-10-28
Source: Gitea #481 (part of #478). Stacked on PR #485 (#480), which is stacked on PR #483 (#479).

## Context
The single-value Project Details lookups disagree with their own save check, `ValidateProjectDetailsLookups` (`Helpers/ProjectHelper.cs`), which is used by AddProject, UpdateProjectDetails and Lump Sum:
- **Origin and Agency.** `ShowProjectDropdowns` lists active rows only, and the save requires `IsActive` with no exception for a value the project already has. A project whose Origin or Agency is retired shows a **blank** field and **cannot be saved** until the user picks another value.
- **Implementation Mode, Emergency Mode, ROW Available, Feasibility Study, Detailed Design.** The dropdown lists inactive rows too, but the save rejects them: the user can pick a value that can never be saved.
- **Tier.** Neither side looks at IsActive.

These six have no Code Tables screen (`UpdateCodeTable` has no handler for them), and none is inactive in the local data. So in practice the reachable bug is Origin and Agency, which an admin can retire from Code Tables; the local DB already has one inactive Agency. The rule still applies to all eight, so they behave alike if a row is ever retired.

**Modification:** RevisionController's dropdowns list everything, and RequestRevision/ResubmitRevision don't check these fields (only Category, in Resubmit).

The rule is the same as #479 and #480:
- A retired value is not offered for a new pick and is refused when a project changes **to** it.
- A project that already has it keeps it, shows it and saves.

This is the Thrust model: `PreviousThrust` in the same params class.

## Acceptance Criteria
As a PS user, I want a project whose Origin or Agency (or another Project Details lookup) was later retired to keep showing and saving that value, while retired values are not offered for new choices, so that a code-table change never locks me out of a project.

- [ ] **S04-TC036:** a project's Origin (or Agency) is set Inactive. The project opens with the field still showing the name, and a save succeeds and keeps the value.
- [ ] **S04-TC037:** an Inactive Origin or Agency is not offered in the Add Project form, or in another project's dropdown. Changing a project's Origin or Agency **to** an inactive one is refused, with a message that names it as inactive.
- [ ] The same rule holds for Tier, Implementation Mode, Emergency Mode, ROW Available, Feasibility Study and Detailed Design (code-level; there's no UI to retire them).
- [ ] It holds in Project Details (Add / Update), Modification (RequestRevision / ResubmitRevision: only values the revision actually changes) and Lump Sum (Create / Update; Update compares with the stored Lump Sum Project).
- [ ] Existing messages for unknown values stay as they are (*"Selected Origin '…' is not valid."*).

## Approach
**1. Shared pieces** (`Helpers/ProjectHelper.cs`):
- `record ProjectDetailsLookupValues(int Tier, int Origin, int Agency, int? ImplementationMode, int? EmergencyMode, int? RowAvailable, int? Feasibility, int? DetailedDesign)`.
- A pure `ChangedProjectDetailsLookups(current, previous)` returning the (lookup, value) pairs that must be active: the non-null values that differ from `previous`, or all of them when `previous` is null (a new record). This is unit-tested.
- `ValidateProjectDetailsActiveAsync(this MYPSDbContext, current, previous, ct)`. For each changed value it loads the row (`NameId == value`). If the row is missing: *"Selected X '…' is not valid."* (same title and text as today). If it is inactive: *"Selected X '{Name}' is inactive and cannot be chosen."*
- `ValidateProjectDetailsLookupsParams` gets `ProjectDetailsLookupValues? Previous`, with the same comment style as `PreviousThrust`. In `ValidateProjectDetailsLookups`:
  - The eight lookups keep their existence check, with `&& x.IsActive` removed.
  - Before `IsValid = true`, it calls `ValidateProjectDetailsActiveAsync(current from p, p.Previous)`.

**2. Call sites:**
- **AddProject:** `Previous = null`, so everything is checked as new, same as today.
- **UpdateProjectDetails:** `Previous` comes from the already-loaded `ProjectRevision`, next to `PreviousThrust` / `PreviousCategory`.
- **Lump Sum `ValidateRequiredFieldsAsync`:** a new optional `previous` argument. UpdateLumpSum passes it from `LumpSumProject` (vLumpSumSet carries all eight); CreateLumpSum passes nothing.
  - The Region path passes `Previous` through.
  - The no-Region path calls `ValidateProjectDetailsActiveAsync` directly. Today it validates only Tier and Category, so this adds the active check for changed values there.
- **RequestRevision / ResubmitRevision:** right after `ProjectDetailsRules.UpdateRevisionData(...)`, call `ValidateProjectDetailsActiveAsync(merged result, the stored row passed in)`. The merged result already drops fields the revision rules lock, so only real changes are checked. Roll back on refusal.

**3. Dropdown data:** `ShowProjectDropdowns` stops filtering Origins and Agencies by IsActive. The other six are already complete. Add a comment next to the Category/Thrust one.

**4. Frontend:** wrap each list with `filterKeepingSelected(list, x => x.IsActive !== false, 'NameId', projectDetails?.<field>)` (`utils/GlobalFunctions.ts:186`):
- Project `ProjectDetailsForm.tsx`: Tier, Origin (both renderings), Agency, Implementation Mode, Emergency Mode, ROW, Feasibility, Detailed Design.
- Modification `ProjectDetailsForm.tsx`: the same.
- Lump Sum `LumpSumDetailsSection.tsx`: Origin and Agency (the others are hidden there).

## Tasks
### Implementation
- [ ] `ProjectHelper`: add `ProjectDetailsLookupValues`, `ChangedProjectDetailsLookups` (with unit tests: new record, unchanged, one field changed, null optional fields) and `ValidateProjectDetailsActiveAsync`. Add `Previous` to the params, and change `ValidateProjectDetailsLookups` to existence checks plus the active check.
- [ ] `UpdateProjectDetails`: pass `Previous` from `ProjectRevision`.
- [ ] Lump Sum `ValidateRequiredFieldsAsync`: add the `previous` argument (UpdateLumpSum passes it from `LumpSumProject`), and add the active check on the no-Region path.
- [ ] `RevisionController.RequestRevision` / `ResubmitRevision`: check after `UpdateRevisionData`, rolling back on refusal.
- [ ] `ShowProjectDropdowns`: return unfiltered Origins and Agencies, with a comment.
- [ ] FE: Project and Modification `ProjectDetailsForm.tsx`, plus `LumpSumDetailsSection.tsx`.
- [ ] e2e `e2e/tests/code-table-retired-project-details.spec.ts`. It makes a BP project through `addOrdinaryProject` (Origin 13, Agency 1001), then:
  - **TC036:** set Origin 13 Inactive through `UpdateCodeTable` (`ProjectOrigin`, restored in `afterEach`). The page shows the Origin name, and Update Project succeeds and keeps 13. Then the same for Agency 1001 (`ProjectAgency`).
  - **TC037:** the Agency dropdown doesn't list the already-inactive Agency (read its name from GetAllCodeTables). Re-sending the browser's save with `Agency` set to it gets 400 "Invalid Originating Agency".
  - Check the spec fails on the pre-#481 API (the #480 branch).

### Documentation
- [ ] `FE/UserManual.md` §5.7.6 Project Details: a short "What Inactive does for Origin and Agency" note (and the other lookups), plus a pointer from the Toggle Active/Inactive note.
- [ ] `e2e/CLAUDE.md` coverage map row.

## Files / Components Touched
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/` (new tests)
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`
- `FE/src/pages/Project/components/ProjectDetailsForm.tsx`, `FE/src/pages/Modification/projectmodification/components/ProjectDetailsForm.tsx`, `FE/src/pages/LumpSum/components/LumpSumDetailsSection.tsx`
- `e2e/tests/code-table-retired-project-details.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`

## Verification
- `dotnet build`; MYPS.UnitTests; MYPS.ApiIntegrationTests with `MYPS_HTTP_TEST_MYPSDB` (88 today). `ProjectHelperValidateLookupsContractTests` asserts source text of `ValidateProjectDetailsLookups`, so update it if a removed `IsActive` breaks an assertion.
- `tsc -p tsconfig.app.json`: no new errors against the 21 baseline.
- e2e on the local DB with the same setup as #479/#480. It passes here and fails on the pre-#481 API. Code tables restored, no programs left. Re-run the #479 and #480 specs as a regression check.

## Risks / Open Questions / Assumptions
- **Assumption:** the six lookups with no Code Tables screen get the rule in code only; there's no e2e for them, because they can't be retired from the app.
- **Behaviour change:** Modification and Lump Sum (no-Region path) now refuse a retired Origin or Agency they currently accept. Lump Sum's no-Region path also starts checking that a changed Origin or Agency exists.
- **Stacked on #485 and #483:** merge order is #483, then #485, then this one.
- **Not covered:** Category is #482, and ApproveRevision is not checked.

## Completion Log
Date: 2026-10-28
- **Implementation:**
  - `ProjectHelper`:
    - `ProjectDetailsLookupValues` (Tier, Origin and Agency nullable, so UpdateLumpSum's omitted fields are skipped) and `ChangedProjectDetailsLookups` (pure, with 4 unit tests).
    - `ValidateProjectDetailsActiveAsync`: unknown values keep "Selected X '…' is not valid."; inactive ones now say "Selected X '{Name}' is inactive and cannot be chosen."
    - The params class gains `Previous`.
    - `ValidateProjectDetailsLookups` keeps existence checks for the seven lookups (`&& x.IsActive` removed) and runs the active check last.
  - UpdateProjectDetails passes `Previous` from `ProjectRevision`.
  - Lump Sum: CreateLumpSum's no-Region path calls the active check with no previous values. UpdateLumpSum calls it against `LumpSumProject`.
  - RequestRevision compares the merged details with `ProjectRevisions`; ResubmitRevision compares with `ExistingRevisionProject`, so what the revision already held is kept. Both roll back on refusal.
  - `ShowProjectDropdowns` returns all Origins and Agencies.
  - FE: `filterKeepingSelected` on all eight lookups in the Project and Modification `ProjectDetailsForm` (16 lists), and on Origin/Agency in `LumpSumDetailsSection`.
  - **Added on the user's decision (AskUserQuestion, 2026-10-28):** the CodeTableController guards for ProjectAgency and ProjectOrigin no longer refuse every update of an in-use row. Only delete, or a Name/NameId change, is refused, judged by the stored row's NameId. Before, an in-use Origin or Agency could not be retired at all.
  - New e2e spec `code-table-retired-project-details.spec.ts` (3 tests).
- **Documentation:** `FE/UserManual.md` §5.7.6 has a new "What Inactive does for an Agency or Origin" block, and the Toggle note points to it. `e2e/CLAUDE.md` has a coverage row.
- **Verification:**
  - Build clean; unit 57/57; integration 88/88 (local DB; `ProjectHelperValidateLookupsContractTests` unaffected); tsc 21 before and after.
  - e2e 3/3 on local myps_db_dev, and 9/9 together with the #479 and #480 specs. 3/3 fail on the pre-#481 API (the #480 branch): the In Use guard refuses deactivating Origin 13 and Agency 1001, and the refusal never says "inactive".
  - Code tables restored (only the pre-existing Agency 5 is inactive); no programs left.

Deviations / flags:
- Lump Sum calls `ValidateProjectDetailsLookups` from CreateLumpSum only (Region path), not from `ValidateRequiredFieldsAsync` as the plan assumed. So the checks were added in CreateLumpSum's no-Region branch and in UpdateLumpSum directly, rather than through a new `previous` argument.
- The in-use guard change was not in the approved plan; the user chose to include it.
- The e2e setup needs a component and a 100% funding line before Update Project will save.
- Not run at runtime: Modification (no revision fixture) and the Lump Sum paths (covered by build and code reading).

Files changed:
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/RetiredLookupRuleTests.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`, `WebAPI/Controllers/CodeTable/CodeTableController.cs`
- `FE/src/pages/Project/components/ProjectDetailsForm.tsx`, `FE/src/pages/Modification/projectmodification/components/ProjectDetailsForm.tsx`, `FE/src/pages/LumpSum/components/LumpSumDetailsSection.tsx`
- `e2e/tests/code-table-retired-project-details.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`, `documents/plans/retired-project-details-lookups-481.md`

### Code review (2026-10-28, /code-review medium): 9 findings, 6 fixed
- **Fixed (real bug):** the Origin screen's Active toggle sends no NameId, so the new in-use guard read it as a NameId change and refused retiring an in-use Origin from the UI. The guard now refuses only Delete or a Name change; the Update branch never writes NameId anyway. The e2e now sends each screen's exact toggle payload (Origin without NameId, Agency with it).
- **Fixed (real bug):** RequestRevision compared the merged details with themselves, because `UpdateRevisionData` changes `ProjectRevisions` in place. Both revision endpoints now snapshot the stored values first.
- **Fixed:** ResubmitRevision keeps a value equal to the project's stored one **or** the request's previous one (new `alsoKept` argument, with a unit test).
- **Fixed:** a NULL `tOptionProjectTier.IsActive` counts as active, matching the forms; before, it would have refused a Tier that had saved fine until now.
- **Fixed:** the in-use guard also counts modification requests (`tRevisionProjects`), so an Origin or Agency used only by a pending request can't be deleted.
- **Fixed:** the lookup-table switch throws on an unknown label instead of falling through to Detailed Design.
- **Not changed:** the second query per changed lookup (existence check plus active check). It only runs on new or changed values.
- **Re-verified:** build clean; unit 58/58; integration 88/88; e2e 9/9 (#481 + #480 + #479 specs) on local myps_db_dev, with data restored.
