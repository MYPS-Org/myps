# Report Generation Documentation

> ⚠️ **KEEP THIS FILE UP TO DATE**
> Every time a report class, shared utility, or controller endpoint is added, modified, or removed,
> update this document **before merging the PR**.  Treat it as a living specification.

> ✅ **BUILD AFTER EVERY CHANGE**
> After making any change to a report class, shared utility, or controller endpoint, run
> `dotnet build` on the affected project (`ReportGeneration`, `WebAPI`) or the full solution
> to confirm the code still compiles. **Do not commit or push if the build fails.** This catches
> API mismatches (for example, calling a method on the wrong QuestPDF descriptor type) before they
> reach review.
>
> Quick commands:
> ```
> dotnet build ReportGeneration\ReportGeneration.csproj
> dotnet build WebAPI\WebAPI.csproj
> dotnet build myps_backend.sln
> ```

---

## Table of Contents

1. [Overview](#overview)
2. [Shared Utilities — `GeneratePDF`](#shared-utilities--generatepdf)
3. [Report Classes](#report-classes)
   - [AIP — Annual Infrastructure Program](#aip--annual-infrastructure-program)
   - [AIP02 — AIP Simplified](#aip02--aip-simplified)
   - [AIPOfficial — AIP Official (no description rows)](#aipofficial--aip-official-no-description-rows)
   - [RBP Components — Regional Budget Proposal Components](#rbp-components--regional-budget-proposal-components)
   - [RBP Summary — Regional Budget Proposal Summary](#rbp-summary--regional-budget-proposal-summary)
   - [RBP Tier — Regional Budget Proposal by Tier](#rbp-tier--regional-budget-proposal-by-tier)
   - [RDIP — Regional Development Investment Plan](#rdip--regional-development-investment-plan)
4. [Controller Endpoints](#controller-endpoints)
5. [Excel Export — Raw Projects](#excel-export--raw-projects)
6. [Dependencies](#dependencies)

---

## Overview

All PDF reports are generated using **QuestPDF** (Community license).
Each report is a static class inside the `ReportGeneration` project with a single public entry point:

```csharp
public static byte[] GenerateReport(<DataType> data, ...optional params...);
```

The byte array is returned directly to the API as `application/pdf`.

```
ReportGeneration\
├── GeneratePDF.cs          ← Shared utilities (logo cache, page factory, DPWH header, footer)
├── AIP.cs                  ← Annual Infrastructure Program (8-col, A4 Portrait)
├── AIP02.cs                ← AIP Simplified (4-col, A4 Portrait)
├── AIPOfficial.cs          ← AIP Official, no description row (8-col, A4 Portrait)
├── RBPComponentsReport.cs  ← RBP Components detail (9-col, A4 Landscape)
├── GenerateRBPReport.cs    ← RBP Summary pivot (11-col, A4 Landscape) ← DPWH logo header
├── GenerateRBPTier.cs      ← RBP by Tier pivot (11-col, A4 Landscape)
└── GenerateRDIPReport.cs   ← RDIP (14-col, A4 Landscape, dynamic year columns)
```

---

## Shared Utilities — `GeneratePDF`

**File:** `ReportGeneration\GeneratePDF.cs`  
**Class:** `public static class GeneratePDF`  
**Font constant:** `GeneratePDF.FontFamily = "Tahoma"`

### `GetLogo() → byte[]`

Loads `Resources/Images/ReportLogo.png` from `AppContext.BaseDirectory` and caches it in memory (thread-safe double-checked lock).  
Only used by **`GenerateRBPReport.cs`** (`BuildDPWHHeader`). All other reports use plain centered text.

### `GenerateReport(Action<PageDescriptor> configurePage) → byte[]`

Sets `LicenseType.Community` and creates a QuestPDF `Document` with a single page configured by the action.  
All report classes delegate PDF creation to this method.

### `BuildDPWHHeader(col, logo, title, subtitle?, regionName?)`

Renders the standard DPWH logo + institution header block.

| Parameter    | Type               | Description                                     |
|--------------|--------------------|-------------------------------------------------|
| `col`        | `ColumnDescriptor` | QuestPDF column to append header items to       |
| `logo`       | `byte[]`           | Logo bytes from `GetLogo()`                     |
| `title`      | `string`           | Bold centered title shown below the logo row    |
| `subtitle`   | `string?`          | Optional smaller subtitle line                  |
| `regionName` | `string?`          | Optional region name line (bold, centered)      |

> ⚠️ Only **`GenerateRBPReport.cs`** (`GenerateRBP`) currently uses this method.

### `BuildFooter(page, fontSize = 7)`

Renders a two-column footer:
- **Left:** `MYPS: MM/dd/yyyy hh:mm:ss tt` (PDF generation timestamp)
- **Right:** `Page X of Y`

Used by all six report classes.

---

## Report Classes

### AIP — Annual Infrastructure Program

| Property     | Value                                                                      |
|--------------|----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\AIP.cs`                                                  |
| **Class**    | `ReportGeneration.AIP`                                                     |
| **Method**   | `GenerateReport(List<GenerateAIP01>, List<GenerateAIPComponents>, int year = 0, string stageName = "")` |
| **Page**     | A4 Portrait — `MarginVertical(25)` + `MarginHorizontal(15)` (tight L/R padding, more usable content width) |
| **Header**   | Plain centered text — no DPWH logo                                         |
| **Title**    | `FY {year} ANNUAL INFRASTRUCTURE PROGRAM` (dynamic; "FY " prefix omitted when year = 0) |
| **Subtitle** | `Based on {stageName}` (dynamic; defaults to `Based on General Appropriations Act`) |
| **Footer**   | `BuildFooter`                                                              |

**Parameters:**

| Parameter    | Description                                                                          |
|--------------|--------------------------------------------------------------------------------------|
| `projects`   | Flat list from `pGenerateAIP01`                                                      |
| `components` | Component rows from `pGenerateAIPComponents`                                         |
| `year`       | Fiscal year shown in the title (e.g. `2026`). Pass `0` to omit the "FY X" prefix    |
| `stageName`  | Full stage label (e.g. `"General Appropriations Act"`) from `GetStageFullName()` in the controller |

**Table Columns (8 relative columns):**

| Col | Header                             |
|-----|------------------------------------|
| 0   | UACS / Sub Program / Component ID  |
| 1   | Project Component Description      |
| 2   | Type of Work                       |
| 3   | Target Unit                        |
| 4   | Physical Target — #                |
| 5   | Physical Target — Unit             |
| 6   | Amount (PHP)                       |
| 7   | Operating Unit / Implementing Office |

**Header / body styling:**

| Element                | Setting |
|------------------------|---------|
| Header underline       | `PaddingTop(4).PaddingBottom(4).LineHorizontal(0.5f)` — 4 pt gap above and below the separator line |
| Thrust label text      | `LineHeight(1.5f)` on the span — extra vertical spacing between wrapped lines of long Thrust strings |
| Project Row 1          | `PaddingLeft(20)` — `{seq}.  ` (bold) + `ProjectId` |
| Project Row 2 (desc.)  | `PaddingLeft(30)` — aligned under the `ProjectId` text, not under the `{seq}.` prefix |

**Grouping hierarchy (table body):**

```
Region          (bold, full-width, top border)
  DEO           (underline, indent 8)
    District    (underline, indent 8)
      Category  (bold, indent 18)
        Thrust  (underline, indent 26, subtotal in col 6, span LineHeight 1.5f)
          Project (2 rows)
            Row 1: seq. [bold] + ProjectId · UACS · total amount   [PaddingLeft 20]
            Row 2: Description [bold]                              [PaddingLeft 30 — aligns under ProjectId]
          Component row (indent 30)
            [EAO components use EaoRow — only ID + amount + IO shown]
            [ROW components: Type of Work overridden to "ROW Acquisition"]
```

**Data sources:** `pGenerateAIP01`, `pGenerateAIPComponents`

---

### AIP02 — AIP Simplified

| Property     | Value                                                                      |
|--------------|----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\AIP02.cs`                                                |
| **Class**    | `ReportGeneration.AIP02`                                                   |
| **Method**   | `GenerateReport(List<GenerateAIP01>, List<GenerateAIPComponents>)`         |
| **Page**     | A4 Portrait — `MarginVertical(25)` + `MarginHorizontal(15)`                |
| **Header**   | Plain centered text — no DPWH logo                                         |
| **Title**    | `FY 2025 ANNUAL INFRASTRUCTURE PROGRAM` (**hardcoded** — update if needed)|
| **Subtitle** | `Based on General Appropriations Act` (**hardcoded**)                      |
| **Footer**   | `BuildFooter`                                                              |

> ⚠️ Unlike **AIP**, the title and stage label are **not dynamic** in AIP02. Update the string literals in `AIP02.cs` if the fiscal year or stage changes.

**Table Columns (4 relative columns):**

| Col | Header                              |
|-----|-------------------------------------|
| 0   | UACS / Sub Program                  |
| 1   | Project Description                 |
| 2   | Amount (PHP)                        |
| 3   | Operating Unit / Implementing Office |

**Header / body styling:**

| Element                | Setting |
|------------------------|---------|
| Header underline       | `PaddingTop(4).PaddingBottom(4).LineHorizontal(0.5f)` |
| Thrust label text      | `LineHeight(1.5f)` on the span |
| Project Row 1          | `PaddingLeft(4)` — `{seq}.  ` (bold) + `ProjectId` |
| Project Row 2 (desc.)  | `PaddingLeft(14)` — aligned under the `ProjectId` text |

**Grouping hierarchy:**

```
Region          (bold, top border)
  District      (underline, indent 6)
    DEO         (underline, indent 6)
      Category  (bold, indent 12)
        Thrust  (underline, indent 18, subtotal in col 2, span LineHeight 1.5f)
          Project (2 rows)
            Row 1: seq. [bold] + ProjectId · UACS · total · OU/IO   [PaddingLeft 4]
            Row 2: Description (cols 0-1)                           [PaddingLeft 14 — aligns under ProjectId]
```

> Note: AIP02 groups **District before DEO** (opposite of AIP which groups **DEO before District**).

**Data sources:** `pGenerateAIP01`, `pGenerateAIPComponents`

---

### AIPOfficial — AIP Official (no description rows)

| Property     | Value                                                                      |
|--------------|----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\AIPOfficial.cs`                                          |
| **Class**    | `ReportGeneration.AIPOfficial`                                             |
| **Method**   | `GenerateReport(List<GenerateAIP01>, List<GenerateAIPComponents>, int year = 0, string stageName = "")` |
| **Page**     | A4 Portrait — `MarginVertical(25)` + `MarginHorizontal(15)`                |
| **Header**   | Plain centered text — no DPWH logo                                         |
| **Title**    | `FY {year} ANNUAL INFRASTRUCTURE PROGRAM` (dynamic; "FY " prefix omitted when year = 0) |
| **Subtitle** | `Based on {stageName}` (dynamic; defaults to `Based on General Appropriations Act`) |
| **Footer**   | `BuildFooter`                                                              |

> 🔁 **Identical to AIP** except: each project renders only **Row 1** (`seq. + ProjectId · UACS · total amount`). The bold description row (Row 2 in `AIP.cs`) is **intentionally omitted** for the "Official" variant.

**Parameters:**

| Parameter    | Description                                                                          |
|--------------|--------------------------------------------------------------------------------------|
| `projects`   | Flat list from `pGenerateAIP01`                                                      |
| `components` | Component rows from `pGenerateAIPComponents`                                         |
| `year`       | Fiscal year shown in the title (e.g. `2026`). Pass `0` to omit the "FY X" prefix    |
| `stageName`  | Full stage label (e.g. `"General Appropriations Act"`) from `GetStageFullName()` in the controller |

**Table Columns (8 relative columns — same as AIP):**

| Col | Header                             |
|-----|------------------------------------|
| 0   | UACS / Sub Program / Component ID  |
| 1   | Project Component Description      |
| 2   | Type of Work                       |
| 3   | Target Unit                        |
| 4   | Physical Target — #                |
| 5   | Physical Target — Unit             |
| 6   | Amount (PHP)                       |
| 7   | Operating Unit / Implementing Office |

**Header / body styling:**

| Element                | Setting |
|------------------------|---------|
| Header underline       | `PaddingTop(4).PaddingBottom(4).LineHorizontal(0.5f)` |
| Thrust label text      | `LineHeight(1.5f)` on the span |
| Project row (single)   | `PaddingLeft(20)` — `{seq}.  ` (bold) + `ProjectId`. **No description row.** |

**Grouping hierarchy:**

```
Region          (bold, full-width, top border)
  DEO           (underline, indent 8)
    District    (underline, indent 8)
      Category  (bold, indent 18)
        Thrust  (bold + underline, indent 26, subtotal in col 6, span LineHeight 1.5f)
          Project (1 row — Row 1 only)
            seq. [bold] + ProjectId · UACS · total amount   [PaddingLeft 20]
          Component row (indent 30)
```

**Data sources:** `pGenerateAIP01`, `pGenerateAIPComponents`

---

### RBP Components — Regional Budget Proposal Components

| Property     | Value                                                                      |
|--------------|----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\RBPComponentsReport.cs`                                  |
| **Class**    | `ReportGeneration.RBPComponents`                                           |
| **Method**   | `GenerateReport(List<GenerateRBPComponents>)`                              |
| **Page**     | A4 Landscape, margin 25                                                    |
| **Header**   | Plain centered text — no DPWH logo                                         |
| **Title**    | `FY 2026 REGIONAL BUDGET PROPOSAL` (**hardcoded**)                         |
| **Footer**   | `BuildFooter`                                                              |

**Table Columns (9 relative columns):**

| Col | Header                   |
|-----|--------------------------|
| 0   | DEO/LD                   |
| 1   | Programs/Activities/Projects |
| 2   | Type of Work             |
| 3   | Project Location         |
| 4   | Details of Work          |
| 5   | Length of Work (m)       |
| 6   | Physical Target          |
| 7   | Target Unit              |
| 8   | Project Cost (P'000)     |

**Grouping hierarchy:**

```
Region          (bold)
  Tier          (indent 8)
    DEO         (indent 16)
      District  (indent 24)
        Category (label in col 0-7, cost in col 8)
          Thrust  (full-width label, indent 40)
            Project (seq + description, cost in col 8)
              Component — 2 rows per component:
                Row 1: ComponentId · ScopeDescription · Length · PhysicalTarget · TargetUnit · Cost
                Row 2: DetailsOfWork · Length · PhysicalTarget · ScopeMeasure
```

**Data source:** `pGenerateRBPComponents`

---

### RBP Summary — Regional Budget Proposal Summary

| Property     | Value                                                                      |
|--------------|----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\GenerateRBPReport.cs`                                    |
| **Class**    | `ReportGeneration.GenerateRBP`                                             |
| **Method**   | `GenerateReport(List<GenerateRBP>)`                                        |
| **Page**     | A4 Landscape, margin 25                                                    |
| **Header**   | ✅ **DPWH logo header** via `BuildDPWHHeader` — **do not remove**          |
| **Footer**   | `BuildFooter`                                                              |

**Table Columns (11 relative columns):**

| Col | Content                                   |
|-----|-------------------------------------------|
| 0   | DEO / Legislative District label          |
| 1-2 | OO-1 (No. of Proj. · Amount P'000)        |
| 3-4 | OO-2 (No. of Proj. · Amount P'000)        |
| 5-6 | CSSP (No. of Proj. · Amount P'000)        |
| 7-8 | LP (No. of Proj. · Amount P'000)          |
| 9-10| TOTAL (No. of Proj. · Amount P'000)       |

**Grouping hierarchy:**

```
Region          (bold, dash for zero)
  Tier I/II/III (indent 4, dash for zero)
    DEO         (indent 10)
      District  (indent 18)
```

**Amount format:** Values divided by 1,000 displayed as N2 (`FormatAmtP`). Zero cells show `""`.  
**Signature block:** Prepared By / Reviewed By / Approved By (Planning Engineer / Division Chief / Regional Director).

**Data source:** `pGenerateRBP`

---

### RBP Tier — Regional Budget Proposal by Tier

| Property     | Value                                                                      |
|--------------|----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\GenerateRBPTier.cs`                                      |
| **Class**    | `ReportGeneration.GenerateRBPTier`                                         |
| **Method**   | `GenerateReport(List<GenerateRBP>)`                                        |
| **Page**     | A4 Landscape, margin 25                                                    |
| **Header**   | Plain centered title + region name — no DPWH logo                          |
| **Title**    | `SUMMARY OF FY 2026 BUDGET PROPOSAL` (**hardcoded**)                       |
| **Footer**   | `BuildFooter`                                                              |

Same 11-column pivot layout as **RBP Summary**, but:
- Tier rows are **bold** with **top borders** (visually separate tiers).
- DEO rows are bold with top borders.
- District rows are indented with no top border.
- Zero cells display `""` (not dash).

**Grouping hierarchy:**

```
Region          (bold, top border)
  Tier I/II/III (bold, top border)
    DEO         (bold, top border, indent 4)
      District  (indent 10)
```

**Data source:** `pGenerateRBP`

---

### RDIP — Regional Development Investment Plan

| Property     | Value                                                                       |
|--------------|-----------------------------------------------------------------------------|
| **File**     | `ReportGeneration\GenerateRDIPReport.cs`                                    |
| **Class**    | `ReportGeneration.GenerateRDIP`                                             |
| **Method**   | `GenerateReport(List<GenerateRDIP>)`                                        |
| **Page**     | A4 Landscape, `Margin(25)`                                                  |
| **Header**   | Plain centered title + region + chapter/agency lines — no DPWH logo        |
| **Title**    | `FY {LowestYear}-{LowestYear+5} REGIONAL DEVELOPMENT INVESTMENT PLAN (RDIP)` — covers all six discrete year columns; "FY …" prefix omitted when `year = 0` |
| **Footer**   | `BuildFooter`                                                               |

**Column weights (14 relative columns):**

```csharp
const float W0=22, W1=7, W2=8, W3=5,    W4=5;
const float W5=8,  W6=7, W7=7, W8=7,    W9=7;
const float W10=7, W11=7, W12=6, W13=6;
```

| Col   | Content                          | Weight |
|-------|----------------------------------|--------|
| 0     | Program / Sub-Program / Projects | 22     |
| 1     | Province / Municipality          | 7      |
| 2     | Congressional District           | 8      |
| 3     | Start Year                       | 5 *(widened from 3.5 to fit 7pt "Implementation" header)* |
| 4     | End Year                         | 5 *(widened from 3.5 for same reason)* |
| 5     | TOTAL Cost                       | 8      |
| 6-11  | Year columns (dynamic, 6 years)  | 7 ea.  |
| 12    | Later Years                      | 6      |
| 13    | Remarks                          | 6 *(widened from 4 to fit 7pt "Remarks" header)* |

**Header layout — 2 rows with vertical-merged corners:**

```
┌─────────────────┬──────────────────────────────────────────────────────────┬─────────┐
│                 │   Spatial Coverage  │ Impl. Period │ Investment Cost     │         │
│   Program /     ├──────────┬──────────┼──────┬───────┼──────┬──────┬──...──┤ Remarks │
│ Sub-Program /   │ Province │ Cong.    │ Start│ End   │TOTAL │1st Yr│ ...   │         │
│   Projects      │/Municip. │ District │ Year │ Year  │ Cost │(2017)│ ...   │         │
└─────────────────┴──────────┴──────────┴──────┴───────┴──────┴──────┴──...──┴─────────┘
```

Implemented as an outer `Row(W0_cell, middle_Column, W13_cell)`:
- **W0** (`Program/Sub-Program/Projects`) and **W13** (`Remarks`) are single tall cells, `AlignCenter().AlignMiddle()`, spanning both header rows.
- The **middle** column nests two `Row`s with a `BorderBottom(0.5f)` between them to draw the horizontal divider between the group labels (Spatial Coverage / Implementation Period / Investment Cost) and the sub-labels.

**Border thickness:**

| Where                                       | Thickness | Color |
|---------------------------------------------|-----------|-------|
| Table outline (header outer + body outer)   | `0.5f`    | Black |
| Header row dividers + column dividers       | `0.5f`    | Black |
| **Body row top borders** (between data rows)| `0.25f`   | Black |
| **Body cell right borders** (column dividers in body) | `0.25f` | Black |
| `AmountCell` right border (when `borderRight: true`)  | `0.25f` | Black |

> Rationale: header borders stay strong (0.5pt) so the column structure reads cleanly; body grid is hairline (0.25pt) so it doesn't visually compete with the data.

**Font sizes:**

| Element                            | Size | Bold |
|------------------------------------|------|------|
| Header cells (all)                 | 7 pt | yes  |
| Top-level summary (Category)       | 7 pt | yes  |
| Mid-level summary (Program / Sub-Program) | 6.5 pt | yes |
| Activity summary                   | 6 pt | yes  |
| Project rows                       | 6 pt | no   |
| Default text style                 | 6 pt | no   |

**Dynamic year columns:** Year labels in the lower middle row are computed from `data.Min(r => r.StartYear)` as the base year. The six year columns show `(LowestYear)` … `(LowestYear+5)`; the Later Years column shows `(LowestYear+6+)`.

**Grouping hierarchy:**

```
Category        (bold, font 7)
  Program       (indent 6, font 6.5)
    Sub-Program (indent 12, font 6.5 — skipped when empty)
      Activity  (indent 18, font 6 — skipped when empty)
        Project (indent 24, seq. Description + all location/year columns)
```

**Data source:** `pGenerateRDIP`

---

## Controller Endpoints

**File:** `WebAPI\Controllers\Reports\ReportingController.cs`  
**Route prefix:** `api/Reporting`  
**Helper:** `GetStageFullName(stageName?)` — maps stage codes to full display names:

| Stage Code       | Display Name                     |
|------------------|----------------------------------|
| `BP`             | Budget Proposal                  |
| `NEP`, `NEP-E`   | National Expenditure Program     |
| `HGAB`, `HGAB-I` | House General Appropriations Bill |
| `GAA`, `GAA-R`   | General Appropriations Act       |
| `TF`, `TF-R`     | Trust Fund                       |

**Endpoints:**

| Endpoint                      | Method | Returns             | Report Class / Notes                              |
|-------------------------------|--------|---------------------|---------------------------------------------------|
| `GetAIPReportDropdowns`       | POST   | JSON (dropdowns)    | Categories, Regions, OUs, DEOs, IOs, LDs          |
| `RequestReportAIP`            | POST   | `application/pdf`   | `AIP.GenerateReport` — passes `year` + `stageName` dynamically |
| `RequestReportAIP02`          | POST   | `application/pdf`   | `AIP02.GenerateReport`                            |
| `RequestReportAIPOfficial`    | POST   | `application/pdf`   | `AIPOfficial.GenerateReport` — passes `year` + `stageName` dynamically; no project description row |
| `GetRBPReportDropdowns`       | POST   | JSON (dropdowns)    | Regions filtered by session                       |
| `RequestReportRBPComponents`  | POST   | `application/pdf`   | `RBPComponents.GenerateReport`                    |
| `RequestReportRBP`            | POST   | `application/pdf`   | `GenerateRBP.GenerateReport`                      |
| `RequestReportRBPTier`        | POST   | `application/pdf`   | `GenerateRBPTier.GenerateReport`                  |
| `GetRDIPReportDropdowns`      | POST   | JSON (dropdowns)    | Regions filtered by session                       |
| `RequestReportRDIP`           | POST   | `application/pdf`   | `GenerateRDIP.GenerateReport`                     |
| `RequestRawProjects`          | POST   | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Excel export (EPPlus) |

> ⚠️ Update this table whenever an endpoint is added, renamed, or removed.

**Session filtering:** When `_Session.ApplyFilter` is true, queries are scoped to `_Session.RegCode`.  
**Request DTO common fields:** `ProgramId`, `StageName`, `RegionName` (optional on most), plus report-specific filters.

---

## Excel Export — Raw Projects

**Endpoint:** `POST api/Reporting/RequestRawProjects`  
**Library:** EPPlus (`LicenseContext.NonCommercial`)  
**Output format:** `.xlsx` named `{ProgramId}_{StageName}_Projects.xlsx`

**Stored procedures:** `pExportRawProjects`, `pExportRawProjectsMajorItems`

### Sheets

All sheets are **flat** (no outline grouping). Header row is styled blue (`#3F9FFF`).

#### `Project`
One row per project. 37 columns (A–AK):

| Cols   | Fields |
|--------|--------|
| A–C    | ProgramId · ReferenceId · ProjectId |
| D–G    | AlternateId · ExternalId · UACS (text format) · MYId |
| H      | MYCAApprovalDate |
| I–L    | Description · Category · Thrust · Origin |
| M–S    | City · Province · LegislativeDistrict · OperatingUnit · ImplementingOffice · DEO · Region |
| T–U    | Agency · IslandCode |
| V–W    | ImplementationMode · EmergencyMode |
| X–AA   | Feasibility · FeasibilityDate · DetailedDesign · DetailedDesignDate |
| AB–AC  | RowAvailable · RegionWide |
| AD–AE  | Tier · Rank |
| AF–AG  | IsRevised · RevisedNumber |
| AH–AI  | IsPublishable · IsPublished (Published To PCMA) |
| AJ–AK  | CreatedBy · CreatedDate |

#### `Funding Profile`
One row per funding source entry (only emitted when `fundingProfiles.Count > 0`).  
Columns: ProjectId · Source · Agreement · Amount · Percentage · CreatedBy · CreatedDate · UpdatedBy · UpdatedDate

#### `Component Cost Per Year`
**Flat** — one row per cost-year pair; parent component fields are repeated on each year row.  
Only emitted when `componentCosts.Count > 0`.  
Columns: Project ID · Description · Component Project ID · Component Type · Component ID · Total · Year · Amount · Start Date · End Date · Created By · Created Date · Updated By · Updated Date

#### `Major Work Item`
**Flat** — one row per location; parent work item fields repeated on each location row.  
Only emitted when `majorWorkItems.Count > 0`.  
Columns: Project ID · Component Project ID · Component ID · Year of Work · Work Type · Infra Type · Infra ID · Detailed Scope · Target Unit · Start X · Start Y · End X · End Y · Physical Target · Start Station Limit · End Station Limit · End Chainage · Start Chainage · Length · Created By · Created Date · Updated By · Updated Date

---

## Dependencies

| Library  | License          | Usage                    |
|----------|------------------|--------------------------|
| QuestPDF | Community        | PDF report generation    |
| EPPlus   | NonCommercial    | Excel (`.xlsx`) export   |

**Stored procedures used:**

| Procedure                     | Used By                                     |
|-------------------------------|---------------------------------------------|
| `pGenerateAIP01`              | AIP, AIP02                                  |
| `pGenerateAIPComponents`      | AIP, AIP02                                  |
| `pGenerateRBP`                | RBP Summary, RBP Tier                       |
| `pGenerateRBPComponents`      | RBP Components                              |
| `pGenerateRDIP`               | RDIP                                        |
| `pExportRawProjects`          | Excel Raw Projects export                   |
| `pExportRawProjectsMajorItems`| Excel Raw Projects export (Major Work Items)|

---

*Last updated: see Git history for change log.*
