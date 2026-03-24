using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using DBHelper.Models.Procedures;

namespace ReportGeneration
{
    public class AIP
    {
        public static byte[] GenerateReport(
            List<GenerateAIP01> projects,
            List<GenerateAIPComponents> components
        )
        {
            int DefaultFs = 8;
            int FooterFs = 7;
            var logo = GeneratePDF.GetLogo();
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(DefaultFs).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                // ── HEADER ───────────────────────────────────────────
                page.Header()
                    .Column(col =>
                    {
                        GeneratePDF.BuildDPWHHeader(col, logo,
                            "FY 2025 ANNUAL INFRASTRUCTURE PROGRAM",
                            subtitle: "Based on General Appropriations Act");

                        col.Item()
                           .PaddingTop(8)
                           .Element(BuildTableHeader);
                    });

                // ── CONTENT ──────────────────────────────────────────
                page.Content()
                    .Element(c => BuildTableContent(c, projects, components));

                // ── FOOTER ───────────────────────────────────────────
                GeneratePDF.BuildFooter(page, FooterFs);
            });
        }
        // ── COLUMN HEADERS ────────────────────────────────────────────────
        static void BuildTableHeader(IContainer container)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                // Row 1
                HeaderCell(table, "UACS / Sub Program\nProject Component ID", rowSpan: 2);
                HeaderCell(table, "Project Component Description", rowSpan: 2);
                HeaderCell(table, "Type of Work", rowSpan: 2);
                HeaderCell(table, "Target\nUnit", rowSpan: 2);
                HeaderCell(table, "Physical Target", colSpan: 2);
                HeaderCell(table, "Amount\n(PHP)", rowSpan: 2);
                HeaderCell(table, "Operating Unit /\nImplementing Office", rowSpan: 2);

                // Row 2 — under Physical Target
                HeaderCell(table, "#");
                HeaderCell(table, "Unit");
            });
        }

        static void HeaderCell(
            TableDescriptor table,
            string text,
            uint colSpan = 1,
            uint rowSpan = 1)
        {
            table.Cell()
                 .ColumnSpan(colSpan)
                 .RowSpan(rowSpan)
                 .Border(0.3f).BorderColor(Colors.Grey.Lighten1)
                 .Background(Colors.Grey.Lighten4)
                 .AlignCenter().AlignMiddle()
                 .Padding(4)
                 .Text(text).Bold().FontSize(7);
        }

        // ── TABLE CONTENT ─────────────────────────────────────────────────
        static void BuildTableContent(
            IContainer container,
            List<GenerateAIP01> projects,
            List<GenerateAIPComponents> components)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                // Region grouping
                foreach (var regionGrp in projects
                    .GroupBy(p => p.Region)
                    .OrderBy(g => g.Key))
                {
                    var regionComponents = GetComponents(regionGrp, components);
                    var regionTotal = regionComponents.Sum(c => c.TotalComponentCost);

                    // ── Region row ────────────────────────────────────────
                    SummaryRow(table,
                        regionGrp.Key,
                        regionGrp.Count(),
                        (decimal)regionTotal,
                        fontSize: 8, bold: true, topBorder: true);

                    // District grouping
                    foreach (var distGrp in regionGrp
                        .GroupBy(p => p.LegislativeDistrict)
                        .OrderBy(g => g.Key))
                    {
                        var distComponents = GetComponents(distGrp, components);
                        var distTotal = distComponents.Sum(c => c.TotalComponentCost);

                        // ── District row ──────────────────────────────────
                        SummaryRow(table,
                            distGrp.Key,
                            distGrp.Count(),
                            (decimal)distTotal,
                            fontSize: 8, bold: false,
                            underline: true, indent: 6);

                        // DEO grouping
                        foreach (var deoGrp in distGrp
                            .GroupBy(p => p.DEO)
                            .OrderBy(g => g.Key))
                        {
                            var deoComponents = GetComponents(deoGrp, components);
                            var deoTotal = deoComponents.Sum(c => c.TotalComponentCost);

                            // ── DEO / Office row ──────────────────────────
                            SummaryRow(table,
                                deoGrp.Key,
                                deoGrp.Count(),
                                (decimal)deoTotal,
                                fontSize: 8, bold: false,
                                underline: true, indent: 6);

                            // Category (OO) grouping
                            foreach (var ooGrp in deoGrp
                                .GroupBy(p => p.Category ?? "")
                                .OrderBy(g => g.Key))
                            {
                                var ooComponents = GetComponents(ooGrp, components);
                                var ooTotal = ooComponents.Sum(c => c.TotalComponentCost);

                                // ── Category (OO) row ─────────────────────
                                SummaryRow(table,
                                    ooGrp.Key,
                                    ooGrp.Count(),
                                    (decimal)ooTotal,
                                    fontSize: 8, bold: true,
                                    indent: 12);

                                // Thrust grouping
                                int seq = 0;
                                foreach (var catGrp in ooGrp
                                    .GroupBy(p => BuildCategoryLabel(p))
                                    .OrderBy(g => g.Key))
                                {
                                    var catComponents = GetComponents(catGrp, components);
                                    var catTotal = catComponents.Sum(c => c.TotalComponentCost);

                                    // ── Thrust header ─────────────────────
                                    CategoryRow(table, catGrp.Key, (decimal)catTotal);

                                    // Project rows
                                    foreach (var project in catGrp.OrderBy(p => p.Id))
                                    {
                                        seq++;

                                        // Get this project's components
                                        var projComponents = components
                                            .Where(c => c.ProjectComponentId
                                                ?.StartsWith(project.ProjectId) == true)
                                            .OrderBy(c => c.Id)
                                            .ToList();

                                        var projTotal = projComponents
                                            .Sum(c => c.TotalComponentCost);

                                        // ── Project header row ────────────
                                        ProjectHeaderRow(table, seq, project, (decimal)projTotal);

                                        // ── Component rows ────────────────
                                        foreach (var comp in projComponents)
                                        {
                                            if (comp.ProjectComponentId?.EndsWith("-EAO") == true)
                                                EaoRow(table, comp, project.ImplementingOffice);
                                            else if (comp.ProjectComponentId?.EndsWith("-ROW") == true)
                                                ComponentRow(table, comp, project,
                                                    overrideTypeOfWork: "ROW Acquisition");
                                            else
                                                ComponentRow(table, comp, project);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // ── ROW BUILDERS ──────────────────────────────────────────────────

        static void SummaryRow(
            TableDescriptor table,
            string label,
            int count,
            decimal total,
            float fontSize = 8,
            bool bold = false,
            bool underline = false,
            bool topBorder = false,
            int indent = 0)
        {
            // Cols 0-3 — label
            table.Cell().ColumnSpan(4)
                 .BorderTop(topBorder ? 0.5f : 0)
                 .BorderColor(Colors.Grey.Medium)
                 .PaddingVertical(3)
                 .PaddingLeft(indent + 2f)
                 .Text(t =>
                 {
                     var span = t.Span(label).FontSize(fontSize);
                     if (bold) span.Bold();
                     if (underline) span.Underline();
                 });

            // Col 4 — count
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(3)
                 .Text(t =>
                 {
                     var s = t.Span(count.ToString()).FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            // Col 5 — "projects"
            table.Cell()
                 .PaddingLeft(2).PaddingVertical(3)
                 .Text(t =>
                 {
                     var s = t.Span("projects").FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            // Col 6 — total amount
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(3)
                 .Text(t =>
                 {
                     var s = t.Span(FormatAmt(total)).FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            // Col 7 — blank
            table.Cell().Text("");
        }

        static void CategoryRow(TableDescriptor table, string label, decimal total)
        {
            table.Cell().ColumnSpan(4)
                 .PaddingTop(4).PaddingBottom(2).PaddingLeft(18)
                 .Text(t => t.Span(label + "\n").FontSize(7.5f).Underline());

            table.Cell().Text("");   // count blank
            table.Cell().Text("");   // unit blank

            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(t => t.Span(FormatAmt(total)).FontSize(7.5f));

            table.Cell().Text("");
        }

        static void ProjectHeaderRow(
            TableDescriptor table,
            int seq,
            GenerateAIP01 project,
            decimal total)
        {
            // ── Row 1: seq + ProjectId | UACS | total ─────────
            // Col 0 — seq + ProjectId
            table.Cell()
                 .PaddingLeft(4).PaddingVertical(2)
                 .Text(t =>
                 {
                     t.Span($"{seq}.  ").FontSize(7.5f).Bold();
                      t.Span(project.ProjectId).FontSize(7.5f);
                 });

            // Col 1-3 — UACS (spans 3 cols, same row as ProjectId)
            table.Cell().ColumnSpan(3)
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(project.UACS ?? "").FontSize(7);

            // Col 4 blank
            table.Cell().Text("");

            // Col 5 blank
            table.Cell().Text("");

            // Col 6 — project total
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(FormatAmt(total)).FontSize(7.5f);

            // Col 7 blank
            table.Cell().Text("");

            // ── Row 2: Description ────────────────────────────
            // Col 0-3 — description (spans 4 cols, indented below)
            table.Cell().ColumnSpan(4)
                 .PaddingLeft(6).PaddingBottom(2)
                 .Text("\n" + project.Description + "\n").FontSize(7);

            // Col 4 blank
            table.Cell().Text("");

            // Col 5 blank
            table.Cell().Text("");

            // Col 6 blank
            table.Cell().Text("");

            // Col 7 blank
            table.Cell().Text("");
        }

        static void ComponentRow(
            TableDescriptor table,
            GenerateAIPComponents comp,
            GenerateAIP01 project,
            string? overrideTypeOfWork = null)
        {
            // Col 0 — Component ID
            table.Cell()
                 .PaddingLeft(10).PaddingVertical(2)
                 .Text(comp.ProjectComponentId).FontSize(7);

            // Col 1 — Description
            table.Cell()
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(comp.Description ?? "").FontSize(7);

            // Col 2 — Type of Work (ScopeDescription)
            table.Cell()
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(overrideTypeOfWork ?? comp.ScopeDescription ?? "").FontSize(7);

            // Col 3 — Target Unit (ScopeMeasure)
            table.Cell()
                 .AlignCenter().PaddingVertical(2)
                 .Text(comp.ScopeMeasure ?? "").FontSize(7);

            // Col 4 — Target Quantity (TotalUnitCost)
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(comp.TotalUnitCost != null
                     ? Convert.ToDouble(comp.TotalUnitCost).ToString("N3")
                     : "")
                 .FontSize(7);

            // Col 5 blank
            table.Cell().Text("");

            // Col 6 — Amount (TotalComponentCost)
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(FormatAmt((decimal)comp.TotalComponentCost)).FontSize(7);

            // Col 7 — Operating Unit / Implementing Office
            table.Cell()
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(project.OperatingUnit + "/" + project.ImplementingOffice).FontSize(7);
        }

        static void EaoRow(
            TableDescriptor table,
            GenerateAIPComponents comp,
            string? implementingOffice)
        {
            // Col 0 — EAO component ID
            table.Cell()
                 .PaddingLeft(10).PaddingVertical(2)
                 .Text(comp.ProjectComponentId).FontSize(7);

            // Cols 1-4 blank
            table.Cell().ColumnSpan(4).Text("");

            // Col 5 blank
            table.Cell().Text("");

            // Col 6 — EAO amount
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(FormatAmt((decimal)comp.TotalComponentCost)).FontSize(7);

            // Col 7 — Operating Unit
            table.Cell()
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(implementingOffice ?? "").FontSize(7);
        }

        // ── SHARED HELPERS ─────────────────────────────────────────────────

        static void DefineColumns(TableDescriptor table)
        {
            table.ColumnsDefinition(cols =>
            {
                cols.RelativeColumn(12);  // 0 UACS / Component ID
                cols.RelativeColumn(18);  // 1 Description
                cols.RelativeColumn(10);  // 2 Type of Work
                cols.RelativeColumn(6);   // 3 Target Unit
                cols.RelativeColumn(5);   // 4 Physical Target #
                cols.RelativeColumn(5);   // 5 Physical Target unit
                cols.RelativeColumn(9);   // 6 Amount (PHP)
                cols.RelativeColumn(12);  // 7 Operating Unit
            });
        }

        // Link all components belonging to a group of projects
        static List<GenerateAIPComponents> GetComponents(
            IEnumerable<GenerateAIP01> projectGroup,
            List<GenerateAIPComponents> allComponents)
        {
            var ids = projectGroup.Select(p => p.ProjectId).ToHashSet();
            return allComponents
                .Where(c => ids.Any(id =>
                    c.ProjectComponentId?.StartsWith(id) == true))
                .ToList();
        }

        static string FormatAmt(decimal v) =>
            v == 0 ? "" : v.ToString("N0");

        // "Asset Preservation - Preventive Maintenance - Tertiary Roads"
        static string BuildCategoryLabel(GenerateAIP01 p) => p.Thrust ?? "";
    }
}
