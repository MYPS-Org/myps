using DBHelper.Models.Views;
using Microsoft.EntityFrameworkCore;

namespace DBHelper.Data
{
    public class PCMADbContext : DbContext
    {
        public PCMADbContext(DbContextOptions<PCMADbContext> options) : base(options) {
            this.Database.SetCommandTimeout(TimeSpan.FromMinutes(30));
        }
        #region Tables
        #endregion
        #region Views
        public DbSet<Models.Views.PCMAProjectComponentStatus> vPCMAProjectComponentStatus { get; set; }
        #endregion
        #region Functions
        #endregion
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }
    }
}
