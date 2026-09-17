# MYPS Documentation Index

## Process specifications

| Document | Purpose | Status |
|---|---|---|
| [Program-to-Project process-flow plan](process/MYPS_PROGRAM_TO_PROJECT_PROCESS_FLOW_PLAN.md) | Delivery plan for the complete client and developer documentation suite | Partially client-validated |
| [Program Stage advancement specification](process/MYPS_PROGRAM_STAGE_ADVANCEMENT_SPECIFICATION.md) | Confirmed business flow, data contract, identifier rules, exceptions, implementation plan, and acceptance tests | Client-confirmed baseline with open technical verifications |

## Formal Revision specifications

| Document | Purpose | Status |
|---|---|---|
| [Formal Revision redesign and migration plan](formal-revision/MYPS_FORMAL_REVISION_REDESIGN_AND_MIGRATION_PLAN.md) | Approved table scope, target invariants, migration/cutover/rollback controls, testing strategy, and release gates | Planning baseline; implementation blockers identified |
| [Formal Revision use-case specification](formal-revision/MYPS_FORMAL_REVISION_USE_CASE_SPECIFICATION.md) | IO/RO/CO business flows, dual document modals, PCMA rule evaluation, errors, transaction boundaries, traceability, and 52 UAT scenarios | UAT baseline; open policy decisions identified |

## Engineering plans

| Document | Purpose | Status |
|---|---|---|
| [`RevisionController` refactoring plan](engineering/MYPS_REVISION_CONTROLLER_REFACTORING_PLAN.md) | Code-informed defect register, target architecture, query/command split, workflow state machine, document/PCMA design, test plan, and incremental rollout | Planning baseline; application code not changed |
| [`RevisionRequests` refactoring specification](engineering/MYPS_REVISION_REQUESTS_REFACTORING_SPECIFICATION.md) | Focused queue analysis covering filter defects, actor and row scope, corrected workflow ownership, API/frontend contract, pagination, tests, and rollout | Business decisions complete 2026-08-11; ready for technical implementation planning |

## Data migration records (`myps_db_dev_200`)

| Document | Purpose | Status |
|---|---|---|
| [`myps_db_dev_200` bring-up runbook](engineering/MYPS_DEV_200_DATABASE_BRINGUP.md) | Schema, isolation, the program-group load (Step 3b) and the Lump Sum migration (Step 3c) in run order, with expected outputs | Runbook; mirrored at `Main/Resources/LumpSum/` |
| [Program-group load from `MYPS_BAK`](engineering/MYPS_BAK_PROGRAM_GROUP_LOAD.md) | Every 2023 group and 2025 OO-1 through the reference python pipeline: what changed in the pipeline, the 33 groups, figures per group, verification, how to run it again | Done 2026-09-14; scripts live only in the backend repo |
| [Legacy Lump Sum migration](engineering/MYPS_LEGACY_LS_MIGRATION.md) | 123 parents and 4,037 children onto the V3 model: the data as found, what the script does, both runs, what the first run got wrong, server checklist, `MY…LS` inventory (Appendix A) | Done 2026-09-14 on `dev_200`; server-bound, not yet run there |
| [Plan: legacy Lump Sum migration](../plans/legacy-ls-migration.md) | Goal, acceptance criteria, decisions D1–D14, phases, Completion Log | Implemented |

## Database design samples

| Document | Purpose | Status |
|---|---|---|
| [Formal Revision V2 SQL sample](architecture/database/MYPS_FORMAL_REVISION_SCHEMA_V2_SAMPLE.sql) | Early design exploration combining legacy Revision fields with normalized relationships | Exploratory only; superseded by the approved scope in the redesign plan |

## Manual database scripts

This repo has **no migration runner** for database objects. The scripts below define views,
functions, and schema that the application expects to already exist — apply each by hand to
the target database before deploying the code that depends on it.

| Script | Defines | Required by |
|---|---|---|
| [`Revision.Queue.sql`](../../Main/Resources/Internal/SQLScripts/Revision.Queue.sql) | Normalized revision queue read model | `RevisionController` queue endpoints |
| [`Revision.Queue.Verification.sql`](../../Main/Resources/Internal/SQLScripts/Revision.Queue.Verification.sql) | Read-only post-deployment invariants | Post-deploy verification of the above |
| [`Project.StageTargets.sql`](../../Main/Resources/Internal/SQLScripts/Project.StageTargets.sql) | `dbo.fProjectStageTargets(@ProjectFK)` | `ProjectController.ShowProjectTargetComponents` and `ShowProjectStageTargets`, which back the Component Targets panel on the project details page |

## Visual documentation

See the [architecture and visual catalogue](architecture/README.md) for the lifecycle, ERDs, effective-data flow, and brain-map model.

## Source evidence

See the [source evidence catalogue](../sources/README.md).

Every statement should carry an evidence class. Unverified application behavior remains proposed or an open decision until confirmed against current code or deployed data.
