# Plan: Merge `report-importing` into `merging-branch-import-to-revision`

Status: Ready for implementation
Created: 2026-08-21
Source: User request to fix PR #105's conflict and fold in "every commit for the importing branch including the new import in front end"

## Goal
Fold the 15 commits unique to `report-importing` (async, job-based project import: Hangfire job service, rewritten `ImportingController`, new `ImportProjectsJobDialog.tsx`) into `merging-branch-import-to-revision`, via a reversible merge commit, without losing any existing work on that branch or on `integrate/lumpsum` (explicitly out of scope).

## Acceptance Criteria
As a developer merging import work into the revision branch, I want `report-importing`'s async job-based import feature folded into `merging-branch-import-to-revision` without losing or breaking any existing work, so that PR #105 carries the complete, working import feature set.

- [ ] `merging-branch-import-to-revision` contains all 15 commits currently unique to `report-importing` (verified via `git merge-base --is-ancestor report-importing merging-branch-import-to-revision`)
- [ ] No commits or files previously on `merging-branch-import-to-revision` are lost (merge commit, not rebase; history preserved)
- [ ] `Main/Program.cs`'s leftover commented-out duplicate startup block (inherited from `report-importing`) is removed in the merge result
- [ ] `dotnet build project_myps.sln` succeeds after the merge
- [ ] Frontend build/typecheck succeeds after the merge
- [ ] The merge commit is pushed to both `mf1027` and `origin` only after explicit user confirmation
- [ ] Follow-ups (deleting the now-dead `ImportProjectsDialog.tsx`, running `Importing.Schema.sql` against target DBs) are called out to the user, not silently done or silently skipped

## Approach

**Context:** PR #105's actual merge conflict (`Main/appsettings.Staging.json`, cosmetic comment-ordering only) was already resolved and pushed earlier in this session. This plan covers the separate, larger piece: bringing `report-importing`'s missing commits into the branch.

A `git merge-tree <merge-base> merging-branch-import-to-revision report-importing` dry run (no working-tree changes) found **zero textual conflict markers** across the entire merge, despite 180 files / ~104k lines of diff. 12 files changed on both branches since the merge-base (`dff4a07`) auto-merge cleanly: `.gitignore`, `DBHelper/Data/MYPSDbContext.cs`, `DBHelper/Models/Functions/Program/ProgramDetails.cs`, `FE/src/pages/Program/Model.d.ts`, `FE/src/pages/Program/Service.ts`, `FE/src/pages/Program/program.md`, `Helpers/Functions.cs`, `Main/Program.cs`, `WebAPI/Controllers/CoreController.cs`, `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Reports/ReportingController.cs`, `project_myps.sln`. The remaining ~168 files are net-new from `report-importing`.

Spot-checks of the highest-risk overlaps (done by hand, not just trusting "no conflict markers"):
- `FE/src/pages/Program/Service.ts`: our side adds `ProgramPK`/typed batch responses; their side appends `startImportProjectJob`/`getImportJobStatus` at the end — non-overlapping, safe.
- `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx`: untouched by our branch since the merge-base, so it cleanly takes `report-importing`'s version, which swaps the old synchronous `ImportProjectsDialog` for the new `ImportProjectsJobDialog`. This makes `ImportProjectsDialog.tsx` / `importProjects()` dead code post-merge — left as a flagged follow-up, not deleted here.
- `Main/Program.cs`: our side wraps Hangfire/DinkToPdf startup behind new `Testing:DisableHangfire`/`Testing:DisablePdfNativeLibrary` flags (supporting new `MYPS.UnitTests`/`MYPS.DatabaseTests`/`MYPS.ApiIntegrationTests` projects also added to the `.sln` on our side); their side adds a named `HttpClient("ReportService")` and registers `ReportJobService`, on non-overlapping lines. `report-importing`'s copy also carries an entire duplicate startup block — but it's fully inside a `/* ... */` comment (dead code, not a live duplicate), so it won't break compilation; still, strip it during merge resolution for cleanliness.
- `project_myps.sln`: our side adds 3 test projects, theirs adds `CrystalReportService` — different GUID blocks, should combine, but must be verified with an actual build, not just a clean text merge.
- `DBHelper/Data/MYPSDbContext.cs`: both sides only add new `DbSet<>` properties in different regions. No EF Core migrations folder in this repo — schema changes go through manual SQL scripts (e.g. `Importing.Schema.sql`), so there's no migration-history conflict, but the new script will need manual execution against shared dev/staging DBs post-merge (an ops step, not part of this merge).

**Conclusion:** mechanically low-risk (0 real conflicts), but "auto-merged" isn't "verified working" — treat this as a full feature-branch merge requiring an actual build/typecheck pass before push, not a rubber-stamp.

Steps:
1. `git merge report-importing --no-ff` into `merging-branch-import-to-revision` (reversible merge commit, no rebase/force-push).
2. Resolve conflicts if the real merge surfaces anything the dry run didn't (e.g. binary files) — resolve by hand, don't blindly take one side.
3. Before committing, strip the dead commented-out duplicate block at the end of `Main/Program.cs`.
4. Verify: `dotnet build project_myps.sln` (backend) and the frontend build/typecheck command inside `FE/`.
5. Leave `ImportProjectsDialog.tsx`/old `importProjects()` in place (dead but harmless) — flag as follow-up, don't delete in this pass.
6. Do not run `Importing.Schema.sql` against any database — flag as a manual ops step for whoever owns the target environment.
7. Push to `mf1027` and `origin` only after build/typecheck verification passes and after explicit user go-ahead.

## Tasks

### Implementation
- Run `git merge report-importing --no-ff` on `merging-branch-import-to-revision`, resolving any surfaced conflicts by hand
- Strip the dead commented-out duplicate startup block from the merged `Main/Program.cs`
- Run `dotnet build project_myps.sln` from repo root and fix any build breakage surfaced by the merge (not pre-existing issues)
- Run the frontend build/typecheck command inside `FE/` and fix any breakage surfaced by the merge
- Confirm `git log --oneline report-importing ^merging-branch-import-to-revision` returns empty (all 15 commits now ancestors)
- Push the merge commit to `mf1027` and `origin` after explicit user go-ahead

### Documentation
- Note in the completion log (or a follow-up item) that `ImportProjectsDialog.tsx`/old `importProjects()` are now dead code pending a cleanup PR
- Note in the completion log that `Importing.Schema.sql` still needs manual execution against target dev/staging databases, and flag ownership as an open question

## Files / Components Touched
- `Main/Program.cs` (merge + dead-comment cleanup)
- `project_myps.sln`, `DBHelper/Data/MYPSDbContext.cs`, `Helpers/Functions.cs`, `WebAPI/Controllers/CoreController.cs`, `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Reports/ReportingController.cs`, `DBHelper/Models/Functions/Program/ProgramDetails.cs`, `.gitignore` — auto-merged, verified by build
- `FE/src/pages/Program/Service.ts`, `FE/src/pages/Program/Model.d.ts`, `FE/src/pages/Program/program.md` — auto-merged, verified by frontend build
- ~168 net-new files from `report-importing` (Hangfire service, rewritten `ImportingController.cs`, `Importing.Schema.sql`, new `ImportProjectsJobDialog.tsx`, report-sample fixtures) — brought in as-is

## Risks / Open Questions / Assumptions
- Assumption: "safely, without destroying our branch" means a merge commit (reversible), not rebase/squash — confirmed by the user.
- Risk: git's textual auto-merge succeeding doesn't guarantee runtime correctness for `Program.cs` DI/startup wiring or `.sln` structure — mitigated by requiring an actual build before push.
- Open question (non-blocking): should `ImportProjectsDialog.tsx` be deleted in a follow-up cleanup PR now that it's dead code?
- Open question (non-blocking): who owns running `Importing.Schema.sql` against shared dev/staging databases?
- Out of scope: the large report-sample fixture files already committed inside `report-importing`'s history bloat the repo; rewriting history to remove them would be destructive and isn't part of this plan.
