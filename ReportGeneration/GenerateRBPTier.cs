using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RBPData = DBHelper.Models.Procedures.GenerateRBP;

namespace ReportGeneration
{
    public class GenerateRBPTier
    {
        public static byte[] GenerateReport(List<RBPData> data)
        {
            int FooterFs = 7;
            var logo = GeneratePDF.GetLogo();
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
                            "SUMMARY OF FY 2026 BUDGET PROPOSAL",
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
                 .Border(0.3f).BorderColor(Colors.Grey.Lighten1)
                 .Background(Colors.Grey.Lighten4)
                 .AlignCenter().AlignMiddle()
                 .Padding(3)
                 .Text(text).Bold().FontSize(6.5f);
        }

        // ── TABLE CONTENT ─────────────────────────────────────────────────
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
                    // ── Region summary row ────────────────────
                    WriteDataRow(table, regionGrp.Key, regionGrp,
                        fontSize: 7, bold: true, topBorder: true);

                    foreach (var tierGrp in regionGrp
                        .GroupBy(r => r.Tier)
                        .OrderBy(g => g.Key))
                    {
                        // ── Tier summary row ─────────────────────
                        WriteDataRow(table,
                            $"Tier {ToRoman(tierGrp.Key)}", tierGrp,
                            fontSize: 7, bold: true, topBorder: true);

                        foreach (var deoGrp in tierGrp
                            .GroupBy(r => r.DEO)
                            .OrderBy(g => g.Key))
                        {
                            // ── DEO row ───────────────────────────────
                            WriteDataRow(table, deoGrp.Key, deoGrp,
                                indent: 4, fontSize: 7, bold: true, topBorder: true);

                            foreach (var distGrp in deoGrp
                                .GroupBy(r => r.LegislativeDistrict)
                                .OrderBy(g => g.Key))
                            {
                                // ── District row ──────────────────────
                                WriteDataRow(table, distGrp.Key, distGrp,
                                    indent: 10, fontSize: 7);
                            }
                        }
                    }
                }
            });
        }

        // ── ROW RENDERING ─────────────────────────────────────────────────
        static void WriteDataRow(
            TableDescriptor table,
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

            // Col 0 — Label
            table.Cell()
                 .BorderTop(topBorder ? 0.5f : 0)
                 .BorderColor(Colors.Grey.Medium)
                 .PaddingVertical(2)
                 .PaddingLeft(indent + 2f)
                 .Text(t =>
                 {
                     var s = t.Span(label).FontSize(fontSize);
                     if (bold) s.Bold();
                 });

            WriteCountCell(table, oo1Proj, fontSize, bold, topBorder);
            WriteAmountCell(table, oo1Amt, fontSize, bold, topBorder);
            WriteCountCell(table, oo2Proj, fontSize, bold, topBorder);
            WriteAmountCell(table, oo2Amt, fontSize, bold, topBorder);
            WriteCountCell(table, csspProj, fontSize, bold, topBorder);
            WriteAmountCell(table, csspAmt, fontSize, bold, topBorder);
            WriteCountCell(table, lpProj, fontSize, bold, topBorder);
            WriteAmountCell(table, lpAmt, fontSize, bold, topBorder);
            WriteCountCell(table, totProj, fontSize, bold, topBorder);
            WriteAmountCell(table, totAmt, fontSize, bold, topBorder);
        }

        static void WriteCountCell(
            TableDescriptor table,
            int value,
            float fontSize,
            bool bold,
            bool topBorder = false)
        {
            table.Cell()
                 .BorderTop(topBorder ? 0.5f : 0)
                 .BorderColor(Colors.Grey.Medium)
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(t =>
                 {
                     var s = t.Span(value == 0 ? "" : value.ToString())
                              .FontSize(fontSize);
                     if (bold) s.Bold();
                 });
        }

        static void WriteAmountCell(
            TableDescriptor table,
            double value,
            float fontSize,
            bool bold,
            bool topBorder = false)
        {
            table.Cell()
                 .BorderTop(topBorder ? 0.5f : 0)
                 .BorderColor(Colors.Grey.Medium)
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

        static string FormatAmtP(double v) =>
            v == 0 ? "" : (v / 1000).ToString("N2");

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
