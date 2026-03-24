# Import Lump Sum Project Guide

Bulk-import a single lump sum project's data from an **XLSM template file** directly from the
Project Form page. This mirrors the program-level import flow but is scoped to a specific
project (any project whose ID ends with `LS`).

---

## Overview

```
User clicks "Import Lump Sum Project" button (edit mode, LS project only)
        │
        ▼
ImportLumpsumDialog opens
        │
        ▼
User uploads .xlsm file (drag & drop or file picker)
        │
        ▼
parseImportFile()          ← reads 4 Excel sheets, groups rows by ProjectId
(reused from Program/utils)
        │
        ▼
ImportedProject[]          ← raw Excel data (string names for lookups)
        │
        ▼
ImportLumpsumDialog shows 7-tab preview (same as Program import)
        │
        ▼
User clicks "Import"
        │
        ▼
handleImportLumpsumSubmit() in ProjectForm.tsx
        │
        ▼
transformImportedProjects() ← converts to flat backend DTO shape
(reused from Program/utils)
        │
        ▼
importProject()            ← POST /Importing/ImportProject/
(Project/Service.ts)
```

---

## Files Involved

| File | Role |
|---|---|
| `dialogs/ImportLumpsumDialog.tsx` | Upload UI, drag-and-drop, 7-tab preview |
| `components/ProjectForm.tsx` → `handleImportLumpsumSubmit()` | Orchestrates parse → transform → API call |
| `Service.ts` → `importProject()` | POST to `/Importing/ImportProject/` |
| `../../Program/utils/parseImportFile.ts` | Reads the XLSM, returns `ImportedProject[]` (shared) |
| `../../Program/utils/transformImportedProjects.ts` | Converts raw Excel data → `ImportProjectDTO` (shared) |
| `Model.d.ts` → `#region Import` | All TypeScript interfaces (shared with Program module) |

---

## When the Button Appears

The **"Import Lump Sum Project"** button is rendered in `ProjectForm.tsx` only when **all** of:

1. `mode === 'edit'`
2. `initialData?.ProjectDetails?.ProjectId?.toUpperCase().endsWith('LS')` is `true`

---

## XLSM Template Sheets

The template must contain these exact sheet names (same as the program-level import template):

| Sheet | Maps To |
|---|---|
| `PROJECT DETAILS` | `projectDetails[]` |
| `FUNDING PROFILE` | `fundingProfile[]` |
| `COMPONENT DETAILS` | `componentCosts[]` + `componentCostPerYear[]` |
| `MAJOR ITEMS OF WORK` | `majorItemOfWorks[]` + `majorItemLocations[]` |

Additionally, a `_ImportStatus` sheet is **required** and must contain:

| Cell | Expected Value |
|---|---|
| `B1` | `VALIDATED` |
| `B2` | Non-empty (saved timestamp) |
| `B3` | Non-empty (validated timestamp) |
| `B4` | `MYPS-IMPORT-2026` |

---

## Step 1 — Parser (`parseImportFile.ts`)

Reused directly from `Program/utils/parseImportFile.ts`. Reads each sheet with SheetJS
(`XLSX.utils.sheet_to_json`) and groups all rows by `Project ID`.

**Key behaviours:**
- **Province**, City, LD, Region — all passed as **plain names** — the backend resolves them to IDs.
- **Dates** (Excel serials) are converted to `MM/DD/YYYY` strings.
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

Reused directly from `Program/utils/transformImportedProjects.ts`.

**Signature:**
```ts
transformImportedProjects(
  imported:  ImportedProject[],
  programId: string,
  stageName: string,
): ImportProjectDTO
```

`programId` and `stageName` are taken from `initialData.ProgramDetails` in `ProjectForm`.

### Sections Built

#### `programDetails`
One entry for the whole batch:
```json
{ "programId": "PR20260200103", "stageName": "GAA" }
```

#### `projectDetails`
One entry per project row in the XLSM. All enum/lookup fields are sent as **raw string names** —
the backend resolves them to numeric IDs.

#### `fundingProfile`
One row per FUNDING PROFILE sheet entry. `percentage` defaults to `0`.

#### `componentCosts` + `componentCostPerYear`
- **Grouping rule:** same `ProjectId + ComponentId` → one `ComponentCost` record.
- `costId` = `"{ProjectId}-{ComponentId}"`
- `total` = sum of all row amounts in the group.
- Each Excel row → one `ComponentCostPerYear`.

#### `majorItemOfWorks` + `majorItemLocations`
- InfraType / WorkType cross-referenced from `COMPONENT DETAILS` (same `ComponentId + Year`).
- **Grouping rule:** same `ProjectId + ComponentId + InfraType + WorkType + Year` → one work item.
- `referenceId` auto-generated: `"{ProjectId}-{ComponentId}-{n}"`

---

## Step 3 — API Call (`importProject`)

**Endpoint:** `POST /Importing/ImportProject/`

```ts
// Project/Service.ts
export const importProject = async (payload: ImportProjectDTO) => {
    const response = await httpClient.post(`/Importing/ImportProject/`, payload, {
        preloaderMessage: 'Importing lump sum project...'
    });
    return response;
};
```

This uses the same endpoint as the program-level import (`Program/Service.ts → importProjects`).

---

## Dialog — 7 Preview Tabs

| Tab | Shows |
|---|---|
| **Summary** | Counts per section |
| **Projects** | `projectDetails` rows |
| **Funding** | `fundingProfile` rows |
| **Components** | `componentCosts` (grouped by ComponentId) |
| **Cost / Year** | `componentCostPerYear` rows |
| **Major Items** | `majorItemOfWorks` rows |
| **Locations** | `majorItemLocations` rows |
| **Errors** | Parse errors (non-fatal row skips) |

If the file has parse errors but still contains valid project rows, a warning banner is shown and
the user can still proceed with the import.

---

## ProjectForm Wiring

### State
```tsx
const [isImportLumpsumOpen, setIsImportLumpsumOpen] = useState<boolean>(false);
```

### Button (conditional — LS projects in edit mode only)
```tsx
{mode === 'edit' && initialData?.ProjectDetails?.ProjectId?.toUpperCase().endsWith('LS') && (
  <Button color="blue" onClick={() => setIsImportLumpsumOpen(true)}>
    <ArrowUpTrayIcon className="h-4 w-4" />
    Import Lump Sum Project
  </Button>
)}
```

### Submit handler
```tsx
const handleImportLumpsumSubmit = async (projects: ImportedProject[]) => {
  const programId = initialData?.ProgramDetails?.ProgramId ?? '';
  const stageName = initialData?.ProgramDetails?.StageName ?? '';
  const transformed = transformImportedProjects(projects, programId, stageName);
  await importProject(transformed);
  // navigate refreshes the project page on success
};
```

### Dialog render
```tsx
<ImportLumpsumDialog
  isOpen={isImportLumpsumOpen}
  onClose={() => setIsImportLumpsumOpen(false)}
  onSubmit={handleImportLumpsumSubmit}
  projectId={initialData?.ProjectDetails?.ProjectId ?? ''}
  programId={initialData?.ProgramDetails?.ProgramId ?? ''}
  stageName={initialData?.ProgramDetails?.StageName ?? ''}
/>
```

---

## Differences from the Program-Level Import

| Aspect | Program Import | Lump Sum (Project) Import |
|---|---|---|
| Entry point | `ProgramDetail.tsx` | `ProjectForm.tsx` |
| Condition | Program action menu | LS project, edit mode only |
| Dialog | `ImportProjectsDialog.tsx` | `ImportLumpsumDialog.tsx` |
| Service fn | `Program/Service.ts → importProjects()` | `Project/Service.ts → importProject()` |
| Context banner | Shows program name | Shows project ID + program/stage |
| Post-import | Refreshes program detail | Navigates back to project detail |
| Parsers/transformers | Shared | Shared (same utilities) |

---

## TypeScript Interfaces

All import-related interfaces live in `Project/Model.d.ts` under `#region Import`.
They are **shared** between the Program and Project import flows.

| Interface | Purpose |
|---|---|
| `DtoProgramDetails` | `{ programId, stageName }` |
| `DtoProjectDetails` | Flat project row for backend |
| `DtoFundingProfile` | Funding row |
| `DtoComponentCost` | Component cost (grouped) |
| `DtoComponentCostPerYear` | Cost per year row |
| `DtoMajorItemOfWork` | Major work item (grouped) |
| `DtoMajorItemLocation` | Location row linked to a work item |
| `ImportProjectDTO` | Full payload (all sections) |
| `ImportedProject` | Raw Excel data (parser output) |
| `ImportParseResult` | Parser return value (projects + errors) |
