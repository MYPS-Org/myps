using DBHelper.Models.Enums;
using Helpers;
using DBHelper.Models.Views.Lumpsum;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// Lump Sum reads: the list, its filter bar, and one project's detail and
    /// balance.
    /// </summary>
    public partial class LumpsumController
    {
        #region List and filters

        /// <summary>Dropdown sources for the Lump Sum list filter bar.</summary>
        [HttpPost]
        public async Task<IActionResult> InitFilterLumpSum(CancellationToken cancellationToken)
        {
            try
            {
                /*  Only programs that actually hold a Lump Sum Project — filtering
                    by a program with none can never return a row.

                    ONE ENTRY PER PROGRAM, LABELLED WITH THE PROGRAM'S NAME.
                    Several Lump Sum Projects can sit on the same program and the
                    client keys this dropdown on ProgramFK, so selecting
                    Description into the projection made it distinct by description
                    instead — the same program appeared repeatedly and React warned
                    about duplicate keys. Worse, MIN(Description) across a
                    program's projects picked whichever test project sorted first,
                    and where any had a blank description it returned the empty
                    string, rendering the program as an EMPTY option
                    indistinguishable from a separator.

                    ProgramName and StartYear are both functions of the program, so
                    Min over the group is just "the group's value" and cannot split
                    it. */
                var Programs = await _db.vLumpSumSet
                    .AsNoTracking()
                    .GroupBy(x => new { x.ProgramFK, x.ProgramId })
                    .Select(g => new
                    {
                        g.Key.ProgramFK,
                        g.Key.ProgramId,
                        ProgramName = g.Min(x => x.ProgramName),
                        YearStart = g.Min(x => x.StartYear)
                    })
                    .OrderBy(x => x.ProgramName)
                    .ToListAsync(cancellationToken);

                /*  STAGE ORDER IS StageHierarchy, NOT NameId.

                    tOptionProgramStage carries a decimal StageHierarchy for
                    exactly this, and NameId is just the insertion order of the
                    lookup rows. They disagree: RDIP (.3), PIP (.4) and RBP (.5)
                    all precede BP (1.0), but by NameId they are rows 8, 9 and 11 —
                    so the filter listed the three pre-budget stages AFTER
                    GAA-Revisions, in the middle of the budget sequence. */
                var Stages = await _db.tOptionProgramStage
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.StageHierarchy)
                    .ThenBy(x => x.NameId)
                    .ToListAsync(cancellationToken);

                var Categories = await _db.tOptionProjectCategory
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.CategoryName)
                    .ToListAsync(cancellationToken);

                /*  YEARS, WHERE OPERATING UNITS USED TO BE.

                    An Operating Unit belongs to the individual project, not to the
                    appropriation, so filtering a list of Lump Sum Projects by it
                    answered a question nobody was asking. The budget year is the
                    one people reach for, and it comes from the program.

                    Newest first: the current and next budget years are what a
                    planner wants at the top of the list, not 2019. */
                var Years = await _db.vLumpSumSet
                    .AsNoTracking()
                    .Where(x => x.StartYear != null)
                    .Select(x => x.StartYear!.Value)
                    .Distinct()
                    .OrderByDescending(x => x)
                    .ToListAsync(cancellationToken);

                return Ok(new { Programs, Stages, Categories, Years });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, null, _Session.UserId.ToString());
            }
        }

        /// <summary>Paged Lump Sum Project grid.</summary>
        [HttpPost]
        public async Task<IActionResult> ShowLumpSum([FromBody] ShowLumpSumDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var filters = new List<(string Clause, string ParamName, object? Value)>();

                if (!string.IsNullOrWhiteSpace(dto.Filters.ProgramFK))
                    filters.Add(("v.ProgramFK = @ProgramFK", "@ProgramFK", dto.Filters.ProgramFK.Trim()));

                /*  ProgramName is the ONLY LIKE filter; every other is an exact
                    match. It maps onto the project's Description — the free-text
                    box used to be labelled "Search by Operating Unit…" and fed an
                    equality comparison, so any partial input silently returned an
                    empty grid. */
                if (!string.IsNullOrWhiteSpace(dto.Filters.ProgramName))
                    filters.Add(("v.Description LIKE @Description", "@Description", $"%{dto.Filters.ProgramName.Trim()}%"));

                if (!string.IsNullOrWhiteSpace(dto.Filters.CurrentStage))
                    filters.Add(("v.StageName = @StageName", "@StageName", dto.Filters.CurrentStage.Trim()));

                /*  Still honoured though the filter bar no longer offers it — the
                    field is part of the published request shape and an exact match
                    is cheap to keep. The bar offers Year instead. */
                if (!string.IsNullOrWhiteSpace(dto.Filters.OperatingUnit))
                    filters.Add(("v.OperatingUnit = @OperatingUnit", "@OperatingUnit", dto.Filters.OperatingUnit.Trim()));

                /*  YearStart was on this DTO since it was written and was never
                    implemented, so a request carrying it was accepted and quietly
                    unfiltered — the worst shape a filter can take, because the
                    caller gets a full list back with no indication it was
                    ignored. */
                if (dto.Filters.YearStart.HasValue)
                    filters.Add(("v.StartYear = @StartYear", "@StartYear", dto.Filters.YearStart.Value));

                if (dto.Filters.CategoryId.HasValue)
                    filters.Add(("v.Category = @Category", "@Category", dto.Filters.CategoryId.Value));

                /*  Row-level data security: restrict to projects whose program is
                    visible to the session's region. ProgramFK is the program's
                    string key, so match on ProgramPK. */
                if (_Session.ApplyFilter)
                    filters.Add((
                        "EXISTS (SELECT 1 FROM vProgramDataSecurityGroups d WHERE d.ProgramPK = v.ProgramFK AND d.ParticipantId = @regCode)",
                        "@regCode",
                        _Session.RegCode));

                FilterDataResult<LumpSum> result =
                    await _db.FilterDataCursor<LumpSum, ShowLumpSumFilterDTO>(
                        tableName: "vLumpSumSet",
                        dto: dto,
                        filter: filters,
                        keyColumn: "Id",
                        descending: true,
                        includeTotal: true,
                        ct: cancellationToken);

                if (result.HasError)
                {
                    return new BadRequestObjectResult(new ErrorResult
                    {
                        Title = "Pagination error",
                        Message = result.ErrorMessage ?? "Unable to retrieve the records."
                    });
                }

                return Ok(result.Data);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Detail and balance

        /// <summary>A single Lump Sum Project plus its live balance and child rows.</summary>
        [HttpPost]
        public async Task<IActionResult> LumpSumDetails([FromBody] LumpSumDetailsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var LumpSumProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.LumpSumId, cancellationToken);

                if (LumpSumProject == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.LumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                var Denied = await AssertLumpSumVisibleAsync(dto.LumpSumId, cancellationToken);
                if (Denied != null) return Denied;

                return Ok(await BuildLumpSumDetailsAsync(LumpSumProject, cancellationToken));
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }


        /*  ONE PAYLOAD, TWO ACTIONS (2026-09-10). LumpSumDetails answers this, and
            so does UpdateLumpSum after its commit. The save used to answer the header
            row alone and the client re-read the rest in a second request for the new
            child Ids — and every recovery step in the form waited on that second
            answer. A save that committed but whose re-read timed out left the draft on
            screen as unsaved, one press from being inserted again (finding 2 of the
            2026-09-10 review). With the save answering the whole shape there is no
            second request to lose. Takes the view row rather than an id so a caller
            that has just read it does not read it twice. */
        private async Task<object> BuildLumpSumDetailsAsync(
            DBHelper.Models.Views.Lumpsum.LumpSum Project,
            CancellationToken cancellationToken)
        {
            var Balance = await _db.vLumpSumBalance
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.WalletId == Project.Id, cancellationToken);

            /*  Project revisions store organization participant IDs (for
                example OI46), while a user-facing detail page must show the
                office name. Older data sometimes placed a DEO/IO code in
                OperatingUnit, so resolve against both organization views. */
            string? OperatingUnitName = null;
            if (!string.IsNullOrWhiteSpace(Project.OperatingUnit))
            {
                OperatingUnitName = await _db.vAdminOperatingUnit
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == Project.OperatingUnit)
                    .Select(x => x.Name)
                    .FirstOrDefaultAsync(cancellationToken);

                OperatingUnitName ??= await _db.vAdminImplementingOffice
                    .AsNoTracking()
                    .Where(x => x.ParticipantId == Project.OperatingUnit)
                    .Select(x => x.Name)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            /*  The edit form binds Funding Profile / Component Cost as tables,
                so the detail call carries the child rows too — the grid view
                only exposes their SUM.

                THESE ARE tProject* ROWS. V1 read them from a parallel
                tLSWallet* set, which is what made create and update write
                different models: create wrote the project, update wrote the
                wallet. There is one storage now, and the revision id comes
                straight off the view rather than from a separate lookup. */
            int RevisionId = Project.RevisionId;

            var FundingProfiles = await _db.tProjectFundingProfile
                .AsNoTracking()
                .Where(x => x.ProjectRevisionFK == RevisionId && !x.IsDeleted)
                .OrderBy(x => x.Id)
                .ToListAsync(cancellationToken);

            var ComponentCosts = await _db.tProjectComponentCost
                .AsNoTracking()
                .Where(x => x.ProjectRevisionFK == RevisionId && !x.IsDeleted)
                .OrderBy(x => x.Id)
                .ToListAsync(cancellationToken);

            var CostIds = ComponentCosts.Select(x => x.Id).ToList();
            var ComponentCostPerYear = await _db.tProjectComponentCostPerYear
                .AsNoTracking()
                .Where(x => CostIds.Contains(x.ComponentCostFK) && !x.IsDeleted)
                .OrderBy(x => x.Year).ThenBy(x => x.Id)
                .ToListAsync(cancellationToken);

            /*  A fresh "being itemized" stamp, or null. The page uses it to show a
                banner and disable Save / Replenish / Import / Delete with the
                reason; the mutators would answer 409 anyway (see .Locking.cs). */
            var Stamp = await ReadFreshStampAsync(Project.Id, cancellationToken);

            /*  The program's approval, or null — the same shape of fact as Lock,
                carried the same way. What the page does with it is the PAGE's rule
                (approvedReason in lumpSumActions.ts); what the server refuses on it
                is AssertProgramNotApprovedAsync's — read that before widening either.
                Carries the program's own name and stage from vProgramLatest rather
                than the project's mirror of them, so the banner names what the gate
                actually read. */
            var Approval = await ReadProgramApprovalAsync(Project.ProgramFK, cancellationToken);

            return new
            {
                LumpSumProject = Project,
                /*  An all-zero fallback so the client always gets a balance
                    object rather than null. */
                Balance = Balance ?? new LumpSumBalance { WalletId = Project.Id },
                OperatingUnitName,
                FundingProfiles,
                ComponentCosts,
                ComponentCostPerYear,
                Lock = Stamp == null ? null : new { Stamp.LockedBy, Stamp.LockedDate },
                ProgramApproval = Approval == null
                    ? null
                    : new { Approval.ProgramName, Approval.StageName, Approval.Status }
            };
        }

        /// <summary>Live Total / Itemized / Remaining for one Lump Sum Project.</summary>
        [HttpPost]
        public async Task<IActionResult> LumpSumBalance([FromBody] LumpSumBalanceDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var Denied = await AssertLumpSumVisibleAsync(dto.LumpSumId, cancellationToken);
                if (Denied != null) return Denied;

                var Balance = await _db.vLumpSumBalance
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.WalletId == dto.LumpSumId, cancellationToken);

                if (Balance == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.LumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                return Ok(Balance);
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion


        #region Activity

        /// <summary>
        /// A dated activity timeline, RECONSTRUCTED from audit columns that already
        /// exist — created/updated stamps and publish state. It is not an event log.
        ///
        /// State the honest limit in the UI: only the LATEST change to any row can
        /// appear, because an UpdatedBy/UpdatedDate pair records nothing else.
        ///
        /// V2 emits NO revision events. The reference unioned them in from
        /// tLSWalletProjectRevisions, and WF-6 has left the module (decision 7).
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ShowLumpSumActivity([FromBody] LumpSumActivityDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                var Denied = await AssertLumpSumVisibleAsync(dto.LumpSumId, cancellationToken);
                if (Denied != null) return Denied;

                /*  The Lump Sum PROJECT, not a wallet row. This action still
                    read the retired wallet table, so the Activity tab answered "Wallet N was
                    not found" for every Lump Sum Project in the system - the one
                    tab on the detail page that could not open. */
                var LumpSumProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.LumpSumId, cancellationToken);

                if (LumpSumProject == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.LumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                var Events = new List<object>
                {
                    new
                    {
                        At = LumpSumProject.CreatedDate,
                        By = LumpSumProject.CreatedBy,
                        Kind = "LumpSumCreated",
                        Summary = $"Lump Sum Project {LumpSumProject.ProjectId} created at {LumpSumProject.StageName}, "
                                + $"allocated {LumpSumProject.OriginalAllocation:N2}."
                    }
                };

                if (LumpSumProject.UpdatedDate != null)
                {
                    Events.Add(new
                    {
                        At = LumpSumProject.UpdatedDate.Value,
                        By = LumpSumProject.UpdatedBy ?? string.Empty,
                        Kind = "LumpSumUpdated",
                        Summary = "Lump Sum Project details were last changed."
                    });
                }

                /*  Children by ParentProjectId - the documented itemization link.
                    The old query filtered vLumpSumChildSet on ParentWalletId,
                    which is null on every project created since the re-base. */
                var Projects = await _db.vLumpSumChildSet
                    .AsNoTracking()
                    .Where(x => x.ParentProjectId == LumpSumProject.ProjectId)
                    .ToListAsync(cancellationToken);

                foreach (var Project in Projects)
                {
                    Events.Add(new
                    {
                        At = Project.CreatedDate,
                        By = Project.CreatedBy ?? string.Empty,
                        Kind = "ProjectItemized",
                        Summary = $"Project {Project.ProjectId} itemized from {LumpSumProject.ProjectId}, "
                                + $"drawing {Project.ComponentCostTotal:N2}."
                    });

                    /*  Publishing has no timestamp of its own - IsPublished is a
                        flag. The row's UpdatedDate is the closest durable marker,
                        so it is used and labelled as approximate rather than
                        presented as the publish time. */
                    if (Project.IsPublished && Project.UpdatedDate != null)
                    {
                        Events.Add(new
                        {
                            At = Project.UpdatedDate.Value,
                            By = Project.UpdatedBy ?? string.Empty,
                            Kind = "ProjectPublished",
                            Summary = $"Project {Project.ProjectId} published."
                        });
                    }
                }

                var Ordered = Events
                    .OrderByDescending(e => (DateTime)e.GetType().GetProperty("At")!.GetValue(e)!)
                    .ToList();

                return Ok(new { Events = Ordered, Count = Ordered.Count });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion
    }
}
