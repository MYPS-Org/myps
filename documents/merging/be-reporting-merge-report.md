# Merge Report — `be-reporting` → `merging-branch-import-to-revision`

**Date:** 2026-08-23
**Result commit:** `3dc3caf1` — _feat(reports): unify Crystal Report generation and Reports page_
**Branch:** `merge/be-reporting-into-import-to-revision`
**Scope:** 139 files changed, +2,540 / −85,208
**Status:** committed locally, **not pushed**

Companion document: [`be-reporting-merge-analysis.md`](./be-reporting-merge-analysis.md) — the
pre-merge investigation. This file records what was actually done and what changed along the way.

---

## 1. The original question

> How do I squash and rebase commits of the `be-reporting` git branch into the other branch
> named `merge-branch-import-to-revision`?

Two corrections surfaced immediately:

1. **The target branch is `merging-branch-import-to-revision`**, not `merge-branch-…`.
   The name in the question does not resolve.
2. **"Squash and rebase" describes two different end states.** Squash-merging into the target
   and rebasing `be-reporting` onto the target produce the same code but very different history,
   and only one of them requires a force-push. The choice was deferred until the branches had
   been inspected.

## 2. Why an analysis came first

Before choosing, the branches were inspected read-only. That inspection is what changed the
recommendation, and two of its findings later prevented shipped bugs.

### 2.1 Starting state was clean

| | `be-reporting` | `merging-branch-import-to-revision` |
|---|---|---|
| vs `origin` | 0 ahead / 0 behind | 0 ahead / 0 behind |
| Unique commits | 11 | 57 |
| Working tree | clean | — |
| Stashes | none | — |

Both branches matched their remotes exactly, so every step was recoverable.

### 2.2 Criss-cross history — two merge bases

```
git merge-base --all be-reporting merging-branch-import-to-revision
  fbad2fa5
  4235506a
```

Both branches had independently absorbed the same Crystal Report commits through different
merge paths. This invalidated the obvious measurements: `git diff --stat fbad2fa5..be-reporting`
reports "82 files, +7886 −2616", which is **not** what lands on the target. All real figures
came from `git merge-tree --write-tree`, which uses the `ort` strategy and merges the bases
first.

This detail was not academic — see §5.1.

### 2.3 A merge commit inside the 11

`c1762875` ("Merge pull request #104 from mf1027/working-frontend") is a merge commit. `git
rebase` drops merge commits by default. This, plus the conflict arithmetic below, decided the
approach.

## 3. The decision

`git merge-tree` predicted conflicts in exactly **three** files. That reframed the trade-off:

| | Squash-merge | Rebase |
|---|---|---|
| Conflict resolution passes | **1** | up to **10** (one per replayed commit) |
| Merge commit `c1762875` | absorbed | flattened |
| Force-push | no | **yes** |
| `be-reporting` history | untouched | rewritten |

A rebase would have re-surfaced the same `Program.cs` / `ReportingController.cs` conflicts once
per commit, and replayed the 84k-line deletion separately from the feature commits depending
on it.

**Chosen: squash-merge.** Same end state, a tenth of the work, no history rewrite.

## 4. What was merged

### 4.1 Feature payload

| Area | Contents |
|---|---|
| Backend report plumbing | `WebAPI/Controllers/CrystalReport/` — `ReportCatalog.cs`, `ReportRequestMapper.cs`, `DTOReports.cs` (new), route `api/reports` |
| Hangfire | `ReportParameterBag.cs`, `ExcelReportGenerator.cs` (new); `ReportJobPayload.cs`, `ReportJobService.cs` |
| Frontend | `FE/src/pages/Reports/Reports.tsx` (new), `Model.d.ts`, `Service.ts`, `ui/CheckboxList.tsx`, `Routes.tsx`, `AppSidebar.tsx`, `appRouteList.ts` |
| Tests | `ReportParameterBagTests.cs`, `ReportRequestMapperTests.cs` (new) |
| Supporting docs | `ProjectSupportingDocs.cs`, `DTOProject.cs`, `ProjectController.cs` — adds `DocTypeName`, async upload |
| Cleanup | 107 files removed from `CrystalReportService/` (−84,007) |

### 4.2 About the 85,208 deletions

Almost all of it is one intentional commit, `b7c7f379`: the `Areas/HelpPage/` Web API
scaffolding, vendored `Content/bootstrap*.css`, `Scripts/bootstrap*.js`, `jquery*.js`, their
`.map` files, and `favicon.ico`. Generated and vendored output, not authored code.

**This should be called out in any PR description** — the diffstat looks catastrophic without
the explanation.

## 5. Conflicts and how they were resolved

### 5.1 `Main/Program.cs` — and the bug hiding behind it

The literal conflict was trivial: `using Hangfire.Services;` sat in a different position on each
side. Both sides' substantive changes (`startHangfireServer:` / `Testing:DisableHangfire`, and
the target's `DisablePdfNativeLibrary` guard and SignalR `AddJsonProtocol` fix) auto-merged
cleanly. be-reporting's alphabetical placement was kept.

**The real problem was in the region git merged without asking.** Comparing the resolved file
against the target revealed a missing line:

```
app.MapHub<ReportHub>("/hubs/report");   // present on target, absent from merge result
```

Cause — the two merge bases from §2.2:

| Ref | `MapHub<ReportHub>` occurrences |
|---|---|
| base `4235506a` | **2** (duplicated) |
| base `fbad2fa5` | 0 |
| `merging-branch-import-to-revision` | 1 (deduped) |
| `be-reporting` | 0 (deleted both) |

`ort` merged the bases, saw "target removed one, be-reporting removed both", and resolved to
zero. A clean, silent, entirely automatic deletion of a live SignalR endpoint.

**Then it got worse.** Checking who consumed that hub turned up a second defect:

```
FE/src/pages/Reports/Reports.tsx:124
  .withUrl(`${VITE_API_BASE_URL}/hubs/reports`, …)   // plural
```

The new Reports page connects to `/hubs/reports`; the only mapping that ever existed is
`/hubs/report` (singular), matching the established `/hubs/import` convention. Since
be-reporting mapped no report hub at all, **that connection had never worked on be-reporting
either** — a pre-existing bug that the merge would have preserved while also removing the
mapping that could have fixed it.

**Resolution:** restored `app.MapHub<ReportHub>("/hubs/report");` and corrected `Reports.tsx` to
`/hubs/report`.

### 5.2 `WebAPI/Controllers/Reports/ReportingController.cs`

Presented as the worst conflict: 992 incoming lines vs 1,405 on target, one single whole-file
conflict hunk with no alignment.

The structural comparison showed why — **be-reporting had commented out the entire file**,
every line prefixed `//`. It was superseded by the new `CrystalReport/ReportsController.cs`.
The target, meanwhile, had continued developing it (adding `CancellationToken` throughout).

So the question was not "how do I merge these" but "should this controller still exist". Tracing
the consumers settled it:

- `FE/src/pages/Program/Service.ts` references **eight** `/Reporting/*` endpoints
- `FE/src/pages/Program/dialogs/AIPReportDialog.tsx` imports `fetchAIPReportDropdownData`
- `FE/src/pages/Program/components/programDetail/ActionsDropdown.tsx` renders that dialog and
  calls `downloadAIPReport` and `exportProjects`

All three call sites are live **on be-reporting too**. That branch commented out the backend
while keeping the frontend calling it — the Program detail report actions were broken there.

**Resolution:** kept the target's active controller. Routes do not collide —
`api/Reporting/[action]` versus `api/reports` — so the old and new controllers coexist.

### 5.3 `.gitignore`

be-reporting's side was Visual Studio noise: six auto-appended lines pinning specific generated
PDF filenames, two of them duplicated verbatim, and in the process it had dropped the target's
`e2e/playwright-report/` and `e2e/.env` rules.

**Resolution:** took the target's version wholesale, then added one generic rule:

```
# generated report output (runtime temp folder)
Main/Resources/Reports/*.pdf
```

## 6. Judgment calls beyond conflict resolution

**13 generated PDFs were staged.** `ReportJobService.cs:117` computes that directory as
`Path.Combine(_env.ContentRootPath, "Resources", "Reports")` and names the variable
`tempFolder`. The files carry GUID suffixes and are referenced by no code or test.

- The **10 incoming** ones were dropped from the commit and are now covered by the ignore rule.
- The **3 already tracked on the target** were deliberately left alone. `git rm --cached` had
  staged them for deletion, but they predate this merge; removing them would have widened its
  scope. **Outstanding cleanup** — see §9.

## 7. Verification performed

| Check | Result |
|---|---|
| Repo-wide conflict-marker scan | clean |
| `dotnet build WebAPI` | succeeded, 0 errors |
| `dotnet build Hangfire` | succeeded, 0 errors |
| `dotnet build MYPS.UnitTests` | succeeded, 0 errors |
| `dotnet test MYPS.UnitTests` | **12/12 passed**, incl. `ReportParameterBagTests`, `ReportRequestMapperTests` |
| Loss-check vs `be-reporting` | only the intended `/hubs/report` fix + the target's own `Hangfire/Importing/*` work |

### Not verified

**`dotnet build Main` fails**, but for an environmental reason unrelated to the merge:
`Main.csproj` runs `React-PreBuild.Development.bat` as a pre-build step, which calls
`npm run build:dev` — and `FE/node_modules` does not exist, while the script's `npm install`
is commented out. The C# compile never runs.

Consequently **the frontend was never built or type-checked**, including the one-line
`Reports.tsx` edit. Run `cd FE && npm ci && npm run build` before QA.

## 8. Safety net

```
backup/be-reporting-2026-08-23        → be-reporting @ pre-merge
backup/merging-import-2026-08-23      → merging-branch-import-to-revision @ pre-merge
```

`be-reporting` is untouched and still matches `origin` exactly. Nothing has been pushed.

| Situation | Recovery |
|---|---|
| Undo the squash commit | `git reset --hard backup/merging-import-2026-08-23` |
| After a push | `git revert 3dc3caf1` — do not force-push a shared branch |

A git identity had to be configured to commit at all (the repo had neither a local nor a global
`user.name`/`user.email`). Set **repo-local only**:
`kssalanio <kssalanio@gmail.com>`.

## 9. Outstanding items

1. **Push.** `git push -u origin merge/be-reporting-into-import-to-revision`, then open a PR
   into `merging-branch-import-to-revision`. Include the §4.2 note about the 84k deletions.
2. **`merging-branch-import-to-revision` still holds `3dc3caf1` locally** (ahead 1 of origin).
   If the work should live only on the new branch, reset it:
   `git switch merging-branch-import-to-revision && git reset --hard origin/merging-branch-import-to-revision`
3. **Build and test the frontend** — see §7.
4. **Three tracked-but-now-ignored PDFs** on the target (`aip-official_e3d12c85…`,
   `rbp_262aaec0…`, `rbp_ccd96949…`). `git rm --cached` them as a separate cleanup.
5. **Audit the two controller folders.** `WebAPI/Controllers/Reports/` and
   `WebAPI/Controllers/CrystalReport/` now coexist. Their routes do not collide today, but a
   duplicate `[Route]` fails at startup, not at build — worth a runtime smoke check.
6. **Verify `ExtractPCMIOW_1.rpt`**, added alongside a modified `ExtractPCMIOW.rpt`. The target
   already carries similar `_1` duplicates (`RBP_1.rpt`, `RBP Summary Report_1.rpt`), so this
   may be an accumulating pattern rather than an intentional variant.
7. **Delete `be-reporting`** only after the merge is verified in QA.

## 10. Takeaway

The mechanical answer to the original question was three commands. The useful answer was that
one of the two obvious approaches costs ten times more than the other, that the automatic merge
silently deleted a live endpoint, and that the file which looked like the hardest conflict was
actually a product decision with a wrong default. None of that was visible from the diffstat —
it came from `merge-base --all`, `merge-tree`, and tracing call sites before resolving.
