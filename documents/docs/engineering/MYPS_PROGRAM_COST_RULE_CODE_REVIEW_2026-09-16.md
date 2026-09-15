# Code review: the per-year program cost rule

**Reviewed:** 2026-09-16
**Branch:** `fix/program-details-cost-computation` — commits `b6301021`, `9e1480e2`, `61096b31`,
on top of `9074c83c` (already on `dev-trunk`)
**Objects:** `dbo.fProgramStages`, `dbo.pRecomputeProgramCost`, the shared-server migration
and its backups, the recompute call sites in `ProjectController`, `RevisionController` and
`LumpsumController.Writes`, and `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`
**Remediation plan:** `documents/plans/program-cost-review-remediation.md`

## How this review was done

Two independent passes were merged:

- **Pass A** — this session's review, run through `/code-review` and then re-checked finding by
  finding against localhost `myps_db_dev_200` (read-only SQL) and the branch's tracked files.
- **Pass B** — a separate multi-angle pass recorded in
  `documents/plans/Migration.ProgramCostPerYearRule-review.md` ("pr-211-review"), whose
  checkable claims were re-verified the same way.

Every number below comes from a query run on 2026-09-16. Nothing was written to any database.
The shared server (`192.168.50.200 / myps_db_dev`) was only read.

Where a pass overstated, understated, or got something wrong, that is said here rather than
smoothed over — a review that cannot be trusted on its own claims is not worth merging on.

## What the rule is

A program's cost at a stage is the sum, over the latest revision of each project at that stage,
of:

- the project's `tProjectComponentCostPerYear.Amount` at the **program year**
  (`tPrograms.StartYear`) when it holds several years of rows;
- the amount of its rows **whatever the year**, when it holds one year;
- for a **Lump Sum parent**, its `tProjectComponentCost.Total` instead, with itemized children
  excluded outright.

`fProgramStages` computes it live for the program list; `pRecomputeProgramCost` writes it to
`tProgramRevisions.Cost` for Program Details. They are one rule by two paths.

## Findings at a glance

| # | Finding | Verdict | Severity |
|---|---|---|---|
| 1 | Lump Sum parent appropriation is summed over **all** its components; duplicate rows double it | Confirmed | **High** |
| 2 | Approval-time recompute is a no-op: the rule reads base tables, approval never writes them | Confirmed; consequence of an explicit decision, now reversed | **High** |
| 3 | Soft-deleted project revisions still contribute cost | Confirmed; pre-existing, partially improved | Medium |
| 4 | No backfill: program list and Program Details disagree until each program is next saved | Confirmed by design; now decided: backfill | Medium |
| 5 | One program overflows `decimal(18,5)` under the new rule | Confirmed, intentional abort | Medium |
| 6 | Rollback scripts have no database guard; localhost/shared pairs differ by one token | Confirmed | Medium |
| 7 | Test harness declares `Cost decimal(18,2)`; `fProgramStages` has no tests | Confirmed | Medium |
| 8 | Recompute `EXEC` inlined three times in `LumpsumController.Writes`; `UpdateLumpSum` recomputes unconditionally | Confirmed | Low |
| 9 | The rule is hand-copied five to six times | Confirmed | Low |
| 10 | `@StartYear` has no NULL guard | Not a live risk | Low |
| 11 | Stage filter could zero a Lump Sum parent out of sync with its program's stage | Plausible, unquantified | Low |
| 12 | `LocalDbSafety` env-var override can reach the shared server | **False** | — |
| 13 | `fProgramDetails` unaudited | Confirmed, benign | — |
| 14 | Scope and process framing (PR title vs content; plan written alongside code) | Acknowledged | — |

## The findings

### 1. Lump Sum parents: `SUM(Total)` over every component, and the data has duplicates

`Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` — the
`component_total` CTE in the procedure (~line 962) and the `tot` derived table in the function
(~line 852); the same text in the shared-server script and in the SQL embedded in the test file.

The rule's own comment says a parent contributes "the Total of its **single** 'Lump Sum'
component". The code sums every live component on the revision. That is correct on clean data.
The data is not clean:

| | count |
|---|---|
| Lump Sum parent revisions with exactly one live component | 357 |
| Lump Sum parent revisions with more than one | **71** |
| of those, currently counted in a program's cost | 4 |

Revision 7648 is representative: two rows, both `ComponentType 'LS'`, `ComponentId 'LS'`,
`Description 'Lump Sum'`, Total ₱1,357,891,000, same `CreatedDate` to the second, same
`DataImportProgramId/ProjectId/ComponentId`. Not two components — one component loaded twice.
The four counted parents each report double their appropriation (e.g. ₱6,000,000,000 for
₱3,000,000,000).

**Root cause:** the 2024 import duplication already known from the three-way comparison
(`myps-gis-backend/documents/2026-09-15_program_cost_rca.md`, DOUBLED_LOAD) — reaching the
cost through a second door. The per-year duplication produced the overflow (finding 5); the
component duplication produces this.

**Why it is High and not "just data":** the code's stated contract is one component, and the
implementation does nothing to hold that contract. `vLumpSumSet.OriginalAllocation`, which the
old rule used, filtered to `ComponentType = 'LS'`; the new `component_total` is unfiltered.
No test has two components on a parent, so nothing catches it. Pass B raised the same point
as its item 6; merged here.

### 2. The recompute on revision approval no longer does anything

`WebAPI/Controllers/Revision/RevisionController.cs:2406` fires `pRecomputeProgramCost` when a
Formal Revision is fully approved — commented as the RISK-108 fix. The 2026-09-15 rule reads
`tProjectComponentCost` / `tProjectComponentCostPerYear` directly. Approval writes only the
`tRevisionProject*` shadow tables and never touches base
(`documents/docs/engineering/MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md`, confirmed
on all three fully approved revisions on dev_200). So the call runs, reads unchanged tables, and
writes back the number that was already there.

**Failure scenario:** RO and CO approve a revision raising a project from ₱100M to ₱400M. The
revision shows Approved; Program Details still shows the pre-revision total; nothing signals
that it did not propagate.

**This was decided, not missed.** The 2026-09-15 session chose "base table only" explicitly,
and `documents/plans/program-cost-per-year-rule.md` and the section-11 prose both say so. Pass
B correctly identified the consequence. On 2026-09-16 the maintainer reversed the decision:
**the rule is to become revision-aware.** The remediation plan carries the risks and the
approach.

### 3. Soft-deleted project revisions are counted

`stage_revision` (procedure, ~line 932) and the `sr` derived table (function) pick the latest
`tProjectStages.RevisionId` per project. They filter `IsDeleted` on the component and per-year
tables, never on `tProjectRevisions`.

On dev_200: **5** picked revisions are soft-deleted (Pass A said 6), contributing **₱465,828,000**
across three program groups (`MP_P_CO-PS-634_02272023_144331`, `…_144417`, and a local test
program). Zero cases where a deleted newer revision shadows a live older one — so the exposure is
that ₱465M, not silent drop-outs.

**Pre-existing, and strictly improved by this branch.** The old `fProgramStages` had no
`IsDeleted` filter on revisions either — and no latest-revision pick at all, so it summed every
revision a project ever had at the stage. The new code fixed the second problem and carried the
first forward.

### 4. No backfill, so the two paths disagree after deployment

The program list computes live through `fProgramStages`; Program Details reads the stored
`tProgramRevisions.Cost` through `fProgramDetails` (which selects `pgr.Cost` — that is Pass B's
item 5, and it is benign for exactly this reason). Until something recomputes a program, the
two screens show different rules. On the shared server that is **29 of 41** program groups.

The shared-server runbook says this out loud and calls a backfill "a separate, deliberate
pass". Documented is not decided. **Decision 2026-09-16: the migration gets a backfill section**
that recomputes every group and reports, rather than fails on, the overflowing one.

### 5. One program overflows the column

`MP_P_CO-PS-634_02272023_143836` (RBP FY 2024 NCR) comes to ₱15,839,739,734,800 under the new
rule — twice its stored ₱7,920,049,867,400, from the doubled 2024 per-year rows.
`tProgramRevisions.Cost` is `decimal(18,5)`, ceiling just under ₱10T. Every write that
recomputes that program raises Msg 8115. Same on localhost and on the shared server.

The migration's preflight computes all groups, lists offenders, and **aborts** unless
`@IAcceptOverflowingPrograms = 1`. Widening to `decimal(28,5)` is written but commented. Pass B
lists this as "shipped unresolved"; it is shipped **guarded**, and the resolution is data
work (de-duplication), which this branch does not attempt. The remediation plan scopes the
Lump Sum component de-dup for localhost and leaves the per-year de-dup as a named follow-up.

### 6. Rollback scripts lack a database guard

The forward migration refuses to run outside `myps_db_dev`. The four backup files —
`fProgramStages_backup_shared200_…`, `pRecomputeProgramCost_backup_shared200_…`, and the two
`…_backup_pre_peryear-program-year-rule_20260915.sql` localhost captures — do not. The pairs
differ by one token in the filename and install materially different text: the shared200 pair
carries the RISK-108 fix, the localhost pair predates it. Running the localhost pair on the
shared server silently reverts that fix.

### 7. The tests cannot see the failure the preflight guards against

`MYPS.DatabaseTests/RecomputeProgramCostTests.cs:205` declares `Cost decimal(18,2)`. The real
column is `decimal(18,5)`. That is a *higher* integer ceiling in the harness (16 digits vs 13),
so ₱15.8T fits in the tests and overflows in production. And the twelve tests exercise only the
procedure; `fProgramStages` — the other half of "one rule" — has no test.

### 8. Recompute call sites

`WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs:360, 792, 1066` each inline the same
`FromSqlInterpolated("EXEC dbo.pRecomputeProgramCost …")`. `ProjectController.cs:4392` gates
its call on `HasCostUpdate`; `UpdateLumpSum` recomputes on every save, including detail-only
ones. These came in with `9074c83c` (already on dev-trunk) rather than this branch's three
commits, but they are part of the computation's surface and cheap to fix while it is open.

### 9. The rule exists in five or six places

`fProgramStages`, `pRecomputeProgramCost`, both copied into the shared200 migration, the
migration's preflight CTE, and the SQL embedded in the test file. Drift protection is a prose
comment saying "change together". The shared200 copies are cut mechanically from section 11
(the commit says so), which helps; the preflight and test copies are hand-written.

### 10. `@StartYear` NULL guard — not a live risk

Pass B's item 2. `tPrograms.StartYear` is `NOT NULL` on both databases and holds zero NULLs.
The procedure's `SELECT @StartYear = pg.StartYear` cannot produce NULL unless the program row
is missing, which the preceding revision lookup would already have caught through the FK. A
one-line guard for symmetry with `@CurrentRevisionId` is in the plan because it is free, not
because the failure is reachable.

### 11. A Lump Sum parent out of step with its program's stage

Pass B's item 7: `stage_revision` requires the parent's own `tProjectStages` row at the
program's current stage; the old rule summed `vLumpSumSet` with no stage predicate. By design a
parent follows its program's stage (`lump-sum-parent-boundary`), so this should be empty; the
verification query for it failed on syntax during this review and was not re-run. Carried as a
risk to quantify during remediation, not as a defect.

### 12. `LocalDbSafety` env-var override — false

Pass A's `/code-review` output claimed `MYPS_TEST_SQL_SERVER` lets the suite `CREATE`/`DROP
DATABASE` on any host. There is no such variable in any tracked file on this branch.
`MYPS.DatabaseTests/LocalDbSafety.cs` hardcodes `(localdb)\MSSQLLocalDB` with integrated
security, which cannot reach `192.168.50.200`. (An override existed in a scratch working state
during the 2026-09-15 session and was never committed.) Dropped.

### 13–14. Framing

Pass B's items 8–9 (PR titled as the narrow RISK-108 fix while redefining program cost; the
plan authored in the same session as the code) are fair as process observations. This document
and the remediation plan are the response: the redefinition is now stated as such, and the next
change goes through `/create-plan` → `/implement-task` → `/code-review` in order.

## Decisions taken on 2026-09-16

| Question | Decision |
|---|---|
| Duplicate Lump Sum components | **Both**: the Lump Sum branch reads one `'LS'` component, and a data script soft-deletes the duplicates — **localhost only** |
| Backfill after deployment | **Yes**: the migration recomputes every group; the overflowing group is reported and skipped |
| Base-only vs revision-aware | **Revision-aware**, with the risks and top-of-head optimizations documented; no deep optimization pass |

## Merge recommendation

**Do not merge `fix/program-details-cost-computation` as it stands.** Finding 1 puts a wrong
figure on four programs today and on any program that itemizes a duplicated parent tomorrow;
finding 2 is, by the maintainer's 2026-09-16 decision, the wrong rule.

The rest is not blocking but is cheap and belongs in the same change: findings 3, 6, 7, 8, 10.
Finding 5 stays a guarded abort until the per-year de-dup is done as its own piece of work.

The remediation is planned in `documents/plans/program-cost-review-remediation.md`, to be
implemented on top of the fix branch (or after it lands), not on `dev-trunk`.
