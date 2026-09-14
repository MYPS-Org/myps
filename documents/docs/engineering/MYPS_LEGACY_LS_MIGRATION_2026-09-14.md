# Legacy 2024 Lump Sum projects — migration onto the V3 data model

**Date:** 2026-09-14
**Database:** `localhost` / `myps_db_dev_200`
**Script:** `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`
**Backup taken:** `…\MSSQL\Backup\myps_db_dev_200_pre_legacyls_20260914.bak` (196,121 pages, compressed)
**Result (first run, 59 parents of 2024):** 59 projects migrated. Every verification check 0. Second run reports 0 in scope.
**Result (Revision 2, same day, 2023 onwards):** 83 parents in scope, 4,037 children linked, `vLumpSumSet` 62 → **123**, `vLumpSumChildSet` 18 → **4,055**. See §9.

> ### ⚠ Corrected 2026-09-14 — read §3 before trusting any figure here
>
> **§3 concluded that these 59 parents have no itemized children. That is wrong.** 22 of them
> have **2,028** children between them, and **2,027 are already on this database**, unlinked.
> The old model records an itemization in `dbo.history`, not in any project column, which is why
> a careful search of `AlternateId` / `ParentProjectId` / `ParentWalletId` found nothing.
>
> Three figures below are wrong as a consequence, and are marked where they appear:
> `ItemizedTotal` is not 0; the allocation written is really the **remaining balance**; and the
> six "unfunded" ₱0 parents are **fully itemized**, not unfunded.
>
> The migration as run did no harm — the rows it wrote are correct as far as they go — but it is
> incomplete. The follow-up work links the children and re-derives each allocation as
> `Remaining + Σ children`. See `documents/plans/legacy-ls-migration-2023-2025.md`.
>
> **Resolved the same day.** Revision 2 of the script ran on `myps_db_dev_200` at 11:59 after the
> 2023 and 2025 program groups were loaded from `MYPS_BAK`. §9 is its run log; every figure this
> box calls wrong is corrected there.

---

## 1. What this closes

`Migration.SchemaAndProgrammability.2026-09-10.sql` gave this lineage the Lump Sum v3 **schema** and stated in its own header that it contains **no data migrations**. It was right to: on 2026-09-10 the column it would have keyed off (`ParentProjectId`) had just been created empty.

But `myps_db_dev_200` carries **59 Lump Sum projects migrated from 2024 data** — `tProjects.ProjectPK` ending in `LS`, under three Approved GAA 2024 programs — and they predate the model entirely. This is the data migration for exactly that set.

| | Before | After |
|---|---|---|
| Projects listed by `vLumpSumSet` | 3 (the MyMYPS sample) | **62** |
| Of which the 2024 legacy set | 0 | **59** |
| Allocation held by the 59 | — | ₱4,778,229,699.08 — **this is the remaining balance, not the allocation; see §3** |
| Allocation invariant (`Total = Remaining + Itemized`) | OK on 3 | **OK on 62** — but with `Itemized` wrongly 0 on 22 of them |
| `vLumpSumChildSet` | 18 | 18 — **should be 2,045; the 2,027 loaded children were never linked, see §3** |

Per program:

The `Itemized` column below is **0 only because the children were never linked** (§3). The true
itemized total across the 2024 set is ₱8,696,942,250.33 under 22 parents, so both `Allocation`
and `Itemized` here understate reality; `Remaining` is right.

| ProgramId | Program | Projects | Allocation *(= Remaining; wrong)* | Remaining | Itemized *(wrong)* |
|---|---|---:|---:|---:|---:|
| `P_CO-PS-634_01222024_174001` | GAA 2024 SSP | 34 | 578,425,699.08 | 578,425,699.08 | 0 — really 8,696,942,250.33 under 19 parents |
| `P_CO-PS-278_01262024_140207` | GAA 2024 LP | 21 | 3,689,804,000.00 | 3,689,804,000.00 | 0 — really 24,000,000.00 under 1 parent |
| `P_CO-PS-635_07202023_140408` | GAA 2024 OO-1 | 4 | 510,000,000.00 | 510,000,000.00 | 0 — really 143,500,000.00 under 2 parents |
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
| **Itemized children** | ~~none~~ **2,028, under 22 of the 59** — recorded in `dbo.history`, not in any project column. See §3 |
| `ComponentType` on their LS components | the **code** `'LS'`, not the name `'Lump Sum'` — see §4.1 |
| LS components on the latest revision | 112 across 59: **53 carry an identical duplicate**, 6 carry one with `Total = 0` |
| Per-year rows | **10 per component** (2024–2033); only 2024 non-zero, only 2024 carries a UACS; the empty rows hold `''`, not `NULL` |
| Funding lines | **0** on every parent |
| `Thrust` | **0** on 55 (not a PAPKey); the `P008` four already carry 1024 / 1026 / 1027 / 1124 |
| Tier / Category | Tier 1; Categories 29 (34), 30 (21), 16 (4) |
| Required detail fields | `Description`, `OperatingUnit`, `Origin`, `Agency`, `RegionWide` all present — no gaps |

---

## 3. ~~There are no children~~ — CORRECTED 2026-09-14

> **This section was wrong, and it was the load-bearing finding.** It concluded that the 59
> parents have no itemized children. They have **2,028**, of which **2,027 are on this very
> database**. Everything below the rule is the correction; the original claim and its evidence
> are kept under it, because the way it was wrong is worth more than the conclusion was.

### What is actually true

**22 of the 59 parents are itemized, across 2,028 children.** The old data model does not record
an itemization in any project column. It records it as a `dbo.history` row against the **child**,
in the GAA-R program only:

```
projectid   = P00746419LZ
programid   = P_CO-PS-535_03292023_105429
description = 'Itemized from Project: P00730052LS'
```

`dbo.vw_notes` is the read-only view over it. Every one of the 42,589 such notes in `MYPS_BAK`
names a parent ending in `LS`; **not one** has the child's `alternate_id` equal to that parent.
So a search of `AlternateId` — however thorough — cannot find them, and the original search was
thorough. It looked in exactly the places the *new* model would use, and the old model uses none
of them.

The children were loaded onto `myps_db_dev_200` with the 2024 program groups, before the notes
were understood to carry the link. They are there now, unlinked:

| | Count |
|---|---:|
| Itemization notes in the 2024 groups | 2,028 |
| Distinct children | 2,028 |
| Parents named | **22** of the 59 |
| Children already on `myps_db_dev_200` | **2,027** |
| Children with `ParentProjectId` set | **0** |
| The one missing | `P00851066VS` — a note naming `P00830018LS`, with no `dbo.project` row behind it in the source |

### What that means for the figures in this document

Three things stated below are consequences of the wrong finding and are wrong with it:

1. **`ItemizedTotal` is not 0 and `Remaining` is not the allocation.** Itemization *reduced* the
   parent's stored cost, so the GAA-R figure this migration wrote as the allocation is really the
   **remaining balance**. `P00730052LS` (2023, same shape): 11,000,000,000 at GAA, 9,826,178,558.32
   at GAA-R, 446 children costing 10,429,053,146.08. The identity that holds is
   `OriginalAllocation = Remaining + Σ children`, not `= Remaining`.
2. **The six ₱0 parents are not unfunded — they are fully itemized.** §4.6 calls them "unfunded
   line items". Every one of them has children:

   | Parent | Listed allocation now | Noted children | Their cost in `MYPS_BAK` |
   |---|---:|---:|---:|
   | `P00800007LS` | ₱0 | 2 | 93,500,000.00 |
   | `P00830004LS` | ₱0 | 140 | 39,600,000.00 |
   | `P00830010LS` | ₱0 | 155 | 52,565,000.00 |
   | `P00830013LS` | ₱0 | 117 | 46,060,049.05 |
   | `P00830014LS` | ₱0 | 88 | 36,600,000.00 |
   | `P00830018LS` | ₱0 | 243 | 2,619,974,218.27 |

   Their balance is 0 because their children hold all of it. Reporting them at ₱0 allocation is
   the visible symptom of the missing link.
3. **The funding line this migration wrote is short** by each parent's itemized total, since it
   was written at `Remaining`.

### Why the original search missed it

Not for want of rigour — for want of the right column. The search below was run against the
places the **V3** model records a parent/child link. The old model predates all of them:
`ParentProjectId` did not exist, `ParentWalletId` belongs to the retired wallet era, and
`AlternateId` was never the link. The one place it *is* recorded, `dbo.history`, was not searched
because nothing suggested a free-text log held a relational fact.

The lesson is narrow and worth keeping: **"absent from every column I know about" is not
"absent".** The original wording — "THERE ARE NO CHILDREN. Searched five ways" — asserted the
second from the first.

### The original section, as written

> This is the load-bearing finding, because it determines the balance: with no children,
> `Remaining = Total` for all 59 and `ItemizedTotal` is 0.
>
> The parent's Project ID was searched for in every place a child could record it:
>
> | Searched | Hits |
> |---|---|
> | `tProjectRevisions.AlternateId` = parent's `ProjectId` | 0 |
> | `tProjectRevisions.AlternateId` = parent's `ProjectPK` suffix | 0 |
> | `tProjectRevisions.AlternateId` = parent's own `AlternateId` | 0 |
> | `tProjectRevisions.AlternateId` = parent's `ExternalId` | 0 |
> | `tProjectRevisions.AlternateId` **contains** the parent's numeric core | 13 — **all false positives** |
> | `tProjects.ParentProjectId` → any of the 59 | 0 |
> | `tProjects.ParentWalletId` (wallet era) — anywhere in the database | 0 |
>
> The 13 numeric-core matches are unrelated regular projects that merely share a running number:
> `P00800005VS`, `P00800005LZ`, `P00800005MN` against parent `P00800005LS`, and so on. Different
> island codes, different projects, no relationship.

Those seven rows are all still accurate. The 13 numeric-core matches really are false positives.
The conclusion drawn from them was not.

**On the `MY…LS` identifiers.** The original said they are "the opposite" — the only ids here with
`AlternateId`-linked children. That comparison is now meaningless: `AlternateId` is not how
itemization is recorded, and the `MY…LS` values appear there for some other reason. They remain
excluded from this migration (see `documents/MYPS_LS_MY_Prefixed_Projects.md`), on the
instruction that they belong to a module not yet implemented — which was always the real reason.

### What is being done about it

The link is migrated into `tProjectNotes` by the loader
(`app/data_migration/queries.py: build_project_notes_sql` in the `myps-gis-backend` repo) and
read back by the revised migration script, which sets `ParentProjectId` and re-derives each
parent's allocation as `Remaining + Σ children`. The 2024 groups' 2,059 notes were back-filled on
2026-09-14. See `documents/plans/legacy-ls-migration-2023-2025.md` and the group-load write-up.

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

`AlternateId` is left exactly as found. On a **parent** it is free text (`CreateLumpSum` writes `dto.AlternateId` straight through); the "AlternateId is the parent's Project ID" rule of 2026-09-05 is the **child's**. The `P008` four keep their pre-renumber id, which is a fact about them worth keeping.

> **Corrected:** this paragraph originally ended "…is the **child's**, and there are no children."
> There are 2,028 (§3). Leaving the parents' `AlternateId` alone is still right, and the child
> rule is still the child's — but those children exist, and the follow-up work stamps their
> `AlternateId` with the parent's `ProjectId` exactly as `ImportItemizedProjects` does.

This flip is also what makes the script idempotent — §1's predicate excludes exactly what §5 writes.

### 4.5 Sub-Category  *(decision D3)*

55 carry `Thrust = 0`. That is not a PAPKey — the same "a row Id where a PAPKey belongs" shape `LumpSum.SampleData.Dev.sql` §4d found on the MyMYPS parents — and `ValidateRequiredFieldsAsync` refuses it, so **Save, Replenish and Import are all dead** on those projects until it is resolved.

Unlike the sample script, these parents have no work items of their own, so there is no scope of work to read a family off. The Description is the only evidence — and here it is unusually good evidence, because these are GAA line items whose text is near-verbatim the thrust's own wording.

> **Corrected:** this originally read "these parents have no children and no work items". They
> have 2,028 children (§3). The reasoning survives the correction: the sample script reads the
> family off a parent's **own** work items, and these parents genuinely have none — 0 work items
> across every component of every revision of all 59. The children's work items were never a
> candidate source here, so no Sub-Category pick changes.

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

Both reported **0 rows changed** — correctly *for what the script could see*. The funding line was inserted *at* the component's `Total`, and the surviving per-year row already held that figure.

> **Corrected (§3).** The parenthesis "there are none" is wrong: 22 of these parents have 2,028
> children between them. The derivation itself is sound — it is `vLumpSumSet`'s own arithmetic —
> but it was fed `Σ children = 0` because no child carried a `ParentProjectId`. The consequence
> is that **the funding line each of those 22 parents received is short by its itemized total**,
> and what this document calls their allocation is really their remaining balance.
>
> The direction of the identity is what makes this recoverable rather than destructive: the
> stored per-year `Amount` **is** the remaining balance and always was, so nothing that was
> written needs undoing. The follow-up re-derives the funding line and the component `Total` as
> `Remaining + Σ children` once the children are linked.

**Six parents have `Total = 0`** (decision D2): `P00800007LS`, `P00830004LS`, `P00830010LS`, `P00830013LS`, `P00830014LS`, `P00830018LS`. They got a ₱0 line and list with allocation 0 / remaining 0.

> **Corrected (§3).** This originally concluded: "That is truthful — they are unfunded line items
> — and Replenish is how they would be funded later." They are not unfunded. **All six are fully
> itemized** — their balance is 0 because their children hold every peso of it:
>
> | Parent | Noted children | Their cost |
> |---|---:|---:|
> | `P00800007LS` | 2 | ₱93,500,000.00 |
> | `P00830004LS` | 140 | ₱39,600,000.00 |
> | `P00830010LS` | 155 | ₱52,565,000.00 |
> | `P00830013LS` | 117 | ₱46,060,049.05 |
> | `P00830014LS` | 88 | ₱36,600,000.00 |
> | `P00830018LS` | 243 | ₱2,619,974,218.27 |
>
> A ₱0 allocation on a parent with 243 children should have been read as a missing link rather
> than as a funding gap. It was the clearest signal in the data that §3 was wrong, and it was
> written up as a feature.

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

> **Corrected (§3) — every number above is real, and three of the checks are vacuous.**
>
> | Check | Why it could not have failed |
> |---|---|
> | `Children with no parent` = 0 | `vLumpSumChildSet`'s membership **is** `ParentProjectId IS NOT NULL`. With no child linked, the view was empty of them and the check had nothing to examine. It would have read 0 whether there were 0 children or 2,027. |
> | `vLumpSumChildSet` = 18 unchanged | "Unchanged" was the *wanted* value, taken from the belief that there was nothing to add. It confirmed an assumption instead of testing it. |
> | `Allocation drift` = 0 | Drift is `Total − (Remaining + Itemized)`. `Total` was written *as* `Remaining` and `Itemized` read 0, so the check compared a figure against itself. It is satisfied by any pair of matching wrong numbers. |
>
> This is the failure mode the round-2 bring-up review named: *a green run is weaker evidence
> than it looks when the assertion is satisfied by the empty case.* The right check would have
> been an independent one — the source's own itemization notes against the target's links — and
> it now exists as `app/data_migration/test_sql/verify_itemization_notes.py`.

---

## 6. What was deliberately left alone

| Left alone | Why |
|---|---|
| **`MY…LS` identifiers** (16 projects) | A module not implemented yet — the instruction, and the only reason that matters. Inventoried in `documents/MYPS_LS_MY_Prefixed_Projects.md`. ~~They are the only Lump-Sum-shaped ids here with real `AlternateId`-linked children.~~ **That clause is void (§3):** `AlternateId` is not how itemization is recorded, so their appearance there says nothing about children. |
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

> **Run only Revision 2** — the file at the path in the header, as committed in `585904f4` or
> later. The first version (`f69db199`) wrote each parent's funding line at the *remaining
> balance* rather than the allocation, because it could not see the children (§3). Revision 2
> links the children from `tProjectNotes` and derives `Remaining + Σ children`; it also re-admits
> and corrects any parent the first version touched, so a database that received the first
> version is repaired by running the second. The server has neither the 2023/2025 groups nor the
> `tProjectNotes` rows the link travels in — the group load in
> `MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md` comes first, or Revision 2 finds no children
> there and writes the 2024 parents exactly as the first version did.

This script is server-bound but has only been run on `myps_db_dev_200`. Before the server:

1. **Back up.** §3 and §4 soft-delete rows; reversible by hand, not by re-running the script.
2. **Dry run first** (`@DryRun = 1` in §2b) and read the §6 pick table. The Sub-Category rules were written against *this* lineage's descriptions; a rule whose PAPKey is not allowed there is discarded with a warning rather than applied, but a description this script has never seen falls back — and every fallback is a row for a human.
3. **Expect the duplicate-pair branch to matter.** None differed here. If any differ there, they are reported, skipped, and surface as DRIFT — that is the designed outcome, not a failure.
4. **Check the funding agreements.** `DPWH-GAA-<year>` under `GOP` must be an active row for every program year in scope (§2 prints the table), or §2 refuses.
5. **Confirm the scope count before committing.** §1 prints it, by program and by reason. On this database it was 59 on the first run and 83 on Revision 2 (61 R1 / 4 R2 / 52 R3 / 0 R4); a wildly different number means the predicate is finding something else.
6. **Run the harness first** — `LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql`, which injects three fixture projects, runs the migration against them inside a transaction, asserts eight outcomes and rolls back. It needs an existing 2024 program to hang the fixtures under and passes 8 of 8 here.

---

## 9. Revision 2 — run log (2026-09-14, 11:59)

**Backup taken:** `myps_db_dev_200_pre_phaseC_20260914.bak`. **Preceded by:** the 2023 and 2025
group load (`MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md`) and the harness, PASS 8 of 8. **Plan:**
`documents/plans/legacy-ls-migration-2023-2025.md`, Phase C.

### What changed in the script

| § | Revision 2 |
|---|---|
| 1 scope | 2023 onwards; `MY…` excluded; and a parent already on the model is **re-admitted** when it is not typed `LS` (R1), holds a live non-Lump-Sum component (R2), is named by an itemization note whose child is still unlinked (R3), or its funding no longer equals `Remaining + Σ children` (R4) |
| 2 lookups | the `DPWH-GAA-<year>` agreement resolved for every program year in scope; refuses if any is missing |
| 3 components | all live components on the latest revision, not only the `LS`-typed ones. Survivor = the `LS`-typed one if any, else the lowest Id; identical copies retired as before; other components **folded** into the survivor (Total and earliest per-year Amount, printed); the survivor **converted** to `Lump Sum` / `LS` |
| 5b children | **new.** Reads `'Itemized from Project: <parent>'` from `tProjectNotes`, retires identical duplicate components on each child's latest revision, then stamps the child as `ImportItemizedProjects` would: `ParentProjectId`, `ProjectType 'LS'`, `ItemizationType 'Itemized'`, `ProjectStatus`, revision `AlternateId := parent`, `IsWalletDraw = 1` on its funding lines |
| 7 allocation | **reversed.** The stored per-year `Amount` *is* the remaining balance and is never written. `Target = Remaining + Σ children`: a parent with no line gets one at `Target`; a parent whose only line is the migration's — this script's from the first run, or the loader's on a revision it wrote — is raised to `Target`; anything a person entered is left and shows as DRIFT. Component `Total := Σ funding`; `Remaining = Total − children` is asserted, not derived |
| 8 verification | five new counters (`ParentsHoldingANonLSComponent`, `NotedChildrenUnlinked`, `LinkedChildrenWithDuplicateComponents`, `ChildrenLinkedToAnUnlistedParent`, `LinkedChildrenMissingStamps`), a per-program-year table, and the six formerly-₱0 parents |

### Scope: 83 parents

| Program | Parents | | Reason | Parents |
|---|---:|---|---|---:|
| GAA 2023 CSSP | 34 | | R1 not typed `LS` (the 57 of 2023 + the 4 of 2025) | 61 |
| GAA 2023 LP | 20 | | R2 holds a non-LS component (2025 OO-1's four, `CW1`) | 4 |
| GAA 2023 OO-1 | 3 | | R3 has unlinked noted children (22 of 2024 + 30 of 2023) | 52 |
| GAA 2024 SSP / OO-1 / LP | 19 / 2 / 1 | | R4 allocation drift | 0 |
| GAA 2025 OO-1 | 4 | | | |

The 37 parents of 2024 that have no children were **not** re-admitted: they are typed, hold one
`Lump Sum` component, have no notes and balance — exactly the idempotence the first run promised.

### The log

```
Live components found: 83 across 83 parent(s); 79 already typed as Lump Sum.
Retired 0 surplus component(s) and 0 of their per-year row(s).
CONVERTING these components to the Lump Sum allocation:
  P00900001LS  CW/CW1  500,000,000     P00900002LS  CW/CW1  100,000,000
  P00900003LS  CW/CW1  100,000,000     P00900004LS  CW/CW1  100,000,000
ComponentType set to the canonical Lump Sum name on 61 component row(s).
Description updated on 4 converted component(s).
ComponentId normalised to 'LS' on 4 component row(s) and on 40 per-year row(s).
Retired 549 empty per-year row(s).
Blank UACS cleared to NULL on 0 per-year row(s).
Year clamped to the program start year on 0 per-year row(s).
Filled Start/End dates on 61 per-year row(s).
ProjectType set to 'LS' on 61 project(s).
Itemization notes naming a parent in scope: 4037 child(ren) under 52 parent(s).
Retired 2237 duplicate child component(s) and 22370 of their per-year row(s).   -- all 2024
Linked 4037 child(ren) to their Lump Sum parent.
Alternate ID set to the parent's Project ID on 4037 child revision(s).
IsWalletDraw set on 4032 child funding line(s).                                 -- 5 children have no line
Sub-Category set on 1 revision(s).        -- P00730052LS, fallback: lowest allowed (flagged, see below)
Added 60 funding line(s) at Remaining + children.
Raised 23 funding line(s).
Allocation (component Total) set from the funding lines on 52 component(s).
Remaining = Total - children holds on every derived parent.
Committed.
```

Nothing folded: no in-scope parent held a second component. The 2,237 duplicate child components
are the 2024 children's second copies from the component-grain defect (group-load write-up §3.1);
the 2023 and 2025 children, loaded after the fix, had none. Five children carry no funding line in
the source and so have no `IsWalletDraw` flag to set; `vLumpSumChildSet` counts them from their
components, not their lines.

**The 23 raised lines** are the 22 lines the first run wrote at the remaining balance, plus
`P00700002LS` (2023 OO-1), whose only line came from the old system through the loader and
recorded the same post-itemization figure. Old → new for the six that were listed at ₱0:

| Parent | Children | Line was | Remaining | Children hold | Line now |
|---|---:|---:|---:|---:|---:|
| `P00800007LS` | 2 | 0 | 0 | 93,500,000.00 | 93,500,000.00 |
| `P00830004LS` | 140 | 0 | 0 | 39,600,000.00 | 39,600,000.00 |
| `P00830010LS` | 155 | 0 | 0 | 52,564,999.99 | 52,564,999.99 |
| `P00830013LS` | 117 | 0 | 0 | 46,060,049.05 | 46,060,049.05 |
| `P00830014LS` | 88 | 0 | 0 | 36,600,000.00 | 36,600,000.00 |
| `P00830018LS` | 242 | 0 | 0 | 7,998,736,757.37 | 7,998,736,757.37 |

and, for the shape of the rest: `P00830001LS` 627,157.82 → 33,600,000.00 (68 children, 32,972,842.18 —
no longer doubled), `P00700002LS` 128,776,000 → 233,530,000 (= the source's GAA cost),
`P00800005LS` 450,000,000 → 500,000,000 (1 child). The 60 added lines are the 56 of 2023 that had
none and the 4 of 2025.

**`P00730052LS`'s Sub-Category** (2023 CSSP, description "Rehabilitation of Disaster-Related
Infrastructure and Other Facilities") matched no rule and took the lowest allowed PAPKey, `1054`.
It is the one placeholder this run left for a person to correct. The 2023 GAA-R rows otherwise
arrived with valid PAPKeys, so §6 had nothing else to do.

### Verification

| Check | Wanted | Got |
|---|---|---|
| Orphan revisions / costs / per-year / funding; children with no parent | 0 | **0 / 0 / 0 / 0 / 0** |
| Not listed / not exactly one LS component / drift / invalid Sub-Category / skipped | 0 | **0 / 0 / 0 / 0 / 0** |
| Parents holding a non-LS component | 0 | **0** |
| Noted children still unlinked | 0 | **0** |
| Linked children with duplicate components | 0 | **0** |
| Children linked to an unlisted parent | 0 | **0** |
| Linked children missing stamps | 0 | **0** |
| `vLumpSumSet` | 123 | **123** |
| `vLumpSumChildSet` | 4,055 = 18 sample + 2,010 + 2,027 | **4,055** |
| Invariant `Total = Remaining + Itemized` | OK on all 123 | **OK on all 123** |
| Second run | 0 in scope | **"Lump Sum parents in scope: 0"** |

By program year, as `vLumpSumSet` now reports it:

| Year | Parents | Children | Allocation | Remaining | Itemized |
|---|---:|---:|---:|---:|---:|
| 2023 | 57 | 2,010 | 24,878,881,542.99 | 13,463,934,649.75 | 11,414,946,893.24 |
| 2024 | 59 | 2,027 | 13,622,671,949.41 | 4,778,229,699.08 | 8,844,442,250.33 |
| 2025 | 7 (4 migrated + 3 sample) | 18 (sample) | 1,340,000,000.00 | 908,000,000.00 | 432,000,000.00 |

The 2024 `Remaining` is the first run's "allocation" to the centavo — that figure was the balance
all along. The 2024 children number 2,027 against 2,028 notes: `P00851066VS` is named by a note
and has no project row in `MYPS_BAK` itself. The largest parent, `P00730052LS`, now shows 446
children, 10,429,053,146.08 itemized against a 20,255,231,704.40 allocation.

These checks are not the vacuous ones §5 warned about: `NotedChildrenUnlinked` compares the
source's own itemization record against the target's links, and the per-year `Itemized` figures
were confirmed against `MYPS_BAK` per parent before the run (`verify_itemization_notes.py`).

---

## Related

- `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql`
- `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql` — the rolled-back fixture harness
- `documents/docs/engineering/MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md` — the group load that precedes Revision 2
- `documents/plans/legacy-ls-migration-2023-2025.md`
- `documents/MYPS_LS_MY_Prefixed_Projects.md`
- `documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md` — Steps 3b and 3c
- `documents/docs/engineering/MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md`
- `FE/src/pages/LumpSum/LumpSum.md` — the model, and the Approved-program rule
