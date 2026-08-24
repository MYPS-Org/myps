# Per-family Crystal report request bodies

**Date:** 2026-08-21  
**Status:** Approved for implementation  
**Scope:** `WebAPI` Crystal Reports controller + Hangfire report job payload parsing

## Goal

Support different typed request bodies per report family while keeping clean FE field names. Map to legacy Crystal / Excel parameter keys when storing the Hangfire `QueryString` payload. Crystal display parameters are accepted on the API, defaulted when omitted, and always passed downstream.

## Decisions

| Decision | Choice |
|----------|--------|
| FE field naming | Clean typed names (`yearStart`, `programIds`, …) |
| Crystal display params | Optional on API; default empty string / `"0"`; pass through when set |
| Request shape | Per-family DTOs (Approach 2) |
| Summary reports | Exclude `rbp-summary-report` and `rbp-summary-report-with-tier` until param examples exist |
| Hangfire storage | Keep property name `QueryString`; store JSON object of legacy key/value pairs |
| Job parsing | Dictionary-based (not a single RBP-shaped `ReportJobParameters` class) |

## Out of scope

- Auth / `CoreController` session fix on `ReportsController`
- Frontend wiring
- User-manual updates
- Re-adding summary report types

## Supported catalog

| Id | Family | Output |
|----|--------|--------|
| `rbp` | RBP | pdf |
| `aip-official` | AIP | pdf |
| `aip-executive` | AIP | pdf |
| `aip-executive-2` | AIP | pdf |
| `aip-official-without-ld` | AIP | pdf |
| `extract-pcmiow` | Extract | xlsx |

Remove from `ReportCatalog.SupportedReports` until later: `rbp-summary-report`, `rbp-summary-report-with-tier`.

## Endpoint

Unchanged route:

```http
POST /api/reports/{reportName}
Content-Type: application/json
```

1. Reject unknown `reportName` with 400 (existing `ReportCatalog.IsSupported`).
2. Resolve family from `reportName`.
3. Deserialize body to that family’s DTO.
4. Validate required fields → 400 on failure.
5. Map to legacy `Dictionary<string, string>` (apply display defaults).
6. Serialize dictionary as JSON into `ReportJobPayload.QueryString`.
7. Enqueue Hangfire job (existing queue / SignalR / download flow).

## Family DTOs (API)

### Shared helpers

- `programIds: string[]` → legacy `programid` as comma-joined list (trim entries; skip empties).
- `regionCode` maps to `region` for RBP/AIP, and to `rocode` for extract.

### RBP — `GenerateRbpRequestDTO` (`rbp`)

| API field | Required | Default | Legacy key |
|-----------|----------|---------|------------|
| `yearStart` (`int`) | yes | — | `yearstart` |
| `programIds` (`string[]`) | yes (non-empty) | — | `programid` |
| `regionCode` | no | omit if null/empty | `region` |
| `planningEngineer` | no | omit if empty | `PlanningEngineer` |
| `approvedBy` | no | omit if empty | `ApprovedBy` |
| `reviewedBy` | no | omit if empty | `ReviewedBy` **and** `ReviewdBy` |

### AIP — `GenerateAipRequestDTO` (`aip-official`, `aip-executive`, `aip-executive-2`, `aip-official-without-ld`)

| API field | Required | Default | Legacy key |
|-----------|----------|---------|------------|
| `yearStart` (`int`) | yes | — | `yearstart` |
| `programIds` (`string[]`) | yes (non-empty) | — | `programid` |
| `regionCode` | no | omit if null/empty | `region` |
| `reportType` | no | `""` | `ReportType` |
| `reportTypeTitle` | no | `""` | `ReportTypeTitle` |

Display params are always present in the downstream dictionary (never omit), using `""` when FE omits them.

### Extract — `GenerateExtractPcmiowRequestDTO` (`extract-pcmiow`)

| API field | Required | Default | Legacy key |
|-----------|----------|---------|------------|
| `programIds` (`string[]`) | yes (non-empty) | — | `programid` |
| `categoryId` (`int`) | yes | — | `categoryid` |
| `regionCode` | yes | — | `rocode` |
| `deoCode` | yes | — | `deocode` |
| `ioCode` | yes | — | `io_code` |
| `programLabel` | no | `""` | `programX` |
| `categoryLabel` | no | `"0"` | `categoryX` |
| `regionLabel` | no | `""` | `regionX` |
| `deoLabel` | no | `""` | `deoX` |
| `ioLabel` | no | `""` | `ioX` |

Label / display params always present downstream with defaults above.

## Example FE bodies

### `POST /api/reports/rbp`

```json
{
  "yearStart": 2026,
  "programIds": [
    "jimeneznr_08132026_195437",
    "jimeneznr_08132026_200218",
    "jimeneznr_08132026_200221"
  ],
  "regionCode": "OI237",
  "planningEngineer": "Test",
  "approvedBy": "Test",
  "reviewedBy": "Test"
}
```

### `POST /api/reports/aip-official` (and other `aip-*`)

```json
{
  "yearStart": 2026,
  "programIds": ["jimeneznr_08132026_195437"],
  "regionCode": "OI237"
}
```

Server fills `ReportType` / `ReportTypeTitle` with `""`.

### `POST /api/reports/extract-pcmiow`

```json
{
  "programIds": ["jimeneznr_08132026_195437"],
  "categoryId": 0,
  "regionCode": "OI237",
  "deoCode": "OI405",
  "ioCode": "OI405"
}
```

Server fills `programX`/`regionX`/`deoX`/`ioX` with `""` and `categoryX` with `"0"`.

## Downstream `QueryString` JSON

Stored value is a JSON object with **legacy** keys, for example AIP:

```json
{
  "yearstart": "2026",
  "programid": "jimeneznr_08132026_195437",
  "region": "OI237",
  "ReportType": "",
  "ReportTypeTitle": ""
}
```

JSON property naming for storage uses the exact Crystal keys (including casing such as `ReportType`, `PlanningEngineer`, `io_code`).

## Hangfire / `ReportJobService` changes

Replace typed `ReportJobParameters` as the sole parse target with:

1. If `QueryString` is JSON object → deserialize to `Dictionary<string, string>` (case-insensitive).
2. Else treat as legacy url-encoded query string (in-flight jobs) → parse to the same dictionary.
3. Excel path: pass dictionary to `IExcelReportGenerator.GenerateAsync`.
4. Crystal path: build query string from dictionary (skip null/empty values **except** where Crystal requires empty display params — prefer keeping empty display keys that were intentionally stored).

**Rule for empty values when calling Crystal:** include keys that were written into the stored JSON (including empty display strings). When rebuilding from dictionary for the HTTP query, include empty string values for known display keys; omit other empty optional filters (`region`, signatories).

Simpler implementation rule (preferred):

- Mappers always write display keys into the dictionary (possibly `""`).
- When building Crystal query string, include every dictionary entry (including empty strings).
- Optional data filters that were never set are simply absent from the dictionary.

## Controller binding

ASP.NET cannot pick a DTO type from `{reportName}` automatically. Implementation:

1. Read body as `JsonElement` / `JsonDocument`, or use a small `IReportRequestMapper` registry keyed by report name / family.
2. Each mapper: `bool TryMap(JsonElement body, out Dictionary<string, string> legacy, out string? error)`.
3. Controller stays thin: validate report name → mapper → enqueue.
4. Deserialize with `PropertyNameCaseInsensitive = true` so FE may send `yearStart` or `YearStart` (host currently uses `PropertyNamingPolicy = null` for responses).

### Validation notes

- `programIds` must be present and contain at least one non-whitespace id after trim.
- `categoryId` may be `0` (valid for extract); do not treat zero as “missing.”
- For required strings (`regionCode` / `deoCode` / `ioCode` on extract), whitespace-only counts as missing.

## Validation errors

Return 400 with existing project style where possible:

```json
{
  "Title": "Validation failed",
  "Message": "yearStart is required."
}
```

Unknown report name keeps current unsupported-report response.

## Files to touch (implementation)

| File | Change |
|------|--------|
| `WebAPI/.../ReportCatalog.cs` | Drop summary reports; optionally expose family metadata |
| `WebAPI/.../DTOReports.cs` | Replace single `GenerateReportRequestDTO` with family DTOs |
| `WebAPI/.../ReportsController.cs` | Family deserialize + map |
| New mapper type(s) under CrystalReport | RBP / AIP / Extract mappers |
| `Hangfire/Models/ReportJobParameters.cs` | Retire or reduce to shared helpers; dictionary parse |
| `Hangfire/Services/ReportJobService.cs` | Dictionary parse path |

## Acceptance criteria

- [ ] `GET /api/reports/options` lists only the six supported reports above
- [ ] `POST .../rbp` accepts RBP body and stores legacy JSON including signatory keys when provided
- [ ] `POST .../aip-*` accepts AIP body; always stores `ReportType` and `ReportTypeTitle` (default `""`)
- [ ] `POST .../extract-pcmiow` accepts extract body; always stores SP keys + `*X` display keys with defaults
- [ ] Missing required fields → 400 before Hangfire enqueue
- [ ] Unknown report name → 400
- [ ] In-flight jobs with url-encoded `QueryString` still parse
- [ ] Excel extract and Crystal PDF paths both receive correct legacy keys

## Non-goals / follow-ups

- Document API in `CRYSTAL_REPORTS_API.md` (optional after implement)
- Wire FE Reports pages
- Auth on controller
- Summary report families when samples arrive
