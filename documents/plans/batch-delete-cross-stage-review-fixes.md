# Plan: Batch Delete cross-stage branch — review fixes

Status: Implemented
Created: 2026-10-06
Source: code review + e2e run of 2026-10-06 on branch `fix/batch-delete-restore-cross-stage-verification`
(8 commits on `origin/myps-v2.0.2-2026-0921-0832-program-cost-compute-performance` @ `438f0659`; the
local ref of that name is stale), against `localhost/myps_db_dpwh_2025`.

**Companion plan:** `documents/plans/batch-add-existing-project-restore-fixes.md` (**Status: Deferred**)
records every `BatchAddExistingProject` (Batch Restore) defect for a separate fix later. Per the
maintainer (2026-10-06), Restore is fixed separately and is **not** touched by this plan.

Relation to `documents/plans/program-detail-batch-actions-review-remediation.md` (untracked, other
branch): its S1/J1/J4 and BatchDelete's transaction placement already landed here. Its S2 (restore
recompute) moves to the deferred document. Its S5-rollback/J2/J5/J6 are covered below for the
non-Restore code. S3/S4/J3 are not touched by this branch and stay there.

## Goal

Close the non-Restore defects found in this branch before it merges to the v2.0.2 release, and make its
"live e2e proof" spec runnable, honest, and free of orphaned data. Restore's defects are recorded, not
fixed.

## Already implemented vs. still to change

### Already implemented on this branch (verified in the diff)

| Area | What is done | Commit | Status after review |
|---|---|---|---|
| Batch Delete key | Flags `vProjectLatest.RevisionId` instead of `.Id` (`tProjects.Id`), which hit another project's revision 97% of the time | `ab4d405b` | ✅ Correct, the core fix. Ship it |
| Batch Delete cost | `RecomputeProgramCostAsync` inside a transaction with the delete | `487d0fb9` | ✅ Correct |
| Batch Delete transaction | Opened just before the first write, not before validation | `051bbdfe` | ✅ Placement correct. ⚠ catch passes the request token to `RollbackAsync` (F6) |
| Batch Restore commits | Lookup materialized once before `ExecuteUpdate` | `487d0fb9` | ⚠ Works, but see the deferred document (no recompute, early transaction, rollback token, Lump Sum revival, UI wiring) |
| Batch Restore scope | Filtered on `ProgramFK` | `051bbdfe` | ✅ Correct, kept. Remaining Restore gaps → deferred |
| Table refresh | `refreshProjects()` after Batch Actions, Restore, Publish; delete/restore → page 1, flag-only → same page | `487d0fb9`, `90f709c7`, `3210c485` | ✅ Correct (UI spec 2/2) |
| Duplicate error toasts | Generic catch toasts removed (FE/CLAUDE.md rule) | `487d0fb9` | ⚠ Over-corrected: errors the interceptor does NOT toast are now silent (F8) |
| Fixture blank groups | `approvedProgramFixture` drops blank group members | `57a15a6d` | ✅ Correct. ⚠ helper not exported; duplicated in the new spec (F10) |
| Contract tests | Source-level pins for the above | `487d0fb9`, `ab4d405b`, `051bbdfe` | ✅ 11/11 pass. ⚠ BatchDelete's rollback token is not pinned |
| Cross-stage e2e proof | `batch-delete-restore-cross-stage.spec.ts` | `9bad7cbb` | ❌ Fails on dpwh_2025 (F2), strands a program per run (F3), rule #2 vacuous (F4) |
| One-off cleanup script | `zz-manual-cleanup.spec.ts` | `9bad7cbb` | ❌ Runs in every suite run (F5) |
| Docs | RCA doc, `program.md`, `e2e/CLAUDE.md` row for the UI spec | `ab4d405b`, `90f709c7` | ⚠ Gaps: cross-stage spec row, ProgramId-regeneration trap (F11) |

### Still to change (this plan)

| Task | Change | Why | Gates merge? |
|---|---|---|---|
| T1 | `playwright.config.ts` `testIgnore` for `zz-manual-*`, opt-in via `E2E_RUN_MANUAL=1` | F5 shared-data deletes | **Yes** |
| T2 | Rewrite cross-stage spec: reusable named fixture, re-resolve `ProgramId` by `ProgramPK` after each advance, self-heal, no `afterAll`; opt-in true rule #2 test behind `E2E_ALLOW_ORPHANS=1` | F2, F3, F4 | **Yes** |
| T3 | `BatchDelete` catch: rollback without the request token, unable to mask the original exception | F6 | No (should) |
| T4 | `BatchActionsDropdown.tsx`: generic error toast **only** when the error has no `Message` | F8 silent failures | No (should) |
| T5 | Export `withoutBlanks`; import it in the spec | F10 | No |
| T6 | Contract test pinning T3: `BatchDelete` must not contain `RollbackAsync(cancellationToken)` | regression guard for F6 | With T3 |
| D1–D4 | `e2e/CLAUDE.md`, RCA doc, `FE/CLAUDE.md`, old plan cross-reference + write the deferred document | F11 + new facts | No |

### Deferred to the separate Restore fix (NOT in this plan)

| ID | Restore defect | Where |
|---|---|---|
| RS1 | No `RecomputeProgramCostAsync` after a committed restore, so the stored program Cost goes stale | `ProgramController.cs` ~2532 |
| RS2 | Transaction opened before validation (`using var transaction` at the top) | ~2432 |
| RS3 | `RollbackAsync(cancellationToken)` in catch | ~2553 |
| RS4 | Revives Lump Sum soft-deletes (same `IsDeleted` flag, `LumpsumController.Itemization.cs:404/603`), re-drawing the parent's allocation | lookup ~2497 |
| RS5 | `Max(Id)` per project: a project deleted at several stages gets only its latest revision back | lookup ~2497 |
| RS6 | `BatchRestoreDialog` receives `Details.ProgramPK`; the API matches `ProgramId`, which diverges after BP, so it would 400 | `ProgramDetail.tsx` ~851 |
| RS7 | `handleBatchRestoreSubmit` has the same silent-failure gap as F8 | `ProgramDetail.tsx` ~261 |
| RS8 | Menu opener still commented out (`de295446`); decide whether to re-enable after RS1–RS7 | `ProgramDetail.tsx` ~237 |

## Evidence (2026-10-06)

| Check | Result |
|---|---|
| API build (scratch `-o`), proven on localhost `myps_db_dpwh_2025` via `sys.dm_exec_sessions` (pid 11792) | 0 errors |
| `ProgramControllerPublishRestrictionContractTests` | 11/11 passed |
| `program-detail-batch-actions.spec.ts` (UI) | 2/2 passed |
| `batch-delete-restore-cross-stage.spec.ts` | **0/1**: BatchDelete 400 "Program Not Found" (F2) |
| Full suite minus the two files above and `zz-manual-cleanup` (81 tests) | 43 passed, 10 failed, 5 skipped, 23 did not run (8.1 min). **No failure is in code this branch changes**: 4 missing data-security fixture accounts, `ProjectIdCollisionException` (allocator `tProjectIdSequence` out of sync on this DB) on Lump Sum imports, and the known dashboard FY / `project-list` gaps |
| Residue on DB | `tPrograms.Id 71` (`DESKTOP-EV51R65_10062026_084228`, at NEP with live project `P01000001LZ`) stranded by the cross-stage spec. It is the only one on this DB (corrected during implementation: the three `DESKTOP-EV51R65_10042026_*` ids are the intended approval fixture programs), and there are 4 on `myps_db_dev` (2026-10-05). Sweeper removed 8 Lump Sum fixtures. The UI spec's batch-deleted fixture `P01000008LS` (rev 255850) remains flagged |

## Findings fixed by this plan

| # | Severity | Finding |
|---|---|---|
| F2 | High (test) | BP→NEP `UpdateProgramStage` **regenerates `ProgramId`** (timestamp; `…084228`→`…084229`, `ProgramPK` unchanged). The spec re-resolves `projectId` but not `programId`, so it passes only when create+advance land in the same second |
| F3 | High (data) | Spec `afterAll` uses the unauthenticated `request` fixture + hard-coded `:5015`, ignores status, and `DeleteProgram` refuses any program past BP anyway, so every run strands a program |
| F4 | Medium (test) | Rule #2 check is vacuous: delete and restore both happen at NEP while the program is at NEP |
| F5 | High (data) | `zz-manual-cleanup.spec.ts` ("never part of a normal suite run") is inside `testDir` with no `testIgnore`, so every plain `npx playwright test` fires 13 `DeleteProgram` calls by hard-coded name |
| F6 | Medium | `BatchDelete` catch: `RollbackAsync(cancellationToken)` throws on a cancelled token and skips `_exceptionHandler.Handle` |
| F8 | Medium | `BatchActionsDropdown` has no toast for network errors / 401/403/500 without `Message` (`httpClient.ts` toasts only on 400 or `data.Message`) |
| F10 | Low | `withoutBlanks` copied inline |
| F11 | Low | `e2e/CLAUDE.md` coverage table lacks the cross-stage spec and the cleanup script |

## Acceptance Criteria

As a release maintainer, I want the Batch Delete fixes to fail visibly and be proven by an e2e spec that
leaves no data behind, so that the branch can merge to v2.0.2 without a test suite that silently mutates
shared databases, while Restore's defects stay recorded for their own fix.

- [x] `npx playwright test` with no arguments does not run `zz-manual-cleanup.spec.ts`; `E2E_RUN_MANUAL=1` does.
- [x] `batch-delete-restore-cross-stage.spec.ts` passes on `localhost/myps_db_dpwh_2025` and `localhost/myps_db_dev`, regardless of how many seconds elapse between create and advance.
- [x] Two consecutive default runs of that spec create **zero** new `tPrograms` rows after the first (fixture reused by name); a run aborted between delete and restore is healed by the next run.
- [ ] With `E2E_ALLOW_ORPHANS=1`, an extra test proves rule #2 across stages: delete at NEP → advance to NEP-E → restore → the project is listed at NEP and **not** at NEP-E. Without the flag it is skipped with a reason naming the flag. — **Test built and skips correctly; it FAILS when run (myps_db_dev, 2026-10-06) on a real product defect:** the NEP→NEP-E advance carries the deleted project forward. Left unticked until that defect is fixed (see Completion Log).
- [x] `BatchDelete`'s catch does not pass the request token to `RollbackAsync`; a cancelled request still reaches `_exceptionHandler.Handle`. Pinned by a contract test (T6) that fails if `RollbackAsync(cancellationToken)` reappears in `BatchDelete`.
- [ ] A Batch Action failing without an interceptor toast (network error, 401/403/500 without `Message`) shows exactly one generic error toast; a 400 or `Message` body still shows exactly one (the API's). — Implemented (`351f26fb`), typecheck and lint clean; the manual UI check (Verification 6) was **not** run.
- [x] `withoutBlanks` exists once, exported from `approvedProgramFixture.ts`.
- [x] `BatchAddExistingProject` and the Restore FE wiring are **unchanged** by this plan (`git diff` shows no hunk in them).
- [x] `documents/plans/batch-add-existing-project-restore-fixes.md` exists with Status: Deferred and RS1–RS8 (written with this plan, 2026-10-06).
- [x] All existing contract tests still pass; `program-detail-batch-actions.spec.ts` still passes 2/2.

## Approach

All on the existing branch, one commit per concern, explicit pathspecs (never sweep in the maintainer's
`appsettings.Development.json` / `.env.development`). No schema change, nothing pushed. Order: T1, T2
(merge gates), then T3–T6, then docs.

**Cross-stage spec design (decided 2026-10-06: "both, rule #2 opt-in").** Programs past BP cannot be
deleted through any API (`DeleteProgram`'s `StagesToCheck` guard, a deliberate business rule), so a
per-run program is a permanent orphan. The default test adopts the approval fixture's pattern
(`approvedProgramFixture.ts`: find by an unmistakable name, create once, never swept):
- `ensureCrossStageFixture(page)`: find `E2E batch delete/restore cross-stage fixture` via `listPrograms`.
  If absent, create at BP with one project (today's payload) and advance to NEP. **Then always
  re-resolve by `ProgramPK` (`programByPK`, `lumpSumFixture.ts`)** for the current `ProgramId`.
- Self-heal: if the NEP listing is empty (a previous run aborted after delete), Batch Restore first.
- Test: delete at NEP → gone at NEP, still at BP (rule #1) → restore → back at NEP → second restore
  answers 400 "No Projects Restored". Ends where it started. No `afterAll`.
- Opt-in rule #2 test (`test.skip(!process.env.E2E_ALLOW_ORPHANS, …)`): a fresh program
  `e2e-crossstage-orphan-<ISO>`, 2 projects, BP→NEP, delete A at NEP, NEP→NEP-E (B keeps it
  advanceable), restore A → listed at NEP, absent at NEP-E. Logs the orphan's `ProgramPK`.
  Re-resolve `ProgramId` after **every** advance.
- The spec **uses** Restore as it behaves today and asserts listing only; it makes no program Cost
  assertions (those belong to the deferred RS1 fix). If the Restore fix later changes behaviour, the
  spec is its regression net.

**FE toast fallback (BatchActionsDropdown only).** The interceptor throws an `ErrorResponse` with
`Message` exactly when it has toasted. Toast the generic message only when `!(error as any)?.Message`.
This stays within FE/CLAUDE.md's "no toast for expected API errors" rule.

**BatchDelete rollback.** Keep the nullable transaction opened just before the first write; in the catch,
roll back with `CancellationToken.None` (optionally inside its own try), so the original exception always
reaches `_exceptionHandler.Handle`. The explicit `RollbackAsync` call stays: an existing contract test
requires it (see T3).

## Tasks

### Implementation
- **T1 (F5)** `e2e/playwright.config.ts`: `testIgnore: process.env.E2E_RUN_MANUAL ? [] : ['**/zz-manual-*.spec.ts']`. Update the script header's "how to run" line.
- **T2 (F2, F3, F4)** Rewrite `e2e/tests/batch-delete-restore-cross-stage.spec.ts` per the Approach. Remove the `afterAll` and the hard-coded `localhost:5015`; keep the AddProject payload notes. Fixture helper in `e2e/tests/helpers/` (new `crossStageFixture.ts`, or in `approvedProgramFixture.ts` if small).
- **T3 (F6)** `ProgramController.BatchDelete` catch (~2416): change `RollbackAsync(cancellationToken)` to `RollbackAsync(CancellationToken.None)`. **Keep the `RollbackAsync` call.** Do NOT replace it with "rely on `DisposeAsync`": the existing test `BatchDelete_RecomputesProgramCostInsideTransaction` (`ProgramControllerPublishRestrictionContractTests.cs:109`) asserts `Contains("RollbackAsync")`, and that pin stays as is. Optionally wrap the rollback in its own try/catch so a failed rollback can't mask `ex`.
  - *T3 ↔ T6:* T3 is the fix; T6 is its regression pin (asserts the source no longer contains `RollbackAsync(cancellationToken)`). T6 would fail against today's code, so it lands in the same commit as T3, or right after it. Without T6, a later edit could reintroduce the token unnoticed, which is likely because `BatchAddExistingProject` (~2553) still carries the same line (RS3, deferred). T6 scopes its assertion to `BatchDelete` only, so the deferred Restore code doesn't fail it.
- **T4 (F8)** `BatchActionsDropdown.tsx` (~61): generic error toast only when the error has no `Message`; fix the comment claiming the interceptor always toasts.
- **T5 (F10)** Export `withoutBlanks` from `approvedProgramFixture.ts`; import in the spec/helper.
- **T6** `ProgramControllerPublishRestrictionContractTests.cs`: new `[Fact]` with the same traits (`ProcessConformance`, `Program`). Use `ExtractMethod(source, "BatchDelete")` and `Assert.DoesNotContain("RollbackAsync(cancellationToken)", method)`, plus `Assert.Contains("RollbackAsync(CancellationToken.None)", method)`. Add a dated comment explaining the cancelled-token masking. Scope it to `BatchDelete` only (Restore is deferred, RS3). Leave the existing pins untouched.

### Documentation
- **D1 (F11)** `e2e/CLAUDE.md`: coverage rows for the cross-stage spec (default + opt-in) and the manual script; trap note **"`ProgramId` is regenerated on every stage advance; only `ProgramPK` is stable"**; programs past BP are undeletable, so specs that advance must reuse a named fixture; the two env flags.
- **D2** `documents/docs/engineering/MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md`: ProgramId regeneration (F2); inventory of stranded test programs per DB (dpwh_2025: Id 71 + three `DESKTOP-EV51R65_10042026_*`; myps_db_dev: four `DESKTOP-OCATGDI_10052026_*`); a pointer to the deferred Restore document.
- **D3** `FE/CLAUDE.md`: correct the interceptor sentence (toasts on 400 or when a `Message` exists, not every error); add the no-`Message` fallback to the pattern.
- **D4** `documents/plans/batch-add-existing-project-restore-fixes.md` was written with this plan (2026-10-06); keep it in step with the "Deferred to the separate Restore fix" table above if either changes. Mark S2 in `program-detail-batch-actions-review-remediation.md` as "moved to batch-add-existing-project-restore-fixes.md" (untracked file: edit, don't commit unless asked).

## Files / Components Touched
- `WebAPI/Controllers/Programs/ProgramController.cs` (**`BatchDelete` only**)
- `FE/src/pages/Program/components/programDetail/BatchActionsDropdown.tsx`
- `e2e/playwright.config.ts`, `e2e/tests/batch-delete-restore-cross-stage.spec.ts`, `e2e/tests/zz-manual-cleanup.spec.ts` (header), `e2e/tests/helpers/approvedProgramFixture.ts` (+ optional `crossStageFixture.ts`)
- `MYPS.ApiIntegrationTests/ProgramControllerPublishRestrictionContractTests.cs` (T6: one new test; existing pins unchanged)
- Docs: `e2e/CLAUDE.md`, `MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md`, `FE/CLAUDE.md`, new `documents/plans/batch-add-existing-project-restore-fixes.md`

## Verification
1. `dotnet test MYPS.ApiIntegrationTests --filter FullyQualifiedName~ProgramControllerPublishRestrictionContractTests`: 12 pass (the existing 11 + T6). Also confirm T6 **fails** against the pre-T3 source (stash T3, run, restore), so the pin is proven able to fail.
2. Scratch API build per the memory recipe (copy's `MYPSDb` = localhost; prove via `sys.dm_exec_sessions`). Run `npx playwright test tests/batch-delete-restore-cross-stage.spec.ts tests/program-detail-batch-actions.spec.ts` **twice**: both pass; `SELECT COUNT(*) FROM tPrograms` rises by 1 on the first run and 0 on the second.
3. Abort a run between delete and restore; the next run passes and the fixture project is live at NEP.
4. `npx playwright test --list` shows no `zz-manual-cleanup`; with `E2E_RUN_MANUAL=1` it appears.
5. `E2E_ALLOW_ORPHANS=1` run of the opt-in test passes once on `myps_db_dev` (+1 program, recorded in D2).
6. Manual UI: API stopped → Batch Delete shows one generic error toast; invalid project ID → one API toast.
7. `git diff 53d062ab -- WebAPI/Controllers/Programs/ProgramController.cs` shows hunks only inside `BatchDelete`.

## Risk analysis — merging this branch into v2.0.2

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | **Restore ships with known defects** (RS1–RS7), deferred by decision. Most material is RS1, stale program Cost after an API restore | Low (no UI opener; API-only) / Medium | Keep the menu opener commented out until the deferred fix lands (RS8). Record it in the release notes |
| R2 | **Historic wrong-row deletes.** The cause is fixed in `ab4d405b` (keyed on `RevisionId`), and the RCA documents the recovery method. That commit repaired no database by design. **Checked 2026-10-06, read-only:** the production copy `myps_db_dpwh` (snapshot 2026-09-20) has **0** deleted revisions, so there was no historic damage there; `myps_db_dpwh_2025`'s 6 are all e2e fixtures | Low / Low | Only open point: live production may have changed since the snapshot. Maintainer runs `SELECT COUNT(*) FROM tProjectRevisions WHERE IsDeleted = 1` on live production before the release cut; non-zero → apply the RCA's recovery method |
| R3 | **BatchDelete recomputes cost inside its transaction**, holding locks longer on large programs; at GAA-R it reads the overlay | Low / Low (RCSI on; same helper as other mutators) | Watch duration in the release smoke |
| R4 | **Silent UI failures** on Batch Actions (F8) | Medium / Low | T4 |
| R5 | **Test suite mutates shared data** (F5: 13 `DeleteProgram` by name per suite run; F3: an orphan per run). Anyone pointing `E2E_API_URL` at a shared server inherits both | High / Medium | T1, T2 before merge |
| R6 | Rollback-on-cancel masks BatchDelete errors (F6) | Low / Low | T3 |
| R7 | **Tracked Playwright artifacts** (`53d062ab` commits `playwright-report/index.html`; `e2e/test-results/.last-run.json` is dirtied by every run) | High / Low (noise, conflicts) | Out of scope; suggest `git rm --cached` separately |

**Merge recommendation:** ship the core BatchDelete `RevisionId` fix. Merge after **T1 and T2** (ideally
T3/T4). R2 is closed for the production copy; only a one-line count on live production remains. Restore stays as is, with its opener hidden,
until `batch-add-existing-project-restore-fixes.md` is implemented.

## Assumptions
- NEP→NEP-E (`UpdateProgramStage` Stage 3) works for a program with one live project; fall back to HGAB if NEP-E is skipped on that DB.
- Category 1 still has Project ID range on both target DBs; the reusable fixture consumes it once, not per run.

## Completion Log
Date: 2026-10-06
- Implementation: all 6 tasks, in 4 commits on `fix/batch-delete-restore-cross-stage-verification` (not pushed).
  - `7c130bdb` T1: `testIgnore` for `zz-manual-*`, opt-in via `E2E_RUN_MANUAL=1`. `--list`: 82 tests by default, 83 with the flag.
  - `6c66de0c` T3 + T6: `BatchDelete` rolls back with `CancellationToken.None`, and a failed rollback cannot mask `ex`. New contract test `BatchDelete_RollsBackWithoutTheRequestToken`. Proven able to fail: 11/12 against the pre-T3 source, 12/12 with it.
  - `37dcaabf` T2 + T5: new `e2e/tests/helpers/crossStageFixture.ts` (reusable named fixture, re-read by `ProgramPK` after every advance, self-heal); spec rewritten (default test + opt-in rule #2 test); `withoutBlanks` exported; `programOnStage` skips the fixture and its orphans.
  - `351f26fb` T4: `BatchActionsDropdown` toasts a generic error only when the error has no `Message`.
- Documentation: `4bfc34d9`. D1 `e2e/CLAUDE.md` (coverage rows, env flags, `Name` trap, cross-stage fixture section); D2 RCA follow-up (production-copy check, delete-undone-by-advance defect, ProgramId/ProgramPK rules, inventory of test programs that cannot be deleted); D3 `FE/CLAUDE.md` interceptor rule and catch pattern; D4 deferred Restore plan written with this plan, cross-referenced from `program-detail-batch-actions-review-remediation.md` (S2, untracked, edited not committed).
- Verification, against localhost only (API proven via `sys.dm_exec_sessions` before each run):
  1. Contract tests 12/12.
  2. `myps_db_dpwh_2025`: cross-stage + UI batch specs, run 1 created the fixture (71 → 72 programs), run 2 created none; both passed (3 passed, 1 skipped each).
  3. Simulated abort (fixture project deleted via the API, not restored): the next run healed it and passed, still 72.
  4. `--list` as above.
  5. `myps_db_dev` with `E2E_ALLOW_ORPHANS=1`: default test passed (created the fixture there, Id 36); **opt-in rule #2 test failed on a product defect** (below); +1 orphan, Id 37, recorded in the RCA.
  6. **Not run** (manual toast check).
  7. Controller diff is one hunk, inside `BatchDelete`; `ProgramDetail.tsx` untouched.
  - Full suite on `myps_db_dpwh_2025`: 44 passed, 10 failed, 6 skipped, 23 did not run. The failure set is **identical** to the pre-change baseline (43/10/5/23). The differences are the new default test (+1 passed) and the opt-in test (+1 skipped).

Deviations / flags:
- **New product defect found, not fixed (out of scope, needs a decision):** a Batch Delete is undone by the next stage advance. `vProjectLatest` falls back to the project's older live revision and `UpdateProgramStage` copies it forward, under its BP-era id (revision 130421 on `myps_db_dev`). This is the old plan's S3, now demonstrated. The opt-in rule #2 test is its acceptance check; its assertion was deliberately not loosened.
- **Found while implementing T2:** `UpdateProgramStage` writes the program revision's `Name` from the request, so an advance without `Name` blanks it. That is how program 71 lost its name. The fixture always sends it; the API is unchanged (recorded in the RCA). `ShowProjectsInProgram`'s `ProgramId` field is really the `ProgramPK`.
- **Scope additions:** `lumpSumFixture.ts` gained `CROSS_STAGE_FIXTURE_PROGRAM` / `CROSS_STAGE_ORPHAN_PREFIX` and the `programOnStage` exclusion, so Lump Sum specs cannot seed parents into the NEP fixture. Not in the plan's file list, but needed for T2's "exactly one project" invariant.
- **Correction:** this plan's Evidence said 4 stranded programs on `myps_db_dpwh_2025` (3 from 2026-10-04). Wrong: those three ids are the two approval fixture programs, which are intended. Only program 71 is stranded there. Commit `37dcaabf`'s message repeats the wrong count; `4bfc34d9` corrects the comments and records the correction (history not rewritten).
- T4 edge: a failure in the post-success refresh (`onRefresh`) also lands in the catch, so a network failure there shows the generic "Failed to …" toast after the success toast. Rare; left as is.
- Scratch API config was pointed at `myps_db_dev` for verification 5 only, then back to `myps_db_dpwh_2025`. The maintainer's `Main/appsettings.Development.json` was never touched.
Files changed: `e2e/playwright.config.ts`, `e2e/tests/zz-manual-cleanup.spec.ts`, `e2e/tests/batch-delete-restore-cross-stage.spec.ts`, `e2e/tests/helpers/crossStageFixture.ts` (new), `e2e/tests/helpers/approvedProgramFixture.ts`, `e2e/tests/helpers/lumpSumFixture.ts`, `WebAPI/Controllers/Programs/ProgramController.cs`, `MYPS.ApiIntegrationTests/ProgramControllerPublishRestrictionContractTests.cs`, `FE/src/pages/Program/components/programDetail/BatchActionsDropdown.tsx`, `e2e/CLAUDE.md`, `FE/CLAUDE.md`, `documents/docs/engineering/MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md`; plans: this file, `batch-add-existing-project-restore-fixes.md` (new), `program-detail-batch-actions-review-remediation.md` (untracked, edited).

