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
- Only `ProjectController.ShowProjects` opts in. Every other list keeps its current behaviour.

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

Both use the same paging code and could be poisoned the same way. If they ever show it, the fix is a one-line opt-in:
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

`e2e/tests/project-list-cursor-paging.spec.ts` runs a cursor-0 Next first, then First → Next → Next → Previous →
Page. Every call must be 200 and under 30 s, and the pages must be consistent.
