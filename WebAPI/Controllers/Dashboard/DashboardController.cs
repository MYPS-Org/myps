using DBHelper.Data;
using DBHelper.Models.Views.Project;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Data;
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
                    group new { project.ProjectPK, cost.Amount } by cost.Year into yearGroup
                    orderby yearGroup.Key
                    select new
                    {
                        Year = yearGroup.Key,
                        Amount = yearGroup.Sum(item => item.Amount),
                        ProjectCount = yearGroup.Select(item => item.ProjectPK).Distinct().Count()
                    }).ToListAsync(cancellationToken);

                // The deployed databases currently span two LS schemas. Read
                // only persisted wallet/view values while supporting both the
                // legacy flat tLSWallets shape and normalized vLSWalletLatest.
                // var walletRows = await LoadWalletRows(cancellationToken);
                var walletRows = new List < DashboardWalletRow>();
                var annualWallets = walletRows
                    .GroupBy(wallet => wallet.Year)
                    .Select(yearGroup => new
                    {
                        Year = yearGroup.Key,
                        Total = yearGroup.Sum(wallet => wallet.Total),
                        Itemized = yearGroup.Sum(wallet => wallet.Used)
                    })
                    .ToList();

                var availableYears = annualProjectBudgets.Select(item => item.Year)
                    .Concat(annualWallets.Select(item => item.Year))
                    .Distinct()
                    .OrderByDescending(year => year)
                    .ToArray();
                var selectedYear = dto.Year
                    ?? availableYears.FirstOrDefault(DateTime.UtcNow.Year);

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

                var selectedWallets = walletRows
                    .Where(wallet => wallet.Year == selectedYear)
                    .ToList();

                // var selectedWalletIds = selectedWallets
                //     .Select(wallet => wallet.Id)
                //     .ToArray();
                // var selectedWalletChildren = await _db.vLSWalletProjectSet
                //     .AsNoTracking()
                //     .Where(project => selectedWalletIds.Contains(project.ParentWalletId))
                //     .Select(project => new
                //     {
                //         project.ParentWalletId,
                //         Child = new DashboardLsChildProjectDTO
                //         {
                //             Id = project.Id,
                //             ProjectPK = project.ProjectPK,
                //             ProjectId = project.ProjectId,
                //             Description = project.Description ?? "Not recorded",
                //             StageName = project.StageName ?? "Unstaged",
                //             FundingTotal = project.EffectiveDraw,
                //             ComponentCostTotal = project.CurrentDrawAmount,
                //             IsPublished = project.IsPublished
                //         }
                //     })
                //     .ToListAsync(cancellationToken);
                // var childrenByWallet = selectedWalletChildren
                //     .GroupBy(project => project.ParentWalletId)
                //     .ToDictionary(
                //         group => group.Key,
                //         group => group.Select(project => project.Child)
                //             .OrderByDescending(project => project.ComponentCostTotal)
                //             .ToList());

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

                // This is the live equivalent of the NEP presentation's macro
                // allocation panel. Program names and amounts are taken from
                // the selected projects/revisions; no presentation categories
                // or values are inferred in Live DB mode.
                var budgetBreakdown = projects
                    .GroupBy(project => project.ProgramName)
                    .Select(group => new DashboardBudgetBreakdownDTO
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
                    Title = $"LS Wallet for {wallet.ProjectId} updated",
                    Description = wallet.Description ?? wallet.ProgramName ?? "Lump Sum Wallet",
                    Timestamp = wallet.UpdatedDate ?? wallet.CreatedDate,
                    User = ActivityUserName(wallet.UpdatedBy ?? wallet.CreatedBy)
                });

                // ------------------------------------------------------------------
                // Revision queue
                // ------------------------------------------------------------------
                // Reuses dbo.fRevisionQueue -- the exact source behind the /revision
                // page -- so the dashboard can never disagree with that list. The TVF
                // is already user-scoped: it returns rows the caller created, plus the
                // RO tier when the caller is in RPC and the CO tier when in AUC, which
                // is the "depends on user group" behaviour. @IsRO/@IsCO are derived the
                // same way as RevisionController.RevisionRequests.
                var dashboardUserGroups = _Session.UserGroupNames?.ToArray() ?? Array.Empty<string>();
                var isRevisionRO = dashboardUserGroups.Contains("RPC", StringComparer.OrdinalIgnoreCase);
                var isRevisionCO = dashboardUserGroups.Contains("AUC", StringComparer.OrdinalIgnoreCase);

                var revisionQueue = await _db.fRevisionQueue
                    .FromSqlInterpolated($"SELECT * FROM dbo.fRevisionQueue({_Session.UserId.ToString()}, {isRevisionRO}, {isRevisionCO})")
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                // fRevisionQueue does not carry ImplementingOffice, but it is on the
                // vProjectLatest row the queue already joins. Resolve the office code to
                // its display name through vAdminImplementingOffice -- the same view that
                // populates the Implementing Office dropdown on the project details page.
                var revisionProjectIds = revisionQueue
                    .Select(revision => revision.ProjectId)
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Distinct()
                    .ToArray();
                var revisionOfficeByProject = await visibleProjects
                    .Where(project => revisionProjectIds.Contains(project.ProjectId))
                    .Select(project => new { project.ProjectId, project.ImplementingOffice })
                    .ToDictionaryAsync(
                        project => project.ProjectId,
                        project => project.ImplementingOffice,
                        cancellationToken);

                var revisionOfficeIds = revisionOfficeByProject.Values
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Distinct()
                    .ToArray();
                var revisionOfficeNames = await _db.vAdminImplementingOffice.AsNoTracking()
                    .Where(office => revisionOfficeIds.Contains(office.ParticipantId))
                    .Select(office => new { office.ParticipantId, office.Name })
                    .ToDictionaryAsync(office => office.ParticipantId, office => office.Name, cancellationToken);

                var revisionRows = revisionQueue
                    .Select(revision =>
                    {
                        revisionOfficeByProject.TryGetValue(revision.ProjectId, out var officeId);
                        officeId ??= string.Empty;
                        return new DashboardRevisionDTO
                        {
                            Id = revision.Id,
                            TransactionId = revision.TransactionId,
                            ProjectId = revision.ProjectId,
                            RevisionType = revision.RevisionType,
                            RevisionReason = revision.RevisionReason,
                            RevisionStatus = revision.RevisionStatus,
                            CurrentStage = string.IsNullOrWhiteSpace(revision.CurrentStage)
                                ? "Unassigned"
                                : revision.CurrentStage,
                            ImplementingOfficeId = officeId,
                            ImplementingOffice = revisionOfficeNames.TryGetValue(officeId, out var officeName)
                                ? officeName
                                : (string.IsNullOrWhiteSpace(officeId)
                                    ? "Not recorded"
                                    : $"Unrecognized office ({officeId})"),
                            ProgramName = revision.ProgramName ?? "Not recorded",
                            RevisionDate = revision.RevisionDate,
                            Age = revision.Age ?? 0
                        };
                    })
                    .OrderByDescending(revision => revision.RevisionDate)
                    .ToList();

                // "For Review" is the RO/RPC tier and "For Approval" the CO/AUC tier.
                // These are the only two genuinely pending states in the queue; the
                // remaining three are terminal or returned to the owner.
                const string ForReviewStatus = "For Endorsement";
                const string ForApprovalStatus = "For Approval of Central Office";
                var pendingRevisions = revisionRows
                    .Where(revision => revision.RevisionStatus == ForReviewStatus
                        || revision.RevisionStatus == ForApprovalStatus)
                    .ToList();

                static List<DashboardStatusDTO> GroupRevisions(
                    IEnumerable<DashboardRevisionDTO> source,
                    Func<DashboardRevisionDTO, string> selector) =>
                    source.GroupBy(selector)
                        .Select(group => new DashboardStatusDTO { Name = group.Key, Count = group.Count() })
                        .OrderByDescending(item => item.Count)
                        .ThenBy(item => item.Name)
                        .ToList();

                var revisionSummary = new DashboardRevisionSummaryDTO
                {
                    ForReview = revisionRows.Count(revision => revision.RevisionStatus == ForReviewStatus),
                    ForApproval = revisionRows.Count(revision => revision.RevisionStatus == ForApprovalStatus),
                    ForCorrection = revisionRows.Count(revision => revision.RevisionStatus == "For Correction"),
                    Approved = revisionRows.Count(revision => revision.RevisionStatus == "Approved"),
                    Disapproved = revisionRows.Count(revision => revision.RevisionStatus == "Disapproved"),
                    Total = revisionRows.Count,
                    ByStatus = GroupRevisions(revisionRows, revision => revision.RevisionStatus),
                    ByImplementingOffice = GroupRevisions(pendingRevisions, revision => revision.ImplementingOffice),
                    ByGroup = GroupRevisions(pendingRevisions, revision => revision.CurrentStage),
                    Items = revisionRows
                };

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
                            LsItemized = annualWallets.FirstOrDefault(wallet => wallet.Year == year)?.Itemized ?? 0,
                            ProjectCount = annualProjectBudgets.FirstOrDefault(item => item.Year == year)?.ProjectCount ?? 0
                        })
                        .OrderBy(item => item.Year)
                        .ToList(),
                    BudgetBreakdown = budgetBreakdown,
                    Statuses = statuses,
                    Islands = islands,
                    Projects = projects,
                    // LsProjects = selectedWallets.Select(wallet => new DashboardLsProjectDTO
                    // {
                    //     Id = wallet.Id,
                    //     ProjectPK = wallet.ProjectPK,
                    //     ProjectId = wallet.ProjectId,
                    //     Description = wallet.Description ?? "Not recorded",
                    //     ProgramName = wallet.ProgramName ?? "Not recorded",
                    //     StageName = wallet.StageName ?? "Unstaged",
                    //     TotalAllocation = wallet.OriginalAllocation,
                    //     ItemizedAmount = wallet.ItemizedTotal,
                    //     RemainingAmount = wallet.Remaining,
                    //     ItemizedCount = checked((int)wallet.ItemizedCount),
                    //     Children = childrenByWallet.GetValueOrDefault(wallet.Id) ?? new()
                    // }).OrderByDescending(wallet => wallet.ItemizedAmount).ToList(),
                    LsProjects = new List<DashboardLsProjectDTO>(),
                    Revisions = revisionSummary,
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

        private async Task<List<DashboardWalletRow>> LoadWalletRows(CancellationToken cancellationToken)
        {
            var connection = _db.Database.GetDbConnection();
            var shouldClose = connection.State != ConnectionState.Open;
            if (shouldClose)
            {
                await connection.OpenAsync(cancellationToken);
            }

            try
            {
                var hasLatestView = false;
                await using (var schemaCommand = connection.CreateCommand())
                {
                    schemaCommand.CommandText = "SELECT CASE WHEN OBJECT_ID(N'dbo.vLSWalletLatest', N'V') IS NULL THEN 0 ELSE 1 END";
                    hasLatestView = Convert.ToInt32(await schemaCommand.ExecuteScalarAsync(cancellationToken)) == 1;
                }

                var visibilityClause = _Session.ApplyFilter
                    ? " AND EXISTS (SELECT 1 FROM dbo.fUserVisiblePrograms(@UserId) visible WHERE visible.ProgramPK = wallet.ProgramFK)"
                    : string.Empty;
                var sql = hasLatestView
                    ? $@"
SELECT wallet.Id,
       wallet.ProgramFK AS ProjectPK,
       wallet.ProgramId AS ProjectId,
       COALESCE(wallet.SubCategoryName, wallet.CategoryName, wallet.ProgramName) AS Description,
       wallet.ProgramName,
       COALESCE(wallet.CurrentStage, wallet.ProgramStageName) AS StageName,
       wallet.YearStart AS [Year],
       wallet.Total,
       wallet.Used,
       wallet.Available,
       wallet.ProjectCount,
       wallet.CreatedBy,
       wallet.CreatedDate,
       wallet.UpdatedBy,
       wallet.UpdatedDate
FROM dbo.vLSWalletLatest wallet
WHERE wallet.YearStart BETWEEN {MinimumFiscalYear} AND {MaximumFiscalYear}{visibilityClause}"
                    : $@"
SELECT wallet.Id,
       wallet.ProgramFK AS ProjectPK,
       program.ProgramId AS ProjectId,
       program.Name AS Description,
       program.Name AS ProgramName,
       COALESCE(wallet.CurrentStage, program.StageName) AS StageName,
       program.StartYear AS [Year],
       COALESCE(balance.Total, wallet.Amount) AS Total,
       COALESCE(balance.Used, 0) AS Used,
       COALESCE(balance.Available, wallet.Amount) AS Available,
       (SELECT COUNT_BIG(1) FROM dbo.vLSWalletProjectSet child WHERE child.ParentWalletId = wallet.Id) AS ProjectCount,
       wallet.CreatedBy,
       wallet.CreatedDate,
       wallet.UpdatedBy,
       wallet.UpdatedDate
FROM dbo.tLSWallets wallet
INNER JOIN dbo.vProgramLatest program ON program.ProgramPK = wallet.ProgramFK
LEFT JOIN dbo.vLSWalletBalance balance ON balance.WalletId = wallet.Id
WHERE wallet.IsDeleted = 0
  AND program.StartYear BETWEEN {MinimumFiscalYear} AND {MaximumFiscalYear}{visibilityClause}";

                var rows = new List<DashboardWalletRow>();
                await using var command = connection.CreateCommand();
                command.CommandText = sql;
                if (_Session.ApplyFilter)
                {
                    var userParameter = command.CreateParameter();
                    userParameter.ParameterName = "@UserId";
                    userParameter.Value = _Session.UserId;
                    command.Parameters.Add(userParameter);
                }

                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    rows.Add(new DashboardWalletRow
                    {
                        Id = reader.GetInt32(reader.GetOrdinal("Id")),
                        ProjectPK = reader.GetString(reader.GetOrdinal("ProjectPK")),
                        ProjectId = reader.GetString(reader.GetOrdinal("ProjectId")),
                        Description = reader.IsDBNull(reader.GetOrdinal("Description")) ? null : reader.GetString(reader.GetOrdinal("Description")),
                        ProgramName = reader.IsDBNull(reader.GetOrdinal("ProgramName")) ? null : reader.GetString(reader.GetOrdinal("ProgramName")),
                        StageName = reader.IsDBNull(reader.GetOrdinal("StageName")) ? null : reader.GetString(reader.GetOrdinal("StageName")),
                        Year = reader.GetInt32(reader.GetOrdinal("Year")),
                        Total = reader.GetDecimal(reader.GetOrdinal("Total")),
                        Used = reader.GetDecimal(reader.GetOrdinal("Used")),
                        Available = reader.GetDecimal(reader.GetOrdinal("Available")),
                        ItemizedCount = Convert.ToInt64(reader.GetValue(reader.GetOrdinal("ProjectCount"))),
                        CreatedBy = reader.GetString(reader.GetOrdinal("CreatedBy")),
                        CreatedDate = reader.GetDateTime(reader.GetOrdinal("CreatedDate")),
                        UpdatedBy = reader.IsDBNull(reader.GetOrdinal("UpdatedBy")) ? null : reader.GetString(reader.GetOrdinal("UpdatedBy")),
                        UpdatedDate = reader.IsDBNull(reader.GetOrdinal("UpdatedDate")) ? null : reader.GetDateTime(reader.GetOrdinal("UpdatedDate"))
                    });
                }

                return rows;
            }
            finally
            {
                if (shouldClose)
                {
                    await connection.CloseAsync();
                }
            }
        }

        private sealed class DashboardWalletRow
        {
            public int Id { get; init; }
            public string ProjectPK { get; init; } = string.Empty;
            public string ProjectId { get; init; } = string.Empty;
            public string? Description { get; init; }
            public string? ProgramName { get; init; }
            public string? StageName { get; init; }
            public int Year { get; init; }
            public decimal Total { get; init; }
            public decimal Used { get; init; }
            public decimal Available { get; init; }
            public decimal OriginalAllocation => Total;
            public decimal ItemizedTotal => Used;
            public decimal Remaining => Available;
            public long ItemizedCount { get; init; }
            public string CreatedBy { get; init; } = string.Empty;
            public DateTime CreatedDate { get; init; }
            public string? UpdatedBy { get; init; }
            public DateTime? UpdatedDate { get; init; }
        }
    }
}
