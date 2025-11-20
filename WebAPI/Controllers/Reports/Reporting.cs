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
using System.Data.SqlClient;
using System.Reflection;
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

            string html = "<html><body>";
            html += "<h1 style='text-align:center'>AIP Report</h1>";
            html += "<table border='1' style='border-collapse:collapse; width:100%'>";
            for (int row = 1; row <= ws.Dimension.End.Row; row++)
            {
                html += "<tr>";
                for (int col = 1; col <= ws.Dimension.End.Column; col++)
                {
                    html += $"<td style='padding:5px'>{ws.Cells[row, col].Text}</td>";
                }
                html += "</tr>";
            }
            html += "</table></body></html>";

            return html;
        }

        private byte[] HtmlToPdf(string htmlContent)
        {
            var doc = new HtmlToPdfDocument()
            {
                GlobalSettings = new GlobalSettings
                {
                    ColorMode = ColorMode.Color,
                    Orientation = Orientation.Portrait,
                    PaperSize = PaperKind.A4,
                    Margins = new MarginSettings { Top = 20, Bottom = 20 }
                },
                Objects = {
                    new ObjectSettings
                    {
                        HtmlContent = htmlContent,
                        WebSettings = { DefaultEncoding = "utf-8" }
                    }
                }
            };
            return _converter.Convert(doc);
        }
        #endregion

    }
}