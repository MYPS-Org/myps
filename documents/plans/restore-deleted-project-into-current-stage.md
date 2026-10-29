# Plan: Restore a project deleted at an earlier stage into the program's current stage

Status: Implemented
Created: 2026-10-29
Source: user request 2026-10-29 (follow-up to delete-rules-projects-programs-stages.md), with Alvin's clarification: a project deleted before the program moves on stays deleted; projects of the same year may have different stage paths (some without HGAB, all with GAA). The user approved the proposal in chat and pointed at the existing "Add Project to Working Program" copy (dbo.pCopyProjectDetailChain).

## Goal
When a project was soft-deleted at a stage the program has since left (e.g. deleted at HGAB, program now at GAA), the user can restore it **into the current stage**, with a clear message that the program has moved on. Restoring it back at the old stage (what Batch Restore does) makes no sense for the user.

## Acceptance Criteria
As a program user, I want to bring back a project deleted at an earlier stage into the stage the program is at now, so that I don't have to re-encode it.

- [x] The Deleted projects panel lists, in a separate section, projects whose newest deleted copy is at an earlier stage and that have nothing at the current stage, with the stage they were deleted at.
- [x] That section shows an info message: the program has moved on; restoring adds the project to the current stage with the data it had when deleted; the stages in between are skipped.
- [x] Restore there creates the project at the current stage: a new revision (copied from the deleted one) and stage row, with all live child rows copied. The old deleted copy stays deleted as history. A BP Project ID becomes P when the current stage is a P stage (NEP to GAA-R), as Proceed to next stage does, and is refused if that P ID belongs to another project.
- [x] Refused with the reason shown, and nothing written, for a published project, an Approved program, or a Lump Sum project.
- [x] One audit row per restored project; the program cost is recomputed; the table and the count refresh.
- [x] Batch Restore is unchanged; its dialog points to Deleted projects for restoring into the current stage.

## Approach
- `ShowDeletedProjects` returns both sections (`DeletedAtCurrentStage`, `DeletedStageName`), with `CanRestore` and the reason for each row.
- New `POST /Program/RestoreToCurrentStage { ProgramId, ProjectFKs }`, guarded by `[RequiresDeletionObjects]`. It runs in one transaction: the per-program delete lock, the rule re-decided on locked rows, the revision and stage row inserted, the live child rows copied, the audit rows, the cost recompute, then commit.
- Permission: the migration grants `RestoreToCurrentStage` to groups holding `BatchAddExistingProject`.
- Front end: the panel gets two sections and a restore path for each; ProgramDetail adds a forward-restore handler; the Batch Restore dialog gets a note.

## Tasks
### Implementation
1. ShowDeletedProjects query and row fields; add `[RequiresDeletionObjects]`.
2. RestoreToCurrentStage endpoint and DTO.
3. Migration grant; re-run it on local myps_db_dev.
4. FE: Model, Service, DeletedProjectsPanel, ProgramDetail, BatchRestoreDialog note.
5. Tests: RequiresDeletionObjects list; narrated e2e on local myps_db_dev (throwaway program: delete at NEP, advance to HGAB, restore into HGAB).
### Documentation
6. Changelog, user manuals, program.md.

## Risks / Assumptions
- The throwaway e2e program goes past BP, so by the BP/RBP rule it cannot be deleted afterwards. It stays on local myps_db_dev, named "E2E-RestoreForward …", with its projects soft-deleted at the end.
- Only live child rows are copied, which is what the new stage needs.

## Completion Log
- 2026-10-29. Backend: `ShowDeletedProjects` returns both sections; new `RestoreToCurrentStage` endpoint and DTO; `CopyLiveChildRowsAsync` copies funding, component costs and years, work items and locations, supporting docs (field for field as `UpdateProgramStage`) plus notes. Migration grant added and re-run locally (6 groups). FE: Model, Service, two-section `DeletedProjectsPanel` with the info note, `runRestore` shared by both restore handlers in `ProgramDetail`, and the Batch Restore dialog note.
- **Deviation from the approach:** the plan said `dbo.pCopyProjectDetailChain`. The e2e run showed that procedure fails on myps_db_dev: it inserts per-year rows without the NOT NULL `ComponentId` (work items and locations likewise). It exists only in the database, not in the repo, so its version differs per environment. The copy is done in EF instead, as the stage advance does. The failed attempt rolled back fully (checked in the database).
- Verification:
  - `MYPS.ApiIntegrationTests` `RequiresDeletionObjectsTests` 4/4.
  - `tsc`: no errors in the changed files (the 21 known Rbac errors remain).
  - ESLint: the two errors in `ProgramDetail.tsx` (lines with `any` and an unused `error`) are in the committed file too.
  - Narrated e2e (scratch `restore-forward.narrated.spec.ts`, :8082 → :5017 → local myps_db_dev, COPY_ONLY backup first), across three runs on one throwaway program: soft delete at NEP; the advance to HGAB leaves A deleted; the panel shows both sections, the info note, "Deleted at NEP" and the cost; "Restore into HGAB" toasts and refreshes; the database has the new HGAB revision with the cost, its year (ComponentId kept), funding and note copied, the NEP copy still deleted, and one audit row; the program cost is ₱1,234,567.89; a second restore is refused (400).
- Left behind on local myps_db_dev: program "E2E-RestoreForward 202610291215" at HGAB, its two projects soft-deleted.
- **Found and fixed (pre-existing), 2026-10-29:** `dbo.pRecomputeProgramCost` and `dbo.fProgramStages` counted a project's latest revision at the current stage even when that revision was soft-deleted, so the program cost did not drop after a later-stage delete. Seen on the throwaway program: NEP kept ₱1,234,567.89 after its only costed project was deleted. The fix is in section 11 of `Migration.SchemaAndProgrammability.2026-09-10.sql` (re-cut into `ProgramCost.Objects.2026-09-18.sql`) and ships as `Migration.ProgramCostExcludesDeleted.2026-10-29.sql`. Fixed in the same pass:
  - the recompute's current stage was the newest revision by Id, not the highest StageHierarchy (11 legacy programs on local);
  - the stage rows' ProjectCount counted deleted projects;
  - `vProgramLatest.NumberOfProjects` counted deleted projects.
  - Verification:
    - `RecomputeProgramCostTests` 30/30, and the 3 new tests fail against the HEAD source.
    - The migration ran on local `myps_db_dev` after a COPY_ONLY backup and recomputed 12 programs. Its checks returned 0 rows.
    - Same-stage timing is unchanged (old 399–457 ms, new 422–449 ms). The view takes 45–62 ms across all programs.
