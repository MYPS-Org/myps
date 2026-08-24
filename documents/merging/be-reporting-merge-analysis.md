# Branch Merge Analysis — `be-reporting` → `merging-branch-import-to-revision`

_Generated 2026-08-23. All figures from read-only git inspection; no refs were modified._

> Note: the target branch is named **`merging-branch-import-to-revision`** — not
> `merge-branch-import-to-revision`.

## 1. Branch state

| | `be-reporting` | `merging-branch-import-to-revision` |
|---|---|---|
| Local vs `origin` | 0 ahead / 0 behind (in sync) | 0 ahead / 0 behind (in sync) |
| Commits unique to it | **11** | **57** |
| Working tree | clean | — |
| Stashes | none | — |
| `rerere` | not enabled | — |

Both branches are pushed and identical to their remotes, and the working tree is clean.
This is a safe starting point: any local mistake can be recovered with
`git reset --hard origin/<branch>`.

## 2. Criss-cross history — two merge bases

```
git merge-base --all be-reporting merging-branch-import-to-revision
  fbad2fa5
  4235506a   ("Generate Report using existing Crystal Report (6/8). Recards")
```

There are **two** merge bases, not one. Both branches independently absorbed the same
Crystal Report commits (`b83609b4`, `c612b0a7`, `39235657`, `5c72b54e`, `4235506a`) through
different merge paths. Consequences:

- Any `git log fbad2fa5..<branch>` or `git diff fbad2fa5..<branch>` figure **overstates** the
  real difference, because it re-counts commits that both branches already share.
- `git diff --stat fbad2fa5..be-reporting` reports "82 files, +7886 −2616" — this is **not**
  what would land on the target.
- Git's `ort` merge strategy handles multiple bases correctly by merging the bases first, so
  a real merge is more accurate than any two-dot diff. The figures in §4 come from
  `git merge-tree`, which uses that strategy, and are authoritative.

## 3. The 11 commits unique to `be-reporting`

```
e2fce9e9  feat: integrate CheckboxList component for program selection in Reports page
c65db705  feat: support per-family Crystal report request bodies
4501c82e  feat: consolidate report pages into a unified Reports page
72cd79be  added program filter endpoint, options endpoint, rewrote report generation job
          queueing endpoint to support JSON payloads
4cc41048  Crystal Report - handle ExtractPCMIOW (direct-to-Excel, no .rpt)
b7c7f379  Crystal Report Generation - clean .css/.js files, update Main/Program.cs
c95da6fc  Update sln to integrate crystalreport reporting
02d0c8df  Update to merge reporting from Recards branch
c1762875  Merge pull request #104 from mf1027/working-frontend   <-- MERGE COMMIT
e1e3eabb  Add DocTypeName to ProjectSupportingDocs and DTO
aa26e4db  Improve supporting docs upload: async I/O & error handling
```

`c1762875` is a merge commit (parents `e1e3eabb` + `fbad2fa5`). This is the single most
important structural fact for choosing an approach — see §6.

## 4. What actually lands on the target

Computed via `git merge-tree --write-tree merging-branch-import-to-revision be-reporting`,
then diffed against the target tip:

**153 files changed, +3,550 / −85,210**

That deletion count is dominated by one intentional cleanup commit, `b7c7f379`:

- **109 files deleted**, of which 107 are under `CrystalReportService/`
  (−84,007 lines): the whole `Areas/HelpPage/` Web API scaffolding, bundled
  `Content/bootstrap*.css` + `.map`, `Scripts/bootstrap*.js` + `jquery*.js` + `.map`, and
  `favicon.ico`.
- This is vendored/scaffolded output being removed on purpose, not lost work — but it is a
  large, alarming-looking diff that a reviewer should be told about up front.

### The real feature payload (44 non-deleted paths)

| Area | Files |
|---|---|
| New backend report plumbing | `WebAPI/Controllers/CrystalReport/ReportCatalog.cs`, `ReportRequestMapper.cs`, `DTOReports.cs` (all **new**) |
| Hangfire | `Hangfire/Models/ReportParameterBag.cs` (new), `Services/ExcelReportGenerator.cs` (new), `ReportJobPayload.cs`, `ReportJobService.cs` |
| Frontend | `FE/src/pages/Reports/Reports.tsx` (new), `Model.d.ts`, `Service.ts`, `components/ui/CheckboxList.tsx`, `components/Routes.tsx`, `layouts/AppSidebar.tsx`, `utils/appRouteList.ts` |
| Tests | `MYPS.UnitTests/ReportParameterBagTests.cs`, `ReportRequestMapperTests.cs` (both new) |
| Supporting docs feature | `DBHelper/Models/Table/Project/ProjectSupportingDocs.cs`, `WebAPI/Controllers/Projects/DTOProject.cs`, `ProjectController.cs` |
| Other | `WebAPI/Controllers/Programs/ProgramController.cs`, `Helpers/Functions.cs` |
| Docs | `documents/plans/reports-integration.md`, `docs/superpowers/plans/…`, `docs/superpowers/specs/…`, `e2e/CLAUDE.md` |
| Conflicting | `.gitignore`, `Main/Program.cs`, `WebAPI/Controllers/Reports/ReportingController.cs` |

### Two things worth questioning before the merge lands

1. **10 generated PDFs are committed** under `Main/Resources/Reports/*.pdf`
   (`aip-executive_*.pdf`, `rbp_*.pdf`, `extract-pcmiow_*.pdf`, …). These are report *output*
   artifacts, not source. They should almost certainly be dropped and covered by a
   `Main/Resources/Reports/*.pdf` ignore rule instead.
2. **`CrystalReportService/Reports/ExtractPCMIOW_1.rpt`** is added alongside a modified
   `ExtractPCMIOW.rpt`. Confirm the `_1` copy is intentional and not a stray duplicate
   (the target branch already carries similar duplicates: `RBP_1.rpt`,
   `RBP Summary Report_1.rpt`).

## 5. Conflicts — exactly three files

`git merge-tree` reports content conflicts in:

### `.gitignore` — trivial, ~5 min

`be-reporting`'s side is junk: Visual Studio auto-appended six lines pinning specific
generated PDF filenames (two of them **duplicated verbatim**), and in doing so dropped the
target's `e2e/playwright-report/` and `e2e/.env` rules.

**Resolution: take the target's version wholesale**
(`git checkout merging-branch-import-to-revision -- .gitignore`), then optionally add one
generic rule: `Main/Resources/Reports/*.pdf`. Do not keep any of `be-reporting`'s six lines.

### `Main/Program.cs` — moderate, ~20–30 min

`be-reporting` 204 lines vs target 213 lines. `be-reporting` performed a real restructure:

- Added a `startHangfireServer:` parameter to `PrepareDatabaseConnection()`, driven by a new
  `Testing:DisableHangfire` config flag (test-harness support).
- Extracted the inline CORS policy, `AddDinkToPdf()`, `AddEndpointsApiExplorer()` and a large
  block of service registration out of `Program.cs` into extension methods.
- Reordered `using` directives.

The target has its own independent edits in the same region. Resolve by taking
`be-reporting`'s extracted structure and re-applying whatever the target added on top —
this needs a human read, not a mechanical `--ours`/`--theirs`.

### `WebAPI/Controllers/Reports/ReportingController.cs` — the main risk, ~1–2 h

`be-reporting` 992 lines vs target **1,405 lines**. The target branch has ~400 lines of
reporting work that `be-reporting` does not have. Both sides edited this file heavily and
independently.

This is where the merge effort actually lives. Read both versions side by side before
resolving; a careless `--theirs` here silently drops the target's reporting work.

Note the file layout differs between branches — `be-reporting` also adds a parallel
`WebAPI/Controllers/CrystalReport/` package (`DTOReports.cs`, `ReportCatalog.cs`,
`ReportRequestMapper.cs`) that the target lacks. Check for duplicated responsibilities
between the two `Reports/` and `CrystalReport/` controller folders once merged.

## 6. Approach comparison

| | Squash-merge into target | Rebase `be-reporting` onto target |
|---|---|---|
| Conflict resolutions needed | **1** (3 files, once) | up to **10** (once per replayed commit) |
| Merge commit `c1762875` | absorbed cleanly | **flattened** — `rebase` drops merge commits by default; `--rebase-merges` keeps them but complicates the squash |
| Two merge bases | handled by `ort` automatically | replay may hit already-applied patches; `rebase` usually skips them, but silently |
| Force-push required | no | **yes** — `be-reporting` is on `origin` |
| Blast radius | one new commit on target | `be-reporting` history rewritten for everyone who has it |
| Recovery | `git merge --abort` | `git rebase --abort`, or reflog after a bad force-push |

The 3-conflict-file result from `merge-tree` is a squash-merge preview. A rebase would surface
those same conflicts repeatedly, once per commit that touches `Program.cs` or
`ReportingController.cs` — and `b7c7f379`'s 84k-line deletion would replay separately from the
feature commits that depend on it.

**Recommendation: squash-merge.** Same end state (one commit carrying all of `be-reporting`'s
work, sitting on top of the target), a tenth of the conflict work, no history rewrite, no
force-push, and `be-reporting` stays intact on `origin` as a reference until the merge is
verified.

## 7. Procedure (squash-merge)

### 7a. Safety net

```bash
git fetch origin
git branch backup/be-reporting-2026-08-23 be-reporting
git branch backup/merging-import-2026-08-23 merging-branch-import-to-revision
```

### 7b. Squash

```bash
git switch merging-branch-import-to-revision
git merge --squash be-reporting
```

This stages the merged result without committing and **leaves conflict markers** in the three
files from §5. `git status` lists them under "Unmerged paths".

### 7c. Resolve, in this order

1. **`.gitignore`** — take the target's version outright, then add the generic PDF rule:
   ```bash
   git checkout merging-branch-import-to-revision -- .gitignore
   printf '\nMain/Resources/Reports/*.pdf\n' >> .gitignore
   git add .gitignore
   ```
2. **`Main/Program.cs`** — keep `be-reporting`'s extracted-extension-method structure, including
   the `startHangfireServer:` / `Testing:DisableHangfire` flag; re-apply the target's additions
   on top. Verify no orphaned `using` directives remain.
3. **`WebAPI/Controllers/Reports/ReportingController.cs`** — the real work. Diff both sides first:
   ```bash
   git show merging-branch-import-to-revision:WebAPI/Controllers/Reports/ReportingController.cs > target.cs
   git show be-reporting:WebAPI/Controllers/Reports/ReportingController.cs > incoming.cs
   ```
   The target's 1,405 lines contain reporting work absent from `be-reporting`; preserve it.
   Then reconcile against the new `WebAPI/Controllers/CrystalReport/` package for duplicated
   endpoints or DTOs.

### 7d. Decide on the committed PDFs

Per §4, drop the generated report artifacts rather than committing them onto the target:

```bash
git rm --cached Main/Resources/Reports/*.pdf
```

Skip this if those PDFs are fixtures used by tests.

### 7e. Commit

```bash
git add -A
git commit
```

Suggested message:

```
feat(reports): unify Crystal Report generation and Reports page

Squash-merge of be-reporting (11 commits) into
merging-branch-import-to-revision.

- Unified Reports page with per-program CheckboxList selection
- Per-family Crystal report request bodies (ReportCatalog,
  ReportRequestMapper, ReportParameterBag)
- Program filter + options endpoints; JSON-payload report job queueing
- ExtractPCMIOW renders direct-to-Excel, bypassing the .rpt path
- Removed vendored bootstrap/jQuery assets and HelpPage scaffolding
  from CrystalReportService (~84k lines)
- DocTypeName on ProjectSupportingDocs; async supporting-docs upload
```

### 7f. Verify before pushing

```bash
dotnet build project_myps.sln
dotnet test MYPS.UnitTests/MYPS.UnitTests.csproj
```

`ReportParameterBagTests.cs` and `ReportRequestMapperTests.cs` must pass — they are the direct
regression check on the merged report-request mapping.

Confirm nothing was lost:

```bash
git diff be-reporting -- FE/src/pages/Reports Hangfire WebAPI/Controllers/CrystalReport
```

Every remaining difference should be attributable to the target's own work, not to a dropped
`be-reporting` change.

Frontend smoke check: `cd FE && npm run build`, then exercise the Reports page and confirm
program selection queues a job and a report renders.

### 7g. Push

```bash
git push origin merging-branch-import-to-revision
```

Leave `be-reporting` on `origin` until the merged branch is verified in QA. Delete it
afterwards, not before.

## 8. Rollback

| Stage | Command |
|---|---|
| Before the commit | `git merge --abort` |
| After commit, before push | `git reset --hard backup/merging-import-2026-08-23` |
| After the push | `git revert <squash-sha>` (do not force-push a shared branch) |

## 9. Risks

- **`ReportingController.cs`** — 992 vs 1,405 lines, both sides heavily edited. A careless
  resolution silently drops the target branch's ~400 lines of reporting work. This is the one
  place to slow down.
- **84k-line deletion** — correct and intentional (`b7c7f379`), but it will alarm a reviewer
  who sees the diffstat without the explanation. Call it out in the PR description.
- **Duplicate controller surfaces** — `WebAPI/Controllers/Reports/` and
  `WebAPI/Controllers/CrystalReport/` will coexist after the merge. Audit for overlapping
  routes; a duplicate `[Route]` fails at startup, not at build.
- **Binary `.rpt` files** — `ExtractPCMIOW.rpt` is modified and `ExtractPCMIOW_1.rpt` added.
  Binary, so no auto-merge is possible; `merge-tree` reported no conflict on them, meaning only
  one side changed each. Verify the right revision won.

## 10. Alternative commands, if you choose rebase anyway

If `be-reporting` itself must sit on top of the target (rather than the work landing on the
target as a new commit):

```bash
git switch be-reporting
git reset --soft 4235506a          # collapse to one commit
git commit -m "feat(reports): unify Crystal Report generation and Reports page"
git rebase merging-branch-import-to-revision
# resolve the same three files, then:
git rebase --continue
git push --force-with-lease origin be-reporting
```

`--force-with-lease` (not `--force`) so the push aborts if anyone else has pushed to
`be-reporting` in the meantime. Everyone else holding the branch must then run
`git fetch && git reset --hard origin/be-reporting`.
