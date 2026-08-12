# Debug Report — Exception Handler Database Diagnostics — 2026-08-11

## Symptom

Database failures were hard to debug from logs because the exception handler logged the raw SQL exception and payload but did not produce a direct table/column/constraint/object diagnosis or EF `SaveChanges` entry details.

Sample observed error:

```text
Cannot insert the value NULL into column 'OldValue', table 'myps_db.dbo.tTransactionLog'; column does not allow nulls. UPDATE fails.
```

## Root cause

`Helpers.ExceptionHandler` already found `SqlException`, but it only classified the SQL error number and optionally extracted a constraint name. It did not parse SQL Server messages for specific database objects, and it did not unwrap `DbUpdateException.Entries` to show which EF entities/properties were being saved.

## Fix

Updated `Helpers/ExceptionHandler.cs` to:

- unwrap `DbUpdateException`;
- parse common SQL Server database failures:
  - NULL into NOT NULL column;
  - truncation with table/column/truncated value;
  - FK/check/unique/PK constraint names;
  - duplicate key object/value;
  - invalid object name;
  - invalid column name;
  - conversion and overflow errors;
- add `DATABASE DIAGNOSTIC SUMMARY` to logs;
- add `EF SAVECHANGES ENTRIES` with entity, mapped table, state, property, column, current/original values, PK/FK/nullable flags;
- keep sensitive values redacted and long values truncated.

## Evidence

`dotnet build Helpers\Helpers.csproj --no-restore --nologo`

Result:

- Build succeeded.
- Errors: 0.
- Warnings: 2 existing package compatibility warnings.

Full `WebAPI` build is currently blocked by unrelated existing errors in `WebAPI/Controllers/Programs/ProgramController.cs` lines 681, 684, and 685 referencing `ProgramRevisions.Type`.

## Status

DONE_WITH_CONCERNS

The exception handler change compiles in the `Helpers` project. Full WebAPI verification is blocked by unrelated current worktree/build errors outside the handler.

