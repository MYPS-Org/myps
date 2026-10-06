# Plan: BatchAddExistingProject (Batch Restore) fixes

Status: Deferred — to be fixed separately (maintainer decision 2026-10-06)
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
- [ ] RS1 After a committed restore, tProgramRevisions.Cost equals pRecomputeProgramCost's result
      (RecomputeProgramCostAsync(ProgramParent.ProgramPK) before CommitAsync, as BatchDelete does).
- [ ] RS2 No transaction is opened for a request rejected by validation.
- [ ] RS3 Catch does not pass the request token to RollbackAsync.
- [ ] RS4 Decision recorded and implemented: Lump Sum revisions soft-deleted by
      LumpsumController.Itemization.cs (:404, :603) are excluded from Batch Restore, or allowed and
      documented with the allocation consequence.
- [ ] RS5 Decision recorded: a project deleted at several stages gets back only its latest deleted
      revision (Max(Id)), or every revision BatchDelete flagged.
- [ ] RS6 BatchRestoreDialog receives Details.ProgramId (ProgramId changes on every stage advance;
      ProgramPK does not).
- [ ] RS7 handleBatchRestoreSubmit toasts a generic error only when the error has no Message.
- [ ] RS8 Opener re-enabled only after RS1–RS7, behind the same permission as Batch Delete.
- [ ] Contract tests pin RS1–RS3; the cross-stage e2e spec gains a program Cost assertion
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
