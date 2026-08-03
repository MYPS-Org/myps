using DBHelper.Data;
using Helpers;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Hangfire.Importing
{
    public static class ImportingHelper
    {
        public class ValidationResponse
        {
            public string Message { get; set; } = string.Empty;
            public bool IsValid { get; set; } = false;
            public bool IsWarning { get; set; } = false;
        }
        public static DateTime? StringToDate(this string? str)
        {
            if (string.IsNullOrEmpty(str)) { return null; }
            return DateTime.TryParseExact(str, "MM/dd/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime result)
            ? result
            : null;
        }
        public static bool ValidateYear(string input, out int year)
        {
            // 1. Ensure the input string converts cleanly to an integer
            if (!int.TryParse(input, out year))
            {
                return false;
            }
            DateTime currentDate = Functions.CurrentDate();
            // 2. Enforce a minimum and maximum realistic boundary
            //int currentYear = DateTime.Today.Year + 100;
            int maxYear = currentDate.Year + 100;
            int minYear = currentDate.Year;

            return year >= minYear && year <= maxYear;
        }
        //#region Validation - Project Details 
        //public class ValidateProjectDetailsResponse : ValidationResponse
        //{ }
        //public static ValidateProjectDetailsResponse ValidateProjectDetails(this MYPSDbContext _db, ImportProjectDetailsExcel details, ImportLookupCache cache)
        //{
        //    bool IsValid = true, IsWarning = false;
        //    string Message = string.Empty;

        //    if (details.ProjectId.Trim().Length == 0)
        //    {
        //        IsValid = false;
        //        Message = string.Format("Incorrect Project ID");
        //    }
        //    bool isMYCAApprovalDateValid = true;
        //    if (details.MYId != null)
        //    {
        //        if (details.MYId.Trim().Length > 0)
        //        {
        //            if (details.MYCAApprovalDate != null)
        //            {
        //                bool isValidMYCADate = DateTime.TryParse(details.MYCAApprovalDate, out _);
        //                if (!isValidMYCADate)
        //                {
        //                    isMYCAApprovalDateValid = false;
        //                    IsWarning = true;
        //                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect MYCA Approval Date") : string.Format("{0}", "Incorrect MYCA Approval Date");
        //                }
        //            }
        //        }
        //    }
        //    if (isMYCAApprovalDateValid)
        //    {
        //        if (details.MYCAApprovalDate != null)
        //        {
        //            bool isValidMYCADate = DateTime.TryParse(details.MYCAApprovalDate, out _);
        //            if (!isValidMYCADate)
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect MYCA Approval Date") : string.Format("{0}", "Incorrect MYCA Approval Date");
        //            }
        //            else
        //            {
        //                if (string.IsNullOrWhiteSpace(details.MYId))
        //                {
        //                    IsWarning = true;
        //                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Multi Year ID") : string.Format("{0}", "Incorrect Multi Year ID");
        //                }
        //            }
        //        }
        //    }
        //    if (!details.Tier.Trim().Equals("Tier I", StringComparison.CurrentCultureIgnoreCase) &&
        //        !details.Tier.Trim().Equals("Tier II", StringComparison.CurrentCultureIgnoreCase))
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Tier") : string.Format("{0}", "Incorrect Tier");
        //    }
        //    var Category = cache.Categories.FirstOrDefault(x => x.CategoryName == details.Category);
        //    //var Category = _db.tOptionProjectCategory.AsNoTracking().FirstOrDefault(x => x.CategoryName == details.Category);
        //    if (Category == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Category") : string.Format("{0}", "Incorrect Category");
        //    }
        //    var Thrust = cache.Thrusts.FirstOrDefault(x => x.ThrustDescription == details.Thrust);
        //    //var Thrust = _db.tProjectThrustLists.AsNoTracking().FirstOrDefault(x => x.ThrustDescription == details.Thrust);
        //    if (Thrust == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Thrust") : string.Format("{0}", "Incorrect Thrust");
        //    }
        //    if (details.Description.Trim().Length == 0)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Required Description") : string.Format("{0}", "Required Description");
        //    }
        //    var Province = cache.Provinces.FirstOrDefault(x => x.Name == details.Province);
        //    //var Province = _db.tOptionAdminAreaProvince.AsNoTracking().FirstOrDefault(x => x.Name == details.Province);
        //    if (Province == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Province") : string.Format("{0}", "Incorrect Province");

        //        var City = cache.Cities.FirstOrDefault(x => x.Name == details.City);
        //        //var City = _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefault(x => x.Name == details.City);
        //        if (City == null)
        //        {
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect City") : string.Format("{0}", "Incorrect City");
        //        }
        //        var LD = cache.Districts.FirstOrDefault(x => x.Name == details.LegislativeDistrict);
        //        //var LD = _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefault(x => x.Name == details.LegislativeDistrict);
        //        if (LD == null)
        //        {
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Legislative District") : string.Format("{0}", "Incorrect Legislative District");
        //        }
        //        var Region = cache.Regions.FirstOrDefault(x => x.Name == details.Region);
        //        //var Region = _db.tOptionAdminAreaRegion.AsNoTracking().FirstOrDefault(x => x.Name == details.Region);
        //        if (Region == null)
        //        {
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Region") : string.Format("{0}", "Incorrect Region");
        //        }
        //        var Deo = cache.DEOs.FirstOrDefault(x => x.Name == details.DEO);
        //        //var Deo = _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().FirstOrDefault(x => x.Name == details.DEO);
        //        if (Deo == null)
        //        {
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect DEO") : string.Format("{0}", "Incorrect DEO");
        //        }
        //        if (IsValid)
        //        {
        //            details.CityGdbId = City.GdbId;
        //            details.LDGdbId = LD.GdbId;
        //            details.DeoParticipantId = Deo.ParticipantId;
        //            details.RegionParticipantId = Region.ParticipantId;
        //            details.RegionIslandCode = Region.IslandCode;
        //        }
        //    }
        //    else
        //    {
        //        var City = cache.Cities.FirstOrDefault(x => x.Name == details.City && x.ProvinceGdbId == Province.GdbId);
        //        //var City = _db.tOptionAdminAreaCityMunicipality.AsNoTracking().FirstOrDefault(x => x.Name == details.City && x.ProvinceGdbId == Province.GdbId);
        //        if (City == null)
        //        {
        //            IsValid = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect City") : string.Format("{0}", "Incorrect City");
        //        }
        //        var LD = cache.Districts.FirstOrDefault(x => x.Name == details.LegislativeDistrict && x.ProvinceGdbId == Province.GdbId);
        //        //var LD = _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().FirstOrDefault(x => x.Name == details.LegislativeDistrict && x.ProvinceGdbId == Province.GdbId);
        //        if (LD == null)
        //        {
        //            IsValid = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Legislative District") : string.Format("{0}", "Incorrect Legislative District");
        //        }
        //        var Region = cache.Regions.FirstOrDefault(x => x.Name == details.Region && x.GdbId == Province.RegionParticipantId);
        //        //var Region = _db.tOptionAdminAreaRegion.AsNoTracking().FirstOrDefault(x => x.Name == details.Region && x.GdbId == Province.RegionParticipantId);
        //        if (Region == null)
        //        {
        //            IsValid = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Region") : string.Format("{0}", "Incorrect Region");
        //        }
        //        var Deo = cache.DEOs.FirstOrDefault(x => x.Name == details.DEO && x.ProvinceGdbId == Province.GdbId);
        //        //var Deo = _db.tOptionAdminAreaDistrictEngineeringOffice.AsNoTracking().FirstOrDefault(x => x.Name == details.DEO && x.ProvinceGdbId == Province.GdbId);
        //        if (Deo == null)
        //        {
        //            IsValid = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect DEO") : string.Format("{0}", "Incorrect DEO");
        //        }
        //        if (IsValid)
        //        {
        //            details.CityGdbId = City.GdbId;
        //            details.LDGdbId = LD.GdbId;
        //            details.DeoParticipantId = Deo.ParticipantId;
        //            details.RegionParticipantId = Region.ParticipantId;
        //            details.RegionIslandCode = Region.IslandCode;
        //        }
        //    }
        //    var ImplementingOffice = cache.ImplementingOffices.FirstOrDefault(x => x.Name == details.ImplementingOffice);
        //    //var ImplementingOffice = _db.vAdminImplementingOffice.AsNoTracking().FirstOrDefault(x => x.Name == details.ImplementingOffice);
        //    if (ImplementingOffice == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Implementing Office") : string.Format("{0}", "Incorrect Implementing Office");
        //    }
        //    var OperatingUnit = cache.OperatingUnits.FirstOrDefault(x => x.Name == details.OperatingUnit);
        //    //var OperatingUnit = _db.vAdminOperatingUnit.AsNoTracking().FirstOrDefault(x => x.Name == details.OperatingUnit);
        //    if (OperatingUnit == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Operating Unit") : string.Format("{0}", "Incorrect Operating Unit");
        //    }
        //    var RegionWide = cache.RegionWides.FirstOrDefault(x => x.Name == details.RegionWide);
        //    //var RegionWide = _db.tOptionRegionWide.AsNoTracking().FirstOrDefault(x => x.Name == details.RegionWide);
        //    if (RegionWide == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Region Wide") : string.Format("{0}", "Incorrect Region Wide");
        //    }
        //    var Origin = cache.Origins.FirstOrDefault(x => x.Name == details.Origin);
        //    //var Origin = _db.tOptionProjectOrigin.AsNoTracking().FirstOrDefault(x => x.Name == details.Origin);
        //    if (Origin == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Origin") : string.Format("{0}", "Incorrect Origin");
        //    }
        //    var Agency = cache.Agencies.FirstOrDefault(x => x.Name == details.Agency);
        //    //var Agency = _db.tOptionProjectAgency.AsNoTracking().FirstOrDefault(x => x.Name == details.Agency);
        //    if (Agency == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Agency") : string.Format("{0}", "Incorrect Agency");
        //    }
        //    var ImplementationMode = cache.ImplementationModes.FirstOrDefault(x => x.Name == details.ImplementationMode);
        //    //var ImplementationMode = _db.tOptionProjectImplementationMode.AsNoTracking().FirstOrDefault(x => x.Name == details.ImplementationMode);
        //    if (ImplementationMode == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Implementation Mode") : string.Format("{0}", "Incorrect Implementation Mode");
        //    }
        //    var EmergencyMode = cache.EmergencyModes.FirstOrDefault(x => x.Name == details.EmergencyMode);
        //    //var EmergencyMode = _db.tOptionProjectEmergencyMode.AsNoTracking().FirstOrDefault(x => x.Name == details.EmergencyMode);
        //    if (EmergencyMode == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Emergency Mode") : string.Format("{0}", "Incorrect Emergency Mode");
        //    }
        //    var RowAvailable = cache.RowAvailables.FirstOrDefault(x => x.Name == details.RowAvailable);
        //    //var RowAvailable = _db.tOptionProjectRowAvailable.AsNoTracking().FirstOrDefault(x => x.Name == details.RowAvailable);
        //    if (RowAvailable == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Row Available") : string.Format("{0}", "Incorrect Row Available");
        //    }
        //    var Feasibility = cache.FeasibilityStudies.FirstOrDefault(x => x.Name == details.Feasibility);
        //    //var Feasibility = _db.tOptionProjectFeasibilityStudy.AsNoTracking().FirstOrDefault(x => x.Name == details.Feasibility);
        //    if (Feasibility == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Feasibility") : string.Format("{0}", "Incorrect Feasibility");
        //    }
        //    else
        //    {
        //        if (details.Feasibility.Trim().Equals("YES", StringComparison.OrdinalIgnoreCase))
        //        {
        //            if (details.FeasibilityDate != null)
        //            {
        //                bool isValidDate = DateTime.TryParse(details.FeasibilityDate, out _);
        //                if (!isValidDate)
        //                {
        //                    IsWarning = true;
        //                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Feasibility Date") : string.Format("{0}", "Incorrect Feasibility Date");
        //                }
        //            }
        //            else
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Feasibility Date") : string.Format("{0}", "Incorrect Feasibility Date");
        //            }
        //        }
        //        else if (details.Feasibility.Trim().Equals("NO", StringComparison.OrdinalIgnoreCase))
        //        {
        //            if (details.FeasibilityDate != null)
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Feasibility Date") : string.Format("{0}", "Incorrect Feasibility Date");
        //            }
        //        }
        //    }
        //    var DetailedDesign = cache.DetailedDesigns.FirstOrDefault(x => x.Name == details.DetailedDesign);
        //    //var DetailedDesign = _db.tOptionProjectDetailedDesign.AsNoTracking().FirstOrDefault(x => x.Name == details.DetailedDesign);
        //    if (DetailedDesign == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Detailed Design") : string.Format("{0}", "Incorrect Detailed Design");
        //    }
        //    else
        //    {
        //        if (details.DetailedDesign.Trim().Equals("YES", StringComparison.OrdinalIgnoreCase))
        //        {
        //            if (details.DetailedDesignDate != null)
        //            {
        //                bool isValidDate = DateTime.TryParse(details.DetailedDesignDate, out _);

        //                if (!isValidDate)
        //                {
        //                    IsWarning = true;
        //                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Detailed Design Date") : string.Format("{0}", "Incorrect Detailed Design Date");
        //                }
        //            }
        //            else
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Detailed Design Date") : string.Format("{0}", "Incorrect Detailed Design Date");
        //            }
        //        }
        //        else if (details.DetailedDesign.Trim().Equals("NO", StringComparison.OrdinalIgnoreCase))
        //        {
        //            if (details.DetailedDesignDate != null)
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Detailed Design Date") : string.Format("{0}", "Incorrect Detailed Design Date");
        //            }
        //        }
        //    }
        //    if (details.Rank != null)
        //    {
        //        bool isValidRank = decimal.TryParse(details.Rank, out _);
        //        if (!isValidRank)
        //        {
        //            IsWarning = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Rank") : string.Format("{0}", "Incorrect Rank");
        //        }
        //    }
        //    details.ErrorMessage = Message;
        //    if (IsValid)
        //    {
        //        details.CategoryCategoryId = Category.CategoryId;
        //        details.ThrustPAPKey = Thrust.PAPKey;
        //        details.OriginNameId = Origin.NameId;
        //        //details.CityGdbId = City.GdbId;
        //        details.ProvinceGdbId = Province.GdbId;
        //        //details.LDGdbId = LD.GdbId;
        //        details.OperatingUnitParticipantId = OperatingUnit.ParticipantId;
        //        details.ImplementingOfficeParticipantId = ImplementingOffice.ParticipantId;
        //        //details.DeoParticipantId = Deo.ParticipantId;
        //        //details.RegionParticipantId = Region.ParticipantId;
        //        details.AgencyNameId = Agency.NameId;
        //        details.ImplementationModeNameId = ImplementationMode.NameId;
        //        details.EmergencyModeNameId = EmergencyMode.NameId;
        //        //details.RegionIslandCode = Region.IslandCode;
        //        details.FeasibilityNameId = Feasibility.NameId;
        //        details.DetailedDesignNameId = DetailedDesign.NameId;
        //        details.RowAvailableNameId = RowAvailable.NameId;
        //        details.RegionWideNameId = RegionWide.NameId;
        //    }

        //    return new ValidateProjectDetailsResponse { IsValid = IsValid, Message = Message, IsWarning = IsWarning };
        //}
        //#endregion
        //#region Validation - Funding Profile
        //public class ValidateFundingProfileResponse : ValidationResponse
        //{ }
        //public static ValidateFundingProfileResponse ValidateFundingProfile(this MYPSDbContext _db,
        //    ImportFundingProfileExcel details, ImportLookupCache cache)
        //{
        //    bool IsValid = true, IsWarning = false;
        //    string Message = string.Empty;

        //    var Agreement = cache.FundingAgreements.FirstOrDefault(x => x.Name == details.Agreement);
        //    //var Agreement = _db.tOptionFundingAgreement.AsNoTracking().FirstOrDefault(x => x.Name == details.Agreement);
        //    if (Agreement == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Funding Agreement") : string.Format("{0}", "Incorrect Funding Agreement");
        //    }
        //    var Source = cache.FundingSources.FirstOrDefault(x => x.Name == details.Source);
        //    //var Source = _db.tOptionFundingSource.AsNoTracking().FirstOrDefault(x => x.Name == details.Source);
        //    if (Source == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Funding Source") : string.Format("{0}", "Incorrect Funding Source");
        //    }
        //    else
        //    {
        //        if (Agreement != null)
        //        {
        //            if (Source.Organization != Agreement.SourceOrg)
        //            {
        //                IsValid = false;
        //                Message = Message.Length > 0 ? string.Format("{0}, Funding Source '{1}' does not match the required source organization for Agreement '{2}'. Expected Source Organization: '{3}'", Message, details.Source, details.Agreement, Agreement.SourceOrg) : string.Format("Funding Source '{0}' does not match the required source organization for Agreement '{1}'. Expected Source Organization: '{2}'", details.Source, details.Agreement, Agreement.SourceOrg);
        //            }
        //        }
        //    }
        //    decimal amountValue;
        //    bool isValidAmount = decimal.TryParse(details.Amount, NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"), out amountValue);
        //    if (!isValidAmount)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Amount") : string.Format("{0}", "Incorrect Amount");
        //    }
        //    details.ErrorMessage = Message;
        //    if (IsValid)
        //    {
        //        details.Amount = amountValue.ToString();
        //        details.SourceOrganization = Source.Organization;
        //        details.AgreementCode = Agreement.Code;
        //    }
        //    return new ValidateFundingProfileResponse { IsValid = IsValid, Message = Message, IsWarning = IsWarning };
        //}
        //#endregion
        //#region Validation - Component Details
        //public class ValidateComponentDetailsResponse : ValidationResponse
        //{ }
        //public static ValidateComponentDetailsResponse ValidateComponentDetails(this MYPSDbContext _db, ImportComponentDetailsExcel details, List<ImportComponentDetailsExcel> componentCosts, ImportLookupCache cache)
        //{
        //    bool IsValid = true, IsWarning = false;
        //    string Message = string.Empty;

        //    var Component = cache.Components.FirstOrDefault(x => x.ComponentName == details.ComponentType);
        //    //var Component = _db.tOptionProjectComponent.AsNoTracking().FirstOrDefault(x => x.ComponentName == details.ComponentType);
        //    if (Component == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component Type") : string.Format("{0}", "Incorrect Component Type");
        //    }
        //    else
        //    {
        //        if (details.ComponentId.Trim().Length >= 2)
        //        {
        //            if (details.ComponentId != Component.ComponentId)
        //            {
        //                if (!Component.ComponentName.Equals("Civil Works", StringComparison.OrdinalIgnoreCase))
        //                {
        //                    IsValid = false;
        //                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //                }
        //                else
        //                {
        //                    if (details.ComponentId.Substring(0, 2) == "CW")
        //                    {
        //                        string excessOfComponentId = details.ComponentId.Substring(Component.ComponentId.Length);
        //                        if (excessOfComponentId.Length > 0)
        //                        {
        //                            int cntNumber = 0;
        //                            bool isValidExcessOfComponentId = int.TryParse(excessOfComponentId, out cntNumber);
        //                            if (!isValidExcessOfComponentId)
        //                            {
        //                                IsValid = false;
        //                                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //                            }
        //                            else
        //                            {
        //                                //Check if correct numbering
        //                                var query = componentCosts.Where(x => x.ProjectId == details.ProjectId && x.ComponentType == details.ComponentType).ToList();
        //                                if (cntNumber > query.Count())
        //                                {
        //                                    IsValid = false;
        //                                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //                                }
        //                            }
        //                        }
        //                    }
        //                    else
        //                    {
        //                        IsValid = false;
        //                        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //                    }
        //                }
        //            }
        //            else
        //            {
        //                if (Component.ComponentName.Equals("Civil Works", StringComparison.OrdinalIgnoreCase))
        //                {
        //                    IsValid = false;
        //                    Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //                }
        //            }
        //        }
        //        else
        //        {
        //            IsValid = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //        }
        //    }
        //    decimal costValue;
        //    bool isValidCost = decimal.TryParse(details.Cost, NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"), out costValue);
        //    if (!isValidCost)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Cost") : string.Format("{0}", "Incorrect Cost");
        //    }
        //    if (details.StartDate != null)
        //    {
        //        if (details.StartDate.Trim().Length > 0)
        //        {
        //            bool isValidStartDate = DateTime.TryParse(details.StartDate, out _);
        //            if (!isValidStartDate)
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Planned Start Date") : string.Format("{0}", "Incorrect Planned Start Date");
        //            }
        //        }
        //    }
        //    if (details.EndDate != null)
        //    {
        //        if (details.EndDate.Trim().Length > 0)
        //        {
        //            bool isValidEndDate = DateTime.TryParse(details.EndDate, out _);
        //            if (!isValidEndDate)
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Planned End Date") : string.Format("{0}", "Incorrect Planned End Date");
        //            }
        //        }
        //    }
        //    var InfraType = cache.InfraTypes.FirstOrDefault(x => x.InfraName == details.InfraType);
        //    //var InfraType = _db.tOptionInfraType.AsNoTracking().FirstOrDefault(x => x.InfraName == details.InfraType);
        //    if (InfraType == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Infrastructure Type") : string.Format("{0}", "Incorrect Infrastructure Type");
        //    }
        //    var ScopeOfWork = cache.ScopeOfWorks.Where(x => x.Description == details.WorkTypeId).ToList();
        //    //var ScopeOfWork = _db.tOptionScopeOfWork.AsNoTracking().Where(x => x.Description == details.WorkTypeId);
        //    if (ScopeOfWork == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Work Type") : string.Format("{0}", "Incorrect Work Type");
        //    }
        //    int? ScopeOfWorkEnum = null;
        //    if (InfraType != null && ScopeOfWork != null)
        //    {
        //        bool isValidCombi = false;
        //        foreach (var x in ScopeOfWork)
        //        {
        //            if (x.InfraType.Contains(InfraType.InfraCode))
        //            {
        //                ScopeOfWorkEnum = x.Enum;
        //                isValidCombi = true;
        //                goto hill;
        //            }
        //        }
        //    hill:
        //        if (!isValidCombi)
        //        {
        //            IsValid = false;
        //            Message = Message.Length > 0 ? string.Format("{0}, The selected Work Type '{1}' is not valid for the selected Infrastructure Type '{2}'. Please select a valid Work Type for the Infra Type", Message, details.WorkTypeId, details.InfraType) : string.Format("The selected Work Type '{0}' is not valid for the selected Infrastructure Type '{1}'. Please select a valid Work Type for the Infra Type", details.WorkTypeId, details.InfraType);
        //        }
        //    }
        //    if (!ValidateYear(details.ActiveYear, out _))
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Activity Year") : string.Format("{0}", "Incorrect Activity Year");
        //    }
        //    details.ErrorMessage = Message;
        //    if (IsValid)
        //    {
        //        details.Cost = costValue.ToString();
        //        details.ScopeOfWorkEnum = ScopeOfWorkEnum; // ScopeOfWork.First().Enum;
        //        details.InfraTypeInfraCode = InfraType.InfraCode;
        //    }
        //    return new ValidateComponentDetailsResponse { IsValid = IsValid, Message = Message, IsWarning = IsWarning };
        //}
        //#endregion
        //#region Validation - Major Items of Work
        //public class ValidateMajorItemsOfWorkResponse : ValidationResponse
        //{ }
        //public static ValidateMajorItemsOfWorkResponse ValidateMajorItemsOfWork(this MYPSDbContext _db, ImportMajorItemsOfWorkExcel details, List<ImportComponentDetailsExcel> componentCost, ImportLookupCache cache)
        //{
        //    bool IsValid = true, IsWarning = false;
        //    string Message = string.Empty;

        //    var Component = componentCost.FirstOrDefault(x => x.ProjectId == details.ProjectId && x.ComponentId == details.ComponentId);
        //    if (Component == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Component ID") : string.Format("{0}", "Incorrect Component ID");
        //    }
        //    string refId = string.Format("{0}-{1}", details.ProjectId, details.ComponentId);
        //    if (refId != details.ReferenceId)
        //    {
        //        IsWarning = true;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Reference ID") : string.Format("{0}", "Incorrect Reference ID");
        //    }
        //    if (details.InfrastructureId.Trim().Length == 0)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Infrastructure ID") : string.Format("{0}", "Incorrect Infrastructure ID");
        //    }
        //    string workTypeId = Component != null ? Component.WorkTypeId : "";
        //    var TargetUnit = cache.ScopeOfWorks.FirstOrDefault(x => x.Description == workTypeId && x.Measure == details.TargetUnit);
        //    //var TargetUnit = _db.tOptionScopeOfWork.AsNoTracking().FirstOrDefault(x => x.Description == workTypeId && x.Measure == details.TargetUnit);
        //    if (TargetUnit == null)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Target Unit") : string.Format("{0}", "Incorrect Target Unit");
        //    }
        //    if (details.StartX != null)
        //    {
        //        bool isValidStartX = double.TryParse(details.StartX, out var startXVal);
        //        if (!isValidStartX)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Start X") : string.Format("{0}", "Incorrect Start X");
        //        }
        //        else
        //        {
        //            if (!(startXVal >= 116.66666666666666 && startXVal <= 126.59666666666665))
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Start X Range: 116.66666666666666 - 126.59666666666665") : string.Format("{0}", "Start X Range: 116.66666666666666 - 126.59666666666665");
        //            }
        //        }
        //    }
        //    if (details.StartY != null)
        //    {
        //        bool isValidStartY = double.TryParse(details.StartY, out var startYVal);
        //        if (!isValidStartY)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Start Y") : string.Format("{0}", "Incorrect Start Y");
        //        }
        //        else
        //        {
        //            if (!(startYVal >= 4.666666666666666 && startYVal <= 21.166666666666668))
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Start Y Range: 4.666666666666666 - 21.166666666666668") : string.Format("{0}", "Start Y Range: 4.666666666666666 - 21.166666666666668");
        //            }
        //        }
        //    }
        //    if (details.EndX != null)
        //    {
        //        bool isValidEndX = double.TryParse(details.EndX, out var endXVal);
        //        if (!isValidEndX)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect End X") : string.Format("{0}", "Incorrect End X");
        //        }
        //        else
        //        {
        //            if (!(endXVal >= 116.66666666666666 && endXVal <= 126.59666666666665))
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "End X Range: 116.66666666666666 - 126.59666666666665") : string.Format("{0}", "End X Range: 116.66666666666666 - 126.59666666666665");
        //            }
        //        }
        //    }
        //    if (details.EndY != null)
        //    {
        //        bool isValidEndY = double.TryParse(details.EndY, out var endYVal);
        //        if (!isValidEndY)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect End Y") : string.Format("{0}", "Incorrect End Y");
        //        }
        //        else
        //        {
        //            if (!(endYVal >= 4.666666666666666 && endYVal <= 21.166666666666668))
        //            {
        //                IsWarning = true;
        //                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "End Y Range: 4.666666666666666 - 21.166666666666668") : string.Format("{0}", "End Y Range: 4.666666666666666 - 21.166666666666668");
        //            }
        //        }
        //    }
        //    bool isValidPhysicalTarget = decimal.TryParse(details.PhysicalTarget, out _);
        //    if (!isValidPhysicalTarget)
        //    {
        //        IsValid = false;
        //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Physical Target") : string.Format("{0}", "Incorrect Physical Target");
        //    }
        //    //if (details.StartStation != null)
        //    //{
        //    //    bool isValidStartStationLimit = decimal.TryParse(details.StartStation, out _);
        //    //    if (!isValidStartStationLimit)
        //    //    {
        //    //        IsWarning = true;
        //    //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Start Station") : string.Format("{0}", "Incorrect Start Station");
        //    //    }
        //    //}
        //    //if (details.EndStation != null)
        //    //{
        //    //    bool isValidEndStationLimit = decimal.TryParse(details.EndStation, out _);
        //    //    if (!isValidEndStationLimit)
        //    //    {
        //    //        IsWarning = true;
        //    //        Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect End Station") : string.Format("{0}", "Incorrect End Station");
        //    //    }
        //    //}
        //    if (details.StartChainage != null)
        //    {
        //        bool isValidStartChainage = decimal.TryParse(details.StartChainage, out _);
        //        if (!isValidStartChainage)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Start Chainage") : string.Format("{0}", "Incorrect Start Chainage");
        //        }
        //    }
        //    if (details.EndChainage != null)
        //    {
        //        bool isValidEndChainage = decimal.TryParse(details.EndChainage, out _);
        //        if (!isValidEndChainage)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect End Chainage") : string.Format("{0}", "Incorrect End Chainage");
        //        }
        //    }
        //    if (details.Length != null)
        //    {
        //        bool isValidLength = decimal.TryParse(details.Length, out _);
        //        if (!isValidLength)
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Length") : string.Format("{0}", "Incorrect Length");
        //        }
        //    }
        //    if (details.ActivityYear != null)
        //    {
        //        if (!ValidateYear(details.ActivityYear, out _))
        //        {
        //            IsWarning = true;
        //            Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, "Incorrect Activity Year") : string.Format("{0}", "Incorrect Activity Year");
        //        }
        //    }
        //    details.ErrorMessage = Message;
        //    if (IsValid)
        //    {
        //        details.TargetUnitId = TargetUnit.Id;
        //    }
        //    return new ValidateMajorItemsOfWorkResponse { IsValid = IsValid, Message = Message, IsWarning = IsWarning };
        //}
        //#endregion
        //#region Save - Project Details
        //public class SaveProjectResponse : ValidationResponse
        //{
        //    public DBHelper.Models.Table.Project.Projects Project { get; set; } = new DBHelper.Models.Table.Projects();
        //    public DBHelper.Models.Table.Project.ProjectRevisions ProjectRevision { get; set; } = new DBHelper.Models.Table.ProjectRevisions();
        //    public DBHelper.Models.Table.Project.ProjectStages ProjectStage { get; set; } = new DBHelper.Models.Table.ProjectStages();
        //    public ImportProjectReference ImportReference { get; set; } = new ImportProjectReference();
        //}
        //public static SaveProjectResponse SaveProjectDetails(this MYPSDbContext _db, DBHelper.Models.Views.ProgramDetails ProgramDetails, ImportProjectDetailsExcel details, List<ImportProjectReference> Saved, ImportLookupCache cache)
        //{
        //    var Category = cache.Categories.First(x => x.CategoryName == details.Category);

        //    var ImportRef = new ImportProjectReference();
        //    string toSaveProjectId = _db.GenerateProjectID(ProgramDetails, Category, details.RegionIslandCode!);
        //    var parts = toSaveProjectId.Split("-");
        //    string baseId = toSaveProjectId.Replace("-", "");
        //    string ReferenceId = baseId;
        //    var check = Saved.Where(x => x.ThirdSegment == parts[2]).OrderByDescending(x => x.MaxId).FirstOrDefault(x => x.ThirdSegment == parts[2]);
        //    ImportRef.MaxId = parts[2];
        //    ImportRef.ThirdSegment = parts[2];
        //    if (check != null)
        //    {
        //        ImportRef.MaxId = (int.Parse(check.MaxId) + 1).ToString();
        //        ReferenceId = toSaveProjectId.Replace(parts[2], ImportRef.MaxId.ToString()).Replace("-", "");
        //    }
        //    ImportRef.OldProjectId = details.ProjectId;
        //    ImportRef.NewProjectId = ReferenceId;
        //    /*
        //    ImportProjectReference AddProject = new ImportProjectReference
        //    {
        //        OldProjectId = Item.ProjectId,
        //        NewProjectId = string.Empty
        //    };
        //    AddProject.NewProjectId = Projects.Project.ReferenceId;
        //     */

        //    //DateTime CurrentDate = Functions.CurrentDate();
        //    var NewProject = new DBHelper.Models.Table.Projects
        //    {
        //        ProgramId = ProgramDetails.ProgramId,
        //        ReferenceId = ReferenceId
        //    };
        //    var NewProjectRevision = new DBHelper.Models.Table.ProjectRevisions
        //    {
        //        ProgramId = ProgramDetails.ProgramId,
        //        ReferenceId = ReferenceId,
        //        ProjectId = ReferenceId,
        //        AlternateId = details.ProjectId,
        //        ExternalId = details.ExternalId,
        //        MYId = details.MYId,
        //        UACS = details.UACS,
        //        MYCAApprovalDate = string.IsNullOrWhiteSpace(details.MYCAApprovalDate) ? null : DateTime.TryParse(details.MYCAApprovalDate, out _) ? details.MYCAApprovalDate.StringToDate() : null,
        //        RevisionNumber = 1,
        //        Description = details.Description!,
        //        Category = Category.CategoryId,
        //        Thrust = details.ThrustPAPKey,
        //        Origin = (int)details.OriginNameId!,
        //        City = details.CityGdbId!,
        //        Province = details.ProvinceGdbId!,
        //        LegislativeDistrict = details.LDGdbId!,
        //        OperatingUnit = details.OperatingUnitParticipantId!,
        //        ImplementingOffice = details.ImplementingOfficeParticipantId!,
        //        DEO = details.DeoParticipantId!,
        //        Region = details.RegionParticipantId!,
        //        Agency = (int)details.AgencyNameId!,
        //        ImplementationMode = details.ImplementationModeNameId,
        //        EmergencyMode = (int)details.EmergencyModeNameId!,
        //        IslandCode = details.RegionIslandCode!,
        //        Feasibility = details.FeasibilityNameId,
        //        FeasibilityDate = string.IsNullOrWhiteSpace(details.FeasibilityDate) ? null : DateTime.TryParse(details.FeasibilityDate, out _) ? details.FeasibilityDate.StringToDate() : null,
        //        DetailedDesign = (int)details.DetailedDesignNameId!,
        //        DetailedDesignDate = string.IsNullOrWhiteSpace(details.DetailedDesignDate) ? null : DateTime.TryParse(details.DetailedDesignDate, out _) ? details.DetailedDesignDate.StringToDate() : null,
        //        RowAvailable = (int)details.RowAvailableNameId!,
        //        RegionWide = (int)details.RegionWideNameId!,
        //        Tier = (details.Tier.Trim().Equals("Tier I", StringComparison.CurrentCultureIgnoreCase)) ? 1 : 2,
        //        Rank = string.IsNullOrWhiteSpace(details.Rank) ? null : double.TryParse(details.Rank, out var rank) ? rank : null,
        //    };
        //    var ProjectStage = new DBHelper.Models.Table.ProjectStages
        //    {
        //        ReferenceId = ReferenceId,
        //        ProgramId = ProgramDetails.ProgramId,
        //        RevisionId = 0,
        //        StageId = ProgramDetails.StageId,
        //        StageName = ProgramDetails.StageName
        //    };
        //    return new SaveProjectResponse { IsValid = true, Message = string.Empty, Project = NewProject, ProjectRevision = NewProjectRevision, ProjectStage = ProjectStage, ImportReference = ImportRef };
        //}
        //#endregion
        //#region Save - Funding Profile
        //public class SaveFundingProfileResponse : ValidationResponse
        //{
        //    public DBHelper.Models.Table.ProjectFundingProfile FundingProfile { get; set; } = new DBHelper.Models.Table.ProjectFundingProfile();
        //}
        //public static SaveFundingProfileResponse SaveFundingProfile(this MYPSDbContext _db, ImportFundingProfileExcel details, ImportProjectReference ProjectRef)
        //{
        //    var NewProject = ProjectRef.NewProjectId;
        //    var FundingProfile = new DBHelper.Models.Table.ProjectFundingProfile
        //    {
        //        ProjectId = NewProject,
        //        Source = details.SourceOrganization!,
        //        Agreement = details.AgreementCode!,
        //        Percentage = details.Percentage,
        //        Amount = double.Parse(details.Amount)
        //    };
        //    return new SaveFundingProfileResponse { IsValid = true, Message = string.Empty, FundingProfile = FundingProfile };
        //}
        //#endregion
        //#region Save - Component Details
        //public class SaveComponentDetailsResponse : ValidationResponse
        //{
        //    public DBHelper.Models.Table.ProjectComponentCost ComponentCost { get; set; } = new DBHelper.Models.Table.ProjectComponentCost();
        //    public DBHelper.Models.Table.ProjectComponentCostPerYear ComponentCostPerYear { get; set; } = new DBHelper.Models.Table.ProjectComponentCostPerYear();
        //}
        //public static SaveComponentDetailsResponse SaveComponentCost(this MYPSDbContext _db, ImportComponentDetailsExcel details, ImportProjectReference ProjectRef)
        //{
        //    var NewProject = ProjectRef.NewProjectId;
        //    var ComponentCostProfile = new DBHelper.Models.Table.ProjectComponentCost
        //    {
        //        ProjectId = NewProject,
        //        CostId = string.Format("{0}-{1}", details.ProjectId, details.ComponentId),
        //        ComponentType = details.ComponentType,
        //        ComponentId = details.ComponentId,
        //        Description = details.Description,
        //        Total = double.Parse(details.Cost)
        //    };
        //    DateTime? strStartDate = null, strEndDate = null;
        //    if (details.StartDate != null)
        //    {
        //        if (details.StartDate.Trim().Length > 0)
        //        {
        //            bool isValidStartDate = DateTime.TryParse(details.StartDate, out var startDate);
        //            if (isValidStartDate) strStartDate = startDate;
        //        }
        //    }
        //    if (details.EndDate != null)
        //    {
        //        if (details.EndDate.Trim().Length > 0)
        //        {
        //            bool isValidEndDate = DateTime.TryParse(details.EndDate, out var endDate);
        //            if (isValidEndDate) strEndDate = endDate;
        //        }
        //    }
        //    var ComponentCostPerYearProfile = new DBHelper.Models.Table.ProjectComponentCostPerYear
        //    {
        //        ComponentCostId = string.Format("{0}-{1}", details.ProjectId, details.ComponentId),
        //        Amount = double.Parse(details.Cost),
        //        Year = int.Parse(details.ActiveYear),
        //        StartDate = strStartDate,
        //        EndDate = strEndDate
        //    };

        //    return new SaveComponentDetailsResponse { IsValid = true, Message = string.Empty, ComponentCost = ComponentCostProfile, ComponentCostPerYear = ComponentCostPerYearProfile };
        //}
        //#endregion
        //#region Save - Major Items of Work
        //public class SaveMajorItemsOfWorkResponse : ValidationResponse
        //{
        //    public DBHelper.Models.Table.ProjectMajorWorkItem MajorWorkItem { get; set; } = new DBHelper.Models.Table.ProjectMajorWorkItem();
        //    public DBHelper.Models.Table.ProjectMajorWorkLocations MajorWorkLocation { get; set; } = new DBHelper.Models.Table.ProjectMajorWorkLocations();
        //}
        //public static SaveMajorItemsOfWorkResponse SaveMajorItemsOfWork(this MYPSDbContext _db, ImportMajorItemsOfWorkExcel details, ImportProjectReference ProjectRef, ImportComponentDetailsExcel component)
        //{
        //    int? intActivityYear = null;
        //    if (details.ActivityYear != null)
        //    {
        //        bool isValidActivityYear = ValidateYear(details.ActivityYear, out var activityYear);
        //        if (isValidActivityYear) intActivityYear = activityYear;
        //    }

        //    var MajorWorkItemProfile = new DBHelper.Models.Table.ProjectMajorWorkItem
        //    {
        //        ProjectId = ProjectRef.NewProjectId,
        //        ReferenceId = details.ReferenceId,
        //        ComponentId = details.ComponentId,
        //        YearOfWork = intActivityYear,
        //        WorkTypeId = (int)component.ScopeOfWorkEnum,
        //        InfraType = component.InfraTypeInfraCode!,
        //    };

        //    double? startXVal = null, startYVal = null, endXVal = null, endYVal = null;
        //    if (details.StartX != null)
        //    {
        //        bool isValidStartX = double.TryParse(details.StartX, out var startX);
        //        if (isValidStartX)
        //        {
        //            if (startX >= 116.66666666666666 && startX <= 126.59666666666665)
        //                startXVal = startX;
        //        }
        //    }
        //    if (details.StartY != null)
        //    {
        //        bool isValidStartY = double.TryParse(details.StartY, out var startY);
        //        if (isValidStartY)
        //        {
        //            if (startY >= 4.666666666666666 && startY <= 21.166666666666668)
        //                startYVal = startY;
        //        }
        //    }
        //    if (details.EndX != null)
        //    {
        //        bool isValidEndX = double.TryParse(details.EndX, out var endX);
        //        if (isValidEndX)
        //        {
        //            if (endX >= 116.66666666666666 && endX <= 126.59666666666665)
        //                endXVal = endX;
        //        }
        //    }
        //    if (details.EndY != null)
        //    {
        //        bool isValidEndY = double.TryParse(details.EndY, out var endY);
        //        if (isValidEndY)
        //        {
        //            if (endY >= 4.666666666666666 && endY <= 21.166666666666668)
        //                endYVal = endY;
        //        }
        //    }
        //    double? lengthVal = null, startChainageVal = null, endChainageVal = null;
        //    if (details.Length != null)
        //    {
        //        bool isValidLength = double.TryParse(details.Length, out var length);
        //        if (isValidLength) lengthVal = length;
        //    }
        //    if (details.StartChainage != null)
        //    {
        //        bool isValidStartChainage = double.TryParse(details.StartChainage, out var startChainage);
        //        if (isValidStartChainage) startChainageVal = startChainage;
        //    }
        //    if (details.EndChainage != null)
        //    {
        //        bool isValidEndChainage = double.TryParse(details.EndChainage, out var endChainage);
        //        if (isValidEndChainage) endChainageVal = endChainage;
        //    }
        //    //string? startStationVal = null, endStationVal = null;
        //    //if (details.StartStation != null)
        //    //{
        //    //    bool isValidStartStation = double.TryParse(details.StartStation, out var startStation);
        //    //    if (isValidStartStation) startStationVal = string.Format("{0:N}", startStation);
        //    //}
        //    //if (details.EndStation != null)
        //    //{
        //    //    bool isValidEndStation = double.TryParse(details.EndStation, out var endStation);
        //    //    if (isValidEndStation) endStationVal = string.Format("{0:N}", endStation);
        //    //}

        //    var MajorWorkLocationProfile = new DBHelper.Models.Table.ProjectMajorWorkLocations
        //    {
        //        ParentId = string.Empty, //details.ParentId,
        //        InfraId = details.InfrastructureId,
        //        DetailedScope = details.DetailsScope,
        //        TargetUnitId = (int)details.TargetUnitId,
        //        TargetUnit = details.TargetUnit,
        //        PhysicalTarget = double.Parse(details.PhysicalTarget),
        //        Length = lengthVal,
        //        StartChainage = startChainageVal,
        //        EndChainage = endChainageVal,
        //        StartX = startXVal,
        //        StartY = startYVal,
        //        EndX = endXVal,
        //        EndY = endYVal,
        //        StartStationLimit = details.StartStation,
        //        EndStationLimit = details.EndStation
        //    };

        //    return new SaveMajorItemsOfWorkResponse { IsValid = true, Message = string.Empty, MajorWorkItem = MajorWorkItemProfile, MajorWorkLocation = MajorWorkLocationProfile };
        //}
        //#endregion
        //#region Program Validation
        //public class IsValidProgramIdResponse : ValidationResponse
        //{
        //    public DBHelper.Models.Views.ProgramDetails ProgramDetails { get; set; } = new DBHelper.Models.Views.ProgramDetails();
        //}
        //public static IsValidProgramIdResponse IsValidProgramId(this MYPSDbContext _db, string ProgramID, string StageName)
        //{
        //    var CheckProgram = _db.vPrograms.AsNoTracking().FirstOrDefault(x => x.ProgramId == ProgramID);
        //    if (CheckProgram == null)
        //    {
        //        return new IsValidProgramIdResponse { IsValid = false, Message = $"ProgramID: {ProgramID} does not exist." };
        //    }
        //    else if (CheckProgram.StageName != StageName)
        //    {
        //        return new IsValidProgramIdResponse { IsValid = false, Message = $"The provided stage '{StageName}' does not match the latest stage for Program '{ProgramID}'. Current stage: '{CheckProgram.StageName}'" };
        //    }
        //    var Details = _db.vProgramDetails.AsNoTracking().FirstOrDefault(x => x.ProgramId == ProgramID && x.StageName == StageName);
        //    if (Details == null)
        //    {
        //        return new IsValidProgramIdResponse { IsValid = false, Message = $"Program details not found for ProgramID: {ProgramID} at Stage: {StageName}." };
        //    }
        //    return new IsValidProgramIdResponse { IsValid = true, Message = string.Empty, ProgramDetails = Details };
        //}
        //#endregion
    }
}
