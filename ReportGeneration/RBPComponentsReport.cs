using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RBPCData = DBHelper.Models.Procedures.GenerateRBPComponents;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>RBP Components</b> PDF report (A4 Landscape).
    /// <para>
    /// Uses Row/Column layout (no Table) to avoid PDF cell-border artifacts in Adobe.
    /// Grouping: Region -> Tier -> DEO -> Legislative District -> Category -> Thrust -> Project -> Component.
    /// </para>
    /// <para>Data source: <c>pGenerateRBPComponents</c>.</para>
    /// </summary>
    public class RBPComponents
    {
        // column weights: WA=DEO/LD, WB=Programs/Activities/Projects, W1=TypeOfWork, W2=ProjectLocation, W3=unused, W4=DetailsOfWork, W5=Length, W6=PhysTarget, W7=TargetUnit, W8=Cost
        const float WA=6, WB=20, W1=6, W2=4, W3=6, W4=10, W5=5, W6=5, W7=5, W8=12;

        /// <summary>
        /// Entry point -- builds and returns the RBP Components PDF as a byte array.
        /// </summary>
        /// <param name="data">Flat row list from <c>pGenerateRBPComponents</c>.</param>
        /// <param name="year">Fiscal year shown in the title. Pass 0 to omit.</param>
        /// <param name="stageName">Full stage label appended to the title.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(List<RBPCData> data, int year = 0, string stageName = "")
        {
            int FooterFs = 7;
            var logo = GeneratePDF.GetLogo();
            string fiscalYear = year > 0 ? $"FY {year}  " : "";
            string title = $"{fiscalYear}BUDGET PROPOSAL";
            string subtitle = "(ONGOING, NEW AND EXPANDED PROGRAMS, ACTIVITIES AND PROJECTS)";
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Portrait());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(7).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                var regionName = data.FirstOrDefault()?.Region?.ToUpper() ?? "";

                // -- HEADER
                page.Header()
                    .Column(col =>
                    {
                        GeneratePDF.BuildDPWHHeader(col, logo, title, subtitle: subtitle, regionName: regionName);
                        col.Item().PaddingTop(8).Element(BuildTableHeader);
                    });

                // -- CONTENT
                page.Content()
                    .Column(col =>
                    {
                        col.Item().Element(c => BuildTableContent(c, data));
                        col.Item().Extend().AlignBottom()
                            .PaddingTop(10).Element(BuildSignatureBlock);
                    });

                // -- FOOTER
                GeneratePDF.BuildFooter(page, FooterFs);
            });
        }

        // -- TABLE HEADER
        static void BuildTableHeader(IContainer container)
        {
            container.Column(col =>
            {
                col.Item().Row(row =>
                {
                    HdrCell(row, WA, "DEO/LD");
                    HdrCell(row, WB, "Programs/Activities\n/ Projects");
                    HdrCell(row, W1, "Type of\nWork");
                    HdrCell(row, W2+W3, "Project\nLocation");
                    HdrCell(row, W4, "Details of Work");
                    HdrCell(row, W5, "Length of\nWork (m)");
                    HdrCell(row, W6, "Physical\nTarget");
                    HdrCell(row, W7, "Target\nUnit");
                    HdrCell(row, W8, "Project Cost\n(P'000)");
                });
                col.Item().LineHorizontal(0.5f).LineColor(Colors.Black);
            });
        }

        static void HdrCell(RowDescriptor row, float weight, string text)
        {
            row.RelativeItem(weight)
               .AlignLeft().AlignTop()
               .Padding(2)
               .Text(text).Bold().FontSize(7);
        }

        // -- TABLE CONTENT
        /// <summary>
        /// Builds the component-detail content as a Column of Rows.
        /// Grouping: Region -> Tier -> DEO -> District -> Category -> Thrust -> Project -> Component.
        /// </summary>
        static void BuildTableContent(IContainer container, List<RBPCData> data)
        {
            container.Column(col =>
            {
                foreach (var regionGrp in data.GroupBy(r => r.Region).OrderBy(g => g.Key))
                {
                    WriteSummaryRow(col, regionGrp.Key, regionGrp, bold: true);

                    foreach (var tierGrp in regionGrp.GroupBy(r => r.Tier).OrderBy(g => g.Key))
                    {
                        WriteSummaryRow(col, $"Tier {ToRoman(tierGrp.Key)}", tierGrp, indent: 8);

                        foreach (var deoGrp in tierGrp.GroupBy(r => r.DEO).OrderBy(g => g.Key))
                        {
                            WriteSummaryRow(col, deoGrp.Key, deoGrp, indent: 16);

                            foreach (var distGrp in deoGrp.GroupBy(r => r.LegislativeDistrict).OrderBy(g => g.Key))
                            {
                                WriteSummaryRow(col, distGrp.Key, distGrp, indent: 24);

                                foreach (var catGrp in distGrp.GroupBy(r => r.CategoryName).OrderBy(g => g.Key))
                                {
                                    WriteCategoryRow(col, catGrp.Key, catGrp);

                                    int seq = 0;
                                    foreach (var thrustGrp in catGrp.GroupBy(r => r.ThrustDescription).OrderBy(g => g.Key))
                                    {
                                        WriteThrustRow(col, thrustGrp.Key);

                                        foreach (var projGrp in thrustGrp.GroupBy(r => r.ProjectDescription).OrderBy(g => g.Key))
                                        {
                                            seq++;
                                            var projCost = projGrp.Sum(r => r.ComponentCost);
                                            WriteProjectRow(col, seq, projGrp.Key, projCost);

                                            foreach (var comp in projGrp.OrderBy(c => c.ComponentId))
                                                                WriteComponentRow(col, comp);

                                                            col.Item().PaddingTop(4).Text("");
                                        }

                                        col.Item().PaddingTop(4).Text("");
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // -- ROW RENDERING

        /// <summary>Region / Tier / DEO / District summary -- shows project count + total cost.</summary>
        static void WriteSummaryRow(
            ColumnDescriptor col,
            string label,
            IEnumerable<RBPCData> rows,
            int indent = 0,
            bool bold = false)
        {
            // Region=10, Tier=9, DEO=8, LD=7.5; amounts always at 7.5
            float labelFs = bold ? 10f : (indent <= 8 ? 9f : (indent <= 16 ? 8f : 7.5f));
            float amtFs = 7.5f;
            // No indents for DEO/LD -- all levels start at left
            float leftPad = bold ? 2f : (indent <= 8 ? 6f : (indent <= 16 ? 4f : 10f));
            bool emphasize = true; // all levels bold
            int projCount = rows.Select(r => r.ProjectDescription).Distinct().Count();
            double totalCost = rows.Sum(r => r.ComponentCost);

            col.Item().PaddingTop(bold ? 8 : (indent <= 8 ? 4 : 0)).Row(row =>
            {
                row.RelativeItem(WA+WB).PaddingVertical(1).PaddingLeft(leftPad).PaddingRight(2)
                   .Text(t => { var s = t.Span(label).FontSize(labelFs); if (emphasize) s.Bold(); });

                // middle columns merged: show "N projects" right-aligned
                row.RelativeItem(W1+W2+W3+W4+W5+W6+W7).AlignRight().PaddingRight(4).PaddingVertical(1)
                   .Text(t => { var s = t.Span($"{projCount:N0}  projects").FontSize(amtFs); if (emphasize) s.Bold(); });

                // cost
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(t => { var s = t.Span(FormatP(totalCost)).FontSize(amtFs); if (emphasize) s.Bold(); });
            });
        }

        /// <summary>Category row -- in W0 column, indented under LD.</summary>
        static void WriteCategoryRow(ColumnDescriptor col, string label, IEnumerable<RBPCData> rows)
        {
            float fs = 7f;
            double totalCost = rows.Sum(r => r.ComponentCost);
            col.Item().Row(row =>
            {
                row.RelativeItem(WA+WB).PaddingVertical(1).PaddingLeft(18).PaddingRight(2)
                   .Text(label).FontSize(fs).Bold();
                row.RelativeItem(W1).Text("");
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).Text("");
                row.RelativeItem(W6).Text("");
                row.RelativeItem(W7).Text("");
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatP(totalCost)).FontSize(fs).Bold();
            });
        }

        /// <summary>Thrust row -- in W0 column, indented under Category.</summary>
        static void WriteThrustRow(ColumnDescriptor col, string label)
        {
            float fs = 6.5f;
            col.Item().Row(row =>
            {
                row.RelativeItem(WA+WB).PaddingVertical(1).PaddingLeft(24).PaddingRight(2)
                   .Text(label).FontSize(fs).Bold();
                row.RelativeItem(W1).Text("");
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).Text("");
                row.RelativeItem(W6).Text("");
                row.RelativeItem(W7).Text("");
                row.RelativeItem(W8).Text("");
            });
        }

        /// <summary>Project row -- spans W0-W7 to keep description on one line, cost in W8.</summary>
        static void WriteProjectRow(ColumnDescriptor col, int seq, string description, double cost)
        {
            float fs = 6f;
            col.Item().Row(row =>
            {
                row.RelativeItem(WA).Text("");
                row.RelativeItem(WB+W1+W2+W3+W4+W5+W6+W7)
                   .PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                   .Text(t =>
                   {
                       t.Span($"{seq}.  ").FontSize(fs).Bold();
                       t.Span(description).FontSize(fs);
                   });
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatP(cost)).FontSize(fs);
            });
        }

        /// <summary>Component row -- ComponentId + ScopeDescription in W0 column, detail data in remaining columns.</summary>
        static void WriteComponentRow(ColumnDescriptor col, RBPCData comp)
        {
            float fs = 5.5f;

            col.Item().Row(row =>
            {
                // leave WA empty to align with project description
                row.RelativeItem(WA).Text("");

                // ComponentId + ScopeDescription aligned under project description
                row.RelativeItem(WB).PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                   .Text(t =>
                   {
                       t.Span(comp.ComponentId ?? "").FontSize(fs).Bold();
                       if (!string.IsNullOrEmpty(comp.ScopeDescription))
                           t.Span($"  {comp.ScopeDescription}").FontSize(fs);
                   });

                // Type of Work
                row.RelativeItem(W1).Text("");

                // Project Location
                row.RelativeItem(W2+W3).Text("");

                // Details of Work
                row.RelativeItem(W4).PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                   .Text(comp.DetailsOfWork ?? "").FontSize(fs);

                // Length of Work
                row.RelativeItem(W5).PaddingRight(3).Column(c =>
                {
                    c.Item().AlignRight().PaddingRight(2).PaddingVertical(1)
                       .Text(FormatDecimal(comp.LengthOfWork)).FontSize(fs);
                    if (comp.LengthOfWork is not null and not 0)
                        c.Item().LineHorizontal(0.5f).LineColor(Colors.Black);
                });

                // Physical Target
                row.RelativeItem(W6).PaddingRight(3).Column(c =>
                {
                    c.Item().AlignRight().PaddingRight(2).PaddingVertical(1)
                       .Text(FormatDecimal(comp.PhysicalTarget)).FontSize(fs);
                    if (comp.PhysicalTarget is not null and not 0)
                        c.Item().LineHorizontal(0.5f).LineColor(Colors.Black);
                });

                // Target Unit
                row.RelativeItem(W7).PaddingLeft(2).PaddingVertical(1)
                   .Text(comp.TargetUnit ?? comp.ScopeMeasure ?? "").FontSize(fs);

                // Component Cost
                row.RelativeItem(W8).Column(c =>
                {
                    c.Item().AlignRight().PaddingRight(2).PaddingVertical(1)
                       .Text(FormatP(comp.ComponentCost)).FontSize(fs);
                    if (comp.ComponentCost != 0)
                        c.Item().LineHorizontal(0.5f).LineColor(Colors.Black);
                });
            });
        }

        // -- SIGNATURE BLOCK
        static void BuildSignatureBlock(IContainer container)
        {
            container.Padding(10).Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Prepared By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(10)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning Engineer").FontSize(7);
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Reviewed By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(10)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning and Design Division Chief").FontSize(7);
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Approved By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(10)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Regional Director").FontSize(7);
                });
            });
        }

        // -- HELPERS
        static string FormatP(double v) => v == 0 ? "" : (v / 1000).ToString("N2");
        static string FormatDecimal(double? v) => v is null or 0 ? "" : v.Value.ToString("N2");
        static string ToRoman(int tier) => tier switch
        {
            1 => "I", 2 => "II", 3 => "III", 4 => "IV", 5 => "V", _ => tier.ToString()
        };
    }
}
