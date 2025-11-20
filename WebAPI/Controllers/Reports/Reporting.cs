using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using DinkToPdf;
using DinkToPdf.Contracts;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using System.Data.SqlClient;
using System.Drawing;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using static Eaf.Domain.Uow.EafDataFilters;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using static System.Runtime.InteropServices.JavaScript.JSType;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class Reporting : CoreController
    {
        IConverter _converter;
        public Reporting(AppDbContext db, IProducer<Null, string> producer, IConverter con) : base(db, producer) {
            _converter = con;
        }
        #region Reporting Region
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP()
        {
            try
            {
                // Fix the file path - use absolute path from base directory
                string excelPath = Path.Combine(Appsetting.Resources.Templates, "AIP.xlsx");

                // Check if file exists
                if (!System.IO.File.Exists(excelPath))
                {
                    return BadRequest($"Template file not found at: {excelPath}");
                }

                // 1. convert excel to html (fixed method name)
                string htmlContent = ExcelToHtml(excelPath);

                // 2. convert html to pdf
                byte[] pdfBytes = HtmlToPdf(htmlContent);

                // Return the PDF file
                return File(pdfBytes, "application/pdf", "AIP_Report.pdf");
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        private string ExcelToHtml(string filePath)
        {
            using var package = new ExcelPackage(new FileInfo(filePath));
            var ws = package.Workbook.Worksheets[0];

            var html = new StringBuilder();
            html.AppendLine("<!DOCTYPE html>");
            html.AppendLine("<html>");
            html.AppendLine("<head>");
            html.AppendLine("<meta charset='utf-8'>");
            html.AppendLine("<style>");
            html.AppendLine("body { font-family: Calibri, Arial, sans-serif; margin: 0; padding: 20px; }");
            html.AppendLine("table { border-collapse: collapse; width: 100%; table-layout: fixed; }");
            html.AppendLine("td { border: 1px solid #d0d0d0; padding: 4px 6px; overflow: hidden; word-wrap: break-word; }");
            html.AppendLine("</style>");
            html.AppendLine("</head>");
            html.AppendLine("<body>");
            html.AppendLine("<table>");

            // Get dimensions
            int startRow = ws.Dimension.Start.Row;
            int endRow = ws.Dimension.End.Row;
            int startCol = ws.Dimension.Start.Column;
            int endCol = ws.Dimension.End.Column;

            // Build a dictionary of merged cell ranges for quick lookup
            var mergedCellRanges = new Dictionary<string, (int colspan, int rowspan)>();
            var mergedCellsToSkip = new HashSet<string>();

            foreach (var mergedAddress in ws.MergedCells)
            {
                var range = ws.Cells[mergedAddress];
                int startR = range.Start.Row;
                int startC = range.Start.Column;
                int endR = range.End.Row;
                int endC = range.End.Column;

                // Store the span info for the first cell in the merge
                int colSpan = endC - startC + 1;
                int rowSpan = endR - startR + 1;
                mergedCellRanges[$"{startR}_{startC}"] = (colSpan, rowSpan);

                // Mark all other cells in the merge to be skipped
                for (int r = startR; r <= endR; r++)
                {
                    for (int c = startC; c <= endC; c++)
                    {
                        if (r != startR || c != startC)
                        {
                            mergedCellsToSkip.Add($"{r}_{c}");
                        }
                    }
                }
            }

            // Generate rows
            for (int row = startRow; row <= endRow; row++)
            {
                // Calculate row height
                double rowHeight = ws.Row(row).Height;
                string rowHeightStyle = rowHeight > 0 ? $"height: {rowHeight * 1.33}px;" : "";
                
                html.AppendLine($"<tr style='{rowHeightStyle}'>");

                for (int col = startCol; col <= endCol; col++)
                {
                    string cellKey = $"{row}_{col}";
                    
                    // Skip if this cell is part of a merge (but not the start)
                    if (mergedCellsToSkip.Contains(cellKey))
                    {
                        continue;
                    }

                    var cell = ws.Cells[row, col];
                    var cellValue = cell.Text ?? "";

                    // Get cell styling
                    var style = GetCellStyle(cell, ws, row, col);

                    // Check if this is the start of a merged cell
                    string colspan = "";
                    string rowspan = "";
                    
                    if (mergedCellRanges.TryGetValue(cellKey, out var spans))
                    {
                        if (spans.colspan > 1) colspan = $" colspan='{spans.colspan}'";
                        if (spans.rowspan > 1) rowspan = $" rowspan='{spans.rowspan}'";
                    }

                    html.AppendLine($"<td{colspan}{rowspan} style='{style}'>{System.Net.WebUtility.HtmlEncode(cellValue)}</td>");
                }

                html.AppendLine("</tr>");
            }

            html.AppendLine("</table>");
            html.AppendLine("</body>");
            html.AppendLine("</html>");

            return html.ToString();
        }

        private string GetCellStyle(ExcelRange cell, ExcelWorksheet ws, int row, int col)
        {
            var styles = new List<string>();

            // Font styling
            if (cell.Style.Font.Bold)
                styles.Add("font-weight: bold");
            
            if (cell.Style.Font.Italic)
                styles.Add("font-style: italic");

            if (cell.Style.Font.UnderLine)
                styles.Add("text-decoration: underline");

            // Font size
            if (cell.Style.Font.Size > 0)
                styles.Add($"font-size: {cell.Style.Font.Size}pt");

            // Font color
            if (!string.IsNullOrEmpty(cell.Style.Font.Color.Rgb))
            {
                var fontColor = cell.Style.Font.Color.Rgb;
                if (fontColor.Length >= 6)
                {
                    fontColor = fontColor.Length == 8 ? fontColor.Substring(2) : fontColor;
                    styles.Add($"color: #{fontColor}");
                }
            }

            // Background color
            if (cell.Style.Fill.PatternType == ExcelFillStyle.Solid)
            {
                var bgColor = cell.Style.Fill.BackgroundColor.Rgb;
                if (!string.IsNullOrEmpty(bgColor) && bgColor.Length >= 6)
                {
                    bgColor = bgColor.Length == 8 ? bgColor.Substring(2) : bgColor;
                    styles.Add($"background-color: #{bgColor}");
                }
            }

            // Text alignment
            var hAlign = cell.Style.HorizontalAlignment switch
            {
                ExcelHorizontalAlignment.Left => "left",
                ExcelHorizontalAlignment.Center => "center",
                ExcelHorizontalAlignment.Right => "right",
                _ => ""
            };
            if (!string.IsNullOrEmpty(hAlign))
                styles.Add($"text-align: {hAlign}");

            var vAlign = cell.Style.VerticalAlignment switch
            {
                ExcelVerticalAlignment.Top => "top",
                ExcelVerticalAlignment.Center => "middle",
                ExcelVerticalAlignment.Bottom => "bottom",
                _ => ""
            };
            if (!string.IsNullOrEmpty(vAlign))
                styles.Add($"vertical-align: {vAlign}");

            // Column width
            double colWidth = ws.Column(col).Width;
            if (colWidth > 0)
            {
                styles.Add($"width: {colWidth * 7}px");
            }

            // Text wrapping
            if (cell.Style.WrapText)
                styles.Add("white-space: normal");
            else
                styles.Add("white-space: nowrap");

            // Borders
            var borderStyle = GetBorderStyle(cell.Style.Border);
            if (!string.IsNullOrEmpty(borderStyle))
                styles.Add(borderStyle);

            return string.Join("; ", styles);
        }

        private string GetBorderStyle(Border border)
        {
            var borders = new List<string>();

            if (border.Top.Style != ExcelBorderStyle.None)
                borders.Add($"border-top: 1px solid #000");
            
            if (border.Bottom.Style != ExcelBorderStyle.None)
                borders.Add($"border-bottom: 1px solid #000");
            
            if (border.Left.Style != ExcelBorderStyle.None)
                borders.Add($"border-left: 1px solid #000");
            
            if (border.Right.Style != ExcelBorderStyle.None)
                borders.Add($"border-right: 1px solid #000");

            return string.Join("; ", borders);
        }

        private byte[] HtmlToPdf(string htmlContent)
        {
            var doc = new HtmlToPdfDocument()
            {
                GlobalSettings = new GlobalSettings
                {
                    ColorMode = ColorMode.Color,
                    Orientation = Orientation.Landscape, // Changed to Landscape for wider Excel sheets
                    PaperSize = PaperKind.A4,
                    Margins = new MarginSettings { Top = 10, Bottom = 10, Left = 10, Right = 10 }
                },
                Objects = {
                    new ObjectSettings
                    {
                        HtmlContent = htmlContent,
                        WebSettings = { 
                            DefaultEncoding = "utf-8",
                            EnableJavascript = false
                        },
                        // Better quality rendering
                        UseLocalLinks = true,
                        UseExternalLinks = true,
                        ProduceForms = true
                    }
                }
            };
            return _converter.Convert(doc);
        }
        #endregion

    }
}