using DBHelper.Models.Enums;
using DBHelper.Models.Functions.Program;
using DBHelper.Models.Functions.Project;
using DBHelper.Models.Table.Infra;
using DBHelper.Models.Table.Lookups;
using DBHelper.Models.Table.Lookups.Project;
using DBHelper.Models.Table.Permission;
using DBHelper.Models.Table.Program;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Table.User;
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
        #region Admin Areas

        #region Tables
        public DbSet<Models.Table.AdminAreas.OptionAdminAreaCityMunicipality> tOptionAdminAreaCityMunicipality { get; set; }
        public DbSet<Models.Table.AdminAreas.OptionAdminAreaCongressionalDistrict> tOptionAdminAreaCongressionalDistrict { get; set; }
        public DbSet<Models.Table.AdminAreas.OptionAdminAreaProvince> tOptionAdminAreaProvince { get; set; }
        public DbSet<Models.Table.AdminAreas.OptionAdminAreaRegion> tOptionAdminAreaRegion { get; set; }
        public DbSet<Models.Table.AdminAreas.OptionAdminOffice> tOptionAdminOffice { get; set; }
        #endregion

        #region Views
        public DbSet<Models.Views.AdminAreas.AdminBureau> vAdminBureau { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminCentralOffice> vAdminCentralOffice { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminDEO> vAdminDEO { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminDivision> vAdminDivision { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminImplementingOffice> vAdminImplementingOffice { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminOfficeRegion> vAdminOfficeRegion { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminOperatingUnit> vAdminOperatingUnit { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminPMOCluster> vAdminPMOCluster { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminService> vAdminService { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminSubDEO> vAdminSubDEO { get; set; }
        public DbSet<Models.Views.AdminAreas.AdminUPMO> vAdminUPMO { get; set; }
        #endregion

        #endregion

        #region Programs

        #region Tables
        public DbSet<Models.Table.Program.Programs> tPrograms { get; set; }
        public DbSet<Models.Table.Program.ProgramStages> tProgramStages { get; set; }
        public DbSet<ProgramRevisions> tProgramRevisions { get; set; }
        public DbSet<OptionProgramStage> tOptionProgramStage { get; set; }
        public DbSet<OptionProgramType> tOptionProgramType { get; set; }
        public DbSet<OptionProgramStatus> tOptionProgramStatus { get; set; }
        #endregion

        #region Functions
        public DbSet<Models.Functions.Program.ProgramStages> fProgramStages { get; set; }
        public DbSet<Models.Functions.Program.UserVisiblePrograms> fUserVisiblePrograms { get; set; }
        public DbSet<ProgramDetails> fProgramDetails { get; set; }
        public DbSet<ProgramDetailsInProject> fProgramDetailsInProject { get; set; }
        #endregion

        #region Views
        public DbSet<ProgramLatest> vProgramLatest { get; set; }
        #endregion

        #region Stored Procedures
        public DbSet<Models.Procedures.myps_pub_program> sp_myps_pub_program { get; set; }
        public DbSet<Models.Procedures.RecomputeProjectPublishable> pRecomputeProjectPublishable { get; set; }
        #endregion

        #endregion

        #region Others

        #region Table
        public DbSet<Models.Table.TransactionLog> tTransactionLog { get; set; }
        public DbSet<Models.Table.ImportingStatus> tImportingStatus { get; set; }
        public DbSet<Models.Table.CodeTableTransactionLog> tCodeTableTransactionLog { get; set; }
        public DbSet<Models.Table.LoginHistory> tLoginHistory { get; set; }
        public DbSet<Models.Table.ImportJobResult> tImportJobResult { get; set; }
        #endregion

        #region Views
        public DbSet<Models.Functions.Others.UserVisibleRegions> fUserVisibleRegions { get; set; }
        public DbSet<Models.Functions.Others.UserVisibleOffices> fUserVisibleOffices { get; set; }
        #endregion

        #region Functions
        #endregion

        #region Lookups
        public DbSet<OptionGlobalSearch> tOptionGlobalSearch { get; set; }
        public DbSet<OptionCodeTables> tOptionCodeTables { get; set; }
        public DbSet<OptionReportProgram> tOptionReportProgram { get; set; }
        #endregion

        #region Raw SQL
        public virtual DbSet<PaginationCount> PaginationCounts { get; set; }
        #endregion

        #endregion

        #region Projects

        #region Tables
        public DbSet<Models.Table.Project.Projects> tProjects { get; set; }
        public DbSet<ProjectRevisions> tProjectRevisions { get; set; }
        public DbSet<Models.Table.Project.ProjectStages> tProjectStages { get; set; }

        public DbSet<Models.Table.Project.ProjectFundingProfile> tProjectFundingProfile { get; set; }

        public DbSet<Models.Table.Project.ProjectComponentCost> tProjectComponentCost { get; set; }
        public DbSet<Models.Table.Project.ProjectComponentCostPerYear> tProjectComponentCostPerYear { get; set; }

        public DbSet<Models.Table.Project.ProjectMajorWorkItem> tProjectMajorWorkItem { get; set; }
        public DbSet<Models.Table.Project.ProjectMajorWorkLocations> tProjectMajorWorkLocations { get; set; }


        public DbSet<Models.Table.ProjectNotes> tProjectNotes { get; set; }
        public DbSet<ProjectSupportingDocs> tProjectSupportingDocs { get; set; }
        #endregion

        #region Views
        public DbSet<Models.Views.Project.Projects> vProjects { get; set; }
        public DbSet<Models.Views.Project.ProjectLatest> vProjectLatest { get; set; }
        #endregion

        #region Functions
        public DbSet<Models.Functions.Project.ProjectStages> fProjectStages { get; set; }
        public DbSet<Models.Functions.Project.UserVisibleProjects> fUserVisibleProjects { get; set; }
        public DbSet<Models.Functions.Project.ProjectDetails> fProjectDetails { get; set; }
        public DbSet<Models.Functions.Project.ProjectFundingProfile> fProjectFundingProfile { get; set; }

        public DbSet<Models.Functions.Project.ProjectComponentCost> fProjectComponentCost { get; set; }
        public DbSet<Models.Functions.Project.ProjectComponentCostPerYear> fProjectComponentCostPerYear { get; set; }

        public DbSet<Models.Functions.Project.ProjectMajorWorkItem> fProjectMajorWorkItem { get; set; }
        public DbSet<Models.Functions.Project.ProjectMajorWorkLocations> fProjectMajorWorkLocations { get; set; }
        #endregion

        #region Lookups
        public DbSet<Models.Table.Lookups.Project.OptionProjectTier> tOptionProjectTier { get; set; }
        public DbSet<OptionProjectCategory> tOptionProjectCategory { get; set; }
        public DbSet<Models.Table.Lookups.Project.OptionProjectThrustList> tOptionProjectThrustList { get; set; }

        public DbSet<OptionRegionWide> tOptionRegionWide { get; set; }
        public DbSet<OptionProjectOrigin> tOptionProjectOrigin { get; set; }
        public DbSet<OptionProjectAgency> tOptionProjectAgency { get; set; }
        public DbSet<OptionProjectImplementationMode> tOptionProjectImplementationMode { get; set; }
        public DbSet<OptionProjectEmergencyMode> tOptionProjectEmergencyMode { get; set; }
        public DbSet<OptionProjectRowAvailable> tOptionProjectRowAvailable { get; set; }
        public DbSet<OptionProjectFeasibilityStudy> tOptionProjectFeasibilityStudy { get; set; }
        public DbSet<OptionProjectDetailedDesign> tOptionProjectDetailedDesign { get; set; }

        public DbSet<OptionFundingSource> tOptionFundingSource { get; set; }
        public DbSet<OptionFundingAgreement> tOptionFundingAgreement { get; set; }

        public DbSet<OptionProjectComponentType> tOptionProjectComponentType { get; set; }
        public DbSet<OptionProjectComponentTypeModule> tOptionProjectComponentTypeModule { get; set; }

        public DbSet<OptionScopeOfWork> tOptionScopeOfWork { get; set; }

        public DbSet<Models.Table.DropdownSupportingDocs> tDropdownSupportingDocs { get; set; }
        #endregion

        #endregion

        #region Project Group

        #region Tables
        public DbSet<Models.Table.ProjectsInGroup> tProjectsInGroup { get; set; }
        public DbSet<Models.Table.ProjectGroups> tProjectGroups { get; set; }
        #endregion

        #region Views
        public DbSet<ProjectGroups> vProjectGroups { get; set; }
        public DbSet<ProjectsInGroup> vProjectsInGroup { get; set; }
        #endregion

        #endregion

        #region PCMA
        public DbSet<Models.Table.PCMARevisions> tPCMARevisions { get; set; }
        public DbSet<Models.Table.PCMARevisionDetails> tPCMARevisionDetails { get; set; }
        public DbSet<Models.Table.PCMARevisionChangelogs> tPCMARevisionChangelogs { get; set; }
        #endregion

        #region Revisions

        #region Tables
        public DbSet<Models.Table.RevisionDetails> tRevisionDetails { get; set; }
        public DbSet<Models.Table.RevisionDocuments> tRevisionDocuments { get; set; }
        public DbSet<Models.Table.RevisionForCorrectionDetails> tRevisionForCorrectionDetails { get; set; }
        public DbSet<Models.Table.RevisionRules> tRevisionRules { get; set; }
        public DbSet<Models.Table.RevisionTransactionLog> tRevisionTransactionLog { get; set; }
        public DbSet<Models.Table.RevisionProjects> tRevisionProjects { get; set; }
        public DbSet<Models.Table.RevisionProjectFundingProfile> tRevisionProjectFundingProfile { get; set; }
        public DbSet<Models.Table.RevisionProjectComponentCost> tRevisionProjectComponentCost { get; set; }
        public DbSet<Models.Table.RevisionProjectMajorWorkItem> tRevisionProjectMajorWorkItem { get; set; }
        public DbSet<Models.Table.RevisionProjectMajorWorkLocations> tRevisionProjectMajorWorkLocations { get; set; }
        public DbSet<Models.Table.RevisionDetailsComponentsStatus> tRevisionDetailsComponentsStatus { get; set; }
        public DbSet<Models.Table.RevisionProjectComponentCostPerYear> tRevisionProjectComponentCostPerYear { get; set; }
        #endregion

        #region Lookups
        public DbSet<OptionRevisionHeader> tOptionRevisionHeader { get; set; }
        public DbSet<OptionRevisionReasons> tOptionRevisionReasons { get; set; }
        public DbSet<OptionRevisionCategory> tOptionRevisionCategory { get; set; }
        public DbSet<OptionRevisionStatus> tOptionRevisionStatus { get; set; }
        public DbSet<OptionRevisionDocuments> tOptionRevisionDocuments { get; set; }
        #endregion

        #endregion

        #region Infra

        #region Tables
        public DbSet<FutureRoads> tFutureRoads { get; set; }
        public DbSet<FutureRoadsClassification> tFutureRoadsClassification { get; set; }
        public DbSet<FutureRoadSections> tFutureRoadSections { get; set; }
        public DbSet<FutureBridge> tFutureBridge { get; set; }
        #endregion

        #region Lookups
        public DbSet<OptionInfraType> tOptionInfraType { get; set; }
        #endregion

        #endregion

        #region Users and User Access

        #region Tables
        public DbSet<Models.Table.User.Users> tUsers { get; set; }
        public DbSet<Models.Table.Permission.AppModules> tAppModules { get; set; }
        public DbSet<ApiControllers> tPermissionControllers { get; set; }
        public DbSet<ApiActions> tPermissionActions { get; set; }
        public DbSet<AppViews> tAppViews { get; set; }
        public DbSet<GroupRoles> tGroupRoles { get; set; }
        public DbSet<Models.Table.User.UserGroups> tUserGroups { get; set; }
        public DbSet<Groups> tGroups { get; set; }
        #endregion

        #region Views
        public DbSet<Models.Views.Users> vUsers { get; set; }
        public DbSet<Models.Views.AppModules> vAppModules { get; set; }
        public DbSet<Models.Views.UserActionPermission> vUserActionPermission { get; set; }
        public DbSet<Models.Views.UserViewPermission> vUserViewPermission { get; set; }
        public DbSet<Models.Views.UserGroups> vUserGroups { get; set; }
        public DbSet<Models.Views.APIPermissions> vAPIPermissions { get; set; }
        public DbSet<Models.Views.RevisionRules> vRevisionRules { get; set; }
        public DbSet<Models.Views.RevisionLists> vRevisionLists { get; set; }
        public DbSet<ProjectComponentCostStatus> vProjectComponentCostStatus { get; set; }
        #endregion

        #endregion

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Models.Views.AdminAreas.AdminOperatingUnit>().HasNoKey().ToView("vAdminOperatingUnit");
            modelBuilder.Entity<Models.Views.AdminAreas.AdminImplementingOffice>().HasNoKey().ToView("vAdminImplementingOffice");
            modelBuilder.Entity<Models.Views.AdminAreas.AdminOfficeRegion>().HasNoKey().ToView("vAdminOfficeRegion");
            modelBuilder.Entity<UserVisibleProjects>().HasNoKey().ToView("fUserVisibleProjects");
            modelBuilder.Entity<UserVisiblePrograms>().HasNoKey().ToView("fUserVisiblePrograms");
            modelBuilder.Entity<PaginationCount>().HasNoKey().ToView("PaginationCount");
            // Component Cost → Costs Per Year
            modelBuilder.Entity<Models.Table.Project.ProjectComponentCost>()
                .HasMany(x => x.CostsPerYear)
                .WithOne(x => x.ComponentCost)
                .HasForeignKey(x => x.ComponentCostFK)
                .OnDelete(DeleteBehavior.Restrict);

            // Component Cost → Major Work Items
            modelBuilder.Entity<Models.Table.Project.ProjectComponentCost>()
                .HasMany(x => x.WorkItem)
                .WithOne(x => x.ComponentCost)
                .HasForeignKey(x => x.ComponentCostFK)
                .OnDelete(DeleteBehavior.Restrict);

            // Major Work Item → Work Locations
            modelBuilder.Entity<Models.Table.Project.ProjectMajorWorkItem>()
                .HasMany(x => x.WorkLocations)
                .WithOne(x => x.WorkItem)
                .HasForeignKey(x => x.WorkItemFK)
                .OnDelete(DeleteBehavior.Restrict);

            base.OnModelCreating(modelBuilder);
        }
    }
}
