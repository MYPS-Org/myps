# Code review: program cost computation — PR #216 and the per-year rule

**Reviewed:** 2026-09-16
**Objects:** `dbo.pRecomputeProgramCost`, `dbo.fProgramStages`, their migration and backup
scripts, the recompute call sites in `ProjectController`, `RevisionController` and
`LumpsumController.Writes`, and `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`
**Remediation plan:** `documents/plans/program-cost-review-remediation.md`

This document consolidates two reviews written the same day on two consecutive changes to the
same objects. They are kept as two parts because they reviewed different code and reached
different verdicts; a third part says what the sequence means taken together.

| | Part I | Part II |
|---|---|---|
| Change | PR #216 — RISK-108 funding-profile fix | The per-year, program-year rule |
| Commits | `9074c83c` (merged to `dev-trunk` as `49e6d30e`) | `b6301021`, `9e1480e2`, `61096b31` on `fix/program-details-cost-computation` |
| What it did to the rule | Kept the **funding** basis; made it **revision-aware** through `dbo.fProjectFundingProfile` | Replaced funding with **per-year component cost at the program year**; reads **base tables only** |
| Verdict | GO WITH CONDITIONS | Do not merge as it stands |

**The arc, in one sentence:** PR #216 made program cost see approved revisions; the per-year
rule, three commits later, changed what program cost *is* and in doing so stopped it seeing
approved revisions again — a consequence that was decided, then reviewed, then reversed on
2026-09-16.

## How these reviews were done

**Part I** — `/plan-analysis` + `/code-behavior-audit` + `/code-review` on the PR's full diff,
fetched with `git fetch origin pull/216/head:pr-216` and diffed against `origin/dev-trunk`.
(Diffing against `main` first produced a useless 764-file result because `main` and
`dev-trunk` have diverged substantially — noted so nobody repeats it.)

**Part II** — `/code-review` on the fix branch, then every finding re-checked by hand against
localhost `myps_db_dev_200` (read-only SQL) and the branch's tracked files; a separate
multi-angle pass recorded in `documents/plans/Migration.ProgramCostPerYearRule-review.md` was
merged in and its checkable claims re-verified the same way.

Every number in Part II comes from a query run on 2026-09-16. Nothing was written to any
database. The shared server (`192.168.50.200 / myps_db_dev`) was only read. Where a pass
overstated, understated, or was wrong, that is said rather than smoothed over.

---

# Part I — PR #216: the RISK-108 funding-profile fix

**PR:** https://github.com/mf1027/project_myps/pull/216
**Base:** `dev-trunk` @ `377e372f` · **Head:** `9074c83c` (2026-09-15 04:53:58 +0800)
**Status at review:** **GO WITH CONDITIONS** (see I.6)
**Status now:** superseded on the fix branch by Part II's change — see Part III.

## I.1 Summary

This PR fixes a confirmed, real defect (RISK-108): `dbo.pRecomputeProgramCost` summed a
program's project funding from a direct join against the **base** funding table, blind to
funding changes made through an **approved Formal Revision**. A program's Cost on Program
Details could silently stay wrong — reflecting pre-revision numbers — until an unrelated project
edit happened to trigger a recompute.

The fix is small, correctly scoped, and well implemented. The PR also reconciles a test file
that had drifted into testing a **fictional** version of the procedure (wrong error number,
wrong column count) — not part of the requested fix, but a legitimate improvement shipped
alongside it.

One material gap remained open: the fix's correctness rests on `dbo.fProjectFundingProfile`,
which has **no checked-in source in this repository** — a live-database-only object nobody
backed up or re-verified as part of the PR (I.5.1).

## I.2 Scope

`git diff origin/dev-trunk...pr-216 --stat`: 6 files, 1,443 insertions / 29 deletions. Two are
not functional (a regenerated ERD, the author's plan doc). The four that matter:

| File | Change | Why it matters |
|---|---|---|
| `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` (~822–880) | `JOIN dbo.tProjectFundingProfile` → `CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId)` | Root-cause fix for RISK-108 |
| `Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql` (new) | Pre-fix `OBJECT_DEFINITION` capture from `myps_db_dev` | Rollback artifact — confirmed genuine, not narrated |
| `MYPS.DatabaseTests/RecomputeProgramCostTests.cs` | Embedded procedure copy reconciled to the deployed shape; 2 pre-existing test bugs fixed; 1 new Lump Sum test | Turns a fictional test into a real regression guard (I.5.4) |
| `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs` | `pRecomputeProgramCost` called in `CreateLumpSum`, `UpdateLumpSum`, `ReplenishLumpSum`, each before `CommitAsync` | Closes a second gap: Lump Sum writes never triggered a recompute (I.5.2) |

## I.3 Root cause — confirmed, not probable

**Mechanism:** the procedure summed funding via

```sql
JOIN dbo.tProjectFundingProfile fp ON fp.ProjectRevisionFK = ps.RevisionId AND fp.IsDeleted = 0
```

— the base row only, never the revision overlay that already exists for exactly this purpose.

**`ROOT_CAUSE_CONFIRMED`.** The pre-fix backup is a genuine `OBJECT_DEFINITION` capture from
`myps_db_dev` and shows this exact join. The fix replaces it with the overlay function already
used by six sibling `fProject*` functions.

**Latency note** (from the PR's plan doc, not independently re-verified): only 5 fully approved
revisions existed on `myps_db_dev`, all with revision funding equal to base — so the defect was
**latent**, not visibly wrong on live data. No emergency correction pass was needed; but the
fix had also never been seen producing a correct answer on a case where it matters (I.5.5).

## I.4 What was independently verified

**Verified directly:**

- **Transaction safety of the 3 new call sites.** `CreateLumpSum` (:360), `UpdateLumpSum`
  (:792), `ReplenishLumpSum` (:1066) each call the procedure inside the existing
  `BeginTransactionAsync` / `try` / `catch` wrapper before `CommitAsync`; the catch calls
  `SafeRollbackAsync`. No orphaned-transaction risk if the procedure raises.
- **The "no revisions" error path is not practically reachable there.** `Program` and
  `ProgramStage` are validated non-null before the other writes, so at least one
  `tProgramRevisions`/`tProgramStages` row exists when the procedure runs.
- **The RAISERROR-vs-THROW and 2-vs-3-column test fixes are not a behaviour change of this PR.**
  The pre-fix backup already shows `RAISERROR(...); RETURN;` and three columns; the test was
  wrong before, on a shape unrelated to RISK-108.
- **No C# caller depends on the SQL error number.** `git grep -n "50001"` across `.cs` finds no
  reference; every caller uses a generic handler. Zero functional impact from the correction.
- **The call sites reuse the proven pattern** at `ProjectController.cs:4395` and
  `RevisionController.cs:2406` — same `FromSqlInterpolated`, same `AsNoTracking()`, same
  placement relative to `CommitAsync`.

**Could not be verified:** `dbo.fProjectFundingProfile`'s actual current behaviour (I.5.1);
whether the fix produces the correct *number* on a real divergent-funding case (I.5.5).

## I.5 Findings

### I.5.1 Unverified dependency: `dbo.fProjectFundingProfile` — highest-priority gap

The fix's correctness depends on what `dbo.fProjectFundingProfile(@ProjectFK, @StageId)`
returns. It has no `CREATE`/`ALTER FUNCTION` anywhere in the repository (only name references
in comments, docs, and a `.claude/settings.json` allowlist entry); it was not backed up with
this PR; and it is characterised only by a project memory note dated 2026-08-13 describing a
conditional overlay (one branch, `Source='Revision'` or `Source='Base'`).

**Why it matters:** if the function has drifted, or returns **both** branches as an
unconditional `UNION ALL`, the new `CROSS APPLY` silently double-counts funding for every
project with an approved revision. Not rulable-out from checked-in source.

**Recommendation:** capture its live `OBJECT_DEFINITION` on `myps_db_dev` and confirm exactly
one row-set per `(ProjectFK, StageId)`.

*Partial answer from the following day:* on 2026-09-15 the session that wrote
`MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md` read `dbo.fProjectEffectiveRevision`
and the `fProject*` family on **localhost** and recorded that they branch on
`Source` — one branch, not a union. That was localhost, not `myps_db_dev`, and it did not
capture `fProjectFundingProfile` itself, so the condition stands as written; it is narrower
than it looked.

### I.5.2 Lump Sum writes never triggered a recompute — confirmed real gap, correctly fixed

Before this PR, `CreateLumpSum`, `UpdateLumpSum`, and `ReplenishLumpSum` never called
`pRecomputeProgramCost`; a Lump Sum change left Program Details stale until an unrelated edit
touched the same `ProgramFK`. The PR closes it with the proven call pattern. No issues found.

### I.5.3 Transaction/lock-duration increase — minor, accepted

The three call sites hold each Lump Sum write's transaction slightly longer while the whole
program's funding is aggregated. Matches precedent; no new locking pattern. Flagged for
completeness, not for change.

### I.5.4 Test-file reconciliation — a genuine improvement

The embedded procedure copy had drifted (wrong error, wrong column count, no ADR-055 Lump Sum
addition). The PR makes it identical to the deployed body with a trip-wire comment. That turns
a false-confidence suite into a real regression guard, and deserves saying plainly.

### I.5.5 Not proven on a divergent-funding case — moderate gap

The plan's own acceptance criterion — a project with a fully approved revision whose funding
differs from base contributes the revision's amount — is recorded in the Completion Log only
as "sanity-executed … with no errors". Running without error is not the correct number. The
plan's Risks admit no live data exercised the scenario. **Asserted, not demonstrated.**

## I.6 Verdict — GO WITH CONDITIONS

The code is sound: correctly scoped, reuses proven patterns, no new abstractions, plus a
genuine test-quality improvement. No functional bugs in the diff. Not an unconditional GO
because one new dependency was never examined or backed up, and one acceptance criterion was
asserted rather than shown.

**Open conditions before full GO:**

1. Capture and review `dbo.fProjectFundingProfile`'s live definition on `myps_db_dev`; confirm
   one row-set per `(ProjectFK, StageId)`. (I.5.1)
2. Seed one real divergent-funding case and confirm the procedure returns the revision's
   amount, not base. (I.5.5)

Neither requires reverting or re-scoping the PR.

## I.7 Sign-off

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Author | | ☐ Acknowledge conditions | | |
| Reviewer | AI System Analyst (Claude) | GO WITH CONDITIONS | 2026-09-16 | See I.6 |
| Tech Lead / Approver | | ☐ Approve to merge · ☐ Hold for conditions | | |
| DBA sign-off (I.5.1) | | ☐ `fProjectFundingProfile` verified | | |

PR #216 was merged to `dev-trunk` as `49e6d30e`. See Part III for what the conditions mean
now that Part II's change sits on top of it.

---

# Part II — the per-year, program-year rule

**Branch:** `fix/program-details-cost-computation` — `b6301021`, `9e1480e2`, `61096b31`, on
top of PR #216's `9074c83c`.

## II.1 What the rule is

A program's cost at a stage is the sum, over the latest revision of each project at that stage,
of:

- the project's `tProjectComponentCostPerYear.Amount` at the **program year**
  (`tPrograms.StartYear`) when it holds several years of rows;
- the amount of its rows **whatever the year**, when it holds one year;
- for a **Lump Sum parent**, its `tProjectComponentCost.Total` instead, with itemized children
  excluded outright.

`fProgramStages` computes it live for the program list; `pRecomputeProgramCost` writes it to
`tProgramRevisions.Cost` for Program Details. One rule by two paths. Neither reads funding
profiles or `vLumpSumSet` any more — which is where Part I's fix went (II.3, finding 2).

## II.2 Findings at a glance

| # | Finding | Verdict | Severity |
|---|---|---|---|
| 1 | Lump Sum parent appropriation summed over **all** its components; duplicate rows double it | Confirmed | **High** |
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
| 14 | Scope and process framing | Acknowledged | — |

## II.3 The findings

### 1. Lump Sum parents: `SUM(Total)` over every component, and the data has duplicates

`Migration.SchemaAndProgrammability.2026-09-10.sql` — the `component_total` CTE in the
procedure (~line 962) and the `tot` derived table in the function (~line 852); the same text in
the shared-server script and in the SQL embedded in the test file.

The rule's own comment says a parent contributes "the Total of its **single** 'Lump Sum'
component". The code sums every live component on the revision. Correct on clean data. The
data is not clean:

| | count |
|---|---|
| Lump Sum parent revisions with exactly one live component | 357 |
| Lump Sum parent revisions with more than one | **71** |
| of those, currently counted in a program's cost | 4 |

Revision 7648 is representative: two rows, both `ComponentType 'LS'`, `ComponentId 'LS'`,
`Description 'Lump Sum'`, Total ₱1,357,891,000, same `CreatedDate` to the second, same
`DataImportProgramId/ProjectId/ComponentId`. One component loaded twice. The four counted
parents each report double their appropriation (₱6,000,000,000 for ₱3,000,000,000).

**Root cause:** the 2024 import duplication already known from the three-way comparison
(`myps-gis-backend/documents/2026-09-15_program_cost_rca.md`, DOUBLED_LOAD), reaching the cost
through a second door. Per-year duplication produced the overflow (finding 5); component
duplication produces this.

**Why High and not "just data":** the code's stated contract is one component and the
implementation does nothing to hold it. `vLumpSumSet.OriginalAllocation`, which Part I's rule
used, filtered to `ComponentType = 'LS'`; the new `component_total` is unfiltered. No test has
two components on a parent.

### 2. The recompute on revision approval no longer does anything

`RevisionController.cs:2406` fires `pRecomputeProgramCost` when a Formal Revision is fully
approved — commented as the RISK-108 fix, which is Part I. The per-year rule reads
`tProjectComponentCost` / `tProjectComponentCostPerYear` directly. Approval writes only the
`tRevisionProject*` shadow tables and never base
(`MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md`, confirmed on all three fully approved
revisions on dev_200). The call runs, reads unchanged tables, writes back the number already
there.

**Failure scenario:** RO and CO approve a revision raising a project from ₱100M to ₱400M. The
revision shows Approved; Program Details still shows the pre-revision total; nothing signals it.

**This was decided, not missed.** The 2026-09-15 session chose "base table only" explicitly;
`documents/plans/program-cost-per-year-rule.md` and the section-11 prose say so, and the prose
names `fProjectComponentCostPerYear` as the revision-aware equivalent. The effect is that
**Part I's fix is undone on this branch** — not reverted, but bypassed, because nothing reads
funding any more. On 2026-09-16 the maintainer reversed the decision: **the rule is to become
revision-aware.**

### 3. Soft-deleted project revisions are counted

`stage_revision` (procedure, ~line 932) and the `sr` derived table (function) pick the latest
`tProjectStages.RevisionId` per project, filtering `IsDeleted` on component and per-year tables
but never on `tProjectRevisions`.

On dev_200: **5** picked revisions are soft-deleted (the automated pass said 6), contributing
**₱465,828,000** across three groups (`MP_P_CO-PS-634_02272023_144331`, `…_144417`, and a local
test program). Zero cases of a deleted newer revision shadowing a live older one — the exposure
is that ₱465M, not silent drop-outs.

**Pre-existing, and strictly improved by this branch.** Part I's `fProgramStages` had no
revision `IsDeleted` filter either — and no latest-revision pick at all, so it summed every
revision a project ever had at the stage. The new code fixed the second and carried the first.

### 4. No backfill, so the two paths disagree after deployment

The list computes live through `fProgramStages`; Program Details reads stored
`tProgramRevisions.Cost` through `fProgramDetails` (which selects `pgr.Cost` — finding 13, and
benign for exactly this reason). Until a program is recomputed the two screens show different
rules: **29 of 41** groups on the shared server. The runbook says so and calls a backfill "a
separate, deliberate pass". Documented is not decided. **Decision 2026-09-16: the migration
gets a backfill** that recomputes every group and reports, rather than fails on, the overflow.

### 5. One program overflows the column

`MP_P_CO-PS-634_02272023_143836` (RBP FY 2024 NCR) comes to ₱15,839,739,734,800 under the new
rule — twice its stored ₱7,920,049,867,400, from doubled 2024 per-year rows.
`tProgramRevisions.Cost` is `decimal(18,5)`, ceiling just under ₱10T. Every recompute of that
program raises Msg 8115. Same on localhost and the shared server.

The migration's preflight computes all groups, lists offenders, and **aborts** unless
`@IAcceptOverflowingPrograms = 1`; widening to `decimal(28,5)` is written but commented. This
is shipped **guarded**, not unresolved; the resolution is data de-duplication, which the
remediation plan scopes for Lump Sum components on localhost and names the per-year case as a
separate follow-up.

### 6. Rollback scripts lack a database guard

The forward migration refuses to run outside `myps_db_dev`. The four backups —
`*_backup_shared200_*` and the two `*_backup_pre_peryear-program-year-rule_20260915.sql`
localhost captures — do not. The pairs differ by one filename token and install different text:
the shared200 pair carries Part I's fix, the localhost pair predates it. Running the localhost
pair on the shared server silently reverts RISK-108.

### 7. The tests cannot see the failure the preflight guards against

`RecomputeProgramCostTests.cs:205` declares `Cost decimal(18,2)` — a *higher* integer ceiling
(16 digits vs 13) than the real `decimal(18,5)`, so ₱15.8T fits in the tests and overflows in
production. The twelve tests exercise only the procedure; `fProgramStages` has none.

### 8. Recompute call sites

`LumpsumController.Writes.cs:360, 792, 1066` each inline the same `EXEC`. `ProjectController.cs:4392`
gates on `HasCostUpdate`; `UpdateLumpSum` recomputes on every save. These came in with Part I's
`9074c83c` (Part I reviewed them as correctly reusing the pattern, which they do) — cheap to
consolidate while the computation is open.

### 9. The rule exists in five or six places

`fProgramStages`, `pRecomputeProgramCost`, both copied into the shared200 migration, its
preflight CTE, and the test file's embedded SQL. The shared200 copies are cut mechanically from
section 11; the preflight and test copies are hand-written.

### 10. `@StartYear` NULL guard — not a live risk

`tPrograms.StartYear` is `NOT NULL` on both databases with zero NULLs. A one-line guard for
symmetry with `@CurrentRevisionId` is in the plan because it is free, not because the failure
is reachable.

### 11. A Lump Sum parent out of step with its program's stage

`stage_revision` requires the parent's own `tProjectStages` row at the program's current stage;
the old rule summed `vLumpSumSet` with no stage predicate. By design a parent follows its
program's stage, so this should be empty; the verification query failed on syntax during review
and was not re-run. Carried as a risk to quantify, not a defect.

### 12. `LocalDbSafety` env-var override — false

The automated pass claimed `MYPS_TEST_SQL_SERVER` lets the suite `CREATE`/`DROP DATABASE` on
any host. No such variable exists in any tracked file. `LocalDbSafety.cs` hardcodes
`(localdb)\MSSQLLocalDB` with integrated security, which cannot reach `192.168.50.200`. (An
override existed in a scratch working state on 2026-09-15 and was never committed.) Dropped.

### 13–14. Framing

PR titled as the narrow RISK-108 fix while the branch redefines program cost; the plan authored
in the same session as the code. Fair as process observations. This document and the
remediation plan are the response: the redefinition is now stated as such, and the next change
goes through `/create-plan` → `/implement-task` → `/code-review` in order.

---

# Part III — taken together

## III.1 What the sequence did to revision-awareness

| Step | Reads | Sees approved revisions? |
|---|---|---|
| Before PR #216 | base `tProjectFundingProfile` + `vLumpSumSet` | No — RISK-108 |
| PR #216 (`9074c83c`, on `dev-trunk`) | `fProjectFundingProfile` overlay + `vLumpSumSet` | Yes, on funding |
| Per-year rule (fix branch) | base `tProjectComponentCost*` | **No** — funding is no longer the basis, so the overlay is never consulted |
| Remediation (planned) | effective-revision overlay over per-year and Lump Sum Total | Yes, on the new basis |

`dev-trunk` today is at the PR #216 row. The fix branch, if merged as it stands, moves it to the
third row.

## III.2 What Part I's open conditions mean now

- **Condition 1 (`fProjectFundingProfile` unverified).** On the fix branch nothing reads
  `fProjectFundingProfile`, so for *that branch* the condition is moot. It is not moot for
  `dev-trunk`, which runs PR #216's procedure today, and it becomes live again — in a different
  form — the moment the remediation reintroduces an overlay read: the same question ("exactly
  one branch per project, never both") applies to whatever `effective`-revision logic the
  revision-aware rewrite uses. The plan's set-based `effective` CTE reproduces
  `fProjectEffectiveRevision`'s predicate explicitly rather than calling the function, which is
  how it answers the question in checked-in source.
- **Condition 2 (no divergent-funding proof).** Carried forward unchanged as the
  revision-awareness test in remediation task 9: an approved revision whose figures differ from
  base must move the program's cost; a pending one must not.

## III.3 Decisions taken on 2026-09-16

| Question | Decision |
|---|---|
| Duplicate Lump Sum components | **Both**: the Lump Sum branch reads one `'LS'` component, and a data script soft-deletes the duplicates — **localhost only** |
| Backfill after deployment | **Yes**: the migration recomputes every group; the overflowing group is reported and skipped |
| Base-only vs revision-aware | **Revision-aware**, with the risks and top-of-head optimizations documented; no deep optimization pass |

## III.4 Merge recommendation

- **PR #216 — already merged.** Its two conditions are verification steps, not reverts; they
  remain the right thing to do for `dev-trunk` as it stands.
- **`fix/program-details-cost-computation` — do not merge as it stands.** Finding 1 puts a
  wrong figure on four programs today and on any program that itemizes a duplicated parent
  tomorrow; finding 2 is, by the 2026-09-16 decision, the wrong rule, and it silently bypasses
  the fix PR #216 was merged for.
- The rest is not blocking but is cheap and belongs in the same change: findings 3, 6, 7, 8,
  10. Finding 5 stays a guarded abort until the per-year de-dup is done as its own piece of
  work.

The remediation is planned in `documents/plans/program-cost-review-remediation.md`, to be
implemented on top of the fix branch (or after it lands), not on `dev-trunk`.

---

## Appendix — citations

- PR #216: https://github.com/mf1027/project_myps/pull/216 · fix at
  `Migration.SchemaAndProgrammability.2026-09-10.sql:822-880` (as of `9074c83c`) · pre-fix
  backup `pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql` · author's
  plan `documents/plans/fix-program-details-cost-computation.md`
- Per-year rule: `Migration.SchemaAndProgrammability.2026-09-10.sql` §11 (~789–1010, as of
  `b6301021`) · plan `documents/plans/program-cost-per-year-rule.md` · shared-server
  migration `Migration.ProgramCostPerYearRule.Shared200.2026-09-15.sql` and runbook
  `MYPS_PROGRAM_COST_PER_YEAR_RULE_SHARED200_DEPLOYMENT.md`
- Call sites: `LumpsumController.Writes.cs:360, 792, 1066` · `ProjectController.cs:4395` ·
  `RevisionController.cs:2406`
- Tests: `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`
- Revision overlay: `MYPS_REVISION_APPROVAL_DOES_NOT_UPDATE_BASE_TABLES.md`
- Data evidence: `myps-gis-backend/documents/2026-09-15_program_cost_rca.md` (backend repo)
- Second automated pass on the per-year rule:
  `documents/plans/Migration.ProgramCostPerYearRule-review.md`
