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
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -i Main/Resources/Internal/SQLScripts/Migration.SchemaAndProgrammability.2026-09-10.sql
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
| `sp_RBP` / `a1_usp_AIP2` | **9285 and 10355 characters.** If either shrank, someone also ran the report script and reverted a live fix — see below |

### Step 3 — Read-committed snapshot

```
sqlcmd -S localhost -d myps_db_dev_200 -U sa -P <pw> -C -i Main/Resources/Internal/SQLScripts/LumpSum.Isolation.ReadCommittedSnapshot.sql
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

### Step 4 — Optional local fixtures

Only if you need them. Both are local-dev only and must never touch a shared server.

| Script | Run it when | Note |
|---|---|---|
| `LumpSum.SampleData.Dev.sql` | You want Lump Sum data to look at | Copies from a `MyMYPS` database on the same instance. `MyMYPS` **is** present on this localhost instance, so it will run |
| `LumpSum.DataSecurity.Dev.sql` | You are going to run `e2e/tests/ls-data-security.spec.ts` | Creates two fake sign-in accounts. Idempotent: re-running drops and re-creates just those two and touches no existing row |

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
