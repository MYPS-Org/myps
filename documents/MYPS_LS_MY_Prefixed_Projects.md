# `MY…LS` identifiers on `myps_db_dev_200` — inventory, not migrated

**Date:** 2026-09-14
**Database:** `localhost` / `myps_db_dev_200`
**Status:** excluded from `LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql` by instruction.

---

## Why this file exists

`myps_db_dev_200` carries identifiers that end in `LS` but begin with `MY`. They
belong to a **different module and data model, not yet implemented**, and were
therefore excluded from the 2026-09-14 legacy Lump Sum migration (instruction,
2026-09-14). This file is the record of what was left behind, so whoever builds
that module has the set in front of them.

The migration's scope predicate states the exclusion explicitly:

```sql
AND lr.ProjectId NOT LIKE N'MY%'
```

That clause matches nothing today — **no `MY…LS` value is a `tProjects.ProjectPK`
or a `tProjectRevisions.ProjectId`.** They exist only as *references*: in
`tProjects.MYId`, `tProjects.ExternalId`, and `tProjectRevisions.AlternateId`.
The clause is there so a future restore that does carry them as project keys is
excluded by the predicate rather than by luck.

## What makes them different from the 59 that were migrated

The 59 legacy Lump Sum parents have **no children at all** — searched five ways
and confirmed zero. These `MY…LS` values are the opposite: they are the only
Lump-Sum-shaped identifiers in this database that genuinely have
`AlternateId`-linked children. That parent/child relationship is precisely the
thing the unimplemented module is expected to model, which is why they are
someone else's migration and not a gap in this one.

Note also that **no `MY…LS` project row exists to be their parent.** Every value
below is a dangling reference: 15 projects point at `MY00003005LS` and 1 at
`MY00040003LS`, and neither is a `ProjectPK` or a revision `ProjectId` anywhere
in the database. Whatever holds those records, it is not `tProjects`.

---

## The inventory — 16 projects, 2 distinct `MY…LS` identifiers

`AlternateId` is read from each project's **latest live revision**. Where it
differs from the `MY…LS` value, the `MY…LS` reference lives in `MYId` /
`ExternalId` and in that project's **earlier** revisions — see the note below the
table.

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

---

## Notes on the rows

- **`ProjectType` is `'NULL'`** — the literal four-character string, not a null —
  on all 15 of the GAA 2024 rows. That is a restore artifact shared by 56,769
  projects on this lineage and is not specific to these. The legacy Lump Sum
  migration left it alone outside its own 59; see its header.
- **`BP01009254VS` is a test fixture, not 2024 data.** Its program
  (`LAPTOP-DG33KKDI_09102026_152436`, "BP 2026 OO-1 Region 2 Project") was created
  on 2026-09-10 on someone's laptop, and its `ProjectType` is a real `'VS'`. It
  carries `MY00003005LS` in `MYId`/`ExternalId` because it was copied from one of
  the rows above. Treat it as noise unless the new module wants it.
- **`P00713368LZ` carries `DPWH-HGAB-05011` in `AlternateId`** rather than its own
  id — a House GAB reference. Recorded because it is the one row in the set whose
  `AlternateId` is neither its own id nor an `MY…LS` value.
- **Only `P00655042VS` still carries an `MY…LS` value in the latest live
  revision's `AlternateId`.** For the other 14, the `MY00003005LS` reference sits
  in `MYId` / `ExternalId` and in *earlier* revisions; the latest revision has
  since been re-stamped with the project's own id. A query written only against
  the latest revision's `AlternateId` will therefore find 1 of the 16, which is
  why the query below reads all three columns.

---

## The query that produced this

Re-runnable as-is against `localhost` / `myps_db_dev_200`:

```sql
SET NOCOUNT ON;

SELECT DISTINCT
       p.ProjectPK,
       lr.ProjectId,
       lr.AlternateId,
       ISNULL(p.ProjectType, '<null>') AS ProjectType,
       p.MYId,
       p.ExternalId,
       p.ProgramId,
       ISNULL(pl.[Name], '<none>')     AS ProgramName
FROM   dbo.tProjects p
CROSS APPLY (
    SELECT TOP 1 r.*
    FROM   dbo.tProjectRevisions r
    WHERE  r.ProjectFK = p.ProjectPK AND r.IsDeleted = 0
    ORDER  BY r.Id DESC
) lr
LEFT JOIN dbo.vProgramLatest pl ON pl.ProgramPK = p.ProgramFK
WHERE  p.MYId        LIKE 'MY%LS'
   OR  p.ExternalId  LIKE 'MY%LS'
   OR  lr.AlternateId LIKE 'MY%LS'
ORDER  BY p.ProjectPK;
```

To confirm the claim that no `MY…LS` value is itself a project key:

```sql
SELECT COUNT(*) AS as_project_pk
  FROM dbo.tProjects        WHERE ProjectPK LIKE 'MY%LS';        -- 0
SELECT COUNT(*) AS as_revision_projectid
  FROM dbo.tProjectRevisions WHERE ProjectId LIKE 'MY%LS';        -- 0
```

To see every revision (not just the latest) that references one:

```sql
SELECT r.ProjectFK, r.Id AS RevisionId, r.ProjectId, r.AlternateId, r.IsDeleted
FROM   dbo.tProjectRevisions r
WHERE  r.AlternateId LIKE 'MY%LS'
ORDER  BY r.ProjectFK, r.Id;
```

---

## Related

- `Main/Resources/LumpSum/SQL/LumpSum.Migrate.LegacyLSProjects.2026-09-14.sql` — the migration that excludes these.
- `documents/docs/engineering/MYPS_LEGACY_LS_MIGRATION_2026-09-14.md` — what was migrated, and why these were not.
