using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data.SqlClient;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Xml;
using static Eaf.Domain.Uow.EafDataFilters;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory.Database;
using static System.Runtime.InteropServices.JavaScript.JSType;
using ReportGeneration;
namespace WebAPI.Controllers.Revision
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class Reporting : CoreController
    {
        public Reporting(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region AIP
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP()
        {
            try
            {
                var projects = MockData.GetAIP01();
                var components = MockData.GetAIPComponents();

                var bytes = AIP.GenerateReport(projects, components);

                var fileName = $"AIP_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region AIP02
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP02()
        {
            try
            {
                var projects = MockData.GetAIP01();
                var components = MockData.GetAIPComponents();

                var bytes = AIP02.GenerateReport(projects, components);

                var fileName = $"AIP02_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region RBP
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportRBP()
        {
            try
            {
                var data = MockData.GetRBP();

                var bytes = GenerateRBP.GenerateReport(data);

                var fileName = $"RBP_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region RBPTier
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportRBPTier()
        {
            try
            {
                var data = MockData.GetRBP();

                var bytes = GenerateRBPTier.GenerateReport(data);

                var fileName = $"RBPTier_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region RDIP
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportRDIP()
        {
            try
            {
                var data = MockData.GetRDIP();

                var bytes = GenerateRDIP.GenerateReport(data);

                var fileName = $"RDIP_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion

        #region RBPComponents
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportRBPComponents()
        {
            try
            {
                var data = MockData.GetRBPComponents();

                var bytes = RBPComponents.GenerateReport(data);

                var fileName = $"RBPComponents_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}