using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Views.Lumpsum;
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

        // Only used when the database has no component-cost rows at all, so the year
        // switcher still has a year to show. Every endpoint otherwise honors the year the
        // caller asked for, validated against the years that actually have data — see
        // ResolveYearAsync. (This replaced a hardcoded TemporaryDashboardYear = 2027 that
        // pinned the whole dashboard to a single fiscal year.)
        private const int FallbackDashboardYear = 2027;

        private const string UnrecordedLabel = "Not recorded";
        private const string UnstagedLabel = "Unstaged";

        public DashboardController(
            MYPSDbContext db,
            IHubContext<SignalRHub> hub,
            PCMADbContext pcma,
            IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        // ------------------------------------------------------------------
        // Kpis
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Kpis(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // Grouped by the three publish flags rather than by project: SQL Server
                // returns at most eight rows and the per-flag totals are summed here, so
                // the KPI tiles never pull the ~57k project rows this used to materialize.
                var flagTotals = await (
                    from row in GetYearCostRows(visibleProjects, scope.SelectedYear)
                    join flags in _db.tProjects.AsNoTracking()
                        on row.ProjectPK equals flags.ProjectPK
                    group new { row.Amount, row.ProjectPK } by new
                    {
                        flags.IsPublished,
                        flags.IsPublishable,
                        flags.IsRevised
                    } into grouped
                    select new
                    {
                        grouped.Key.IsPublished,
                        grouped.Key.IsPublishable,
                        grouped.Key.IsRevised,
                        Budget = grouped.Sum(item => item.Amount),
                        ProjectCount = grouped.Select(item => item.ProjectPK).Distinct().Count()
                    }).ToListAsync(cancellationToken);

                var activeProjects = flagTotals.Sum(item => item.ProjectCount);
                var publishedCount = flagTotals.Where(item => item.IsPublished).Sum(item => item.ProjectCount);

                // Real Lump Sum figures, sourced from the V2 views (vLumpSumSet/vLumpSumBalance)
                // via the same helper the LumpSum endpoint uses — replaces the old hard-coded 0/0
                // that stood in for the pre-V2 tLSWallets integration once that schema was retired.
                var lsProjects = await LoadLumpSumProjectsAsync(GetVisibleLumpSumSet(), scope.SelectedYear, cancellationToken);

                var response = new DashboardKpisResponseDTO
                {
                    SelectedYear = scope.SelectedYear,
                    AvailableYears = scope.AvailableYears,
                    Kpis = new DashboardKpiDTO
                    {
                        TotalBudget = flagTotals.Sum(item => item.Budget),
                        ActiveProjects = activeProjects,
                        PublishedProjects = publishedCount,
                        PublishableProjects = flagTotals.Where(item => item.IsPublishable).Sum(item => item.ProjectCount),
                        RevisedProjects = flagTotals.Where(item => item.IsRevised).Sum(item => item.ProjectCount),
                        LsWalletReleased = lsProjects.Sum(item => item.ItemizedAmount),
                        LsWalletTotal = lsProjects.Sum(item => item.TotalAllocation),
                        PublicationRate = activeProjects == 0
                            ? 0
                            : Math.Round((decimal)publishedCount / activeProjects * 100, 1)
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Trend
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Trend(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();

                // A trend line is the one part of the dashboard that is deliberately NOT
                // scoped to the selected year — it spans every fiscal year that has cost
                // rows so the trajectory chart has something to plot. The GROUP BY runs in
                // SQL and returns one row per year (currently 16), not one row per project.
                var annualTrend = await (
                    from project in visibleProjects
                    join component in _db.tProjectComponentCost.AsNoTracking()
                        on project.RevisionId equals component.ProjectRevisionFK
                    join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                        on component.Id equals cost.ComponentCostFK
                    where !component.IsDeleted
                        && !cost.IsDeleted
                        && cost.Year >= MinimumFiscalYear
                        && cost.Year <= MaximumFiscalYear
                    group new { cost.Amount, project.ProjectPK } by cost.Year into grouped
                    select new DashboardTrendDTO
                    {
                        Year = grouped.Key,
                        InfrastructureBudget = grouped.Sum(item => item.Amount),
                        LsItemized = 0,
                        ProjectCount = grouped.Select(item => item.ProjectPK).Distinct().Count()
                    })
                    .OrderBy(row => row.Year)
                    .ToListAsync(cancellationToken);

                return Ok(new DashboardTrendResponseDTO { AnnualTrend = annualTrend });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // BudgetBreakdown
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> BudgetBreakdown(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // This is the live equivalent of the NEP presentation's macro allocation
                // panel. Program names and amounts are taken from the selected
                // projects/revisions; no presentation categories or values are inferred
                // in Live DB mode. The group-by is SQL-side: one row per program.
                var budgetBreakdown = await (
                    from row in GetYearCostRows(visibleProjects, scope.SelectedYear)
                    group new { row.Amount, row.ProjectPK } by row.ProgramName into grouped
                    select new DashboardBudgetBreakdownDTO
                    {
                        Name = grouped.Key ?? UnrecordedLabel,
                        Budget = grouped.Sum(item => item.Amount),
                        ProjectCount = grouped.Select(item => item.ProjectPK).Distinct().Count()
                    })
                    .OrderByDescending(item => item.Budget)
                    .ToListAsync(cancellationToken);

                return Ok(new DashboardBudgetBreakdownResponseDTO { BudgetBreakdown = budgetBreakdown });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Statuses (stage statuses + island totals — both feed DashboardCharts)
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Statuses(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // One SQL group-by over {stage, region} serves both halves of this response:
                // stage and region are project-level attributes, so a project contributes to
                // exactly one cell and rolling the cells up by either axis in memory is exact.
                // That keeps this endpoint at a single heavy query instead of two.
                var cells = await (
                    from row in GetYearCostRows(visibleProjects, scope.SelectedYear)
                    group new { row.Amount, row.ProjectPK } by new { row.StageName, row.Region } into grouped
                    select new
                    {
                        grouped.Key.StageName,
                        grouped.Key.Region,
                        Budget = grouped.Sum(item => item.Amount),
                        ProjectCount = grouped.Select(item => item.ProjectPK).Distinct().Count()
                    }).ToListAsync(cancellationToken);

                var statuses = cells
                    .GroupBy(cell => cell.StageName ?? UnstagedLabel)
                    .Select(group => new DashboardStatusDTO
                    {
                        Name = group.Key,
                        Count = group.Sum(cell => cell.ProjectCount)
                    })
                    .OrderByDescending(item => item.Count)
                    .ToList();

                var islandLookup = await GetIslandCodesByRegionAsync(
                    cells.Select(cell => cell.Region), cancellationToken);

                var islands = cells
                    .GroupBy(cell => IslandName(
                        islandLookup.TryGetValue(cell.Region ?? string.Empty, out var islandCode) ? islandCode : null))
                    .Select(group => new DashboardIslandDTO
                    {
                        Name = group.Key,
                        Budget = group.Sum(cell => cell.Budget),
                        ProjectCount = group.Sum(cell => cell.ProjectCount)
                    })
                    .OrderByDescending(item => item.Budget)
                    .ToList();

                return Ok(new DashboardStatusesResponseDTO { Statuses = statuses, Islands = islands });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // RegionalBreakdown
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> RegionalBreakdown(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // Server-side equivalent of the regional groupby DashboardRegionalMatrix used
                // to do client-side over the full project array — only the aggregated rows go
                // over the wire now. The component's own regionGroup()-based subgroup
                // bucketing (Northern/Southern Luzon, NCR) stays client-side; it only needs
                // {region, island, budget, count}, not raw projects. Grouping by the raw region
                // code (not its display name) keeps the GROUP BY off the region table; names
                // are resolved afterwards over the resulting handful of rows.
                var regionCells = await (
                    from row in GetYearCostRows(visibleProjects, scope.SelectedYear)
                    group new { row.Amount, row.ProjectPK } by row.Region into grouped
                    select new
                    {
                        RegionCode = grouped.Key,
                        Budget = grouped.Sum(item => item.Amount),
                        ProjectCount = grouped.Select(item => item.ProjectPK).Distinct().Count()
                    }).ToListAsync(cancellationToken);

                var regionLookup = await GetRegionsByCodeAsync(
                    regionCells.Select(cell => cell.RegionCode), cancellationToken);

                var regions = regionCells
                    .Select(cell =>
                    {
                        regionLookup.TryGetValue(cell.RegionCode ?? string.Empty, out var region);
                        return new DashboardRegionalBreakdownDTO
                        {
                            Region = RegionDisplayName(cell.RegionCode, region?.Name),
                            Island = IslandName(region?.IslandCode),
                            Budget = cell.Budget,
                            ProjectCount = cell.ProjectCount
                        };
                    })
                    .OrderByDescending(item => item.Budget)
                    .ToList();

                return Ok(new DashboardRegionalBreakdownResponseDTO { Regions = regions });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
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
                var scope = await ResolveYearAsync(dto.Year, cancellationToken);
                var result = await PageProjectsAsync(
                    visibleProjects, scope.SelectedYear, dto.Filters, dto.limit, dto.page, dto.Navigation, cancellationToken);
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
        public async Task<IActionResult> Activities(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);
                var activities = await GetRecentActivitiesAsync(
                    visibleProjects, scope.SelectedYear, cancellationToken);
                return Ok(new DashboardActivitiesResponseDTO { Activities = activities });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
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
        // LumpSum — the Dashboard's own Lump Sum Wallet breakdown, sourced from
        // the same live V2 views (vLumpSumSet/vLumpSumBalance/vLumpSumChildSet)
        // the /lumpsum module reads. Feeds the KPI detail modal's "Lump Sum" tab;
        // Kpis derives its LsWalletReleased/LsWalletTotal tile figures from the
        // same LoadLumpSumProjectsAsync helper this action calls.
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> LumpSum(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);
                var lsProjects = await LoadLumpSumProjectsAsync(GetVisibleLumpSumSet(), scope.SelectedYear, cancellationToken);
                return Ok(new DashboardLsProjectsResponseDTO { LsProjects = lsProjects });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
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
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var visibleProjects = GetVisibleProjects();
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);
                var scoped = await GetYearScopedProjectsAsync(visibleProjects, scope.SelectedYear, cancellationToken);
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
                var lsProjects = await LoadLumpSumProjectsAsync(GetVisibleLumpSumSet(), scope.SelectedYear, cancellationToken);

                var response = new DashboardSummaryDTO
                {
                    SelectedYear = scope.SelectedYear,
                    AvailableYears = scope.AvailableYears,
                    Kpis = new DashboardKpiDTO
                    {
                        TotalBudget = projects.Sum(project => project.AllocatedBudget),
                        ActiveProjects = projects.Count,
                        PublishedProjects = publishedCount,
                        PublishableProjects = projects.Count(project => project.IsPublishable),
                        RevisedProjects = projects.Count(project => project.IsRevised),
                        LsWalletReleased = lsProjects.Sum(item => item.ItemizedAmount),
                        LsWalletTotal = lsProjects.Sum(item => item.TotalAllocation),
                        PublicationRate = projects.Count == 0
                            ? 0
                            : Math.Round((decimal)publishedCount / projects.Count * 100, 1)
                    },
                    AnnualTrend = new List<DashboardTrendDTO>
                    {
                        new()
                        {
                            Year = scope.SelectedYear,
                            InfrastructureBudget = projects.Sum(project => project.AllocatedBudget),
                            LsItemized = 0,
                            ProjectCount = projects.Count
                        }
                    },
                    BudgetBreakdown = budgetBreakdown,
                    Statuses = statuses,
                    Islands = islands,
                    Projects = projects,
                    LsProjects = lsProjects,
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

        /// <summary>
        /// Lump Sum Projects are program-scoped, not project-scoped, so this mirrors
        /// <see cref="GetVisibleProjects"/>'s shape but reuses the Lump Sum module's own
        /// visibility source -- dbo.fUserVisiblePrograms, the same TVF
        /// LumpsumController.IsLumpSumVisible checks a single record against.
        /// </summary>
        private IQueryable<LumpSum> GetVisibleLumpSumSet()
        {
            IQueryable<LumpSum> visibleLumpSum = _db.vLumpSumSet.AsNoTracking();
            if (_Session.ApplyFilter)
            {
                var visiblePrograms = _db.fUserVisiblePrograms
                    .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisiblePrograms({_Session.UserId})");
                visibleLumpSum = visibleLumpSum.Where(lumpSum =>
                    visiblePrograms.Any(program => program.ProgramPK == lumpSum.ProgramFK));
            }
            return visibleLumpSum;
        }

        /// <summary>
        /// One Lump Sum Project per visible row for <paramref name="year"/>, with its live
        /// balance (falling back to the parent view's own allocation figures when
        /// vLumpSumBalance has no row for it -- the same fallback BuildLumpSumDetailsAsync
        /// uses) and its itemized children, batch-loaded rather than N+1.
        /// </summary>
        private async Task<List<DashboardLsProjectDTO>> LoadLumpSumProjectsAsync(
            IQueryable<LumpSum> visibleLumpSum,
            int year,
            CancellationToken cancellationToken)
        {
            var parents = await visibleLumpSum
                .Where(lumpSum => lumpSum.StartYear == year)
                .ToListAsync(cancellationToken);

            if (parents.Count == 0)
            {
                return new List<DashboardLsProjectDTO>();
            }

            var parentIds = parents.Select(lumpSum => lumpSum.Id).ToArray();
            var balances = await _db.vLumpSumBalance.AsNoTracking()
                .Where(balance => parentIds.Contains(balance.WalletId))
                .ToDictionaryAsync(balance => balance.WalletId, cancellationToken);

            var parentProjectIds = parents.Select(lumpSum => lumpSum.ProjectId).ToArray();
            var children = await _db.vLumpSumChildSet.AsNoTracking()
                .Where(child => child.ParentProjectId != null && parentProjectIds.Contains(child.ParentProjectId))
                .ToListAsync(cancellationToken);
            var childrenByParent = children
                .GroupBy(child => child.ParentProjectId!)
                .ToDictionary(group => group.Key, group => group.ToList());

            return parents
                .Select(lumpSum =>
                {
                    balances.TryGetValue(lumpSum.Id, out var balance);
                    childrenByParent.TryGetValue(lumpSum.ProjectId, out var lumpSumChildren);

                    return new DashboardLsProjectDTO
                    {
                        Id = lumpSum.Id,
                        ProjectPK = lumpSum.ProjectPK,
                        ProjectId = lumpSum.ProjectId,
                        Description = lumpSum.Description,
                        ProgramName = lumpSum.ProgramName ?? UnrecordedLabel,
                        StageName = lumpSum.StageName ?? UnstagedLabel,
                        TotalAllocation = balance?.Total ?? lumpSum.OriginalAllocation ?? 0m,
                        ItemizedAmount = balance?.Itemized ?? lumpSum.ItemizedTotal,
                        RemainingAmount = balance?.Remaining ?? lumpSum.Remaining,
                        ItemizedCount = lumpSum.ItemizedCount,
                        Children = (lumpSumChildren ?? new List<LumpSumChild>())
                            .Select(child => new DashboardLsChildProjectDTO
                            {
                                Id = child.Id,
                                ProjectPK = child.ProjectPK,
                                ProjectId = child.ProjectId,
                                Description = child.Description,
                                StageName = child.StageName ?? UnstagedLabel,
                                FundingTotal = child.FundingTotal,
                                ComponentCostTotal = child.ComponentCostTotal,
                                IsPublished = child.IsPublished
                            })
                            .ToList()
                    };
                })
                .OrderByDescending(lumpSum => lumpSum.TotalAllocation)
                .ToList();
        }

        private static string IslandName(string? islandCode) => islandCode switch
        {
            "LZ" => "Luzon",
            "VS" => "Visayas",
            "MN" => "Mindanao",
            _ => "Unassigned"
        };

        /// <summary>
        /// Reverse of <see cref="IslandName"/>. Null means "Unassigned" — no island code
        /// matches, which the watchlist filter turns into "region resolves to no island".
        /// </summary>
        private static string? IslandCode(string islandName) => islandName switch
        {
            "Luzon" => "LZ",
            "Visayas" => "VS",
            "Mindanao" => "MN",
            _ => null
        };

        /// <summary>
        /// The join+enrich pipeline behind <see cref="Summary"/>: visible projects joined to
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

        // ------------------------------------------------------------------
        // Year scoping
        // ------------------------------------------------------------------

        private sealed record DashboardYearScope(int SelectedYear, int[] AvailableYears);

        /// <summary>
        /// Resolves which fiscal year this request is for, and which years the year switcher
        /// should offer. The available list is the set of years that actually have live
        /// component-cost rows — previously this was hardcoded to a single year, which is why
        /// the dashboard only ever displayed FY2027. An unknown or missing requested year
        /// falls back to the current calendar year when it has data, otherwise to the most
        /// recent year that does.
        /// </summary>
        private async Task<DashboardYearScope> ResolveYearAsync(
            int? requestedYear,
            CancellationToken cancellationToken)
        {
            var availableYears = await _db.tProjectComponentCostPerYear.AsNoTracking()
                .Where(cost => !cost.IsDeleted
                    && cost.Year >= MinimumFiscalYear
                    && cost.Year <= MaximumFiscalYear)
                .Select(cost => cost.Year)
                .Distinct()
                .OrderByDescending(year => year)
                .ToArrayAsync(cancellationToken);

            if (availableYears.Length == 0)
            {
                // Nothing to scope to — keep the switcher non-empty rather than returning a
                // year the caller cannot select.
                var onlyYear = requestedYear ?? FallbackDashboardYear;
                return new DashboardYearScope(onlyYear, new[] { onlyYear });
            }

            if (requestedYear.HasValue && availableYears.Contains(requestedYear.Value))
            {
                return new DashboardYearScope(requestedYear.Value, availableYears);
            }

            var currentYear = DateTime.Now.Year;
            var defaultYear = availableYears.Contains(currentYear) ? currentYear : availableYears[0];
            return new DashboardYearScope(defaultYear, availableYears);
        }

        // ------------------------------------------------------------------
        // Aggregate query building blocks
        // ------------------------------------------------------------------

        /// <summary>
        /// One row per component-cost-per-year record for <paramref name="year"/>, carrying only
        /// the dimensions the aggregate endpoints group by.
        ///
        /// Returned as an <see cref="IQueryable{T}"/> and deliberately never materialized: each
        /// caller appends its own <c>GroupBy</c>, which SQL Server executes, so only the
        /// aggregated rows (tens) cross the wire instead of the ~57k project rows per section
        /// this controller used to load. Budgets are <c>SUM(Amount)</c> at cost-row grain;
        /// project counts are <c>COUNT(DISTINCT ProjectPK)</c>, because one project has many
        /// cost rows.
        /// </summary>
        private IQueryable<DashboardCostRow> GetYearCostRows(
            IQueryable<ProjectLatest> visibleProjects,
            int year) =>
            from project in visibleProjects
            join component in _db.tProjectComponentCost.AsNoTracking()
                on project.RevisionId equals component.ProjectRevisionFK
            join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                on component.Id equals cost.ComponentCostFK
            where !component.IsDeleted && !cost.IsDeleted && cost.Year == year
            select new DashboardCostRow
            {
                ProjectPK = project.ProjectPK,
                Region = project.Region,
                ProgramName = project.ProgramName,
                StageName = project.StageName,
                Amount = cost.Amount
            };

        private sealed class DashboardCostRow
        {
            public string ProjectPK { get; set; } = string.Empty;
            public string? Region { get; set; }
            public string? ProgramName { get; set; }
            public string? StageName { get; set; }
            public decimal Amount { get; set; }
        }

        private sealed record DashboardRegionRow(string Name, string IslandCode);

        /// <summary>Region code -&gt; name/island for the handful of codes an aggregate returned.</summary>
        private async Task<Dictionary<string, DashboardRegionRow>> GetRegionsByCodeAsync(
            IEnumerable<string?> regionCodes,
            CancellationToken cancellationToken)
        {
            var codes = regionCodes
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Select(code => code!)
                .Distinct()
                .ToArray();
            if (codes.Length == 0)
            {
                return new Dictionary<string, DashboardRegionRow>();
            }

            return await _db.tOptionAdminAreaRegion.AsNoTracking()
                .Where(region => codes.Contains(region.ParticipantId))
                .Select(region => new { region.ParticipantId, region.Name, region.IslandCode })
                .ToDictionaryAsync(
                    region => region.ParticipantId,
                    region => new DashboardRegionRow(region.Name, region.IslandCode),
                    cancellationToken);
        }

        private async Task<Dictionary<string, string>> GetIslandCodesByRegionAsync(
            IEnumerable<string?> regionCodes,
            CancellationToken cancellationToken)
        {
            var regions = await GetRegionsByCodeAsync(regionCodes, cancellationToken);
            return regions.ToDictionary(entry => entry.Key, entry => entry.Value.IslandCode);
        }

        private static string RegionDisplayName(string? regionCode, string? resolvedName) =>
            resolvedName
                ?? (string.IsNullOrWhiteSpace(regionCode)
                    ? UnrecordedLabel
                    : $"Unrecognized region ({regionCode})");

        private static string OfficeDisplayName(string? officeCode, string? resolvedName) =>
            resolvedName
                ?? (string.IsNullOrWhiteSpace(officeCode)
                    ? UnrecordedLabel
                    : $"Unrecognized office ({officeCode})");

        // ------------------------------------------------------------------
        // Activities
        // ------------------------------------------------------------------

        /// <summary>
        /// The twelve most recently touched projects in the fiscal year. Ordering and the
        /// <c>TOP 12</c> both run in SQL — the feed never needed the whole portfolio, and this
        /// is the only work it does now.
        /// </summary>
        private async Task<List<DashboardActivityDTO>> GetRecentActivitiesAsync(
            IQueryable<ProjectLatest> visibleProjects,
            int year,
            CancellationToken cancellationToken)
        {
            const int FeedSize = 12;

            var recent = await (
                from project in visibleProjects
                join flags in _db.tProjects.AsNoTracking()
                    on project.ProjectPK equals flags.ProjectPK
                where _db.tProjectComponentCost.Any(component =>
                    component.ProjectRevisionFK == project.RevisionId
                    && !component.IsDeleted
                    && _db.tProjectComponentCostPerYear.Any(cost =>
                        cost.ComponentCostFK == component.Id
                        && !cost.IsDeleted
                        && cost.Year == year))
                select new
                {
                    flags.Id,
                    project.ProjectId,
                    project.Description,
                    flags.IsRevised,
                    UpdatedBy = project.LastUpdatedBy ?? project.RevisionCreatedBy,
                    UpdatedAt = project.LastUpdatedDate ?? project.RevisionCreatedDate
                })
                .OrderByDescending(row => row.UpdatedAt)
                .Take(FeedSize)
                .ToListAsync(cancellationToken);

            var activityUserIds = recent
                .Select(row => row.UpdatedBy)
                .Where(userId => !string.IsNullOrWhiteSpace(userId))
                .Distinct()
                .ToArray();
            var activityUsers = await _db.vUsers.AsNoTracking()
                .Where(user => activityUserIds.Contains(user.UserId))
                .Select(user => new { user.UserId, user.Name })
                .ToDictionaryAsync(user => user.UserId, cancellationToken);

            return recent
                .Select(row => new DashboardActivityDTO
                {
                    Id = $"project-{row.Id}-{row.UpdatedAt.Ticks}",
                    Type = row.IsRevised ? "revision" : "project",
                    Title = row.IsRevised
                        ? $"Project {row.ProjectId} revised"
                        : $"Project {row.ProjectId} updated",
                    Description = row.Description,
                    Timestamp = row.UpdatedAt,
                    User = activityUsers.TryGetValue(row.UpdatedBy, out var user) ? user.Name : row.UpdatedBy
                })
                .ToList();
        }

        // ------------------------------------------------------------------
        // Watchlist paging
        // ------------------------------------------------------------------

        /// <summary>
        /// Pages the watchlist in SQL: filters, per-project budget aggregation, ordering and
        /// <c>OFFSET/FETCH</c> all run server-side, so one page costs one page. This replaces an
        /// in-memory page over a fully materialized portfolio.
        ///
        /// This is still not <see cref="Helpers.QueryPaginationExtensions.FilterDataCursor"/>'s
        /// keyset pagination — that helper pages a single SQL table/view/TVF directly, and this
        /// is a multi-table join with a computed per-year budget and no backing view. Page
        /// numbers are honored directly and the cursor id fields below are page numbers, so the
        /// shared frontend usePagination hook's contract (cursors are opaque) still holds.
        /// </summary>
        private async Task<FilteredResult<DashboardProjectDTO>> PageProjectsAsync(
            IQueryable<ProjectLatest> visibleProjects,
            int year,
            ShowDashboardProjectsFilterDTO filters,
            int limit,
            int page,
            PaginationNavigation navigation,
            CancellationToken cancellationToken)
        {
            var scopedProjects = visibleProjects;

            // The island filter is expressed as a display name ("Luzon"); translate it to the
            // region codes that carry that island so the filter can run in SQL.
            if (!string.IsNullOrWhiteSpace(filters.Island))
            {
                var islandCode = IslandCode(filters.Island);
                var regionCodes = islandCode is null
                    ? await _db.tOptionAdminAreaRegion.AsNoTracking()
                        .Select(region => region.ParticipantId)
                        .ToArrayAsync(cancellationToken)
                    : await _db.tOptionAdminAreaRegion.AsNoTracking()
                        .Where(region => region.IslandCode == islandCode)
                        .Select(region => region.ParticipantId)
                        .ToArrayAsync(cancellationToken);

                scopedProjects = islandCode is null
                    // "Unassigned" means the project's region resolves to no island at all.
                    ? scopedProjects.Where(project => !regionCodes.Contains(project.Region))
                    : scopedProjects.Where(project => regionCodes.Contains(project.Region));
            }

            if (!string.IsNullOrWhiteSpace(filters.Status))
            {
                var status = filters.Status.Trim();
                scopedProjects = status == UnstagedLabel
                    ? scopedProjects.Where(project => project.StageName == null)
                    : scopedProjects.Where(project => project.StageName == status);
            }

            if (!string.IsNullOrWhiteSpace(filters.Search))
            {
                var search = filters.Search.Trim();
                // Region is matched by its display name in the UI, so resolve the matching
                // region codes first rather than joining the region table into the page query.
                var matchingRegionCodes = await _db.tOptionAdminAreaRegion.AsNoTracking()
                    .Where(region => region.Name.Contains(search))
                    .Select(region => region.ParticipantId)
                    .ToArrayAsync(cancellationToken);

                scopedProjects = scopedProjects.Where(project =>
                    project.ProjectId.Contains(search)
                    || project.Description.Contains(search)
                    || matchingRegionCodes.Contains(project.Region));
            }

            // Deliberately grouped by ProjectPK alone. Carrying the display columns through
            // the GROUP BY works but costs roughly three times as much in SQL Server (the
            // wide grouping key has to be sorted/hashed for all ~57k projects), and this
            // query runs twice — once to count, once to page. So the aggregate stays narrow
            // and the display columns are fetched afterwards for the page's rows only.
            var budgetQuery =
                from project in scopedProjects
                join component in _db.tProjectComponentCost.AsNoTracking()
                    on project.RevisionId equals component.ProjectRevisionFK
                join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                    on component.Id equals cost.ComponentCostFK
                where !component.IsDeleted && !cost.IsDeleted && cost.Year == year
                group cost.Amount by project.ProjectPK into grouped
                select new
                {
                    ProjectPK = grouped.Key,
                    Budget = grouped.Sum()
                };

            var safeLimit = limit < 1 ? 10 : Math.Min(limit, 200);
            var total = await budgetQuery.CountAsync(cancellationToken);
            var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)safeLimit);

            int requestedPage = navigation switch
            {
                PaginationNavigation.First => 1,
                PaginationNavigation.Last => totalPages > 0 ? totalPages : 1,
                _ => Math.Clamp(page < 1 ? 1 : page, 1, Math.Max(totalPages, 1))
            };

            // ThenBy keeps the order total, so OFFSET/FETCH cannot repeat or skip a project
            // between pages when several share a budget.
            var pageBudgets = await budgetQuery
                .OrderByDescending(row => row.Budget)
                .ThenBy(row => row.ProjectPK)
                .Skip((requestedPage - 1) * safeLimit)
                .Take(safeLimit)
                .ToListAsync(cancellationToken);

            var pageKeys = pageBudgets.Select(row => row.ProjectPK).ToArray();
            var budgetByProject = pageBudgets.ToDictionary(row => row.ProjectPK, row => row.Budget);

            var details = await (
                from project in visibleProjects
                join flags in _db.tProjects.AsNoTracking()
                    on project.ProjectPK equals flags.ProjectPK
                where pageKeys.Contains(project.ProjectPK)
                select new
                {
                    flags.Id,
                    project.ProjectPK,
                    project.RevisionId,
                    project.ProjectId,
                    project.Description,
                    project.ProgramName,
                    project.Region,
                    project.CategoryName,
                    project.StageName,
                    project.ImplementingOffice,
                    project.LastUpdatedDate,
                    project.RevisionCreatedDate,
                    flags.IsPublished,
                    flags.IsPublishable,
                    flags.IsRevised
                }).ToListAsync(cancellationToken);

            // Re-impose the paged order, which the detail fetch does not preserve.
            var detailByProject = details.ToDictionary(row => row.ProjectPK);
            var pageRows = pageKeys
                .Where(detailByProject.ContainsKey)
                .Select(key => new { Key = detailByProject[key], Budget = budgetByProject[key] })
                .ToList();

            // Name/funding resolution only ever runs over the rows on this page.
            var regionLookup = await GetRegionsByCodeAsync(
                pageRows.Select(row => row.Key.Region), cancellationToken);

            var officeIds = pageRows.Select(row => row.Key.ImplementingOffice)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct()
                .ToArray();
            var officeLookup = await _db.vAdminImplementingOffice.AsNoTracking()
                .Where(office => officeIds.Contains(office.ParticipantId))
                .Select(office => new { office.ParticipantId, office.Name })
                .ToDictionaryAsync(office => office.ParticipantId, office => office.Name, cancellationToken);

            var revisionIds = pageRows.Select(row => row.Key.RevisionId).Distinct().ToArray();
            var fundingLookup = await GetFundingSourcesByRevisionAsync(revisionIds, cancellationToken);

            var lists = pageRows
                .Select(row =>
                {
                    regionLookup.TryGetValue(row.Key.Region ?? string.Empty, out var region);
                    officeLookup.TryGetValue(row.Key.ImplementingOffice ?? string.Empty, out var officeName);
                    fundingLookup.TryGetValue(row.Key.RevisionId, out var fundingSources);
                    return new DashboardProjectDTO
                    {
                        Id = row.Key.Id,
                        ProjectPK = row.Key.ProjectPK,
                        ProjectId = row.Key.ProjectId,
                        Description = row.Key.Description,
                        ProgramName = row.Key.ProgramName ?? UnrecordedLabel,
                        Region = RegionDisplayName(row.Key.Region, region?.Name),
                        Island = IslandName(region?.IslandCode),
                        Category = row.Key.CategoryName ?? "Uncategorized",
                        StageName = row.Key.StageName ?? UnstagedLabel,
                        ImplementingOffice = OfficeDisplayName(row.Key.ImplementingOffice, officeName),
                        FundingSource = string.IsNullOrWhiteSpace(fundingSources)
                            ? UnrecordedLabel
                            : fundingSources,
                        AllocatedBudget = row.Budget,
                        IsPublished = row.Key.IsPublished,
                        IsPublishable = row.Key.IsPublishable,
                        IsRevised = row.Key.IsRevised,
                        UpdatedAt = row.Key.LastUpdatedDate ?? row.Key.RevisionCreatedDate
                    };
                })
                .ToList();

            var hasPrevious = requestedPage > 1;
            var hasNext = requestedPage < totalPages;

            return new FilteredResult<DashboardProjectDTO>
            {
                lists = lists,
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

        /// <summary>Comma-joined funding source names per revision, for the rows on one page.</summary>
        private async Task<Dictionary<int, string>> GetFundingSourcesByRevisionAsync(
            int[] revisionIds,
            CancellationToken cancellationToken)
        {
            if (revisionIds.Length == 0)
            {
                return new Dictionary<int, string>();
            }

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

            return fundingRows
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
        }

    }
}
