using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DBHelper.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace DBHelper.Data
{
    public class AppDbContext : DbContext
    {
        public DbSet<User> tUsers { get; set; }
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    }
}
