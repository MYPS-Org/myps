using DBHelper.Data;
using DBHelper.Models.Table.AdminAreas;
using DBHelper.Models.Table.Lookups;
using DBHelper.Models.Table.Lookups.Project;
using DBHelper.Models.Views.AdminAreas;
using Microsoft.EntityFrameworkCore;

namespace Hangfire.Importing
{
    // Hangfire/Importing/ImportLookupCache.cs
    public class ImportLookupCache
    {
        // Project Details lookups
        public List<OptionProjectTier> Tiers { get; set; }
        public List<DBHelper.Models.Table.Lookups.OptionProjectCategory> Categories { get; set; }
        public List<OptionProjectThrustList> Thrusts { get; set; }
        public List<OptionAdminAreaProvince> Provinces { get; set; }
        public List<OptionAdminAreaCityMunicipality> Cities { get; set; }
        public List<OptionAdminAreaCongressionalDistrict> Districts { get; set; }
        public List<OptionAdminAreaRegion> Regions { get; set; }
        public List<AdminDEO> DEOs { get; set; }
        public List<AdminImplementingOffice> ImplementingOffices { get; set; }
        public List<AdminOperatingUnit> OperatingUnits { get; set; }
        public List<OptionRegionWide> RegionWides { get; set; }
        public List<OptionProjectOrigin> Origins { get; set; }
        public List<OptionProjectAgency> Agencies { get; set; }
        public List<OptionProjectImplementationMode> ImplementationModes { get; set; }
        public List<OptionProjectEmergencyMode> EmergencyModes { get; set; }
        public List<OptionProjectRowAvailable> RowAvailables { get; set; }
        public List<OptionProjectFeasibilityStudy> FeasibilityStudies { get; set; }
        public List<OptionProjectDetailedDesign> DetailedDesigns { get; set; }

        // Funding Profile lookups
        public List<OptionFundingSource> FundingSources { get; set; }
        public List<OptionFundingAgreement> FundingAgreements { get; set; }

        // Component Details lookups
        public List<OptionProjectComponentType> Components { get; set; }
        public List<OptionInfraType> InfraTypes { get; set; }
        public List<OptionScopeOfWork> ScopeOfWorks { get; set; }

        // ── Load all lookups in one DB round-trip ──────────────────────────────
        public static async Task<ImportLookupCache> LoadAsync(MYPSDbContext db)
        {
            return new ImportLookupCache
            {
                Tiers = await db.tOptionProjectTier.AsNoTracking().ToListAsync(),
                Categories = await db.tOptionProjectCategory.AsNoTracking().ToListAsync(),
                Thrusts = await db.tOptionProjectThrustList.AsNoTracking().ToListAsync(),
                // Matches the main app's rule (ProjectHelper.cs's ValidateProjectDetailsLookups:
                // !x.Deprecated on each of these three) — no admin area is currently deprecated
                // in this DB, so this has no effect on any real row today, but keeps import
                // consistent with the main app the moment one is.
                Provinces = await db.tOptionAdminAreaProvince.AsNoTracking().Where(x => !x.Deprecated).ToListAsync(),
                Cities = await db.tOptionAdminAreaCityMunicipality.AsNoTracking().Where(x => !x.Deprecated).ToListAsync(),
                Districts = await db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().Where(x => !x.Deprecated).ToListAsync(),
                Regions = await db.tOptionAdminAreaRegion.AsNoTracking().ToListAsync(),
                DEOs = await db.vAdminDEO.AsNoTracking().ToListAsync(),
                ImplementingOffices = await db.vAdminImplementingOffice.AsNoTracking().ToListAsync(),
                OperatingUnits = await db.vAdminOperatingUnit.AsNoTracking().ToListAsync(),
                RegionWides = await db.tOptionRegionWide.AsNoTracking().ToListAsync(),
                // Matches the main app's rule (ProjectHelper.cs's ValidateProjectDetailsLookups):
                // each of these requires IsActive == true, with no ValidUntil-style exception
                // like Category has. Filtering here — rather than in ImportingHelper.cs's
                // per-field checks — also keeps an inactive value out of the generated
                // workbook's dropdowns (ImportErrorWorkbookBuilder.cs reads these same lists),
                // not just out of validation.
                Origins = await db.tOptionProjectOrigin.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                Agencies = await db.tOptionProjectAgency.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                ImplementationModes = await db.tOptionProjectImplementationMode.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                EmergencyModes = await db.tOptionProjectEmergencyMode.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                RowAvailables = await db.tOptionProjectRowAvailable.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                FeasibilityStudies = await db.tOptionProjectFeasibilityStudy.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                DetailedDesigns = await db.tOptionProjectDetailedDesign.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                // FundingAgreements/FundingSources/Components deliberately NOT filtered by
                // IsActive: the main app's actual save-time gate (ProjectController.cs's
                // UpdateProjectDetails) never checks IsActive on Funding Source/Agreement, and
                // its ComponentType "active types" query (~line 930) is loaded but never
                // actually used to reject anything — dead code. Filtering here would make
                // import stricter than the main app for no reason (the same mistake Thrust's
                // now-removed window check made).
                FundingAgreements = await db.tOptionFundingAgreement.AsNoTracking().ToListAsync(),
                FundingSources = await db.tOptionFundingSource.AsNoTracking().ToListAsync(),
                Components = await db.tOptionProjectComponentType.AsNoTracking().ToListAsync(),
                // InfraType/ScopeOfWork (WorkType) ARE genuinely enforced with IsActive at the
                // main app's actual save gate (ProjectController.cs ~lines 1115-1154, "Invalid
                // Work Type"/"invalid or inactive" — a real rejection, not just a dropdown
                // filter). Verified against real data: InfraCode='LB' ("Local Bridges") is
                // IsActive=0 with zero current usage, so no live impact, but keeps import
                // consistent with the main app going forward.
                InfraTypes = await db.tOptionInfraType.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
                ScopeOfWorks = await db.tOptionScopeOfWork.AsNoTracking().Where(x => x.IsActive).ToListAsync(),
            };
        }
    }
}
