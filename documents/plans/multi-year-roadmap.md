# Multi-Year roadmap: all 84 requirements by phase

Created: 2026-10-31
Source: `docs/multi-year/` (README, 01-multi-year-projects, 02-multi-year-program-portfolios, 03-stakeholder-and-spatial). The two design plans those files cite (`multi-year-cost-stream-refactor.md`, `multi-year-program-portfolio-refactor.md`) were not available; the design follows the requirements and the current code.
Phase 1 plan: `documents/plans/multi-year-phase-1-portfolio-module.md`. Phase 2 plan: `documents/plans/multi-year-phase-2-annual-program-linking.md`.

## Decisions (user, 2026-10-31)

1. The portfolio side is a **new sidebar module** (Phase 1), additive: Programs, Projects, Revisions, import and reports keep working as before.
2. Year locking and the shared cost stream (file 01) change existing behaviour **on purpose**. They come after the module, in steps that switch one reader at a time.
3. **File 03 is on the roadmap in full**, with the assumptions below for the open questions; it is built last, and each division should confirm its items first.
4. Portfolio access is an **Edit Group setting** (Project visibility, plus the Show PIP grant), never a group name.
5. (2026-10-31, Phase 2) GAA projects join PIP **by Multi Year ID only** (an MY id matching no planning project), not every project with several cost years.
6. (2026-10-31, Phase 2) A withdrawn GAA entry (Non-Implementable, or Termination with No Disbursements) sends an Ongoing project **back to New**, the one system move not on the status diagram.

## Phases

| Phase | Delivers | Touches existing code | Depends on |
|---|---|---|---|
| **1 Multi-Year module** (done) | Portfolios and six-year terms, memberships and status flow, planning projects with MY ids, planned yearly cost, code lists, budget ceilings, access | Small hooks only: Cluster visibility value, ID generator in-use check, Code Tables tab | — |
| **2 Link to annual programs** (done) | Propose to RBP / UBP, Add to PIP, the portfolio update when a GAA / GAA-R is approved and after Termination / Non-Implementable, import of planning projects, saved totals | After-commit hooks in program approval, stage advance and revision approval; MY id generation skips Multi Year IDs | 1 |
| **2b Legacy conversion** | 17 RDIP terms, PIP 2017–2022, 5 UDIP terms; the 147-project RDIP program as memberships; list of the 3,062 unmatched legacy PIP rows; then hide the RDIP / PIP stages from the Programs filter. Localhost only | Programs filter | 2 |
| **3a Year locking** | Lock year Y on GAA / GAA-R approval (effective amounts), lock metadata, refusals in edit / advance / import naming the year and program, locked years read-only on screen | Server guards in project edit, stage advance, import | 1 |
| **3b One cost stream** | Programs store only their open years; past years read from the stream; a merged read view; migration of the duplicated rows with a conflict list, proven to the cent | Every yearly-cost reader (program cost, dashboard, AIP, RBP, extracts) | 3a |
| **4 Costing Changes rules** | Rules for the existing Multi-Year Costing Changes revision: decrease only, auto EXP line, total never lower, MYOA date per year, closed components read-only, superseded history | Revision request / approval | 3a |
| **5 Reports** | TRIP (3 years), MTPIP / CIP (6 years), Change in Allocation, Reconciliation, PIP Internal; the existing RDIP report in the Reports catalog | Reports catalog | 2, 3b |
| **6 Workshop and spatial** | File 03 | Project form sections, component types, maps, funding | 1; confirmation per division |

## Requirement map

Status: **Done** in Phase 1, **Partly** (Phase 1 did its part), or the phase that does it.

### File 01 — Multi-year projects

| ID | Requirement (short) | Phase | Status |
|---|---|---|---|
| MY-PRJ-01 | One record per project across every year and stage | 1, 3b | Partly: planning projects have one record; existing annual multi-year projects get theirs in 3b |
| MY-PRJ-02 | Each year's program entry links to that record | 2, 3b | Partly: proposals and every annual project carrying the MY id as Multi Year ID (Annual Programs); existing annual projects in 3b |
| MY-PRJ-03 | Both continuation ways (one ID every year; new BP / P id linked to a planning parent) | 2, 3b | Partly: a new BP id per proposal, linked by Multi Year ID; the carried MYOA id in 3b |
| MY-PRJ-04 | MY-prefixed id following the BP / P numbering | 1 | Done |
| MY-PRJ-05 | First implementation year and end year, no maximum years | 1 | Done |
| MY-PRJ-06 | Horizon type drives warnings, not limits | 1 | Done |
| MY-PRJ-07 | Current and original cost; original never changes | 1 | Done |
| MY-PRJ-08 | A year belongs to the program group whose start year it is | 3b | — |
| MY-PRJ-09 | Years before a program's start read from the stream, not stored again | 3b | — |
| MY-PRJ-10 | No zero rows, none after the end year | 1, 3b | Partly: planned years |
| MY-PRJ-11 | A planning-only project keeps planned yearly costs in the stream | 1 | Done |
| MY-PRJ-12 | Screens show locked and open years together, each flagged | 1, 3a | Partly: every year flagged Planned |
| MY-PRJ-13 … 18 | Lock year Y on GAA / GAA-R approval, effective amounts, lock metadata, idempotent re-publish, refusals, "locked only if it names its program" | 3a | — |
| MY-PRJ-19 … 25 | Changing a locked year through Multi-Year Costing Changes (RO, CO), decrease only to EXP, total never lower, MYOA date per year, closed components read-only, superseded history, one current amount | 4 | MY-PRJ-25's one-current-amount index exists since Phase 1 |
| MY-PRJ-26 | Locked years read-only; entry limited to start / end; warn past the horizon | 1, 3a | Partly: entry limits and horizon warning |
| MY-PRJ-27, 28 | Migration merges the copies, conflicts listed; localhost only, backup, totals proven to the cent | 3b | — |

### File 02 — Program portfolios

| ID | Requirement (short) | Phase | Status |
|---|---|---|---|
| MY-PFL-01 … 07 | Three portfolio kinds; separate from annual programs; fixed non-overlapping six-year terms; one per kind / owner / term; Admin and AUC create and open terms; carry-forward; never deleted | 1 | Done |
| MY-PFL-08 | UDIP owners are the UPMO clusters; the UPMO sees all | 1 | Done (owners from the office data) |
| MY-PFL-09 | Membership holds its own status, start year, cost, planning fields | 1 | Done |
| MY-PFL-10 | Owner marked; PIP membership records its source | 1, 2 | Done |
| MY-PFL-11 | Five statuses, changed only as the diagram shows | 1, 2 | Done (plus decision 6) |
| MY-PFL-12, 13 | Start year editable only while new; completed / cancelled by RO, DEO, UPC, PPC, and lock | 1 | Done (grant seeded to RPC, DPC, UPC, PPC) |
| MY-PFL-14, 15 | Planning fields; code lists with validity years | 1 | Done |
| MY-PFL-16 | Add a planning project: one civil works component, one major item, planned yearly cost, status new | 1 | Done |
| MY-PFL-17 | Import planning projects from a template | 2 | Done |
| MY-PFL-18, 19 | Only PPC adds to PIP (original cost, MCA); only PPC changes the PIP cost | 2 | Done (grants seeded to PPC and Admin; New and Potential may enter, OQ-05) |
| MY-PFL-20 | Propose into RBP / UBP: BP-numbered annual project linked to its parent, status potential | 2 | Done (that year's planned cost; funding and locations completed in Programs) |
| MY-PFL-21, 22 | Portfolio update on GAA / GAA-R approval, idempotent; again after Termination / Non-Implementable | 2 | Done (after commit; Termination requests are still refused by the revision module) |
| MY-PFL-23 | Budget ceiling per portfolio and year | 1 | Done |
| MY-PFL-24 | Saved totals (term open / close, after GAA update, on request), never edited | 2 | Done (base amounts; effective amounts with 3a) |
| MY-PFL-25 | TRIP, MTPIP / CIP, Change in Allocation, Reconciliation | 5 | — |
| MY-PFL-26, 27 | Region / cluster scoping, PIP for PPC and unrestricted central users; cluster offices selectable as owners | 1 | Done (Edit Group Project visibility + Show PIP grant) |
| MY-PFL-28 | Legacy migration of terms, the RDIP program and the PIP rows | 2b | — |

### File 03 — Stakeholder and spatial (all workshop-proposed or conceptual)

| ID | Requirement (short) | Phase |
|---|---|---|
| MY-STK-01 | Proposed projects from HDM-4 / PMS and BMS into the pipeline | 6 |
| MY-STK-02 | RBP draws from RDIP and accepts direct entry | 2 (done) |
| MY-STK-03 | PIP Internal = every project in the current PIP term | 5 |
| MY-STK-04 | PIPOL as a subset of PIP Internal with extra fields | 6 |
| MY-STK-05 | Import / export the PIP spreadsheet | 6 |
| MY-STK-06 … 09 | Feasibility Study uploads (RBP), Impact Study uploads (GAA-R onward), Feasibility Study project type with an FS component, study document as its output | 6 |
| MY-STK-10, 11 | KML / KMZ upload and download; every alignment version kept | 6 |
| MY-STK-12, 13 | Safeguards checklist with a GIS layer each; visual overlay on the map | 6 |
| MY-STK-14 | Readiness information grouped under Project Readiness | 6 |
| MY-STK-15, 16 | PPP solicited / unsolicited; who pays each component | 6 |
| MY-STK-17 | UPMO grouped and reported by PMO cluster | 1, 5 (UDIP per cluster is Phase 1; reports in 5) |
| MY-STK-18 … 21 | Grouping by lender and loan; loan percentage per component; FOA document; GOP counterpart and taxes | 6 |
| MY-STK-22 | Component types ICD, Price Contingency, Physical Contingency, Operate and Maintain | 6 |
| MY-SPA-01 … 06 | Location on the lasting record, spatial versions, feature attributes, route measures, several admin areas, portfolio context, yearly / revised alignments | 6 |

## Open questions and the assumption used until answered

| ID | Question | Assumption |
|---|---|---|
| OQ-01 | Is the BARMM RPMO a sixth UPMO cluster? | UDIP owners come from the office data; RPMO-BARMM is listed there as a PMO office, so it is offered. Remove it from the office list if it must not be |
| OQ-02 | What is PIPOL and its extra fields? | PIPOL = PIP Online: a flag on a PIP membership plus an export; the extra fields come with the spreadsheet |
| OQ-03 | Upfront fees, service charges, previous loan balances | Funding-profile lines with new funding natures, not components |
| OQ-04 | GOP counterpart and government taxes on loan-funded projects | Funding-profile lines with source GOP, tagged Counterpart or Taxes |
| OQ-05 | Can a project enter PIP while potential? | Allow both new and potential, as the design recommends |
| OQ-06 | Is Project Readiness a component type or a section? | A section beside feasibility and impact studies |
| OQ-07 | The "PIP spreadsheet" layout | The MTPIP six-year layout until the spreadsheet is provided |
| OQ-08 | What is OTH* under physical contingencies? | The existing OTH2–OTH4 "other" components; Physical Contingency is a new component type |
| OQ-09 | FOA and its fields | A document like the MYCA date: number, date, amount and file |
| OQ-10 | Does the spatial model fit the GIS platform? | WGS84 GeoJSON storage, routes from the RBIA road sections; to be validated with the GIS team before Phase 6 |

## Notes for the next phases

- Phase 1's yearly cost stream already has the Planned / Locked / Superseded statuses and a one-current-amount index; Phase 3a adds the lock columns, never dropping the Phase 1 constraints (they were written as `Amount >= 0` so a locked year may reach zero).
- Phase 2 recognises a planning project in BP / NEP / GAA programs by the annual project's Multi Year ID. Phase 3b's one cost stream should keep that link (or replace it with a real foreign key and migrate the Multi Year IDs).
- Saved totals and the GAA update use base GAA / GAA-R amounts; Phase 3a's effective amounts (approved formal revisions) should feed `SavedTotalsWriter` too.
- Two pre-existing bugs found during this analysis were fixed with Phase 1: the MYOA approval date was dropped on stage advance and restore, and an approved RBP program did not lock its projects on the server.
