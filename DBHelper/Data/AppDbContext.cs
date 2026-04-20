using DBHelper.Models.Views;
using Microsoft.EntityFrameworkCore;

namespace DBHelper.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {
            this.Database.SetCommandTimeout(TimeSpan.FromMinutes(30));
        }
        #region Tables
        public DbSet<Models.Table.Users> tUsers { get; set; }
        public DbSet<Models.Table.AppModules> tAppModules { get; set; }
        public DbSet<Models.Table.PermissionControllers> tPermissionControllers { get; set; }
        public DbSet<Models.Table.PermissionActions> tPermissionActions { get; set; }
        public DbSet<Models.Table.PermissionViews> tPermissionViews { get; set; }
        public DbSet<Models.Table.GroupRoles> tGroupRoles { get; set; }
        public DbSet<Models.Table.UserGroups> tUserGroups { get; set; }
        public DbSet<Models.Table.Groups> tGroups { get; set; }
        public DbSet<Models.Table.ImplementingOffice> tImplementingOffice { get; set; }
        public DbSet<Models.Table.Programs> tPrograms { get; set; }
        public DbSet<Models.Table.ProgramStages> tProgramStages { get; set; }
        public DbSet<Models.Table.ProgramRevisions> tProgramRevisions { get; set; }
        public DbSet<Models.Table.OptionProgramStage> tOptionProgramStage { get; set; }
        public DbSet<Models.Table.OptionProgramType> tOptionProgramType { get; set; }
        public DbSet<Models.Table.OptionProgramStatus> tOptionProgramStatus { get; set; }
        public DbSet<Models.Table.Projects> tProjects { get; set; }
        public DbSet<Models.Table.ProjectRevisions> tProjectRevisions { get; set; }
        public DbSet<Models.Table.ProjectStages> tProjectStages { get; set; }
        public DbSet<Models.Table.OptionProjectCategory> tOptionProjectCategory { get; set; }
        public DbSet<Models.Table.ProjectThrustLists> tProjectThrustLists { get; set; }
        public DbSet<Models.Table.OptionProjectOrigin> tOptionProjectOrigin { get; set; }
        public DbSet<Models.Table.OptionAdminAreaCityMunicipality> tOptionAdminAreaCityMunicipality { get; set; }
        public DbSet<Models.Table.OptionAdminBureau> tOptionAdminBureau { get; set; }
        public DbSet<Models.Table.OptionAdminAreaCongressionalDistrict> tOptionAdminAreaCongressionalDistrict { get; set; }
        public DbSet<Models.Table.OptionAdminAreaDistrictEngineeringOffice> tOptionAdminAreaDistrictEngineeringOffice { get; set; }
        public DbSet<Models.Table.OptionAdminAreaRegion> tOptionAdminAreaRegion { get; set; }
        public DbSet<Models.Table.OptionProjectImplementationMode> tOptionProjectImplementationMode { get; set; }
        public DbSet<Models.Table.OptionProjectEmergencyMode> tOptionProjectEmergencyMode { get; set; }
        public DbSet<Models.Table.OptionProjectFeasibilityStudy> tOptionProjectFeasibilityStudy { get; set; }
        public DbSet<Models.Table.OptionProjectDetailedDesign> tOptionProjectDetailedDesign { get; set; }
        public DbSet<Models.Table.OptionProjectRowAvailable> tOptionProjectRowAvailable { get; set; }
        public DbSet<Models.Table.OptionRegionWide> tOptionRegionWide { get; set; }
        public DbSet<Models.Table.OptionProjectAgency> tOptionProjectAgency { get; set; }
        public DbSet<Models.Table.OptionProjectComponent> tOptionProjectComponent { get; set; }
        public DbSet<Models.Table.ProjectComponentCost> tProjectComponentCost { get; set; }
        public DbSet<Models.Table.ProjectComponentCostPerYear> tProjectComponentCostPerYear { get; set; }
        public DbSet<Models.Table.TransactionLog> tTransactionLog { get; set; }
        public DbSet<Models.Table.OptionScopeOfWork> tOptionScopeOfWork { get; set; }
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
        public DbSet<Models.Table.PCMARevisions> tPCMARevisions { get; set; }
        public DbSet<Models.Table.PCMARevisionDetails> tPCMARevisionDetails { get; set; }
        public DbSet<Models.Table.PCMARevisionChangelogs> tPCMARevisionChangelogs { get; set; }
        public DbSet<Models.Table.RevisionDetails> tRevisionDetails { get; set; }
        public DbSet<Models.Table.RevisionDocuments> tRevisionDocuments { get; set; }
        public DbSet<Models.Table.RevisionForCorrectionDetails> tRevisionForCorrectionDetails { get; set; }
        public DbSet<Models.Table.OptionRevisionHeader> tOptionRevisionHeader { get; set; }
        public DbSet<Models.Table.OptionRevisionReasons> tOptionRevisionReasons { get; set; }
        public DbSet<Models.Table.OptionRevisionCategory> tOptionRevisionCategory { get; set; }
        public DbSet<Models.Table.OptionRevisionStatus> tOptionRevisionStatus { get; set; }
        public DbSet<Models.Table.OptionRevisionDocuments> tOptionRevisionDocuments { get; set; }
        public DbSet<Models.Table.RevisionRules> tRevisionRules { get; set; }
        public DbSet<Models.Table.RevisionTransactionLog> tRevisionTransactionLog { get; set; }
        public DbSet<Models.Table.RevisionProjects> tRevisionProjects { get; set; }
        public DbSet<Models.Table.RevisionProjectFundingProfile> tRevisionProjectFundingProfile { get; set; }
        public DbSet<Models.Table.RevisionProjectComponentCost> tRevisionProjectComponentCost { get; set; }
        public DbSet<Models.Table.RevisionProjectMajorWorkItem> tRevisionProjectMajorWorkItem { get; set; }
        public DbSet<Models.Table.RevisionProjectMajorWorkLocations> tRevisionProjectMajorWorkLocations { get; set; }
        public DbSet<Models.Table.RevisionDetailsComponentsStatus> tRevisionDetailsComponentsStatus { get; set; }
        public DbSet<Models.Table.RevisionProjectComponentCostPerYear> tRevisionProjectComponentCostPerYear { get; set; }
        public DbSet<Models.Table.OptionInfraType> tOptionInfraType { get; set; }
        public DbSet<Models.Table.ImportingStatus> tImportingStatus { get; set; }
        public DbSet<Models.Table.OptionCodeTables> tOptionCodeTables { get; set; }
        public DbSet<Models.Table.CodeTableTransactionLog> tCodeTableTransactionLog { get; set; }
        public DbSet<Models.Table.OptionReportProgram> tOptionReportProgram { get; set; }
        public DbSet<Models.Table.LoginHistory> tLoginHistory { get; set; }
        public DbSet<Models.Table.OptionGlobalSearch> tOptionGlobalSearch { get; set; }
        #endregion
        #region Views
        public DbSet<Models.Views.Users> vUsers { get; set; }
        public DbSet<Models.Views.AppModules> vAppModules { get; set; }
        public DbSet<Models.Views.UserActionPermission> vUserActionPermission { get; set; }
        public DbSet<Models.Views.UserViewPermission> vUserViewPermission { get; set; }
        public DbSet<Models.Views.UserGroups> vUserGroups { get; set; }
        public DbSet<Models.Views.APIPermissions> vAPIPermissions { get; set; }
        public DbSet<Models.Views.Programs> vPrograms { get; set; }
        public DbSet<Models.Views.ProgramDetails> vProgramDetails { get; set; }
        public DbSet<Models.Views.Projects> vProjects { get; set; }
        public DbSet<Models.Views.ProjectDetails> vProjectDetails { get; set; }
        public DbSet<Models.Views.ProjectGroups> vProjectGroups { get; set; }
        public DbSet<Models.Views.ProjectsInGroup> vProjectsInGroup { get; set; }
        public DbSet<Models.Views.AdminOperatingUnit> vAdminOperatingUnit { get; set; }
        public DbSet<Models.Views.AdminImplementingOffice> vAdminImplementingOffice { get; set; }
        public DbSet<Models.Views.RevisionRules> vRevisionRules { get; set; }
        public DbSet<Models.Views.RevisionLists> vRevisionLists { get; set; }
        public DbSet<Models.Views.ProjectComponentCostStatus> vProjectComponentCostStatus { get; set; }
        public DbSet<Models.Views.ProjectPerStages> vProjectPerStages { get; set; }
        public DbSet<Models.Views.ProjectLatestStage> vProjectLatestStage { get; set; }
        #endregion
        #region Functions
        public DbSet<Models.Functions.ProjectsPerStage> fProjectsPerStage { get; set; }
        #endregion
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<AdminOperatingUnit>().HasNoKey().ToView("vAdminOperatingUnit");
            modelBuilder.Entity<AdminImplementingOffice>().HasNoKey().ToView("vAdminImplementingOffice");
            base.OnModelCreating(modelBuilder);
        }
    }
}
