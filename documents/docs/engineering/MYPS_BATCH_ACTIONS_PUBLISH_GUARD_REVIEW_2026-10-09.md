# Batch Actions publish guard — code review and risk analysis (2026-10-09)

**Branch:** `fix/batch-actions-page-position-and-publish-guard-v2.0.2` at `3b7f6e48` (matches `origin`)
**Base:** `76d67979` — `myps-v2.0.2-2026-0921-0832-program-cost-compute-performance` after PR #243
**Scope reviewed:** `76d67979..3b7f6e48` (7 commits; the newest, `3b7f6e48`, is the subject of this pass)
**Build / tests:** API builds clean; `MYPS.ApiIntegrationTests` 47 / 47 pass. No e2e run and no code changed in this pass.

This supersedes the 2026-10-06 write-up, which described an older base.

## 1. What `3b7f6e48` resolved from the previous pass

| Previous item | Status now |
|---|---|
| R3 — Restrict's `ExecuteUpdateAsync` lacked `!x.IsPublished` | **Fixed** — predicate added; the guard is now atomic at the write |
| R6 — Restrict answered 400 "Projects Not Found" when every match was already published | **Fixed** — 200 "No Changes Required", mirroring Allow |
| R7 — skip invisible to the user | **Half fixed** — `BatchActionResponse` gains `SkippedAlreadyPublishedProjectIds`; Restrict's partial message lists the skipped IDs. Allow's messages are unchanged (finding 1) |
| R9 — SQL script's rollback "backup" was a hard-coded body | **Fixed** — the script now snapshots the live `OBJECT_DEFINITION` and patches it in place (but see finding 4) |
| Batch Restore's catch block toasted on every error | **Fixed** — gated on `!error.Message` |
| Spec: silent no-op UPDATEs, `ProjectPK ?? ProjectId` fallback, revert failure skipping cleanup | **Fixed** — `updateOneProject` throws on 0 rows; hard `expect` on PK; revert error deferred until after `DeleteProgram` |

## 2. Code review findings

All findings were verified against the source. The SQL splice was dry-run as string operations only; nothing was executed and no database was changed.

| # | Severity | Finding | Where |
|---|---|---|---|
| 1 | Should fix | `BatchAllowPublish` never says what it skipped. The success and partial messages omit `SkippedAlreadyPublishedProjectIds`; the one "already published" wording is chosen only when no already-allowed project is present, so a mixed batch reports "all matching projects are already allowed". Restrict now lists skipped IDs, so the two siblings report the same situation differently, and the FE toasts only `Message`. | `ProgramController.cs` ~1963, 2185, 2221, 2256 |
| 2 | **Regression** | `onLoadingChange(false)` was moved out of `finally`. Anything that throws inside the catch handler (e.g. `showToast` while the page is swapped for its skeleton — exactly what `onLoadingChange(true)` does) escapes `handleBatchTagSubmit`, and `isLoading` stays `true` until reload. The previous `finally` guaranteed the reset. | `BatchActionsDropdown.tsx` ~84 |
| 3 | Should fix | The new "action completed, but the page failed to refresh" warning is unreachable. `refreshProjects()` calls `pagination.refresh()` / `applyFilters()`, which return `void`, and `fetchProgramDetail` catches internally (~line 204) and never rethrows. A failed reload after a successful batch is still silent; the comment "so a failed header refetch can't leave it stale" describes a throw that never happens. | `BatchActionsDropdown.tsx` ~79; `ProgramDetail.tsx` ~204, ~695 |
| 4 | **Regression** | The script turns `CREATE` into `ALTER` by `STUFF`ing the last `CREATE` before the procedure name. On all three localhost DBs the live header is `CREATE   PROCEDURE`, so this yields `ALTER   PROCEDURE` correctly. A body deployed with `CREATE OR ALTER` yields `ALTER OR ALTER PROCEDURE` — a syntax error raised **after** the backup object has been created, leaving a backup present and the live body unpatched. | `ProjectPublishable.AlreadyPublishedGuard.2026-10-05.sql` ~101 |
| 5 | Should fix | Restrict's race case lands in the wrong branch. The new predicate makes "published between the read and the write" possible, and it falls into the pre-existing `updatedCount == 0` → 400 "No Projects Updated" with no skipped/missing arrays, contradicting the 200 "No Changes Required" two branches up. The new comment "updatedCount only counts rows actually changed" is also wrong: `ExecuteUpdateAsync` returns rows *matched*, so restricting an already-restricted project still reports "1 project(s) were excluded". | `ProgramController.cs` ~1646-1664 |
| 6 | Should fix | Spec cleanup is `afterAll` only, and its fixtures carry no sweeper marker. `e2e/CLAUDE.md` is explicit that `afterAll` is not enough (a cold-API timeout abandons the file first). A run aborted after `beforeAll` strands a program `e2e-publishguard-<ms>` holding a project hand-flipped to `IsPublished = 1`; the sweeper matches `(e2e <ISO>)` in `Description` and will never see it. | `batch-restrict-allow-publish-skips-published.spec.ts` ~202 |
| 7 | Minor | `ShowProjectsInProgram` is called with `programId` where the endpoint wants `ProgramPK`. It works only because `AddProgram` writes `ProgramPK = ProgramId = NewProgramUniqueId` (`ProgramController.cs` ~283-296); the correct `programPK` is computed on line 129 and never read. Same wrong-key class the cross-stage spec already paid for. | spec ~129, ~167 |
| 8 | Open (R4) | `pAllowProjectPublishing` still has no SQL-level `IsPublished` guard (live body, checksum `-292144318`, no `IsPublished` anywhere). Only Allow's C# pre-filter protects it; SSMS, scripts and future callers are exposed. | live SP; `ProgramController.cs` ~1918-1925 |
| 9 | Open (R5) | Contract tests unchanged: `Assert.Contains("!x.IsPublished", method)` is satisfied by any one of Allow's three guard sites, or by the text in a comment. | `ProgramControllerPublishRestrictionContractTests.cs` ~54, ~83 |
| 10 | Minor | Fixture code duplicated in the spec: `withoutBlanks` (exported from `approvedProgramFixture.ts:84`), the donor lookup, the `AddProgram` payload and the 25-field `AddProject` payload are copied from `crossStageFixture.ts:87-144`. The copied donor filter (`length > 0`) is already weaker than the helper's (`withoutBlanks(...).length > 0`). | spec ~100-160 |
| 11 | Open (R8) | The smoke check still `EXEC`s the full recompute on an unordered `TOP 1` program inside a transaction. The `sys.sql_modules` text check above it already proves the guard is live. | same script, section 2 |
| 12 | **Blocker (R1)** | `***REMOVED***` remains in `9f5e538d` on this branch and in `cb605717` / `3b7f6e48` on `origin`. Removing it from the files did not remove it from history. | git history |

## 3. Risk table

| # | Risk | Severity | Likelihood | Status / recommended action |
|---|---|---|---|---|
| R1 | Shared-server `sa` password in git history, already on `origin` | **High — merge blocker** | Certain | Open — rotate the 192.168.50.200 `sa` password |
| N1 | `isLoading` stuck on the skeleton if the catch path throws (finding 2) | Medium | Low–medium | Open — wrap the whole handler in `try/finally` with the nested refresh `try` inside |
| N2 | Deploy script leaves backup created and live body unpatched on a `CREATE OR ALTER` header (finding 4) | Medium | Low today (all localhost DBs are `CREATE PROCEDURE`); real on any hot-fixed DB | Open — normalise the header to `CREATE OR ALTER` instead of splicing `CREATE` |
| R4 | `pAllowProjectPublishing` re-grants `IsPublishable` on a published project for any non-app caller (finding 8) | Medium | Low via the app, real via SSMS or scripts | Open — `AND ISNULL(p.IsPublished, 0) = 0` on the SP's step-9 UPDATE |
| R5 | Removal of a guard site goes undetected by the contract tests (finding 9) | Medium | Medium | Open — one assertion per guard site on comment-stripped source |
| N3 | Restrict race → 400 "No Projects Updated"; `UpdatedCount` over-reports (finding 5) | Low | Low | Open — route the 0-row case to the 200 skip branch; correct the comment |
| N4 | Refresh-failure warning never fires; stale table after a failed reload (finding 3) | Low | Low | Open — have the pagination hook report success/failure so `refreshProjects` can be awaited meaningfully, or remove the dead path and its comment |
| R7b | Allow's toast hides skips; a mixed batch reports "all already allowed" (finding 1) | Low | Certain for mixed batches | Open |
| N5 | Stranded `e2e-publishguard-*` program with a hand-published project after an aborted run (finding 6) | Low | Medium | Open — write the `(e2e <ISO>)` marker and register the program with the sweeper |
| N6 | Spec breaks the moment the fixture is advanced past BP or `AddProgram` stops aliasing `ProgramPK = ProgramId` (finding 7) | Low | Low | Open — pass `programPK` |
| R8 | Smoke-check `EXEC` holds locks on an arbitrary program (finding 11) | Low | Low | Open |
| R10 | Tracked, gitignored Playwright output churns on every run | Low | Certain | Open |
| N7 | Duplicated fixture payloads drift (finding 10) | Low | Medium over time | Open — reuse the `crossStageFixture` helpers |

**Closed since the previous pass:** R3, R6, R9, R7 (Restrict half), the ungated Batch Restore toast, and the spec's silent-UPDATE / PK-fallback / revert issues.

## 4. Verdict

Merge is blocked only by R1 (password rotation). `3b7f6e48` genuinely improved the controller, the deploy script and the spec, but it introduced two regressions worth fixing before merge — N1 (`finally` removed) and N2 (`CREATE`→`ALTER` splice) — and R4 / R5 remain open. The pre-merge fix set (R4, R5, N1, N2, N3) is planned in `documents/plans/publish-guard-premerge-fixes.md`.

## 5. How this was verified

- `git diff 76d67979..3b7f6e48` read in full; each finding checked against the current source.
- `dotnet build Main/Main.csproj` → 0 errors; `dotnet test MYPS.ApiIntegrationTests` → 47 / 47.
- SQL splice dry-run: the script's `CHARINDEX` / `STUFF` logic was evaluated on `localhost/myps_db_dpwh_2025` as `SELECT`s over `OBJECT_DEFINITION` only, plus the same logic over a literal `CREATE OR ALTER` header. Nothing was executed and no database was changed.
- Live SP headers checked on `myps_db_dev`, `myps_db_dpwh`, `myps_db_dpwh_2025`: all `CREATE   PROCEDURE`; the recompute guard is not yet applied on any of them.
- `usePagination.fetchData` confirmed to catch and log its own errors (so a returned promise would never reject); `pagination.refresh()` / `applyFilters()` have 23 call sites, all ignoring the return value.
