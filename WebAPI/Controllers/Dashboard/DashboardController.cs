using DBHelper.Data;
using DBHelper.Models.Enums;
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

        // Temporary: the live database only has clean, complete data for FY2027 right
        // now, so scope the dashboard down to that single year instead of scanning
        // MinimumFiscalYear..MaximumFiscalYear. Every split endpoint below uses this
        // rather than honoring an arbitrary client-requested year. Remove this and
        // restore per-year selection once other fiscal years are ready.
        private const int TemporaryDashboardYear = 2027;

        public DashboardController(
            MYPSDbContext db,
            IHubContext<SignalRHub> hub,
            PCMADbContext pcma,
            IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        // ------------------------------------------------------------------
        // Kpis
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Kpis(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);
                var projects = scoped.Projects;
                var publishedCount = projects.Count(project => project.IsPublished);

                var response = new DashboardKpisResponseDTO
                {
                    SelectedYear = TemporaryDashboardYear,
                    AvailableYears = new[] { TemporaryDashboardYear },
                    Kpis = new DashboardKpiDTO
                    {
                        TotalBudget = projects.Sum(project => project.AllocatedBudget),
                        ActiveProjects = projects.Count,
                        PublishedProjects = publishedCount,
                        PublishableProjects = projects.Count(project => project.IsPublishable),
                        RevisedProjects = projects.Count(project => project.IsRevised),
                        // LS Wallet integration is disabled pending schema normalization —
                        // see the commented-out LoadWalletRows call this file used to make.
                        LsWalletReleased = 0,
                        LsWalletTotal = 0,
                        PublicationRate = projects.Count == 0
                            ? 0
                            : Math.Round((decimal)publishedCount / projects.Count * 100, 1)
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Trend
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Trend(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);
                var projects = scoped.Projects;

                // TemporaryDashboardYear pins the whole dashboard to one fiscal year, so this
                // collapses to a single point until that scoping is lifted (see the constant's
                // comment above) — intentional, not a bug in the split.
                var response = new DashboardTrendResponseDTO
                {
                    AnnualTrend = new List<DashboardTrendDTO>
                    {
                        new()
                        {
                            Year = TemporaryDashboardYear,
                            InfrastructureBudget = projects.Sum(project => project.AllocatedBudget),
                            LsItemized = 0,
                            ProjectCount = projects.Count
                        }
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // BudgetBreakdown
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> BudgetBreakdown(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);

                // This is the live equivalent of the NEP presentation's macro allocation
                // panel. Program names and amounts are taken from the selected
                // projects/revisions; no presentation categories or values are inferred
                // in Live DB mode.
                var budgetBreakdown = scoped.Projects
                    .GroupBy(project => project.ProgramName)
                    .Select(group => new DashboardBudgetBreakdownDTO
                    {
                        Name = group.Key,
                        Budget = group.Sum(project => project.AllocatedBudget),
                        ProjectCount = group.Count()
                    })
                    .OrderByDescending(item => item.Budget)
                    .ToList();

                return Ok(new DashboardBudgetBreakdownResponseDTO { BudgetBreakdown = budgetBreakdown });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Statuses (stage statuses + island totals — both feed DashboardCharts)
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Statuses(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);
                var projects = scoped.Projects;

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

                return Ok(new DashboardStatusesResponseDTO { Statuses = statuses, Islands = islands });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // RegionalBreakdown
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> RegionalBreakdown(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);

                // Server-side equivalent of the regional groupby DashboardRegionalMatrix used
                // to do client-side over the full project array — only the aggregated rows go
                // over the wire now. The component's own regionGroup()-based subgroup
                // bucketing (Northern/Southern Luzon, NCR) stays client-side; it only needs
                // {region, island, budget, count}, not raw projects.
                var regions = scoped.Projects
                    .GroupBy(project => project.Region)
                    .Select(group => new DashboardRegionalBreakdownDTO
                    {
                        Region = group.Key,
                        Island = group.First().Island,
                        Budget = group.Sum(project => project.AllocatedBudget),
                        ProjectCount = group.Count()
                    })
                    .OrderByDescending(item => item.Budget)
                    .ToList();

                return Ok(new DashboardRegionalBreakdownResponseDTO { Regions = regions });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Projects (paginated — feeds DashboardProjectWatchlist)
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Projects(
            [FromBody] ShowDashboardProjectsDTO dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);
                var result = PaginateProjects(scoped.Projects, dto.Filters, dto.limit, dto.page, dto.Navigation);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Activities
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Activities(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);
                var activities = await GetActivitiesAsync(scoped, cancellationToken);
                return Ok(new DashboardActivitiesResponseDTO { Activities = activities });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Revisions
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Revisions(CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var revisionSummary = await GetRevisionSummaryAsync(visibleProjects, cancellationToken);
                return Ok(revisionSummary);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Summary — kept for backward compatibility. The prior "dashboard-live-data-
        // integrity" plan made this endpoint's existence and contract an acceptance
        // criterion (see documents/plans/dashboard-live-data-integrity.md) with its own
        // e2e regression spec. Dashboard.tsx no longer calls this — it uses the split
        // endpoints above — but this composes the same shared helpers so the combined
        // contract keeps holding for any other caller (and for that integrity spec,
        // once it's pointed at the split endpoints alongside this one).
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Summary(
            [FromBody] DashboardRequestDTO dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, TemporaryDashboardYear, cancellationToken);
                var projects = scoped.Projects;
                var publishedCount = projects.Count(project => project.IsPublished);

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

                var activities = await GetActivitiesAsync(scoped, cancellationToken);
                var revisionSummary = await GetRevisionSummaryAsync(visibleProjects, cancellationToken);

                var response = new DashboardSummaryDTO
                {
                    SelectedYear = TemporaryDashboardYear,
                    AvailableYears = new[] { TemporaryDashboardYear },
                    Kpis = new DashboardKpiDTO
                    {
                        TotalBudget = projects.Sum(project => project.AllocatedBudget),
                        ActiveProjects = projects.Count,
                        PublishedProjects = publishedCount,
                        PublishableProjects = projects.Count(project => project.IsPublishable),
                        RevisedProjects = projects.Count(project => project.IsRevised),
                        LsWalletReleased = 0,
                        LsWalletTotal = 0,
                        PublicationRate = projects.Count == 0
                            ? 0
                            : Math.Round((decimal)publishedCount / projects.Count * 100, 1)
                    },
                    AnnualTrend = new List<DashboardTrendDTO>
                    {
                        new()
                        {
                            Year = TemporaryDashboardYear,
                            InfrastructureBudget = projects.Sum(project => project.AllocatedBudget),
                            LsItemized = 0,
                            ProjectCount = projects.Count
                        }
                    },
                    BudgetBreakdown = budgetBreakdown,
                    Statuses = statuses,
                    Islands = islands,
                    Projects = projects,
                    LsProjects = new List<DashboardLsProjectDTO>(),
                    Revisions = revisionSummary,
                    Activities = activities
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        private async Task<List<DashboardActivityDTO>> GetActivitiesAsync(
            YearScopedProjects scoped,
            CancellationToken cancellationToken)
        {
            var activityUserIds = scoped.Rows.Select(row => row.UpdatedBy)
                .Where(userId => !string.IsNullOrWhiteSpace(userId))
                .Distinct()
                .ToArray();
            var activityUsers = await _db.vUsers.AsNoTracking()
                .Where(user => activityUserIds.Contains(user.UserId))
                .Select(user => new { user.UserId, user.Name })
                .ToDictionaryAsync(user => user.UserId, cancellationToken);

            string ActivityUserName(string userId) =>
                activityUsers.TryGetValue(userId, out var user) ? user.Name : userId;

            return scoped.Rows
                .Select(row => new DashboardActivityDTO
                {
                    Id = $"project-{row.Project.Id}-{row.Project.UpdatedAt.Ticks}",
                    Type = row.Project.IsRevised ? "revision" : "project",
                    Title = row.Project.IsRevised
                        ? $"Project {row.Project.ProjectId} revised"
                        : $"Project {row.Project.ProjectId} updated",
                    Description = row.Project.Description,
                    Timestamp = row.Project.UpdatedAt,
                    User = ActivityUserName(row.UpdatedBy)
                })
                .OrderByDescending(activity => activity.Timestamp)
                .Take(12)
                .ToList();
        }

        private async Task<DashboardRevisionSummaryDTO> GetRevisionSummaryAsync(
            IQueryable<ProjectLatest> visibleProjects,
            CancellationToken cancellationToken)
        {
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

                return revisionSummary;
        }

        private static List<DashboardStatusDTO> GroupRevisions(
            IEnumerable<DashboardRevisionDTO> source,
            Func<DashboardRevisionDTO, string> selector) =>
            source.GroupBy(selector)
                .Select(group => new DashboardStatusDTO { Name = group.Key, Count = group.Count() })
                .OrderByDescending(item => item.Count)
                .ThenBy(item => item.Name)
                .ToList();

        // ------------------------------------------------------------------
        // Shared helpers
        // ------------------------------------------------------------------

        private IQueryable<ProjectLatest> GetVisibleProjects()
        {
            IQueryable<ProjectLatest> visibleProjects = _db.vProjectLatest.AsNoTracking();
            if (_Session.ApplyFilter)
            {
                var allowedProjects = _db.fUserVisibleProjects
                    .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisibleProjects({_Session.UserId})");
                visibleProjects = visibleProjects.Where(project =>
                    allowedProjects.Any(allowed => allowed.ProjectPK == project.ProjectPK));
            }
            return visibleProjects;
        }

        private static string IslandName(string? islandCode) => islandCode switch
        {
            "LZ" => "Luzon",
            "VS" => "Visayas",
            "MN" => "Mindanao",
            _ => "Unassigned"
        };

        /// <summary>
        /// The join+enrich pipeline every split endpoint needs: visible projects joined to
        /// their component cost for <paramref name="year"/>, enriched with resolved
        /// region/office names, joined funding sources, and publish/publishable/revised
        /// flags. Each endpoint re-runs this rather than sharing one cached result across
        /// requests, trading a little query duplication (cheap now that it's pinned to one
        /// fiscal year) for independently callable, independently lazy-loadable endpoints.
        /// </summary>
        private async Task<YearScopedProjects> GetYearScopedProjectsAsync(
            IQueryable<ProjectLatest> visibleProjects,
            int year,
            CancellationToken cancellationToken)
        {
            var projectBudgets = await (
                from project in visibleProjects
                join component in _db.tProjectComponentCost.AsNoTracking()
                    on project.RevisionId equals component.ProjectRevisionFK
                join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                    on component.Id equals cost.ComponentCostFK
                where !component.IsDeleted && !cost.IsDeleted && cost.Year == year
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
                    return (
                        Project: project,
                        UpdatedBy: item.Key.LastUpdatedBy ?? item.Key.RevisionCreatedBy);
                })
                .OrderByDescending(item => item.Project.AllocatedBudget)
                .ToList();

            return new YearScopedProjects(
                projectRows.Select(row => row.Project).ToList(),
                projectRows);
        }

        /// <summary>
        /// Pages an already-materialized, year-scoped project list in memory. This is NOT
        /// Helpers.QueryPaginationExtensions.FilterDataCursor's keyset SQL pagination —
        /// that helper only pages a single SQL table/view/TVF directly, and this DTO is a
        /// multi-table join with a computed per-year budget and resolved names with no
        /// backing view. The list is already bounded to one fiscal year, so there's no
        /// scale reason to reimplement keyset cursors: page numbers are honored directly,
        /// and the cursor id fields below are just page numbers, so the shared FE
        /// usePagination hook's contract (which treats cursors as opaque) still holds.
        /// </summary>
        private static FilteredResult<DashboardProjectDTO> PaginateProjects(
            List<DashboardProjectDTO> allProjects,
            ShowDashboardProjectsFilterDTO filters,
            int limit,
            int page,
            PaginationNavigation navigation)
        {
            IEnumerable<DashboardProjectDTO> filtered = allProjects;

            if (!string.IsNullOrWhiteSpace(filters.Search))
            {
                var search = filters.Search.Trim();
                filtered = filtered.Where(project =>
                    project.ProjectId.Contains(search, StringComparison.OrdinalIgnoreCase)
                    || project.Description.Contains(search, StringComparison.OrdinalIgnoreCase)
                    || project.Region.Contains(search, StringComparison.OrdinalIgnoreCase));
            }
            if (!string.IsNullOrWhiteSpace(filters.Island))
            {
                filtered = filtered.Where(project => project.Island == filters.Island);
            }
            if (!string.IsNullOrWhiteSpace(filters.Status))
            {
                filtered = filtered.Where(project => project.StageName == filters.Status);
            }

            var ordered = filtered.OrderByDescending(project => project.AllocatedBudget).ToList();

            var safeLimit = limit < 1 ? 10 : Math.Min(limit, 200);
            var total = ordered.Count;
            var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)safeLimit);

            int requestedPage = navigation switch
            {
                PaginationNavigation.First => 1,
                PaginationNavigation.Last => totalPages > 0 ? totalPages : 1,
                _ => Math.Clamp(page < 1 ? 1 : page, 1, Math.Max(totalPages, 1))
            };

            var pageItems = ordered
                .Skip((requestedPage - 1) * safeLimit)
                .Take(safeLimit)
                .ToList();

            var hasPrevious = requestedPage > 1;
            var hasNext = requestedPage < totalPages;

            return new FilteredResult<DashboardProjectDTO>
            {
                lists = pageItems,
                page = requestedPage,
                limit = safeLimit,
                total = total,
                totalPages = totalPages,
                HasPrevious = hasPrevious,
                HasNext = hasNext,
                PreviousFilteredId = hasPrevious ? requestedPage - 1 : null,
                NextFilteredId = hasNext ? requestedPage + 1 : null,
                PageCursorId = requestedPage
            };
        }

        private sealed record YearScopedProjects(
            List<DashboardProjectDTO> Projects,
            List<(DashboardProjectDTO Project, string UpdatedBy)> Rows);

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
