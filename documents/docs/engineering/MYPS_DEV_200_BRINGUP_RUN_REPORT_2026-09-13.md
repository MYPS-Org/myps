# `myps_db_dev_200` bring-up — execution, review and risk report

**Date:** 2026-09-13
**Target:** `localhost` / `myps_db_dev_200` (verified localhost throughout)
**Runbook:** `Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md`
**Backup taken:** `…\MSSQL\Backup\myps_db_dev_200_pre_bringup_20260913.bak` (194,177 pages, compressed)

---

## 1. Outcome at a glance

| Phase | Result |
|---|---|
| Step 1 — schema and programmability | **Pass** |
| Step 2 — idempotency re-run + verification | **Pass** (exit 0, no errors, every check wanted-value) |
| Step 3 — `READ_COMMITTED_SNAPSHOT` | **Pass** — `rcsi = 1` |
| Step 4a — `LumpSum.SampleData.Dev.sql` | **Refused by its own guard** — see §3.1; rewritten and now loading, see §7 |
| Step 4b — `LumpSum.DataSecurity.Dev.sql` | **Pass** — both accounts `ApplyFilter = 1`, 13/13 grants |
| Step 5 — API + `/lumpsum` | **Pass** — HTTP 200 |
| Code review (`ceaa859e`) | 12 findings |
| e2e suite (first run) | **9 failed, 30 passed, 5 skipped, 29 did not run** (baseline 55/3/0) |
| e2e suite (after remediation, §7) | **70 passed, 4 skipped, 0 failed** |

The database bring-up itself succeeded. The e2e result is **not** a bring-up failure — the
failures decompose into four independent causes, none of them a product regression in the
Lump Sum module (§4). All four are fixed on branch `fix/dev200-e2e-failures` (§7).

---

## 2. Verified state

Pre-state matched the runbook's "Verified starting state" table exactly, including the two
procedures the runbook warns are *ahead* of the repo:

| Object | Before | After | Wanted |
|---|---|---|---|
| `sp_RBP` | 9285 chars (2026-09-09) | 9285 | 9285 — **unchanged, live fix preserved** |
| `a1_usp_AIP2` | 10355 chars (2026-09-10) | 10355 | 10355 — **unchanged, live fix preserved** |
| Lump Sum columns / views / indexes | absent | present, all three views bind | present |
| Wallet-era objects | 4 present | **0** | 0 |
| Import defaults / indexes | absent | 3 defaults + both indexes | present |
| Lump Sum API actions | wallet-era names | **13 V2 names**, none ungranted, no dangling grant | 13 |
| `READ_COMMITTED_SNAPSHOT` | 0 | **1** | 1 |

API connection proven, not assumed: 6 sessions on `myps_db_dev_200` from the API's own
pid 5084.

---

## 3. Divergences from the runbook

### 3.1 The sample-data script refuses on this lineage — the runbook says it will run

The runbook states: *"`MyMYPS` **is** present on this localhost instance, so it will run."*
It does not. It halts on its own assertion:

```
Sample: 3 Lump Sum Project(s), 18 itemized child/children.
Msg 50000: Identity collision on 21 row(s): rows unrelated to the sample
already occupy these Ids. Remapping is out of scope for this script.
```

**Root cause.** The script's design rests on *"Every source Id in this sample sits above this
database's MAX for the same table."* That is true of `myps_db_dev`. It is false of this
lineage:

| Table | `myps_db_dev_200` MAX(Id) | `MyMYPS` MAX(Id) |
|---|---|---|
| `tProjects` | **57,788** | 56,514 |
| `tProjectRevisions` | 119,521 | 128,860 |

`myps_db_dev_200` holds 56,789 projects and has grown *past* MyMYPS's range, so the sample's
preserved identities land inside occupied space.

**The guard worked correctly.** It uses `SET NOEXEC ON` after the `RAISERROR`, so execution
stopped before any write. Verified: 0 sample projects, 0 `LS` projects at that point, and
`tProjectMajorWorkItem` intact at **251,233 rows**. Nothing was half-applied.

This matters because the very next script in the folder, `LumpSum.DataSecurity.Dev.sql`, uses
`RAISERROR` at severity 16 **without** `NOEXEC` (code-review finding #4) — the two sibling
scripts do not fail the same way.

### 3.2 The connection string did not point where the runbook claimed

The runbook asserts `Main/appsettings.Development.json` "now points `MYPSDb` at it". At session
start the active line was `Database=myps_db_dev`; the `dev_200` line was commented out. Corrected
mid-session. The SQL steps take `-d` explicitly so they were unaffected, but Step 5 and the whole
e2e run would otherwise have exercised the wrong database.

---

## 4. e2e failure analysis

**Infrastructure ruled out first** (per the standing check order): `fail: Hangfire` count **0**,
deadlock `1205` count **0**, worst application query **859 ms**, `rcsi = 1`. These failures are
real signal, not the known false-alarm patterns.

### Cause A — `DownloadTemplate` 403 (6 of 9 failures)

```
Error: DownloadTemplate answered 403:
"You do not have permission to perform 'DownloadTemplate' on 'ImportingController'."
```

Affects `ls-contract`, `ls-data-security`, `ls-ownership`, `ls-program-approved`, and two
`ls-module-ui-walkthrough` cases.

| Fact | Value |
|---|---|
| `DownloadTemplate` registered on `dev_200` | Yes, `Id = 123`, `ImportingController` |
| Granted to groups | 2, 3, 4 |
| e2e user `jimeneznr` groups | **[1]** |
| Group 1 Lump Sum actions granted | 13 of 13 ✅ |
| Group 1 `DownloadTemplate` | **Not granted** ❌ |

The migration grants exactly the 13 `LumpsumController` actions and never the
`ImportingController` actions the Lump Sum import flow actually calls.

**Not introduced by this bring-up.** On `myps_db_dev`, `DownloadTemplate` (`Id = 141` there)
is granted to **no group at all**, and `jimeneznr` is group `[1]` on that lineage too. So this
is a pre-existing gap in permission seeding that the bring-up *surfaced*, not one it caused.

Worth noting: action Ids diverge between lineages — `Id 123` is `DownloadTemplate` on
`dev_200` but `DeleteItemizedProject` on `myps_db_dev`. Any grant logic that merges raw **Ids**
rather than names is lineage-specific.

### Cause B — no seeded Lump Sum data (2 failures)

Direct consequence of §3.1. Both are `ls-module-ui-walkthrough` list-page cases:

- *"filters come from the server, and search narrows it"* — `element(s) not found`
- *"Next shows the next ten rows"* — `Expected: 10, Received: 1`

The paging case needs ≥10 Lump Sum rows; only the fixture's own parent existed.

### Cause C — a stale spec, not a build artifact (1 failure)

**Corrected after further investigation.** The first pass of this report attributed this to my
scratch build. That was wrong, and the evidence was mine: I probed the endpoint with a **GET**,
which matches no route, falls through to static-file middleware, and throws
`System.IO.FileNotFoundException: 'Microsoft.Extensions.FileSystemGlobbing'` — a 500 from my
build output. The spec **POSTs**, and a POST answers **200** in 14.3 s. So the endpoint was
healthy all along.

The real cause is that the spec is stale against the dashboard as it now stands:

| The spec expected | The page actually does |
|---|---|
| A `/welcome back/i` heading | No such heading; the shell renders `Welcome, {name}!` in `Layout.tsx` |
| Live data on arrival | `dataSourceMode` defaults to `'benchmark'` — **Demo Data**, which calls no API at all |
| `FY 2025`-style year buttons | Bare years (`{year}`) |
| A `MYPS Command Center` element to z-index test | Gone |
| Every fiscal year clicked in turn | 16 years × 14.3 s — cannot fit the 120 s test budget |

`WebAPI.csproj` no longer excludes `Controllers\Dashboard\**` (it removes only
`RevisionController.cs`), so the spec's 404/405 self-skip correctly stopped firing and the spec
began running for the first time — against a UI that had moved on under it while it was dark.

### The 29 that "did not run"

Serial-mode cascade. `ls-module-ui-walkthrough.narrated.spec.ts` is `mode: 'serial'`, so its
early failures abandoned the rest of the file — the same amplification the e2e guide documents.
Fixing Cause A alone should recover most of these.

---

## 5. Code review — `ceaa859e` (12 findings)

Verified correct first: all seven "verbatim" script ranges are byte-identical to their sources;
the `sp_RBP` / `a1_usp_AIP2` "do not run" figures are real; the 13 action names match the 13
`LumpsumController` actions; the three FE route names match the grant list.

| # | Location | Finding | Risk |
|---|---|---|---|
| 1 | `LumpSum.Isolation.ReadCommittedSnapshot.sql:76` | **No target-database guard at all**, on the most destructive script in the set | **High** |
| 2 | `LumpSum.SampleData.Dev.sql:136` | Orphan sweep deletes `tProjectMajorWorkItem` **database-wide**, contradicting its own "scoped to exactly the ProjectPKs" claim | **High** |
| 3 | `Migration…2026-09-10.sql:113` | `myps_db` refusal guard **fails open** for a non-sysadmin login (sev-20 `WITH LOG` → Msg 2754, batch aborts, migration continues) | **High** |
| 4 | `LumpSum.DataSecurity.Dev.sql:67` | `ApplyFilter` guard `RAISERROR`s at sev 16 and **keeps going** — fixture created even when it proves nothing (sibling uses `SET NOEXEC ON`) | Medium |
| 5 | `Migration…2026-09-10.sql:276` | `IX_tProjects_ParentProjectId` guard checks `sys.indexes` by name with **no `object_id` filter**, unlike its four siblings — can silently skip creation | Medium |
| 6 | `Migration…2026-09-10.sql:1020` | Folds in the PAP-map index but **drops the source's missing-`Id`-column repair** — the exact hand-made-table case the runbook says applies here | Medium |
| 7 | `Migration…2026-09-10.sql:1173` | Route grants **no-op silently** if `tAppViews` rows are absent; neither script nor Step 2 verifies `ViewIds` | Medium |
| 8 | `BRINGUP.md:75` | Step 2 lists five indexes; the script only ever prints **four** | Low |
| 9 | `BRINGUP.md:56` | Cites eight scripts that **do not exist on this branch** (only on `lumpsum-v3-backup`) | Low |
| 10 | `Migration…2026-09-10.sql:91` | "HOW TO RUN" names `Main/Resources/Internal/SQLScripts/…`; the file lives in `Main/Resources/LumpSum/SQL/` | Low |
| 11 | `documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md:52,83` | **Divergent duplicate runbook** carrying the same stale paths | Low |
| 12 | `BRINGUP.md:98,147` | Broken relative link to the deadlock RCA; "revisit only if data is copied in" is triggered by the runbook's own Step 4 with no link between them | Low |

---

## 6. Risk analysis

| ID | Risk | Likelihood | Impact | Status |
|---|---|---|---|---|
| R1 | **Isolation script has no database guard** (finding #1). `WITH ROLLBACK IMMEDIATE` disconnects every session; run against the wrong database it is a whole-database setting change plus a forced disconnect. | Medium | High | **Open** |
| R2 | **Sample fixture's database-wide delete** (finding #2). Did not fire here only because the collision guard halted first. On a database where the collision check passes, it deletes every orphaned `tProjectMajorWorkItem` row regardless of lineage. | Medium | High | **Closed** — the sweep is gone (`a6b605d0`) |
| R3 | **Migration's `myps_db` refusal fails open** for a non-sysadmin login (finding #3). The one guard protecting production behaves differently by login privilege. | Low | High | **Open** |
| R4 | **`DownloadTemplate` ungranted** blocks the Lump Sum import path for Admin-group users on both lineages. Currently masks 6 e2e tests and cascades into 29 more. | **Certain (observed)** | Medium | **Closed** — granted by name (`a6b605d0`) |
| R5 | **No Lump Sum data on `dev_200`.** Sample fixture cannot run without an Id-remapping script that does not exist. Two UI specs cannot pass; module demos have nothing to show. | **Certain (observed)** | Medium | **Closed** — identities remapped, program copied, model normalised (`a6b605d0`, `8bb35933`, round 2) |
| R6 | **Action Ids diverge between lineages** (123 = `DownloadTemplate` here, `DeleteItemizedProject` on `myps_db_dev`). Any Id-based grant or script is silently lineage-specific. | Medium | Medium | **Open** |
| R7 | **`Dashboard/Summary` returns every visible project, uncapped.** `DashboardController.cs:466` sets `Projects = projects` with no `Take`. On `dev_200` that is **56,722 rows / 33.5 MB / 14.3 s** for a single page load, and the payload grows with the portfolio. The watchlist renders a handful of them. | **Certain (measured)** | Medium | **Mitigated, not fixed** — Live DB switched off in the UI (`LIVE_DB_ENABLED`, 2026-09-13) so the query is no longer issued. The endpoint is unchanged and still needs paging |
| R8 | **`sp_RBP` / `a1_usp_AIP2` have no forward source.** Verified unchanged at 9285/10355 by this run, but they exist only in the database. | Medium | High | Carried (pre-existing) |
| R9 | **Two divergent copies of the runbook** (finding #11) with stale paths in both — a future operator may follow the wrong one. | Medium | Low | **Open** |
| R10 | **Credentials committed in the clear** in `.claude/settings.json` and `appsettings.Development.json`. | — | High | Carried as RISK-090 |
| R11 | Stale comment in `dashboard-real-data` spec asserting an exclusion that has been lifted. | Low | Low | **Closed** — spec rewritten (`6afda7a6`) |

### Recommended order of work

1. **R4** — grant the `ImportingController` actions to group 1. Single highest-yield fix: unblocks 6 failures and most of the 29 that did not run.
2. **R1, R2, R3** — three guard defects, each small and each able to damage data outside its stated blast radius. Fix before anyone runs these scripts again.
3. **R5** — decide whether `dev_200` needs Lump Sum data; if so an Id-remapping variant of the sample script is required, and the runbook's "it will run" claim must be corrected either way.
4. **R7, R8** — script the two live procedures back into the repo; collapse the duplicate runbook.

---

## 7. Remediation — branch `fix/dev200-e2e-failures`

All four causes fixed and re-verified the same day. **Whole suite on
`localhost/myps_db_dev_200`: 70 passed, 4 skipped, 0 failed (5.3 min)** — from 9 failed /
30 passed / 29 did not run.

| Cause | Fix | Commit |
|---|---|---|
| **A** — `DownloadTemplate` 403 | `Migration.SchemaAndProgrammability` §2 now merges `ImportingController.DownloadTemplate` and `.DownloadImportFile` into Admin's grants, **matched by name** because Ids diverge between lineages. Step 2 gained a "want none" check. `DownloadTemplate` → 200 | `a6b605d0` |
| **B** — sample could not load | `LumpSum.SampleData.Dev.sql` rewritten to **remap identities** rather than preserve them, copy the sample's program when absent, and bring the copied parents onto the current allocation model (§4e) | `a6b605d0` |
| **C** — stale dashboard spec | Live DB **switched off** and the spec rewritten around the demo path (below) | `6afda7a6` |
| **D** — latent spec bugs | Filter test self-provisions; pager tops up to 20; `ls-ownership` keeps the sweeper marker | `6afda7a6` |

### Also closed

- **Code-review finding #2** — the sample script's database-wide `DELETE … tProjectMajorWorkItem`
  is gone. It existed only so preserved Ids could not collide on re-copy; remapping removes the
  need. Verified: the table went 251,233 → 251,251 (the sample's 18 rows, nothing else).
- **The restricted group could not build a workbook.** `LumpSum.DataSecurity.Dev.sql` now grants
  it the same two Importing actions — otherwise the import spec 403s at the permission filter
  before reaching the visibility gate it exists to test, which is the trap that script's own
  header warns about.

### The dashboard decision

Live DB is **off** (`LIVE_DB_ENABLED = false` in `FE/src/pages/Dashboard/Dashboard.tsx`). The
page opens on Demo Data, the control renders disabled and explains itself, and no
`Dashboard/Summary` query is issued. No live code was removed — `fetchDashboardSummary`,
`mapSummary` and every panel sit behind the flag, with a guard in the fetch effect so no query
escapes if the mode is reached another way. R7 is therefore **mitigated, not fixed**: the
endpoint still returns 33.5 MB and still needs paging.

The spec mirrors that: its demo half asserts the page queries **nothing**, and its live half is
kept whole and skipped against a constant tracking the FE flag.

### Verified after the run

| Check | Result |
|---|---|
| `vLumpSumSet` / `vLumpSumChildSet` | 3 / 18 — the sample survived the sweeper, pinned by `ProjectId` despite new Ids |
| Invariant drift | 0 |
| `LS-OWNERSHIP` leftovers | 0 — the marker fix works; the sweeper removed 21 parents and 3 children |
| Skips | 4: the deferred live-dashboard test and the three KNOWN GAP data-security cases |

### Round 2 — review of the merged branch (PR #206), branch `fix/dev200-review-round-2`

A second review, at high effort, over all four merged commits. Five findings, every one a
**vacuous pass or an unexercised data shape** — the kind a green run cannot surface, which is
why the register below treats "the suite is green" as weaker evidence than it looks.

| # | Finding | Why the green run missed it | Fix |
|---|---|---|---|
| 1 | The filter-probe poll (`rows not matching = 0`) is satisfied by an **empty** table, and `LumpSumList` unmounts the table while a search is in flight | Passed on 0 rows during the loading window | One predicate: rows > 0 **and** every row matches |
| 2 | §4e handled multiple per-year rows but not multiple live `'LS'` cost rows — which the `LS1→LS` rename can itself create. Both updates would then write twice, and §5's DRIFT would have no warning behind it | Sample parents have exactly one | `#LSCostRows` counts per revision; both updates require exactly one; others are reported. **Proven**: a duplicate injected in a rolled-back transaction is flagged `LSCostRows=2` |
| 3 | §4d's Thrust repair *and its own warning* `INNER JOIN tPrograms`, so a program that never lands makes both fall silent while `vLumpSumSet`'s `LEFT JOIN` keeps §5/§6 green | The program copy succeeded | After §2, `NOEXEC ON` if the program is still absent — a rolled-back copy now stops the script rather than producing a sample that reads fine and cannot be saved |
| 4 | The "pager disappears" poll (`Next page` count = 0) is also true during the loading window, because `PaginationBar` is inside the same `!isLoading && lists.length > 0` block | Loading is fast | Rows present **and** no Next, in one predicate |
| 5 | The migration's BIN2 name match is reused verbatim in its own verification, so a name whose casing drifted grants nothing **and reports nothing** | Names match today | Verification now matches case-insensitively, so drift surfaces as "ungranted" |

Re-verified: sample script clean warm, migration idempotent with empty check, walkthrough
16 / 16 with the tightened polls exercised against 20 real fillers.

### Still open

Code-review findings #1 (isolation script has no database guard) and #3 (the `myps_db` refusal
fails open for a non-sysadmin login) — both are guard defects that can damage data outside their
stated blast radius, and neither was in scope here. R7's underlying endpoint, and the nine other
`ImportingController`/`RevisionController`/`Dashboard` actions Admin lacks on this lineage, are
also untouched by design.

---

## 8. Environment used

- API: scratch build at `…/scratchpad/api-out`, `http://localhost:5015`, connection string verified `Server=localhost;Database=myps_db_dev_200` **in the scratch copy** before start.
- FE: `VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort` (tracked `.env.development` not edited).
- e2e: `E2E_API_URL=http://localhost:5015 E2E_BASE_URL=http://localhost:8080 npx playwright test --workers=1`.
- Build: 0 errors, 210 warnings (pre-existing).
- Post-run: `rcsi = 1`.

### Stranded fixture data — one row, not two (corrected)

| ProjectPK | Verdict |
|---|---|
| `P00800031LS` | **Genuinely stranded.** A childless Lump Sum parent holding 200,000,000 of its program's allocation, description `LS-OWNERSHIP parent` |
| `P01000009LS` | **Not stranded.** Both its revisions are `IsDeleted = 1` — a soft-deleted approval-fixture seed, invisible to `vLumpSumSet`. The first pass of this report misread it |

**Why the sweeper missed `P00800031LS`, and the fix.** `lumpSumSweeper.ts` finds test data by
the marker `(e2e <ISO timestamp>)` that `provisionLumpSum` writes into a Description.
`ls-ownership.spec.ts` then re-saved that project through `UpdateLumpSum` with
`Description: \`${TAG} parent\`` — dropping the marker and making its own parent unsweepable.
Every later run would have stranded another. The spec now keeps the marker.

The row was removed through the product's own `DeleteLumpSum` (hard tier) before the
re-run.
