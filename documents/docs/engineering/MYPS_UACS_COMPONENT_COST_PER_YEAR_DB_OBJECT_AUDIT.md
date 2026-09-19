# UACS on Component Cost Per Year — Full DB Object Audit

**Date:** 2026-09-16
**Branch:** `feat/uacs-component-cost-per-year` (off `dev-trunk`, not pushed/merged as of this doc)
 - `a237e8a3` — Add UACS input to Component Cost Per Year (Project + Modification dialogs)
 - `328fbdef` — Fix Global Search UACS category: vProjects view does not exist
**Scope:** Every live database object on `myps_db_dev` whose definition references `UACS`,
audited after the Project/Modification Component Cost Per Year dialogs were given an
independently-editable UACS field per row.
**Method:** `SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON
m.object_id = o.object_id WHERE m.definition LIKE '%UACS%'` against live `myps_db_dev`
(192.168.50.200), followed by `OBJECT_DEFINITION()` on each of the 10 objects returned,
read in full. Not derived from checked-in source, memory notes, or assumption — every finding
below traces to a live query result captured this session.
**Status:** Investigation complete. Fixes: 1 shipped (GlobalSearchController), 1 **on hold**
(`sp_RBP`, this doc), 1 explicitly out of scope (`pGenerateAIP01`, operator-confirmed unused),
2 no action needed (informational only).

---

## Why this audit happened

Until `feat/uacs-component-cost-per-year`, UACS could only ever be set through the Lump Sum UI,
whose convention keeps every per-year row on a project at the *same* value (set once on Project
Details, fanned server-side). Every other SQL object that reads `tProjectComponentCostPerYear.UACS`
was written and implicitly tested against a world where all per-year rows on a project share one
value. Now that Project/Modification's dialogs let each row carry its own value independently
(operator-confirmed design decision), any object that silently collapses multiple per-year rows
down to "one" UACS per project/component — instead of either preserving all of them or picking a
row deterministically — can now produce wrong or non-deterministic output where it previously
couldn't, because the underlying data literally couldn't vary before.

---

## The 10 objects, and what each one does

| Object | Type | Verdict |
|---|---|---|
| `GlobalSearchController.cs` (WebAPI, not a DB object but included for completeness) | C# controller | 🔴 → 🟢 **Fixed this session** — queried a nonexistent view (`vProjects`); rewritten against `tProjectComponentCostPerYear` directly, matched-values shown per project, no arbitrary collapse. Committed on `feat/uacs-component-cost-per-year`. |
| `fProjectComponentCostPerYear` | Inline TVF | 🟢 **Correct** — see §1 |
| `fRevisionComponentCostPerYear` | Inline TVF | 🟢 **Correct** — see §2 |
| `pCopyProjectDetailChain` | Stored proc | 🟢 **Correct** — see §3 |
| `vLumpSumSet` | View | 🟢 **Correct, unaffected** — see §4 |
| `vLumpSumChildSet` | View | Not independently re-read this pass — same author/pattern as `vLumpSumSet`, same established track record; not flagged by anything found elsewhere. Lower priority; revisit if a Lump Sum-specific UACS issue ever surfaces. |
| `a1_usp_AIP2` | Stored proc | 🟡 **Needs a design decision, not clearly a bug** — see §5 |
| `usp_extract_PC_list` | Stored proc | 🟡 **Deterministic but semantically arbitrary, user-facing** — see §6 |
| `usp_extract_PC_MIOW_list` | Stored proc | ⚪ **Dead computation, no user-facing impact** — see §7 |
| `pGenerateAIP01` | Stored proc | ⚫ **Out of scope — operator confirmed not in use.** Non-deterministic UACS output was confirmed via SQL text (see git history / prior session message for detail), but no fix needed since nothing calls it. |
| `sp_RBP` | Stored proc | 🔴 **ON HOLD — two separate confirmed defects, not yet fixed.** See §8, the main subject of this document. |

---

## §1 — `fProjectComponentCostPerYear(@ProjectPK, @StageId)` — correct

`UNION ALL` of two branches gated by `ce.Source` (`'Revision'` vs `'Base'`, from the underlying
`fProjectComponentCost` overlay), never both. `py.UACS` is selected and threaded through
correctly in both branches. This is the revision-aware overlay function `RevisionController.cs`
and `ShowProjectDetails`-equivalent reads go through — confirmed it correctly surfaces whichever
UACS is currently effective (base or revision) per row, and does **not** silently collapse
multiple per-year rows into one — it returns one row per underlying per-year row, which is the
correct shape for anything consuming individual per-year rows (as opposed to a report that
needs one summary row per project/component).

## §2 — `fRevisionComponentCostPerYear(@TransactionId)` — correct

Keyed by `@TransactionId` (used in the resubmit-revision flow), returns one row per
`tRevisionProjectComponentCostPerYear` row with `py.UACS` carried through directly. No
aggregation or collapse — same "correct by construction" reasoning as §1.

## §3 — `pCopyProjectDetailChain` — correct

The stage-advance copy-forward procedure. Its `tProjectComponentCostPerYear` INSERT explicitly
includes `UACS` in both the column list and the `SELECT`:
```sql
INSERT dbo.tProjectComponentCostPerYear (ComponentCostFK, Amount, Year, UACS, StartDate, EndDate, CreatedBy, CreatedDate)
SELECT m.NewCostId, py.Amount, py.Year, py.UACS, py.StartDate, py.EndDate, @By, @Now
FROM dbo.tProjectComponentCostPerYear py
JOIN @CompMap m ON m.OldCostId = py.ComponentCostFK
WHERE py.IsDeleted = 0;
```
Confirmed: UACS survives a stage advance, per-row, exactly as it should given the independent-
per-row design. No gap.

## §4 — `vLumpSumSet` — correct, unaffected by the general-flow change

Its `uacs` `OUTER APPLY` already uses a **deterministic** tiebreak:
```sql
OUTER APPLY (
    SELECT TOP 1 cy.UACS
    FROM   dbo.tProjectComponentCost cc
    JOIN   dbo.tProjectComponentCostPerYear cy ON cy.ComponentCostFK = cc.Id AND cy.IsDeleted = 0
    WHERE  cc.ProjectRevisionFK = lr.Id AND cc.IsDeleted = 0 AND cy.UACS IS NOT NULL
    ORDER  BY cy.Year, cy.Id
) uacs
```
`TOP 1 ... ORDER BY cy.Year, cy.Id` — earliest year first, `Id` as an absolute final tiebreak.
This was built with per-row-variability already in mind (the comment explains it's surfaced here
specifically to compare a Lump Sum child's UACS against its parent's, a Lump-Sum-specific spec
requirement). Well-designed; nothing to fix.

## §5 — `a1_usp_AIP2` — needs a decision, not obviously broken

Joins `tProjectComponentCost`/`tProjectComponentCostPerYear` directly rather than through the
revision-aware overlay function — so an approved Formal Revision's UACS change would not appear
in this AIP report; it always reflects base. This mirrors the exact shape of the RISK-108 defect
(`pRecomputeProgramCost` reading base funding instead of the revision overlay), but for UACS in
a reporting proc rather than a computed total.

**Not asserting this is wrong** — AIP (Annual Investment Program) reports may intentionally
reflect base/as-originally-budgeted data rather than live revision overlays; that could be
correct government-reporting behavior, not a bug. This proc already has a well-documented,
deliberate change history (the 2026-09-10 UACS-filter comment-out was quantified and
operator-approved — see its own header comment), so whoever owns AIP reporting semantics should
make this call, not an inference from code shape alone. Flagged for a decision. No fix proposed
or applied.

## §6 — `usp_extract_PC_list` — deterministic but semantically arbitrary, user-facing

```sql
SELECT
    ...
    MAX(pccpy.UACS)          AS pmsid,
    ...
FROM dbo.tProjectComponentCost pcc
LEFT JOIN dbo.tProjectComponentCostPerYear pccpy ON pccpy.ComponentCostFK = pcc.Id AND pccpy.IsDeleted = 0
WHERE pcc.IsDeleted = 0
GROUP BY pcc.Id, pcc.ProjectRevisionFK, pcc.ComponentId, pcc.Total, pcc.Description
```
Collapses across every year of a component via `MAX(UACS)`. Deterministic (won't flip between
runs, unlike `sp_RBP`/`pGenerateAIP01`), but picks whichever code sorts alphabetically last —
not "the current one," not "the most recent year," just whatever wins a string comparison. This
value **is** selected into the final report output (`pcs.pmsid AS UACS`), so it's user-facing.
Lower severity than `sp_RBP`/`pGenerateAIP01` (no run-to-run flicker), but still not meaningful
once a component's years can genuinely carry different codes. Not fixed this pass — flagged
alongside `sp_RBP` for the same future decision on how per-year UACS should collapse to a
per-component or per-project report row.

## §7 — `usp_extract_PC_MIOW_list` — dead computation, no user-facing impact

Its `pcs` CTE computes the identical `MAX(pccpy.UACS) AS pmsid` as §6, but the final `SELECT`
list never references `pmsid`/`UACS` at all — confirmed by reading the complete `SELECT DISTINCT`
column list, no `UACS` present. No fix needed; worth a minor cleanup someday (drop the unused
column from the CTE) but not urgent and not part of this audit's actual scope.

---

## §8 — `sp_RBP` — ON HOLD, two separate confirmed defects

**Explicitly not fixed yet, per operator instruction (2026-09-16) to hold this and document it
instead.** Both findings below are independently confirmed against the **live** proc, re-verified
a second time after the first read to rule out a transcription error (they matched both times).

### 8a. UACS output is non-deterministic (the reason this audit reached `sp_RBP` in the first place)

The final collapse to "one row per component":
```sql
ranked AS (
    SELECT
        xd.*,
        COUNT(xd.Target_Amount) OVER (PARTITION BY xd.Project_Id, xd.Component_Id) AS CountField,
        ROW_NUMBER() OVER (PARTITION BY xd.Project_Id, xd.Component_Id ORDER BY (SELECT NULL)) AS rn
    FROM xd
)
SELECT ... FROM ranked WHERE rn = 1
```
`ORDER BY (SELECT NULL)` is an explicitly unordered tiebreak. Because the upstream join to
`tProjectComponentCostPerYear` has no year constraint —
```sql
JOIN dbo.[tProjectComponentCostPerYear] pccpy
    ON  pccpy.ComponentCostFK = pcc.Id
    --temp lang
    --AND pccpy.Year            = prog.StartYear
    AND pccpy.IsDeleted       = 0
```
— a component with per-year rows spanning multiple years produces multiple `xd` rows per
`(Project_Id, Component_Id)`, and `rn = 1` picks one of them **arbitrarily**. Before per-row UACS
editing existed, this was latent — every candidate row shared the same UACS, so "arbitrary" always
produced the same visible answer. It's live now.

**Note the commented-out `--AND pccpy.Year = prog.StartYear` line above** — this looks like the
original, disabled attempt at exactly this constraint. It was not re-enabled as part of this audit
because turning it into a hard `WHERE`/join filter would risk silently dropping components that
have no per-year row for the exact `@yearstart` year (the join is `INNER`, not `LEFT`) — that's a
bigger behavior change than restoring determinism requires. The lower-risk fix (not yet applied)
is a deterministic `ORDER BY` in the `ranked` CTE's `ROW_NUMBER()` that *prefers* the row matching
`@yearstart` when one exists, falls back to the most recent year otherwise, and uses the per-year
row's own `Id` as an absolute final tiebreak — restoring the filter's evident intent without its
row-dropping risk. This requires first adding `pccpy.Year`/`pccpy.Id` to the `x` and `xd` CTEs'
column lists, since neither currently carries them through.

### 8b. The live proc is missing an already-designed, already-documented correction (bigger than 8a)

The checked-in source, `Main/Resources/Internal/SQLScripts/Reports.CrystalReportSQLFixes.sql:134`,
carries a **different, already-fixed** version of `sp_RBP` than what's live. Its own header
comment (lines 82-111 of that file) documents a "Round 2 correction" dated 2026-09-06:

> *"the 'latest revision by Id DESC, regardless of stage' resolution ... was itself wrong for
> sp_RBP and a1_usp_AIP2, caught before it could ship to the frontend ... a program with an
> RBP-stage revision that isn't also its highest-Id revision (or with no RBP-stage revision at
> all) would show wrong-stage data mislabeled as RBP."*

The checked-in fix: `LatestProgStage` filters `WHERE StageName = 'RBP'` first, then
`LatestProgRev` joins to that specific stage row (`JOIN LatestProgStage ps ON ps.RevisionId =
pr.Id AND ps.rn = 1`) — so `Program_Description` and `stage_desc` can never disagree about which
revision is being shown, and a program with no RBP-stage revision correctly returns zero rows.

**Re-verified live, twice, to rule out a misread:**
```sql
LatestProgRev AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn FROM dbo.tProgramRevisions),
LatestProgStage AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY ProgramFK ORDER BY Id DESC) AS rn FROM dbo.tProgramStages)
```
No `StageName = 'RBP'` filter anywhere; the two CTEs are **not joined to each other** — each
independently picks "whichever row has the highest Id," exactly the pre-correction, documented-
as-broken shape. **The live database is currently running the version the checked-in file's own
comments say was already found wrong and fixed on 2026-09-06.** Whether this means the fix was
never actually deployed, or was deployed and then lost (e.g. in one of this database's periodic
rebuilds — a known, recurring pattern for `myps_db_dev`), is not established by this audit.

**A third, smaller drift in the same direction was also found:** the checked-in file's
`@programid` parameter is still `VARCHAR(MAX)`; live has already been narrowed to `VARCHAR(300)`
per a documented 2026-09-09 fix (comment present in the *live* definition, absent from the
checked-in file). So the checked-in file is stale in **both directions** relative to live — it's
missing one fix live already has (§8b's own parameter width), while live is simultaneously
missing a different fix the checked-in file already has (the RBP-stage filter). The two copies
have genuinely diverged, not just drifted one way.

### What "fix `sp_RBP` thoroughly" will need to cover, when resumed

1. Back up the current live definition (`OBJECT_DEFINITION`) before altering anything — standard
   convention, matches every other backup in `Main/Resources/Internal/SQLScripts/`.
2. Restore the RBP-stage filter (§8b) — the higher-severity, already-designed fix.
3. Apply the deterministic UACS/year-collapse fix (§8a) on top of the restored, correct base.
4. Resync the checked-in `Reports.CrystalReportSQLFixes.sql` to match the true corrected state
   (closing both directions of drift found in §8b), not just append a third patch on top of an
   already-stale copy.
5. Re-verify against real multi-revision, multi-year test data — this proc's own change history
   (§8b's quote) explicitly treats "runs without error" as insufficient evidence for exactly this
   proc, twice already; the fix needs the same standard applied to itself.
6. Decide whether §6/§7 (`usp_extract_PC_list`/`usp_extract_PC_MIOW_list`) get the same
   determinism treatment while this proc family is already open, or stay tracked separately.

None of the above has been executed. `sp_RBP` on `myps_db_dev` is unchanged from its current
(pre-correction, non-deterministic) state as of this document.

---

## Summary table (for quick reference)

| Finding | Severity | Status |
|---|---|---|
| `GlobalSearchController.cs` queried a nonexistent view | 🔴 | ✅ Fixed, committed |
| `sp_RBP` UACS collapse is non-deterministic | 🔴 | ⏸️ On hold, documented (§8a) |
| `sp_RBP` missing the RBP-stage-filter correction | 🔴 | ⏸️ On hold, documented (§8b) — larger than the UACS issue itself |
| `sp_RBP` checked-in source diverged from live, both directions | 🟡 | ⏸️ On hold, documented (§8b) |
| `usp_extract_PC_list` UACS collapse is arbitrary-but-deterministic | 🟡 | Documented (§6), not fixed |
| `a1_usp_AIP2` reads base UACS, not revision overlay | 🟡 | Documented (§5), needs a design decision, not a code fix |
| `pGenerateAIP01` non-deterministic UACS output | ⚫ | Operator-confirmed unused; no fix needed |
| `usp_extract_PC_MIOW_list` dead UACS computation | ⚪ | Documented (§7), no user impact |
| `fProjectComponentCostPerYear`, `fRevisionComponentCostPerYear`, `pCopyProjectDetailChain`, `vLumpSumSet` | 🟢 | Confirmed correct, no action |
