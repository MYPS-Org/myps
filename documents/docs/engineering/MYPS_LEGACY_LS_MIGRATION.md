# Legacy Lump Sum projects — migration onto the V3 data model

**Date:** 2026-09-14 (two runs, morning and 11:59)
**Database:** `localhost` / `myps_db_dev_200`
**Script:** `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql` (Revision 2, committed `585904f4`) with its harness `LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql`
**Preceded by:** the program-group load from `MYPS_BAK` (`MYPS_BAK_PROGRAM_GROUP_LOAD.md`), which brought the 2023 and 2025 parents and carried the itemization notes the children are linked from
**Backups:** `myps_db_dev_200_pre_legacyls_20260914.bak` (first run), `myps_db_dev_200_pre_phaseC_20260914.bak` (Revision 2)
**Result:** 123 Lump Sum parents on the model (57 of 2023, 59 of 2024, 4 of 2025 converted from `CW`) and 4,037 itemized children linked to them. `vLumpSumSet` 3 → **123**, `vLumpSumChildSet` 18 → **4,055**, allocation invariant OK on all 123, every verification counter 0, second run 0 in scope. 44 Playwright specs pass against the migrated data.

---

## 1. What this closes

`Migration.SchemaAndProgrammability.2026-09-10.sql` gave this lineage the Lump Sum v3 **schema** and said in its own header that it contains no data migrations. It was right to: the column it would have keyed off, `ParentProjectId`, had just been created empty.

But the lineage holds Lump Sum projects migrated from the old system — `tProjects.ProjectPK` ending in `LS` under Approved GAA-R programs — and projects itemized from them, and all of it predates the model. The module could not see the parents (`vLumpSumSet` requires `ProjectType = 'LS'`) and, once it could, would have mis-reported them: doubled allocation, no funding line, invalid Sub-Category, a balance shown as the allocation, and no child knowing its parent. This is the data migration for exactly that set, under the model of 2026-09-06:

```
LS component Total   = the full allocation    = Σ live funding lines
LS per-year Amount   = the remaining balance  = Total − Σ children's latest-revision costs
```

| | Before | After |
|---|---:|---:|
| `vLumpSumSet` | 3 (the MyMYPS sample) | **123** |
| `vLumpSumChildSet` | 18 (sample) | **4,055** |
| Parents with a funding line | 1 of 120 (`P00700002LS`, through the loader) | 120 of 120 |
| Invariant `Total = Remaining + Itemized` | OK on 3 | OK on 123, no drift |

By program year, as `vLumpSumSet` now reports it:

| Year | Parents | Children | Allocation | Remaining | Itemized |
|---|---:|---:|---:|---:|---:|
| 2023 | 57 | 2,010 | 24,878,881,542.99 | 13,463,934,649.75 | 11,414,946,893.24 |
| 2024 | 59 | 2,027 | 13,622,671,949.41 | 4,778,229,699.08 | 8,844,442,250.33 |
| 2025 | 7 (4 migrated + 3 sample) | 18 (sample) | 1,340,000,000.00 | 908,000,000.00 | 432,000,000.00 |

All these programs are **Approved at GAA-R**. Under the rule of 2026-09-09 that means creating and deleting a Lump Sum Project in them is refused and the project's details and component render read-only, while Save, Replenish, Import and child delete keep working. That is the expected state for this data, not a regression.

---

## 2. The data as found

Verified against `MYPS_BAK` and the live database before anything was written.

| Fact | Value |
|---|---|
| Parents | **120** on the target after the load: `ProjectPK LIKE '%LS'`, latest live revision under a program with `StartYear >= 2023`. 2023: 57 (CSSP 34, LP 20, OO-1 3). 2024: 59 (SSP 34, LP 21, OO-1 4), on the target since the server restore. 2025: 4 (`P00900001LS`–`04LS`, OO-1) |
| `ProjectType` on them | the literal string **`'NULL'`** — the loader's signature, shared by ~56,700 projects on this lineage |
| Live revisions per parent | one per stage the group carries; the views read the **latest** only |
| Components on the latest revision | 2023 and 2024: `LS` only. **2025: `CW:CW1` only** — the component *is* the allocation, stored as civil works |
| `ComponentType` as stored | the **code** (`LS`, `CW`), where every Lump Sum reader joins on the **name** (`Lump Sum`). Lineage-wide: 245,367 `CW` and 100,566 `EAO` rows store the code against 5 rows holding a name |
| Duplicate components | 2024 parents (server-loaded, before the grain fix): **53 of 59** carry an identical duplicate; their children carry two copies each (2,237 pairs). 2023 and 2025, loaded after the fix: none |
| Per-year rows | **10 per component** (start year to start year + 9); only the start year non-zero and carrying a UACS; the empty rows hold `''`, not `NULL` |
| Funding lines | **0** on every parent except `P00700002LS`, whose one line came through the loader at the post-itemization figure |
| `Thrust` (Sub-Category) | 2024: `0` on 55 (not a PAPKey); 2023 GAA-R rows arrived with valid PAPKeys except `P00730052LS` |
| **Itemized children** | **4,038** in the source under 74 parents: 2023 — 2,010 under 30 (CSSP 2,001 / 26, LP 1 / 1, OO-1 8 / 3); 2024 — 2,028 under 22 (SSP 2,024 / 19, OO-1 3 / 2, LP 1 / 1); 2025 — none. `P00851066VS` is named by a note and has no `dbo.project` row, so 4,037 can be linked |
| How the old model records itemization | as a `dbo.history` row against the **child**, in the GAA-R program only: `'Itemized from Project: <parent>'` (`dbo.vw_notes` is the view over it). Not in `alternate_id`: of 42,589 such notes, none has the child's `alternate_id` equal to the parent it names |
| What itemization did to the parent's stored cost | **reduced** it. `P00730052LS`: 11,000,000,000 at GAA, 9,826,178,558.32 at GAA-R, 446 children costing 10,429,053,146.08. The GAA-R LS figure is therefore the **remaining balance**, not the allocation; the GAA figure is not a reliable original either (top-ups happened at GAA-R: 20 of 26 CSSP parents satisfy GAA − GAA-R = Σ children, 6 do not) |
| `AlternateId` on a parent | its own ProjectId; the four `P008…` of 2024 carry their pre-renumber id (PK `…P00800001LS`, ProjectId `P00800005LS`, AlternateId `P00800001LS`) |
| Required detail fields | `Description`, `OperatingUnit`, `Origin`, `Agency`, `RegionWide` all present |
| `MY…LS` identifiers | 16 projects reference `MY00003005LS` or `MY00040003LS`; excluded by instruction — Appendix A |

The identity that holds, and the one the script writes to:

```
Remaining          = the parent's stored LS cost at GAA-R          (per-year Amount, never rewritten)
ItemizedTotal      = Σ children's latest-revision component costs  (the view computes it)
OriginalAllocation = Remaining + ItemizedTotal                     (funding line, and component Total = Σ funding)
```

---

## 3. What the script does, and why

One idempotent T-SQL script in the house style of `LumpSum.SampleData.Dev.sql` §4b–4e: `XACT_ABORT`, one transaction for the writes, a `@DryRun` switch, a printed report per section, `@Who = N'migrate:LumpSum.Migrate.LegacyLSProjects.2026-09-14'` on every `CreatedBy` / `UpdatedBy`. No C# changes, no view changes: the writers already handle the migrated shape (`LumpsumHelper.SyncLSToFundingAsync` / `MoveLSBalanceAsync` derive from exactly the rows it leaves behind).

| § | Does |
|---|---|
| 0 | Prints server / database / time; refuses `myps_db` with `RAISERROR` **and `SET NOEXEC ON`** (§6) |
| 1 scope | Latest live revision `ProjectId LIKE 'P%LS' OR 'BP%LS' OR ProjectPK LIKE '%LS'`, `NOT LIKE 'MY%'`, `ParentProjectId IS NULL`, program `StartYear >= 2023`, **and** any of: **R1** not typed `LS`; **R2** a live non-Lump-Sum component on the latest revision; **R3** named by an `'Itemized from Project'` note whose child is still unlinked; **R4** Σ live funding ≠ `Remaining + Σ linked children`. Prints scope by program and by reason. A parent already on the model that satisfies none is left alone — that is the idempotence |
| 2 lookups | The `'LS'` component type and the `DPWH-GAA-<StartYear>` funding agreement under `GOP` for every program year in scope (2023 = 49, 2024 = 64, 2025 = 67); refuses if any is missing rather than writing blind |
| 3 components | All live components on the latest revision. Survivor = the `LS`-typed one (by name or code, either column) if any, else the lowest Id — the row `FindLSComponentAsync` would return, so the script and the application agree about which row is the allocation. Identical copies retired (soft-deleted with their per-year rows); a copy that **differs** is reported, the parent marked Skip, surfacing as DRIFT rather than being averaged. Any other live component **folded** into the survivor (Total added, earliest per-year Amount added, printed). The survivor converted: `ComponentType 'Lump Sum'`, `ComponentId 'LS'` on it and its per-year rows, `Description 'Lump Sum'` where it said `'Civil Works'`. This conversion is what made the parents visible at all: `vLumpSumSet`, `FindLSComponentAsync` and `GetLSComponentAsync` all join on the name, and the first dry run found 0 LS components across 59 parents until it was added |
| 4 per-year | Retire rows that are **empty and silent**: `Amount = 0`, no UACS (`NULL` **or `''`** — these rows hold blanks, and `IS NULL` alone matched nothing), not the program's start year. Assert exactly one live row remains. Normalise blank UACS to `NULL` (`vLumpSumSet` picks the project's UACS with `IS NOT NULL ORDER BY Year, Id`, so a blank row sorting first would be surfaced as the code). Fill `StartDate` / `EndDate` from the row's own year, the 1 Jan – 31 Dec derivation `yearBounds()` and `CreateLumpSum` use, without which the Component Cost dialog refuses to save. Clamp a `Year` outside 2000–2100 to the start year (none needed it) |
| 5 identity | `ProjectType = 'LS'` (the seek key `IX_tProjects_ProjectType`), `IsPublishable = 0` (a Lump Sum Project is never published to PCMA). `ParentProjectId`, `ItemizationType`, `ProjectStatus` stay NULL on a parent — they are the child's columns. `AlternateId` left as found: on a parent it is free text |
| 5b children | Parses `'Itemized from Project: <parent>'` from `tProjectNotes` on the target. Parent must be in scope or already listed; child must have a live revision; unresolved links printed (the one `P00851066VS`). For each child: retire identical duplicate components and their per-year rows (same rule as §3), then stamp it exactly as `ImportItemizedProjects` does — `ParentProjectId` = parent's latest `ProjectId`, `ProjectType 'LS'`, `ItemizationType 'Itemized'`, `ProjectStatus 'potential'` (`'scheduled'` if published), revision `AlternateId` = parent's `ProjectId` (rule 2026-09-05), `IsWalletDraw = 1` on its live funding lines. A child already linked to the same parent is skipped; one linked to a different parent is printed and left |
| 6 Sub-Category | For a `Thrust` that is not an allowed, in-window PAPKey for its Category (`tOptionProjectCategoryToPAPMap` × `tOptionProjectThrustList`'s validity window, the predicate `ValidateRequiredFieldsAsync` enforces — without it Save, Replenish and Import are dead): keyword rules against the Description (`%Building%` → 1031, `%Persons with Disabilities%` → 1141, `%Rainwater Collector%` → 1138, `%Septage and Sewerage%` → 1137, `%Expressway%` → 1078, `%Facilit%` → 1031), tie → lowest, no match → **lowest allowed PAPKey as a printed placeholder**. Every rule is validated against the allowed set before use and discarded with a warning if its target is not allowed there |
| 7 allocation | `Kids` := Σ linked children's latest-revision live component Totals. A parent with no live funding line gets one at `Remaining + Kids` (`GOP`, `DPWH-GAA-<year>`, 100%, `IsWalletDraw = 0` — that flag marks a *child's* draw). A parent whose only line is the migration's own (this script's, or the loader's on a revision it imported) is **raised** to that figure, old and new printed; anything a person entered is left and shows as DRIFT. Then component `Total := Σ funding`. The stored per-year `Amount` is never written: it *is* the remaining balance, and `Remaining = Total − Kids` is asserted, not derived |
| 8 verification | After commit: orphan revisions / costs / per-year / funding; children with no parent; in-scope parents not listed; parents not holding exactly one LS component; allocation drift; still-invalid Sub-Category; skipped; **`ParentsHoldingANonLSComponent`, `NotedChildrenUnlinked`, `LinkedChildrenWithDuplicateComponents`, `ChildrenLinkedToAnUnlistedParent`, `LinkedChildrenMissingStamps`** — all must be 0 — then `vLumpSumSet` / `vLumpSumChildSet` counts and the per-year table |

**The harness**, `LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql`: under an existing 2024 program it injects `P00899901LS` (`'NULL'`, one `CW1` component, no funding), `P00899902LS` (typed, a `Lump Sum` component plus a stray `CW1`) and a child `P00899903LZ` (two identical `CW1` copies, a funding line, a note naming `P00899901LS`), runs the migration inside a transaction, asserts eight outcomes (both parents listed; `P00899901LS` allocation 163,000,000 / remaining 123,000,000 / itemized 40,000,000 with one child holding one live component; `P00899902LS` folded; invariant OK; the new counters 0) and rolls back. **PASS 8 of 8** before the real run.

---

## 4. The two runs

### 4.1 First run — the 59 parents of 2024, before the load

Written and run against the 2024 data alone, before the 2023 / 2025 groups were on the target. Dry-run three times; each dry run exposed something the plan had assumed: that `ComponentType` held the name (it holds the code — 0 LS components found until §3's name-or-code predicate), that empty per-year rows held `NULL` UACS (they hold `''` — 0 rows retired until the predicate widened), and that `tPrograms` has a `ProgramId` column (it does not; the readable key comes from the project).

```
Live 'LS' components found: 112 across 59 parent(s).
Retired 53 duplicate 'LS' component(s) and 530 of their per-year row(s).
ComponentType normalised to the canonical name on 59 component row(s).
Retired 531 empty per-year row(s).   Blank UACS cleared to NULL on 2.   Filled Start/End dates on 59.
ProjectType set to 'LS' on 59 project(s).   Sub-Category set on 55 revision(s).
Added 59 funding line(s).
Allocation derived from the funding lines on 0 component(s).   Remaining balance set on 0 per-year row(s).
Committed.
```

Every counter 0, `vLumpSumSet` 62, `vLumpSumChildSet` 18, invariant OK on 62, second run 0 in scope. **And it was incomplete** — see §5.

### 4.2 Revision 2 — 2023 onwards, after the load, 11:59

Scope **83**: R1 61 (the 57 of 2023 and the 4 of 2025), R2 4 (the 2025 four, `CW1`), R3 52 (the 22 of 2024 and 30 of 2023 with unlinked noted children), R4 0. The 37 parents of 2024 without children were **not** re-admitted: typed, one `Lump Sum` component, no notes, in balance — exactly the idempotence the first run promised.

```
Live components found: 83 across 83 parent(s); 79 already typed as Lump Sum.
Retired 0 surplus component(s) and 0 of their per-year row(s).
CONVERTING these components to the Lump Sum allocation:
  P00900001LS  CW/CW1  500,000,000     P00900002LS  CW/CW1  100,000,000
  P00900003LS  CW/CW1  100,000,000     P00900004LS  CW/CW1  100,000,000
ComponentType set to the canonical Lump Sum name on 61 component row(s).
ComponentId normalised to 'LS' on 4 component row(s) and on 40 per-year row(s).
Retired 549 empty per-year row(s).   Filled Start/End dates on 61 per-year row(s).
ProjectType set to 'LS' on 61 project(s).
Itemization notes naming a parent in scope: 4037 child(ren) under 52 parent(s).
Retired 2237 duplicate child component(s) and 22370 of their per-year row(s).   -- all 2024
Linked 4037 child(ren) to their Lump Sum parent.
Alternate ID set to the parent's Project ID on 4037 child revision(s).
IsWalletDraw set on 4032 child funding line(s).                                 -- 5 children have no line in the source
Sub-Category set on 1 revision(s).                                              -- P00730052LS, fallback
Added 60 funding line(s) at Remaining + children.
Raised 23 funding line(s).
Allocation (component Total) set from the funding lines on 52 component(s).
Remaining = Total - children holds on every derived parent.
Committed.
```

Nothing folded: no in-scope parent held a second component. The 2,237 duplicate child components are the 2024 children's second copies from the loader's component-grain defect (load write-up §3.1); the 2023 and 2025 children, loaded after the fix, had none. The 60 added lines are the 56 of 2023 that had none and the 4 of 2025. The 23 raised lines are the 22 the first run wrote at the remaining balance plus `P00700002LS`, whose one line came through the loader at the same post-itemization figure. For the shape of it:

| Parent | Children | Line was | Children hold | Line now |
|---|---:|---:|---:|---:|
| `P00830018LS` | 242 | 0 | 7,998,736,757.37 | 7,998,736,757.37 |
| `P00830004LS` | 140 | 0 | 39,600,000.00 | 39,600,000.00 |
| `P00830001LS` | 68 | 627,157.82 | 32,972,842.18 | 33,600,000.00 |
| `P00700002LS` | 8 | 128,776,000.00 | 104,754,000.00 | 233,530,000.00 (= the source's GAA cost) |
| `P00730052LS` | 446 | none | 10,429,053,146.08 | 20,255,231,704.40 |

Six parents of 2024 (`P00800007LS`, `P00830004LS`, `P00830010LS`, `P00830013LS`, `P00830014LS`, `P00830018LS`) list at **remaining ₱0** because their children hold every peso: they are fully itemized, not unfunded.

**Verification**

| Check | Wanted | Got |
|---|---|---|
| Orphan revisions / costs / per-year / funding; children with no parent | 0 | **0 / 0 / 0 / 0 / 0** |
| Not listed / not exactly one LS component / drift / invalid Sub-Category / skipped | 0 | **0 / 0 / 0 / 0 / 0** |
| Non-LS component / noted children unlinked / linked children with duplicates / linked to an unlisted parent / missing stamps | 0 | **0 / 0 / 0 / 0 / 0** |
| `vLumpSumSet` | 123 | **123** |
| `vLumpSumChildSet` | 4,055 = 18 sample + 2,010 + 2,027 | **4,055** |
| Invariant on all 123 | OK | **OK** |
| Second run | 0 in scope | **"Lump Sum parents in scope: 0"** |

These checks are not vacuous (§5): `NotedChildrenUnlinked` compares the source's own itemization record against the target's links, and the per-year `Itemized` figures were confirmed against `MYPS_BAK` per parent before the run (`verify_itemization_notes.py`). The 2024 `Remaining` is the first run's "allocation" to the centavo — that figure was the balance all along.

**Through the API and UI** (scratch build on 5016 / Vite 8090, connection string verified `Database=myps_db_dev_200`): `LumpSumDetails` for `P00730052LS` reports 20,255,231,704.40 / 9,826,178,558.32 / 10,429,053,146.08 / 446 and `ShowItemizedProjects` pages 446 children carrying `ParentProjectId`, `AlternateId` = parent, `ProjectType 'LS'`, `ItemizationType 'Itemized'`; `P00900001LS` holds one `Lump Sum` / `LS` component of 500,000,000 on `DPWH-GAA-2025`; `P00830018LS` 7,998,736,757.37 / 0 / 242. A faithful `UpdateLumpSum` echo returns 200 and changes no figure (an echo that omits a detail field is refused by name under the Approved-program guard, as designed). Both detail pages render the three figures, the Approved banner and the one component; the list finds `P00830018LS` by description. `ls-contract`, `ls-list-tolerance` and `ls-module-ui-walkthrough.narrated`: **44 passed**.

---

## 5. What the first run got wrong, and the lesson

The first run's load-bearing finding was **"there are no children"**: the parent's Project ID was searched for in `tProjectRevisions.AlternateId` (as ProjectId, PK suffix, own AlternateId, ExternalId, numeric core), `tProjects.ParentProjectId` and `tProjects.ParentWalletId`, and found nowhere. Every one of those seven results is still accurate. The conclusion drawn from them was not: 22 of the 59 have **2,028** children between them, recorded in `dbo.history` — a free-text log the old model uses for a relational fact, and the one place the search did not look because it looked in exactly the places the *new* model uses.

Three things followed from it. The funding line was written at the stored per-year `Amount`, which is the **remaining balance**, so 22 parents' allocations were short by their itemized total. The six ₱0 parents were written up as "unfunded line items" when a ₱0 balance under 243 children was the clearest signal in the data that the finding was wrong. And three of the green checks were vacuous: `Children with no parent = 0` had nothing to examine because membership *is* `ParentProjectId IS NOT NULL`; `vLumpSumChildSet = 18 unchanged` confirmed the belief it was meant to test; `Allocation drift = 0` compared `Total` against a `Remaining` that was the same number plus an `Itemized` of 0.

None of it was destructive. The stored per-year `Amount` is the balance and always was, so nothing written needed undoing; Revision 2 re-admits the affected parents under R3 and raises their lines. A database that received only the first version is repaired by running Revision 2. What is worth keeping:

- **"Absent from every column I know about" is not "absent".** Search the source's own record of the fact, not the target's columns for it.
- **A green check that is satisfied by the empty case proves nothing.** The check that would have caught this is an independent one — the source's itemization notes against the target's links — and it now exists (`verify_itemization_notes.py`).

---

## 6. Guard note — `SET NOEXEC ON`, not `RAISERROR` alone

Both refusal guards (the `myps_db` check in §0 and the lookup checks in §2) set `NOEXEC` after raising. `XACT_ABORT` does not cover `RAISERROR`: a severity-16 `RAISERROR` inside the transaction prints its message and the next statement runs anyway, so a guard written that way would have announced the missing funding agreement and then inserted the lines naming it. The severity-20 `WITH LOG` form the 2026-09-10 migration uses cannot be raised by a non-sysadmin login at all (Msg 2754, the batch aborts, every later batch runs) — the fail-open the bring-up review recorded as finding #3, which remains open against that file. `NOEXEC` does not care who raised what.

---

## 7. Deliberately left alone

| Left alone | Why |
|---|---|
| **`MY…LS` identifiers** (16 projects) | A module not implemented yet — the instruction, and the only reason. Appendix A |
| **`ProjectType = 'NULL'` on ~56,700 other projects** | The loader's signature and a genuine restore artifact; its own decision. Only the parents and their linked children were typed |
| **`ComponentType` as a code on ~353,000 other rows** | Same reasoning. Only the parents' allocation components were normalised |
| **~174,000 duplicated component pairs outside the linked children** | The server load's grain defect; recorded in the load write-up, untouched |
| **The older live revisions** | Still carry the duplicate / ten-row shape. Every Lump Sum view reads the latest live revision only, and rewriting history is not this script's job |
| **Two Sub-Category placeholders** | `P00830018LS` (2024) and `P00730052LS` (2023), both "Rehabilitation of Disaster-Related Infrastructure and Other Facilities": no rule matched and Category 29 offers no disaster-rehabilitation thrust, so both took the lowest allowed PAPKey, `1054`. Semantically wrong, printed, recorded here, editable once a program is set back to Working; the alternative (`Thrust = 0`) makes the project unusable and does so invisibly |
| **`sp_RBP` / `a1_usp_AIP2`**, **`READ_COMMITTED_SNAPSHOT`** | Live-only fixes and a separate script; see the 2026-09-10 migration's header |

---

## 8. Before running against `192.168.50.200`

Run **only Revision 2** — the file at the path in the header as committed in `585904f4` or later. The server has neither the 2023 / 2025 groups nor the `tProjectNotes` rows the link travels in: the group load comes first, or Revision 2 finds no children and writes the 2024 parents exactly as the first version did. Then:

1. **Back up.** §3, §4 and §5b soft-delete rows; reversible by hand, not by re-running the script.
2. **Run the harness**, then **dry-run** (`@DryRun = 1` in section 2b) and read the scope-by-reason table, the CONVERTING table and the Sub-Category pick table. The keyword rules were written against this lineage's descriptions; a description the script has never seen falls back, and every fallback is a row for a human.
3. **Expect the duplicate-pair branch to matter.** None differed here. If any differ there they are reported, skipped, and surface as DRIFT — the designed outcome.
4. **Check the funding agreements.** `DPWH-GAA-<year>` under `GOP` must be an active row for every program year in scope, or §2 refuses.
5. **Confirm the scope count before committing.** Here it was 59 on the first run and 83 on Revision 2; a wildly different number means the predicate is finding something else.

---

## Appendix A — `MY…LS` identifiers: inventory, not migrated

`myps_db_dev_200` carries identifiers that end in `LS` but begin with `MY`. They belong to a **different module and data model, not yet implemented**, and were excluded from this migration by instruction. This is the record of what was left behind, so whoever builds that module has the set in front of them.

The scope predicate states the exclusion (`AND lr.ProjectId NOT LIKE N'MY%'`). That clause matches nothing today: **no `MY…LS` value is a `tProjects.ProjectPK` or a `tProjectRevisions.ProjectId`.** They exist only as references, in `tProjects.MYId`, `tProjects.ExternalId` and `tProjectRevisions.AlternateId`, and every one is dangling — 15 projects point at `MY00003005LS` and 1 at `MY00040003LS`, and neither is a project key anywhere in the database. The clause is there so a future restore that does carry them as keys is excluded by the predicate rather than by luck. `MYPS_BAK.dbo.history` holds no row mentioning a `MY…LS` id, so their appearance in `AlternateId` says nothing about itemization either way.

### Referencing `MY00003005LS` — 15 projects

| ProjectPK | ProjectId (latest live rev) | AlternateId (latest live rev) | MYId / ExternalId | ProgramId | Program |
|---|---|---|---|---|---|
| `MP_P_CO-PS-635_07202023_140408_P00402036LZ` | `P00402036LZ` | `P00402036LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00706284VS` | `P00801197VS` | `P00706284VS` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00706286VS` | `P00801198VS` | `P00706286VS` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713367LZ` | `P00713367LZ` | `P00713367LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713368LZ` | `P00713368LZ` | `DPWH-HGAB-05011` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713369LZ` | `P00713369LZ` | `P00713369LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713370LZ` | `P00713370LZ` | `P00713370LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713371LZ` | `P00713371LZ` | `P00713371LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713372LZ` | `P00713372LZ` | `P00713372LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713373LZ` | `P00713373LZ` | `P00713373LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713374LZ` | `P00713374LZ` | `P00713374LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713375LZ` | `P00713375LZ` | `P00713375LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713376LZ` | `P00713376LZ` | `P00713376LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `MP_P_CO-PS-635_07202023_140408_P00713377LZ` | `P00713377LZ` | `P00713377LZ` | `MY00003005LS` | `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 |
| `BP01009254VS` | `BP01009254VS` | `P00706285VS` | `MY00003005LS` | `LAPTOP-DG33KKDI_09102026_152436` | BP 2026 OO-1 Region 2 Project |

### Referencing `MY00040003LS` — 1 project

| ProjectPK | ProjectId (latest live rev) | AlternateId (latest live rev) | MYId / ExternalId | ProgramId | Program |
|---|---|---|---|---|---|
| `MP_P_CO-PS-535_08082023_100655_P00655042VS` | `P00655042VS` | `MY00040003LS` | `MY00040003LS` | `P_CO-PS-278_01262024_140207` | GAA 2024 LP |

### Notes on the rows

- **`ProjectType` is `'NULL'`** (the string) on all 15 GAA 2024 rows — the lineage-wide artifact, not specific to these.
- **`BP01009254VS` is a test fixture, not 2024 data.** Its program was created on 2026-09-10 on someone's laptop and its `ProjectType` is a real `'VS'`; it carries `MY00003005LS` because it was copied from one of the rows above. Noise unless the new module wants it.
- **`P00713368LZ` carries `DPWH-HGAB-05011` in `AlternateId`** — a House GAB reference, the one row whose `AlternateId` is neither its own id nor an `MY…LS` value.
- **Only `P00655042VS` still carries an `MY…LS` value in the latest live revision's `AlternateId`.** For the other 14 the reference sits in `MYId` / `ExternalId` and in *earlier* revisions; a query against the latest revision alone finds 1 of the 16, which is why the query below reads all three columns.

### The queries that produced this

```sql
SET NOCOUNT ON;
SELECT DISTINCT p.ProjectPK, lr.ProjectId, lr.AlternateId, ISNULL(p.ProjectType, '<null>') AS ProjectType,
       p.MYId, p.ExternalId, p.ProgramId, ISNULL(pl.[Name], '<none>') AS ProgramName
FROM   dbo.tProjects p
CROSS APPLY (SELECT TOP 1 r.* FROM dbo.tProjectRevisions r
             WHERE r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0 ORDER BY r.Id DESC) lr
LEFT JOIN dbo.vProgramLatest pl ON pl.ProgramPK = p.ProgramFK
WHERE  p.MYId LIKE 'MY%LS' OR p.ExternalId LIKE 'MY%LS' OR lr.AlternateId LIKE 'MY%LS'
ORDER  BY p.ProjectPK;

SELECT COUNT(*) FROM dbo.tProjects         WHERE ProjectPK LIKE 'MY%LS';   -- 0
SELECT COUNT(*) FROM dbo.tProjectRevisions WHERE ProjectId LIKE 'MY%LS';   -- 0

SELECT r.ProjectFK, r.Id AS RevisionId, r.ProjectId, r.AlternateId, r.IsDeleted   -- every revision, not just the latest
FROM   dbo.tProjectRevisions r WHERE r.AlternateId LIKE 'MY%LS' ORDER BY r.ProjectFK, r.Id;
```

---

## Related

- `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql` and `…Proof.Dev.sql`
- `MYPS_BAK_PROGRAM_GROUP_LOAD.md` — the load that precedes this migration and carries the notes
- `MYPS_DEV_200_DATABASE_BRINGUP.md` — Steps 3b and 3c
- `documents/plans/legacy-ls-migration.md` — the plan and its Completion Log
- `FE/src/pages/LumpSum/LumpSum.md` — the model, the Approved-program rule, and the migrated-data paragraph
