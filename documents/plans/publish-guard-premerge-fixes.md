# Plan: Pre-merge fix set for the publish guard (R4, R5, N1, N2, N3) + review write-up

Status: Ready for implementation
Created: 2026-10-09 (supersedes the 2026-10-07 draft; R3 from that draft landed in `3b7f6e48`)
Source: Risk table from the 2026-10-09 review of `fix/batch-actions-page-position-and-publish-guard-v2.0.2` at `3b7f6e48` (base `76d67979`)

## Context

`3b7f6e48` closed R3 (Restrict's UPDATE now carries `&& !x.IsPublished`), R6 and R9, but the review of it found two regressions and left the two deeper guard gaps open:

- **N1 (regression)** — `BatchActionsDropdown.handleBatchTagSubmit` no longer has a `finally`; `onLoadingChange(false)` is the last statement. Anything thrown inside the `catch` (e.g. `showToast` while the page is swapped for its skeleton) escapes and leaves `ProgramDetail.isLoading` stuck `true`. Also, the new "action completed, but the page failed to refresh" branch is unreachable: `refreshProjects()` is fire-and-forget (`usePagination.refresh/applyFilters` return `void`) and `fetchProgramDetail` catches internally and never rethrows.
- **N2 (regression)** — `ProjectPublishable.AlreadyPublishedGuard.2026-10-05.sql` now patches the live body in place by `STUFF`ing the last `CREATE` before the procedure name with `ALTER`. Dry-run (string ops only, nothing executed): correct on all three localhost DBs (`CREATE   PROCEDURE`), but a body deployed with `CREATE OR ALTER` becomes `ALTER OR ALTER PROCEDURE` — a syntax error raised **after** the backup object exists. Section 2 also still `EXEC`s the recompute on an unordered `TOP 1` program inside a transaction (R8).
- **N3** — The R3 predicate makes "published between the read and the write" reachable, and it lands in the pre-existing `updatedCount == 0` → 400 "No Projects Updated" (no skipped/missing arrays), contradicting the 200 "No Changes Required" branch two lines up. The new comment "updatedCount only counts rows actually changed" is false — `ExecuteUpdateAsync` returns rows *matched*.
- **R4** — `pAllowProjectPublishing` (live, checksum `-292144318`, 1,101 lines, no copy in the repo) has no `IsPublished` guard; its step-9 UPDATE is `WHERE v.IsValid = 1 AND ISNULL(p.IsPublishable, 0) <> 1;`. Only Allow's C# pre-filter protects it — nothing for SSMS/scripts/future callers, and the pre-filter has the same read-then-write race.
- **R5** — The contract tests assert `Assert.Contains("!x.IsPublished", method)`, satisfied by any one of Allow's three guard sites or by a comment.

Plus the interrupted request: the 2026-10-09 review itself goes into the repo as the first commit.

Outcome: the invariant "a published project's `IsPublishable` is never written again" holds at the write in SQL for both procedures and in C# for Restrict; the deploy script cannot half-apply; the FE cannot strand the loading state; and the tests fail if any single guard site is removed.

## Goal

Land the review write-up, fix the two regressions from `3b7f6e48`, and close R4/R5 — the full pre-merge set short of R1 (password rotation, which is operational, not code).

## Acceptance Criteria

As a MYPS operator, I want restrict/allow publishing to leave published projects untouched under every path and to never leave the Program Details page stuck loading, so that batch actions are safe to run on real programs.

- [ ] AC0 — `documents/docs/engineering/MYPS_BATCH_ACTIONS_PUBLISH_GUARD_REVIEW_2026-10-09.md` exists with the findings/risk table from the 2026-10-09 review and is committed on its own before any code change.
- [ ] AC1 (N1) — `handleBatchTagSubmit` always calls `onLoadingChange(false)` on exit, including when the batch call throws and the catch handler itself throws (`try { … } finally { onLoadingChange(false) }` wraps the whole body; the refresh keeps its own inner `try`).
- [ ] AC2 (N1) — `usePagination.fetchData` resolves to `true` on success and `false` on its caught error (it keeps swallowing; no unhandled rejections for the 23 existing callers); `refresh` / `applyFilters` return that `Promise<boolean>`; `refreshProjects` returns it; `onRefresh` awaits it and throws when `false`, so the "action completed, but the page failed to refresh" toast is reachable when `ShowProjectsInProgram` fails. The `ProgramDetail.tsx` comment about a failed header refetch is corrected (the header refetch still swallows by design). The existing e2e `loading/present/absent` assertions still pass.
- [ ] AC3 (N2) — The 2026-10-05 script produces a valid `ALTER`/`CREATE OR ALTER` statement whether the live header is `CREATE PROCEDURE`, `CREATE   PROCEDURE` or `CREATE OR ALTER PROCEDURE`; the backup is created only after the patched statement has been validated; the smoke check has no `EXEC`.
- [ ] AC4 (N3) — When Restrict's UPDATE matches 0 rows after a non-empty `projectPks`, the response is 200 "No Changes Required" with `UpdatedCount = 0`, `MissingProjectIds` and `SkippedAlreadyPublishedProjectIds` populated (the race-skipped IDs included); the "rows actually changed" comment is corrected.
- [ ] AC5 (R4) — A new script `Main/Resources/Internal/SQLScripts/ProjectPublishable.AlreadyPublishedGuard.pAllowProjectPublishing.2026-10-09.sql` patches the live `pAllowProjectPublishing` step-9 UPDATE to `WHERE v.IsValid = 1 AND ISNULL(p.IsPublishable, 0) <> 1 AND ISNULL(p.IsPublished, 0) = 0;` after snapshotting the live body as `pAllowProjectPublishing_backup_pre_published_guard_20261009`; nothing else in the procedure changes; it `THROW`s and changes nothing if the anchor text is not found exactly once; re-running is a no-op.
- [ ] AC6 (R4) — `EXEC dbo.pAllowProjectPublishing @ProjectIds = '["<id>"]'` on a project with `IsPublished = 1, IsPublishable = 0` that passes all seven rules leaves `IsPublishable = 0` and reports `ProjectsUpdated = 0`.
- [ ] AC7 (R4) — `BatchAllowPublish` still reports such a project in `SkippedAlreadyPublishedProjectIds` (C# pre-filter retained as defense in depth); the publish-guard e2e spec still passes.
- [ ] AC8 (R5) — Contract tests assert each guard site separately on comment-stripped source: Restrict's `projectPks` statement and its `ExecuteUpdateAsync` predicate; Allow's `alreadyAllowedProjectIds`, `restrictedProjectIds`, `beforeStatuses`. Reverting any one guard locally makes exactly its fact fail (verified, not committed).
- [ ] AC9 — `MYPS.ApiIntegrationTests` passes (47 today + the new facts); both batch-actions e2e specs pass against `localhost/myps_db_dpwh_2025` with both guard scripts applied there; a new SP-level e2e test proves AC6 and self-skips, naming the script, when the guard text is absent from `sys.sql_modules`.

## Approach

**Task order matters:** write-up first (AC0), then N2 (so the R4 script can copy a *correct* splice), then R4, then N1/N3/R5 (independent).

**N2 (script hardening)** — keep the live-snapshot design (it is the right call for a 1,101-line sibling), fix the splice. Replace the `REVERSE/CHARINDEX('CREATE')` + `STUFF(…,6,'ALTER')` with: find the header as the text from the start of `@def` up to the procedure name; `IF @head LIKE '%CREATE%OR%ALTER%'` → leave it (`CREATE OR ALTER` is already re-runnable); else replace the single leading `CREATE` with `CREATE OR ALTER`. Validate before writing: run the patched statement through `sys.sp_describe_first_result_set`? — not applicable to DDL; instead wrap backup+patch in one `BEGIN TRAN … COMMIT` with `XACT_ABORT ON` so a syntax error in the patched statement rolls the backup back too (DDL is transactional in SQL Server). Drop the `EXEC … ROLLBACK` smoke block; keep the `sys.sql_modules` text check and the informational count. Same shape then reused verbatim for R4 with different `@name/@backup/@old/@new`.

**R4 (new script)** — copy the hardened 2026-10-05 script, parameterised: `@name = N'pAllowProjectPublishing'`, `@backup = N'pAllowProjectPublishing_backup_pre_published_guard_20261009'`, `@old = N'WHERE v.IsValid = 1' + CHAR(13)+CHAR(10) + N'      AND ISNULL(p.IsPublishable, 0) <> 1;'`, `@new = @old` with `;` replaced by `CHAR(13)+CHAR(10) + N'      AND ISNULL(p.IsPublished, 0) = 0;'`. The anchor must match the live body's exact whitespace/line endings (dry-run `(LEN(@def)-LEN(REPLACE(@def,@old,'')))/LEN(@old)` = 1 on all four localhost DBs before committing; if CRLF vs LF differs, normalise `@def` with `REPLACE(@def, CHAR(13)+CHAR(10), CHAR(10))` first and use LF in the anchor). Guard the UPDATE only — `@ResolvedProjects`/`@Validation`/both result sets unchanged, so a published project still resolves and validates and the detailed result set still describes it; only the write is refused. Update the 2026-10-05 script's "SCOPE" header paragraph (it says the siblings are C#-only) to point at the new script.

**N3 (controller)** — in `BatchRestrictPublish`, replace the `updatedCount == 0` 400 with the same 200 "No Changes Required" shape used for `projectPks.Length == 0`, with `SkippedAlreadyPublishedProjectIds = alreadyPublishedProjectIds` ∪ the race-skipped IDs. Compute the race-skipped set as `projectPks` minus the PKs still unpublished — simplest correct form: after the UPDATE, if `updatedCount < projectPks.Length`, re-read `tProjects.Where(pk in projectPks && IsPublished).Select(ProjectPK)` and map back to ProjectIds via `projectRevisions`; append to `alreadyPublishedProjectIds` before building any response. Fix the comment to "… and updatedCount counts rows matched by the guarded predicate". Keep `Title = "No Changes Required"` consistent with Allow.

**N1 (FE)** — `BatchActionsDropdown.tsx`: restructure to `try { onLoadingChange(true); try { switch… ; actionSucceeded = true } catch (error) { …existing gated toast… } if (actionSucceeded) { try { await onRefresh(action) } catch { …warning toast… } } } finally { onLoadingChange(false) }`. `usePagination.ts`: `fetchData` already wraps its request in `try/catch/finally` (lines ~110-137) and swallows — keep that, but `return true` at the end of the `try` and `return false` in the `catch`; `refresh` and `applyFilters` `return fetchData(...)` instead of discarding it; interface types become `Promise<boolean>`. `ProgramDetail.tsx`: `refreshProjects` returns that promise; `onRefresh` does `const ok = await refreshProjects(action === 'delete'); await fetchProgramDetail(...); if (!ok) throw new Error('projects table refresh failed');` so the dropdown's existing inner `catch` shows the warning; correct the comment (a failed *table* refresh now surfaces; the header refetch still swallows by design). The 23 other `refresh()`/`applyFilters()` call sites ignore the return value and need no change — confirm with `tsc`.

**R5 (tests)** — add `StripLineComments(string)` and `ExtractStatement(string method, string anchor)` (anchor → next `;` at paren/brace depth 0) to the contract test class. Replace the loose `Assert.Contains("!x.IsPublished", method)` in both `_SkipsAlreadyPublishedProjects` tests with five `[Fact]`s, one per site, each asserting on the extracted comment-stripped statement and naming its anchor in the failure message. Keep the `alreadyPublishedProjectIds` / `SkippedAlreadyPublishedProjectIds` assertions. Add one fact for N3: Restrict's method contains no `BadRequestObjectResult` after the `ExecuteUpdateAsync` call (string index comparison, same style as `BatchDelete_OpensItsTransactionAfterValidation`).

**e2e (AC9)** — in `batch-restrict-allow-publish-skips-published.spec.ts`: `beforeAll` computes `guardApplied` via `runSql` over `sys.sql_modules`; add a third test that sets the published fixture's `IsPublishable = 0` (`updateOneProject`), `EXEC`s the SP directly for both fixture IDs, and asserts the published one stays `0`. Precondition: the unpublished twin must be granted by the same EXEC — if not (fixture lacks components), `test.skip` with that reason rather than a false green. Self-skip with the script name when `!guardApplied`. Also write the `(e2e <ISO>)` marker into the fixture projects' `Description` so the sweeper's safety net covers them (one-line change; N5 proper stays out of scope).

## Tasks

### Implementation
0. Write `documents/docs/engineering/MYPS_BATCH_ACTIONS_PUBLISH_GUARD_REVIEW_2026-10-09.md` (sections: what `3b7f6e48` resolved; findings 1-12; risk table R1/N1-N7/R4/R5/R7b/R8/R10; verdict; how verified). Commit alone.
1. N2 — `ProjectPublishable.AlreadyPublishedGuard.2026-10-05.sql`: header-normalising splice; `BEGIN TRAN`/`COMMIT` around backup+patch; remove the `EXEC … ROLLBACK` block; update the header's "HOW IT IS APPLIED"/"SCOPE" text. Dry-run the string ops on `myps_db_dev`, `myps_db_dpwh`, `myps_db_dpwh_2025` and on a literal `CREATE OR ALTER` header before applying anywhere.
2. R4 — author `ProjectPublishable.AlreadyPublishedGuard.pAllowProjectPublishing.2026-10-09.sql` from the hardened template; dry-run the anchor count (= 1) on all four localhost DBs; apply to `myps_db_dpwh_2025` and `myps_db_dev`; verify backup object + new checksum + `sys.sql_modules` text. Also apply the (hardened) 2026-10-05 script to the same two DBs — it is on no localhost DB yet.
3. N3 — `BatchRestrictPublish`: race-skipped re-read, 200 "No Changes Required" for the 0-row case, comment fix.
4. N1 — `usePagination.ts` return promises; `ProgramDetail.tsx` `refreshProjects`/`onRefresh`/comment; `BatchActionsDropdown.tsx` outer `try/finally`. `npx tsc --noEmit` in `FE`.
5. R5 — contract test helpers + five per-site facts + the N3 ordering fact; deliberate local revert of one guard to prove the matching fact fails; restore.
6. e2e — SP-level test with `guardApplied` self-skip and twin-grant precondition; `(e2e <ISO>)` marker on fixture descriptions.

### Documentation
7. `e2e/CLAUDE.md` — extend the publish-guard coverage row (SP-level case, its self-skip, the two scripts that must be applied); fix line ~339 ("over every project it holds" → "over every not-yet-published project it holds").
8. `documents/docs/engineering/MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md` — "Published-project invariant" subsection: the three write paths (Restrict UPDATE, `pAllowProjectPublishing`, `pRecomputeProjectPublishable`), where each guard lives, deploy order (2026-10-05 then 2026-10-09; no data correction), rollback (backup objects).
9. `FE/src/pages/Program/program.md` — one line: `refreshProjects()` now returns the table fetch so callers can await it.

## Files / Components Touched
- `documents/docs/engineering/MYPS_BATCH_ACTIONS_PUBLISH_GUARD_REVIEW_2026-10-09.md` (new)
- `Main/Resources/Internal/SQLScripts/ProjectPublishable.AlreadyPublishedGuard.2026-10-05.sql`
- `Main/Resources/Internal/SQLScripts/ProjectPublishable.AlreadyPublishedGuard.pAllowProjectPublishing.2026-10-09.sql` (new)
- `WebAPI/Controllers/Programs/ProgramController.cs` (BatchRestrictPublish only)
- `FE/src/hooks/usePagination.ts`, `FE/src/pages/Program/Views/ProgramDetail.tsx`, `FE/src/pages/Program/components/programDetail/BatchActionsDropdown.tsx`
- `MYPS.ApiIntegrationTests/ProgramControllerPublishRestrictionContractTests.cs`
- `e2e/tests/batch-restrict-allow-publish-skips-published.spec.ts`
- `e2e/CLAUDE.md`, `documents/docs/engineering/MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md`, `FE/src/pages/Program/program.md`

Reused: the 2026-10-05 script's live-snapshot design and backup naming; the spec's `runSql` (argv, `E2E_SQL_*`) and `updateOneProject`; the test class's `ReadSourceFile` / `ExtractMethod` and the index-ordering style of `BatchDelete_OpensItsTransactionAfterValidation`; the dropdown's existing gated catch toast.

## Verification
1. Build: `dotnet build Main/Main.csproj -c Debug -o <scratch>/api-out -p:UseSharedCompilation=false`; patch the scratch copy's `MYPSDb` to `localhost/myps_db_dpwh_2025` (never the repo file — the committed line is the shared server); `cd FE && npx tsc --noEmit`.
2. Scripts: dry-run both splices as `SELECT`s (anchor count = 1; patched header starts with `CREATE OR ALTER PROCEDURE`) on `myps_db_dev`, `myps_db_dpwh`, `myps_db_dpwh_2025`; then apply both to `myps_db_dpwh_2025` and `myps_db_dev` with `sqlcmd -I -i`; confirm both backup objects exist and `sys.sql_modules` shows both guards; re-run each script and confirm the no-op path prints.
3. Integration tests: build to `MYPS.ApiIntegrationTests/bin/review-out` (repo-internal so `ReadSourceFile` resolves); expect 47 + new facts green. Revert one guard site in a working copy → exactly one fact red → restore.
4. SP proof (AC6): on `myps_db_dpwh_2025`, inside `BEGIN TRAN … ROLLBACK`, `EXEC dbo.pAllowProjectPublishing` with a published, currently-restricted project that passes validation (or the e2e fixture); assert `ProjectsUpdated = 0` and the flag unchanged.
5. e2e: start the API on 5015, prove `sys.dm_exec_sessions.host_process_id` = API pid is on `myps_db_dpwh_2025`, confirm Vite 8080 proxies to it, then `npx playwright test batch-restrict-allow-publish-skips-published program-detail-batch-actions --workers=1`: expect 3/3 + 3/3 with the new SP test *running*, not skipping. Then the full suite; expect the known database-floor failures only.
6. DB hygiene: before/after snapshot of `tProjectRevisions WHERE IsDeleted = 1`; `COUNT(*) … Description NOT LIKE '%(e2e %'` = 0; no `e2e-publishguard-%` program left in `tProgramRevisions`.
7. Commit per task boundary (write-up; N2+R4 scripts; N3; N1; R5+e2e; docs).

## Risks / Open Questions / Assumptions
- **Assumption:** R4 is a separate script, not folded into the 2026-10-05 one (separate backup object and rollback point).
- **Assumption:** N3's race-skipped IDs are reported under `SkippedAlreadyPublishedProjectIds` rather than a new field — same meaning (published, therefore skipped), and the FE type already carries it.
- **Verified:** `usePagination.fetchData` is async and swallows its own errors (`try/catch/finally`, console.error), so a returned promise never rejects — hence the `boolean` result rather than rethrowing, which would create unhandled rejections at the 23 call sites that ignore the return value.
- **Risk:** `pAllowProjectPublishing`'s body is not in the repo; the script is its first versioned copy. Byte-identical on all four localhost DBs today; on any other DB the anchor-count guard refuses to patch rather than guessing.
- **Risk:** the SP-level e2e depends on the BP fixture passing the seven GAA-R rules so the SP would otherwise grant; the twin-grant precondition turns an unprovable data state into a skip, not a false pass. If it always skips on `dpwh_2025`, AC6 is still covered by the manual `BEGIN TRAN` proof in Verification 4.
- **Risk:** `ExtractStatement` is a text heuristic; moving a guard into a helper would need the anchor updated. Each fact names its anchor.
- Out of scope (stay in the risk table): R1 (rotate the password — operational), R7b (Allow's messages), N5 beyond the marker line, N6, N7, R10.
- Not touched: `pRecomputeProjectPublishable`'s logic (only the script that deploys it), `BatchAllowPublish` C#, `BatchDelete`.
