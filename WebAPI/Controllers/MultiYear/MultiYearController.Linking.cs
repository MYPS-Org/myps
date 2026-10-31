using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using DBHelper.Models.Table.Project;
using DBHelper.Models.Views.Program;
using Helpers;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.MultiYear
{
    /// <summary>
    /// Phase 2: a planning project meets the annual programs -- Propose to RBP / UBP (MY-PFL-20,
    /// MY-STK-02, MY-PRJ-02/03) -- and PIP gains its members -- Add to PIP and the PIP cost
    /// (MY-PFL-10, -18, -19). documents/plans/multi-year-phase-2-annual-program-linking.md.
    /// </summary>
    public partial class MultiYearController
    {
        private const string RbpStageName = "RBP";
        private const string CivilWorksComponentCode = "CW";

        #region Propose to RBP / UBP

        /// <summary>
        /// What the Propose dialog offers for one RDIP / UDIP membership: the RBP-stage programs it may
        /// go into (current stage RBP, not approved, its Data Security includes the portfolio's owner,
        /// visible to the caller, a year from the membership's start year on), with that year's planned
        /// cost; the annual-project lookups the planning project does not hold; and, when the project
        /// lacks a location field an annual project needs, which ones.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> InitProposeForm([FromBody] MemberIdDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (member, portfolio, refusal) = await LoadMemberAsync(dto.MemberId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (ProposalRules.MembershipRefusal(portfolio!.Kind, member!.Status) is string cannot)
                    return Refused("Cannot Propose", cannot);

                var project = await _db.tMultiYearProject.AsNoTracking().FirstAsync(p => p.Id == member.MultiYearProjectFK, cancellationToken);
                var planned = await PlannedByYearAsync(project.Id, cancellationToken);
                var proposedYears = await LiveProposalYearsAsync(project.Id, cancellationToken);
                var programs = await ProposablePrograms(portfolio, member.StartYear, cancellationToken);

                var operatingUnits = await _db.vAdminOperatingUnit.AsNoTracking()
                    .Where(o => o.RegionParticipantId == project.Region || o.RegionParticipantId == null || o.RegionParticipantId == "")
                    .OrderBy(o => o.Name).Select(o => new { o.ParticipantId, o.Name }).ToListAsync(cancellationToken);

                return Ok(new
                {
                    MemberId = member.Id,
                    project.ProjectId,
                    project.Description,
                    PortfolioName = await PortfolioNameAsync(portfolio, cancellationToken),
                    member.Status,
                    member.StartYear,
                    member.Tier,
                    MissingFields = MissingForAnnualProject(project),
                    Programs = programs.Select(p => new
                    {
                        p.ProgramPK,
                        p.Name,
                        p.StartYear,
                        PlannedAmount = planned.TryGetValue(p.StartYear, out var amount) ? amount : (decimal?)null,
                        AlreadyProposed = proposedYears.Contains(p.StartYear),
                    }).ToList(),
                    OperatingUnits = operatingUnits,
                    Origins = await _db.tOptionProjectOrigin.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    Agencies = await _db.tOptionProjectAgency.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    ImplementationModes = await _db.tOptionProjectImplementationMode.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    EmergencyModes = await _db.tOptionProjectEmergencyMode.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    RowAvailables = await _db.tOptionProjectRowAvailable.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    Feasibilities = await _db.tOptionProjectFeasibilityStudy.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    DetailedDesigns = await _db.tOptionProjectDetailedDesign.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                    Tiers = await _db.tOptionProjectTier.AsNoTracking().Where(x => x.IsActive != false).OrderBy(x => x.Name).Select(x => new { x.NameId, x.Name }).ToListAsync(cancellationToken),
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// Proposes a planning project into an RBP / UBP (MY-PFL-20). In one transaction, as Add
        /// Project and Create Lump Sum write a project: a BP-numbered annual project for the program's
        /// year (GenerateProjectID) carrying the MY id as its Multi Year ID, its header from the
        /// planning project and the dialog, component CW1 Civil Works holding that year's planned cost
        /// with one cost-per-year row and one major item, and the program cost recomputed. No funding
        /// line: the coordinator completes Funding and locations in Programs. A New membership becomes
        /// Potential; an Ongoing one stays Ongoing (its next year).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ProposeToAnnualProgram([FromBody] ProposeToAnnualProgramDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (member, portfolio, refusal) = await LoadMemberAsync(dto.MemberId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (ProposalRules.MembershipRefusal(portfolio!.Kind, member!.Status) is string cannot)
                    return Refused("Cannot Propose", cannot);

                var project = await _db.tMultiYearProject.AsNoTracking().FirstAsync(p => p.Id == member.MultiYearProjectFK, cancellationToken);
                var missing = MissingForAnnualProject(project);
                if (missing.Count > 0)
                    return Refused("Project Details Incomplete", $"An annual project needs the {JoinLabels(missing)}. Add {(missing.Count == 1 ? "it" : "them")} on this project's page (Edit Project) first.");

                // The program: the current stage RBP, not approved, its Data Security the portfolio's owner.
                var latest = await _db.vProgramLatest.AsNoTracking().FirstOrDefaultAsync(p => p.ProgramPK == dto.ProgramPK, cancellationToken);
                if (latest == null || !await _db.tPrograms.AsNoTracking().AnyAsync(p => p.ProgramPK == dto.ProgramPK && !p.IsDeleted, cancellationToken))
                    return Refused("Program Not Found", "The selected program could not be found. Reload the dialog and choose it again.");
                if (latest.StageId != EnumProgramStage.RBP)
                    return Refused("Not an RBP", $"{latest.Name} is at the {latest.StageName} stage. A project is proposed into an RBP or UBP program.");
                if (ProgramHelper.IsApprovedStatus(latest.Status))
                    return Refused("Program Approved", $"{latest.Name} is Approved and takes no new projects.");
                var upmoOffices = await _db.vAdminUPMO.AsNoTracking().Select(u => u.ParticipantId).ToListAsync(cancellationToken);
                if (!ProposalRules.ProgramFitsOwner(portfolio.Kind, portfolio.OwnerParticipantId, latest.DataSecurityGroup, upmoOffices))
                    return Refused("Wrong Program", $"{latest.Name} is not an RBP of {await OwnerNameAsync(portfolio.OwnerParticipantId, cancellationToken)}. Choose its {(portfolio.Kind == EnumPortfolioKind.UDIP ? "UBP" : "RBP")}.");

                var program = await _db.ValidateProgramId(new ProgramHelperParams
                {
                    ProgramId = dto.ProgramPK,
                    StageName = RbpStageName,
                    _Session = _Session,
                }, cancellationToken);
                if (!program.IsValid)
                    return Refused(program.Title, program.Message);
                var programParent = program.Data.Program;
                var programRevision = program.Data.ProgramRevision;
                var programStage = program.Data.ProgramStage;
                int budgetYear = programParent.StartYear;

                var planned = await PlannedByYearAsync(project.Id, cancellationToken);
                var proposedYears = await LiveProposalYearsAsync(project.Id, cancellationToken);
                if (ProposalRules.YearRefusal(budgetYear, member.StartYear, planned.TryGetValue(budgetYear, out var plannedAmount) ? plannedAmount : null, proposedYears, latest.Name) is string yearRefusal)
                    return Refused("Cannot Propose", yearRefusal);
                decimal amount = plannedAmount;

                // The annual header, exactly as Add Project checks it (#488: judged for the program's year).
                var lookups = await _db.ValidateProjectDetailsLookups(new ProjectHelper.ValidateProjectDetailsLookupsParams
                {
                    _Session = _Session,
                    Tier = dto.Tier,
                    Category = project.Category,
                    Thrust = project.Thrust,
                    Region = project.Region!,
                    Province = project.Province!,
                    City = project.City!,
                    LegislativeDistrict = project.LegislativeDistrict!,
                    DEO = project.DEO!,
                    ImplementingOffice = project.ImplementingOffice!,
                    OperatingUnit = (dto.OperatingUnit ?? string.Empty).Trim(),
                    Origin = dto.Origin,
                    Agency = dto.Agency,
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = dto.EmergencyMode,
                    RowAvailable = dto.RowAvailable,
                    Feasibility = dto.Feasibility,
                    FeasibilityDate = dto.FeasibilityDate,
                    DetailedDesign = dto.DetailedDesign,
                    DetailedDesignDate = dto.DetailedDesignDate,
                    ProgramYear = budgetYear,
                }, cancellationToken);
                if (!lookups.IsValid)
                    return Refused(lookups.Title, lookups.Message);
                if (!await _db.tOptionAdminAreaRegion.AsNoTracking().AnyAsync(r => r.IslandCode == project.IslandCode, cancellationToken))
                    return Refused("Invalid Island Code", $"Island Code '{project.IslandCode}' is not valid.");

                // The major item: its infrastructure type and type of work must still be selectable.
                var component = await _db.tMultiYearComponent.AsNoTracking()
                    .FirstOrDefaultAsync(c => c.MultiYearProjectFK == project.Id && c.ComponentId == CivilWorksComponentId, cancellationToken);
                if (component == null || string.IsNullOrWhiteSpace(component.InfraTypeFK) || component.WorkTypeFK is not int workType)
                    return Refused("Project Details Incomplete", "This project has no Civil Works major item. Add its infrastructure type and type of work on the project page first.");
                if (!await _db.tOptionInfraType.AsNoTracking().AnyAsync(i => i.InfraCode == component.InfraTypeFK && i.IsActive, cancellationToken)
                    || !await _db.tOptionScopeOfWork.AsNoTracking().AnyAsync(s => s.Enum == workType && s.IsActive, cancellationToken))
                    return Refused("Retired Major Item", "The project's infrastructure type or type of work has been retired. Choose a current one on the project page first.");
                string componentName = await _db.tOptionProjectComponentType.AsNoTracking()
                    .Where(t => t.ComponentId == CivilWorksComponentCode)
                    .Select(t => t.ComponentName)
                    .FirstOrDefaultAsync(cancellationToken) ?? CivilWorksComponentType;

                var now = Functions.CurrentDate();
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

                string bpId;
                try
                {
                    bpId = await _db.GenerateProjectID(new ProjectHelper.GenerateProjectIDParams
                    {
                        CategoryId = project.Category,
                        StageName = RbpStageName, // the BP prefix
                        IslandCode = project.IslandCode,
                        YearStart = budgetYear,
                    }, cancellationToken);
                }
                catch (ProjectHelper.ProjectIdRangeExhaustedException ex)
                {
                    return Refused("Project ID Range Exhausted", ex.Message);
                }
                catch (ProjectHelper.ProjectIdCollisionException ex)
                {
                    return Refused("Project ID Collision Detected", ex.Message);
                }

                _db.tProjects.Add(new DBHelper.Models.Table.Project.Projects
                {
                    ProgramFK = programParent.ProgramPK,
                    ProjectPK = bpId,
                    ProgramId = programRevision.ProgramId,
                    MYId = project.ProjectId, // the link back to the planning project (MY-PRJ-03)
                    ProjectType = project.IslandCode, // as the Add Project form sets it
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                });
                await _db.SaveChangesAsync(cancellationToken);

                var revision = new ProjectRevisions
                {
                    ProjectFK = bpId,
                    ProgramFK = programParent.ProgramPK,
                    ProgramId = programRevision.ProgramId,
                    ProjectId = bpId,
                    Description = project.Description,
                    Region = project.Region,
                    Province = project.Province,
                    City = project.City,
                    LegislativeDistrict = project.LegislativeDistrict,
                    DEO = project.DEO,
                    OperatingUnit = dto.OperatingUnit.Trim(),
                    ImplementingOffice = project.ImplementingOffice,
                    IslandCode = project.IslandCode,
                    Category = project.Category,
                    Thrust = project.Thrust,
                    Origin = dto.Origin,
                    Agency = dto.Agency,
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = dto.EmergencyMode,
                    RegionWide = project.RegionWide!.Value,
                    Feasibility = dto.Feasibility,
                    FeasibilityDate = dto.FeasibilityDate,
                    DetailedDesign = dto.DetailedDesign,
                    DetailedDesignDate = dto.DetailedDesignDate,
                    RowAvailable = dto.RowAvailable,
                    Tier = dto.Tier,
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                };
                _db.tProjectRevisions.Add(revision);
                await _db.SaveChangesAsync(cancellationToken);

                _db.tProjectStages.Add(new ProjectStages
                {
                    ProjectFK = bpId,
                    ProgramFK = programParent.ProgramPK,
                    ProgramId = programRevision.ProgramId,
                    RevisionId = revision.Id,
                    StageId = programStage.StageId,
                    StageName = programStage.StageName,
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                });
                var annualComponent = new ProjectComponentCost
                {
                    ProjectRevisionFK = revision.Id,
                    ComponentType = componentName,
                    ComponentId = CivilWorksComponentId,
                    Description = component.Description,
                    Total = amount,
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                };
                _db.tProjectComponentCost.Add(annualComponent);
                await _db.SaveChangesAsync(cancellationToken);

                _db.tProjectComponentCostPerYear.Add(new ProjectComponentCostPerYear
                {
                    ComponentCostFK = annualComponent.Id,
                    ComponentId = CivilWorksComponentId,
                    Year = budgetYear,
                    Amount = amount,
                    StartDate = new DateTime(budgetYear, 1, 1),
                    EndDate = new DateTime(budgetYear, 12, 31),
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                });
                _db.tProjectMajorWorkItem.Add(new ProjectMajorWorkItem
                {
                    ComponentCostFK = annualComponent.Id,
                    ComponentId = CivilWorksComponentId,
                    YearOfWork = budgetYear,
                    WorkTypeFK = workType,
                    InfraTypeFK = component.InfraTypeFK!,
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                });
                await _db.SaveChangesAsync(cancellationToken);
                await _db.RecomputeProgramCostAsync(programParent.ProgramPK, cancellationToken);

                var proposal = new MultiYearProposal
                {
                    MultiYearProjectFK = project.Id,
                    MemberFK = member.Id,
                    ProgramFK = programParent.ProgramPK,
                    ProjectFK = bpId,
                    ProjectId = bpId,
                    BudgetYear = budgetYear,
                    Amount = amount,
                    ProposedBy = _Session.UserId,
                    ProposedDate = now,
                };
                _db.tMultiYearProposal.Add(proposal);
                await _db.SaveChangesAsync(cancellationToken);

                var from = member.Status;
                var to = ProposalRules.StatusAfter(from);
                member.Status = to;
                member.UpdatedBy = _Session.UserId;
                member.UpdatedDate = now;
                _db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
                {
                    MemberFK = member.Id,
                    FromStatus = from,
                    ToStatus = to,
                    Reason = from == to
                        ? $"Proposed for its next year to {latest.Name} as {bpId} ({budgetYear})."
                        : $"Proposed to {latest.Name} as {bpId} ({budgetYear}).",
                    ProposalFK = proposal.Id,
                    ChangedBy = _Session.UserId,
                    ChangedDate = now,
                });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    ProjectId = bpId,
                    ProgramPK = programParent.ProgramPK,
                    ProgramName = latest.Name,
                    member.Status,
                    Message = $"Proposed to {latest.Name} as {bpId} with the {budgetYear} planned cost of {amount:N2}. Open it in Programs to add its Funding and locations.",
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>The RBP-stage programs a membership of <paramref name="portfolio"/> may be proposed into.</summary>
        private async Task<List<ProgramLatest>> ProposablePrograms(MultiYearPortfolio portfolio, int fromYear, CancellationToken ct)
        {
            var upmoOffices = await _db.vAdminUPMO.AsNoTracking().Select(u => u.ParticipantId).ToListAsync(ct);
            var rbps = await (from l in _db.vProgramLatest.AsNoTracking()
                              join p in _db.tPrograms.AsNoTracking() on l.ProgramPK equals p.ProgramPK
                              where l.StageId == EnumProgramStage.RBP && !p.IsDeleted && l.StartYear >= fromYear
                              select l).ToListAsync(ct);
            return rbps
                .Where(l => !ProgramHelper.IsApprovedStatus(l.Status)
                            && ProposalRules.ProgramFitsOwner(portfolio.Kind, portfolio.OwnerParticipantId, l.DataSecurityGroup, upmoOffices)
                            && _Session.CanAccessProgram(l.DataSecurityGroup))
                .OrderBy(l => l.StartYear).ThenBy(l => l.Name)
                .ToList();
        }

        /// <summary>The location fields an annual project needs (Add Project's checks) that this planning project lacks.</summary>
        private static List<string> MissingForAnnualProject(MultiYearProject project)
        {
            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(project.Province)) missing.Add("Province");
            if (string.IsNullOrWhiteSpace(project.City)) missing.Add("City / Municipality");
            if (string.IsNullOrWhiteSpace(project.LegislativeDistrict)) missing.Add("Legislative District");
            if (string.IsNullOrWhiteSpace(project.DEO)) missing.Add("District Engineering Office");
            if (string.IsNullOrWhiteSpace(project.ImplementingOffice)) missing.Add("Implementing Office");
            if (project.RegionWide == null) missing.Add("Region Wide");
            return missing;
        }

        private static string JoinLabels(IReadOnlyList<string> labels) =>
            labels.Count == 1 ? labels[0] : $"{string.Join(", ", labels.Take(labels.Count - 1))} and {labels[^1]}";

        /// <summary>The project's planned (current) cost per year, all components; Superseded never counts.</summary>
        private async Task<Dictionary<int, decimal>> PlannedByYearAsync(int multiYearProjectId, CancellationToken ct) =>
            (await (from c in _db.tMultiYearComponent.AsNoTracking()
                    join y in _db.tMultiYearComponentCostPerYear.AsNoTracking() on c.Id equals y.MultiYearComponentFK
                    where c.MultiYearProjectFK == multiYearProjectId && y.Status != EnumCostStreamStatus.Superseded
                    select new { y.Year, y.Amount }).ToListAsync(ct))
            .GroupBy(x => x.Year)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        /// <summary>The budget years the project has a live proposal for: its annual project not deleted.</summary>
        private async Task<List<int>> LiveProposalYearsAsync(int multiYearProjectId, CancellationToken ct) =>
            await (from p in _db.tMultiYearProposal.AsNoTracking()
                   where p.MultiYearProjectFK == multiYearProjectId
                         && _db.tProjectRevisions.Any(r => r.ProjectFK == p.ProjectFK && !r.IsDeleted)
                   select p.BudgetYear).Distinct().ToListAsync(ct);

        #endregion

        #region PIP

        /// <summary>
        /// The RDIP / UDIP projects a PPC may add to this PIP (MY-PFL-18): New or Potential, in an open
        /// term, starting by the PIP term's end, not yet in it. Listed for holders of the Add to PIP
        /// grant whatever RDIP / UDIP they see, since PIP is chosen from every region and cluster.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ShowPipCandidates([FromBody] ShowPipCandidatesDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (pip, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (pip!.Kind != EnumPortfolioKind.PIP)
                    return Refused("Not a PIP", "Projects are added to PIP from a PIP portfolio.");

                int termEnd = PortfolioTermRules.TermEnd(pip.TermStartYear);
                var inPip = _db.tMultiYearPortfolioMember.Where(m => m.PortfolioFK == pip.Id).Select(m => m.MultiYearProjectFK);
                string search = (dto.Search ?? string.Empty).Trim();
                var query = from m in _db.tMultiYearPortfolioMember.AsNoTracking()
                            join p in _db.tMultiYearPortfolio.AsNoTracking() on m.PortfolioFK equals p.Id
                            join pr in _db.tMultiYearProject.AsNoTracking() on m.MultiYearProjectFK equals pr.Id
                            where p.Kind != EnumPortfolioKind.PIP && p.Status == EnumPortfolioStatus.Open
                                  && (m.Status == EnumMembershipStatus.New || m.Status == EnumMembershipStatus.Potential)
                                  && m.StartYear <= termEnd
                                  && !inPip.Contains(m.MultiYearProjectFK)
                            select new { Member = m, Portfolio = p, Project = pr };
                if (search.Length > 0)
                    query = query.Where(x => x.Project.ProjectId.Contains(search) || x.Project.Description.Contains(search));
                var rows = await query.OrderBy(x => x.Project.ProjectId).Take(200).ToListAsync(cancellationToken);

                var result = new List<object>();
                foreach (var x in rows)
                    result.Add(new
                    {
                        SourceMemberId = x.Member.Id,
                        x.Project.ProjectId,
                        x.Project.Description,
                        SourcePortfolioName = await PortfolioNameAsync(x.Portfolio, cancellationToken),
                        x.Member.Status,
                        x.Member.StartYear,
                        x.Member.Cost,
                        x.Member.McaScore,
                    });
                return Ok(result);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// Adds an RDIP / UDIP project to an open PIP (MY-PFL-10, -18): its cost is copied into the
        /// PIP membership's Original Cost, which never changes; the MCA score is recorded; the source
        /// RDIP / UDIP is kept; the planning fields are copied; the status is the source's.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> AddToPip([FromBody] AddToPipDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (pip, refusal) = await LoadPortfolioAsync(dto.PortfolioId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (pip!.Kind != EnumPortfolioKind.PIP)
                    return Refused("Not a PIP", "Projects are added to PIP from a PIP portfolio.");

                var source = await _db.tMultiYearPortfolioMember.AsNoTracking().FirstOrDefaultAsync(m => m.Id == dto.SourceMemberId, cancellationToken);
                if (source == null)
                    return Refused("Not Found", MembershipNotFoundMessage);
                var sourcePortfolio = await _db.tMultiYearPortfolio.AsNoTracking().FirstAsync(p => p.Id == source.PortfolioFK, cancellationToken);
                if (PortfolioTermRules.WriteRefusal(sourcePortfolio.Status, sourcePortfolio.TermStartYear) is string closed)
                    return Refused("Term Closed", closed);

                bool alreadyIn = await _db.tMultiYearPortfolioMember.AsNoTracking().AnyAsync(m => m.PortfolioFK == pip.Id && m.MultiYearProjectFK == source.MultiYearProjectFK, cancellationToken);
                if (PipRules.AddRefusal(sourcePortfolio.Kind, source.Status, source.StartYear, pip.TermStartYear, alreadyIn, dto.McaScore) is string cannot)
                    return Refused("Cannot Add to PIP", cannot);

                var now = Functions.CurrentDate();
                string sourceName = await PortfolioNameAsync(sourcePortfolio, cancellationToken);
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                var member = new MultiYearPortfolioMember
                {
                    PortfolioFK = pip.Id,
                    MultiYearProjectFK = source.MultiYearProjectFK,
                    IsOwner = false,
                    SourcePortfolioFK = sourcePortfolio.Id,
                    Status = source.Status,
                    StartYear = source.StartYear,
                    Cost = source.Cost,
                    OriginalCost = source.Cost, // never changes (MY-PFL-19)
                    BasisForImplementationFK = source.BasisForImplementationFK,
                    NedaProjectStatusFK = source.NedaProjectStatusFK,
                    ReadinessLevelIds = source.ReadinessLevelIds,
                    RdpOutcomes = source.RdpOutcomes,
                    Tier = source.Tier,
                    McaScore = Math.Round(dto.McaScore!.Value, 4),
                    CreatedBy = _Session.UserId,
                    CreatedDate = now,
                };
                _db.tMultiYearPortfolioMember.Add(member);
                await _db.SaveChangesAsync(cancellationToken);
                _db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
                {
                    MemberFK = member.Id,
                    FromStatus = null,
                    ToStatus = member.Status,
                    ToStartYear = member.StartYear,
                    ToCost = member.Cost,
                    Reason = $"Added to PIP from {sourceName}, MCA Score {member.McaScore:0.##}.",
                    ChangedBy = _Session.UserId,
                    ChangedDate = now,
                });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                string projectId = await _db.tMultiYearProject.AsNoTracking().Where(p => p.Id == member.MultiYearProjectFK).Select(p => p.ProjectId).FirstAsync(cancellationToken);
                return Ok(new
                {
                    MemberId = member.Id,
                    Message = $"{projectId} added to {await PortfolioNameAsync(pip, cancellationToken)} with an Original Cost of {member.Cost:N2}.",
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>Changes a PIP membership's cost (MY-PFL-19). The Original Cost never changes; the change is logged.</summary>
        [HttpPost]
        public async Task<IActionResult> SetPipCost([FromBody] SetPipCostDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var (member, portfolio, refusal) = await LoadMemberAsync(dto.MemberId, forWrite: true, cancellationToken);
                if (refusal != null) return refusal;
                if (portfolio!.Kind != EnumPortfolioKind.PIP)
                    return Refused("Not a PIP Project", "Set PIP Cost changes the cost of a project in PIP. Its RDIP / UDIP cost follows the project's planned yearly costs.");
                if (MembershipStatusRules.IsLocked(member!.Status))
                    return Refused("Project Locked", $"This project is {MembershipStatusRules.Label(member.Status)} in this portfolio and can no longer change.");
                decimal cost = Math.Round(dto.Cost, 2);
                if (PipRules.CostRefusal(cost) is string invalid)
                    return Refused("Invalid PIP Cost", invalid);
                if (cost == member.Cost)
                    return Refused("Nothing to Save", $"The PIP cost is already {cost:N2}.");

                var now = Functions.CurrentDate();
                decimal previous = member.Cost;
                member.Cost = cost;
                member.UpdatedBy = _Session.UserId;
                member.UpdatedDate = now;
                _db.tMultiYearMemberStatusLog.Add(new MultiYearMemberStatusLog
                {
                    MemberFK = member.Id,
                    FromStatus = member.Status,
                    ToStatus = member.Status,
                    FromCost = previous,
                    ToCost = cost,
                    Reason = string.IsNullOrWhiteSpace(dto.Reason) ? "PIP cost changed." : $"PIP cost changed: {dto.Reason.Trim()}",
                    ChangedBy = _Session.UserId,
                    ChangedDate = now,
                });
                await _db.SaveChangesAsync(cancellationToken);
                return Ok(new { MemberId = member.Id, member.Cost, Message = $"PIP cost set to {cost:N2}. The Original Cost stays {member.OriginalCost ?? previous:N2}." });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion
    }
}
