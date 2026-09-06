# Plan: surface exception reasons in BatchAllowPublish

Status: **On hold** (operator, 2026-09-06) — investigated and designed, not implemented.

## Goal

`BatchAllowPublish` (`WebAPI/Controllers/Programs/ProgramController.cs`) currently reports which
project IDs failed to become publishable, but not *why*. The operator wants failed projects to
come back with an explanation of which GAA-R rule they violated — the same idea as the
`Exception Report - Project Implementation Plan` / `Exception Report - Project Location` reports
built earlier this session (`documents/plans/` sibling context: see
`MYPS-Module-Function-Inventory.md` Module 10), but surfaced inline on the publish action itself
instead of as a separate report.

## Scope — confirmed narrow by a full sweep of every controller (2026-09-06)

`BatchAllowPublish` is the **only** real candidate in the entire codebase:

- `BatchRestrictPublish`, `BatchDelete`, `BatchAddExistingProject` (same file, same region) only
  ever report "not found" — self-explanatory, no hidden reason being discarded, since none of them
  call a business-rule validation proc.
- `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`,
  `WebAPI/Controllers/Lumpsum/LumpsumController.cs`, `WebAPI/Controllers/PIS/PISController.cs`,
  `WebAPI/Controllers/PCMA/PCMAController.cs` have **no batch/multi-item actions at all** —
  everything there operates on a single ID (`RevisionController`'s actions all take a single
  `TransactionId`, for example).

## Why `BatchAllowPublish` specifically

It already calls `EXEC dbo.pAllowProjectPublishing @ProjectIds = {json}` via
`ExecuteSqlInterpolatedAsync`. Its own code comment (current lines ~1965-1981) states outright:
the proc returns 2 result sets ("1. Summary, 2. Detailed project validation") and *"For this
endpoint we do not need to consume those result sets"* — the per-project reason is already
computed by the database and thrown away by design. The failed list (`notRestoredProjectIds`,
built by re-querying `IsPublishable` before/after the call) is bare project IDs today.

## On the earlier, uncommitted attempt

This session's context referenced a prior rewiring of `BatchAllowPublish` from
`ExecuteSqlInterpolatedAsync` to Dapper `QueryMultipleAsync`, specifically to capture this detail,
done as part of the same (now-reverted) May 2026 `ProjectExceptionReport` work
(`Helpers/ExceptionReport.cs`, `DBHelper/Models/Extra/ExceptionReport.cs`, commit `1b26990f`).
Checked directly: `git log --all -S"QueryMultipleAsync"` and `-S"Dapper"` against
`ProgramController.cs` both return **zero commits** — this rewiring was never actually committed,
same pattern as the original `ExceptionReport.cs` history (built, then discarded before commit).
**There is no "why it was reverted" story to inherit, and no evidence it caused a problem** — it's
simply unfinished work from a prior session that never got saved.

## Confirmed: `pAllowProjectPublishing`'s detailed result set already has everything needed

Read the proc's actual final `SELECT` directly (`sp_helptext dbo.pAllowProjectPublishing` against
`myps_db_dev`, 2026-09-06 — not paraphrased). It joins `@RequestedProjects` (every ID the caller
asked about, including ones that never resolved) against `@Validation` and `tProjects`, and builds
one `ValidationMessage` per project via a single ordered `CASE` — the first rule that fails wins,
in the same priority order the 7 rules are checked in:

```
'Implementing Office is required.'
'Operating Unit is required.'
'At least one Project Component is required.'
'Every Project Component must have at least one Cost Per Year record.'
'Every Cost Per Year record must contain Amount, Year, Start Date, and End Date.'
'Every Project Component must have at least one Major Item of Work.'
'Every Major Item of Work must have at least one Work Location.'
'At least one Funding Profile is required.'
'Project passed all publishing validations.'   -- IsValid = 1
'Project failed publishing validation.'        -- fallback
```

This is the **single source of truth** for why publishing failed — reusing it means the reason
shown can never drift from what the proc actually decided for that project. Deliberately *not*
pieced together from the 2 exception-report procs built earlier this session
(`pProjectImplementationPlanExceptions`/`pProjectLocationExceptions`, see
`Main/Resources/Internal/SQLScripts/`) — those only re-derive 2 of the 7 rules independently as a
separate, program-wide *review* tool; using them here would risk showing a reason that disagrees
with what `pAllowProjectPublishing` itself just decided in the same request.

The proc has 2 sequential `SELECT` statements confirmed via `sp_helptext`: "10. SUMMARY RESULT SET"
(aggregate counts, section header found ~line 1543 of the proc body) first, then the detailed
per-project one described above. Not needed for this feature: the Summary result set — only the
detailed one matters here.

## Design

1. **Rewire `BatchAllowPublish`** (current lines ~1986-1991) from `ExecuteSqlInterpolatedAsync` to
   Dapper's `QueryMultipleAsync`, called on the same connection/transaction already open in this
   method (`_db.Database.GetDbConnection()` + `transaction.GetDbTransaction()`, so the read
   participates in the same transaction as the rest of the method rather than a separate
   connection). Skip result set 1 (Summary), read result set 2 into a small
   `record ProjectPublishValidationDetail(string ProjectId, bool IsValid, string ValidationMessage)`.
2. **Open response-shape decision — needs the operator, not yet chosen:** the current
   `NotRestoredProjectIds` field is a plain `string[]`; some frontend code may already depend on
   that exact shape.
   - **Option A (lower risk):** add a new field alongside it, e.g.
     `NotRestoredReasons: [{ProjectId, Reason}]`, leaving `NotRestoredProjectIds` untouched.
   - **Option B (cleaner):** replace `NotRestoredProjectIds`'s shape entirely with the richer
     `{ProjectId, Reason}` array. Only safe if nothing in `FE/src` currently reads it as bare
     strings — **not checked yet**, would need a grep of `FE/src` for `NotRestoredProjectIds`
     before choosing this option.
3. `MissingProjectIds` does **not** need the same treatment — "not found" is already
   self-explanatory, consistent with why the other 3 batch actions don't need this either.

## Affected files (when this is picked back up)

- `WebAPI/Controllers/Programs/ProgramController.cs` — `BatchAllowPublish` only (~lines 1960-2170
  as of 2026-09-06; line numbers will drift as the file changes).
- Possibly `FE/src/pages/Program/...` — only if Option B is chosen and something there currently
  reads `NotRestoredProjectIds` as bare strings.
- No SQL changes needed — `pAllowProjectPublishing` already computes everything required.

## Next concrete action (when un-paused)

Get the operator's call on the response-shape question (Option A vs. B) — grep `FE/src` for
`NotRestoredProjectIds` first if Option B is being considered — then implement, `dotnet build` /
`dotnet test`, and verify with a real drilled call against `myps_db_dev` (a request containing at
least one project genuinely missing a required field, to confirm a real, non-generic
`ValidationMessage` comes back, not just a happy-path compile check) before calling it done.
