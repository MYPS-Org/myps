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
    public class ReportingController : CoreController
    {
        public ReportingController(AppDbContext db, IProducer<Null, string> producer) : base(db, producer) { }
        #region AIP 
        
        [HttpPost]
        public async Task<IActionResult> GetAIPReportDropdowns()
        {
            try
            {
                var categories = await _db.tOptionProjectCategory
                    .AsNoTracking()
                    .ToListAsync();
                var regions = await _db.tOptionAdminAreaRegion
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == _Session.RegCode || !_Session.ApplyFilter)
                    .ToListAsync();
                if (regions == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Region Not Found",
                        Message = "No region found for the current user's session. Please contact the administrator."
                    });
                }

                var RegionIds = regions.Select(r => r.GdbId).ToList();
                var RegionParticipantIds = regions.Select(x => x.ParticipantId).ToList();
                var province = await _db.tOptionAdminAreaProvince
                    .AsNoTracking()
                    .Where(x => RegionIds.Contains(x.RegionParticipantId) || !_Session.ApplyFilter)
                    .ToListAsync();

                var ProvinceIds = province.Select(p => p.GdbId).ToList();
                var legislativeDistricts = await _db.tOptionAdminAreaCongressionalDistrict
                    .AsNoTracking()
                    .Where(x => ProvinceIds.Contains(x.ProvinceGdbId) || !_Session.ApplyFilter)
                    .ToListAsync();

                var deos = await _db.tOptionAdminAreaDistrictEngineeringOffice
                    .AsNoTracking()
                    .Where(x => RegionParticipantIds.Contains(x.RegionParticipantId) || !_Session.ApplyFilter)
                    .ToListAsync();

                var DEOParticipantIds = deos.Select(d => d.ParticipantId).ToList();
                var implementingOffices = await _db.vAdminImplementingOffice
                    .AsNoTracking()
                    .Where(x => (DEOParticipantIds.Contains(x.ParticipantId) || x.OrgType == "UPMO") || !_Session.ApplyFilter)
                    .ToListAsync();

                var ioIds = implementingOffices.Select(io => io.ParticipantId).ToList();
                var operatingUnits = await _db.vAdminOperatingUnit
                    .AsNoTracking()
                    .Where(x => ioIds.Contains(x.ParticipantId) || !_Session.ApplyFilter)
                    .ToListAsync();
                return new OkObjectResult(new
                {
                    Categories = categories,
                    Regions = regions,
                    OperatingUnits = operatingUnits,
                    DEOs = deos,
                    ImplementingOffices = implementingOffices,
                    LegislativeDistricts = legislativeDistricts
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP([FromBody] RequestReportAIPDTO dto)
        {
            try
            {
                var ProgramDetails = _db.vProgramDetails
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId && x.StageName == dto.StageName);

                if (_Session.ApplyFilter)
                {
                    ProgramDetails = ProgramDetails.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
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
        
        [HttpPost]
        public async Task<IActionResult> RequestReportAIP02([FromBody] RequestReportAIPDTO dto)
        {
            try
            {
                var ProgramDetails = _db.vProgramDetails
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId && x.StageName == dto.StageName);

                if (_Session.ApplyFilter)
                {
                    ProgramDetails = ProgramDetails.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
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
        
        [HttpPost]
        public async Task<IActionResult> GetRBPReportDropdowns()
        {
            try
            {
                var regions = await _db.tOptionAdminAreaRegion
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == _Session.RegCode || !_Session.ApplyFilter)
                    .ToListAsync();
                return new OkObjectResult(new
                {
                    Regions = regions
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> RequestReportRBPComponents([FromBody] RequestReportRBPComponentsDTO dto)
        {
            try
            {
                var ProgramDetails = _db.vPrograms
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId);

                if (_Session.ApplyFilter)
                {
                    ProgramDetails = ProgramDetails.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRBP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRBPComponents> RBP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRBPComponents>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                if (RBP.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RBP Components data found for the given parameters."
                    });
                }
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
        
        [HttpPost]
        public async Task<IActionResult> RequestReportRBP(RequestReportRBPDTO dto)
        {
            try
            {
                var ProgramDetails = _db.vPrograms
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId);

                if (_Session.ApplyFilter)
                {
                    ProgramDetails = ProgramDetails.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRBP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRBP> RBP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRBP>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                if (RBP.Count == 0) {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RBP data found for the given parameters."
                    });
                }
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
        
        [HttpPost]
        public async Task<IActionResult> RequestReportRBPTier(RequestReportRBPTierDTO dto)
        {
            try
            {
                var ProgramDetails = _db.vPrograms
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId);

                if (_Session.ApplyFilter)
                {
                    ProgramDetails = ProgramDetails.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRBP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRBP> RBP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRBP>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                if(RBP.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RBP data found for the given parameters."
                    });
                }
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
        
        [HttpPost]
        public async Task<IActionResult> GetRDIPReportDropdowns()
        {
            try
            {
                var regions = await _db.tOptionAdminAreaRegion
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == _Session.RegCode || !_Session.ApplyFilter)
                    .ToListAsync();
                return new OkObjectResult(new
                {
                    Regions = regions
                });
            }
            catch (Exception ex)
            {
                return ExceptionHandler(ex);
            }
        }
        
        [HttpPost]
        public async Task<IActionResult> RequestReportRDIP([FromBody] RequestReportRDIPDTO dto)
        {
            try
            {
                var ProgramDetails = _db.vPrograms
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId);

                if (_Session.ApplyFilter)
                {
                    ProgramDetails = ProgramDetails.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
                var param = new Dictionary<string, object> {
                    { "@ProgramId", dto.ProgramId }
                };
                if (!string.IsNullOrEmpty(dto.RegionName)) { param.Add("@RegionName", dto.RegionName); }
                string aipSql = "EXEC pGenerateRDIP " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRDIP> RDIP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRDIP>(
                    Appsetting.ConnectionString,
                    aipSql, param
                );
                if(RDIP.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RDIP data found for the given parameters."
                    });
                }
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

                // Component Cost Per Year sheet (flat)
                if (componentCosts.Count > 0)
                {
                    var ws = package.Workbook.Worksheets.Add("Component Cost Per Year");
                    var costPerYearLookup = componentCostPerYear
                        .GroupBy(cy => cy.ComponentCostId)
                        .ToDictionary(g => g.Key, g => g.ToList());

                    ws.Cells["A1"].Value = "Project ID";
                    ws.Cells["B1"].Value = "Description";
                    ws.Cells["C1"].Value = "Component Project ID";
                    ws.Cells["D1"].Value = "Component Type";
                    ws.Cells["E1"].Value = "Component ID";
                    ws.Cells["F1"].Value = "Total";
                    ws.Cells["G1"].Value = "Year";
                    ws.Cells["H1"].Value = "Amount";
                    ws.Cells["I1"].Value = "Start Date";
                    ws.Cells["J1"].Value = "End Date";
                    ws.Cells["K1"].Value = "Created By";
                    ws.Cells["L1"].Value = "Created Date";
                    ws.Cells["M1"].Value = "Updated By";
                    ws.Cells["N1"].Value = "Updated Date";

                    using (var headerRange = ws.Cells["A1:N1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(63, 159, 255));
                    }

                    int row = 2;
                    foreach (var cost in componentCosts)
                    {
                        if (costPerYearLookup.TryGetValue(cost.CostId, out var yearRows))
                        {
                            foreach (var yr in yearRows)
                            {
                                ws.Cells[row, 1].Value = cost.ProjectId;
                                ws.Cells[row, 2].Value = cost.Description;
                                ws.Cells[row, 3].Value = cost.CostId;
                                ws.Cells[row, 4].Value = cost.ComponentType;
                                ws.Cells[row, 5].Value = cost.ComponentId;
                                ws.Cells[row, 6].Value = cost.Total;
                                ws.Cells[row, 7].Value = yr.Year;
                                ws.Cells[row, 8].Value = yr.Amount;
                                ws.Cells[row, 9].Value = yr.StartDate;
                                ws.Cells[row, 9].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 10].Value = yr.EndDate;
                                ws.Cells[row, 10].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 11].Value = yr.CreatedBy;
                                ws.Cells[row, 12].Value = yr.CreatedDate;
                                ws.Cells[row, 12].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 13].Value = yr.UpdatedBy;
                                ws.Cells[row, 14].Value = yr.UpdatedDate;
                                ws.Cells[row, 14].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                row++;
                            }
                        }
                        else
                        {
                            ws.Cells[row, 1].Value = cost.ProjectId;
                            ws.Cells[row, 2].Value = cost.Description;
                            ws.Cells[row, 3].Value = cost.CostId;
                            ws.Cells[row, 4].Value = cost.ComponentType;
                            ws.Cells[row, 5].Value = cost.ComponentId;
                            ws.Cells[row, 6].Value = cost.Total;
                            ws.Cells[row, 11].Value = cost.CreatedBy;
                            ws.Cells[row, 12].Value = cost.CreatedDate;
                            ws.Cells[row, 12].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                            ws.Cells[row, 13].Value = cost.UpdatedBy;
                            ws.Cells[row, 14].Value = cost.UpdatedDate;
                            ws.Cells[row, 14].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                            row++;
                        }
                    }
                    if (ws.Dimension != null) ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                // Major Work Item Per Location sheet (flat)
                if (majorWorkItems.Count > 0)
                {
                    var ws = package.Workbook.Worksheets.Add("Major Work Item");
                    var locationLookup = majorWorkLocations
                        .GroupBy(l => l.ParentId)
                        .ToDictionary(g => g.Key, g => g.ToList());

                    ws.Cells["A1"].Value = "Project ID";
                    ws.Cells["B1"].Value = "Component Project ID";
                    ws.Cells["C1"].Value = "Component ID";
                    ws.Cells["D1"].Value = "Year of Work";
                    ws.Cells["E1"].Value = "Work Type";
                    ws.Cells["F1"].Value = "Infra Type";
                    ws.Cells["G1"].Value = "Infra ID";
                    ws.Cells["H1"].Value = "Detailed Scope";
                    ws.Cells["I1"].Value = "Target Unit";
                    ws.Cells["J1"].Value = "Start X";
                    ws.Cells["K1"].Value = "Start Y";
                    ws.Cells["L1"].Value = "End X";
                    ws.Cells["M1"].Value = "End Y";
                    ws.Cells["N1"].Value = "Physical Target";
                    ws.Cells["O1"].Value = "Start Station Limit";
                    ws.Cells["P1"].Value = "End Station Limit";
                    ws.Cells["Q1"].Value = "End Chainage";
                    ws.Cells["R1"].Value = "Start Chainage";
                    ws.Cells["S1"].Value = "Length";
                    ws.Cells["T1"].Value = "Created By";
                    ws.Cells["U1"].Value = "Created Date";
                    ws.Cells["V1"].Value = "Updated By";
                    ws.Cells["W1"].Value = "Updated Date";

                    using (var headerRange = ws.Cells["A1:W1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(63, 159, 255));
                    }

                    int row = 2;
                    foreach (var wi in majorWorkItems)
                    {
                        if (locationLookup.TryGetValue(wi.ReferenceId, out var locRows))
                        {
                            foreach (var loc in locRows)
                            {
                                ws.Cells[row, 1].Value = wi.ProjectId;
                                ws.Cells[row, 2].Value = wi.ReferenceId;
                                ws.Cells[row, 3].Value = wi.ComponentId;
                                ws.Cells[row, 4].Value = wi.YearOfWork;
                                ws.Cells[row, 5].Value = wi.WorkTypeId;
                                ws.Cells[row, 6].Value = wi.InfraType;
                                ws.Cells[row, 7].Value = loc.InfraId;
                                ws.Cells[row, 8].Value = loc.DetailedScope;
                                ws.Cells[row, 9].Value = loc.TargetUnit;
                                ws.Cells[row, 10].Value = loc.StartX;
                                ws.Cells[row, 11].Value = loc.StartY;
                                ws.Cells[row, 12].Value = loc.EndX;
                                ws.Cells[row, 13].Value = loc.EndY;
                                ws.Cells[row, 14].Value = loc.PhysicalTarget;
                                ws.Cells[row, 15].Value = loc.StartStationLimit;
                                ws.Cells[row, 16].Value = loc.EndStationLimit;
                                ws.Cells[row, 17].Value = loc.EndChainage;
                                ws.Cells[row, 18].Value = loc.StartChainage;
                                ws.Cells[row, 19].Value = loc.Length;
                                ws.Cells[row, 20].Value = loc.CreatedBy;
                                ws.Cells[row, 21].Value = loc.CreatedDate;
                                ws.Cells[row, 21].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                ws.Cells[row, 22].Value = loc.UpdatedBy;
                                ws.Cells[row, 23].Value = loc.UpdatedDate;
                                ws.Cells[row, 23].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                                row++;
                            }
                        }
                        else
                        {
                            ws.Cells[row, 1].Value = wi.ProjectId;
                            ws.Cells[row, 2].Value = wi.ReferenceId;
                            ws.Cells[row, 3].Value = wi.ComponentId;
                            ws.Cells[row, 4].Value = wi.YearOfWork;
                            ws.Cells[row, 5].Value = wi.WorkTypeId;
                            ws.Cells[row, 6].Value = wi.InfraType;
                            ws.Cells[row, 20].Value = wi.CreatedBy;
                            ws.Cells[row, 21].Value = wi.CreatedDate;
                            ws.Cells[row, 21].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                            ws.Cells[row, 22].Value = wi.UpdatedBy;
                            ws.Cells[row, 23].Value = wi.UpdatedDate;
                            ws.Cells[row, 23].Style.Numberformat.Format = "mmm-dd-yyyy hh:ss AM/PM";
                            row++;
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