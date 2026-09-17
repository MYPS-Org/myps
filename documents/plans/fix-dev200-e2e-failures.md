# Plan: Fix the nine e2e failures from the `myps_db_dev_200` bring-up

Status: Ready for implementation
Created: 2026-09-13
Source: `documents/docs/engineering/MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md` (§4) + this session's follow-up investigation
Branch: `fix/dev200-e2e-failures` (from `dev-trunk` @ `79787cce`) — Target DB: `localhost/myps_db_dev_200` **only**

## Context

The bring-up succeeded, but the full e2e run came back **9 failed / 30 passed / 5 skipped / 29 did not run** against a 55/3/0 baseline. Infrastructure was ruled out (0 Hangfire failures, 0 deadlocks, worst query 859 ms). The nine failures decompose into four independent causes, none of which is a product regression in the Lump Sum module:

| Cause | Failures | Root |
|---|---|---|
| **A** — `DownloadTemplate` 403 | 6 (+ the 29 serial "did not run") | The migration grants only `LumpsumController` actions to Admin; the module also calls two `ImportingController` actions |
| **B** — no sample data | 2 (walkthrough list page) | `LumpSum.SampleData.Dev.sql` preserves MyMYPS identities, which collide on this lineage; its program is also absent here |
| **C** — stale dashboard spec | 1 | Spec asserts PR-#192-era UI (`/welcome back/`); today's page defaults to Demo Data with different copy |
| **D** — latent spec bugs surfaced by an empty module | (inside B) | Paging test tops up to 11 rows but asserts a full page 2; `ls-ownership` drops the sweeper marker |

The intended outcome is a green suite on `dev_200`, sample data that loads on **either** lineage, and specs that ask the database rather than assume it.

## Goal
Make the Lump Sum e2e suites and the dashboard spec pass against `myps_db_dev_200`, by fixing the permission seeding, the sample-data fixture, and the specs themselves — without touching the API or the maintainer's local config.

## Acceptance Criteria
As a developer bringing up a restored MYPS database, I want the bring-up scripts and e2e suite to work on any lineage, so that a green run means the product works and a red run means it doesn't.

- [ ] Re-running `Migration.SchemaAndProgrammability.2026-09-10.sql` on `dev_200` grants `ImportingController.DownloadTemplate` and `.DownloadImportFile` to group 1; its Step-2 output prints a "Lump Sum's Importing dependencies not granted to Admin (want none)" block that is empty; a second run changes nothing.
- [ ] `GET /api/Importing/DownloadTemplate` as `jimeneznr` returns 200 (was 403).
- [ ] `LumpSum.SampleData.Dev.sql` completes on `dev_200`: copies program `MP_P_CO-PS-535_03252025_073824` (absent here) plus 3 parents / 18 children with **new** identities; `vLumpSumSet` = 3, `vLumpSumChildSet` = 18, every §6 referential-integrity count = 0, every §5 `Invariant` = `OK`; a second run re-copies cleanly (idempotent).
- [ ] The script no longer contains a database-wide `DELETE … tProjectMajorWorkItem` (code-review finding #2 closed); `tProjectMajorWorkItem` row count outside the sample is unchanged by a run.
- [ ] `ls-module-ui-walkthrough` filters test passes without depending on the sample's "Demo pack" description; paging test tops up to ≥ 20 rows and passes.
- [ ] `ls-ownership` leaves no parent behind: after its run, no `vLumpSumSet` row whose Description starts with `LS-OWNERSHIP` survives the sweeper.
- [ ] `dashboard-real-data.narrated.spec.ts` passes against the current UI, finishes inside the 120 s budget on `dev_200` (Summary ≈ 14 s), and keeps the payload-shape and KPI-reconciliation assertions.
- [ ] Full suite on `dev_200`: **0 failed**, skips limited to the three KNOWN-GAP data-security cases (and the dashboard probe only if the endpoint is 404/405).
- [ ] `Main/appsettings.Development.json` and `FE/.env.development` are not in the diff.
- [ ] Runbook, `e2e/CLAUDE.md`, and the run report are updated to match (details under Documentation).

## Approach

**A. Permissions — grant by name, not Id.** Extend the migration's §2 `LumpSumActions` CTE (`Migration.SchemaAndProgrammability.2026-09-10.sql` ≈ L1143) with a second source: `ImportingController` rows whose `ActionName IN ('DownloadTemplate','DownloadImportFile')` — the two the module actually calls (`FE/src/pages/LumpSum/Service.ts:517,533`, `e2e/tests/helpers/importWorkbook.ts:108`). Action Ids diverge between lineages (`123` is `DownloadTemplate` here, `DeleteItemizedProject` on `myps_db_dev`), so names are the only safe key. Add a matching "want none" check beside the existing one at ≈ L1367. Scope deliberately stops at those two; the other nine actions Admin lacks on this lineage (Revision*, ProgramController exceptions, Dashboard.Summary…) are recorded in the report, not granted here. Group 15 needs nothing — `ls-data-security` imports as Admin in `beforeAll`.

**B. Sample data — remap identities instead of preserving them.** Rewrite `LumpSum.SampleData.Dev.sql` §2–§4:
- §0b *(new)*: if `tPrograms` lacks the sample's `ProgramPK`, copy `tPrograms` → `tProgramRevisions` (MERGE … `OUTPUT src.Id, inserted.Id INTO #ProgRevMap`) → `tProgramStages` with `RevisionId` remapped. One row each; lookups (`tOptionProgramType` 3, `tOptionProgramStage` 13/'TF-R') already exist here. Copy faithfully at TF-R — it is *not* itemizable, so `programOnStage` will never hand it to a spec.
- §2: delete the collision assertion (the premise is gone).
- §3: keep the natural-key deletes; **remove** the database-wide orphan sweep — it only existed so a re-copy with preserved Ids would not hit `PK_tProjectMajorWorkItem`; new identities cannot collide.
- §4: keep the column-intersection dynamic SQL (handles `DataImportProgramId`/`MCAScore` vs `DataImportId`), but drop `Id` from every list and drop `IDENTITY_INSERT`. Copy order and remaps: `tProjects` (plain; `ProjectPK` is the key, nothing references `tProjects.Id`) → `tProjectRevisions` (MERGE … OUTPUT → `#RevMap`) → `tProjectStages` (`RevisionId`), `tProjectFundingProfile` / `tProjectNotes` (`ProjectRevisionFK`) → `tProjectComponentCost` (MERGE … OUTPUT → `#CostMap`, `ProjectRevisionFK` remapped) → `tProjectComponentCostPerYear` / `tProjectMajorWorkItem` (`ComponentCostFK`). MERGE-with-OUTPUT is the standard way to capture old→new pairs because `INSERT … OUTPUT` cannot reference source columns.
- §4b–§4d, §5, §6 already operate on natural keys and stay; reword §6's "preserving identities keeps the chain coherent" and the header's "IDENTITIES ARE PRESERVED" paragraph.
- The sweeper pins the sample by `ProjectId` **string** (`lumpSumSweeper.ts:39`), so remapped Ids are safe.

**C. Dashboard spec — rewrite for the current page, sample two years.** `Dashboard.tsx` defaults to `dataSourceMode='benchmark'` (Demo Data, never calls the API). Flow: login → `/dashboard` → assert "DPWH Executive Command Center" badge and the demo notice → click **Live DB** → wait for `/api/Dashboard/Summary` 200 → assert "Database data" badge and notice gone → keep every payload-shape and reconciliation assertion (they are API-level and still valid) → click **two** FY buttons (bare-year text now) and refresh, asserting `{ Year }` on the wire → adapt the KPI-card names (`FY Infrastructure Budget`, `Active Portfolio Projects`, `Lump Sum (LS) Itemized`, `Publication Compliance`), activity filters (`All`/`Projects`/`Revisions`), watchlist "Quick view", and modal steps to current markup → drop the "MYPS Command Center" z-index block (element gone). Keep the 404/405 self-skip probe; fix its comment (`WebAPI.csproj` no longer excludes `Controllers\Dashboard`). Rationale for two years: Summary is 14.3 s / 33.5 MB here — the old spec's "click every year" is 16 × 14 s. The uncapped `Projects` payload (`DashboardController.cs:466`) is a product risk to *report*, not fix.

**D. Spec hygiene.** Paging top-up `11 → 20` (`ls-module-ui-walkthrough` ≈ L158). Filters test provisions `${RUN_TAG} filter probe` via `provisionLumpSum` and searches for it (≈ L131). `ls-ownership` L72 keeps the `(e2e <ISO>)` marker in the rewritten Description.

**Run prep.** Remove the one genuinely stranded parent `P00800031LS` through the product's `DeleteLumpSum` (it is `vLumpSumSet`'s only row, childless, e2e residue). `P01000009LS` is a soft-deleted approval seed — not stranded; the report is corrected.

## Tasks

### Implementation
1. **Migration grant + check** — `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql` §2 CTE and the verification block; re-run on `dev_200` twice (apply, then prove idempotent); curl `DownloadTemplate` as the e2e user → 200.
2. **Sample script rewrite** — `Main/Resources/LumpSum/SQL/LumpSum.SampleData.Dev.sql` header, §0b, §2, §3 (sweep removed), §4 (remap), §6 wording; run on `dev_200` twice; check `vLumpSumSet`/`vLumpSumChildSet`/RI/Invariant output and that `tProjectMajorWorkItem` non-sample count is unchanged.
3. **Walkthrough spec** — `e2e/tests/ls-module-ui-walkthrough.narrated.spec.ts`: filters test self-provisions; paging top-up to 20.
4. **Ownership spec** — `e2e/tests/ls-ownership.spec.ts:72` keeps the marker.
5. **Dashboard spec rewrite** — `e2e/tests/dashboard-real-data.narrated.spec.ts` per Approach C (read `Dashboard.tsx` + `components/` for exact copy while writing).
6. **Run prep + full verification** — delete `P00800031LS` via `DeleteLumpSum`; scratch-build the API (`dotnet build Main/Main.csproj -o <scratch>`; **confirm the copy's `MYPSDb` reads `Server=localhost;Database=myps_db_dev_200`**); Vite with `VITE_API_BASE_URL=http://localhost:5015`; `E2E_API_URL`/`E2E_BASE_URL` → `npx playwright test --workers=1`; target 0 failed. Then `/code-review` the diff. Commit at stage boundaries (after 1–2, after 3–5, after docs).

### Documentation
7. **Runbook** — `Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md`: Step 2 table gains the Importing-grant check; Step 4 row stops claiming the sample "will run" and describes the remap + program copy.
8. **e2e guide** — `e2e/CLAUDE.md`: Dashboard coverage row (no longer self-skipping), the "two full pages" note, whole-suite count recounted from the green run.
9. **Run report** — `documents/docs/engineering/MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md`: Cause C corrected (spec staleness, not a build artifact — the 500 was my GET curl hitting static-file fallback, the spec POSTs and got 200), `P01000009LS` reclassified, new risk row for the uncapped 33 MB `Projects` payload, and a "Remediation" section recording the re-run result.

## Files / Components Touched
- `Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql`
- `Main/Resources/LumpSum/SQL/LumpSum.SampleData.Dev.sql`
- `Main/Resources/LumpSum/MYPS_DEV_200_DATABASE_BRINGUP.md`
- `e2e/tests/ls-module-ui-walkthrough.narrated.spec.ts`, `e2e/tests/ls-ownership.spec.ts`, `e2e/tests/dashboard-real-data.narrated.spec.ts`
- `e2e/CLAUDE.md`, `documents/docs/engineering/MYPS_DEV_200_BRINGUP_RUN_REPORT_2026-09-13.md`
- Reused, unchanged: `provisionLumpSum` / `programOnStage` (`e2e/tests/helpers/lumpSumFixture.ts`), `captureApiCalls`, `narrator`, `lumpSumSweeper.ts`
- **Not touched:** any C#/API code, `Main/appsettings.Development.json`, `FE/.env.development`, `LumpSum.DataSecurity.Dev.sql`

## Risks / Open Questions / Assumptions
- **Assumption:** the sample's intersected columns satisfy every `NOT NULL`-without-default column on `dev_200`'s tables (the migration added `ItemizationType`/`ProjectStatus` to `tProjects` with defaults). The script's own §5/§6 output will show it if not; fix in place.
- **Assumption:** copying the program at TF-R (its real MyMYPS stage) is preferable to re-parenting onto a `dev_200` GAA-R program, which would disturb that program's cost rollups. TF-R is non-itemizable, so no fixture will select it.
- **Risk:** `MERGE … OUTPUT` in dynamic SQL is more intricate than the current `INSERT … SELECT`; mitigated by the existing RI checks and a second (idempotency) run.
- **Risk:** Dashboard Live mode on a production-sized lineage is 14 s per fetch; the spec budgets ≤ 3 fetches (initial, one year, refresh) plus one back-navigation. If a later data change pushes Summary past ~30 s the `expect.poll` timeouts will need raising — noted in the spec.
- **Deliberately out of scope:** the other nine Admin grant gaps, the uncapped `Projects` payload, and code-review findings #1/#3 (isolation-script guard, fail-open `myps_db` refusal) — all recorded in the report as open.
- **Judgment call made:** paging top-up provisions up to 20 parents × 1 M each into `programOnStage`'s program; they carry the sweeper marker and are removed by `globalTeardown`.
