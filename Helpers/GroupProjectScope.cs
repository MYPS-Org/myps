using DBHelper.Data;
using Microsoft.EntityFrameworkCore;

namespace Helpers
{
    /// <summary>
    /// Which projects a user group's members see. Set per group in User Management > User Groups
    /// (tGroups.ProjectScope) and read by the project view gate in <see cref="ProjectHelper"/>
    /// (2026-10-31). Before, it was fixed by group NAME: AUC and DPD Admin all, RPC the region, DPC the
    /// district. Those names are now only the fallback on a server where
    /// Migration.GroupProjectScope.2026-10-31.sql has not been run yet (<see cref="ByName"/>).
    /// </summary>
    public enum GroupProjectScope : byte
    {
        /// <summary>Today's rule for groups without a scope: with Apply Filter, the programs whose Data
        /// Security Access includes the user's region; without it, every project.</summary>
        DataSecurity = 0,
        /// <summary>Every project.</summary>
        All = 1,
        /// <summary>Every district office in the region of the user's Plantilla Office.</summary>
        Region = 2,
        /// <summary>The district office that is the user's Plantilla Office.</summary>
        District = 3,
        /// <summary>The UPMO cluster that is the user's Plantilla Office (2026-10-31). It scopes the
        /// Multi-Year portfolios only (Helpers/MultiYear/MultiYearAccess.cs): that cluster's UDIP, or
        /// every UDIP for the UPMO itself. For projects it is <see cref="DataSecurity"/>; see
        /// <see cref="GroupProjectScopes.Widest"/>. Storable once
        /// Migration.GroupProjectScopeCluster.2026-10-31.sql has widened the column's check.</summary>
        Cluster = 4,
    }

    public static class GroupProjectScopes
    {
        // Once the column exists it stays; until then every call checks again, so running the script
        // takes effect without a restart.
        private static volatile bool _columnSeen;

        /// <summary>True once tGroups.ProjectScope exists on this database.</summary>
        public static async Task<bool> IsConfigurableAsync(MYPSDbContext db, CancellationToken ct)
        {
            if (_columnSeen) return true;
            bool present = await db.Database
                .SqlQuery<int>($"SELECT CASE WHEN COL_LENGTH('dbo.tGroups', 'ProjectScope') IS NULL THEN 0 ELSE 1 END AS Value")
                .SingleAsync(ct) == 1;
            if (present) _columnSeen = true;
            return present;
        }

        /// <summary>The scope the group names gave before the setting existed; also the migration's seed.</summary>
        public static GroupProjectScope ByName(string? groupName) => groupName switch
        {
            "AUC" or "DPD Admin" => GroupProjectScope.All,
            "RPC" => GroupProjectScope.Region,
            "DPC" => GroupProjectScope.District,
            _ => GroupProjectScope.DataSecurity,
        };

        public static bool IsValid(int value) => value is >= 0 and <= 4;

        /// <summary>
        /// True once Migration.GroupProjectScopeCluster.2026-10-31.sql has widened
        /// CK_tGroups_ProjectScope to 0-4. Until then the database refuses <see cref="GroupProjectScope.Cluster"/>.
        /// </summary>
        public static async Task<bool> IsClusterStorableAsync(MYPSDbContext db, CancellationToken ct) =>
            await IsConfigurableAsync(db, ct)
            && await db.Database
                .SqlQuery<int>($"SELECT COUNT(*) AS Value FROM sys.check_constraints WHERE name = N'CK_tGroups_ProjectScope' AND parent_object_id = OBJECT_ID(N'dbo.tGroups') AND definition LIKE N'%<=(4)%'")
                .SingleAsync(ct) > 0;

        /// <summary>
        /// The project view scope of a user in several groups: All wins; otherwise Region and District
        /// add up; otherwise DataSecurity. Null means DataSecurity (the user is in no group with a
        /// scope). Cluster is not a project scope, so it counts as DataSecurity here.
        /// </summary>
        public static GroupProjectScope? Widest(IEnumerable<GroupProjectScope> scopes, out bool region, out bool district)
        {
            var set = scopes.ToHashSet();
            region = set.Contains(GroupProjectScope.Region);
            district = set.Contains(GroupProjectScope.District);
            if (set.Contains(GroupProjectScope.All)) return GroupProjectScope.All;
            if (region || district) return region ? GroupProjectScope.Region : GroupProjectScope.District;
            return null;
        }

        public sealed class GroupScopeRow
        {
            public int Id { get; set; }
            public int Scope { get; set; }
        }

        /// <summary>Every group's scope, by tGroups.Id.</summary>
        public static async Task<Dictionary<int, GroupProjectScope>> LoadAsync(MYPSDbContext db, CancellationToken ct)
        {
            if (await IsConfigurableAsync(db, ct))
                return (await db.Database
                        .SqlQuery<GroupScopeRow>($"SELECT Id, CAST(ProjectScope AS int) AS Scope FROM dbo.tGroups")
                        .ToListAsync(ct))
                    .ToDictionary(r => r.Id, r => IsValid(r.Scope) ? (GroupProjectScope)r.Scope : GroupProjectScope.DataSecurity);

            return (await db.tGroups.AsNoTracking().Select(g => new { g.Id, g.GroupName }).ToListAsync(ct))
                .ToDictionary(g => g.Id, g => ByName(g.GroupName));
        }

        /// <summary>Saves a group's scope; joins the caller's transaction. Call only when <see cref="IsConfigurableAsync"/>.</summary>
        public static Task SaveAsync(MYPSDbContext db, int groupId, GroupProjectScope scope, CancellationToken ct) =>
            db.Database.ExecuteSqlInterpolatedAsync($"UPDATE dbo.tGroups SET ProjectScope = {(byte)scope} WHERE Id = {groupId}", ct);
    }
}
