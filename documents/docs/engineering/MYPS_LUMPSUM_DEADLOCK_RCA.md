# The Lump Sum deadlock — root cause and fix

**Date:** 2026-09-06 · **Branch:** `feat/lumpsum-v3` · **Plan:** `documents/plans/lump-sum-deadlock.md`
**Status:** fixed on `localhost` (`myps_db_dev`); the isolation setting is recorded below as a
production step for the DBA.

## Symptom

Intermittent SQL Server error 1205 — *"Transaction was deadlocked on lock resources with another
process and has been chosen as the deadlock victim"* — on Lump Sum requests, surfacing as a 500 to
the page. In the fourteen scratch API logs kept from 2026-09-06 it appears in six runs (03:28, two
around 07:xx, 09:xx, 10:xx, 11:13, 12:16). **The victim was always a read**: EF's
`Query[10100]` event, iterating a `SELECT` over `vLumpSumSet`. A writer was never the victim.

The first occurrence (03:28) predates the application lock (commit `6caf1d00`, 07:21) and the
allocation-model change (`ab9397c4`, 11:26), so neither introduced it. `e2e/CLAUDE.md` already
pinned the Playwright workers to 1 because concurrent specs deadlocked on `UpdateProjectDetails`:
the same class, seen earlier in another module.

## The cycle

From the `system_health` deadlock graph captured at 11:13:45 local (03:13:45Z):

| | Reader — the victim | Writer |
|---|---|---|
| Statement | `SELECT TOP(1) … FROM vLumpSumSet WHERE Id = @id` — `LumpSumDetails`, autocommit, a **parallel plan** (spid 70: coordinator ecid 0 and worker ecid 19) | `DELETE FROM tProjectRevisions … WHERE Id = @p0` — the hard-delete path of `DeleteLumpSum` / `DeleteItemizedProject`, in a user transaction **open since 11:13:39.380**, six seconds |
| Holds | **S key lock on `PK_tProjectRevisions`** — a revision row of the project being deleted, held by the coordinator while the pipeline was stalled behind the worker | **IX page lock on `tProjectStages`** — it had just deleted the project's stage rows |
| Waits for | **S page lock on that `tProjectStages` page** (the worker) | **X convert on that revision key** |

Two lock orders, inverted. The view walks **revisions → costs / per-year → stages**. The hard delete
removes **per-year → costs → notes → funding + stages → revisions → project** — the foreign keys
force children first — in six `SaveChanges` round trips inside one transaction. Under locking
`READ COMMITTED` the reader takes shared locks as it goes, so the two can form a cycle, and SQL
Server kills the cheaper party: the read.

## Why a read of one project collided with the deletion of a different one

`vLumpSumSet` resolved each project's latest revision with
`ROW_NUMBER() OVER (PARTITION BY ProjectFK ORDER BY Id DESC)` in a CTE, `GROUP BY`'d the costs of
**every** project (`ProjectCost`), and evaluated that twice — once for the parents and once inside
the `kids` apply. SQL Server cannot push `WHERE Id = @id` through a window function, so reading a
single row cost a scan of the whole revisions table, with locks taken on every other project's
rows along the way, including the rows of the project another session was deleting.

Measured with `SET STATISTICS IO` on `localhost` (`tProjectRevisions`: 128,751 rows, 16,156 pages;
`tProjectStages`: 128,751 rows, 8,908 pages; `tProjects`: 56,397 rows):

| Read | `tProjectRevisions` | `tProjectComponentCost` | `tProjectStages` | `tProjects` |
|---|---|---|---|---|
| Detail, all columns as EF issues it — **before** | **14 scans, 15,126 reads** | 48 | 4 | 20 |
| Detail, all columns — **after** | **6 seeks, 36 reads** | 48 | 2 | 20 |
| List, unfiltered (`ShowLumpSum`) — before | 24 scans, 3,206 | 5,732 | — | — |
| List, unfiltered — after | 198 | 198 | — | 4 |
| One parent's children (`vLumpSumChildSet`) — before | 24 scans, 3,140 | — | — | 10 |
| One parent's children — after | 36 | — | — | 24 |
| `fProgramStages` for one program, Lump Sum share — before | 3,666 | 5,732 | | |
| `fProgramStages` — after | 138 | 138 | | |

Two indexes were missing for the seeks: `tProjectStages(RevisionId)` — the `TOP 1 … ORDER BY Id
DESC` stage lookup was a scan, which is exactly the page lock in the graph — and
`tProjects(ProjectType, ParentProjectId)`. Every parent in the view has `ProjectType = 'LS'` and no
`ParentProjectId` (33 of 33); both writers of a parent (`CreateLumpSum`, the itemization import)
write `'LS'`; the 74 children also carry `'LS'` but have a parent.

## Contributing conditions

- `myps_db_dev` ran with `READ_COMMITTED_SNAPSHOT` **off** and `ALLOW_SNAPSHOT_ISOLATION` off, so
  every read took shared locks. `MAXDOP` 11 and a cost threshold of 5 let the wide read go
  parallel, so a single statement held a key lock on one thread while another thread waited on a
  page.
- The hard delete held its transaction across the applock wait (up to 5 s) and six round trips.
- `MYPSDbContext` sets a 30-minute command timeout and the API's options 90 s, so a *blocked*
  read looked like a hung request rather than an error.

## What this RCA does not explain

Two walkthrough failures at 13:3x and a contract-suite POST timeout at 19:0x that day have **no
server-side signature**: those logs hold no 1205, no exception, and no command over 3 s. Their
screenshots were purged by a later passing run, and the Vite log shows full page reloads at
13:33:09 and 13:33:15 triggered by documentation edits made while a run was in flight. They are
attributed to the scratch environment, not to this defect. The deadlock is proven independently by
the graph and the six logged victims; the fix is verified by its own race test.

## The fix — two layers, and one removed

1. **Per-project views** (`LumpSum.Baseline.sql` §6a, §7, §8). `vLumpSumSet` and
   `vLumpSumChildSet` resolve the latest revision with `CROSS APPLY (SELECT TOP 1 … WHERE
   ProjectFK = p.ProjectPK ORDER BY Id DESC)` and every figure with a correlated aggregate against
   that project's keys. The parents are driven from `tProjects` by `ProjectType = N'LS' AND
   ParentProjectId IS NULL`; membership is still `HasLSComponent = 1`. Two new indexes:
   `IX_tProjectStages_RevisionId (RevisionId, Id) INCLUDE (StageName)` and
   `IX_tProjects_ProjectType (ProjectType, ParentProjectId) INCLUDE (ProjectPK, ProgramFK,
   ProgramId)`. The column set is unchanged; a row dump of all three views before and after the
   change was byte-identical (33 / 74 / 33 rows).
2. **`READ_COMMITTED_SNAPSHOT`** (`LumpSum.Isolation.ReadCommittedSnapshot.sql`, run once).
   Readers take no locks and read the last committed version; a reader can no longer be half of a
   deadlock with a writer, in any module. Applied on `localhost` on 2026-09-06.

Layer 1 narrows the cycle to a read of the very project being deleted, at the instant it is
deleted. Layer 2 closes the class. Until production has layer 2, that narrow residual remains:
such a read is chosen as the victim and answers 500 where "not found" would have been the
truthful answer.

**Considered, implemented, and removed the same day — a lock-first delete helper.** The plan's
third layer took `XLOCK, ROWLOCK` on the project, its revisions, component costs, per-year rows
and stages, in the reader's order, before the first `DELETE`, so that the deletes would only
convert locks already held. The code review measured it and it did not do that: a `SELECT` with a
lock hint locks the keys of the index it seeks, and each of the five statements seeked a covering
non-clustered foreign-key index, so the transaction held X on `UQ_tProjects_ProjectPK`,
`IX_tProjectRevisions_ProjectFK`, `IX_tProjectComponentCost_Revision`,
`IX_tProjectComponentCostPerYear_Cost` and `IX_tProjectStages_ProjectFK` — and nothing on
`PK_tProjectRevisions`, the very key in the deadlock graph, nor on `IX_tProjectStages_RevisionId`,
which the rewritten view reads. Selecting a non-covered column forces a key lookup and does lock
the clustered keys, but the ordering problem has no answer: the readers walk project → revisions →
stages, `ProgramController.DeleteProgram` walks stages → revisions → projects, and a helper that
matches one inverts against the other. Against the readers the helper adds nothing once
`READ_COMMITTED_SNAPSHOT` is on, since they hold no locks; against `DeleteProgram` — a writer,
which snapshot isolation does not protect — it would have *introduced* a writer-versus-writer
cycle that did not exist before, because both deletes previously took stages before revisions.
The helper was reverted; the hard deletes are as they were.

## The production step

`READ_COMMITTED_SNAPSHOT` is a database-wide setting on a database shared with the legacy IIS
application, so it is a DBA change in a maintenance window:

```sql
ALTER DATABASE [<MYPS database>] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE name = '<MYPS database>';
```

`WITH ROLLBACK IMMEDIATE` rolls back every open transaction and disconnects every other session;
pooled connections (the API, Hangfire) reconnect on their next use. The cost is tempdb version
store growth under long transactions — the longest here is the itemization import, which spans one
workbook's validation, seconds; monitor `sys.dm_tran_version_store_space_usage`. Nothing in this
repository depends on a read blocking: there is no `TransactionScope`, no `IsolationLevel.*`, no
`NOLOCK`, and the one check-then-act that must serialise (`tProjectIdSequence`) holds
`UPDLOCK, HOLDLOCK`, which hints force regardless of the setting. `ALLOW_SNAPSHOT_ISOLATION`
stays off. Reverting is the same statement with `OFF`. The Baseline's verification block prints a
`WARN` line whenever the setting is off.

## Verification (localhost, 2026-09-06)

- `LumpSum.Baseline.sql` applied: views bind (33 / 74 / 33 rows), both indexes present, DRIFT 0;
  the RCSI line printed `WARN: OFF` until the isolation script ran, then `ON`.
- Row dumps of the three views before and after the rewrite, ordered by key: byte-identical.
- `dotnet build` clean. No frontend change.
- `ls-contract`, `ls-ownership`, `ls-data-security` against a scratch API on 5016: 33 passed, the
  three known honest skips — first with the lock helper in place, then again without it, with the
  same result, which is itself the evidence that under snapshot isolation the helper changed
  nothing a test could see. `ls-module-ui` through Vite on 8080: 12 passed, including the two
  detail-page tests that had failed earlier in the day while servers were being restarted mid-run.
- The race case (forty detail reads and ten list reads of one parent during the hard delete of
  five others): every read 200; slowest read 530 ms in the full run, then 387 / 515 / 467 ms in
  three consecutive solo runs. `grep -c 1205` on the API log for all of it: 0.
- One false start, recorded for honesty: the first scratch build of the evening picked up the
  committed `appsettings.Development.json`, whose `MYPSDb` line is the shared server at
  192.168.50.200, because the maintainer's local override had been reverted at 22:34. That run was
  refused at its first permission check on every spec and wrote nothing there beyond 16
  `tLoginHistory` rows; the API was stopped, the scratch copy pointed back at localhost, and the
  sessions were proven local through `sys.dm_exec_sessions` before anything ran again.

## Same shape elsewhere, out of scope

`vProjectLatest` and seven procedures (`pAllowProjectPublishing`, `pGenerateAIP01`,
`pGenerateAIPComponents`, `pGenerateRBP`, `pGenerateRBPComponents`, `pGenerateRDIP`,
`pRecomputeProjectPublishable`) use the same `ROW_NUMBER` latest-revision pattern over every
revision; `ProgramController.DeleteProgram` deletes stages → revisions → projects in the same
inverted order. Layer 3 removes their deadlock exposure; their scan cost remains. `fProgramStages`
still spends 5,645 reads on `tProjectStages` and 3,202 on `tProjectFundingProfile` for its own
non-Lump-Sum sums (no index on `tProjectStages.ProgramFK`). Separate tickets.
