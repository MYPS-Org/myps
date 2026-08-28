using Helpers;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Hangfire.Importing
{
    // Builds the downloadable "error report" workbook for a failed project import: a fresh
    // .xlsm (never derived from the uploaded file) containing only the rows that failed
    // validation. Every lookup-backed column across all four sheets gets an Excel Data
    // Validation dropdown, sourced from the same ImportLookupCache lists the corresponding
    // Validate* method checks against — pulled fresh from the DB at generation time, unlike
    // the reference DPWH template this cascading technique is adapted from, whose lookup
    // sheets are frozen at whatever point the template was last exported.
    //
    // Six PROJECT DETAILS fields (City, Legislative District, Region, DEO, Implementing
    // Office, Operating Unit), FUNDING PROFILE's Agreement, and COMPONENT DETAILS' Type of
    // Work are filtered by a parent column (Province / Source / Infrastructure Type
    // respectively). The *initial* filtered dropdown for each row is set directly at
    // generation time (we already know the row's parent value then); a small VBA
    // Worksheet_Change handler per sheet re-points the dependent cell's validation and clears
    // its value whenever the parent cell is edited after the file is opened — this mirrors
    // the mechanism (not the data) of the reference template's cascade macro: a VBA-driven
    // Validation.Formula1 rewrite against pre-built static named ranges, rather than an
    // INDIRECT formula. That means the cascade only updates live with macros enabled; the
    // dropdown a row opens with is always correct regardless, since it was set at build time.
    public static class ImportErrorWorkbookBuilder
    {
        // Matches the reference template's Amount/Cost number format exactly (literal peso
        // sign, thousands separator, 2 decimals).
        private const string CurrencyFormat = "\"₱\"#,##0.00";

        // AutoFitColumns() has no built-in limit — one long free-text value (e.g. Detailed
        // Scope, Description) stretches its column arbitrarily wide. Cap it here instead.
        private const double MaxColumnWidth = 60;

        // Column letters, 1-based, matching the PROJECT DETAILS layout below.
        private const int ColProvince = 10;   // J
        private const int ColCity = 11;   // K
        private const int ColDistrict = 12;   // L
        private const int ColRegion = 13;   // M
        private const int ColDeo = 14;   // N
        private const int ColImplOffice = 15;   // O
        private const int ColOpUnit = 16;   // P
        private const int ColMessage = 28;   // AB

        // FUNDING PROFILE columns.
        private const int ColFPSource = 2;    // B
        private const int ColFPAgreement = 3;    // C

        // COMPONENT DETAILS columns.
        private const int ColCDComponentType = 2;    // B
        private const int ColCDComponentId = 3;    // C
        private const int ColCDInfraType = 8;    // H
        private const int ColCDWorkType = 9;    // I

        // Matches ValidateComponentDetails' own special-casing (ImportingHelper.cs): only this
        // component type gets a numbered-suffix Component ID; every other type must be exactly
        // its lookup's base ComponentId.
        private const string CivilWorksComponentTypeName = "Civil Works";

        // MAJOR ITEMS OF WORK columns.
        private const int ColMWTargetUnit = 6;    // F

        // Hidden helper columns used only by the live Project ID rebuild macro (RebuildProjectIdDropdown)
        // to stage each sheet's freshly-scanned Project ID list before replacing the named range.
        private const int ColFPProjectIdHelper = 7;    // G
        private const int ColCDProjectIdHelper = 13;   // M
        private const int ColMWProjectIdHelper = 20;   // T
        // Start of a reserved block of columns (300 wide) used only by RebuildComponentIdGroups
        // to stage one per-Project-ID Component ID list each — well clear of every other column
        // MAJOR ITEMS OF WORK actually uses.
        private const int ColMWComponentIdHelperStart = 30;

        public static byte[] Build(
            ImportLookupCache cache,
            List<ImportProjectDetailsExcel> errorProjectDetails,
            List<ImportFundingProfileExcel> errorFundingProfile,
            List<ImportComponentDetailsExcel> errorComponentDetails,
            List<ImportMajorItemsOfWorkExcel> errorMajorItemsOfWork)
        {
            using var pkg = new ExcelPackage();
            pkg.Workbook.CreateVBAProject();

            var lookups = BuildLookupSheet(pkg, cache, errorProjectDetails, errorFundingProfile, errorComponentDetails);

            BuildProjectDetailsSheet(pkg, errorProjectDetails, lookups);
            BuildFundingProfileSheet(pkg, errorFundingProfile, lookups);
            BuildComponentDetailsSheet(pkg, errorComponentDetails, lookups, cache);
            BuildMajorItemsOfWorkSheet(pkg, errorMajorItemsOfWork, lookups);

            AuthorCascadeMacros(pkg);

            return pkg.GetAsByteArray();
        }

        // ── Excel-Name-safe key derivation ──────────────────────────────────────
        // Ported from the reference template's ModuleShared.MakeValidName (VBA): a handful of
        // explicit replacements for the common cases, then a catch-all that keeps only
        // [A-Za-z0-9_] and drops anything else — simpler and more robust than enumerating every
        // punctuation character, since it can't miss one. The VBA copy in AuthorCascadeMacros
        // must stay behaviorally identical to this, since a cell edited after the file is open
        // has its cascade key recomputed there, not here.
        private static string SanitizeKey(string raw)
        {
            var t = raw.Trim();
            foreach (var pair in new[] { (" ", "_"), ("-", "_"), ("/", "_"), (".", "_"), ("(", "_"), (")", "_"), ("&", "_"), (",", "_"), ("'", "") })
                t = t.Replace(pair.Item1, pair.Item2);

            var sb = new StringBuilder();
            foreach (var ch in t)
                if (char.IsLetterOrDigit(ch) || ch == '_') sb.Append(ch);

            var result = sb.ToString();
            if (result.Length == 0) result = "X";
            if (char.IsDigit(result[0])) result = "N_" + result;
            return result;
        }

        // ── Lookup sheet + defined Names ─────────────────────────────────────────
        private class LookupNames
        {
            public required string Tier;
            public required string Category;
            public required string Thrust;
            public required string Province;
            public required string RegionWide;
            public required string Origin;
            public required string Agency;
            public required string ImplementationMode;
            public required string EmergencyMode;
            public required string RowAvailable;
            public required string Feasibility;
            public required string DetailedDesign;
            public required string FundingSource;
            public required string ComponentType;
            public required string InfraType;
            public required string TargetUnit;
            public required string ProjectId;
            public required string ProjectIdFromFundingProfile;
            public required string ProjectIdFromComponentDetails;
        }

        private static LookupNames BuildLookupSheet(
            ExcelPackage pkg,
            ImportLookupCache cache,
            List<ImportProjectDetailsExcel> errorProjectDetails,
            List<ImportFundingProfileExcel> errorFundingProfile,
            List<ImportComponentDetailsExcel> errorComponentDetails)
        {
            var ws = pkg.Workbook.Worksheets.Add("_Lookups");
            ws.Hidden = eWorkSheetHidden.VeryHidden;

            int col = 1;

            string WriteFlatList(string namePrefix, IEnumerable<string?> values)
            {
                var distinctValues = values.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().OrderBy(v => v).ToList();
                if (distinctValues.Count == 0) distinctValues.Add(""); // Named range can't be empty

                for (int i = 0; i < distinctValues.Count; i++)
                    ws.Cells[i + 1, col].Value = distinctValues[i];

                pkg.Workbook.Names.Add(namePrefix, ws.Cells[1, col, distinctValues.Count, col]);
                col++;
                return namePrefix;
            }

            var names = new LookupNames
            {
                Tier = WriteFlatList("Lookup_Tier", cache.Tiers.Select(x => x.Name)),
                // Excludes expired categories (ValidUntil != 0 and already passed) — matches the
                // reference template's own dropdown-filtering rule, and ValidateProjectDetails
                // (ImportingHelper.cs) now rejects an expired category the same way.
                Category = WriteFlatList("Lookup_Category", cache.Categories
                    .Where(x => x.ValidUntil == 0 || x.ValidUntil > Functions.CurrentDate().Year)
                    .Select(x => x.CategoryName)),
                // Excludes expired/not-yet-active Thrusts (mirrors the reference template's
                // SubCategory validity-date filter, and ValidateProjectDetails now rejects
                // an out-of-range Thrust the same way).
                Thrust = WriteFlatList("Lookup_Thrust", cache.Thrusts
                    .Where(x => x.ValidToDate == 0 || (x.ValidFromDate < Functions.CurrentDate().Year && x.ValidToDate > Functions.CurrentDate().Year))
                    .Select(x => x.ThrustDescription)),
                Province = WriteFlatList("Lookup_Province", cache.Provinces.Select(x => x.Name)),
                RegionWide = WriteFlatList("Lookup_RegionWide", cache.RegionWides.Select(x => x.Name)),
                Origin = WriteFlatList("Lookup_Origin", cache.Origins.Select(x => x.Name)),
                Agency = WriteFlatList("Lookup_Agency", cache.Agencies.Select(x => x.Name)),
                ImplementationMode = WriteFlatList("Lookup_ImplementationMode", cache.ImplementationModes.Select(x => x.Name)),
                EmergencyMode = WriteFlatList("Lookup_EmergencyMode", cache.EmergencyModes.Select(x => x.Name)),
                RowAvailable = WriteFlatList("Lookup_RowAvailable", cache.RowAvailables.Select(x => x.Name)),
                Feasibility = WriteFlatList("Lookup_Feasibility", cache.FeasibilityStudies.Select(x => x.Name)),
                DetailedDesign = WriteFlatList("Lookup_DetailedDesign", cache.DetailedDesigns.Select(x => x.Name)),
                FundingSource = WriteFlatList("Lookup_FundingSource", cache.FundingSources.Select(x => x.Name)),
                ComponentType = WriteFlatList("Lookup_ComponentType", cache.Components.Select(x => x.ComponentName)),
                InfraType = WriteFlatList("Lookup_InfraType", cache.InfraTypes.Select(x => x.InfraName)),
                TargetUnit = WriteFlatList("Lookup_TargetUnit", cache.ScopeOfWorks.Select(x => x.Measure)),
                // Project ID lists chain sheet-to-sheet, each sourced from this workbook's own
                // error rows on the sheet before it — not ImportLookupCache, since there's no
                // DB-wide "all Project IDs" list.
                ProjectId = WriteFlatList("Lookup_ProjectId", errorProjectDetails.Select(x => x.ProjectId)),
                ProjectIdFromFundingProfile = WriteFlatList("Lookup_ProjectId_FP", errorFundingProfile.Select(x => x.ProjectId)),
                ProjectIdFromComponentDetails = WriteFlatList("Lookup_ProjectId_CD", errorComponentDetails.Select(x => x.ProjectId)),
            };

            // ── Component Type -> base Component ID table, for the auto-fill macro on
            // COMPONENT DETAILS. Written as two parallel columns (not through WriteFlatList,
            // which independently sorts/dedupes — these need to stay row-aligned) so
            // ComponentTypeIds[i] is always the base ID for ComponentTypeNames[i].
            {
                var componentPairs = cache.Components
                    .Where(x => !string.IsNullOrWhiteSpace(x.ComponentName) && !string.IsNullOrWhiteSpace(x.ComponentId))
                    .GroupBy(x => x.ComponentName, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .ToList();

                int nameCol = col++;
                int idCol = col++;
                int rowCount = Math.Max(1, componentPairs.Count);
                for (int i = 0; i < componentPairs.Count; i++)
                {
                    ws.Cells[i + 1, nameCol].Value = componentPairs[i].ComponentName;
                    ws.Cells[i + 1, idCol].Value = componentPairs[i].ComponentId;
                }
                pkg.Workbook.Names.Add("ComponentTypeNames", ws.Cells[1, nameCol, rowCount, nameCol]);
                pkg.Workbook.Names.Add("ComponentTypeIds", ws.Cells[1, idCol, rowCount, idCol]);
            }

            // ── Infrastructure Type name -> code, and Scope of Work description -> (infra codes,
            // measure) tables — for the Target Unit auto-fill macro on MAJOR ITEMS OF WORK, which
            // needs to resolve a Component Details row's Infrastructure Type + Type of Work into
            // the matching ScopeOfWork's Measure, mirroring ValidateMajorItemsOfWork's own
            // ScopeOfWork.Description == Component.WorkTypeId (scoped by Infrastructure Type) check.
            {
                var infraPairs = cache.InfraTypes
                    .Where(x => !string.IsNullOrWhiteSpace(x.InfraName) && !string.IsNullOrWhiteSpace(x.InfraCode))
                    .GroupBy(x => x.InfraName, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .ToList();

                int infraNameCol = col++;
                int infraCodeCol = col++;
                int infraRowCount = Math.Max(1, infraPairs.Count);
                for (int i = 0; i < infraPairs.Count; i++)
                {
                    ws.Cells[i + 1, infraNameCol].Value = infraPairs[i].InfraName;
                    ws.Cells[i + 1, infraCodeCol].Value = infraPairs[i].InfraCode;
                }
                pkg.Workbook.Names.Add("InfraTypeNames", ws.Cells[1, infraNameCol, infraRowCount, infraNameCol]);
                pkg.Workbook.Names.Add("InfraTypeCodes", ws.Cells[1, infraCodeCol, infraRowCount, infraCodeCol]);

                var scopeRows = cache.ScopeOfWorks
                    .Where(x => !string.IsNullOrWhiteSpace(x.Description))
                    .ToList();

                int descCol = col++;
                int infraCodesCol = col++;
                int measureCol = col++;
                int scopeRowCount = Math.Max(1, scopeRows.Count);
                for (int i = 0; i < scopeRows.Count; i++)
                {
                    ws.Cells[i + 1, descCol].Value = scopeRows[i].Description;
                    ws.Cells[i + 1, infraCodesCol].Value = string.Join("|", scopeRows[i].InfraType ?? Array.Empty<string>());
                    ws.Cells[i + 1, measureCol].Value = scopeRows[i].Measure;
                }
                pkg.Workbook.Names.Add("ScopeOfWorkDescriptions", ws.Cells[1, descCol, scopeRowCount, descCol]);
                pkg.Workbook.Names.Add("ScopeOfWorkInfraCodes", ws.Cells[1, infraCodesCol, scopeRowCount, infraCodesCol]);
                pkg.Workbook.Names.Add("ScopeOfWorkMeasures", ws.Cells[1, measureCol, scopeRowCount, measureCol]);
            }

            // ── Per-province grouped lists, mirroring ValidateProjectDetails' own scoping ──
            // Accumulated into buckets keyed by the sanitized name — if two distinct province
            // names ever sanitize to the same key, both provinces' entries get unioned into
            // that one dropdown list instead of the second one silently losing its ranges.
            var grouped = new Dictionary<string, (List<string?> Cities, List<string?> Districts, List<string?> Regions, List<string?> Deos, List<string?> ImplOffices, List<string?> OpUnits)>(StringComparer.OrdinalIgnoreCase);

            foreach (var province in cache.Provinces)
            {
                var key = SanitizeKey(province.Name);
                if (!grouped.TryGetValue(key, out var bucket))
                {
                    bucket = (new List<string?>(), new List<string?>(), new List<string?>(), new List<string?>(), new List<string?>(), new List<string?>());
                    grouped[key] = bucket;
                }

                var region = cache.Regions.FirstOrDefault(r => r.ParticipantId == province.RegionParticipantId);
                var deoNames = cache.DEOs.Where(d => d.ProvinceCode == province.Code).Select(d => d.Name).ToList();

                bucket.Cities.AddRange(cache.Cities.Where(c => c.ProvinceCode == province.Code).Select(c => c.Name));
                bucket.Districts.AddRange(cache.Districts.Where(d => d.ProvinceCode == province.Code).Select(d => d.Name));
                if (region != null) bucket.Regions.Add(region.Name);
                bucket.Deos.AddRange(deoNames);

                // Implementing Office / Operating Unit candidates: any office scoped to this
                // province's Region whose name matches either the Region itself or one of this
                // province's DEOs — the same OR-condition ValidateProjectDetails checks per row.
                bucket.ImplOffices.AddRange(cache.ImplementingOffices
                    .Where(o => o.RegionParticipantId == province.RegionParticipantId
                             && (region != null && ImportingHelper.NamesMatch(o.Name, region.Name)
                                 || deoNames.Any(d => ImportingHelper.NamesMatch(o.Name, d))))
                    .Select(o => o.Name));

                bucket.OpUnits.AddRange(cache.OperatingUnits
                    .Where(o => o.RegionParticipantId == province.RegionParticipantId
                             && (region != null && ImportingHelper.NamesMatch(o.Name, region.Name)
                                 || deoNames.Any(d => ImportingHelper.NamesMatch(o.Name, d))))
                    .Select(o => o.Name));
            }

            // "Central Office" is always a valid Operating Unit choice, regardless of province.
            var centralOffice = cache.OperatingUnits.Where(o => ImportingHelper.NamesMatch(o.Name, "Central Office")).Select(o => o.Name).ToList();

            foreach (var (key, bucket) in grouped)
            {
                WriteFlatList($"City_{key}", bucket.Cities);
                WriteFlatList($"Dist_{key}", bucket.Districts);
                WriteFlatList($"Reg_{key}", bucket.Regions);
                WriteFlatList($"Deo_{key}", bucket.Deos);
                WriteFlatList($"ImplOff_{key}", bucket.ImplOffices);
                WriteFlatList($"OpUnit_{key}", bucket.OpUnits.Concat(centralOffice));
            }

            // ── Per-Source grouped Agreement lists (Funding Profile), mirroring
            // ValidateFundingProfile's Source.Organization == Agreement.SourceOrg check.
            var sourceGroups = new Dictionary<string, List<string?>>(StringComparer.OrdinalIgnoreCase);
            foreach (var source in cache.FundingSources)
            {
                var key = SanitizeKey(source.Name);
                if (!sourceGroups.TryGetValue(key, out var list))
                {
                    list = new List<string?>();
                    sourceGroups[key] = list;
                }
                list.AddRange(cache.FundingAgreements.Where(a => a.SourceOrg == source.Organization).Select(a => a.Name));
            }
            foreach (var (key, list) in sourceGroups)
                WriteFlatList($"Agr_{key}", list);

            // ── Per-InfraType grouped Work Type lists (Component Details), mirroring
            // ValidateComponentDetails' ScopeOfWork.InfraType.Contains(InfraType.InfraCode) check ──
            var infraGroups = new Dictionary<string, List<string?>>(StringComparer.OrdinalIgnoreCase);
            foreach (var infra in cache.InfraTypes)
            {
                var key = SanitizeKey(infra.InfraName);
                if (!infraGroups.TryGetValue(key, out var list))
                {
                    list = new List<string?>();
                    infraGroups[key] = list;
                }
                list.AddRange(cache.ScopeOfWorks.Where(s => s.InfraType.Contains(infra.InfraCode)).Select(s => s.Description));
            }
            foreach (var (key, list) in infraGroups)
                WriteFlatList($"Work_{key}", list);

            // ── Per-Project-ID grouped Component ID lists (Major Items of Work), mirroring
            // ValidateMajorItemsOfWork's own check that ComponentId belongs to this ProjectId's
            // Component Details rows. This is only the build-time seed — since Component Details
            // can gain new (ProjectId, ComponentId) pairs after the file is opened, the macro's
            // RebuildComponentIdGroups (on MAJOR ITEMS OF WORK's Worksheet_Activate) rebuilds
            // these same "CompId_<key>" names live from whatever is actually on that sheet then.
            var componentIdGroups = new Dictionary<string, List<string?>>(StringComparer.OrdinalIgnoreCase);
            foreach (var component in errorComponentDetails)
            {
                if (string.IsNullOrWhiteSpace(component.ProjectId) || string.IsNullOrWhiteSpace(component.ComponentId)) continue;
                var key = SanitizeKey(component.ProjectId);
                if (!componentIdGroups.TryGetValue(key, out var list))
                {
                    list = new List<string?>();
                    componentIdGroups[key] = list;
                }
                list.Add(component.ComponentId);
            }
            foreach (var (key, list) in componentIdGroups)
                WriteFlatList($"CompId_{key}", list);

            return names;
        }

        // ── PROJECT DETAILS ──────────────────────────────────────────────────────
        private static void BuildProjectDetailsSheet(ExcelPackage pkg, List<ImportProjectDetailsExcel> errors, LookupNames lookups)
        {
            var ws = pkg.Workbook.Worksheets.Add("PROJECT DETAILS");
            ws.Cells["A1"].Value = "Project ID";
            ws.Cells["B1"].Value = "Multi Year ID";
            ws.Cells["C1"].Value = "External ID";
            ws.Cells["D1"].Value = "OA Project Code (UACS)";
            ws.Cells["E1"].Value = "*Tier";
            ws.Cells["F1"].Value = "*Category";
            ws.Cells["G1"].Value = "*Sub-Category";
            ws.Cells["H1"].Value = "MYCA Approval Date";
            ws.Cells["I1"].Value = "Description";
            ws.Cells["J1"].Value = "*Province";
            ws.Cells["K1"].Value = "*City Municipality";
            ws.Cells["L1"].Value = "*Legislative District:";
            ws.Cells["M1"].Value = "*Region";
            ws.Cells["N1"].Value = "*District Engineering Office";
            ws.Cells["O1"].Value = "*Implementing Office";
            ws.Cells["P1"].Value = "Operation Unit";
            ws.Cells["Q1"].Value = "Region Wide";
            ws.Cells["R1"].Value = "Origin";
            ws.Cells["S1"].Value = "Originating Agency";
            ws.Cells["T1"].Value = "Implementation Mode";
            ws.Cells["U1"].Value = "Emergency Mode";
            ws.Cells["V1"].Value = "ROW Available";
            ws.Cells["W1"].Value = "Feasibility Study";
            ws.Cells["X1"].Value = "Feasibility Date";
            ws.Cells["Y1"].Value = "Detailed Design";
            ws.Cells["Z1"].Value = "Detailed Design Date";
            ws.Cells["AA1"].Value = "Rank";
            ws.Cells["AB1"].Value = "Error(s) and Warning(s)";

            StyleHeaders(ws, "A1:AB1",
                red: ["A1", "E1", "F1", "G1", "I1", "J1", "K1", "L1", "M1", "N1", "O1", "P1", "Q1", "R1", "S1", "T1", "U1", "V1", "W1", "Y1", "AB1"],
                blue: ["B1", "C1", "D1", "H1", "X1", "Z1", "AA1"]);

            for (int i = 0; i < errors.Count; i++)
            {
                int row = i + 2;
                var item = errors[i];
                ws.Cells[row, 1].Value = item.ProjectId;
                ws.Cells[row, 2].Value = item.MYId;
                ws.Cells[row, 3].Value = item.ExternalId;
                ws.Cells[row, 4].Value = item.UACS;
                ws.Cells[row, 5].Value = item.Tier;
                ws.Cells[row, 6].Value = item.Category;
                ws.Cells[row, 7].Value = item.Thrust;
                ws.Cells[row, 8].Value = item.MYCAApprovalDate;
                ws.Cells[row, 9].Value = item.Description;
                ws.Cells[row, ColProvince].Value = item.Province;
                ws.Cells[row, ColCity].Value = item.City;
                ws.Cells[row, ColDistrict].Value = item.LegislativeDistrict;
                ws.Cells[row, ColRegion].Value = item.Region;
                ws.Cells[row, ColDeo].Value = item.DEO;
                ws.Cells[row, ColImplOffice].Value = item.ImplementingOffice;
                ws.Cells[row, ColOpUnit].Value = item.OperatingUnit;
                ws.Cells[row, 17].Value = item.RegionWide;
                ws.Cells[row, 18].Value = item.Origin;
                ws.Cells[row, 19].Value = item.Agency;
                ws.Cells[row, 20].Value = item.ImplementationMode;
                ws.Cells[row, 21].Value = item.EmergencyMode;
                ws.Cells[row, 22].Value = item.RowAvailable;
                ws.Cells[row, 23].Value = item.Feasibility;
                ws.Cells[row, 24].Value = item.FeasibilityDate;
                ws.Cells[row, 25].Value = item.DetailedDesign;
                ws.Cells[row, 26].Value = item.DetailedDesignDate;
                ws.Cells[row, 27].Value = item.Rank;
                ws.Cells[row, ColMessage].Value = item.ErrorMessage;

                // Province-dependent dropdowns: correct for THIS row's Province value set now,
                // at generation time — the macro (AuthorCascadeMacros) only needs to re-point
                // these if the user edits Province after opening the file, including on a row
                // added later (Worksheet_Change fires regardless of when the row was created).
                var provinceKey = SanitizeKey(item.Province ?? string.Empty);
                AddListValidation(ws, row, ColCity, $"City_{provinceKey}");
                AddListValidation(ws, row, ColDistrict, $"Dist_{provinceKey}");
                AddListValidation(ws, row, ColRegion, $"Reg_{provinceKey}");
                AddListValidation(ws, row, ColDeo, $"Deo_{provinceKey}");
                AddListValidation(ws, row, ColImplOffice, $"ImplOff_{provinceKey}");
                AddListValidation(ws, row, ColOpUnit, $"OpUnit_{provinceKey}");
            }

            // Flat dropdowns — independent of any other cell in the row. Applied to the whole
            // column (row 2 through Excel's last row), not just the rows written above, so a
            // row added later by hand still gets the dropdown — matching the reference
            // template's own approach (e.g. its Province column is validated J2:J1048576).
            AddColumnListValidation(ws, 5, lookups.Tier);
            AddColumnListValidation(ws, 6, lookups.Category);
            AddColumnListValidation(ws, 7, lookups.Thrust);
            AddColumnListValidation(ws, ColProvince, lookups.Province);
            AddColumnListValidation(ws, 17, lookups.RegionWide);
            AddColumnListValidation(ws, 18, lookups.Origin);
            AddColumnListValidation(ws, 19, lookups.Agency);
            AddColumnListValidation(ws, 20, lookups.ImplementationMode);
            AddColumnListValidation(ws, 21, lookups.EmergencyMode);
            AddColumnListValidation(ws, 22, lookups.RowAvailable);
            AddColumnListValidation(ws, 23, lookups.Feasibility);
            AddColumnListValidation(ws, 25, lookups.DetailedDesign);

            AutoFitWithCap(ws);
        }

        private static void AddListValidation(ExcelWorksheet ws, int row, int col, string definedName)
        {
            var validation = ws.DataValidations.AddListValidation(ws.Cells[row, col].Address);
            validation.Formula.ExcelFormula = definedName;
            validation.ShowErrorMessage = true;
            validation.ErrorStyle = OfficeOpenXml.DataValidation.ExcelDataValidationWarningStyle.stop;
        }

        // Amount/Cost are stored as raw strings on the DTOs (rows can genuinely have invalid
        // text there, which is often why the row errored in the first place). Only a value that
        // parses cleanly gets written as a real number + the currency format — Excel ignores a
        // number format on a text cell, so an unparsable value is left as plain text to show
        // exactly what needs fixing.
        private static void SetCurrencyCell(ExcelRange cell, string? rawValue)
        {
            if (decimal.TryParse(rawValue, NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"), out var amount))
            {
                cell.Value = amount;
                cell.Style.Numberformat.Format = CurrencyFormat;
            }
            else
            {
                cell.Value = rawValue;
            }
        }

        private static void AddColumnListValidation(ExcelWorksheet ws, int col, string definedName)
        {
            var validation = ws.DataValidations.AddListValidation(ws.Cells[2, col, ExcelPackage.MaxRows, col].Address);
            validation.Formula.ExcelFormula = definedName;
            validation.ShowErrorMessage = true;
            validation.ErrorStyle = OfficeOpenXml.DataValidation.ExcelDataValidationWarningStyle.stop;
        }

        // ── FUNDING PROFILE / COMPONENT DETAILS / MAJOR ITEMS OF WORK ────────────
        private static void BuildFundingProfileSheet(ExcelPackage pkg, List<ImportFundingProfileExcel> errors, LookupNames lookups)
        {
            var ws = pkg.Workbook.Worksheets.Add("FUNDING PROFILE");
            ws.Cells["A1"].Value = "Project ID";
            ws.Cells["B1"].Value = "Source(s)";
            ws.Cells["C1"].Value = "Agreement(s)";
            ws.Cells["D1"].Value = "Amount";
            ws.Cells["E1"].Value = "Error(s) and Warning(s)";

            StyleHeaders(ws, "A1:E1", red: ["A1", "B1", "C1", "D1", "E1"], blue: Array.Empty<string>());

            for (int i = 0; i < errors.Count; i++)
            {
                int row = i + 2;
                ws.Cells[row, 1].Value = errors[i].ProjectId;
                ws.Cells[row, ColFPSource].Value = errors[i].Source;
                ws.Cells[row, ColFPAgreement].Value = errors[i].Agreement;
                SetCurrencyCell(ws.Cells[row, 4], errors[i].Amount);
                ws.Cells[row, 5].Value = errors[i].ErrorMessage;

                // Agreement is filtered to whichever Source is selected — correct for this row's
                // Source at generation time, re-pointed live by the macro if edited afterward.
                var sourceKey = SanitizeKey(errors[i].Source ?? string.Empty);
                AddListValidation(ws, row, ColFPAgreement, $"Agr_{sourceKey}");
            }

            // Project ID and Source are flat and applied to the whole column so a row added
            // later still gets the dropdown (see the matching comment in BuildProjectDetailsSheet).
            AddColumnListValidation(ws, 1, lookups.ProjectId);
            AddColumnListValidation(ws, ColFPSource, lookups.FundingSource);

            ws.Column(4).Style.Numberformat.Format = CurrencyFormat; // Amount — applies to blank/future cells too
            ws.Column(ColFPProjectIdHelper).Hidden = true;
            AutoFitWithCap(ws);
        }

        private static void BuildComponentDetailsSheet(ExcelPackage pkg, List<ImportComponentDetailsExcel> errors, LookupNames lookups, ImportLookupCache cache)
        {
            var ws = pkg.Workbook.Worksheets.Add("COMPONENT DETAILS");
            ws.Cells["A1"].Value = "Project ID";
            ws.Cells["B1"].Value = "Component Type";
            ws.Cells["C1"].Value = "Component ID";
            ws.Cells["D1"].Value = "Description";
            ws.Cells["E1"].Value = "Cost";
            ws.Cells["F1"].Value = "Planned Start Date";
            ws.Cells["G1"].Value = "Planned End Date";
            ws.Cells["H1"].Value = "Infrastructure Type";
            ws.Cells["I1"].Value = "Type of Work";
            ws.Cells["J1"].Value = "Activity Year";
            ws.Cells["K1"].Value = "Error(s) and Warning(s)";

            StyleHeaders(ws, "A1:K1",
                red: ["A1", "B1", "C1", "E1", "H1", "I1", "J1", "K1"],
                blue: ["D1", "F1", "G1"]);

            for (int i = 0; i < errors.Count; i++)
            {
                int row = i + 2;
                ws.Cells[row, 1].Value = errors[i].ProjectId;
                ws.Cells[row, ColCDComponentType].Value = errors[i].ComponentType;
                // The original uploaded value, not an auto-corrected one — the dropdown/live
                // auto-fill on Component Type change (AuthorCascadeMacros) is still there for
                // when the user actively edits, but the initial view should show what was
                // actually submitted, not something already silently fixed for them.
                ws.Cells[row, ColCDComponentId].Value = errors[i].ComponentId;
                ws.Cells[row, 4].Value = errors[i].Description;
                SetCurrencyCell(ws.Cells[row, 5], errors[i].Cost);
                ws.Cells[row, 6].Value = errors[i].StartDate;
                ws.Cells[row, 7].Value = errors[i].EndDate;
                ws.Cells[row, ColCDInfraType].Value = errors[i].InfraType;
                ws.Cells[row, ColCDWorkType].Value = errors[i].WorkTypeId;
                ws.Cells[row, 10].Value = errors[i].ActiveYear;
                ws.Cells[row, 11].Value = errors[i].ErrorMessage;

                // Component ID has no dropdown — it's auto-filled (above, and live by the macro
                // on Component Type change) rather than picked from a list.
                var infraKey = SanitizeKey(errors[i].InfraType ?? string.Empty);
                AddListValidation(ws, row, ColCDWorkType, $"Work_{infraKey}");
            }

            // Flat, applied to the whole column so a row added later still gets the dropdown.
            // Project ID here is chained off FUNDING PROFILE's own error rows, not PROJECT DETAILS.
            AddColumnListValidation(ws, 1, lookups.ProjectIdFromFundingProfile);
            AddColumnListValidation(ws, ColCDComponentType, lookups.ComponentType);
            AddColumnListValidation(ws, ColCDInfraType, lookups.InfraType);

            ws.Column(5).Style.Numberformat.Format = CurrencyFormat; // Cost — applies to blank/future cells too
            ws.Column(ColCDProjectIdHelper).Hidden = true;
            AutoFitWithCap(ws);
        }

        private static void BuildMajorItemsOfWorkSheet(ExcelPackage pkg, List<ImportMajorItemsOfWorkExcel> errors, LookupNames lookups)
        {
            var ws = pkg.Workbook.Worksheets.Add("MAJOR ITEMS OF WORK");
            ws.Cells["A1"].Value = "Project ID";
            ws.Cells["B1"].Value = "Component ID";
            ws.Cells["C1"].Value = "Reference ID";
            ws.Cells["D1"].Value = "Infrastructure ID";
            ws.Cells["E1"].Value = "Detailed Scope";
            ws.Cells["F1"].Value = "Target Unit";
            ws.Cells["G1"].Value = "Start X";
            ws.Cells["H1"].Value = "Start Y";
            ws.Cells["I1"].Value = "End X";
            ws.Cells["J1"].Value = "End Y";
            ws.Cells["K1"].Value = "Physical Target";
            ws.Cells["L1"].Value = "Start Station";
            ws.Cells["M1"].Value = "End Station";
            ws.Cells["N1"].Value = "Start Chainage (m)";
            ws.Cells["O1"].Value = "End Chainage (m)";
            ws.Cells["P1"].Value = "Length (meters)";
            ws.Cells["Q1"].Value = "Activity Year";
            ws.Cells["R1"].Value = "Error(s) and Warning(s)";

            StyleHeaders(ws, "A1:R1",
                red: ["A1", "B1", "C1", "D1", "F1", "G1", "H1", "I1", "J1", "K1", "R1"],
                blue: ["E1", "L1", "M1", "N1", "O1", "P1", "Q1"]);

            for (int i = 0; i < errors.Count; i++)
            {
                int row = i + 2;
                // The original uploaded values, not auto-corrected ones — the live auto-fill on
                // Project ID / Component ID change (AuthorCascadeMacros) is still there for when
                // the user actively edits, but the initial view should show what was actually
                // submitted, not something already silently fixed for them.
                ws.Cells[row, 1].Value = errors[i].ProjectId;
                ws.Cells[row, 2].Value = errors[i].ComponentId;
                ws.Cells[row, 3].Value = errors[i].ReferenceId;
                ws.Cells[row, 4].Value = errors[i].InfrastructureId;
                ws.Cells[row, 5].Value = errors[i].DetailsScope;
                ws.Cells[row, ColMWTargetUnit].Value = errors[i].TargetUnit;
                ws.Cells[row, 7].Value = errors[i].StartX;
                ws.Cells[row, 8].Value = errors[i].StartY;
                ws.Cells[row, 9].Value = errors[i].EndX;
                ws.Cells[row, 10].Value = errors[i].EndY;
                ws.Cells[row, 11].Value = errors[i].PhysicalTarget;
                ws.Cells[row, 12].Value = errors[i].StartStation;
                ws.Cells[row, 13].Value = errors[i].EndStation;
                ws.Cells[row, 14].Value = errors[i].StartChainage;
                ws.Cells[row, 15].Value = errors[i].EndChainage;
                ws.Cells[row, 16].Value = errors[i].Length;
                ws.Cells[row, 17].Value = errors[i].ActivityYear;
                ws.Cells[row, 18].Value = errors[i].ErrorMessage;

                // Component ID is filtered to whichever Project ID is on this row — correct for
                // this row's Project ID at generation time, re-pointed live by the macro if
                // Project ID is edited afterward (or Component Details gains new components).
                var projectKey = SanitizeKey(errors[i].ProjectId ?? string.Empty);
                AddListValidation(ws, row, 2, $"CompId_{projectKey}");
            }

            // Flat, applied to the whole column so a row added later still gets the dropdown.
            // Project ID here is chained off COMPONENT DETAILS' own error rows.
            AddColumnListValidation(ws, 1, lookups.ProjectIdFromComponentDetails);

            // Target Unit is flat, not cascaded: the valid set actually depends on the sibling
            // COMPONENT DETAILS row's Work Type (matched via ProjectId+ComponentId), which
            // isn't available here — this workbook only carries each sheet's own error rows.
            AddColumnListValidation(ws, ColMWTargetUnit, lookups.TargetUnit);

            ws.Column(ColMWProjectIdHelper).Hidden = true;
            ws.Cells[1, ColMWComponentIdHelperStart, 1, ColMWComponentIdHelperStart + 300].EntireColumn.Hidden = true;
            AutoFitWithCap(ws);
        }

        // Autofits then clamps every column to MaxColumnWidth, wrapping any column that got
        // clamped so its full text is still reachable (multi-line) instead of being cut off.
        private static void AutoFitWithCap(ExcelWorksheet ws)
        {
            if (ws.Dimension == null) return;
            ws.Cells[ws.Dimension.Address].AutoFitColumns();

            for (int col = 1; col <= ws.Dimension.End.Column; col++)
            {
                var column = ws.Column(col);
                if (column.Width > MaxColumnWidth)
                {
                    column.Width = MaxColumnWidth;
                    ws.Cells[1, col, ws.Dimension.End.Row, col].Style.WrapText = true;
                }
            }
        }

        private static void StyleHeaders(ExcelWorksheet ws, string range, string[] red, string[] blue)
        {
            foreach (var c in red)
            {
                ws.Cells[c].Style.Fill.PatternType = ExcelFillStyle.Solid;
                ws.Cells[c].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.SkyBlue);
            }
            foreach (var c in blue)
            {
                ws.Cells[c].Style.Fill.PatternType = ExcelFillStyle.Solid;
                ws.Cells[c].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.SkyBlue);
            }
            ws.Cells[range].Style.Font.Bold = true;
            ws.Cells[range].Style.Font.Color.SetColor(System.Drawing.Color.White);
        }

        // ── Cascade macros ────────────────────────────────────────────────────────
        // Adapted from the reference template's cascade mechanism (Module_ProjectCascade.bas /
        // Sheet3.cls in Imp_BP-HGAB_Final.xlsm): on a parent cell's Worksheet_Change, rewrite
        // the dependent cell's Validation.Formula1 to point at the pre-built static named range
        // for the new parent value, and clear the dependent's stale value. A shared standard
        // module (ModuleShared) holds the key-sanitizer and the apply/clear helper so all three
        // sheet code modules can call into it.
        private static void AuthorCascadeMacros(ExcelPackage pkg)
        {
            var shared = pkg.Workbook.VbaProject.Modules.AddModule("ModuleShared");
            shared.Code = $@"
Option Explicit

Public Function MakeValidName(ByVal s As String) As String
    Dim t As String, i As Long, ch As String, out As String

    t = Trim$(s)
    t = Replace(t, "" "", ""_"")
    t = Replace(t, ""-"", ""_"")
    t = Replace(t, ""/"", ""_"")
    t = Replace(t, ""."", ""_"")
    t = Replace(t, ""("", ""_"")
    t = Replace(t, "")"", ""_"")
    t = Replace(t, ""&"", ""_"")
    t = Replace(t, "","", ""_"")
    t = Replace(t, ""'"", """")

    out = """"
    For i = 1 To Len(t)
        ch = Mid$(t, i, 1)
        If ch Like ""[A-Za-z0-9_]"" Then out = out & ch
    Next i

    If Len(out) = 0 Then out = ""X""
    If Left$(out, 1) Like ""[0-9]"" Then out = ""N_"" & out

    MakeValidName = out
End Function

Public Sub ApplyCascadeCell(ByVal targetCell As Range, ByVal rangeName As String)
    targetCell.ClearContents
    On Error Resume Next
    targetCell.Validation.Delete
    On Error GoTo 0
    With targetCell.Validation
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Operator:=xlBetween, Formula1:=""="" & rangeName
        .IgnoreBlank = True
        .InCellDropdown = True
    End With
End Sub

Public Sub ReplaceName(ByVal nm As String, ByVal refersTo As String)
    On Error Resume Next
    ThisWorkbook.Names(nm).Delete
    On Error GoTo 0
    ThisWorkbook.Names.Add Name:=nm, RefersTo:=refersTo
End Sub

' Rescans sourceSheetName's sourceCol for its current distinct, non-blank values, stages them
' in targetWs's helperCol (a column reserved only for this), replaces rangeName to point at that
' staged list, then applies it as a dropdown across targetWs's targetCol (rows 2-100000) — so the
' dropdown always reflects whatever is currently typed in the source sheet, not a build-time snapshot.
Public Sub RebuildProjectIdDropdown(ByVal targetWs As Worksheet, ByVal targetCol As Long, _
                                     ByVal helperCol As Long, ByVal sourceSheetName As String, _
                                     ByVal sourceCol As Long, ByVal rangeName As String)
    Dim wsSrc As Worksheet
    On Error Resume Next
    Set wsSrc = ThisWorkbook.Worksheets(sourceSheetName)
    On Error GoTo 0
    If wsSrc Is Nothing Then Exit Sub

    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.count, sourceCol).End(xlUp).Row

    Dim dict As Object
    Set dict = CreateObject(""Scripting.Dictionary"")

    Dim r As Long, v As String
    If lastRow >= 2 Then
        For r = 2 To lastRow
            v = Trim$(CStr(wsSrc.Cells(r, sourceCol).Value))
            If Len(v) > 0 Then
                If Not dict.Exists(v) Then dict.Add v, 1
            End If
        Next r
    End If

    targetWs.Columns(helperCol).ClearContents

    If dict.count = 0 Then
        targetWs.Cells(2, helperCol).Value = """"
        ReplaceName rangeName, ""="" & targetWs.Cells(2, helperCol).Address(True, True, xlA1, True)
    Else
        Dim k As Variant, i As Long
        i = 2
        For Each k In dict.Keys
            targetWs.Cells(i, helperCol).Value = k
            i = i + 1
        Next k
        ReplaceName rangeName, ""="" & targetWs.Range(targetWs.Cells(2, helperCol), targetWs.Cells(i - 1, helperCol)).Address(True, True, xlA1, True)
    End If

    With targetWs.Range(targetWs.Cells(2, targetCol), targetWs.Cells(100000, targetCol))
        On Error Resume Next
        .Validation.Delete
        On Error GoTo 0
        .Validation.Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Operator:=xlBetween, Formula1:=""="" & rangeName
        .Validation.IgnoreBlank = True
        .Validation.InCellDropdown = True
    End With
End Sub

' Case-insensitive lookup of a Component Type's base Component ID from the ComponentTypeNames /
' ComponentTypeIds parallel named ranges built at generation time. Returns """" if not found.
Public Function LookupComponentBaseId(ByVal typeName As String) As String
    On Error GoTo NotFound
    Dim rngNames As Range, rngIds As Range
    Set rngNames = ThisWorkbook.Names(""ComponentTypeNames"").RefersToRange
    Set rngIds = ThisWorkbook.Names(""ComponentTypeIds"").RefersToRange

    Dim i As Long
    For i = 1 To rngNames.Cells.count
        If StrComp(Trim$(CStr(rngNames.Cells(i, 1).Value)), Trim$(typeName), vbTextCompare) = 0 Then
            LookupComponentBaseId = CStr(rngIds.Cells(i, 1).Value)
            Exit Function
        End If
    Next i

NotFound:
    LookupComponentBaseId = """"
End Function

' Next CW suffix number for Civil Works rows sharing the same Project ID on ws — one past the
' highest existing ""CW<n>"" already present in idCol for that Project ID (excluding currentRow),
' matching ValidateComponentDetails' own numbering rule exactly.
Public Function NextCivilWorksNumber(ByVal ws As Worksheet, ByVal currentRow As Long, _
                                      ByVal projectCol As Long, ByVal typeCol As Long, _
                                      ByVal idCol As Long) As Long
    Dim projectId As String
    projectId = Trim$(CStr(ws.Cells(currentRow, projectCol).Value))

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.count, projectCol).End(xlUp).Row

    Dim maxN As Long: maxN = 0
    Dim r As Long
    For r = 2 To lastRow
        If r <> currentRow Then
            If StrComp(Trim$(CStr(ws.Cells(r, projectCol).Value)), projectId, vbTextCompare) = 0 Then
                If StrComp(Trim$(CStr(ws.Cells(r, typeCol).Value)), ""Civil Works"", vbTextCompare) = 0 Then
                    Dim v As String
                    v = UCase$(Trim$(CStr(ws.Cells(r, idCol).Value)))
                    If Left$(v, 2) = ""CW"" And Len(v) > 2 And IsNumeric(Mid$(v, 3)) Then
                        Dim n As Long: n = CLng(val(Mid$(v, 3)))
                        If n > maxN Then maxN = n
                    End If
                End If
            End If
        End If
    Next r

    NextCivilWorksNumber = maxN + 1
End Function

' Rescans COMPONENT DETAILS for (ProjectId, ComponentId) pairs, grouping Component IDs by
' Project ID, and replaces one ""CompId_<key>"" named range per Project ID found — same idea as
' RebuildProjectIdDropdown, but one list per key instead of a single flat list, since Major Items
' of Work's Component ID choices depend on which row's Project ID they're on.
Public Sub RebuildComponentIdGroups(ByVal targetWs As Worksheet, ByVal helperStartCol As Long)
    Dim wsCC As Worksheet
    On Error Resume Next
    Set wsCC = ThisWorkbook.Worksheets(""COMPONENT DETAILS"")
    On Error GoTo 0
    If wsCC Is Nothing Then Exit Sub

    Dim lastRow As Long
    lastRow = wsCC.Cells(wsCC.Rows.count, 1).End(xlUp).Row

    Const maxKeys As Long = 300
    targetWs.Range(targetWs.Cells(1, helperStartCol), targetWs.Cells(100000, helperStartCol + maxKeys)).ClearContents

    Dim dict As Object
    Set dict = CreateObject(""Scripting.Dictionary"") ' key -> Dictionary of ComponentIds

    Dim r As Long, proj As String, cid As String, key As String
    If lastRow >= 2 Then
        For r = 2 To lastRow
            proj = Trim$(CStr(wsCC.Cells(r, 1).Value))
            cid = Trim$(CStr(wsCC.Cells(r, 3).Value))
            If Len(proj) > 0 And Len(cid) > 0 Then
                key = ModuleShared.MakeValidName(proj)
                If Not dict.Exists(key) Then Set dict(key) = CreateObject(""Scripting.Dictionary"")
                If Not dict(key).Exists(cid) Then dict(key).Add cid, 1
            End If
        Next r
    End If

    Dim col As Long: col = helperStartCol
    Dim k As Variant, idKey As Variant
    For Each k In dict.Keys
        Dim ids As Object: Set ids = dict(k)
        Dim i As Long: i = 1
        For Each idKey In ids.Keys
            targetWs.Cells(i, col).Value = idKey
            i = i + 1
        Next idKey

        ReplaceName ""CompId_"" & CStr(k), ""="" & targetWs.Range(targetWs.Cells(1, col), targetWs.Cells(ids.count, col)).Address(True, True, xlA1, True)
        col = col + 1
        If col > helperStartCol + maxKeys Then Exit For
    Next k
End Sub

' Reference ID = ""ProjectId-ComponentId"" — matches ValidateMajorItemsOfWork's own expected
' format exactly (ImportingHelper.cs). Cleared, not guessed, whenever either half is blank.
Public Sub UpdateReferenceId(ByVal ws As Worksheet, ByVal rowNum As Long)
    Dim proj As String: proj = Trim$(CStr(ws.Cells(rowNum, 1).Value))
    Dim cid As String: cid = Trim$(CStr(ws.Cells(rowNum, 2).Value))

    If Len(proj) > 0 And Len(cid) > 0 Then
        ws.Cells(rowNum, 3).Value = proj & ""-"" & cid
    Else
        ws.Cells(rowNum, 3).ClearContents
    End If
End Sub

' Resolves an Infrastructure Type name + Type of Work (ScopeOfWork Description) to its Measure,
' via the InfraTypeNames/InfraTypeCodes and ScopeOfWorkDescriptions/ScopeOfWorkInfraCodes/
' ScopeOfWorkMeasures parallel tables built at generation time. ScopeOfWorkInfraCodes stores each
' row's infra codes pipe-delimited (e.g. ""R|LR""), checked via a padded-with-pipes InStr so a
' short code can't false-match inside a longer one.
Public Function ResolveMeasure(ByVal infraTypeName As String, ByVal workType As String) As String
    ResolveMeasure = """"
    On Error GoTo Done

    Dim infraCode As String: infraCode = """"
    Dim rn As Range: Set rn = ThisWorkbook.Names(""InfraTypeNames"").RefersToRange
    Dim rc As Range: Set rc = ThisWorkbook.Names(""InfraTypeCodes"").RefersToRange
    Dim i As Long
    For i = 1 To rn.Cells.count
        If StrComp(Trim$(CStr(rn.Cells(i, 1).Value)), infraTypeName, vbTextCompare) = 0 Then
            infraCode = Trim$(CStr(rc.Cells(i, 1).Value))
            Exit For
        End If
    Next i
    If Len(infraCode) = 0 Then Exit Function

    Dim rd As Range: Set rd = ThisWorkbook.Names(""ScopeOfWorkDescriptions"").RefersToRange
    Dim ri As Range: Set ri = ThisWorkbook.Names(""ScopeOfWorkInfraCodes"").RefersToRange
    Dim rm As Range: Set rm = ThisWorkbook.Names(""ScopeOfWorkMeasures"").RefersToRange
    For i = 1 To rd.Cells.count
        If StrComp(Trim$(CStr(rd.Cells(i, 1).Value)), workType, vbTextCompare) = 0 Then
            If InStr(1, ""|"" & CStr(ri.Cells(i, 1).Value) & ""|"", ""|"" & infraCode & ""|"", vbTextCompare) > 0 Then
                ResolveMeasure = Trim$(CStr(rm.Cells(i, 1).Value))
                Exit Function
            End If
        End If
    Next i

Done:
End Function

' Looks up the sibling COMPONENT DETAILS row (matched by Project ID + Component ID) and resolves
' its Infrastructure Type + Type of Work to a Target Unit via ResolveMeasure. Returns """" if
' either ID is blank, no sibling row is found, or it doesn't resolve to a real ScopeOfWork entry.
Public Function LookupTargetUnit(ByVal projectId As String, ByVal componentId As String) As String
    LookupTargetUnit = """"
    If Len(projectId) = 0 Or Len(componentId) = 0 Then Exit Function

    Dim wsCD As Worksheet
    On Error Resume Next
    Set wsCD = ThisWorkbook.Worksheets(""COMPONENT DETAILS"")
    On Error GoTo 0
    If wsCD Is Nothing Then Exit Function

    Dim lastRow As Long
    lastRow = wsCD.Cells(wsCD.Rows.count, 1).End(xlUp).Row

    Dim r As Long
    For r = 2 To lastRow
        If StrComp(Trim$(CStr(wsCD.Cells(r, 1).Value)), projectId, vbTextCompare) = 0 And _
           StrComp(Trim$(CStr(wsCD.Cells(r, 3).Value)), componentId, vbTextCompare) = 0 Then
            Dim infraType As String, workType As String
            infraType = Trim$(CStr(wsCD.Cells(r, {ColCDInfraType}).Value))
            workType = Trim$(CStr(wsCD.Cells(r, {ColCDWorkType}).Value))
            If Len(infraType) > 0 And Len(workType) > 0 Then
                LookupTargetUnit = ResolveMeasure(infraType, workType)
            End If
            Exit Function
        End If
    Next r
End Function

' Sets or clears Target Unit (col F) on a MAJOR ITEMS OF WORK row, from its Project ID + Component ID.
Public Sub UpdateTargetUnit(ByVal ws As Worksheet, ByVal rowNum As Long)
    Dim proj As String: proj = Trim$(CStr(ws.Cells(rowNum, 1).Value))
    Dim cid As String: cid = Trim$(CStr(ws.Cells(rowNum, 2).Value))
    Dim tu As String: tu = LookupTargetUnit(proj, cid)

    If Len(tu) > 0 Then
        ws.Cells(rowNum, {ColMWTargetUnit}).Value = tu
    Else
        ws.Cells(rowNum, {ColMWTargetUnit}).ClearContents
    End If
End Sub

' Called from COMPONENT DETAILS when Infrastructure Type or Type of Work changes: re-resolves
' Target Unit on every MAJOR ITEMS OF WORK row referencing this same Project ID + Component ID.
Public Sub PropagateTargetUnit(ByVal projectId As String, ByVal componentId As String)
    If Len(projectId) = 0 Or Len(componentId) = 0 Then Exit Sub

    Dim wsMIW As Worksheet
    On Error Resume Next
    Set wsMIW = ThisWorkbook.Worksheets(""MAJOR ITEMS OF WORK"")
    On Error GoTo 0
    If wsMIW Is Nothing Then Exit Sub

    Dim lastRow As Long
    lastRow = wsMIW.Cells(wsMIW.Rows.count, 1).End(xlUp).Row

    Dim r As Long
    For r = 2 To lastRow
        If StrComp(Trim$(CStr(wsMIW.Cells(r, 1).Value)), projectId, vbTextCompare) = 0 And _
           StrComp(Trim$(CStr(wsMIW.Cells(r, 2).Value)), componentId, vbTextCompare) = 0 Then
            UpdateTargetUnit wsMIW, r
        End If
    Next r
End Sub

' Looks up the sibling COMPONENT DETAILS row's Activity Year (col J) for the given Project ID +
' Component ID. Returns """" if either ID is blank or no sibling row is found.
Public Function LookupActivityYear(ByVal projectId As String, ByVal componentId As String) As String
    LookupActivityYear = """"
    If Len(projectId) = 0 Or Len(componentId) = 0 Then Exit Function

    Dim wsCD As Worksheet
    On Error Resume Next
    Set wsCD = ThisWorkbook.Worksheets(""COMPONENT DETAILS"")
    On Error GoTo 0
    If wsCD Is Nothing Then Exit Function

    Dim lastRow As Long
    lastRow = wsCD.Cells(wsCD.Rows.count, 1).End(xlUp).Row

    Dim r As Long
    For r = 2 To lastRow
        If StrComp(Trim$(CStr(wsCD.Cells(r, 1).Value)), projectId, vbTextCompare) = 0 And _
           StrComp(Trim$(CStr(wsCD.Cells(r, 3).Value)), componentId, vbTextCompare) = 0 Then
            LookupActivityYear = Trim$(CStr(wsCD.Cells(r, 10).Value))
            Exit Function
        End If
    Next r
End Function

' Sets or clears Activity Year (col Q) on a MAJOR ITEMS OF WORK row, from its Project ID +
' Component ID. A plain editable value, not a dropdown — see the comment on ResolveActivityYear
' in the C# builder for why (ValidateMajorItemsOfWork only requires >=, not an exact match).
Public Sub UpdateActivityYear(ByVal ws As Worksheet, ByVal rowNum As Long)
    Dim proj As String: proj = Trim$(CStr(ws.Cells(rowNum, 1).Value))
    Dim cid As String: cid = Trim$(CStr(ws.Cells(rowNum, 2).Value))
    Dim yr As String: yr = LookupActivityYear(proj, cid)

    If Len(yr) > 0 Then
        ws.Cells(rowNum, 17).Value = yr
    Else
        ws.Cells(rowNum, 17).ClearContents
    End If
End Sub

' Called from COMPONENT DETAILS when its own Activity Year changes: re-resolves Activity Year on
' every MAJOR ITEMS OF WORK row referencing this same Project ID + Component ID.
Public Sub PropagateActivityYear(ByVal projectId As String, ByVal componentId As String)
    If Len(projectId) = 0 Or Len(componentId) = 0 Then Exit Sub

    Dim wsMIW As Worksheet
    On Error Resume Next
    Set wsMIW = ThisWorkbook.Worksheets(""MAJOR ITEMS OF WORK"")
    On Error GoTo 0
    If wsMIW Is Nothing Then Exit Sub

    Dim lastRow As Long
    lastRow = wsMIW.Cells(wsMIW.Rows.count, 1).End(xlUp).Row

    Dim r As Long
    For r = 2 To lastRow
        If StrComp(Trim$(CStr(wsMIW.Cells(r, 1).Value)), projectId, vbTextCompare) = 0 And _
           StrComp(Trim$(CStr(wsMIW.Cells(r, 2).Value)), componentId, vbTextCompare) = 0 Then
            UpdateActivityYear wsMIW, r
        End If
    Next r
End Sub

' If cell's own value duplicates another row's value in the same column on ws, warns and clears
' cell (keeping whichever row had it first). Used on PROJECT DETAILS' Project ID column, where —
' unlike the other three sheets — each row must be a distinct project.
Public Sub CheckDuplicateProjectId(ByVal ws As Worksheet, ByVal cell As Range, ByVal projectIdCol As Long)
    Dim newID As String: newID = Trim$(CStr(cell.Value))
    If Len(newID) = 0 Then Exit Sub

    Dim lastDataRow As Long
    lastDataRow = ws.Cells(ws.Rows.count, projectIdCol).End(xlUp).Row

    Dim chkRow As Long
    For chkRow = 2 To lastDataRow
        If chkRow <> cell.Row Then
            If StrComp(Trim$(CStr(ws.Cells(chkRow, projectIdCol).Value)), newID, vbTextCompare) = 0 Then
                MsgBox ""Duplicate Project ID '"" & newID & ""' found in row "" & chkRow & ""."" & vbNewLine & _
                       ""The value in row "" & cell.Row & "" has been cleared."", vbExclamation, ""Duplicate Project ID""
                cell.ClearContents
                Exit For
            End If
        End If
    Next chkRow
End Sub
".Replace("\r\n", "\n");

            // Pre-save mandatory-field gate, adapted from the reference template's Module7.bas /
            // ThisWorkbook.Workbook_BeforeSave (MandatoryFieldsMessage_All). Required columns
            // below are the same ones already marked required (red header) by StyleHeaders in
            // each Build*Sheet method. Also includes the reference's cross-sheet relational
            // checks (Project needs a Funding Profile + Component Details entry, Component needs
            // a Major Item) — safe to port because ImportProjectJobService.FinalizeErrors already
            // cascades every related row for a problem Project ID into the error lists across all
            // four sheets, so this workbook does carry each flagged project's full row set, not
            // just the individually-failed rows.
            //
            // The Major-Item exemption list (component types that don't need a physical Major
            // Item) mirrors the reference's own list, matched against our live
            // tOptionProjectComponentType.ComponentId codes rather than hardcoded reference
            // strings: EAO/EAOS (admin overhead), EXC (Excess), SAV (Savings), CoS (Consultancy),
            // FS (Feasibility Study), DED (Detailed Engineering Design), LS (Lump Sum),
            // OTH2-4 (Institutional Capacity/Training/LGU Assistance), EXP (Expired Funding),
            // CS (Construction Supervision). Right of Way (ROW/ROW2) and Civil Works/Design
            // (CW/CWD/DR) are deliberately NOT exempted, matching the reference's own choice —
            // those component types do carry trackable physical/location items.
            var mandatory = pkg.Workbook.VbaProject.Modules.AddModule("ModuleMandatory");
            mandatory.Code = $@"
Option Explicit

Public Function MandatoryFieldsMessage_All(ByRef firstBad As Range) As String
    Dim issues As Collection
    Set issues = New Collection

    CollectMissingSheet ThisWorkbook.Worksheets(""PROJECT DETAILS""), _
        Array(1, 5, 6, 7, 9, {ColProvince}, {ColCity}, {ColDistrict}, {ColRegion}, {ColDeo}, {ColImplOffice}, {ColOpUnit}, 17, 18, 19, 20, 21, 22, 23, 25), _
        issues, firstBad

    CollectMissingSheet ThisWorkbook.Worksheets(""FUNDING PROFILE""), _
        Array(1, {ColFPSource}, {ColFPAgreement}, 4), issues, firstBad

    CollectMissingSheet ThisWorkbook.Worksheets(""COMPONENT DETAILS""), _
        Array(1, {ColCDComponentType}, {ColCDComponentId}, 5, {ColCDInfraType}, {ColCDWorkType}, 10), issues, firstBad

    CollectMissingSheet ThisWorkbook.Worksheets(""MAJOR ITEMS OF WORK""), _
        Array(1, 2, 3, 4, {ColMWTargetUnit}, 7, 8, 11), issues, firstBad

    '========================================
    ' Per-Project Relational Validation
    '========================================
    Dim wsProject As Worksheet, wsFunding As Worksheet, wsComponent As Worksheet, wsMajor As Worksheet
    Set wsProject = ThisWorkbook.Worksheets(""PROJECT DETAILS"")
    Set wsFunding = ThisWorkbook.Worksheets(""FUNDING PROFILE"")
    Set wsComponent = ThisWorkbook.Worksheets(""COMPONENT DETAILS"")
    Set wsMajor = ThisWorkbook.Worksheets(""MAJOR ITEMS OF WORK"")

    Dim dictFunding As Object, dictComponent As Object
    Set dictFunding = CreateObject(""Scripting.Dictionary"")
    Set dictComponent = CreateObject(""Scripting.Dictionary"")

    Dim r As Long, lastRow As Long, pid As String

    lastRow = wsFunding.Cells(wsFunding.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        pid = UCase(Trim$(CStr(wsFunding.Cells(r, 1).Value)))
        If Len(pid) > 0 Then dictFunding(pid) = True
    Next r

    lastRow = wsComponent.Cells(wsComponent.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        pid = UCase(Trim$(CStr(wsComponent.Cells(r, 1).Value)))
        If Len(pid) > 0 Then dictComponent(pid) = True
    Next r

    lastRow = wsProject.Cells(wsProject.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        pid = UCase(Trim$(CStr(wsProject.Cells(r, 1).Value)))
        If Len(pid) = 0 Then GoTo NextProject

        If Not dictFunding.Exists(pid) Then
            issues.Add ""Project ID '"" & pid & ""' has no Funding Profile entry.""
            If firstBad Is Nothing Then Set firstBad = wsProject.Cells(r, 1)
        End If
        If Not dictComponent.Exists(pid) Then
            issues.Add ""Project ID '"" & pid & ""' has no Component Details entry.""
            If firstBad Is Nothing Then Set firstBad = wsProject.Cells(r, 1)
        End If
NextProject:
    Next r

    '========================================
    ' Component -> Major Item Validation
    '========================================
    Dim excluded As Object
    Set excluded = CreateObject(""Scripting.Dictionary"")
    Dim ex As Variant
    For Each ex In Array(""EAO"", ""EAOS"", ""EXC"", ""SAV"", ""COS"", ""FS"", ""DED"", ""LS"", ""OTH2"", ""OTH3"", ""OTH4"", ""EXP"", ""CS"")
        excluded(ex) = True
    Next ex

    Dim dictMajor As Object
    Set dictMajor = CreateObject(""Scripting.Dictionary"")
    lastRow = wsMajor.Cells(wsMajor.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        Dim mProj As String, mComp As String
        mProj = Trim$(CStr(wsMajor.Cells(r, 1).Value))
        mComp = Trim$(CStr(wsMajor.Cells(r, 2).Value))
        If Len(mProj) > 0 And Len(mComp) > 0 Then dictMajor(UCase(mProj) & ""|"" & UCase(mComp)) = True
    Next r

    lastRow = wsComponent.Cells(wsComponent.Rows.Count, 1).End(xlUp).Row
    For r = 2 To lastRow
        Dim cProj As String, cComp As String
        cProj = Trim$(CStr(wsComponent.Cells(r, 1).Value))
        cComp = Trim$(CStr(wsComponent.Cells(r, {ColCDComponentId}).Value))
        If Len(cProj) = 0 Or Len(cComp) = 0 Then GoTo NextComponent
        If excluded.Exists(UCase(cComp)) Then GoTo NextComponent

        If Not dictMajor.Exists(UCase(cProj) & ""|"" & UCase(cComp)) Then
            issues.Add ""Component '"" & cComp & ""' under Project '"" & cProj & ""' requires at least 1 Major Item.""
            If firstBad Is Nothing Then Set firstBad = wsComponent.Cells(r, {ColCDComponentId})
        End If
NextComponent:
    Next r

    If issues.Count = 0 Then
        MandatoryFieldsMessage_All = vbNullString
        Exit Function
    End If

    Dim msg As String, i As Long
    Dim maxShow As Long: maxShow = 30

    msg = ""Cannot save. Please populate the required fields below:"" & vbCrLf & vbCrLf
    For i = 1 To Application.Min(maxShow, issues.Count)
        msg = msg & ""- "" & issues(i) & vbCrLf
    Next i
    If issues.Count > maxShow Then
        msg = msg & ""...and "" & (issues.Count - maxShow) & "" more."" & vbCrLf
    End If
    msg = msg & vbCrLf & ""You will be taken to the first missing cell.""

    MandatoryFieldsMessage_All = msg
End Function

Private Sub CollectMissingSheet(ByVal ws As Worksheet, ByVal requiredCols As Variant, _
                                ByRef issues As Collection, ByRef firstBad As Range)
    Dim maxReqCol As Long, c As Variant, colNum As Long
    For Each c In requiredCols
        If CLng(c) > maxReqCol Then maxReqCol = CLng(c)
    Next c

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Dim r As Long
    For r = 2 To lastRow
        If Application.WorksheetFunction.CountA(ws.Range(ws.Cells(r, 1), ws.Cells(r, maxReqCol))) = 0 Then GoTo NextRow

        For Each c In requiredCols
            colNum = CLng(c)
            If Len(Trim$(CStr(ws.Cells(r, colNum).Value))) = 0 Then
                If firstBad Is Nothing Then Set firstBad = ws.Cells(r, colNum)

                Dim fieldName As String
                fieldName = Trim$(CStr(ws.Cells(1, colNum).Value))
                If Left$(fieldName, 1) = ""*"" Then fieldName = Trim$(Mid$(fieldName, 2))
                If Right$(fieldName, 1) = "":"" Then fieldName = Trim$(Left$(fieldName, Len(fieldName) - 1))
                If Len(fieldName) = 0 Then fieldName = ""Column "" & colNum

                issues.Add ""Populate "" & fieldName & "" Row "" & r & "", "" & ws.Name & "" sheet.""
            End If
        Next c

NextRow:
    Next r
End Sub
".Replace("\r\n", "\n");

            pkg.Workbook.CodeModule.Code = $@"
Private Sub Workbook_BeforeSave(ByVal SaveAsUI As Boolean, Cancel As Boolean)
    Dim firstBad As Range
    Dim msg As String
    msg = ModuleMandatory.MandatoryFieldsMessage_All(firstBad)

    If Len(msg) > 0 Then
        Cancel = True
        MsgBox msg, vbExclamation, ""Missing required fields""
        If Not firstBad Is Nothing Then Application.Goto firstBad, True
    End If
End Sub
".Replace("\r\n", "\n");

            var projectDetails = pkg.Workbook.Worksheets["PROJECT DETAILS"];
            projectDetails.CodeModule.Code = $@"
Private Sub Worksheet_Change(ByVal Target As Range)
    If Target.Cells.Count > 1 Then Exit Sub
    If Target.Row < 2 Then Exit Sub

    On Error GoTo CleanUp
    Application.EnableEvents = False

    If Target.Column = 1 Then
        ModuleShared.CheckDuplicateProjectId Me, Target, 1

    ElseIf Target.Column = {ColProvince} Then
        Dim key As String
        key = ModuleShared.MakeValidName(CStr(Target.Value))

        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColCity}), ""City_"" & key
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColDistrict}), ""Dist_"" & key
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColRegion}), ""Reg_"" & key
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColDeo}), ""Deo_"" & key
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColImplOffice}), ""ImplOff_"" & key
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColOpUnit}), ""OpUnit_"" & key
    End If

CleanUp:
    Application.EnableEvents = True
End Sub
".Replace("\r\n", "\n");

            var fundingProfile = pkg.Workbook.Worksheets["FUNDING PROFILE"];
            fundingProfile.CodeModule.Code = $@"
Private Sub Worksheet_Activate()
    On Error Resume Next
    ModuleShared.RebuildProjectIdDropdown Me, 1, {ColFPProjectIdHelper}, ""PROJECT DETAILS"", 1, ""Lookup_ProjectId""
    On Error GoTo 0
End Sub

Private Sub Worksheet_Change(ByVal Target As Range)
    If Target.Cells.Count > 1 Then Exit Sub
    If Target.Row < 2 Then Exit Sub
    If Target.Column <> {ColFPSource} Then Exit Sub

    On Error GoTo CleanUp
    Application.EnableEvents = False

    Dim key As String
    key = ModuleShared.MakeValidName(CStr(Target.Value))
    ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColFPAgreement}), ""Agr_"" & key

CleanUp:
    Application.EnableEvents = True
End Sub
".Replace("\r\n", "\n");

            var componentDetails = pkg.Workbook.Worksheets["COMPONENT DETAILS"];
            componentDetails.CodeModule.Code = $@"
Private Sub Worksheet_Activate()
    On Error Resume Next
    ModuleShared.RebuildProjectIdDropdown Me, 1, {ColCDProjectIdHelper}, ""FUNDING PROFILE"", 1, ""Lookup_ProjectId_FP""
    On Error GoTo 0
End Sub

Private Sub Worksheet_Change(ByVal Target As Range)
    If Target.Cells.Count > 1 Then Exit Sub
    If Target.Row < 2 Then Exit Sub

    On Error GoTo CleanUp
    Application.EnableEvents = False

    If Target.Column = {ColCDInfraType} Then
        Dim key As String
        key = ModuleShared.MakeValidName(CStr(Target.Value))
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, {ColCDWorkType}), ""Work_"" & key
        ModuleShared.PropagateTargetUnit CStr(Me.Cells(Target.Row, 1).Value), CStr(Me.Cells(Target.Row, {ColCDComponentId}).Value)

    ElseIf Target.Column = {ColCDWorkType} Then
        ModuleShared.PropagateTargetUnit CStr(Me.Cells(Target.Row, 1).Value), CStr(Me.Cells(Target.Row, {ColCDComponentId}).Value)

    ElseIf Target.Column = {ColCDComponentType} Then
        Dim typ As String
        typ = Trim$(CStr(Target.Value))

        If Len(typ) = 0 Then
            Me.Cells(Target.Row, {ColCDComponentId}).ClearContents
        ElseIf StrComp(typ, ""{CivilWorksComponentTypeName}"", vbTextCompare) = 0 Then
            Me.Cells(Target.Row, {ColCDComponentId}).Value = ""CW"" & ModuleShared.NextCivilWorksNumber(Me, Target.Row, 1, {ColCDComponentType}, {ColCDComponentId})
        Else
            Dim baseId As String
            baseId = ModuleShared.LookupComponentBaseId(typ)
            If Len(baseId) > 0 Then
                Me.Cells(Target.Row, {ColCDComponentId}).Value = baseId
            Else
                Me.Cells(Target.Row, {ColCDComponentId}).ClearContents
            End If
        End If

    ElseIf Target.Column = 10 Then
        ModuleShared.PropagateActivityYear CStr(Me.Cells(Target.Row, 1).Value), CStr(Me.Cells(Target.Row, {ColCDComponentId}).Value)
    End If

CleanUp:
    Application.EnableEvents = True
End Sub
".Replace("\r\n", "\n");

            var majorItemsOfWork = pkg.Workbook.Worksheets["MAJOR ITEMS OF WORK"];
            majorItemsOfWork.CodeModule.Code = $@"
Private Sub Worksheet_Activate()
    On Error Resume Next
    ModuleShared.RebuildProjectIdDropdown Me, 1, {ColMWProjectIdHelper}, ""COMPONENT DETAILS"", 1, ""Lookup_ProjectId_CD""
    ModuleShared.RebuildComponentIdGroups Me, {ColMWComponentIdHelperStart}
    On Error GoTo 0
End Sub

Private Sub Worksheet_Change(ByVal Target As Range)
    If Target.Cells.Count > 1 Then Exit Sub
    If Target.Row < 2 Then Exit Sub

    On Error GoTo CleanUp
    Application.EnableEvents = False

    If Target.Column = 1 Then
        Dim key As String
        key = ModuleShared.MakeValidName(CStr(Target.Value))
        ModuleShared.ApplyCascadeCell Me.Cells(Target.Row, 2), ""CompId_"" & key
        ModuleShared.UpdateReferenceId Me, Target.Row
        ModuleShared.UpdateTargetUnit Me, Target.Row
        ModuleShared.UpdateActivityYear Me, Target.Row
    ElseIf Target.Column = 2 Then
        ModuleShared.UpdateReferenceId Me, Target.Row
        ModuleShared.UpdateTargetUnit Me, Target.Row
        ModuleShared.UpdateActivityYear Me, Target.Row
    End If

CleanUp:
    Application.EnableEvents = True
End Sub
".Replace("\r\n", "\n");
        }
    }
}
