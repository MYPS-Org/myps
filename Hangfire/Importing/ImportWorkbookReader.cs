using OfficeOpenXml;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Hangfire.Importing
{
    /// <summary>
    /// Reads the four import sheets of a MYPS import workbook into the row shapes
    /// <see cref="ImportingHelper"/> validates, and applies the three file-level gates that come
    /// before any row is read: the system provenance marker, the required sheets, and the exact
    /// header layout. Shared by the Program importer (<c>ImportProjectJobService</c>) and the
    /// Lump Sum itemization import, so the two never disagree about what a workbook is.
    /// </summary>
    /// <remarks>
    /// Moved verbatim from <c>ImportProjectJobService</c> on 2026-09-05. The readers pull every
    /// field by fixed column index, which is why <see cref="ValidateSheetHeaders"/> must have
    /// passed first — a reordered column would otherwise be misread silently rather than refused.
    /// </remarks>
    public static class ImportWorkbookReader
    {
        public const string ProjectDetailsSheet = "PROJECT DETAILS";
        public const string FundingProfileSheet = "FUNDING PROFILE";
        public const string ComponentDetailsSheet = "COMPONENT DETAILS";
        public const string MajorItemsOfWorkSheet = "MAJOR ITEMS OF WORK";

        public static readonly string[] RequiredSheets =
        {
            ProjectDetailsSheet, FundingProfileSheet, ComponentDetailsSheet, MajorItemsOfWorkSheet
        };

        /// <summary>
        /// The wording the Program importer fails a job with when the marker is missing. Reused by
        /// the Lump Sum import so a rejected file reads the same in both dialogs.
        /// </summary>
        public const string MissingMarkerMessage =
            "The uploaded file does not appear to be a genuine MYPS import file. Please use the file from Download Template or a generated error report, without recreating it in another tool.";

        // ── Expected header text per column, keyed by 1-based column index — mirrors the exact
        // strings ImportErrorWorkbookBuilder.cs writes to row 1 of each sheet. The Read* methods
        // below pull every field by fixed column index, not by header lookup, so a hand-edited or
        // stale-template upload with columns reordered/inserted/deleted would otherwise be
        // misread silently (e.g. Category data landing in the Tier field) instead of failing
        // cleanly. Only the columns each Read* method actually consumes are checked — the
        // trailing "Error(s) and Warning(s)" display column carries no imported data, so its
        // absence (e.g. someone deleted it from a downloaded template) isn't a correctness risk.
        public static readonly string[] ProjectDetailsHeaders =
        {
            "Project ID", "Multi Year ID", "External ID", "OA Project Code (UACS)", "*Tier", "*Category",
            "*Sub-Category", "MYCA Approval Date", "Description", "*Province", "*City Municipality",
            "*Legislative District:", "*Region", "*District Engineering Office", "*Implementing Office",
            "Operation Unit", "Region Wide", "Origin", "Originating Agency", "Implementation Mode",
            "Emergency Mode", "ROW Available", "Feasibility Study", "Feasibility Date", "Detailed Design",
            "Detailed Design Date", "Rank"
        };
        public static readonly string[] FundingProfileHeaders =
        {
            "Project ID", "Source(s)", "Agreement(s)", "Amount"
        };
        public static readonly string[] ComponentDetailsHeaders =
        {
            "Project ID", "Component Type", "Component ID", "Description", "Cost", "Planned Start Date",
            "Planned End Date", "Infrastructure Type", "Type of Work", "Activity Year"
        };
        public static readonly string[] MajorItemsOfWorkHeaders =
        {
            "Project ID", "Component ID", "Reference ID", "Infrastructure ID", "Detailed Scope", "Target Unit",
            "Start X", "Start Y", "End X", "End Y", "Physical Target", "Start Station", "End Station",
            "Start Chainage (m)", "End Chainage (m)", "Length (meters)", "Activity Year"
        };

        /// <summary>
        /// True when the workbook carries the VeryHidden <c>_SysMeta</c> sheet
        /// <see cref="ImportErrorWorkbookBuilder.AddSystemMarker"/> stamps on every file this
        /// system generates. Its absence means the file wasn't produced by this system: most
        /// likely hand-built from scratch, or edited with a tool that stripped worksheet-level
        /// metadata. Checked before the sheet/header checks since it's the most fundamental signal.
        /// </summary>
        public static bool HasSystemMarker(ExcelPackage package)
        {
            var markerSheet = package.Workbook.Worksheets[ImportErrorWorkbookBuilder.SystemMarkerSheetName];
            var markerValue = markerSheet?.Cells[1, 1].Text;
            return string.Equals(markerValue, ImportErrorWorkbookBuilder.SystemMarkerValue, StringComparison.Ordinal);
        }

        /// <summary>Names of the required sheets the workbook does not contain.</summary>
        public static List<string> MissingSheets(ExcelPackage package)
            => RequiredSheets.Where(s => package.Workbook.Worksheets[s] == null).ToList();

        /// <summary>
        /// Every header mismatch across the four sheets. Empty means the layout is trustworthy
        /// enough for the Read* methods' fixed-column-index access to be safe. Call only after
        /// <see cref="MissingSheets"/> returned empty.
        /// </summary>
        public static List<string> ValidateAllHeaders(ExcelPackage package)
        {
            var headerMismatches = new List<string>();
            headerMismatches.AddRange(ValidateSheetHeaders(package.Workbook.Worksheets[ProjectDetailsSheet], ProjectDetailsSheet, ProjectDetailsHeaders));
            headerMismatches.AddRange(ValidateSheetHeaders(package.Workbook.Worksheets[FundingProfileSheet], FundingProfileSheet, FundingProfileHeaders));
            headerMismatches.AddRange(ValidateSheetHeaders(package.Workbook.Worksheets[ComponentDetailsSheet], ComponentDetailsSheet, ComponentDetailsHeaders));
            headerMismatches.AddRange(ValidateSheetHeaders(package.Workbook.Worksheets[MajorItemsOfWorkSheet], MajorItemsOfWorkSheet, MajorItemsOfWorkHeaders));
            return headerMismatches;
        }

        // Compares row 1 of the sheet against the expected header list column-by-column, returning
        // one description per mismatch (missing/blank column counts as a mismatch against what was
        // expected there). An empty return means the layout is trustworthy enough for the Read*
        // methods' fixed-column-index access to be safe.
        public static List<string> ValidateSheetHeaders(ExcelWorksheet ws, string sheetName, string[] expectedHeaders)
        {
            var mismatches = new List<string>();
            for (int col = 1; col <= expectedHeaders.Length; col++)
            {
                var actual = ws.Cells[1, col].Text?.Trim() ?? string.Empty;
                var expected = expectedHeaders[col - 1];
                if (!string.Equals(actual, expected, StringComparison.Ordinal))
                {
                    mismatches.Add($"{sheetName} column {ColumnLetter(col)}: expected \"{expected}\", found \"{actual}\"");
                }
            }
            return mismatches;
        }

        // 1-based column index -> Excel column letter (1 -> A, 27 -> AA). All the sheets this
        // validates against top out well under 27 columns, but the loop handles any width.
        public static string ColumnLetter(int col)
        {
            var letters = string.Empty;
            while (col > 0)
            {
                int rem = (col - 1) % 26;
                letters = (char)('A' + rem) + letters;
                col = (col - 1) / 26;
            }
            return letters;
        }

        /// <summary>All four sheets, read in one call.</summary>
        public static ImportProjectDTOExcel ReadAll(ExcelPackage package) => new ImportProjectDTOExcel
        {
            ProjectDetails = ReadProjectDetails(package),
            FundingProfile = ReadFundingProfile(package),
            ComponentDetails = ReadComponentDetails(package),
            MajorItemsOfWork = ReadMajorItemsOfWork(package)
        };

        public static List<ImportProjectDetailsExcel> ReadProjectDetails(ExcelPackage package)
        {
            var result = new List<ImportProjectDetailsExcel>();
            // Sheet name must match exactly what your Excel file uses
            var ws = package.Workbook.Worksheets[ProjectDetailsSheet];
            if (ws == null || ws.Dimension == null) return result;

            // Row 1 = headers, data starts at row 2
            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                // Skip completely empty rows
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text))
                    continue;
                string? mYId = string.IsNullOrWhiteSpace(ws.Cells[row, 2].Text) ? null : ws.Cells[row, 2].Text.Trim();
                string? externalId = string.IsNullOrWhiteSpace(ws.Cells[row, 3].Text) ? null : ws.Cells[row, 3].Text.Trim();
                string? uACS = string.IsNullOrWhiteSpace(ws.Cells[row, 4].Text) ? null : ws.Cells[row, 4].Text.Trim();
                string? mYCAApprovalDate = string.IsNullOrWhiteSpace(ws.Cells[row, 8].Text) ? null : ws.Cells[row, 8].Text.Trim();
                string? feasibilityDate = string.IsNullOrWhiteSpace(ws.Cells[row, 24].Text) ? null : ws.Cells[row, 24].Text.Trim();
                string? detailedDesignDate = string.IsNullOrWhiteSpace(ws.Cells[row, 26].Text) ? null : ws.Cells[row, 26].Text.Trim();
                string? rank = string.IsNullOrWhiteSpace(ws.Cells[row, 27].Text) ? null : ws.Cells[row, 27].Text.Trim();

                result.Add(new ImportProjectDetailsExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    MYId = mYId,
                    ExternalId = externalId,
                    UACS = uACS,
                    Tier = ws.Cells[row, 5].Text.Trim(),
                    Category = ws.Cells[row, 6].Text.Trim(),
                    Thrust = ws.Cells[row, 7].Text.Trim(),
                    MYCAApprovalDate = mYCAApprovalDate,
                    Description = ws.Cells[row, 9].Text.Trim(),
                    Province = ws.Cells[row, 10].Text.Trim(),
                    City = ws.Cells[row, 11].Text.Trim(),
                    LegislativeDistrict = ws.Cells[row, 12].Text.Trim(),
                    Region = ws.Cells[row, 13].Text.Trim(),
                    DEO = ws.Cells[row, 14].Text.Trim(),
                    ImplementingOffice = ws.Cells[row, 15].Text.Trim(),
                    OperatingUnit = ws.Cells[row, 16].Text.Trim(),
                    RegionWide = ws.Cells[row, 17].Text.Trim(),
                    Origin = ws.Cells[row, 18].Text.Trim(),
                    Agency = ws.Cells[row, 19].Text.Trim(),
                    ImplementationMode = ws.Cells[row, 20].Text.Trim(),
                    EmergencyMode = ws.Cells[row, 21].Text.Trim(),
                    RowAvailable = ws.Cells[row, 22].Text.Trim(),
                    Feasibility = ws.Cells[row, 23].Text.Trim(),
                    FeasibilityDate = feasibilityDate,
                    DetailedDesign = ws.Cells[row, 25].Text.Trim(),
                    DetailedDesignDate = detailedDesignDate,
                    Rank = rank
                });
            }
            return result;
        }

        public static List<ImportFundingProfileExcel> ReadFundingProfile(ExcelPackage package)
        {
            var result = new List<ImportFundingProfileExcel>();
            var ws = package.Workbook.Worksheets[FundingProfileSheet];
            if (ws == null || ws.Dimension == null) return result;

            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text)) continue;

                result.Add(new ImportFundingProfileExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    Source = ws.Cells[row, 2].Text.Trim(),
                    Agreement = ws.Cells[row, 3].Text.Trim(),
                    Amount = ws.Cells[row, 4].Text.Trim(),
                    Percentage = 100
                });
            }
            return result;
        }

        public static List<ImportComponentDetailsExcel> ReadComponentDetails(ExcelPackage package)
        {
            var result = new List<ImportComponentDetailsExcel>();
            var ws = package.Workbook.Worksheets[ComponentDetailsSheet];
            if (ws == null || ws.Dimension == null) return result;

            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text)) continue;
                string? startDate = string.IsNullOrWhiteSpace(ws.Cells[row, 6].Text) ? null : ws.Cells[row, 6].Text.Trim();
                string? endDate = string.IsNullOrWhiteSpace(ws.Cells[row, 7].Text) ? null : ws.Cells[row, 7].Text.Trim();
                string? description = string.IsNullOrEmpty(ws.Cells[row, 4].Text) ? null : ws.Cells[row, 4].Text.Trim();

                result.Add(new ImportComponentDetailsExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    ComponentType = ws.Cells[row, 2].Text.Trim(),
                    ComponentId = ws.Cells[row, 3].Text.Trim(),
                    Description = description,
                    Cost = ws.Cells[row, 5].Text.Trim(),
                    StartDate = startDate,
                    EndDate = endDate,
                    InfraType = ws.Cells[row, 8].Text.Trim(),
                    WorkTypeId = ws.Cells[row, 9].Text.Trim(),
                    ActiveYear = ws.Cells[row, 10].Text.Trim()
                });
            }
            return result;
        }

        public static List<ImportMajorItemsOfWorkExcel> ReadMajorItemsOfWork(ExcelPackage package)
        {
            var result = new List<ImportMajorItemsOfWorkExcel>();
            var ws = package.Workbook.Worksheets[MajorItemsOfWorkSheet];
            if (ws == null || ws.Dimension == null) return result;

            for (int row = 2; row <= ws.Dimension.End.Row; row++)
            {
                if (string.IsNullOrWhiteSpace(ws.Cells[row, 1].Text)) continue;
                string? detailsScope = string.IsNullOrWhiteSpace(ws.Cells[row, 5].Text) ? null : ws.Cells[row, 5].Text.Trim();
                string? startX = string.IsNullOrWhiteSpace(ws.Cells[row, 7].Text) ? null : ws.Cells[row, 7].Text.Trim();
                string? startY = string.IsNullOrWhiteSpace(ws.Cells[row, 8].Text) ? null : ws.Cells[row, 8].Text.Trim();
                string? endX = string.IsNullOrWhiteSpace(ws.Cells[row, 9].Text) ? null : ws.Cells[row, 9].Text.Trim();
                string? endY = string.IsNullOrWhiteSpace(ws.Cells[row, 10].Text) ? null : ws.Cells[row, 10].Text.Trim();
                string? physicalTarget = string.IsNullOrWhiteSpace(ws.Cells[row, 11].Text) ? null : ws.Cells[row, 11].Text.Trim();
                string? startStation = string.IsNullOrWhiteSpace(ws.Cells[row, 12].Text) ? null : ws.Cells[row, 12].Text.Trim();
                string? endStation = string.IsNullOrWhiteSpace(ws.Cells[row, 13].Text) ? null : ws.Cells[row, 13].Text.Trim();
                string? startChainage = string.IsNullOrWhiteSpace(ws.Cells[row, 14].Text) ? null : ws.Cells[row, 14].Text.Trim();
                string? endChainage = string.IsNullOrWhiteSpace(ws.Cells[row, 15].Text) ? null : ws.Cells[row, 15].Text.Trim();
                string? length = string.IsNullOrWhiteSpace(ws.Cells[row, 16].Text) ? null : ws.Cells[row, 16].Text.Trim();

                result.Add(new ImportMajorItemsOfWorkExcel
                {
                    ProjectId = ws.Cells[row, 1].Text.Trim(),
                    ComponentId = ws.Cells[row, 2].Text.Trim(),
                    ReferenceId = ws.Cells[row, 3].Text.Trim(),
                    InfrastructureId = ws.Cells[row, 4].Text.Trim(),
                    DetailsScope = detailsScope,
                    TargetUnit = ws.Cells[row, 6].Text.Trim(),
                    StartX = startX,
                    StartY = startY,
                    EndX = endX,
                    EndY = endY,
                    PhysicalTarget = physicalTarget,
                    StartStation = startStation,
                    EndStation = endStation,
                    StartChainage = startChainage,
                    EndChainage = endChainage,
                    Length = length,
                    ActivityYear = ws.Cells[row, 17].Text.Trim()
                });
            }
            return result;
        }
    }
}
