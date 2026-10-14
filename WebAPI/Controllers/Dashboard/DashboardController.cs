using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table.AdminAreas;
using DBHelper.Models.Views.Lumpsum;
using DBHelper.Models.Views.Project;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
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

        // Only used when the database has no programs at all, so the year switcher still
        // has a year to show. Every endpoint otherwise honors the year the caller asked
        // for, validated against the program years that exist — see ResolveYearAsync. (This replaced a hardcoded TemporaryDashboardYear = 2027 that
        // pinned the whole dashboard to a single fiscal year.)
        private const int FallbackDashboardYear = 2027;

        private const string UnrecordedLabel = "Not recorded";
        private const string UnstagedLabel = "Unstaged";

        /// <summary>vProjectLatest.Source when an approved formal revision is the effective one.</summary>
        private const string RevisionSource = "Revision";

        /*  THE BUDGET STAGES (tOptionProgramStage.Name). The dashboard reports appropriations,
            so a project counts only at a stage of the budget cycle (BP through GAA-R) or of a
            Trust Fund. RBP, RDIP and PIP are regional and investment planning proposals: the
            same works come back as BP projects in a separate program, so counting both read
            FY2025 as P3.34T instead of P1.33T. An allow-list rather than an RBP/RDIP/PIP
            deny-list, as the stakeholders asked, so an unstaged project or a stage added later
            stays out until someone decides it belongs. */
        private static readonly string[] BudgetStageNames =
            { "BP", "NEP", "NEP-E", "HGAB", "HGAB-I", "GAA", "GAA-R", "TF", "TF-R" };

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
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // Grouped by the three publish flags rather than by project: SQL Server
                // returns at most eight rows and the per-flag totals are summed here, so
                // the KPI tiles never pull the ~57k project rows this used to materialize.
                var flagTotals = await (
                    from row in await GetCostRowsAsync(scope.SelectedYear, dto?.CategoryId, cancellationToken)
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
                var lsProjects = await LoadLumpSumProjectsAsync(GetVisibleLumpSumSet(dto?.CategoryId), scope.SelectedYear, cancellationToken);

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
                // A trend line is the one part of the dashboard that is deliberately NOT
                // scoped to the selected year: it plots every fiscal year, each read the same
                // way the selected year is (its own programs, its own cost year).
                //
                // SQL groups by the {program year, cost year} pair -- a few dozen rows -- and
                // the pairs where the two match are kept here. Comparing the two years inside
                // the query is the obvious form and must not be used: with no constant year
                // to seek on, SQL Server picks a nested-loop plan that took 34-89 s on
                // myps_db_dev, against 1.7 s for this. A project has one program, so a pair
                // never mixes two projects' years and its distinct count is exact.
                var yearPairs = await (
                    from row in await GetCostRowsAsync(null, dto?.CategoryId, cancellationToken)
                    group new { row.Amount, row.ProjectPK } by new { row.ProgramYear, row.Year } into grouped
                    select new
                    {
                        grouped.Key.ProgramYear,
                        grouped.Key.Year,
                        Budget = grouped.Sum(item => item.Amount),
                        ProjectCount = grouped.Select(item => item.ProjectPK).Distinct().Count()
                    }).ToListAsync(cancellationToken);

                var annualTrend = yearPairs
                    .Where(pair => pair.ProgramYear == pair.Year
                        && pair.Year >= MinimumFiscalYear
                        && pair.Year <= MaximumFiscalYear)
                    .Select(pair => new DashboardTrendDTO
                    {
                        Year = pair.Year,
                        InfrastructureBudget = pair.Budget,
                        ProjectCount = pair.ProjectCount
                    })
                    .OrderBy(row => row.Year)
                    .ToList();

                // LS Itemized per year: the same figure the Lump Sum KPI tile shows for the
                // selected year, so a bar's tooltip agrees with the tile.
                var itemizedByYear = await GetLumpSumItemizedByYearAsync(dto?.CategoryId, cancellationToken);
                foreach (var row in annualTrend)
                {
                    row.LsItemized = itemizedByYear.TryGetValue(row.Year, out var itemized) ? itemized : 0;
                }

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
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // This is the live equivalent of the NEP presentation's macro allocation
                // panel. Program names and amounts are taken from the selected
                // projects/revisions; no presentation categories or values are inferred
                // in Live DB mode. The group-by is SQL-side: one row per program, and only
                // the selected year's programs reach it (see GetCostRowsAsync).
                var budgetBreakdown = await (
                    from row in await GetCostRowsAsync(scope.SelectedYear, dto?.CategoryId, cancellationToken)
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
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // One SQL group-by over {stage, region} serves both halves of this response:
                // stage and region are project-level attributes, so a project contributes to
                // exactly one cell and rolling the cells up by either axis in memory is exact.
                // That keeps this endpoint at a single heavy query instead of two.
                var cells = await (
                    from row in await GetCostRowsAsync(scope.SelectedYear, dto?.CategoryId, cancellationToken)
                    group new { row.Amount, row.ProjectPK } by new { row.StageName, row.RegionCode } into grouped
                    select new
                    {
                        grouped.Key.StageName,
                        Region = grouped.Key.RegionCode,
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
                var scope = await ResolveYearAsync(dto?.Year, cancellationToken);

                // Server-side equivalent of the regional groupby DashboardRegionalMatrix used
                // to do client-side over the full project array — only the aggregated rows go
                // over the wire now. The component's own regionGroup()-based subgroup
                // bucketing (Northern/Southern Luzon, NCR) stays client-side; it only needs
                // {region, island, budget, count}, not raw projects. Grouping by the region
                // code (not its display name) keeps the GROUP BY off the region table; names
                // are resolved afterwards over the resulting handful of rows.
                var regionCells = await (
                    from row in await GetCostRowsAsync(scope.SelectedYear, dto?.CategoryId, cancellationToken)
                    group new { row.Amount, row.ProjectPK } by row.RegionCode into grouped
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
                var scope = await ResolveYearAsync(dto.Year, cancellationToken);
                var result = await PageProjectsAsync(
                    scope.SelectedYear, dto.CategoryId, dto.Filters, dto.limit, dto.page, dto.Navigation, cancellationToken);
                return Ok(result);
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
        public async Task<IActionResult> Revisions(
            [FromBody] DashboardRequestDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                // The queue is a work list, not a fiscal-year figure, so only the category
                // narrows it; the year is deliberately ignored here.
                var visibleProjects = GetVisibleProjects();
                var revisionSummary = await GetRevisionSummaryAsync(visibleProjects, dto?.CategoryId, cancellationToken);
                return Ok(revisionSummary);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
            }
        }

        // ------------------------------------------------------------------
        // Categories — the header's category picker. The list is short (33 rows in
        // tOptionProjectCategory) and the stakeholders asked to see all of it the
        // moment the box is focused, so an empty query returns every category; the
        // page then narrows it in memory as the user types. A non-empty Query is
        // still honoured, substring-matched, for any other caller.
        // ------------------------------------------------------------------
        [HttpPost]
        public async Task<IActionResult> Categories(
            [FromBody] DashboardCategorySearchDTO? dto,
            CancellationToken cancellationToken)
        {
            try
            {
                var query = dto?.Query?.Trim() ?? string.Empty;

                // Every category, inactive ones included: a past fiscal year is still
                // filtered by the categories its projects were saved under. The database
                // collation is case-insensitive, so the comparison does not fold case itself.
                var categories = _db.tOptionProjectCategory.AsNoTracking()
                    .Where(category => category.CategoryName != null);
                if (query.Length > 0)
                {
                    categories = categories.Where(category => category.CategoryName!.Contains(query));
                }

                var matches = await categories
                    .OrderBy(category => category.CategoryName)
                    .Select(category => new DashboardCategoryDTO
                    {
                        CategoryId = category.CategoryId,
                        CategoryName = category.CategoryName!,
                        IsActive = category.IsActive
                    })
                    .ToListAsync(cancellationToken);

                return Ok(new DashboardCategoriesResponseDTO { Categories = matches });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId);
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
                var lsProjects = await LoadLumpSumProjectsAsync(GetVisibleLumpSumSet(dto?.CategoryId), scope.SelectedYear, cancellationToken);
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
                var revisionSummary = await GetRevisionSummaryAsync(visibleProjects, null, cancellationToken);
                var lsProjects = await LoadLumpSumProjectsAsync(GetVisibleLumpSumSet(null), scope.SelectedYear, cancellationToken);

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
            int? categoryId,
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
                var revisionProjects = visibleProjects
                    .Where(project => revisionProjectIds.Contains(project.ProjectId));
                if (categoryId is int category)
                {
                    revisionProjects = revisionProjects.Where(project => project.Category == category);
                }
                var revisionOfficeByProject = await revisionProjects
                    .Select(project => new { project.ProjectId, project.ImplementingOffice })
                    .ToDictionaryAsync(
                        project => project.ProjectId,
                        project => project.ImplementingOffice,
                        cancellationToken);

                // A category narrows the queue to revisions of that category's projects;
                // revisionOfficeByProject now holds exactly those.
                if (categoryId.HasValue)
                {
                    revisionQueue = revisionQueue
                        .Where(revision => revision.ProjectId != null
                            && revisionOfficeByProject.ContainsKey(revision.ProjectId))
                        .ToList();
                }

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
        /// LumpsumController.IsLumpSumVisible checks a single record against. Held to the
        /// same budget stages and category as every other dashboard figure.
        /// </summary>
        private IQueryable<LumpSum> GetVisibleLumpSumSet(int? categoryId)
        {
            IQueryable<LumpSum> visibleLumpSum = _db.vLumpSumSet.AsNoTracking()
                .Where(lumpSum => BudgetStageNames.Contains(lumpSum.StageName));
            if (categoryId is int category)
            {
                visibleLumpSum = visibleLumpSum.Where(lumpSum => lumpSum.Category == category);
            }
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
        /// Itemized Lump Sum amount per program year, with the same live-balance fallback as
        /// <see cref="LoadLumpSumProjectsAsync"/>. Lump Sum Projects number a handful, so
        /// they are summed in memory.
        /// </summary>
        private async Task<Dictionary<int, decimal>> GetLumpSumItemizedByYearAsync(
            int? categoryId,
            CancellationToken cancellationToken)
        {
            var lumpSums = await GetVisibleLumpSumSet(categoryId)
                .Where(lumpSum => lumpSum.StartYear != null)
                .Select(lumpSum => new { lumpSum.Id, Year = lumpSum.StartYear!.Value, lumpSum.ItemizedTotal })
                .ToListAsync(cancellationToken);
            if (lumpSums.Count == 0)
            {
                return new Dictionary<int, decimal>();
            }

            var walletIds = lumpSums.Select(lumpSum => lumpSum.Id).ToArray();
            var itemizedByWallet = await _db.vLumpSumBalance.AsNoTracking()
                .Where(balance => walletIds.Contains(balance.WalletId))
                .ToDictionaryAsync(balance => balance.WalletId, balance => balance.Itemized, cancellationToken);

            return lumpSums
                .GroupBy(lumpSum => lumpSum.Year)
                .ToDictionary(
                    group => group.Key,
                    group => group.Sum(lumpSum =>
                        itemizedByWallet.TryGetValue(lumpSum.Id, out var itemized)
                            ? itemized
                            : lumpSum.ItemizedTotal));
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
        /// should offer. A fiscal year is a program year (tPrograms.StartYear): the switcher
        /// offers the years that have live programs, and every figure for a year is read from
        /// that year's programs (see <see cref="GetCostRowsAsync"/>). An unknown or missing
        /// requested year falls back to the current calendar year when it has programs,
        /// otherwise to the most recent year that does.
        /// </summary>
        private async Task<DashboardYearScope> ResolveYearAsync(
            int? requestedYear,
            CancellationToken cancellationToken)
        {
            var availableYears = await _db.tPrograms.AsNoTracking()
                .Where(program => !program.IsDeleted
                    && program.StartYear >= MinimumFiscalYear
                    && program.StartYear <= MaximumFiscalYear)
                .Select(program => program.StartYear)
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
        /// One row per component-cost-per-year record in the dashboard's scope, carrying only
        /// the dimensions the aggregate endpoints group or filter by. Every section reads it,
        /// so their totals reconcile. The scope:
        /// <list type="bullet">
        /// <item>a visible project, in a live program, at one of <see cref="BudgetStageNames"/>,
        /// and in category <paramref name="categoryId"/> when one is given;</item>
        /// <item>its program's year (tPrograms.StartYear) is <paramref name="year"/>, and only
        /// cost scheduled IN that year counts, so a multi-year project in last year's program
        /// adds nothing to this year. With a null <paramref name="year"/> (the trend) every
        /// row is returned with both years and the caller keeps the pairs where they match;
        /// see <see cref="Trend"/> for why that comparison is not done in SQL;</item>
        /// <item>the cost comes from the project's effective revision: an approved formal
        /// revision's tRevisionProjectComponentCost* rows when it has one (vProjectLatest.Source
        /// 'Revision', what Program Details counts), its base tProjectComponentCost* rows
        /// otherwise;</item>
        /// <item>the region is the one its province belongs to: tProjectRevisions.Province
        /// matched on tOptionAdminAreaProvince.Code. tProjectRevisions.Region is not read: it is
        /// blank on most migrated projects and, where set, names another region than the
        /// province on nearly all of them (NCR projects stored as BARMM). A project whose
        /// province matches no row has no region and shows as Unassigned.</item>
        /// </list>
        ///
        /// Returned as an <see cref="IQueryable{T}"/> and deliberately never materialized: each
        /// caller appends its own <c>GroupBy</c>, which SQL Server executes, so only the
        /// aggregated rows (tens) cross the wire. Budgets are <c>SUM(Amount)</c> at cost-row
        /// grain; project counts are <c>COUNT(DISTINCT ProjectPK)</c>, because one project has
        /// many cost rows. A project is in exactly one of the two branches below, so their
        /// UNION ALL never counts a project twice.
        ///
        /// PERFORMANCE. Nothing here reads a vProjectLatest column that depends on its
        /// per-project CROSS APPLY of fProjectEffectiveRevision (Source, ProjectId,
        /// Description, Region, Category...): touching one makes SQL Server evaluate that
        /// function for every project, which took these queries from about 1 s to 6-9 s. So the
        /// revised projects are found first, as a short list, and the category is read from the
        /// base revision row, which is what the view returns for every unrevised project. The
        /// revised few are point lookups, which cost nothing.
        ///
        /// The watchlist's project filters (island, stage, search: the narrow argument of
        /// GetCostRowSourcesAsync) run on each half's project rows, before the cost joins. Filtering the finished rows instead
        /// made SQL Server re-plan the whole UNION ALL: the island filter went from 2 s to 10 s
        /// and the search timed out.
        /// </summary>
        private async Task<IQueryable<DashboardCostRow>> GetCostRowsAsync(
            int? year,
            int? categoryId,
            CancellationToken cancellationToken)
        {
            var sources = await GetCostRowSourcesAsync(year, categoryId, cancellationToken);
            return sources.Revised is null ? sources.Base : sources.Base.Concat(sources.Revised);
        }

        /// <summary>
        /// The two halves of <see cref="GetCostRowsAsync"/>, kept apart for the watchlist (see
        /// <see cref="DashboardPageMerge"/>): projects costed from their base rows, and, when
        /// any exist, the few costed from an approved formal revision. A project is in one only.
        /// </summary>
        private sealed record CostRowSources(IQueryable<DashboardCostRow> Base, IQueryable<DashboardCostRow>? Revised);

        private async Task<CostRowSources> GetCostRowSourcesAsync(
            int? year,
            int? categoryId,
            CancellationToken cancellationToken,
            Func<IQueryable<ScopedProject>, IQueryable<ScopedProject>>? narrow = null)
        {
            var revisionDetailIds = await GetEffectiveRevisions()
                .Select(item => item.RevisionDetailId)
                .ToArrayAsync(cancellationToken);
            var revisionDetails = _db.tRevisionDetails.AsNoTracking()
                .Where(detail => revisionDetailIds.Contains(detail.Id));

            var projects = GetVisibleProjects()
                .Where(project => BudgetStageNames.Contains(project.StageName));
            var programs = _db.tPrograms.AsNoTracking()
                .Where(program => !program.IsDeleted);
            if (year is int fiscalYear)
            {
                programs = programs.Where(program => program.StartYear == fiscalYear);
            }

            IQueryable<ScopedProject> baseProjects =
                from project in projects
                join program in programs
                    on project.ProgramFK equals program.ProgramPK
                join revision in _db.tProjectRevisions.AsNoTracking()
                    on project.RevisionId equals revision.Id
                select new ScopedProject
                {
                    Project = project,
                    ProgramYear = program.StartYear,
                    Province = revision.Province,
                    Category = revision.Category,
                    ProjectId = revision.ProjectId,
                    Description = revision.Description
                };
            if (revisionDetailIds.Length > 0)
            {
                // NOT EXISTS against tRevisionDetails, not NOT IN over a list of project keys:
                // EF sends that list as an OPENJSON nvarchar(max) column, and with an island
                // filter beside it SQL Server chose a plan seven times slower.
                baseProjects = baseProjects.Where(item =>
                    !revisionDetails.Any(detail => detail.ProjectFK == item.Project.ProjectPK));
            }
            baseProjects = Narrow(baseProjects);

            var baseCosts =
                from item in baseProjects
                join component in _db.tProjectComponentCost.AsNoTracking()
                    on item.Project.RevisionId equals component.ProjectRevisionFK
                join cost in _db.tProjectComponentCostPerYear.AsNoTracking()
                    on component.Id equals cost.ComponentCostFK
                where !component.IsDeleted && !cost.IsDeleted
                select new BranchCostRow
                {
                    ProjectPK = item.Project.ProjectPK,
                    ProgramName = item.Project.ProgramName,
                    StageName = item.Project.StageName,
                    ProgramYear = item.ProgramYear,
                    Province = item.Province,
                    Year = cost.Year,
                    Amount = cost.Amount
                };

            IQueryable<BranchCostRow>? revisedCosts = null;
            if (revisionDetailIds.Length > 0)
            {
                IQueryable<ScopedProject> revisedProjects =
                    from detail in revisionDetails
                    join project in projects
                        on detail.ProjectFK equals project.ProjectPK
                    join program in programs
                        on project.ProgramFK equals program.ProgramPK
                    join revision in _db.tProjectRevisions.AsNoTracking()
                        on project.RevisionId equals revision.Id
                    select new ScopedProject
                    {
                        Project = project,
                        ProgramYear = program.StartYear,
                        Province = revision.Province,
                        // The view's values are the approved revision's for these projects.
                        Category = project.Category,
                        ProjectId = project.ProjectId,
                        Description = project.Description,
                        RevisionDetailId = detail.Id
                    };
                revisedProjects = Narrow(revisedProjects);

                revisedCosts =
                    from item in revisedProjects
                    join component in _db.tRevisionProjectComponentCost.AsNoTracking()
                        on item.RevisionDetailId equals component.RevisionDetailFK
                    join cost in _db.tRevisionProjectComponentCostPerYear.AsNoTracking()
                        on component.Id equals cost.RevisionComponentCostFK
                    where !component.IsDeleted && !cost.IsDeleted
                    select new BranchCostRow
                    {
                        ProjectPK = item.Project.ProjectPK,
                        ProgramName = item.Project.ProgramName,
                        StageName = item.Project.StageName,
                        ProgramYear = item.ProgramYear,
                        Province = item.Province,
                        Year = cost.Year,
                        Amount = cost.Amount
                    };
            }

            return new CostRowSources(
                ToCostRows(baseCosts),
                revisedCosts is null ? null : ToCostRows(revisedCosts));

            IQueryable<ScopedProject> Narrow(IQueryable<ScopedProject> source)
            {
                if (categoryId is int category)
                {
                    source = source.Where(item => item.Category == category);
                }
                return narrow is null ? source : narrow(source);
            }

            // The cost-year filter and the province -> region lookup, the same for both halves.
            IQueryable<DashboardCostRow> ToCostRows(IQueryable<BranchCostRow> costs)
            {
                if (year is int costYear)
                {
                    costs = costs.Where(row => row.Year == costYear);
                }
                return
                    from row in costs
                    join province in _db.tOptionAdminAreaProvince.AsNoTracking()
                        on row.Province equals province.Code into provinces
                    from province in provinces.DefaultIfEmpty()
                    select new DashboardCostRow
                    {
                        ProjectPK = row.ProjectPK,
                        ProgramName = row.ProgramName,
                        StageName = row.StageName,
                        RegionCode = province.RegionParticipantId,
                        ProgramYear = row.ProgramYear,
                        Year = row.Year,
                        Amount = row.Amount
                    };
            }
        }

        /// <summary>One cost row of either half, before its province is resolved to a region.</summary>
        private sealed class BranchCostRow
        {
            public string ProjectPK { get; set; } = string.Empty;
            public string? ProgramName { get; set; }
            public string? StageName { get; set; }
            public int ProgramYear { get; set; }
            public string? Province { get; set; }
            public int Year { get; set; }
            public decimal Amount { get; set; }
        }

        /// <summary>
        /// A project inside the dashboard scope, before its cost rows are joined: what
        /// <see cref="GetCostRowSourcesAsync"/>'s project filters can see.
        /// </summary>
        private sealed class ScopedProject
        {
            public ProjectLatest Project { get; set; } = null!;
            public int ProgramYear { get; set; }
            /// <summary>tProjectRevisions.Province, a tOptionAdminAreaProvince.Code.</summary>
            public string? Province { get; set; }
            /// <summary>
            /// Category, ID and description as vProjectLatest shows them: the base revision row's
            /// for an unrevised project (exactly what the view returns for it), the view's own for
            /// a revised one. Read from the base row where possible because the view's columns
            /// make SQL Server resolve every project's effective revision (see GetCostRowsAsync).
            /// </summary>
            public int Category { get; set; }
            public string ProjectId { get; set; } = string.Empty;
            public string Description { get; set; } = string.Empty;
            /// <summary>The approved formal revision the project reads its cost from; 0 for none.</summary>
            public int RevisionDetailId { get; set; }
        }

        /// <summary>
        /// The approved formal revision each revised project reads from: its latest
        /// tRevisionDetails row that has a live snapshot and was approved by both the RO and
        /// the CO tier. This is dbo.fProjectEffectiveRevision's rule, which decides
        /// vProjectLatest.Source, with fRevisionApprovalStatus.IsFullyApproved inlined as two
        /// EXISTS checks; they are equal because UQ_tRevisionApprovals_Level allows one
        /// approval row per level. Status 1 is Approved in tOptionRevisionStatus.
        /// </summary>
        private IQueryable<EffectiveRevision> GetEffectiveRevisions() =>
            from detail in _db.tRevisionDetails.AsNoTracking()
            where _db.tRevisionProjectSnapshot.Any(snapshot =>
                    snapshot.RevisionDetailFK == detail.Id && !snapshot.IsDeleted)
                && _db.tRevisionApprovals.Any(approval =>
                    approval.RevisionDetailFK == detail.Id && approval.Level == "RO" && approval.Status == 1)
                && _db.tRevisionApprovals.Any(approval =>
                    approval.RevisionDetailFK == detail.Id && approval.Level == "CO" && approval.Status == 1)
            group detail.Id by detail.ProjectFK into grouped
            select new EffectiveRevision
            {
                ProjectFK = grouped.Key,
                RevisionDetailId = grouped.Max()
            };

        private sealed class EffectiveRevision
        {
            public string ProjectFK { get; set; } = string.Empty;
            public int RevisionDetailId { get; set; }
        }

        private sealed class DashboardCostRow
        {
            public string ProjectPK { get; set; } = string.Empty;
            public string? ProgramName { get; set; }
            public string? StageName { get; set; }
            /// <summary>tOptionAdminAreaRegion.ParticipantId of the project's province; null when none matches.</summary>
            public string? RegionCode { get; set; }
            /// <summary>tPrograms.StartYear: the fiscal year the project's program belongs to.</summary>
            public int ProgramYear { get; set; }
            /// <summary>The year this cost is scheduled in.</summary>
            public int Year { get; set; }
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

        /// <summary>
        /// Codes of the provinces whose region satisfies <paramref name="regionPredicate"/>, as
        /// a subquery. Kept in SQL on purpose: sent as a list (an OPENJSON parameter, which
        /// carries no statistics) the 39 Luzon codes made the watchlist's island filter take
        /// 4.4 s per query instead of 0.6 s.
        /// </summary>
        private IQueryable<string> GetProvinceCodes(Expression<Func<OptionAdminAreaRegion, bool>> regionPredicate)
        {
            var regionCodes = _db.tOptionAdminAreaRegion.AsNoTracking()
                .Where(regionPredicate)
                .Select(region => region.ParticipantId);
            return _db.tOptionAdminAreaProvince.AsNoTracking()
                .Where(province => regionCodes.Contains(province.RegionParticipantId))
                .Select(province => province.Code);
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
        // Watchlist paging
        // ------------------------------------------------------------------

        /// <summary>
        /// Pages the watchlist in SQL: filters, per-project budget aggregation, ordering and
        /// <c>OFFSET/FETCH</c> all run server-side, so one page costs one page. It pages the
        /// same <see cref="GetCostRowsAsync"/> the aggregate sections read, so a project's budget,
        /// island and region here are the ones those sections count.
        ///
        /// This is still not <see cref="Helpers.QueryPaginationExtensions.FilterDataCursor"/>'s
        /// keyset pagination — that helper pages a single SQL table/view/TVF directly, and this
        /// is a multi-table join with a computed per-year budget and no backing view. Page
        /// numbers are honored directly and the cursor id fields below are page numbers, so the
        /// shared frontend usePagination hook's contract (cursors are opaque) still holds.
        /// </summary>
        private async Task<FilteredResult<DashboardProjectDTO>> PageProjectsAsync(
            int year,
            int? categoryId,
            ShowDashboardProjectsFilterDTO filters,
            int limit,
            int page,
            PaginationNavigation navigation,
            CancellationToken cancellationToken)
        {
            // The island and region filters are expressed as display names ("Luzon"); each is
            // matched through the province codes it covers, on the project's own province.
            var hasIslandFilter = !string.IsNullOrWhiteSpace(filters.Island);
            var islandCode = hasIslandFilter ? IslandCode(filters.Island!) : null;
            // For "Unassigned" (a null island code) this is every province that DOES resolve
            // to an island.
            var provincesOnIsland = GetProvinceCodes(
                islandCode is null
                    ? region => region.IslandCode == "LZ" || region.IslandCode == "VS" || region.IslandCode == "MN"
                    : region => region.IslandCode == islandCode);

            var status = filters.Status?.Trim() ?? string.Empty;
            var search = filters.Search?.Trim() ?? string.Empty;
            var provincesInMatchingRegions = GetProvinceCodes(region => region.Name.Contains(search));

            IQueryable<ScopedProject> Narrow(IQueryable<ScopedProject> projects)
            {
                if (hasIslandFilter)
                {
                    projects = islandCode is null
                        // "Unassigned" means the project's province resolves to no island at
                        // all. The explicit null test matters: NOT IN never matches a NULL.
                        ? projects.Where(item => item.Province == null || !provincesOnIsland.Contains(item.Province))
                        : projects.Where(item => provincesOnIsland.Contains(item.Province));
                }
                if (status.Length > 0)
                {
                    projects = projects.Where(item => item.Project.StageName == status);
                }
                if (search.Length > 0)
                {
                    projects = projects.Where(item =>
                        item.ProjectId.Contains(search)
                        || item.Description.Contains(search)
                        || provincesInMatchingRegions.Contains(item.Province));
                }
                return projects;
            }

            var sources = await GetCostRowSourcesAsync(year, categoryId, cancellationToken, Narrow);

            // Deliberately grouped by project alone (its region code rides along: a project has
            // one province, so it never splits a group). Carrying the display columns through
            // the GROUP BY works but costs roughly three times as much in SQL Server, and this
            // query runs twice — once to count, once to page. So the aggregate stays narrow and
            // the display columns are fetched afterwards for the page's rows only.
            var baseBudgets = ToProjectBudgets(sources.Base);

            // The few projects costed from an approved formal revision are ranked in memory
            // and merged into the SQL page (see DashboardPageMerge for why they are not in it).
            var revisedBudgets = sources.Revised is null
                ? new List<DashboardProjectBudget>()
                : await ToProjectBudgets(sources.Revised).ToListAsync(cancellationToken);

            var safeLimit = limit < 1 ? 10 : Math.Min(limit, 200);
            var total = await baseBudgets.CountAsync(cancellationToken) + revisedBudgets.Count;
            var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)safeLimit);

            int requestedPage = navigation switch
            {
                PaginationNavigation.First => 1,
                PaginationNavigation.Last => totalPages > 0 ? totalPages : 1,
                _ => Math.Clamp(page < 1 ? 1 : page, 1, Math.Max(totalPages, 1))
            };

            // ThenBy keeps the order total, so OFFSET/FETCH cannot repeat or skip a project
            // between pages when several share a budget.
            var offset = (requestedPage - 1) * safeLimit;
            var windowStart = DashboardPageMerge.WindowStart(offset, revisedBudgets.Count);
            var window = await baseBudgets
                .OrderByDescending(row => row.Budget)
                .ThenBy(row => row.ProjectPK)
                .Skip(windowStart)
                .Take(offset + safeLimit - windowStart)
                .ToListAsync(cancellationToken);
            var pageBudgets = DashboardPageMerge.Page(window, windowStart, revisedBudgets, offset, safeLimit);

            var pageKeys = pageBudgets.Select(row => row.ProjectPK).ToArray();
            var pageByProject = pageBudgets.ToDictionary(row => row.ProjectPK);

            var details = await (
                from project in GetVisibleProjects()
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
                .Select(key => new { Key = detailByProject[key], Page = pageByProject[key] })
                .ToList();

            // Name/funding resolution only ever runs over the rows on this page.
            var regionLookup = await GetRegionsByCodeAsync(
                pageRows.Select(row => row.Page.RegionCode), cancellationToken);

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
                    regionLookup.TryGetValue(row.Page.RegionCode ?? string.Empty, out var region);
                    officeLookup.TryGetValue(row.Key.ImplementingOffice ?? string.Empty, out var officeName);
                    fundingLookup.TryGetValue(row.Key.RevisionId, out var fundingSources);
                    return new DashboardProjectDTO
                    {
                        Id = row.Key.Id,
                        ProjectPK = row.Key.ProjectPK,
                        ProjectId = row.Key.ProjectId,
                        Description = row.Key.Description,
                        ProgramName = row.Key.ProgramName ?? UnrecordedLabel,
                        Region = RegionDisplayName(row.Page.RegionCode, region?.Name),
                        Island = IslandName(region?.IslandCode),
                        Category = row.Key.CategoryName ?? "Uncategorized",
                        StageName = row.Key.StageName ?? UnstagedLabel,
                        ImplementingOffice = OfficeDisplayName(row.Key.ImplementingOffice, officeName),
                        FundingSource = string.IsNullOrWhiteSpace(fundingSources)
                            ? UnrecordedLabel
                            : fundingSources,
                        AllocatedBudget = row.Page.Budget,
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

        private static IQueryable<DashboardProjectBudget> ToProjectBudgets(IQueryable<DashboardCostRow> rows) =>
            from row in rows
            group row.Amount by new { row.ProjectPK, row.RegionCode } into grouped
            select new DashboardProjectBudget
            {
                ProjectPK = grouped.Key.ProjectPK,
                RegionCode = grouped.Key.RegionCode,
                Budget = grouped.Sum()
            };

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
