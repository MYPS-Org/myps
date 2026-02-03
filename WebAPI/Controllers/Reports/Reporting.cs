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
                SMTPModel EmailConfig = new SMTPModel
                {
                    Recipient = "mf102798@gmail.com",
                    Subject = "Request for Revision",
                    Body = "Dear Team,<br/><br/>A new revision request has been submitted. Please review the details and take the necessary actions.<br/><br/>Best Regards,<br/>Automated Notification System"
                };
                EmailConfig.SendEmail();
                var Classification = await _db.tFutureRoadsClassification.AsNoTracking().ToListAsync();
                var response = new
                {
                    Classifications = Classification
                };

                return Ok(response); // Remove the extra wrapper
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> GetProgramProjectDetails([FromBody] DTOReportAIPFilter request)
        {
            try
            {
                var response = await GetProgramProjectData(request);
                return Ok(response);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> DownloadProgramProjectDetailsPDF([FromBody] DTOReportAIPFilter request)
        {
            try
            {
                var data = await GetProgramProjectData(request);
                var htmlContent = GenerateProgramProjectHtml(data);
                var pdfBytes = HtmlToPdf(htmlContent);

                var fileName = $"AIP_Report_{data.Program.ProgramId}_{data.Program.StageName}_{DateTime.Now:yyyyMMddHHmmss}.pdf";
                
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }

        private async Task<DTOProgramProjectDetailsResponse> GetProgramProjectData(DTOReportAIPFilter request)
        {
            var query = _db.AIPBase.AsNoTracking().AsQueryable();

            if (!string.IsNullOrEmpty(request.ProgramName))
            {
                query = query.Where(x => x.ProgramName == request.ProgramName);
            }

            if (!string.IsNullOrEmpty(request.ProgramId))
            {
                query = query.Where(x => x.ProgramId == request.ProgramId);
            }

            if (!string.IsNullOrEmpty(request.StageName))
            {
                query = query.Where(x => x.StageName == request.StageName);
            }

            if (!string.IsNullOrEmpty(request.Region))
            {
                query = query.Where(x => x.Region == request.Region);
            }

            var results = await query.ToListAsync();

            if (!results.Any())
            {
                return new DTOProgramProjectDetailsResponse
                {
                    Program = new DTOProgramDetails
                    {  
                        ProgramName = request.ProgramName ?? "",
                        ProgramId = request.ProgramId ?? "",
                        StageName = request.StageName ?? "",
                        ProjectList = new List<DTOProjectInfo>()
                    }
                };
            }

            // Group and transform the data
            var programGroup = results.GroupBy(x => new { x.ProgramId, x.ProgramName, x.StageName }).First();

            var projectList = results
                .GroupBy(x => new { x.ProjectId, x.ProjectCategory, x.Region })
                .Select(projectGroup => new DTOProjectInfo
                {
                    ProjectId = projectGroup.Key.ProjectId,
                    ProjectCategory = projectGroup.Key.ProjectCategory ?? "",
                    Region = projectGroup.Key.Region ?? "",
                    ComponentCosts = projectGroup
                        .GroupBy(x => new { x.ComponentId, x.ComponentAmount, x.ComponentDescription })
                        .Select(cc => new DTOComponentCost
                        {
                            ComponentId = cc.Key.ComponentId,
                            Amount = cc.Key.ComponentAmount,
                            Description = cc.Key.ComponentDescription ?? ""
                        })
                        .ToList(),
                    MajorItems = projectGroup
                        .GroupBy(x => new { x.MW_ComponentId, x.Measure, x.WorkTypeDescription })
                        .Select(mi => new DTOMajorWorkItem
                        {
                            ComponentId = mi.Key.MW_ComponentId,
                            Measure = mi.Key.Measure,
                            Description = mi.Key.WorkTypeDescription
                        })
                        .ToList()
                })
                .ToList();

            return new DTOProgramProjectDetailsResponse
            {
                Program = new DTOProgramDetails
                {
                    ProgramName = programGroup.Key.ProgramName,
                    ProgramId = programGroup.Key.ProgramId,
                    StageName = programGroup.Key.StageName,
                    ProjectList = projectList
                }
            };
        }

        private string GenerateProgramProjectHtml(DTOProgramProjectDetailsResponse data)
        {
            var html = new StringBuilder();
            html.AppendLine("<!DOCTYPE html>");
            html.AppendLine("<html>");
            html.AppendLine("<head>");
            html.AppendLine("<meta charset='utf-8'>");
            html.AppendLine("<style>");
            html.AppendLine("body { font-family: Arial, sans-serif; margin: 20px; font-size: 10pt; }");
            html.AppendLine("h1 { color: #333; font-size: 18pt; margin-bottom: 10px; text-align: center; }");
            html.AppendLine("h2 { color: #555; font-size: 14pt; margin-top: 20px; margin-bottom: 10px; background-color: #f0f0f0; padding: 8px; }");
            html.AppendLine("h3 { color: #666; font-size: 12pt; margin-top: 15px; margin-bottom: 8px; }");
            html.AppendLine(".header-info { margin-bottom: 20px; padding: 10px; background-color: #e8f4f8; border-left: 4px solid #0066cc; }");
            html.AppendLine(".header-info p { margin: 5px 0; }");
            html.AppendLine(".project-section { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; page-break-inside: avoid; }");
            html.AppendLine("table { border-collapse: collapse; width: 100%; margin-bottom: 15px; font-size: 9pt; }");
            html.AppendLine("th { background-color: #4CAF50; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; }");
            html.AppendLine("td { padding: 6px 8px; border: 1px solid #ddd; }");
            html.AppendLine("tr:nth-child(even) { background-color: #f9f9f9; }");
            html.AppendLine(".amount { text-align: right; }");
            html.AppendLine(".project-header { background-color: #e3f2fd; padding: 10px; margin-bottom: 15px; border-radius: 4px; }");
            html.AppendLine("</style>");
            html.AppendLine("</head>");
            html.AppendLine("<body>");

            // Header
            html.AppendLine("<h1>Annual Infrastructure Program (AIP) Report</h1>");
            html.AppendLine("<div class='header-info'>");
            html.AppendLine($"<p><strong>Program ID:</strong> {System.Net.WebUtility.HtmlEncode(data.Program.ProgramName)}</p>");
            html.AppendLine($"<p><strong>Stage Name:</strong> {System.Net.WebUtility.HtmlEncode(data.Program.StageName)}</p>");
            html.AppendLine($"<p><strong>Report Generated:</strong> {DateTime.Now:MMMM dd, yyyy hh:mm tt}</p>");
            html.AppendLine($"<p><strong>Total Projects:</strong> {data.Program.ProjectList.Count}</p>");
            html.AppendLine("</div>");

            // Projects
            foreach (var project in data.Program.ProjectList)
            {
                html.AppendLine("<div class='project-section'>");
                
                // Project Header
                html.AppendLine("<div class='project-header'>");
                html.AppendLine($"<h2>Project: {System.Net.WebUtility.HtmlEncode(project.ProjectId)}</h2>");
                html.AppendLine($"<p><strong>Category:</strong> {System.Net.WebUtility.HtmlEncode(project.ProjectCategory)}</p>");
                html.AppendLine($"<p><strong>Region:</strong> {System.Net.WebUtility.HtmlEncode(project.Region)}</p>");
                html.AppendLine("</div>");

                // Component Costs
                if (project.ComponentCosts.Any())
                {
                    html.AppendLine("<h3>Component Costs</h3>");
                    html.AppendLine("<table>");
                    html.AppendLine("<thead><tr><th>Component ID</th><th>Description</th><th>Amount</th></tr></thead>");
                    html.AppendLine("<tbody>");
                    
                    decimal totalAmount = 0;
                    foreach (var component in project.ComponentCosts)
                    {
                        totalAmount += (decimal)component.Amount;
                        html.AppendLine("<tr>");
                        html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(component.ComponentId)}</td>");
                        html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(component.Description)}</td>");
                        html.AppendLine($"<td class='amount'>{component.Amount:N2}</td>");
                        html.AppendLine("</tr>");
                    }
                    
                    html.AppendLine("<tr style='font-weight: bold; background-color: #e8f5e9;'>");
                    html.AppendLine("<td colspan='2' style='text-align: right;'>Total:</td>");
                    html.AppendLine($"<td class='amount'>{totalAmount:N2}</td>");
                    html.AppendLine("</tr>");
                    html.AppendLine("</tbody>");
                    html.AppendLine("</table>");
                }

                // Major Work Items
                if (project.MajorItems.Any())
                {
                    html.AppendLine("<h3>Major Work Items</h3>");
                    html.AppendLine("<table>");
                    html.AppendLine("<thead><tr><th>Component ID</th><th>Measure</th><th>Description</th></tr></thead>");
                    html.AppendLine("<tbody>");
                    
                    foreach (var item in project.MajorItems)
                    {
                        html.AppendLine("<tr>");
                        html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(item.ComponentId)}</td>");
                        html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(item.Measure)}</td>");
                        html.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(item.Description)}</td>");
                        html.AppendLine("</tr>");
                    }
                    
                    html.AppendLine("</tbody>");
                    html.AppendLine("</table>");
                }

                html.AppendLine("</div>");
            }

            html.AppendLine("</body>");
            html.AppendLine("</html>");

            return html.ToString();
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