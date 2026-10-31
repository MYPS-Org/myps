# Plan: Multi-Year Phase 1 — the Multi-Year module (RDIP, UDIP and PIP portfolios)

Status: Implemented
Created: 2026-10-31
Source: docs/multi-year/ (README, 01-multi-year-projects, 02-multi-year-program-portfolios, 03-stakeholder-and-spatial; 84 requirements)

## Context

MYPS has no way to manage multi-year planning. RDIP and PIP exist only as program **stages** (9 and 11, no UDIP) on a planning track that Add Program hides. Projects carry only a free-text Multi-Year ID, and each stage advance copies every project's whole yearly cost schedule. The client's requirements ask for two things:
- **Portfolios** (file 02): RDIP per region, UDIP per UPMO cluster and one national PIP, each over a fixed six-year term. Projects join as **memberships**, not copies.
- **One lasting record per multi-year project** (file 01): past years lock when GAA is approved.

Decisions made with the user on 2026-10-31:
1. Build the portfolio side as a **new sidebar module** first (Phase 1). It is **additive**: Programs, Projects, Revisions, import and reports keep working as they do today.
2. File 03 (workshop and spatial) is **on the roadmap in full**, with stated assumptions for the open questions.
3. Portfolio visibility comes from **Edit Group settings**, not group names. Each group's Project visibility is reused, a new **Cluster** value is added, and a separate grant controls who sees PIP.
4. The two design plans the requirements cite (cost-stream and portfolio refactor) are unavailable. Table design follows the requirements, the current code and the table names in file 01's design reference.

## Goal
Administrators can create RDIP, UDIP and PIP portfolios for six-year terms. Coordinators can add planning projects with MY IDs and planned yearly costs, and keep each membership's status and planning fields. Everyone sees only the portfolios their group allows. No existing screen or rule changes.

## Acceptance Criteria
As a planning coordinator (RPC, DPC or UPC), I want to keep my region's or cluster's multi-year plan in MYPS as one record per project, so that the six-year plan no longer lives in spreadsheets and copies.

**Portfolios and terms**
- [ ] A new **Multi-Year** sidebar dropdown appears, holding **Portfolios**. It is hidden from a user whose groups don't grant its page.
- [ ] A user with the Create Portfolio grant (seeded to Admin and AUC) can create an RDIP for a region, a UDIP for a PMO cluster office or the PIP, for a term start year. The term end is always start + 5 (MY-PFL-01, -03, -05).
- [ ] A second portfolio of the same kind, owner and term is refused. So is a term that overlaps one the owner already has (MY-PFL-03, -04).
- [ ] UDIP owners come from the PMO cluster offices in the database, not a fixed list. RPMO-BARMM is offered if the office data lists it (MY-PFL-08, -27; OQ-01).
- [ ] **Open Next Term** creates the next six-year term starting the year after the current one ends.
  - Every membership that is not completed or cancelled is carried into it, with its fields.
  - The old term becomes **Closed**, and every write to it is refused with a message naming the term.
  - The number of multi-year project records is unchanged (MY-PFL-06).
- [ ] No endpoint deletes a portfolio or a term. Closed terms stay readable (MY-PFL-07).
- [ ] Budget ceilings can be entered per portfolio and per year of its term. Years outside the term are refused (MY-PFL-23).

**Planning projects and memberships**
- [ ] A coordinator can add a planning project to an open RDIP or UDIP. It needs:
  - description, category and sub-category, judged valid for the project's start year (#488 rule);
  - location;
  - horizon type (Short 3 / Medium 6 / Long open-ended);
  - start year and an optional end year;
  - one Civil Works component (CW1) with one major item: infrastructure type, dominant type of work and physical target;
  - at least one planned yearly cost.

  (MY-PRJ-05, -06; MY-PFL-16)
- [ ] The project gets an **MY-prefixed ID** from the existing generator. The number is never one held by a BP, P or MY project or by another planning project (MY-PRJ-04).
- [ ] The project has one lasting record. Its original cost is set once, when it is created, and later saves never change it (MY-PRJ-01, -07).
- [ ] Planned yearly costs are kept in the shared yearly cost table, marked **Planned** (MY-PRJ-11). The planned costs are refused when:
  - an amount is zero;
  - a year appears twice;
  - a year is before the start year;
  - a year is after a known end year.

  A year past the horizon saves, with a warning (MY-PRJ-10, -26).
- [ ] The membership that created the project is marked **owner** and starts as **new**. It holds its own start year, cost, Basis for Implementation, NEDA Project Status (no default), Readiness Levels, RDP outcomes (one output each), Tier and MCA score (MY-PFL-09, -10, -14).
- [ ] The start year can be edited only while the status is new (MY-PFL-12).
- [ ] A user with the Close Membership grant can set completed or cancelled. That grant is seeded to RPC, DPC, UPC and PPC (the RO, DEO, UPC and PPC of MY-PFL-13). The two-step transitions follow the status diagram exactly; any other transition is refused. A completed or cancelled membership refuses every further edit (MY-PFL-11, -13).
- [ ] The project page shows the yearly costs with each year marked **Planned**, and lists every membership the project has (MY-PRJ-12, partly).

**Code lists**
- [ ] Code Tables gains a **Multi-Year** tab for Basis for Implementation, NEDA Project Status, Readiness Level, and RDP Outcomes with their Outputs (MY-PFL-15).
  - Each has Valid From / Valid To years (0 = open) and Active.
  - The existing "Active OR valid for the year" rule decides what can be picked, judged for the membership's start year.
  - A retired value already saved on a membership stays shown and saves unchanged.

**Access**
- [ ] Edit Group's **Project visibility** offers a new **Own UPMO cluster** choice.
  - For portfolios: All shows every portfolio. Own region shows that region's RDIP. Own district office shows the RDIP of the district office's region. Own UPMO cluster shows that cluster's UDIP, or every UDIP when the Plantilla Office is the UPMO itself.
  - An office that doesn't fit shows nothing (MY-PFL-26).
  - **The Projects list does not change:** a group set to Own UPMO cluster sees projects exactly as By program Data Security does today.
- [ ] PIP is listed and opened only by users whose visibility is All or who hold the **Show PIP** grant (seeded to PPC). Everyone else gets 403 on a PIP deep link (MY-PFL-26).
- [ ] Every write checks the caller's grant **and** that the portfolio is visible to them. A coordinator cannot post to another region's portfolio by its id.

**No conflict**
- [ ] Program list, Program Detail, Project list and form, Revision, import, Dashboard and Reports behave exactly as before. The existing project-visibility e2e spec and the GroupProjectScope unit tests still pass.

## Approach

### Shape
A self-contained module in the same shape as Lump Sum:
- **API:** one controller split into partials (`MultiYearController.*.cs`, since grants are keyed on the controller name).
- **Business rules:** in `Helpers/MultiYear/`, as pure, unit-tested functions.
- **Data:** new `tMultiYear*` and `tOption*` tables only.
- **Front end:** pages under `FE/src/pages/MultiYear/`.
- **Changes to existing code:**
  - a few-line hook in `GroupProjectScope` / `ProjectHelper` for the Cluster value;
  - one extra table in the project ID generator's "number in use" check;
  - one new group entry on the Code Tables page.

### Data model (`Main/Resources/MultiYear/SQL/Migration.MultiYear.Schema.<date>.sql`)
The script is idempotent (`IF OBJECT_ID … IS NULL`), additive only, and run by hand per environment.

| Table | Purpose / key rules |
|---|---|
| `tOptionMultiYearType` | Horizon: Short (3), Medium (6), Long (NULL years). The only seeded list. |
| `tMultiYearPortfolio` | Kind (1 RDIP, 2 UDIP, 3 PIP), OwnerParticipantId (region / PMO office, NULL for PIP), TermStartYear, `TermEndYear AS TermStartYear+5 PERSISTED`, Status (1 Open, 2 Closed), PreviousPortfolioFK, audit columns. UNIQUE (Kind, OwnerKey, TermStartYear). No delete, no IsDeleted. |
| `tMultiYearProject` | The lasting record: ProjectId (MY…, UNIQUE), Description, Category, Thrust, Region, Province, City, LegislativeDistrict, DEO, ImplementingOffice, ReportingRegion, RegionWide, IslandCode, HorizonTypeFK, StartYear, EndYear NULL, OriginalCost, CurrentCost, audit. |
| `tMultiYearComponent` | MultiYearProjectFK, ComponentId (CW1), ComponentType, Description, InfraType, WorkTypeId, PhysicalTarget, TargetUnit. |
| `tMultiYearComponentCostPerYear` | The shared yearly stream: ComponentFK, Year, Amount (> 0), Status (1 Planned; 2 Locked and 3 Superseded are reserved for Phases 3–4). A filtered UNIQUE (ComponentFK, Year) WHERE Status <> 3 means one current amount per component and year. Lock metadata columns are added in Phase 3a. |
| `tMultiYearPortfolioMember` | PortfolioFK, MultiYearProjectFK, IsOwner, SourcePortfolioFK (PIP, Phase 2), CarriedFromMemberFK, Status (1 new … 5 cancelled), StartYear, Cost, OriginalCost NULL (PIP), BasisForImplementationFK, NedaProjectStatusFK, Tier, McaScore, audit. UNIQUE (PortfolioFK, MultiYearProjectFK). |
| `tMultiYearMemberReadiness`, `tMultiYearMemberRdpOutput` | The two multi-valued fields; an output row names its outcome. |
| `tMultiYearMemberStatusLog` | From → To, who, when, reason. |
| `tMultiYearPortfolioCeiling` | PortfolioFK, Year, Amount; UNIQUE (PortfolioFK, Year). |
| `tOptionBasisForImplementation`, `tOptionNedaProjectStatus`, `tOptionReadinessLevel`, `tOptionRdpOutcome`, `tOptionRdpOutput` (FK outcome) | Name, Description, ValidFromYear, ValidToYear (int, 0 = open), IsActive. Not seeded: the 2018 values in the old prototype are marked provisional. |

EF models go in `DBHelper/Models/Table/MultiYear/`, and enums in `DBHelper/Models/Enums/MultiYear.cs`. The DbSets go in a `#region MultiYear` of `DBHelper/Data/MYPSDbContext.cs`. Columns must match exactly, because EF binds by column name.

### Rules (pure helpers, `Helpers/MultiYear/`)
- **`PortfolioTermRules`:** term end = start + 5; next start = end + 1; overlap with the owner's existing terms; a write is allowed only while Open.
- **`MembershipStatusRules`:** the whole diagram as one table, each transition tagged Manual or System.
  - Manual, Phase 1: new→cancelled, potential→cancelled, ongoing→completed, ongoing→cancelled.
  - System, Phase 2: new→potential, potential→ongoing, potential→new, the start-year roll.
  - Plus "locked when completed/cancelled" and "start year editable only while new".
- **`MultiYearCostRules`:** amount > 0; no duplicate year; year ≥ StartYear; year ≤ EndYear when set; horizon warnings (years past StartYear + horizon − 1). Returns errors and warnings separately.
- **`MultiYearAccess`:** resolves the caller's visible portfolio owners from `GroupProjectScopes.LoadAsync` plus `tUsers.PlantillaOffice` (the same source as `ProjectHelper.ResolveProjectViewScopeAsync`, `Helpers/ProjectHelper.cs:57`).
  - Region → that region's RDIP; District → the RDIP of the district office's region (`vAdminDEO.RegionParticipantId`); Cluster → that `vAdminPMOCluster` office's UDIP, or all UDIPs when the Plantilla Office is their parent UPMO; All → everything.
  - DataSecurity without Apply Filter → every RDIP and UDIP. DataSecurity with Apply Filter → the RDIP of `vUsers.RegCode`'s region.
  - PIP → scope All, or the `ShowPipPortfolios` grant (checked in `vUserActionPermission`).
  - Multiple groups → union. An office that doesn't fit → nothing.
- **Reuse, don't copy:**
  - Category, sub-category and lookup validity: `ValidateCategoryAsync` / `ValidateThrustForCategoryAsync` and `CategoryIsSelectable` / `ThrustIsSelectable` (`Helpers/ProjectHelper.cs`, ~884), plus `RetiredLookupRule.RowsRequiringActiveCheck` (`Helpers/RetiredLookupRule.cs`).
  - Member list paging: `FilterDataCursor` (`Helpers/CursorPagination.cs`).
  - MY ID: `GenerateProjectID` with StageName "RDIP"/"UDIP" (`Helpers/ProjectHelper.cs:400`). Its `InUseAsync` and `NextFreeSequenceSql` also count `tMultiYearProject.ProjectId`, so a later BP/P/MY id never reuses a planning project's number.

### Cluster visibility (small change to existing code)
- `GroupProjectScope.Cluster = 4`, and `IsValid` becomes 0..4 (`Helpers/GroupProjectScope.cs`).
- In `ResolveProjectViewScopeAsync`, Cluster is mapped to DataSecurity before `Widest`. That one line is why the Projects list doesn't change.
- Front end: the new option and its help text in `FE/src/pages/Rbac/projectScope.ts` / `dialogs/ProjectScopeField.tsx`.
- `Main/Resources/Internal/SQLScripts/Migration.GroupProjectScopeCluster.<date>.sql` widens `CK_tGroups_ProjectScope` to 0–4 (drop and re-add the check; no data touched). **The user runs this script.** The database-safety rules don't let Claude run DROP statements. Until it runs, Edit Group refuses the Cluster value with a clear message.

### API (`WebAPI/Controllers/MultiYear/MultiYearController*.cs : CoreController`)

| Kind | Actions |
|---|---|
| Reads | `InitMultiYearFilters`, `ShowPortfolios`, `ShowPipPortfolios`, `PortfolioDetails`, `ShowPortfolioMembers` (cursor-paged; the 6 term years + Later Years + Total per member), `MultiYearProjectDetails`, `InitPlanningProjectForm`, `ShowBudgetCeilings` |
| Writes | `CreatePortfolio`, `OpenNextTerm` (one transaction; the unique index stops a double open), `AddPlanningProject`, `UpdatePlanningProject`, `UpdateMembership`, `SetMembershipStatus`, `SaveBudgetCeilings` |
| Code lists | `ShowMultiYearCodeLists`, `SaveMultiYearCodeListItem` (refuses renaming or deleting an in-use value, as Code Tables does) |

- Every action: find the record, then `MultiYearAccess` visibility (403), then the Open-term check, then the rule helpers.
- Errors use the existing `{ Data, Status, Message }` response shape, with messages in the user's words.
- There are no delete endpoints.

### Front end (`FE/src/pages/MultiYear/`)
- **Pages**, with RouteNames that are new and paths under `/multi-year/`. This keeps clear of the old `MultiYearList` rows and `/multiyear` paths.

  | Page | RouteName | Path |
  |---|---|---|
  | Portfolios list | `MultiYearPortfolios` | `/multi-year/portfolios` |
  | Portfolio detail | `MultiYearPortfolioDetails` | `/multi-year/portfolios/:portfolioId` |
  | Add project | `MultiYearAddProject` | `/multi-year/portfolios/:portfolioId/add-project` |
  | Project detail | `MultiYearProjectDetails` | `/multi-year/projects/:projectId` |

  The portfolio detail page has Members, Budget Ceilings and Terms tabs.
- **Pieces:**
  - dialogs: CreatePortfolio, OpenNextTerm, MembershipStatus, EditMembership;
  - components: `YearlyCostGrid` (reused later for Locked/Open years), `MembershipStatusBadge`;
  - `Service.ts` (the only `httpClient` user), `Model.d.ts`, `MultiYear.md`.
- **Wiring:**
  - `Routes.tsx`: the four routes, in a `#region Multi-Year Routes`.
  - `AppSidebar.tsx`: replace the commented-out dropdown (130–143) with a live **Multi-Year** dropdown holding Portfolios. Buttons are gated with `can('MultiYear', …)`.
  - Code Tables: a `Multi-Year` group in `GROUPS` (`FE/src/pages/CodeTables/Views/CodeTables.tsx`), with tables in `FE/src/pages/CodeTables/tables/multiYear/` that call the MultiYear endpoints and reuse `ValidityStatusFilters`.
- **Conventions** (FE/CLAUDE.md): `httpClient` toasts, no duplicate toasts, `maxLength` equal to the DTO limits, `DateInput` only, UI labels in messages.

### Permissions (`Main/Resources/MultiYear/SQL/Migration.MultiYear.Permissions.<date>.sql`)
- Additive, matched **by name**, never by Id or by replacing. It mirrors the Lump Sum seed (`Main/Resources/LumpSum/SQL/Migration.SchemaAndProgrammability.2026-09-10.sql:1495-1613`), without its retire/delete step.
- Registers `MultiYearController`, its actions and the four `tAppViews`.
- Creates the App Module **Multi-Year** and links the controller and views to it, so Edit Group lists them.
- Merges the default grants by group name. These are a starting setup only; the code never checks names.

  | Grant | Seeded to |
  |---|---|
  | Pages and reads | Admin, AUC, DPD Admin, RPC, DPC, UPC, PPC |
  | Create Portfolio, Open Next Term | Admin, AUC |
  | Add/Update Planning Project, Update Membership, Save Budget Ceilings | Admin, AUC, RPC, DPC, UPC |
  | Set Membership Status | Admin, AUC, RPC, DPC, UPC, PPC |
  | Show PIP | Admin, PPC |
  | Code lists | every group that already holds `CodeTableController.UpdateCodeTable` |

## Tasks

### Implementation
0. **Pre-existing bugs found in the investigation.** Confirm each on local `myps_db_dev` first (read-only queries), and fix it only if it is real. Each gets its own focused test and its own release note.
   - (a) The live `tProjectComponentCostPerYear.DateOfApproval` (the MYOA date) is not mapped on `DBHelper/Models/Table/Project/ProjectComponentCostPerYear.cs`. Stage advance (`ProgramController.cs` ~1690-1716) and restore (`CopyLiveChildRowsAsync`, ~832-846) therefore copy year rows without it, and the AIP "MYOA" flag disappears after an advance.
   - (b) `vProgramLatest.Status` is compared with `"1"` at `ProjectController.cs:969-976` but with `"Approved"` at 746/870 and `LumpsumController.cs:222`, so one side never matches.
   These are the only edits to ProgramController, ProjectController and LumpsumController.
1. Schema migration script and EF models, enums and DbSets. Run it on local `myps_db_dev` (create only).
2. Cluster scope: the enum and `IsValid`, the mapping in `ResolveProjectViewScopeAsync`, the Edit Group option and help text. Write the constraint script for the user to run.
3. `Helpers/MultiYear/`: `PortfolioTermRules`, `MembershipStatusRules`, `MultiYearCostRules`, `MultiYearAccess`.
4. `GenerateProjectID`: add `tMultiYearProject` to `InUseAsync` and `NextFreeSequenceSql`.
5. `MultiYearController` partials and DTOs (reads, writes, code lists) with visibility, open-term and grant checks.
6. Permission seed script; run it locally.
7. Front end: Service and Model; the Portfolios list, Portfolio detail, Add Project and Project detail pages; dialogs; `YearlyCostGrid`; routes; sidebar.
8. Code Tables: the Multi-Year group and its tables.
9. Tests:
   - **Unit:** the four rule helpers, plus a GroupProjectScope Cluster case. The existing tests stay green.
   - **Database** (disposable `MYPS_Test_*`): the schema script runs twice cleanly; the unique indexes and filters hold; the ID generator skips a number held by a planning project.
   - **e2e:** `e2e/tests/multi-year-portfolios.narrated.spec.ts` (see Verification).

### Documentation
10. Release note: a "Multi-Year module" section in the newest `docs/changelogs/v*.md` marked (not yet released), written for users, per `.claude/skills/update-changelogs/SKILL.md`.
11. User Manual: a new Multi-Year section in `FE/UserManual.md`, the Project visibility table in §5.8 gains Own UPMO cluster, and an entry in `documents/UserManual_Changelog.md`.
12. `FE/src/pages/MultiYear/MultiYear.md` (developer notes).
13. `e2e/CLAUDE.md`: route inventory and coverage map rows.
14. `documents/plans/multi-year-roadmap.md`: all 84 requirements by phase, with the open-question assumptions (summary below).

## Files / Components Touched
- **New:**
  - `Main/Resources/MultiYear/SQL/*.sql`
  - `DBHelper/Models/Table/MultiYear/*`, `DBHelper/Models/Enums/MultiYear.cs`
  - `Helpers/MultiYear/*`
  - `WebAPI/Controllers/MultiYear/*`
  - `FE/src/pages/MultiYear/**`, `FE/src/pages/CodeTables/tables/multiYear/*`
  - `Main/Resources/Internal/SQLScripts/Migration.GroupProjectScopeCluster.<date>.sql`
  - tests in `MYPS.UnitTests`, `MYPS.DatabaseTests` and `e2e/tests`
- **Edited (small, additive):**
  - `DBHelper/Data/MYPSDbContext.cs`
  - `Helpers/GroupProjectScope.cs`
  - `Helpers/ProjectHelper.cs` (Cluster mapping; ID in-use check)
  - `FE/src/components/Routes.tsx`, `FE/src/layouts/AppSidebar.tsx`
  - `FE/src/pages/CodeTables/Views/CodeTables.tsx`
  - `FE/src/pages/Rbac/projectScope.ts`, `FE/src/pages/Rbac/dialogs/ProjectScopeField.tsx`
  - `MYPS.UnitTests/GroupProjectScopeTests.cs`
  - docs listed above
- **Untouched by the module:** ProgramController, ProjectController, RevisionController, Hangfire import, Dashboard, Reports, every existing SQL object. The only exception is the Task 0 bug fixes, if confirmed.

## Verification
1. `dotnet build project_myps.sln`; `dotnet test MYPS.UnitTests`; `dotnet test MYPS.DatabaseTests` (LocalDB or `MYPS_TEST_SQL_SERVER`, `MYPS_Test_*` only).
2. Front end: `npm run build` in `FE/` (tsc + vite; CI type-checks the FE).
3. Local stack only: local API plus local `myps_db_dev`. Run the schema and permission scripts there (creates and inserts only). The user runs the Cluster constraint script.
4. Playwright narrated spec on the local stack. Portfolios can't be deleted, so it **reuses** one far-future fixture term (created on first run) instead of creating new ones.
   - **AUC:** creates or reuses the RDIP fixture term, adds a planning project and checks the MY ID format. The yearly grid shows Planned. A beyond-horizon warning appears while the save succeeds. A zero amount is refused.
   - **AUC:** sets one membership to cancelled; edits to it are then refused.
   - **AUC:** Open Next Term carries the others forward, and the project count is unchanged. It runs once and is verified on reruns.
   - **RPC of another region:** the portfolio is not listed, and the deep link gives 403.
   - **User without Show PIP:** PIP is not listed, and the deep link gives 403.
5. Proof of no change:
   - `e2e/tests/project-visibility.spec.ts` (API level) passes.
   - A spot check of Program list, Program Detail and the Project form shows them unchanged.
   - `git diff --stat` shows no edits in Programs, Projects, Revision, import, Dashboard or Reports, apart from the Task 0 fixes.

## Risks / Open Questions / Assumptions
- **Who runs the Cluster script:** the user, because of the DROP rule. The rest of the module works before it runs.
- **Plantilla offices:** the Cluster scope assumes UPC users' Plantilla Office is their PMO cluster office (`OI2689`–`OI2693`, or `OI2688` for the UPMO). This is unverified on local data, so it gets checked first.
- **DataSecurity + Apply Filter → RDIP of `vUsers.RegCode`:** verify that RegCode matches the region's ParticipantId or Code.
- **Code lists start empty** (only the horizon types are seeded). Basis, NEDA, Readiness and RDP are optional on a membership until values are entered. The 2018 provisional lists are available to paste if the client confirms them.
- **Open Next Term timing:** Admin or AUC may open it at any time. The dialog warns when the current term has not ended.
- **No delete in Phase 1:** a wrong planning project is cancelled, not deleted, and e2e fixtures are permanent (reused).
- **Two places say "RDIP" until Phase 2b:** the legacy RDIP/PIP stage programs stay in Programs until they are converted. The changelog and manual say so.
- **Table names follow file 01's design reference.** Other names and shapes are new, because the cost-stream and portfolio design plans are unavailable.

## Roadmap after Phase 1 (full table goes to documents/plans/multi-year-roadmap.md)

| Phase | Requirements | Touches existing code |
|---|---|---|
| **1 (this plan)** | PRJ-01 (planning), 04–07, 10–12 (planned years), 26 (entry); PFL-01–16, 23, 26, 27 | No (tiny hooks above) |
| 2 Link to annual programs | PFL-10 (PIP source), 11 (system moves), 17 import, 18–19 Add to PIP, 20 Propose to RBP/UBP, 21–22 GAA / Termination / Non-Implementable update, 24 saved totals; PRJ-02, 03 (planning parent); STK-02 | Program approval and revision approval hooks |
| 2b Legacy conversion | PFL-28: 17 RDIP terms, PIP 2017–2022, 5 UDIP terms, the 147-project RDIP program, the list of 3,062 unmatched PIP rows; then hide RDIP/PIP from the Programs filter. Localhost only. | Programs filter |
| 3a Year locking | PRJ-13–18, 26 (locked read-only), 12 (locked/open flags); MYOA date mapped (`DateOfApproval`, today dropped on advance) | Server guards on edit, advance, import |
| 3b One cost stream | PRJ-01–03 (existing projects), 08–10, 27–28; a merged read view so readers switch one at a time | Every yearly-cost reader |
| 4 Costing Changes rules | PRJ-19–25 on the existing revision type 14 (decrease only, auto EXP line, total never lower, MYOA date per year, closed components read-only, superseded history) | RevisionController |
| 5 Reports | PFL-25 (TRIP 3 y, MTPIP/CIP 6 y, Change in Allocation, Reconciliation); STK-03 PIP Internal; the existing RDIP report wired into the catalog | Reports catalog |
| 6 Workshop and spatial | STK-01, 04–22; SPA-01–06 | Project form sections, component types, maps |

The assumptions for the open questions are written in the roadmap:

| Question | Assumption |
|---|---|
| OQ-01 (BARMM) | UDIP owners are driven by office data |
| OQ-02 (PIPOL) | PIPOL = PIP Online: a flag plus an export |
| OQ-03, OQ-04 (fees, counterpart funding, taxes) | Funding-profile lines with new natures |
| OQ-05 (PIP entry status) | Allow new and potential |
| OQ-06 (Project Readiness) | A section, not a component |
| OQ-07 (PIP spreadsheet) | The MTPIP 6-year layout |
| OQ-08 (OTH*) | The existing OTH2–OTH4 components |
| OQ-09 (FOA) | A document like MYCA: number, date, amount, file |
| OQ-10 (spatial fit) | WGS84 GeoJSON, with routes from RBIA sections |

The two likely existing bugs found during the investigation are Task 0 of this implementation (see Tasks).

## Completion Log
Date: 2026-10-31
- Implementation:
  - **Task 0, both bugs confirmed and fixed.** (a) The MYOA date (`DateOfApproval`) is now mapped on the year-row EF model and copied by stage advance and restore; on local data the column has 178 dated rows. (b) `vProgramLatest.Status` is "Approved" / "Working", so the RBP lock in `UpdateProjectDetails` never fired; it now uses `ProgramHelper.IsApprovedStatus`, the only such comparison in the code.
  - **Tasks 1–8 as planned.**
    - Schema script, including a `vMultiYearPortfolioMemberList` view for the paged Members tab; EF models and enums.
    - Cluster scope value 4, with the constraint script for the user to run.
    - The four rule helpers.
    - A guarded `tMultiYearProject` in-use check in `GenerateProjectID`.
    - `MultiYearController` in four partials with 16 actions.
    - The permission seed.
    - The four pages, dialogs and Code Tables › Multi-Year.
  - **Local `myps_db_dev`** got the schema and permission scripts (creates and inserts only). The Cluster constraint script was **not** run: it contains `DROP CONSTRAINT`, which the user runs.
- Tests:
  - `MYPS.UnitTests`: 237/237, including `MultiYearRulesTests`, the Cluster cases and `ProgramStatusAndMyoaDateTests`.
  - `MYPS.DatabaseTests`:
    - `MultiYearSchemaTests` 7/7: the script runs twice, the constraints hold, and EF matches every table.
    - `ProjectIdGenerationTests` 26/26, including a planning-held number.
    - `YearRowMyoaDateMappingTests` 1/1.
  - FE `tsc -b` clean; eslint on the new and changed files clean.
- **Local stack verification.**
  - The scratch API ran on :5099. Its only session was on localhost `myps_db_dev`, with no connection to the shared server.
  - An API smoke run passed 43/43 checks:
    - **Terms:** create, duplicate, overlap and next-term refusals; the next term opens once; a closed term refuses writes.
    - **Costs:** zero, repeated and before-start years refused; the horizon warning; MY id `MY07368001LZ`; edit with a year superseded; the original cost kept; Category locked.
    - **Status:** the moves the diagram allows, and the cancelled lock.
    - **Ceilings and members:** budget ceilings; paged members.
    - **Access:** the DPC of another region is refused (list, deep link 403, Show PIP 403, Create Portfolio 403).
  - The narrated spec passed 2/2 (9 + 3 steps) against Vite :8082 → :5099.
  - The Projects list is unchanged: DPC 1,424 and AUC 172,122 projects.
  - Nothing was written to `tProjects` or `tPrograms`.
- Documentation:
  - Release notes: three sections at the top of `docs/changelogs/v2.0.9-…` (the module and the two fixes).
  - User Manual v3.32: new Section 5.11 and updates to 4.1, 5.7, 5.8 and 9; `documents/UserManual_Changelog.md` v3.31 → v3.32.
  - `FE/src/pages/MultiYear/MultiYear.md`; e2e/CLAUDE.md route and coverage rows; `documents/plans/multi-year-roadmap.md` mapping all 84 requirements to phases, with the assumptions for the open questions.
Deviations / flags:
- **Status moves follow the requirements' diagram, not the plan text.** The diagram has no Potential → Cancelled, so coordinators may set New → Cancelled, Ongoing → Completed and Ongoing → Cancelled only.
- **Multi-valued planning fields are JSON columns on the membership** (`ReadinessLevelIds`, `RdpOutcomes`, like `tGroupRoles.ActionIds`) instead of two link tables. Changing a selection is then an update, never a deleted row.
- **No separate `ShowBudgetCeilings` action.** `PortfolioDetails` returns the ceilings per year, and `SaveBudgetCeilings` returns the refreshed details. That makes 16 actions.
- **Added rule: the term right after an existing one is refused in Create Portfolio** ("Use Open Next Term …"), so carry-forward cannot be skipped. An earlier, historical term can still be created.
- **Code-list values have no delete action at all.** They are retired (Active / Valid To); renaming one in use is refused.
- **Other small changes:**
  - The App Module is named `MultiYear` (no space), matching `CodeTable` / `ProjectGroup`.
  - `ProjectScopeField.tsx` needed no change: it renders the shared option list.
  - The Multi-Year form `Field` ties its label to its control (`htmlFor`), for screen readers and the e2e selectors.
- **Scope of the "Own UPMO cluster" value.** For projects it is By program Data Security; `Widest` already ignores it, so the project gate itself needed only a comment.
- **Not run: `e2e/tests/project-visibility.spec.ts`.** Its fixture script, `ProjectVisibility.Fixture.Dev.sql`, physically deletes `tUsers` / `tUserGroups` rows, and its accounts are not on the local database.
- **The pre-run snapshot of `tGroupRoles` failed.** `sqlcmd` misread the scratchpad path, and the permission seed ran anyway. The seed only adds ids, so the prior state is each group's arrays minus the MultiYear ids.
- **Permanent local test data, by design (nothing can be deleted):**
  - RDIP OI237 terms 2089–2094 (closed) and 2095–2100;
  - PIP 2089–2094;
  - planning projects `MY07368001LZ` (carried forward) and `MY07368002LZ`, `MY07968001LZ`–`MY07968003LZ` (cancelled).
- `e2e/local-multiyear.config.ts` is a temporary local config (no Lump Sum teardown); it is not for commit.
Files changed:
- **Modified:**
  - `DBHelper/Data/MYPSDbContext.cs`, `DBHelper/Models/Table/Project/ProjectComponentCostPerYear.cs`
  - `Helpers/GroupProjectScope.cs`, `Helpers/ProgramHelper.cs`, `Helpers/ProjectHelper.cs`
  - `WebAPI/Controllers/Programs/ProgramController.cs`, `WebAPI/Controllers/Projects/ProjectController.cs`, `WebAPI/Controllers/Settings/UserManagement/UserManagementController.cs`
  - `FE/src/components/Routes.tsx`, `FE/src/layouts/AppSidebar.tsx`, `FE/src/pages/CodeTables/Views/CodeTables.tsx`, `FE/src/pages/Rbac/projectScope.ts`
  - `MYPS.UnitTests/GroupProjectScopeTests.cs`, `MYPS.DatabaseTests/ProjectIdGenerationTests.cs`
  - `FE/UserManual.md`, `documents/UserManual_Changelog.md`, `docs/changelogs/v2.0.9-delete-one-project-generate-reports-and-more.md`, `e2e/CLAUDE.md`
- **New:**
  - `Main/Resources/MultiYear/SQL/` (2 scripts), `Main/Resources/Internal/SQLScripts/Migration.GroupProjectScopeCluster.2026-10-31.sql`
  - `DBHelper/Models/Enums/MultiYear.cs`, `DBHelper/Models/Table/MultiYear/` (4 files), `DBHelper/Models/Views/MultiYear/PortfolioMemberListRow.cs`
  - `Helpers/MultiYear/` (4 files), `WebAPI/Controllers/MultiYear/` (5 files)
  - `FE/src/pages/MultiYear/` (Model.d.ts, Service.ts, utils.ts, rules.ts, MultiYear.md, 4 component files, 2 dialog files, 4 views), `FE/src/pages/CodeTables/tables/multiYear/MultiYearCodeListTable.tsx`
  - `MYPS.UnitTests/MultiYearRulesTests.cs`, `MYPS.UnitTests/ProgramStatusAndMyoaDateTests.cs`, `MYPS.DatabaseTests/MultiYearSchemaTests.cs`, `MYPS.DatabaseTests/YearRowMyoaDateMappingTests.cs`
  - `e2e/tests/multi-year-portfolios.narrated.spec.ts`
  - `documents/plans/multi-year-phase-1-portfolio-module.md`, `documents/plans/multi-year-roadmap.md`
- Untouched user edits: `Main/appsettings.Development.json`; `docs/multi-year/` is the user's untracked source.
