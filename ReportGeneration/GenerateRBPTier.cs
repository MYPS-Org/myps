using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RBPData = DBHelper.Models.Procedures.GenerateRBP;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>RBP by Tier</b> PDF report (A4 Landscape).
    /// <para>
    /// Uses Row/Column layout (no Table) to avoid PDF cell-border artifacts in Adobe.
    /// Same pivot columns as <see cref="GenerateRBP"/> but rows grouped: Region -> Tier -> DEO -> Legislative District.
    /// All summary rows are bold with top borders to separate tiers.
    /// </para>
    /// <para>Data source: <c>pGenerateRBP</c>.</para>
    /// </summary>
    public class GenerateRBPTier
    {
        const float WL = 20, WC = 5, WA = 11;

        /// <summary>
        /// Entry point -- builds and returns the RBP Tier PDF as a byte array.
        /// </summary>
        /// <param name="data">Flat row list from <c>pGenerateRBP</c>.</param>
        /// <param name="year">Fiscal year shown in the title. Pass 0 to omit.</param>
        /// <param name="stageName">Full stage label appended to the title.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(List<RBPData> data, int year = 0, string stageName = "")
        {
            int FooterFs = 7;
            string fiscalYear = year > 0 ? $"FY {year} " : "";
            string title = $"SUMMARY OF {fiscalYear}BUDGET PROPOSAL";
            if (!string.IsNullOrEmpty(stageName)) title += $" -- {stageName}";
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
                        col.Item().AlignCenter()
                           .Text(title)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(10).Bold();
                        if (!string.IsNullOrEmpty(regionName))
                            col.Item().AlignCenter()
                               .Text(regionName)
                               .FontFamily(GeneratePDF.FontFamily).FontSize(9).Bold();
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
            container.BorderBottom(0.5f).BorderColor(Colors.Black).Column(col =>
            {
                // Row 1 -- group labels
                col.Item().Row(row =>
                {
                    HdrCell(row, WL, "DISTRICT ENGINEERING OFFICE /\nLEGISLATIVE DISTRICT");
                    HdrCell(row, WC + WA, "OO-1");
                    HdrCell(row, WC + WA, "OO-2");
                    HdrCell(row, WC + WA, "CSSP");
                    HdrCell(row, WC + WA, "LP");
                    HdrCell(row, WC + WA, "TOTAL");
                });
                // Row 2 -- sub-labels
                col.Item().Row(row =>
                {
                    row.RelativeItem(WL).Text("");
                    for (int i = 0; i < 5; i++)
                    {
                        HdrCell(row, WC, "No. of\nProj.");
                        HdrCell(row, WA, "Amount\n(P'000)");
                    }
                });
            });
        }

        static void HdrCell(RowDescriptor row, float weight, string text)
        {
            row.RelativeItem(weight)
               .AlignCenter().AlignMiddle()
               .Padding(3)
               .Text(text).Bold().FontSize(6.5f);
        }

        // -- TABLE CONTENT
        /// <summary>Builds the tier pivot body. Grouping: Region -> Tier (bold) -> DEO -> Legislative District.</summary>
        static void BuildTableContent(IContainer container, List<RBPData> data)
        {
            container.Column(col =>
            {
                foreach (var regionGrp in data.GroupBy(r => r.Region).OrderBy(g => g.Key))
                {
                    WriteDataRow(col, regionGrp.Key, regionGrp, fontSize: 7, bold: true, topBorder: true);

                    foreach (var tierGrp in regionGrp.GroupBy(r => r.Tier).OrderBy(g => g.Key))
                    {
                        WriteDataRow(col, $"Tier {ToRoman(tierGrp.Key)}", tierGrp,
                            fontSize: 7, bold: true, topBorder: true);

                        foreach (var deoGrp in tierGrp.GroupBy(r => r.DEO).OrderBy(g => g.Key))
                        {
                            WriteDataRow(col, deoGrp.Key, deoGrp,
                                indent: 4, fontSize: 7, bold: true, topBorder: true);

                            foreach (var distGrp in deoGrp.GroupBy(r => r.LegislativeDistrict).OrderBy(g => g.Key))
                            {
                                WriteDataRow(col, distGrp.Key, distGrp,
                                    indent: 10, fontSize: 7);
                            }
                        }
                    }
                }
            });
        }

        // -- ROW RENDERING
        /// <summary>
        /// Renders one labeled data row with aggregated counts and amounts.
        /// Optionally draws a top border (used to separate Tier sections).
        /// </summary>
        static void WriteDataRow(
            ColumnDescriptor col,
            string label,
            IEnumerable<RBPData> rows,
            int indent = 0,
            float fontSize = 7,
            bool bold = false,
            bool topBorder = false)
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

            col.Item()
               .Row(row =>
            {
                // Label
                row.RelativeItem(WL)
                   .PaddingVertical(2).PaddingLeft(indent + 2f)
                   .Text(t => { var s = t.Span(label).FontSize(fontSize); if (bold) s.Bold(); });

                CountCell(row, WC, oo1Proj, fontSize, bold);
                AmtCell(row, WA, oo1Amt, fontSize, bold);
                CountCell(row, WC, oo2Proj, fontSize, bold);
                AmtCell(row, WA, oo2Amt, fontSize, bold);
                CountCell(row, WC, csspProj, fontSize, bold);
                AmtCell(row, WA, csspAmt, fontSize, bold);
                CountCell(row, WC, lpProj, fontSize, bold);
                AmtCell(row, WA, lpAmt, fontSize, bold);
                CountCell(row, WC, totProj, fontSize, bold);
                AmtCell(row, WA, totAmt, fontSize, bold);
            });
        }

        static void CountCell(RowDescriptor row, float weight, int value,
            float fontSize, bool bold)
        {
            row.RelativeItem(weight)
               .AlignRight().PaddingRight(2).PaddingVertical(2)
               .Text(t =>
               {
                   var s = t.Span(value == 0 ? "" : value.ToString()).FontSize(fontSize);
                   if (bold) s.Bold();
               });
        }

        static void AmtCell(RowDescriptor row, float weight, double value,
            float fontSize, bool bold)
        {
            row.RelativeItem(weight)
               .AlignRight().PaddingRight(2).PaddingVertical(2)
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
        static string FormatAmtP(double v) => v == 0 ? "" : (v / 1000).ToString("N2");
        static string ToRoman(int tier) => tier switch
        {
            1 => "I", 2 => "II", 3 => "III", 4 => "IV", 5 => "V", _ => tier.ToString()
        };
    }
}
