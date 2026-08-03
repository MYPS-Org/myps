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
        public List<OptionFundingAgreement> FundingAgreements { get; set; }
        public List<OptionFundingSource> FundingSources { get; set; }

        // Component Details lookups
        public List<OptionProjectComponentType> Components { get; set; }
        public List<OptionInfraType> InfraTypes { get; set; }
        public List<OptionScopeOfWork> ScopeOfWorks { get; set; }

        // ── Load all lookups in one DB round-trip ──────────────────────────────
        public static async Task<ImportLookupCache> LoadAsync(MYPSDbContext db)
        {
            return new ImportLookupCache
            {
                Categories = await db.tOptionProjectCategory.AsNoTracking().ToListAsync(),
                Thrusts = await db.tOptionProjectThrustList.AsNoTracking().ToListAsync(),
                Provinces = await db.tOptionAdminAreaProvince.AsNoTracking().ToListAsync(),
                Cities = await db.tOptionAdminAreaCityMunicipality.AsNoTracking().ToListAsync(),
                Districts = await db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().ToListAsync(),
                Regions = await db.tOptionAdminAreaRegion.AsNoTracking().ToListAsync(),
                DEOs = await db.vAdminDEO.AsNoTracking().ToListAsync(),
                ImplementingOffices = await db.vAdminImplementingOffice.AsNoTracking().ToListAsync(),
                OperatingUnits = await db.vAdminOperatingUnit.AsNoTracking().ToListAsync(),
                RegionWides = await db.tOptionRegionWide.AsNoTracking().ToListAsync(),
                Origins = await db.tOptionProjectOrigin.AsNoTracking().ToListAsync(),
                Agencies = await db.tOptionProjectAgency.AsNoTracking().ToListAsync(),
                ImplementationModes = await db.tOptionProjectImplementationMode.AsNoTracking().ToListAsync(),
                EmergencyModes = await db.tOptionProjectEmergencyMode.AsNoTracking().ToListAsync(),
                RowAvailables = await db.tOptionProjectRowAvailable.AsNoTracking().ToListAsync(),
                FeasibilityStudies = await db.tOptionProjectFeasibilityStudy.AsNoTracking().ToListAsync(),
                DetailedDesigns = await db.tOptionProjectDetailedDesign.AsNoTracking().ToListAsync(),
                FundingAgreements = await db.tOptionFundingAgreement.AsNoTracking().ToListAsync(),
                FundingSources = await db.tOptionFundingSource.AsNoTracking().ToListAsync(),
                Components = await db.tOptionProjectComponentType.AsNoTracking().ToListAsync(),
                InfraTypes = await db.tOptionInfraType.AsNoTracking().ToListAsync(),
                ScopeOfWorks = await db.tOptionScopeOfWork.AsNoTracking().ToListAsync(),
            };
        }
    }
}
