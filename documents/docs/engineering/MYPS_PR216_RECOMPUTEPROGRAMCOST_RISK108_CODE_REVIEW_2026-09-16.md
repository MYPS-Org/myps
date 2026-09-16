# PR #216 — `pRecomputeProgramCost` RISK-108 Funding-Profile Fix — Code Review & Handover

**PR:** https://github.com/mf1027/project_myps/pull/216
**Base branch:** `dev-trunk` @ `377e372ffc71353c0507b1e3853ab618b8a28d31`
**Head commit:** `9074c83ca7ee0cdffef56e9ad817f2d015c46c7b` (2026-09-15 04:53:58 +0800)
**Review date:** 2026-09-16
**Reviewer:** AI System Analyst / Architect (Claude), on the operator's request
**Review method:** `/plan-analysis` + `/code-behavior-audit` + `/code-review` — full diff fetched directly via `git fetch origin pull/216/head:pr-216` and diffed against `origin/dev-trunk` (the actual base; diffing against `main` first produced a useless 764-file result since `main` and `dev-trunk` have diverged substantially — noted here so nobody repeats that mistake)
**Status:** **GO WITH CONDITIONS** — see [Verdict](#verdict--go-with-conditions) and [Open Conditions](#open-conditions-before-full-go)

---

## 1. Executive Summary

This PR fixes a confirmed, real defect (RISK-108): `dbo.pRecomputeProgramCost` was summing a program's project funding from a direct join against the **base** funding table, blind to funding changes made through an **approved Formal Revision**. A program's displayed Cost on Program Details could silently stay wrong — reflecting pre-revision numbers — until an unrelated project edit happened to trigger a recompute.

The fix itself is small, correctly scoped, and well-implemented. The PR also reconciles a test file that had drifted into testing a **fictional** version of the procedure (wrong error number, wrong column count) — a good catch, not part of the requested fix, but a legitimate improvement shipped alongside it.

**One material gap remains open**: the fix's entire correctness rests on a function (`dbo.fProjectFundingProfile`) that has **no checked-in source anywhere in this repository** — it's a live-database-only object. Nobody backed it up or re-verified its current behavior as part of this PR. See [§5.1](#51-unverified-dependency-dbofprojectfundingprofile-highest-priority-gap).

---

## 2. Scope — What Actually Changed

Confirmed via `git diff origin/dev-trunk...pr-216 --stat` (6 files, 1,443 insertions / 29 deletions). Two of the six are not functional changes (an auto-regenerated ERD diagram, and the author's own plan doc) — this review covers the four that matter:

| File | Change | Why it matters |
|---|---|---|
| `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` (lines ~822–880) | The actual fix: `JOIN dbo.tProjectFundingProfile` → `CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId)` | Root-cause fix for RISK-108 |
| `Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql` (new) | Pre-fix `OBJECT_DEFINITION` backup of the live procedure, captured before altering `myps_db_dev` | Rollback artifact — confirmed genuine, not narrated (see §4) |
| `MYPS.DatabaseTests/RecomputeProgramCostTests.cs` | Reconciles the test's embedded procedure copy to match the real deployed shape; fixes 2 unrelated pre-existing test bugs; adds 1 new test for the Lump Sum addition | Turns a fictional test into a real regression guard (see §5.4) |
| `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs` | Adds a `pRecomputeProgramCost` call in `CreateLumpSum`, `UpdateLumpSum`, `ReplenishLumpSum`, each before `CommitAsync` | Closes a second, related gap: Lump Sum writes never triggered a recompute at all (see §5.2) |

---

## 3. Root Cause (Confirmed, Not Probable)

**Symptom:** A program's Cost on Program Details could show a stale number after a Formal Revision changed a project's funding, until an unrelated edit forced a recompute.

**Mechanism:** `dbo.pRecomputeProgramCost` summed funding via:
```sql
JOIN dbo.tProjectFundingProfile fp ON fp.ProjectRevisionFK = ps.RevisionId AND fp.IsDeleted = 0
```
— reading only the base (`tProjectRevisions`) funding row, never the revision-overlay function that already exists elsewhere in the codebase for exactly this purpose.

**Classification: `ROOT_CAUSE_CONFIRMED`.** This is not inferred — the pre-fix backup file (`pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql`) is a genuine `OBJECT_DEFINITION` capture from `myps_db_dev`, and it matches this exact join shape. The fix (`CROSS APPLY dbo.fProjectFundingProfile(ps.ProjectFK, ps.StageId)`) replaces it with the revision-aware overlay function already used by six sibling `fProject*` functions in this codebase for the same purpose.

**Latency note (from the PR's own plan doc, not independently re-verified by this review):** at investigation time only 5 fully-approved revisions existed on `myps_db_dev`, and all 5 coincidentally had revision funding equal to base funding — so this defect was **latent** (present in the code path, not yet visibly wrong on real data) rather than actively producing an incorrect number for any live program. This matters for prioritization: nothing needs an emergency data-correction pass, but it also means **the fix has never been observed producing a correct answer on a case where it actually matters** (see §5.1 and §5.5).

---

## 4. Code-Behavior Trace — What Was Independently Verified

This section separates what this review **confirmed directly** from what it could **not** confirm and is only relying on the PR's own claims or older project memory.

### 4.1 Verified directly by this review

- **Transaction safety of the 3 new call sites.** `LumpsumController.Writes.cs`'s `CreateLumpSum` (line 360), `UpdateLumpSum` (line 792), and `ReplenishLumpSum` (line 1066) each call `pRecomputeProgramCost` inside the existing `BeginTransactionAsync` / `try` / `catch (Exception)` wrapper, before `CommitAsync`. The catch block calls `SafeRollbackAsync` — confirmed no orphaned-transaction risk if the procedure ever raised.
- **The "no revisions" error path is not practically reachable at these 3 call sites.** `Program` and `ProgramStage` are both validated non-null immediately before the transaction's other writes in each method, which structurally guarantees at least one `tProgramRevisions`/`tProgramStages` row exists by the time `pRecomputeProgramCost` runs.
- **The RAISERROR-vs-THROW / 2-column-vs-3-column test fixes are NOT a behavior change introduced by this PR.** The pre-fix backup file already shows `RAISERROR(...); RETURN;` and a 3-column result set — meaning the test was already wrong *before* this PR, on a procedure shape that had nothing to do with the RISK-108 fix. This PR just catches the test up to reality.
- **No C# caller depends on the specific SQL error number.** `git grep -n "50001"` across all `.cs` files in the PR shows zero references to `pRecomputeProgramCost`'s error number anywhere in application code — every caller uses a generic exception handler. The error-number/message test correction therefore has **zero functional impact**, confirmed rather than assumed.
- **The 3 new call sites correctly reuse an existing, already-proven pattern** (`ProjectController.cs:4395`, `RevisionController.cs:2406`) rather than inventing a new one — same `FromSqlInterpolated` shape, same `AsNoTracking()`, same placement relative to `CommitAsync`.

### 4.2 Could NOT be verified this review — flagged, not asserted either way

- **`dbo.fProjectFundingProfile`'s actual current behavior.** See §5.1 — this is the single largest open item from this review.
- **Whether the fix produces the *correct number* on a real divergent-funding case.** The Completion Log in the PR's own plan doc records only that the fixed procedure was "sanity-executed... with no errors" against a real program — not that its output was checked against a hand-computed expected value. See §5.5.

---

## 5. Findings

Ranked by priority. Each finding states its confidence and what evidence backs it, per this review's own discipline against asserting unverified claims as fact.

### 5.1 Unverified dependency: `dbo.fProjectFundingProfile` (HIGHEST PRIORITY GAP)

**Confidence: cannot be verified from checked-in source — this is the finding.**

The entire correctness of this fix depends on what `dbo.fProjectFundingProfile(@ProjectFK, @StageId)` actually returns. This function:
- Has **no `CREATE FUNCTION`/`ALTER FUNCTION` statement anywhere in the repository** (`git grep` across the full PR tree returns zero hits for its definition — only references to its name in comments, docs, and a `.claude/settings.json` permission allowlist entry for an ad-hoc diagnostic query).
- Was **not backed up as part of this PR** — only `pRecomputeProgramCost` itself got an `OBJECT_DEFINITION` capture. Its new dependency, which the whole fix now trusts, has no equivalent record.
- Is only characterized by a **project memory note dated 2026-08-13 — over a month before this PR** — describing it as a conditional overlay (a CTE checks for an approved-and-not-superseded revision, then returns either a `Source='Revision'` branch or a `Source='Base'` branch). That note was not re-verified this session and the database may have changed since.

**Why this matters:** if this function's actual behavior has drifted since 08-13, or if it returns **both** branches (an unconditional `UNION ALL`) rather than exactly one, `pRecomputeProgramCost`'s new `CROSS APPLY` would silently double-count funding for any project with an approved revision. This review cannot rule that out from the checked-in source.

**Recommendation:** before treating this fix as fully proven, capture `dbo.fProjectFundingProfile`'s current live `OBJECT_DEFINITION` on `myps_db_dev` (same pattern already used for `pRecomputeProgramCost`) and confirm it returns exactly one row-set per `(ProjectFK, StageId)` pair, never both branches together.

### 5.2 Lump Sum writes previously never triggered a program recompute at all (confirmed real gap, correctly fixed)

**Confidence: high — confirmed via diff and call-site trace (§4.1).**

Before this PR, `CreateLumpSum`, `UpdateLumpSum`, and `ReplenishLumpSum` never called `pRecomputeProgramCost` — a Lump Sum allocation change would leave Program Details showing a stale total until an unrelated project edit happened to touch the same `ProgramFK`. This is a second, related defect beyond the RISK-108 join fix itself, and the PR correctly closes it by adding the same call pattern already proven in `ProjectController.cs`/`RevisionController.cs` to all three write paths. No issues found with the implementation of this part.

### 5.3 Transaction/lock-duration increase (minor, accepted risk — not a defect)

**Confidence: high — structural, not a bug.**

The 3 new call sites now hold each Lump Sum write's transaction open slightly longer while `pRecomputeProgramCost` aggregates the **whole program's** funding, not just the one project being written. This is an accepted, reasonable tradeoff (matches existing precedent, no new locking pattern introduced) — flagged here for DBA-lens completeness, not as something requiring a change.

### 5.4 Test-file reconciliation is a genuine improvement (positive finding)

**Confidence: high — confirmed via diff.**

`RecomputeProgramCostTests.cs`'s embedded copy of the procedure had drifted into testing a shape that never matched what was actually deployed (wrong error number/message, wrong result-set column count, missing the ADR-055 Lump Sum addition entirely). This PR makes the embedded copy byte-for-byte identical to the real deployed procedure body, with an explicit trip-wire comment warning the next editor not to let the two drift apart again. This is good practice and should be recognized as such, not just noted in passing — it turns a false-confidence test suite into a real regression guard.

### 5.5 The fix has not been proven correct on a real divergent-funding case (moderate gap)

**Confidence: moderate — based on the PR's own Completion Log and Risks section, both read directly.**

The plan doc's own acceptance criteria require confirming that "a project with a fully-approved Formal Revision whose funding differs from base now contributes the revision's amount to its program's Cost, not the base amount." The Completion Log records only that the fixed procedure was "sanity-executed... against a real program with a fully-approved revision with no errors" — running without erroring is not the same as confirming the output number is correct. The plan doc's own Risks section independently admits no live data on `myps_db_dev` currently exercises this scenario. **This acceptance criterion is not actually demonstrated as met**, only asserted as sanity-checked.

---

## 6. Verdict — GO WITH CONDITIONS

The code changes in this PR are sound: correctly scoped, reuse existing proven patterns, introduce no new abstractions, and include a genuine test-quality improvement as a side effect. No functional bugs were found in the diff itself. This is **not** a NO-GO.

It is not an unconditional GO because one dependency this fix now relies on was never independently examined or backed up, and one of the fix's own acceptance criteria was asserted rather than demonstrated.

### Open Conditions Before Full GO

1. **Capture and review `dbo.fProjectFundingProfile`'s current live definition** on `myps_db_dev` — confirm it returns exactly one row-set per `(ProjectFK, StageId)`, not a double-counting union. (§5.1)
2. **Seed one real divergent-funding test case** (project with an approved revision whose funding differs from base) against `myps_db_dev` and confirm `pRecomputeProgramCost` now returns the revision's amount, not base — closing the gap between "ran without error" and "produces the correct number." (§5.5)

Neither condition requires reverting or re-scoping the PR — both are verification steps that can run against the already-fixed procedure.

---

## 7. Team Sign-off

| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Author | | ☐ Acknowledge conditions | | |
| Reviewer (this doc) | AI System Analyst (Claude) | GO WITH CONDITIONS | 2026-09-16 | See §6 |
| Tech Lead / Approver | | ☐ Approve to merge · ☐ Hold for conditions | | |
| DBA sign-off (for §5.1) | | ☐ `fProjectFundingProfile` verified | | |

**Recommended next action:** run condition #1 (capture + review `fProjectFundingProfile`) before merge; condition #2 can run either just before or just after merge since it's a verification step against behavior the PR already ships.

---

## Appendix — Citations

- PR: https://github.com/mf1027/project_myps/pull/216
- Fix: `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql:822-880` (as of `9074c83`)
- Pre-fix backup: `Main/Resources/Internal/SQLScripts/pRecomputeProgramCost_backup_pre_risk108-fundingprofile-fix_20260915.sql`
- Test reconciliation: `MYPS.DatabaseTests/RecomputeProgramCostTests.cs`
- New call sites: `WebAPI/Controllers/Lumpsum/LumpsumController.Writes.cs:360`, `:792`, `:1066`
- Existing precedent for the call pattern: `WebAPI/Controllers/Projects/ProjectController.cs:4395`, `WebAPI/Controllers/Revision/RevisionController.cs:2406`
- Author's own plan doc: `documents/plans/fix-program-details-cost-computation.md`
