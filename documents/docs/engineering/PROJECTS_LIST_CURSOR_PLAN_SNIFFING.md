# Projects list: "Next" timing out from a poisoned cursor plan

Date: 2026-10-18 · Branch: `fix/projects-list-cursor-plan-sniffing` (from `main`) · Plan:
`documents/plans/projects-list-cursor-plan-sniffing.md`

## Symptom

On the Projects list, page 1 loads, but **Next** (and "go to page n") answers after 90 s with
`400 Pagination error — Execution Timeout Expired`. It happens for every user whose list is unfiltered (AUC, Admin
and other unrestricted groups), and it keeps happening until SQL Server drops the cached plan.

## Cause: parameter sniffing on the cursor

`FilterDataCursor` (`Helpers/CursorPagination.cs`) fetches Next / Previous / Page n with one parameterised statement
per shape. The Next shape is:

```sql
SELECT TOP (@__take) v.* FROM [vProjectLatest] AS v WHERE v.[Id] < @__cursor ORDER BY v.[Id] DESC
```

- **One plan per shape.** SQL Server compiles one plan for each shape, for the **first** `@__cursor` value it sees,
  and reuses it for everyone.
- **What poisons it.** A cursor that matches about one row, for example `NextFilteredId = 0` or a page near the
  oldest projects, produces an all-nested-loops plan. Every later Next with a typical cursor (most of 172k rows)
  reuses that plan and runs past the 90 s timeout.
- **Why it is hard to see.** The request that poisons the plan only gets a harmless-looking "cursor may be stale"
  400. Timed-out runs aren't recorded in `sys.dm_exec_query_stats`, so the cache shows just the one fast run.

## Evidence (localhost `myps_db_migrated_uat`, about 172k projects)

| Check | Result |
|---|---|
| App's cached Next plan | Compiled for `@__cursor = 0`; operators estimated at ~1 row; 1 recorded run at 16 ms |
| `main` built and run | Next and Page took ~91 s (timeout) for e2eauc (AUC) and longboanak (Admin). The SQL text is identical to what the feature branches send |
| Same SQL in sqlcmd, freshly compiled for the real cursor | 1.2 s (`v.Id` only) / 2.6 s (`v.*`) |
| Plan evicted, real cursors | Next / Previous / Page: 200 in 1.9–5.4 s |
| Plan evicted, then one cursor-0 Next | The next real Next for e2eauc **and** longboanak timed out at 91.3 s |

## Fix

`FilterDataCursor` has a new optional parameter, `recompileCursorQueries`, default `false`.
- When it is `true`, the cursor fetches (Next / Previous / Page n; anything with `@__cursor`) get `OPTION
  (RECOMPILE)`, so each one is compiled for its own cursor value and nothing poisoned can be reused.
- First, Last and the count query are unchanged.
- `ProjectController.ShowProjects` and `ProgramController.ShowProjectsInProgram` (`fProgramProjects`, the heavy
  per-program source) opt in. Every other list keeps its current behaviour.

Two guards around it, for every caller of `FilterDataCursor`:
- **A cursor of 0 or less is treated as missing.** `NextFilteredId` / `PreviousFilteredId` / `PageCursorId` <= 0 is
  rejected with the usual "… is required …" 400 before any SQL runs, so it can't compile a plan. Keys are positive
  identities, so a 0 only ever meant "not set": the FE used to send `?? 0` (Program details projects tab, component
  targets panel) and now sends `null`.
- **A command timeout is no longer swallowed.** `SqlException` -2 is rethrown, so the controller's exception handler
  logs it at `fail` with an ErrorId, `SqlErrorNumber: -2` and the method name. Before, it became a plain
  "Pagination error" 400 that was never logged. The client still gets a 400 (`SqlServerFailure`, with the ErrorId):
  the handler maps every error to 400 by design.

| After the fix | Result |
|---|---|
| A cursor-0 Next, then a real Next | 5.8 s (e2eauc), 6.9 s (Admin), both 200. Before: 91 s timeout |
| All navigations | 1.7–5.3 s, the same as page 1; the per-call compile cost isn't measurable at this size |
| Plan cache | No cursor plan is cached for the shape any more |

## Not changed (measured, not poisoned)

| List | First | Next |
|---|---|---|
| Program list (`ShowProgram`, `vProgramLatest`) | 0.18 s | 0.04 s |
| Program details projects tab (`ShowProjectsInProgram`, largest program) | 1.86 s | 3.29 s |

Both use the same paging code and could be poisoned the same way. The Program details tab was opted in on review
(it is a heavy TVF); the Program list is fast and small, so it stays as is. Any other list that shows it needs only
`recompileCursorQueries: true`.

## How to check for it

Run this as an administrator on the affected database. `set_options = 251` is the app's connection settings.

```sql
SET QUOTED_IDENTIFIER ON;
WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
SELECT qs.creation_time, qs.execution_count, qs.max_elapsed_time / 1000 AS max_ms,
       qp.query_plan.value('(//ParameterList/ColumnReference[@Column="@__cursor"]/@ParameterCompiledValue)[1]', 'varchar(30)') AS compiled_cursor,
       st.text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE st.text LIKE '%FROM \[vProjectLatest\] AS v%@\_\_cursor%' ESCAPE '\';
```

- **Signs of poisoning:** a compiled cursor of `(0)` or another very small id, plus users reporting Next timeouts.
- **Short-term relief,** without the fix: `DBCC FREEPROCCACHE (<that plan_handle>)`. This lasts only until the next
  unusual cursor arrives.
- **With the fix,** no plan for this shape stays cached.

## Regression test

`e2e/tests/project-list-cursor-paging.spec.ts`, API level:

- **Always, as `E2E_USERNAME` and e2eauc** (skipped if the account doesn't exist): a cursor of 0 is rejected for
  Next, Previous and Page. Then First → Next → Next → Previous → Page are all 200, each under max(1.5 × the first
  page, 10 s), and the pages are consistent. Skipped below 31 visible rows.
- **Opt-in, the poisoned plan itself** (`E2E_ALLOW_PLAN_EVICTION=1` plus `E2E_SQL_SERVER` / `E2E_SQL_DB` /
  `E2E_SQL_USER` / `E2E_SQL_PASSWORD`, needs VIEW and ALTER SERVER STATE): it evicts the app's cursor plans, then
  injects the cursor-0 Next plan with sqlcmd under the app's set_options (251) and checks that it is cached. A real
  Next must then be 200 and fast, and the injected plan must be the only one cached. The plans are evicted again at
  the end.
  - The poison is injected because the API can no longer send cursor 0. A tiny *real* cursor (the oldest Id + 1) was
    tried and did not reproduce the bad plan (8.6 s, no timeout).
  - Negative control: with `recompileCursorQueries: false` this case fails with a 91.3 s timeout; with the fix it
    passes.
