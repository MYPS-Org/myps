# `SyncAPIPermissions` — the reflection block is unreachable

**File:** [`WebAPI/Controllers/Settings/UserManagement/UserManagementController.cs`](../../../WebAPI/Controllers/Settings/UserManagement/UserManagementController.cs)
**Found:** 2026-09-03, while running the endpoint for the first time during Lump Sum V2 phase 4
**Status:** **APPLIED 2026-09-03.** The dead block is gone, the nullable return type and its
null check with it, and the helper is now `ReconcileApiPermissionsAsync`. Net −80/+40 lines.
Kept as the record of why the dead path must not be revived — the reasoning now lives in
XML doc comments on both methods, and this document is what they cite.

**Re-checked 2026-09-12** after the rebase onto `dev-trunk` and the `myps_db_dev_200` restore. The
cleanup holds: the endpoint is now at line 1029 and is a single `return await
ReconcileApiPermissionsAsync(...)`; the helper at line 1579 still has exactly one `return`, still
keys on `ControllerName + '\0' + ActionName`, still removes stale rows and strips their ids from
every group, and still commits as its last act — the `catch` block's rollback now carries a comment
saying why that ordering is load-bearing. **The line numbers quoted in the sections below are as of
2026-09-03 and describe code that no longer exists; they are the record, not a map.** Two things
around the endpoint *have* changed, and both are recorded in dated addenda at the end: the SQL
script that deliberately does *not* delegate to this endpoint now ships in a second place, with
fresh live evidence for why; and the Dashboard footnote is inverted on this branch.

## Summary

`POST /api/UserManagement/SyncAPIPermissions` contains **two independent implementations of
the same job**. Lines 1016–1091 — the commented, step-numbered reflection block that reads
like the body of the endpoint — have **never executed**. The work is done entirely by
`SyncApiPermissionsValidated` (line 1619), a 25-line helper called on the first statement.

The dead block is not a stale copy of the live one. It is missing stale-row detection, and its
duplicate test is wrong in a way that is already live in the database. Deleting it is the fix;
restoring it would be a regression **and** would throw on a committed transaction.

## Why it is unreachable

The endpoint's first two statements:

```csharp
// line 1013
var remediatedResult = await SyncApiPermissionsValidated(transaction, cancellationToken);
if (remediatedResult != null) return remediatedResult;

// line 1016
// 1. Discover all controller Types via reflection
...
```

The helper is declared `Task<IActionResult?>`, and that `?` is the whole reason the `if` reads
as a guard. But the helper contains **exactly one return statement** in its 25 lines:

```csharp
// line 1641-1642
await _db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
return Ok(new { Message = "API permission reconciliation complete.", ... });
```

No early exits, no conditional, no `return null`. `remediatedResult` therefore cannot be null,
the `if` always fires, and nothing from line 1016 to line 1091 can run. **The nullable return
type advertises a contract the method does not have** — it is the entire source of the
illusion.

## Runtime proof

The two paths return different response shapes, so the endpoint's own output identifies which
one ran:

| Path | `Message` | Shape of `Actions` |
|---|---|---|
| Helper (line 1642) | `"API permission reconciliation complete."` | `{ Added, Removed, Unchanged }` — counts |
| Dead block (line 1085) | `"Sync complete! Controllers added: …"` | `[ … ]` — full row lists |

Observed on 2026-09-03 against `localhost:5015` / `myps_db_dev`:

```json
{
  "Message": "API permission reconciliation complete.",
  "Title": "Sync Complete",
  "Controllers": { "Added": 0, "Removed": 0, "Unchanged": 14 },
  "Actions":     { "Added": 6, "Removed": 10, "Unchanged": 119 }
}
```

Counts, and the helper's wording. The block below has never executed in this build.

## Do not restore it — it is the worse implementation

Two behavioural differences, either of which would be a regression.

### 1. It never removes anything

The dead block only adds. It has no equivalent of the helper's `staleActions` / `staleControllers`
handling, which deletes actions absent from the assembly *and* strips their ids out of every
group's `tGroupRoles.ActionIds`. When the endpoint was finally run, that housekeeping removed
**10 rows** and left **0 dangling grants**. Under the dead block those 10 would still be
registered and still granted, pointing at methods that no longer exist.

### 2. Its duplicate test ignores the controller

```csharp
// lines 1054-1060
var existingActionKeys = existingActions
    .Select(x => x.ActionName)              // ← ActionName only
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

var newActions = discoveredActions
    .Where(a => !existingActionKeys.Contains(a.ActionName));
```

An action counts as already registered if **any** controller has a method of that name. The
helper keys correctly on `ControllerName + '\0' + ActionName`.

This is not hypothetical — the collision exists in `myps_db_dev` today:

```
ActionName  | OnHowManyControllers | Controllers
AddProject  | 2                    | ProjectController, ProjectGroupController
```

Whichever was registered first would permanently suppress the other. Because
[`UpdateUserGroup` refuses ids that are not registered](#related), the suppressed endpoint
could never be granted to anyone — a 403 for every user, with nothing in the permissions UI to
explain it.

### 3. The early return is load-bearing

The helper **commits the transaction** (line 1641) before returning. The dead block ends with
its own:

```csharp
// lines 1073-1074
await _db.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

Both share the one `IDbContextTransaction` opened at line 1010. So deleting the `return` to let
the block run would commit an already-committed transaction:

> `This SqlTransaction has completed; it is no longer usable.`

That is the same failure this codebase has already been bitten by — recorded as decision 7 of
the Lump Sum V2 plan, where a `RollbackAsync` in a `catch` replaced the real exception and cost
a debugging session. Here it would surface as a 500 from a `catch` block, with the sync having
already succeeded.

**Consequence:** the dead code cannot be revived by removing one line. Anyone attempting that
gets a green-then-red endpoint and a misleading error.

## The change, as applied

Cleanup only; no behavioural change intended, and none observed.

1. **Delete lines 1016–1091** — the reflection block, from `// 1. Discover all controller Types`
   through its `return Ok(...)`.
2. **Change the helper's return type** from `Task<IActionResult?>` to `Task<IActionResult>`, and
   collapse the call site to a plain `return await SyncApiPermissionsValidated(...)`. Leaving the
   `?` and the `!= null` check in place is what produced this report; the next reader will
   reach the same wrong conclusion.
3. **Consider renaming the helper.** `…Validated` suggests a validation step that returns null
   on success. It is the implementation. Something like `ReconcileApiPermissionsAsync` describes
   what it does.
4. **Leave the transaction where it is.** The helper owning both `SaveChanges` and `Commit` is
   correct once the second path is gone.

### Verification performed

| Check | Result |
|---|---|
| Build | `dotnet build WebAPI` — 0 errors, no new warnings |
| Response unchanged | `"API permission reconciliation complete."`, count-shaped payload, HTTP 200 |
| **Idempotency** — run twice | Both runs `Controllers 0/0/14`, `Actions 0/0/125`. Untested before this change |
| Granting still refuses unregistered ids | `"The following Action IDs do not exist: 999. Please sync permissions and try again."` — 400 |
| Granting still accepts a valid set | 200, group unchanged, `ApplyFilter` preserved |
| Dangling grants | `0` |
| Lump Sum regression | `ls-contract` + `ls-data-security`: 16 passed, 2 known-gap skips |

One note on the regression run: the first combined attempt failed on the opening test of each
file, because the API had only just started and the first request in each timed out. Re-running
against a warm process was green. It also aborted `afterAll`, leaving one orphan Lump Sum
Project behind — worth knowing that a failed run of these suites does not always clean up
after itself.

Re-run the idempotency check with:

```bash
curl -s -b <cookiejar> -X POST http://localhost:5015/api/UserManagement/SyncAPIPermissions
# twice; the second must report Added: 0, Removed: 0

# and no grant may point at a missing action:
SELECT COUNT(*) FROM dbo.tGroupRoles gr
CROSS APPLY OPENJSON(gr.ActionIds) WITH (ActionId INT '$') a
WHERE NOT EXISTS (SELECT 1 FROM dbo.tApiActions t WHERE t.Id = a.ActionId);   -- must be 0
```

## Related

Three adjacent facts established in the same session, recorded in full in
[`documents/plans/lump-sum-v2.md`](../../plans/lump-sum-v2.md) under *Known gaps*:

- **The endpoint works.** `LumpSum.Permissions.sql`'s header claimed for months that it writes
  to `tPermissionControllers` / `tPermissionActions` and fails with *Invalid object name*. Those
  tables do not exist, but the endpoint never references them — it uses `tApiControllers` /
  `tApiActions`. Corrected in that script's header.
- **`UpdateUserGroup` is a full replace.** `ActionIds` becomes exactly what the request sends,
  and `tGroups.ApplyFilter` is written from the same payload, so a caller posting a partial set
  silently revokes everything omitted.
- **`UpdateUserGroup` refuses unregistered ids** — *"The following Action IDs do not exist: N.
  Please sync permissions and try again."* Registration really is the prerequisite for granting,
  which is what makes the sync endpoint worth having correct.

### Since then — 2026-09-12

**The SQL script is not a substitute for this endpoint, and now says so in two places.**
`LumpSum.Permissions.sql` registers and grants the thirteen Lump Sum actions by hand, and its
header has always explained why it does not simply call `SyncAPIPermissions`: the reconciler is
correct housekeeping, but it *also* deletes every action absent from the assembly and rewrites
every group's `ActionIds` as a side effect, which belongs in a deliberate maintenance step and
not in a module's setup. That script is now folded verbatim into Part 7 of
[`Migration.SchemaAndProgrammability.2026-09-10.sql`](../../../Main/Resources/Internal/SQLScripts/Migration.SchemaAndProgrammability.2026-09-10.sql),
whose header restates the distinction, and the ordered procedure is
[`MYPS_DEV_200_DATABASE_BRINGUP.md`](MYPS_DEV_200_DATABASE_BRINGUP.md).

**Live evidence for that distinction**, verified on both localhost databases on 2026-09-12:

| | `myps_db_dev` | `myps_db_dev_200` (restored 2026-09-10 from the 200 server) |
|---|---|---|
| `LumpsumController` actions registered | the 13 V2 names | `InitFilterLumpsum`, `LumpsumDetails`, `ShowItemizedProjects`, `ShowLumpsum`, `WalletBalance` |
| Wallet-era names still registered | 0 | **4**, granted to group 2 (AUC) |
| Dangling grants | 0 | 0 |
| `AddProject` registered on | 2 controllers | 2 controllers |

On `_200`, running this endpoint would be *correct* — it would delete those four rows and
strip their ids out of AUC's grants — and it would do the same to every other stale action on
that database and touch every group's row to do it. The script's §0 retires exactly those four
names and nothing else, which is the whole point of keeping it. And the `AddProject` collision
that made the dead block's `ActionName`-only key wrong is still present on both databases, so
the compound key in the live helper is still what keeps `ProjectGroupController.AddProject`
registrable.

Separately, and outside this document's scope: `WebAPI.csproj` carries
`<Compile Remove="Controllers\Dashboard\**" />`, so `DashboardController` is not in the
assembly, `/api/Dashboard/Summary` returns 405, and the sync rightly removed its two registered
actions — while `FE/src/pages/Dashboard/` still calls those endpoints.

> **Inverted on this branch, 2026-09-12.** `dev-trunk` never carried that `Compile Remove`
> line, so after the rebase `WebAPI.csproj` has no Dashboard exclusion at all:
> `DashboardController.Summary` is compiled and routable, and `FE/src/pages/Dashboard/Service.ts`
> still posts to `/Dashboard/Summary`. The consequence for this endpoint: on `myps_db_dev` the
> 2026-09-03 run removed `DashboardController`'s actions (0 registered today), so the **next**
> sync on that database will *add* `Summary` back — and, per the `UpdateUserGroup` rule above,
> it will 403 for everyone until a group is granted it. `myps_db_dev_200` never had that run and
> still registers `Summary`. Whether the Dashboard should be live is a product question this
> document does not answer; what it does say is that a sync run now changes the Dashboard's
> registration in the opposite direction from the one recorded above.
