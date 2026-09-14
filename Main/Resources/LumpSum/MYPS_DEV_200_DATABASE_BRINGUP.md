# Bringing up `myps_db_dev_200`

**Status:** verified against the live database on 2026-09-10. Not yet executed — every step
below is still to be run.

## What this database is

`myps_db_dev_200` was restored onto localhost on 2026-09-10 at 16:47 from the
`192.168.50.200` server, and `Main/appsettings.Development.json` now points `MYPSDb` at it.

It is **a different lineage from `localhost/myps_db_dev`**, not an older copy of it. It
carries the 200 server's reporting and revision fixes, several of which are *newer* than the
versions checked into this repo, and none of the Lump Sum v3 work. That asymmetry is the
whole reason this runbook exists: the folder of SQL scripts is not a queue to be replayed
from the top, and running all of it would revert live fixes.

This repo is database-first. There is no EF migration pipeline, no runner, and no tracking
table, so nothing in the database records what has been applied to it.

## Verified starting state

| Area | State on 2026-09-10 |
|---|---|
| Lump Sum schema | Entirely absent — no `ParentProjectId` / `ItemizationType` / `ProjectStatus`, no `vLumpSum*` views, no seek indexes |
| Lump Sum rollups | `fProgramStages`, `pRecomputeProgramCost`, `fProgramProjects` present but stale (2026-08-14 / 08-31 / 08-24) |
| Wallet era | `tLSWallets` (0 rows), `vLSWalletBalance`, `vLSWalletProjectSet` and `FK_tProjects_ParentWallet` all still present |
| Location columns | `tProjectRevisions.Region` / `.DEO` / `.ImplementingOffice` still `NOT NULL`, so a Lump Sum Project cannot be saved |
| Import tables | Tables exist but were hand-made: no unique index on `JobId`, no defaults, no covering index on the PAP map |
| API permissions | Still the wallet-era action names, so every Lump Sum endpoint returns 403 |
| `READ_COMMITTED_SNAPSHOT` | **OFF** |
| Lump Sum data | **None at all** — 0 projects of type `LS`, 0 live `LS` components, 0 legacy `LS1` components |
| Report procedures | `sp_RBP` and `a1_usp_AIP2` are **newer than the repo's copies** |

## Before you start

1. **Confirm the target.** Only ever run these against localhost. Check that the connection
   string names `Server=localhost`, and re-check it in any scratch build output directory: a
   build copies `Main/appsettings.Development.json`, and the committed version of that file
   has pointed at the shared `192.168.50.200` server before.
2. **Take a backup.** Step 1 drops tables and Step 3 changes a database-level flag. Neither
   is reversible by re-running a script.
3. **Have the application idle.** Step 3 disconnects every other session.

The password is in the uncommitted `MYPSDb` line of `Main/appsettings.Development.json`.
Every command below is written for that file's current target.

## The steps, in order

### Step 1 — Schema and programmability

```
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -i Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql
```

One file, idempotent, covering everything in the table above except the isolation flag. It
folds in the parts of `LumpSum.Baseline.sql`, `Importing.Schema.sql`,
`Importing.CategoryToPAPMap.Schema.sql` and `LumpSum.Permissions.sql` that this database
actually needs, with the definitions copied verbatim. Its own header lists what it closes and
what it refuses to touch.

It refuses to run against a database named `myps_db`.

**Expect:** `Migration.SchemaAndProgrammability.2026-09-10.sql complete.` and a `WARN: OFF`
line about `READ_COMMITTED_SNAPSHOT`, which Step 3 clears.

### Step 2 — Prove Step 1 landed

Re-run the exact same command. A second run must change nothing and raise no error; that is
the idempotency check. Then read the verification output at the end:

| Check | Wanted |
|---|---|
| The three `vLumpSum*` views | All three return a count, not an error. Binding is the real test — a view over a dropped column still *creates* cleanly |
| Wallet-era objects | Zero rows |
| Indexes | `IX_tProjects_ParentProjectId`, `IX_tProjectStages_RevisionId`, `IX_tProjects_ProjectType`, `UX_tImportJobResult_JobId`, `IX_tOptionProjectCategoryToPAPMap_CategoryId` |
| Defaults | Three `DF_tImportJobResult_*` rows |
| Lump Sum actions | The 13 V2 names, no wallet-era name, none ungranted, no dangling grant |
| Importing dependencies | Empty. `DownloadTemplate` and `DownloadImportFile` are `ImportingController` actions the Lump Sum import calls, and Admin did not hold either on this lineage — six e2e specs 403'd on the first, and serial mode took 29 more tests with them (2026-09-13) |
| `sp_RBP` / `a1_usp_AIP2` | **9285 and 10355 characters.** If either shrank, someone also ran the report script and reverted a live fix — see below |

### Step 3 — Read-committed snapshot

```
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -i Main/Resources/LumpSum/SQL/LumpSum.Isolation.ReadCommittedSnapshot.sql
```

Separate from Step 1 on purpose. This changes how the *whole database* isolates readers from
writers, and its `ALTER ... WITH ROLLBACK IMMEDIATE` rolls back open transactions and
disconnects every other session to get the database to itself for an instant. The API and
Hangfire reconnect on their next use. Run it when the application is idle.

The script is database-agnostic and idempotent: it resolves the target through `DB_NAME()`,
prints the flag before and after, and does nothing if the flag is already on.

**Expect:** the `--- after ---` block reports `read_committed_snapshot = 1`.

Left off, Lump Sum reads take shared locks and deadlock with writers. The symptom is not an
error — it is a 12-second read or a request that times out with nothing blocked in
`sys.dm_exec_requests`. See the [Lump Sum deadlock RCA](MYPS_LUMPSUM_DEADLOCK_RCA.md).

### Step 3b — Load the 2023 and 2025 program groups from `MYPS_BAK`

Steps 1-3 give this database the Lump Sum *schema* and no data. The restore it came from carries
the **2024** program groups only; the 2023 and 2025 groups — and with them 61 of the 123 legacy
Lump Sum parents — exist only in `localhost / MYPS_BAK`, in the old data model. This step brings
them across through the reference python pipeline in the backend repo, which also carries the
old system's itemization notes (`dbo.history`, `'Itemized from Project: …'`) into
`tProjectNotes`. Those notes are the **only** record of which child was itemized from which
parent, and Step 3c cannot link a child without them.

**Back up first.** The loader commits per table per stage; a failure mid-group leaves it half
loaded, and only the rollback script or the backup undoes that.

```
cd C:\Users\User\Eptisa\git_wsl\02_refactored\myps-gis-backend       # branch feat/data-migration-2023-2025-groups
.pixi\envs\default\python.exe -m app.data_migration.steps_for_2023_2025_groups                # all four groups, in order
.pixi\envs\default\python.exe -m app.data_migration.steps_for_2023_2025_groups --notes-only   # then: back-fill the 2024 notes
```

Source and target are constants in the entrypoint (`localhost/MYPS_BAK` → `localhost/myps_db_dev_200`);
it refuses any host that is not this machine and refuses a group whose `ProgramPK` already
exists, so a re-run cannot double-load. Run it from a foreground shell — not `nohup … &` from
one that then exits. Load one group at a time with `--group "2023 LP"` if you want to watch the
first one land (80 s); the whole set takes about 20 minutes.

**Expect** per group: `=== <group>: done (MP_…) ===`, and at the end `All groups loaded.`; the
CSSP group also logs one `program cost … exceeds the column; using Σ cost stream` line — that is
the ₱300tn source row, substituted by decision. Then:

| Check | Wanted |
|---|---|
| `tPrograms` | **44** (40 + 4: `MP_P_CO-PS-535_09102022_074918`, `…282_08232022_121112`, `…291_08222022_145740`, `…800_07152024_143901`) |
| `tProjects` / `tProjectRevisions` | **86,597** / **221,534** |
| `tProjectComponentCost` | **515,186**, one row per (revision, component) in the four groups |
| `tProjectNotes` | **4,138** — 4,037 `Itemized from Project` links, every one resolving to a loaded parent |
| `app/data_migration/test_sql/verify_component_grain.py` | 161,756 pairs, all one row, all Total = source |
| `app/data_migration/test_sql/verify_itemization_notes.py` | 4,037 links, 0 unresolved, 1 known source gap (`P00851066VS`) |

To undo a group: `sqlcmd … -i app/data_migration/migration_sql/rollback_program_group.sql -v ProgramPK="MP_…"`.

Full write-up, including the two loader defects fixed on the way and the figures per group:
[loading the 2023/2025 groups](../../../documents/docs/engineering/MYPS_BAK_2023_2025_GROUP_LOAD_2026-09-14.md). The changed files are mirrored under
[documents/python_migration](../../../documents/python_migration/).

### Step 3c — Legacy Lump Sum data (2023 onwards)

```
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -i Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.Proof.Dev.sql   # harness: PASS 8 of 8, rolls back
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -i Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql
```

**Back up first.** This one soft-deletes component and per-year rows; both are reversible by
hand, neither by re-running the script.

This lineage holds **123 Lump Sum projects migrated from 2023-2025 data** — `ProjectPK` ending
in `LS` under Approved GAA-R programs — and **4,037 projects itemized from them**, and all of it
predates the model: parents' components store `ComponentType` as the *code* where every reader
joins on the *name*, four of the 2025 parents hold a `CW` component that *is* their allocation,
every component carries ten per-year rows of which one is real, most parents have no funding
line, and no child knows its parent except through the notes Step 3b carried. Step 3c is that
migration: it types the parents, converts or folds their components into one `Lump Sum` one,
links the children from the notes and stamps them as `ImportItemizedProjects` would, retires the
2024 children's duplicate component copies, and writes each parent's allocation as
`Remaining + Σ children`. It is not optional if you want those projects in `/lumpsum`.

**Run the harness first**, then **do a dry run** (`@DryRun = 1` in section 2b) and read the
scope-by-reason table, the CONVERTING table and the Sub-Category pick table before running for
real. Every fallback in the pick table is a placeholder for someone to correct.

**Expect:** `Lump Sum parents in scope: 83` (61 R1 / 4 R2 / 52 R3 / 0 R4), then `Committed.`,
then every verification count **0** — the five referential, the five model, and the five
Revision 2 counters — and:

| Check | Wanted |
|---|---|
| `vLumpSumSet` | **123** — 3 sample + 57 of 2023 + 59 of 2024 + 4 of 2025 |
| `vLumpSumChildSet` | **4,055** — 18 sample + 2,010 + 2,027 |
| Children linked / duplicate child components retired | **4,037** / **2,237** (all 2024) |
| Funding lines added / raised | **60** / **23** |
| Allocation invariant | **OK** on all 123, no DRIFT |
| `P00730052LS` | 446 children, allocation 20,255,231,704.40 |

Idempotent: a second run reports `parents in scope: 0` and stops. A database that received the
first (2024-only) version of this script is repaired by this one — the 22 itemized parents it
wrote short are re-admitted under R3 and their lines raised.

**MY-prefixed ids are excluded** — `MY00003005LS` and `MY00040003LS` belong to a module that
is not implemented yet. They are inventoried in
[MY-prefixed LS identifiers](../../../documents/MYPS_LS_MY_Prefixed_Projects.md).

Full write-up: [legacy Lump Sum migration](../../../documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md) — §9 is this run's log.

### Step 4 — Optional local fixtures

Only if you need them. Both are local-dev only and must never touch a shared server.

| Script | Run it when | Note |
|---|---|---|
| `LumpSum.SampleData.Dev.sql` | You want Lump Sum data to look at | Copies from a `MyMYPS` database on the same instance. `MyMYPS` **is** present on this localhost instance. See below — it needed rewriting to run here |
| `LumpSum.DataSecurity.Dev.sql` | You are going to run `e2e/tests/ls-data-security.spec.ts` | Creates two fake sign-in accounts. Idempotent: re-running drops and re-creates just those two and touches no existing row |

**Expect from the sample script:** `3 Lump Sum Project(s), 18 itemized child/children`, then
`vLumpSumSet` = 3 and `vLumpSumChildSet` = 18, every `Invariant` reading `OK`, and every
referential-integrity and chain-match count `0`. It is idempotent — a second run deletes the
sample and re-copies it.

The first run on a database that lacks the sample's program also prints
`Program MP_P_CO-PS-535_03252025_073824 is absent here; copying it.`

#### What the sample script had to learn on this database (2026-09-13)

It was written for `myps_db_dev` and did not run here. Three things were wrong, all now fixed
in the script itself:

- **It preserved MyMYPS's identities** with `IDENTITY_INSERT`, on the premise that every source
  Id sits above the target's `MAX`. True of `myps_db_dev`; false here, where `tProjects`
  reaches Id 57,788 against MyMYPS's 56,514 — it refused with `Identity collision on 21 row(s)`
  and the module had no data at all. Each table now allocates its own Id and the copy rewrites
  every foreign key as it goes. Nothing keys on the old numbers: `ProjectPK`, `ProjectId` and
  `ParentProjectId` are strings and are copied verbatim.
- **The sample's program was missing here.** All three parents sit in
  `MP_P_CO-PS-535_03252025_073824`, which `myps_db_dev` has and this database does not; a
  project whose `ProgramFK` matches no program surfaces nowhere, because every Lump Sum view
  joins through the program for its stage and start year. The script now copies it when absent,
  at the TF-R stage it really holds.
- **The copied rows predate two migrations.** MyMYPS still stores `ComponentId = 'LS1'` with the
  component `Total` holding the *balance*; since 2026-09-06 the Total is the full allocation and
  the per-year `Amount` is the balance. Straight-copied, `vLumpSumSet` showed `OriginalAllocation`
  36,000,000 beneath an `ItemizedTotal` of 144,000,000 and the invariant reported `DRIFT`. The
  script's §4e now applies both migrations scoped to the sample. This is the case the
  "every data migration is a no-op here" note below anticipated: they stop being no-ops the
  moment Lump Sum data is copied in.

### Step 5 — End to end

Start the API and load `/lumpsum`. Confirm first that the running build's
`appsettings.Development.json` still names `Server=localhost`.

## Do not run these

### `Reports.CrystalReportSQLFixes.sql` — it would revert live fixes

The live database is **ahead** of the checked-in file for two procedures:

| Object | Live on `myps_db_dev_200` | Repo file |
|---|---|---|
| `sp_RBP` | 9285 chars, modified 2026-09-09 | 7162 chars |
| `a1_usp_AIP2` | 10355 chars, modified 2026-09-10 | 8720 chars |

Those are the 2026-09-09 legacy-parity fix and the 2026-09-10 UACS-filter fix. Their only
trace in this repo is a `_backup_pre_*.sql` snapshot of the state *before* them; no forward
source was ever written back. Replaying the file would revert both silently, which is the
same near-miss `Revision.Queue.sql` records in its own header. The other three objects in
that file already match the live database.

Step 2's last check exists to catch this if it happens anyway.

### Already current — nothing to do

`fRevisionQueue` (correct `@UserId` / `@IsRO` / `@IsCO` signature and all four 2026-09-03
text fixes), `vRevisionPending`, `fProjectStageTargets`, and `pReserveProjectIdBlock`
(raises `PROJECTID_RANGE_EXHAUSTED`, the token `Helpers/ProjectHelper.cs` matches on).

### Every data migration — all no-ops here

`LumpSum.ComponentMigration.sql`, `LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql`,
`LumpSum.Repair.PerYearAmount.2026-09-06.sql`, `LumpSum.Repair.FundingGap.2026-09-06.sql`
and `LumpSum.Repair.FormLookupKeys.2026-09-05.sql` all rewrite *existing* Lump Sum rows.

This database has none: 0 projects of type `LS`, 0 live `LS` components, 0 legacy `LS1`
components, and `tLSWallets` empty. Every one of them would touch zero rows. Skip them, and
revisit only if Lump Sum data is later imported or copied in from another database.

**That "revisit" is triggered by Step 4's own sample script**, which copies pre-migration
MyMYPS rows in. It does not run these files — none of them exists on this branch, and each
sweeps every Lump Sum row in the database, which is equivalent only while the sample is the
only Lump Sum data there is. It applies the two that matter (`ComponentMigration` and
`Migrate.BalanceToPerYear`) itself, scoped to the sample, in its §4e. If you later import real
Lump Sum data from another database, that is when to go and find these scripts on
`lumpsum-v3-backup`.

The `LS` row in `tOptionProjectComponentType` **is** present, which is what the module needs.

## Known divergences, not fixed by this runbook

- **`sp_RBP` and `a1_usp_AIP2` have no forward source.** Both live only in the database. The
  repo holds only pre-fix snapshots. Scripting the current definitions back into
  `Reports.CrystalReportSQLFixes.sql` would close a real gap and remove the trap above.
- **A column rename diverged.** `myps_db_dev_200` has `DataImportId` on seven tables where
  `myps_db_dev` has `DataImportProgramId`. No C# references either name, so the application
  is unaffected, but `pExportRawProjectsMajorItems` on this database still references
  `DataImportProgramId` and will fail when called.
- **Credentials are committed in the clear**, in `.claude/settings.json` and
  `Main/appsettings.Development.json`. Tracked as RISK-090.
