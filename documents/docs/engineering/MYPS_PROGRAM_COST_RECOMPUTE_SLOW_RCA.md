# Slow program cost recompute: root cause and fix

**Date:** 2026-09-18 · **Branch:** `fix/program-cost-recompute-perf` · **Plan:** `documents/plans/program-cost-recompute-slow-rca.md`
**Status:** fixed on localhost `myps_db_dev_200`. The shared server (`192.168.50.200`) was not touched and still runs its own funding-based definition.

## Symptom

Every Lump Sum write (Create, Update and Replenish) runs `dbo.pRecomputeProgramCost` inside its transaction, while it holds the parent's application lock. On the largest Lump Sum program the call took about 3.2 seconds. The three calls in `LumpsumController.Writes.cs` had been commented out as a stopgap, which left Program Details showing a stale cost after any Lump Sum change.

The Lump Sum call sites are not the multiplier. Each request makes one call. The two programs that hold Lump Sum projects on `myps_db_dev_200` are also the two largest programs on it, about 17,500 projects each, and the procedure's cost grew with program size. `UpdateLumpSum` also recomputed on every save, including saves that changed nothing that counts.

## Which body was slow

Two bodies of the procedure existed on 2026-09-18.

| Body | Where it lived | Read time on `MP_P_CO-PS-635_07212023_081334` |
|---|---|---|
| Funding-based (RISK-108) | `dev-trunk`, section 11 of `Migration.SchemaAndProgrammability.2026-09-10.sql` | 172 ms |
| Per-year rule, deployed 2026-09-15 | Live on localhost `myps_db_dev_200`; in git only on the unmerged `fix/program-details-cost-computation` | **3,157 ms** (2,609 ms CPU) |

The slow body is the live one. The program has 7,254 projects at its current stage, 14,662 live components and 146,620 per-year rows.

## The cause

Measured with `SET STATISTICS IO` and `SHOWPLAN_ALL` on the live body:

| Table | Logical reads | Why |
|---|---|---|
| `tProjects` | **992,166** | The `EXISTS (SELECT 1 FROM counted …)` inside the per-year aggregate was rewritten into a join. Its `tProjects` seek plus key lookup for `ParentProjectId` ran once per **per-year row**, not once per project. |
| `tProjectComponentCostPerYear` | 499,150 (scan count 14,662) | A seek on `IX_tProjectComponentCostPerYear_Cost`, then a key lookup per row for `Year`, `Amount` and `IsDeleted`. No index covered them. |
| `tProjectStages` | 30,267 (scan count 3) | The `counted` CTE was expanded **three times**, once per reference. Each expansion was a full clustered scan of 258,561 rows, because no index started with `(ProgramFK, StageId)`. |
| `tProjectComponentCost` | 35,756 (scan count 2) | Two full scans. `IX_tProjectComponentCost_Live` does not include `Total`. |

Contributing conditions:

- **Low estimates.** The optimizer estimated 1,632 stage rows against 7,254 actual, and 56 components against 14,662. A plan cached for a small program would have been reused for the large one.
- **Wasted work.** The per-year aggregate was computed for Lump Sum parents too, then thrown away, because a parent's figure comes from its component Total.
- **Misleading benchmarks.** `sqlcmd` runs with `QUOTED_IDENTIFIER OFF` unless given `-I`. With it off, SQL Server will not use a filtered index, so a benchmark run that way sees full scans the application never sees. Every figure below was taken with the application's settings.

## A rule defect found alongside

The live body counted a Lump Sum parent only when the parent's own `tProjectStages` row matched the program's current stage. Parents are created at GAA-R and stay there while their programs move on.

| | Count on `myps_db_dev_200` |
|---|---|
| Lump Sum parents | 123 |
| Parents at their program's current stage | 37 |
| Parents that contributed nothing | **86** |

On the largest program this left out ₱9,255,367,949.41, the Total of its 34 parents.

## The rule, as decided on 2026-09-18

- **Ordinary project.** Unchanged. It counts at the program's current stage, on its latest revision there. One distinct Year of per-year rows counts whatever the year is. Several count only the program year.
- **Lump Sum parent.** It counts only the Total of its live `'LS'` component on its latest live revision, at any stage. Its per-year row holds the remaining balance after itemization and is never read.
- **Itemized child.** It never counts. Its money was drawn out of the parent's appropriation, which is already counted whole.

`dbo.fProgramStages`, the program list's copy of the rule, carries the same rule.

## The fix

- **Procedure.** The ordinary projects are put into a keyed table variable once. The per-year rule runs over that set only. Both size-dependent statements use `OPTION (RECOMPILE)`, so no program reuses another program's plan. The Lump Sum parents are read from `tProjects` with a `TOP 1` latest-revision lookup per parent, the same shape `vLumpSumSet` uses.
- **Function.** The same rule, set-based. The Lump Sum part is uncorrelated with the stage row, so it is computed once per call.
- **Indexes.** Three new indexes, in section 6b of the migration source:
  - `IX_tProjectStages_ProgramFK_StageId` on `(ProgramFK, StageId)`, including `ProjectFK` and `RevisionId`.
  - `IX_tProjectComponentCost_Revision_Live`, filtered on `IsDeleted = 0`, including `Total` and `ComponentId`.
  - `IX_tProjectComponentCostPerYear_Cost_Live`, filtered on `IsDeleted = 0`, including `Year` and `Amount`.
- **Application.** One helper, `Helpers/ProgramCostRecompute.cs`, replaces the five inlined calls. The three Lump Sum calls are live again. `UpdateLumpSum` recomputes only when the parent's LS component Total changed.

## Measurements

`pRecomputeProgramCost` on `MP_P_CO-PS-635_07212023_081334`, warm cache:

| | Before | After |
|---|---|---|
| Elapsed, whole call | 3,157 ms (read only) | 310–330 ms |
| `tProjects` reads | 992,166 | 3,325 |
| `tProjectComponentCostPerYear` reads | 499,150 | 47,300 |
| `tProjectStages` reads (scans) | 30,267 (3) | 157 (1) |
| `tProjectComponentCost` reads | 35,756 | 1,771 |
| Small program run first, then this one | not measured | 311–330 ms |
| `NewCost` | 289,327,226,000.00 | 298,582,593,949.41 |

The new `NewCost` is the old figure plus exactly the 34 parents' Totals. The ordinary part is unchanged.

`fProgramStages` on the same program, with application settings:

| | Old live function | New function |
|---|---|---|
| One stage (`ProgramHelper` path) | 790–860 ms | 580–730 ms |
| All five stages (`ProgramController` path) | 7,400–7,600 ms | 1,100–4,900 ms |

The all-stages read still spills a hash join to disk on a cold plan. It is faster than before but remains a follow-up.

## Verification

- `MYPS.DatabaseTests` passes 30 of 30 against localhost. The program cost tests now load both objects from the migration source, not from a copy, and assert every figure through both the stored Cost and the list function.
- The procedure was run for every program on `myps_db_dev_200`, each inside a transaction that was rolled back. It agrees with the list function on 72 of 73 programs. The 73rd, `MP_P_CO-PS-634_02272023_143836`, raises the known `decimal(18,5)` overflow, as it did before this change. No stored cost changed.
- The two rollback scripts, run inside a transaction on `myps_db_dev_200`, restored the exact prior definitions by checksum. The transaction was then rolled back.
- The deploy script and both rollback scripts refuse `tempdb`. They end the connection with a severity 20 error.
- No latest-live parent revision on `myps_db_dev_200` has more than one live `'LS'` component, or none. The `ComponentId` column agrees with the component-type name lookup on all 123 parents.

Not yet done: the manual UI check (Replenish, then Program Details) and the optional backfill of stored costs.

## Production steps

- The indexes are additive and safe on any server. `tProjectComponentCostPerYear` has about 5.6 million rows, so its index takes on the order of a minute to build.
- The procedure and function must move together. On the shared server they replace a funding-based body. `fix/program-details-cost-computation` carries `Migration.ProgramCostPerYearRule.Shared200.2026-09-15.sql`; if that is ever deployed, re-cut it from the new section 11 first.
- Never run `Migration.ProgramCostLSParentAnyStage.Dev200.2026-09-18.sql` on the shared server. Its guard refuses every database except `myps_db_dev_200`.
- Program Details reads the stored cost, which moves to the new rule only when a write recomputes that program. Section 5 of the deploy script backfills every program when `@RunBackfill` is set to 1. It reports and skips the program group that overflows `decimal(18,5)`.

## Follow-ups

- `fix/program-details-cost-computation` will conflict with this branch in section 11, `RecomputeProgramCostTests.cs` and `LocalDbSafety.cs`. Take this branch's versions.
- Ordinary projects still read base tables, so an approved Formal Revision does not change program cost, and soft-deleted revisions still count. Both are tracked in `documents/plans/program-cost-review-remediation.md`.
- `DeleteLumpSum` and `DeleteItemizedProject` never recompute. A deleted parent's allocation stays in the stored cost until the next write to that program.
- `IX_tProjectComponentCost_Live` and `IX_tProjectComponentCostPerYear_Live` may now be redundant. Check `sys.dm_db_index_usage_stats` before dropping either.
- The all-stages `fProgramStages` read still takes seconds on the largest programs.
