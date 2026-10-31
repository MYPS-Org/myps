using DBHelper.Data;
using DBHelper.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace Helpers.MultiYear
{
    /// <summary>
    /// Which RDIP, UDIP and PIP portfolios a user sees (MY-PFL-08, -26). Decided by the user's groups'
    /// Project visibility (Edit Group, tGroups.ProjectScope) and offices, never by group names:
    ///   All projects          every portfolio, PIP included
    ///   Own region            the RDIP of the region that is the Plantilla Office
    ///   Own district office   the RDIP of the region of the DEO that is the Plantilla Office
    ///   Own UPMO cluster      the UDIP of the PMO cluster office that is the Plantilla Office,
    ///                         or every UDIP when the Plantilla Office is the UPMO itself
    ///   By program Data       only when no group has one of the above: without Apply Filter every
    ///   Security              RDIP and UDIP; with it, the RDIP of the region of tUsers.RegCode, or
    ///                         every RDIP and UDIP when that office has no region (Central Office,
    ///                         UPMO) -- the same office test as dbo.fUserVisiblePrograms.
    /// PIP: All projects, or the Show PIP grant (MultiYearController.ShowPipPortfolios).
    /// Several groups add up. An office that does not fit its scope shows nothing (fail closed).
    /// </summary>
    public static class MultiYearAccess
    {
        public const string ControllerName = "MultiYearController";
        public const string ShowPipAction = "ShowPipPortfolios";

        public sealed class PortfolioVisibility
        {
            public bool All { get; init; }
            public bool AllRdip { get; init; }
            public bool AllUdip { get; init; }
            public bool Pip { get; init; }
            public IReadOnlySet<string> RdipOwners { get; init; } = new HashSet<string>();
            public IReadOnlySet<string> UdipOwners { get; init; } = new HashSet<string>();

            public bool CanSee(EnumPortfolioKind kind, string? owner) => kind switch
            {
                EnumPortfolioKind.PIP => All || Pip,
                EnumPortfolioKind.RDIP => All || AllRdip || (owner != null && RdipOwners.Contains(owner)),
                EnumPortfolioKind.UDIP => All || AllUdip || (owner != null && UdipOwners.Contains(owner)),
                _ => false,
            };
        }

        /// <summary>What the database says about the user's two office columns.</summary>
        public sealed record OfficeFacts
        {
            /// <summary>tUsers.PlantillaOffice, trimmed.</summary>
            public string? PlantillaOffice { get; init; }
            public bool PlantillaIsRegion { get; init; }
            /// <summary>The region of the DEO that is the Plantilla Office; null when it is no DEO.</summary>
            public string? PlantillaDeoRegion { get; init; }
            public bool PlantillaIsPmoCluster { get; init; }
            public bool PlantillaIsUpmo { get; init; }
            /// <summary>tUsers.RegCode's office has no region (Central Office, UPMO, ...).</summary>
            public bool DataSecurityOfficeHasNoRegion { get; init; }
            /// <summary>tUsers.RegCode's region: the office itself when it is a region, else its region.</summary>
            public string? DataSecurityRegion { get; init; }
        }

        /// <summary>The rule above, from facts already read. Pure, so it is unit-tested directly.</summary>
        public static PortfolioVisibility Decide(IEnumerable<GroupProjectScope> groupScopes, OfficeFacts office, bool applyFilter, bool hasPipGrant)
        {
            var scopes = groupScopes.ToHashSet();
            if (scopes.Count == 0) scopes.Add(GroupProjectScope.DataSecurity);

            if (scopes.Contains(GroupProjectScope.All))
                return new PortfolioVisibility { All = true, Pip = true };

            var rdip = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var udip = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            bool allRdip = false, allUdip = false;
            string? plantilla = office.PlantillaOffice;

            if (scopes.Contains(GroupProjectScope.Region) && office.PlantillaIsRegion && plantilla != null)
                rdip.Add(plantilla);
            if (scopes.Contains(GroupProjectScope.District) && office.PlantillaDeoRegion != null)
                rdip.Add(office.PlantillaDeoRegion);
            if (scopes.Contains(GroupProjectScope.Cluster))
            {
                if (office.PlantillaIsUpmo) allUdip = true;
                else if (office.PlantillaIsPmoCluster && plantilla != null) udip.Add(plantilla);
            }

            bool hasOfficeScope = scopes.Contains(GroupProjectScope.Region)
                || scopes.Contains(GroupProjectScope.District)
                || scopes.Contains(GroupProjectScope.Cluster);
            if (!hasOfficeScope)
            {
                if (!applyFilter || office.DataSecurityOfficeHasNoRegion)
                    allRdip = allUdip = true;
                else if (office.DataSecurityRegion != null)
                    rdip.Add(office.DataSecurityRegion);
            }

            return new PortfolioVisibility
            {
                AllRdip = allRdip,
                AllUdip = allUdip,
                Pip = hasPipGrant,
                RdipOwners = rdip,
                UdipOwners = udip,
            };
        }

        /// <summary>Reads the user's group scopes, offices and Show PIP grant, then <see cref="Decide"/>.</summary>
        public static async Task<PortfolioVisibility> ResolveAsync(MYPSDbContext db, DBHelper.Models.Views.Users session, CancellationToken ct)
        {
            var scopes = await GroupProjectScopes.LoadAsync(db, ct);
            var groupScopes = (session.UserGroupIds ?? Array.Empty<int>())
                .Select(id => scopes.TryGetValue(id, out var s) ? s : GroupProjectScope.DataSecurity)
                .ToList();

            // OFFICE SOURCE: the same two tUsers columns the project view gate (ProjectHelper) and
            // dbo.fUserVisiblePrograms read.
            var user = await db.tUsers.AsNoTracking()
                .Where(u => u.UserId == session.UserId)
                .Select(u => new { u.PlantillaOffice, u.RegCode })
                .FirstOrDefaultAsync(ct);
            string? plantilla = string.IsNullOrWhiteSpace(user?.PlantillaOffice) ? null : user!.PlantillaOffice!.Trim();
            string? regCode = string.IsNullOrWhiteSpace(user?.RegCode) ? null : user!.RegCode.Trim();

            var facts = new OfficeFacts { PlantillaOffice = plantilla };
            if (plantilla != null)
            {
                facts = facts with
                {
                    PlantillaIsRegion = await db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(r => r.ParticipantId == plantilla, ct),
                    PlantillaDeoRegion = await db.vAdminDEO.AsNoTracking().Where(d => d.ParticipantId == plantilla).Select(d => d.RegionParticipantId).FirstOrDefaultAsync(ct),
                    PlantillaIsPmoCluster = await db.vAdminPMOCluster.AsNoTracking().AnyAsync(c => c.ParticipantId == plantilla, ct),
                    PlantillaIsUpmo = await db.vAdminUPMO.AsNoTracking().AnyAsync(u => u.ParticipantId == plantilla, ct),
                };
            }
            if (regCode != null)
            {
                bool regCodeIsRegion = await db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(r => r.ParticipantId == regCode, ct);
                var officeRegion = await db.vAdminOfficeRegion.AsNoTracking()
                    .Where(o => o.OfficeParticipantId == regCode)
                    .Select(o => new { o.RegionParticipantId })
                    .FirstOrDefaultAsync(ct);
                facts = facts with
                {
                    DataSecurityOfficeHasNoRegion = !regCodeIsRegion && officeRegion != null && officeRegion.RegionParticipantId == null,
                    DataSecurityRegion = regCodeIsRegion ? regCode : officeRegion?.RegionParticipantId,
                };
            }

            bool pipGrant = await db.vUserActionPermission.AsNoTracking().AnyAsync(x =>
                x.UserId == session.UserId && x.IsActive
                && x.PermissionController == ControllerName && x.PermissionAction == ShowPipAction, ct);

            return Decide(groupScopes, facts, session.ApplyFilter, pipGrant);
        }
    }
}
