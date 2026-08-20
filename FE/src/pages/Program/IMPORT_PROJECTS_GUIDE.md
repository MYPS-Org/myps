# Import Projects Guide

> **⚠ Legacy / currently unused.** This guide documents `ImportProjectsDialog.tsx`'s client-side parse flow, which is no longer wired into the live UI — the backend's `/Importing/ImportProject` endpoint stopped accepting the JSON payload this flow builds (see commit `eb3327af`, "Importing Projects - Validation and Writing to DB", and its follow-up `4a31ccc1`, "Importing Projects - update - to handle the blob file"). The live "Import Projects" action now opens `ImportProjectsJobDialog.tsx` instead: it posts the workbook directly as `multipart/form-data` (`{ProgramId, StageName, File}`) to `/Importing/ImportProject`, which saves the upload and queues the Hangfire job in one call and returns a `JobId`, then polls `/Importing/GetImportStatus` until the job finishes. This dialog and the utilities below (`parseImportFile.ts`, `transformImportedProjects.ts`) are kept in the codebase for possible later reuse but are not currently reachable from the app. See `documents/plans/program-import-job-dialog.md` for the full rationale.

Bulk-import projects into a program from an **XLSM template file**.

---

## Overview

```
User uploads .xlsm
        │
        ▼
parseImportFile()          ← reads 4 Excel sheets, groups rows by ProjectId
        │
        ▼
ImportedProject[]          ← raw Excel data (string names for lookups)
        │
        ▼
transformImportedProjects() ← converts to flat backend DTO shape
        │
        ▼
ImportProjectDTO            ← sent to POST /Importing/ImportProject/
```

---

## Files Involved

| File | Role |
|---|---|
| `dialogs/ImportProjectsDialog.tsx` | Upload UI, drag-and-drop, 7-tab preview |
| `utils/parseImportFile.ts` | Reads the XLSM, returns `ImportedProject[]` |
| `utils/transformImportedProjects.ts` | Converts raw Excel data → `ImportProjectDTO` |
| `Service.ts` → `importProjects()` | POST to `/Importing/ImportProject/` |
| `Views/ProgramDetail.tsx` → `handleImportProjectsSubmit()` | Orchestrates parse → transform → API call |
| `../Project/Model.d.ts` → `#region Import` | All TypeScript interfaces |

---

## XLSM Template Sheets

The template (`Importation_1.xlsm`) must contain these exact sheet names:

| Sheet | Maps To |
|---|---|
| `PROJECT DETAILS` | `projectDetails[]` |
| `FUNDING PROFILE` | `fundingProfile[]` |
| `COMPONENT DETAILS` | `componentCosts[]` + `componentCostPerYear[]` |
| `MAJOR ITEMS OF WORK` | `majorItemOfWorks[]` + `majorItemLocations[]` |

---

## Step 1 — Parser (`parseImportFile.ts`)

Reads each sheet with SheetJS (`XLSX.utils.sheet_to_json`) and groups all rows by `Project ID`.

**Key behaviours:**
- **Province**, City, LD, Region — all passed as **plain names** — the backend resolves them to IDs.
- **Dates** (Excel serials) are converted to `MM/DD/YYYY` strings via `XLSX.SSF.parse_date_code`.
- Empty rows are skipped.
- Rows with a missing `Project ID` are recorded as parse errors (non-fatal).

**Output type:**
```ts
interface ImportedProject {
  ProjectDetails:   ImportedProjectDetails;
  FundingProfiles:  ImportedFundingProfile[];
  ComponentCosts:   ImportedComponentCost[];
  MajorItemsOfWork: ImportedMajorItem[];
}
```

---

## Step 2 — Transformer (`transformImportedProjects.ts`)

Converts `ImportedProject[]` into a single flat `ImportProjectDTO`.

**Signature:**
```ts
transformImportedProjects(
  imported:  ImportedProject[],
  programId: string,
  stageName: string,
): ImportProjectDTO
```

### Sections Built

#### `programDetails`
One entry for the whole batch:
```json
{ "programId": "PR20260200103", "stageName": "GAA" }
```

#### `projectDetails`
One entry per project. All enum/lookup fields (Category, Thrust, Origin, etc.) are sent as **raw string names** — the backend resolves them to numeric IDs.
- `province` → raw name from Excel (backend resolves to code)
- `description` → always `null` (not in XLSM; backend sets it)

#### `fundingProfile`
One entry per funding row. `percentage` defaults to `0` (not in XLSM; backend calculates).

#### `componentCosts` + `componentCostPerYear`
- **Grouping rule:** same `ProjectId + ComponentId` → one `ComponentCost` record
- `costId` = `"{ProjectId}-{ComponentId}"`
- `total` = sum of all row amounts in the group
- Each Excel row → one `ComponentCostPerYear` (linked via `componentCostId`)

#### `majorItemOfWorks` + `majorItemLocations`
- InfraType and WorkType come from `COMPONENT DETAILS` (cross-referenced by `ComponentId + ActivityYear`), since `MAJOR ITEMS OF WORK` does not have those columns.
- **Grouping rule:** same `ProjectId + ComponentId + InfraType + WorkType + Year` → one `MajorItemOfWork`
- `referenceId` is auto-generated: `"{ProjectId}-{ComponentId}-{n}"`
- `workTypeId` and `targetUnitId` = raw string names (backend resolves to IDs)
- Chainage/coordinate fields are coerced to `string | null`

---

## Step 3 — API Payload (`ImportProjectDTO`)

```ts
interface ImportProjectDTO {
  programDetails:       DtoProgramDetails;        // single object
  projectDetails:       DtoProjectDetails[];
  fundingProfile:       DtoFundingProfile[];
  componentCosts:       DtoComponentCost[];
  componentCostPerYear: DtoComponentCostPerYear[];
  majorItemOfWorks:     DtoMajorItemOfWork[];
  majorItemLocations:   DtoMajorItemLocation[];
}
```

**Endpoint:** `POST /Importing/ImportProject/`

**Service function:**
```ts
// Service.ts
export const importProjects = async (payload: ImportProjectDTO) => { ... }
```

---

## Example Payload Shape

```json
{
  "programDetails": {
    "programId": "PR20260200103",
    "stageName": "GAA"
  },
  "projectDetails": [
    {
      "projectId": "PR1001",
      "province": "PH140100000",
      "city": "Baguio City",
      "region": "CAR",
      "category": "MFO 2 - Infrastructure",
      "tier": "Tier II",
      "implementationMode": "By Administration",
      "feasibility": "With FS",
      "feasibilityDate": "01/15/2025",
      "rowAvailable": "Yes",
      "description": null
    }
  ],
  "fundingProfile": [
    {
      "projectId": "PR1001",
      "source": "GAA",
      "agreement": "Regular",
      "percentage": 0,
      "amount": 5000000
    }
  ],
  "componentCosts": [
    {
      "projectId": "PR1001",
      "costId": "PR1001-CW1",
      "componentType": "Civil Works",
      "componentId": "CW1",
      "description": "Road Widening",
      "total": 5000000
    }
  ],
  "componentCostPerYear": [
    {
      "componentCostId": "PR1001-CW1",
      "amount": 5000000,
      "year": 2026,
      "startDate": "01/01/2026",
      "endDate": "12/31/2026"
    }
  ],
  "majorItemOfWorks": [
    {
      "projectId": "PR1001",
      "referenceId": "PR1001-CW1-1",
      "componentId": "CW1",
      "yearOfWork": 2026,
      "infraType": "Road",
      "workTypeId": "Construction of Asphalt Road",
      "targetUnitId": "Lane-km",
      "targetUnit": "Lane-km"
    }
  ],
  "majorItemLocations": [
    {
      "parentId": "PR1001-CW1-1",
      "infraId": "SN-0001",
      "detailedScope": "Widening of Road",
      "targetUnitId": "Lane-km",
      "targetUnit": "Lane-km",
      "physicalTarget": 2.5,
      "length": 2.5,
      "startChainage": "0+000",
      "endChainage": "2+500",
      "startX": null,
      "startY": null,
      "endX": null,
      "endY": null,
      "startStationLimit": null,
      "endStationLimit": null
    }
  ]
}
```

---

## Dialog — 7 Preview Tabs

| Tab | Shows |
|---|---|
| **Summary** | Counts per section |
| **Projects** | `projectDetails` rows |
| **Funding** | `fundingProfile` rows |
| **Components** | `componentCosts` (grouped) |
| **Cost / Year** | `componentCostPerYear` rows |
| **Major Items** | `majorItemOfWorks` rows |
| **Locations** | `majorItemLocations` rows |
| **Errors** | Parse errors (non-fatal row skips) |

---

## Wiring Up the API Call

Currently the submit handler **logs the payload** only. To enable the actual API call:

**In `ProgramDetail.tsx`:**

1. Uncomment the import:
```ts
import { importProjects } from '../Service';
```

2. Replace the TODO comment with:
```ts
await importProjects(transformed);
```

---

## TypeScript Interfaces (`Model.d.ts` — `#region Import`)

All import-related interfaces are isolated in the `#region Import` section and **do not touch the main app interfaces** (`ProjectDetails`, `MajorItemOfWork`, etc.).

| Interface | Purpose |
|---|---|
| `DtoProgramDetails` | `{ programId, stageName }` |
| `DtoProjectDetails` | Flat project row for backend |
| `DtoFundingProfile` | Funding row |
| `DtoComponentCost` | Component cost (grouped) |
| `DtoComponentCostPerYear` | Cost per year row |
| `DtoMajorItemOfWork` | Major work item (grouped) |
| `DtoMajorItemLocation` | Location row linked to a work item |
| `ImportProjectDTO` | Full payload (all sections above) |
| `ImportedProject` | Raw Excel data (parser output) |
| `ImportParseResult` | Parser return value (projects + errors) |
| `ImportProjectPayload` | `= ImportProjectDTO` (alias, deprecated) |
