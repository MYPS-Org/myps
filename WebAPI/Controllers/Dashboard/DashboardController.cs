using DBHelper.Data;
using DBHelper.Models.Views.Project;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WebAPI.MicroService;

namespace WebAPI.Controllers.Dashboard
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    // Dashboard is a read-only portfolio projection of the same project set as
    // the repository. Reuse its established list permission so existing users
    // who can browse projects can load the dashboard without a one-off database
    // permission migration.
    [PermissionFilter("ProjectController", "ShowProjects")]
    public class DashboardController : CoreController
    {
        private const int MinimumFiscalYear = 2000;
        private const int MaximumFiscalYear = 2200;

        public DashboardController(
            MYPSDbContext db,
            IHubContext<SignalRHub> hub,
            PCMADbContext pcma,
            IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        [HttpPost]
        public async Task<IActionResult> Summary(
            [FromBody] DashboardRequestDTO dto,
            CancellationToken cancellationToken)
        {
            try
            {
                IQueryable<ProjectLatest> visibleProjects = _db.vProjectLatest.AsNoTracking();
                if (_Session.ApplyFilter)
                {
                    var allowedProjects = _db.fUserVisibleProjects
                        .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleProjects({_Session.UserId})");
                    visibleProjects = visibleProjects.Where(project =>
                        allowedProjects.Any(allowed => allowed.ProjectPK == project.ProjectPK));
                }

                var annualProjectBudgets = await (
                    from project in visibleProjects
                    join component in _db.tProjectComponentCost.AsNoTracking()
                        on project.RevisionId equals component.ProjectRevisionFK
                    join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                        on component.Id equals cost.ComponentCostFK
                    where !component.IsDeleted
                        && !cost.IsDeleted
                        && cost.Year >= MinimumFiscalYear
                        && cost.Year <= MaximumFiscalYear
                    group cost by cost.Year into yearGroup
                    orderby yearGroup.Key
                    select new
                    {
                        Year = yearGroup.Key,
                        Amount = yearGroup.Sum(item => item.Amount)
                    }).ToListAsync(cancellationToken);

                var walletQuery = _db.vLSProjectSet.AsNoTracking();
                if (_Session.ApplyFilter)
                {
                    var allowedProjects = _db.fUserVisibleProjects
                        .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleProjects({_Session.UserId})");
                    walletQuery = walletQuery.Where(wallet =>
                        allowedProjects.Any(allowed => allowed.ProjectPK == wallet.ProjectPK));
                }

                // A wallet's fiscal year belongs to its persisted Program. Join
                // it directly instead of inferring the year from dates or
                // requiring the LS view to duplicate that field.
                var annualWallets = await (
                    from wallet in walletQuery
                    join program in _db.vProgramLatest.AsNoTracking()
                        on wallet.ProgramFK equals program.ProgramPK
                    where program.StartYear >= MinimumFiscalYear
                        && program.StartYear <= MaximumFiscalYear
                    group wallet by program.StartYear into yearGroup
                    select new
                    {
                        Year = yearGroup.Key,
                        Total = yearGroup.Sum(wallet => wallet.OriginalAllocation),
                        Itemized = yearGroup.Sum(wallet => wallet.ItemizedTotal)
                    }).ToListAsync(cancellationToken);

                var availableYears = annualProjectBudgets.Select(item => item.Year)
                    .Concat(annualWallets.Select(item => item.Year))
                    .Distinct()
                    .OrderByDescending(year => year)
                    .ToArray();
                if (availableYears.Length == 0)
                {
                    availableYears = [DateTime.UtcNow.Year];
                }
                var selectedYear = dto.Year
                    ?? availableYears[0];

                var projectBudgets = await (
                    from project in visibleProjects
                    join component in _db.tProjectComponentCost.AsNoTracking()
                        on project.RevisionId equals component.ProjectRevisionFK
                    join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                        on component.Id equals cost.ComponentCostFK
                    where !component.IsDeleted && !cost.IsDeleted && cost.Year == selectedYear
                    group new { project, cost } by new
                    {
                        project.Id,
                        project.ProjectPK,
                        project.RevisionId,
                        project.ProjectId,
                        project.Description,
                        project.ProgramName,
                        project.Region,
                        project.CategoryName,
                        project.StageName,
                        project.ImplementingOffice,
                        project.LastUpdatedBy,
                        project.LastUpdatedDate,
                        project.RevisionCreatedBy,
                        project.RevisionCreatedDate
                    } into projectGroup
                    select new
                    {
                        projectGroup.Key,
                        Budget = projectGroup.Sum(item => item.cost.Amount)
                    }).ToListAsync(cancellationToken);

                var projectKeys = projectBudgets.Select(item => item.Key.ProjectPK).ToArray();
                var projectFlags = await _db.tProjects.AsNoTracking()
                    .Where(project => projectKeys.Contains(project.ProjectPK))
                    .Select(project => new
                    {
                        project.Id,
                        project.ProjectPK,
                        project.IsPublished,
                        project.IsPublishable,
                        project.IsRevised
                    })
                    .ToDictionaryAsync(item => item.ProjectPK, cancellationToken);

                var regionIds = projectBudgets.Select(item => item.Key.Region)
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Distinct()
                    .ToArray();
                var regionLookup = await _db.tOptionAdminAreaRegion.AsNoTracking()
                    .Where(region => regionIds.Contains(region.ParticipantId))
                    .Select(region => new { region.ParticipantId, region.Name, region.IslandCode })
                    .ToDictionaryAsync(region => region.ParticipantId, cancellationToken);

                var officeIds = projectBudgets.Select(item => item.Key.ImplementingOffice)
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Distinct()
                    .ToArray();
                var officeLookup = await _db.vAdminImplementingOffice.AsNoTracking()
                    .Where(office => officeIds.Contains(office.ParticipantId))
                    .Select(office => new { office.ParticipantId, office.Name })
                    .ToDictionaryAsync(office => office.ParticipantId, cancellationToken);

                var revisionIds = projectBudgets.Select(item => item.Key.RevisionId).Distinct().ToArray();
                var fundingRows = await _db.tProjectFundingProfile.AsNoTracking()
                    .Where(funding => revisionIds.Contains(funding.ProjectRevisionFK) && !funding.IsDeleted)
                    .Select(funding => new { funding.ProjectRevisionFK, funding.SourceOrg })
                    .ToListAsync(cancellationToken);
                var sourceOrganizations = fundingRows.Select(funding => funding.SourceOrg)
                    .Where(source => !string.IsNullOrWhiteSpace(source))
                    .Distinct()
                    .ToArray();
                var sourceRows = await _db.tOptionFundingSource.AsNoTracking()
                    .Where(source => sourceOrganizations.Contains(source.Organization))
                    .Select(source => new { source.Organization, source.Name })
                    .ToListAsync(cancellationToken);
                var sourceLookup = sourceRows.GroupBy(source => source.Organization)
                    .ToDictionary(group => group.Key, group => group.First().Name);
                var fundingLookup = fundingRows
                    .GroupBy(funding => funding.ProjectRevisionFK)
                    .ToDictionary(
                        group => group.Key,
                        group => string.Join(", ", group.Select(funding =>
                                sourceLookup.TryGetValue(funding.SourceOrg, out var sourceName)
                                    ? sourceName
                                    : funding.SourceOrg)
                            .Where(source => !string.IsNullOrWhiteSpace(source))
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .OrderBy(source => source)));

                static string IslandName(string? islandCode) => islandCode switch
                {
                    "LZ" => "Luzon",
                    "VS" => "Visayas",
                    "MN" => "Mindanao",
                    _ => "Unassigned"
                };

                var projectRows = projectBudgets
                    .Select(item =>
                    {
                        projectFlags.TryGetValue(item.Key.ProjectPK, out var flags);
                        regionLookup.TryGetValue(item.Key.Region, out var region);
                        officeLookup.TryGetValue(item.Key.ImplementingOffice, out var office);
                        fundingLookup.TryGetValue(item.Key.RevisionId, out var fundingSources);
                        var project = new DashboardProjectDTO
                        {
                            Id = flags?.Id ?? item.Key.Id,
                            ProjectPK = item.Key.ProjectPK,
                            ProjectId = item.Key.ProjectId,
                            Description = item.Key.Description,
                            ProgramName = item.Key.ProgramName ?? "Not recorded",
                            Region = region?.Name
                                ?? (string.IsNullOrWhiteSpace(item.Key.Region)
                                    ? "Not recorded"
                                    : $"Unrecognized region ({item.Key.Region})"),
                            Island = IslandName(region?.IslandCode),
                            Category = item.Key.CategoryName ?? "Uncategorized",
                            StageName = item.Key.StageName ?? "Unstaged",
                            ImplementingOffice = office?.Name
                                ?? (string.IsNullOrWhiteSpace(item.Key.ImplementingOffice)
                                    ? "Not recorded"
                                    : $"Unrecognized office ({item.Key.ImplementingOffice})"),
                            FundingSource = string.IsNullOrWhiteSpace(fundingSources)
                                ? "Not recorded"
                                : fundingSources,
                            AllocatedBudget = item.Budget,
                            IsPublished = flags?.IsPublished ?? false,
                            IsPublishable = flags?.IsPublishable ?? false,
                            IsRevised = flags?.IsRevised ?? false,
                            UpdatedAt = item.Key.LastUpdatedDate ?? item.Key.RevisionCreatedDate
                        };
                        return new
                        {
                            Project = project,
                            UpdatedBy = item.Key.LastUpdatedBy ?? item.Key.RevisionCreatedBy
                        };
                    })
                    .OrderByDescending(item => item.Project.AllocatedBudget)
                    .ToList();
                var projects = projectRows.Select(item => item.Project).ToList();

                var selectedWallets = await (
                    from wallet in walletQuery
                    join program in _db.vProgramLatest.AsNoTracking()
                        on wallet.ProgramFK equals program.ProgramPK
                    where program.StartYear == selectedYear
                    select new
                    {
                        wallet.Id,
                        wallet.ProjectPK,
                        wallet.ProjectId,
                        wallet.Description,
                        wallet.ProgramName,
                        wallet.StageName,
                        wallet.OriginalAllocation,
                        wallet.ItemizedTotal,
                        wallet.Remaining,
                        wallet.ItemizedCount,
                        wallet.CreatedBy,
                        wallet.CreatedDate,
                        wallet.UpdatedBy,
                        wallet.UpdatedDate
                    }).ToListAsync(cancellationToken);

                var selectedWalletProjectIds = selectedWallets
                    .Select(wallet => wallet.ProjectId)
                    .Where(projectId => !string.IsNullOrWhiteSpace(projectId))
                    .Distinct()
                    .ToArray();
                var selectedWalletChildren = await _db.vLSWalletProjectSet
                    .AsNoTracking()
                    .Where(project => project.ParentProjectId != null
                        && selectedWalletProjectIds.Contains(project.ParentProjectId))
                    .Select(project => new
                    {
                        project.ParentProjectId,
                        Child = new DashboardLsChildProjectDTO
                        {
                            Id = project.Id,
                            ProjectPK = project.ProjectPK,
                            ProjectId = project.ProjectId,
                            Description = project.Description ?? "Not recorded",
                            StageName = project.StageName ?? "Unstaged",
                            FundingTotal = project.FundingTotal,
                            ComponentCostTotal = project.ComponentCostTotal,
                            IsPublished = project.IsPublished
                        }
                    })
                    .ToListAsync(cancellationToken);
                var childrenByWallet = selectedWalletChildren
                    .GroupBy(project => project.ParentProjectId!)
                    .ToDictionary(
                        group => group.Key,
                        group => group.Select(project => project.Child)
                            .OrderByDescending(project => project.ComponentCostTotal)
                            .ToList());

                var activityUserIds = projectRows.Select(item => item.UpdatedBy)
                    .Concat(selectedWallets.Select(wallet => wallet.UpdatedBy ?? wallet.CreatedBy))
                    .Where(userId => !string.IsNullOrWhiteSpace(userId))
                    .Distinct()
                    .ToArray();
                var activityUsers = await _db.vUsers.AsNoTracking()
                    .Where(user => activityUserIds.Contains(user.UserId))
                    .Select(user => new { user.UserId, user.Name })
                    .ToDictionaryAsync(user => user.UserId, cancellationToken);

                string ActivityUserName(string userId) =>
                    activityUsers.TryGetValue(userId, out var user) ? user.Name : userId;

                var statuses = projects
                    .GroupBy(project => project.StageName)
                    .OrderByDescending(group => group.Count())
                    .Select(group => new DashboardStatusDTO { Name = group.Key, Count = group.Count() })
                    .ToList();

                var islands = projects
                    .GroupBy(project => project.Island)
                    .Select(group => new DashboardIslandDTO
                    {
                        Name = group.Key,
                        Budget = group.Sum(project => project.AllocatedBudget),
                        ProjectCount = group.Count()
                    })
                    .OrderByDescending(item => item.Budget)
                    .ToList();

                var projectActivities = projectRows.Select(item => new DashboardActivityDTO
                {
                    Id = $"project-{item.Project.Id}-{item.Project.UpdatedAt.Ticks}",
                    Type = item.Project.IsRevised ? "revision" : "project",
                    Title = item.Project.IsRevised ? $"Project {item.Project.ProjectId} revised" : $"Project {item.Project.ProjectId} updated",
                    Description = item.Project.Description,
                    Timestamp = item.Project.UpdatedAt,
                    User = ActivityUserName(item.UpdatedBy)
                });

                var walletActivities = selectedWallets.Select(wallet => new DashboardActivityDTO
                {
                    Id = $"wallet-{wallet.Id}-{(wallet.UpdatedDate ?? wallet.CreatedDate).Ticks}",
                    Type = "lswallet",
                    Title = $"LS Project {wallet.ProjectId} updated",
                    Description = wallet.Description ?? wallet.ProgramName ?? "Lump Sum Project",
                    Timestamp = wallet.UpdatedDate ?? wallet.CreatedDate,
                    User = ActivityUserName(wallet.UpdatedBy ?? wallet.CreatedBy)
                });

                var walletForYear = annualWallets.FirstOrDefault(item => item.Year == selectedYear);
                var publishedCount = projects.Count(project => project.IsPublished);
                var response = new DashboardSummaryDTO
                {
                    SelectedYear = selectedYear,
                    AvailableYears = availableYears,
                    Kpis = new DashboardKpiDTO
                    {
                        TotalBudget = projects.Sum(project => project.AllocatedBudget),
                        ActiveProjects = projects.Count,
                        PublishedProjects = publishedCount,
                        PublishableProjects = projects.Count(project => project.IsPublishable),
                        RevisedProjects = projects.Count(project => project.IsRevised),
                        LsWalletReleased = walletForYear?.Itemized ?? 0,
                        LsWalletTotal = walletForYear?.Total ?? 0,
                        PublicationRate = projects.Count == 0
                            ? 0
                            : Math.Round((decimal)publishedCount / projects.Count * 100, 1)
                    },
                    AnnualTrend = availableYears
                        .Select(year => new DashboardTrendDTO
                        {
                            Year = year,
                            InfrastructureBudget = annualProjectBudgets.FirstOrDefault(item => item.Year == year)?.Amount ?? 0,
                            LsItemized = annualWallets.FirstOrDefault(wallet => wallet.Year == year)?.Itemized ?? 0
                        })
                        .OrderBy(item => item.Year)
                        .ToList(),
                    Statuses = statuses,
                    Islands = islands,
                    Projects = projects,
                    LsProjects = selectedWallets.Select(wallet => new DashboardLsProjectDTO
                    {
                        Id = wallet.Id,
                        ProjectPK = wallet.ProjectPK,
                        ProjectId = wallet.ProjectId,
                        Description = wallet.Description ?? "Not recorded",
                        ProgramName = wallet.ProgramName ?? "Not recorded",
                        StageName = wallet.StageName ?? "Unstaged",
                        TotalAllocation = wallet.OriginalAllocation,
                        ItemizedAmount = wallet.ItemizedTotal,
                        RemainingAmount = wallet.Remaining,
                        ItemizedCount = wallet.ItemizedCount,
                        Children = childrenByWallet.GetValueOrDefault(wallet.ProjectId) ?? new()
                    }).OrderByDescending(wallet => wallet.ItemizedAmount).ToList(),
                    Activities = projectActivities.Concat(walletActivities)
                        .OrderByDescending(activity => activity.Timestamp)
                        .Take(12)
                        .ToList()
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }
    }
}
