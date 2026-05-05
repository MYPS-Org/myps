using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RBPCData = DBHelper.Models.Procedures.GenerateRBPComponents;

namespace ReportGeneration
{
    /// <summary>
    /// Generates the <b>RBP Components</b> (Regional Budget Proposal — component detail) PDF report (A4 Landscape).
    /// <para>
    /// 9-column layout. Grouping hierarchy:
    /// Region (bold) → Tier → DEO → Legislative District → Category → Thrust → Project → Component (2 rows per component).
    /// </para>
    /// <para>Data source: <c>pGenerateRBPComponents</c>.</para>
    /// </summary>
    public class RBPComponents
    {
        /// <summary>
        /// Entry point — builds and returns the RBP Components PDF as a byte array.
        /// </summary>
        /// <param name="data">Flat row list from <c>pGenerateRBPComponents</c>.</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(List<RBPCData> data, int year = 0, string stageName = "")
        {
            int FooterFs = 7;
            string fiscalYear = year > 0 ? $"FY {year}  " : "";
            string title = $"{fiscalYear}REGIONAL BUDGET PROPOSAL";
            if (!string.IsNullOrEmpty(stageName)) title += $" — {stageName}";
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(6).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                // ── HEADER ───────────────────────────────────────────
                page.Header()
                    .Column(col =>
                    {
                        col.Item().AlignCenter()
                           .Text(title)
                           .FontFamily(GeneratePDF.FontFamily).FontSize(10).Bold();
                        col.Item().AlignCenter()
                           .Text("(ONGOING, NEW AND EXPANDED PROGRAMS, ACTIVITIES AND PROJECTS)")
                           .FontFamily(GeneratePDF.FontFamily).FontSize(8);

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

                HeaderCell(table, "DEO/LD");
                HeaderCell(table, "Programs/Activities\n/ Projects");
                HeaderCell(table, "Type of\nWork");
                HeaderCell(table, "Project\nLocation");
                HeaderCell(table, "Details of Work");
                HeaderCell(table, "Length of\nWork (m)");
                HeaderCell(table, "Physical\nTarget");
                HeaderCell(table, "Target\nUnit");
                HeaderCell(table, "Project Cost\n(P'000)");
            });
        }

        static void HeaderCell(TableDescriptor table, string text)
        {
            table.Cell()
                 .BorderBottom(0.5f).BorderColor(Colors.Black)
                 .AlignCenter().AlignMiddle()
                 .Padding(3)
                 .Text(text).Bold().FontSize(6);
        }

        // ── TABLE CONTENT ─────────────────────────────────────────────────
        /// <summary>
        /// Builds the component-detail table body.
        /// Grouping: Region → Tier → DEO → Legislative District → Category → Thrust → Project → Component.
        /// Each component renders two rows: a summary line and a detail line.
        /// </summary>
        static void BuildTableContent(
            IContainer container,
            List<RBPCData> data)
        {
            container.Table(table =>
            {
                DefineColumns(table);

                foreach (var regionGrp in data
                    .GroupBy(r => r.Region).OrderBy(g => g.Key))
                {
                    WriteSummaryRow(table, regionGrp.Key, regionGrp, bold: true);

                    foreach (var tierGrp in regionGrp
                        .GroupBy(r => r.Tier).OrderBy(g => g.Key))
                    {
                        WriteSummaryRow(table, $"Tier {ToRoman(tierGrp.Key)}", tierGrp,
                            indent: 8);

                        foreach (var deoGrp in tierGrp
                            .GroupBy(r => r.DEO).OrderBy(g => g.Key))
                        {
                            WriteSummaryRow(table, deoGrp.Key, deoGrp,
                                indent: 16);

                            foreach (var distGrp in deoGrp
                                .GroupBy(r => r.LegislativeDistrict).OrderBy(g => g.Key))
                            {
                                WriteSummaryRow(table, distGrp.Key, distGrp,
                                    indent: 24);

                                foreach (var catGrp in distGrp
                                    .GroupBy(r => r.CategoryName).OrderBy(g => g.Key))
                                {
                                    // Category — cost only, label in col 1
                                    WriteCategoryRow(table, catGrp.Key, catGrp);

                                    int seq = 0;
                                    foreach (var thrustGrp in catGrp
                                        .GroupBy(r => r.ThrustDescription).OrderBy(g => g.Key))
                                    {
                                        // Thrust — label only
                                        WriteThrustRow(table, thrustGrp.Key);

                                        // Projects
                                        foreach (var projGrp in thrustGrp
                                            .GroupBy(r => r.ProjectDescription).OrderBy(g => g.Key))
                                        {
                                            seq++;
                                            var projCost = projGrp.Sum(r => r.ComponentCost);
                                            WriteProjectRow(table, seq, projGrp.Key, projCost);

                                            // Components
                                            foreach (var comp in projGrp.OrderBy(c => c.ComponentId))
                                            {
                                                WriteComponentRow(table, comp);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // ── ROW RENDERING ─────────────────────────────────────────────────

        /// <summary>Region / Tier / DEO / District summary — shows project count + total cost</summary>
        static void WriteSummaryRow(
            TableDescriptor table,
            string label,
            IEnumerable<RBPCData> rows,
            int indent = 0,
            bool bold = false)
        {
            float fs = 7;
            int projCount = rows.Select(r => r.ProjectDescription).Distinct().Count();
            double totalCost = rows.Sum(r => r.ComponentCost);

            // Col 0 — DEO/LD label
            LabelCell(table, label, fs, bold, indent);
            // Cols 1-5 — empty
            EmptyCell(table); EmptyCell(table); EmptyCell(table);
            EmptyCell(table); EmptyCell(table);
            // Col 6 — project count
            RightCell(table, projCount.ToString(), fs, bold);
            // Col 7 — "projects"
            LeftCell(table, "projects", fs, bold);
            // Col 8 — total cost P'000
            RightCell(table, FormatP(totalCost), fs, bold);
        }

        /// <summary>Category row — label spans cols 0-7, cost in col 8</summary>
        static void WriteCategoryRow(
            TableDescriptor table,
            string label,
            IEnumerable<RBPCData> rows)
        {
            float fs = 6.5f;
            double totalCost = rows.Sum(r => r.ComponentCost);

            table.Cell().ColumnSpan(8)
                 .PaddingVertical(1)
                 .PaddingLeft(32 + 2f).PaddingRight(2)
                 .Text(label).FontSize(fs);
            RightCell(table, FormatP(totalCost), fs, false);
        }

        /// <summary>Thrust row — label spans full width, no amounts</summary>
        static void WriteThrustRow(TableDescriptor table, string label)
        {
            float fs = 6;
            table.Cell().ColumnSpan(9)
                 .PaddingVertical(1)
                 .PaddingLeft(40 + 2f).PaddingRight(2)
                 .Text(label).FontSize(fs);
        }

        /// <summary>Project row — seq + description, cost</summary>
        static void WriteProjectRow(
            TableDescriptor table,
            int seq,
            string description,
            double cost)
        {
            float fs = 6;

            // Col 0 — seq number
            table.Cell()
                 .PaddingVertical(1).PaddingLeft(18).PaddingRight(2)
                 .Text($"{seq}.").FontSize(fs);

            // Col 1 — description
            table.Cell()
                 .PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                 .Text(description).FontSize(fs);

            // Cols 2-7 — empty
            EmptyCell(table); EmptyCell(table); EmptyCell(table);
            EmptyCell(table); EmptyCell(table); EmptyCell(table);

            // Col 8 — cost P'000
            RightCell(table, FormatP(cost), fs, false);
        }

        /// <summary>Component — 2 table rows: component line + detail line</summary>
        static void WriteComponentRow(
            TableDescriptor table,
            RBPCData comp)
        {
            float fs = 5.5f;

            // ── Row 1: Component summary ──────────────────────────────
            // Col 0 — ComponentId
            table.Cell()
                 .PaddingVertical(1).PaddingLeft(24).PaddingRight(2)
                 .Text(comp.ComponentId).FontSize(fs);

            // Col 1 — ScopeDescription
            table.Cell()
                 .PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                 .Text(comp.ScopeDescription ?? "").FontSize(fs);

            // Col 2 — empty (Type of Work)
            EmptyCell(table);
            // Col 3 — empty (Project Location)
            EmptyCell(table);
            // Col 4 — empty (Details of Work)
            EmptyCell(table);

            // Col 5 — Length of Work
            RightCell(table, FormatDecimal(comp.LengthOfWork), fs, false);
            // Col 6 — Physical Target
            RightCell(table, FormatDecimal(comp.PhysicalTarget), fs, false);
            // Col 7 — Target Unit / ScopeMeasure
            LeftCell(table, comp.TargetUnit ?? comp.ScopeMeasure ?? "", fs, false);
            // Col 8 — Component cost P'000
            RightCell(table, FormatP(comp.ComponentCost), fs, false);

            // ── Row 2: Scope detail ───────────────────────────────────
            // Cols 0-3 — empty
            EmptyCell(table); EmptyCell(table); EmptyCell(table); EmptyCell(table);

            // Col 4 — Details of Work
            table.Cell()
                 .PaddingVertical(1).PaddingLeft(2).PaddingRight(2)
                 .Text(comp.DetailsOfWork ?? "").FontSize(fs);

            // Col 5 — Length of Work
            RightCell(table, FormatDecimal(comp.LengthOfWork), fs, false);
            // Col 6 — Physical Target
            RightCell(table, FormatDecimal(comp.PhysicalTarget), fs, false);
            // Col 7 — ScopeMeasure
            LeftCell(table, comp.ScopeMeasure ?? "", fs, false);
            // Col 8 — empty
            EmptyCell(table);
        }

        // ── CELL HELPERS ──────────────────────────────────────────────────
        static void LabelCell(
            TableDescriptor table, string text,
            float fontSize, bool bold,
            int indent = 0, int col = 0)
        {
            table.Cell()
                 .PaddingVertical(1)
                 .PaddingLeft(indent + 2f).PaddingRight(2)
                 .Text(t =>
                 {
                     var s = t.Span(text).FontSize(fontSize);
                     if (bold) s.Bold();
                 });
        }

        static void RightCell(
            TableDescriptor table, string text,
            float fontSize, bool bold)
        {
            table.Cell()
                 .AlignRight().PaddingRight(2).PaddingVertical(1)
                 .Text(t =>
                 {
                     var s = t.Span(text).FontSize(fontSize);
                     if (bold) s.Bold();
                 });
        }

        static void LeftCell(
            TableDescriptor table, string text,
            float fontSize, bool bold)
        {
            table.Cell()
                 .PaddingLeft(2).PaddingVertical(1)
                 .Text(t =>
                 {
                     var s = t.Span(text).FontSize(fontSize);
                     if (bold) s.Bold();
                 });
        }

        static void EmptyCell(TableDescriptor table)
        {
            table.Cell().Text("");
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
                cols.RelativeColumn(10);   // 0  DEO/LD
                cols.RelativeColumn(20);   // 1  Programs/Activities / Projects
                cols.RelativeColumn(4);    // 2  Type of Work
                cols.RelativeColumn(6);    // 3  Project Location
                cols.RelativeColumn(10);   // 4  Details of Work
                cols.RelativeColumn(5);    // 5  Length of Work (m)
                cols.RelativeColumn(5);    // 6  Physical Target
                cols.RelativeColumn(5);    // 7  Target Unit
                cols.RelativeColumn(8);    // 8  Project Cost (P'000)
            });
        }

        static string FormatP(double v) =>
            v == 0 ? "" : (v / 1000).ToString("N2");

        static string FormatDecimal(double? v) =>
            v is null or 0 ? "" : v.Value.ToString("N2");

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
