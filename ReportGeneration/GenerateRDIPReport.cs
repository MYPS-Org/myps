using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RDIPData = DBHelper.Models.Procedures.GenerateRDIP;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>Regional Development Investment Plan (RDIP)</b> PDF report (A4 Landscape).
    /// <para>
    /// Uses Row/Column layout (no Table) to avoid PDF cell-border artifacts in Adobe.
    /// Grouping: Category -> Program -> Sub-Program -> Activity -> Project.
    /// Year columns are dynamically derived from the minimum StartYear in the data.
    /// </para>
    /// <para>Data source: <c>pGenerateRDIP</c>.</para>
    /// </summary>
    public class GenerateRDIP
    {
        // 14 relative column weights
        const float W0=22, W1=7, W2=8, W3=3.5f, W4=3.5f;
        const float W5=8,  W6=7, W7=7, W8=7,    W9=7;
        const float W10=7, W11=7, W12=6, W13=4;

        /// <summary>
        /// Entry point -- builds and returns the RDIP PDF as a byte array.
        /// </summary>
        /// <param name="data">Flat row list from <c>pGenerateRDIP</c>.</param>
        /// <param name="year">Fiscal year shown in the title. Pass 0 to omit.</param>
        /// <param name="stageName">Full stage label appended to the title.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(List<RDIPData> data, int year = 0, string stageName = "")
        {
            int FooterFs = 7;
            int LowestYear = data.Min(r => r.StartYear);
            string fiscalYear = year > 0 ? $" FY {year}" : "";
            string title = $"Regional Development Investment Plan (RDIP){fiscalYear}";
            if (!string.IsNullOrEmpty(stageName)) title += $" -- {stageName}";
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(6).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                var regionName = data.FirstOrDefault()?.Region ?? "Region I";

                // -- HEADER
                page.Header()
                    .Column(col =>
                    {
                        col.Item().AlignCenter()
                           .Text(title)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(10).Bold();
                        col.Item().AlignCenter()
                           .Text(regionName)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(9).Bold();
                        col.Item().PaddingTop(2)
                           .Text("PDF Chapter: Chapter 19 - Accelerating Infrastructure Development")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(7);
                        col.Item()
                           .Text("Agency: Department of Public Works and Highways")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(7);
                        col.Item().PaddingTop(6).Element(c => BuildTableHeader(c, LowestYear));
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

        // -- TABLE HEADER (3 rows)
        /// <summary>
        /// Renders the 3-row header using Column+Row layout.
        /// Year columns in row 3 are labeled dynamically starting from <paramref name="LowestYear"/>.
        /// </summary>
        static void BuildTableHeader(IContainer container, int LowestYear)
        {
            container.BorderBottom(0.5f).BorderColor(Colors.Black).Column(col =>
            {
                // Row 1
                col.Item().Row(row =>
                {
                    HdrCell(row, W0, "Program/Sub-Program/Projects");
                    HdrCell(row, W1 + W2, "Spatial Coverage");
                    HdrCell(row, W3 + W4, "Implementation Period");
                    HdrCell(row, W5 + W6 + W7 + W8 + W9 + W10 + W11 + W12, "Investment Cost");
                    HdrCell(row, W13, "Remarks");
                });
                // Row 2
                col.Item().Row(row =>
                {
                    row.RelativeItem(W0).Text("");
                    HdrCell(row, W1, "Province/\nMunicipality");
                    HdrCell(row, W2, "Congressional\nDistrict");
                    HdrCell(row, W3, "Start of\nProject\nImplemen-\ntation");
                    HdrCell(row, W4, "Year of\nProject\nImplemen-\ntation");
                    HdrCell(row, W5, "TOTAL Cost");
                    HdrCell(row, W6, "FirstYear");
                    HdrCell(row, W7, "SecondYear");
                    HdrCell(row, W8, "ThirdYear");
                    HdrCell(row, W9, "FourthYear");
                    HdrCell(row, W10, "FifthYear");
                    HdrCell(row, W11, "SixthYear");
                    HdrCell(row, W12, "Later\nYears");
                    row.RelativeItem(W13).Text("");
                });
                // Row 3 -- year numbers
                col.Item().Row(row =>
                {
                    row.RelativeItem(W0 + W1 + W2 + W3 + W4 + W5).Text("");
                    HdrCell(row, W6,  $"({LowestYear})");
                    HdrCell(row, W7,  $"({LowestYear + 1})");
                    HdrCell(row, W8,  $"({LowestYear + 2})");
                    HdrCell(row, W9,  $"({LowestYear + 3})");
                    HdrCell(row, W10, $"({LowestYear + 4})");
                    HdrCell(row, W11, $"({LowestYear + 5})");
                    HdrCell(row, W12, $"({LowestYear + 6}...)");
                    row.RelativeItem(W13).Text("");
                });
            });
        }

        static void HdrCell(RowDescriptor row, float weight, string text)
        {
            row.RelativeItem(weight)
               .AlignCenter().AlignMiddle()
               .Padding(3)
               .Text(text).Bold().FontSize(5.5f);
        }

        // -- TABLE CONTENT
        /// <summary>
        /// Builds the RDIP content as a Column of Rows.
        /// Grouping: Category -> Program -> Sub-Program -> Activity -> Project.
        /// </summary>
        static void BuildTableContent(IContainer container, List<RDIPData> data)
        {
            container.Column(col =>
            {
                foreach (var catGrp in data.GroupBy(r => r.CategoryName).OrderBy(g => g.Key))
                {
                    WriteSummaryRow(col, catGrp.Key, catGrp, fontSize: 7, bold: true);

                    foreach (var progGrp in catGrp.GroupBy(r => r.ThrustProgramName).OrderBy(g => g.Key))
                    {
                        WriteSummaryRow(col, progGrp.Key, progGrp, indent: 6, fontSize: 6.5f);

                        foreach (var subGrp in progGrp.GroupBy(r => r.ThrustSubProgramName ?? "").OrderBy(g => g.Key))
                        {
                            if (!string.IsNullOrEmpty(subGrp.Key))
                                WriteSummaryRow(col, subGrp.Key, subGrp, indent: 12, fontSize: 6.5f);

                            foreach (var actGrp in subGrp.GroupBy(r => r.ThrustActivityName ?? "").OrderBy(g => g.Key))
                            {
                                if (!string.IsNullOrEmpty(actGrp.Key))
                                    WriteSummaryRow(col, actGrp.Key, actGrp, indent: 18, fontSize: 6);

                                int seq = 0;
                                foreach (var proj in actGrp.OrderBy(p => p.ProjectId))
                                {
                                    seq++;
                                    WriteProjectRow(col, seq, proj);
                                }
                            }
                        }
                    }
                }
            });
        }

        // -- ROW RENDERING

        /// <summary>Category / Program / Sub-Program / Activity summary row with aggregated yearly totals.</summary>
        static void WriteSummaryRow(
            ColumnDescriptor col,
            string label,
            IEnumerable<RDIPData> rows,
            int indent = 0,
            float fontSize = 6,
            bool bold = false)
        {
            var totalCost  = rows.Sum(r => r.TotalCost);
            var firstYear  = rows.Sum(r => r.FirstYear);
            var secondYear = rows.Sum(r => r.SecondYear);
            var thirdYear  = rows.Sum(r => r.ThirdYear);
            var fourthYear = rows.Sum(r => r.FourthYear);
            var fifthYear  = rows.Sum(r => r.FifthYear);
            var sixthYear  = rows.Sum(r => r.SixthYear);
            var laterYears = rows.Sum(r => r.LaterYears);

            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingVertical(2).PaddingLeft(indent + 2f).PaddingRight(2)
                   .Text(t => { var s = t.Span(label).FontSize(fontSize); if (bold) s.Bold(); });

                // Spatial / implementation columns empty for summary rows
                row.RelativeItem(W1).Text("");
                row.RelativeItem(W2).Text("");
                row.RelativeItem(W3).Text("");
                row.RelativeItem(W4).Text("");

                AmountCell(row, W5, totalCost, fontSize, bold);
                AmountCell(row, W6, firstYear, fontSize, bold);
                AmountCell(row, W7, secondYear, fontSize, bold);
                AmountCell(row, W8, thirdYear, fontSize, bold);
                AmountCell(row, W9, fourthYear, fontSize, bold);
                AmountCell(row, W10, fifthYear, fontSize, bold);
                AmountCell(row, W11, sixthYear, fontSize, bold);
                AmountCell(row, W12, laterYears, fontSize, bold);

                row.RelativeItem(W13).Text("");
            });
        }

        /// <summary>Project row with all spatial, implementation, and yearly amount columns populated.</summary>
        static void WriteProjectRow(ColumnDescriptor col, int seq, RDIPData proj)
        {
            float fs = 6;
            col.Item().Row(row =>
            {
                row.RelativeItem(W0).PaddingVertical(2).PaddingLeft(24).PaddingRight(2)
                   .Text($"{seq}. {proj.ProjectDescription}").FontSize(fs);

                row.RelativeItem(W1).AlignCenter().AlignMiddle().Padding(2)
                   .Text($"{proj.CityMunicipality}\n({proj.Province})").FontSize(fs);

                row.RelativeItem(W2).AlignCenter().AlignMiddle().Padding(2)
                   .Text(proj.CongressionalDistrict).FontSize(fs);

                row.RelativeItem(W3).AlignCenter().AlignMiddle().Padding(2)
                   .Text(proj.StartYear.ToString()).FontSize(fs);

                row.RelativeItem(W4).AlignCenter().AlignMiddle().Padding(2)
                   .Text(proj.EndYear.ToString()).FontSize(fs);

                AmountCell(row, W5, proj.TotalCost, fs, false);
                AmountCell(row, W6, proj.FirstYear, fs, false);
                AmountCell(row, W7, proj.SecondYear, fs, false);
                AmountCell(row, W8, proj.ThirdYear, fs, false);
                AmountCell(row, W9, proj.FourthYear, fs, false);
                AmountCell(row, W10, proj.FifthYear, fs, false);
                AmountCell(row, W11, proj.SixthYear, fs, false);
                AmountCell(row, W12, proj.LaterYears, fs, false);

                row.RelativeItem(W13).Text("");
            });
        }

        static void AmountCell(RowDescriptor row, float weight, double value, float fontSize, bool bold)
        {
            row.RelativeItem(weight)
               .AlignRight().PaddingRight(2).PaddingVertical(2)
               .Text(t =>
               {
                   var display = value == 0 ? "" : value.ToString("N0");
                   var s = t.Span(display).FontSize(fontSize);
                   if (bold) s.Bold();
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
    }
}
