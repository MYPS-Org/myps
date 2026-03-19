using Confluent.Kafka;
using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Procedures;
using DBHelper.Models.Table;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Newtonsoft.Json;
using ReportGeneration;
using System.Data.SqlClient;
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
        public Reporting(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region AIP 
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP([FromBody] RequestReportAIPDTO dto)
        {
            try
            {
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.StageName)) { param.Add("@StageName", dto.StageName); }
                if (!string.IsNullOrEmpty(dto.CategoryName)) { param.Add("@CategoryName", dto.CategoryName); }
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                if (!string.IsNullOrEmpty(dto.OperatingUnitName)) { param.Add("@OperatingUnitName", dto.OperatingUnitName); }
                if (!string.IsNullOrEmpty(dto.DistrictEngineeringOffice)) { param.Add("@DistrictEngineeringOffice", dto.DistrictEngineeringOffice); }
                if (!string.IsNullOrEmpty(dto.ImplementingOfficeName)) { param.Add("@ImplementingOfficeName", dto.ImplementingOfficeName); }
                if (!string.IsNullOrEmpty(dto.LegislativeDistrictName)) { param.Add("@LegislativeDistrictName", dto.LegislativeDistrictName); }
                string aipSql = "EXEC pGenerateAIP01 " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<GenerateAIP01> aip = Sql.NormalQuery<GenerateAIP01>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                if (aip.Count < 1)
                {
                    return new BadRequestObjectResult(new {
                        Title = "No Data Found",
                        Message = "No AIP data found for the given parameters."
                    });
                }
                var param2 = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId },
                    { "@StageName", aip.FirstOrDefault()?.StageName }
                };
                List<GenerateAIPComponents> aipcomponents = Sql.NormalQuery<GenerateAIPComponents>(
                    Appsetting.ConnectionString,
                    "EXEC pGenerateAIPComponents " +
                    "@ProgramId = @ProgramId, " +
                    "@StageName = @StageName", param
                );
                /*
                 EXEC pGenerateAIP01 
                    @ProgramId = 'P_CO-PS-635_04112025_134220',
                    @StageName = 'GAA-R',--Optional
                    @CategoryName = 'Category Name',--Optional
                    @RegionName = 'Region I',--Optional
                    @OperatingUnitName = 'Region I',--Optional
                    @DistrictEngineeringOffice = 'Region I',--Optional
                    @ImplementingOfficeName = 'Region I',--Optional
                    @LegislativeDistrictName = 'Region I'--Optional;
                 */

                var bytes = AIP.GenerateReport(aip, aipcomponents);

                var fileName = $"AIP_Report.pdf";
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
        public async Task<IActionResult> RequestReportAIP02([FromBody] RequestReportAIPDTO dto)
        {
            try
            {
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.StageName)) { param.Add("@StageName", dto.StageName); }
                if (!string.IsNullOrEmpty(dto.CategoryName)) { param.Add("@CategoryName", dto.CategoryName); }
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                if (!string.IsNullOrEmpty(dto.OperatingUnitName)) { param.Add("@OperatingUnitName", dto.OperatingUnitName); }
                if (!string.IsNullOrEmpty(dto.DistrictEngineeringOffice)) { param.Add("@DistrictEngineeringOffice", dto.DistrictEngineeringOffice); }
                if (!string.IsNullOrEmpty(dto.ImplementingOfficeName)) { param.Add("@ImplementingOfficeName", dto.ImplementingOfficeName); }
                if (!string.IsNullOrEmpty(dto.LegislativeDistrictName)) { param.Add("@LegislativeDistrictName", dto.LegislativeDistrictName); }
                string aipSql = "EXEC pGenerateAIP01 " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<GenerateAIP01> aip = Sql.NormalQuery<GenerateAIP01>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                if (aip.Count < 1)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No AIP data found for the given parameters."
                    });
                }
                var param2 = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId },
                    { "@StageName", aip.FirstOrDefault()?.StageName }
                };
                List<GenerateAIPComponents> aipcomponents = Sql.NormalQuery<GenerateAIPComponents>(
                    Appsetting.ConnectionString,
                    "EXEC pGenerateAIPComponents " +
                    "@ProgramId = @ProgramId, " +
                    "@StageName = @StageName", param
                );
                /*
                 EXEC pGenerateAIP01 
                    @ProgramId = 'P_CO-PS-635_04112025_134220',
                    @StageName = 'GAA-R',--Optional
                    @CategoryName = 'Category Name',--Optional
                    @RegionName = 'Region I',--Optional
                    @OperatingUnitName = 'Region I',--Optional
                    @DistrictEngineeringOffice = 'Region I',--Optional
                    @ImplementingOfficeName = 'Region I',--Optional
                    @LegislativeDistrictName = 'Region I'--Optional;
                 */

                var bytes = AIP02.GenerateReport(aip, aipcomponents);

                var fileName = $"AIP_Report02.pdf";
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
        public async Task<IActionResult> RequestReportRBPComponents([FromBody] RequestReportRBPComponentsDTO dto)
        {
            try
            {
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRBP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRBPComponents> RBP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRBPComponents>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                var bytes = RBPComponents.GenerateReport(RBP);

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

        #region RBP
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestReportRBP(RequestReportRBPDTO dto)
        {
            try
            {
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRBP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRBP> RBP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRBP>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                var bytes = ReportGeneration.GenerateRBP.GenerateReport(RBP);

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
                return Ok();
                var data = MockData.GetRDIP();

                //var bytes = GenerateRDIP.GenerateReport(data);

                //var fileName = $"RDIP_Report.pdf";
                //System.IO.File.WriteAllBytes(fileName, bytes);
                //return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}