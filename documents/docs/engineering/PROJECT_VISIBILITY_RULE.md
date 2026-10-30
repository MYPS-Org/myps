# Project visibility by DEO / Region (view gate, v2)

Date: 2026-10-18 · Plan: `documents/plans/project-visibility-by-deo-region.md` · Branch: `feat/project-visibility-by-office`

## What it restricts

**Viewing only:** the two project lists and the project-details reads. Every other function behaves as before and is
left for a later change. That includes saves, revisions, programs, the Lump Sum module, Dashboard, Reports and
Code Tables.

| Endpoint | Gate |
|---|---|
| `ProjectController.ShowProjects` | Lists a project when **any** of its stages is visible; never a Lump Sum parent |
| `ProgramController.ShowProjectsInProgram` | Each row is one project at one stage, so lists it when **that** stage is visible |
| `ProjectController.ShowProjectDetails` | 400 "Project Not Found" unless the requested stage is visible |
| `ProjectController.ShowProjectStages` | Returns only the visible stages; 400 when none are |
| `ShowProjectTargetComponents` / `ShowProjectStageTargets` | Rows from visible stages only; 400 when none are |
| `ProjectGroupController.SearchProject` / `AddProject` / `DeleteProject` / `ProjectGroupDetails` / `ShowProjectGroups` (2026-10-30) | A project the user may not view is "not found"; the details and the list's member counts cover only visible members, and the list's ProjectId filter finds nothing for a hidden project. Batch form: `GetViewableStagesByProjectAsync` |
| `GlobalSearchController.Search`, project categories (2026-10-30) | Only the stages the user may open, as `ShowProjectDetails` decides |

## The rule

| User (by group name) | Sees |
|---|---|
| In **AUC** or **DPD Admin** (wins over everything else) | Every project and stage |
| In **DPC** | Stages whose DEO = `tUsers.PlantillaOffice` (must be a `vAdminDEO` id) |
| In **RPC** | Stages whose DEO's `vAdminDEO.RegionParticipantId` = `tUsers.PlantillaOffice` (must be a region id) |
| DPC/RPC with an office that doesn't fit (blank, wrong kind, `"OI140 (Not Exists)"`) | Nothing. The lists answer **403 "No Project Access"** |
| In none of the four | Unchanged: today's `ApplyFilter` behaviour |

Further details:

- **A stage's DEO** is decided per stage, by the stage's own revision (`tProjectStages.RevisionId`).
  - If that revision has a **fully approved modification**, its `tRevisionProjectSnapshot.DEO` is used. This is the
    same approval test `fProjectEffectiveRevision` uses.
  - Otherwise it is `tProjectRevisions.DEO`.
- **Lump Sum parents** (`ProjectType = 'LS'`, no `ParentProjectId`) are never visible to DPC/RPC. Itemized children
  follow the rule like any other project.
- **A user in both DPC and RPC** gets the union of the two scopes.
- **The DEO → region parent** comes from the office hierarchy that the GIS backend's AAMS/IOMS import maintains, not
  from the revision's `Region` tag.

## Where it lives

The whole gate is in `Helpers/ProjectHelper.cs`, region **"Project view gate"**. No SQL objects were added or
changed, so there is no deploy step.

| Member | Visibility | Role |
|---|---|---|
| `ResolveProjectViewScopeAsync` | private | Decides the scope. It reads the office at the single **`// OFFICE SOURCE`** line; change that line if the office column moves. |
| `StageDeoSql` | private | The one SQL definition of a stage's DEO. |
| `AddProjectListVisibilityAsync` | public | The list filter. Returns `false` for "no office scope", and the caller answers 403. |
| `GetViewableStagesAsync` | public | The URL check. `null` means unrestricted; otherwise it returns the visible stages. |
| `GetViewableStagesByProjectAsync` | public | The same check for many projects in one query (Project Groups, Global Search). `null` means unrestricted; a project missing from the lookup is not visible. |
| `ValidateProjectIdParams.SkipVisibilityCheck` | opt-in flag | Set only by `ShowProjectDetails`, so a DPD Admin with `ApplyFilter = 1` isn't stopped by the old check. Every update and revision caller keeps that check. |

The **frontend** mirrors the group set in `FE/src/contexts/AuthContext.tsx`. For DPC/RPC users it drops the Lump Sum
and Code Tables routes from `ViewAccess`, which hides both the sidebar entries and the routes. This is frontend-only;
those modules' APIs are unchanged. **Keep the two group sets in step.**

## Why v1 was dropped

v1 is on branch `wip/project-visibility-reuse-v1` (commit `b64e391c`), kept for reference only. It flipped
`tGroups.ApplyFilter` and rewrote the shared `fUserVisibleProjects` / `vProjectLatest`.

That switched on old filters across Programs, Revisions, Lump Sum, Reports and Dashboard:
- DPC users saw 0 programs, then couldn't add projects or revise.
- Every fix opened another gap.

v2 touches no shared mechanism.

## Data findings (localhost `myps_db_migrated_uat`, 2026-10-18)

**Offices**
- **`PlantillaOffice` quality.** Across all users it holds 299 DEOs, 32 regions, 192 blanks and 64 other or
  unresolvable values. A DPC/RPC user's office must be fixed before they can see anything.
  `ProjectVisibility.UserRoles.Dev.sql` sets the local test accounts.

**Stage DEOs**
- **1,173 projects (0.7%) change DEO between stages.** Most are in GAA 2026 OO-1 (693) and GAA 2025 OO-1 (268). Most
  changes happen at NEP → HGAB (683) and NEP → NEP-E (210). For example, OI122 Davao City DEO → OI3576 Davao City 3rd
  DEO. Per-stage visibility exists for exactly these.
- **The project list row shows the latest stage.** A project listed because an earlier stage is visible still shows
  the latest stage's description in the row.

**Regions**
- **1,211 live revisions are tagged with a region other than their DEO's parent.** Most are Cotabato City (parent
  Region XII) and Isabela City (parent Region IX), both tagged BARMM. BARMM RPC users don't see them. Another 525
  revisions have a blank `Region`.

**Modifications**
- **None exist locally (0 `tRevisionDetails`).** That path is covered by a SQL probe in a rolled-back transaction
  in the e2e spec.

## Performance

Measured on localhost with about 172k projects.

| User | `ShowProjects`, 10 rows |
|---|---|
| Unrestricted (AUC, or Admin on the Legacy path) | ~4.5–5.8 s |
| DPC | ~7.5 s |
| RPC | ~13 s |

- **The view is the cost, not the rule.** Any selective filter on `vProjectLatest` costs about 10 s per call
  (count + page), and the same filter on the base revision DEO alone is no faster.
- **Pre-resolving the visible projects into an `OPENJSON` list is worse.** The optimizer runs nested loops over the
  view and calls hit 90 s timeouts.
- **A real fix needs a new or changed SQL object** (e.g. an indexed DEO), which this change ruled out.
- **The `project-list` UI spec is flaky** near its 10 s wait on this database, even for unrestricted users.

## Known gaps, for the later change

- **The Lump Sum module and Code Tables are hidden in the frontend only.** Their APIs still answer DPC/RPC users.
- **Saves aren't restricted.** A DPC/RPC user can still save or revise a project into another DEO, and then loses
  sight of it.
- **Dashboard isn't filtered.** Its project links to out-of-scope stages land on the "Project Not Available" panel.
- **Group names are matched by name.** Renaming a group in User Management silently breaks the gate.
