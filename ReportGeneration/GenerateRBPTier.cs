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
                        col.Item().PaddingTop(35).Element(BuildTableHeader);
                    });

                // -- CONTENT
                page.Content()
                    .Column(col =>
                    {
                        col.Item().Element(c => BuildTableContent(c, data));
                        col.Item().PaddingTop(10).ShowEntire().Element(BuildSignatureBlock);
                    });

                // -- FOOTER
                GeneratePDF.BuildFooter(page, FooterFs);
            });
        }

        // -- TABLE HEADER
        static void BuildTableHeader(IContainer container)
        {
            var categories = new[] { "OO-1", "OO-2", "CSSP", "LP", "TOTAL" };
            float rightWeight = (WC + WA) * categories.Length;

            container.Border(0.5f).BorderColor(Colors.Black).Row(mainRow =>
            {
                // Label cell -- spans both sub-rows (merged)
                mainRow.RelativeItem(WL)
                       .BorderRight(0.5f).BorderColor(Colors.Black)
                       .AlignCenter().AlignMiddle().Padding(3)
                       .Text("DISTRICT ENGINEERING OFFICE /\nLEGISLATIVE DISTRICT")
                       .Bold().FontSize(6.5f);

                // Right side: two stacked sub-rows
                mainRow.RelativeItem(rightWeight).Column(rightCol =>
                {
                    // Sub-row 1: category group labels
                    rightCol.Item().BorderBottom(0.5f).BorderColor(Colors.Black).Row(row =>
                    {
                        for (int i = 0; i < categories.Length; i++)
                        {
                            row.RelativeItem(WC + WA)
                               .BorderLeft(0.5f).BorderColor(Colors.Black)
                               .AlignCenter().AlignMiddle().Padding(3)
                               .Text(categories[i]).Bold().FontSize(6.5f);
                        }
                    });

                    // Sub-row 2: No. of Proj / Amount sub-labels
                    rightCol.Item().Row(row =>
                    {
                        for (int i = 0; i < categories.Length; i++)
                        {
                            row.RelativeItem(WC)
                               .BorderLeft(0.5f).BorderColor(Colors.Black)
                               .AlignCenter().AlignMiddle().Padding(3)
                               .Text("No. of\nProj.").Bold().FontSize(6.5f);
                            row.RelativeItem(WA)
                               .BorderLeft(0.5f).BorderColor(Colors.Black)
                               .AlignCenter().AlignMiddle().Padding(3)
                               .Text("Amount\n(P'000)").Bold().FontSize(6.5f);
                        }
                    });
                });
            });
        }

        // -- TABLE CONTENT
        /// <summary>Builds the tier pivot body. Grouping: Region -> Tier (bold) -> DEO -> Legislative District.</summary>
        static void BuildTableContent(IContainer container, List<RBPData> data)
        {
            container.BorderLeft(0.5f).BorderRight(0.5f).BorderBottom(0.5f).BorderColor(Colors.Black).Column(col =>
            {
                foreach (var regionGrp in data.GroupBy(r => r.Region).OrderBy(g => g.Key))
                {
                    WriteDataRow(col, regionGrp.Key, regionGrp, fontSize: 7, labelFontSize: 9, bold: true, borderTop: true, borderBottom: true, underline: true);

                    var tierGroups = regionGrp.GroupBy(r => r.Tier).OrderBy(g => g.Key).ToList();
                    for (int ti = 0; ti < tierGroups.Count; ti++)
                    {
                        var tierGrp = tierGroups[ti];

                        WriteDataRow(col, $"Tier {ToRoman(tierGrp.Key)}", tierGrp,
                            fontSize: 7, labelFontSize: 9, bold: true,
                            borderTop: true, borderBottom: true, underline: true);

                        foreach (var deoGrp in tierGrp.GroupBy(r => r.DEO).OrderBy(g => g.Key))
                        {
                            WriteDataRow(col, deoGrp.Key, deoGrp,
                                indent: 4, fontSize: 7, bold: true, borderTop: true);

                            var distGroups = deoGrp.GroupBy(r => r.LegislativeDistrict).OrderBy(g => g.Key).ToList();
                            for (int di = 0; di < distGroups.Count; di++)
                            {
                                bool isLast = di == distGroups.Count - 1;
                                string ldLabel = isLast
                                    ? distGroups[di].Key + "\n"
                                    : distGroups[di].Key;
                                WriteDataRow(col, ldLabel, distGroups[di],
                                    indent: 10, fontSize: 7, borderTop: true);
                            }
                        }
                    }
                }
            });
        }

        // -- ROW RENDERING
        /// <summary>
        /// Renders one labeled data row with aggregated counts and amounts.
        /// </summary>
        static void WriteDataRow(
            ColumnDescriptor col,
            string label,
            IEnumerable<RBPData> rows,
            int indent = 0,
            float fontSize = 7,
            float labelFontSize = 0,
            bool bold = false,
            bool borderTop = false,
            bool borderBottom = false,
            bool underline = false)
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

            var rowItem = col.Item();
            if (borderTop)    rowItem = rowItem.BorderTop(0.5f).BorderColor(Colors.Black);
            if (borderBottom) rowItem = rowItem.BorderBottom(0.5f).BorderColor(Colors.Black);

            rowItem.Background(Colors.White).Row(row =>
            {
                // Label
                row.RelativeItem(WL)
                   .BorderRight(0.5f).BorderColor(Colors.Black)
                   .Background(Colors.White)
                   .PaddingVertical(2).PaddingLeft(indent + 2f)
                   .Text(t => { var s = t.Span(label).FontSize(labelFontSize > 0 ? labelFontSize : fontSize); if (bold) s.Bold(); if (underline) s.Underline(); });

                CountCell(row, WC, oo1Proj, fontSize, bold, underline);
                AmtCell(row, WA, oo1Amt, fontSize, bold, underline);
                CountCell(row, WC, oo2Proj, fontSize, bold, underline);
                AmtCell(row, WA, oo2Amt, fontSize, bold, underline);
                CountCell(row, WC, csspProj, fontSize, bold, underline);
                AmtCell(row, WA, csspAmt, fontSize, bold, underline);
                CountCell(row, WC, lpProj, fontSize, bold, underline);
                AmtCell(row, WA, lpAmt, fontSize, bold, underline);
                CountCell(row, WC, totProj, fontSize, bold, underline);
                AmtCell(row, WA, totAmt, fontSize, bold, underline);
            });
        }

        static void CountCell(RowDescriptor row, float weight, int value,
            float fontSize, bool bold, bool underline = false)
        {
            var display = value == 0 ? "" : value.ToString("N0");
            row.RelativeItem(weight)
               .BorderLeft(0.5f).BorderColor(Colors.Black)
               .Background(Colors.White)
               .AlignRight().PaddingRight(2).PaddingVertical(2)
               .Text(t =>
               {
                   var s = t.Span(display).FontSize(fontSize);
                   if (bold) s.Bold();
                   if (underline) s.Underline();
               });
        }

        static void AmtCell(RowDescriptor row, float weight, double value,
            float fontSize, bool bold, bool underline = false)
        {
            var display = value == 0 ? "" : FormatAmtP(value);
            row.RelativeItem(weight)
               .BorderLeft(0.5f).BorderColor(Colors.Black)
               .Background(Colors.White)
               .AlignRight().PaddingRight(2).PaddingVertical(2)
               .Text(t =>
               {
                   var s = t.Span(display).FontSize(fontSize);
                   if (bold) s.Bold();
                   if (underline) s.Underline();
               });
        }
        static void BuildSignatureBlock(IContainer container)
        {
            container.Padding(10).Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Prepared By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(30)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning Engineer").FontSize(7);
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Reviewed By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(30)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning and Design Division Chief").FontSize(7);
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Approved By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(30)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Regional Director").FontSize(7);
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
