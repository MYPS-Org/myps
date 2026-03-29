# AIP Report Dialog — Developer Guide

## Overview

The Report Dialog (`AIPReportDialog.tsx`) allows users to generate PDF reports for a given program. The set of available report types is determined by the program's current **stage ID**, and the filter fields shown adapt to the selected report type.

---

## Report Types & Stage Availability

| Value           | Label                               | Backend Endpoint                            | Payload       |
|-----------------|-------------------------------------|---------------------------------------------|---------------|
| `AIP`           | AIP (Annual Investment Plan)        | `POST /Reporting/RequestReportAIP`          | Full filters  |
| `AIP02`         | AIP-02 (Annual Investment Plan 02)  | `POST /Reporting/RequestReportAIP02`        | Full filters  |
| `RBP`           | RBP (Regional Budget Proposal)      | `POST /Reporting/RequestReportRBP`          | Region only   |
| `RBPComponents` | RBP Components                      | `POST /Reporting/RequestReportRBPComponents`| Region only   |
| `RBPTier`       | RBP Tier                            | `POST /Reporting/RequestReportRBPTier`      | Region only   |
| `RDIP`          | RDIP (Regional Dev. Investment Plan)| `POST /Reporting/RequestReportRDIP`         | Region only   |

### Availability by Stage ID

```
stageId <= 4 OR stageId >= 10  →  AIP, AIP02 are available
stageId === 4                  →  RBP, RBPComponents, RBPTier are additionally available
stageId >= 2                   →  RDIP is available
```

Example:
- Stage 2–3: RDIP only
- Stage 4: AIP + AIP02 + RBP + RBPComponents + RBPTier + RDIP (all)
- Stage 5–9: RDIP only
- Stage 10+: AIP + AIP02 + RDIP

If no report types are available for the current stage, the Report Type field shows an amber notice and the Generate button is disabled.

---

## Request Payload — `AIPReportParams`

| Field                    | Required | Type     | Notes                                               |
|--------------------------|----------|----------|-----------------------------------------------------|
| `ReportType`             | ✅        | `AIPReportType` | Determines endpoint and which fields are sent. Populated from stage-derived list |
| `ProgramId`              | ✅        | `string` | Pre-filled from the current program                 |
| `ProgramName`            | —        | `string` | Display only; not sent to the backend               |
| `StageName`              | Optional | `string` | **AIP/AIP02 only.** Pre-filled with program's current stage |
| `CategoryName`           | Optional | `string` | **AIP/AIP02 only.** Dropdown from `Categories`      |
| `RegionName`             | Optional | `string` | Available for all report types. Sent as-is          |
| `DistrictEngineeringOffice` | Optional | `string` | **AIP/AIP02 only.** Disabled until Region selected  |
| `ImplementingOfficeName` | Optional | `string` | **AIP/AIP02 only.** Disabled until Region selected  |
| `OperatingUnitName`      | Optional | `string` | **AIP/AIP02 only.** Disabled until IO selected      |
| `LegislativeDistrictName`| Optional | `string` | **AIP/AIP02 only.** Disabled until Region selected  |

For **RBP / RBPComponents / RBPTier / RDIP**, the service layer sends only `{ ProgramId, RegionName }` regardless of any other fields in `AIPReportParams`.
| `DistrictEngineeringOffice` | Optional | `string` | Cascaded off `RegionName`                        |
| `ImplementingOfficeName` | Optional | `string` | Cascaded off `RegionName`                           |
| `LegislativeDistrictName`| Optional | `string` | Dropdown from `LegislativeDistricts`                |

Empty optional fields are stripped (`undefined`) before the payload is sent.

---

## Dropdown Data — `/Reporting/GetAIPReportDropdowns`

Fetched once when the dialog first opens (cached in component state until unmount).

| Key                  | Source table / view                               | Interface                          | Key field for `<option>`  |
|----------------------|---------------------------------------------------|------------------------------------|---------------------------|
| `Categories`         | `tOptionProjectCategory`                          | `AIPDropdownCategory`              | `Id`                      |
| `Regions`            | `tOptionAdminAreaRegion`                          | `AIPDropdownRegion`                | `Id`                      |
| `OperatingUnits`     | `vAdminOperatingUnit`                             | `AIPDropdownOperatingUnit`         | `ParticipantId`           |
| `DEOs`               | `tOptionAdminAreaDistrictEngineeringOffice`        | `AIPDropdownDEO`                   | `Id`                      |
| `ImplementingOffices`| `vAdminImplementingOffice`                        | `AIPDropdownImplementingOffice`    | `ParticipantId`           |
| `LegislativeDistricts`| `tOptionAdminAreaCongressionalDistrict`           | `AIPDropdownLegislativeDistrict`   | `Id`                      |

### Interface shapes (aligned with Project model equivalents)

| AIP dropdown interface           | Equivalent in Project `Model.d.ts`      |
|----------------------------------|-----------------------------------------|
| `AIPDropdownCategory`            | `CategoryEnum`                          |
| `AIPDropdownRegion`              | _(no direct equivalent; custom)_        |
| `AIPDropdownOperatingUnit`       | `ProjectOperatingUnitEnum` (subset)     |
| `AIPDropdownDEO`                 | `RODEOEnum`                             |
| `AIPDropdownImplementingOffice`  | `ProjectImplementingOfficeEnum` (subset)|
| `AIPDropdownLegislativeDistrict` | `ProjectLegislativeDistrictEnum`        |

### Cascade Behaviour (step-by-step)

Region is the root of all regional filters. All regional fields are **disabled** until their parent is selected.

```
Region (optional)
  └── DEO        — disabled if no Region; filtered by RegionName
  └── IO         — disabled if no Region; filtered by RegionName
  │               (further filtered by DEO→IO logic when DEO is selected)
  │                 · R-type IOs in the same region as the DEO
  │                 · All UPMO IOs
  │                 · The DEO's own IO entry
  └── LD         — disabled if no Region; full list (no RegionName field on LD records)
       └── OU    — disabled if no IO selected; filtered by IO + DEO combination
                   · OrgType === 'CO' (Central Office)
                   · OU whose ParticipantId matches the DEO's RegionParticipantId
                   · OU whose ParticipantId matches the IO's ParticipantId
                   · If IO is UPMO: OU whose ParticipantId matches the DEO's ParticipantId
```

**Field order in the dialog:**
1. Report Type _(always enabled)_
2. Stage Name _(always enabled)_
3. Category _(always enabled)_
4. **Region** _(unlocks all fields below)_
5. District Engineering Office _(disabled without Region)_
6. Implementing Office _(disabled without Region)_
7. Operating Unit _(disabled without Implementing Office)_
8. Legislative District _(disabled without Region)_

**Clearing rules on change:**
- `RegionName` changed → clears DEO, IO, OU
- `DistrictEngineeringOffice` changed → clears IO, OU
- `ImplementingOfficeName` changed → clears OU

---

## Component Props

```ts
interface AIPReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: AIPReportParams) => void;
  programId?: string;    // pre-fills ProgramId
  programName?: string;  // display only
  stageName?: string;    // pre-fills StageName (AIP/AIP02 only)
  stageId?: number;      // determines available report types (default 0 = no reports)
}
```

---

## Service Layer

| Function                     | Location            | Purpose                                               |
|------------------------------|---------------------|-------------------------------------------------------|
| `fetchAIPReportDropdownData` | `Program/Service.ts` | Returns `AIPReportDropdowns` from backend             |
| `downloadAIPReport`          | `Program/Service.ts` | Routes to the correct endpoint based on `ReportType`, returns `{ blob, filename }` |

### `downloadAIPReport` routing

```ts
const endpoints: Record<AIPReportType, string> = {
  AIP: '/Reporting/RequestReportAIP',
  AIP02: '/Reporting/RequestReportAIP02',
  RBP: '/Reporting/RequestReportRBP',
  RBPComponents: '/Reporting/RequestReportRBPComponents',
  RBPTier: '/Reporting/RequestReportRBPTier',
  RDIP: '/Reporting/RequestReportRDIP',
};
```

For AIP/AIP02 the full filter payload is sent. For all other types only `{ ProgramId, RegionName }` is included in the request body.

---

## Future Work / TODOs

- [ ] **RBP / RBP Components / RBP Tier / RDIP reports** — these take only `ProgramId` + optional `RegionName`. A separate dialog (or a mode in this one) should be built when those reports are prioritised.
- [ ] **DEOs** — currently the `tOptionAdminAreaDistrictEngineeringOffice` table may be empty in development; the dropdown will show "All DEOs" as the only option until data is populated.
- [ ] **ImplementingOffices** — same as DEOs above.
- [ ] **Stage Name as dropdown** — `StageName` is currently a free-text field pre-filled with the current stage. Consider replacing it with a dropdown populated from `tOptionProgramStage` when that API is included in the dropdowns payload.
