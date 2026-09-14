# Legacy 2024 Lump Sum projects — migration onto the V3 data model

**Date:** 2026-09-14
**Database:** `localhost` / `myps_db_dev_200`
**Script:** `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`
**Backup taken:** `…\MSSQL\Backup\myps_db_dev_200_pre_legacyls_20260914.bak` (196,121 pages, compressed)
**Result:** 59 projects migrated. Every verification check 0. Second run reports 0 in scope.

---

## 1. What this closes

`Migration.SchemaAndProgrammability.2026-09-10.sql` gave this lineage the Lump Sum v3 **schema** and stated in its own header that it contains **no data migrations**. It was right to: on 2026-09-10 the column it would have keyed off (`ParentProjectId`) had just been created empty.

But `myps_db_dev_200` carries **59 Lump Sum projects migrated from 2024 data** — `tProjects.ProjectPK` ending in `LS`, under three Approved GAA 2024 programs — and they predate the model entirely. This is the data migration for exactly that set.

| | Before | After |
|---|---|---|
| Projects listed by `vLumpSumSet` | 3 (the MyMYPS sample) | **62** |
| Of which the 2024 legacy set | 0 | **59** |
| Allocation held by the 59 | — | **₱4,778,229,699.08** |
| Allocation invariant (`Total = Remaining + Itemized`) | OK on 3 | **OK on 62** |
| `vLumpSumChildSet` | 18 | **18** (unchanged) |

Per program:

| ProgramId | Program | Projects | Allocation | Remaining | Itemized |
|---|---|---:|---:|---:|---:|
| `P_CO-PS-634_01222024_174001` | GAA 2024 SSP | 34 | 578,425,699.08 | 578,425,699.08 | 0 |
| `P_CO-PS-278_01262024_140207` | GAA 2024 LP | 21 | 3,689,804,000.00 | 3,689,804,000.00 | 0 |
| `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 | 4 | 510,000,000.00 | 510,000,000.00 | 0 |
| `P_CO-PS-535_03252025_073824` | Trust Funds 2025 (sample, untouched) | 3 | 540,000,000.00 | 108,000,000.00 | 432,000,000.00 |

All three 2024 programs are **Approved at GAA-R**. Under the rule of 2026-09-09 that means creating and deleting a Lump Sum Project in them is refused, and the project's details and component render read-only — while Save, Replenish, Import and child delete keep working. That is the expected state for this data, not a regression.

---

## 2. The data as found

Verified against the live database on 2026-09-14 before anything was written.

| Fact | Value |
|---|---|
| Legacy parents | 59 — `ProjectPK LIKE '%LS' AND ProjectType <> 'LS' AND ParentProjectId IS NULL` |
| `ProjectType` on them | the literal string **`'NULL'`** — an artifact shared by 56,769 projects on this lineage |
| Live revisions per parent | 2 (older at `GAA`, latest at `GAA-R`); the four `P008…` have 5 |
| `AlternateId` on the parent | its own ProjectId; the `P008` four carry their pre-renumber id (PK `…P00800001LS`, ProjectId `P00800005LS`, AlternateId `P00800001LS`) |
| **Itemized children** | **none** — see §3 |
| `ComponentType` on their LS components | the **code** `'LS'`, not the name `'Lump Sum'` — see §4.1 |
| LS components on the latest revision | 112 across 59: **53 carry an identical duplicate**, 6 carry one with `Total = 0` |
| Per-year rows | **10 per component** (2024–2033); only 2024 non-zero, only 2024 carries a UACS; the empty rows hold `''`, not `NULL` |
| Funding lines | **0** on every parent |
| `Thrust` | **0** on 55 (not a PAPKey); the `P008` four already carry 1024 / 1026 / 1027 / 1124 |
| Tier / Category | Tier 1; Categories 29 (34), 30 (21), 16 (4) |
| Required detail fields | `Description`, `OperatingUnit`, `Origin`, `Agency`, `RegionWide` all present — no gaps |

---

## 3. There are no children — the evidence

This is the load-bearing finding, because it determines the balance: with no children, `Remaining = Total` for all 59 and `ItemizedTotal` is 0.

The parent's Project ID was searched for in every place a child could record it:

| Searched | Hits |
|---|---|
| `tProjectRevisions.AlternateId` = parent's `ProjectId` | 0 |
| `tProjectRevisions.AlternateId` = parent's `ProjectPK` suffix | 0 |
| `tProjectRevisions.AlternateId` = parent's own `AlternateId` | 0 |
| `tProjectRevisions.AlternateId` = parent's `ExternalId` | 0 |
| `tProjectRevisions.AlternateId` **contains** the parent's numeric core | 13 — **all false positives** |
| `tProjects.ParentProjectId` → any of the 59 | 0 |
| `tProjects.ParentWalletId` (wallet era) — anywhere in the database | 0 |

The 13 numeric-core matches are unrelated regular projects that merely share a running number: `P00800005VS`, `P00800005LZ`, `P00800005MN` against parent `P00800005LS`, and so on. Different island codes, different projects, no relationship.

**This is the opposite of the `MY…LS` identifiers**, which *do* have `AlternateId`-linked children (15 + 1) and which were excluded from this migration — see `documents/MYPS_LS_MY_Prefixed_Projects.md`.

---

## 4. What the migration did, and why

### 4.1 `ComponentType`: the code → the canonical name  *(the change that actually made them visible)*

`vLumpSumSet` decides membership with

```sql
LEFT JOIN tOptionProjectComponentType opt ON opt.ComponentName = cc.ComponentType
... MAX(CASE WHEN opt.ComponentId = 'LS' THEN 1 ELSE 0 END) AS HasLSComponent
```

— it joins on the **name**. These rows store the **code**. So the join found nothing, `HasLSComponent` came back 0, and **flipping `ProjectType` alone would have listed none of them.** The same applies to `LumpsumHelper.FindLSComponentAsync` and `GetLSComponentAsync`, which is how every *writer* locates the allocation row.

The first dry run is what exposed this: it reported *"Live 'LS' components found: 0 across 0 parent(s)"* and proposed to skip all 59. Had the script been written to the plan and run without a dry run, it would have flipped 59 types and changed nothing a user could see.

This is lineage-wide, not a Lump Sum quirk:

| `ComponentType` as stored | Rows | Shape |
|---|---:|---|
| `CW` | 245,367 | code |
| `EAO` | 100,566 | code |
| `ROW` | 6,967 | code |
| `LS` | 254 | code |
| `Civil Works` | 76 | name |
| `Lump Sum` | 5 | name |

**Scope taken:** only the 59 parents' own LS components (59 rows). The wider artifact is real and should be decided on its own, exactly like `ProjectType = 'NULL'`. The membership predicate now accepts *either* spelling, so a parent someone has since re-saved through the form is still found.

### 4.2 One live LS component per parent

53 of 59 carry a duplicate — same `Total`, same per-year rows, same `CreatedDate`, same `CreatedBy` (`cabalrla`). `vLumpSumSet` **sums** the components into `LSCost`, so every one of those would have reported double its allocation.

The survivor is the **lowest Id** — arbitrary but stable, and the row `FindLSComponentAsync` would return (`OrderBy(x => x.Id).FirstOrDefault`), so the script and the application agree about which row is the allocation.

**Identical, or hands off.** A duplicate proved a true copy is a copy; one that differs is data, and deleting it would destroy a figure nobody has looked at. Compared on `Total`, live per-year count, live per-year Σ and live UACS-bearing count. A parent whose duplicates differ is reported, marked `Skip`, and sits out the rest — surfacing as DRIFT rather than being silently averaged. **None differed here**; the branch exists for the server copy.

Result: 53 components and their 530 per-year rows soft-deleted.

### 4.3 One live per-year row per component  *(decision D1)*

Ten rows, 2024–2033, nine of them empty. The module creates exactly one (`CreateLumpSum`, at the program's start year, carrying the whole allocation) and the Component Cost dialog renders Year and Amount read-only with no "Add Year" — so nine empty years are nine read-only ₱0.00 rows a user cannot remove.

Retired only when **empty and silent**: `Amount = 0`, no UACS, and not the program's start year.

**"No UACS" had to mean null *or* blank.** These rows hold `''` where the application stores `NULL`, and `UACS IS NULL` alone matched none of them — the second dry run retired 0 rows and reported all 59 parents as still having ten. Blank is a hazard in its own right: `vLumpSumSet` picks the project's UACS with `WHERE cy.UACS IS NOT NULL ORDER BY cy.Year, cy.Id`, so a blank row sorting first would be surfaced as the project's code. Survivors are normalised to `NULL`, which is the invariant `NormalizeUacs` maintains.

Result: 531 empty rows retired (59 × 9), 2 blank UACS cleared to `NULL`, and `StartDate`/`EndDate` filled on the 59 survivors from their own year — the same 1 Jan – 31 Dec derivation `yearBounds()` and `CreateLumpSum` use, and without which the Component Cost dialog **refuses to save at all**.

### 4.4 Identity

`ProjectType = 'LS'` (the seek key `vLumpSumSet` uses, `IX_tProjects_ProjectType`) and `IsPublishable = 0` (a Lump Sum Project is never published to PCMA — Operations Guide D.3).

`ParentProjectId`, `ItemizationType` and `ProjectStatus` stay **NULL**: they are the *child's* columns, and `vLumpSumChildSet`'s membership is `ParentProjectId IS NOT NULL`. Writing them would move all 59 into the children view.

`AlternateId` is left exactly as found. On a **parent** it is free text (`CreateLumpSum` writes `dto.AlternateId` straight through); the "AlternateId is the parent's Project ID" rule of 2026-09-05 is the **child's**, and there are no children. The `P008` four keep their pre-renumber id, which is a fact about them worth keeping.

This flip is also what makes the script idempotent — §1's predicate excludes exactly what §5 writes.

### 4.5 Sub-Category  *(decision D3)*

55 carry `Thrust = 0`. That is not a PAPKey — the same "a row Id where a PAPKey belongs" shape `LumpSum.SampleData.Dev.sql` §4d found on the MyMYPS parents — and `ValidateRequiredFieldsAsync` refuses it, so **Save, Replenish and Import are all dead** on those projects until it is resolved.

Unlike the sample script, these parents have no children and no work items, so there is no scope of work to read a family off. The Description is the only evidence — and here it is unusually good evidence, because these are GAA line items whose text is near-verbatim the thrust's own wording.

Candidates are exactly what the validators and the FE dropdown allow: PAPKeys mapped to the Category by `tOptionProjectCategoryToPAPMap`, valid in the program's `StartYear` per `tOptionProjectThrustList`'s window. **Every rule is validated against that set before use** and discarded with a warning if its target is not allowed — so a rule right here and wrong on the server copy fails loudly instead of writing a plausible value.

| Matched by | Rows | PAPKey |
|---|---:|---|
| `%Building%` | 19 | 1031 Buildings and Other Structures – Multipurpose / Facilities |
| `%Persons with Disabilities%` | 16 | 1141 (worded identically to the projects) |
| `%Rainwater Collector%` | 16 | 1138 Rain Water Collectors in Public Facilities |
| `%Septage and Sewerage%` | 1 | 1137 |
| `%Expressway%` | 1 | 1078 National Roads – PPP Strategic Support Fund |
| `%Facilit%` | 1 | 1031 |
| **fallback: lowest allowed** | **1** | **1054 — see below** |

> **`P00830018LS` needs a human.** "Rehabilitation of Disaster-Related Infrastructure and Other Facilities" matches no rule, and Category 29 offers no disaster-rehabilitation thrust. It took the deterministic fallback (lowest allowed PAPKey, 1054 "Convergence… Water Supply / Septage / Rainwater Collector"), which is a **placeholder, not an answer**. It keeps the project saveable; it is semantically wrong and should be corrected.
>
> The alternative — leaving `Thrust = 0` — makes the project unusable and does so invisibly. A wrong value that is printed, recorded here, and editable is the better failure.

### 4.6 The allocation

Not one parent had a funding line, and since 2026-09-06 **the allocation *is* the sum of the live funding lines**: `SyncLSToFundingAsync` sets `Total := Σ funding` on every save. A parent left without one does not merely look odd in the funding table — the first time anyone pressed Save, its allocation would be rewritten to **zero**.

One line per parent, at 100%, for the component's current `Total`, `IsWalletDraw = 0` (that flag marks a *child's* draw against its parent; flagging a Lump Sum Project's own funding would make it a claimant against itself). Source `GOP`, agreement `DPWH-GAA-2024` — these are GAA 2024 programs, and it is the 2024 analogue of the `DPWH-GAA-2025` line the sample carries. Resolved from `tOptionFundingAgreement` and **refused if absent**, rather than written blind.

Then the two derivations, computed exactly as `vLumpSumSet` computes them:

```
Total  := Σ live funding lines
Amount := Total − Σ children's latest-live-revision costs   (= Total; there are none)
```

Both reported **0 rows changed** — correctly. The funding line was inserted *at* the component's `Total`, and the surviving per-year row already held that figure, so the model was already satisfied. The statements remain because they are the definition, and on the server copy they may well bite.

**Six parents have `Total = 0`** (decision D2): `P00800007LS`, `P00830004LS`, `P00830010LS`, `P00830013LS`, `P00830014LS`, `P00830018LS`. They got a ₱0 line and list with allocation 0 / remaining 0. That is truthful — they are unfunded line items — and Replenish is how they would be funded later.

---

## 5. Run log

```
Live 'LS' components found: 112 across 59 parent(s).
Retired 53 duplicate 'LS' component(s) and 530 of their per-year row(s).
ComponentType normalised to the canonical name on 59 component row(s).
ComponentId normalised to 'LS' on 0 component row(s).
Retired 531 empty per-year row(s).
Blank UACS cleared to NULL on 2 per-year row(s).
Filled Start/End dates on 59 per-year row(s).
ProjectType set to 'LS' on 59 project(s).
Sub-Category set on 55 revision(s).
Added 59 funding line(s).
Allocation derived from the funding lines on 0 component(s).
Remaining balance set on 0 per-year row(s).
Committed.
```

No warnings were raised: no parent lacked an LS component, no duplicate pair differed, no parent ended with the wrong number of per-year rows, and no rule was discarded.

### Verification

| Check | Wanted | Got |
|---|---|---|
| Orphan revisions / costs / per-year / funding | 0 | **0 / 0 / 0 / 0** |
| Children with no parent | 0 | **0** |
| Migrated parents not listed by the module | 0 | **0** |
| Parents not holding exactly one LS component | 0 | **0** |
| Allocation drift | 0 | **0** |
| Still-invalid Sub-Category | 0 | **0** |
| Skipped | 0 | **0** |
| `vLumpSumSet` | 62 | **62** |
| `vLumpSumChildSet` | 18 (unchanged) | **18** |
| Invariant OK across all 62 | 62 | **62** |
| Per migrated parent: components / per-year rows / funding lines | 1 / 1 / 1 | **min 1, max 1 on all three** |
| Migrated parents carrying a UACS | 57 (2 were blank) | **57 of 59** |
| **Second run** | 0 in scope, no error | **"Legacy Lump Sum parents in scope: 0"** |

Three per-year rows still lack Start/End dates — they are the **MyMYPS sample's** three, which this script does not touch. Pre-existing and documented in `LumpSum.ComponentMigration.sql`'s header ("START/END DATES … are left null as found").

---

## 6. What was deliberately left alone

| Left alone | Why |
|---|---|
| **`MY…LS` identifiers** (16 projects) | A module not implemented yet. Inventoried in `documents/MYPS_LS_MY_Prefixed_Projects.md`. They are the only Lump-Sum-shaped ids here with real `AlternateId`-linked children. |
| **`ProjectType = 'NULL'` on 56,710 other projects** | A genuine restore artifact, and its own decision. Only the 59 were changed. |
| **`ComponentType` as a code on ~353,000 other rows** | Same reasoning (§4.1). Only the 59 parents' LS components were normalised. |
| **The older live revisions** | Each parent has a second (the `P008` four have five); 71 carry components of their own, still in the duplicate/ten-row shape. Every Lump Sum view reads the **latest** live revision only, and rewriting history is not this script's job. |
| **`sp_RBP` / `a1_usp_AIP2`** | Live-only fixes with no forward source. See the 2026-09-10 migration's header. |
| **`READ_COMMITTED_SNAPSHOT`** | Already 1; its own script. |

---

## 7. Guard note — why `SET NOEXEC ON`, not `RAISERROR` alone

Both refusal guards in this script (the `myps_db` check in §0 and the lookup checks in §2) set `NOEXEC` after raising.

`XACT_ABORT` does **not** cover `RAISERROR`. A severity-16 `RAISERROR` inside the transaction prints its message and then *the next statement runs anyway* — so a guard written that way would have announced the missing funding agreement and then inserted 59 lines naming it. And the severity-20 `WITH LOG` form used by the 2026-09-10 migration cannot be raised by a non-sysadmin login at all: it fails with Msg 2754, that batch aborts, and every later batch runs — the fail-open the bring-up code review recorded as finding #3. `NOEXEC` does not care who raised what.

This is the localhost proof of that fix. Finding #3 remains open against the 2026-09-10 migration itself.

---

## 8. Before running against `192.168.50.200`

This script is server-bound but has only been run on `myps_db_dev_200`. Before the server:

1. **Back up.** §3 and §4 soft-delete rows; reversible by hand, not by re-running the script.
2. **Dry run first** (`@DryRun = 1` in §2b) and read the §6 pick table. The Sub-Category rules were written against *this* lineage's descriptions; a rule whose PAPKey is not allowed there is discarded with a warning rather than applied, but a description this script has never seen falls back — and every fallback is a row for a human.
3. **Expect the duplicate-pair branch to matter.** None differed here. If any differ there, they are reported, skipped, and surface as DRIFT — that is the designed outcome, not a failure.
4. **Check the funding agreement.** `DPWH-GAA-2024` under `GOP` must be an active row, or §2 refuses.
5. **Confirm the scope count before committing.** §1 prints it. On this database it was 59; a wildly different number means the predicate is finding something else.

---

## Related

- `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`
- `documents/MYPS_LS_MY_Prefixed_Projects.md`
- `documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md` — Step 3b
- `documents/docs/engineering/MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md`
- `FE/src/pages/LumpSum/LumpSum.md` — the model, and the Approved-program rule
