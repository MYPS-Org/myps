using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ReportGeneration
{
    public static class GeneratePDF
    {
        // ── Shared font / style constants ─────────────────────────────
        public const string FontFamily = "Tahoma";

        private static byte[]? _logoCached;
        private static readonly object _lock = new();

        /// <summary>Load the DPWH 17-gear logo once and cache it.</summary>
        public static byte[] GetLogo()
        {
            if (_logoCached is not null) return _logoCached;
            lock (_lock)
            {
                if (_logoCached is not null) return _logoCached;
                var path = Path.Combine(
                    AppContext.BaseDirectory, "Resources", "Images", "ReportLogo.png");
                _logoCached = File.ReadAllBytes(path);
            }
            return _logoCached;
        }

        /// <summary>
        /// Sets the QuestPDF community license and creates a single-page PDF document
        /// using the provided page configuration action.
        /// All report classes delegate PDF creation to this method.
        /// </summary>
        /// <param name="configurePage">Action that configures the page (size, margins, header, content, footer).</param>
        /// <returns>PDF byte array suitable for an <c>application/pdf</c> file-download response.</returns>
        public static byte[] GenerateReport(Action<PageDescriptor> configurePage)
        {
            QuestPDF.Settings.License = LicenseType.Community;
            QuestPDF.Settings.EnableDebugging = false;

            var document = Document.Create(container =>
            {
                container.Page(configurePage);
            });
            return document.GeneratePdf();
        }

        /// <summary>Standard DPWH header block with logo + Republic / DPWH / title lines.</summary>
        public static void BuildDPWHHeader(
            ColumnDescriptor col,
            byte[] logo,
            string title,
            string? subtitle = null,
            string? regionName = null)
        {
            col.Item().AlignCenter().Row(row =>
            {
                row.AutoItem().AlignMiddle().Width(55).Height(55)
                   .Image(logo);

                row.AutoItem().PaddingLeft(8).AlignMiddle().Column(inner =>
                {
                    inner.Item().AlignCenter()
                         .Text("Republic of the Philippines")
                         .FontFamily(FontFamily).FontSize(9);
                    inner.Item().AlignCenter()
                         .Text("DEPARTMENT OF PUBLIC WORKS AND HIGHWAYS")
                         .FontFamily(FontFamily).FontSize(9).Bold();
                    if (regionName is not null)
                        inner.Item().AlignCenter()
                             .Text(regionName)
                             .FontFamily(FontFamily).FontSize(9).Bold();
                    inner.Item().PaddingTop(4).AlignCenter()
                         .Text(title)
                         .FontFamily(FontFamily).FontSize(10).Bold();
                    if (subtitle is not null)
                        inner.Item().AlignCenter()
                             .Text(subtitle)
                             .FontFamily(FontFamily).FontSize(8);
                });
            });
        }

        /// <summary>Standard footer with MYPS timestamp + page numbers.</summary>
        public static void BuildFooter(PageDescriptor page, int fontSize = 7)
        {
            page.Footer()
                .PaddingTop(6)
                .Row(row =>
                {
                    row.RelativeItem()
                       .Text(t =>
                       {
                           t.Span("MYPS: ").FontFamily(FontFamily).FontSize(fontSize);
                           t.Span(DateTime.Now.ToString("MM/dd/yyyy hh:mm:ss tt"))
                             .FontFamily(FontFamily).FontSize(fontSize);
                       });

                    row.RelativeItem()
                       .AlignRight()
                       .Text(t =>
                       {
                           t.Span("Page ").FontFamily(FontFamily).FontSize(fontSize);
                           t.CurrentPageNumber().FontFamily(FontFamily).FontSize(fontSize);
                            t.Span(" of ").FontFamily(FontFamily).FontSize(fontSize);
                            t.TotalPages().FontFamily(FontFamily).FontSize(fontSize);
                       });
                });
        }
    }
}