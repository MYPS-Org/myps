using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using DBHelper.Models.Procedures;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>Annual Infrastructure Program (AIP)</b> PDF report (A4 Portrait).
    /// <para>
    /// Uses Row/Column layout (no Table) to avoid PDF cell-border artifacts in Adobe.
    /// Body grouping hierarchy:
    /// Region (bold) -> DEO (underline, indent 8) -> Legislative District (underline, indent 8)
    /// -> Category/OO (bold, indent 18) -> Thrust (underline, indent 26)
    /// -> Project (seq bold, ProjectId normal, indent 20/24) -> Component (indent 30).
    /// </para>
    /// <para>Data sources: <c>pGenerateAIP01</c>, <c>pGenerateAIPComponents</c>.</para>
    /// </summary>
    public class AIP
    {
        // Relative column weights for the 8-column AIP layout
        const float W0 = 12, W1 = 18, W2 = 10, W3 = 6, W4 = 5, W5 = 5, W6 = 9, W7 = 12;

        /// <summary>
        /// Entry point -- builds and returns the AIP PDF as a byte array.
        /// </summary>
        /// <param name="projects">Flat project list from <c>pGenerateAIP01</c>.</param>
        /// <param name="components">Component rows from <c>pGenerateAIPComponents</c>.</param>
        /// <param name="year">Fiscal year shown in the page title (e.g. 2026). Pass 0 to omit.</param>
        /// <param name="stageName">Full stage label shown below the title.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(
            List<GenerateAIP01> projects,
            List<GenerateAIPComponents> components,
            int year = 0,
            string stageName = ""
        )
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

                // -- HEADER
                page.Header()
                    .Column(col =>
                    {
                        col.Item().AlignCenter()
                           .Text($"{fiscalYear}ANNUAL INFRASTRUCTURE PROGRAM")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(10).Bold();
                        col.Item().AlignCenter()
                           .Text(stageLabel)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(8);
                        col.Item().PaddingTop(8).Element(BuildTableHeader);
                    });

                // -- CONTENT
                page.Content().Element(c => BuildTableContent(c, projects, components));

                // -- FOOTER
                GeneratePDF.BuildFooter(page, FooterFs);
            });
        }

        // -- COLUMN HEADERS
        /// <summary>
        /// Renders the 8-column header row using Row layout (no Table).
        /// Row 1: UACS/ID, Description, Type of Work, Target Unit, Physical Target (#/Unit combined), Amount, OU/IO.
        /// Row 2: sub-labels for the Physical Target columns.
        /// </summary>
        static void BuildTableHeader(IContainer container)
        {
            container.BorderBottom(0.5f).BorderColor(Colors.Black).Column(col =>
            {
                // Row 1
                col.Item().Row(row =>
                {
                    HdrCell(row, W0,          "UACS / Sub Program\nProject Component ID");
                    HdrCell(row, W1,          "Project Component Description");
                    HdrCell(row, W2,          "Type of Work");
                    HdrCell(row, W3,          "Target\nUnit");
                    HdrCell(row, W4 + W5,     "Physical Target");
                    HdrCell(row, W6,          "Amount\n(PHP)");
                    HdrCell(row, W7,          "Operating Unit /\nImplementing Office");
                });
                // Row 2 -- sub-labels under Physical Target only
                col.Item().Row(row =>
                {
                    row.RelativeItem(W0 + W1 + W2 + W3).Text("");
                    HdrCell(row, W4, "#");
                    HdrCell(row, W5, "Unit");
                    row.RelativeItem(W6 + W7).Text("");
                });
            });
        }

        /// <summary>Renders a single header cell with centered bold text (no per-cell border).</summary>
        static void HdrCell(RowDescriptor row, float weight, string text)
        {
            row.RelativeItem(weight)
               .AlignCenter().AlignMiddle()
               .Padding(4)
               .Text(text).Bold().FontSize(7);
        }

        // -- TABLE CONTENT
        /// <summary>
        /// Builds the full grouped project content as a Column of Rows.
        /// Grouping order: Region -> DEO -> Legislative District -> Category (OO) -> Thrust -> Project -> Component.
        /// </summary>
        static void BuildTableContent(
            IContainer container,
            List<GenerateAIP01> projects,
            List<GenerateAIPComponents> components)
        {
            container.Column(col =>
            {
                foreach (var regionGrp in projects.GroupBy(p => p.Region).OrderBy(g => g.Key))
                {
                    var regionTotal = (decimal)GetComponents(regionGrp, components).Sum(c => c.TotalComponentCost);
                    SummaryRow(col, regionGrp.Key, regionGrp.Count(), regionTotal,
                        fontSize: 8, bold: true, topBorder: true);

                    foreach (var deoGrp in regionGrp.GroupBy(p => p.DEO).OrderBy(g => g.Key))
                    {
                        var deoTotal = (decimal)GetComponents(deoGrp, components).Sum(c => c.TotalComponentCost);
                        SummaryRow(col, deoGrp.Key, deoGrp.Count(), deoTotal,
                            fontSize: 8, underline: true, indent: 8);

                        foreach (var distGrp in deoGrp.GroupBy(p => p.LegislativeDistrict).OrderBy(g => g.Key))
                        {
                            var distTotal = (decimal)GetComponents(distGrp, components).Sum(c => c.TotalComponentCost);
                            SummaryRow(col, distGrp.Key, distGrp.Count(), distTotal,
                                fontSize: 8, underline: true, indent: 8);

                            foreach (var ooGrp in distGrp.GroupBy(p => p.Category ?? "").OrderBy(g => g.Key))
                            {
                                var ooTotal = (decimal)GetComponents(ooGrp, components).Sum(c => c.TotalComponentCost);
                                SummaryRow(col, ooGrp.Key, ooGrp.Count(), ooTotal,
                                    fontSize: 8, bold: true, indent: 18);

                                int seq = 0;
                                foreach (var catGrp in ooGrp.GroupBy(p => BuildCategoryLabel(p)).OrderBy(g => g.Key))
                                {
                                    var catTotal = (decimal)GetComponents(catGrp, components).Sum(c => c.TotalComponentCost);
                                    CategoryRow(col, catGrp.Key, catTotal);

                                    foreach (var project in catGrp.OrderBy(p => p.Id))
                                    {
                                        seq++;
                                        var projComponents = components
                                            .Where(c => c.ProjectComponentId?.StartsWith(project.ProjectId) == true)
                                            .OrderBy(c => c.Id).ToList();
                                        var projTotal = (decimal)projComponents.Sum(c => c.TotalComponentCost);

                                        ProjectHeaderRow(col, seq, project, projTotal);

                                        foreach (var comp in projComponents)
                                        {
                                            if (comp.ProjectComponentId?.EndsWith("-EAO") == true)
                                                EaoRow(col, comp, project.ImplementingOffice);
                                            else if (comp.ProjectComponentId?.EndsWith("-ROW") == true)
                                                ComponentRow(col, comp, project, overrideTypeOfWork: "ROW Acquisition");
                                            else
                                                ComponentRow(col, comp, project);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // -- ROW BUILDERS

        /// <summary>
        /// Renders a full-width summary row (Region / DEO / District / Category level).
        /// </summary>
        static void SummaryRow(
            ColumnDescriptor col,
            string label,
            int count,
            decimal total,
            float fontSize = 8,
            bool bold = false,
            bool underline = false,
            bool topBorder = false,
            int indent = 0)
        {
            col.Item()
               .Row(row =>
            {
                row.RelativeItem(W0 + W1 + W2 + W3)
                   .PaddingVertical(3).PaddingLeft(indent + 2f)
                   .Text(t =>
                   {
                       var s = t.Span(label).FontSize(fontSize);
                       if (bold) s.Bold();
                       if (underline) s.Underline();
                   });

                row.RelativeItem(W4)
                   .AlignRight().PaddingRight(2).PaddingVertical(3)
                   .Text(t =>
                   {
                       var s = t.Span(count.ToString()).FontSize(fontSize);
                       if (bold) s.Bold();
                   });

                row.RelativeItem(W5)
                   .PaddingLeft(2).PaddingVertical(3)
                   .Text(t =>
                   {
                       var s = t.Span("projects").FontSize(fontSize);
                       if (bold) s.Bold();
                   });

                row.RelativeItem(W6)
                   .AlignRight().PaddingRight(2).PaddingVertical(3)
                   .Text(t =>
                   {
                       var s = t.Span(FormatAmt(total)).FontSize(fontSize);
                       if (bold) s.Bold();
                   });

                row.RelativeItem(W7)
                   .Text("");
            });
        }

        /// <summary>Renders a Thrust label row (indented 26 pt, underlined).</summary>
        static void CategoryRow(ColumnDescriptor col, string label, decimal total)
        {
            col.Item().Row(row =>
            {
                row.RelativeItem(W0 + W1 + W2 + W3)
                   .PaddingTop(4).PaddingBottom(2).PaddingLeft(26)
                   .Text(t => t.Span(label + "\n").FontSize(7.5f).Underline());

                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).Text("");

                row.RelativeItem(W6)
                   .AlignRight().PaddingRight(2).PaddingVertical(2)
                   .Text(t => t.Span(FormatAmt(total)).FontSize(7.5f));

                row.RelativeItem(W7).Text("");
            });
        }

        /// <summary>
        /// Renders two rows for a project entry.
        /// Row 1: seq + ProjectId, UACS, total amount.
        /// Row 2: description (bold, indented).
        /// </summary>
        static void ProjectHeaderRow(
            ColumnDescriptor col,
            int seq,
            GenerateAIP01 project,
            decimal total)
        {
            // Row 1: seq + ProjectId | UACS | total
            col.Item().Row(row =>
            {
                row.RelativeItem(W0)
                   .PaddingLeft(20).PaddingVertical(5)
                   .Text(t =>
                   {
                       t.Span($"{seq}.  ").FontSize(7.5f).Bold();
                       t.Span(project.ProjectId).FontSize(7.5f);
                   });

                row.RelativeItem(W1 + W2 + W3)
                   .PaddingHorizontal(4).PaddingVertical(5)
                   .Text(project.UACS ?? "").FontSize(7);

                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).Text("");

                row.RelativeItem(W6)
                   .AlignRight().PaddingRight(2).PaddingVertical(2)
                   .Text(FormatAmt(total)).FontSize(7.5f);

                row.RelativeItem(W7).Text("");
            });

            // Row 2: description
            col.Item().Row(row =>
            {
                row.RelativeItem(W0 + W1 + W2 + W3)
                   .PaddingLeft(24).PaddingBottom(2)
                   .Text(t => t.Span("\n" + project.Description + "\n").FontSize(7).Bold());

                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).Text("");
                row.RelativeItem(W6).Text("");
                row.RelativeItem(W7).Text("");
            });
        }

        /// <summary>
        /// Renders a single component row (indented 30 pt).
        /// </summary>
        static void ComponentRow(
            ColumnDescriptor col,
            GenerateAIPComponents comp,
            GenerateAIP01 project,
            string? overrideTypeOfWork = null)
        {
            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingLeft(30).PaddingVertical(2)
                   .Text(comp.ProjectComponentId).FontSize(7);

                row.RelativeItem(W1).PaddingHorizontal(2).PaddingVertical(2)
                   .Text(comp.Description ?? "").FontSize(7);

                row.RelativeItem(W2).PaddingHorizontal(2).PaddingVertical(2)
                   .Text(overrideTypeOfWork ?? comp.ScopeDescription ?? "").FontSize(7);

                row.RelativeItem(W3).AlignCenter().PaddingVertical(2)
                   .Text(comp.ScopeMeasure ?? "").FontSize(7);

                row.RelativeItem(W4).AlignRight().PaddingRight(2).PaddingVertical(2)
                   .Text(comp.TotalUnitCost != null
                       ? Convert.ToDouble(comp.TotalUnitCost).ToString("N3")
                       : "").FontSize(7);

                row.RelativeItem(W5).Text("");

                row.RelativeItem(W6).AlignRight().PaddingRight(2).PaddingVertical(2)
                   .Text(FormatAmt((decimal)comp.TotalComponentCost)).FontSize(7);

                row.RelativeItem(W7).PaddingHorizontal(2).PaddingVertical(2)
                   .Text(project.OperatingUnit + "/" + project.ImplementingOffice).FontSize(7);
            });
        }

        /// <summary>Renders an EAO component row (Component ID, amount, implementing office only).</summary>
        static void EaoRow(
            ColumnDescriptor col,
            GenerateAIPComponents comp,
            string? implementingOffice)
        {
            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingLeft(30).PaddingVertical(2)
                   .Text(comp.ProjectComponentId).FontSize(7);

                row.RelativeItem(W1 + W2 + W3 + W4 + W5).Text("");

                row.RelativeItem(W6).AlignRight().PaddingRight(2).PaddingVertical(2)
                   .Text(FormatAmt((decimal)comp.TotalComponentCost)).FontSize(7);

                row.RelativeItem(W7).PaddingHorizontal(2).PaddingVertical(2)
                   .Text(implementingOffice ?? "").FontSize(7);
            });
        }

        // -- SHARED HELPERS

        /// <summary>Returns all components whose ProjectComponentId starts with any ProjectId in the group.</summary>
        static List<GenerateAIPComponents> GetComponents(
            IEnumerable<GenerateAIP01> projectGroup,
            List<GenerateAIPComponents> allComponents)
        {
            var ids = projectGroup.Select(p => p.ProjectId).ToHashSet();
            return allComponents
                .Where(c => ids.Any(id => c.ProjectComponentId?.StartsWith(id) == true))
                .ToList();
        }

        /// <summary>Formats an amount as comma-separated integer (N0), or empty string when zero.</summary>
        static string FormatAmt(decimal v) =>
            v == 0 ? "" : v.ToString("N0");

        /// <summary>Returns the project Thrust as the group label.</summary>
        static string BuildCategoryLabel(GenerateAIP01 p) => p.Thrust ?? "";
    }
}
