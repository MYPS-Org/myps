using DBHelper.Models.Table.Project;
using Helpers;
using static Helpers.ProjectHelper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore.Storage;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// Lump Sum writes.
    ///
    /// THE POINT OF V2 LIVES HERE. In V1 CreateLumpsum wrote the project model
    /// and UpdateLumpsum wrote a parallel wallet model, so the two never agreed.
    /// Both now write the same tProject* tables keyed to the Lump Sum Project's
    /// own revision, through the same helper.
    /// </summary>
    public partial class LumpsumController
    {
        #region Create

        /// <summary>
        /// WF-1. Creates a Lump Sum Project: a real tProjects row with its
        /// revision, stage, one 100% funding line, one 'LS' component cost equal
        /// to it, and one cost-per-year row.
        ///
        /// It carries NO EAO component — Design Report 2.6.8 says it should not.
        /// ProjectType = 'LS' and the LS component are what identify it.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateLumpSum([FromBody] CreateLumpSumDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                var Program = await _db.tPrograms
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProgramPK == dto.ProgramId && !x.IsDeleted, cancellationToken);

                if (Program == null)
                    return NotFoundResult($"Program '{dto.ProgramId}' was not found.");

                if (_Session.ApplyFilter && !await IsLumpSumVisible(Program.ProgramPK, cancellationToken))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "You do not have access to this program.",
                        Title = "Access Denied"
                    });
                }

                // An Approved program takes no new parent — see AssertProgramNotApprovedAsync.
                var Frozen = await AssertProgramNotApprovedAsync(Program.ProgramPK, "Creating a Lump Sum Project", cancellationToken);
                if (Frozen != null) return Frozen;

                /*  THE PROGRAM'S CURRENT STAGE — whatever that is.

                    A project does not start at BP. It starts wherever its program
                    currently sits, which for Lump Sum is in practice GAA-R,
                    the itemizable stage. Nothing here may assume a first stage.
                    The client's CurrentStage is ignored entirely. */
                var ProgramStage = await _db.tProgramStages
                    .AsNoTracking()
                    .Where(x => x.ProgramFK == Program.ProgramPK)
                    .OrderByDescending(x => x.Id)
                    .FirstOrDefaultAsync(cancellationToken);

                if (ProgramStage == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "This program has no stage to create a Lump Sum Project against.",
                        Title = "No Stage"
                    });
                }

                /*  TIER IS 1 UNLESS THE CALLER SAYS OTHERWISE (2026-09-06). The Lump
                    Sum form no longer collects it: a Lump Sum Project covers a
                    programme, every migrated parent is Tier 1, and the lookup only
                    holds 1 and 2, so the starred select was a choice with nothing to
                    base it on. An explicit value from an API caller is still honoured
                    and still range-checked below; only an ABSENT one is defaulted, and
                    only here, on create. Update keeps the stored value instead
                    (ApplyDetailFields). This is a deliberate default for a form field,
                    not the import's "unresolved lookup" case — the itemization import
                    still takes each child's Tier from the workbook and refuses an
                    unknown one rather than defaulting it. */
                dto.Tier ??= 1;

                var Refusal = await ValidateRequiredFieldsAsync(dto, cancellationToken);
                if (Refusal != null) return Refusal;

                /*  Resolved by CODE. tProjectComponentCost stores the component's
                    NAME, and the names are editable; the codes are not. */
                var LSType = await _db.tOptionProjectComponentType
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ComponentId == "LS", cancellationToken);

                if (LSType == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The Lump Sum component type is missing from the code tables.",
                        Title = "Not Configured"
                    });
                }

                /*  The shared lookup validator runs ONLY when a Region was given.

                    It validates Province, City, Legislative District, DEO and
                    Implementing Office against the Region and hard-fails on each,
                    but the V2 field spec makes all of those OPTIONAL. Calling it
                    with blanks would refuse a Lump Sum Project that the spec says
                    is complete. When there is no Region there is no geographic
                    chain to check, so Tier and Category — the two required lookups
                    it would have checked first — are validated directly. */
                if (!string.IsNullOrWhiteSpace(dto.Region))
                {
                    var DetailValidation = await _db.ValidateProjectDetailsLookups(
                        new ValidateProjectDetailsLookupsParams
                        {
                            _Session = _Session,
                            Tier = dto.Tier ?? 1,
                            Category = dto.CategoryId ?? 0,
                            Region = dto.Region ?? string.Empty,
                            Province = dto.Province ?? string.Empty,
                            City = dto.City ?? string.Empty,
                            LegislativeDistrict = dto.LegislativeDistrict ?? string.Empty,
                            DEO = dto.Deo ?? string.Empty,
                            ImplementingOffice = dto.ImplementingOffice ?? string.Empty,
                            OperatingUnit = dto.OperatingUnit ?? string.Empty,
                            Origin = dto.Origin ?? 0,
                            Agency = dto.Agency ?? 0,
                            ImplementationMode = dto.ImplementationMode,
                            EmergencyMode = dto.EmergencyMode,
                            RowAvailable = dto.RowAvailable,
                            Feasibility = dto.Feasibility,
                            FeasibilityDate = dto.FeasibilityDate,
                            DetailedDesign = dto.DetailedDesign,
                            DetailedDesignDate = dto.DetailedDesignDate
                        }, cancellationToken);

                    if (!DetailValidation.IsValid)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = DetailValidation.Message,
                            Title = DetailValidation.Title
                        });
                    }
                }
                else
                {
                    var LookupRefusal = await ValidateTierAndCategoryAsync(dto.Tier ?? 1, dto.CategoryId ?? 0, cancellationToken);
                    if (LookupRefusal != null) return LookupRefusal;
                }

                /*  ISLAND CODE IS THE CONSTANT 'LS'.

                    V1 resolved a geographic island-group code from the selected
                    Region. Region is optional now, so there is nothing to resolve
                    from — and the model was always that a Lump Sum Project is
                    identified by ProjectType plus its LS component, not by an ID
                    suffix. GenerateProjectID appends this as the trailing segment
                    ({Prefix}{YearOffset:3}{Sequence:5}{IslandCode}), so IDs end
                    in 'LS'.

                    It is also what ProjectDetailsForm's IsLumpSum check reads, so
                    the project form keeps exempting the right fields. */
                const string LumpSumIslandCode = "LS";

                string ProjectPK = await _db.GenerateProjectID(new GenerateProjectIDParams
                {
                    CategoryId = dto.CategoryId ?? 0,
                    StageName = ProgramStage.StageName,
                    IslandCode = LumpSumIslandCode,
                    YearStart = Program.StartYear
                }, cancellationToken);

                var Project = new DBHelper.Models.Table.Project.Projects
                {
                    ProgramFK = Program.ProgramPK,
                    ProjectPK = ProjectPK,
                    ProgramId = ProgramStage.ProgramId,
                    ProjectType = "LS",
                    MYId = dto.MyId,
                    ExternalId = dto.ExternalId,
                    IsPublished = false,
                    IsRevised = false,
                    /*  Never published to PCMA — it is concerned with civil-works
                        components (Operations Guide D.3). Publishing belongs to the
                        Programs module, and a Lump Sum Project is never published. */
                    IsPublishable = false,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                };
                await _db.tProjects.AddAsync(Project, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                var Revision = new ProjectRevisions
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = Program.ProgramPK,
                    ProgramId = ProgramStage.ProgramId,
                    ProjectId = ProjectPK,
                    AlternateId = dto.AlternateId,
                    Description = dto.Description ?? string.Empty,
                    IslandCode = LumpSumIslandCode,
                    Category = dto.CategoryId ?? 0,
                    Thrust = dto.SubCategoryId,
                    Tier = dto.Tier ?? 1,
                    Rank = dto.Rank,
                    MYCAApprovalDate = dto.MycaApprovalDate,


                    /*  Optional under the V2 field spec, and left NULL rather than
                        defaulted. Baseline §2b widened Region, DEO and
                        ImplementingOffice to allow it; inventing a value here would
                        look like a planning decision nobody made. */
                    Region = dto.Region,
                    Province = dto.Province,
                    City = dto.City,
                    LegislativeDistrict = dto.LegislativeDistrict,
                    DEO = dto.Deo,
                    ImplementingOffice = dto.ImplementingOffice,

                    // Required by the field spec, so no defaulting to hide a gap.
                    OperatingUnit = dto.OperatingUnit ?? string.Empty,
                    RegionWide = dto.RegionWide ?? 0,
                    Origin = dto.Origin ?? 0,
                    Agency = dto.Agency ?? 0,

                    /*  Optional. These are NameId values, not the surrogate Id —
                        the two differ for these tables, and writing the Id makes
                        the project form answer "Selected Emergency Mode '2' is not
                        valid." */
                    ImplementationMode = dto.ImplementationMode,
                    EmergencyMode = dto.EmergencyMode,
                    Feasibility = dto.Feasibility,
                    FeasibilityDate = dto.FeasibilityDate,
                    DetailedDesign = dto.DetailedDesign,
                    DetailedDesignDate = dto.DetailedDesignDate,
                    RowAvailable = dto.RowAvailable,

                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                    IsDeleted = false
                };
                await _db.tProjectRevisions.AddAsync(Revision, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                await _db.tProjectStages.AddAsync(new ProjectStages
                {
                    ProjectFK = ProjectPK,
                    ProgramFK = Program.ProgramPK,
                    ProgramId = ProgramStage.ProgramId,
                    RevisionId = Revision.Id,
                    StageId = ProgramStage.StageId,
                    StageName = ProgramStage.StageName,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate
                }, cancellationToken);

                /*  FUNDING BEFORE COMPONENT. Order matters to the reader, not to
                    SQL: the funding line is the ceiling and the component cost is
                    what sits under it. One line for the whole allocation at 100%,
                    which is what the project form's "funding must total 100%" rule
                    requires.

                    IsWalletDraw is FALSE. That flag marks a CHILD's draw against
                    its parent; flagging a Lump Sum Project's own funding would make
                    it a claimant against itself. */
                await _db.tProjectFundingProfile.AddAsync(new ProjectFundingProfile
                {
                    ProjectRevisionFK = Revision.Id,
                    SourceOrg = dto.FundingSource!,
                    AgreementCode = dto.FundingAgreement!,
                    Amount = dto.Allocation,
                    Percentage = 100d,
                    IsWalletDraw = false,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                    IsDeleted = false
                }, cancellationToken);

                /*  THE ALLOCATION. This single component is what itemization draws
                    down and what vLumpSumSet reports as Remaining. Equal to the
                    funding line, so the project form opens with Total Cost exactly
                    on its Max Cost rather than over a ceiling of zero. */
                var LSComponent = new ProjectComponentCost
                {
                    ProjectRevisionFK = Revision.Id,
                    ComponentType = LSType.ComponentName,
                    /*  'LS', not 'LS1'. A Lump Sum Project holds exactly one
                        component, so there is nothing for a running number to
                        distinguish it from. The suffix was copied from the Civil
                        Works convention, where a project may hold several. */
                    ComponentId = LSType.ComponentId,
                    Description = dto.Description ?? "Lump Sum allocation",
                    Total = dto.Allocation,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                    IsDeleted = false
                };
                await _db.tProjectComponentCost.AddAsync(LSComponent, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);

                /*  ONE COST-PER-YEAR ROW, DERIVED.

                    The field spec makes ComponentCostPerYear required, but the Add
                    flow collects a single allocation figure rather than a year
                    breakdown. So the server derives one row at the program's start
                    year carrying the whole allocation.

                    THIS ROW IS THE SHAPE, not a starting point. The Component Cost
                    dialog renders Year and Amount read-only and offers no "Add
                    Year", so there is never a second row and neither value is ever
                    retyped: the year follows the program, and the amount follows
                    the funding lines and Replenish, with itemization drawing it
                    down. Only the dates and the UACS are edited by hand. */
                await _db.tProjectComponentCostPerYear.AddAsync(new ProjectComponentCostPerYear
                {
                    ComponentCostFK = LSComponent.Id,
                    Year = Program.StartYear,
                    Amount = dto.Allocation,

                    /*  THE WHOLE PROGRAM START YEAR. These were left null, which the
                        Component Cost dialog then refused to save past — it requires
                        both dates and clamps them to the row's year, so every new
                        Lump Sum Project needed two dates typed in before its own
                        component could be edited at all. There is only one sensible
                        pair for a component that covers the program's start year. */
                    StartDate = new DateTime(Program.StartYear, 1, 1),
                    EndDate = new DateTime(Program.StartYear, 12, 31),

                    /*  THE FORM'S UACS LANDS HERE (2026-09-06). There is no project-level
                        UACS column; this per-year row is the only storage, and
                        vLumpSumSet.UACS reads it back. The create payload carries no
                        per-year rows of its own, so dto.Uacs is the only way the code
                        typed on Project Details can reach the database. Normalised so
                        an empty box stores NULL, never '' — the views filter IS NOT
                        NULL only, and a '' here would be what they return. */
                    UACS = NormalizeUacs(dto.Uacs),

                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                    IsDeleted = false
                }, cancellationToken);

                await _db.SaveChangesAsync(cancellationToken);

                // The new Lump Sum Project's allocation feeds the parent Program's Cost
                // (ADR-055), so the program has to recompute the moment it exists — otherwise
                // Program Details shows a stale total until an unrelated project edit happens
                // to touch the same ProgramFK.
                await _db.RecomputeProgramCostAsync(Program.ProgramPK, cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                var Created = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.ProjectPK == ProjectPK, cancellationToken);

                return Ok(new
                {
                    LumpSumProject = Created,
                    LumpSumId = Created?.Id ?? 0,
                    Message = $"Lump Sum Project {ProjectPK} created with an allocation of {dto.Allocation:N2}.",
                    Title = "Created"
                });
            }
            /*  AN ADMINISTRATIVE CONDITION, NAMED (2026-09-10). The category's
                Project ID range is used up — GenerateProjectID above translates the
                allocator's PROJECTID_RANGE_EXHAUSTED into this type. Nothing on the
                form can change it: an administrator has to widen the range. So it is
                answered the way ProjectController.AddProject answers the same
                exception, with the same Title, rather than falling through to the
                generic handler and reading as "Application Error" with a reference
                id. It sits above that handler, which C# also insists on (CS0160:
                a catch below `catch (Exception)` is unreachable and will not compile).

                The mint runs before the commit, so this rollback also restores the
                sequence the allocator had already advanced. */
            catch (ProjectIdRangeExhaustedException ex)
            {
                await SafeRollbackAsync(transaction, cancellationToken);
                _logger.LogWarning(
                    "Project ID range exhausted on CreateLumpSum: category {CategoryId}, program {ProgramId}, user {UserId}. {Detail}",
                    ex.CategoryId, dto.ProgramId, _Session.UserId, ex.Message);
                return new BadRequestObjectResult(new
                {
                    Title = "Project ID Range Exhausted",
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                /*  Roll back ONLY if the transaction is still live.

                    The read-back after CommitAsync is inside this try, so a
                    failure THERE reaches here with the transaction already
                    committed — and RollbackAsync then throws "This SqlTransaction
                    has completed", masking the real exception entirely. That is
                    how a nullable-column mismatch surfaced as a transaction error
                    with no mention of the column. */
                await SafeRollbackAsync(transaction, cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Update

        /// <summary>
        /// Composite save of an existing Lump Sum Project: detail fields plus the
        /// full replacement Funding Profile / Component Cost / per-year sets, in
        /// one transaction.
        ///
        /// The revision row is updated IN PLACE rather than superseded. Exactly
        /// one non-deleted revision per project is maintained, or the
        /// LatestRevision CTE in the views starts resolving a row nobody meant to
        /// publish.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> UpdateLumpSum([FromBody] UpdateLumpSumDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                // Before the first read of the parent — see .Locking.cs for the order rule.
                var Busy = await AcquireLumpSumLockAsync(dto.LumpSumId, cancellationToken);
                if (Busy != null) return Busy;

                var LumpSumProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.LumpSumId, cancellationToken);

                if (LumpSumProject == null)
                    return NotFoundResult($"Lump Sum Project {dto.LumpSumId} was not found.");

                var Denied = await AssertLumpSumVisibleAsync(dto.LumpSumId, cancellationToken);
                if (Denied != null) return Denied;

                /*  NO ACTION-LEVEL APPROVAL GATE HERE (rule revised 2026-09-09). Save
                    is how a Replenish and a funding-line removal reach the database,
                    and both stay available on an Approved GAA-R program — so gating
                    this action would gate them. What approval closes on this action
                    is FIELD-scoped: the guard below ValidateRequiredFieldsAsync. */

                /*  The stored Category and Sub-Category ride along so an UNTOUCHED pair is
                    grandfathered past the mapping check (2026-09-12) -- see
                    ValidateSubCategoryAsync. LumpSumProject is the vLumpSumSet row loaded
                    above; FirstChangedDetail already reads the same two fields from it. */
                var Refusal = await ValidateRequiredFieldsAsync(
                    dto, cancellationToken,
                    previousCategory: LumpSumProject.Category,
                    previousThrust: LumpSumProject.Thrust);
                if (Refusal != null) return Refusal;

                /*  THE PROJECT'S RECORD IS CLOSED UNDER AN APPROVAL — SERVER-SIDE
                    (2026-09-09, the maintainer's decision on the risk analysis' N1).

                    A CHANGE IS REFUSED; AN ECHO IS NOT — the UACS guard's rule, applied
                    to every detail field and to the Component Cost. The page already
                    renders these read-only and re-sends what it fetched, so its saves
                    pass; an API caller that would alter a detail on a project whose
                    program is Approved at GAA-R is refused by name. Funding lines are
                    never compared: a top-up and a line removal are exactly what Save is
                    left live for under an approval.

                    After validation, deliberately, so an invalid payload still gets
                    the validation message it always got; before the revision is
                    loaded, so nothing is tracked and returning disposes the
                    transaction unwritten like every guard above. This READS the
                    approval rather than calling AssertProgramNotApprovedAsync — that
                    helper refuses an action outright and has two callers by rule. */
                var Approval = await ReadProgramApprovalAsync(LumpSumProject.ProgramFK, cancellationToken);
                if (Approval != null)
                {
                    string? Changed = FirstChangedDetail(dto, LumpSumProject)
                        ?? await FirstChangedComponentAsync(dto, LumpSumProject.RevisionId, cancellationToken);

                    if (Changed != null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = ProgramApprovedMessage("Changing this Lump Sum Project's details", Approval)
                                    + $" ({Changed} would change.)",
                            Title = ProgramApprovedTitle
                        });
                    }
                }

                /*  A NEW FUNDING LINE IS A TOP-UP, AND A TOP-UP IS CONFINED TO THE
                    REVISION STAGES (2026-09-08). Replenish used to be its own request
                    and carried this gate itself; the dialog now appends the line to
                    the form and this save is what writes it, so the gate has to sit
                    here or an API caller could append a line at BP through this
                    action — the V1 hole ReplenishLumpSum closed. Existing lines are
                    not gated: a removal must stay possible at any stage. The pair and
                    Amount rules for a new line are in ValidateRequiredFieldsAsync. */
                bool AppendsFunding = dto.FundingProfiles.Any(x => x.Id == 0 && !x.IsDeleted);
                if (AppendsFunding && !RevisionStages.Contains(LumpSumProject.StageName ?? string.Empty))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"A funding line can only be added at {string.Join(" or ", RevisionStages)}. This Lump Sum Project is at '{LumpSumProject.StageName}'.",
                        Title = "Stage Not Reached"
                    });
                }

                /*  Reducing funding below what the itemized children already draw
                    would make Remaining negative — 2.6.4's "At no time can the
                    Parent LS allocation be less than 0". Refuse before writing. */
                decimal NewTotal = dto.FundingProfiles.Where(x => !x.IsDeleted).Sum(x => x.Amount);

                if (NewTotal < LumpSumProject.ItemizedTotal)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Cannot reduce the allocation to {NewTotal:N2}: itemized projects already draw "
                                + $"{LumpSumProject.ItemizedTotal:N2}. Remove or reduce itemized projects first.",
                        Title = "Below Committed Draw"
                    });
                }

                /*  A TOP-UP RAISES THE ALLOCATION, OR IT IS NOT A TOP-UP (2026-09-10,
                    finding 5 of that day's review).

                    ReplenishLumpSum carried this rule and compared against the STORED
                    allocation (line 677). The dialog is local-until-Save now, so this
                    action writes the top-up — and it inherited no such rule. Meanwhile
                    SyncLSToFundingAsync re-derives the allocation from the lines below,
                    so a payload that appends a line while the lines total less than the
                    stored allocation writes the allocation DOWN and the audit note says
                    "increased by". The money's one honest signal lied.

                    Scoped to a payload that appends and deletes nothing: removing a
                    line is how an allocation legitimately falls, and Save is left live
                    on an Approved program precisely for that. Where the lines already
                    disagree with the allocation — the funding-gap shape
                    LumpSum.Repair.FundingGap exists for — this refuses the top-up and
                    names both figures rather than quietly resolving the gap downward. */
                bool RemovesFunding = dto.FundingProfiles.Any(x => x.IsDeleted);
                decimal StoredAllocation = LumpSumProject.OriginalAllocation ?? 0m;

                if (AppendsFunding && !RemovesFunding && NewTotal <= StoredAllocation)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"This save adds a funding line but would leave the allocation at {NewTotal:N2}, "
                                + $"which is not above the current {StoredAllocation:N2}. The funding lines do not add "
                                + "up to the allocation; repair the funding profile before topping up.",
                        Title = "Allocation Mismatch"
                    });
                }

                /*  UACS IS FROZEN ONCE THE PROJECT HAS CHILDREN (2026-09-08). It is an
                    externally assigned business key, and ApplyUacsToPerYearRowsAsync
                    below is scoped to THIS revision's component costs — so a change here
                    cannot reach the children that inherited the code at import (see
                    "UACS IS INHERITED, NOT CHECKED" in .Import.cs). Letting one through
                    would leave a parent and its children permanently disagreeing about a
                    key 2.6.8 requires to be identical, with nothing to reconcile them.

                    Until now this was a frontend freeze only — the details form disables
                    the box on an itemized parent — so an API caller could still do it.

                    A CHANGE IS REFUSED; AN ECHO IS NOT, and the distinction is
                    load-bearing. The DTO is tri-state (see DTOLumpSum.Uacs): null means
                    "keep" and never reaches the fan-out at all, so it must pass here
                    too. The EQUAL case must pass as well: the form is disabled on an
                    itemized parent but Save is NOT — a wrong funding line has to stay
                    removable — and detailFields() re-sends the fetched UACS on every one
                    of those saves. A guard keyed on "itemized and Uacs present" would
                    break funding-line removal outright.

                    Both sides are normalised so '' vs NULL and stray whitespace do not
                    read as a change. Read under the applock taken above, so the child
                    count cannot move underneath it; returning here disposes the
                    transaction unwritten, the same as the guards above. */
                if (dto.Uacs != null && NormalizeUacs(dto.Uacs) != NormalizeUacs(LumpSumProject.UACS))
                {
                    int ItemizedChildren = await _db.vLumpSumChildSet
                        .AsNoTracking()
                        .CountAsync(x => x.ParentProjectId == LumpSumProject.ProjectId, cancellationToken);

                    if (ItemizedChildren > 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"The OA Project Code (UACS) cannot be changed: {ItemizedChildren} itemized "
                                    + $"project(s) inherited it from {LumpSumProject.ProjectId} at import. "
                                    + "Remove them first.",
                            Title = "UACS Locked"
                        });
                    }
                }

                /*  THE ALLOCATION ROW IS NOT THE PAYLOAD'S TO NAME (2026-09-10,
                    finding 15 of that day's review).

                    ValidateRequiredFieldsAsync asks HOW MANY live components the payload
                    describes and what type the survivor claims to be. It cannot ask WHICH
                    row that is: it never sees the revision. So a payload that flagged the
                    real Lump Sum row deleted and presented a live LS-type row carrying a
                    foreign or invented Id satisfied the count — and the merge, which skips
                    an Id it does not own and copies IsDeleted onto the one it does, then
                    soft-deleted the allocation and committed. vLumpSumSet admits a project
                    only while it holds a live LS component, so the project left the module
                    entirely: gone from the list, "Not Found" on open, and every itemized
                    child unsaveable because AdjustParentAllocationAsync resolves the parent
                    through the same view.

                    The same hole sat one level down: the per-year rule asks whether EVERY
                    row in the payload is deleted, which a payload carrying an unrelated
                    live row passes while deleting the balance row this component hangs on.

                    Both are answered here, against the revision, before anything is
                    tracked — returning disposes the transaction unwritten like the guards
                    above. The page cannot send either shape; the Component Cost table
                    offers neither Add nor Delete. This is for the API caller. */
                var LsRow = await _db.FindLSComponentAsync(LumpSumProject.RevisionId, cancellationToken);

                if (LsRow == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "This Lump Sum Project has no Lump Sum component to save against.",
                        Title = "Single Component"
                    });
                }

                /*  THE ALLOCATION BEFORE THIS SAVE (2026-09-18). A Lump Sum parent adds
                    exactly this Total to its program's cost, so it is the one figure that
                    decides whether the program must be recomputed below. Read now, before
                    anything is written: LsRow is tracked, and SyncLSToFundingAsync mutates
                    this same instance later. */
                decimal AllocationBefore = LsRow.Total;

                /*  Count and type are already enforced above, so exactly one row is live. */
                var LiveCost = dto.ComponentCosts.First(x => !x.IsDeleted);

                if (LiveCost.Id != LsRow.Id)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "A Lump Sum Project's one component is the Lump Sum allocation it was created with; "
                                + "it cannot be replaced or removed.",
                        Title = "Single Component"
                    });
                }

                /*  The balance lives on this component's per-year row, so the payload has
                    to leave it one: an existing row of THIS component, or a new one
                    attached to it. Attachment is by the client's own CostId string, the
                    same match the merge's CostIdMap makes. Replacing the row — every
                    existing one deleted, an Id-0 row attached — is a legitimate shape and
                    stays legitimate. */
                var LsPerYearIds = await _db.tProjectComponentCostPerYear
                    .AsNoTracking()
                    .Where(x => x.ComponentCostFK == LsRow.Id && !x.IsDeleted)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);

                /*  LAST ENTRY WINS, because that is what the merge does (review,
                    2026-09-10). It walks the payload in order and assigns IsDeleted
                    each time, so one Id listed live and then deleted ends deleted — and
                    an Any() over the payload reads the first entry and passes it. Group
                    by Id and judge each row on its last word. Id-0 rows have no identity
                    to group by; each is its own insert, so any live one counts. */
                bool KeepsExistingRow = dto.ComponentCostPerYear
                    .Where(Year => Year.Id != 0 && LsPerYearIds.Contains(Year.Id))
                    .GroupBy(Year => Year.Id)
                    .Any(Rows => !Rows.Last().IsDeleted);

                bool AddsAttachedRow = dto.ComponentCostPerYear.Any(Year => Year.Id == 0
                    && !Year.IsDeleted
                    && string.Equals(Year.ComponentCostId?.Trim(), LiveCost.CostId?.Trim(), StringComparison.OrdinalIgnoreCase));

                bool KeepsBalanceRow = KeepsExistingRow || AddsAttachedRow;

                if (!KeepsBalanceRow)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "The Lump Sum allocation's Cost Per Year row cannot be removed; the balance lives on it.",
                        Title = "Cost Per Year Required"
                    });
                }

                var Revision = await _db.tProjectRevisions
                    .FirstOrDefaultAsync(x => x.Id == LumpSumProject.RevisionId, cancellationToken);

                if (Revision == null)
                    return NotFoundResult($"Lump Sum Project {dto.LumpSumId} has no active revision to update.");

                ApplyDetailFields(Revision, dto);
                Revision.UpdatedBy = UserId;
                Revision.UpdatedDate = CurrentDate;

                var Project = await _db.tProjects
                    .FirstOrDefaultAsync(x => x.ProjectPK == LumpSumProject.ProjectPK, cancellationToken);

                if (Project != null)
                {
                    Project.MYId = dto.MyId;
                    Project.ExternalId = dto.ExternalId;
                }

                await _db.SaveChangesAsync(cancellationToken);

                var ChildError = await SaveLumpSumChildrenAsync(
                    Revision.Id, dto, LumpSumProject.UACS, UserId, CurrentDate, cancellationToken);
                if (ChildError != null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return ChildError;
                }

                await _db.SaveChangesAsync(cancellationToken);

                /*  THE LS COMPONENT IS DERIVED, NOT TYPED (2026-09-06). Whatever Total or
                    per-year Amount the client echoed for it was written by the merge above;
                    this overwrites both from the truth: Total := Σ live funding lines,
                    Amount := Total − what the children have drawn. Two things follow. The
                    dialog can never set the allocation to the balance or the balance to
                    the allocation, whatever it sends. And a form save that raced an import
                    can no longer write a pre-import figure back — the lost-update hazard
                    recorded earlier today — because the figure it writes is recomputed
                    here, after the merge, inside the parent's lock. ItemizedTotal is the
                    view's, read at the top of this request under that same lock. */
                /*  AND IT ANSWERS, so read the answer (2026-09-10). This returns false
                    when the revision has no live LS component left — which the check
                    before the merge has just made impossible, and which was silently
                    discarded here while the save committed the damage anyway. It stays
                    because that check reasons about the payload and this helper reasons
                    about the database; the day they disagree, this line is what keeps the
                    disagreement out of the record. */
                bool Synced = await _db.SyncLSToFundingAsync(Revision.Id, LumpSumProject.ItemizedTotal, UserId, CurrentDate, cancellationToken);

                if (!Synced)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return new BadRequestObjectResult(new
                    {
                        Message = "This save would leave the Lump Sum Project without its allocation component. "
                                + "Nothing was written.",
                        Title = "Single Component"
                    });
                }

                /*  AND THE BALANCE ROW, WHICH Sync CANNOT ANSWER FOR (review,
                    2026-09-10). SyncLSToFundingAsync returns TRUE for a component with no
                    live per-year row — "Rows.Count == 0 return true", because moving
                    nothing is not its failure — so the check above cannot stand in for
                    this one. Without a live row the balance has nowhere to live:
                    MoveLSBalanceAsync returns quietly, and every later import and child
                    delete stops adjusting the allocation while the API still answers 200.
                    That is the drift the Baseline's own health check hunts for.

                    Asked of the database rather than the payload, because the merge's
                    ordering and its CostId mapping both sit between the two. */
                bool HasBalanceRow = await _db.tProjectComponentCostPerYear
                    .AnyAsync(x => x.ComponentCostFK == LsRow.Id && !x.IsDeleted, cancellationToken);

                if (!HasBalanceRow)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return new BadRequestObjectResult(new
                    {
                        Message = "The Lump Sum allocation's Cost Per Year row cannot be removed; the balance lives on it. "
                                + "Nothing was written.",
                        Title = "Cost Per Year Required"
                    });
                }

                /*  UACS FANS OUT AFTER THE FLUSH ABOVE, not before. Rows the same payload
                    inserted with Id 0 exist in the database only from that flush on; a
                    fan-out that queried earlier would miss them and leave a new
                    component's row blank while its siblings carry the code. */
                await ApplyUacsToPerYearRowsAsync(Revision.Id, dto.Uacs, UserId, CurrentDate, cancellationToken);

                await _db.SaveChangesAsync(cancellationToken);

                /*  RECOMPUTE ONLY WHEN THE ALLOCATION MOVED (2026-09-18), the way
                    ProjectController gates on HasCostUpdate. A parent contributes its LS
                    component Total to the program's cost and nothing else of it counts:
                    not its per-year balance, not its details, not its children. So a save
                    that leaves the Total where it was cannot change the program's cost,
                    and pays nothing. Read back from the database, after the flush above,
                    so the comparison sees what the merge and the sync actually wrote. */
                decimal AllocationAfter = await _db.tProjectComponentCost
                    .AsNoTracking()
                    .Where(x => x.Id == LsRow.Id)
                    .Select(x => x.Total)
                    .FirstAsync(cancellationToken);

                bool HasCostUpdate = AllocationAfter != AllocationBefore;

                if (HasCostUpdate)
                    await _db.RecomputeProgramCostAsync(LumpSumProject.ProgramFK, cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                /*  THE SAVE ANSWERS THE WHOLE PROJECT (2026-09-10) — the shape
                    LumpSumDetails returns, built by the same method. It used to answer
                    the header row and leave the client to re-read the child rows for
                    their new Ids in a second request; a save that committed but whose
                    re-read timed out left the draft on screen as unsaved, one press
                    from a second insert. One answer, or none: the client treats a lost
                    answer as an unknown outcome and reloads before it will save again
                    (LumpSumForm.confirmUpdate). The read-back below is still inside
                    the try, so a failure here reaches the catch with the transaction
                    committed — which is exactly the case the client's rule is for. */
                var Updated = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.LumpSumId, cancellationToken)
                    ?? throw new InvalidOperationException(
                        $"Lump Sum Project {dto.LumpSumId} could not be read back after its own save.");

                return Ok(await BuildLumpSumDetailsAsync(Updated, cancellationToken));
            }
            catch (Exception ex)
            {
                /*  Roll back ONLY if the transaction is still live.

                    The read-back after CommitAsync is inside this try, so a
                    failure THERE reaches here with the transaction already
                    committed — and RollbackAsync then throws "This SqlTransaction
                    has completed", masking the real exception entirely. That is
                    how a nullable-column mismatch surfaced as a transaction error
                    with no mention of the column. */
                await SafeRollbackAsync(transaction, cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Replenish

        /// <summary>
        /// Tops a Lump Sum Project's allocation up to a new TOTAL.
        ///
        /// Raises the 'LS' component — the one row the allocation lives on — so
        /// Remaining rises by the difference and every itemized child is left
        /// untouched.
        ///
        /// THE UI NO LONGER CALLS THIS (2026-09-08). The Replenish dialog appends
        /// the top-up to the form's funding lines and "Save Lump Sum Project"
        /// carries it through UpdateLumpSum, which applies the same stage gate,
        /// pair rule, Amount > 0 and audit note to every new line. This action
        /// stays as the API-level top-up; the contract suite (ls-contract,
        /// ls-data-security) is its specification.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ReplenishLumpSum([FromBody] ReplenishLumpSumDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                // Before the first read of the parent — see .Locking.cs for the order rule.
                var Busy = await AcquireLumpSumLockAsync(dto.LumpSumId, cancellationToken);
                if (Busy != null) return Busy;

                var LumpSumProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.LumpSumId, cancellationToken);

                if (LumpSumProject == null)
                    return NotFoundResult($"Lump Sum Project {dto.LumpSumId} was not found.");

                var Denied = await AssertLumpSumVisibleAsync(LumpSumProject.Id, cancellationToken);
                if (Denied != null) return Denied;

                /*  No program-approval gate (rule revised 2026-09-09): topping up an
                    Approved GAA-R program is the work that stage exists for. */

                /*  A top-up has to be carried by a revision, so replenish is
                    confined to the revision stages — see RevisionStages. In V1
                    this gate lived only in the frontend, so any caller reaching
                    the API directly could replenish a project still at BP. */
                if (!RevisionStages.Contains(LumpSumProject.StageName ?? string.Empty))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Replenish is only available at {string.Join(" or ", RevisionStages)}. This Lump Sum Project is at '{LumpSumProject.StageName}'.",
                        Title = "Stage Not Reached"
                    });
                }

                /*  NewAmount is the new ORIGINAL allocation, so it is compared
                    against the original — not against Remaining, which is already
                    net of everything itemized. Replenishing to a figure below what
                    children already draw would otherwise look valid. */
                decimal Original = LumpSumProject.OriginalAllocation ?? 0m;

                if (dto.NewAmount <= Original)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"The new allocation must exceed the current {Original:N2}.",
                        Title = "Invalid Amount"
                    });
                }

                var LSComponent = await GetLSComponentAsync(LumpSumProject.RevisionId, cancellationToken);
                if (LSComponent == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "This Lump Sum Project has no Lump Sum component to raise.",
                        Title = "No Allocation"
                    });
                }

                decimal TopUp = dto.NewAmount - Original;

                /*  THE TOP-UP IS A FUNDING LINE (2026-09-06). The manual, the DTO and the
                    dialog all said so from the start; the server only ever raised the
                    component. Three figures describe the allocation and this is where
                    they are kept in step (model note: Helpers/LumpsumHelper.cs):

                      Σ funding lines  = the full allocation — what the project was ever
                                         given — so it grows by exactly the top-up;
                      component Total  = the same full allocation, so it grows by the
                                         top-up too;
                      per-year Amount  = what is left to itemize (Remaining), which the
                                         top-up also raises.

                    Total = Σ funding always; Amount = Total − what the children have
                    drawn, so on a project with nothing itemized the three are one number.

                    EXISTING LINES' AMOUNTS ARE NEVER TOUCHED — a top-up is appended,
                    which is why a decrease cannot be expressed here at all. Percentage
                    is a derived share of the funding total, so it IS re-derived across
                    every live line once the new one exists; leaving the old lines at
                    100% beside a second line would be a lie, not a courtesy.

                    Source and Agreement: the request's if given, else copied from the
                    project's FIRST funding line (the DTO documents that default). A
                    project with no live line and no codes supplied cannot be
                    replenished — there is nothing to say where the money came from.

                    THE FIRST FUNDING LINE IS THE ONLY LINE THE DEFAULT READS (2026-09-08).
                    It is the earliest LIVE line by Id — the one CreateLumpSum wrote, or
                    the earliest survivor if that one was deleted as the wrong-source
                    repair — which is the same definition the details page uses when it
                    protects that line on an itemized parent (firstFundingLine.ts). Until
                    today the default was the LARGEST line, a guess at "the main source"
                    that followed whichever top-up happened to be biggest.

                    THE TWO ARE ONE CHOICE, NOT TWO (2026-09-06). An agreement belongs to
                    a source — tOptionFundingAgreement.SourceOrg — so resolving them
                    independently could pair a source the caller chose with an agreement
                    copied from a line under a DIFFERENT source. The dialog makes that
                    easy: choosing a source clears the agreement box. So a source without
                    an agreement gets the first line's agreement ONLY if the first line is
                    under that source; any other source is a deliberate departure from
                    the project's original funding, and the caller names its agreement —
                    even when later lines exist under that source. The result is checked
                    against the lookup before it is written. */
                var LiveFunding = await _db.tProjectFundingProfile
                    .Where(x => x.ProjectRevisionFK == LumpSumProject.RevisionId && !x.IsDeleted)
                    .OrderBy(x => x.Id)
                    .ToListAsync(cancellationToken);

                var FirstLine = LiveFunding.FirstOrDefault();

                string? Source = string.IsNullOrWhiteSpace(dto.Source) ? null : dto.Source.Trim();
                string? Agreement = string.IsNullOrWhiteSpace(dto.Agreement) ? null : dto.Agreement.Trim();

                if (Source == null && Agreement == null)
                {
                    // Neither given: the first funding line, both halves of it.
                    Source = FirstLine?.SourceOrg;
                    Agreement = FirstLine?.AgreementCode;
                }
                else if (Agreement == null)
                {
                    /*  A source without an agreement: the FIRST line's agreement, and only
                        when the first line is under that source. Searching for "any line
                        under that source" would let a secondary source's top-up inherit an
                        agreement the user never chose. */
                    /*  Both sides trimmed: dto.Source was, and a stored SourceOrg with
                        padding (legacy rows) must not read as a different source here
                        while the dialog's sameSource() — which trims both — says it is
                        the same. The two predicates have to agree or the dialog's
                        pre-check waves through a request this refuses. */
                    bool FirstLineIsUnderSource = FirstLine != null
                        && string.Equals(FirstLine.SourceOrg?.Trim(), Source, StringComparison.OrdinalIgnoreCase);

                    if (!FirstLineIsUnderSource)
                    {
                        /*  The message names the actual reason. "No funding line under
                            {Source}" was the old lookup's truth and is now false by
                            design — that source may well have lines; only the first
                            one counts. */
                        return new BadRequestObjectResult(new
                        {
                            Message = FirstLine == null
                                ? "This Lump Sum Project has no funding line to copy the agreement from. Choose a Funding Agreement for the top-up."
                                : $"The first funding line is under {FirstLine.SourceOrg}, not {Source}. Choose a Funding Agreement for the top-up under {Source}.",
                            Title = "Funding Agreement Required"
                        });
                    }

                    Agreement = FirstLine!.AgreementCode;
                }
                else if (Source == null)
                {
                    // An agreement without a source: the agreement's own owner.
                    Source = await _db.tOptionFundingAgreement
                        .AsNoTracking()
                        .Where(x => x.Code == Agreement)
                        .Select(x => x.SourceOrg)
                        .FirstOrDefaultAsync(cancellationToken);
                }

                if (string.IsNullOrWhiteSpace(Source) || string.IsNullOrWhiteSpace(Agreement))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "This Lump Sum Project has no funding line to copy the source from. Choose a Funding Source and Agreement for the top-up.",
                        Title = "Funding Source Required"
                    });
                }

                /*  The pair must exist AND belong together. ValidateFundingLinesAsync
                    checks the agreement is a real code — the same check create runs — and
                    ValidateFundingPairsAsync adds the ownership the top-up needs. Both are
                    the checks UpdateLumpSum runs on a new line since 2026-09-08. */
                var TopUpPair = new (string? Source, string? Agreement)[] { (Source, Agreement) };
                var TopUpLineError = await ValidateFundingLinesAsync(TopUpPair, cancellationToken)
                    ?? await ValidateFundingPairsAsync(TopUpPair, cancellationToken);

                if (TopUpLineError != null)
                    return new BadRequestObjectResult(new { Message = TopUpLineError, Title = "Invalid Funding Line" });

                var TopUpLine = new ProjectFundingProfile
                {
                    ProjectRevisionFK = LumpSumProject.RevisionId,
                    SourceOrg = Source,
                    AgreementCode = Agreement,
                    Amount = TopUp,
                    Percentage = 0d,            // re-derived with the rest below
                    IsWalletDraw = false,
                    CreatedBy = UserId,
                    CreatedDate = CurrentDate,
                    IsDeleted = false
                };
                await _db.tProjectFundingProfile.AddAsync(TopUpLine, cancellationToken);
                LiveFunding.Add(TopUpLine);

                RederiveFundingShares(LiveFunding, UserId, CurrentDate);

                // Allocation AND balance rise together — see LumpsumHelper.RaiseLSAllocationAsync.
                await _db.RaiseLSAllocationAsync(LSComponent, TopUp, UserId, CurrentDate, cancellationToken);

                await _db.SaveChangesAsync(cancellationToken);

                await AddProjectNoteAsync(
                    LumpSumProject.RevisionId,
                    $"Lump Sum allocation increased by {TopUp:N2} to {dto.NewAmount:N2} ({Source} / {Agreement}).",
                    UserId, CurrentDate, cancellationToken);

                // The top-up just raised this project's allocation; the parent Program's Cost
                // (ADR-055) has to follow, or Program Details shows a stale total.
                await _db.RecomputeProgramCostAsync(LumpSumProject.ProgramFK, cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                var Updated = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == LumpSumProject.Id, cancellationToken);

                return Ok(new
                {
                    LumpSumProject = Updated,
                    Added = TopUp,
                    FundingLine = new { TopUpLine.Id, Source, Agreement, Amount = TopUp },
                    Message = $"Allocation raised by {TopUp:N2}.",
                    Title = "Replenish Complete"
                });
            }
            catch (Exception ex)
            {
                await SafeRollbackAsync(transaction, cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Shared write helpers

        /// <summary>
        /// Writes a note against a project revision.
        /// </summary>
        /// <remarks>
        /// Raw SQL on purpose. DBHelper.Models.Table.ProjectNotes declares
        /// StageName and ProjectId, but dbo.tProjectNotes actually has
        /// ProjectRevisionFK — the model is stale, and correcting it is a separate
        /// job with its own blast radius. Writing the real columns directly keeps
        /// this change contained.
        /// </remarks>
        private async Task AddProjectNoteAsync(
            int projectRevisionId, string text, string userId, DateTime when, CancellationToken ct)
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($@"
                INSERT INTO dbo.tProjectNotes
                    (ProjectRevisionFK, FileName, FileExtension, FilePath, Description, CreatedBy, CreatedDate)
                VALUES
                    ({projectRevisionId}, N'', N'', N'', {text}, {userId}, {when})", ct);
        }

        private static BadRequestObjectResult NotFoundResult(string message) =>
            new(new { Message = message, Title = "Not Found" });

        /// <summary>
        /// Rolls back only if the transaction is still live, and never lets a
        /// rollback failure escape.
        ///
        /// Calling RollbackAsync on an already-committed transaction throws
        /// "This SqlTransaction has completed; it is no longer usable" — and
        /// because that happens INSIDE the catch, it replaces the exception being
        /// handled. The original cause never reaches the caller or the log in a
        /// usable form. That is precisely how a nullable-column mismatch on
        /// vLumpSumSet.Region first presented: as a transaction error naming no
        /// column at all.
        /// </summary>
        private static async Task SafeRollbackAsync(
            IDbContextTransaction transaction,
            CancellationToken cancellationToken)
        {
            try
            {
                if (transaction.GetDbTransaction()?.Connection != null)
                    await transaction.RollbackAsync(cancellationToken);
            }
            catch
            {
                /*  Swallowed deliberately: the caller is already returning the real
                    exception, and a rollback that cannot run has nothing left to
                    undo. Masking that exception is the bug this method exists for. */
            }
        }

        /// <summary>
        /// The V2 required set, enforced server-side in the order a person would
        /// fill the form. Shared by create and update so the two cannot drift.
        ///
        /// This is the FIELD SPEC, not V1's: Region, Province, City, Legislative
        /// District, DEO and Implementing Office are OPTIONAL and deliberately not
        /// checked here. Sub-Category, Region Wide, Agency and Origin are required
        /// and were not in V1.
        ///
        /// Tier left the required set on 2026-09-06: the form no longer collects it,
        /// create defaults an absent Tier to 1 and update keeps the stored value. The
        /// Tier clause below is therefore a RANGE guard on an explicit value, and
        /// null passes it.
        /// </summary>
        private async Task<IActionResult?> ValidateRequiredFieldsAsync(
            LumpSumDetailFieldsDTO dto, CancellationToken cancellationToken,
            int? previousCategory = null, int? previousThrust = null)
        {
            /*  Category first: GenerateProjectID builds the Project ID from it, and
                a zero produced a malformed id ("BP011LS" instead of "BP01100001LS")
                that then broke id generation for every later Lump Sum Project in
                the program. */
            string? Error =
                (dto.CategoryId is null or <= 0)    ? "Select a Category — the Lump Sum Project ID is generated from it." :
                (dto.SubCategoryId is null or <= 0) ? "Select a Sub-Category." :
                string.IsNullOrWhiteSpace(dto.OperatingUnit)
                                                    ? "Select an Operating Unit — a Lump Sum Project cannot be saved in the project form without one." :
                string.IsNullOrWhiteSpace(dto.Description)
                                                    ? "Enter a Description — it is how the Lump Sum Project is identified in every list." :
                (dto.Tier is < 1 or > 5)            ? "Select a Tier between 1 and 5." :
                (dto.RegionWide is null or <= 0)    ? "Select Region Wide." :
                (dto.Agency is null or <= 0)        ? "Select an Originating Agency." :
                (dto.Origin is null or <= 0)        ? "Select an Origin." :
                null;

            if (Error != null)
                return new BadRequestObjectResult(new { Message = Error, Title = "Required" });

            /*  Sub-Category is stored as tOptionProjectThrustList.PAPKey and read back
                by it everywhere — the views, the Project form, the importer. Nothing
                checked it here, which let the Lump Sum form save the row's surrogate
                Id (1..164, disjoint from the PAPKeys at 1001+) unnoticed until
                2026-09-05. Refused now, on create and update alike. */
            var SubCategoryRefusal = await ValidateSubCategoryAsync(
                dto.CategoryId ?? 0, dto.SubCategoryId ?? 0, previousCategory, previousThrust, cancellationToken);
            if (SubCategoryRefusal != null) return SubCategoryRefusal;

            /*  Create carries a single allocation and one funding line; update
                carries the full replacement sets. Validate whichever shape arrived. */
            if (dto is CreateLumpSumDTO Create)
            {
                if (Create.Allocation <= 0m)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Enter the Lump Sum allocation — it is the amount that will be itemized against.",
                        Title = "Allocation Required"
                    });
                }

                if (string.IsNullOrWhiteSpace(Create.FundingSource))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Select a Funding Source — the allocation has to be funded from somewhere.",
                        Title = "Funding Source Required"
                    });
                }

                if (string.IsNullOrWhiteSpace(Create.FundingAgreement))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Select a Funding Agreement — it identifies which fund the allocation is drawn from.",
                        Title = "Funding Agreement Required"
                    });
                }

                /*  Existence, then ownership (2026-09-08). Create used to check only
                    that the agreement was a real code; a source paired with another
                    source's agreement went through. The same pair rule Replenish has
                    always applied now applies here. */
                var CreatePair = new (string? Source, string? Agreement)[]
                {
                    (Create.FundingSource, Create.FundingAgreement)
                };
                var LineError = await ValidateFundingLinesAsync(CreatePair, cancellationToken)
                    ?? await ValidateFundingPairsAsync(CreatePair, cancellationToken);

                if (LineError != null)
                    return new BadRequestObjectResult(new { Message = LineError, Title = "Invalid Funding Line" });
            }
            else
            {
                var Live = dto.FundingProfiles.Where(x => !x.IsDeleted).ToList();

                /*  A NEW LINE IS A TOP-UP AND CARRIES A TOP-UP'S RULES (2026-09-08).
                    The Replenish dialog appends the line locally and this save writes
                    it, so the two checks ReplenishLumpSum made on the request now apply
                    to every line the client has not persisted yet: the amount must be a
                    genuine increase, and the pair must belong together. NEW lines only.
                    An existing line keeps whatever it holds — a legacy row paired
                    before the ownership rule existed must stay saveable, or a wrong line
                    beside it could never be removed. The stage gate is in
                    UpdateLumpSum, where the project's stage is already in hand. */
                var NewLines = Live.Where(x => x.Id == 0).ToList();

                if (NewLines.Any(x => x.Amount <= 0m))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "A new funding line must carry an amount greater than zero. To lower the allocation, remove a line instead.",
                        Title = "Invalid Funding Line"
                    });
                }

                var PairError = await ValidateFundingPairsAsync(
                    NewLines.Select(x => ((string?)x.Source, (string?)x.Agreement)), cancellationToken);

                if (PairError != null)
                    return new BadRequestObjectResult(new { Message = PairError, Title = "Invalid Funding Line" });

                /*  EVERY FUNDING LINE IS DELETABLE, INCLUDING THE LAST (2026-09-07).

                    This used to refuse a payload leaving no live line ("A Lump Sum
                    Project needs at least one Funding Profile line"), which since the
                    table became read-only made a wrong line UNCORRECTABLE: the codes
                    can no longer be typed over, Replenish only APPENDS a line above the
                    current allocation, and CreateLumpSum writes exactly one — so on the
                    ordinary single-line project the only repair was deleting that line,
                    and this refused it.

                    Zero lines is now a legitimate, recoverable state: the allocation is
                    derived from the lines, so it becomes 0, the project keeps its LS
                    component and stays in the module, and Replenish puts a correct line
                    back (it asks for a Source and Agreement outright when there is no
                    line to copy them from). What it is NOT is a way to strand money:
                    the "Below Committed Draw" check above already refuses any payload
                    whose live lines total less than the itemized projects draw, so a
                    parent with children cannot be emptied — and while it has children
                    the form is read-only anyway. */

                /*  HOW MANY, AND OF WHAT TYPE — NOT WHICH ROW. This validator never sees
                    the revision, so it cannot tell the project's own allocation row from
                    a live LS-type row carrying somebody else's Id. UpdateLumpSum answers
                    that against the revision (see "THE ALLOCATION ROW IS NOT THE
                    PAYLOAD'S TO NAME"); this stays as the cheap first answer, and as the
                    only answer CreateLumpSum needs. */

                /*  EXACTLY ONE COMPONENT, AND IT IS THE LUMP SUM ONE (2026-09-06). The
                    allocation lives on that component — Total = funding, per-year row =
                    balance — and both are derived on save, so a second component would be
                    money the funding does not cover and a deleted one would be a project
                    with no allocation to itemize. The form no longer offers Add or Delete;
                    this refuses the API caller who still tries. "Lump Sum" is matched by
                    code through the lookup, the same way GetLSComponentAsync does. */
                var LiveComponents = dto.ComponentCosts.Where(x => !x.IsDeleted).ToList();
                if (LiveComponents.Count != 1)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = LiveComponents.Count == 0
                            ? "A Lump Sum Project holds exactly one component, the Lump Sum allocation; it cannot be removed."
                            : "A Lump Sum Project holds exactly one component, the Lump Sum allocation; it cannot be added to.",
                        Title = "Single Component"
                    });
                }

                var OnlyType = await ResolveComponentTypeAsync(LiveComponents[0].ComponentType, cancellationToken);
                if (!string.Equals(OnlyType, "LS", StringComparison.OrdinalIgnoreCase))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "A Lump Sum Project's one component must be the Lump Sum allocation.",
                        Title = "Single Component"
                    });
                }

                if (dto.ComponentCostPerYear.All(x => x.IsDeleted))
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = "Every Component Cost needs at least one Cost Per Year row.",
                        Title = "Cost Per Year Required"
                    });
                }

                var LineError = await ValidateFundingLinesAsync(
                    Live.Select(x => ((string?)x.Source, (string?)x.Agreement)), cancellationToken);

                if (LineError != null)
                    return new BadRequestObjectResult(new { Message = LineError, Title = "Invalid Funding Line" });
            }

            return null;
        }

        /// <summary>
        /// Sub-Category must be a tOptionProjectThrustList.PAPKey that is inside its validity
        /// window AND permitted for the chosen Category. A thrust row's surrogate Id is not
        /// accepted: the two number spaces do not overlap (Ids 1..164, PAPKeys 1001+), so an Id
        /// here is always a wrong value, and the Lump Sum form used to send exactly that.
        /// </summary>
        /// <remarks>
        /// 2026-09-11. This method used to do two things wrong, and its own doc-comment asserted
        /// a parity that had never held — it claimed to apply "the same test the Project form's
        /// dropdown applies", which is part of why the gap survived review.
        ///
        /// 1. NO MAPPING CHECK. It never consulted tOptionProjectCategoryToPAPMap, so the form
        ///    happily stored a (Category, Sub-Category) pair that AddProject refuses and that the
        ///    module's OWN itemization import then refuses on the very next step. Measured on
        ///    localhost 2026-09-10: 1,824 pairs selectable, 134 permitted, 1,690 wrongly accepted.
        ///
        /// 2. A THIRD VALIDITY WINDOW. It required ValidFromDate &lt; Year AND ValidToDate &gt; Year,
        ///    strictly narrower than both the dropdown (ValidToDate == 0 || ValidToDate &gt;= Year)
        ///    and the Project save (IsActive || ValidToDate == 0 || ValidToDate &gt;= Year). So the
        ///    form offered options this method then refused — one such option today (PAPKey 1142,
        ///    ending 2026), and the set rolls over every 1 January.
        ///
        /// Both are now delegated to ProjectHelper.ValidateThrustForCategoryAsync, the single
        /// implementation shared with ValidateProjectDetailsLookups and ResubmitRevision. See its
        /// header for the unrestricted-category rule and the Thrust = 0 exemption.
        ///
        /// Note the caller's own required-field guard already rejects a null or non-positive
        /// SubCategoryId before this runs, so Lump Sum never reaches the Thrust = 0 exemption —
        /// a Lump Sum Project must carry a Sub-Category. The exemption matters to the Project
        /// callers, not to this one.
        ///
        /// GRANDFATHERED THE SAME WAY AS PROJECT (2026-09-12). UpdateLumpSum passes the stored
        /// Category and Sub-Category; when both are untouched the shared method skips the pair
        /// check, so a legacy pair takes an unrelated edit and saves — the operator's Option A
        /// decision, which until now held for Project and not here. Changing either field is a
        /// new choice and is validated in full. CreateLumpSum passes neither, so a new Lump Sum
        /// Project is always validated.
        /// </remarks>
        private async Task<IActionResult?> ValidateSubCategoryAsync(
            int categoryId, int papKey, int? previousCategory, int? previousThrust, CancellationToken cancellationToken)
        {
            var Refusal = await _db.ValidateThrustForCategoryAsync(
                categoryId, papKey, previousCategory, previousThrust, cancellationToken);

            if (!Refusal.IsValid)
                return new BadRequestObjectResult(new { Message = Refusal.Message, Title = Refusal.Title });

            return null;
        }

        /// <summary>Tier and Category, for the path where no Region was supplied.</summary>
        private async Task<IActionResult?> ValidateTierAndCategoryAsync(
            int tier, int category, CancellationToken cancellationToken)
        {
            bool TierOk = await _db.tOptionProjectTier.AsNoTracking()
                .AnyAsync(x => x.NameId == tier, cancellationToken);

            if (!TierOk)
                return new BadRequestObjectResult(new { Message = $"Selected Tier '{tier}' is not valid.", Title = "Invalid Tier" });

            int Year = Functions.CurrentDate().Year;
            bool CategoryOk = await _db.tOptionProjectCategory.AsNoTracking()
                .AnyAsync(x => x.CategoryId == category
                            && (x.IsActive || x.ValidUntil == 0 || x.ValidUntil >= Year), cancellationToken);

            if (!CategoryOk)
                return new BadRequestObjectResult(new { Message = $"Selected Category '{category}' is not valid.", Title = "Invalid Category" });

            return null;
        }

        #region UACS

        /*  UACS HAS ONE HOME: tProjectComponentCostPerYear.UACS. There is no column on
            tProjects, tProjectRevisions or tProjectComponentCost, and vLumpSumSet.UACS
            is a SELECT TOP 1 over the per-year rows. The details form is the SINGLE
            WRITER (2026-09-06): what it sends as dto.Uacs is fanned out across every
            per-year row of the project's revision, so the "TOP 1" is exact rather
            than "first non-null". The Component Cost dialog only displays it. */

        /// <summary>
        /// null for null/whitespace, else the trimmed value. Never lets '' reach a
        /// row: the views filter <c>IS NOT NULL</c> only, so an empty string on the
        /// first row would be what they return, hiding a real code on a later one.
        /// </summary>
        private static string? NormalizeUacs(string? uacs) =>
            string.IsNullOrWhiteSpace(uacs) ? null : uacs.Trim();

        #region Approved-program field guard

        /// <summary>
        /// Two texts read as the same value when they normalise alike: null,
        /// empty and whitespace are one thing, and padding is ignored. The page's
        /// mapper turns a stored '' or NULL into an omitted key, which binds as
        /// null; without this an untouched Save of a blank Description would read
        /// as a change.
        /// </summary>
        private static bool SameText(string? a, string? b) =>
            string.Equals(NormalizeUacs(a), NormalizeUacs(b), StringComparison.Ordinal);

        /// <summary>
        /// The first detail field the payload would CHANGE on the stored project,
        /// by the DTO's own name, or null when every field is an echo.
        ///
        /// Mirrors ApplyDetailFields exactly, which is what makes it honest:
        ///
        ///   - CategoryId, Tier, RegionWide, Origin, Agency are KEPT when omitted
        ///     (`?? revision.X` there), so a null here is not a change and is
        ///     compared only when sent — the contract suite's echo helper omits
        ///     Tier and must keep passing.
        ///   - Every other field is written unconditionally there, so an OMITTED
        ///     value that differs from a stored one really would erase it, and is
        ///     refused as the change it is (decision recorded in the plan). The
        ///     page never omits a stored value: it re-sends what it fetched.
        ///   - Uacs is tri-state — null means keep — so it too is compared only
        ///     when sent. This is how a UACS change on a CHILDLESS project is
        ///     refused under an approval; the UACS guard above only covers parents
        ///     with children.
        ///   - Dates compare as DateTime? after model binding, never as text.
        ///
        /// Funding lines are not here on purpose; they are what Save stays live for.
        /// </summary>
        private static string? FirstChangedDetail(LumpSumDetailFieldsDTO dto, DBHelper.Models.Views.Lumpsum.LumpSum stored)
        {
            // Kept-when-omitted: compare only when the payload spoke.
            if (dto.CategoryId != null && dto.CategoryId != stored.Category) return nameof(dto.CategoryId);
            if (dto.Tier != null && dto.Tier != stored.Tier) return nameof(dto.Tier);
            if (dto.RegionWide != null && dto.RegionWide != stored.RegionWide) return nameof(dto.RegionWide);
            if (dto.Origin != null && dto.Origin != stored.Origin) return nameof(dto.Origin);
            if (dto.Agency != null && dto.Agency != stored.Agency) return nameof(dto.Agency);

            // Tri-state: null keeps.
            if (dto.Uacs != null && !SameText(dto.Uacs, stored.UACS)) return nameof(dto.Uacs);

            // Written as sent: an omitted value is a change if something is stored.
            if (!SameText(dto.Description, stored.Description)) return nameof(dto.Description);
            if (!SameText(dto.OperatingUnit, stored.OperatingUnit)) return nameof(dto.OperatingUnit);
            if (!SameText(dto.AlternateId, stored.AlternateId)) return nameof(dto.AlternateId);
            if (!SameText(dto.MyId, stored.MYId)) return nameof(dto.MyId);
            if (!SameText(dto.ExternalId, stored.ExternalId)) return nameof(dto.ExternalId);
            if (!SameText(dto.Province, stored.Province)) return nameof(dto.Province);
            if (!SameText(dto.City, stored.City)) return nameof(dto.City);
            if (!SameText(dto.LegislativeDistrict, stored.LegislativeDistrict)) return nameof(dto.LegislativeDistrict);
            if (!SameText(dto.Deo, stored.DEO)) return nameof(dto.Deo);
            if (!SameText(dto.Region, stored.Region)) return nameof(dto.Region);
            if (!SameText(dto.ImplementingOffice, stored.ImplementingOffice)) return nameof(dto.ImplementingOffice);

            if (dto.SubCategoryId != stored.Thrust) return nameof(dto.SubCategoryId);
            if (dto.Rank != stored.Rank) return nameof(dto.Rank);
            if (dto.MycaApprovalDate != stored.MYCAApprovalDate) return nameof(dto.MycaApprovalDate);
            if (dto.ImplementationMode != stored.ImplementationMode) return nameof(dto.ImplementationMode);
            if (dto.EmergencyMode != stored.EmergencyMode) return nameof(dto.EmergencyMode);
            if (dto.Feasibility != stored.Feasibility) return nameof(dto.Feasibility);
            if (dto.FeasibilityDate != stored.FeasibilityDate) return nameof(dto.FeasibilityDate);
            if (dto.DetailedDesign != stored.DetailedDesign) return nameof(dto.DetailedDesign);
            if (dto.DetailedDesignDate != stored.DetailedDesignDate) return nameof(dto.DetailedDesignDate);
            if (dto.RowAvailable != stored.RowAvailable) return nameof(dto.RowAvailable);

            return null;
        }

        /// <summary>
        /// The first Component Cost change the payload would make, or null.
        ///
        /// Compares only what the client OWNS on those rows: the cost's
        /// Description and the per-year Year / StartDate / EndDate, plus any row
        /// added (Id 0) or flagged deleted. Total and the per-year Amount are
        /// DERIVED from the funding lines by SyncLSToFundingAsync on every save —
        /// a payload may lie about them by design — and ComponentType is fixed by
        /// the single-component rule and stored as a name where the payload sends a
        /// code. ComponentId IS compared (2026-09-10, finding 3): that rule
        /// constrains the TYPE only, and the merge writes ComponentId
        /// unconditionally, so an echo that merely omitted it blanked the stored
        /// code. The per-year UACS is not compared because it is not an input at
        /// all — the merge no longer reads it (finding 1).
        ///
        /// One untracked read each of the two tables; the same rows the merge
        /// reads again later. Only runs when the program is Approved.
        /// </summary>
        private async Task<string?> FirstChangedComponentAsync(
            LumpSumDetailFieldsDTO dto, int revisionId, CancellationToken cancellationToken)
        {
            var Costs = await _db.tProjectComponentCost
                .AsNoTracking()
                .Where(x => x.ProjectRevisionFK == revisionId)
                .ToListAsync(cancellationToken);

            foreach (var Cost in dto.ComponentCosts)
            {
                if (Cost.Id == 0 && !Cost.IsDeleted) return "a new Component Cost";
                if (Cost.Id == 0) continue;                       // added then removed client-side
                var Row = Costs.FirstOrDefault(x => x.Id == Cost.Id);
                if (Row == null) continue;                        // not this project's — the merge ignores it
                if (Cost.IsDeleted != Row.IsDeleted) return "the Component Cost's deletion";
                if (!SameText(Cost.Description, Row.Description)) return "the Component Cost's Description";
                if (!SameText(Cost.ComponentId, Row.ComponentId)) return "the Component Cost's Component ID";
            }

            var Rows = await _db.tProjectComponentCostPerYear
                .AsNoTracking()
                .Where(x => Costs.Select(c => c.Id).Contains(x.ComponentCostFK))
                .ToListAsync(cancellationToken);

            foreach (var Year in dto.ComponentCostPerYear)
            {
                if (Year.Id == 0 && !Year.IsDeleted) return "a new Cost Per Year row";
                if (Year.Id == 0) continue;
                var Row = Rows.FirstOrDefault(x => x.Id == Year.Id);
                if (Row == null) continue;
                if (Year.IsDeleted != Row.IsDeleted) return "a Cost Per Year row's deletion";
                if (Year.Year != null && Year.Year != Row.Year) return "a Cost Per Year row's Year";
                if (Year.StartDate != Row.StartDate) return "a Cost Per Year row's Start Date";
                if (Year.EndDate != Row.EndDate) return "a Cost Per Year row's End Date";
            }

            return null;
        }

        #endregion

        /// <summary>
        /// Sets every live funding line's Percentage to its share of their total.
        ///
        /// A share is DERIVED, never typed: the column is display and reporting only —
        /// no balance, view or gate reads it — so the one thing it must be is
        /// consistent with the amounts beside it. Both writers of a funding line call
        /// this: ReplenishLumpSum, which has always done so, and UpdateLumpSum's merge,
        /// which stored what it was sent until 2026-09-10.
        ///
        /// Touches only a line whose share actually moves, so an untouched save writes
        /// nothing; a line with no Id yet is left unstamped because it is being
        /// inserted, not updated. Does not call SaveChanges — the caller owns the
        /// transaction.
        /// </summary>
        private static void RederiveFundingShares(
            IEnumerable<ProjectFundingProfile> liveLines,
            string userId,
            DateTime currentDate)
        {
            var Lines = liveLines.ToList();
            decimal FundingTotal = Lines.Sum(x => x.Amount);

            foreach (var Line in Lines)
            {
                double Share = FundingTotal == 0m ? 0d : (double)(Line.Amount / FundingTotal * 100m);
                if (Math.Abs(Line.Percentage - Share) < 0.0000001d) continue;
                Line.Percentage = Share;
                if (Line.Id != 0) { Line.UpdatedBy = userId; Line.UpdatedDate = currentDate; }
            }
        }

        /// <summary>
        /// Fans the form's UACS out across every live per-year row of the revision.
        ///
        /// TRI-STATE on the raw DTO value, and the distinction is load-bearing:
        ///   null            KEEP — the caller did not speak to UACS. Older clients and
        ///                   API scripts that never send it cannot wipe it, and the
        ///                   ls-ownership spec's per-row writes keep working.
        ///   "" / whitespace CLEAR — every row to NULL. This is the only way to remove
        ///                   a code; per-row clearing is not an operation any more.
        ///   text            SET — every row to the trimmed value.
        ///
        /// Must run AFTER the flush that follows SaveLumpSumChildrenAsync: rows the
        /// same payload inserted with Id 0 exist in the database only from then on.
        /// Touches only rows whose value differs, so an untouched save writes nothing.
        /// Does not call SaveChanges — the caller owns the transaction.
        /// </summary>
        private async Task ApplyUacsToPerYearRowsAsync(
            int revisionId,
            string? rawUacs,
            string userId,
            DateTime currentDate,
            CancellationToken cancellationToken)
        {
            if (rawUacs == null) return;                 // keep

            string? Target = NormalizeUacs(rawUacs);     // null = clear, text = set

            var Rows = await _db.tProjectComponentCostPerYear
                .Where(cy => !cy.IsDeleted
                          && _db.tProjectComponentCost.Any(cc => cc.Id == cy.ComponentCostFK
                                                              && cc.ProjectRevisionFK == revisionId
                                                              && !cc.IsDeleted))
                .ToListAsync(cancellationToken);

            foreach (var Row in Rows)
            {
                if (Row.UACS == Target) continue;
                Row.UACS = Target;
                Row.UpdatedBy = userId;
                Row.UpdatedDate = currentDate;
            }
        }

        #endregion

        /// <summary>
        /// Copies the detail fields off the DTO onto the revision. Shared by create
        /// and update so the two paths cannot drift field-by-field.
        ///
        /// CurrentStage is deliberately absent: stage lives in tProjectStages and
        /// follows the program, and is never accepted from the client. UACS is
        /// absent too — it has no column here; see the UACS region above.
        /// </summary>
        private static void ApplyDetailFields(ProjectRevisions revision, LumpSumDetailFieldsDTO dto)
        {
            revision.AlternateId = dto.AlternateId;
            revision.Description = dto.Description ?? string.Empty;
            revision.Category = dto.CategoryId ?? revision.Category;
            revision.Thrust = dto.SubCategoryId;
            revision.Tier = dto.Tier ?? revision.Tier;
            revision.Rank = dto.Rank;
            revision.MYCAApprovalDate = dto.MycaApprovalDate;


            revision.Region = dto.Region;
            revision.Province = dto.Province;
            revision.City = dto.City;
            revision.LegislativeDistrict = dto.LegislativeDistrict;
            revision.DEO = dto.Deo;
            revision.ImplementingOffice = dto.ImplementingOffice;

            revision.OperatingUnit = dto.OperatingUnit ?? string.Empty;
            revision.RegionWide = dto.RegionWide ?? revision.RegionWide;
            revision.Origin = dto.Origin ?? revision.Origin;
            revision.Agency = dto.Agency ?? revision.Agency;

            revision.ImplementationMode = dto.ImplementationMode;
            revision.EmergencyMode = dto.EmergencyMode;
            revision.Feasibility = dto.Feasibility;
            revision.FeasibilityDate = dto.FeasibilityDate;
            revision.DetailedDesign = dto.DetailedDesign;
            revision.DetailedDesignDate = dto.DetailedDesignDate;
            revision.RowAvailable = dto.RowAvailable;
        }

        /// <summary>
        /// Reconciles the Funding Profile / Component Cost / per-year sets against
        /// what the client posted.
        ///
        /// THIS IS THE STORAGE COLLAPSE. V1's equivalent wrote a parallel
        /// tLSWallet* set while create wrote the project — which is exactly why the
        /// two models disagreed. These are tProject* rows, keyed to the Lump Sum
        /// Project's own revision, and they are the same rows LumpSumDetails reads
        /// back and the same rows vLumpSumSet computes the allocation from.
        ///
        /// The client sends the FULL set every time, including rows flagged
        /// IsDeleted, so this is a three-way merge:
        ///   Id == 0 and not deleted -> insert
        ///   Id  > 0 and not deleted -> update in place
        ///   Id  > 0 and     deleted -> soft-delete
        /// Rows the client omits entirely are LEFT ALONE — an omission is "not mine
        /// to touch", never a delete, so a partial payload can never silently wipe
        /// funding history.
        ///
        /// Does NOT call SaveChanges — the caller owns the transaction.
        /// </summary>
        /// <returns>A refusal to return, or null on success.</returns>
        private async Task<IActionResult?> SaveLumpSumChildrenAsync(
            int revisionId,
            LumpSumDetailFieldsDTO dto,
            string? storedUacs,
            string userId,
            DateTime currentDate,
            CancellationToken cancellationToken)
        {
            #region Funding profile

            var ExistingFunding = await _db.tProjectFundingProfile
                .Where(x => x.ProjectRevisionFK == revisionId)
                .ToListAsync(cancellationToken);

            /*  THE AUDIT NOTE FOLLOWS THE LINE (2026-09-08). ReplenishLumpSum wrote
                "allocation increased by X to Y" to tProjectNotes for every top-up;
                the top-up now arrives here as an Id-0 line, so the note is written
                here, one per inserted line, with "to Y" running up through the
                lines in payload order and ending on the funded total this save
                leaves. Inserted lines are counted first because the running figure
                has to start from the total the payload had BEFORE any of them. */
            decimal FundingAfter = dto.FundingProfiles.Where(x => !x.IsDeleted).Sum(x => x.Amount);
            decimal RunningTotal = FundingAfter
                - dto.FundingProfiles.Where(x => x.Id == 0 && !x.IsDeleted).Sum(x => x.Amount);

            var InsertedFunding = new List<ProjectFundingProfile>();

            foreach (var Line in dto.FundingProfiles)
            {
                if (Line.Id == 0)
                {
                    if (Line.IsDeleted) continue;   // added then removed client-side

                    var NewLine = new ProjectFundingProfile
                    {
                        ProjectRevisionFK = revisionId,
                        SourceOrg = Line.Source,
                        AgreementCode = Line.Agreement ?? string.Empty,
                        Amount = Line.Amount,
                        Percentage = Line.Percentage,   // re-derived with the rest below
                        IsWalletDraw = false,
                        CreatedBy = userId,
                        CreatedDate = currentDate,
                        IsDeleted = false
                    };
                    await _db.tProjectFundingProfile.AddAsync(NewLine, cancellationToken);
                    InsertedFunding.Add(NewLine);

                    RunningTotal += Line.Amount;
                    await AddProjectNoteAsync(
                        revisionId,
                        $"Lump Sum allocation increased by {Line.Amount:N2} to {RunningTotal:N2} ({Line.Source} / {Line.Agreement}).",
                        userId, currentDate, cancellationToken);
                    continue;
                }

                var Row = ExistingFunding.FirstOrDefault(x => x.Id == Line.Id);
                if (Row == null) continue;          // belongs to another project — ignore

                Row.SourceOrg = Line.Source;
                Row.AgreementCode = Line.Agreement ?? string.Empty;
                Row.Amount = Line.Amount;
                Row.Percentage = Line.Percentage;
                Row.IsDeleted = Line.IsDeleted;
                Row.UpdatedBy = userId;
                Row.UpdatedDate = currentDate;
            }

            /*  A SHARE IS DERIVED, NEVER TYPED (2026-09-10, finding 4 of that day's
                review). ReplenishLumpSum re-derived every line's share when it owned
                the top-up; this action inherited the write but not the rule, and stored
                whatever the payload said. The form's funding table does re-derive on
                screen — but it is unmounted while the Funding Profile section is
                collapsed, so a top-up from a collapsed page persisted 100/0. The
                figures now come from the amounts, wherever the payload came from. */
            RederiveFundingShares(
                ExistingFunding.Where(x => !x.IsDeleted).Concat(InsertedFunding),
                userId,
                currentDate);

            #endregion

            #region Component cost

            var ExistingCosts = await _db.tProjectComponentCost
                .Where(x => x.ProjectRevisionFK == revisionId)
                .ToListAsync(cancellationToken);

            /*  The client links per-year rows to their parent by CostId, a string
                it makes up before either row has a database Id. Track which real Id
                each CostId resolved to so the per-year pass can attach correctly. */
            var CostIdMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var NewCosts = new List<(string? CostId, ProjectComponentCost Entity)>();

            foreach (var Cost in dto.ComponentCosts)
            {
                /*  A deleted row's type is irrelevant — do not reject a save because
                    a row on its way out names a retired component type. */
                string ComponentType = "LS";
                if (!Cost.IsDeleted)
                {
                    var Resolved = await ResolveComponentTypeAsync(Cost.ComponentType, cancellationToken);
                    if (Resolved == null)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"'{Cost.ComponentType}' is not a valid component type.",
                            Title = "Invalid Component Type"
                        });
                    }
                    ComponentType = Resolved;
                }

                /*  Stored as the NAME, resolved from the code. */
                string? ComponentName = await _db.tOptionProjectComponentType
                    .AsNoTracking()
                    .Where(x => x.ComponentId == ComponentType)
                    .Select(x => x.ComponentName)
                    .FirstOrDefaultAsync(cancellationToken);

                /*  THE COMPONENT ID IS NOT THE PAYLOAD'S EITHER (2026-09-20, finding 1
                    of the post-rebase review).

                    This used to copy dto's own ComponentId on top, which made the
                    payload the author of a column NOTHING validates: the count and type
                    checks resolve ComponentType, and the allocation-row check matches by
                    ComponentType's NAME, so a body sending ComponentId '' or 'X' passed
                    every guard and committed. The Lump Sum module never noticed -
                    vLumpSumSet, FindLSComponentAsync, Replenish and the import all find
                    the row by name - but PROGRAM COST matches cc.ComponentId = N'LS'
                    (section 11 of Migration.SchemaAndProgrammability.2026-09-10.sql), so
                    the parent's whole appropriation silently left its program's cost. Not
                    at once, either: the recompute below is gated on Total, which such a
                    save does not move, so the loss appeared at the next unrelated
                    recompute of that program.

                    The code resolved above IS tOptionProjectComponentType.ComponentId -
                    'LS' here, since ValidateRequiredFieldsAsync admits no other type - so
                    the server writes it and the payload's value is ignored. A row on its
                    way OUT keeps what it has: its ComponentType was never resolved (the
                    "LS" above is a placeholder, not a lookup), so there is nothing
                    trustworthy to write, and a deleted row is read by nothing. */
                if (Cost.Id == 0)
                {
                    if (Cost.IsDeleted) continue;

                    var Entity = new ProjectComponentCost
                    {
                        ProjectRevisionFK = revisionId,
                        ComponentType = ComponentName ?? ComponentType,
                        ComponentId = ComponentType,
                        Description = Cost.Description,
                        Total = Cost.Total,
                        CreatedBy = userId,
                        CreatedDate = currentDate,
                        IsDeleted = false
                    };
                    await _db.tProjectComponentCost.AddAsync(Entity, cancellationToken);
                    NewCosts.Add((Cost.CostId, Entity));
                    continue;
                }

                var Row = ExistingCosts.FirstOrDefault(x => x.Id == Cost.Id);
                if (Row == null) continue;

                Row.ComponentType = ComponentName ?? ComponentType;
                if (!Cost.IsDeleted) Row.ComponentId = ComponentType;
                Row.Description = Cost.Description;
                Row.Total = Cost.Total;
                Row.IsDeleted = Cost.IsDeleted;
                Row.UpdatedBy = userId;
                Row.UpdatedDate = currentDate;

                /*  A ROW ON ITS WAY OUT IS NOT AN ATTACHMENT TARGET (review,
                    2026-09-10). This map is what a new per-year row's ComponentCostId
                    resolves through, so mapping a soft-deleted cost would let a payload
                    reparent the replacement row onto a dead component — and the balance
                    row would be attached to something the views do not read. */
                if (!string.IsNullOrWhiteSpace(Cost.CostId) && !Cost.IsDeleted)
                    CostIdMap[Cost.CostId!] = Row.Id;
            }

            /*  New costs need their identities before per-year rows can point at
                them. The caller still owns the transaction — this is a flush, not a
                commit. */
            if (NewCosts.Count > 0)
            {
                await _db.SaveChangesAsync(cancellationToken);
                foreach (var (CostId, Entity) in NewCosts)
                    if (!string.IsNullOrWhiteSpace(CostId))
                        CostIdMap[CostId!] = Entity.Id;
            }

            #endregion

            #region Cost per year

            var CostIds = ExistingCosts.Select(x => x.Id)
                .Concat(NewCosts.Select(x => x.Entity.Id))
                .ToList();

            var ExistingPerYear = await _db.tProjectComponentCostPerYear
                .Where(x => CostIds.Contains(x.ComponentCostFK))
                .ToListAsync(cancellationToken);

            foreach (var Year in dto.ComponentCostPerYear)
            {
                if (Year.Id == 0)
                {
                    if (Year.IsDeleted) continue;

                    /*  Resolve the parent through CostId first — a new per-year row
                        on a new cost has no real ComponentCostFK yet. Reject an
                        orphan BY NAME rather than letting it fail as a foreign-key
                        violation the user cannot act on. */
                    int ParentId = 0;
                    if (!string.IsNullOrWhiteSpace(Year.ComponentCostId)
                        && CostIdMap.TryGetValue(Year.ComponentCostId!, out var Mapped))
                        ParentId = Mapped;

                    if (ParentId <= 0)
                    {
                        return new BadRequestObjectResult(new
                        {
                            Message = $"A Cost Per Year row for {Year.Year} is not attached to any Component Cost.",
                            Title = "Orphaned Cost Per Year"
                        });
                    }

                    await _db.tProjectComponentCostPerYear.AddAsync(new ProjectComponentCostPerYear
                    {
                        ComponentCostFK = ParentId,
                        ComponentId = ParentComponentId(ParentId, ExistingCosts, NewCosts),
                        Year = Year.Year ?? 0,
                        Amount = Year.Amount ?? 0m,
                        /*  THE PROJECT'S CODE, NOT THE PAYLOAD'S (2026-09-10). A new row
                            is born with what the project already holds; if this save also
                            speaks to Uacs, the fan-out below overwrites it. The row's own
                            value is never an input — see the update path. */
                        UACS = NormalizeUacs(storedUacs),
                        StartDate = Year.StartDate,
                        EndDate = Year.EndDate,
                        CreatedBy = userId,
                        CreatedDate = currentDate,
                        IsDeleted = false
                    }, cancellationToken);
                    continue;
                }

                var Row = ExistingPerYear.FirstOrDefault(x => x.Id == Year.Id);
                if (Row == null) continue;

                Row.Year = Year.Year ?? Row.Year;
                Row.Amount = Year.Amount ?? Row.Amount;
                /*  THE ROW'S UACS IS NOT WRITTEN HERE, AND NOT AN INPUT AT ALL
                    (2026-09-10, finding 1 of that day's review).

                    There is no project-level UACS column: this row IS the storage, the
                    details form's Uacs is fanned out across every live row after this
                    merge, and vLumpSumSet reads the first row back. This line used to
                    copy the payload's own row value on top, which made a SECOND writer
                    that nothing guarded — the itemized freeze and the Approved-program
                    guard both read dto.Uacs and nothing else. A payload that omitted
                    Uacs and set it on a row therefore changed a frozen parent's code
                    while every child kept the old one. The form has never sent a
                    divergent row value; an API caller could. */
                Row.StartDate = Year.StartDate;
                Row.EndDate = Year.EndDate;
                Row.IsDeleted = Year.IsDeleted;
                Row.UpdatedBy = userId;
                Row.UpdatedDate = currentDate;
            }

            #endregion

            return null;
        }

        /// <summary>
        /// The component id string of the cost a per-year row hangs off.
        ///
        /// tProjectComponentCostPerYear.ComponentId is NOT NULL and duplicates its
        /// parent's, so a new per-year row has to carry the parent's value rather
        /// than an empty string — an empty one makes the row unattributable in
        /// every report that groups by component.
        /// </summary>
        private static string ParentComponentId(
            int parentId,
            List<ProjectComponentCost> existing,
            List<(string? CostId, ProjectComponentCost Entity)> added)
        {
            var Match = existing.FirstOrDefault(x => x.Id == parentId)
                     ?? added.Select(x => x.Entity).FirstOrDefault(x => x.Id == parentId);

            return Match?.ComponentId ?? string.Empty;
        }

        /// <summary>
        /// Every funding line needs a Source and a recognised Agreement. One round
        /// trip for the whole set rather than one per line, and unknown agreements
        /// are named — otherwise they arrive as a foreign-key violation from EF
        /// that means nothing to the user.
        /// </summary>
        private async Task<string?> ValidateFundingLinesAsync(
            IEnumerable<(string? Source, string? Agreement)> lines,
            CancellationToken cancellationToken)
        {
            var Live = lines.ToList();
            if (Live.Count == 0) return null;

            for (int i = 0; i < Live.Count; i++)
            {
                if (string.IsNullOrWhiteSpace(Live[i].Source))
                    return $"Funding line {i + 1} has no Source. Every funding line needs one.";

                if (string.IsNullOrWhiteSpace(Live[i].Agreement))
                    return $"Funding line {i + 1} has no Agreement. Every funding line needs one — it identifies which fund the money comes from.";
            }

            var Codes = Live.Select(x => x.Agreement!).Distinct().ToList();

            var Known = await _db.tOptionFundingAgreement
                .AsNoTracking()
                .Where(x => Codes.Contains(x.Code))
                .Select(x => x.Code)
                .ToListAsync(cancellationToken);

            var Unknown = Codes.Where(c => !Known.Contains(c, StringComparer.OrdinalIgnoreCase)).ToList();

            if (Unknown.Count > 0)
                return $"These Funding Agreements are not recognised: {string.Join(", ", Unknown)}.";

            return null;
        }

        /// <summary>
        /// Every pair must BELONG together: tOptionFundingAgreement.SourceOrg must be
        /// the line's Source. ReplenishLumpSum applied this inline from 2026-09-06; it
        /// is shared now because UpdateLumpSum writes the top-up line since
        /// 2026-09-08 and CreateLumpSum's one line deserves the same check. Run it
        /// AFTER ValidateFundingLinesAsync, which has already refused a blank or
        /// unknown code — this only answers "does this real agreement sit under this
        /// source". Compared trimmed and case-insensitively, the way the first-line
        /// default is, so the two cannot disagree about "the same source".
        /// Since #480 it also refuses an inactive Source or Agreement: every caller passes
        /// NEW lines only (Create's one line, Replenish's top-up, UpdateLumpSum's Id == 0
        /// lines), and an existing line, read-only here, keeps whatever it holds.
        /// </summary>
        private async Task<string?> ValidateFundingPairsAsync(
            IEnumerable<(string? Source, string? Agreement)> lines,
            CancellationToken cancellationToken)
        {
            var Pairs = lines
                .Where(x => !string.IsNullOrWhiteSpace(x.Source) && !string.IsNullOrWhiteSpace(x.Agreement))
                .Select(x => (Source: x.Source!.Trim(), Agreement: x.Agreement!.Trim()))
                .Distinct()
                .ToList();
            if (Pairs.Count == 0) return null;

            var Codes = Pairs.Select(x => x.Agreement).Distinct().ToList();

            var Owners = await _db.tOptionFundingAgreement
                .AsNoTracking()
                .Where(x => Codes.Contains(x.Code))
                .Select(x => new { x.Code, x.SourceOrg })
                .ToListAsync(cancellationToken);

            foreach (var Pair in Pairs)
            {
                bool Belongs = Owners.Any(o =>
                    string.Equals(o.Code?.Trim(), Pair.Agreement, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(o.SourceOrg?.Trim(), Pair.Source, StringComparison.OrdinalIgnoreCase));

                if (!Belongs)
                    return $"Funding Agreement {Pair.Agreement} does not belong to Funding Source {Pair.Source}. Choose an agreement under that source.";
            }

            var Retired = await _db.ValidateFundingLookupsAsync(
                Pairs.Select(x => new FundingLookupRow(0, false, x.Source, x.Agreement)),
                Enumerable.Empty<FundingLookupRow>(),
                cancellationToken);

            return Retired.IsValid ? null : Retired.Message;
        }

        #endregion
    }
}
