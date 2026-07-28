# Program & Project Versioning Reference

> **Use this document as the canonical reference for how program and project versioning works in MYPS.**

---

## Core Concept

Programs and projects follow an **append-only revision model**. Data is never overwritten — every change (edit or stage advancement) creates a **new revision row**. The anchor tables (`tPrograms`, `tProjects`) each maintain a single row per entity throughout its lifecycle.

---

## Tables Involved

| Table | Role |
|---|---|
| `tPrograms` | **Anchor** — one row per program, never duplicated. Tracks high-level flags (`IsDeleted`, `IsSkipped`, `IsPublished`). |
| `tProgramRevisions` | **Version history** — one row per revision. Holds all mutable program data (`Name`, `Cost`, `UserGroup`, `Status`, etc.). |
| `tProgramStages` | **Stage tracker** — links a revision to a pipeline stage (`BP`, `NEP`, `GAA`, etc.). |

---

## How It Works (Step by Step)

### 1. Program Creation

When a program is first created:

| Action | Table | What happens |
|---|---|---|
| Insert anchor | `tPrograms` | One row with a generated `ProgramId`. `RevisionNumber = NULL`, `IsPublished = NULL`. |
| Insert revision | `tProgramRevisions` | `RevisionNumber = 1`, `Status = 3` (Active). Carries the initial `Name`, `YearStart`, `Type`, etc. |
| Insert stage | `tProgramStages` | Links `RevisionId → 63` to `StageId = 4` (BP). `IsPublished = 0`. |

**Resulting state:**

```
tPrograms           → 1 row   (ProgramId = PR20260200124, RevisionNumber = NULL)
tProgramRevisions   → 1 row   (RevisionNumber = 1, Status = 3, Stage = BP)
tProgramStages      → 1 row   (RevisionId = 63, StageId = 4 / BP)
```

### 2. Edit Within the Same Stage

When a program is edited (e.g. `Cost` updated, `UserGroup` changed) without advancing to a new stage:

| Action | Table | What happens |
|---|---|---|
| Insert revision | `tProgramRevisions` | `RevisionNumber = 2`, `Status = 1` (Draft). Contains the updated data (`Cost = 100`, `UserGroup = [1,3]`). |
| Insert stage | `tProgramStages` | New row linking `RevisionId → 64` to the **same** `StageId = 4` (BP). |

> The previous revision (`RevisionNumber = 1`) is **not modified** — it stays at `Status = 3`.

**Resulting state:**

```
tPrograms           → 1 row   (unchanged)
tProgramRevisions   → 2 rows  (Rev 1: Status 3, Rev 2: Status 1)
tProgramStages      → 2 rows  (both StageId = 4 / BP, pointing to Rev 63 and Rev 64)
```

### 3. Stage Advancement (BP → NEP)

When a program advances to a new pipeline stage:

| Action | Table | What happens |
|---|---|---|
| Insert revision | `tProgramRevisions` | **`RevisionNumber` resets to 1**. `Status = 3` (Active). `Name` updated to reflect new stage (`"NEP 2027 - test demo"`). |
| Insert stage | `tProgramStages` | New row linking `RevisionId → 65` to `StageId = 5` (NEP). |

> `RevisionNumber` resets because it is **scoped per stage**, not globally sequential.

**Resulting state:**

```
tPrograms           → 1 row   (unchanged)
tProgramRevisions   → 3 rows  (BP Rev 1, BP Rev 2, NEP Rev 1)
tProgramStages      → 3 rows  (2× BP, 1× NEP)
```

---

## Full Example (PR20260200124)

### tPrograms
| Id | ProgramId | IsDeleted | IsSkipped | IsPublished | RevisionNumber |
|---|---|---|---|---|---|
| 21 | PR20260200124 | 0 | 0 | NULL | NULL |

### tProgramRevisions
| Id | RevisionNumber | Name | Status | Type | Cost | YearStart | UserGroup | StageId |
|---|---|---|---|---|---|---|---|---|
| 63 | 1 | BP 2027 - test demo | **3** (Active) | 1 | NULL | 2027 | [1] | 4 (BP) |
| 64 | 2 | BP 2027 - test demo | **1** (Draft) | 1 | 100 | 2027 | [1,3] | 4 (BP) |
| 65 | **1** ← reset | NEP 2027 - test demo | **3** (Active) | 1 | 100 | 2027 | [1,3] | 5 (NEP) |

### tProgramStages
| Id | RevisionId | StageId | StageName | IsPublished |
|---|---|---|---|---|
| 63 | 63 | 4 | BP | 0 |
| 64 | 64 | 4 | BP | 0 |
| 65 | 65 | 5 | NEP | 0 |

---

## Status Values

| Status | Meaning | Description |
|---|---|---|
| **1** | Draft | A revision that has been created/edited but not yet finalized within its stage. |
| **3** | Active | The authoritative revision for its stage. This is the version that represents the current state. |

---

## Key Rules

1. **One anchor, many revisions** — `tPrograms` has exactly **one row** per program. All versioned data lives in `tProgramRevisions`.

2. **Append-only** — Revisions are never updated or deleted. Each change inserts a **new row**.

3. **`RevisionNumber` is stage-scoped** — It **resets to 1** when entering a new stage, and **increments** for edits within the same stage.

4. **Stage is tracked separately** — `tProgramStages` links each revision to a pipeline stage. Multiple revisions can exist under the **same stage** (edits within that stage).

5. **Latest revision per stage** — To get the current data for a stage, query the revision with the **highest `RevisionNumber`** for that `StageId`:
   ```sql
   SELECT TOP 1 *
   FROM tProgramRevisions pr
   INNER JOIN tProgramStages ps ON ps.RevisionId = pr.Id
   WHERE pr.ProgramId = @ProgramId
     AND ps.StageId = @StageId
   ORDER BY pr.RevisionNumber DESC
   ```

6. **Stage advancement carries data forward** — When advancing (e.g. BP → NEP), the new revision copies the latest data from the previous stage, resets `RevisionNumber` to 1, and may update fields (e.g. `Name` prefix changes from "BP" to "NEP").

7. **RevisionId = tProgramRevisions.Id** — The `tProgramStages.RevisionId` is a direct foreign key to `tProgramRevisions.Id`, giving a 1:1 mapping between a revision and its stage record.

---

## Visual Timeline

```
Program PR20260200124 created
│
├─ Rev 1 (BP, Status=3 Active)     ← Initial creation
│   └─ Stage: BP (StageId=4)
│
├─ Rev 2 (BP, Status=1 Draft)      ← Edit: Cost set to 100, UserGroup updated
│   └─ Stage: BP (StageId=4)
│
└─ Rev 1 (NEP, Status=3 Active)    ← Stage advanced: BP → NEP, RevisionNumber reset
    └─ Stage: NEP (StageId=5)
```

---

## Querying Patterns

### Get the latest revision for a program (regardless of stage)
```sql
SELECT TOP 1 *
FROM tProgramRevisions
WHERE ProgramId = @ProgramId
ORDER BY Id DESC
```

> Use `Id` (identity) instead of `RevisionNumber` because `RevisionNumber` resets per stage.

### Get the latest active revision per stage
```sql
;WITH Ranked AS (
    SELECT pr.*, ps.StageId, ps.StageName,
           ROW_NUMBER() OVER (
               PARTITION BY ps.StageId
               ORDER BY pr.RevisionNumber DESC
           ) AS rn
    FROM tProgramRevisions pr
    INNER JOIN tProgramStages ps ON ps.RevisionId = pr.Id
    WHERE pr.ProgramId = @ProgramId
)
SELECT * FROM Ranked WHERE rn = 1
```

### Get full revision history for a program
```sql
SELECT pr.*, ps.StageId, ps.StageName, ps.IsPublished
FROM tProgramRevisions pr
INNER JOIN tProgramStages ps ON ps.RevisionId = pr.Id
WHERE pr.ProgramId = @ProgramId
ORDER BY pr.Id ASC
```

---
---

# Part 2 — Project Versioning

---

## Tables Involved

| Table | Role |
|---|---|
| `tProjects` | **Anchor** — one row per project, never duplicated. Linked to a program via `ProgramId`. Tracks `IsPublished` flag (set only at GAA-R stage). |
| `tProjectRevisions` | **Version history** — one row per revision. Holds all mutable project data (`Description`, `Category`, `Thrust`, `City`, `Province`, etc.). |
| `tProjectStages` | **Stage tracker** — links a revision to a pipeline stage (`BP`, `NEP`, `GAA`, etc.). |

---

## Key Difference from Program Versioning

| Aspect | Program | Project |
|---|---|---|
| Anchor key | `ProgramId` | `ReferenceId` (constant across all stages) |
| Version identifier | `RevisionNumber` (resets to 1 per stage) | `RevisionNumber` (resets to 1 per stage) |
| Id that changes | — | `ProjectId` changes when stage advances (stage prefix changes) |

> Both programs and projects share the same `RevisionNumber` behavior: **reset to 1** on stage advancement, **increment** on edit within the same stage.

> **`ReferenceId`** is the true immutable identifier for a project. **`ProjectId`** is stage-scoped — its prefix reflects the current stage (e.g. `BP01193001MN` in BP, `P01193001MN` in NEP).

---

## How It Works (Step by Step)

### 1. Project Creation

When a project is first created under a program:

| Action | Table | What happens |
|---|---|---|
| Insert anchor | `tProjects` | One row with a generated `ReferenceId`. Linked to parent `ProgramId`. |
| Insert revision | `tProjectRevisions` | `RevisionNumber = 1`. `ProjectId = BP01193001MN` (BP-prefixed). Carries initial data. |
| Insert stage | `tProjectStages` | Links `RevisionId → 4771` to `StageId = 4` (BP). |

**Resulting state:**

```
tProjects           → 1 row   (ReferenceId = BP01193001MN, ProgramId = PR20260200124)
tProjectRevisions   → 1 row   (RevisionNumber = 1, ProjectId = BP01193001MN, Stage = BP)
tProjectStages      → 1 row   (RevisionId = 4771, StageId = 4 / BP)
```

### 2. Edit Within the Same Stage

When a project is edited (e.g. `AlternateId` added) without advancing to a new stage:

| Action | Table | What happens |
|---|---|---|
| Insert revision | `tProjectRevisions` | `RevisionNumber = 2`. Same `ProjectId = BP01193001MN`. Updated data (`AlternateId = sdsdsdsd`). |
| Insert stage | `tProjectStages` | New row linking `RevisionId → 4772` to the **same** `StageId = 4` (BP). |

> The `ProjectId` stays the same, and `RevisionNumber` increments within that stage.

**Resulting state:**

```
tProjects           → 1 row   (unchanged)
tProjectRevisions   → 2 rows  (Rev 1 and Rev 2, both BP01193001MN)
tProjectStages      → 2 rows  (both StageId = 4 / BP)
```

### 3. Stage Advancement (BP → NEP)

When a project advances to a new pipeline stage:

| Action | Table | What happens |
|---|---|---|
| Insert revision | `tProjectRevisions` | **`RevisionNumber` resets to 1**. `ProjectId` changes to `P01193001MN` (NEP prefix). |
| Insert stage | `tProjectStages` | New row linking `RevisionId → 4773` to `StageId = 5` (NEP). |

> **Two things change on stage advancement:**
> 1. `ProjectId` gets a new stage prefix (`BP...` → `P...`)
> 2. `RevisionNumber` resets to 1

> **`ReferenceId` remains `BP01193001MN`** — it is the constant thread across all stages.

**Resulting state:**

```
tProjects           → 1 row   (unchanged)
tProjectRevisions   → 3 rows  (BP Rev 1, BP Rev 2, NEP Rev 1)
tProjectStages      → 3 rows  (2× BP, 1× NEP)
```

---

## Full Example (BP01193001MN)

### tProjects
| Id | ProgramId | ReferenceId | CreatedBy | CreatedDate | IsDeleted | IsPublished |
|---|---|---|---|---|---|---|
| 10366 | PR20260200124 | BP01193001MN | jimeneznr | 2026-02-27 08:09:07 | 0 | 0 |

### tProjectRevisions
| Id | ReferenceId | ProjectId | AlternateId | RevisionNumber | Description | Category | Thrust | Origin | City | Province |
|---|---|---|---|---|---|---|---|---|---|---|
| 4771 | BP01193001MN | **BP**01193001MN | *(empty)* | **1** | adsa | 24 | 1115 | 62 | PH1600201 | PH16002 |
| 4772 | BP01193001MN | **BP**01193001MN | sdsdsdsd | **2** | adsa | 24 | 1115 | 62 | PH1600201 | PH16002 |
| 4773 | BP01193001MN | **P**01193001MN | sdsdsdsd | **1** ← reset | adsa | 24 | 1115 | 62 | PH1600201 | PH16002 |

### tProjectStages
| Id | ReferenceId | RevisionId | StageId | StageName | CreatedDate |
|---|---|---|---|---|---|
| 18187 | BP01193001MN | 4771 | 4 | BP | 2026-02-27 08:09:07 |
| 18188 | BP01193001MN | 4772 | 4 | BP | 2026-02-27 08:14:09 |
| 18189 | BP01193001MN | 4773 | 5 | NEP | 2026-02-27 08:15:51 |

---

## Key Rules (Project-Specific)

1. **`ReferenceId` is immutable** — It never changes. Use it as the primary key for querying a project across all stages.

2. **`ProjectId` is stage-scoped** — It changes when the project advances. The prefix reflects the pipeline stage:
   - `BP01193001MN` — Budget Proposal stage
   - `P01193001MN` — NEP / later stages

3. **`RevisionNumber` resets per stage** — Unlike programs (monotonically increasing), project revision numbering starts at 1 again when entering a new stage.

4. **Latest revision per stage** — To get the current data for a specific stage, query by `ReferenceId` + `StageId` and take the highest `RevisionNumber`:
   ```sql
   SELECT TOP 1 *
   FROM tProjectRevisions pr
   INNER JOIN tProjectStages ps ON ps.RevisionId = pr.Id
   WHERE pr.ReferenceId = @ReferenceId
     AND ps.StageId = @StageId
   ORDER BY pr.RevisionNumber DESC
   ```

5. **Latest revision overall** — Use `tProjectStages.CreatedDate` or `tProjectRevisions.Id` (identity) to find the most recent revision across all stages, since `RevisionNumber` alone is not globally unique.

6. **Parent linkage** — Every project is linked to exactly one program via `ProgramId`. When the program advances, its projects advance together.

7. **Latest stage is determined at the program level** — All projects under a program share the same current stage. If the program's latest stage is GAA-R, then every project in that program is at GAA-R. To find the latest stage, query `tProgramStages` for the highest `StageId` of the program — do **not** derive it per-project:
   ```sql
   SELECT TOP 1 ps.StageName
   FROM tProgramStages ps
   INNER JOIN tProgramRevisions pr ON pr.Id = ps.RevisionId
   WHERE pr.ProgramId = @ProgramId
   ORDER BY ps.StageId DESC
   ```

7. **`IsPublished` lives on `tProjects`** — The publish flag is on the project anchor table, not on `tProjectStages`. It is set to `1` only when the project reaches the **GAA-R** stage. Similarly, `tPrograms.IsPublished` is set at GAA-R.

8. **`IsPublishable` is a readiness flag** — `tProjectRevisions.IsPublishable` indicates whether the revision *can be* published (eligibility), but does not mean it *is* published. The actual publish state is `tProjects.IsPublished`.

---

## Publishing & Revision Workflow

### Publishing Rules

1. **Only the GAA-R stage can publish** — `IsPublished` on `tPrograms` and `tProjects` can only be set to `1` when the current stage is **GAA-R** (`StageId = 10`).
2. **`tProjectRevisions.IsPublishable`** determines whether a project revision is *eligible* for publishing (a readiness check), separate from the actual publish flag.
3. **`tProjects.IsPublished`** is the authoritative publish status for the project.
4. **`tPrograms.IsPublished`** is the authoritative publish status for the program.

### Revision Rules (Post-Publication)

Once both the **Program** and **Project** are published (`IsPublished = 1`), users are allowed to create a **Revision**:

1. **Guard condition:** `tPrograms.IsPublished = 1 AND tProjects.IsPublished = 1`
2. A revision stores a **snapshot copy** of the project and all related child data into the revision tables:
   - `tRevisionProjects` (copy of `tProjectRevisions`)
   - `tRevisionProjectComponentCost` (copy of `tProjectComponentCost`)
   - `tRevisionProjectComponentCostPerYear` (copy of `tProjectComponentCostPerYear`)
   - `tRevisionProjectMajorWorkItem` (copy of `tProjectMajorWorkItem`)
   - `tRevisionProjectMajorWorkLocations` (copy of `tProjectMajorWorkLocations`)
   - `tRevisionProjectFundingProfile` (copy of `tProjectFundingProfile`)
3. The previous version is **preserved** — revision tables use `TransactionId` to scope each snapshot.
4. A `tRevisionDetails` record is created with revision metadata (group, category, reason, approval workflow).
5. `tRevisionTransactionLog` records all field-level changes for audit.

---

## Visual Timeline

```
Project BP01193001MN (under PR20260200124)
│
├─ Rev 1 (ProjectId=BP01193001MN, Stage=BP)   ← Initial creation
│   └─ Stage: BP (StageId=4)
│
├─ Rev 2 (ProjectId=BP01193001MN, Stage=BP)   ← Edit: AlternateId added
│   └─ Stage: BP (StageId=4)
│
└─ Rev 1 (ProjectId=P01193001MN, Stage=NEP)   ← Stage advanced: BP → NEP
    └─ Stage: NEP (StageId=5)                     ProjectId changed, RevisionNumber reset
```

---

## Child Table Versioning (Funding, Components, Costs)

Project child tables — `tProjectFundingProfile`, `tProjectComponentCost`, and `tProjectComponentCostPerYear` — do **not** use `RevisionNumber`. Instead, they use **`StageName`** and **`ProjectId`** to differentiate between stage versions.

### How Stage Advancement Works for Child Tables

When a project advances from BP → NEP, all child rows are **duplicated** with the new stage's `ProjectId` and `StageName`. The original BP rows remain untouched.

| Aspect | Behavior |
|---|---|
| Versioning key | `StageName` (not `RevisionNumber`) |
| On stage advancement | Rows are **duplicated** with new `ProjectId` + `StageName` |
| Shared identifiers | `CostId` and `ComponentCostId` remain the **same** across stages |
| Original rows | Never modified |
| CreatedDate | Same timestamp for both BP and NEP rows (duplicated at the same moment) |

### tProjectFundingProfile
| Id | ProjectId | Source | Agreement | Amount | Percentage | StageName |
|---|---|---|---|---|---|---|
| 5371 | **BP**01193001MN | GOP | DPWH-GAA-2014 | 100 | 100 | **BP** |
| 5372 | **P**01193001MN | GOP | DPWH-GAA-2014 | 100 | 100 | **NEP** |

> Same funding data, different `ProjectId` and `StageName`. Both created at `2026-02-27 08:14:09`.

### tProjectComponentCost
| Id | ProjectId | CostId | ComponentType | ComponentId | Description | Total | StageName |
|---|---|---|---|---|---|---|---|
| 11725 | **BP**01193001MN | temp_...tyzldbt5h | Civil Works | CW1 | asdasd | 100 | **BP** |
| 11726 | **P**01193001MN | temp_...tyzldbt5h | Civil Works | CW1 | asdasd | 100 | **NEP** |

> `CostId` is shared — it links the same logical component cost across stages.

### tProjectComponentCostPerYear
| Id | ComponentCostId | Amount | Year | StageName |
|---|---|---|---|---|
| 11961 | temp_...tyzldbt5h | 50 | 2027 | **BP** |
| 11962 | temp_...tyzldbt5h | 50 | 2028 | **BP** |
| 11963 | temp_...tyzldbt5h | 50 | 2027 | **NEP** |
| 11964 | temp_...tyzldbt5h | 50 | 2028 | **NEP** |

> Yearly breakdown duplicated per stage. `ComponentCostId` links back to `tProjectComponentCost.CostId`.

### tProjectMajorWorkItem
| Id | ProjectId | ReferenceId | ComponentId | YearOfWork | WorkTypeId | InfraType | StageName |
|---|---|---|---|---|---|---|---|
| 18946 | **BP**01193001MN | **BP**01193001MN-CW1 | CW1 | 2027 | 126 | LR | **BP** |
| 18947 | **P**01193001MN | **P**01193001MN-CW1-0 | CW1 | 2027 | 126 | LR | **NEP** |

> **`ReferenceId` changes on stage advancement** — it is composed from `ProjectId` + component suffix, so it inherits the stage prefix: `BP01193001MN-CW1` → `P01193001MN-CW1-0`.

### tProjectMajorWorkLocations
| Id | ParentId | InfraId | DetailedScope | TargetUnitId | TargetUnit | StartX | StartY | EndX | EndY | PhysicalTarget | Length |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 27969 | BP01193001MN-CW1 | LRD20021 | wadasd | 126 | Lane Km | 117 | 8 | 117 | 8 | 4 | 5 |

> `ParentId` links to `tProjectMajorWorkItem.ReferenceId`. Locations are tied to the work item's stage-scoped `ReferenceId`.

### tProjectNotes
| Id | ProjectId | StageName | FileName | FileExtension | FilePath | Description | CreatedBy | CreatedDate |
|---|---|---|---|---|---|---|---|---|
| *(empty)* | | | | | | | | |

> Stores file attachments per project per stage. Same `ProjectId` + `StageName` pattern as other child tables.

### Key Rules (Child Tables)

1. **`StageName` is the version discriminator** — To get child data for a specific stage, filter by `StageName` (or `ProjectId`, which is stage-scoped).

2. **Shared `CostId` / `ComponentCostId`** — These identifiers remain constant across stages, allowing you to trace the same logical item across its stage history.

3. **Full duplication on advancement** — Every child row is cloned with new `ProjectId` + `StageName`. Edits after advancement only affect the new stage's rows.

4. **Work item `ReferenceId` is stage-scoped** — `tProjectMajorWorkItem.ReferenceId` is derived from `ProjectId` + component suffix, so it changes on stage advancement (e.g. `BP01193001MN-CW1` → `P01193001MN-CW1-0`).

5. **Locations link through work item** — `tProjectMajorWorkLocations.ParentId` references the work item's stage-scoped `ReferenceId`, forming the chain: `ProjectId → WorkItem.ReferenceId → Location.ParentId`.

6. **Notes follow the same pattern** — `tProjectNotes` uses `ProjectId` + `StageName` to scope file attachments per stage.

7. **Query by stage:**
   ```sql
   -- Funding for NEP stage
   SELECT * FROM tProjectFundingProfile
   WHERE ProjectId = @ProjectId AND StageName = 'NEP'

   -- Component costs for NEP stage
   SELECT * FROM tProjectComponentCost
   WHERE ProjectId = @ProjectId AND StageName = 'NEP'

   -- Yearly costs for a specific component across all stages
   SELECT * FROM tProjectComponentCostPerYear
   WHERE ComponentCostId = @CostId
   ORDER BY StageName, Year

   -- Major work items for NEP stage
   SELECT * FROM tProjectMajorWorkItem
   WHERE ProjectId = @ProjectId AND StageName = 'NEP'

   -- Locations for a specific work item
   SELECT * FROM tProjectMajorWorkLocations
   WHERE ParentId = @WorkItemReferenceId

   -- Notes/attachments for NEP stage
   SELECT * FROM tProjectNotes
   WHERE ProjectId = @ProjectId AND StageName = 'NEP'
   ```

---

## Visual Timeline (Full — Including Child Tables)

```
Project BP01193001MN (under PR20260200124)
│
├─ Rev 1 (ProjectId=BP01193001MN, Stage=BP)     ← Initial creation
│   └─ Stage: BP (StageId=4)
│
├─ Rev 2 (ProjectId=BP01193001MN, Stage=BP)     ← Edit: AlternateId added
│   └─ Stage: BP (StageId=4)
│   └─ Child rows created:
│       FundingProfile (BP), ComponentCost (BP), CostPerYear (BP)
│       MajorWorkItem (BP, Ref=BP01193001MN-CW1)
│       MajorWorkLocations (ParentId=BP01193001MN-CW1)
│
└─ Rev 1 (ProjectId=P01193001MN, Stage=NEP)     ← Stage advanced: BP → NEP
    └─ Stage: NEP (StageId=5)
    └─ Child rows DUPLICATED:
        FundingProfile (NEP), ComponentCost (NEP), CostPerYear (NEP)
        MajorWorkItem (NEP, Ref=P01193001MN-CW1-0)
        MajorWorkLocations (ParentId=P01193001MN-CW1-0)
```

---

## Querying Patterns (Project)

### Get the latest revision for a project (regardless of stage)
```sql
SELECT TOP 1 pr.*, ps.StageId, ps.StageName
FROM tProjectRevisions pr
INNER JOIN tProjectStages ps ON ps.RevisionId = pr.Id
WHERE pr.ReferenceId = @ReferenceId
ORDER BY pr.Id DESC
```

### Get the latest revision per stage
```sql
;WITH Ranked AS (
    SELECT pr.*, ps.StageId, ps.StageName,
           ROW_NUMBER() OVER (
               PARTITION BY ps.StageId
               ORDER BY pr.RevisionNumber DESC
           ) AS rn
    FROM tProjectRevisions pr
    INNER JOIN tProjectStages ps ON ps.RevisionId = pr.Id
    WHERE pr.ReferenceId = @ReferenceId
)
SELECT * FROM Ranked WHERE rn = 1
```

### Get full revision history for a project
```sql
SELECT pr.*, ps.StageId, ps.StageName, p.IsPublished
FROM tProjectRevisions pr
INNER JOIN tProjectStages ps ON ps.RevisionId = pr.Id
INNER JOIN tProjects p ON p.ReferenceId = pr.ReferenceId
WHERE pr.ReferenceId = @ReferenceId
ORDER BY pr.Id ASC
```

### Find all projects under a program with their latest data
```sql
;WITH Ranked AS (
    SELECT pr.*, ps.StageId, ps.StageName,
           ROW_NUMBER() OVER (
               PARTITION BY pr.ReferenceId
               ORDER BY pr.Id DESC
           ) AS rn
    FROM tProjectRevisions pr
    INNER JOIN tProjectStages ps ON ps.RevisionId = pr.Id
    WHERE pr.ProgramId = @ProgramId
)
SELECT * FROM Ranked WHERE rn = 1
```

---
---

# Part 3 — Stored Procedures

---

## pGenerateAIP01

**Purpose:** Generate the AIP (Annual Investment Plan) report — returns the latest revision per project per stage for a given program, with resolved lookup names.

**File:** `pGenerateAIP.sql`

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `@ProgramId` | NVARCHAR(200) | **Yes** | The program to generate the AIP for |
| `@CategoryName` | NVARCHAR(200) | No | Filter by project category name |
| `@RegionName` | NVARCHAR(200) | No | Filter by region name |
| `@RegionalOfficeName` | NVARCHAR(200) | No | Filter by Regional Office (Operating Unit) name via `vAdminOperatingUnit` |
| `@DistrictEngineeringOffice` | NVARCHAR(200) | No | Filter by DEO name |
| `@ImplementingOfficeName` | NVARCHAR(200) | No | Filter by Implementing Office name via `vAdminImplementingOffice` |
| `@LegislativeDistrictName` | NVARCHAR(200) | No | Filter by Legislative District name |

> All optional filters use `(@Param IS NULL OR column = @Param)` — passing `NULL` or omitting the parameter skips that filter.

### Output Columns

| Column | Source |
|---|---|
| `ProjectId` | `tProjectRevisions.ProjectId` |
| `UACS` | `tProjectRevisions.UACS` |
| `Description` | `tProjectRevisions.Description` |
| `StageName` | `tProjectStages.StageName` |
| `Region` | `tOptionAdminAreaRegion.Name` |
| `RegionalOffice` | `vAdminOperatingUnit.Name` |
| `LegislativeDistrict` | `tOptionAdminAreaCongressionalDistrict.Name` |
| `DEO` | `tOptionAdminAreaDistrictEngineeringOffice.Name` |
| `ImplementingOffice` | `vAdminImplementingOffice.Name` |
| `Category` | `tOptionProjectCategory.CategoryName` |
| `Thrust` | `tOptionProjectThrustList.ThrustDescription` |

### How It Works

1. **LatestPerStage CTE** — `ROW_NUMBER() OVER (PARTITION BY ReferenceId, StageId ORDER BY RevisionNumber DESC)` gets the latest revision per project per stage.
2. **Lookup joins** — Resolves `ParticipantId`/`GdbId` codes to human-readable names.
3. **Optional filters** — Applied in the `WHERE` clause with `IS NULL` bypass pattern.

### Usage
```sql
-- All projects in a program (no filters)
EXEC pGenerateAIP01 @ProgramId = 'P_CO-PS-635_04112025_134220'

-- Filter by Region + DEO only
EXEC pGenerateAIP01 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @RegionName = 'Region I',
    @DistrictEngineeringOffice = 'Ilocos Norte 1st DEO'

-- Filter by all
EXEC pGenerateAIP01 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @CategoryName = 'Bridge',
    @RegionName = 'Region I',
    @RegionalOfficeName = 'Region I Office',
    @DistrictEngineeringOffice = 'Ilocos Norte 1st DEO',
    @ImplementingOfficeName = 'Ilocos Norte IO',
    @LegislativeDistrictName = 'ILOCOS NORTE (FIRST DISTRICT)'
```

---

## pGenerateAIPComponents

**Purpose:** Returns component cost details (with scope of work and physical targets) for all projects in a program at a given stage.

**File:** `pGenerateAIPComponents.sql`

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `@ProgramId` | NVARCHAR(200) | **Yes** | The program to query |
| `@StageId` | INT | **Yes** | The stage to query (e.g. `4` = BP, `5` = NEP) |

### Output Columns

| Column | Source |
|---|---|
| `Id` | `tProjectComponentCost.Id` |
| `ProjectComponentId` | `TRIM(ProjectId) + '-' + ComponentId` |
| `Description` | `tProjectComponentCost.Description` |
| `ScopeDescription` | `tOptionScopeOfWork.Description` |
| `ScopeMeasure` | `tOptionScopeOfWork.Measure` |
| `TotalUnitCost` | `SUM(tProjectMajorWorkLocations.PhysicalTarget)` for the work item |
| `TotalComponentCost` | `tProjectComponentCost.Total` |

### How It Works

1. **LatestPerStage CTE** — Resolves the latest revision per project (`PARTITION BY ReferenceId`) for the given `@StageId`, yielding the stage-scoped `ProjectId` and `StageName`.
2. **Child table joins** — Uses `(ProjectId, StageName)` to join `tProjectComponentCost` (the version discriminator for child tables — see Part 2, Child Table Versioning).
3. **Work item chain** — `tProjectMajorWorkItem` matched on `(ComponentId, StageName, ProjectId)` → `tProjectMajorWorkLocations` via `ParentId = wi.ReferenceId` for physical target aggregation.

### Usage
```sql
-- Components for all projects in NEP stage
EXEC pGenerateAIPComponents 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @StageId = 5

-- Components for all projects in BP stage
EXEC pGenerateAIPComponents 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @StageId = 4
```

---

## pGenerateRBP

**Purpose:** Generate a Regional Budget Proposal summary — pivots project counts and total component cost amounts by category (OO-1, OO-2, CSSP, LP), grouped by Region / DEO / Legislative District, for a specific stage.

**File:** `pGenerateRBP.sql`

### Category Mapping

| CategoryId | Column Label |
|---|---|
| 16 | OO-1 |
| 17 | OO-2 |
| 29 | CSSP |
| 30 | LP |

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `@ProgramId` | NVARCHAR(200) | **Yes** | The program to generate the RBP for |
| `@StageId` | INT | No (default `3`) | The stage to query. Default `3` = RBP; `4` = BP, `5` = NEP, `10` = GAA-R |
| `@RegionName` | NVARCHAR(200) | No | Optional filter by region name |

### Output Columns

| Column | Description |
|---|---|
| `Region` | Region name |
| `DEO` | District Engineering Office name |
| `LegislativeDistrict` | Legislative District name |
| `OO1_NoOfProj` | Count of projects with CategoryId = 16 |
| `OO1_Amount` | Sum of component cost totals for CategoryId = 16 |
| `OO2_NoOfProj` | Count of projects with CategoryId = 17 |
| `OO2_Amount` | Sum of component cost totals for CategoryId = 17 |
| `CSSP_NoOfProj` | Count of projects with CategoryId = 29 |
| `CSSP_Amount` | Sum of component cost totals for CategoryId = 29 |
| `LP_NoOfProj` | Count of projects with CategoryId = 30 |
| `LP_Amount` | Sum of component cost totals for CategoryId = 30 |
| `Total_NoOfProj` | Total project count across all 4 categories |
| `Total_Amount` | Total component cost amount across all 4 categories |

### How It Works

1. **LatestPerStage CTE** — Gets the latest revision per project for the given `@StageId` (`PARTITION BY ReferenceId ORDER BY RevisionNumber DESC`).
2. **ProjectCost CTE** — Joins to `tProjectComponentCost` on `(ProjectId, StageName)` — the child table version discriminator — and sums `Total` per project.
3. **Conditional aggregation** — Uses `COUNT(CASE WHEN Category = X ...)` and `SUM(CASE WHEN Category = X ...)` to pivot into OO-1, OO-2, CSSP, LP columns.
4. **Grouped by** Region → DEO → Legislative District.

### Usage
```sql
-- Default stage (RBP, StageId=3), all regions
EXEC pGenerateRBP @ProgramId = 'P_CO-PS-635_04112025_134220'

-- Specific stage + region filter
EXEC pGenerateRBP 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @StageId = 4,
    @RegionName = 'Region I'
```

---

## pGenerateRBPComponents

**Purpose:** Generate the FY Budget Proposal detail report — returns one row per work location with the full grouping hierarchy (Region → Tier → DEO → Legislative District → Category → Thrust → Project → Component → Work Location). The front-end groups and subtotals by these columns to produce the printed report layout.

**File:** `pGenerateRBPComponents.sql`

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `@ProgramId` | NVARCHAR(200) | **Yes** | The program to generate the RBP detail for |
| `@RegionName` | NVARCHAR(200) | No | Optional filter by region name |

> Stage is hardcoded to `3` (RBP) — same as `pGenerateRBP`.

### Report Hierarchy (Grouping Levels)

```
Region                          ← tOptionAdminAreaRegion.Name
└─ Tier                         ← tProjectRevisions.Tier
   └─ DEO                      ← tOptionAdminAreaDistrictEngineeringOffice.Name
      └─ Legislative District   ← tOptionAdminAreaCongressionalDistrict.Name
         └─ Category + Thrust   ← tOptionProjectCategory.CategoryName + tOptionProjectThrustList.*
            └─ Project          ← ProjectId + ProjectDescription
               └─ Component    ← ComponentId (CW1/CW2) + ScopeDescription + ComponentCost
                  └─ Work Location ← DetailsOfWork + LengthOfWork + PhysicalTarget + TargetUnit
```

### Output Columns

| Column | Source | Description |
|---|---|---|
| `Region` | `tOptionAdminAreaRegion.Name` | Region name |
| `Tier` | `tProjectRevisions.Tier` | Project tier (1, 2) |
| `DEO` | `tOptionAdminAreaDistrictEngineeringOffice.Name` | District Engineering Office |
| `LegislativeDistrict` | `tOptionAdminAreaCongressionalDistrict.Name` | Legislative District |
| `CategoryName` | `tOptionProjectCategory.CategoryName` | Category (e.g. OO-1, OO-2) |
| `ThrustProgramName` | `tOptionProjectThrustList.ProgramName` | Thrust program (e.g. "Ensure Safe and Reliable National Road System") |
| `ThrustSubProgramName` | `tOptionProjectThrustList.SubProgramName` | Sub-program (e.g. "Asset Preservation") |
| `ThrustActivityName` | `tOptionProjectThrustList.ActivityName` | Activity (e.g. "Preventive Maintenance") |
| `ThrustDescription` | `tOptionProjectThrustList.ThrustDescription` | Full thrust description |
| `ProjectId` | `tProjectRevisions.ProjectId` | Stage-scoped project ID |
| `ProjectDescription` | `tProjectRevisions.Description` | Project name / description |
| `ComponentId` | `tProjectComponentCost.ComponentId` | Component type (CW1, CW2, etc.) |
| `ComponentDescription` | `tProjectComponentCost.Description` | Component description |
| `ScopeDescription` | `tOptionScopeOfWork.Description` | Scope of work (e.g. "Preventive Maintenance of Road: Asphalt Overlay") |
| `ScopeMeasure` | `tOptionScopeOfWork.Measure` | Unit of measure from scope |
| `ComponentCost` | `tProjectComponentCost.Total` | Component cost total |
| `DetailsOfWork` | `tOptionInfraType.InfraName` | Details of work (e.g. "Asphalt Overlay") |
| `LengthOfWork` | `tProjectMajorWorkLocations.Length` | Length of work in meters |
| `PhysicalTarget` | `tProjectMajorWorkLocations.PhysicalTarget` | Physical target value |
| `TargetUnit` | `tProjectMajorWorkLocations.TargetUnit` | Target unit (e.g. "Lane Km") |

### How It Works

1. **LatestPerStage CTE** — Gets the latest revision per project for `StageId = 3` (RBP), carrying project-level fields (`Description`, `Category`, `Tier`, `Thrust`, and admin area FKs).
2. **Lookup joins** — Resolves region, DEO, legislative district, category, and thrust to human-readable names.
3. **Child-table chain** — `tProjectComponentCost` → `tProjectMajorWorkItem` → `tProjectMajorWorkLocations`, all joined via `(ProjectId, StageName)` version discriminator.
4. **Details of work** — `tOptionInfraType.InfraName` joined via `tProjectMajorWorkItem.InfraType = InfraCode`.
5. **Result granularity** — One row per work location. Front-end aggregates subtotals at each grouping level (project cost = SUM of component costs, etc.).

### Usage
```sql
-- All regions
EXEC pGenerateRBPComponents @ProgramId = 'P_CO-PS-635_04112025_134220'

-- Filter by region
EXEC pGenerateRBPComponents 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @RegionName = 'Region I'
```

---

## pGenerateRDIP

**Purpose:** Generate the Regional Development Investment Plan (RDIP) report — returns project details with grouping hierarchy (Category → Thrust → Project) plus spatial coverage, implementation period, and yearly investment cost breakdown. Grouped by OO1, OO2, CSSP, and LP categories.

**File:** `pGenerateRDIP.sql`

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `@ProgramId` | NVARCHAR(200) | **Yes** | The program to generate the RDIP for |
| `@RegionName` | NVARCHAR(200) | No | Optional filter by region name |

> Stage is hardcoded to `3` (RBP) — same as `pGenerateRBP`.

### Report Hierarchy (Grouping Levels)

```
Region
└─ Category (OO1 / OO2 / CSSP / LP)          ← tOptionProjectCategory.CategoryName
   └─ Thrust Program                          ← tOptionProjectThrustList.ProgramName
      └─ Thrust Sub-Program                   ← tOptionProjectThrustList.SubProgramName
         └─ Thrust Activity                   ← tOptionProjectThrustList.ActivityName
            └─ Infrastructure Type            ← tOptionProjectThrustList.InfrastructureType
               └─ Project                     ← ProjectId + Description + spatial + costs
```

### Result Set 1 — Project Details

| Column | Source | Description |
|---|---|---|
| `Region` | `tOptionAdminAreaRegion.Name` | Region name |
| `CategoryName` | `tOptionProjectCategory.CategoryName` | Category (OO-1, OO-2, CSSP, LP) |
| `ThrustProgramName` | `tOptionProjectThrustList.ProgramName` | e.g. "Ensure Safe and Reliable National Road System" |
| `ThrustSubProgramName` | `tOptionProjectThrustList.SubProgramName` | e.g. "Asset Preservation Program" |
| `ThrustActivityName` | `tOptionProjectThrustList.ActivityName` | e.g. "Preventive Maintenance" |
| `ThrustInfrastructureType` | `tOptionProjectThrustList.InfrastructureType` | e.g. "Primary Roads", "Secondary Roads" |
| `ProjectId` | `tProjectRevisions.ProjectId` | Stage-scoped project ID |
| `ProjectDescription` | `tProjectRevisions.Description` | Project name / road description |
| `CityMunicipality` | `tOptionAdminAreaCityMunicipality.Name` | City/Municipality |
| `Province` | `tOptionAdminAreaProvince.Name` | Province name |
| `CongressionalDistrict` | `tOptionAdminAreaCongressionalDistrict.Name` | Congressional District |
| `StartYear` | `MIN(tProjectComponentCostPerYear.Year)` | Start of project implementation |
| `EndYear` | `MAX(tProjectComponentCostPerYear.Year)` | Year of project implementation end |
| `TotalCost` | `SUM(tProjectComponentCost.Total)` | Total investment cost |

### Result Set 2 — Yearly Investment Cost

| Column | Source | Description |
|---|---|---|
| `ProjectId` | `tProjectRevisions.ProjectId` | Links to Result Set 1 |
| `Year` | `tProjectComponentCostPerYear.Year` | Calendar year |
| `Amount` | `SUM(tProjectComponentCostPerYear.Amount)` | Total amount for that year |

> The front-end pivots Result Set 2 into dynamic year columns (e.g. 2017, 2018, …, 2022) and computes "Later Years" as the sum of amounts beyond the report's year range.

### How It Works

1. **Temp table `#LatestProjects`** — Resolves the latest revision per project for `StageId = 3` (RBP). Stored in a temp table to avoid recomputing the CTE for both result sets.
2. **Result Set 1** — Joins lookup tables for category, thrust, spatial coverage. Uses `OUTER APPLY` for total cost (`SUM(tProjectComponentCost.Total)`) and implementation period (`MIN/MAX Year` from `tProjectComponentCostPerYear` where `Amount > 0`).
3. **Result Set 2** — Aggregates yearly amounts per project from `tProjectComponentCostPerYear`, grouped by `(ProjectId, Year)`. The front-end maps these into year columns.
4. **Category filter** — Only includes categories 16 (OO-1), 17 (OO-2), 18/29 (CSSP), 19/30 (LP).

### Usage
```sql
-- All regions
EXEC pGenerateRDIP @ProgramId = 'P_CO-PS-635_04112025_134220'

-- Filter by region
EXEC pGenerateRDIP 
    @ProgramId = 'P_CO-PS-635_04112025_134220',
    @RegionName = 'Region I'
```

---
---

# Part 4 — Migration Functions

---

## fGetRBPProjectRevision

**Purpose:** Inline TVF that transforms legacy `MYPS_BAK` project data into the `tProjectRevisions` schema for migration. Maps old text-based codes and enums to the new system's integer/lookup values.

**File:** `fn_GetProjectRevisionData.sql` | **Function name:** `fGetRBPProjectRevision`

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `@ProgramId` | NVARCHAR(100) | The legacy program ID to migrate (e.g. `'P_CO-PS-635_04112025_134220'`) |

### Source Tables (MYPS_BAK)

| Table | Purpose | Join Key |
|---|---|---|
| `project` | Main project anchor | `projectid`, `programid` |
| `projectthrust` | Project thrust assignment | `projectid`, `programid` |
| `projectoffices` | Office codes (OU, IO, DEO, LD, City) | `projectid`, `programid` |
| `longtermproject` | Feasibility/design/ROW flags | `projectid`, `programid` |
| `projecttier` | Tier assignment | `projectid` |
| `projectdescription` | Project description text | `projectid`, `programid` |
| `projectcoststream` | UACS (pmsid) lookup | `projectid`, `programid` |

### Lookup Tables (LOCAL-MYPS)

| Table | Maps From → To |
|---|---|
| `tOptionAdminAreaCityMunicipality` | `cm_code` → `GdbId` (City), `ProvinceGdbId` (Province) |
| `tOptionAdminAreaCongressionalDistrict` | `ld_code` → `GdbId` (LegislativeDistrict) |
| `tOptionAdminAreaDistrictEngineeringOffice` | `deo_code` → `ParticipantId` (DEO) |
| `tOptionAdminAreaRegion` | `RegionParticipantId` → `ParticipantId` (Region), `IslandCode` |

### Enum Mappings

| Field | Legacy Value → New Value |
|---|---|
| `ImplementationMode` | `'by Administration'` → 1, `'by Contract'` → 2, `'by MOA'` → 3, `'By Negotiated Contract'` → 4 |
| `EmergencyMode` | `'YES'` → 1, else → 0 |
| `Feasibility` | `'Yes'` → 1, `'No'` → 2, `'Not applicable'` → 3, `'To be Decided'` → 4, else → 2 |
| `DetailedDesign` | `'Yes'` → 1, else → 0 |
| `RowAvailable` | `'Yes'` → 1, else → 0 |
| `RegionWide` | `'%ignore%'` → 3, `'Y'/'YES'/'Regionwide'` → 1, else → 2 |
| `Tier` | `'Tier II'` → 2, else → 1 |

### Enhancements Over Original

| Issue | Original | Enhanced |
|---|---|---|
| UACS subquery | Could return multiple rows → runtime error | `TOP 1` added |
| Duplicate rows | `SELECT DISTINCT` masked 1:N fan-out from `projectthrust` / `projectoffices` | `ROW_NUMBER()` CTEs (`ThrustRanked`, `OfficeRanked`) deduplicate at source |
| Missing `ProgramId` | Not in output | Included as `@ProgramId` |
| Lookup joins | `INNER JOIN` silently dropped projects with bad codes | `LEFT JOIN` — projects with missing lookups retained |
| Missing columns | `MYCAApprovalDate`, `Rank`, `IsPublishable`, `IsDeleted` absent | All included with defaults |
| LpAgg grouping | Grouped by `projectid, programid` (programid redundant since filtered) | Grouped by `projectid` only |

### Usage
```sql
-- Direct query
SELECT * FROM dbo.fGetRBPProjectRevision('P_CO-PS-635_04112025_134220')

-- Migration insert into tProjectRevisions
INSERT INTO tProjectRevisions (
    ProgramId, ReferenceId, ProjectId, AlternateId, ExternalId, MYId, UACS,
    MYCAApprovalDate, RevisionNumber, [Description], Category, Thrust, Origin,
    City, Province, LegislativeDistrict, OperatingUnit, ImplementingOffice,
    DEO, Region, Agency, ImplementationMode, EmergencyMode, IslandCode,
    Feasibility, FeasibilityDate, DetailedDesign, DetailedDesignDate,
    RowAvailable, RegionWide, Tier, [Rank], IsRevised, RevisedNumber,
    CreatedBy, CreatedDate, IsPublishable, IsDeleted
)
SELECT * FROM dbo.fGetRBPProjectRevision('P_CO-PS-635_04112025_134220')
```
