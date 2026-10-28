# Plan: Retired Funding Agreement / Source keeps showing and saving (#480)

Status: Implemented
Created: 2026-10-28
Source: Gitea #480 (part of #478), plus Ken's comment on #478 (Sir Alvin). Stacked on PR #483 (#479).

## Context
Setting a **Funding Agreement** or **Funding Source** Inactive makes a project that already uses it show a **blank** Agreement or Source cell ("Select Agreement"):
- `ShowProjectComponentDropdowns` (ProjectController around L173-182) returns active rows only.
- `SearchableDropdown` only labels a value it finds in its options.

The saved code is still there. But if the user clears the cell it's gone, and QA reads the blank as "the agreement disappeared". Sir Alvin on #478: *"nawala yung funding agreement nya, hindi dapat. Retained yung values even sa display, dapat nawawala lang sa dropdown."*

At the same time, deactivating doesn't stop anyone from using the value:
- The save checks only test that it exists: UpdateProjectDetails around L1015-1093, and Lump Sum `ValidateFundingLinesAsync` / `ValidateFundingPairsAsync`.
- Modification lists every value (RevisionController around L488-489, L796-797) and doesn't check it either.

This applies the #479 rule to funding lines:
- A retired value is hidden for new picks and rejected on new or changed lines.
- A line that already has it keeps it, shows it and saves.

## Acceptance Criteria
As a PS user, I want a project's funding line to keep its Agreement and Source after an admin deactivates them, and to be offered only active ones for new lines, so that a code-table change never blanks or loses my funding.

- [ ] **S04-TC034:** a project has Funding Agreement A under Source S, and A is set Inactive. The project's Agreement cell still shows A. Editing something else and saving succeeds and keeps A.
- [ ] The same holds when Source S is set Inactive: the Source cell still shows S, and the project saves.
- [ ] **S04-TC035:** with A Inactive, a new Funding Profile row does not offer A in Project, Modification, the Lump Sum create form or the Replenish dialog. The same applies to an Inactive Source.
- [ ] The API refuses an inactive Agreement or Source on a **new** line, or on an existing line whose Source or Agreement **changed**, in UpdateProjectDetails, RequestRevision, ResubmitRevision, CreateLumpSum, UpdateLumpSum (new lines) and ReplenishLumpSum.
- [ ] Replenish with no agreement chosen, on a Lump Sum whose first line's agreement is now Inactive, says to choose an agreement instead of failing silently.
- [ ] Lump Sum's read-only funding table still shows the retired agreement's name, not the bare code.

## Approach
Reuse #479's pieces (branch stacked on `fix/S04-479-retired-major-item-lookups`):

**1. Shared check** (`Helpers/ProjectHelper.cs`, next to `ValidateMajorItemLookupsAsync`):
- `record FundingLookupRow(int Id, bool IsDeleted, string SourceOrg, string AgreementCode)`.
- `ValidateFundingLookupsAsync(this MYPSDbContext, IEnumerable<FundingLookupRow> posted, IEnumerable<FundingLookupRow> stored, ct)`.
  - It picks the rows with `RetiredLookupRule.RowsRequiringActiveCheck`, keyed on (Source, Agreement) trimmed and upper-cased, so a line whose Source or Agreement changed is checked in full.
  - It then requires `tOptionFundingSource.IsActive` (by `Organization`) and `tOptionFundingAgreement.IsActive` (by `Code`), compared case-insensitively.
- Titles stay "Invalid Funding Profile Source" / "Invalid Funding Profile Agreement". New messages: *"The following Funding Source(s) / Agreement(s) are inactive and can't be used on a new or changed funding line: X."*

**2. Call sites:**
- **UpdateProjectDetails:** after the existing existence and pair checks, compare against the stored lines `tProjectFundingProfile.Where(ProjectRevisionFK == ProjectRevision.Id)`. That table has no IsDeleted, so lines are hard-deleted.
- **RequestRevision:** stored = `FundingProfile` (the `fProjectFundingProfile` GAAR rows, around L1202). Roll back on refusal, as for Major Items.
- **ResubmitRevision:** stored = `ExistingFundingProfile` (around L2634), with rollback.
- **Lump Sum:** call it inside `ValidateFundingPairsAsync`, with every line as new and no stored rows. That method only runs on **new** lines (Create's one line, Replenish's top-up, UpdateLumpSum's `Id == 0` lines). Existing lines are read-only in Lump Sum and keep their legacy values. Update its doc comment.

**3. Dropdown data:** `ShowProjectComponentDropdowns` returns all Agreements and Sources. Keep the ordering and add a comment pointing at the #479 one.

**4. Frontend pickers** (filter for new picks, keep the line's own value) with `filterKeepingSelected(list, x => x.IsActive !== false, key, profile.<value>)` (`utils/GlobalFunctions.ts:186`):
- Project `components/FundingProfileForm.tsx`: Source and Agreement (the Agreement list is still filtered by SourceOrg).
- Modification `projectmodification/components/FundingProfileForm.tsx`: same.
- Lump Sum `LumpSumForm.tsx` create pickers and `ReplenishLumpSumDialog.tsx` (Source `<select>`, `agreementOptions`): active only, since they are always new lines.
- Replenish: when it copies the first line's agreement and that agreement is inactive, return *"Choose a Funding Agreement — the first funding line's agreement {code} is inactive."*
- `LumpSumFundingProfileForm` name lookups need no change; they resolve once the full list arrives.

Keeping the row's **current** value is enough here, unlike #479's edit dialog. The cells are inline, a new line can only get a value from the active list, and changing Source clears Agreement.

## Tasks
### Implementation
- [ ] `ProjectHelper`: add `FundingLookupRow` and `ValidateFundingLookupsAsync`. Add unit tests in `MYPS.UnitTests` for the case-insensitive key (unchanged line in different case, changed agreement, changed source), plus any SQL-free part that's testable.
- [ ] `UpdateProjectDetails`: load the stored funding lines for this revision and call the shared check after the pair check.
- [ ] `RevisionController.RequestRevision` and `ResubmitRevision`: call it with the stored rows, rolling back on refusal.
- [ ] `LumpsumController.Writes.ValidateFundingPairsAsync`: add the active check for new lines and update the doc comment.
- [ ] `ShowProjectComponentDropdowns`: return unfiltered Agreements and Sources, with a comment.
- [ ] FE: Project and Modification `FundingProfileForm.tsx`, `LumpSumForm.tsx`, `ReplenishLumpSumDialog.tsx` (pickers plus the first-line message).
- [ ] e2e `e2e/tests/code-table-retired-funding.spec.ts`:
  - Build a BP project with one funding line through the UI or API.
  - Deactivate its Agreement (TC034, TC035), then separately its Source, through `UpdateCodeTable` (Codes `FundingAgreement` / `FundingSource`), restoring in `afterEach`.
  - Check: the cell shows the name; a save succeeds and keeps the code; Add Funding doesn't offer it; re-sending the browser's save with a new line using it returns 400.
  - Lump Sum: CreateLumpSum through the API with the retired agreement returns 400, if a Lump Sum fixture makes that cheap (`lumpSumFixture.ts`); otherwise API-only.
  - Check it fails on the pre-fix API.

### Documentation
- [ ] `FE/UserManual.md` §5.7: a short "What Inactive does for a Funding Agreement or Funding Source" block, plus a pointer from the Toggle Active/Inactive note. Mention Project, Modification and Lump Sum.
- [ ] `e2e/CLAUDE.md` coverage map row.

## Files / Components Touched
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/` (new tests)
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`
- `FE/src/pages/Project/components/FundingProfileForm.tsx`, `FE/src/pages/Modification/projectmodification/components/FundingProfileForm.tsx`, `FE/src/pages/LumpSum/components/LumpSumForm.tsx`, `FE/src/pages/LumpSum/dialogs/ReplenishLumpSumDialog.tsx`
- `e2e/tests/code-table-retired-funding.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`

## Verification
- `dotnet build`, `dotnet test MYPS.UnitTests`, and MYPS.ApiIntegrationTests with `MYPS_HTTP_TEST_MYPSDB` (88 tests today).
- `tsc -p tsconfig.app.json`: no new errors against the 21-error baseline.
- e2e on the **local** DB (scratch content root and Vite with `VITE_API_BASE_URL`, as for #479). It passes here and fails on the `origin/main` API. Confirm the code-table rows are restored and no programs are left behind.

## Risks / Open Questions / Assumptions
- **Behaviour change:** Modification and Lump Sum new lines currently accept inactive values; after this they are refused (#478 intent).
- **Replenish with no agreement chosen** can no longer copy a retired first-line agreement. The dialog says so first.
- **Stacked on #483:** the PR targets `main` but includes #483's commits until #483 merges. The PR body says "merge #483 first". Alternatively, set its base to the #479 branch and retarget it after #483 merges; the plan uses base `main` plus the note, which matches how PRs are reviewed here.
- **ApproveRevision is not checked**, same as #479.

## Completion Log
Date: 2026-10-28
- **Implementation:** all 7 tasks done.
  - `ProjectHelper.FundingLookupRow`, `FundingLookupKey` (trimmed, upper-case Source/Agreement) and `ValidateFundingLookupsAsync`, built on `RetiredLookupRule.RowsRequiringActiveCheck`. 3 new unit tests (10 for the rule in total).
  - UpdateProjectDetails runs the check after the pair check, against `tProjectFundingProfile` for this ProjectRevision.
  - RequestRevision (stored = `fProjectFundingProfile` GAAR rows) and ResubmitRevision (stored = `ExistingFundingProfile`) roll back on refusal.
  - Lump Sum: inside `ValidateFundingPairsAsync`, whose callers pass new lines only, with an updated doc comment.
  - `ShowProjectComponentDropdowns` returns every Agreement and Source.
  - FE:
    - Project and Modification `FundingProfileForm` use `filterKeepingSelected` on IsActive, keeping the line's current value.
    - The `LumpSumForm` create pickers and the `ReplenishLumpSumDialog` Source/Agreement lists offer active values only.
    - Replenish refuses a resolved (for example, copied first-line) Source or Agreement that is inactive.
  - New e2e spec `code-table-retired-funding.spec.ts` (3 tests).
- **Documentation:** `FE/UserManual.md` §5.7.3 has a new "What Inactive does for a Funding Source or Funding Agreement" block, and the Toggle note points to it. No version bump. `e2e/CLAUDE.md` has a coverage row.
- **Verification:**
  - `dotnet build` clean; unit 53/53; integration 88/88 (local DB); tsc 21 errors before and after, none in the diff.
  - e2e 3/3 on local myps_db_dev, and 6/6 together with the #479 spec. 3/3 fail on the pre-#480 API (the #479 branch): the Agreement cell is blank, the Source cell is blank, and CreateLumpSum accepts the retired agreement.
  - Code tables restored; only the pre-existing "PPP projects" agreement is Inactive; no programs left.

Deviations / flags:
- The Lump Sum e2e test logs in as `e2eadmin` (`E2E_LS_USERNAME`). On local myps_db_dev only that user (group 16) holds CreateLumpSum; jopiojvc and jimeneznr get 403.
- The pre-fix run created one Lump Sum (Id 58134, P01200047LS). The sweeper did not remove it, probably because its user lacks DeleteLumpSum, so it was deleted by hand through DeleteLumpSum as e2eadmin. The spec now deletes such a leak itself in afterEach.
- Modification was not exercised at runtime (no revision fixture), same as #479.
- No new Replenish UI test; the dialog change is covered by tsc and code reading only.

Files changed:
- `Helpers/ProjectHelper.cs`, `MYPS.UnitTests/RetiredLookupRuleTests.cs`
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`, `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs`
- `FE/src/pages/Project/components/FundingProfileForm.tsx`, `FE/src/pages/Modification/projectmodification/components/FundingProfileForm.tsx`, `FE/src/pages/LumpSum/components/LumpSumForm.tsx`, `FE/src/pages/LumpSum/dialogs/ReplenishLumpSumDialog.tsx`
- `e2e/tests/code-table-retired-funding.spec.ts` (new), `e2e/CLAUDE.md`, `FE/UserManual.md`, `documents/plans/retired-funding-profile-480.md`

### Code review (2026-10-28, /code-review medium): 9 findings, 4 fixed
- **Fixed:** funding lines are now judged **per field**. A changed Agreement under a line's retired Source no longer re-checks that Source, which is exactly what the form offers (it keeps the retired Source and lists its active agreements). `FundingLookupKey` became `FundingLookupCode` (one code, trimmed, upper-case); the unit tests were rewritten to cover it.
- **Fixed:** an unknown code is reported as "invalid or inactive". The Revision saves have no separate existence check. The manual quotes the new text.
- **Fixed:** ResubmitRevision runs the check after its blank Amount / Source / Agreement checks, so a multi-problem payload gets the same first error as before.
- **Fixed:** the UpdateProjectDetails baseline is this revision's **non-deleted** funding lines (the column exists; the save path filters on it too).
- **Fixed:** the Source and Agreement halves of the validator share one local `NotActive` helper.
- **Not changed:**
  - RequestRevision checks lines that the revision rules might drop (same reasoning as #479).
  - The ResubmitRevision rollback is kept, to match RequestRevision.
  - The FE label match is exact on case/padding (pre-existing: such values never labelled, active or not).
  - Replenish's blank-Source default when the first line's Source is retired is reported on submit, not disabled up front.
  - One extra agreement query in Lump Sum.
- **Re-verified:** build clean; unit 53/53; integration 88/88; tsc no new errors; e2e 6/6 (#480 + #479 specs) on local myps_db_dev, with code tables restored and no programs left.
