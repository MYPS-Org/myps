# R6 — API action Ids diverge between database lineages

**Status:** Open — a standing hazard for anyone writing grant SQL
**Raised:** 2026-09-13, during the `myps_db_dev_200` bring-up
**Rating:** Medium likelihood / Medium impact
**Related:** `MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md` (risk register, R6);
`MYPS_SYNCAPIPERMISSIONS_DEAD_REFLECTION_PATH.md`

## The mechanism

`dbo.tApiActions` names every API action the permission filter enforces —
`ImportingController.DownloadTemplate`, `LumpsumController.CreateLumpSum`, and so on. Its `Id`
is an `IDENTITY` column: the database hands out the next number whenever a row is inserted.

Grants are stored in `dbo.tGroupRoles.ActionIds` as a **JSON array of those numbers**:

```json
[3, 17, 123, 138]
```

On a single database that is fine. The problem is that this project now has two databases that
were never the same copy — `myps_db_dev` and `myps_db_dev_200`, a restore of the
`192.168.50.200` server — and each registered its actions in its own order, at its own time. So
the same number means a different thing on each:

| `Id` | on `myps_db_dev_200` | on `myps_db_dev` |
|---|---|---|
| 123 | `DownloadTemplate` | `DeleteItemizedProject` |
| 141 | *(another action)* | `DownloadTemplate` |

Nothing is wrong with either database. Each is internally consistent. **The hazard lives
entirely in scripts that carry Ids from one to the other** — and every future lineage restored
from the shared server or from production will diverge in the same way.

## How it bites

Someone writes a permission fix on `myps_db_dev`, looks up the Ids Admin needs, and commits:

```sql
UPDATE dbo.tGroupRoles
   SET ActionIds = JSON_MODIFY(ActionIds, 'append $', 141)
 WHERE GroupId = 1;
```

On `myps_db_dev` that grants `DownloadTemplate`. Run the same script on `dev_200` and it grants
whatever `141` is *there* — silently, with no error — and the action they meant to grant stays
ungranted. It looks like it worked. `ActionIds` is a JSON array of integers with no foreign key,
so the database cannot tell you the number points at the wrong row.

Nothing fails: no error, no log line, no test. You find out when a user reports a 403 on a
lineage nobody tested — which is precisely how the `DownloadTemplate` gap (R4) surfaced.

## Why this is "open" when R4 is closed

The bring-up branch grants by **name**, resolving the Id at run time:

```sql
SELECT Id FROM dbo.tApiActions
WHERE  ControllerName = N'ImportingController'
  AND  ActionName COLLATE Latin1_General_BIN2 IN (N'DownloadTemplate', N'DownloadImportFile')
```

That is correct on any database. But it is a convention that one branch followed, not a rule the
repository enforces. Nothing stops the next script from pasting literal Ids, and the existing
lineage of permission scripts grew up on one database. So the **specific** defect is closed and
the **class** of defect is open.

## What would close it

In increasing order of cost:

1. **A rule in the SQL-scripts guide.** Grant SQL matches `ControllerName` + `ActionName`, never
   `Id`. Cheap, and the first thing to do.
2. **A verification block in every grant script** that prints what the group ended up holding
   *by name*, so a wrong-Id grant is visible in the output rather than invisible in a JSON array.
   `Migration.SchemaAndProgrammability.2026-09-10.sql` already does this for the Lump Sum and
   Importing actions and is the pattern to copy.
3. **A natural key on `tApiActions`** — a unique index on `(ControllerName, ActionName)` — with
   grant scripts written as lookups against it. This also lets a "no dangling grant" check catch a
   miss rather than merely a number that points nowhere.
4. **Stop storing grants as a JSON array of integers.** A proper `tGroupActions(GroupId,
   ActionId)` table with a foreign key makes a wrong Id a constraint error. This is a product
   change and out of proportion to any single bring-up; it belongs with the RBAC work.

Items 1 and 2 cost an afternoon and remove most of the risk. Item 3 is the one that makes the
mistake *impossible* to commit unnoticed.
