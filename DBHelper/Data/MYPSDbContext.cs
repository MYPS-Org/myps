using DBHelper.Models.Functions.Program;
using DBHelper.Models.Functions.Project;
using DBHelper.Models.Table.Lookups;
using DBHelper.Models.Table.Program;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views;
using DBHelper.Models.Views.Program;
using DBHelper.Models.Views.Project;
using Microsoft.EntityFrameworkCore;

namespace DBHelper.Data
{
    public class MYPSDbContext : DbContext
    {
        public MYPSDbContext(DbContextOptions<MYPSDbContext> options) : base(options) {
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
        public DbSet<Models.Table.Program.Programs> tPrograms { get; set; }
        public DbSet<Models.Table.Program.ProgramStages> tProgramStages { get; set; }
        public DbSet<ProgramRevisions> tProgramRevisions { get; set; }
        public DbSet<OptionProgramStage> tOptionProgramStage { get; set; }
        public DbSet<OptionProgramType> tOptionProgramType { get; set; }
        public DbSet<OptionProgramStatus> tOptionProgramStatus { get; set; }
        public DbSet<Models.Table.Project.Projects> tProjects { get; set; }
        public DbSet<ProjectRevisions> tProjectRevisions { get; set; }
        public DbSet<Models.Table.Project.ProjectStages> tProjectStages { get; set; }
        public DbSet<OptionProjectCategory> tOptionProjectCategory { get; set; }
        public DbSet<Models.Table.ProjectThrustLists> tProjectThrustLists { get; set; }
        public DbSet<OptionProjectOrigin> tOptionProjectOrigin { get; set; }
        public DbSet<OptionAdminAreaCityMunicipality> tOptionAdminAreaCityMunicipality { get; set; }
        public DbSet<OptionAdminBureau> tOptionAdminBureau { get; set; }
        public DbSet<OptionAdminAreaCongressionalDistrict> tOptionAdminAreaCongressionalDistrict { get; set; }
        public DbSet<OptionAdminAreaDistrictEngineeringOffice> tOptionAdminAreaDistrictEngineeringOffice { get; set; }
        public DbSet<OptionAdminAreaRegion> tOptionAdminAreaRegion { get; set; }
        public DbSet<OptionProjectImplementationMode> tOptionProjectImplementationMode { get; set; }
        public DbSet<OptionProjectEmergencyMode> tOptionProjectEmergencyMode { get; set; }
        public DbSet<OptionProjectFeasibilityStudy> tOptionProjectFeasibilityStudy { get; set; }
        public DbSet<OptionProjectDetailedDesign> tOptionProjectDetailedDesign { get; set; }
        public DbSet<OptionProjectRowAvailable> tOptionProjectRowAvailable { get; set; }
        public DbSet<OptionRegionWide> tOptionRegionWide { get; set; }
        public DbSet<OptionProjectAgency> tOptionProjectAgency { get; set; }
        public DbSet<OptionProjectComponent> tOptionProjectComponent { get; set; }
        public DbSet<ProjectComponentCost> tProjectComponentCost { get; set; }
        public DbSet<ProjectComponentCostPerYear> tProjectComponentCostPerYear { get; set; }
        public DbSet<Models.Table.TransactionLog> tTransactionLog { get; set; }
        public DbSet<OptionScopeOfWork> tOptionScopeOfWork { get; set; }
        public DbSet<ProjectMajorWorkItem> tProjectMajorWorkItem { get; set; }
        public DbSet<ProjectMajorWorkLocations> tProjectMajorWorkLocations { get; set; }
        public DbSet<Models.Table.ProjectNotes> tProjectNotes { get; set; }
        public DbSet<ProjectSupportingDocs> tProjectSupportingDocs { get; set; }
        public DbSet<ProjectFundingProfile> tProjectFundingProfile { get; set; }
        public DbSet<Models.Table.ProjectFundingAgreementLists> tProjectFundingAgreementLists { get; set; }
        public DbSet<Models.Table.ProjectFundingSource> tProjectFundingSource { get; set; }
        public DbSet<OptionFundingSource> tOptionFundingSource { get; set; }
        public DbSet<OptionFundingAgreement> tOptionFundingAgreement { get; set; }
        public DbSet<Models.Table.InfraType> tInfraType { get; set; }
        public DbSet<Models.Table.ProjectsInGroup> tProjectsInGroup { get; set; }
        public DbSet<Models.Table.ProjectGroups> tProjectGroups { get; set; }
        public DbSet<OptionAdminAreaProvince> tOptionAdminAreaProvince { get; set; }
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
        public DbSet<OptionRevisionHeader> tOptionRevisionHeader { get; set; }
        public DbSet<OptionRevisionReasons> tOptionRevisionReasons { get; set; }
        public DbSet<OptionRevisionCategory> tOptionRevisionCategory { get; set; }
        public DbSet<OptionRevisionStatus> tOptionRevisionStatus { get; set; }
        public DbSet<OptionRevisionDocuments> tOptionRevisionDocuments { get; set; }
        public DbSet<Models.Table.RevisionRules> tRevisionRules { get; set; }
        public DbSet<Models.Table.RevisionTransactionLog> tRevisionTransactionLog { get; set; }
        public DbSet<Models.Table.RevisionProjects> tRevisionProjects { get; set; }
        public DbSet<Models.Table.RevisionProjectFundingProfile> tRevisionProjectFundingProfile { get; set; }
        public DbSet<Models.Table.RevisionProjectComponentCost> tRevisionProjectComponentCost { get; set; }
        public DbSet<Models.Table.RevisionProjectMajorWorkItem> tRevisionProjectMajorWorkItem { get; set; }
        public DbSet<Models.Table.RevisionProjectMajorWorkLocations> tRevisionProjectMajorWorkLocations { get; set; }
        public DbSet<Models.Table.RevisionDetailsComponentsStatus> tRevisionDetailsComponentsStatus { get; set; }
        public DbSet<Models.Table.RevisionProjectComponentCostPerYear> tRevisionProjectComponentCostPerYear { get; set; }
        public DbSet<OptionInfraType> tOptionInfraType { get; set; }
        public DbSet<Models.Table.ImportingStatus> tImportingStatus { get; set; }
        public DbSet<OptionCodeTables> tOptionCodeTables { get; set; }
        public DbSet<Models.Table.CodeTableTransactionLog> tCodeTableTransactionLog { get; set; }
        public DbSet<OptionReportProgram> tOptionReportProgram { get; set; }
        public DbSet<Models.Table.LoginHistory> tLoginHistory { get; set; }
        public DbSet<OptionGlobalSearch> tOptionGlobalSearch { get; set; }
        #endregion
        #region Views
        public DbSet<Models.Views.Users> vUsers { get; set; }
        public DbSet<Models.Views.AppModules> vAppModules { get; set; }
        public DbSet<Models.Views.UserActionPermission> vUserActionPermission { get; set; }
        public DbSet<Models.Views.UserViewPermission> vUserViewPermission { get; set; }
        public DbSet<Models.Views.UserGroups> vUserGroups { get; set; }
        public DbSet<Models.Views.APIPermissions> vAPIPermissions { get; set; }
        public DbSet<ProgramLatest> vProgramLatest { get; set; }
        public DbSet<Models.Views.Project.Projects> vProjects { get; set; }
        public DbSet<ProjectGroups> vProjectGroups { get; set; }
        public DbSet<ProjectsInGroup> vProjectsInGroup { get; set; }
        public DbSet<Models.Views.AdminOperatingUnit> vAdminOperatingUnit { get; set; }
        public DbSet<Models.Views.AdminImplementingOffice> vAdminImplementingOffice { get; set; }
        public DbSet<Models.Views.RevisionRules> vRevisionRules { get; set; }
        public DbSet<Models.Views.RevisionLists> vRevisionLists { get; set; }
        public DbSet<ProjectComponentCostStatus> vProjectComponentCostStatus { get; set; }
        public DbSet<Models.Views.Project.ProjectLatest> vProjectLatest { get; set; }
        #endregion
        #region Functions
        public DbSet<Models.Functions.Program.ProgramStages> fProgramStages { get; set; }
        public DbSet<ProgramDetails> fProgramDetails { get; set; }
        public DbSet<Models.Functions.Project.ProjectStages> fProjectStages { get; set; }
        public DbSet<Models.Functions.Project.ProjectDetails> fProjectDetails { get; set; }
        #endregion
        #region Stored Procedures
        public DbSet<Models.Procedures.myps_pub_program> sp_myps_pub_program { get; set; }
        public DbSet<Models.Procedures.RecomputeProjectPublishable> pRecomputeProjectPublishable { get; set; }
        #endregion
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<AdminOperatingUnit>().HasNoKey().ToView("vAdminOperatingUnit");
            modelBuilder.Entity<AdminImplementingOffice>().HasNoKey().ToView("vAdminImplementingOffice");
            // Component Cost → Costs Per Year
            modelBuilder.Entity<ProjectComponentCost>()
                .HasMany(x => x.CostsPerYear)
                .WithOne(x => x.ComponentCost)
                .HasForeignKey(x => x.ComponentCostFK)
                .OnDelete(DeleteBehavior.Restrict);

            // Component Cost → Major Work Items
            modelBuilder.Entity<ProjectComponentCost>()
                .HasMany(x => x.WorkItem)
                .WithOne(x => x.ComponentCost)
                .HasForeignKey(x => x.ComponentCostFK)
                .OnDelete(DeleteBehavior.Restrict);

            // Major Work Item → Work Locations
            modelBuilder.Entity<ProjectMajorWorkItem>()
                .HasMany(x => x.WorkLocations)
                .WithOne(x => x.WorkItem)
                .HasForeignKey(x => x.WorkItemFK)
                .OnDelete(DeleteBehavior.Restrict);

            base.OnModelCreating(modelBuilder);
        }
    }
}
