# Plan: One project-deletion rule (criteria review of feat/program-project-hard-delete-policy)

Status: Implemented
Created: 2026-10-15
Source: Criteria review requested by the user (hard delete only on first stage entry; single validation function; BP/P-agnostic; Lump Sum itemized always hard).


## Context

The user asked for a code review of this branch against four criteria:

1. A project may be hard-deleted only on its **first project-stage entry**. Once it has progressed with the program (a next stage was initiated), only a soft delete applies.
2.1. **One function** decides, for every path, whether a project delete is allowed and whether it is hard or soft.
2.2. That decision must not depend on the **BP/P prefix** of the Project ID, given how BP/P ids are reserved.
3. **Lump Sum itemized projects** (created only at GAA-R) are always hard-deleted, so their reserved Project Id is no longer held by any row.

Decisions taken with the user (2026-10-15):
- "Free up the ID" means every row holding it is gone. The allocator (`tProjectIdSequence`) is not changed: re-itemizing gets a new number.
- An itemized child is hard-deleted even when `IsRevised = 1` (its `tRevision*` rows go too). A **published** child is still refused.
- Batch Delete **follows the function**: hard when the tier is Hard, soft otherwise.

## Review verdict (current branch)

| # | Verdict | Evidence |
|---|---|---|
| 1 | **Fails.** No project-level stage rule exists. | `fProjectDeletionTier.sql:69-72` decides on `IsPublished` only; `StageCount`/`RevisionCount` are display-only. The cascade gets "first stage" only indirectly, from the program's own count (`fProgramDeletionEligibility`). A standalone `EXEC pExecuteProjectDeletion` hard-deletes a project that has advanced through every stage. The Lump Sum paths use a different proxy, `!IsRevised && Revisions.Count <= 1` (`LumpsumController.Itemization.cs:349`, `:547`). It counts soft-deleted revisions and revisions under other programs. |
| 2.1 | **Fails.** Four paths, four rules. | `DeleteProgram` uses `fProgramDeletionEligibility` + `fProjectDeletionTier`. `BatchDelete` (`ProgramController.cs:2238`) has no rule at all: always soft, no published check, and it can delete Lump Sum parents and children without the balance logic. `DeleteLumpSum` and `DeleteItemizedProject` use the inline C# test above. The C# wrappers `DetermineProjectDeletionTierAsync` / `ExecuteProjectDeletionAsync` (`Helpers/ProjectHelper.cs:663`, `:684`) have **no callers**. |
| 2.2 | **Partly fails.** | `fProjectDeletionTier`, `pExecute*` and `DeleteItemizedProject` key on `ProjectPK`/`ProjectFK`, which never changes, so they are agnostic. `BatchDelete` matches the stage-specific `vProjectLatest.ProjectId` exactly (`ProgramController.cs:2337-2341`). After BP→NEP the PK stays `BP…` while the revision becomes `P…` (`ReplaceFirst("BP", …)`, `:870`), so the BP form lands in `MissingProjectIds`. Restore (`:2547-2550`) is prefix-sensitive the same way. BP, P and MY ids come from **separate counters** (`pReserveProjectIdBlock @Suffix`), and the swap reuses the BP digits, so prefixed strings are not a safe key. The agnostic pattern already exists in `ProjectGroupController.DeleteProject:411` (`ProjectId == id || ProjectPK == id`). |
| 3 | **Partly fails.** | `DeleteItemizedProject` hard-deletes only when `!IsRevised && Revisions.Count <= 1`; otherwise it soft-deletes **every** revision, so the rows keep the id. The EF hard cascade also misses `tProjectMajorWorkLocations`, `tProjectSupportingDocs` and `tRevision*` (`:358-397`). A revised child would fail on `FK_tRevisionDetails_ProjectRevision`. The allocator never re-issues a number (accepted: "row gone is enough"). |

Other findings from this pass (not in the four criteria; tracked, not fixed here): no audit row on delete, Approved programs are deletable, refusal text is lost through `_exceptionHandler`, the multi-year guard contradicts Pass 3.5, and the soft-delete scope differs (Batch Delete flags the current stage only, Lump Sum flags every revision: OD-1/OD-3 in the deletion redesign).

## Approach: one rule in SQL, every path calls it

### 1. `dbo.fProjectDeletionTier(@ProjectRef, @ProgramFK)`, the single decision (rewrite)
`Main/Resources/Internal/SQLObjects/Functions/fProjectDeletionTier.sql`
- **Prefix-agnostic resolve (2.2).** `@ProjectRef` may be the `ProjectPK` or **any** revision `ProjectId` of the project under `@ProgramFK` (BP-, P- or MY-form). Resolve with `tProjects.ProjectPK = @ProjectRef OR EXISTS (tProjectRevisions r WHERE r.ProjectFK = p.ProjectPK AND r.ProgramFK = @ProgramFK AND r.ProjectId = @ProjectRef)`. Every rule below runs on the resolved `ProjectFK` only. If nothing resolves, zero rows are returned (unchanged contract).
- **Columns returned:** `ProjectFK`, `ProgramFK`, `Kind` (`LSChild` when `ParentProjectId IS NOT NULL`; `LSParent` when `ProjectType = 'LS' AND ParentProjectId IS NULL`; else `Ordinary`), `IsPublished`, `IsRevised`, `StageCount`, `Tier`, `Reason`.
- **`StageCount`** = `COUNT(DISTINCT StageId) FROM tProjectStages WHERE ProjectFK = … AND ProgramFK = @ProgramFK`. Rows are not filtered on `IsDeleted`: a project deleted at NEP has still progressed. Scope by `ProgramFK` (stable), never `ProgramId`, which is regenerated on every advance.
- **Tier, in order:**
  1. `IsPublished = 1` → `Blocked` ("published").
  2. `Kind = 'LSChild'` → `Hard`, regardless of `IsRevised` and `StageCount` (criterion 3).
  3. `StageCount <= 1` → `Hard` (criterion 1, first stage entry, whatever its stage name or prefix).
  4. else → `Soft`.

### 2. `dbo.pExecuteProjectDeletion`: the one hard cascade (complete it)
`Main/Resources/Internal/SQLObjects/Stored Procedures/pExecuteProjectDeletion.sql`
- Call `fProjectDeletionTier` first (already does); refuse unless `Hard`.
- Add the missing tables, children first:
  - `tProjectSupportingDocs` (by revision; record file paths for an after-commit delete only when no other row shares the path, OD-7).
  - `tRevisionDetails` and its children by `RevisionDetailFK`: `tRevisionApprovals`, `tRevisionDocuments`, `tRevisionForCorrectionDetails`, `tRevisionProjectComponentCost` → `…PerYear`, `tRevisionProjectMajorWorkItem` → `…Locations`, `tRevisionProjectFundingProfile`, `tRevisionProjectSnapshot`.
  - `tRevisionProjects` (by `ProjectFK` + `ProgramFK`).
  - Read the exact FK order from `sys.foreign_keys` when implementing.
- **Nesting fix.** The CATCH rolls back only a transaction it opened (`IF @StartedOwnTran = 1`), then `THROW`. A caller-owned transaction (EF in the Lump Sum paths) stays the caller's to roll back. This becomes a real path now, so it is in scope.

### 3. Every delete path consults the function
- **`pExecuteProgramDeletion` Pass 2:** refuse on any child whose tier is not `Hard`, naming it. This already holds for a single-stage program; it becomes the explicit rule.
- **`BatchDelete`** (`ProgramController.cs:2238`):
  - Resolve each requested id through the function, so BP or P form both work.
  - Refuse `LSParent`/`LSChild` (owned by the Lump Sum module, which has the balance logic) and `Blocked`.
  - `Hard` → `ProjectHelper.ExecuteProjectDeletionAsync`.
  - `Soft` → today's current-stage flag.
  - Report `HardDeletedProjectIds` and `SoftDeletedProjectIds` separately, and recompute program cost as today.
- **`BatchAddExistingProject`** (restore, `:2475`): resolve ids the same prefix-agnostic way. Only soft-deleted revisions are restorable; a hard-deleted id reports as missing.
- **`DeleteItemizedProject`** (`LumpsumController.Itemization.cs:226`):
  - Replace the inline tier and the EF cascade with the function and the procedure, run inside the existing EF transaction and lock (`EXEC` via `_db.Database`).
  - Keep the parent-balance return and note, done before the procedure runs.
  - `Blocked` keeps today's message. The soft branch is gone, because a child is never `Soft`.
- **`DeleteLumpSum`** (`:472`): keep the live-children and Approved guards as preconditions, then follow the function's tier.
  - `Hard` → the procedure.
  - `Soft` → keep its current soft write. The flag-all-revisions scope is OD-3, not this plan; record it as a deviation.
- **C# entry point:** `ProjectHelper.DetermineProjectDeletionTierAsync` (and the EF-side twin the Lump Sum controller needs) only call the SQL function. There is no C# re-implementation of the rule.

### 4. Deploy
The function and procedures ship through `Main --apply-sql-objects` (already built).

## Files

- **Modified SQL:** `SQLObjects/Functions/fProjectDeletionTier.sql`, `SQLObjects/Stored Procedures/pExecuteProjectDeletion.sql`, `pExecuteProgramDeletion.sql`.
- **Modified C#:** `Helpers/ProjectHelper.cs` (wrapper signature: `projectRef` + new columns), `WebAPI/Controllers/Programs/ProgramController.cs` (`BatchDelete`, `BatchAddExistingProject`), `WebAPI/Controllers/Lumpsum/LumpsumController.Itemization.cs` (`DeleteItemizedProject`, `DeleteLumpSum`; `ISqlExecutor` injection or an EF `SqlQuery` wrapper over the same function).
- **Possibly modified FE:** `FE/src/pages/Program/components/programDetail/BatchActionsDropdown.tsx` toast, if it should show hard vs soft counts.
- **Tests:** `MYPS.DatabaseTests/ProjectDeletionTierTests.cs` (new), `e2e/tests/program-hard-delete-policy.spec.ts` (extend), `e2e/CLAUDE.md` coverage map.

## Tasks

**Implementation**
1. Rewrite `fProjectDeletionTier` (resolve + `Kind` + `StageCount` + tier order).
2. Complete the `pExecuteProjectDeletion` cascade from live FK order; apply the CATCH nesting fix; make Pass 2 explicit.
3. `BatchDelete` / `BatchAddExistingProject`: prefix-agnostic resolve through the function, hard/soft split, Lump Sum refusal, response fields.
4. Lump Sum delete paths: tier from the function; hard cascade through the procedure inside the EF transaction.
5. Update the `ProjectHelper` wrappers; delete nothing else.

**Tests**
1. **DB test matrix** (throwaway `MYPS_Test_*`, objects applied by `SqlObjectDeployer`):
   - First stage at BP (`BP…`) → Hard.
   - Born at NEP (`P…`) → Hard.
   - Advanced BP→NEP, queried by the BP-form PK **and** by the P-form `ProjectId` → both Soft and same `ProjectFK`.
   - Advanced, then current-stage revision soft-deleted → still Soft.
   - LS child with `IsRevised = 1` → Hard.
   - LS child or ordinary with `IsPublished = 1` → Blocked.
   - Unknown ref → zero rows.
   - Cascade leaves zero rows in every listed table, and a nested call inside a caller transaction does not roll that transaction back on its own.
2. **e2e (API level):**
   - Batch Delete of a first-stage project → 200, rows gone, reported hard.
   - After BP→NEP, Batch Delete by the BP-form id and by the P-form id → soft, current-stage revision flagged, earlier stage untouched.
   - Batch Delete of an LS row → refused.
   - Restore by either form.
   - The existing (a)–(g) cases still behave as before.
   - Lump Sum itemized cases need the `CreateLumpSum` grant; on localhost they are environment-blocked, so they are covered at DB level.

**Documentation:** header comments in the three SQL files (single rule, tier order, prefix contract); a note in `e2e/CLAUDE.md` coverage map.

## Risks

- **Batch Delete now destroys data** for first-stage projects. There is no undo. The UI must say so: the confirmation text names hard vs soft. This is the behaviour the user chose.
- **The cascade reaches `tRevision*`** for revised children. Get the FK order from the live schema; a mistake fails the delete atomically rather than corrupting data.
- **The stage-count signal depends on stage data being clean.** Legacy imports wrote stage rows outside `UpdateProgramStage` (1,292 lagging projects on UAT). They are counted as they are, which errs toward Soft.
- **Out of scope, still open:** audit row, Approved gate, error translation, Pass 3.5 vs multi-year guard, OD-1/OD-3 soft scope.

## Verification

1. `dotnet build` (0 errors); `MYPS.UnitTests`; `MYPS.DatabaseTests` with `MYPS_TEST_SQL_SERVER=localhost` (throwaway DBs only).
2. Localhost `myps_db_migrated_uat` only:
   - Snapshot plus baseline counts.
   - `Main.exe --apply-sql-objects`, check the target it prints, then run with `--yes`.
   - API on `:5025` (Hangfire off), Vite on `:8081`.
   - Full Playwright suite with `E2E_SQL_*`.
3. `/code-review` of the diff against the four criteria.
4. Revert the snapshot, verify counts match the baseline on all tables, drop the snapshot.

## Completion Log
Date: 2026-10-15
- Implementation:
  - `dbo.fProjectDeletionTier(@ProjectRef, @ProgramFK)` rewritten as the single rule: Blocked if published; Hard for an itemized child; Hard when `StageCount = 1`; Soft otherwise (including `StageCount = 0`). It resolves the PK or any revision ProjectId (BP/P-agnostic) and returns one row per project a reference names.
  - `pExecuteProjectDeletion` refuses anything but Hard (an exact PK match wins; any other ambiguous reference is refused). The cascade now covers `tRevisionDetails` and children, `tRevisionPCMAComponent` (when unshared), `tRevisionProjects` and `tProjectSupportingDocs`. The CATCH no longer rolls back a caller's transaction.
  - `pExecuteProgramDeletion` Pass 2 requires every child to be Hard.
  - EF and Dapper wrappers in `ProjectHelper`.
  - `BatchDelete`: tier per id (Hard → procedure, Soft → current-stage flag); refuses Lump Sum, published, ambiguous and duplicate-form refs. Scoped through `tProjectStages` at the current stage, not `vProjectLatest`.
  - `BatchAddExistingProject` resolves ids prefix-agnostically.
  - `DeleteItemizedProject` is always hard through the procedure, with the balance return kept. `DeleteLumpSum` takes its tier from the function and keeps its preconditions.
- Tests: `ProjectDeletionTierTests` (16 cases, live FK schema, real objects via `SqlObjectDeployer`); DB suite 66/66, unit 37/37. e2e `program-hard-delete-policy` (f) updated and (h)–(j) added; `program-detail-batch-actions` retargeted from Lump Sum parents to ordinary projects; `addOrdinaryProject` takes a stage and returns the id.
- Documentation: headers of the three SQL objects; XML docs on both Lump Sum actions; `e2e/CLAUDE.md` coverage map.
- Verification (localhost `myps_db_migrated_uat`, snapshot reverted, counts match baseline on 108 tables):
  - Final full e2e: 48 passed / 15 failed / 7 skipped / 36 not run, 0 permission 403s.
  - Deletion specs pass except (c) and (g) (known out-of-scope findings) and (i). (i) passed twice in isolation; in the full run it failed in setup on a pre-existing `AddProgram` ProgramPK collision (second-resolution key).
Deviations / flags:
- Ambiguity handling changed after code review: there is no silent "PK wins" pick for user-typed refs.
- Supporting-document FILES are not deleted, only rows (OD-7 file-sharing check deferred).
- Lump Sum soft delete still flags every revision (OD-3), and a Lump Sum parent hard delete can still orphan children that were soft-deleted under the old rule.
- Batch Delete refusal of Lump Sum rows is a routing check in C# (`Kind`), not a second validity rule.
- On user request (2026-10-15), Lump Sum grants for Admin and the data-security fixture accounts were created on `myps_db_migrated_uat` and kept.
Files changed: SQLObjects/Functions/fProjectDeletionTier.sql, SQLObjects/Stored Procedures/pExecuteProjectDeletion.sql, pExecuteProgramDeletion.sql, Helpers/ProjectHelper.cs, WebAPI/Controllers/Programs/ProgramController.cs, WebAPI/Controllers/Lumpsum/LumpsumController.Itemization.cs, MYPS.DatabaseTests/ProjectDeletionTierTests.cs (new), MYPS.DatabaseTests/SqlObjectDeployerTests.cs, e2e/tests/program-hard-delete-policy.spec.ts, e2e/tests/program-detail-batch-actions.spec.ts, e2e/tests/helpers/crossStageFixture.ts, e2e/CLAUDE.md.
