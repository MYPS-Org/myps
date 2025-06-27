using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Models.Table;
using Microsoft.EntityFrameworkCore;

namespace DBHelper.Data
{
    public class AppDbContext : DbContext
    {
        public DbSet<User> tUsers { get; set; }
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        //protected override void OnModelCreating(ModelBuilder modelBuilder)
        //{
        //    base.OnModelCreating(modelBuilder);

            // Define relationships
            //modelBuilder.Entity<Project>()
            //    .HasOne(p => p.User)
            //    .WithMany()
            //    .HasForeignKey(p => p.UserId);

            //modelBuilder.Entity<Project>()
            //    .HasOne(p => p.ProgramStage)
            //    .WithMany(ps => ps.Projects)
            //    .HasForeignKey(p => p.ProgramStageId);

            //modelBuilder.Entity<ProgramStage>()
            //    .HasOne(ps => ps.Program)
            //    .WithMany(p => p.ProgramStages)
            //    .HasForeignKey(ps => ps.ProgramId);

            //// Seed program stages if needed
            //modelBuilder.Entity<Program>().HasData(
            //    new Program { ProgramId = "RBP", ProgramName = "RBP", ProgramDescription = "Research-Based Program", ProgramStage = "1" },
            //    new Program { ProgramId = "UWP", ProgramName = "UWP", ProgramDescription = "Upstream Work Program", ProgramStage = "2" },
            //    // Add other program stages
            //    new Program { ProgramId = "GAA", ProgramName = "GAA", ProgramDescription = "General Appropriations Act", ProgramStage = "9" }
            //);
        //}
    }
}
