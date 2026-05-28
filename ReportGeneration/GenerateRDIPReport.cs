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
        // 14 relative column weights.
        // W3/W4 widened from 3.5 to 5 so "Implementation Period" header fits at 7pt without
        // mid-word breaks (body just shows 4-digit years, so extra width is harmless).
        // W13 widened from 4 to 6 so "Remarks" header fits at 7pt (body cell is always empty).
        const float W0=22, W1=7, W2=8, W3=5,    W4=5;
        const float W5=8,  W6=7, W7=7, W8=7,    W9=7;
        const float W10=7, W11=7, W12=6, W13=6;

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
            var logo = GeneratePDF.GetLogo();
            string fiscalYear = year > 0 ? $"FY {year} " : "";
            string title = $"{fiscalYear}REGIONAL DEVELOPMENT INVESTMENT PLAN (RDIP)";
            string subtitle = "Chapter 19 - Accelerating Infrastructure Development";
            return GeneratePDF.GenerateReport(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(25);
                page.DefaultTextStyle(x =>
                    x.FontSize(6).FontFamily(GeneratePDF.FontFamily).FontColor(Colors.Black));

                var regionName = data.FirstOrDefault()?.Region?.ToUpper() ?? "";

                // -- HEADER
                page.Header()
                    .Column(col =>
                    {
                        GeneratePDF.BuildDPWHHeader(col, logo, title, subtitle: subtitle, regionName: regionName);
                        col.Item().PaddingTop(8).Element(c => BuildTableHeader(c, LowestYear));
                    });

                // -- CONTENT
                page.Content()
                    .Column(col =>
                    {
                        col.Item().Element(c => BuildTableContent(c, data));
                        col.Item().PaddingTop(10).Element(BuildSignatureBlock);
                    });

                // -- FOOTER
                GeneratePDF.BuildFooter(page, FooterFs);
            });
        }

        // -- TABLE HEADER (3 rows)
        /// <summary>
        /// Renders the 2-row header.
        /// The "Program/Sub-Program/Projects" (W0) and "Remarks" (W13) cells are vertically
        /// merged so they span both header rows (centered vertically and horizontally).
        /// The middle columns keep the original 2-row layout (group label on top, sub-label below).
        /// Year columns in the second middle row are labeled dynamically from <paramref name="LowestYear"/>.
        /// </summary>
        static void BuildTableHeader(IContainer container, int LowestYear)
        {
            container.Border(0.5f).BorderColor(Colors.Black).Row(row =>
            {
                // Merged W0: "Program/Sub-Program/Projects" spans both header rows.
                row.RelativeItem(W0)
                   .BorderRight(0.5f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(2)
                   .Text("Program/Sub-Program/Projects").Bold().FontSize(7);

                // Middle: two-row header for the columns between W0 and W13.
                row.RelativeItem(W1 + W2 + W3 + W4 + W5 + W6 + W7 + W8 + W9 + W10 + W11 + W12).Column(col =>
                {
                    // Row 1 — group labels
                    col.Item().BorderBottom(0.5f).BorderColor(Colors.Black).Row(rr =>
                    {
                        HdrCell(rr, W1 + W2, "Spatial Coverage", borderRight: true);
                        HdrCell(rr, W3 + W4, "Implementation\nPeriod", borderRight: true);
                        HdrCell(rr, W5 + W6 + W7 + W8 + W9 + W10 + W11 + W12, "Investment Cost (P'000)", borderRight: false);
                    });
                    // Row 2 — sub-labels (year columns dynamic)
                    col.Item().Row(rr =>
                    {
                        HdrCell(rr, W1, "Province/\nMunicipality", borderRight: true);
                        HdrCell(rr, W2, "Congressional\nDistrict", borderRight: true);
                        HdrCell(rr, W3, "Start\nYear", borderRight: true);
                        HdrCell(rr, W4, "End\nYear", borderRight: true);
                        HdrCell(rr, W5, "TOTAL\nCost", borderRight: true);
                        HdrCell(rr, W6, $"1st Year\n({LowestYear})", borderRight: true);
                        HdrCell(rr, W7, $"2nd Year\n({LowestYear + 1})", borderRight: true);
                        HdrCell(rr, W8, $"3rd Year\n({LowestYear + 2})", borderRight: true);
                        HdrCell(rr, W9, $"4th Year\n({LowestYear + 3})", borderRight: true);
                        HdrCell(rr, W10, $"5th Year\n({LowestYear + 4})", borderRight: true);
                        HdrCell(rr, W11, $"6th Year\n({LowestYear + 5})", borderRight: true);
                        HdrCell(rr, W12, $"Later\nYears\n({LowestYear + 6}+)", borderRight: false);
                    });
                });

                // Merged W13: "Remarks" spans both header rows.
                row.RelativeItem(W13)
                   .BorderLeft(0.5f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(2)
                   .Text("Remarks").Bold().FontSize(7);
            });
        }

        static void HdrCell(RowDescriptor row, float weight, string text, bool borderRight = false)
        {
            var cell = row.RelativeItem(weight);
            if (borderRight) cell = cell.BorderRight(0.5f).BorderColor(Colors.Black);
            cell.AlignCenter().AlignMiddle().Padding(2)
               .Text(text).Bold().FontSize(7);
        }

        // -- TABLE CONTENT
        /// <summary>
        /// Builds the RDIP content as a Column of Rows.
        /// Grouping: Category -> Program -> Sub-Program -> Activity -> Project.
        /// </summary>
        static void BuildTableContent(IContainer container, List<RDIPData> data)
        {
            container.BorderLeft(0.5f).BorderRight(0.5f).BorderBottom(0.5f).BorderColor(Colors.Black).Column(col =>
            {
                foreach (var catGrp in data.GroupBy(r => r.CategoryName).OrderBy(g => g.Key))
                {
                    WriteSummaryRow(col, catGrp.Key, catGrp, fontSize: 7, bold: true);

                    foreach (var progGrp in catGrp.GroupBy(r => r.ThrustProgramName).OrderBy(g => g.Key))
                    {
                        WriteSummaryRow(col, progGrp.Key, progGrp, indent: 6, fontSize: 6.5f, bold: true);

                        foreach (var subGrp in progGrp.GroupBy(r => r.ThrustSubProgramName ?? "").OrderBy(g => g.Key))
                        {
                            if (!string.IsNullOrEmpty(subGrp.Key))
                                WriteSummaryRow(col, subGrp.Key, subGrp, indent: 12, fontSize: 6.5f, bold: true);

                            foreach (var actGrp in subGrp.GroupBy(r => r.ThrustActivityName ?? "").OrderBy(g => g.Key))
                            {
                                if (!string.IsNullOrEmpty(actGrp.Key))
                                    WriteSummaryRow(col, actGrp.Key, actGrp, indent: 18, fontSize: 6, bold: true);

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

            // Body row borders use 0.25pt (lighter than the 0.5pt header borders).
            col.Item().BorderTop(0.25f).BorderColor(Colors.Black).Row(row =>
            {
                row.RelativeItem(W0)
                   .BorderRight(0.25f).BorderColor(Colors.Black)
                   .PaddingVertical(2).PaddingLeft(indent + 2f).PaddingRight(2)
                   .Text(t => { var s = t.Span(label).FontSize(fontSize); if (bold) s.Bold(); });

                row.RelativeItem(W1).BorderRight(0.25f).BorderColor(Colors.Black).Text("");
                row.RelativeItem(W2).BorderRight(0.25f).BorderColor(Colors.Black).Text("");
                row.RelativeItem(W3).BorderRight(0.25f).BorderColor(Colors.Black).Text("");
                row.RelativeItem(W4).BorderRight(0.25f).BorderColor(Colors.Black).Text("");

                AmountCell(row, W5,  totalCost,  fontSize, bold, borderRight: true);
                AmountCell(row, W6,  firstYear,  fontSize, bold, borderRight: true);
                AmountCell(row, W7,  secondYear, fontSize, bold, borderRight: true);
                AmountCell(row, W8,  thirdYear,  fontSize, bold, borderRight: true);
                AmountCell(row, W9,  fourthYear, fontSize, bold, borderRight: true);
                AmountCell(row, W10, fifthYear,  fontSize, bold, borderRight: true);
                AmountCell(row, W11, sixthYear,  fontSize, bold, borderRight: true);
                AmountCell(row, W12, laterYears, fontSize, bold, borderRight: true);

                row.RelativeItem(W13).Text("");
            });
        }

        /// <summary>Project row with all spatial, implementation, and yearly amount columns populated.</summary>
        static void WriteProjectRow(ColumnDescriptor col, int seq, RDIPData proj)
        {
            float fs = 6;
            // Body row borders use 0.25pt (lighter than the 0.5pt header borders).
            col.Item().BorderTop(0.25f).BorderColor(Colors.Black).Row(row =>
            {
                row.RelativeItem(W0)
                   .BorderRight(0.25f).BorderColor(Colors.Black)
                   .PaddingVertical(2).PaddingLeft(24).PaddingRight(2)
                   .Text($"{seq}. {proj.ProjectDescription}").FontSize(fs);

                row.RelativeItem(W1).BorderRight(0.25f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(2)
                   .Text($"{proj.CityMunicipality}\n({proj.Province})").FontSize(fs);

                row.RelativeItem(W2).BorderRight(0.25f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(2)
                   .Text(proj.CongressionalDistrict).FontSize(fs);

                row.RelativeItem(W3).BorderRight(0.25f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(2)
                   .Text(proj.StartYear.ToString()).FontSize(fs);

                row.RelativeItem(W4).BorderRight(0.25f).BorderColor(Colors.Black)
                   .AlignCenter().AlignMiddle().Padding(2)
                   .Text(proj.EndYear.ToString()).FontSize(fs);

                AmountCell(row, W5,  proj.TotalCost,  fs, false, borderRight: true);
                AmountCell(row, W6,  proj.FirstYear,  fs, false, borderRight: true);
                AmountCell(row, W7,  proj.SecondYear, fs, false, borderRight: true);
                AmountCell(row, W8,  proj.ThirdYear,  fs, false, borderRight: true);
                AmountCell(row, W9,  proj.FourthYear, fs, false, borderRight: true);
                AmountCell(row, W10, proj.FifthYear,  fs, false, borderRight: true);
                AmountCell(row, W11, proj.SixthYear,  fs, false, borderRight: true);
                AmountCell(row, W12, proj.LaterYears, fs, false, borderRight: true);

                row.RelativeItem(W13).Text("");
            });
        }

        static void AmountCell(RowDescriptor row, float weight, double value, float fontSize, bool bold, bool borderRight = false)
        {
            var cell = row.RelativeItem(weight);
            // Body cell right border uses 0.25pt (lighter than the 0.5pt header borders).
            if (borderRight) cell = cell.BorderRight(0.25f).BorderColor(Colors.Black);
            cell.AlignRight().PaddingRight(2).PaddingVertical(2)
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
                    col.Item().PaddingTop(30).PaddingHorizontal(20)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning Engineer").FontSize(7);
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Reviewed By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(20)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Planning and Design Division Chief").FontSize(7);
                });
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("Approved By:").Bold().FontSize(7);
                    col.Item().PaddingTop(30).PaddingHorizontal(20)
                        .LineHorizontal(0.5f).LineColor(Colors.Black);
                    col.Item().PaddingTop(4).AlignCenter()
                        .Text("Regional Director").FontSize(7);
                });
            });
        }
    }
}
