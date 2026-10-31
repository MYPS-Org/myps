using DBHelper.Data;
using DBHelper.Models.Table.Project;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MYPS.DatabaseTests;

// 2026-10-31 (documents/plans/multi-year-phase-1-portfolio-module.md, Task 0). The MYOA date lives in
// tProjectComponentCostPerYear.DateOfApproval. Unmapped, the stage-advance and restore copies in
// ProgramController wrote every new year row without it. Builds the EF model only; no database.
public class YearRowMyoaDateMappingTests
{
    [Fact]
    public void YearRow_MapsTheMyoaDateColumn()
    {
        var options = new DbContextOptionsBuilder<MYPSDbContext>().UseSqlServer("Server=unused;Database=unused").Options;
        using var db = new MYPSDbContext(options);

        var property = db.Model.FindEntityType(typeof(ProjectComponentCostPerYear))?.FindProperty(nameof(ProjectComponentCostPerYear.DateOfApproval));

        Assert.NotNull(property);
        Assert.Equal("DateOfApproval", property!.GetColumnName());
        Assert.True(property.IsNullable);
    }
}
