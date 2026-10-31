# Multi-Year module (developer notes)

Phases 1 and 2 of the client's multi-year requirements (`docs/multi-year`). Plans: `documents/plans/multi-year-phase-1-portfolio-module.md` (the module) and `documents/plans/multi-year-phase-2-annual-program-linking.md` (linking it to the annual programs); the later phases: `documents/plans/multi-year-roadmap.md`. User Manual: Section 5.11.

## What it is

RDIP (one per region), UDIP (one per PMO cluster office) and PIP (national) are **portfolios** over fixed six-year terms. A multi-year project has **one lasting record** and joins portfolios as **memberships**, each with its own status, start year, cost and planning fields. Its planned yearly costs live in the shared yearly cost stream, marked Planned; year locking (Phase 3) will add Locked years.

Phase 2 links it to the annual programs: **Propose to RBP / UBP** creates a BP project in an RBP program carrying the MY id as its **Multi Year ID** (`tProjects.MYId`); the **portfolio update** after a GAA / GAA-R approval moves memberships and adds unlinked GAA projects to PIP; **Add to PIP**, **Import Projects** and **Saved Totals**. Outside the module, only three after-commit hooks call in (below); Projects, Revisions, import, Dashboard and Reports still do not read these tables. The RDIP and PIP *stages* of the Programs list are the older track and are untouched.

## Where things are

| Piece | Location |
|---|---|
| Tables, view | `Main/Resources/MultiYear/SQL/Migration.MultiYear.Schema.2026-10-31.sql`; Phase 2: `Migration.MultiYear.Linking.2026-10-31.sql` (proposals, update runs, saved totals, history columns) |
| Permissions seed (by name, additive) | `Main/Resources/MultiYear/SQL/Migration.MultiYear.Permissions.2026-10-31.sql`; Phase 2: `Migration.MultiYear.LinkingPermissions.2026-10-31.sql` |
| "Own UPMO cluster" check widening (contains a DROP CONSTRAINT; run by an administrator) | `Main/Resources/Internal/SQLScripts/Migration.GroupProjectScopeCluster.2026-10-31.sql` |
| EF models | `DBHelper/Models/Table/MultiYear/`, `DBHelper/Models/Views/MultiYear/`, `DBHelper/Models/Enums/MultiYear.cs` |
| Rules (pure, unit-tested) | `Helpers/MultiYear/` — `PortfolioTermRules`, `MembershipStatusRules`, `MultiYearCostRules`, `MultiYearAccess`; Phase 2: `PortfolioUpdateRules`, `ProposalRules`, `PipRules`, `SavedTotalsRules`, `PlanningImportRules` |
| Annual programs, update, totals | `Helpers/MultiYear/AnnualEntries.cs` (the annual projects by Multi Year ID), `PortfolioGaaUpdate.cs`, `SavedTotalsWriter.cs` |
| Hooks outside the module | `ProgramController.UpdateProgramDetails` and `.UpdateProgramStage` (`AdvanceProgramAsync`), `RevisionController.ApproveRevision` — each after its commit; `ProjectHelper.GenerateProjectID` (a new MY id skips numbers used as a Multi Year ID) |
| API | `WebAPI/Controllers/MultiYear/MultiYearController*.cs` (partials: Portfolios, Projects, CodeLists; Phase 2: Linking, Updates, Totals, Import) |
| Pages | `Views/PortfolioList` (GAA Updates), `Views/PortfolioDetail` (Saved Totals tab, Import, Add to PIP), `Views/AddPlanningProject`, `Views/MultiYearProjectDetail` (Propose, Set PIP Cost, Annual Programs); dialogs in `dialogs/LinkingDialogs`, `ImportPlanningDialog`, `GaaUpdatesDialog` |
| Code Tables tab | `../CodeTables/tables/multiYear/MultiYearCodeListTable.tsx` |
| Tests | `MYPS.UnitTests/MultiYearRulesTests.cs`, `MultiYearLinkingRulesTests.cs`; `MYPS.DatabaseTests/MultiYearSchemaTests.cs`, `MultiYearLinkingScriptTests.cs`, `MultiYearPortfolioUpdateTests.cs`; `e2e/tests/multi-year-portfolios.narrated.spec.ts` |

`Service.ts` is the only file that calls the API. `rules.ts` repeats the server's form checks so the user hears about a problem before the round trip; the server still decides.

## Rules worth knowing before changing anything

- **Who sees which portfolio is never a group name.** It is the group's Project visibility (`tGroups.ProjectScope`) plus the user's Plantilla Office, resolved by `MultiYearAccess`. "Own UPMO cluster" (4) scopes portfolios only; the project view gate treats it as By program Data Security. PIP needs All projects or the `ShowPipPortfolios` grant, which is a real action so Sync API keeps it.
- **Every action**: find the record → `MultiYearAccess` (403) → open-term check → rule helpers. A write to a closed term or a completed/cancelled membership is refused.
- **Nothing is deleted.** No portfolio, project, membership or code-list delete exists. A planned year taken off a project is marked Superseded (status 3) and kept. Multi-valued membership fields are JSON arrays so a changed selection is an update.
- **Status moves** follow the diagram in `MembershipStatusRules` exactly. Manual (coordinator): New→Cancelled, Ongoing→Completed, Ongoing→Cancelled. System (Phase 2): New→Potential, Potential→Ongoing, Potential→New.
- **MY Project IDs** come from `ProjectHelper.GenerateProjectID` with StageName RDIP/UDIP. Its "number in use" check also reads `tMultiYearProject` (guarded by `OBJECT_ID`, so servers without the module are unchanged).
- **Category and Region are fixed** after a project is saved: both are part of the MY id. The original cost is set once.
- **Open Next Term** carries every membership that is not completed or cancelled, closes the old term, and a filtered unique index allows one next term per term. Creating the term right after an existing one directly is refused: it must come from Open Next Term.
- The Members tab reads `vMultiYearPortfolioMemberList` through `FilterDataCursor`; the API adds category / region / DEO names after the page is read.

### Phase 2

- **The Multi Year ID is the only link to BP / NEP / GAA.** An RBP program never advances; BP, NEP and GAA programs are separate programs whose projects are added or imported, so `AnnualEntries` finds a planning project's annual entries by `tProjects.MYId` = its MY id (trimmed, upper-cased, MY format only). `tMultiYearProposal` records what Propose created; a proposal is live while its project has a live revision.
- **A UBP is an RBP-stage program** whose Data Security includes the UDIP's cluster office or the UPMO (`ProposalRules.ProgramFitsOwner`). Propose writes the tables Add Project and Create Lump Sum write (project, revision, stage, CW1 with that year's cost, one major item), then `RecomputeProgramCostAsync`; it reuses `ValidateProgramId` and `ValidateProjectDetailsLookups`.
- **The portfolio update never blocks an approval.** The hooks run after the approval's commit, through `PortfolioGaaUpdate.AfterApprovalAsync` / `AfterRevisionApprovalAsync`, which clear the change tracker, run in their own transaction under an app lock, and turn any failure into a `{ Message, Failed }` notice (logged). The response carries it as `MultiYearUpdate`; `FE/src/pages/MultiYear/utils.ts` `multiYearUpdateToast` shows it. Without the Phase 2 tables they do nothing.
- **Idempotent:** `PortfolioUpdateRules.Decide` with the same facts after its moves gives no moves (unit-tested over every status and fact), the PIP auto-add skips MY ids that already have a record, and saved totals are skipped when identical to the latest. Every run is recorded in `tMultiYearUpdateRun`.
- **One move is not on the diagram:** Ongoing -> New when every GAA entry was withdrawn (Non-Implementable 8, or Termination 9 with reason 37 "with No Disbursements"), the user's decision 2. Termination requests are currently refused by RevisionController, so 9 + 37 cannot reach approval yet.
- **The start-year roll** moves the owner membership's start year with the project's (and lifts a passed End Year); planned years left before it stay and are flagged on the project page.
- **Saved totals** count a project-year once: approved GAA / GAA-R of that year (highest approved stage per program, withdrawn left out), else the most advanced annual program of the year at the project's latest stage, else the planned stream. Base amounts, not revision-effective ones (Phase 3a).
