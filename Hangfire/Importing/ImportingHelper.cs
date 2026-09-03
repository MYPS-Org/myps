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
        // Component types with no physical infrastructure attributes — administrative/overhead
        // cost lines (EAO/EAOS), consultancy (CoS), studies/design (FS, DED), lump-sum (LS),
        // institutional-capacity items (OTH2-4), expired funding (EXP), construction supervision
        // (CS), excess/savings (EXC/SAV) — matched against tOptionProjectComponentType.ComponentId
        // codes. This is the SAME exemption list ImportErrorWorkbookBuilder.cs's client-side VBA
        // "Component -> Major Item" mandatory-fields macro already uses (mirroring the reference
        // template's own list) to warn a user when one of these components has no Major Item row —
        // that macro interpolates this exact set rather than hardcoding its own copy, so the two
        // stay in sync. Right of Way (ROW/ROW2) and Civil Works/Design (CW/CWD/DR) are deliberately
        // NOT included — those types do carry trackable physical/location items.
        public static readonly HashSet<string> NonPhysicalComponentTypeIds = new(StringComparer.OrdinalIgnoreCase)
        {
            "EAO", "EAOS", "EXC", "SAV", "COS", "FS", "DED", "LS", "OTH2", "OTH3", "OTH4", "EXP", "CS"
        };

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
        // public (not private): BuildComponentCostGroupTotals returns a per-row ValidationState
        // cache that ValidateComponentDetails reuses, so this type appears in those public method
        // signatures and needs matching accessibility.
        public sealed class ValidationState
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
        // ── Max value accepted for money fields (Amount, Cost) — matches the SQL
        // decimal(18,5) precision of their destination columns (tProjectFundingProfile.Amount,
        // tProjectComponentCost.Total, tProjectComponentCostPerYear.Amount). A value that parses
        // fine as a .NET decimal but exceeds this would otherwise pass validation and only fail
        // later at SaveChangesAsync with a raw ArgumentException, crashing the whole import job
        // instead of being reported as a normal per-row error.
        private const decimal MaxDecimal18_5 = 9999999999999.99999m;
        // decimal(18,5) constrains scale (5 fractional digits) as well as magnitude — a value
        // like 100.123456 is nowhere near MaxDecimal18_5 but still has more fractional digits
        // than the column allows, and would otherwise reach SQL Server and be silently rounded
        // on insert instead of being reported as a normal per-row import error.
        private static bool ExceedsDecimal18_5Scale(decimal value) => decimal.Round(value, 5) != value;
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

        // ── InfraCode -> auto-generated Infrastructure ID prefix ─────────────────────────
        // Mirrors FE/src/utils/infraIdGenerator.ts's getInfraTypePrefix() "Short InfraCodes
        // (from JSON InfraTypes)" map exactly (keys lowercased there; StringComparer here makes
        // that irrelevant). That FE function is the actual code that assigns a Work Location's
        // real Infrastructure ID when a user adds one in the main app for any type other than
        // Roads/Bridges (shouldAutoGenerateInfraId() returns false for those two — they use
        // RBIA's own inventory instead, handled separately via the Roads/Bridges special case in
        // ValidateMajorItemsOfWork, NOT via this table). Deliberately excludes InfraCode "R"/"B":
        // the FE map still lists 'r':'RD'/'b':'BR' for completeness, but that branch of
        // getInfraTypePrefix() is dead code in practice for Roads/Bridges — real IDs for those
        // two come from RBIA's own convention (Roads "S...", Bridges "B..."), not this generator.
        // The prefix is NOT simply the InfraCode itself — several diverge (e.g. Hospitals is
        // InfraCode "H" but every generated ID uses "HSP") — do not "simplify" this back to
        // reading InfraCode directly without re-checking infraIdGenerator.ts first.
        private static readonly Dictionary<string, string> InfraCodeToAutoGeneratedPrefix = new(StringComparer.OrdinalIgnoreCase)
        {
            { "AF", "AF" },
            { "CS", "CS" },
            { "DPW", "DPW" },
            { "DS", "DS" },
            { "FCS", "FCS" },
            { "H", "HSP" },
            { "LB", "LBR" },
            { "LFCS", "LFCS" },
            { "LR", "LRD" },
            { "LWW", "LWW" },
            { "MPB", "MPB" },
            { "NI", "NI" },
            { "OB", "OTB" },
            { "RS", "RSS" },
            { "RW", "RWC" },
            { "SB", "SCH" },
            { "SS", "SPS" },
            { "WS", "WSS" },
            { "WW", "WW" },
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
            // 2. Enforce only a generous upper sanity boundary. No lower bound here — a
            // lower bound tied to "today's calendar year" would collide with (and pre-empt)
            // the context-aware "cannot be earlier than the Program's Start Year" checks that
            // already run right after every call site: a Program's own StartYear can legitimately
            // predate the current year (verified against real data — e.g. a real Program with
            // StartYear 2016 whose ComponentCostPerYear/MajorWorkItem rows are all dated 2016),
            // and this function returning false for those years would block the more accurate
            // check from ever running, rejecting perfectly legitimate historical data with a
            // generic "Incorrect ... Year" message instead.
            int maxYear = Functions.CurrentDate().Year + 100;

            return year <= maxYear;
        }
        #region Validation - Project Details 
        public class ValidateProjectDetailsResponse : ValidationResponse
        { }
        public static ValidateProjectDetailsResponse ValidateProjectDetails(this MYPSDbContext _db, ImportProjectDetailsExcel details, ImportLookupCache cache, List<(string Description, string ProjectId)> existingProjectDescriptions, int programStartYear)
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
            // Matches the main app's exact rule (ProjectHelper.cs's ValidateProjectDetailsLookups):
            // valid if IsActive is true, REGARDLESS of ValidUntil — ValidUntil only matters when
            // IsActive is false. Previously this ignored IsActive entirely (this workbook's cache
            // loads every category unfiltered), which would incorrectly reject real IsActive
            // categories whose ValidUntil year has already passed — verified against real data:
            // 7 such categories exist (e.g. CategoryId=1 "MFO 1: National Road Network Services",
            // ValidUntil=2017, still IsActive=True), none currently used by a saved project but
            // fully selectable in the main app. Compared against the Program's own StartYear, not
            // today's calendar year — a Program can legitimately be for a past or future year, and
            // "was this Category valid in the Program's year" is the question that actually matters
            // for a row being imported into that Program.
            else if (!Category.IsActive && Category.ValidUntil != 0 && Category.ValidUntil < programStartYear)
            {
                v.Fail("Category is no longer valid");
            }
            var Thrust = cache.Thrusts.FirstOrDefault(x => NamesMatch(x.ThrustDescription, details.Thrust));
            if (Thrust == null)
            {
                v.Fail("Incorrect Thrust");
            }
            // Mirrors the FE dropdown's own window rule (ProjectDetailsForm.tsx: ValidToDate === 0
            // means "no expiry"; otherwise only ValidFromDate < year < ValidToDate is selectable) —
            // same shape as the Category.ValidUntil check above, including comparing against the
            // Program's StartYear rather than today's calendar year, for the same reason.
            else if (Thrust.ValidToDate != 0 && !(Thrust.ValidFromDate < programStartYear && Thrust.ValidToDate > programStartYear))
            {
                v.Fail("Selected Thrust is no longer valid");
            }
            // Thrust<->Category relation check excluded for now, along with CategoryId itself
            // (see OptionProjectThrustList.cs) — the column doesn't exist on the shared dev DB yet.
            if (string.IsNullOrWhiteSpace(details.Description))
            {
                v.Fail("Required Description");
            }
            // Mirrors the main app's own soft duplicate-Description check (ProjectController.cs's
            // GetSameDescription, scoped to the same Program, excluding the project's own existing
            // row). The main app can prompt a human to confirm and proceed anyway; an import has no
            // one to ask, so this is a Warn (still imports) rather than a Fail.
            else if (existingProjectDescriptions.Any(x => NamesMatch(x.Description, details.Description) && !NamesMatch(x.ProjectId, details.ProjectId)))
            {
                v.Warn($"Description '{details.Description}' already exists for another project in this Program");
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
                // Matches the main app's hard requirement (ProjectHelper.cs's
                // ValidateProjectDetailsLookups): Feasibility Date is required and cannot be in
                // the past when Feasibility Study is "Yes" — both are Fails here, not Warns,
                // since the main app blocks on both rather than merely flagging them. Confirmed
                // live against the real Add Project form (screenshot, 2026-09-04): the main app
                // genuinely rejects a past Feasibility Date today, so this is deliberate, current
                // behavior to mirror exactly — not a stale/unreachable rule. An earlier attempt to
                // compare against the Program's StartYear instead was reverted: real data shows
                // FeasibilityDate legitimately precedes StartYear (the study finishes before the
                // program starts), so that comparison direction doesn't fit this field either.
                if (details.Feasibility.Trim().Equals("YES", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(details.FeasibilityDate))
                    {
                        v.Fail("Feasibility Date is required when Feasibility Study is selected");
                    }
                    else
                    {
                        bool isValidDate = DateTime.TryParse(details.FeasibilityDate, out var feasibilityDateValue);
                        if (!isValidDate)
                        {
                            v.Warn("Incorrect Feasibility Date");
                        }
                        else if (feasibilityDateValue.Date < Functions.CurrentDate().Date)
                        {
                            v.Fail("Feasibility Date cannot be earlier than the current date");
                        }
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
                // Same parity rule as Feasibility Date above, matching the main app's *intended*
                // behavior (ProjectHelper.cs has a pre-existing bug where its own "required" guard
                // for this field never fires — left untouched per direction; this validator
                // enforces the rule correctly rather than reproducing that bug). Same "compare
                // against today, confirmed live against the real Add Project form" reasoning as
                // Feasibility Date above for the date-window check itself.
                if (details.DetailedDesign.Trim().Equals("YES", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(details.DetailedDesignDate))
                    {
                        v.Fail("Detailed Design Date is required when Detailed Design is selected");
                    }
                    else
                    {
                        bool isValidDate = DateTime.TryParse(details.DetailedDesignDate, out var detailedDesignDateValue);

                        if (!isValidDate)
                        {
                            v.Warn("Incorrect Detailed Design Date");
                        }
                        else if (detailedDesignDateValue.Date < Functions.CurrentDate().Date)
                        {
                            v.Fail("Detailed Design Date cannot be earlier than the current date");
                        }
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
            // Matches the main app's hard requirement (UpdateProjectDetails' BlankFunding
            // check): Amount must be a real positive value, not just parseable text.
            else if (amountValue <= 0)
            {
                v.Fail("Amount must be greater than zero");
            }
            // A value can parse fine as a decimal but still exceed the destination column's
            // SQL precision — catch that here instead of letting SaveChangesAsync crash the job.
            else if (amountValue > MaxDecimal18_5)
            {
                v.Fail("Amount exceeds the maximum allowed value");
            }
            else if (ExceedsDecimal18_5Scale(amountValue))
            {
                v.Fail("Amount has more than 5 decimal places, exceeding the allowed precision");
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
        // Builds the ProjectId+ComponentId -> summed Cost lookup consumed by the group-total
        // overflow check below, PLUS a per-row cache of ValidateComponentDetailsCore's own result
        // (keyed by row reference) so ValidateComponentDetails can reuse it instead of re-running
        // the same Component Type/ComponentId-format/duplicate-scan logic a second time for the
        // same row — that scan is itself O(componentCosts.Count), so recomputing it per row would
        // double the O(N^2) cost of validating a large file. Only sums rows that pass
        // ValidateComponentDetailsCore into the group total — a row that will be rejected for an
        // unrelated reason (bad ComponentType, bad ComponentId, a duplicate, etc.) is never
        // actually persisted (RunImportAsync only sums ValidComponentDetails+WarningComponentDetails
        // into tProjectComponentCost.Total), so it must not count toward whether some OTHER,
        // genuinely valid row in the same group gets wrongly flagged as exceeding the max.
        public static (Dictionary<string, decimal> GroupTotals, Dictionary<ImportComponentDetailsExcel, ComponentDetailsCoreResult> CoreByRow)
            BuildComponentCostGroupTotals(List<ImportComponentDetailsExcel> componentCosts, ImportLookupCache cache, int programStartYear)
        {
            var totals = new Dictionary<string, decimal>();
            var coreByRow = new Dictionary<ImportComponentDetailsExcel, ComponentDetailsCoreResult>();
            foreach (var group in componentCosts.GroupBy(x => ComponentCostGroupKey(x.ProjectId, x.ComponentId)))
            {
                decimal total = 0m;
                foreach (var row in group)
                {
                    var core = ValidateComponentDetailsCore(row, componentCosts, cache, programStartYear);
                    coreByRow[row] = core;
                    if (core.State.IsValid)
                        total += core.Cost;
                }
                totals[group.Key] = total;
            }
            return (totals, coreByRow);
        }

        private static string ComponentCostGroupKey(string? projectId, string? componentId)
            => (projectId ?? string.Empty) + "|" + (componentId?.Trim() ?? string.Empty).ToUpperInvariant();

        // Bundles ValidateComponentDetailsCore's full verdict: not just Pass/Fail, but every value
        // the outer ValidateComponentDetails needs to finish the row on success (Cost/ScopeOfWorkEnum/
        // InfraTypeInfraCode) — anything less than the FULL "would this row actually be persisted"
        // verdict here would let a row failing for a reason Core doesn't check (previously: InfraType/
        // WorkType/ActiveYear/dates) still count toward BuildComponentCostGroupTotals's group sum.
        public sealed class ComponentDetailsCoreResult
        {
            public required ValidationState State { get; init; }
            public decimal Cost { get; init; }
            public int? ScopeOfWorkEnum { get; init; }
            public string? InfraTypeInfraCode { get; init; }
        }

        // Everything ValidateComponentDetails checks EXCEPT the group-cost-total overflow check
        // itself (which needs this method's own pass/fail verdict to have already excluded
        // non-qualifying rows from the group sum in BuildComponentCostGroupTotals — see that
        // method's comment). This IS the full "would this row actually be persisted" determination,
        // so every check that can Fail the row belongs here, not in the outer method.
        private static ComponentDetailsCoreResult ValidateComponentDetailsCore(ImportComponentDetailsExcel details, List<ImportComponentDetailsExcel> componentCosts, ImportLookupCache cache, int programStartYear)
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

                // Matches the main app's hard rule for ComponentCostPerYear (UpdateProjectDetails'
                // "Duplicate Cost Per Year" check, ProjectController.cs ~line 1014): a duplicate is
                // (ComponentId, Year) both matching, NOT ComponentId alone. Two rows sharing a
                // ComponentId with DIFFERENT ActiveYear are legitimate — ImportProjectJobService's
                // save loop (RunImportAsync's Component Details section) already treats a repeated
                // ComponentId as "add another year" for the same component, consolidating them into
                // one ProjectComponentCost with multiple ProjectComponentCostPerYear children,
                // exactly mirroring the main app's own data model. Only the exact same
                // (ComponentId, Year) pair repeated is a real duplicate. Checked within this import
                // batch only, not against already-saved components for an existing project (Update
                // mode), which would need additional DB plumbing not added here.
                if (componentId.Length >= 2 && componentCosts.Any(x => !ReferenceEquals(x, details)
                    && x.ProjectId == details.ProjectId
                    && string.Equals(x.ComponentId?.Trim(), componentId, StringComparison.OrdinalIgnoreCase)
                    && string.Equals((x.ActiveYear ?? string.Empty).Trim(), (details.ActiveYear ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)))
                {
                    v.Fail($"Duplicate Component ID '{componentId}' for Year '{details.ActiveYear}' within Project '{details.ProjectId}'");
                }
            }
            bool isValidCost = decimal.TryParse(details.Cost, NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"), out var costValue);
            if (!isValidCost)
            {
                v.Fail("Incorrect Cost");
            }
            // Matches the main app's hard requirement (UpdateProjectDetails' "Invalid
            // Component Cost Amount" check): a new component's Total must be >= 1, not just
            // parseable text.
            else if (costValue < 1)
            {
                v.Fail("Cost must be at least 1");
            }
            // A value can parse fine as a decimal but still exceed the destination column's
            // SQL precision — catch that here instead of letting SaveChangesAsync crash the job.
            else if (costValue > MaxDecimal18_5)
            {
                v.Fail("Cost exceeds the maximum allowed value");
            }
            else if (ExceedsDecimal18_5Scale(costValue))
            {
                v.Fail("Cost has more than 5 decimal places, exceeding the allowed precision");
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
            // Component types with no physical infrastructure attributes (administrative overhead,
            // consultancy, studies, lump-sum, etc. — see NonPhysicalComponentTypeIds) never have an
            // Infrastructure Type/Type of Work: nothing in the DB stores it for them (that data only
            // ever lives on a Major Work Item sharing this ComponentId, and these types are the same
            // ones ImportErrorWorkbookBuilder.cs's client-side macro already knows never get one), so
            // requiring it here would hard-Fail every real row of these types — including a faithful
            // ExportProjects round-trip of already-valid data, which has nothing else to offer.
            bool infraTypeExempt = Component != null && NonPhysicalComponentTypeIds.Contains(Component.ComponentId);

            var InfraType = infraTypeExempt ? null : cache.InfraTypes.FirstOrDefault(x => NamesMatch(x.InfraName, details.InfraType));
            if (InfraType == null && !infraTypeExempt)
            {
                v.Fail("Incorrect Infrastructure Type");
            }
            var ScopeOfWork = infraTypeExempt ? new List<DBHelper.Models.Table.Lookups.OptionScopeOfWork>() : cache.ScopeOfWorks.Where(x => NamesMatch(x.Description, details.WorkTypeId)).ToList();
            if (ScopeOfWork.Count == 0 && !infraTypeExempt)
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
            // Explicit product decision: Activity Year must not be earlier than the Program's
            // Start Year, enforced as a hard Fail — even though UserManual.md's own CC-F05 entry
            // only documents this field as "pre-filled to Program Start Year" (no minimum stated,
            // unlike Major Items of Work's MIOW-F02), and real existing data contains rows that
            // predate their Program's StartYear. Those existing rows are exactly the kind of data
            // this check is meant to start catching going forward.
            bool isValidActiveYear = ValidateYear(details.ActiveYear, out int activeYearValue);
            if (!isValidActiveYear)
            {
                v.Fail("Incorrect Activity Year");
            }
            else if (activeYearValue < programStartYear)
            {
                v.Fail($"Activity Year ({activeYearValue}) cannot be earlier than the Program's Start Year ({programStartYear})");
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

            return new ComponentDetailsCoreResult { State = v, Cost = costValue, ScopeOfWorkEnum = ScopeOfWorkEnum, InfraTypeInfraCode = InfraType?.InfraCode };
        }

        public static ValidateComponentDetailsResponse ValidateComponentDetails(this MYPSDbContext _db, ImportComponentDetailsExcel details, List<ImportComponentDetailsExcel> componentCosts, ImportLookupCache cache, int programStartYear,
            (Dictionary<string, decimal> GroupTotals, Dictionary<ImportComponentDetailsExcel, ComponentDetailsCoreResult> CoreByRow) componentCostContext)
        {
            // Reuses the full verdict BuildComponentCostGroupTotals already computed for this exact
            // row (same reference, from the same componentCosts list) instead of re-running
            // ValidateComponentDetailsCore's Component Type/ComponentId/InfraType/WorkType/duplicate
            // scan a second time. Falls back to computing it directly only if the cache is somehow
            // missing this row (shouldn't happen when called with the list BuildComponentCostGroupTotals
            // was built from, but keeps this method correct even if it's ever called standalone).
            var core = componentCostContext.CoreByRow.TryGetValue(details, out var cached)
                ? cached
                : ValidateComponentDetailsCore(details, componentCosts, cache, programStartYear);
            var v = core.State;

            if (v.IsValid)
            {
                // RunImportAsync rolls every year-row sharing this ProjectId+ComponentId into
                // one tProjectComponentCost.Total (ExistingComponentCost.Total += ...), so several
                // rows that are each individually within range can still overflow decimal(18,5)
                // once summed. Mirrors the duplicate-ComponentId check above (same componentCosts
                // list, same ProjectId+ComponentId grouping) but across all years instead of one.
                string groupComponentId = details.ComponentId?.Trim() ?? string.Empty;
                decimal groupCostTotal = componentCostContext.GroupTotals.TryGetValue(
                    ComponentCostGroupKey(details.ProjectId, details.ComponentId), out var total) ? total : core.Cost;

                if (groupCostTotal > MaxDecimal18_5)
                {
                    v.Fail($"Total Cost for Component '{groupComponentId}' across all its year rows exceeds the maximum allowed value");
                }
            }

            details.ErrorMessage = v.Message;
            if (v.IsValid)
            {
                details.Cost = core.Cost.ToString();
                details.ScopeOfWorkEnum = core.ScopeOfWorkEnum; // tProjectMajorWorkItem.WorkTypeFK
                details.InfraTypeInfraCode = core.InfraTypeInfraCode; // tProjectMajorWorkItem.InfraTypeFK
            }
            return new ValidateComponentDetailsResponse { IsValid = v.IsValid, Message = v.Message, IsWarning = v.IsWarning };
        }
        #endregion
        #region Validation - Major Items of Work
        public class ValidateMajorItemsOfWorkResponse : ValidationResponse
        { }
        public static ValidateMajorItemsOfWorkResponse ValidateMajorItemsOfWork(this MYPSDbContext _db, ImportMajorItemsOfWorkExcel details, List<ImportComponentDetailsExcel> componentCost, List<ImportMajorItemsOfWorkExcel> allMajorItems, ImportLookupCache cache, int programStartYear)
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
            else if (Component != null)
            {
                // InfraNameToCode (built from AllInfraTypes, not IsActive-filtered InfraTypes) —
                // an Infrastructure ID's required prefix format doesn't depend on whether its type
                // is currently active; that's a separate rule already enforced elsewhere
                // (ValidateComponentDetails' "Incorrect Infrastructure Type" check). Dictionary
                // lookup instead of a per-row FirstOrDefault scan, since this runs once per
                // MajorItemsOfWork row.
                var infraCode = Component.InfraType != null
                    && cache.InfraNameToCode.TryGetValue(Component.InfraType.Trim(), out var resolvedInfraCode)
                        ? resolvedInfraCode
                        : null;
                // Roads/Bridges (InfraCode "R"/"B") are National types selected from RBIA's own
                // inventory rather than auto-generated — FE/src/utils/infraIdGenerator.ts's
                // shouldAutoGenerateInfraId() returns false for these two, so getInfraTypePrefix()
                // (and its 'r':'RD'/'b':'BR' entries) is never actually invoked for them. Hardcoded
                // here instead, confirmed against real location data: Roads IDs are RBIA Road
                // Section IDs ("S..."), Bridges IDs are RBIA Bridge IDs ("B..."). Every other
                // type's expected prefix comes from InfraCodeToAutoGeneratedPrefix, NOT the raw
                // InfraCode — mirroring getInfraTypePrefix()'s "Short InfraCodes (from JSON
                // InfraTypes)" map exactly, since that function is what actually assigns real
                // Infrastructure IDs for these types when a user adds a Work Location in the main
                // app.
                var expectedInfraPrefix = NamesMatch(Component.InfraType, "Roads")
                    ? "S"
                    : NamesMatch(Component.InfraType, "Bridges")
                        ? "B"
                        : infraCode != null && InfraCodeToAutoGeneratedPrefix.TryGetValue(infraCode, out var mappedPrefix)
                            ? mappedPrefix
                            : null;
                if (expectedInfraPrefix != null
                    && !details.InfrastructureId.Trim().StartsWith(expectedInfraPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    v.Fail($"Infrastructure ID '{details.InfrastructureId}' does not match the expected '{expectedInfraPrefix}' prefix for Infrastructure Type '{Component.InfraType}'");
                }
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
            // Matches the main app's hard requirement (UpdateProjectDetails' "Invalid Physical
            // Target" check): Physical Target is required and must be greater than zero — not
            // just parseable text when present. (The Excel workbook's own pre-save gate already
            // treats this column as required; this closes the gap where the backend didn't
            // independently enforce it.)
            if (string.IsNullOrWhiteSpace(details.PhysicalTarget))
            {
                v.Fail("Physical Target is required");
            }
            else
            {
                bool isValidPhysicalTarget = decimal.TryParse(details.PhysicalTarget, out var physicalTargetValue);
                if (!isValidPhysicalTarget)
                {
                    v.Warn("Incorrect Physical Target");
                }
                else if (physicalTargetValue <= 0)
                {
                    v.Fail("Physical Target must be greater than zero");
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
            if (string.IsNullOrWhiteSpace(details.Length))
            {
                // UserManual.md's WL-F04 documents Length as required for Roads; real DB data
                // confirms Bridges rows are held to the same convention in practice (86/86 real
                // Bridges locations have Length populated, matching the Station/Chainage fix
                // above which is also scoped to isRoadsSCase || isBridgesBCase).
                if (isRoadsSCase || isBridgesBCase)
                {
                    v.Fail("Length is required");
                }
            }
            else
            {
                bool isValidLength = decimal.TryParse(details.Length, out _);
                if (!isValidLength)
                {
                    v.Warn("Incorrect Length");
                }
            }
            // Roads items whose Infrastructure ID starts with 'S', and Bridges items whose
            // Infrastructure ID starts with 'B', use Station/Chainage instead of X/Y coordinates
            // (verified against real data: every sampled Roads location has an InfraId starting
            // with 'S' and every Bridges location starts with 'B' — the prefix check isn't a
            // narrowing assumption, it matches RBIA's actual ID convention). The manual documents
            // Start/End Chainage as required for Roads (UserManual.md's WL-F07/WL-F08). Station
            // and Chainage are interchangeable, not both-required: the main app has "Auto-fill
            // Station"/"Auto-fill Chainage" buttons that derive one from the other (WL-A05/A06),
            // and real data confirms this — several real rows have Chainage populated with
            // Station left blank. So this only Fails when BOTH are missing; previously this only
            // checked Station (ignoring Chainage as a valid alternative, producing spurious
            // warnings on those real rows) and only applied to Roads, not Bridges, despite the
            // comment here claiming both.
            if (isRoadsSCase || isBridgesBCase)
            {
                if (string.IsNullOrWhiteSpace(details.StartStation) && string.IsNullOrWhiteSpace(details.StartChainage))
                {
                    v.Fail("Start Station or Start Chainage is required");
                }
                if (string.IsNullOrWhiteSpace(details.EndStation) && string.IsNullOrWhiteSpace(details.EndChainage))
                {
                    v.Fail("End Station or End Chainage is required");
                }
            }

            // Matches the main app's hard rule (UpdateProjectDetails' "Duplicate Major Work
            // Locations" check), scoped the same way: only rows that both have Start/End Station
            // data (the Roads-S / Bridges-B case) are compared, since that's the only pairing the
            // main app itself checks. Checked within this import batch only.
            if (!string.IsNullOrEmpty(details.StartStation) && !string.IsNullOrEmpty(details.EndStation)
                && allMajorItems.Any(x => !ReferenceEquals(x, details)
                    && !string.IsNullOrEmpty(x.StartStation) && !string.IsNullOrEmpty(x.EndStation)
                    && string.Equals((x.DetailsScope ?? string.Empty).Trim(), (details.DetailsScope ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)
                    && string.Equals(x.StartStation!.Trim(), details.StartStation!.Trim(), StringComparison.OrdinalIgnoreCase)
                    && string.Equals(x.EndStation!.Trim(), details.EndStation!.Trim(), StringComparison.OrdinalIgnoreCase)))
            {
                v.Fail("Duplicate Major Work Location (same Detailed Scope, Start Station, and End Station)");
            }

            // ── Duplicate Major Work Item, adapted for the import's flattened row shape ──
            // The main app's own dedup key (Component+Year+WorkType+InfraType) doesn't
            // discriminate here: WorkType and InfraType are both derived from the Component
            // (Component.WorkTypeId / Component.InfraType above), not chosen per row, so every
            // row sharing a ComponentId already shares those too — the key would collapse to just
            // (ComponentId, Year) and wrongly reject legitimate multiple physical
            // locations/segments under one conceptual Work Item (the main app's own
            // one-Work-Item-many-Locations model). InfrastructureId is what actually identifies a
            // distinct physical location on each row, so the real duplicate condition is the same
            // location entered twice under the same Project+Component+Year — different
            // InfrastructureId values stay legitimate.
            if (!string.IsNullOrWhiteSpace(details.InfrastructureId) && allMajorItems.Any(x => !ReferenceEquals(x, details)
                && x.ProjectId == details.ProjectId
                && string.Equals((x.ComponentId ?? string.Empty).Trim(), (details.ComponentId ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)
                && string.Equals((x.ActivityYear ?? string.Empty).Trim(), (details.ActivityYear ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)
                && string.Equals((x.InfrastructureId ?? string.Empty).Trim(), details.InfrastructureId!.Trim(), StringComparison.OrdinalIgnoreCase)))
            {
                v.Fail($"Duplicate Major Work Item: Infrastructure ID '{details.InfrastructureId}' already used for Component '{details.ComponentId}' in Year '{details.ActivityYear}'");
            }

            bool isValidActivityYear = ValidateYear(details.ActivityYear, out int activityYearValue);
            if (!isValidActivityYear)
            {
                v.Fail("Incorrect Activity Year");
            }
            // Matches the documented spec for this field (UserManual.md's MIOW-F02: "Year of
            // Work... minimum = Program Start Year") — unlike Component Details' ActiveYear
            // (CC-F05), which only documents a default, not a minimum. This is a real Fail: a
            // physical work item genuinely can't be dated before its Program started.
            else if (activityYearValue < programStartYear)
            {
                v.Fail($"Activity Year ({activityYearValue}) cannot be earlier than the Program's Start Year ({programStartYear})");
            }
            else if (Component != null)
            {
                // A ComponentId can now legitimately span multiple Component Details rows (one
                // per funded year — see the duplicate-ComponentId fix), so "the Component's Active
                // Year" is no longer well-defined as a single row's value: FirstOrDefault above
                // just grabs whichever row happens to appear first in the sheet, which could be
                // any of the component's years depending on row order. Compare against the
                // earliest valid year across ALL rows sharing this ComponentId instead.
                //
                // Explicit product decision: Fail, not Warn — a Major Item's work must not be
                // dated earlier than its Component's own Activity Year, even though this has no
                // direct main-app equivalent and real existing data contains rows that predate
                // it (same rationale as the Program StartYear floor above: existing violations are
                // exactly what this check is meant to start catching going forward).
                var componentActiveYears = componentCost
                    .Where(x => x.ProjectId == details.ProjectId && x.ComponentId == details.ComponentId)
                    .Select(x => ValidateYear(x.ActiveYear, out int y) ? (int?)y : null)
                    .Where(y => y.HasValue)
                    .Select(y => y!.Value)
                    .ToList();

                if (componentActiveYears.Count > 0 && activityYearValue < componentActiveYears.Min())
                {
                    int componentActiveYearValue = componentActiveYears.Min();
                    v.Fail($"Activity Year ({activityYearValue}) cannot be earlier than the Component's earliest Active Year ({componentActiveYearValue})");
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
            // ── true when a brand-new tProjects row needs to be Add()-ed.
            // false when an existing row (found via AlternateId) was fetched and just needs updating —
            // the caller must NOT Add() it again, only SaveChanges() to persist the tracked changes.
            public bool IsNewProject { get; set; } = true;
            // ── true when a brand-new tProjectRevisions/tProjectStages row needs to be Add()-ed.
            // false when an existing revision (found for this exact Program+Stage+ProjectId) is
            // retained and updated in place — its Id/ProjectId are preserved, not regenerated.
            public bool IsNewRevision { get; set; } = true;
        }
        public static async Task<SaveProjectResponse> SaveProjectDetails(this MYPSDbContext _db, DBHelper.Models.Functions.Program.ProgramDetails ProgramDetails, ImportProjectDetailsExcel details, List<ImportProjectReference> Saved, ProjectIdentityResolver resolver, CancellationToken cancellationToken)
        {
            string ProgramFK = ProgramDetails.ProgramPK;
            string ProgramId = ProgramDetails.ProgramId;

            // Identity resolution (AlternateId, or a no-AlternateId project's own ProjectFK
            // fallback) is computed once per RunImportAsync call and shared via resolver instead
            // of this method re-querying the DB per row — see ProjectIdentityResolver.cs. Ambiguous
            // is a genuine third outcome here: the pre-checks in RunImportAsync (ImportProjectJobService.cs)
            // already disregard/reject any ambiguous row before it reaches this method, so this
            // throw should be unreachable in practice — kept as a safety net, not the primary guard.
            var outcome = resolver.Resolve(details.ProjectId, out var resolvedProjectFK);

            if (outcome == MatchOutcome.Ambiguous)
            {
                throw new InvalidOperationException(
                    $"Ambiguous ProjectId '{details.ProjectId}' under Program '{ProgramFK}': matches multiple existing projects. Reconcile the data before this row can be imported.");
            }

            // If found, it's retained and updated in place — its Id and ProjectId are preserved
            // rather than soft-deleted and recreated. Only the tables underneath it (funding
            // profile, component cost, etc.) get replaced.
            string ProjectPK;
            bool IsNewProject;
            bool IsNewRevision;
            DBHelper.Models.Table.Project.Projects NewProject;
            DBHelper.Models.Table.Project.ProjectStages ProjectStage;
            DBHelper.Models.Table.Project.ProjectRevisions ProjectRevision;

            if (outcome == MatchOutcome.Found
                && resolver.CurrentStageRevisionByProjectFK.TryGetValue(resolvedProjectFK!, out var stageMatch))
            {
                // ── Retain: same revision row (same Id, same ProjectId) gets updated in place ──
                ProjectPK = stageMatch.Revision.ProjectFK;
                IsNewProject = false;
                IsNewRevision = false;

                NewProject = await _db.tProjects.FirstAsync(x => x.ProjectPK == ProjectPK, cancellationToken);
                NewProject.ExternalId = details.ExternalId;
                NewProject.MYId = details.MYId;
                NewProject.ProjectType = details.RegionIslandCode!;

                ProjectStage = stageMatch.Stage;       // tracked, already points at this revision
                ProjectRevision = stageMatch.Revision; // tracked — fields refreshed below

                // Self-heal: this row was matched via the ProjectFK fallback above (its
                // AlternateId was null), so it now permanently gains a real AlternateId — every
                // future Import/Update for this project matches it the normal way from here on.
                if (string.IsNullOrEmpty(ProjectRevision.AlternateId))
                {
                    ProjectRevision.AlternateId = details.ProjectId;
                }
            }
            else
            {
                // No revision under this Program+Stage yet. The project itself might still exist
                // (e.g. this ProjectId was previously imported under a different Stage) — reuse
                // its ProjectPK, but this Stage needs its own brand-new revision + stage row.
                IsNewProject = outcome != MatchOutcome.Found;
                IsNewRevision = true;

                if (IsNewProject)
                {
                    var Request = new GenerateProjectIDParams
                    {
                        CategoryId = (int)details.CategoryCategoryId!,
                        StageName = ProgramDetails.StageName,
                        IslandCode = details.RegionIslandCode!,
                        YearStart = ProgramDetails.StartYear,
                        Count = 1
                    };

                    ProjectPK = await _db.GenerateProjectID(Request, cancellationToken);

                    NewProject = new DBHelper.Models.Table.Project.Projects
                    {
                        ProjectPK = ProjectPK,
                        ProgramFK = ProgramFK,
                        ProgramId = ProgramId,
                        ExternalId = details.ExternalId,
                        MYId = details.MYId,
                        ProjectType = details.RegionIslandCode!,
                        IsPublished = false,
                        IsRevised = false,
                        IsPublishable = false,
                        PCMARevisionCount = 0
                    };
                }
                else
                {
                    ProjectPK = resolvedProjectFK!;
                    NewProject = await _db.tProjects.FirstAsync(x => x.ProjectPK == ProjectPK, cancellationToken);
                    NewProject.ExternalId = details.ExternalId;
                    NewProject.MYId = details.MYId;
                    NewProject.ProjectType = details.RegionIslandCode!;
                }

                ProjectStage = new DBHelper.Models.Table.Project.ProjectStages
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = ProgramFK,
                    ProgramId = ProgramId,
                    RevisionId = 0, // set by the caller once the new revision has an Id
                    StageId = (EnumProgramStage)ProgramDetails.StageId,
                    StageName = ProgramDetails.StageName
                };

                ProjectRevision = new DBHelper.Models.Table.Project.ProjectRevisions
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = ProgramFK,
                    ProgramId = ProgramId,
                    ProjectId = ProjectPK,
                    AlternateId = details.ProjectId,
                    IsDeleted = false
                };
            }

            var ImportRef = new ImportProjectReference();

            ImportRef.OldProjectFK = details.ProjectId;
            ImportRef.NewProjectFK = ProjectPK;

            // ── Field refresh — applied whether this revision is brand-new or retained ──
            ProjectRevision.MYCAApprovalDate = string.IsNullOrWhiteSpace(details.MYCAApprovalDate) ? null : DateTime.TryParse(details.MYCAApprovalDate, out _) ? details.MYCAApprovalDate.StringToDate() : null;
            ProjectRevision.Description = details.Description!;
            ProjectRevision.Category = (int)details.CategoryCategoryId;
            ProjectRevision.Thrust = details.ThrustPAPKey;
            ProjectRevision.Origin = (int)details.OriginNameId!;
            ProjectRevision.City = details.CityCode!;
            ProjectRevision.Province = details.ProvinceCode!;
            ProjectRevision.LegislativeDistrict = details.LDCode!;
            ProjectRevision.OperatingUnit = details.OperatingUnitParticipantId!;
            ProjectRevision.ImplementingOffice = details.ImplementingOfficeParticipantId!;
            ProjectRevision.DEO = details.DeoParticipantId!;
            ProjectRevision.Region = details.RegionParticipantId!;
            ProjectRevision.Agency = (int)details.AgencyNameId!;
            ProjectRevision.ImplementationMode = details.ImplementationModeNameId;
            ProjectRevision.EmergencyMode = details.EmergencyModeNameId!;
            ProjectRevision.IslandCode = details.RegionIslandCode!;
            ProjectRevision.Feasibility = details.FeasibilityNameId;
            ProjectRevision.FeasibilityDate = string.IsNullOrWhiteSpace(details.FeasibilityDate) ? null : DateTime.TryParse(details.FeasibilityDate, out _) ? details.FeasibilityDate.StringToDate() : null;
            ProjectRevision.DetailedDesign = details.DetailedDesignNameId!;
            ProjectRevision.DetailedDesignDate = string.IsNullOrWhiteSpace(details.DetailedDesignDate) ? null : DateTime.TryParse(details.DetailedDesignDate, out _) ? details.DetailedDesignDate.StringToDate() : null;
            ProjectRevision.RowAvailable = details.RowAvailableNameId!;
            ProjectRevision.RegionWide = (int)details.RegionWideNameId!;
            ProjectRevision.Tier = (int)details.TierNameId!;
            ProjectRevision.Rank = string.IsNullOrWhiteSpace(details.Rank) ? null : double.TryParse(details.Rank, out var rank) ? rank : null;
            ProjectRevision.IsDeleted = false; // revives it if it had been soft-deleted by an older flow

            return new SaveProjectResponse { IsValid = true, Message = string.Empty, Project = NewProject, ProjectRevision = ProjectRevision, ProjectStage = ProjectStage, ImportReference = ImportRef, IsNewProject = IsNewProject, IsNewRevision = IsNewRevision };
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
            // Non-null here is guaranteed by ValidateMajorItemsOfWork: a row referencing a
            // NonPhysicalComponentTypeIds-exempt component (blank WorkTypeId) fails validation
            // before it can reach this save step, so only components with a resolved
            // ScopeOfWorkEnum/InfraTypeInfraCode ever get here.
            int WorkTypeFK = ComponentRef.WorkTypeFK!.Value;
            string InfraTypeFK = ComponentRef.InfraTypeFK!;

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
            double? physicalTarget = null, lengthVal = null, startChainageVal = null, endChainageVal = null;
            if (details.PhysicalTarget != null)
            {
                bool isValidPhysicalTarget = double.TryParse(details.PhysicalTarget, out var physicalTargetParsed);
                if (isValidPhysicalTarget) physicalTarget = physicalTargetParsed;
            }
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
                PhysicalTarget = physicalTarget,
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
        #region Soft Delete - Update
        /// <summary>
        /// Soft-deletes only the tables hanging off a project's revision — funding profile,
        /// component cost, component cost per year, major work items, major work locations —
        /// scoped ONLY to the ProjectIds present in the current excel import, resolved against
        /// the given resolver's Program+Stage (see ProjectIdentityResolver.cs). tProjectRevisions
        /// itself is NOT soft-deleted: SaveProjectDetails
        /// retains and updates that row in place (same Id, same ProjectId) instead of replacing
        /// it, so its history/identity stays intact across Update runs. tProjects and
        /// tProjectStages are likewise untouched — reused, never orphaned.
        /// </summary>
        public static async Task<int> SoftDeleteProjectsByProgramStage(this MYPSDbContext _db, List<string> ProjectIds, ProjectIdentityResolver resolver, string UpdatedBy, CancellationToken cancellationToken)
        {
            var DistinctProjectIds = (ProjectIds ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();

            if (DistinctProjectIds.Count == 0) return 0;

            // Resolved via the shared resolver (built once in RunImportAsync) instead of its own
            // query — same fallback-matching rule (AlternateId, or a no-AlternateId project's own
            // ProjectFK) as SaveProjectDetails. This runs BEFORE the save loop's self-heal, but the
            // resolver's maps were built before that too, from the same pre-loop DB snapshot, so
            // a project's first fallback-matched Update is still found correctly here; without
            // that, its pre-existing children would never get soft-deleted and the save loop would
            // insert a second, duplicate set alongside them.
            var RevisionIds = DistinctProjectIds
                .Select(id => resolver.Resolve(id, out var fk) == MatchOutcome.Found
                           && resolver.CurrentStageRevisionByProjectFK.TryGetValue(fk!, out var match)
                    ? match.Revision.Id
                    : (int?)null)
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            if (RevisionIds.Count == 0) return 0;

            DateTime CurrentDate = Functions.CurrentDate();
            string RevisionIdsCsv = string.Join(",", RevisionIds); // ints only — safe to join, passed as one parameter below

            int affected = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                DECLARE @RevisionIds TABLE (Id INT PRIMARY KEY);
                DECLARE @ComponentCostIds TABLE (Id INT PRIMARY KEY);
                DECLARE @WorkItemIds TABLE (Id INT PRIMARY KEY);

                INSERT INTO @RevisionIds (Id)
                SELECT DISTINCT TRY_CAST(value AS INT)
                FROM STRING_SPLIT({RevisionIdsCsv}, ',');

                -- Component costs hanging off those revisions
                INSERT INTO @ComponentCostIds (Id)
                SELECT cc.Id
                FROM dbo.tProjectComponentCost cc
                WHERE cc.ProjectRevisionFK IN (SELECT Id FROM @RevisionIds)
                  AND cc.IsDeleted = 0;

                -- Major work items hanging off those component costs
                INSERT INTO @WorkItemIds (Id)
                SELECT wi.Id
                FROM dbo.tProjectMajorWorkItem wi
                WHERE wi.ComponentCostFK IN (SELECT Id FROM @ComponentCostIds)
                  AND wi.IsDeleted = 0;

                -- Leaf-most first, then walk back up the hierarchy — tProjectRevisions itself is
                -- deliberately NOT touched here; it's retained and updated in place by the caller.
                UPDATE dbo.tProjectMajorWorkLocations
                SET IsDeleted = 1, UpdatedBy = {UpdatedBy}, UpdatedDate = {CurrentDate}
                WHERE WorkItemFK IN (SELECT Id FROM @WorkItemIds)
                  AND IsDeleted = 0;

                UPDATE dbo.tProjectMajorWorkItem
                SET IsDeleted = 1, UpdatedBy = {UpdatedBy}, UpdatedDate = {CurrentDate}
                WHERE Id IN (SELECT Id FROM @WorkItemIds);

                UPDATE dbo.tProjectComponentCostPerYear
                SET IsDeleted = 1, UpdatedBy = {UpdatedBy}, UpdatedDate = {CurrentDate}
                WHERE ComponentCostFK IN (SELECT Id FROM @ComponentCostIds)
                  AND IsDeleted = 0;

                UPDATE dbo.tProjectComponentCost
                SET IsDeleted = 1, UpdatedBy = {UpdatedBy}, UpdatedDate = {CurrentDate}
                WHERE Id IN (SELECT Id FROM @ComponentCostIds);

                UPDATE dbo.tProjectFundingProfile
                SET IsDeleted = 1, UpdatedBy = {UpdatedBy}, UpdatedDate = {CurrentDate}
                WHERE ProjectRevisionFK IN (SELECT Id FROM @RevisionIds)
                  AND IsDeleted = 0;
            ", cancellationToken);

            return affected;
        }
        #endregion
    }
}