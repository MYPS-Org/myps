using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using DBHelper.Models.Procedures;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>AIP Simplified</b> PDF report (A4 Portrait, 4-column layout).
    /// <para>
    /// Uses Row/Column layout (no Table) to avoid PDF cell-border artifacts in Adobe.
    /// A condensed view of the AIP: each project shows UACS, description, amount, and OU/IO.
    /// Grouping: Region -> Legislative District -> DEO -> Category (OO) -> Thrust -> Project.
    /// </para>
    /// <para>Data sources: <c>pGenerateAIP01</c>, <c>pGenerateAIPComponents</c>.</para>
    /// </summary>
    public class AIP02
    {
        // Relative column weights for the 4-column simplified AIP layout
        const float W0 = 14, W1 = 30, W2 = 9, W3 = 12;

        /// <summary>
        /// Entry point -- builds and returns the AIP02 PDF as a byte array.
        /// </summary>
        /// <param name="projects">Flat project list from <c>pGenerateAIP01</c>.</param>
        /// <param name="components">Component rows from <c>pGenerateAIPComponents</c> (used for totals only).</param>
        /// <param name="year">Fiscal year shown in the page title. Pass 0 to omit.</param>
        /// <param name="stageName">Full stage label shown below the title.</param>
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
                page.MarginVertical(25);
                page.MarginHorizontal(15);
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
        /// <summary>Renders the 4-column header row using Row layout (no Table).</summary>
        static void BuildTableHeader(IContainer container)
        {
            container.Column(col =>
            {
                col.Item().Row(row =>
                {
                    HdrCell(row, W0, "UACS / Sub Program");
                    HdrCell(row, W1, "Project Description");
                    HdrCell(row, W2, "Amount\n(PHP)", alignRight: true);
                    HdrCell(row, W3, "Operating Unit /\nImplementing Office");
                });
                // Underline separator (with extra space above to give header text breathing room)
                col.Item().PaddingTop(4).PaddingBottom(4).LineHorizontal(0.5f).LineColor(Colors.Black);
            });
        }

        /// <summary>Renders a single header cell with bold text (no per-cell border).
        /// Left-aligned by default; pass <paramref name="alignRight"/> = <c>true</c> for columns whose
        /// body cells are right-aligned (e.g. Amount) so header and body line up.</summary>
        static void HdrCell(RowDescriptor row, float weight, string text, bool alignRight = false)
        {
            var cell = row.RelativeItem(weight).AlignTop();
            cell = alignRight
                ? cell.AlignRight().PaddingRight(2).PaddingVertical(2)
                : cell.AlignLeft().Padding(2);
            cell.Text(text).Bold().FontSize(7);
        }

        // -- TABLE CONTENT
        /// <summary>
        /// Builds the simplified project content as a Column of Rows.
        /// Grouping order: Region -> Legislative District -> DEO -> Category (OO) -> Thrust -> Project.
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
                        fontSize: 8, bold: true, boldData: true, topBorder: true);

                    foreach (var distGrp in regionGrp.GroupBy(p => p.LegislativeDistrict).OrderBy(g => g.Key))
                    {
                        var distTotal = (decimal)GetComponents(distGrp, components).Sum(c => c.TotalComponentCost);
                        SummaryRow(col, distGrp.Key, distGrp.Count(), distTotal,
                            fontSize: 8, underline: true, indent: 6, arialUnderline: true);

                        foreach (var deoGrp in distGrp.GroupBy(p => p.DEO).OrderBy(g => g.Key))
                        {
                            var deoTotal = (decimal)GetComponents(deoGrp, components).Sum(c => c.TotalComponentCost);
                            SummaryRow(col, deoGrp.Key, deoGrp.Count(), deoTotal,
                                fontSize: 8, underline: true, indent: 6, arialUnderline: true);

                            foreach (var ooGrp in deoGrp.GroupBy(p => p.Category ?? "").OrderBy(g => g.Key))
                            {
                                var ooTotal = (decimal)GetComponents(ooGrp, components).Sum(c => c.TotalComponentCost);
                                SummaryRow(col, ooGrp.Key, ooGrp.Count(), ooTotal,
                                    fontSize: 8, bold: true, boldData: false, indent: 12);

                                int seq = 0;
                                foreach (var catGrp in ooGrp.GroupBy(p => BuildCategoryLabel(p)).OrderBy(g => g.Key))
                                {
                                    var catTotal = (decimal)GetComponents(catGrp, components).Sum(c => c.TotalComponentCost);
                                    ThrustRow(col, catGrp.Key, catTotal);

                                    foreach (var project in catGrp.OrderBy(p => p.Id))
                                    {
                                        seq++;
                                        var projTotal = (decimal)components
                                            .Where(c => c.ProjectComponentId?.StartsWith(project.ProjectId) == true)
                                            .Sum(c => c.TotalComponentCost);
                                        ProjectRow(col, seq, project, projTotal);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // -- ROW BUILDERS

        /// <summary>Renders a summary row (Region / District / DEO / Category level).</summary>
        static void SummaryRow(
            ColumnDescriptor col,
            string label,
            int count,
            decimal total,
            float fontSize = 8,
            bool bold = false,
            bool boldData = false,
            bool underline = false,
            bool arialUnderline = false,
            bool topBorder = false,
            int indent = 0)
        {
            col.Item()
               .Row(row =>
            {
                row.RelativeItem(W0 + W1)
                   .PaddingVertical(3).PaddingLeft(indent + 2f)
                   .Text(t =>
                   {
                       var s = t.Span(label).FontSize(fontSize);
                       if (bold) s.Bold();
                       if (underline) { s.Underline(); if (arialUnderline) s.FontFamily("Arial"); }
                   });

                // Count + total both underlined to visually mark summary subtotals
                // (matches AIP / AIPOfficial styling).
                row.RelativeItem(W2)
                   .AlignRight().PaddingRight(2).PaddingVertical(3)
                   .Text(t =>
                   {
                       var s = t.Span($"{count}  projects").FontSize(fontSize).Underline();
                       if (boldData) s.Bold();
                   });

                row.RelativeItem(W2)
                   .AlignRight().PaddingRight(2).PaddingVertical(3)
                   .Text(t =>
                   {
                       var s = t.Span(FormatAmt(total)).FontSize(fontSize).Underline();
                       if (boldData) s.Bold();
                   });

                row.RelativeItem(W3)
                   .Text("");
            });
        }

        /// <summary>Renders a Thrust label row spanning cols 0-1, with total in col 2.</summary>
        static void ThrustRow(ColumnDescriptor col, string label, decimal total)
        {
            col.Item().Row(row =>
            {
                row.RelativeItem(W0 + W1)
                   .PaddingTop(8).PaddingBottom(2).PaddingLeft(18)
                   .Text(t => t.Span(label + "\n")
                               .FontSize(7.5f)
                               .Bold()
                               .Underline()
                               .FontFamily("Arial")
                               .LineHeight(1.5f));

                row.RelativeItem(W2)
                   .AlignRight().PaddingRight(2).PaddingVertical(2)
                   .Text(t => t.Span(FormatAmt(total)).FontSize(7.5f));

                row.RelativeItem(W3).Text("");
            });
        }

        /// <summary>
        /// Renders two rows for a project in the simplified AIP layout.
        /// Row 1: seq + ProjectId, UACS, total, OU/IO.
        /// Row 2: description spanning cols 0-1.
        /// </summary>
        static void ProjectRow(
            ColumnDescriptor col,
            int seq,
            GenerateAIP01 project,
            decimal total)
        {
            // Row 1
            col.Item().Row(row =>
            {
                row.RelativeItem(W0)
                   .PaddingLeft(4).PaddingTop(4).PaddingBottom(1)
                   .Text(t =>
                   {
                       t.Span($"{seq}.  ").FontSize(7.5f).Bold();
                       t.Span(project.ProjectId).FontSize(7.5f);
                   });

                row.RelativeItem(W1)
                   .PaddingHorizontal(2).PaddingTop(4).PaddingBottom(1)
                   .Text(project.UACS ?? "").FontSize(7);

                // Per-project total — underlined to match summary-row totals above.
                row.RelativeItem(W2)
                   .AlignRight().PaddingRight(2).PaddingTop(4).PaddingBottom(1)
                   .Text(t => t.Span(FormatAmt(total)).FontSize(7.5f).Underline());

                row.RelativeItem(W3)
                   .PaddingHorizontal(2).PaddingTop(4).PaddingBottom(1)
                   .Text(project.OperatingUnit + " / " + project.ImplementingOffice).FontSize(7);
            });

            // Row 2: description limited to W0+W1 (up to Amount column).
            // PaddingLeft(14) aligns the description with the ProjectId text in Row 1
            // (Row 1 PaddingLeft(4) + ~10pt width of the "{seq}.  " bold prefix).
            col.Item().Row(row =>
            {
                row.RelativeItem(W0 + W1)
                   .AlignLeft()
                   .PaddingLeft(14).PaddingTop(1).PaddingBottom(3)
                   .Text(t => t.Span(project.Description ?? "").FontSize(7).Bold());

                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
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

        /// <summary>Returns the project Thrust as the group label.</summary>
        static string BuildCategoryLabel(GenerateAIP01 p) => p.Thrust ?? "";

        /// <summary>Formats an amount as comma-separated integer (N0), or empty string when zero.</summary>
        static string FormatAmt(decimal v) =>
            v == 0 ? "" : v.ToString("N0");
    }
}
