using DBHelper.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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
        public DbSet<Models.Table.ProjectCityEnum> tProjectCityEnum { get; set; }
        public DbSet<Models.Table.ProjectLegislativeDistrictEnum> tProjectLegislativeDistrictEnum { get; set; }
        public DbSet<Models.Table.ProjectOperatingUnitEnum> tProjectOperatingUnitEnum { get; set; }
        public DbSet<Models.Table.ProjectImplementingOfficeEnum> tProjectImplementingOfficeEnum { get; set; }
        public DbSet<Models.Table.ProjectDEOEnum> tProjectDEOEnum { get; set; }
        public DbSet<Models.Table.ProjectRODEOEnum> tProjectRODEOEnum { get; set; }
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
        public DbSet<Models.Table.ProjectNotes> tProjectNotes { get; set; }
        public DbSet<Models.Table.ProjectFundingProfile> tProjectFundingProfile { get; set; }
        public DbSet<Models.Table.ProjectFundingAgreementLists> tProjectFundingAgreementLists { get; set; }
        public DbSet<Models.Table.ProjectFundingSource> tProjectFundingSource { get; set; }
        public DbSet<Models.Table.InfraType> tInfraType { get; set; }
        public DbSet<Models.Table.ProjectInGroups> tProjectInGroups { get; set; }
        public DbSet<Models.Table.ProjectGroups> tProjectGroups { get; set; }
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
        #endregion
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }
    }
}
