# Revision Controller and Script-Revision Issue Register

Date: 2026-08-11

## Line Number Baseline

These line numbers were read from the current saved files.

| File | Lines | Last modified |
|---|---:|---|
| `C:\Users\khen\Documents\ChatGPT\MYPS\sources\database\myps_db(script-revision).sql` | `270` | `2026-08-11 10:19:09` |
| `C:\Users\khen\source\repos\mf1027\project_myps\WebAPI\Controllers\Revision\RevisionController.cs` | `3175` | `2026-08-11 10:08:31` |

## File 1: `myps_db(script-revision).sql`

Path:

`C:\Users\khen\Documents\ChatGPT\MYPS\sources\database\myps_db(script-revision).sql`

### Confirmed OK

| Line | Object | Status |
|---:|---|---|
| `2` | `tRevisionDocuments` | exists |
| `112` | `tRevisionDetails` | exists; `Id` primary key is present |
| `244` | `fPendingProjectComponentCost` | exists |

### Issues

| Line(s) | Object / code | Issue | Fix |
|---:|---|---|---|
| `32`, `44` | `vRevisionRules`, then `vRevisionLists` | `vRevisionRules` starts at line `32`; `vRevisionLists` starts at line `44` with no `GO` between them. SQL Server requires `CREATE VIEW` / `CREATE OR ALTER VIEW` to be isolated in its own batch. | Add `GO` after line `42`. |
| `41` | `FROM tRevisionRules tr` | `vRevisionRules` does not filter active rules. Inactive rules may be selected by the controller. | Add `WHERE tr.IsActive = 1`. |
| `44` | `CREATE OR ALTER VIEW [dbo].[vRevisionLists] AS (` | Outer parentheses around the view query are risky/likely invalid SQL Server view syntax. | Prefer `AS SELECT DISTINCT ...` without wrapping the whole query in parentheses. |
| `80` | `co.TransactionId = co.TransactionId` | Self-comparison. This can return the latest CO correction globally instead of the current transaction correction. | Change to `co.TransactionId = rd.TransactionId`. |
| `84` | `co.TransactionId = co.TransactionId` | Same self-comparison bug for CO correction date. | Change to `co.TransactionId = rd.TransactionId`. |
| `100`, `102` | view end then `DROP TABLE [tRevisionDetailsComponentsStatus]` | `vRevisionLists` ends at line `100`; `DROP TABLE` starts at line `102` with no `GO`. This violates view batch rules. | Add `GO` after line `100`. |

## File 2: `RevisionController.cs`

Path:

`C:\Users\khen\source\repos\mf1027\project_myps\WebAPI\Controllers\Revision\RevisionController.cs`

### Confirmed OK / Expected

| Line | Code | Status |
|---:|---|---|
| `154` | `_db.vRevisionLists` | referenced view exists in `script-revision.sql`, after SQL batch fixes |
| `204`, `448`, `679`, `2010` | `_db.vRevisionRules` | referenced view exists in `script-revision.sql`, after SQL batch fixes |
| `1786`, `1788` | `fPendingProjectComponentCost` | referenced function exists in `script-revision.sql` |

### Issues

| Line(s) | Function / area | Issue | Fix |
|---:|---|---|---|
| `402` | pending check | Uses display ProjectId string prefix: `TransactionId LIKE {dto.ProjectId + "-%"}`. Better than broad `Contains`, but still not stable identity. | Use exact stable `ProjectFK`, exact `ProjectRevisionFK`, or a validated transaction prefix format. |
| `696` | `RequestRevision` pending check | Uses broad display ProjectId prefix: `TransactionId LIKE {dto.ProjectDetails.ProjectId + "%"}`. This can match unintended transactions. | Use exact stable Project identity. |
| `840` | `RequestRevision` project-id mutation | `RevisionGroupId == 13` changes ProjectId to `-A` for all group 13 reasons. | Gate by exact continuation `ReasonId`. |
| `1372` | `RequestRevision` document upload | `IsApprovedDocument = isCOUser ? true : false` can mark the request/submission document as CO-approved. Confirmed process says IO document before submit is `false`; CO approval document is `true`. | Set request/submission document to `false`; keep CO final approval document as `true`. |
| `1394` | `RequestRevision` group 13 branch | Branch runs for all group 13 reasons. | Gate by exact continuation `ReasonId`. |
| `1727` | `UpdateRevisionStatus` rejected guard | Uses `RegionStatus != Rejected || COStatus != Rejected`. If one side is rejected and one is not, the row still passes. | Use explicit terminal-state logic; if flat model remains, likely `&&`. |
| `1801` | `UpdateRevisionStatus` group 13 branch | Branch runs for all group 13 reasons. | Gate by exact continuation `ReasonId`. |
| `2027` | `ResubmitRevision` pending check | Uses broad display ProjectId prefix: `TransactionId LIKE {dto.ProjectDetails.ProjectId + "%"}`. | Use exact stable Project identity. |

## Build Status

Latest build failure:

```text
CSC : error CS2012: Cannot open '...\WebAPI\obj\Debug\net8.0\WebAPI.dll' for writing
Access to the path is denied.
```

This is not a Revision compile error. Visual Studio was running during the check, so the likely cause is a locked build artifact.

## Fix Order By File

### SQL file first

1. Add `GO` after line `42`.
2. Add `WHERE tr.IsActive = 1` to `vRevisionRules`.
3. Rewrite `vRevisionLists` as `AS SELECT DISTINCT ...`, without the outer `AS (` wrapper.
4. Fix lines `80` and `84` to `co.TransactionId = rd.TransactionId`.
5. Add `GO` after line `100`.

### Controller second

1. Fix line `1372` document classification.
2. Fix line `1727` rejected guard.
3. Replace pending checks at lines `402`, `696`, and `2027`.
4. Gate group 13 logic at lines `840`, `1394`, and `1801` by exact `ReasonId`.
