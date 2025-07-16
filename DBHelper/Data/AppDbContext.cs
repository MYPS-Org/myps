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
        #endregion
        #region Views
        public DbSet<Models.Views.Users> vUsers { get; set; }
        public DbSet<Models.Views.UserGroups> vUserGroups { get; set; }
        public DbSet<Models.Views.Permissions> vPermissions { get; set; }
        public DbSet<Models.Views.Programs> vPrograms { get; set; }
        #endregion
    }
}
