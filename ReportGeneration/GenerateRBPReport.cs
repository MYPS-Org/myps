using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RBPData = DBHelper.Models.Procedures.GenerateRBP;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>RBP Summary</b> (Regional Budget Proposal) PDF report (A4 Landscape).
    /// <para>This is the <b>only</b> report that uses the full DPWH logo header (<c>BuildDPWHHeader</c>).</para>
    /// <para>
    /// Pivot table structure — rows grouped as: Region → Tier → DEO → Legislative District.
    /// Columns: DEO/LD label · OO-1 (count + P'000) · OO-2 · CSSP · LP · TOTAL.
    /// </para>
    /// <para>Data source: <c>pGenerateRBP</c>.</para>
    /// </summary>
    public class GenerateRBP
    {
        /// <summary>
        /// Entry point — builds and returns the RBP Summary PDF as a byte array.
        /// </summary>
        /// <param name="data">Flat row list from <c>pGenerateRBP</c>.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(List<RBPData> data, int year = 0, string stageName = "")
        {
            int FooterFs = 7;
            var logo = GeneratePDF.GetLogo();
            string fiscalYear = year > 0 ? $"FY {year} " : "";
            string title = $"SUMMARY OF {fiscalYear}REGIONAL BUDGET PROPOSAL";
            if (!string.IsNullOrEmpty(stageName)) title += $" — {stageName}";
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(7).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                // ── HEADER ───────────────────────────────────────────
                var regionName = data.FirstOrDefault()?.Region?.ToUpper() ?? "";

                page.Header()
                    .Column(col =>
                    {
                        GeneratePDF.BuildDPWHHeader(col, logo,
                            title,
                            regionName: regionName);

                        col.Item().PaddingTop(8)
                           .Element(BuildTableHeader);
                    });

                // ── CONTENT ──────────────────────────────────────────
                page.Content()
                    .Column(col =>
                    {
                        col.Item().Element(c => BuildTableContent(c, data));
                        col.Item().Extend().AlignBottom()
                            .PaddingTop(10).Element(BuildSignatureBlock);
                    });

                // ── FOOTER ───────────────────────────────────────────
                GeneratePDF.BuildFooter(page, FooterFs);
            });
        }

        // ── TABLE HEADER ──────────────────────────────────────────────────
        /// <summary>
        /// Renders the 2-row, 11-column table header: label · OO-1 (col span 2) · OO-2 · CSSP · LP · TOTAL,
        /// with "No. of Proj." and "Amount (P'000)" sub-headers in row 2.
        /// </summary>
        static void BuildTableHeader(IContainer container)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                // Row 1
                HeaderCell(table, "DISTRICT ENGINEERING OFFICE /\nLEGISLATIVE DISTRICT", rowSpan: 2);
                HeaderCell(table, "OO-1", colSpan: 2);
                HeaderCell(table, "OO-2", colSpan: 2);
                HeaderCell(table, "CSSP", colSpan: 2);
                HeaderCell(table, "LP", colSpan: 2);
                HeaderCell(table, "TOTAL", colSpan: 2);

                // Row 2 — sub-headers
                for (int i = 0; i < 5; i++)
                {
                    HeaderCell(table, "No. of\nProj.");
                    HeaderCell(table, "Amount\n(P'000)");
                }
            });
        }

        static void HeaderCell(
            TableDescriptor table,
            string text,
            uint colSpan = 1,
            uint rowSpan = 1)
        {
            table.Cell()
                 .ColumnSpan(colSpan)
                 .RowSpan(rowSpan)
                 .BorderBottom(0.5f).BorderColor(Colors.Black)
                 .AlignCenter().AlignMiddle()
                 .Padding(3)
                 .Text(text).Bold().FontSize(6.5f);
        }

        // ── TABLE CONTENT ─────────────────────────────────────────────────
        /// <summary>Builds the pivot table body. Grouping: Region → Tier (Roman numeral) → DEO → Legislative District.</summary>
        static void BuildTableContent(
            IContainer container,
            List<RBPData> data)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                foreach (var regionGrp in data
                    .GroupBy(r => r.Region)
                    .OrderBy(g => g.Key))
                {
                    // ── Region row ────────────────────────────────────
                    WriteDataRow(table, regionGrp.Key, regionGrp,
                        fontSize: 8, bold: true, dashForZero: true);

                    foreach (var tierGrp in regionGrp
                        .GroupBy(r => r.Tier)
                        .OrderBy(g => g.Key))
                    {
                        // ── Tier row ──────────────────────────────────
                        WriteDataRow(table,
                            $"Tier {ToRoman(tierGrp.Key)}", tierGrp,
                            indent: 4, fontSize: 8, dashForZero: true);

                        foreach (var deoGrp in tierGrp
                            .GroupBy(r => r.DEO)
                            .OrderBy(g => g.Key))
                        {
                            // ── DEO row ───────────────────────────────
                            WriteDataRow(table, deoGrp.Key, deoGrp,
                                indent: 10, fontSize: 7, dashForZero: true);

                            // ── District detail rows ──────────────────
                            foreach (var distGrp in deoGrp
                                .GroupBy(r => r.LegislativeDistrict)
                                .OrderBy(g => g.Key))
                            {
                                WriteDataRow(table, distGrp.Key, distGrp,
                                    indent: 18, fontSize: 7);
                            }
                        }
                    }
                }
            });
        }

        // ── ROW RENDERING ─────────────────────────────────────────────────
        /// <summary>
        /// Renders one labeled data row with aggregated counts and amounts for all 5 budget categories.
        /// Values are summed across all <paramref name="rows"/> before rendering.
        /// </summary>
        static void WriteDataRow(
            TableDescriptor table,
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

            // Col 0 — Label
            table.Cell()
                 .PaddingVertical(2)
                 .PaddingLeft(indent + 2f)
                 .Text(t =>
                 {
                     var s = t.Span(label).FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            WriteCountCell(table, oo1Proj, fontSize, bold, dashForZero);
            WriteAmountCell(table, oo1Amt, fontSize, bold);
            WriteCountCell(table, oo2Proj, fontSize, bold, dashForZero);
            WriteAmountCell(table, oo2Amt, fontSize, bold);
            WriteCountCell(table, csspProj, fontSize, bold, dashForZero);
            WriteAmountCell(table, csspAmt, fontSize, bold);
            WriteCountCell(table, lpProj, fontSize, bold, dashForZero);
            WriteAmountCell(table, lpAmt, fontSize, bold);
            WriteCountCell(table, totProj, fontSize, bold, dashForZero);
            WriteAmountCell(table, totAmt, fontSize, bold);
        }

        /// <summary>Renders a right-aligned project count cell. Shows "-" for zero when <paramref name="dashForZero"/> is true.</summary>
        static void WriteCountCell(
            TableDescriptor table,
            int value,
            float fontSize,
            bool bold,
            bool dashForZero = false)
        {
            var display = value == 0
                ? (dashForZero ? "-" : "0")
                : value.ToString();

            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(t =>
                 {
                     var s = t.Span(display).FontSize(fontSize);
                     if (bold) s.Bold();
                 });
        }

        /// <summary>Renders a right-aligned amount cell formatted as P'000 (divided by 1000, 2 decimal places).</summary>
        static void WriteAmountCell(
            TableDescriptor table,
            double value,
            float fontSize,
            bool bold)
        {
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(t =>
                 {
                     var s = t.Span(FormatAmtP(value)).FontSize(fontSize);
                     if (bold) s.Bold();
                 });
        }

        // ── SIGNATURE BLOCK ───────────────────────────────────────────────
        static void BuildSignatureBlock(IContainer container)
        {
            container
                .Padding(10)
                .Row(row =>
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

        // ── HELPERS ───────────────────────────────────────────────────────
        /// <summary>Defines 11 relative columns: label · OO1 count/amt · OO2 count/amt · CSSP count/amt · LP count/amt · Total count/amt.</summary>
        static void DefineColumns(TableDescriptor table)
        {
            table.ColumnsDefinition(cols =>
            {
                cols.RelativeColumn(20);  // 0  Label
                cols.RelativeColumn(5);   // 1  OO1 Count
                cols.RelativeColumn(11);  // 2  OO1 Amount
                cols.RelativeColumn(5);   // 3  OO2 Count
                cols.RelativeColumn(11);  // 4  OO2 Amount
                cols.RelativeColumn(5);   // 5  CSSP Count
                cols.RelativeColumn(11);  // 6  CSSP Amount
                cols.RelativeColumn(5);   // 7  LP Count
                cols.RelativeColumn(11);  // 8  LP Amount
                cols.RelativeColumn(5);   // 9  Total Count
                cols.RelativeColumn(11);  // 10 Total Amount
            });
        }

        /// <summary>Formats a double value as thousands (divides by 1000, N2), or empty string for zero.</summary>
        static string FormatAmtP(double v) =>
            v == 0 ? "" : (v / 1000).ToString("N2");

        /// <summary>Converts an integer tier number (1-5) to a Roman numeral string for display.</summary>
        static string ToRoman(int tier) => tier switch
        {
            1 => "I",
            2 => "II",
            3 => "III",
            4 => "IV",
            5 => "V",
            _ => tier.ToString()
        };
    }
}
