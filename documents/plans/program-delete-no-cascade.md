# Plan: Delete Program no longer deletes live projects (no cascade)

Status: Implemented
Created: 2026-10-16
Source: user request 2026-10-16 — a program can only be deleted once all its child projects have been manually deleted by a permitted user. Decisions: soft-deleted projects count as deleted (their leftover rows are removed only within the selected program); Program list disables Delete with the server's reason.


## Context
Today Delete Program hard-deletes every child project with the program (`ProgramHelper.DeleteProgramInTransactionAsync`, PASS 2–3). The new rule: **a program can be deleted only once all its child projects have been deleted by hand, by a user allowed to**:
- Batch Delete in Program Details (`ProgramController.BatchDelete`, permission `BatchDelete`);
- the Lump Sum module for Lump Sum projects (`DeleteLumpSum`, `DeleteItemizedProject`).

Delete Program stops deleting live projects.

User decisions (2026-10-16):
- **Soft-deleted projects count as deleted.**
  - A project with no live revision under the program (all its revisions there are `IsDeleted = 1`, e.g. from the old Batch Delete on `main`) was already deleted by a user. Delete Program removes those leftover rows.
  - **If that project has other years** (history in another program), only its rows **within the selected program** are removed; its other years and its `tProjects` row stay. `ExecuteProjectDeletion.sql` already behaves this way (it deletes `WHERE ProgramFK = @ProgramFK`, plus the multi-year guard on `tProjects`).
- **UI:** the Program list disables Delete with a tooltip when the program can't be deleted, like the Approved case. The server stays the authority.

Data on localhost `myps_db_migrated_uat` (2026-10-16): 18 programs pass today's eligibility. 3 have no projects; 15 have live projects and would now be refused until their projects are deleted.

The existing rules stay unchanged: Approved → refused; progressed past first stage → refused; single tier rule `GetProjectDeletionTier.sql` for every project row removed (criteria 1, 2.1, 2.2, 3).

## Approach

### 1. The rule lives in the program eligibility script
**`Main/Resources/Internal/SQLObjects/Functions/GetProgramDeletionEligibility.sql`**
- **Input:** a set of programs, `@ProgramFKs` (JSON array, read with `OPENJSON`; compatibility 130 is already required). One query serves a single delete and a whole list page.
- **New columns:**
  - `LiveProjects`: distinct `ProjectFK` with a `tProjectRevisions` row under the program and `IsDeleted = 0`. This counts carried-in projects too.
  - `DeletedProjects`: projects linked to the program (`tProjects.ProgramFK`, or revisions/stages under it) with no live revision there. These are the leftovers Delete Program removes.
- **Order of `Blocked` reasons**, first match wins:
  1. `program is approved`
  2. `progressed beyond its initial stage`
  3. **new:** `it still has N project(s) that have not been deleted`
- Header updated: the program-level single point of eligibility; what "live" means; the leftover rule.

**`Helpers/ProgramHelper.cs`**
- `DetermineProgramDeletionEligibilityAsync(programFK)` keeps its signature and passes a one-element JSON array.
- New `DetermineProgramDeletionEligibilitiesAsync(IEnumerable<string> programFKs)` makes one call for many programs.
- `ProgramDeletionEligibilityResult` gains `LiveProjects` and `DeletedProjects`.

### 2. Delete Program removes only what was already deleted
**`ProgramHelper.DeleteProgramInTransactionAsync`** (same locked transaction):
- **Lock:** add `tProjectRevisions` to `LockProgramForDeletionSql`, reading `IsDeleted`, because live-ness now depends on it. A concurrent Batch Restore must wait. `tProjectRevisions` has `IX_tProjectRevisions_ProgramFK` (checked).
- **PASS 1:** the eligibility script refuses live projects with a reason that names how to fix it:
  > "This program cannot be deleted: it still has N project(s) that have not been deleted. Delete them first (Batch Delete in Program Details; Lump Sum projects from the Lump Sum module)."

  The C# adds the "Delete them first…" hint to the script's reason.
- **PASS 2/3 now cover leftovers only:** projects linked to the program with no live revision under it (`ProgramProjectsSql` gains `AND NOT EXISTS live revision`).
  - Each still goes through `ProjectHelper.ExecuteProjectDeletionAsync(…, tx)`, which runs the single tier rule. It removes only that project's rows under this program, and keeps its `tProjects` row if another program has history for it.
  - A leftover the tier refuses (published, no stage history) refuses the delete, naming it. These are rare; e.g. none on UAT.
- **PASS 3.5 stays:** nothing may be left under the program. A project *created* in this program whose `tProjects` row is kept because a later program has its history still refuses, with "still has history in another program". The project row must not point at a deleted program.
- **PASS 4 is unchanged.**
- The audit row for the program records `ProjectsDeleted` = leftovers removed (normally 0).

**`WebAPI/Controllers/Programs/ProgramController.cs` `DeleteProgram`:** only the comment and success message change ("Program X has been deleted.").

### 3. The Program list says why Delete is unavailable
- **`ProgramController.ShowProgram`:** after `FilterDataCursor`, run `DetermineProgramDeletionEligibilitiesAsync` once for the page's ProgramPKs. Set two new `[NotMapped]` properties on `DBHelper/Models/Views/Program/ProgramLatest.cs`: `CanDelete` (bool) and `DeleteBlockedReason` (string). One script call per page, not per row.
- **FE `FE/src/pages/Program/Model.d.ts`:** add `CanDelete?` and `DeleteBlockedReason?` to the program list type.
- **`FE/src/pages/Program/Views/Program.tsx` (~L257-263):**
  - `disabled={program.CanDelete === false}`.
  - Title = the reason ("Delete its N project(s) first…" / "An Approved program cannot be deleted." / "progressed…").
  - This replaces the client-side `Status === 'Approved'` check, so the rule isn't repeated in the client.
- **`FE/src/pages/Program/dialogs/DeleteProgramDialog.tsx`:** remove the "N project(s) will be permanently deleted with the program" warning; the dialog now only says the program is deleted. Server refusals still show through the existing fallback toast.

### 4. Tests
- **`MYPS.DatabaseTests/ProjectDeletionTierTests.cs`** (localhost throwaway DBs), program section rewritten:
  - a program with a live project is refused with the reason, nothing written;
  - an empty program is deleted, with 1 audit row;
  - a program whose projects are all soft-deleted is deleted, and their rows go;
  - a soft-deleted project with history in another program keeps its other-program rows and `tProjects` row (the user's "previous years" rule);
  - a published soft-deleted leftover refuses, naming it;
  - a concurrent restore is covered by the in-transaction test style: flip `IsDeleted` to 0 before the transaction → refused;
  - eligibility returns `LiveProjects`/`DeletedProjects` for several programs in one call;
  - replace the cascade tests (`ProgramDeletion_LogsEveryProjectAndTheProgram`, `_RefusesWhenAChildIsNotHard_NamingIt`, the in-transaction child tests, the carried-in test) with leftover-based equivalents.
- **`MYPS.ApiIntegrationTests/DeletionEndpointsHttpTests.cs`:**
  - `DeleteProgram_RealHttpCall_HardDeletesAnEligibleProgram…` becomes: refused while it has projects; Batch Delete both (HTTP); then Delete Program succeeds. This exercises "deleted by a permitted user" end to end.
  - The Approved test is unchanged.
- **e2e `e2e/tests/program-hard-delete-policy.spec.ts`:**
  - (a) Delete Program with a costed live project → 400 "still has 1 project", nothing written; then Batch Delete it → Delete Program → 200.
  - (c) a published live child → refused as "still has projects".
  - (f) moves to Batch Delete: the cascade over the formal-revision tables now happens on the project delete.
  - (g) audit: the project rows come from Batch Delete, then one program row.
  - New: a program with only soft-deleted projects is deletable.
  - (b), (d), (e), (h)–(l) unchanged.
- **`e2e/tests/batch-restrict-allow-publish-skips-published.spec.ts` afterAll:** Batch Delete the fixture's projects before `DeleteProgram`, or the fixture strands.
- **New UI check:** the Delete button is disabled with the reason on a program that has projects.
- **`e2e/CLAUDE.md`:** update the coverage notes for program delete.

### 5. Docs
- **`documents/docs/RELEASE_DELETE_POLICY.md`:**
  - "Behaviour users will notice": Delete Program needs its projects deleted first.
  - Step 2's index check gains `tProjectRevisions`.
- **New `documents/plans/program-delete-no-cascade.md`** (this plan) with a Completion Log.

## Checked against the criteria
| Criterion | Effect |
|---|---|
| 1 Hard delete only on first stage, soft after | Unchanged. Live projects are deleted by Batch Delete, under the same rule. |
| 2.1 One point of validation | Program-level: one script, used by Delete Program and the list. Project-level: every leftover still goes through `ExecuteProjectDeletionAsync` → `GetProjectDeletionTier.sql`. |
| 2.2 BP/P prefix | Unchanged. Leftovers are passed by ProjectPK. |
| 3 Itemized children always Hard | Unchanged. They're deleted in the Lump Sum module, which Delete Program now requires. |

## Verification
1. `dotnet build`; `MYPS.UnitTests`; `MYPS.DatabaseTests` (`MYPS_TEST_SQL_SERVER=localhost`); `MYPS.ApiIntegrationTests` with the HTTP tests off, then on (`MYPS_HTTP_TEST_MYPSDB` = localhost UAT, under a snapshot). FE `npm run typecheck` (no new errors beyond the pre-existing Rbac ones). `dotnet build-server shutdown`.
2. Localhost `myps_db_migrated_uat` only, under snapshot `_snap_t7`:
   - check the MYPSDb target in source and bin first;
   - permission script;
   - API on :5025, Vite on :8081;
   - delete specs plus the batch-restrict spec, then the full suite;
   - revert the snapshot, diff the counts, drop it.
3. `/code-review` of the diff; re-check the 4 criteria.
4. Commit locally in logical commits. **No push** without asking.

## Out of scope
- `vProgramLatest.NumberOfProjects` still counts every project row; the list's "No. of Projects" column is unchanged. `CanDelete` uses live projects.
- The deferred program-year gate.

## Completion Log
Date: 2026-10-16
- **Implementation:**
  - **`GetProgramDeletionEligibility.sql`:**
    - Takes `@ProgramFKs` (JSON array). It runs in three steps: stage and status, then live projects counted ONLY for programs not Approved and not progressed, then the rule.
    - New `LiveProjects` and `BlockedBy` ('Approved' / 'Progressed' / 'LiveProjects'). New Blocked reason "it still has N project(s) that have not been deleted".
  - **`ProgramHelper`:**
    - `DetermineProgramDeletionEligibilitiesAsync` covers a whole page in one call.
    - `RefusalMessage` adds "Delete them first (Batch Delete in Program Details; Lump Sum projects from the Lump Sum module)", keyed on `BlockedBy`.
    - `DeleteProgramInTransactionAsync` no longer deletes live projects. It removes only the leftovers of soft-deleted projects, each through `ExecuteProjectDeletionAsync` (single tier rule, rows under this program only).
    - `tProjectRevisions.IsDeleted` joins the lock, so a concurrent restore waits.
  - **`ProgramController`:**
    - `ShowProgram` sets `CanDelete` / `DeleteBlockedReason` only when `IncludeDeleteEligibility` is sent (the Program list). A failure is logged and leaves them unset.
    - The `DeleteProgram` message is now "Program X has been deleted."
  - **FE:**
    - The list sends the flag. Delete is disabled with the server's reason, falling back to the old Approved check when the server could not say.
    - The dialog's "projects will be permanently deleted" warning is removed.
- **Documentation:**
  - `RELEASE_DELETE_POLICY.md`: behaviour note; the smoke check and the index check include `tProjectRevisions`.
  - `e2e/CLAUDE.md`: coverage row.
- **Tests:**
  - DB 102/102: no-cascade refusal, empty program, leftovers removed and logged, a previous-year project keeps its other years, a later-year carry-over refuses with rollback, a published leftover named, several programs in one call, plus in-transaction restore / publish / approval.
  - Unit 37/37.
  - API 66/66, with the HTTP tests on against localhost UAT: refused while it has projects → Batch Delete → deleted.
  - **E2E** (localhost, snapshot `_snap_t7`):
    - `program-hard-delete-policy` 14/14 (new (m) all soft-deleted, (n) list and UI button);
    - batch-actions, batch-restrict (its cleanup now Batch-Deletes first; no program left behind), cross-stage, ls-program-approved all pass;
    - full suite 52 passed / 12 failed, all the known non-branch failures (Lump Sum HGAB stage data, dashboard, report-job);
    - after the review fixes: delete specs 19/19 on the rebuilt API.
  - Snapshot reverted, counts match, dropped.

**Deviations / flags:**
- **Performance:**
  - The first version of the eligibility query took 10.7 s for 20 programs; SQL Server ignored the in-APPLY gate.
  - It was rewritten as steps: 0.27 s for 25.
  - `DeletedProjects` was dropped, since nothing read it; Delete Program finds leftovers itself.
- **Review follow-ups applied:** a reason code (`BlockedBy`) instead of matching on the wording; the opt-in flag (the Project form's type-ahead no longer pays for the query); the Approved fallback in the FE; the swallowed error is now logged.
- **Not changed, noted:**
  - The list can still show Delete enabled for a program whose only leftovers the server will refuse: a published soft-deleted project, or one carried into a later year. None on UAT.
  - A legacy soft delete that flagged only one of a project's revisions leaves the project live until Batch Delete is run on it again.
  - A published LIVE project gets the "Batch Delete" hint, but Batch Delete refuses it; it must be unpublished first.

**Files changed:**
- SQL: `GetProgramDeletionEligibility.sql`
- Helpers: `ProgramHelper.cs`
- WebAPI: `ProgramController.cs`, `DTOProgram.cs`
- DBHelper: `ProgramLatest.cs`
- FE: `Program/{Model.d.ts, Service.ts, Views/Program.tsx, dialogs/DeleteProgramDialog.tsx}`
- Tests: `ProjectDeletionTierTests.cs`, `DeletionEndpointsHttpTests.cs`, e2e `program-hard-delete-policy.spec.ts`, `batch-restrict-allow-publish-skips-published.spec.ts`
- Docs: `RELEASE_DELETE_POLICY.md`, `e2e/CLAUDE.md`, this plan.
