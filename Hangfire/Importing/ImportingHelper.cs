using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Views.AdminAreas;
using Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using OfficeOpenXml;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Globalization;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using static Helpers.ProjectHelper;

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

        // ── Shared validation-state accumulator ─────────────────────────────────
        // Centralizes the repeated "IsValid=false; Message = append(...)" and
        // "IsWarning=true; Message = append(...)" pattern used throughout every
        // Validate* method below, so call sites read as one line instead of three,
        // and the comma-joining/append logic only lives in one place.
        private sealed class ValidationState
        {
            public bool IsValid { get; private set; } = true;
            public bool IsWarning { get; private set; } = false;
            public string Message { get; private set; } = string.Empty;

            // Marks the record invalid (hard error) and appends the message.
            public void Fail(string message)
            {
                IsValid = false;
                Append(message);
            }

            // Marks the record as having a warning (soft error) and appends the message.
            // Does not affect IsValid — a record can carry warnings and still be valid.
            public void Warn(string message)
            {
                IsWarning = true;
                Append(message);
            }

            private void Append(string message)
            {
                Message = Message.Length > 0 ? string.Format("{0}, {1}", Message, message) : message;
            }
        }
        // ── Shared case-insensitive / trim-tolerant name comparison ────────────
        // Use this everywhere a lookup/reference name is compared against an
        // imported Excel value, instead of raw `==`, so casing differences
        // (e.g. "Metro Manila" vs "METRO MANILA") don't fail validation.
        public static bool NamesMatch(string? a, string? b)
            => string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);

        // ── Tier comparison: cache.Tiers.Name is always Arabic ("Tier 1"/"Tier 2"),
        // but imported Excel values may come in as Roman numerals ("Tier I"/"Tier II").
        private static readonly Dictionary<string, int> TierRomanToArabic = new(StringComparer.OrdinalIgnoreCase)
        {
            { "I", 1 }, { "II", 2 }
        };

        // Extracts the tier's numeric value regardless of whether it's written as
        // "Tier 1", "Tier I", "TIER1", "tier-1", etc. Returns null if it can't be parsed.
        private static int? NormalizeTierValue(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;

            // Strip a leading "Tier" (any casing) and any separators/whitespace around the number.
            var cleaned = Regex.Replace(raw.Trim(), @"^\s*Tier\s*[-:]?\s*", "", RegexOptions.IgnoreCase).Trim();
            if (cleaned.Length == 0) return null;

            if (int.TryParse(cleaned, out int arabicValue))
                return arabicValue;

            if (TierRomanToArabic.TryGetValue(cleaned, out int romanValue))
                return romanValue;

            return null;
        }

        // Use this instead of NamesMatch specifically for Tier fields.
        public static bool TierMatches(string? cacheTierName, string? importedTierValue)
        {
            var a = NormalizeTierValue(cacheTierName);
            var b = NormalizeTierValue(importedTierValue);
            return a.HasValue && b.HasValue && a.Value == b.Value;
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
        #region Validation - Project Details 
        public class ValidateProjectDetailsResponse : ValidationResponse
        { }
        public static ValidateProjectDetailsResponse ValidateProjectDetails(this MYPSDbContext _db, ImportProjectDetailsExcel details, ImportLookupCache cache)
        {
            var v = new ValidationState();

            if (string.IsNullOrWhiteSpace(details.ProjectId))
            {
                v.Fail("Incorrect Project ID");
            }
            if (details.MYCAApprovalDate != null)
            {
                bool isMYCAApprovalDateValid = DateTime.TryParse(details.MYCAApprovalDate, out _);
                if (!isMYCAApprovalDateValid)
                {
                    v.Warn("Incorrect MYCA Approval Date");
                }
                else if (string.IsNullOrWhiteSpace(details.MYId))
                {
                    v.Warn("Incorrect Multi Year ID");
                }
            }

            var Tier = cache.Tiers.FirstOrDefault(x => TierMatches(x.Name, details.Tier));
            if (Tier == null)
            {
                v.Fail("Incorrect Tier");
            }
            var Category = cache.Categories.FirstOrDefault(x => NamesMatch(x.CategoryName, details.Category));
            if (Category == null)
            {
                v.Fail("Incorrect Category");
            }
            var Thrust = cache.Thrusts.FirstOrDefault(x => NamesMatch(x.ThrustDescription, details.Thrust));
            if (Thrust == null)
            {
                v.Fail("Incorrect Thrust");
            }
            if (string.IsNullOrWhiteSpace(details.Description))
            {
                v.Fail("Required Description");
            }
            // ── Primary source: Legislative District (name may not be globally unique) ──
            // Province is DERIVED from the resolved LD, not read from details.Province.
            // details.Province is only used as a disambiguation signal when the LD
            // name matches more than one district (see scoring below).
            var LDCandidates = cache.Districts.Where(x => NamesMatch(x.Name, details.LegislativeDistrict)).ToList();

            var LDResolvedCandidates = LDCandidates;
            bool ldAmbiguous = false;
            string? ldAmbiguityDetail = null;

            // Declared here (outer scope) because it's referenced again near the
            // end of this method when populating `details` on success.
            var Province = cache.Provinces.FirstOrDefault(x => false);

            if (LDCandidates.Count > 1)
            {
                // ── Multiple LDs share this name — disambiguate using Province/City/Region/DEO ──
                var scored = LDCandidates
                    .Select(candidate =>
                    {
                        var province = cache.Provinces.FirstOrDefault(p => p.Code == candidate.ProvinceCode);
                        int score = 0;

                        if (province != null)
                        {
                            if (NamesMatch(province.Name, details.Province))
                                score += 4;

                            if (cache.Cities.Any(c => NamesMatch(c.Name, details.City) && c.ProvinceCode == province.Code))
                                score += 3;

                            var region = cache.Regions.FirstOrDefault(r => r.ParticipantId == province.RegionParticipantId);
                            if (region != null && NamesMatch(region.Name, details.Region))
                                score += 2;

                            if (cache.DEOs.Any(d => NamesMatch(d.Name, details.DEO) && d.ProvinceCode == province.Code))
                                score += 1;
                        }

                        return new { Candidate = candidate, Province = province, Score = score };
                    })
                    .OrderByDescending(x => x.Score)
                    .ToList();

                var topScore = scored[0].Score;
                var topMatches = scored.Where(x => x.Score == topScore).ToList();

                if (topScore == 0 || topMatches.Count > 1)
                {
                    // ── Genuine tie, or nothing matched any signal — cannot safely pick one ──
                    ldAmbiguous = true;
                    ldAmbiguityDetail = string.Join(" / ", scored.Select(x => x.Province?.Name ?? "Unknown"));
                    LDResolvedCandidates = new();
                }
                else
                {
                    LDResolvedCandidates = new() { topMatches[0].Candidate };
                }
            }

            var LD = LDResolvedCandidates.FirstOrDefault();

            if (LD == null)
            {
                if (ldAmbiguous)
                {
                    v.Fail($"Ambiguous Legislative District '{details.LegislativeDistrict}' — matches {LDCandidates.Count} provinces ({ldAmbiguityDetail}); could not disambiguate using Province/City/Region/DEO");
                }
                else
                {
                    v.Fail("Incorrect Legislative District");
                }

                // ── LD unresolved → can't derive Province → fall back to name-only checks ──
                // Record is already invalid from the LD failure above; these use Fail too
                // (not just message-only) so City/Region/DEO issues are reflected the same
                // way as every other required field in this method.
                var City = cache.Cities.FirstOrDefault(x => NamesMatch(x.Name, details.City));
                if (City == null)
                {
                    v.Fail("Incorrect City");
                }
                var Region = cache.Regions.FirstOrDefault(x => NamesMatch(x.Name, details.Region));
                if (Region == null)
                {
                    v.Fail("Incorrect Region");
                }
                var Deo = cache.DEOs.FirstOrDefault(x => NamesMatch(x.Name, details.DEO));
                if (Deo == null)
                {
                    v.Fail("Incorrect DEO");
                }
                var ImplementingOffice = cache.ImplementingOffices.FirstOrDefault(x => NamesMatch(x.Name, details.ImplementingOffice));
                if (ImplementingOffice == null)
                {
                    v.Fail("Incorrect Implementing Office");
                }
                var OperatingUnit = cache.OperatingUnits.FirstOrDefault(x => NamesMatch(x.Name, details.OperatingUnit));
                if (OperatingUnit == null)
                {
                    v.Fail("Incorrect Operating Unit");
                }
            }
            else
            {
                // ── LD resolved (unique or disambiguated) → derive the "real" Province from it ──
                Province = cache.Provinces.FirstOrDefault(x => x.Code == LD.ProvinceCode);

                if (Province == null)
                {
                    // Data integrity issue — LD points to a province code that doesn't exist in cache.
                    v.Fail("Province could not be resolved from Legislative District");
                }
                else
                {
                    var City = cache.Cities.FirstOrDefault(x => NamesMatch(x.Name, details.City) && x.ProvinceCode == Province.Code);
                    if (City == null)
                    {
                        v.Fail("Incorrect City");
                    }

                    var Region = cache.Regions.FirstOrDefault(x => NamesMatch(x.Name, details.Region) && x.ParticipantId == Province.RegionParticipantId);
                    if (Region == null)
                    {
                        v.Fail("Incorrect Region");
                    }

                    var Deo = cache.DEOs.FirstOrDefault(x => NamesMatch(x.Name, details.DEO) && x.ProvinceCode == Province.Code);
                    if (Deo == null)
                    {
                        v.Fail("Incorrect DEO");
                    }

                    if (Region != null && Deo != null)
                    {
                        var ImplementingOffice = cache.ImplementingOffices.FirstOrDefault(x => (NamesMatch(x.Name, Region.Name) || NamesMatch(x.Name, Deo.Name)) && x.RegionParticipantId == Province.RegionParticipantId);
                        if (ImplementingOffice == null)
                        {
                            v.Fail("Incorrect Implementing Office");
                        }

                        var OperatingUnit = NamesMatch(details.OperatingUnit, "Central Office") ?
                            cache.OperatingUnits.FirstOrDefault(x => NamesMatch(x.Name, "Central Office")) :
                            cache.OperatingUnits.FirstOrDefault(x => (NamesMatch(x.Name, Region.Name) || NamesMatch(x.Name, Deo.Name)) && x.RegionParticipantId == Province.RegionParticipantId);
                        if (OperatingUnit == null)
                        {
                            v.Fail("Incorrect Operating Unit");
                        }

                        if (v.IsValid)
                        {
                            details.CityCode = City.Code;
                            details.LDCode = LD.Code;
                            details.DeoParticipantId = Deo.ParticipantId;
                            details.RegionParticipantId = Region.ParticipantId;
                            details.RegionIslandCode = Region.IslandCode;
                            details.ImplementingOfficeParticipantId = ImplementingOffice.ParticipantId;
                            details.OperatingUnitParticipantId = OperatingUnit.ParticipantId;
                        }
                    }
                }
            }

            var RegionWide = cache.RegionWides.FirstOrDefault(x => NamesMatch(x.Name, details.RegionWide));
            if (RegionWide == null)
            {
                v.Fail("Incorrect Region Wide");
            }
            var Origin = cache.Origins.FirstOrDefault(x => NamesMatch(x.Name, details.Origin));
            if (Origin == null)
            {
                v.Fail("Incorrect Origin");
            }
            var Agency = cache.Agencies.FirstOrDefault(x => NamesMatch(x.Name, details.Agency));
            if (Agency == null)
            {
                v.Fail("Incorrect Agency");
            }
            var ImplementationMode = cache.ImplementationModes.FirstOrDefault(x => NamesMatch(x.Name, details.ImplementationMode));
            if (ImplementationMode == null)
            {
                v.Fail("Incorrect Implementation Mode");
            }
            var EmergencyMode = cache.EmergencyModes.FirstOrDefault(x => NamesMatch(x.Name, details.EmergencyMode));
            if (EmergencyMode == null)
            {
                v.Fail("Incorrect Emergency Mode");
            }
            var RowAvailable = cache.RowAvailables.FirstOrDefault(x => NamesMatch(x.Name, details.RowAvailable));
            if (RowAvailable == null)
            {
                v.Fail("Incorrect Row Available");
            }
            var Feasibility = cache.FeasibilityStudies.FirstOrDefault(x => NamesMatch(x.Name, details.Feasibility));
            if (Feasibility == null)
            {
                v.Fail("Incorrect Feasibility");
            }
            else
            {
                if (details.Feasibility.Trim().Equals("YES", StringComparison.OrdinalIgnoreCase))
                {
                    if (details.FeasibilityDate != null)
                    {
                        bool isValidDate = DateTime.TryParse(details.FeasibilityDate, out _);
                        if (!isValidDate)
                        {
                            v.Warn("Incorrect Feasibility Date");
                        }
                    }
                    else
                    {
                        v.Warn("Incorrect Feasibility Date");
                    }
                }
                else if (details.Feasibility.Trim().Equals("NO", StringComparison.OrdinalIgnoreCase))
                {
                    if (details.FeasibilityDate != null)
                    {
                        v.Warn("Incorrect Feasibility Date");
                    }
                }
            }
            var DetailedDesign = cache.DetailedDesigns.FirstOrDefault(x => NamesMatch(x.Name, details.DetailedDesign));
            if (DetailedDesign == null)
            {
                v.Fail("Incorrect Detailed Design");
            }
            else
            {
                if (details.DetailedDesign.Trim().Equals("YES", StringComparison.OrdinalIgnoreCase))
                {
                    if (details.DetailedDesignDate != null)
                    {
                        bool isValidDate = DateTime.TryParse(details.DetailedDesignDate, out _);

                        if (!isValidDate)
                        {
                            v.Warn("Incorrect Detailed Design Date");
                        }
                    }
                    else
                    {
                        v.Warn("Incorrect Detailed Design Date");
                    }
                }
                else if (details.DetailedDesign.Trim().Equals("NO", StringComparison.OrdinalIgnoreCase))
                {
                    if (details.DetailedDesignDate != null)
                    {
                        v.Warn("Incorrect Detailed Design Date");
                    }
                }
            }
            if (details.Rank != null)
            {
                bool isValidRank = decimal.TryParse(details.Rank, out _);
                if (!isValidRank)
                {
                    v.Warn("Incorrect Rank");
                }
            }
            details.ErrorMessage = v.Message;
            if (v.IsValid)
            {
                details.TierNameId = Tier.NameId;
                details.CategoryCategoryId = Category.CategoryId;
                details.ThrustPAPKey = Thrust.PAPKey;
                details.OriginNameId = Origin.NameId;
                details.ProvinceCode = Province.Code;
                details.RegionWideNameId = RegionWide.NameId;
                details.OriginNameId = Origin.NameId;
                details.AgencyNameId = Agency.NameId;
                details.ImplementationModeNameId = ImplementationMode.NameId;
                details.EmergencyModeNameId = EmergencyMode.NameId;
                details.RowAvailableNameId = RowAvailable.NameId;
                details.FeasibilityNameId = Feasibility.NameId;
                details.DetailedDesignNameId = DetailedDesign.NameId;
            }

            return new ValidateProjectDetailsResponse { IsValid = v.IsValid, Message = v.Message, IsWarning = v.IsWarning };
        }
        #endregion
        #region Validation - Funding Profile
        public class ValidateFundingProfileResponse : ValidationResponse
        { }
        public static ValidateFundingProfileResponse ValidateFundingProfile(this MYPSDbContext _db,
            ImportFundingProfileExcel details, ImportLookupCache cache)
        {
            var v = new ValidationState();

            var Agreement = cache.FundingAgreements.FirstOrDefault(x => NamesMatch(x.Name, details.Agreement));
            if (Agreement == null)
            {
                v.Fail("Incorrect Funding Agreement");
            }
            var Source = cache.FundingSources.FirstOrDefault(x => NamesMatch(x.Name, details.Source));
            if (Source == null)
            {
                v.Fail("Incorrect Funding Source");
            }
            else
            {
                if (Agreement != null)
                {
                    if (Source.Organization != Agreement.SourceOrg)
                    {
                        v.Fail($"Funding Source '{details.Source}' does not match the required source organization for Agreement '{details.Agreement}'. Expected Source Organization: '{Agreement.SourceOrg}'");
                    }
                }
            }
            decimal amountValue;
            bool isValidAmount = decimal.TryParse(details.Amount, NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"), out amountValue);
            if (!isValidAmount)
            {
                v.Fail("Incorrect Amount");
            }
            details.ErrorMessage = v.Message;
            if (v.IsValid)
            {
                details.Amount = amountValue.ToString();
                details.AgreementCode = Agreement.Code;
                details.SourceOrg = Source.Organization;
            }
            return new ValidateFundingProfileResponse { IsValid = v.IsValid, Message = v.Message, IsWarning = v.IsWarning };
        }
        #endregion
        #region Validation - Component Details
        public class ValidateComponentDetailsResponse : ValidationResponse
        { }
        public static ValidateComponentDetailsResponse ValidateComponentDetails(this MYPSDbContext _db, ImportComponentDetailsExcel details, List<ImportComponentDetailsExcel> componentCosts, ImportLookupCache cache)
        {
            var v = new ValidationState();

            var Component = cache.Components.FirstOrDefault(x => NamesMatch(x.ComponentName, details.ComponentType));

            if (Component == null)
            {
                v.Fail("Incorrect Component Type");
            }
            else
            {
                bool isCivilWorks = Component.ComponentName.Equals("Civil Works", StringComparison.OrdinalIgnoreCase);
                string componentId = details.ComponentId?.Trim() ?? string.Empty;

                if (componentId.Length < 2)
                {
                    // Too short to be a valid component ID.
                    v.Fail("Incorrect Component ID");
                }
                else if (componentId == Component.ComponentId)
                {
                    // Exact base code — only allowed for non-Civil-Works components,
                    // since Civil Works requires the numbered suffix scheme below.
                    if (isCivilWorks)
                        v.Fail("Incorrect Component ID");
                }
                else if (!isCivilWorks)
                {
                    // Any non-exact ID is invalid unless the component is Civil Works.
                    v.Fail("Incorrect Component ID");
                }
                else if (componentId.Substring(0, 2) != "CW")
                {
                    v.Fail("Incorrect Component ID");
                }
                else
                {
                    // Civil Works allows a numbered suffix, e.g. "CW1", "CW2", ...
                    string excessOfComponentId = componentId.Substring(Component.ComponentId.Length);
                    if (excessOfComponentId.Length > 0)
                    {
                        if (!int.TryParse(excessOfComponentId, out int cntNumber))
                        {
                            v.Fail("Incorrect Component ID");
                        }
                        else
                        {
                            // Check if correct numbering
                            int existingCount = componentCosts.Count(x => x.ProjectId == details.ProjectId && NamesMatch(x.ComponentType, details.ComponentType));
                            if (cntNumber > existingCount)
                            {
                                v.Fail("Incorrect Component ID");
                            }
                        }
                    }
                }
            }
            decimal costValue;
            bool isValidCost = decimal.TryParse(details.Cost, NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"), out costValue);
            if (!isValidCost)
            {
                v.Fail("Incorrect Cost");
            }
            DateTime? startDateValue = null, endDateValue = null;
            if (!string.IsNullOrWhiteSpace(details.StartDate))
            {
                bool isValidStartDate = DateTime.TryParse(details.StartDate, out var parsedStartDate);
                if (!isValidStartDate)
                {
                    v.Warn("Incorrect Planned Start Date");
                }
                else
                {
                    startDateValue = parsedStartDate;
                }
            }
            if (!string.IsNullOrWhiteSpace(details.EndDate))
            {
                bool isValidEndDate = DateTime.TryParse(details.EndDate, out var parsedEndDate);
                if (!isValidEndDate)
                {
                    v.Warn("Incorrect Planned End Date");
                }
                else
                {
                    endDateValue = parsedEndDate;
                }
            }
            var InfraType = cache.InfraTypes.FirstOrDefault(x => NamesMatch(x.InfraName, details.InfraType));
            if (InfraType == null)
            {
                v.Fail("Incorrect Infrastructure Type");
            }
            var ScopeOfWork = cache.ScopeOfWorks.Where(x => NamesMatch(x.Description, details.WorkTypeId)).ToList();
            if (ScopeOfWork.Count == 0)
            {
                v.Fail("Incorrect Work Type");
            }
            int? ScopeOfWorkEnum = null;
            if (InfraType != null && ScopeOfWork.Count > 0)
            {
                var matchedScope = ScopeOfWork.FirstOrDefault(x => x.InfraType.Contains(InfraType.InfraCode));
                if (matchedScope != null)
                {
                    ScopeOfWorkEnum = matchedScope.Enum;
                }
                else
                {
                    v.Fail($"The selected Work Type '{details.WorkTypeId}' is not valid for the selected Infrastructure Type '{details.InfraType}'. Please select a valid Work Type for the Infra Type");
                }
            }
            bool isValidActiveYear = ValidateYear(details.ActiveYear, out int activeYearValue);
            if (!isValidActiveYear)
            {
                v.Fail("Incorrect Activity Year");
            }

            // ── Date range cross-check: only runs when ActiveYear, StartDate, and EndDate
            // are ALL individually valid (StartDate/EndDate are otherwise optional fields,
            // so this never fires just because one of them was left blank).
            if (isValidActiveYear && startDateValue.HasValue && endDateValue.HasValue)
            {
                if (endDateValue.Value.Date < startDateValue.Value.Date)
                {
                    v.Warn("Planned End Date cannot be earlier than Planned Start Date");
                }
                if (startDateValue.Value.Year < activeYearValue)
                {
                    v.Warn("Planned Start Date cannot be earlier than the Active Year");
                }
                if (endDateValue.Value.Year < activeYearValue)
                {
                    v.Warn("Planned End Date cannot be earlier than the Active Year");
                }
            }
            details.ErrorMessage = v.Message;
            if (v.IsValid)
            {
                details.Cost = costValue.ToString();
                details.ScopeOfWorkEnum = ScopeOfWorkEnum; // tProjectMajorWorkItem.WorkTypeFK
                details.InfraTypeInfraCode = InfraType.InfraCode; // tProjectMajorWorkItem.InfraTypeFK
            }
            return new ValidateComponentDetailsResponse { IsValid = v.IsValid, Message = v.Message, IsWarning = v.IsWarning };
        }
        #endregion
        #region Validation - Major Items of Work
        public class ValidateMajorItemsOfWorkResponse : ValidationResponse
        { }
        public static ValidateMajorItemsOfWorkResponse ValidateMajorItemsOfWork(this MYPSDbContext _db, ImportMajorItemsOfWorkExcel details, List<ImportComponentDetailsExcel> componentCost, ImportLookupCache cache)
        {
            var v = new ValidationState();

            var Component = componentCost.FirstOrDefault(x => x.ProjectId == details.ProjectId && x.ComponentId == details.ComponentId);

            if (Component == null)
            {
                v.Fail("Incorrect Component ID");
            }
            string refId = string.Format("{0}-{1}", details.ProjectId, details.ComponentId);
            if (refId != details.ReferenceId)
            {
                v.Warn("Incorrect Reference ID");
            }
            if (string.IsNullOrWhiteSpace(details.InfrastructureId))
            {
                v.Fail("Incorrect Infrastructure ID");
            }

            // ── Special case: Roads items whose Infrastructure ID starts with 'S', and
            // Bridges items whose Infrastructure ID starts with 'B', relax PhysicalTarget
            // from a hard failure to a warning, and expect additional station/chainage/
            // length data (checked further below, also warning-only).
            bool isRoadsSCase = Component != null
                && NamesMatch(Component.InfraType, "Roads")
                && (details.InfrastructureId?.Trim().StartsWith("S", StringComparison.OrdinalIgnoreCase) ?? false);

            bool isBridgesBCase = Component != null
                && NamesMatch(Component.InfraType, "Bridges")
                && (details.InfrastructureId?.Trim().StartsWith("B", StringComparison.OrdinalIgnoreCase) ?? false);

            string workTypeId = Component != null ? Component.WorkTypeId : "";
            var TargetUnit = cache.ScopeOfWorks.FirstOrDefault(x => x.Description == workTypeId && NamesMatch(x.Measure, details.TargetUnit));
            if (TargetUnit == null)
            {
                v.Fail("Incorrect Target Unit");
            }
            // ── StartX/StartY/EndX/EndY only apply outside the Roads-S / Bridges-B
            // special cases, which use Station/Chainage instead of X/Y coordinates.
            if (!isRoadsSCase && !isBridgesBCase)
            {
                if (details.StartX != null)
                {
                    bool isValidStartX = double.TryParse(details.StartX, out var startXVal);
                    if (!isValidStartX)
                    {
                        v.Warn("Incorrect Start X");
                    }
                    else
                    {
                        if (!(startXVal >= 116.66666666666666 && startXVal <= 126.59666666666665))
                        {
                            v.Warn("Start X Range: 116.66666666666666 - 126.59666666666665");
                        }
                    }
                }
                if (details.StartY != null)
                {
                    bool isValidStartY = double.TryParse(details.StartY, out var startYVal);
                    if (!isValidStartY)
                    {
                        v.Warn("Incorrect Start Y");
                    }
                    else
                    {
                        if (!(startYVal >= 4.666666666666666 && startYVal <= 21.166666666666668))
                        {
                            v.Warn("Start Y Range: 4.666666666666666 - 21.166666666666668");
                        }
                    }
                }
                if (details.EndX != null)
                {
                    bool isValidEndX = double.TryParse(details.EndX, out var endXVal);
                    if (!isValidEndX)
                    {
                        v.Warn("Incorrect End X");
                    }
                    else
                    {
                        if (!(endXVal >= 116.66666666666666 && endXVal <= 126.59666666666665))
                        {
                            v.Warn("End X Range: 116.66666666666666 - 126.59666666666665");
                        }
                    }
                }
                if (details.EndY != null)
                {
                    bool isValidEndY = double.TryParse(details.EndY, out var endYVal);
                    if (!isValidEndY)
                    {
                        v.Warn("Incorrect End Y");
                    }
                    else
                    {
                        if (!(endYVal >= 4.666666666666666 && endYVal <= 21.166666666666668))
                        {
                            v.Warn("End Y Range: 4.666666666666666 - 21.166666666666668");
                        }
                    }
                }
            }
            if (details.PhysicalTarget != null)
            {
                bool isValidPhysicalTarget = decimal.TryParse(details.PhysicalTarget, out _);
                if (!isValidPhysicalTarget)
                {
                    v.Warn("Incorrect Physical Target");
                }
            }
            if (details.StartChainage != null)
            {
                bool isValidStartChainage = decimal.TryParse(details.StartChainage, out _);
                if (!isValidStartChainage)
                {
                    v.Warn("Incorrect Start Chainage");
                }
            }
            if (details.EndChainage != null)
            {
                bool isValidEndChainage = decimal.TryParse(details.EndChainage, out _);
                if (!isValidEndChainage)
                {
                    v.Warn("Incorrect End Chainage");
                }
            }
            if (details.Length != null)
            {
                bool isValidLength = decimal.TryParse(details.Length, out _);
                if (!isValidLength)
                {
                    v.Warn("Incorrect Length");
                }
            }
            // ── Same special case as above: Roads items whose Infrastructure ID starts with
            // 'S', and Bridges items whose Infrastructure ID starts with 'B', have additional
            // expected fields. Every check in this block is warning-only by design — it never
            // fails the record, only flags missing/invalid supplementary data.
            if (isRoadsSCase)
            {
                if (details.StartStation == null)
                {
                    v.Warn("Incorrect Start Chainage");
                }
                if (details.EndStation == null)
                {
                    v.Warn("Incorrect End Chainage");
                }
            }

            bool isValidActivityYear = ValidateYear(details.ActivityYear, out int activityYearValue);
            if (!isValidActivityYear)
            {
                v.Fail("Incorrect Activity Year");
            }
            else if (Component != null && ValidateYear(Component.ActiveYear, out int componentActiveYearValue))
            {
                if (activityYearValue < componentActiveYearValue)
                {
                    v.Fail($"Activity Year ({activityYearValue}) cannot be earlier than the Component's Active Year ({componentActiveYearValue})");
                }
            }
            details.ErrorMessage = v.Message;
            if (v.IsValid)
            {
                details.TargetUnitId = TargetUnit.Id;
            }
            return new ValidateMajorItemsOfWorkResponse { IsValid = v.IsValid, Message = v.Message, IsWarning = v.IsWarning };
        }
        #endregion
        #region Save - Project Details
        public class SaveProjectResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Project.Projects Project { get; set; } = new DBHelper.Models.Table.Project.Projects();
            public DBHelper.Models.Table.Project.ProjectRevisions ProjectRevision { get; set; } = new DBHelper.Models.Table.Project.ProjectRevisions();
            public DBHelper.Models.Table.Project.ProjectStages ProjectStage { get; set; } = new DBHelper.Models.Table.Project.ProjectStages();
            public ImportProjectReference ImportReference { get; set; } = new ImportProjectReference();
        }
        public static async Task<SaveProjectResponse> SaveProjectDetails(this MYPSDbContext _db, DBHelper.Models.Functions.Program.ProgramDetails ProgramDetails, ImportProjectDetailsExcel details, List<ImportProjectReference> Saved, CancellationToken cancellationToken)
        {
            var Request = new GenerateProjectIDParams
            {
                CategoryId = (int)details.CategoryCategoryId!,
                StageName = ProgramDetails.StageName,
                IslandCode = details.RegionIslandCode!,
                YearStart = ProgramDetails.StartYear,
                Count = 1
            };

            string ProjectPK = await _db.GenerateProjectID(Request, cancellationToken);

            var ImportRef = new ImportProjectReference();

            ImportRef.OldProjectFK = details.ProjectId;
            ImportRef.NewProjectFK = ProjectPK;

            string ProgramId = ProgramDetails.ProgramId;
            string ProgramFK = ProgramDetails.ProgramPK;

            var NewProject = new DBHelper.Models.Table.Project.Projects
            {
                ProjectPK = ProjectPK,
                ProgramFK = ProgramFK,
                ProgramId = ProgramId,
                ExternalId = details.ExternalId,
                MYId = details.MYId,
                ProjectType = string.Empty,
                IsPublished = false,
                IsRevised = false,
                IsPublishable = false,
                PCMARevisionCount = 0
            };
            var NewProjectRevision = new DBHelper.Models.Table.Project.ProjectRevisions
            {
                ProjectFK = ProjectPK,
                ProgramFK = ProgramFK,
                ProgramId = ProgramId,
                ProjectId = ProjectPK,
                AlternateId = details.ProjectId,
                MYCAApprovalDate = string.IsNullOrWhiteSpace(details.MYCAApprovalDate) ? null : DateTime.TryParse(details.MYCAApprovalDate, out _) ? details.MYCAApprovalDate.StringToDate() : null,
                Description = details.Description!,
                Category = (int)details.CategoryCategoryId,
                Thrust = details.ThrustPAPKey,
                Origin = (int)details.OriginNameId!,
                City = details.CityCode!,
                Province = details.ProvinceCode!,
                LegislativeDistrict = details.LDCode!,
                OperatingUnit = details.OperatingUnitParticipantId!,
                ImplementingOffice = details.ImplementingOfficeParticipantId!,
                DEO = details.DeoParticipantId!,
                Region = details.RegionParticipantId!,
                Agency = (int)details.AgencyNameId!,
                ImplementationMode = details.ImplementationModeNameId,
                EmergencyMode = details.EmergencyModeNameId!,
                IslandCode = details.RegionIslandCode!,
                Feasibility = details.FeasibilityNameId,
                FeasibilityDate = string.IsNullOrWhiteSpace(details.FeasibilityDate) ? null : DateTime.TryParse(details.FeasibilityDate, out _) ? details.FeasibilityDate.StringToDate() : null,
                DetailedDesign = details.DetailedDesignNameId!,
                DetailedDesignDate = string.IsNullOrWhiteSpace(details.DetailedDesignDate) ? null : DateTime.TryParse(details.DetailedDesignDate, out _) ? details.DetailedDesignDate.StringToDate() : null,
                RowAvailable = details.RowAvailableNameId!,
                RegionWide = (int)details.RegionWideNameId!,
                Tier = (int)details.TierNameId!,
                Rank = string.IsNullOrWhiteSpace(details.Rank) ? null : double.TryParse(details.Rank, out var rank) ? rank : null,
                IsDeleted = false
            };
            var ProjectStage = new DBHelper.Models.Table.Project.ProjectStages
            {
                ProjectFK = ProjectPK,
                ProgramFK = ProgramFK,
                ProgramId = ProgramDetails.ProgramId,
                RevisionId = 0,
                StageId = (EnumProgramStage)ProgramDetails.StageId,
                StageName = ProgramDetails.StageName
            };
            return new SaveProjectResponse { IsValid = true, Message = string.Empty, Project = NewProject, ProjectRevision = NewProjectRevision, ProjectStage = ProjectStage, ImportReference = ImportRef };
        }
        #endregion
        #region Save - Funding Profile
        public class SaveFundingProfileResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Project.ProjectFundingProfile FundingProfile { get; set; } = new DBHelper.Models.Table.Project.ProjectFundingProfile();
        }
        public static SaveFundingProfileResponse SaveFundingProfile(this MYPSDbContext _db, ImportFundingProfileExcel details, ImportProjectReference ProjectRef)
        {
            var NewProjectId = ProjectRef.NewProjectId;
            var FundingProfile = new DBHelper.Models.Table.Project.ProjectFundingProfile
            {
                ProjectRevisionFK = NewProjectId,
                SourceOrg = details.SourceOrg!,
                AgreementCode = details.AgreementCode!,
                Percentage = details.Percentage,
                Amount = decimal.Parse(details.Amount),
                IsDeleted = false
            };
            return new SaveFundingProfileResponse { IsValid = true, Message = string.Empty, FundingProfile = FundingProfile };
        }
        #endregion
        #region Save - Component Cost
        public class SaveComponentDetailsResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Project.ProjectComponentCost ComponentCost { get; set; } = new DBHelper.Models.Table.Project.ProjectComponentCost();
        }
        public static SaveComponentDetailsResponse SaveComponentCost(this MYPSDbContext _db, ImportComponentDetailsExcel details, ImportProjectReference ProjectRef)
        {
            var NewProject = ProjectRef.NewProjectId;
            var ComponentCostProfile = new DBHelper.Models.Table.Project.ProjectComponentCost
            {
                ProjectRevisionFK = NewProject,
                ComponentType = details.ComponentType, // sample: Civil Works
                ComponentId = details.ComponentId, // sample: CW1
                Description = details.Description,
                Total = decimal.Parse(details.Cost),
                IsDeleted = false
            };

            return new SaveComponentDetailsResponse { IsValid = true, Message = string.Empty, ComponentCost = ComponentCostProfile };
        }
        #endregion
        #region Save - Component Cost Per Year
        public class SaveComponentCostPerYearResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Project.ProjectComponentCostPerYear ComponentCostPerYear { get; set; } = new DBHelper.Models.Table.Project.ProjectComponentCostPerYear();
        }
        public static SaveComponentCostPerYearResponse SaveComponentCostPerYear(this MYPSDbContext _db, ImportComponentDetailsExcel details, ImportComponentReference ComponentRef, string? Uacs)
        {
            DateTime? strStartDate = null, strEndDate = null;
            if (!string.IsNullOrWhiteSpace(details.StartDate))
            {
                bool isValidStartDate = DateTime.TryParse(details.StartDate, out var startDate);
                if (isValidStartDate) strStartDate = startDate;
            }
            if (!string.IsNullOrWhiteSpace(details.EndDate))
            {
                bool isValidEndDate = DateTime.TryParse(details.EndDate, out var endDate);
                if (isValidEndDate) strEndDate = endDate;
            }
            var NewComponentId = ComponentRef.NewComponentId;
            var ComponentCostPerYearProfile = new DBHelper.Models.Table.Project.ProjectComponentCostPerYear
            {
                ComponentCostFK = NewComponentId,
                ComponentId = details.ComponentId,
                Amount = decimal.Parse(details.Cost),
                Year = int.Parse(details.ActiveYear),
                UACS = Uacs,
                StartDate = strStartDate,
                EndDate = strEndDate,
                IsDeleted = false
            };

            return new SaveComponentCostPerYearResponse { IsValid = true, Message = string.Empty, ComponentCostPerYear = ComponentCostPerYearProfile };
        }
        #endregion
        #region Save - Major Work Item
        public class SaveMajorWorkItemResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Project.ProjectMajorWorkItem MajorWorkItem { get; set; } = new DBHelper.Models.Table.Project.ProjectMajorWorkItem();
        }
        public static SaveMajorWorkItemResponse SaveMajorItemsOfWork(this MYPSDbContext _db, ImportMajorItemsOfWorkExcel details, ImportComponentReference ComponentRef)
        {
            int NewComponentId = ComponentRef.NewComponentId;
            int WorkTypeFK = ComponentRef.WorkTypeFK;
            string InfraTypeFK = ComponentRef.InfraTypeFK;

            var MajorWorkItemProfile = new DBHelper.Models.Table.Project.ProjectMajorWorkItem
            {
                ComponentCostFK = NewComponentId,
                ComponentId = details.ComponentId,
                YearOfWork = int.Parse(details.ActivityYear),
                WorkTypeFK = WorkTypeFK,
                InfraTypeFK = InfraTypeFK,
                IsDeleted = false
            };

            return new SaveMajorWorkItemResponse { IsValid = true, Message = string.Empty, MajorWorkItem = MajorWorkItemProfile };
        }
        #endregion
        #region Save - Major Work Location
        public class SaveMajorWorkLocationResponse : ValidationResponse
        {
            public DBHelper.Models.Table.Project.ProjectMajorWorkLocations MajorWorkLocation { get; set; } = new DBHelper.Models.Table.Project.ProjectMajorWorkLocations();
        }
        public static SaveMajorWorkLocationResponse SaveMajorWorkLocation(this MYPSDbContext _db, ImportMajorItemsOfWorkExcel details, ImportMajorWorkItemReference WorkRef)
        {
            double? startXVal = null, startYVal = null, endXVal = null, endYVal = null;
            if (details.StartX != null)
            {
                bool isValidStartX = double.TryParse(details.StartX, out var startX);
                if (isValidStartX)
                {
                    if (startX >= 116.66666666666666 && startX <= 126.59666666666665)
                        startXVal = startX;
                }
            }
            if (details.StartY != null)
            {
                bool isValidStartY = double.TryParse(details.StartY, out var startY);
                if (isValidStartY)
                {
                    if (startY >= 4.666666666666666 && startY <= 21.166666666666668)
                        startYVal = startY;
                }
            }
            if (details.EndX != null)
            {
                bool isValidEndX = double.TryParse(details.EndX, out var endX);
                if (isValidEndX)
                {
                    if (endX >= 116.66666666666666 && endX <= 126.59666666666665)
                        endXVal = endX;
                }
            }
            if (details.EndY != null)
            {
                bool isValidEndY = double.TryParse(details.EndY, out var endY);
                if (isValidEndY)
                {
                    if (endY >= 4.666666666666666 && endY <= 21.166666666666668)
                        endYVal = endY;
                }
            }
            double? lengthVal = null, startChainageVal = null, endChainageVal = null;
            if (details.Length != null)
            {
                bool isValidLength = double.TryParse(details.Length, out var length);
                if (isValidLength) lengthVal = length;
            }
            if (details.StartChainage != null)
            {
                bool isValidStartChainage = double.TryParse(details.StartChainage, out var startChainage);
                if (isValidStartChainage) startChainageVal = startChainage;
            }
            if (details.EndChainage != null)
            {
                bool isValidEndChainage = double.TryParse(details.EndChainage, out var endChainage);
                if (isValidEndChainage) endChainageVal = endChainage;
            }
            //string? startStationVal = null, endStationVal = null;
            //if (details.StartStation != null)
            //{
            //    bool isValidStartStation = double.TryParse(details.StartStation, out var startStation);
            //    if (isValidStartStation) startStationVal = string.Format("{0:N}", startStation);
            //}
            //if (details.EndStation != null)
            //{
            //    bool isValidEndStation = double.TryParse(details.EndStation, out var endStation);
            //    if (isValidEndStation) endStationVal = string.Format("{0:N}", endStation);
            //}

            int NewComponentId = WorkRef.NewWorkItem;

            var MajorWorkLocationProfile = new DBHelper.Models.Table.Project.ProjectMajorWorkLocations
            {
                WorkItemFK = NewComponentId,
                ComponentId = details.ComponentId,
                InfraId = details.InfrastructureId,
                DetailedScope = details.DetailsScope,
                TargetUnitId = (int)details.TargetUnitId!,
                TargetUnit = details.TargetUnit,
                StartX = startXVal,
                StartY = startYVal,
                EndX = endXVal,
                EndY = endYVal,
                PhysicalTarget = double.Parse(details.PhysicalTarget),
                StartStationLimit = details.StartStation,
                EndStationLimit = details.EndStation,
                StartChainage = startChainageVal,
                EndChainage = endChainageVal,
                Length = lengthVal,
                IsDeleted = false
            };

            return new SaveMajorWorkLocationResponse { IsValid = true, Message = string.Empty, MajorWorkLocation = MajorWorkLocationProfile };
        }
        #endregion
        #region Program Validation
        public class IsValidProgramIdResponse : ValidationResponse
        {
            public DBHelper.Models.Functions.Program.ProgramDetails ProgramDetails { get; set; } = new DBHelper.Models.Functions.Program.ProgramDetails();
        }
        public static async Task<IsValidProgramIdResponse> IsValidProgramId(this MYPSDbContext _db, string ProgramID, string StageName)
        {
            var CheckProgram = _db.vProgramLatest.AsNoTracking().FirstOrDefault(x => x.ProgramPK == ProgramID);
            if (CheckProgram == null)
            {
                return new IsValidProgramIdResponse { IsValid = false, Message = $"ProgramID: {ProgramID} does not exist." };
            }
            else if (CheckProgram.StageName != StageName)
            {
                return new IsValidProgramIdResponse { IsValid = false, Message = $"The provided stage '{StageName}' does not match the latest stage for Program '{ProgramID}'. Current stage: '{CheckProgram.StageName}'" };
            }

            var GetStageId = _db.tOptionProgramStage.AsNoTracking().FirstOrDefault(x => x.Name == StageName);

            var Details = await _db.fProgramDetails.FromSqlInterpolated($"SELECT * FROM fProgramDetails({ProgramID}, {GetStageId.NameId})").AsNoTracking().FirstOrDefaultAsync();

            if (Details == null)
            {
                return new IsValidProgramIdResponse { IsValid = false, Message = $"Program details not found for ProgramID: {ProgramID} at Stage: {StageName}." };
            }
            return new IsValidProgramIdResponse { IsValid = true, Message = string.Empty, ProgramDetails = Details };
        }
        #endregion
        public static async Task<string> GenerateProjectID(this MYPSDbContext _db, GenerateProjectIDParams request, CancellationToken cancellationToken)
        {
            string FirstSegment = request.StageName.GenerateProjec1stSegment();
            string SecondSegment = request.YearStart.GenerateProjec2ndSegment();

            //var existingMaxIds = _db.vGetProjectCategoryVersions.AsNoTracking()
            //    .Where(x => x.Category == Category.CategoryId
            //        && x.ProjectSuffix == FirstSegment
            //        && x.IslandCode == IslandCode
            //        && x.YearStart == ProgramDetails.YearStart)
            //    .OrderByDescending(x => x.MaxId)
            //    .FirstOrDefault();
            //int maxExisting = (existingMaxIds != null) ? existingMaxIds.MaxId : (_db.tOptionProjectCategory.FirstOrDefault(x => x.CategoryId == Category.CategoryId)!.Minimum);


            //int nextId = Math.Max(maxExisting + 1, Category.Minimum);
            //string ThirdSegment = nextId.ToString("D5");

            var param = new Dictionary<string, object>
            {
                { "@ProjectSuffix", FirstSegment },
                { "@CategoryId", request.CategoryId },
                { "@YearStart", request.YearStart },
                { "@IslandCode", request.IslandCode }
            };
            var results = await _db.Database
            .SqlQuery<string>($@"EXEC dbo.pGenerateThirdSegment 
                @ProjectSuffix = {FirstSegment}, 
                @CategoryId = {request.CategoryId}, 
                @YearStart = {request.YearStart}, 
                @IslandCode = {request.IslandCode}")
            .ToListAsync(cancellationToken);

            string ThirdSegment = results.Single();

            //string ThirdSegment = await Sql.NormalQuery<string>(
            //    Appsetting.DbConnections.MYPSDb,
            //    "EXEC pGenerateThirdSegment @ProjectSuffix, @CategoryId, @YearStart, @IslandCode",
            //    param
            //).FirstOrDefaultAsync() ?? string.Empty;

            return $"{FirstSegment}-{SecondSegment}-{ThirdSegment}-{request.IslandCode}".Replace("-", "");
        }
    }
}