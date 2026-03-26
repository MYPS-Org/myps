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
using OfficeOpenXml;
using OfficeOpenXml.Style;
using QuestPDF.Helpers;
using ReportGeneration;
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
        public async Task<IActionResult> RequestReportRBPTier(RequestReportRBPTierDTO dto)
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
                var bytes = GenerateRBPTier.GenerateReport(RBP);

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
        public async Task<IActionResult> RequestReportRDIP([FromBody] RequestReportRDIPDTO dto)
        {
            try
            {
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRDIP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRDIP> RDIP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRDIP>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                var bytes = ReportGeneration.GenerateRDIP.GenerateReport(RDIP);

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

        #region Export Raw Projects
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestRawProjects([FromBody] RequestRawProjectsDTO dto)
        {
            try
            {
                var stages = await _db.tProjectStages
                    .AsNoTracking()
                    .Where(s => s.ProgramId == dto.ProgramId && s.StageName == dto.StageName)
                    .ToListAsync();

                if (stages.Count < 1)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No projects found for the given Program and Stage."
                    });
                }

                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.StageName)) { param.Add("@StageName", dto.StageName); }
                string aipSql = "EXEC pExportRawProjects " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<ExportRawProjects> rawProjects = Sql.NormalQuery<ExportRawProjects>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                var projectIds = rawProjects.Select(p => p.ProjectId).ToList();

                var fundingProfiles = await _db.tProjectFundingProfile
                    .AsNoTracking()
                    .Where(f => projectIds.Contains(f.ProjectId) && f.StageName == dto.StageName && !f.IsDeleted)
                    .ToListAsync();

                var componentCosts = await _db.tProjectComponentCost
                    .AsNoTracking()
                    .Where(c => projectIds.Contains(c.ProjectId) && c.StageName == dto.StageName && !c.IsDeleted)
                    .ToListAsync();

                var costIds = componentCosts.Select(c => c.CostId).ToList();

                var componentCostPerYear = await _db.tProjectComponentCostPerYear
                    .AsNoTracking()
                    .Where(cy => costIds.Contains(cy.ComponentCostId) && cy.StageName == dto.StageName && !cy.IsDeleted)
                    .ToListAsync();

                //pExportRawProjectsMajorItems


                var WorkItemParams = new Dictionary<string, object> {
                    { "@ProjectIds", string.Join(",",projectIds) },
                    { "@StageName", dto.StageName }
                };
                string WorkItemSql = "EXEC pExportRawProjectsMajorItems " + string.Join(", ", WorkItemParams.Keys.Select(k => $"{k} = {k}"));
                List<ProjectMajorWorkItem> majorWorkItems = Sql.NormalQuery<ProjectMajorWorkItem>(
                    Appsetting.ConnectionString,
                    WorkItemSql, WorkItemParams
                );
                

                var majorWorkReferenceIds = majorWorkItems.Select(m => m.ReferenceId).ToList();

                var majorWorkLocations = await _db.tProjectMajorWorkLocations
                    .AsNoTracking()
                    .Where(l => majorWorkReferenceIds.Contains(l.ParentId) && l.StageName == dto.StageName && !l.IsDeleted)
                    .ToListAsync();

                ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
                using var package = new ExcelPackage();

                // Project sheet
                {
                    var ws = package.Workbook.Worksheets.Add("Project");
                    ws.Cells["A1"].Value = "ProgramId";
                    ws.Cells["B1"].Value = "ReferenceId";
                    ws.Cells["C1"].Value = "ProjectId";
                    ws.Cells["D1"].Value = "AlternateId";
                    ws.Cells["E1"].Value = "ExternalId";
                    ws.Cells["F1"].Value = "UACS";
                    ws.Cells["G1"].Value = "MYId";
                    ws.Cells["H1"].Value = "MYCAApprovalDate";
                    ws.Cells["I1"].Value = "Description";
                    ws.Cells["J1"].Value = "Category";
                    ws.Cells["K1"].Value = "Thrust";
                    ws.Cells["L1"].Value = "Origin";
                    ws.Cells["M1"].Value = "City";
                    ws.Cells["N1"].Value = "Province";
                    ws.Cells["O1"].Value = "LegislativeDistrict";
                    ws.Cells["P1"].Value = "OperatingUnit";
                    ws.Cells["Q1"].Value = "ImplementingOffice";
                    ws.Cells["R1"].Value = "DEO";
                    ws.Cells["S1"].Value = "Region";
                    ws.Cells["T1"].Value = "Agency";
                    ws.Cells["U1"].Value = "IslandCode";
                    ws.Cells["V1"].Value = "ImplementationMode";
                    ws.Cells["W1"].Value = "EmergencyMode";
                    ws.Cells["X1"].Value = "Feasibility";
                    ws.Cells["Y1"].Value = "FeasibilityDate";
                    ws.Cells["Z1"].Value = "DetailedDesign";
                    ws.Cells["AA1"].Value = "DetailedDesignDate";
                    ws.Cells["AB1"].Value = "RowAvailable";
                    ws.Cells["AC1"].Value = "RegionWide";
                    ws.Cells["AD1"].Value = "Tier";
                    ws.Cells["AE1"].Value = "Rank";
                    ws.Cells["AF1"].Value = "IsRevised";
                    ws.Cells["AG1"].Value = "RevisedNumber";
                    ws.Cells["AH1"].Value = "Is Publishable";
                    ws.Cells["AI1"].Value = "Published To PCMA";
                    ws.Cells["AJ1"].Value = "CreatedBy";
                    ws.Cells["AK1"].Value = "CreatedDate";

                    using (var headerRange = ws.Cells["A1:AK1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(63, 159, 255));
                    }

                    for (int i = 0; i < rawProjects.Count; i++)
                    {
                        var item = rawProjects[i];
                        ws.Cells[i + 2, 1].Value = item.ProgramId;
                        ws.Cells[i + 2, 2].Value = item.ReferenceId;
                        ws.Cells[i + 2, 3].Value = item.ProjectId;
                        ws.Cells[i + 2, 4].Value = item.AlternateId;
                        ws.Cells[i + 2, 5].Value = item.ExternalId;
                        ws.Cells[i + 2, 6].Value = item.UACS;
                        ws.Cells[i + 2, 6].Style.Numberformat.Format = "@";
                        ws.Cells[i + 2, 7].Value = item.MYId;
                        ws.Cells[i + 2, 8].Value = item.MYCAApprovalDate;
                        ws.Cells[i + 2, 8].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        ws.Cells[i + 2, 9].Value = item.Description;
                        ws.Cells[i + 2, 10].Value = item.Category;
                        ws.Cells[i + 2, 11].Value = item.Thrust;
                        ws.Cells[i + 2, 12].Value = item.Origin;
                        ws.Cells[i + 2, 13].Value = item.City;
                        ws.Cells[i + 2, 14].Value = item.Province;
                        ws.Cells[i + 2, 15].Value = item.LegislativeDistrict;
                        ws.Cells[i + 2, 16].Value = item.OperatingUnit;
                        ws.Cells[i + 2, 17].Value = item.ImplementingOffice;
                        ws.Cells[i + 2, 18].Value = item.DEO;
                        ws.Cells[i + 2, 19].Value = item.Region;
                        ws.Cells[i + 2, 20].Value = item.Agency;
                        ws.Cells[i + 2, 21].Value = item.IslandCode;
                        ws.Cells[i + 2, 22].Value = item.ImplementationMode;
                        ws.Cells[i + 2, 23].Value = item.EmergencyMode;
                        ws.Cells[i + 2, 24].Value = item.Feasibility;
                        ws.Cells[i + 2, 25].Value = item.FeasibilityDate;
                        ws.Cells[i + 2, 25].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        ws.Cells[i + 2, 26].Value = item.DetailedDesign;
                        ws.Cells[i + 2, 27].Value = item.DetailedDesignDate;
                        ws.Cells[i + 2, 27].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        ws.Cells[i + 2, 28].Value = item.RowAvailable;
                        ws.Cells[i + 2, 29].Value = item.RegionWide;
                        ws.Cells[i + 2, 30].Value = item.Tier;
                        ws.Cells[i + 2, 31].Value = item.Rank;
                        ws.Cells[i + 2, 32].Value = item.IsRevised;
                        ws.Cells[i + 2, 33].Value = item.RevisedNumber;
                        ws.Cells[i + 2, 34].Value = item.IsPublishable;
                        ws.Cells[i + 2, 35].Value = item.IsPublished;
                        ws.Cells[i + 2, 36].Value = item.CreatedBy;
                        ws.Cells[i + 2, 37].Value = item.CreatedDate;
                        ws.Cells[i + 2, 37].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                    }
                    //ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                // Funding Profile sheet
                if (fundingProfiles.Count > 0)
                {
                    var ws = package.Workbook.Worksheets.Add("Funding Profile");
                    ws.Cells["A1"].Value = "ProjectId";
                    ws.Cells["B1"].Value = "Source";
                    ws.Cells["C1"].Value = "Agreement";
                    ws.Cells["D1"].Value = "Amount";
                    ws.Cells["E1"].Value = "Percentage";
                    ws.Cells["F1"].Value = "CreatedBy";
                    ws.Cells["G1"].Value = "CreatedDate";
                    ws.Cells["H1"].Value = "UpdatedBy";
                    ws.Cells["I1"].Value = "UpdatedDate";

                    using (var headerRange = ws.Cells["A1:I1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(63, 159, 255));
                    }

                    for (int i = 0; i < fundingProfiles.Count; i++)
                    {
                        var item = fundingProfiles[i];
                        ws.Cells[i + 2, 1].Value = item.ProjectId;
                        ws.Cells[i + 2, 2].Value = item.Source;
                        ws.Cells[i + 2, 3].Value = item.Agreement;
                        ws.Cells[i + 2, 4].Value = item.Amount;
                        ws.Cells[i + 2, 5].Value = item.Percentage;
                        ws.Cells[i + 2, 6].Value = item.CreatedBy;
                        ws.Cells[i + 2, 7].Value = item.CreatedDate;
                        ws.Cells[i + 2, 7].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        ws.Cells[i + 2, 8].Value = item.UpdatedBy;
                        ws.Cells[i + 2, 9].Value = item.UpdatedDate;
                        ws.Cells[i + 2, 9].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                    }
                    //ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                // Component sheet (grouped with Cost Per Year)
                if (componentCosts.Count > 0)
                {
                    var ws = package.Workbook.Worksheets.Add("Component");
                    var costPerYearLookup = componentCostPerYear
                        .GroupBy(cy => cy.ComponentCostId)
                        .ToDictionary(g => g.Key, g => g.ToList());

                    int row = 2;
                    ws.Cells["A1"].Value = "Project ID";
                    ws.Cells["B1"].Value = "Description";
                    ws.Cells["C1"].Value = "Component Project ID";
                    ws.Cells["D1"].Value = "Component Type";
                    ws.Cells["E1"].Value = "Component ID";
                    ws.Cells["F1"].Value = "Total";
                    ws.Cells["G1"].Value = "Created By";
                    ws.Cells["H1"].Value = "Created Date";
                    ws.Cells["I1"].Value = "UpdatedBy";
                    ws.Cells["J1"].Value = "UpdatedDate";

                    using (var headerRange = ws.Cells["A1:J1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(63, 159, 255));
                    }
                    foreach (var cost in componentCosts)
                    {
                        // Parent row — ComponentCost
                        ws.Cells[row, 1].Value = cost.ProjectId;
                        ws.Cells[row, 2].Value = cost.Description;
                        ws.Cells[row, 3].Value = cost.CostId;
                        ws.Cells[row, 4].Value = cost.ComponentType;
                        ws.Cells[row, 5].Value = cost.ComponentId;
                        ws.Cells[row, 6].Value = cost.Total;
                        ws.Cells[row, 7].Value = cost.CreatedBy;
                        ws.Cells[row, 8].Value = cost.CreatedDate;
                        ws.Cells[row, 8].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        ws.Cells[row, 9].Value = cost.UpdatedBy;
                        ws.Cells[row, 10].Value = cost.UpdatedDate;
                        ws.Cells[row, 10].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        row++;

                        // Child rows — CostPerYear grouped under parent
                        if (costPerYearLookup.TryGetValue(cost.CostId, out var yearRows))
                        {
                            int startRow = row;
                            ws.Cells[row, 5].Value = "Year";
                            ws.Cells[row, 6].Value = "Amount";
                            ws.Cells[row, 7].Value = "Start Date";
                            ws.Cells[row, 8].Value = "End Date";
                            ws.Cells[row, 9].Value = "Created By";
                            ws.Cells[row, 10].Value = "Created Date";
                            ws.Cells[row, 11].Value = "UpdatedBy";
                            ws.Cells[row, 12].Value = "UpdatedDate";

                            using (var headerRange = ws.Cells[row, 5, row, 12])
                            {
                                headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                                headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(175, 215, 255));
                            }
                            row++;
                            foreach (var yr in yearRows)
                            {
                                ws.Cells[row, 5].Value = yr.Year;
                                ws.Cells[row, 6].Value = yr.Amount;
                                ws.Cells[row, 7].Value = yr.StartDate;
                                ws.Cells[row, 7].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 8].Value = yr.EndDate;
                                ws.Cells[row, 8].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 9].Value = yr.CreatedBy;
                                ws.Cells[row, 10].Value = yr.CreatedDate;
                                ws.Cells[row, 10].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 11].Value = yr.UpdatedBy;
                                ws.Cells[row, 12].Value = yr.UpdatedDate;
                                ws.Cells[row, 12].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                row++;
                            }
                            int endRow = row - 1;
                            for (int r = startRow; r <= endRow; r++)
                            {
                                ws.Row(r).OutlineLevel = 1;
                            }
                        }
                    }
                    if (ws.Dimension != null) ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                // Major Work Item sheet (grouped with Work Locations)
                if (majorWorkItems.Count > 0)
                {
                    var ws = package.Workbook.Worksheets.Add("Major Work Item");
                    var locationLookup = majorWorkLocations
                        .GroupBy(l => l.ParentId)
                        .ToDictionary(g => g.Key, g => g.ToList());

                    int row = 2;
                    ws.Cells["A1"].Value = "Project ID";
                    ws.Cells["B1"].Value = "Component Project ID";
                    ws.Cells["C1"].Value = "Component ID";
                    ws.Cells["D1"].Value = "Year of Work";
                    ws.Cells["E1"].Value = "Work Type";
                    ws.Cells["F1"].Value = "Infra Type";
                    ws.Cells["G1"].Value = "Created By";
                    ws.Cells["H1"].Value = "Created Date";
                    ws.Cells["I1"].Value = "Updated By";
                    ws.Cells["J1"].Value = "Updated Date";

                    using (var headerRange = ws.Cells["A1:J1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(63, 159, 255));
                    }

                    foreach (var wi in majorWorkItems)
                    {
                        // Parent row — MajorWorkItem
                        ws.Cells[row, 1].Value = wi.ProjectId;
                        ws.Cells[row, 2].Value = wi.ReferenceId;
                        ws.Cells[row, 3].Value = wi.ComponentId;
                        ws.Cells[row, 4].Value = wi.YearOfWork;
                        ws.Cells[row, 5].Value = wi.WorkTypeId;
                        ws.Cells[row, 6].Value = wi.InfraType;;
                        ws.Cells[row, 7].Value = wi.CreatedBy;
                        ws.Cells[row, 8].Value = wi.CreatedDate;
                        ws.Cells[row, 8].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        ws.Cells[row, 9].Value = wi.UpdatedBy;
                        ws.Cells[row, 10].Value = wi.UpdatedDate;
                        ws.Cells[row, 10].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                        row++;

                        // Child rows — Locations grouped under parent
                        if (locationLookup.TryGetValue(wi.ReferenceId, out var locRows))
                        {
                            int startRow = row;
                            ws.Cells[row, 6].Value = "Infra ID";
                            ws.Cells[row, 7].Value = "Detailed Scope";
                            ws.Cells[row, 8].Value = "Target Unit";
                            ws.Cells[row, 9].Value = "Start X";
                            ws.Cells[row, 10].Value = "Start Y";
                            ws.Cells[row, 11].Value = "End X";
                            ws.Cells[row, 12].Value = "End Y";
                            ws.Cells[row, 13].Value = "Physical Target";
                            ws.Cells[row, 14].Value = "Start Station Limit";
                            ws.Cells[row, 15].Value = "End Station Limit";
                            ws.Cells[row, 16].Value = "End Chainage";
                            ws.Cells[row, 17].Value = "Start Chainage";
                            ws.Cells[row, 18].Value = "Length";
                            ws.Cells[row, 19].Value = "Created By";
                            ws.Cells[row, 20].Value = "Created Date";
                            ws.Cells[row, 21].Value = "Updated By";
                            ws.Cells[row, 22].Value = "Updated Date";

                            using (var childHeaderRange = ws.Cells[row, 5, row, 24])
                            {
                                childHeaderRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                                childHeaderRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(175, 215, 255));
                            }
                            row++;

                            foreach (var loc in locRows)
                            {
                                ws.Cells[row, 6].Value = loc.InfraId;
                                ws.Cells[row, 7].Value = loc.DetailedScope;
                                ws.Cells[row, 8].Value = loc.TargetUnit;
                                ws.Cells[row, 9].Value = loc.StartX;
                                ws.Cells[row, 10].Value = loc.StartY;
                                ws.Cells[row, 11].Value = loc.EndX;
                                ws.Cells[row, 12].Value = loc.EndY;
                                ws.Cells[row, 13].Value = loc.PhysicalTarget;
                                ws.Cells[row, 14].Value = loc.StartStationLimit;
                                ws.Cells[row, 15].Value = loc.EndStationLimit;
                                ws.Cells[row, 16].Value = loc.EndChainage;
                                ws.Cells[row, 17].Value = loc.StartChainage;
                                ws.Cells[row, 18].Value = loc.Length;
                                ws.Cells[row, 19].Value = loc.CreatedBy;
                                ws.Cells[row, 20].Value = loc.CreatedDate;
                                ws.Cells[row, 20].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 21].Value = loc.UpdatedBy;
                                ws.Cells[row, 22].Value = loc.UpdatedDate;
                                ws.Cells[row, 22].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                row++;
                            }
                            int endRow = row - 1;
                            for (int r = startRow; r <= endRow; r++)
                            {
                                ws.Row(r).OutlineLevel = 1;
                            }
                        }
                    }
                    if (ws.Dimension != null)
                        ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                var bytes = package.GetAsByteArray();
                var fileName = $"{dto.ProgramId}_{dto.StageName}_Projects.xlsx";
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        #endregion
    }
}