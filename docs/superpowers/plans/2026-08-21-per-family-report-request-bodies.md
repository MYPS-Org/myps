# Per-family report request bodies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept different typed JSON bodies per report family (`rbp`, `aip-*`, `extract-pcmiow`), map them to legacy Crystal/Excel keys, store that map as JSON in Hangfire `QueryString`, and parse it as a dictionary in the job worker.

**Architecture:** Family DTOs + `IReportRequestMapper` registry in WebAPI map clean FE fields → `Dictionary<string,string>` of legacy keys (display params always written with defaults). Hangfire gains `ReportParameterBag` (parse JSON or legacy query string → dictionary; build Crystal query string including empty values). Summary reports drop from catalog.

**Tech Stack:** ASP.NET Core net8.0, System.Text.Json, Hangfire, xunit (`MYPS.UnitTests`)

## Global Constraints

- Clean API field names; legacy Crystal keys only in stored `QueryString` JSON
- Keep Hangfire payload property name `QueryString`
- Display params optional on API; default `""` (and `categoryX` → `"0"`); always pass downstream
- Exclude `rbp-summary-report` and `rbp-summary-report-with-tier` from catalog
- Case-insensitive JSON property names on request deserialize
- `categoryId: 0` is valid (not “missing”)
- Do not commit unless the user explicitly asks for a git commit
- Spec: `docs/superpowers/specs/2026-08-21-per-family-report-request-bodies-design.md`

## File structure

| File | Responsibility |
|------|----------------|
| `Hangfire/Models/ReportParameterBag.cs` | Parse stored `QueryString` → dictionary; build Crystal query string |
| `Hangfire/Models/ReportJobParameters.cs` | Delete after Form replaces it (or leave deleted) |
| `Hangfire/Services/ReportJobService.cs` | Use `ReportParameterBag` instead of typed params |
| `WebAPI/Controllers/CrystalReport/ReportCatalog.cs` | Six reports only; family lookup helper |
| `WebAPI/Controllers/CrystalReport/DTOReports.cs` | Family request DTOs; remove old `GenerateReportRequestDTO` |
| `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs` | Registry + RBP/AIP/Extract map methods |
| `WebAPI/Controllers/CrystalReport/ReportsController.cs` | Body as `JsonElement`; map then enqueue |
| `MYPS.UnitTests/ReportParameterBagTests.cs` | Parse / query-string tests |
| `MYPS.UnitTests/ReportRequestMapperTests.cs` | Family mapping + validation tests |
| `MYPS.UnitTests/MYPS.UnitTests.csproj` | Add Hangfire + WebAPI project refs |

---

### Task 1: Hangfire dictionary parameter bag

**Files:**
- Create: `project_myps/Hangfire/Models/ReportParameterBag.cs`
- Modify: `project_myps/Hangfire/Services/ReportJobService.cs` (parse call sites)
- Delete: `project_myps/Hangfire/Models/ReportJobParameters.cs` (after service switch)
- Test: `project_myps/MYPS.UnitTests/ReportParameterBagTests.cs`
- Modify: `project_myps/MYPS.UnitTests/MYPS.UnitTests.csproj` (Hangfire reference)

**Interfaces:**
- Consumes: none
- Produces:
  - `ReportParameterBag.Parse(string? storedValue) → Dictionary<string, string>` (OrdinalIgnoreCase)
  - `ReportParameterBag.ToQueryString(IDictionary<string, string> parameters) → string` (includes empty values)

- [ ] **Step 1: Add Hangfire project reference to unit tests**

In `MYPS.UnitTests.csproj`, add:

```xml
<ProjectReference Include="..\Hangfire\Hangfire.csproj" />
```

- [ ] **Step 2: Write failing tests for `ReportParameterBag`**

Create `MYPS.UnitTests/ReportParameterBagTests.cs`:

```csharp
using Hangfire.Models;
using Xunit;

namespace MYPS.UnitTests;

public class ReportParameterBagTests
{
    [Fact]
    public void Parse_JsonObject_ReturnsLegacyKeys()
    {
        var json = """{"yearstart":"2026","programid":"p1","ReportType":"","ReportTypeTitle":""}""";
        var dict = ReportParameterBag.Parse(json);

        Assert.Equal("2026", dict["yearstart"]);
        Assert.Equal("p1", dict["programid"]);
        Assert.Equal("", dict["ReportType"]);
        Assert.Equal("", dict["ReportTypeTitle"]);
    }

    [Fact]
    public void Parse_LegacyQueryString_ReturnsKeys()
    {
        var qs = "yearstart=2026&programid=p1&region=OI237";
        var dict = ReportParameterBag.Parse(qs);

        Assert.Equal("2026", dict["yearstart"]);
        Assert.Equal("p1", dict["programid"]);
        Assert.Equal("OI237", dict["region"]);
    }

    [Fact]
    public void ToQueryString_IncludesEmptyValues()
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["yearstart"] = "2026",
            ["ReportType"] = ""
        };

        var qs = ReportParameterBag.ToQueryString(dict);

        Assert.Contains("yearstart=2026", qs);
        Assert.Contains("ReportType=", qs);
    }
}
```

- [ ] **Step 3: Run tests — expect fail**

Run:

```powershell
dotnet test "e:\Jeff\Freelance\MYPS\project_myps\MYPS.UnitTests\MYPS.UnitTests.csproj" --filter "FullyQualifiedName~ReportParameterBagTests" --no-restore
```

If restore needed first: `dotnet restore` on that csproj.

Expected: FAIL (type `ReportParameterBag` missing)

- [ ] **Step 4: Implement `ReportParameterBag`**

Create `Hangfire/Models/ReportParameterBag.cs`:

```csharp
using System.Text.Json;
using System.Web;

namespace Hangfire.Models;

public static class ReportParameterBag
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static Dictionary<string, string> Parse(string? storedValue)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(storedValue))
            return result;

        if (storedValue.TrimStart().StartsWith('{'))
        {
            using var doc = JsonDocument.Parse(storedValue);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                result[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.Null => string.Empty,
                    JsonValueKind.String => prop.Value.GetString() ?? string.Empty,
                    JsonValueKind.Number => prop.Value.ToString(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => prop.Value.ToString()
                };
            }
            return result;
        }

        var parsed = HttpUtility.ParseQueryString(storedValue);
        foreach (var key in parsed.AllKeys.Where(k => k != null))
            result[key!] = parsed[key] ?? string.Empty;

        return result;
    }

    public static string ToQueryString(IDictionary<string, string> parameters)
    {
        return string.Join("&", parameters.Select(kv =>
            $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value ?? string.Empty)}"));
    }
}
```

- [ ] **Step 5: Switch `ReportJobService` to `ReportParameterBag`**

Replace the block that uses `ReportJobParameters.Parse` with:

```csharp
var parameters = ReportParameterBag.Parse(payload.QueryString);
var queryString = ReportParameterBag.ToQueryString(parameters);

if (_excelReportGenerator.CanHandle(payload.ReportName))
{
    fileBytes = await _excelReportGenerator.GenerateAsync(
        payload.ReportName, parameters, ct.ShutdownToken);
    fileExtension = "xlsx";
}
else
{
    var client = _httpClientFactory.CreateClient("ReportService");
    var requestUri = $"api/reports/{payload.ReportName}"
                   + (string.IsNullOrEmpty(queryString)
                       ? string.Empty
                       : $"?{queryString}");
    // ... existing response handling unchanged ...
}
```

Delete `Hangfire/Models/ReportJobParameters.cs`.

Remove unused `using System.Text.Json` from `ReportJobService` if present and unused.

- [ ] **Step 6: Run tests — expect pass**

```powershell
dotnet test "e:\Jeff\Freelance\MYPS\project_myps\MYPS.UnitTests\MYPS.UnitTests.csproj" --filter "FullyQualifiedName~ReportParameterBagTests"
```

Expected: PASS

Also:

```powershell
dotnet build "e:\Jeff\Freelance\MYPS\project_myps\WebAPI\WebAPI.csproj"
```

Expected: 0 errors (WebAPI still references old DTO until Task 3 — if build fails because WebAPI still uses `ReportJobParameters`, leave WebAPI compile broken only until Task 3; prefer finishing Task 2–3 in the same session so solution builds).

**Note:** After deleting `ReportJobParameters`, WebAPI `GenerateReportRequestDTO.ToReportParameters()` will not compile. Do Task 2 and Task 3 immediately after Task 1 in the same working session before considering the task done.

---

### Task 2: Catalog + family DTOs + request mappers

**Files:**
- Modify: `project_myps/WebAPI/Controllers/CrystalReport/ReportCatalog.cs`
- Modify: `project_myps/WebAPI/Controllers/CrystalReport/DTOReports.cs`
- Create: `project_myps/WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs`
- Test: `project_myps/MYPS.UnitTests/ReportRequestMapperTests.cs`
- Modify: `project_myps/MYPS.UnitTests/MYPS.UnitTests.csproj` (WebAPI reference)

**Interfaces:**
- Consumes: `ReportCatalog.IsSupported`
- Produces:
  - `ReportCatalog.TryGetFamily(string reportName, out ReportFamily family)`
  - `enum ReportFamily { Rbp, Aip, ExtractPcmiow }`
  - `ReportRequestMapper.TryMap(string reportName, JsonElement body, out Dictionary<string,string> legacyParams, out string? error) → bool`
  - DTOs: `GenerateRbpRequestDTO`, `GenerateAipRequestDTO`, `GenerateExtractPcmiowRequestDTO`

- [ ] **Step 1: Add WebAPI reference to unit tests**

```xml
<ProjectReference Include="..\WebAPI\WebAPI.csproj" />
```

If WebAPI reference pulls unwanted host assets and fails, prefer referencing only what compiles; if blocked, keep mapper tests in a new `WebAPI.Tests` project — default is UnitTests → WebAPI.

- [ ] **Step 2: Write failing mapper tests**

Create `MYPS.UnitTests/ReportRequestMapperTests.cs`:

```csharp
using System.Text.Json;
using WebAPI.Controllers.CrystalReport;
using Xunit;

namespace MYPS.UnitTests;

public class ReportRequestMapperTests
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static JsonElement Body(string json) =>
        JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void Map_Rbp_MapsSignatoriesAndPrograms()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp",
            Body("""{"yearStart":2026,"programIds":["a","b"],"regionCode":"OI237","planningEngineer":"PE","approvedBy":"A","reviewedBy":"R"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("2026", legacy["yearstart"]);
        Assert.Equal("a,b", legacy["programid"]);
        Assert.Equal("OI237", legacy["region"]);
        Assert.Equal("PE", legacy["PlanningEngineer"]);
        Assert.Equal("A", legacy["ApprovedBy"]);
        Assert.Equal("R", legacy["ReviewedBy"]);
        Assert.Equal("R", legacy["ReviewdBy"]);
    }

    [Fact]
    public void Map_Aip_DefaultsDisplayParams()
    {
        var ok = ReportRequestMapper.TryMap(
            "aip-official",
            Body("""{"yearStart":2026,"programIds":["p1"]}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("", legacy["ReportType"]);
        Assert.Equal("", legacy["ReportTypeTitle"]);
        Assert.False(legacy.ContainsKey("region"));
    }

    [Fact]
    public void Map_Extract_DefaultsLabels_AllowsCategoryZero()
    {
        var ok = ReportRequestMapper.TryMap(
            "extract-pcmiow",
            Body("""{"programIds":["p1"],"categoryId":0,"regionCode":"OI237","deoCode":"OI405","ioCode":"OI405"}"""),
            out var legacy,
            out var error);

        Assert.True(ok, error);
        Assert.Equal("0", legacy["categoryid"]);
        Assert.Equal("OI237", legacy["rocode"]);
        Assert.Equal("OI405", legacy["deocode"]);
        Assert.Equal("OI405", legacy["io_code"]);
        Assert.Equal("", legacy["programX"]);
        Assert.Equal("0", legacy["categoryX"]);
        Assert.Equal("", legacy["regionX"]);
        Assert.Equal("", legacy["deoX"]);
        Assert.Equal("", legacy["ioX"]);
    }

    [Fact]
    public void Map_Rbp_MissingYearStart_Fails()
    {
        var ok = ReportRequestMapper.TryMap(
            "rbp",
            Body("""{"programIds":["p1"]}"""),
            out _,
            out var error);

        Assert.False(ok);
        Assert.Contains("yearStart", error, StringComparison.OrdinalIgnoreCase);
    }
}
```

- [ ] **Step 3: Run tests — expect fail**

```powershell
dotnet test "e:\Jeff\Freelance\MYPS\project_myps\MYPS.UnitTests\MYPS.UnitTests.csproj" --filter "FullyQualifiedName~ReportRequestMapperTests"
```

Expected: FAIL (`ReportRequestMapper` missing)

- [ ] **Step 4: Update `ReportCatalog`**

Replace `SupportedReports` list with only the six reports from the spec. Add:

```csharp
public enum ReportFamily
{
    Rbp,
    Aip,
    ExtractPcmiow
}

public static bool TryGetFamily(string reportName, out ReportFamily family)
{
    family = default;
    if (string.IsNullOrWhiteSpace(reportName))
        return false;

    if (reportName.Equals("rbp", StringComparison.OrdinalIgnoreCase))
    {
        family = ReportFamily.Rbp;
        return true;
    }

    if (reportName.Equals("extract-pcmiow", StringComparison.OrdinalIgnoreCase))
    {
        family = ReportFamily.ExtractPcmiow;
        return true;
    }

    if (reportName.Equals("aip-official", StringComparison.OrdinalIgnoreCase)
        || reportName.Equals("aip-executive", StringComparison.OrdinalIgnoreCase)
        || reportName.Equals("aip-executive-2", StringComparison.OrdinalIgnoreCase)
        || reportName.Equals("aip-official-without-ld", StringComparison.OrdinalIgnoreCase))
    {
        family = ReportFamily.Aip;
        return true;
    }

    return false;
}
```

Keep `IsSupported` in sync (can implement as `TryGetFamily(reportName, out _)`).

Remove `rbp-summary-report` and `rbp-summary-report-with-tier` entries.

- [ ] **Step 5: Replace DTOs in `DTOReports.cs`**

Remove `GenerateReportRequestDTO` and Hangfire `using`. Keep filter/options DTOs. Add:

```csharp
public class GenerateRbpRequestDTO
{
    public int? YearStart { get; set; }
    public string[]? ProgramIds { get; set; }
    public string? RegionCode { get; set; }
    public string? PlanningEngineer { get; set; }
    public string? ApprovedBy { get; set; }
    public string? ReviewedBy { get; set; }
}

public class GenerateAipRequestDTO
{
    public int? YearStart { get; set; }
    public string[]? ProgramIds { get; set; }
    public string? RegionCode { get; set; }
    public string? ReportType { get; set; }
    public string? ReportTypeTitle { get; set; }
}

public class GenerateExtractPcmiowRequestDTO
{
    public string[]? ProgramIds { get; set; }
    public int? CategoryId { get; set; }
    public string? RegionCode { get; set; }
    public string? DeoCode { get; set; }
    public string? IoCode { get; set; }
    public string? ProgramLabel { get; set; }
    public string? CategoryLabel { get; set; }
    public string? RegionLabel { get; set; }
    public string? DeoLabel { get; set; }
    public string? IoLabel { get; set; }
}
```

- [ ] **Step 6: Implement `ReportRequestMapper`**

Create `WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs` with:

```csharp
using System.Text.Json;

namespace WebAPI.Controllers.CrystalReport;

public static class ReportRequestMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static bool TryMap(
        string reportName,
        JsonElement body,
        out Dictionary<string, string> legacyParams,
        out string? error)
    {
        legacyParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        error = null;

        if (!ReportCatalog.TryGetFamily(reportName, out var family))
        {
            error = $"'{reportName}' is not a supported report type.";
            return false;
        }

        return family switch
        {
            ReportFamily.Rbp => MapRbp(body, out legacyParams, out error),
            ReportFamily.Aip => MapAip(body, out legacyParams, out error),
            ReportFamily.ExtractPcmiow => MapExtract(body, out legacyParams, out error),
            _ => Fail(out legacyParams, out error, "Unknown report family.")
        };
    }

    // Implement MapRbp / MapAip / MapExtract per spec tables.
    // Shared helpers:
    // - JoinProgramIds(string[]?): null if empty after trim; else comma-join
    // - AddOptional(dict, key, value): only if !string.IsNullOrWhiteSpace
    // - Always set display keys for AIP / Extract with defaults
}
```

**MapRbp validation:** `YearStart` has value; `JoinProgramIds` non-null.  
**MapAip:** same + always `ReportType` / `ReportTypeTitle` = request value ?? `""`.  
**MapExtract:** `JoinProgramIds` non-null; `CategoryId.HasValue` (0 OK); `RegionCode`/`DeoCode`/`IoCode` non-whitespace; always write `programX`/`categoryX`/`regionX`/`deoX`/`ioX` with defaults `""` / `"0"` / `""` / `""` / `""`.

- [ ] **Step 7: Run mapper tests — expect pass**

```powershell
dotnet test "e:\Jeff\Freelance\MYPS\project_myps\MYPS.UnitTests\MYPS.UnitTests.csproj" --filter "FullyQualifiedName~ReportRequestMapperTests"
```

Expected: PASS

---

### Task 3: Wire `ReportsController.Generate`

**Files:**
- Modify: `project_myps/WebAPI/Controllers/CrystalReport/ReportsController.cs`

**Interfaces:**
- Consumes: `ReportRequestMapper.TryMap`, `ReportCatalog.IsSupported`
- Produces: unchanged Hangfire enqueue contract; `QueryString` is JSON dictionary

- [ ] **Step 1: Change action signature and mapping**

Replace `[FromBody] GenerateReportRequestDTO request` with `[FromBody] JsonElement body`.

Replace the map/payload creation section with:

```csharp
if (!ReportRequestMapper.TryMap(reportName, body, out var legacyParams, out var mapError))
{
    return BadRequest(new
    {
        Title = "Validation failed",
        Message = mapError ?? "Invalid report request."
    });
}

string User = _Session.UserId;

var payload = new ReportJobPayload
{
    ReportName = reportName,
    QueryString = JsonSerializer.Serialize(legacyParams),
    RequestedBy = User
};
```

Keep unsupported-report check **or** rely on mapper’s family check; prefer keeping both: catalog check first, then mapper.

**JSON serialize note:** `Dictionary` serialization preserves the keys as inserted (`yearstart`, `ReportType`, …). Use default `JsonSerializer.Serialize(legacyParams)` (no camelCase policy).

- [ ] **Step 2: Build solution**

```powershell
dotnet build "e:\Jeff\Freelance\MYPS\project_myps\WebAPI\WebAPI.csproj"
dotnet test "e:\Jeff\Freelance\MYPS\project_myps\MYPS.UnitTests\MYPS.UnitTests.csproj" --filter "FullyQualifiedName~Report"
```

Expected: 0 errors; all Report* tests PASS

---

### Task 4: Manual verification checklist (no code)

**Files:** none

- [ ] **Step 1: Confirm acceptance criteria against code**

Walk the spec acceptance list:

1. Options catalog has exactly six report ids (no summary reports)
2. RBP mapper writes signatory keys only when provided; always writes `yearstart`/`programid`
3. AIP always writes `ReportType` + `ReportTypeTitle`
4. Extract always writes SP + `*X` keys; `categoryId: 0` works
5. Missing required → mapper error string for BadRequest
6. `ReportParameterBag.Parse` handles JSON and `&`-separated legacy strings
7. `ReportJobService` uses dictionary for Excel and Crystal

- [ ] **Step 2: Optional smoke (if local API running)**

```http
POST /api/reports/rbp
{"yearStart":2026,"programIds":["jimeneznr_08132026_195437"]}

POST /api/reports/aip-official
{"yearStart":2026,"programIds":["jimeneznr_08132026_195437"],"regionCode":"OI237"}

POST /api/reports/extract-pcmiow
{"programIds":["jimeneznr_08132026_195437"],"categoryId":0,"regionCode":"OI237","deoCode":"OI405","ioCode":"OI405"}

POST /api/reports/rbp-summary-report
{}
```

Last call expected 400 unsupported.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Drop summary reports from catalog | Task 2 |
| Family DTOs + clean names | Task 2 |
| Display param defaults | Task 2 |
| Mapper registry / TryMap | Task 2 |
| Controller JsonElement + 400 validation | Task 3 |
| `QueryString` stores legacy JSON dict | Task 3 |
| Dictionary parse + empty values in query | Task 1 |
| In-flight url-encoded jobs | Task 1 |
| Excel + Crystal consume dict | Task 1 |
| Unit tests for form + mappers | Tasks 1–2 |
| Auth / FE / docs | Out of scope (skipped) |

## Placeholder scan

No TBD / “implement later” steps. Commit steps omitted intentionally (user rule: commit only when asked).
