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
        // 9 relative column weights
        const float W0=10, W1=20, W2=4, W3=6, W4=10, W5=5, W6=5, W7=5, W8=8;

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
            string fiscalYear = year > 0 ? $"FY {year}  " : "";
            string title = $"{fiscalYear}REGIONAL BUDGET PROPOSAL";
            if (!string.IsNullOrEmpty(stageName)) title += $" -- {stageName}";
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(6).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                // -- HEADER
                page.Header()
                    .Column(col =>
                    {
                        col.Item().AlignCenter()
                           .Text(title)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(10).Bold();
                        col.Item().AlignCenter()
                           .Text("(ONGOING, NEW AND EXPANDED PROGRAMS, ACTIVITIES AND PROJECTS)")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(8);
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
            container.BorderBottom(0.5f).BorderColor(Colors.Black).Row(row =>
            {
                HdrCell(row, W0, "DEO/LD");
                HdrCell(row, W1, "Programs/Activities\n/ Projects");
                HdrCell(row, W2, "Type of\nWork");
                HdrCell(row, W3, "Project\nLocation");
                HdrCell(row, W4, "Details of Work");
                HdrCell(row, W5, "Length of\nWork (m)");
                HdrCell(row, W6, "Physical\nTarget");
                HdrCell(row, W7, "Target\nUnit");
                HdrCell(row, W8, "Project Cost\n(P'000)");
            });
        }

        static void HdrCell(RowDescriptor row, float weight, string text)
        {
            row.RelativeItem(weight)
               .AlignCenter().AlignMiddle()
               .Padding(3)
               .Text(text).Bold().FontSize(6);
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
                                        }
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
            float fs = 7;
            int projCount = rows.Select(r => r.ProjectDescription).Distinct().Count();
            double totalCost = rows.Sum(r => r.ComponentCost);

            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingVertical(1).PaddingLeft(indent + 2f).PaddingRight(2)
                   .Text(t => { var s = t.Span(label).FontSize(fs); if (bold) s.Bold(); });

                // cols 1-4 empty
                row.RelativeItem(W1).Text("");
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).Text("");

                // col 5: count
                row.RelativeItem(W5).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(t => { var s = t.Span(projCount.ToString()).FontSize(fs); if (bold) s.Bold(); });

                // col 6: "projects"
                row.RelativeItem(W6).PaddingLeft(2).PaddingVertical(1)
                   .Text(t => { var s = t.Span("projects").FontSize(fs); if (bold) s.Bold(); });

                // col 7 empty, col 8: total cost
                row.RelativeItem(W7).Text("");
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(t => { var s = t.Span(FormatP(totalCost)).FontSize(fs); if (bold) s.Bold(); });
            });
        }

        /// <summary>Category row -- label, cost in last column.</summary>
        static void WriteCategoryRow(ColumnDescriptor col, string label, IEnumerable<RBPCData> rows)
        {
            float fs = 6.5f;
            double totalCost = rows.Sum(r => r.ComponentCost);
            col.Item().Row(row =>
            {
                row.RelativeItem(W0+W1+W2+W3+W4+W5+W6+W7)
                   .PaddingVertical(1).PaddingLeft(34).PaddingRight(2)
                   .Text(label).FontSize(fs);
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatP(totalCost)).FontSize(fs);
            });
        }

        /// <summary>Thrust row -- label spans full width, no amounts.</summary>
        static void WriteThrustRow(ColumnDescriptor col, string label)
        {
            float fs = 6;
            col.Item().PaddingVertical(1).PaddingLeft(42).PaddingRight(2)
               .Text(label).FontSize(fs);
        }

        /// <summary>Project row -- seq + description, cost.</summary>
        static void WriteProjectRow(ColumnDescriptor col, int seq, string description, double cost)
        {
            float fs = 6;
            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingVertical(1).PaddingLeft(18).PaddingRight(2)
                   .Text($"{seq}.").FontSize(fs);
                row.RelativeItem(W1).PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                   .Text(description).FontSize(fs);
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).Text("");
                row.RelativeItem(W6).Text("");
                row.RelativeItem(W7).Text("");
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatP(cost)).FontSize(fs);
            });
        }

        /// <summary>Component -- 2 layout rows: summary line + detail line.</summary>
        static void WriteComponentRow(ColumnDescriptor col, RBPCData comp)
        {
            float fs = 5.5f;

            // Row 1: component summary
            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingVertical(1).PaddingLeft(24).PaddingRight(2)
                   .Text(comp.ComponentId).FontSize(fs);
                row.RelativeItem(W1).PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                   .Text(comp.ScopeDescription ?? "").FontSize(fs);
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).Text("");
                row.RelativeItem(W5).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatDecimal(comp.LengthOfWork)).FontSize(fs);
                row.RelativeItem(W6).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatDecimal(comp.PhysicalTarget)).FontSize(fs);
                row.RelativeItem(W7).PaddingLeft(2).PaddingVertical(1)
                   .Text(comp.TargetUnit ?? comp.ScopeMeasure ?? "").FontSize(fs);
                row.RelativeItem(W8).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatP(comp.ComponentCost)).FontSize(fs);
            });

            // Row 2: scope detail
            col.Item().Row(row =>
            {
                row.RelativeItem(W0).Text("");
                row.RelativeItem(W1).Text("");
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                   .Text(comp.DetailsOfWork ?? "").FontSize(fs);
                row.RelativeItem(W5).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatDecimal(comp.LengthOfWork)).FontSize(fs);
                row.RelativeItem(W6).AlignRight().PaddingRight(2).PaddingVertical(1)
                   .Text(FormatDecimal(comp.PhysicalTarget)).FontSize(fs);
                row.RelativeItem(W7).PaddingLeft(2).PaddingVertical(1)
                   .Text(comp.ScopeMeasure ?? "").FontSize(fs);
                row.RelativeItem(W8).Text("");
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
                        .Text("Planning Engineer").FontSize(7).Italic();
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Reviewed By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(10)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning and Design Division Chief").FontSize(7).Italic();
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Approved By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(10)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Regional Director").FontSize(7).Italic();
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
