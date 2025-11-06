using DBHelper.Models.Views;
using Microsoft.EntityFrameworkCore;

namespace DBHelper.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        #region Tables
        public DbSet<Models.Table.Users> tUsers { get; set; }
        public DbSet<Models.Table.PermissionGroups> tPermissionGroups { get; set; }
        public DbSet<Models.Table.Permissions> tPermissions { get; set; }
        public DbSet<Models.Table.GroupRoles> tGroupRoles { get; set; }
        public DbSet<Models.Table.UserGroups> tUserGroups { get; set; }
        public DbSet<Models.Table.Groups> tGroups { get; set; }
        public DbSet<Models.Table.ImplementingOffice> tImplementingOffice { get; set; }
        public DbSet<Models.Table.Programs> tPrograms { get; set; }
        public DbSet<Models.Table.ProgramStages> tProgramStages { get; set; }
        public DbSet<Models.Table.ProgramRevisions> tProgramRevisions { get; set; }
        public DbSet<Models.Table.ProgramStageEnum> tProgramStageEnum { get; set; }
        public DbSet<Models.Table.ProgramTypeEnum> tProgramTypeEnum { get; set; }
        public DbSet<Models.Table.ProgramStatusEnum> tProgramStatusEnum { get; set; }
        public DbSet<Models.Table.Projects> tProjects { get; set; }
        public DbSet<Models.Table.ProjectRevisions> tProjectRevisions { get; set; }
        public DbSet<Models.Table.ProjectStages> tProjectStages { get; set; }
        public DbSet<Models.Table.ProjectCategoryEnum> tProjectCategoryEnum { get; set; }
        public DbSet<Models.Table.ProjectThrustLists> tProjectThrustLists { get; set; }
        public DbSet<Models.Table.ProjectOriginEnum> tProjectOriginEnum { get; set; }
        public DbSet<Models.Table.OptionAdminAreaCityMunicipality> tOptionAdminAreaCityMunicipality { get; set; }
        public DbSet<Models.Table.AdminAreaCongressionalDistrict> tAdminAreaCongressionalDistrict { get; set; }
        public DbSet<Models.Table.OptionAdminAreaDistrictEngineeringOffice> tOptionAdminAreaDistrictEngineeringOffice { get; set; }
        public DbSet<Models.Table.OptionAdminAreaRegion> tOptionAdminAreaRegion { get; set; }
        //public DbSet<Models.Table.AdminImplementingOffice> tAdminImplementingOffice { get; set; }
        public DbSet<Models.Table.ProjectAgencyLists> tProjectAgencyLists { get; set; }
        public DbSet<Models.Table.ProjectImplementModeEnum> tProjectImplementModeEnum { get; set; }
        public DbSet<Models.Table.ProjectEmergencyModeEnum> tProjectEmergencyModeEnum { get; set; }
        public DbSet<Models.Table.ProjectLongFeasibilityEnum> tProjectLongFeasibilityEnum { get; set; }
        public DbSet<Models.Table.ProjectComponentEnum> tProjectComponentEnum { get; set; }
        public DbSet<Models.Table.ProjectComponentCost> tProjectComponentCost { get; set; }
        public DbSet<Models.Table.ProjectComponentCostYear> tProjectComponentCostYear { get; set; }
        public DbSet<Models.Table.TransactionLog> tTransactionLog { get; set; }
        public DbSet<Models.Table.ProjectScopeOfWorkEnum> tProjectScopeOfWorkEnum { get; set; }
        public DbSet<Models.Table.ProjectMajorWorkItem> tProjectMajorWorkItem { get; set; }
        public DbSet<Models.Table.ProjectMajorWorkLocations> tProjectMajorWorkLocations { get; set; }
        public DbSet<Models.Table.ProjectNotes> tProjectNotes { get; set; }
        public DbSet<Models.Table.ProjectSupportingDocs> tProjectSupportingDocs { get; set; }
        public DbSet<Models.Table.ProjectFundingProfile> tProjectFundingProfile { get; set; }
        public DbSet<Models.Table.ProjectFundingAgreementLists> tProjectFundingAgreementLists { get; set; }
        public DbSet<Models.Table.ProjectFundingSource> tProjectFundingSource { get; set; }
        public DbSet<Models.Table.OptionFundingSource> tOptionFundingSource { get; set; }
        public DbSet<Models.Table.OptionFundingAgreement> tOptionFundingAgreement { get; set; }
        public DbSet<Models.Table.InfraType> tInfraType { get; set; }
        public DbSet<Models.Table.ProjectsInGroup> tProjectsInGroup { get; set; }
        public DbSet<Models.Table.ProjectGroups> tProjectGroups { get; set; }
        public DbSet<Models.Table.OptionAdminAreaProvince> tOptionAdminAreaProvince { get; set; }
        public DbSet<Models.Table.DropdownSupportingDocs> tDropdownSupportingDocs { get; set; }
        public DbSet<Models.Table.FutureRoads> tFutureRoads { get; set; }
        public DbSet<Models.Table.FutureRoadsClassification> tFutureRoadsClassification { get; set; }
        public DbSet<Models.Table.FutureRoadSections> tFutureRoadSections { get; set; }
        public DbSet<Models.Table.FutureBridge> tFutureBridge { get; set; }
        public DbSet<Models.Table.ProjectImplementingOfficeEnum> tProjectImplementingOfficeEnum { get; set; }
        #endregion
        #region Views
        public DbSet<Models.Views.Users> vUsers { get; set; }
        public DbSet<Models.Views.UserGroups> vUserGroups { get; set; }
        public DbSet<Models.Views.Permissions> vPermissions { get; set; }
        public DbSet<Models.Views.Programs> vPrograms { get; set; }
        public DbSet<Models.Views.ProgramDetails> vProgramDetails { get; set; }
        public DbSet<Models.Views.Projects> vProjects { get; set; }
        public DbSet<Models.Views.ProjectDetails> vProjectDetails { get; set; }
        public DbSet<Models.Views.ProjectGroups> vProjectGroups { get; set; }
        public DbSet<Models.Views.ProjectsInGroup> vProjectsInGroup { get; set; }
        public DbSet<Models.Views.AdminOperatingUnit> vAdminOperatingUnit { get; set; }
        public DbSet<Models.Views.AdminImplementingOffice> vAdminImplementingOffice { get; set; }
        #endregion
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<AdminOperatingUnit>().HasNoKey().ToView("vAdminOperatingUnit");
            modelBuilder.Entity<AdminImplementingOffice>().HasNoKey().ToView("vAdminImplementingOffice");
            base.OnModelCreating(modelBuilder);
        }
    }
}
