using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using DBHelper.Models.Views.MultiYear;
using Helpers;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.MultiYear
{
    public partial class MultiYearController
    {
        #region Reads

        /// <summary>Filter and Create Portfolio sources: the owners the caller can see, and whether PIP is among them.</summary>
        [HttpPost]
        public async Task<IActionResult> InitMultiYearFilters(CancellationToken cancellationToken)
        {
            try
            {
                var visibility = await VisibilityAsync(cancellationToken);
                var regions = (await _db.tOptionAdminAreaRegion.AsNoTracking()
                        .Where(r => !r.Deprecated)
                        .OrderBy(r => r.Name)
                        .Select(r => new { r.ParticipantId, r.Name })
                        .ToListAsync(cancellationToken))
                    .Where(r => visibility.CanSee(EnumPortfolioKind.RDIP, r.ParticipantId))
                    .ToList();
                // MY-PFL-08, -27: the UDIP owners are the PMO cluster offices the data lists (OQ-01:
                // RPMO-BARMM is offered when the office list has it).
                var clusters = (await _db.vAdminPMOCluster.AsNoTracking()
                        .OrderBy(c => c.Name)
                        .Select(c => new { c.ParticipantId, c.Name })
                        .ToListAsync(cancellationToken))
                    .Where(c => visibility.CanSee(EnumPortfolioKind.UDIP, c.ParticipantId))
                    .ToList();

                return Ok(new
                {
                    Regions = regions,
                    Clusters = clusters,
                    CanSeePip = visibility.CanSee(EnumPortfolioKind.PIP, null),
                    CurrentYear = Functions.CurrentDate().Year,
                    FirstTermStartYear = PortfolioTermRules.FirstTermStartYear,
                    LastTermStartYear = PortfolioTermRules.LastTermStartYear,
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        /// <summary>Every portfolio the caller can see, PIP included when they may (MY-PFL-26).</summary>
        [HttpPost]
        public async Task<IActionResult> ShowPortfolios([FromBody] ShowPortfoliosDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var query = _db.tMultiYearPortfolio.AsNoTracking();
                if (dto.Kind is EnumPortfolioKind kind) query = query.Where(p => p.Kind == kind);
                if (!string.IsNullOrWhiteSpace(dto.OwnerParticipantId)) query = query.Where(p => p.OwnerParticipantId == dto.OwnerParticipantId.Trim());
                if (dto.Status is EnumPortfolioStatus status) query = query.Where(p => p.Status == status);
                if (dto.Year is int year) query = query.Where(p => p.TermStartYear <= year && p.TermEndYear >= year);

                var visibility = await VisibilityAsync(cancellationToken);
                var portfolios = (await query.ToListAsync(cancellationToken))
                    .Where(p => visibility.CanSee(p.Kind, p.OwnerParticipantId))
                    .ToList();
                return Ok(await PortfolioRowsAsync(portfolios, cancellationToken));
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// The PIP terms. This action IS the Show PIP grant (MultiYearAccess.ShowPipAction): holding
        /// it is what lets a user who is not "All projects" see PIP anywhere in the module. Phase 2's
        /// Add to PIP lists its target terms through it.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ShowPipPortfolios(CancellationToken cancellationToken)
        {
            try
            {
                var portfolios = await _db.tMultiYearPortfolio.AsNoTracking()
                    .Where(p => p.Kind == EnumPortfolioKind.PIP)
                    .ToListAsync(cancellationToken);
                return Ok(await PortfolioRowsAsync(portfolios, cancellationToken));
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        /// <summary>One portfolio: its term chain, per-year planned cost against its ceilings, and status counts.</summary>
        [HttpPost]
        public async Task<IActionResult> PortfolioDetails([FromBody] PortfolioIdDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: false, cancellationToken);
                if (refusal != null) return refusal;
                return Ok(await BuildPortfolioDetailsAsync(portfolio!, cancellationToken));
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>The Members tab: a portfolio's projects, cursor-paged (FilterDataCursor).</summary>
        [HttpPost]
        public async Task<IActionResult> ShowPortfolioMembers([FromBody] ShowPortfolioMembersDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.Filters.PortfolioId, forWrite: false, cancellationToken);
                if (refusal != null) return refusal;

                var filters = new List<(string Clause, string ParamName, object? Value)>
                {
                    ("v.PortfolioFK = @PortfolioFK", "@PortfolioFK", portfolio!.Id),
                };
                if (dto.Filters.Status is EnumMembershipStatus status)
                    filters.Add(("v.Status = @Status", "@Status", (byte)status));
                if (!string.IsNullOrWhiteSpace(dto.Filters.Search))
                    filters.Add(("(v.ProjectId LIKE @Search OR v.Description LIKE @Search)", "@Search", $"%{dto.Filters.Search.Trim()}%"));

                FilterDataResult<PortfolioMemberListRow> result = await _db.FilterDataCursor<PortfolioMemberListRow, MemberFilterDTO>(
                    tableName: "vMultiYearPortfolioMemberList",
                    dto: dto,
                    filter: filters,
                    keyColumn: "Id",
                    descending: true,
                    includeTotal: true,
                    ct: cancellationToken);
                if (result.HasError)
                    return new BadRequestObjectResult(new ErrorResult { Title = "Pagination error", Message = result.ErrorMessage ?? "Unable to retrieve the records." });

                await NameMemberRowsAsync(result.Data.lists, portfolio, cancellationToken);
                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Writes

        /// <summary>Creates an RDIP, UDIP or PIP for one six-year term (MY-PFL-01, -03, -04, -05).</summary>
        [HttpPost]
        public async Task<IActionResult> CreatePortfolio([FromBody] CreatePortfolioDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                if (!Enum.IsDefined(dto.Kind))
                    return Refused("Invalid Portfolio", "Choose RDIP, UDIP or PIP.");

                string? owner = dto.Kind == EnumPortfolioKind.PIP ? null : dto.OwnerParticipantId?.Trim();
                if (dto.Kind == EnumPortfolioKind.RDIP)
                {
                    if (string.IsNullOrEmpty(owner))
                        return Refused("Region Required", "Choose the region the RDIP belongs to.");
                    if (!await _db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(r => r.ParticipantId == owner && !r.Deprecated, cancellationToken))
                        return Refused("Invalid Region", "The selected region is not valid.");
                }
                else if (dto.Kind == EnumPortfolioKind.UDIP)
                {
                    if (string.IsNullOrEmpty(owner))
                        return Refused("UPMO Cluster Required", "Choose the UPMO cluster the UDIP belongs to.");
                    if (!await _db.vAdminPMOCluster.AsNoTracking().AnyAsync(c => c.ParticipantId == owner, cancellationToken))
                        return Refused("Invalid UPMO Cluster", "The selected UPMO cluster is not valid.");
                }

                if (!(await VisibilityAsync(cancellationToken)).CanSee(dto.Kind, owner))
                    return Denied(dto.Kind == EnumPortfolioKind.PIP ? "the PIP" : "this owner's portfolios");

                string ownerKey = owner ?? string.Empty;
                var existingStarts = await _db.tMultiYearPortfolio.AsNoTracking()
                    .Where(p => p.Kind == dto.Kind && p.OwnerKey == ownerKey)
                    .Select(p => p.TermStartYear)
                    .ToListAsync(cancellationToken);
                string? ownerName = await OwnerNameAsync(owner, cancellationToken);
                if (PortfolioTermRules.CreateRefusal(dto.Kind, ownerName, dto.TermStartYear, existingStarts) is string termRefusal)
                    return Refused("Invalid Term", termRefusal);

                var portfolio = new MultiYearPortfolio
                {
                    Kind = dto.Kind,
                    OwnerParticipantId = owner,
                    TermStartYear = dto.TermStartYear,
                    Status = EnumPortfolioStatus.Open,
                    CreatedBy = _Session.UserId,
                    CreatedDate = Functions.CurrentDate(),
                };
                string name = PortfolioTermRules.PortfolioName(dto.Kind, ownerName, dto.TermStartYear);
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                _db.tMultiYearPortfolio.Add(portfolio);
                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    _db.ChangeTracker.Clear();
                    // Two simultaneous creates: the unique constraint let one through.
                    if (!await _db.tMultiYearPortfolio.AsNoTracking().AnyAsync(p => p.Kind == dto.Kind && p.OwnerKey == ownerKey && p.TermStartYear == dto.TermStartYear, cancellationToken))
                        throw;
                    return Refused("Invalid Term", $"{name} already exists.");
                }

                // MY-PFL-24: totals are saved when a term opens.
                await SavedTotalsWriter.SaveAsync(_db, portfolio, EnumTotalsReason.TermOpened, null, $"{name} opened.", _Session.UserId, skipIfSame: false, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return Ok(new { PortfolioId = portfolio.Id, Name = name, Message = $"{name} created." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// Opens the next six-year term (MY-PFL-06): every membership that is not completed or
        /// cancelled is carried into a new membership with its fields, the old term is closed and
        /// read-only, and no project record is created or copied.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> OpenNextTerm([FromBody] PortfolioIdDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: false, cancellationToken, tracked: true);
                if (refusal != null) return refusal;
                string currentName = await PortfolioNameAsync(portfolio!, cancellationToken);

                if (portfolio!.Status != EnumPortfolioStatus.Open)
                    return Refused("Term Closed", $"{currentName} is already closed; its next term has been opened.");

                int nextStart = PortfolioTermRules.NextTermStart(portfolio.TermStartYear);
                if (nextStart > PortfolioTermRules.LastTermStartYear)
                    return Refused("Invalid Term", $"The term must start between {PortfolioTermRules.FirstTermStartYear} and {PortfolioTermRules.LastTermStartYear}.");
                string ownerKey = portfolio.OwnerKey;
                var clash = await _db.tMultiYearPortfolio.AsNoTracking()
                    .Where(p => p.Kind == portfolio.Kind && p.OwnerKey == ownerKey && p.Id != portfolio.Id
                             && p.TermStartYear > nextStart - PortfolioTermRules.TermYears && p.TermStartYear < nextStart + PortfolioTermRules.TermYears)
                    .Select(p => (int?)p.TermStartYear)
                    .FirstOrDefaultAsync(cancellationToken);
                if (clash != null)
                    return Refused("Invalid Term", $"{PortfolioTermRules.PortfolioName(portfolio.Kind, await OwnerNameAsync(portfolio.OwnerParticipantId, cancellationToken), clash.Value)} already covers part of the next term.");

                var now = Functions.CurrentDate();
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                var next = new MultiYearPortfolio
                {
                    Kind = portfolio.Kind,
                    OwnerParticipantId = portfolio.OwnerParticipantId,
                    TermStartYear = nextStart,
                    Status = EnumPortfolioStatus.Open,
                    PreviousPortfolioFK = portfolio.Id,
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                };
                _db.tMultiYearPortfolio.Add(next);
                await _db.SaveChangesAsync(cancellationToken);

                var members = await _db.tMultiYearPortfolioMember.AsNoTracking()
                    .Where(m => m.PortfolioFK == portfolio.Id)
                    .ToListAsync(cancellationToken);
                var carried = members
                    .Where(m => !MembershipStatusRules.IsLocked(m.Status))
                    .Select(m => new MultiYearPortfolioMember
                    {
                        PortfolioFK = next.Id,
                        MultiYearProjectFK = m.MultiYearProjectFK,
                        IsOwner = m.IsOwner,
                        SourcePortfolioFK = m.SourcePortfolioFK,
                        CarriedFromMemberFK = m.Id,
                        Status = m.Status,
                        StartYear = m.StartYear,
                        Cost = m.Cost,
                        OriginalCost = m.OriginalCost,
                        BasisForImplementationFK = m.BasisForImplementationFK,
                        NedaProjectStatusFK = m.NedaProjectStatusFK,
                        ReadinessLevelIds = m.ReadinessLevelIds,
                        RdpOutcomes = m.RdpOutcomes,
                        Tier = m.Tier,
                        McaScore = m.McaScore,
                        CreatedBy = _Session.UserId,
                        CreatedDate = now,
                    })
                    .ToList();
                _db.tMultiYearPortfolioMember.AddRange(carried);
                await _db.SaveChangesAsync(cancellationToken);
                _db.tMultiYearMemberStatusLog.AddRange(carried.Select(m => new MultiYearMemberStatusLog
                {
                    MemberFK = m.Id,
                    FromStatus = m.Status,
                    ToStatus = m.Status,
                    Reason = $"Carried forward from {currentName}.",
                    ChangedBy = _Session.UserId,
                    ChangedDate = now,
                }));

                portfolio.Status = EnumPortfolioStatus.Closed;
                portfolio.ClosedBy = _Session.UserId;
                portfolio.ClosedDate = now;
                await _db.SaveChangesAsync(cancellationToken);

                // MY-PFL-24: totals are saved when a term closes and when one opens.
                string nextName = await PortfolioNameAsync(next, cancellationToken);
                await SavedTotalsWriter.SaveAsync(_db, portfolio, EnumTotalsReason.TermClosed, null, $"{currentName} closed; {nextName} opened.", _Session.UserId, skipIfSame: false, cancellationToken);
                await SavedTotalsWriter.SaveAsync(_db, next, EnumTotalsReason.TermOpened, null, $"{nextName} opened from {currentName}.", _Session.UserId, skipIfSame: false, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                int left = members.Count - carried.Count;
                return Ok(new
                {
                    PortfolioId = next.Id,
                    Name = nextName,
                    Carried = carried.Count,
                    LeftBehind = left,
                    Message = $"{nextName} opened with {carried.Count} project(s) carried forward"
                        + (left > 0 ? $"; {left} completed or cancelled project(s) stay in {currentName}." : ".")
                        + $" {currentName} is now closed and read-only.",
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>Records a budget ceiling for years of the portfolio's term (MY-PFL-23). Answers the refreshed details.</summary>
        [HttpPost]
        public async Task<IActionResult> SaveBudgetCeilings([FromBody] SaveBudgetCeilingsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;

                var ceilings = dto.Ceilings ?? new();
                if (ceilings.Count == 0)
                    return Refused("Nothing to Save", "Enter a budget ceiling for at least one year.");
                if (ceilings.GroupBy(c => c.Year).FirstOrDefault(g => g.Count() > 1) is { } twice)
                    return Refused("Invalid Budget Ceiling", $"{twice.Key} is entered more than once.");
                if (ceilings.FirstOrDefault(c => c.Year < portfolio!.TermStartYear || c.Year > portfolio.TermEndYear) is { } outside)
                    return Refused("Invalid Budget Ceiling", $"{outside.Year} is outside the term {PortfolioTermRules.TermLabel(portfolio!.TermStartYear)}.");
                if (ceilings.FirstOrDefault(c => c.Amount < 0) is { } negative)
                    return Refused("Invalid Budget Ceiling", $"The budget ceiling for {negative.Year} cannot be negative.");

                var now = Functions.CurrentDate();
                var existing = await _db.tMultiYearPortfolioCeiling
                    .Where(c => c.PortfolioFK == portfolio!.Id)
                    .ToDictionaryAsync(c => c.Year, cancellationToken);
                foreach (var ceiling in ceilings)
                {
                    decimal amount = Math.Round(ceiling.Amount, 2);
                    if (existing.TryGetValue(ceiling.Year, out var row))
                    {
                        if (row.Amount == amount) continue;
                        row.Amount = amount;
                        row.UpdatedBy = _Session.UserId;
                        row.UpdatedDate = now;
                    }
                    else
                    {
                        _db.tMultiYearPortfolioCeiling.Add(new MultiYearPortfolioCeiling
                        {
                            PortfolioFK = portfolio!.Id,
                            Year = ceiling.Year,
                            Amount = amount,
                            CreatedBy = _Session.UserId,
                            CreatedDate = now,
                        });
                    }
                }
                await _db.SaveChangesAsync(cancellationToken);

                var details = await BuildPortfolioDetailsAsync(portfolio!, cancellationToken);
                return Ok(new { Details = details, Message = "Budget ceilings saved." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Shapes

        private async Task<List<object>> PortfolioRowsAsync(List<MultiYearPortfolio> portfolios, CancellationToken ct)
        {
            var ids = portfolios.Select(p => p.Id).ToList();
            var stats = await _db.tMultiYearPortfolioMember.AsNoTracking()
                .Where(m => ids.Contains(m.PortfolioFK))
                .GroupBy(m => m.PortfolioFK)
                .Select(g => new
                {
                    PortfolioFK = g.Key,
                    Projects = g.Count(),
                    Cost = g.Where(m => m.Status != EnumMembershipStatus.Cancelled).Sum(m => (decimal?)m.Cost) ?? 0,
                })
                .ToDictionaryAsync(s => s.PortfolioFK, ct);
            var nextIds = await _db.tMultiYearPortfolio.AsNoTracking()
                .Where(p => p.PreviousPortfolioFK != null && ids.Contains(p.PreviousPortfolioFK.Value))
                .ToDictionaryAsync(p => p.PreviousPortfolioFK!.Value, p => p.Id, ct);

            var rows = new List<object>();
            foreach (var p in portfolios.OrderBy(p => p.Kind).ThenBy(p => p.OwnerKey).ThenByDescending(p => p.TermStartYear))
            {
                string? ownerName = await OwnerNameAsync(p.OwnerParticipantId, ct);
                stats.TryGetValue(p.Id, out var s);
                rows.Add(new
                {
                    p.Id,
                    p.Kind,
                    KindName = PortfolioTermRules.KindName(p.Kind),
                    p.OwnerParticipantId,
                    OwnerName = ownerName,
                    p.TermStartYear,
                    p.TermEndYear,
                    Term = PortfolioTermRules.TermLabel(p.TermStartYear),
                    p.Status,
                    Name = PortfolioTermRules.PortfolioName(p.Kind, ownerName, p.TermStartYear),
                    PreviousPortfolioId = p.PreviousPortfolioFK,
                    NextPortfolioId = nextIds.TryGetValue(p.Id, out var nextId) ? nextId : (int?)null,
                    ProjectCount = s?.Projects ?? 0,
                    PlannedCost = s?.Cost ?? 0,
                });
            }
            return rows;
        }

        private async Task<object> BuildPortfolioDetailsAsync(MultiYearPortfolio portfolio, CancellationToken ct)
        {
            var row = (await PortfolioRowsAsync(new List<MultiYearPortfolio> { portfolio }, ct)).Single();

            // Planned cost per year of every membership that is not cancelled, from the shared stream.
            var perYear = await (
                    from m in _db.tMultiYearPortfolioMember.AsNoTracking()
                    where m.PortfolioFK == portfolio.Id && m.Status != EnumMembershipStatus.Cancelled
                    join c in _db.tMultiYearComponent.AsNoTracking() on m.MultiYearProjectFK equals c.MultiYearProjectFK
                    join y in _db.tMultiYearComponentCostPerYear.AsNoTracking() on c.Id equals y.MultiYearComponentFK
                    where y.Status != EnumCostStreamStatus.Superseded
                    group y by y.Year into g
                    select new { Year = g.Key, Amount = g.Sum(x => x.Amount) })
                .ToDictionaryAsync(x => x.Year, x => x.Amount, ct);
            var ceilings = await _db.tMultiYearPortfolioCeiling.AsNoTracking()
                .Where(c => c.PortfolioFK == portfolio.Id)
                .ToDictionaryAsync(c => c.Year, c => c.Amount, ct);
            var statusCounts = await _db.tMultiYearPortfolioMember.AsNoTracking()
                .Where(m => m.PortfolioFK == portfolio.Id)
                .GroupBy(m => m.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            var years = Enumerable.Range(portfolio.TermStartYear, PortfolioTermRules.TermYears)
                .Select(year => new
                {
                    Year = year,
                    Planned = perYear.TryGetValue(year, out var planned) ? planned : 0,
                    Ceiling = ceilings.TryGetValue(year, out var ceiling) ? ceiling : (decimal?)null,
                })
                .ToList();

            return new
            {
                Portfolio = row,
                Years = years,
                PlannedBeforeTerm = perYear.Where(x => x.Key < portfolio.TermStartYear).Sum(x => x.Value),
                PlannedLaterYears = perYear.Where(x => x.Key > portfolio.TermEndYear).Sum(x => x.Value),
                StatusCounts = statusCounts,
                IsOpen = portfolio.Status == EnumPortfolioStatus.Open,
                TermHasEnded = Functions.CurrentDate().Year > portfolio.TermEndYear,
                CanAddProjects = portfolio.Status == EnumPortfolioStatus.Open && portfolio.Kind != EnumPortfolioKind.PIP,
            };
        }

        private async Task NameMemberRowsAsync(List<PortfolioMemberListRow> rows, MultiYearPortfolio portfolio, CancellationToken ct)
        {
            if (rows.Count == 0) return;
            var categoryIds = rows.Select(r => r.Category).Distinct().ToList();
            var categories = await _db.tOptionProjectCategory.AsNoTracking()
                .Where(c => categoryIds.Contains(c.CategoryId))
                .Select(c => new { c.CategoryId, c.CategoryName })
                .ToListAsync(ct);
            var deoIds = rows.Where(r => r.DEO != null).Select(r => r.DEO!).Distinct().ToList();
            var deos = await _db.vAdminDEO.AsNoTracking()
                .Where(d => deoIds.Contains(d.ParticipantId))
                .Select(d => new { d.ParticipantId, d.Name })
                .ToListAsync(ct);
            var sourceIds = rows.Where(r => r.SourcePortfolioFK != null).Select(r => r.SourcePortfolioFK!.Value).Distinct().ToList();
            var sources = await _db.tMultiYearPortfolio.AsNoTracking().Where(p => sourceIds.Contains(p.Id)).ToListAsync(ct);
            bool open = portfolio.Status == EnumPortfolioStatus.Open;
            foreach (var row in rows)
            {
                var source = sources.FirstOrDefault(p => p.Id == row.SourcePortfolioFK);
                row.SourcePortfolioName = source == null ? null : await PortfolioNameAsync(source, ct);
                row.CategoryName = categories.FirstOrDefault(c => c.CategoryId == row.Category)?.CategoryName;
                row.RegionName = await OwnerNameAsync(row.Region, ct);
                row.DEOName = deos.FirstOrDefault(d => d.ParticipantId == row.DEO)?.Name;
                row.AllowedStatuses = open ? MembershipStatusRules.ManualTargets(row.Status).ToList() : new();
            }
        }

        #endregion
    }
}
