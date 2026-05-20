using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RBPData = DBHelper.Models.Procedures.GenerateRBP;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>RBP Summary</b> (Regional Budget Proposal) PDF report (A4 Landscape).
    /// <para>
    /// Uses a bordered Row/Column grid layout to match the official RBP template.
    /// Pivot structure: Region -> Tier -> DEO -> Legislative District.
    /// Columns: label, OO-1 (count/P'000), OO-2, CSSP, LP, TOTAL.
    /// </para>
    /// <para>Data source: <c>pGenerateRBP</c>.</para>
    /// </summary>
    public class GenerateRBP
    {
        // Relative column weights: label, then 5x (count + amount)
        const float WL = 28, WC = 5, WA = 12;

        /// <summary>
        /// Entry point -- builds and returns the RBP Summary PDF as a byte array.
        /// </summary>
        /// <param name="data">Flat row list from <c>pGenerateRBP</c>.</param>
        /// <param name="year">Fiscal year shown in the title. Pass 0 to omit.</param>
        /// <param name="stageName">Full stage label appended to the title.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(List<RBPData> data, int year = 0, string stageName = "")
        {
            int FooterFs = 7;
            var logo = GeneratePDF.GetLogo();
            string fiscalYear = year > 0 ? $"FY {year} " : "";
            string title = $"SUMMARY OF {fiscalYear}BUDGET PROPOSAL";

            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(7).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                var regionName = data.FirstOrDefault()?.Region?.ToUpper() ?? "";

                // -- HEADER
                page.Header()
                    .Column(col =>
                    {
                        GeneratePDF.BuildDPWHHeader(col, logo, title, regionName: regionName);
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
        /// <summary>
        /// Renders a single-row bordered header where the label cell spans the full height
        /// and each category column contains its group label on top and sub-labels below.
        /// </summary>
        static void BuildTableHeader(IContainer container)
        {
            var categories = new[] { "OO-1", "OO-2", "CSSP", "LP", "TOTAL" };
            container.Row(row =>
            {
                // Label cell -- full height spanning both logical header rows
                row.RelativeItem(WL)
                   .Border(0.5f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(3)
                   .Text("DISTRICT ENGINEERING OFFICE /\nLEGISLATIVE DISTRICT")
                   .Bold().FontSize(6.5f);

                // Category columns
                for (int i = 0; i < categories.Length; i++)
                {
                    bool isLast = i == categories.Length - 1;
                    var catName = categories[i];
                    row.RelativeItem(WC + WA)
                       .BorderTop(0.5f).BorderColor(Colors.Black)
                       .BorderLeft(0.5f).BorderColor(Colors.Black)
                       .BorderBottom(0.5f).BorderColor(Colors.Black)
                       .BorderRight(isLast ? 0.5f : 0f).BorderColor(Colors.Black)
                       .Column(col =>
                       {
                           // Group label row
                           col.Item()
                              .BorderBottom(0.5f).BorderColor(Colors.Black)
                              .AlignCenter().AlignMiddle().Padding(3)
                              .Text(catName).Bold().FontSize(6.5f);
                           // Sub-label row
                           col.Item().Row(subRow =>
                           {
                               subRow.RelativeItem(WC)
                                     .BorderRight(0.5f).BorderColor(Colors.Black)
                                     .AlignCenter().AlignMiddle().Padding(3)
                                     .Text("No. of\nProj.").Bold().FontSize(6.5f);
                               subRow.RelativeItem(WA)
                                     .AlignCenter().AlignMiddle().Padding(3)
                                     .Text("Amount\n(P'000)").Bold().FontSize(6.5f);
                           });
                       });
                }
            });
        }

        /// <summary>Renders a single bordered header cell.</summary>
        static void HdrCell(RowDescriptor row, float weight, string text,
            bool borderLeft = false, bool borderTop = false,
            bool borderBottom = false, bool borderRight = false)
        {
            // Borders must be applied before alignment/padding so they wrap the outer edge
            var cell = row.RelativeItem(weight);
            if (borderLeft)   cell = cell.BorderLeft(0.5f).BorderColor(Colors.Black);
            if (borderTop)    cell = cell.BorderTop(0.5f).BorderColor(Colors.Black);
            if (borderBottom) cell = cell.BorderBottom(0.5f).BorderColor(Colors.Black);
            if (borderRight)  cell = cell.BorderRight(0.5f).BorderColor(Colors.Black);

            cell.AlignCenter().AlignMiddle().Padding(3)
                .Text(text).Bold().FontSize(6.5f);
        }

        // -- TABLE CONTENT
        /// <summary>Builds the pivot table body. Grouping: Region -> Tier -> DEO -> Legislative District.</summary>
        static void BuildTableContent(IContainer container, List<RBPData> data)
        {
            container.Column(col =>
            {
                foreach (var regionGrp in data.GroupBy(r => r.Region).OrderBy(g => g.Key))
                {
                    WriteDataRow(col, regionGrp.Key, regionGrp,
                        fontSize: 8, bold: true, dashForZero: true);

                    foreach (var tierGrp in regionGrp.GroupBy(r => r.Tier).OrderBy(g => g.Key))
                    {
                        WriteDataRow(col, $"Tier {ToRoman(tierGrp.Key)}", tierGrp,
                            indent: 4, fontSize: 7.5f, bold: false, dashForZero: true);

                        foreach (var deoGrp in tierGrp.GroupBy(r => r.DEO).OrderBy(g => g.Key))
                        {
                            WriteDataRow(col, deoGrp.Key, deoGrp,
                                indent: 10, fontSize: 7, bold: true, dashForZero: true);

                            foreach (var distGrp in deoGrp.GroupBy(r => r.LegislativeDistrict).OrderBy(g => g.Key))
                            {
                                WriteDataRow(col, distGrp.Key, distGrp,
                                    indent: 20, fontSize: 7, bold: false, dashForZero: true);
                            }
                        }
                    }
                }
            });
        }

        // -- ROW RENDERING
        /// <summary>Renders one labeled bordered data row with aggregated counts and amounts for all 5 budget categories.</summary>
        static void WriteDataRow(
            ColumnDescriptor col,
            string label,
            IEnumerable<RBPData> rows,
            int indent = 0,
            float fontSize = 7,
            bool bold = false,
            bool dashForZero = false)
        {
            var oo1Proj  = rows.Sum(r => r.OO1_NoOfProj ?? 0);
            var oo1Amt   = rows.Sum(r => r.OO1_Amount);
            var oo2Proj  = rows.Sum(r => r.OO2_NoOfProj ?? 0);
            var oo2Amt   = rows.Sum(r => r.OO2_Amount);
            var csspProj = rows.Sum(r => r.CSSP_NoOfProj ?? 0);
            var csspAmt  = rows.Sum(r => r.CSSP_Amount);
            var lpProj   = rows.Sum(r => r.LP_NoOfProj ?? 0);
            var lpAmt    = rows.Sum(r => r.LP_Amount);
            var totProj  = rows.Sum(r => r.Total_NoOfProj ?? 0);
            var totAmt   = rows.Sum(r => r.Total_Amount);

            col.Item().Row(row =>
            {
                // Label cell: no borders in data rows to match reference style
                row.RelativeItem(WL)
                   .PaddingVertical(3).PaddingLeft(indent + 2f)
                   .Text(t =>
                   {
                       var s = t.Span(label).FontSize(fontSize);
                       if (bold) s.Bold();
                   });

                DataCountCell(row, WC, oo1Proj,  fontSize, bold, dashForZero);
                DataAmtCell(row,   WA, oo1Amt,   fontSize, bold);
                DataCountCell(row, WC, oo2Proj,  fontSize, bold, dashForZero);
                DataAmtCell(row,   WA, oo2Amt,   fontSize, bold);
                DataCountCell(row, WC, csspProj, fontSize, bold, dashForZero);
                DataAmtCell(row,   WA, csspAmt,  fontSize, bold);
                DataCountCell(row, WC, lpProj,   fontSize, bold, dashForZero);
                DataAmtCell(row,   WA, lpAmt,    fontSize, bold);
                DataCountCell(row, WC, totProj,  fontSize, bold, dashForZero);
                DataAmtCell(row,   WA, totAmt,   fontSize, bold);
            });
        }

        static void DataCountCell(RowDescriptor row, float weight, int value,
            float fontSize, bool bold, bool dashForZero)
        {
            var display = value == 0 ? (dashForZero ? "-" : "") : value.ToString();
            row.RelativeItem(weight)
               .AlignRight().PaddingRight(2).PaddingVertical(3)
               .Text(t =>
               {
                   var s = t.Span(display).FontSize(fontSize);
                   if (bold) s.Bold();
               });
        }

        static void DataAmtCell(RowDescriptor row, float weight, double value,
            float fontSize, bool bold)
        {
            row.RelativeItem(weight)
               .AlignRight().PaddingRight(2).PaddingVertical(3)
               .Text(t =>
               {
                   var s = t.Span(FormatAmtP(value)).FontSize(fontSize);
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

        // -- HELPERS
        /// <summary>Formats a double as thousands (divides by 1000, N2), or empty string for zero.</summary>
        static string FormatAmtP(double v) =>
            v == 0 ? "" : (v / 1000).ToString("N2");

        /// <summary>Converts an integer tier number (1-5) to a Roman numeral string for display.</summary>
        static string ToRoman(int tier) => tier switch
        {
            1 => "I", 2 => "II", 3 => "III", 4 => "IV", 5 => "V", _ => tier.ToString()
        };
    }
}
