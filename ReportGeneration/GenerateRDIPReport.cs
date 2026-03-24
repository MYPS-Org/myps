using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RDIPData = DBHelper.Models.Procedures.GenerateRDIP;

namespace ReportGeneration
{
    public class GenerateRDIP
    {
        public static byte[] GenerateReport(List<RDIPData> data)
        {
            int FooterFs = 7;
            int LowestYear = data.Min(r => r.StartYear);
            var logo = GeneratePDF.GetLogo();
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(6).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                // ── HEADER ───────────────────────────────────────────
                var regionName = data.FirstOrDefault()?.Region ?? "Region I";

                page.Header()
                    .Column(col =>
                    {
                        GeneratePDF.BuildDPWHHeader(col, logo,
                            "Regional Development Investment Plan (RDIP)",
                            regionName: regionName);

                        col.Item().PaddingTop(2)
                           .Text("PDF Chapter: Chapter 19 - Accelerating Infrastructure Development")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(7);
                        col.Item()
                           .Text("Agency: Department of Public Works and Highways")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(7);

                        col.Item().PaddingTop(6)
                           .Element(c => BuildTableHeader(c, LowestYear));
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

        // ── TABLE HEADER (3 rows) ────────────────────────────────────────
        static void BuildTableHeader(IContainer container, int LowestYear)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                // Row 1
                HeaderCell(table, "Program/Sub-Program/Projects", rowSpan: 3);
                HeaderCell(table, "Spatial Coverage", colSpan: 2);
                HeaderCell(table, "Implementation Period", colSpan: 2);
                HeaderCell(table, "Investment Cost", colSpan: 8);
                HeaderCell(table, "Remarks", rowSpan: 3);

                // Row 2
                HeaderCell(table, "Province/\nMunicipality", rowSpan: 2);
                HeaderCell(table, "Congressional\nDistrict", rowSpan: 2);
                HeaderCell(table, "Start of\nProject\nImplemen-\ntation", rowSpan: 2);
                HeaderCell(table, "Year of\nProject\nImplemen-\ntation", rowSpan: 2);
                HeaderCell(table, "TOTAL Cost", rowSpan: 2);
                HeaderCell(table, "FirstYear");
                HeaderCell(table, "SecondYear");
                HeaderCell(table, "ThirdYear");
                HeaderCell(table, "FourthYear");
                HeaderCell(table, "FifthYear");
                HeaderCell(table, "SixthYear");
                HeaderCell(table, "Later\nYears");

                // Row 3 — column numbers
                HeaderCell(table, "(" + (LowestYear).ToString() + ")");
                HeaderCell(table, "(" + (LowestYear + 1).ToString() + ")");
                HeaderCell(table, "(" + (LowestYear + 2).ToString() + ")");
                HeaderCell(table, "(" + (LowestYear + 3).ToString() + ")");
                HeaderCell(table, "(" + (LowestYear + 4).ToString() + ")");
                HeaderCell(table, "(" + (LowestYear + 5).ToString() + ")");
                HeaderCell(table, "(" + (LowestYear + 6).ToString() + "...)");
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
                 .Text(text).Bold().FontSize(5.5f);
        }

        // ── TABLE CONTENT ─────────────────────────────────────────────────
        static void BuildTableContent(
            IContainer container,
            List<RDIPData> data)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                foreach (var catGrp in data
                    .GroupBy(r => r.CategoryName)
                    .OrderBy(g => g.Key))
                {
                    // ── Category row ──────────────────────────────────
                    WriteSummaryRow(table, catGrp.Key, catGrp,
                        fontSize: 7, bold: true);

                    foreach (var progGrp in catGrp
                        .GroupBy(r => r.ThrustProgramName)
                        .OrderBy(g => g.Key))
                    {
                        // ── Program row ───────────────────────────────
                        WriteSummaryRow(table, progGrp.Key, progGrp,
                            indent: 6, fontSize: 6.5f);

                        foreach (var subGrp in progGrp
                            .GroupBy(r => r.ThrustSubProgramName ?? "")
                            .OrderBy(g => g.Key))
                        {
                            if (!string.IsNullOrEmpty(subGrp.Key))
                            {
                                // ── SubProgram row ────────────────────
                                WriteSummaryRow(table, subGrp.Key, subGrp,
                                    indent: 12, fontSize: 6.5f);
                            }

                            foreach (var actGrp in subGrp
                                .GroupBy(r => r.ThrustActivityName ?? "")
                                .OrderBy(g => g.Key))
                            {
                                if (!string.IsNullOrEmpty(actGrp.Key))
                                {
                                    // ── Activity row ──────────────────
                                    WriteSummaryRow(table, actGrp.Key, actGrp,
                                        indent: 18, fontSize: 6);
                                }

                                // ── Project rows ──────────────────────
                                int seq = 0;
                                foreach (var proj in actGrp.OrderBy(p => p.ProjectId))
                                {
                                    seq++;
                                    WriteProjectRow(table, seq, proj);
                                }
                            }
                        }
                    }
                }
            });
        }

        // ── ROW RENDERING ─────────────────────────────────────────────────
        static void WriteSummaryRow(
            TableDescriptor table,
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

            // Col 0 — Label
            DataCell(table, t =>
            {
                var s = t.Span(label).FontSize(fontSize);
                if (bold) s.Bold();
            }, paddingLeft: indent + 2f);

            // Cols 1-4 — empty spatial / implementation
            EmptyCell(table);
            EmptyCell(table);
            EmptyCell(table);
            EmptyCell(table);

            // Cols 5-12 — amounts
            AmountCell(table, totalCost, fontSize, bold);
            AmountCell(table, firstYear, fontSize, bold);
            AmountCell(table, secondYear, fontSize, bold);
            AmountCell(table, thirdYear, fontSize, bold);
            AmountCell(table, fourthYear, fontSize, bold);
            AmountCell(table, fifthYear, fontSize, bold);
            AmountCell(table, sixthYear, fontSize, bold);
            AmountCell(table, laterYears, fontSize, bold);

            // Col 13 — Remarks
            EmptyCell(table);
        }

        static void WriteProjectRow(
            TableDescriptor table,
            int seq,
            RDIPData proj)
        {
            float fs = 6;

            // Col 0 — seq. Description
            DataCell(table, t =>
            {
                t.Span($"{seq}. {proj.ProjectDescription}").FontSize(fs);
            }, paddingLeft: 24f);

            // Col 1 — Province / Municipality
            DataCell(table, t =>
            {
                t.Span($"{proj.CityMunicipality}\n({proj.Province})").FontSize(fs);
            });

            // Col 2 — Congressional District
            DataCell(table, t =>
            {
                t.Span(proj.CongressionalDistrict).FontSize(fs);
            });

            // Col 3 — Start Year
            table.Cell()
                 .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                 .AlignCenter().AlignMiddle()
                 .Padding(2)
                 .Text(proj.StartYear.ToString()).FontSize(fs);

            // Col 4 — End Year
            table.Cell()
                 .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                 .AlignCenter().AlignMiddle()
                 .Padding(2)
                 .Text(proj.EndYear.ToString()).FontSize(fs);

            // Cols 5-12 — amounts
            AmountCell(table, proj.TotalCost, fs, false);
            AmountCell(table, proj.FirstYear, fs, false);
            AmountCell(table, proj.SecondYear, fs, false);
            AmountCell(table, proj.ThirdYear, fs, false);
            AmountCell(table, proj.FourthYear, fs, false);
            AmountCell(table, proj.FifthYear, fs, false);
            AmountCell(table, proj.SixthYear, fs, false);
            AmountCell(table, proj.LaterYears, fs, false);

            // Col 13 — Remarks (empty)
            EmptyCell(table);
        }

        // ── CELL HELPERS ──────────────────────────────────────────────────
        static void DataCell(
            TableDescriptor table,
            Action<TextDescriptor> textAction,
            float paddingLeft = 2f)
        {
            table.Cell()
                 .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                 .PaddingVertical(2)
                 .PaddingLeft(paddingLeft)
                 .PaddingRight(2)
                 .Text(textAction);
        }

        static void EmptyCell(TableDescriptor table)
        {
            table.Cell()
                 .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                 .Text("");
        }

        static void AmountCell(
            TableDescriptor table,
            double value,
            float fontSize,
            bool bold)
        {
            table.Cell()
                 .Border(0.5f).BorderColor(Colors.Grey.Lighten1)
                 .AlignRight().PaddingRight(2).PaddingVertical(2)
                 .Text(t =>
                 {
                     var display = value == 0 ? "" : value.ToString("N0");
                     var s = t.Span(display).FontSize(fontSize);
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
                cols.RelativeColumn(22);   // 0  Program/Sub-Program/Projects
                cols.RelativeColumn(7);    // 1  Province/Municipality
                cols.RelativeColumn(8);    // 2  Congressional District
                cols.RelativeColumn(3.5f); // 3  Start Year
                cols.RelativeColumn(3.5f); // 4  End Year
                cols.RelativeColumn(8);    // 5  TOTAL Cost
                cols.RelativeColumn(7);    // 6  FirstYear
                cols.RelativeColumn(7);    // 7  SecondYear
                cols.RelativeColumn(7);    // 8  ThirdYear
                cols.RelativeColumn(7);    // 9  FourthYear
                cols.RelativeColumn(7);    // 10 FifthYear
                cols.RelativeColumn(7);    // 11 SixthYear
                cols.RelativeColumn(6);    // 12 Later Years
                cols.RelativeColumn(4);    // 13 Remarks
            });
        }
    }
}
