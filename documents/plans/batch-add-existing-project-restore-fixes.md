# Plan: BatchAddExistingProject (Batch Restore) fixes

Status: Implemented (2026-10-24; deferred 2026-10-06 by maintainer decision)
Created: 2026-10-06
Source: code review of fix/batch-delete-restore-cross-stage-verification, 2026-10-06; see
batch-delete-cross-stage-review-fixes.md and MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md

## Goal
Make Batch Restore safe to expose in the UI: correct program cost after a restore, consistent
transaction handling with BatchDelete, no revival of Lump Sum soft-deletes, correct FE wiring.

## Current state (as of 53d062ab)
- Commits since 487d0fb9 (it never could before); scoped to ProgramFK since 051bbdfe.
- Menu opener commented out since de295446, so it is reachable only through the API.

## Acceptance Criteria
As a program officer, I want Batch Restore to put a deleted project back exactly as it was,
so that the program's cost and Lump Sum allocations stay correct.
- [x] RS1 After a committed restore, tProgramRevisions.Cost equals pRecomputeProgramCost's result
      (RecomputeProgramCostAsync(ProgramParent.ProgramPK) before CommitAsync, as BatchDelete does).
- [x] RS2 No transaction is opened for a request rejected by validation.
- [x] RS3 Catch does not pass the request token to RollbackAsync.
- [x] RS4 Decision recorded and implemented: Lump Sum revisions soft-deleted by
      LumpsumController.Itemization.cs (:404, :603) are excluded from Batch Restore, or allowed and
      documented with the allocation consequence. *(Allowed, confirmed by the user 2026-10-24: Lump
      Sum projects go through batch actions like any other. Itemized children are always hard-deleted,
      so they are never found; a soft-deleted parent gets its latest revision back and the program
      Cost, which includes its OriginalAllocation, is recomputed.)*
- [x] RS5 Decision recorded: a project deleted at several stages gets back only its latest deleted
      revision (Max(Id)), or every revision BatchDelete flagged. *(Latest only; confirmed by the user 2026-10-25.)*
- [x] RS6 BatchRestoreDialog receives Details.ProgramId (ProgramId changes on every stage advance;
      ProgramPK does not).
- [x] RS7 handleBatchRestoreSubmit toasts a generic error only when the error has no Message.
- [x] RS8 Opener re-enabled only after RS1–RS7, behind the same permission as Batch Delete.
- [x] Contract tests pin RS1–RS3; the cross-stage e2e spec gains a program Cost assertion
      (Cost before delete == Cost after restore).

## Tasks
### Implementation
- ProgramController.BatchAddExistingProject: RS1, RS2, RS3 (mirror BatchDelete's shape).
- RS4/RS5: maintainer decision first; then the lookup (~line 2497).
- ProgramDetail.tsx: RS6 (~851), RS7 (~261), RS8 (~237).
- Contract tests + e2e Cost assertion.
### Documentation
- RCA doc, FE/src/pages/Program/program.md (Batch Restore section).

## Risks / Open Questions
- Decide RS5 together with the defect found on 2026-10-06 (RCA, "Follow-up review"): a Batch
  Delete is undone by the next stage advance, because vProjectLatest falls back to the
  project's older live revision and UpdateProgramStage copies it forward. Restore must be the
  inverse of whatever Batch Delete is changed to mean. The opt-in rule #2 e2e test
  (E2E_ALLOW_ORPHANS=1) fails on it today and is the acceptance check.
- RS4 is a data-integrity risk: a revived itemized child re-draws its parent's allocation outside
  Lump Sum's own rules. Needs maintainer decision.
- First production write path for Restore: rehearse on localhost myps_db_dpwh (production copy)
  inside BEGIN TRAN … ROLLBACK before release.

## Completion Log
Date: 2026-10-24
- Implementation: `ProgramController.BatchAddExistingProject`: transaction opened after validation
  and id resolution (RS2); `RecomputeProgramCostAsync` before `CommitAsync` (RS1); every rollback
  uses `CancellationToken.None`, plus BatchDelete's deadlock catch and finally-dispose (RS3); Lump Sum
  first refused, then allowed after the user confirmed (RS4, see Review follow-up); latest deleted
  revision only, as before, now commented (RS5). The response gains `UpdatedCount`,
  `RestoredProjectIds`, `MissingProjectIds`, `RefusedProjects` and a "Partially Successful" title; the
  "restored to their original stage" text and the "No Projects Restored" title are kept (e2e asserts
  them). FE: `BatchRestoreDialog` gets `Details.ProgramId` (RS6); RS7 was already in place; Batch
  Restore added to `BatchActionsDropdown` next to Batch Delete, and the success toast shows the API's
  `Message` (RS8). `Migration.BatchRestorePermission.2026-10-24.sql` grants `BatchAddExistingProject`
  to every group holding `BatchDelete` (a no-op on myps_db_dev, where all 8 already had it). Contract
  tests: RecomputesProgramCostInsideTransaction, OpensItsTransactionAfterValidation,
  RollsBackWithoutTheRequestToken, RefusesApprovedProgramsAndPublishedProjects,
  DecidesAgainOnLockedRowsBeforeWriting. e2e: `programCost` helper, and
  Cost before == Cost after restore in the default cross-stage test.
- Documentation: FE/UserManual.md 5.2.5 (v3.15); FE/src/pages/Program/program.md (service row,
  BatchRestoreDialog section); MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md (deferred note replaced).

Deviations / flags:
- RS4 (Lump Sum restored like any other project) confirmed by the user. RS5 (latest deleted revision
  only) was decided by the implementer with the user and confirmed 2026-10-25.
- RS8 "same permission as Batch Delete" is met on the server (grant migration). The FE has no
  per-button permission gating, so the entry shows for everyone, as Batch Delete's does.
- The e2e Cost assertion is weak on the fixture (its Cost is 0). RS1 was verified separately on
  localhost myps_db_dev: delete, overwrite the stored Cost with 999, restore -> Cost back to 0 (the
  recomputed value). No local program has a funded project past its first stage, so a non-zero
  natural round trip was not possible locally.
- RS4 verified on localhost: a soft-deleted Lump Sum revision (P01000011LS) sent to restore answers
  400 with a RefusedProjects reason and stays IsDeleted = 1.
- Not yet rehearsed on myps_db_dpwh (production copy), as the Risks section asks.
- The stage-advance defect under Risks (rule #2, E2E_ALLOW_ORPHANS) is unchanged and was not re-run.

Review follow-up (2026-10-24, /code-review findings 1-10):
- Restore now refuses a published project or an Approved program, as Batch Delete does
  (`RestoreRefusal`). Verified on localhost: BP00803948VS in Approved
  program MP_P_CO-PS-634_02272023_144417 answers 400 "Not restored (program is approved)" and stays deleted.
- Decided again on locked rows (`DecideProjectDeletionsUnderLockAsync` after the program lock, before
  the un-delete); a change in between throws "can no longer be restored here".
- Messages name every id not restored and why (`DescribeNotRestored`, `NothingRestored`); ids are
  de-duplicated case-insensitively.
- FE: the refresh after a committed restore is separate from the restore call (warning toast, not
  "Failed to restore").
- Migration: THROW instead of RAISERROR, so a database without BatchDelete rolls back untouched
  (failure path tested on localhost with a scratch copy: 0 rows left).
- e2e: asserts the Cost drops after the delete when the fixture Cost is non-zero; still cannot detect
  a missing recompute on the zero-Cost fixture (annotated).
- RS4 REVERSED (user confirmed, 2026-10-24): Lump Sum projects are NOT to be restricted from batch
  actions. The Lump Sum refusal was removed from restore; `RestoreRefusal` now reads only
  `IsPublished` / `ProgramApproved` (not Tier, which rates an itemized child Hard even in an Approved
  program). This also answers review finding 5. Verified on localhost: soft-deleted Lump Sum parent
  P01000011LS restored (latest, GAA-R revision live; program Cost recomputed to its 1,000,000
  allocation from a stale 32,000,000), then reverted by hand (the test user lacks DeleteLumpSum).
- Restrict/Allow Publishing including Lump Sum projects is intended; no change there.
- Not changed: the catch/rollback chain stays inline in both BatchDelete and BatchAddExistingProject;
  contract tests pin `RollbackAsync(CancellationToken.None)` inside each method.
- Not changed: BatchDelete still refuses Lump Sum projects (existing maintainer code, outside #376).

Files changed: FE/src/pages/Program/{Model.d.ts, Service.ts, Views/ProgramDetail.tsx,
components/programDetail/BatchActionsDropdown.tsx, program.md}, FE/UserManual.md,
WebAPI/Controllers/Programs/ProgramController.cs,
MYPS.ApiIntegrationTests/ProgramControllerPublishRestrictionContractTests.cs,
e2e/tests/batch-delete-restore-cross-stage.spec.ts, e2e/tests/helpers/crossStageFixture.ts,
Main/Resources/Internal/SQLScripts/Migration.BatchRestorePermission.2026-10-24.sql,
documents/docs/engineering/MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md, this plan.

Review follow-up (2026-10-25, code review + risk analysis R2/R4/R5/R12):
- R2: the tier resolver ignores IsDeleted, so a live id reached `RestoreRefusal` and was reported
  "Not restored (published)" / "(program is approved)". `BatchAddExistingProject` now reads which
  resolved projects have a deleted revision in this program (`deletedFKs`) before classifying; any
  other id is reported as "Not found or not deleted". Only real candidates are re-decided under the
  lock, so a live id published concurrently no longer rejects the whole batch (mostly closes R3).
  Contract test: `BatchAddExistingProject_RefusesOnlyDeletedProjects`.
- R4: `handleBatchRestoreSubmit` toasts a warning, not a success, when `RefusedProjects` or
  `MissingProjectIds` is non-empty.
- R5: RS5 (latest deleted revision only) confirmed by the user.
- R12: program.md no longer lists Lump Sum as a refusal reason.
- R1 (deploy): `Migration.BatchRestorePermission.2026-10-24.sql` must be run by hand per environment;
  carried in the PR body.
