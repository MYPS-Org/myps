using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Extra;
using DBHelper.Models.Procedures;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views;
using Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.Extensions.Hosting;
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
        public ReportingController(MYPSDbContext db, IHubContext<MicroService.SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        private static string GetStageFullName(string? stageName) => stageName?.ToUpperInvariant() switch
        {
            "BP" => "Budget Proposal",
            "NEP" or "NEP-E" => "National Expenditure Program",
            "HGAB" or "HGAB-I" => "House General Appropriations Bill",
            "GAA" or "GAA-R" => "General Appropriations Act",
            "TF" or "TF-R" => "Trust Fund",
            _ => stageName ?? ""
        };

        #region AIP 

        [HttpPost]
        public async Task<IActionResult> GetAIPReportDropdowns(CancellationToken cancellationToken)
        {
            try
            {
                var categories = await _db.tOptionProjectCategory
                    .AsNoTracking()
                    .OrderBy(x => x.CategoryName)
                    .ToListAsync(cancellationToken);
                var regions = await _db.tOptionAdminAreaRegion
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == _Session.RegCode || !_Session.ApplyFilter)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);
                if (regions == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "Region Not Found",
                        Message = "No region found for the current user's session. Please contact the administrator."
                    });
                }

                var RegionIds = regions.Select(r => r.ParticipantId).ToList();
                var RegionParticipantIds = regions.Select(x => x.ParticipantId).ToList();
                var province = await _db.tOptionAdminAreaProvince
                    .AsNoTracking()
                    .Where(x => RegionIds.Contains(x.RegionParticipantId) || !_Session.ApplyFilter)
                    .ToListAsync(cancellationToken);

                var ProvinceIds = province.Select(p => p.Code).ToList();
                var legislativeDistricts = await _db.tOptionAdminAreaCongressionalDistrict
                    .AsNoTracking()
                    .Where(x => ProvinceIds.Contains(x.ProvinceCode) || !_Session.ApplyFilter)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);

                var deos = await _db.vAdminDEO
                    .AsNoTracking()
                    .Where(x => RegionParticipantIds.Contains(x.RegionParticipantId) || !_Session.ApplyFilter)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);

                var DEOParticipantIds = deos.Select(d => d.ParticipantId).ToList();
                var implementingOffices = await _db.vAdminImplementingOffice
                    .AsNoTracking()
                    .Where(x => (DEOParticipantIds.Contains(x.ParticipantId) || x.OrgType == "UPMO") || !_Session.ApplyFilter)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);

                var ioIds = implementingOffices.Select(io => io.ParticipantId).ToList();
                var operatingUnits = await _db.vAdminOperatingUnit
                    .AsNoTracking()
                    .Where(x => ioIds.Contains(x.ParticipantId) || !_Session.ApplyFilter)
                    .OrderBy(x => x.Name)
                    .ToListAsync(cancellationToken);
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
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> RequestReportAIP([FromBody] RequestReportAIPDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-800_07152024_143901";
                //dto.StageName = "GAA-R";
                //dto.CategoryName = "OO1: Ensure Safe and Reliable National Road System";
                //dto.RegionName = "Region I";
                //dto.DistrictEngineeringOffice = "Ilocos Norte 1st District Engineering Office";
                //dto.ImplementingOfficeName = "";
                //dto.OperatingUnitName = "";
                //dto.LegislativeDistrictName = "";

                var programDetailsQuery = _db.fProgramStages
                .AsNoTracking()
                .Where(x => x.ProgramId == dto.ProgramId && x.StageName == dto.StageName);

                if (_Session.ApplyFilter)
                {
                    programDetailsQuery = programDetailsQuery.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
                var ProgramDetails = await programDetailsQuery.FirstOrDefaultAsync();
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
                    Appsetting.DbConnections.MYPSDb,
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
                    Appsetting.DbConnections.MYPSDb,
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

                var bytes = AIP.GenerateReport(aip, aipcomponents,
                    year: ProgramDetails?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramDetails?.StageName));

                var fileName = $"AIP_Report.pdf";
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> RequestReportAIPOfficial([FromBody] RequestReportAIPDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-800_07152024_143901";
                //dto.StageName = "GAA-R";
                //dto.CategoryName = "OO1: Ensure Safe and Reliable National Road System";
                //dto.RegionName = "Region I";
                //dto.DistrictEngineeringOffice = "Ilocos Norte 1st District Engineering Office";
                //dto.ImplementingOfficeName = "";
                //dto.OperatingUnitName = "";
                //dto.LegislativeDistrictName = "";
                var programDetailsQuery = _db.fProgramStages
                    .AsNoTracking()
                    .Where(x => x.ProgramId == dto.ProgramId && x.StageName == dto.StageName);

                if (_Session.ApplyFilter)
                {
                    programDetailsQuery = programDetailsQuery.Where(x => x.DataSecurityGroup.Contains(_Session.RegCode));
                    var Region = await _db.tOptionAdminAreaRegion.FirstOrDefaultAsync(x => _Session.RegCode == x.ParticipantId);
                    dto.RegionName = dto.RegionName ?? Region?.Name;
                }
                var ProgramDetails = await programDetailsQuery.FirstOrDefaultAsync();
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
                    Appsetting.DbConnections.MYPSDb,
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
                    Appsetting.DbConnections.MYPSDb,
                    "EXEC pGenerateAIPComponents " +
                    "@ProgramId = @ProgramId, " +
                    "@StageName = @StageName", param2
                );

                var bytes = AIPOfficial.GenerateReport(aip, aipcomponents,
                    year: ProgramDetails?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramDetails?.StageName));

                var fileName = $"AIPOfficial_Report.pdf";
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> RequestReportAIP02([FromBody] RequestReportAIPDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-800_07152024_143901";
                //dto.StageName = "GAA-R";
                //dto.CategoryName = "OO1: Ensure Safe and Reliable National Road System";
                //dto.RegionName = "Region I";
                //dto.DistrictEngineeringOffice = "Ilocos Norte 1st District Engineering Office";
                //dto.ImplementingOfficeName = "";
                //dto.OperatingUnitName = "";
                //dto.LegislativeDistrictName = "";
                var ProgramDetails = _db.fProgramStages
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
                    Appsetting.DbConnections.MYPSDb,
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
                    Appsetting.DbConnections.MYPSDb,
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

                var ProgramData = await ProgramDetails.FirstOrDefaultAsync();
                var bytes = AIP02.GenerateReport(aip, aipcomponents,
                    year: ProgramData?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramData?.StageName));

                var fileName = $"AIP_Report02.pdf";
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region RBPComponents

        [HttpPost]
        public async Task<IActionResult> GetRBPReportDropdowns(CancellationToken cancellationToken)
        {
            try
            {
                var regions = await _db.tOptionAdminAreaRegion
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == _Session.RegCode || !_Session.ApplyFilter)
                    .ToListAsync(cancellationToken);
                return new OkObjectResult(new
                {
                    Regions = regions
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> RequestReportRBPComponents([FromBody] RequestReportRBPComponentsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-634_02172025_093955";
                //dto.RegionName = "Region I";
                var ProgramDetails = _db.vProgramLatest
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
                string aipSql = "EXEC pGenerateRBPComponents " + string.Join(", ", param.Keys.Select(k => $"{k} = {k}"));
                List<DBHelper.Models.Procedures.GenerateRBPComponents> RBP = Sql.NormalQuery<DBHelper.Models.Procedures.GenerateRBPComponents>(
                    Appsetting.DbConnections.MYPSDb,
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
                var ProgramData = await ProgramDetails.FirstOrDefaultAsync();
                var bytes = RBPComponents.GenerateReport(RBP,
                    year: ProgramData?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramData?.StageName));

                var fileName = $"RBPComponents_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region RBPTier

        [HttpPost]
        public async Task<IActionResult> RequestReportRBPTier(RequestReportRBPDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-634_02172025_093955";
                //dto.RegionName = "Region I";
                var ProgramDetails = _db.vProgramLatest
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
                    Appsetting.DbConnections.MYPSDb,
                    aipSql, param
                );
                if (RBP.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RBP data found for the given parameters."
                    });
                }
                var ProgramData = await ProgramDetails.FirstOrDefaultAsync();
                var bytes = GenerateRBPTier.GenerateReport(RBP,
                    year: ProgramData?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramData?.StageName));

                var fileName = $"RBPTier_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region RBP

        [HttpPost]
        public async Task<IActionResult> RequestReportRBP(RequestReportRBPTierDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-634_02172025_093955";
                //dto.RegionName = "Region I";
                var ProgramDetails = _db.vProgramLatest
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
                    Appsetting.DbConnections.MYPSDb,
                    aipSql, param
                );
                if (RBP.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RBP data found for the given parameters."
                    });
                }
                var ProgramData = await ProgramDetails.FirstOrDefaultAsync();
                var bytes = ReportGeneration.GenerateRBP.GenerateReport(RBP,
                    year: ProgramData?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramData?.StageName));

                var fileName = $"RBP_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region RDIP

        [HttpPost]
        public async Task<IActionResult> GetRDIPReportDropdowns(CancellationToken cancellationToken)
        {
            try
            {
                var regions = await _db.tOptionAdminAreaRegion
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == _Session.RegCode || !_Session.ApplyFilter)
                    .ToListAsync(cancellationToken);
                return new OkObjectResult(new
                {
                    Regions = regions
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        [HttpPost]
        public async Task<IActionResult> RequestReportRDIP([FromBody] RequestReportRDIPDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                //dto.ProgramId = "P_CO-PS-546_12172019_135556";
                //dto.RegionName = "Region I";
                var ProgramDetails = _db.vProgramLatest
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
                    Appsetting.DbConnections.MYPSDb,
                    aipSql, param
                );
                if (RDIP.Count == 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Title = "No Data Found",
                        Message = "No RDIP data found for the given parameters."
                    });
                }
                var ProgramData = await ProgramDetails.FirstOrDefaultAsync();
                var bytes = ReportGeneration.GenerateRDIP.GenerateReport(RDIP,
                    year: ProgramData?.StartYear ?? 0,
                    stageName: GetStageFullName(ProgramData?.StageName));

                var fileName = $"RDIP_Report.pdf";
                System.IO.File.WriteAllBytes(fileName, bytes);
                return File(bytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion

        #region Export Raw Projects
        [AllowAnonymous]
        [HttpPost]
        public async Task<IActionResult> RequestRawProjects([FromBody] RequestRawProjectsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var stageName = dto.StageName.Replace("-", "");

                if (!Enum.TryParse<EnumProgramStage>(
                        stageName,
                        true,
                        out var SelectedStage))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Invalid program stage '{dto.StageName}'.",
                        Title = "Invalid Program Stage"
                    });
                }
                // Numeric value
                int selectedStageValue = (int)SelectedStage;

                var stages = await _db.fProgramProjects.FromSqlInterpolated($"SELECT * FROM fProgramProjects({dto.ProgramId}, {selectedStageValue})").AsNoTracking().ToListAsync(cancellationToken);

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
                    Appsetting.DbConnections.MYPSDb,
                    aipSql, param
                );
                var projectIds = rawProjects.Select(p => p.Id).ToList();

                var fundingProfiles = await _db.tProjectFundingProfile
                    .AsNoTracking()
                    .Where(f => projectIds.Contains(f.ProjectRevisionFK) && !f.IsDeleted)
                    .ToListAsync(cancellationToken);

                var componentCosts = await _db.tProjectComponentCost
                    .AsNoTracking()
                    .Where(c => projectIds.Contains(c.ProjectRevisionFK) && !c.IsDeleted)
                    .ToListAsync(cancellationToken);

                var costIds = componentCosts.Select(c => c.Id).ToList();

                var componentCostPerYear = await _db.tProjectComponentCostPerYear
                    .AsNoTracking()
                    .Where(cy => costIds.Contains(cy.ComponentCostFK) && !cy.IsDeleted)
                    .ToListAsync(cancellationToken);

                //pExportRawProjectsMajorItems


                var WorkItemParams = new Dictionary<string, object> {
                    { "@ProjectIds", string.Join(",",projectIds) },
                    { "@StageName", dto.StageName }
                };
                string WorkItemSql = "EXEC pExportRawProjectsMajorItems " + string.Join(", ", WorkItemParams.Keys.Select(k => $"{k} = {k}"));
                List<ProjectMajorWorkItem> majorWorkItems = Sql.NormalQuery<ProjectMajorWorkItem>(
                    Appsetting.DbConnections.MYPSDb,
                    WorkItemSql, WorkItemParams
                );


                var majorWorkReferenceIds = majorWorkItems.Select(m => m.Id).ToList();

                var majorWorkLocations = await _db.tProjectMajorWorkLocations
                    .AsNoTracking()
                    .Where(l => majorWorkReferenceIds.Contains(l.WorkItemFK) && !l.IsDeleted)
                    .ToListAsync(cancellationToken);

                ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
                using var package = new ExcelPackage();

                // Project sheet
                {
                    var ws = package.Workbook.Worksheets.Add("Project Details");
                    // ============================================================
                    // HEADERS
                    // ============================================================

                    ws.Cells["A1"].Value = "ProgramId";
                    ws.Cells["B1"].Value = "ProgramFK";
                    ws.Cells["C1"].Value = "ProjectId";
                    ws.Cells["D1"].Value = "ProjectPK";
                    ws.Cells["E1"].Value = "AlternateId";
                    ws.Cells["F1"].Value = "ExternalId";
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
                    ws.Cells["AG1"].Value = "Is Publishable";
                    ws.Cells["AH1"].Value = "Published To PCMA";
                    ws.Cells["AI1"].Value = "CreatedBy";
                    ws.Cells["AJ1"].Value = "CreatedDate";


                    // ============================================================
                    // HEADER STYLE
                    // ============================================================

                    using (var headerRange = ws.Cells["A1:AJ1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(
                            Color.FromArgb(63, 159, 255));
                    }


                    // ============================================================
                    // DATA
                    // ============================================================

                    for (int i = 0; i < rawProjects.Count; i++)
                    {
                        var item = rawProjects[i];
                        var row = i + 2;

                        ws.Cells[row, 1].Value = item.ProgramId;
                        ws.Cells[row, 2].Value = item.ProgramFK;
                        ws.Cells[row, 3].Value = item.ProjectId;
                        ws.Cells[row, 4].Value = item.ProjectPK;
                        ws.Cells[row, 5].Value = item.AlternateId;
                        ws.Cells[row, 6].Value = item.ExternalId;


                        // ========================================================
                        // MYId
                        // Keep as text
                        // ========================================================

                        ws.Cells[row, 7].Value = item.MYId;
                        ws.Cells[row, 7].Style.Numberformat.Format = "@";


                        // ========================================================
                        // MYCA Approval Date
                        // ========================================================

                        ws.Cells[row, 8].Value = item.MYCAApprovalDate;
                        ws.Cells[row, 8].Style.Numberformat.Format =
                            "mmm-dd-yyyy hh:mm AM/PM";


                        ws.Cells[row, 9].Value = item.Description;
                        ws.Cells[row, 10].Value = item.Category;
                        ws.Cells[row, 11].Value = item.Thrust;
                        ws.Cells[row, 12].Value = item.Origin;
                        ws.Cells[row, 13].Value = item.City;
                        ws.Cells[row, 14].Value = item.Province;
                        ws.Cells[row, 15].Value = item.LegislativeDistrict;
                        ws.Cells[row, 16].Value = item.OperatingUnit;
                        ws.Cells[row, 17].Value = item.ImplementingOffice;
                        ws.Cells[row, 18].Value = item.DEO;
                        ws.Cells[row, 19].Value = item.Region;
                        ws.Cells[row, 20].Value = item.Agency;
                        ws.Cells[row, 21].Value = item.IslandCode;
                        ws.Cells[row, 22].Value = item.ImplementationMode;
                        ws.Cells[row, 23].Value = item.EmergencyMode;
                        ws.Cells[row, 24].Value = item.Feasibility;


                        // ========================================================
                        // Feasibility Date
                        // ========================================================

                        ws.Cells[row, 25].Value = item.FeasibilityDate;
                        ws.Cells[row, 25].Style.Numberformat.Format =
                            "mmm-dd-yyyy hh:mm AM/PM";


                        ws.Cells[row, 26].Value = item.DetailedDesign;


                        // ========================================================
                        // Detailed Design Date
                        // ========================================================

                        ws.Cells[row, 27].Value = item.DetailedDesignDate;
                        ws.Cells[row, 27].Style.Numberformat.Format =
                            "mmm-dd-yyyy hh:mm AM/PM";


                        ws.Cells[row, 28].Value = item.RowAvailable;
                        ws.Cells[row, 29].Value = item.RegionWide;
                        ws.Cells[row, 30].Value = item.Tier;
                        ws.Cells[row, 31].Value = item.Rank;
                        ws.Cells[row, 32].Value = item.IsRevised;
                        ws.Cells[row, 33].Value = item.IsPublishable;
                        ws.Cells[row, 34].Value = item.IsPublished;
                        ws.Cells[row, 35].Value = item.CreatedBy;


                        // ========================================================
                        // Created Date
                        // ========================================================

                        ws.Cells[row, 36].Value = item.CreatedDate;
                        ws.Cells[row, 36].Style.Numberformat.Format =
                            "mmm-dd-yyyy hh:mm AM/PM";
                    }
                    //ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                // Funding Profile sheet
                {
                    var ws = package.Workbook.Worksheets.Add("Funding Profile");
                    // ============================================================
                    // HEADERS
                    // ============================================================

                    ws.Cells["A1"].Value = "ProjectId";
                    ws.Cells["B1"].Value = "ProjectRevisionFK";
                    ws.Cells["C1"].Value = "Source";
                    ws.Cells["D1"].Value = "Agreement";
                    ws.Cells["E1"].Value = "Amount";
                    ws.Cells["F1"].Value = "Percentage";
                    ws.Cells["G1"].Value = "IsWalletDraw";
                    ws.Cells["H1"].Value = "CreatedBy";
                    ws.Cells["I1"].Value = "CreatedDate";
                    ws.Cells["J1"].Value = "UpdatedBy";
                    ws.Cells["K1"].Value = "UpdatedDate";


                    // ============================================================
                    // HEADER STYLE
                    // ============================================================

                    using (var headerRange = ws.Cells["A1:K1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(
                            Color.FromArgb(63, 159, 255));
                    }


                    // ============================================================
                    // DATA
                    // ============================================================

                    for (int i = 0; i < fundingProfiles.Count; i++)
                    {
                        var item = fundingProfiles[i];
                        var row = i + 2;

                        var parentProject = rawProjects
                            .Find(x => x.Id == item.ProjectRevisionFK);

                        ws.Cells[row, 1].Value = parentProject?.ProjectId;
                        ws.Cells[row, 2].Value = item.ProjectRevisionFK;
                        ws.Cells[row, 3].Value = item.SourceOrg;
                        ws.Cells[row, 4].Value = item.AgreementCode;
                        ws.Cells[row, 5].Value = item.Amount;
                        ws.Cells[row, 6].Value = item.Percentage;
                        ws.Cells[row, 7].Value = item.IsWalletDraw;
                        ws.Cells[row, 8].Value = item.CreatedBy;

                        ws.Cells[row, 9].Value = item.CreatedDate;
                        ws.Cells[row, 9].Style.Numberformat.Format =
                            "mmm-dd-yyyy hh:mm AM/PM";

                        ws.Cells[row, 10].Value = item.UpdatedBy;

                        ws.Cells[row, 11].Value = item.UpdatedDate;
                        ws.Cells[row, 11].Style.Numberformat.Format =
                            "mmm-dd-yyyy hh:mm AM/PM";
                    }
                }

                // Component Costs sheet (flat: one row per ComponentCost × CostPerYear)
                {
                    var ws = package.Workbook.Worksheets.Add("Component Costs");
                    var costPerYearLookup = componentCostPerYear
                        .GroupBy(cy => cy.ComponentCostFK)
                        .ToDictionary(g => g.Key, g => g.ToList());
                    // ============================================================
                    // HEADERS
                    // ============================================================

                    ws.Cells["A1"].Value = "Cost Per Year ID";
                    ws.Cells["B1"].Value = "Component Cost FK";
                    ws.Cells["C1"].Value = "Project ID";
                    ws.Cells["D1"].Value = "Project Revision FK";
                    ws.Cells["E1"].Value = "Description";
                    ws.Cells["F1"].Value = "Component Cost ID";
                    ws.Cells["G1"].Value = "Component Type";
                    ws.Cells["H1"].Value = "Component ID";
                    ws.Cells["I1"].Value = "Total";
                    ws.Cells["J1"].Value = "Year";
                    ws.Cells["K1"].Value = "UACS";
                    ws.Cells["L1"].Value = "Amount";
                    ws.Cells["M1"].Value = "Start Date";
                    ws.Cells["N1"].Value = "End Date";
                    ws.Cells["O1"].Value = "Created By";
                    ws.Cells["P1"].Value = "Created Date";
                    ws.Cells["Q1"].Value = "Updated By";
                    ws.Cells["R1"].Value = "Updated Date";

                    using (var headerRange = ws.Cells["A1:R1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(
                            Color.FromArgb(63, 159, 255));
                    }


                    // ============================================================
                    // DATA
                    // ============================================================

                    int row = 2;

                    foreach (var cost in componentCosts)
                    {
                        var parentProject = rawProjects
                            .Find(x => x.Id == cost.ProjectRevisionFK);

                        // ========================================================
                        // HAS COST PER YEAR
                        // ========================================================

                        if (costPerYearLookup.TryGetValue(
                                cost.Id,
                                out var yearRows) &&
                            yearRows.Count > 0)
                        {
                            foreach (var yr in yearRows)
                            {
                                ws.Cells[row, 1].Value = yr.Id;
                                ws.Cells[row, 2].Value = yr.ComponentCostFK;

                                ws.Cells[row, 3].Value = parentProject?.ProjectId;
                                ws.Cells[row, 4].Value = cost.ProjectRevisionFK;

                                ws.Cells[row, 5].Value = cost.Description;
                                ws.Cells[row, 6].Value = cost.Id;
                                ws.Cells[row, 7].Value = cost.ComponentType;
                                ws.Cells[row, 8].Value = cost.ComponentId;
                                ws.Cells[row, 9].Value = cost.Total;

                                ws.Cells[row, 10].Value = yr.Year;

                                ws.Cells[row, 11].Value = yr.UACS;
                                ws.Cells[row, 11].Style.Numberformat.Format = "@";

                                ws.Cells[row, 12].Value = yr.Amount;

                                ws.Cells[row, 13].Value = yr.StartDate;
                                ws.Cells[row, 13].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";

                                ws.Cells[row, 14].Value = yr.EndDate;
                                ws.Cells[row, 14].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";

                                ws.Cells[row, 15].Value = yr.CreatedBy;

                                ws.Cells[row, 16].Value = yr.CreatedDate;
                                ws.Cells[row, 16].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";

                                ws.Cells[row, 17].Value = yr.UpdatedBy;

                                ws.Cells[row, 18].Value = yr.UpdatedDate;
                                ws.Cells[row, 18].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";

                                row++;
                            }
                        }

                        // ========================================================
                        // NO COST PER YEAR
                        //
                        // SAME EXACT COLUMN ALIGNMENT.
                        // Only Cost Per Year-specific values are blank.
                        // ========================================================

                        else
                        {
                            // No Cost Per Year row exists.
                            ws.Cells[row, 1].Value = null; // Cost Per Year ID
                            ws.Cells[row, 2].Value = null; // Component Cost FK from Cost Per Year

                            // Project
                            ws.Cells[row, 3].Value = parentProject?.ProjectId;
                            ws.Cells[row, 4].Value = cost.ProjectRevisionFK;

                            // Component Cost
                            ws.Cells[row, 5].Value = cost.Description;
                            ws.Cells[row, 6].Value = cost.Id;
                            ws.Cells[row, 7].Value = cost.ComponentType;
                            ws.Cells[row, 8].Value = cost.ComponentId;
                            ws.Cells[row, 9].Value = cost.Total;

                            // No Cost Per Year data.
                            ws.Cells[row, 10].Value = null; // Year
                            ws.Cells[row, 11].Value = null; // UACS
                            ws.Cells[row, 12].Value = null; // Amount
                            ws.Cells[row, 13].Value = null; // Start Date
                            ws.Cells[row, 14].Value = null; // End Date

                            // Since there is no Cost Per Year row,
                            // use the Component Cost audit fields.
                            ws.Cells[row, 15].Value = cost.CreatedBy;

                            ws.Cells[row, 16].Value = cost.CreatedDate;
                            ws.Cells[row, 16].Style.Numberformat.Format =
                                "mmm-dd-yyyy hh:mm AM/PM";

                            ws.Cells[row, 17].Value = cost.UpdatedBy;

                            ws.Cells[row, 18].Value = cost.UpdatedDate;
                            ws.Cells[row, 18].Style.Numberformat.Format =
                                "mmm-dd-yyyy hh:mm AM/PM";

                            row++;
                        }
                    }
                    if (ws.Dimension != null) ws.Cells[ws.Dimension.Address].AutoFitColumns();
                }

                // Major Work Items sheet (flat: one row per WorkItem × Location)
                {
                    var ws = package.Workbook.Worksheets.Add("Major Work Items");
                    var locationLookup = majorWorkLocations
                        .GroupBy(l => l.WorkItemFK)
                        .ToDictionary(g => g.Key, g => g.ToList());
                    // ============================================================
                    // HEADERS
                    // ============================================================

                    ws.Cells["A1"].Value = "Location ID";
                    ws.Cells["B1"].Value = "Work Item FK";
                    ws.Cells["C1"].Value = "Component Cost FK";
                    ws.Cells["D1"].Value = "Project ID";
                    ws.Cells["E1"].Value = "Year of Work";
                    ws.Cells["F1"].Value = "Work Type FK";
                    ws.Cells["G1"].Value = "Component ID";
                    ws.Cells["H1"].Value = "Infra Type FK";
                    ws.Cells["I1"].Value = "Infra ID";
                    ws.Cells["J1"].Value = "Detailed Scope";
                    ws.Cells["K1"].Value = "Target Unit ID";
                    ws.Cells["L1"].Value = "Target Unit";
                    ws.Cells["M1"].Value = "Start X";
                    ws.Cells["N1"].Value = "Start Y";
                    ws.Cells["O1"].Value = "End X";
                    ws.Cells["P1"].Value = "End Y";
                    ws.Cells["Q1"].Value = "Physical Target";
                    ws.Cells["R1"].Value = "Start Station Limit";
                    ws.Cells["S1"].Value = "End Station Limit";
                    ws.Cells["T1"].Value = "Start Chainage";
                    ws.Cells["U1"].Value = "End Chainage";
                    ws.Cells["V1"].Value = "Length";

                    ws.Cells["W1"].Value = "Work Item Created By";
                    ws.Cells["X1"].Value = "Work Item Created Date";
                    ws.Cells["Y1"].Value = "Work Item Updated By";
                    ws.Cells["Z1"].Value = "Work Item Updated Date";

                    ws.Cells["AA1"].Value = "Location Created By";
                    ws.Cells["AB1"].Value = "Location Created Date";
                    ws.Cells["AC1"].Value = "Location Updated By";
                    ws.Cells["AD1"].Value = "Location Updated Date";


                    // ============================================================
                    // HEADER STYLE
                    // ============================================================

                    using (var headerRange = ws.Cells["A1:AD1"])
                    {
                        headerRange.Style.Fill.PatternType = ExcelFillStyle.Solid;
                        headerRange.Style.Fill.BackgroundColor.SetColor(
                            Color.FromArgb(63, 159, 255));
                    }


                    // ============================================================
                    // DATA
                    // ============================================================

                    int row = 2;

                    foreach (var wi in majorWorkItems)
                    {
                        var parentComponent = componentCosts
                            .Find(x => x.Id == wi.ComponentCostFK);

                        var parentProject = parentComponent != null
                            ? rawProjects.Find(x => x.Id == parentComponent.ProjectRevisionFK)
                            : null;


                        // ========================================================
                        // HAS LOCATION
                        // ========================================================

                        if (locationLookup.TryGetValue(
                                wi.ComponentCostFK,
                                out var locRows) &&
                            locRows.Count > 0)
                        {
                            foreach (var loc in locRows)
                            {
                                // =================================================
                                // IDS / REFERENCES
                                // =================================================

                                ws.Cells[row, 1].Value = loc.Id;

                                ws.Cells[row, 2].Value = loc.WorkItemFK;

                                ws.Cells[row, 3].Value = wi.ComponentCostFK;

                                ws.Cells[row, 4].Value = parentProject?.ProjectId;


                                // =================================================
                                // WORK ITEM
                                // =================================================

                                ws.Cells[row, 5].Value = wi.YearOfWork;

                                ws.Cells[row, 6].Value = wi.WorkTypeFK;

                                ws.Cells[row, 7].Value = wi.ComponentId;

                                ws.Cells[row, 8].Value = wi.InfraTypeFK;


                                // =================================================
                                // LOCATION
                                // =================================================

                                ws.Cells[row, 9].Value = loc.InfraId;

                                ws.Cells[row, 10].Value = loc.DetailedScope;

                                ws.Cells[row, 11].Value = loc.TargetUnitId;

                                ws.Cells[row, 12].Value = loc.TargetUnit;

                                ws.Cells[row, 13].Value = loc.StartX;

                                ws.Cells[row, 14].Value = loc.StartY;

                                ws.Cells[row, 15].Value = loc.EndX;

                                ws.Cells[row, 16].Value = loc.EndY;

                                ws.Cells[row, 17].Value = loc.PhysicalTarget;

                                ws.Cells[row, 18].Value = loc.StartStationLimit;

                                ws.Cells[row, 19].Value = loc.EndStationLimit;

                                ws.Cells[row, 20].Value = loc.StartChainage;

                                ws.Cells[row, 21].Value = loc.EndChainage;

                                ws.Cells[row, 22].Value = loc.Length;


                                // =================================================
                                // WORK ITEM AUDIT
                                // =================================================

                                ws.Cells[row, 23].Value = wi.CreatedBy;

                                ws.Cells[row, 24].Value = wi.CreatedDate;
                                ws.Cells[row, 24].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";

                                ws.Cells[row, 25].Value = wi.UpdatedBy;

                                ws.Cells[row, 26].Value = wi.UpdatedDate;
                                ws.Cells[row, 26].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";


                                // =================================================
                                // LOCATION AUDIT
                                // =================================================

                                ws.Cells[row, 27].Value = loc.CreatedBy;

                                ws.Cells[row, 28].Value = loc.CreatedDate;
                                ws.Cells[row, 28].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";

                                ws.Cells[row, 29].Value = loc.UpdatedBy;

                                ws.Cells[row, 30].Value = loc.UpdatedDate;
                                ws.Cells[row, 30].Style.Numberformat.Format =
                                    "mmm-dd-yyyy hh:mm AM/PM";


                                row++;
                            }
                        }


                        // ========================================================
                        // NO LOCATION
                        //
                        // SAME EXACT COLUMN ALIGNMENT AS ABOVE
                        // ========================================================

                        else
                        {
                            // =====================================================
                            // IDS / REFERENCES
                            // =====================================================

                            ws.Cells[row, 1].Value = null;
                            // Location ID

                            ws.Cells[row, 2].Value = null;
                            // WorkItemFK belongs to Location

                            ws.Cells[row, 3].Value = wi.ComponentCostFK;

                            ws.Cells[row, 4].Value = parentProject?.ProjectId;


                            // =====================================================
                            // WORK ITEM
                            // =====================================================

                            ws.Cells[row, 5].Value = wi.YearOfWork;

                            ws.Cells[row, 6].Value = wi.WorkTypeFK;

                            ws.Cells[row, 7].Value = wi.ComponentId;

                            ws.Cells[row, 8].Value = wi.InfraTypeFK;


                            // =====================================================
                            // NO LOCATION DATA
                            // =====================================================

                            ws.Cells[row, 9].Value = null;
                            // Infra ID

                            ws.Cells[row, 10].Value = null;
                            // Detailed Scope

                            ws.Cells[row, 11].Value = null;
                            // Target Unit ID

                            ws.Cells[row, 12].Value = null;
                            // Target Unit

                            ws.Cells[row, 13].Value = null;
                            // Start X

                            ws.Cells[row, 14].Value = null;
                            // Start Y

                            ws.Cells[row, 15].Value = null;
                            // End X

                            ws.Cells[row, 16].Value = null;
                            // End Y

                            ws.Cells[row, 17].Value = null;
                            // Physical Target

                            ws.Cells[row, 18].Value = null;
                            // Start Station Limit

                            ws.Cells[row, 19].Value = null;
                            // End Station Limit

                            ws.Cells[row, 20].Value = null;
                            // Start Chainage

                            ws.Cells[row, 21].Value = null;
                            // End Chainage

                            ws.Cells[row, 22].Value = null;
                            // Length


                            // =====================================================
                            // WORK ITEM AUDIT
                            // =====================================================

                            ws.Cells[row, 23].Value = wi.CreatedBy;

                            ws.Cells[row, 24].Value = wi.CreatedDate;
                            ws.Cells[row, 24].Style.Numberformat.Format =
                                "mmm-dd-yyyy hh:mm AM/PM";

                            ws.Cells[row, 25].Value = wi.UpdatedBy;

                            ws.Cells[row, 26].Value = wi.UpdatedDate;
                            ws.Cells[row, 26].Style.Numberformat.Format =
                                "mmm-dd-yyyy hh:mm AM/PM";


                            // =====================================================
                            // NO LOCATION AUDIT
                            // =====================================================

                            ws.Cells[row, 27].Value = null;
                            // Location Created By

                            ws.Cells[row, 28].Value = null;
                            // Location Created Date

                            ws.Cells[row, 29].Value = null;
                            // Location Updated By

                            ws.Cells[row, 30].Value = null;
                            // Location Updated Date


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
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }
        #endregion
    }
}