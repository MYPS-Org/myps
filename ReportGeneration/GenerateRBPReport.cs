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
        /// <summary>Builds the pivot table body. Grouping: Region -> DEO -> Legislative District (no Tier row).</summary>
        static void BuildTableContent(IContainer container, List<RBPData> data)
        {
            container.BorderLeft(0.5f).BorderRight(0.5f).BorderBottom(0.5f).BorderColor(Colors.Black).Column(col =>
            {
                foreach (var regionGrp in data.GroupBy(r => r.Region).OrderBy(g => g.Key))
                {
                    foreach (var deoGrp in regionGrp.GroupBy(r => r.DEO).OrderBy(g => g.Key))
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
            });
        }

        /// <summary>
        /// Renders a DEO group where the label column is a single merged cell containing the DEO name
        /// and all its Legislative District names stacked, while the data column shows the DEO aggregate
        /// row followed by per-LD data rows — aligned side by side.
        /// </summary>
        static void WriteDEOGroup(ColumnDescriptor col, IGrouping<string, RBPData> deoGrp, bool borderTop)
        {
            var distGroups = deoGrp.GroupBy(r => r.LegislativeDistrict).OrderBy(g => g.Key).ToList();

            var groupItem = col.Item();
            if (borderTop) groupItem = groupItem.BorderTop(0.5f).BorderColor(Colors.Black);

            // Total weight of the numeric side = 5 categories × (WC + WA)
            float numericWeight = 5 * (WC + WA);

            groupItem.Row(outerRow =>
            {
                // Merged label cell: DEO name on top, then each LD name stacked below
                outerRow.RelativeItem(WL)
                    .Background(Colors.White)
                    .BorderRight(0.5f).BorderColor(Colors.Black)
                    .Column(labelCol =>
                    {
                        // DEO name
                        labelCol.Item()
                            .Background(Colors.White)
                            .PaddingVertical(3).PaddingLeft(12f)
                            .Text(t => { var s = t.Span(deoGrp.Key).FontSize(7); s.Bold(); });

                        // LD names
                        foreach (var dg in distGroups)
                        {
                            labelCol.Item()
                                .Background(Colors.White)
                                .PaddingVertical(3).PaddingLeft(20f)
                                .Text(dg.Key).FontSize(7);
                        }
                    });

                // Numeric data side: DEO aggregate row + one row per LD
                outerRow.RelativeItem(numericWeight)
                    .Background(Colors.White)
                    .Column(dataCol =>
                    {
                        // DEO aggregate row
                        dataCol.Item().Background(Colors.White).Row(r => WriteNumericCells(r, deoGrp, 7, bold: true, underline: false));

                        // Per-LD rows
                        foreach (var dg in distGroups)
                        {
                            dataCol.Item().Background(Colors.White).Row(r => WriteNumericCells(r, dg, 7, bold: false, underline: false));
                        }
                    });
            });
        }

        /// <summary>Writes the 10 numeric cells (5 category pairs) for a data row, without a label cell.</summary>
        static void WriteNumericCells(RowDescriptor row, IEnumerable<RBPData> rows, float fontSize, bool bold, bool underline)
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

            DataCountCell(row, WC, oo1Proj,  fontSize, bold, underline);
            DataAmtCell(row,   WA, oo1Amt,   fontSize, bold, underline);
            DataCountCell(row, WC, oo2Proj,  fontSize, bold, underline);
            DataAmtCell(row,   WA, oo2Amt,   fontSize, bold, underline);
            DataCountCell(row, WC, csspProj, fontSize, bold, underline);
            DataAmtCell(row,   WA, csspAmt,  fontSize, bold, underline);
            DataCountCell(row, WC, lpProj,   fontSize, bold, underline);
            DataAmtCell(row,   WA, lpAmt,    fontSize, bold, underline);
            DataCountCell(row, WC, totProj,  fontSize, bold, underline);
            DataAmtCell(row,   WA, totAmt,   fontSize, bold, underline);
        }

        /// <summary>Renders one labeled data row with aggregated counts and amounts for all 5 budget categories.</summary>
        static void WriteDataRow(
            ColumnDescriptor col,
            string label,
            IEnumerable<RBPData> rows,
            int indent = 0,
            float fontSize = 7,
            bool bold = false,
            bool borderTop = false,
            bool borderBottom = false,
            bool underline = false,
            int paddingBottom = 0)
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
                row.RelativeItem(WL)
                   .BorderRight(0.5f).BorderColor(Colors.Black)
                   .Background(Colors.White)
                   .PaddingTop(2).PaddingBottom(2 + paddingBottom).PaddingLeft(indent + 2f)
                   .Text(t => { var s = t.Span(label).FontSize(fontSize); if (bold) s.Bold(); if (underline) s.Underline(); });

                CountCell(row, WC, oo1Proj,  fontSize, bold, underline);
                AmtCell(row,   WA, oo1Amt,   fontSize, bold, underline);
                CountCell(row, WC, oo2Proj,  fontSize, bold, underline);
                AmtCell(row,   WA, oo2Amt,   fontSize, bold, underline);
                CountCell(row, WC, csspProj, fontSize, bold, underline);
                AmtCell(row,   WA, csspAmt,  fontSize, bold, underline);
                CountCell(row, WC, lpProj,   fontSize, bold, underline);
                AmtCell(row,   WA, lpAmt,    fontSize, bold, underline);
                CountCell(row, WC, totProj,  fontSize, bold, underline);
                AmtCell(row,   WA, totAmt,   fontSize, bold, underline);
            });
        }

        /// <summary>Renders a right-aligned count cell with a left border column separator.</summary>
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

        /// <summary>Renders a right-aligned amount cell (P'000) with a left border column separator.</summary>
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

        /// <summary>Renders a right-aligned count cell with a left border column separator.</summary>
        static void DataCountCell(RowDescriptor row, float weight, int value,
            float fontSize, bool bold, bool underline)
        {
            var display = value == 0 ? "" : value.ToString("N0");
            row.RelativeItem(weight)
               .Background(Colors.White)
               .BorderLeft(0.5f).BorderColor(Colors.Black)
               .PaddingRight(2).PaddingVertical(3)
               .Column(c =>
               {
                   c.Item().AlignRight().Text(t =>
                   {
                       var s = t.Span(display).FontSize(fontSize);
                       if (bold) s.Bold();
                   });
                   if (underline)
                       c.Item().PaddingTop(3).PaddingHorizontal(2)
                           .LineHorizontal(0.75f).LineColor("#333333");
               });
        }

        /// <summary>Renders a right-aligned amount cell (P'000) with a left border column separator.</summary>
        static void DataAmtCell(RowDescriptor row, float weight, double value,
            float fontSize, bool bold, bool underline = false)
        {
            row.RelativeItem(weight)
               .Background(Colors.White)
               .BorderLeft(0.5f).BorderColor(Colors.Black)
               .PaddingRight(2).PaddingVertical(3)
               .Column(c =>
               {
                   c.Item().AlignRight().Text(t =>
                   {
                       var s = t.Span(FormatAmtP(value)).FontSize(fontSize);
                       if (bold) s.Bold();
                   });
                   if (underline)
                       c.Item().PaddingTop(3).PaddingHorizontal(2)
                           .LineHorizontal(0.75f).LineColor("#333333");
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
