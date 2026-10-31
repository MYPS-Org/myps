# Plan: Multi-Year Phase 2 — link the portfolios to the annual programs

Status: Implemented
Created: 2026-10-31
Source: docs/multi-year/ (file 02 §B–D, file 01 §A, README), documents/plans/multi-year-roadmap.md (Phase 2 row), Phase 1 plan documents/plans/multi-year-phase-1-portfolio-module.md (Implemented, not committed)

## Context

Phase 1 built the Multi-Year module as a stand-alone island. It has portfolios, planning projects with MY ids, memberships and planned yearly costs. Nothing yet connects it to the annual budget track (RBP → BP → NEP → HGAB → GAA → GAA-R). Phase 2 adds that link, as the planning-cycle figure in file 02 draws it:
- coordinators **Propose to RBP / UBP**;
- PPC **adds to PIP**;
- the system **updates every portfolio when a GAA or GAA-R is approved**, and again after a Non-Implementable revision or a Termination with no disbursement;
- coordinators **import** planning projects;
- **saved totals** keep each portfolio's planned, proposed and approved cost over time.

### What the code investigation established
- **No RBP project ever reaches the GAA.**
  - An RBP program never advances to BP. RBP is a stand-alone stage (`FE/src/pages/Program/utils/stageProgression.ts`).
  - BP, NEP and GAA programs are separate programs whose projects are added or imported, so no cross-program project key exists.
  - The only thing that follows a project from RBP to BP to GAA is the free-text **Multi Year ID** (`tProjects.MYId`). The project form, the import and the export carry it, and all 24 values on local data are already in the MY… format.
  - So **a planning project is "in the GAA" when a project in that approved GAA/GAA-R program carries its MY id as Multi Year ID.**
- **"UBP" is not a stage.**
  - Each RBP program belongs to its region through Data Security; for example, `RBP FY 2026 Region III` has `["OI237"]`.
  - A UBP is therefore an RBP-stage program whose Data Security includes the UDIP's owner office (the PMO cluster office or the UPMO).
- **Program approval happens in two places, both in `WebAPI/Controllers/Programs/ProgramController.cs`:**
  - `UpdateProgramDetails` sets the Status to Approved (~1238 / 1316).
  - `UpdateProgramStage` marks the GAA Approved when it advances to GAA-R (~1569, commit in `AdvanceProgramAsync` ~1435).
- **Revisions:**
  - Revision approval is `RevisionController.ApproveRevision`; full approval is checked by `fRevisionApprovalStatus` (~2444, commit ~2453).
  - Non-Implementable is revision type **8**. Termination is type **9**, and reason **37** is "Termination of Contract - with No Disbursements". Termination requests are currently refused at request time, so 9 + 37 is wired in but cannot arrive yet.
- **Reusable code:**
  - `ValidateProgramId` (program, current stage, Data Security), `ValidateProjectDetailsLookups`, `ValidateMajorItemLookupsAsync`, `GenerateProjectID`, `RecomputeProgramCostAsync` (Helpers/ProjectHelper.cs, ProgramHelper.cs, ProgramCostRecompute.cs).
  - The one-transaction create in `LumpsumController.CreateLumpSum` (`LumpsumController.Writes.cs:31-420`).
  - The synchronous EPPlus import in `LumpsumController.Import.cs` (`ImportItemizedProjects`).

### Decisions (user, 2026-10-31)
1. **Unlinked GAA projects go to PIP by Multi Year ID only.** These are approved GAA projects whose Multi Year ID matches no planning project, with one lasting record per Multi Year ID. Projects that merely have several cost years are not added; that would be about 30,000 a year.
2. **The revision re-run moves Ongoing back to New.** This applies only when every GAA entry that made the project Ongoing became Non-Implementable or was terminated with no disbursement, and it was never implemented in another year. This is a system move added to the diagram for MY-PFL-22, logged with the revision.

## Goal
Planning projects flow into the annual programs and back:
- they can be proposed into an RBP or UBP and added to PIP;
- every portfolio updates itself idempotently when a GAA or GAA-R is approved or a GAA project is withdrawn;
- coordinators can import planning projects;
- each portfolio keeps saved, never-edited totals.

Program approval and revision approval must never fail because of the Multi-Year module.

## Acceptance Criteria
As a planning coordinator (RPC, DPC, UPC, or PPC for PIP), I want the multi-year plan to follow each project into the annual budget and back, so that portfolio statuses and totals stay right without re-keying.

**Propose to RBP / UBP (MY-PFL-20, MY-STK-02, MY-PRJ-02/03)**
- [ ] On the project page, **Propose to RBP** appears for an RDIP or UDIP membership that is **New** or **Ongoing**, in an open term, for a user holding the Propose grant (seeded to Admin, AUC, RPC, DPC, UPC).
- [ ] The dialog lists only programs that meet all of these:
  - current stage RBP, status Working, not deleted;
  - Data Security includes the portfolio's owner (the region, the PMO cluster office or the UPMO);
  - visible to the user (`CanAccessProgram`);
  - start year is a year the project has a planned cost for, at or after the membership's start year.
- [ ] The dialog asks only for the annual-project fields the planning project does not have: Operating Unit, Origin, Agency, Tier (pre-filled from the membership), Implementation Mode, Emergency Mode, ROW Available, Feasibility, and Detailed Design with their dates. They are validated by the same `ValidateProjectDetailsLookups` that Add Project uses.
- [ ] The server creates the annual project in one transaction:
  - a **BP-numbered id** from `GenerateProjectID` for the program year, with **Multi Year ID = the MY id**;
  - the header copied from the planning project;
  - component CW1 Civil Works with **that year's planned cost**, one cost-per-year row and one major item (infra type, work type, year);
  - a recompute of the program cost.

  No funding row is created. The success message says to complete Funding and locations on the project in Programs.
- [ ] A New membership becomes **Potential**, logged with the program and BP id. An Ongoing one stays Ongoing (a continuing year).
- [ ] These are refused, each with a message naming what is wrong:
  - a second live proposal for the same budget year;
  - an approved or non-RBP program;
  - a year with no planned cost;
  - a Potential, completed or cancelled membership;
  - a PIP membership;
  - a closed term.
- [ ] The project page lists its **Annual Programs** entries (proposals and every annual project carrying its MY id): program, stage, year, Project ID and that year's amount.

**Add to PIP (MY-PFL-10, -18, -19; OQ-05)**
- [ ] On an open PIP, **Add Project to PIP** (grant seeded to Admin and PPC) searches RDIP and UDIP memberships that are New or Potential, are not already in that PIP, and start no later than the PIP term's end.
- [ ] Adding needs an MCA score (0–100). It copies the cost into **Original Cost**, records the source RDIP or UDIP, and copies the planning fields. The PIP membership takes the owner's status.
- [ ] **Set PIP Cost** (grant seeded to Admin and PPC) changes a PIP membership's cost. Its Original Cost never changes. The change is logged with the old and new cost. Anyone without the grant is refused.

**GAA update (MY-PFL-11, -21, -22)**
- [ ] When a **GAA or GAA-R program of year Y is approved** (Status set to Approved, or a GAA advanced to GAA-R), the update runs after the approval has committed. **The approval is never blocked:** if the update fails, the program is still approved and the response carries a notice. Program Details shows it, naming **Run GAA Update**.
- [ ] Every membership of every **open** portfolio moves as the diagram shows, with Y the GAA year:

  | Before | Condition | After |
  |---|---|---|
  | Potential | In GAA Y | Ongoing |
  | Potential | Not in GAA Y, implemented in an earlier GAA | Ongoing |
  | Potential | Not in GAA Y, never implemented, no proposal for a later year | New, start year Y+1 |
  | Potential | A proposal for a later year exists | Unchanged |
  | New | In GAA Y (it entered the annual track outside the module) | Potential, then Ongoing (two logged moves, both on the diagram) |
  | New | Start year ≤ Y | Start year Y+1 |
  | Ongoing | Every GAA entry up to Y was withdrawn (Non-Implementable, or Termination with No Disbursements) and none is valid | New, start year Y+1 (decision 2) |
  | Completed, Cancelled | — | Never touched |

  An owner membership's start year moves the project's start year with it. Planned years left before the new start year are kept and flagged for re-planning.
- [ ] **Unlinked GAA projects go to PIP:** each MY-format Multi Year ID in GAA Y that matches no planning project becomes a lasting record, carrying the description, category, location, island and cost of its GAA projects, with horizon, start and end taken from their cost years. It becomes an **Ongoing** PIP membership in the open PIP whose term covers Y. When no PIP covers Y, the run lists it as skipped.
- [ ] **Running it again gives the same result:** no further moves, no duplicate PIP records, and no new saved totals when nothing changed.
- [ ] When a **Non-Implementable**, or a **Termination with No Disbursements** (type 9, reason 37), is fully approved for a project in an approved GAA or GAA-R of year Y, the same update re-runs for Y after commit. The revision approval is never blocked.
- [ ] Every run is recorded: year, trigger, program or revision, who, when, and counts. Admin and AUC see the list and can **Run GAA Update** for any year that has an approved GAA or GAA-R.

**Import (MY-PFL-17)**
- [ ] On an open RDIP or UDIP, **Import Projects** (grant seeded to Admin, AUC, RPC, DPC, UPC) downloads a template. The template has:
  - every planning field;
  - Start Year, then **Amount 1 … Amount N**, where Amount k is for Start Year + k − 1 and N is any number;
  - Tier, Reporting Region, Regionwide and the membership fields;
  - a Lists sheet of valid codes and names.
- [ ] Uploading validates each row with the same rules as Add Planning Project. **A blank amount between two filled amounts is refused**, as is a zero amount. Valid rows are added as **New**, each with its own MY id; failed rows come back with their row number and messages. At most 500 rows are accepted.

**Saved totals (MY-PFL-24)**
- [ ] Totals are saved when a term opens (Create Portfolio, Open Next Term), when one closes (Open Next Term), after each GAA update (skipped when identical to the latest), and on request (**Save Totals**, seeded to the groups that see portfolios).
- [ ] For each project and term year, each year counts in exactly one column:
  - **Approved:** the year's amount in an approved GAA or GAA-R program of that year, withdrawn entries excluded;
  - **Proposed:** otherwise, its amount in that year's annual programs at their current stage;
  - **Planned:** otherwise, the planned stream.

  The portfolio's budget ceiling is copied in alongside. The **Saved Totals** tab lists them, and nothing edits or deletes them.

**No conflict**
- [ ] Program approval, stage advance and revision approval behave as before apart from the after-commit hook and an optional response notice. They work unchanged on a server without the Phase 2 tables, because the hook checks the tables exist first.
- [ ] New BP, P and MY ids never reuse a number already used as a Multi Year ID.
- [ ] The existing unit tests and RevisionController contract tests still pass.

## Approach

### Data (`Main/Resources/MultiYear/SQL/Migration.MultiYear.Linking.2026-10-31.sql`)
Idempotent and additive (`IF OBJECT_ID / COL_LENGTH IS NULL`). It makes no change to any table outside the module.

| Object | Purpose |
|---|---|
| `tMultiYearProposal` | MultiYearProjectFK, MemberFK, ProgramFK, ProjectFK (`tProjects.ProjectPK`), ProjectId (BP id), BudgetYear, Amount, ProposedBy/Date. The proposal history; a live proposal is one whose project revision is not deleted |
| `tMultiYearUpdateRun` | Year, Trigger (1 GAA approved, 2 GAA-R approved, 3 GAA advanced, 4 revision approved, 5 on request), ProgramFK, RevisionDetailsFK, RunBy/Date, counts (JSON) |
| `tMultiYearMemberStatusLog` gains `FromStartYear`, `ToStartYear`, `FromCost`, `ToCost`, `RunFK`, `ProposalFK` | One history per membership: status moves, start-year moves, PIP cost changes |
| `tMultiYearProject` gains `OriginProgramFK` | Set when the GAA update created the record (shown as "Added from GAA <year>") |
| `tMultiYearTotalsSnapshot`, `tMultiYearTotalsLine` | Snapshot: PortfolioFK, Reason, RunFK, TakenBy/Date. Line: SnapshotFK, MultiYearProjectFK (NULL = portfolio total), Year, Planned, Proposed, Approved, Ceiling. Insert only |

### Rules (pure, unit-tested; `Helpers/MultiYear/`)
- **`PortfolioUpdateRules.Decide(member, facts, year)`** returns the moves (status, start year, reason) from the table above. The facts are InGaaY, ImplementedBefore, WithdrawnOnly and ProposedForLaterYear.
  - `MembershipStatusRules` gains the Ongoing→New system move, tagged as the revision exception.
- **`ProposalRules`:** which memberships may be proposed and the refusal texts, one live proposal per budget year, and that year's planned cost.
- **`PipRules`:** add eligibility (New or Potential, start ≤ term end, not already in), the MCA range, the cost-change refusal, and the auto-add record built from GAA rows (horizon from the cost-year count: ≤3 short, ≤6 medium, else long).
- **`SavedTotalsRules.Classify`:** approved, then proposed, then planned for one project-year.
- **`PlanningImportRules`:** parses one row's amount columns (Start Year + k − 1), refusing a blank between filled cells and a zero amount, and reads lookups given as a code or an exact name (an ambiguous name is refused with "use the code").

### GAA update service (`Helpers/MultiYear/PortfolioGaaUpdate.cs`)
- **`RunAsync(db, year, trigger, programFK?, revisionFK?, userId, ct)`:**
  - Returns a summary, or null when the Phase 2 tables are missing.
  - Runs in its **own transaction**.
  - Facts come from one SQL read: approved GAA/GAA-R stages (`tProgramStages` + `tProgramRevisions.Status = 1`) of programs with `StartYear ≤ Y`, then `tProjectStages` → `tProjectRevisions` (`IsDeleted = 0`) → `tProjects.MYId`. Withdrawn means a fully approved revision of type 8, or 9 + 37, on that project (`fRevisionApprovalStatus`).
  - It applies `Decide` to the New, Potential and Ongoing memberships of open portfolios, adds unlinked MY ids to PIP, writes logs only for real changes, saves totals per affected portfolio, and records the run.
- **`AfterApprovalAsync(...)`** wraps `RunAsync` in try/catch so it never throws. It returns a user-facing notice, or null, and logs failures through the exception handler.

### Hooks into existing code (the only edits outside the module)
- **`ProgramController.UpdateProgramDetails`:**
  - Capture the old status before ~1242.
  - After `CommitAsync` (~1317), when the stage is GAA or GAA-R and the status changed to Approved, call `AfterApprovalAsync`.
  - Add `MultiYearUpdate = notice` to the Ok body. `Message`, `Data` and `Title` are unchanged.
- **`ProgramController.UpdateProgramStage`:** when the source stage is GAA and `AdvanceProgramAsync` returned Ok, call `AfterApprovalAsync` (trigger 3) and add the notice.
- **`RevisionController.ApproveRevision`:**
  - After `CommitAsync` (~2453) and `transactionCommitted = true`, when fully approved and type 8, or 9 + 37, run it for the year of the project's program.
  - The call sits after the commit and never throws, so the existing catch, which rolls back, is never reached by it. The contract test's publish → save → commit order is untouched.
- **`Helpers/ProjectHelper.GenerateProjectID`:** `InUseAsync` and `NextFreeSequenceSql` also treat a number as used when any of its forms is a `tProjects.MYId`. The Phase 1 comment claiming a proposal "keeps the same digits" is corrected: a proposal gets a fresh BP id for its program year, linked by Multi Year ID.
- **Front end:** `FE/src/pages/Program` (the approval and stage-advance handlers) and the revision approval handler show `MultiYearUpdate` as an info toast when it is present.

### API (`MultiYearController` partials)
New partials: `.Linking.cs` (propose, PIP), `.Updates.cs` (runs), `.Import.cs`, `.Totals.cs`. Every action runs the Phase 1 guard order: find the record, check visibility (403), check the term is open, then the rules.

| Action | Notes |
|---|---|
| `InitProposeForm` | Eligible programs and the header lookups. It reuses the tables Add Project validates against |
| `ProposeToAnnualProgram` | The write above, in one transaction like `CreateLumpSum` |
| `ShowPipCandidates` | For AddToPip grant holders: summary rows of RDIP/UDIP memberships, regardless of RDIP visibility, because PPC selects from every region |
| `AddToPip`, `SetPipCost` | — |
| `ShowUpdateRuns` | Runs list, plus the years with an approved GAA or GAA-R |
| `RunGaaUpdate` | Admin and AUC |
| `DownloadPlanningTemplate` | EPPlus |
| `ImportPlanningProjects` | Multipart, synchronous, per-row results. `AddPlanningProject`'s validation is refactored into a shared core that returns messages instead of `IActionResult` |
| `ShowSavedTotals`, `SavedTotalsDetails`, `SaveTotals` | — |
| `MultiYearProjectDetails` (extended) | Adds the Annual Programs entries and the membership history |

### Permissions (`Main/Resources/MultiYear/SQL/Migration.MultiYear.LinkingPermissions.2026-10-31.sql`)
Additive and matched by name, like the Phase 1 seed. It registers the actions and seeds the grants named in the Acceptance Criteria. The code never checks group names.

### Front end (`FE/src/pages/MultiYear/`)
- **Project page:**
  - **Propose to RBP** (`ProposeDialog`: program picker and header fields);
  - an **Annual Programs** section;
  - a **History** list per membership.
- **Portfolio page:**
  - **Import Projects** (`ImportPlanningDialog`, following the Lump Sum import dialog: template download, upload, row errors);
  - for PIP, **Add Project to PIP** (`AddToPipDialog`: candidate search plus MCA score), a **Source** column and **Set PIP Cost**;
  - a **Saved Totals** tab with **Save Totals**.
- **Portfolios list:** **GAA Updates** for Admin and AUC (`GaaUpdatesDialog`: runs and Run GAA Update).
- All calls go through `Service.ts`; buttons are gated with `can('MultiYear', …)`.

## Tasks

### Implementation
1. Write the linking schema script and the EF models and DbSets. Run it on local `myps_db_dev` (create and alter-add only).
2. Write the rule helpers: `PortfolioUpdateRules`, `ProposalRules`, `PipRules`, `SavedTotalsRules`, `PlanningImportRules`, plus the Ongoing→New system move in `MembershipStatusRules`.
3. Make `GenerateProjectID` treat a number used as a Multi Year ID as in use, and correct the comment.
4. Build the `PortfolioGaaUpdate` service and the saved-totals writer, including the snapshots in CreatePortfolio and OpenNextTerm.
5. Add the hooks in `ProgramController` (two places) and `RevisionController.ApproveRevision`, plus the front-end notice.
6. Add the MultiYear actions: propose, PIP, runs, import (with the shared validation refactor), totals, and the project-page extensions.
7. Write the permissions seed and run it locally.
8. Build the front-end dialogs, tabs and sections.
9. Tests:
   - **Unit:** every rule helper, covering every row of the update table, idempotency, the decision-2 exception and the import amount columns.
   - **Database** (`MYPS_Test_*`): the linking script runs twice cleanly, plus an ID-generation case for a Multi Year ID.
   - **API smoke** on the local stack (below).
   - The narrated e2e spec extended.

### Documentation
10. Release note in `docs/changelogs/v2.0.9-…` (not yet released), per the update-changelogs skill.
11. User Manual §5.11: Propose to RBP, Add to PIP, the GAA update, Import, Saved Totals, and a note on Program Details. Add a `documents/UserManual_Changelog.md` entry.
12. Update `FE/src/pages/MultiYear/MultiYear.md` and `e2e/CLAUDE.md`, and mark Phase 2 in `documents/plans/multi-year-roadmap.md`.

## Files / Components Touched
- **New:**
  - `Main/Resources/MultiYear/SQL/Migration.MultiYear.Linking*.sql`
  - `DBHelper/Models/Table/MultiYear/*` (Proposal, UpdateRun, Totals)
  - `Helpers/MultiYear/*Rules.cs`, `PortfolioGaaUpdate.cs`, `SavedTotalsWriter.cs`
  - `WebAPI/Controllers/MultiYear/MultiYearController.{Linking,Updates,Import,Totals}.cs`
  - FE dialogs and components under `FE/src/pages/MultiYear/`
  - tests
- **Edited (module):** the Phase 1 MultiYear controller, DTOs and FE pages; `DBHelper/Data/MYPSDbContext.cs`.
- **Edited (existing app, small):**
  - `WebAPI/Controllers/Programs/ProgramController.cs` (2 hooks)
  - `WebAPI/Controllers/Revision/RevisionController.cs` (1 hook)
  - `Helpers/ProjectHelper.cs` (Multi Year ID in-use check)
  - the FE program and revision approval handlers (notice)

## Verification
1. `dotnet build`. Unit tests: all, with the new ones. DatabaseTests: MultiYear*, GroupProjectScopeScript, ProjectIdGeneration (`MYPS_Test_*` only). ApiIntegrationTests: the RevisionController contract tests. FE: `tsc` and eslint.
2. **Local stack only:**
   - The scratch API on :5099. First prove its session is on local `myps_db_dev` and not 192.168.50.200.
   - Run the linking schema and permission scripts there.
3. **API smoke** (extending `my_smoke.py`), using permanent far-future fixtures. Nothing is ever deleted.
   - **Fixtures:** an RBP "E2E RBP 2095 Region III" ([OI237]) and a GAA "E2E GAA 2095", both created through the API.
   - **Propose:**
     - Propose the open-term fixture project into the RBP. Check the BP id, Multi Year ID = MY id, the cost row for 2095 and the program cost, and that the membership is Potential.
     - Check each refusal: a second proposal for the year, a year with no planned cost, another region's coordinator (403), and an approved program.
   - **GAA update:**
     - Add a GAA 2095 project with that Multi Year ID through AddProject, then approve the GAA. The membership becomes Ongoing, the run is recorded and totals are saved.
     - Set the program back to Working and approve again: no new moves, no new snapshot.
     - Run GAA Update on request: same result.
     - A New membership with start ≤ 2095 moves to 2096. A Potential membership never in the GAA goes back to New.
   - **Withdrawn re-run:** run `RunAsync` on a project whose GAA entry has an approved Non-Implementable revision, if the local revision flow can approve one without PCMA. If it cannot, cover the decision-2 path with unit tests and the facts SQL with a direct read-only query, and say so in the report.
   - **PIP:** AddToPip with an MCA score; SetPipCost by PPC (and refused for RPC); Original Cost unchanged. Auto-add: a GAA 2095 project whose Multi Year ID matches no planning project lands in PIP 2095–2100 as Ongoing once; a re-run adds no duplicate.
   - **Import:** good rows are added; a blank amount in the middle, a zero amount and a bad code are refused with row numbers.
4. **No conflict:**
   - Approving a non-GAA program and advancing a non-GAA stage behave as before, with no MultiYearUpdate in the body.
   - The Projects and Programs lists return the same counts.
   - `git diff --stat` touches only the files listed.
5. Narrated e2e (`e2e/local-multiyear.config.ts`, no teardown): Propose to RBP, Add to PIP, Import, the Saved Totals tab.

## Risks / Open Questions / Assumptions
- **The Multi Year ID is the link across programs.** Users must keep the MY id in the Multi Year ID when building BP or GAA from the RBP; export and import already carry it. A project whose Multi Year ID is changed or cleared stops counting. The manual says so.
- **The proposal copies only that year's planned cost** (MY-PFL-20 literally). Funding and locations are completed in Programs. An Ongoing project is proposed again each year.
- **Start-year roll:** planned years before the new start year are kept and flagged, not shifted. The coordinator re-plans them, and the cost rules then require it on the next save.
- **"Approved" uses base GAA/GAA-R amounts.** Effective amounts after formal revisions come with year locking (Phase 3a).
- **Termination 9 + 37 cannot reach approval today** (it is refused at request). The hook is ready for it.
- **The update runs after commit, not in the same transaction.** If it fails, the approval stands and Run GAA Update repairs it; idempotency makes repeating it safe.
- **Fixture programs are permanent** on local `myps_db_dev` (far-future year 2095, named "E2E …"), like the Phase 1 fixture portfolios.
- **Servers** need the two linking scripts run by hand, after the Phase 1 scripts.

## Completion Log
Date: 2026-11-01

- **Before Phase 2 (user report):** `Migration.GroupProjectScopeCluster.2026-10-31.sql` failed on `db76600` with "Invalid column name 'ProjectScope'" (that server never ran `Migration.GroupProjectScope`; the guard could not run because the batch did not compile). Fixed: the statements naming the column are dynamic SQL, so the script stops with "Nothing changed: … Run Migration.GroupProjectScope.2026-10-31.sql …"; and `Migration.GroupProjectScope` now creates the check as 0–4 on a server where it adds the column, so only servers that ran it earlier need the Cluster script. `MYPS.DatabaseTests/GroupProjectScopeScriptTests.cs` (3) runs both scripts on the three server states.
- **Implementation:** Tasks 1–9 as planned.
  - Schema `Main/Resources/MultiYear/SQL/Migration.MultiYear.Linking.2026-10-31.sql` (proposals, update runs, saved totals, history columns, `OriginProgramFK`; stops with NOEXEC when Phase 1 is missing) and EF models.
  - Rules: `PortfolioUpdateRules`, `ProposalRules`, `PipRules`, `SavedTotalsRules`, `PlanningImportRules`, and the Ongoing → New system move.
  - Service: `AnnualEntries` (the annual projects by Multi Year ID), `PortfolioGaaUpdate`, `SavedTotalsWriter`; totals saved by Create Portfolio and Open Next Term.
  - Hooks: `ProgramController.UpdateProgramDetails`, `.UpdateProgramStage` (`AdvanceProgramAsync`), `RevisionController.ApproveRevision`, each after its commit; `GenerateProjectID` skips Multi Year IDs for a new MY id.
  - API partials `.Linking`, `.Updates`, `.Totals`, `.Import`; Add Planning Project's body moved into `AddPlanningProjectCoreAsync`, shared with the import.
  - Permissions `Migration.MultiYear.LinkingPermissions.2026-10-31.sql`.
  - Front end: `ProposeDialog`, `AddToPipDialog`, `SetPipCostDialog`, `ImportPlanningDialog`, `GaaUpdatesDialog`, `SavedTotalsTab`; the project, portfolio and list pages; the `MultiYearUpdate` notice on Program Details save, Proceed to the next stage and revision approval.
- **Applied to local myps_db_dev** (create / alter-add / insert only): the linking script (twice), the Phase 1 schema script again (its view gains `OriginalCost`, `SourcePortfolioFK`), the linking permissions (Admin 28, AUC 24, RPC / DPC / UPC 18, PPC 14, DPD Admin 10 Multi-Year actions). The pre-run `tGroupRoles` snapshot did not save (sqlcmd flag clash); the seed only adds.
- **Tests:**
  - Unit: 271/271 (`MultiYearLinkingRulesTests` covers every update-table row, an idempotency sweep over every status × fact × start year, and that every move is a diagram System move).
  - Database: MultiYear schema / linking / no-Phase-1 (9), GroupProjectScope scripts (3), ProjectIdGeneration (27, with the Multi Year ID case), MYOA mapping (1), `MultiYearPortfolioUpdateTests` (3: GAA approval → moves and PIP auto-add with the GAA cost, re-run idempotent, Non-Implementable re-run Ongoing → New, a failure is a notice and rolls back, no-op without the Phase 2 tables).
  - ApiIntegrationTests: RevisionController contract and ProgramController 36/36.
  - FE: `tsc` clean; eslint clean on `pages/MultiYear`.
  - API smoke on the scratch API :5099 (proved: its only session on localhost myps_db_dev, no :1433 connection to 192.168.50.200): 59/62 on the first pass. Two failures were the script's own cost inserts (sqlcmd without `-I`), re-checked by a follow-up 7/7: 2095 counts once as Approved 90, a re-run saves nothing new. One was a wrong expectation (the GAA → GAA-R run moved the start year of a project imported after the first run, which is correct).
  - Narrated e2e (`e2e/local-multiyear.config.ts`, Vite :8082 → :5099): 3/3, 20 steps.
  - Projects list: DPC asisjnt 1,424 (unchanged); AUC 172,130 (+8 fixture projects in the E2E 2095 programs).
- **Documentation:** release note (top section of `docs/changelogs/v2.0.9-…`; Phase 1's "Not in this release" and administrator bullets updated); User Manual v3.33 (new 5.11.8–5.11.12, updates to 5.11, 5.11.2–5.11.4, 5.11.6 and the Program Details Status row); `documents/UserManual_Changelog.md`; `FE/src/pages/MultiYear/MultiYear.md`; `e2e/CLAUDE.md` coverage row; roadmap Phase 2 done with decisions 5 and 6.

Deviations / flags:
- **Annual entries are found by Multi Year ID**, as planned, and `AnnualEntries` uses `OPTION (RECOMPILE)` and filters ids in memory: 8.7 s → 53 ms on local data.
- **The PIP auto-added record keeps the cost it had when added**; later GAA-R cost changes show in saved totals, not in that record (one cost stream is Phase 3b).
- **`MultiYearUpdate` is an object** `{ Message, Failed }`, not a string, so a failed update shows as a warning.
- **Save Totals is seeded to Admin, AUC, RPC, DPC, UPC, PPC.** DPD Admin only reads them.
- **The withdrawn re-run** could not be run through the revision workflow locally: there is no Non-Implementable or Termination revision on local data, and Termination requests are refused by RevisionController. It is covered by `MultiYearPortfolioUpdateTests` on a disposable database with the live `fRevisionApprovalStatus`.
- **Pre-existing, fixed:** `RevisionControllerContractTests.PackageStatusAggregation_UsesAnyNotPackagedComponentAsNotPackaged` looked for code text that had moved into `RevisionStatusEligibility.ProjectStatus` (it also fails on `HEAD`); it now checks the helper. A Phase 1 refusal said "A Ongoing project …"; it now says "An Ongoing project …".
- **Not fixed (pre-existing, outside the change):** eslint `no-explicit-any` / unused `error` in `ProgramDetail.tsx` and `NextStageDialog.tsx`; `dotnet build project_myps.sln` cannot build `CrystalReportService` (.NET Framework web project) with the dotnet CLI.
- **Permanent local fixtures** (nothing is deleted):
  - Programs "E2E RBP 2095 Region III" (RBP, Working) and "E2E GAA 2095 Region III", now at GAA-R with its GAA stage approved.
  - PIP 2095–2100, opened from PIP 2089–2094 (now closed).
  - Planning projects "E2E P2 …", the narrated proposals, one imported project, their BP projects, and the GAA projects with Multi Year IDs MY07968004LZ and MY07999001LZ.

Files changed:
- **New:**
  - `Main/Resources/MultiYear/SQL/Migration.MultiYear.Linking.2026-10-31.sql`, `Migration.MultiYear.LinkingPermissions.2026-10-31.sql`
  - `DBHelper/Models/Table/MultiYear/MultiYearLinking.cs`
  - `Helpers/MultiYear/{AnnualEntries,PortfolioGaaUpdate,SavedTotalsWriter,PortfolioUpdateRules,ProposalRules,PipRules,SavedTotalsRules,PlanningImportRules}.cs`
  - `WebAPI/Controllers/MultiYear/MultiYearController.{Linking,Updates,Totals,Import}.cs`
  - `FE/src/pages/MultiYear/dialogs/{LinkingDialogs,ImportPlanningDialog,GaaUpdatesDialog}.tsx`, `components/SavedTotalsTab.tsx`
  - `MYPS.UnitTests/MultiYearLinkingRulesTests.cs`
  - `MYPS.DatabaseTests/{MultiYearLinkingScriptTests,MultiYearPortfolioUpdateTests,GroupProjectScopeScriptTests}.cs`
- **Edited (module):**
  - `Main/Resources/MultiYear/SQL/Migration.MultiYear.Schema.2026-10-31.sql` (view columns)
  - `DBHelper/Models/Enums/MultiYear.cs`, `Table/MultiYear/{MultiYearProject,MultiYearPortfolioMember}.cs`, `Views/MultiYear/PortfolioMemberListRow.cs`, `DBHelper/Data/MYPSDbContext.cs`
  - `Helpers/MultiYear/MembershipStatusRules.cs`
  - `WebAPI/Controllers/MultiYear/{MultiYearController,MultiYearController.Portfolios,MultiYearController.Projects,DTOMultiYear}.cs`
  - `FE/src/pages/MultiYear/{Model.d.ts,Service.ts,utils.ts,MultiYear.md,components/YearlyCostGrid.tsx,Views/*}`
  - `MYPS.DatabaseTests/MultiYearSchemaTests.cs`
  - `e2e/tests/multi-year-portfolios.narrated.spec.ts`
- **Edited (existing app):**
  - `WebAPI/Controllers/Programs/ProgramController.cs`, `WebAPI/Controllers/Revision/RevisionController.cs`, `Helpers/ProjectHelper.cs`
  - `FE/src/pages/Program/Views/ProgramDetail.tsx`, `FE/src/pages/Program/dialogs/NextStageDialog.tsx`, `FE/src/pages/Modification/dialogs/ApproveModifyDialog.tsx`
  - `Main/Resources/Internal/SQLScripts/Migration.GroupProjectScope.2026-10-31.sql`, `Migration.GroupProjectScopeCluster.2026-10-31.sql`
  - `MYPS.DatabaseTests/ProjectIdGenerationTests.cs`, `MYPS.ApiIntegrationTests/RevisionControllerContractTests.cs`
- **Docs:** `docs/changelogs/v2.0.9-…`, `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `e2e/CLAUDE.md`, `documents/plans/multi-year-roadmap.md`

