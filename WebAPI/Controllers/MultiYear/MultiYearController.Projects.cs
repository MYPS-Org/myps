using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using Helpers;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.MultiYear
{
    public partial class MultiYearController
    {
        #region Form sources

        /// <summary>
        /// Everything the Add / Edit planning project form offers, scoped to the portfolio: an RDIP's
        /// projects are in its region; a UDIP's may be in any region and are implemented by its
        /// cluster office. Lookups come back COMPLETE, retired rows included, so a saved value always
        /// shows; the form offers only selectable rows for a new pick (the convention of the Project form).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> InitPlanningProjectForm([FromBody] PortfolioIdDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: false, cancellationToken);
                if (refusal != null) return refusal;

                var regionsQuery = _db.tOptionAdminAreaRegion.AsNoTracking().Where(r => !r.Deprecated);
                if (portfolio!.Kind == EnumPortfolioKind.RDIP)
                    regionsQuery = regionsQuery.Where(r => r.ParticipantId == portfolio.OwnerParticipantId);
                var regions = await regionsQuery.OrderBy(r => r.Name).Select(r => new { r.ParticipantId, r.Name, r.IslandCode }).ToListAsync(cancellationToken);
                var regionIds = regions.Select(r => r.ParticipantId).ToHashSet();

                var provinces = await _db.tOptionAdminAreaProvince.AsNoTracking()
                    .Where(p => regionIds.Contains(p.RegionParticipantId) && !p.Deprecated)
                    .OrderBy(p => p.Name).Select(p => new { p.Code, p.Name, p.RegionParticipantId }).ToListAsync(cancellationToken);
                var provinceCodes = provinces.Select(p => p.Code).ToHashSet();
                var cities = await _db.tOptionAdminAreaCityMunicipality.AsNoTracking()
                    .Where(c => provinceCodes.Contains(c.ProvinceCode) && !c.Deprecated)
                    .OrderBy(c => c.Name).Select(c => new { c.Code, c.Name, c.ProvinceCode }).ToListAsync(cancellationToken);
                var districts = await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking()
                    .Where(d => provinceCodes.Contains(d.ProvinceCode) && !d.Deprecated)
                    .OrderBy(d => d.Name).Select(d => new { d.Code, d.Name, d.ProvinceCode }).ToListAsync(cancellationToken);
                var deos = await _db.vAdminDEO.AsNoTracking()
                    .Where(d => d.RegionParticipantId != null && regionIds.Contains(d.RegionParticipantId))
                    .OrderBy(d => d.Name).Select(d => new { d.ParticipantId, d.Name, d.RegionParticipantId }).ToListAsync(cancellationToken);
                var implementingOffices = portfolio.Kind == EnumPortfolioKind.UDIP
                    ? await _db.vAdminPMOCluster.AsNoTracking().Where(c => c.ParticipantId == portfolio.OwnerParticipantId)
                        .Select(c => new { c.ParticipantId, c.Name, RegionParticipantId = (string?)null }).ToListAsync(cancellationToken)
                    : await _db.vAdminImplementingOffice.AsNoTracking()
                        .Where(o => o.RegionParticipantId != null && regionIds.Contains(o.RegionParticipantId))
                        .OrderBy(o => o.Name).Select(o => new { o.ParticipantId, o.Name, o.RegionParticipantId }).ToListAsync(cancellationToken);

                return Ok(new
                {
                    Portfolio = (await PortfolioRowsAsync(new List<MultiYearPortfolio> { portfolio }, cancellationToken)).Single(),
                    HorizonTypes = await _db.tOptionMultiYearType.AsNoTracking().OrderBy(t => t.Years == null).ThenBy(t => t.Years).ToListAsync(cancellationToken),
                    Categories = await _db.tOptionProjectCategory.AsNoTracking().OrderBy(c => c.CategoryName)
                        .Select(c => new { c.CategoryId, c.CategoryName, c.IsActive, c.ValidUntil }).ToListAsync(cancellationToken),
                    Thrusts = await _db.tOptionProjectThrustList.AsNoTracking().OrderBy(t => t.ThrustDescription)
                        .Select(t => new { t.PAPKey, t.ThrustDescription, t.IsActive, t.ValidFromDate, t.ValidToDate }).ToListAsync(cancellationToken),
                    CategoryThrustMap = await _db.tOptionProjectCategoryToPAPMap.AsNoTracking().Select(m => new { m.CategoryId, m.PAPKey }).ToListAsync(cancellationToken),
                    Regions = regions,
                    Provinces = provinces,
                    Cities = cities,
                    LegislativeDistricts = districts,
                    DEOs = deos,
                    ImplementingOffices = implementingOffices,
                    RegionWides = await _db.tOptionRegionWide.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                    Tiers = await _db.tOptionProjectTier.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                    InfraTypes = await _db.tOptionInfraType.AsNoTracking().OrderBy(x => x.InfraName)
                        .Select(x => new { x.InfraCode, x.InfraName, x.IsActive }).ToListAsync(cancellationToken),
                    ScopesOfWork = await _db.tOptionScopeOfWork.AsNoTracking().OrderBy(x => x.Description)
                        .Select(x => new { x.Enum, x.Description, x.Measure, x.InfraType, x.IsActive }).ToListAsync(cancellationToken),
                    BasisForImplementation = await _db.tOptionBasisForImplementation.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                    NedaProjectStatus = await _db.tOptionNedaProjectStatus.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                    ReadinessLevels = await _db.tOptionReadinessLevel.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                    RdpOutcomes = await _db.tOptionRdpOutcome.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                    RdpOutputs = await _db.tOptionRdpOutput.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken),
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Add, read and edit a planning project

        /// <summary>
        /// Adds a planning project to an open RDIP or UDIP (MY-PFL-16): one lasting record with an MY
        /// id (MY-PRJ-01, -04), one Civil Works component with one major item, its planned yearly costs
        /// in the shared stream marked Planned (MY-PRJ-11), and the owner membership, status new
        /// (MY-PFL-10, -11). Planned years past the horizon save with a warning (MY-PRJ-26).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> AddPlanningProject([FromBody] AddPlanningProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (portfolio, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;

                var (added, addRefusal) = await AddPlanningProjectCoreAsync(dto, portfolio!, $"Added to {await PortfolioNameAsync(portfolio!, cancellationToken)}.", cancellationToken);
                if (addRefusal != null) return addRefusal;

                return Ok(new
                {
                    MultiYearProjectId = added!.Project.Id,
                    added.Project.ProjectId,
                    MemberId = added.Member.Id,
                    added.Warnings,
                    Message = $"Planning project {added.Project.ProjectId} added.",
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        private sealed record AddedPlanningProject(MultiYearProject Project, MultiYearPortfolioMember Member, IReadOnlyList<string> Warnings);

        /// <summary>
        /// Everything Add Planning Project does once the portfolio is loaded for a write, in its own
        /// transaction: shared by the Add form and the import (MY-PFL-16, -17), so an imported row
        /// passes exactly the same checks. <paramref name="addedReason"/> is the first status-log line.
        /// </summary>
        private async Task<(AddedPlanningProject? Added, IActionResult? Refusal)> AddPlanningProjectCoreAsync(
            AddPlanningProjectDTO dto, MultiYearPortfolio portfolio, string addedReason, CancellationToken cancellationToken)
        {
            if (portfolio.Kind == EnumPortfolioKind.PIP)
                return (null, Refused("Not Allowed", "Projects are added to an RDIP or UDIP. They enter the PIP from there, through Add to PIP."));
            if (dto.StartYear < portfolio.TermStartYear)
                return (null, Refused("Invalid Start Year", $"A new planning project in {PortfolioTermRules.TermLabel(portfolio.TermStartYear)} starts in {portfolio.TermStartYear} or later."));

            var (planned, fieldsRefusal) = await ValidatePlanningFieldsAsync(dto, portfolio, existing: null, cancellationToken);
            if (fieldsRefusal != null) return (null, fieldsRefusal);
            var (membership, membershipRefusal) = await ValidateMembershipFieldsAsync(dto.Membership ?? new(), previous: null, dto.StartYear, cancellationToken);
            if (membershipRefusal != null) return (null, membershipRefusal);

            var now = Functions.CurrentDate();
            decimal total = planned!.Years.Sum(y => y.Amount);
            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

            string projectId;
            try
            {
                projectId = await _db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
                {
                    CategoryId = dto.Category,
                    StageName = portfolio.Kind.ToString(), // "RDIP" / "UDIP": the MY prefix
                    IslandCode = planned.IslandCode,
                    YearStart = dto.StartYear,
                }, cancellationToken);
            }
            catch (ProjectHelper.ProjectIdRangeExhaustedException ex)
            {
                return (null, Refused("Project ID Unavailable", ex.Message));
            }
            catch (ProjectHelper.ProjectIdCollisionException ex)
            {
                return (null, Refused("Project ID Unavailable", ex.Message));
            }

            var project = new MultiYearProject
            {
                ProjectId = projectId,
                CreatedBy = _Session.UserId,
                CreatedDate = now,
                OriginalCost = total, // set once, never again (MY-PRJ-07)
            };
            ApplyProjectFields(project, dto, planned, total);
            _db.tMultiYearProject.Add(project);
            await _db.SaveChangesAsync(cancellationToken);

            var component = new MultiYearComponent
            {
                MultiYearProjectFK = project.Id,
                ComponentId = CivilWorksComponentId,
                ComponentType = CivilWorksComponentType,
                CreatedBy = _Session.UserId,
                CreatedDate = now,
            };
            ApplyComponentFields(component, dto.Component, planned);
            _db.tMultiYearComponent.Add(component);
            await _db.SaveChangesAsync(cancellationToken);

            _db.tMultiYearComponentCostPerYear.AddRange(planned.Years.Select(y => new MultiYearComponentCostPerYear
            {
                MultiYearComponentFK = component.Id,
                Year = y.Year,
                Amount = y.Amount,
                Status = EnumCostStreamStatus.Planned,
                CreatedBy = _Session.UserId,
                CreatedDate = now,
            }));

            var member = new MultiYearPortfolioMember
            {
                PortfolioFK = portfolio.Id,
                MultiYearProjectFK = project.Id,
                IsOwner = true,
                Status = EnumMembershipStatus.New,
                StartYear = dto.StartYear,
                Cost = total,
                CreatedBy = _Session.UserId,
                CreatedDate = now,
            };
            ApplyMembershipFields(member, membership!);
            _db.tMultiYearPortfolioMember.Add(member);
            await _db.SaveChangesAsync(cancellationToken);

            _db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
            {
                MemberFK = member.Id,
                FromStatus = null,
                ToStatus = EnumMembershipStatus.New,
                ToStartYear = dto.StartYear,
                ToCost = total,
                Reason = addedReason,
                ChangedBy = _Session.UserId,
                ChangedDate = now,
            });
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return (new AddedPlanningProject(project, member, planned.Warnings), null);
        }

        /// <summary>
        /// One multi-year project: its record, component, yearly costs (each year marked Planned until
        /// year locking; MY-PRJ-12), every membership the caller can see with its history, and (Phase 2)
        /// its entries in the annual programs -- the proposals made from here and every annual project
        /// carrying its MY id as Multi Year ID (MY-PRJ-02, -03). A caller who sees none of its
        /// portfolios is refused.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> MultiYearProjectDetails([FromBody] MultiYearProjectDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                string projectId = (dto.ProjectId ?? string.Empty).Trim();
                var project = await _db.tMultiYearProject.AsNoTracking().FirstOrDefaultAsync(p => p.ProjectId == projectId, cancellationToken);
                if (project == null)
                    return Refused("Project Not Found", ProjectNotFoundMessage);

                var visibility = await VisibilityAsync(cancellationToken);
                var memberships = await (
                        from m in _db.tMultiYearPortfolioMember.AsNoTracking()
                        join p in _db.tMultiYearPortfolio.AsNoTracking() on m.PortfolioFK equals p.Id
                        where m.MultiYearProjectFK == project.Id
                        select new { Member = m, Portfolio = p })
                    .ToListAsync(cancellationToken);
                memberships = memberships.Where(x => visibility.CanSee(x.Portfolio.Kind, x.Portfolio.OwnerParticipantId)).ToList();
                if (memberships.Count == 0)
                    return Denied("this multi-year project");

                var components = await _db.tMultiYearComponent.AsNoTracking().Where(c => c.MultiYearProjectFK == project.Id).OrderBy(c => c.ComponentId).ToListAsync(cancellationToken);
                var componentIds = components.Select(c => c.Id).ToList();
                var years = await _db.tMultiYearComponentCostPerYear.AsNoTracking()
                    .Where(y => componentIds.Contains(y.MultiYearComponentFK) && y.Status != EnumCostStreamStatus.Superseded)
                    .OrderBy(y => y.Year)
                    .ToListAsync(cancellationToken);
                var infra = components.Select(c => c.InfraTypeFK).Where(x => x != null).ToList();
                var work = components.Select(c => c.WorkTypeFK).Where(x => x != null).ToList();
                var infraNames = await _db.tOptionInfraType.AsNoTracking().Where(i => infra.Contains(i.InfraCode)).ToDictionaryAsync(i => i.InfraCode, i => i.InfraName, cancellationToken);
                var workNames = await _db.tOptionScopeOfWork.AsNoTracking().Where(s => work.Contains(s.Enum)).ToDictionaryAsync(s => s.Enum, s => s.Description, cancellationToken);

                var memberIds = memberships.Select(x => x.Member.Id).ToList();
                var logs = await _db.tMultiYearMemberStatusLog.AsNoTracking().Where(l => memberIds.Contains(l.MemberFK)).OrderByDescending(l => l.Id).ToListAsync(cancellationToken);

                // The record is edited through its owner membership in an open term (MY-PFL-10).
                var editableOwner = memberships
                    .Where(x => x.Member.IsOwner && x.Portfolio.Status == EnumPortfolioStatus.Open && !MembershipStatusRules.IsLocked(x.Member.Status))
                    .OrderByDescending(x => x.Portfolio.TermStartYear)
                    .FirstOrDefault();

                var sourceIds = memberships.Where(x => x.Member.SourcePortfolioFK != null).Select(x => x.Member.SourcePortfolioFK!.Value).Distinct().ToList();
                var sources = await _db.tMultiYearPortfolio.AsNoTracking().Where(p => sourceIds.Contains(p.Id)).ToListAsync(cancellationToken);

                var membershipRows = new List<object>();
                foreach (var x in memberships.OrderByDescending(x => x.Portfolio.TermStartYear).ThenBy(x => x.Portfolio.Kind))
                {
                    bool open = x.Portfolio.Status == EnumPortfolioStatus.Open;
                    var source = sources.FirstOrDefault(p => p.Id == x.Member.SourcePortfolioFK);
                    membershipRows.Add(new
                    {
                        MemberId = x.Member.Id,
                        PortfolioId = x.Portfolio.Id,
                        PortfolioName = await PortfolioNameAsync(x.Portfolio, cancellationToken),
                        SourcePortfolioName = source == null ? null : await PortfolioNameAsync(source, cancellationToken),
                        x.Portfolio.Kind,
                        PortfolioStatus = x.Portfolio.Status,
                        x.Member.IsOwner,
                        x.Member.Status,
                        x.Member.StartYear,
                        x.Member.Cost,
                        x.Member.OriginalCost,
                        BasisForImplementationId = x.Member.BasisForImplementationFK,
                        NedaProjectStatusId = x.Member.NedaProjectStatusFK,
                        ReadinessLevelIds = ReadIds(x.Member.ReadinessLevelIds),
                        RdpOutcomes = ReadRdp(x.Member.RdpOutcomes),
                        x.Member.Tier,
                        x.Member.McaScore,
                        CanEdit = open && !MembershipStatusRules.IsLocked(x.Member.Status),
                        CanEditStartYear = open && !x.Member.IsOwner && MembershipStatusRules.CanEditStartYear(x.Member.Status),
                        AllowedStatuses = open ? MembershipStatusRules.ManualTargets(x.Member.Status) : new List<EnumMembershipStatus>(),
                        CanPropose = open && ProposalRules.MembershipRefusal(x.Portfolio.Kind, x.Member.Status) == null,
                        CanSetPipCost = open && x.Portfolio.Kind == EnumPortfolioKind.PIP && !MembershipStatusRules.IsLocked(x.Member.Status),
                        StatusLog = logs.Where(l => l.MemberFK == x.Member.Id)
                            .Select(l => new { l.FromStatus, l.ToStatus, l.FromStartYear, l.ToStartYear, l.FromCost, l.ToCost, l.Reason, l.ChangedBy, l.ChangedDate, BySystem = l.RunFK != null }).ToList(),
                    });
                }

                // Phase 2: where the project sits in the annual programs.
                var annual = (await AnnualEntries.LoadAsync(_db, new[] { project.ProjectId }, null, null, cancellationToken))
                    .Where(e => e.IsLatest)
                    .OrderByDescending(e => e.Year).ThenByDescending(e => e.StageHierarchy).ThenBy(e => e.ProjectId)
                    .Select(e => new
                    {
                        e.ProgramFK,
                        e.ProgramName,
                        e.Year,
                        e.StageName,
                        e.ProjectId,
                        e.Amount,
                        Approved = e.IsApprovedGaa,
                        e.Withdrawn,
                    })
                    .ToList();
                var proposals = await (from pr in _db.tMultiYearProposal.AsNoTracking()
                                       where pr.MultiYearProjectFK == project.Id
                                       orderby pr.Id descending
                                       select new
                                       {
                                           pr.ProjectId,
                                           pr.ProgramFK,
                                           pr.BudgetYear,
                                           pr.Amount,
                                           pr.ProposedBy,
                                           pr.ProposedDate,
                                           Live = _db.tProjectRevisions.Any(r => r.ProjectFK == pr.ProjectFK && !r.IsDeleted),
                                       }).ToListAsync(cancellationToken);
                var programNames = await ProgramNamesAsync(proposals.Select(p => p.ProgramFK).Append(project.OriginProgramFK ?? string.Empty).Distinct().ToList(), cancellationToken);

                var horizon = await _db.tOptionMultiYearType.AsNoTracking().FirstOrDefaultAsync(h => h.Id == project.HorizonTypeFK, cancellationToken);
                var category = await _db.tOptionProjectCategory.AsNoTracking().Where(c => c.CategoryId == project.Category).Select(c => c.CategoryName).FirstOrDefaultAsync(cancellationToken);
                var thrust = project.Thrust == null ? null : await _db.tOptionProjectThrustList.AsNoTracking().Where(t => t.PAPKey == project.Thrust).Select(t => t.ThrustDescription).FirstOrDefaultAsync(cancellationToken);

                return Ok(new
                {
                    Project = project,
                    HorizonType = horizon?.Name,
                    HorizonYears = horizon?.Years,
                    CategoryName = category,
                    ThrustName = thrust,
                    RegionName = await OwnerNameAsync(project.Region, cancellationToken),
                    Components = components.Select(c => new
                    {
                        c.Id,
                        c.ComponentId,
                        c.ComponentType,
                        c.Description,
                        c.InfraTypeFK,
                        InfraTypeName = c.InfraTypeFK != null && infraNames.TryGetValue(c.InfraTypeFK, out var i) ? i : null,
                        c.WorkTypeFK,
                        WorkTypeName = c.WorkTypeFK is int w && workNames.TryGetValue(w, out var n) ? n : null,
                        c.PhysicalTarget,
                        c.TargetUnit,
                    }).ToList(),
                    YearlyCosts = years.GroupBy(y => y.Year).Select(g => new
                    {
                        Year = g.Key,
                        Amount = g.Sum(y => y.Amount),
                        // Phase 3 adds Locked years; until then every year of the stream is Planned.
                        Status = g.Any(y => y.Status == EnumCostStreamStatus.Locked) ? "Locked" : "Planned",
                        // Left before the start year when the GAA update moved the start on: to re-plan.
                        BeforeStart = g.Key < project.StartYear,
                    }).ToList(),
                    Memberships = membershipRows,
                    AnnualPrograms = annual,
                    Proposals = proposals.Select(p => new
                    {
                        p.ProjectId,
                        ProgramName = programNames.TryGetValue(p.ProgramFK, out var name) ? name : p.ProgramFK,
                        p.BudgetYear,
                        p.Amount,
                        p.ProposedBy,
                        p.ProposedDate,
                        p.Live,
                    }).ToList(),
                    OriginProgramName = project.OriginProgramFK != null && programNames.TryGetValue(project.OriginProgramFK, out var origin) ? origin : null,
                    CanEditProject = editableOwner != null,
                    OwnerPortfolioId = editableOwner?.Portfolio.Id ?? memberships.FirstOrDefault(x => x.Member.IsOwner)?.Portfolio.Id,
                    CanEditStartYear = editableOwner != null && MembershipStatusRules.CanEditStartYear(editableOwner.Member.Status),
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// Edits a planning project through its owner membership in an open term. The original cost
        /// never changes (MY-PRJ-07). Category and region are part of the MY id, so they are fixed.
        /// The start year changes only while the owner membership is new (MY-PFL-12). A planned year
        /// taken off is marked Superseded and kept, never deleted.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> UpdatePlanningProject([FromBody] UpdatePlanningProjectDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var project = await _db.tMultiYearProject.FirstOrDefaultAsync(p => p.Id == dto.MultiYearProjectId, cancellationToken);
                if (project == null)
                    return Refused("Project Not Found", ProjectNotFoundMessage);

                var owners = await (
                        from m in _db.tMultiYearPortfolioMember
                        join p in _db.tMultiYearPortfolio.AsNoTracking() on m.PortfolioFK equals p.Id
                        where m.MultiYearProjectFK == project.Id && m.IsOwner
                        orderby p.TermStartYear descending
                        select new { Member = m, Portfolio = p })
                    .ToListAsync(cancellationToken);
                var owner = owners.FirstOrDefault();
                if (owner == null)
                    return Refused("Project Not Found", ProjectNotFoundMessage);
                if (!(await VisibilityAsync(cancellationToken)).CanSee(owner.Portfolio.Kind, owner.Portfolio.OwnerParticipantId))
                    return Denied("this multi-year project");
                if (PortfolioTermRules.WriteRefusal(owner.Portfolio.Status, owner.Portfolio.TermStartYear) is string closed)
                    return Refused("Term Closed", closed);
                if (MembershipStatusRules.IsLocked(owner.Member.Status))
                    return Refused("Project Locked", $"This project is {MembershipStatusRules.Label(owner.Member.Status)} and can no longer change.");

                if (dto.Category != project.Category)
                    return Refused("Category Locked", "The Category cannot be changed: it is part of the Project ID.");
                if (dto.StartYear != project.StartYear && !MembershipStatusRules.CanEditStartYear(owner.Member.Status))
                    return Refused("Start Year Locked", $"The Start Year can be changed only while the project is New; it is {MembershipStatusRules.Label(owner.Member.Status)}.");

                var (planned, fieldsRefusal) = await ValidatePlanningFieldsAsync(dto, owner.Portfolio, project, cancellationToken);
                if (fieldsRefusal != null) return fieldsRefusal;

                var now = Functions.CurrentDate();
                decimal total = planned!.Years.Sum(y => y.Amount);
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                ApplyProjectFields(project, dto, planned, total);
                project.UpdatedBy = _Session.UserId;
                project.UpdatedDate = now;

                var component = await _db.tMultiYearComponent.FirstOrDefaultAsync(c => c.MultiYearProjectFK == project.Id && c.ComponentId == CivilWorksComponentId, cancellationToken);
                if (component == null)
                    return Refused("Project Not Found", ProjectNotFoundMessage);
                ApplyComponentFields(component, dto.Component, planned);
                component.UpdatedBy = _Session.UserId;
                component.UpdatedDate = now;

                var current = await _db.tMultiYearComponentCostPerYear
                    .Where(y => y.MultiYearComponentFK == component.Id && y.Status != EnumCostStreamStatus.Superseded)
                    .ToListAsync(cancellationToken);
                if (current.Any(y => y.Status == EnumCostStreamStatus.Locked))
                    return Refused("Year Locked", "This project has locked years; change them through a Multi-Year Costing Changes revision.");
                var wanted = planned.Years.ToDictionary(y => y.Year, y => y.Amount);
                foreach (var row in current)
                {
                    if (wanted.TryGetValue(row.Year, out var amount))
                    {
                        if (row.Amount != amount)
                        {
                            row.Amount = amount;
                            row.UpdatedBy = _Session.UserId;
                            row.UpdatedDate = now;
                        }
                        wanted.Remove(row.Year);
                    }
                    else
                    {
                        row.Status = EnumCostStreamStatus.Superseded; // taken off: kept as history
                        row.UpdatedBy = _Session.UserId;
                        row.UpdatedDate = now;
                    }
                }
                // Superseded rows must leave the filtered unique index before a re-added year is inserted.
                await _db.SaveChangesAsync(cancellationToken);
                _db.tMultiYearComponentCostPerYear.AddRange(wanted.Select(y => new MultiYearComponentCostPerYear
                {
                    MultiYearComponentFK = component.Id,
                    Year = y.Key,
                    Amount = y.Value,
                    Status = EnumCostStreamStatus.Planned,
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                }));

                owner.Member.Cost = total;
                owner.Member.StartYear = dto.StartYear;
                owner.Member.UpdatedBy = _Session.UserId;
                owner.Member.UpdatedDate = now;

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new { project.ProjectId, planned.Warnings, Message = $"Planning project {project.ProjectId} saved." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Membership

        /// <summary>A membership's planning fields (MY-PFL-14), and its start year while new for a
        /// membership that is not the owner (MY-PFL-12).</summary>
        [HttpPost]
        public async Task<IActionResult> UpdateMembership([FromBody] UpdateMembershipDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (member, portfolio, refusal) = await LoadMemberAsync(dto.MemberId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (MembershipStatusRules.IsLocked(member!.Status))
                    return Refused("Project Locked", $"This project is {MembershipStatusRules.Label(member.Status)} in this portfolio and can no longer change.");

                int startYear = member.StartYear;
                if (dto.StartYear is int newStart && newStart != member.StartYear)
                {
                    if (member.IsOwner)
                        return Refused("Start Year Locked", "This is the project's own portfolio: change the Start Year in the project's details.");
                    if (!MembershipStatusRules.CanEditStartYear(member.Status))
                        return Refused("Start Year Locked", $"The Start Year can be changed only while the project is New; it is {MembershipStatusRules.Label(member.Status)}.");
                    if (MultiYearCostRules.YearsRefusal(newStart, null) is string yearRefusal)
                        return Refused("Invalid Start Year", yearRefusal);
                    startYear = newStart;
                }

                var (fields, fieldsRefusal) = await ValidateMembershipFieldsAsync(dto, member, startYear, cancellationToken);
                if (fieldsRefusal != null) return fieldsRefusal;

                ApplyMembershipFields(member, fields!);
                member.StartYear = startYear;
                member.UpdatedBy = _Session.UserId;
                member.UpdatedDate = Functions.CurrentDate();
                await _db.SaveChangesAsync(cancellationToken);

                return Ok(new { MemberId = member.Id, Message = $"Saved for {await PortfolioNameAsync(portfolio!, cancellationToken)}." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>A coordinator sets completed or cancelled, as the status diagram allows (MY-PFL-11, -13).</summary>
        [HttpPost]
        public async Task<IActionResult> SetMembershipStatus([FromBody] SetMembershipStatusDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (member, portfolio, refusal) = await LoadMemberAsync(dto.MemberId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (MembershipStatusRules.ManualMoveRefusal(member!.Status, dto.Status) is string moveRefusal)
                    return Refused("Status Not Allowed", moveRefusal);

                var now = Functions.CurrentDate();
                var from = member.Status;
                member.Status = dto.Status;
                member.UpdatedBy = _Session.UserId;
                member.UpdatedDate = now;
                _db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
                {
                    MemberFK = member.Id,
                    FromStatus = from,
                    ToStatus = dto.Status,
                    Reason = string.IsNullOrWhiteSpace(dto.Reason) ? null : dto.Reason.Trim(),
                    ChangedBy = _Session.UserId,
                    ChangedDate = now,
                });
                await _db.SaveChangesAsync(cancellationToken);

                return Ok(new
                {
                    MemberId = member.Id,
                    member.Status,
                    Message = $"Set to {MembershipStatusRules.Label(dto.Status)} in {await PortfolioNameAsync(portfolio!, cancellationToken)}. It can no longer be edited there.",
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Planning project fields

        private sealed record PlannedProject(
            string Region, string IslandCode, string? ImplementingOffice, string? TargetUnit,
            IReadOnlyList<MultiYearCostRules.YearAmount> Years, IReadOnlyList<string> Warnings);

        /// <summary>
        /// Every check on a planning project's own fields. <paramref name="existing"/> is null on add;
        /// on edit, values the project already has are kept even once retired.
        /// </summary>
        private async Task<(PlannedProject? Planned, IActionResult? Refusal)> ValidatePlanningFieldsAsync(
            PlanningProjectFieldsDTO dto, MultiYearPortfolio portfolio, MultiYearProject? existing, CancellationToken ct)
        {
            string description = (dto.Description ?? string.Empty).Trim();
            if (description.Length == 0)
                return (null, Refused("Description Required", "Enter the project description."));
            if (description.Length > 1000)
                return (null, Refused("Description Too Long", "Description cannot exceed 1000 characters."));

            if (MultiYearCostRules.YearsRefusal(dto.StartYear, dto.EndYear) is string yearsRefusal)
                return (null, Refused("Invalid Years", yearsRefusal));

            // #488: Category / Sub-Category validity is judged for the project's start year.
            var category = await _db.ValidateCategoryAsync(dto.Category, existing?.Category, dto.StartYear, ct);
            if (!category.IsValid)
                return (null, Refused(category.Title, category.Message));
            var thrust = await _db.ValidateThrustForCategoryAsync(dto.Category, dto.Thrust, existing?.Category, existing?.Thrust, dto.StartYear, ct);
            if (!thrust.IsValid)
                return (null, Refused(thrust.Title, thrust.Message));

            var horizon = await _db.tOptionMultiYearType.AsNoTracking().FirstOrDefaultAsync(h => h.Id == dto.HorizonTypeId, ct);
            if (horizon == null || (!horizon.IsActive && horizon.Id != existing?.HorizonTypeFK))
                return (null, Refused("Invalid Horizon", "Choose Short term, Medium term or Long term."));

            // Location. An RDIP's projects are in its region; the region is part of the MY id, so it
            // cannot change once the project exists.
            string? region = portfolio.Kind == EnumPortfolioKind.RDIP ? portfolio.OwnerParticipantId : dto.Region?.Trim();
            if (existing != null) region = existing.Region;
            if (string.IsNullOrEmpty(region))
                return (null, Refused("Region Required", "Choose the region."));
            var regionRow = await _db.tOptionAdminAreaRegion.AsNoTracking().FirstOrDefaultAsync(r => r.ParticipantId == region, ct);
            if (regionRow == null)
                return (null, Refused("Invalid Region", "The selected region is not valid."));
            if (existing != null && !string.IsNullOrWhiteSpace(dto.Region) && dto.Region.Trim() != existing.Region)
                return (null, Refused("Region Locked", "The Region cannot be changed: it is part of the Project ID."));

            if (!string.IsNullOrWhiteSpace(dto.Province)
                && !await _db.tOptionAdminAreaProvince.AsNoTracking().AnyAsync(p => p.Code == dto.Province && p.RegionParticipantId == region, ct))
                return (null, Refused("Invalid Province", "The selected province is not in the project's region."));
            if (!string.IsNullOrWhiteSpace(dto.City)
                && (string.IsNullOrWhiteSpace(dto.Province)
                    || !await _db.tOptionAdminAreaCityMunicipality.AsNoTracking().AnyAsync(c => c.Code == dto.City && c.ProvinceCode == dto.Province, ct)))
                return (null, Refused("Invalid City / Municipality", "The selected city or municipality is not in the selected province."));
            if (!string.IsNullOrWhiteSpace(dto.LegislativeDistrict)
                && (string.IsNullOrWhiteSpace(dto.Province)
                    || !await _db.tOptionAdminAreaCongressionalDistrict.AsNoTracking().AnyAsync(d => d.Code == dto.LegislativeDistrict && d.ProvinceCode == dto.Province, ct)))
                return (null, Refused("Invalid Legislative District", "The selected legislative district is not in the selected province."));
            if (!string.IsNullOrWhiteSpace(dto.DEO)
                && !await _db.vAdminDEO.AsNoTracking().AnyAsync(d => d.ParticipantId == dto.DEO && d.RegionParticipantId == region, ct))
                return (null, Refused("Invalid District Engineering Office", "The selected district engineering office is not in the project's region."));
            if (!string.IsNullOrWhiteSpace(dto.ReportingRegion)
                && !await _db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(r => r.ParticipantId == dto.ReportingRegion, ct))
                return (null, Refused("Invalid Reporting Region", "The selected reporting region is not valid."));
            if (dto.RegionWide is int regionWide
                && !await _db.tOptionRegionWide.AsNoTracking().AnyAsync(r => r.NameId == regionWide, ct))
                return (null, Refused("Invalid Region Wide", "The selected Region Wide value is not valid."));

            // A UDIP's projects are implemented by its cluster office (MY-STK-17: grouped by cluster).
            string? implementingOffice = portfolio.Kind == EnumPortfolioKind.UDIP ? portfolio.OwnerParticipantId : dto.ImplementingOffice?.Trim();
            if (portfolio.Kind == EnumPortfolioKind.RDIP && !string.IsNullOrEmpty(implementingOffice)
                && implementingOffice != existing?.ImplementingOffice
                && !await _db.vAdminImplementingOffice.AsNoTracking().AnyAsync(o => o.ParticipantId == implementingOffice && o.RegionParticipantId == region, ct))
                return (null, Refused("Invalid Implementing Office", "The selected implementing office is not in the project's region."));

            // The one Civil Works component's major item (MY-PFL-16).
            var component = dto.Component ?? new();
            string infraCode = (component.InfraTypeFK ?? string.Empty).Trim();
            var existingComponent = existing == null ? null
                : await _db.tMultiYearComponent.AsNoTracking().FirstOrDefaultAsync(c => c.MultiYearProjectFK == existing.Id && c.ComponentId == CivilWorksComponentId, ct);
            var infraRow = await _db.tOptionInfraType.AsNoTracking().FirstOrDefaultAsync(i => i.InfraCode == infraCode, ct);
            if (infraRow == null || (!infraRow.IsActive && infraCode != existingComponent?.InfraTypeFK))
                return (null, Refused("Invalid Infrastructure Type", "Choose the infrastructure type of the major item of work."));
            var scope = await _db.tOptionScopeOfWork.AsNoTracking().FirstOrDefaultAsync(s => s.Enum == component.WorkTypeFK, ct);
            if (scope == null || (!scope.IsActive && component.WorkTypeFK != existingComponent?.WorkTypeFK))
                return (null, Refused("Invalid Work Type", "Choose the dominant type of work of the major item."));
            if (scope.InfraType.Length > 0 && !scope.InfraType.Contains(infraCode, StringComparer.OrdinalIgnoreCase))
                return (null, Refused("Invalid Work Type", $"'{scope.Description}' is not a type of work for {infraRow.InfraName}."));
            if (component.PhysicalTarget is double target && (target < 0 || double.IsNaN(target) || double.IsInfinity(target)))
                return (null, Refused("Invalid Physical Target", "The physical target cannot be negative."));
            if ((component.Description ?? string.Empty).Trim().Length > 1000)
                return (null, Refused("Component Description Too Long", "Component description cannot exceed 1000 characters."));

            var years = (dto.YearlyCosts ?? new()).Select(y => new MultiYearCostRules.YearAmount(y.Year, Math.Round(y.Amount, 2))).ToList();
            var costs = MultiYearCostRules.Check(dto.StartYear, dto.EndYear, horizon.Years, horizon.Name, years);
            if (!costs.IsValid)
                return (null, Refused("Invalid Planned Cost", string.Join(" ", costs.Errors)));

            return (new PlannedProject(region, regionRow.IslandCode, string.IsNullOrEmpty(implementingOffice) ? null : implementingOffice, scope.Measure, years, costs.Warnings), null);
        }

        private static void ApplyProjectFields(MultiYearProject project, PlanningProjectFieldsDTO dto, PlannedProject planned, decimal total)
        {
            project.Description = dto.Description.Trim();
            project.Category = dto.Category;
            project.Thrust = dto.Thrust is int t && t != 0 ? t : null;
            project.Region = planned.Region;
            project.IslandCode = planned.IslandCode;
            project.Province = Blank(dto.Province);
            project.City = Blank(dto.City);
            project.LegislativeDistrict = Blank(dto.LegislativeDistrict);
            project.DEO = Blank(dto.DEO);
            project.ImplementingOffice = planned.ImplementingOffice;
            project.ReportingRegion = Blank(dto.ReportingRegion);
            project.RegionWide = dto.RegionWide;
            project.HorizonTypeFK = dto.HorizonTypeId;
            project.StartYear = dto.StartYear;
            project.EndYear = dto.EndYear;
            project.CurrentCost = total;
        }

        private static void ApplyComponentFields(MultiYearComponent component, PlanningComponentDTO dto, PlannedProject planned)
        {
            component.Description = Blank(dto.Description);
            component.InfraTypeFK = dto.InfraTypeFK.Trim();
            component.WorkTypeFK = dto.WorkTypeFK;
            component.PhysicalTarget = dto.PhysicalTarget;
            component.TargetUnit = planned.TargetUnit;
        }

        private static void ApplyMembershipFields(MultiYearPortfolioMember member, MembershipFields fields)
        {
            member.BasisForImplementationFK = fields.BasisFK;
            member.NedaProjectStatusFK = fields.NedaFK;
            member.ReadinessLevelIds = fields.ReadinessJson;
            member.RdpOutcomes = fields.RdpJson;
            member.Tier = fields.Tier;
            member.McaScore = fields.McaScore;
        }

        private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        #endregion
    }
}
