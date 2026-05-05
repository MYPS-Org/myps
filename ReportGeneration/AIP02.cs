using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using DBHelper.Models.Procedures;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>AIP Simplified</b> PDF report (A4 Portrait, 4-column layout).
    /// <para>
    /// A condensed view of the AIP: each project shows UACS, description, amount, and OU/IO.
    /// Grouping: Region → Legislative District → DEO → Category (OO) → Thrust → Project.
    /// </para>
    /// <para>Data sources: <c>pGenerateAIP01</c>, <c>pGenerateAIPComponents</c>.</para>
    /// </summary>
    public class AIP02
    {
        /// <summary>
        /// Entry point — builds and returns the AIP02 PDF as a byte array.
        /// </summary>
        /// <param name="projects">Flat project list from <c>pGenerateAIP01</c>.</param>
        /// <param name="components">Component rows from <c>pGenerateAIPComponents</c> (used for totals only).</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(
            List<GenerateAIP01> projects,
            List<GenerateAIPComponents> components,
            int year = 0,
            string stageName = "")
        {
            int DefaultFs = 8;
            int FooterFs = 7;
            string fiscalYear = year > 0 ? $"FY {year} " : "";
            string stageLabel = !string.IsNullOrEmpty(stageName) ? $"Based on {stageName}" : "Based on General Appropriations Act";
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
                        col.Item().AlignCenter()
                           .Text($"{fiscalYear}ANNUAL INFRASTRUCTURE PROGRAM")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(10).Bold();
                        col.Item().AlignCenter()
                           .Text(stageLabel)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(8);

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

                HeaderCell(table, "UACS / Sub Program");
                HeaderCell(table, "Project Description");
                HeaderCell(table, "Amount\n(PHP)");
                HeaderCell(table, "Operating Unit /\nImplementing Office");
            });
        }

        static void HeaderCell(TableDescriptor table, string text)
        {
            table.Cell()
                 .BorderBottom(0.5f).BorderColor(Colors.Black)
                 .AlignCenter().AlignMiddle()
                 .Padding(4)
                 .Text(text).Bold().FontSize(7);
        }

        // ── TABLE CONTENT ─────────────────────────────────────────────────
        /// <summary>
        /// Builds the simplified project table.
        /// Grouping order: Region → Legislative District → DEO → Category (OO) → Thrust → Project.
        /// </summary>
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
                    var regionTotal = (decimal)GetComponents(regionGrp, components).Sum(c => c.TotalComponentCost);

                    SummaryRow(table,
                        regionGrp.Key,
                        regionGrp.Count(),
                        regionTotal,
                        fontSize: 8, bold: true, topBorder: true);

                    // District grouping
                    foreach (var distGrp in regionGrp
                        .GroupBy(p => p.LegislativeDistrict)
                        .OrderBy(g => g.Key))
                    {
                        var distTotal = (decimal)GetComponents(distGrp, components).Sum(c => c.TotalComponentCost);

                        SummaryRow(table,
                            distGrp.Key,
                            distGrp.Count(),
                            distTotal,
                            fontSize: 8, bold: false,
                            underline: true, indent: 6);

                        // DEO grouping
                        foreach (var deoGrp in distGrp
                            .GroupBy(p => p.DEO)
                            .OrderBy(g => g.Key))
                        {
                            var deoTotal = (decimal)GetComponents(deoGrp, components).Sum(c => c.TotalComponentCost);

                            SummaryRow(table,
                                deoGrp.Key,
                                deoGrp.Count(),
                                deoTotal,
                                fontSize: 8, bold: false,
                                underline: true, indent: 6);

                            // Category (OO) grouping
                            foreach (var ooGrp in deoGrp
                                .GroupBy(p => p.Category ?? "")
                                .OrderBy(g => g.Key))
                            {
                                var ooTotal = (decimal)GetComponents(ooGrp, components).Sum(c => c.TotalComponentCost);

                                SummaryRow(table,
                                    ooGrp.Key,
                                    ooGrp.Count(),
                                    ooTotal,
                                    fontSize: 8, bold: true,
                                    indent: 12);

                                // Thrust grouping
                                int seq = 0;
                                foreach (var catGrp in ooGrp
                                    .GroupBy(p => BuildCategoryLabel(p))
                                    .OrderBy(g => g.Key))
                                {
                                    var catTotal = (decimal)GetComponents(catGrp, components).Sum(c => c.TotalComponentCost);

                                    ThrustRow(table, catGrp.Key, catTotal);

                                    // Project rows
                                    foreach (var project in catGrp.OrderBy(p => p.Id))
                                    {
                                        seq++;

                                        var projTotal = (decimal)components
                                            .Where(c => c.ProjectComponentId
                                                ?.StartsWith(project.ProjectId) == true)
                                            .Sum(c => c.TotalComponentCost);

                                        ProjectRow(table, seq, project, projTotal);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // ── ROW BUILDERS ──────────────────────────────────────────────────

        /// <summary>
        /// Renders a summary row (Region / District / DEO / Category level).
        /// Col 0 = label; Col 1 = count + "projects"; Col 2 = total; Col 3 = blank.
        /// </summary>
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
            // Col 0 — label
            table.Cell()
                 .BorderTop(topBorder ? 0.3f : 0)
                 .BorderColor(Colors.Black)
                 .PaddingVertical(3)
                 .PaddingLeft(indent + 2f)
                 .Text(t =>
                 {
                     var span = t.Span(label).FontSize(fontSize);
                     if (bold) span.Bold();
                     if (underline) span.Underline();
                 });

            // Col 1 — count + "projects"
            table.Cell()
                 .PaddingLeft(2).PaddingVertical(3)
                 .AlignRight().PaddingRight(2)
                 .Text(t =>
                 {
                     var s = t.Span($"{count}     projects").FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            // Col 2 — total amount
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(3)
                 .Text(t =>
                 {
                     var s = t.Span(FormatAmt(total)).FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            // Col 3 — blank
            table.Cell().Text("");
        }

        /// <summary>Renders a Thrust label row spanning cols 0-1, with total in col 2.</summary>
        static void ThrustRow(TableDescriptor table, string label, decimal total)
        {
            // Col 0-1 — label (spans 2 cols)
            table.Cell().ColumnSpan(2)
                 .PaddingTop(4).PaddingBottom(2).PaddingLeft(18)
                 .Text(t => t.Span(label + "\n").FontSize(7.5f).Underline());

            // Col 2 — total
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(t => t.Span(FormatAmt(total)).FontSize(7.5f));

            // Col 3 — blank
            table.Cell().Text("");
        }

        /// <summary>
        /// Renders <b>two table rows</b> for a project in the simplified AIP layout.
        /// Row 1: seq (bold) + ProjectId · UACS · total · OU/IO.
        /// Row 2: description spanning cols 0-1.
        /// </summary>
        static void ProjectRow(
            TableDescriptor table,
            int seq,
            GenerateAIP01 project,
            decimal total)
        {
            // ── Row 1: seq + ProjectId | UACS | total | office ────
            // Col 0 — seq + ProjectId
            table.Cell()
                 .PaddingLeft(4).PaddingVertical(2)
                 .Text(t =>
                 {
                     t.Span($"{seq}.  ").FontSize(7.5f).Bold();
                      t.Span(project.ProjectId).FontSize(7.5f);
                 });

            // Col 1 — UACS
            table.Cell()
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(project.UACS ?? "").FontSize(7);

            // Col 2 — project total
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(FormatAmt(total)).FontSize(7.5f);

            // Col 3 — Operating Unit / Implementing Office
            table.Cell()
                 .PaddingHorizontal(2).PaddingVertical(2)
                 .Text(project.OperatingUnit + "/" +  project.ImplementingOffice).FontSize(7);

            // ── Row 2: Description ────────────────────────────────
            // Col 0-1 — description (spans 2 cols)
            table.Cell().ColumnSpan(2)
                 .PaddingLeft(6).PaddingBottom(2)
                 .Text("\n" + project.Description + "\n").FontSize(7);

            // Col 2 — blank
            table.Cell().Text("");

            // Col 3 — blank
            table.Cell().Text("");
        }

        // ── SHARED HELPERS ─────────────────────────────────────────────────

        /// <summary>Defines the 4 relative columns: UACS/Sub Program · Description · Amount · OU/IO.</summary>
        static void DefineColumns(TableDescriptor table)
        {
            table.ColumnsDefinition(cols =>
            {
                cols.RelativeColumn(14);  // 0 UACS / Sub Program
                cols.RelativeColumn(30);  // 1 Project Description
                cols.RelativeColumn(9);   // 2 Amount (PHP)
                cols.RelativeColumn(12);  // 3 Operating Unit
            });
        }

        /// <summary>Returns all components whose <c>ProjectComponentId</c> starts with any ProjectId in the group.</summary>
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

        /// <summary>Returns the project's <c>Thrust</c> as the group label used by the Thrust/Category row.</summary>
        static string BuildCategoryLabel(GenerateAIP01 p) => p.Thrust ?? "";

        /// <summary>Formats an amount as comma-separated integer (N0), or an empty string when zero.</summary>
        static string FormatAmt(decimal v) =>
            v == 0 ? "" : v.ToString("N0");
    }
}
