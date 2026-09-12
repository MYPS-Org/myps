# `CK_tProjects_ProjectType` — removed, and what `ProjectType` actually holds

**Table / column:** `dbo.tProjects.ProjectType` (`nvarchar`, NOT NULL)
**Decision:** remove the CHECK constraint; change nothing else (maintainer, 2026-09-05)
**Script:** [`LumpSum.Baseline.sql` §1](../../../Main/Resources/Internal/SQLScripts/LumpSum.Baseline.sql) now drops it and does not re-create it
**Applied to:** `localhost/myps_db_dev` on 2026-09-05

## What the constraint was

```sql
CK_tProjects_ProjectType  CHECK (ProjectType IN (N'MY', N'LS', N'AIP', N'NP'))
```

| Code | Meaning |
|---|---|
| `MY` | Multi-Year |
| `LS` | Lump Sum — the parent, and every itemized child |
| `AIP` | Regular AIP |
| `NP` | Non Project, never published to PCMA |

## History

| When | Where | What |
|---|---|---|
| before 2026-08 | the database, outside any repo script | a three-value version (`MY`, `LS`, `AIP`) already existed |
| 2026-08-04 | `LSWallet.Schema.sql` (`0251a66b`, on `dev-trunk`) | dropped and re-created with `NP` added, per the flow document's Non Project type |
| 2026-08-05 | `LSWallet.Revisions.Schema.sql` (`9777dc39`, on `dev-trunk`) | same four values |
| 2026-09-01 | `LumpSum.Baseline.sql` §1 (`8a937c25` / `62e48a26`, this branch) | re-homed; added WITH NOCHECK when existing rows violate it, WITH CHECK otherwise |
| 2026-09-05 | `LumpSum.Baseline.sql` §1 | **dropped, not re-created** |

## Why it was removed

1. **Wrong shape for a growing code set.** A hard-coded value list in a CHECK constraint has to
   be edited by a schema change every time a project type is added — `NP` was exactly such an
   edit. A code set the application owns belongs in an enum/lookup table with a foreign key.
2. **The Program importer never conformed to it.** `Hangfire/Importing/ImportingHelper.cs`,
   `SaveProjectDetails`, writes the row's **island code** into `ProjectType` in all three of
   its identity branches — the new project (line ~1342), the retained revision (~1301) and the
   existing-project-new-stage case (~1355). `LZ`, `VS` and `MN` are not in the allowed set, so
   on any database carrying the baseline a clean Program import failed at its first INSERT with
   *"The INSERT statement conflicted with the CHECK constraint CK_tProjects_ProjectType"*.
   Found 2026-09-05 while proving the Lump Sum V3 extraction
   ([`lump-sum-v3.md`](../../plans/lump-sum-v3.md)).
3. **The data never conformed either.** On the 2026-09-01 localhost restore, all 56,289
   non-Lump-Sum rows carried the literal four-character string `NULL` (the word; the column is
   NOT NULL). The baseline could therefore only add the constraint WITH NOCHECK — untrusted,
   guarding new rows against a rule the existing rows already broke.

## What writes `ProjectType` today

| Writer | Value written | Notes |
|---|---|---|
| `LumpsumController.Writes.cs` — Create / Update Lump Sum | `LS` | the parent |
| `LumpsumController.Import.cs` — itemization import | `LS` | every itemized child; the child's **island code** goes to the Project ID suffix and `tProjectRevisions.IslandCode`, never here |
| `ProjectController.AddProject` | whatever the client sends in `dto.ProjectType` | a commented-out line beside it shows an older convention: the island code unless it was `LZ`/`VS`/`MN`, otherwise `AIP` |
| `RevisionController` (continuation fork) | copies the original project's `ProjectType` | |
| `ImportingHelper.SaveProjectDetails` (Program import / update) | the row's **island code** (`LZ` / `VS` / `MN`) | three writes; looks like a remnant of the older convention above. **Not changed by this decision** |

## What the Lump Sum module relies on

Only the value `LS`, and `ParentProjectId`. Membership is `ProjectType = 'LS'` plus the parent
link; the island code of an itemized child is derived from its Region and lands in the generated
Project ID (`…LZ` / `…VS` / `…MN`) and in `tProjectRevisions.IslandCode`. None of that needed the
constraint, and none of it changes with its removal.

## Follow-ups (recorded, not done)

- **Enum table.** A `dbo.tOptionProjectType` (code, name, `IsActive`) with a foreign key from
  `tProjects.ProjectType`, read by the UI for its dropdown and by every writer for validation.
  Seeding it requires deciding what the importer's island-code values and the 56k `'NULL'` rows
  become.
- **Importer.** `SaveProjectDetails` should stop writing the island code into `ProjectType` once
  the column's meaning is settled by the table above; it already writes the code to the Project
  ID and `tProjectRevisions.IslandCode`.
- **Data.** The literal `'NULL'` rows are a data decision, separate from schema.

## How to verify

```sql
SELECT name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.tProjects');
-- expect no CK_tProjects_ProjectType
SELECT ProjectType, COUNT(*) FROM dbo.tProjects GROUP BY ProjectType;
```

A Program import of a clean workbook through `ImportingController.ImportProject` now reaches
`Completed` on a database carrying the baseline; before the drop it ended `Failed` at the INSERT.

Observed on localhost right after the drop (2026-09-05): the import and the update both
`Completed`, and the project they wrote — `P01100005LZ`, `AlternateId V3VERIFY-…-P1` — carries
`ProjectType = 'LZ'`. That row is the importer's behaviour made visible, and is the case the
enum-table follow-up has to decide.
