using DBHelper.Models.Enums;
using DBHelper.Models.Views.Lumpsum;
using Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// The itemized children of a Lump Sum Project: reading them, the import
    /// gate, and the two deletes.
    ///
    /// DELETING RESTORES THE ALLOCATION. Itemizing deducts a child's cost from
    /// the parent's 'LS' component; deleting the child adds it back — "the total
    /// Allocation of the deleted itemized Projects shall be added to the LS
    /// allocation". That is the inverse operation, and it is why Remaining can be
    /// read live off the component and never drifts.
    /// </summary>
    public partial class LumpsumController
    {
        #region Reading the children
        /// Paged set of itemized projects under a wallet. Only ProjectType = 'LS'
        /// rows with a live revision appear — the view enforces both.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ShowItemizedProjects([FromBody] ShowItemizedProjectsDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                /*  LumpSumId is the Lump Sum Project's tProjects.Id.
                    the existing routes and client contract survive; there is no
                    wallet entity behind it any more. */
                var LumpSumProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.Filters.LumpSumId, cancellationToken);

                if (LumpSumProject == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.Filters.LumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                /*  The children inherit the parent's visibility — listing them is
                    reading the parent by another route, so the same gate applies.
                    Without this, a restricted user was refused the parent by
                    LumpSumDetails and then handed its whole child set here. */
                var Denied = await AssertLumpSumVisibleAsync(LumpSumProject.Id, cancellationToken);
                if (Denied != null) return Denied;

                /*  SCOPED BY PARENT PROJECT.

                    The design report ties an itemized project to ONE Lump Sum
                    Project through the Parent Project ID field. Earlier passes
                    matched on ParentWalletId and then on the program; both were the
                    wrong grain, since a program can hold several LS Projects with
                    different UACS, each itemized against its own allocation. */
                var filters = new List<(string Clause, string ParamName, object? Value)>
                {
                    ("v.ParentProjectId = @ParentProjectId", "@ParentProjectId", LumpSumProject.ProjectId)
                };

                if (!string.IsNullOrWhiteSpace(dto.Filters.ProjectId))
                    filters.Add(("v.ProjectId LIKE @ProjectId", "@ProjectId", $"%{dto.Filters.ProjectId.Trim()}%"));

                if (dto.Filters.IsPublished.HasValue)
                    filters.Add(("v.IsPublished = @IsPublished", "@IsPublished", dto.Filters.IsPublished.Value));

                FilterDataResult<LumpSumChild> result =
                    await _db.FilterDataCursor<LumpSumChild, ShowItemizedProjectsFilterDTO>(
                        tableName: "vLumpSumChildSet",
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

                /*  THE FUNDING LINES THEMSELVES, not just their sum.

                    vLumpSumChildSet aggregates a project's wallet-draw lines
                    into CurrentDrawAmount and FundingTotal. That is all the table
                    needs, but EditDrawAmountDialog edits the LINES — and with
                    nothing to populate them from, the client synthesized a single
                    placeholder row hardcoded to Source 'GOP' with a blank
                    Agreement. Reopening the dialog therefore showed a blank
                    Agreement over a stored one, misreported the source, and — since
                    UpdateDrawAmount replaces the whole set with whatever is
                    submitted — collapsed multi-line funding into one line on save.

                    Returned as a sibling collection keyed by ProjectPK rather than
                    as a property on LumpSumChild: that model is bound by
                    column name out of the view, and a property with no matching
                    column aborts the entire query. */
                var PageRevisionIds = result.Data.lists.Select(x => x.RevisionId).ToList();

                var FundingLines = PageRevisionIds.Count == 0
                    ? new List<object>()
                    : await _db.tProjectFundingProfile
                        .AsNoTracking()
                        .Where(f => PageRevisionIds.Contains(f.ProjectRevisionFK)
                                 && f.IsWalletDraw
                                 && !f.IsDeleted)
                        .Join(_db.tProjectRevisions.AsNoTracking(),
                              f => f.ProjectRevisionFK,
                              r => r.Id,
                              (f, r) => new
                              {
                                  ProjectPK = r.ProjectFK,
                                  f.Id,
                                  f.SourceOrg,
                                  f.AgreementCode,
                                  f.Amount,
                                  f.Percentage
                              })
                        .ToListAsync<object>(cancellationToken);

                return Ok(new
                {
                    result.Data.lists,
                    result.Data.page,
                    result.Data.limit,
                    result.Data.total,
                    result.Data.totalPages,
                    result.Data.PreviousFilteredId,
                    result.Data.NextFilteredId,
                    result.Data.HasPrevious,
                    result.Data.HasNext,
                    result.Data.PageCursorId,
                    FundingLines
                });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Import gate

        /// WF-4 gate: can this wallet take on itemized projects right now?
        /// Returns Valid=false with a reason rather than an error status — the
        /// caller renders the reason in the import dialog, it is not a failure.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ValidateForItemization([FromBody] ValidateLumpSumForItemizationDTO dto, CancellationToken cancellationToken)
        {
            try
            {
                /*  A LUMP SUM PROJECT, not a wallet row. Reading the wallet table here
                    made this gate answer "Wallet not found." for every real Lump
                    Sum Project in the system - so the import dialog refused all
                    of them, and the design report's primary itemization mode was
                    unreachable through the UI. */
                var LumpSumProject = await _db.vLumpSumSet
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == dto.LumpSumId, cancellationToken);

                if (LumpSumProject == null)
                    return Ok(new { Valid = false, Message = "Lump Sum Project not found." });

                // Same {Valid, Message} shape as the other refusals — the import
                // dialog renders this, so a 400 here would read as a failure
                // rather than a reason.
                if (await AssertLumpSumVisibleAsync(dto.LumpSumId, cancellationToken) != null)
                    return Ok(new { Valid = false, Message = "You do not have access to this Lump Sum Project." });

                /*  No program-approval reason (rule revised 2026-09-09): itemizing an
                    Approved GAA-R program is allowed, so this pre-flight must not
                    refuse what ImportItemizedProjects accepts. */

                /*  Someone else's import is in flight (a fresh visible stamp — see
                    .Locking.cs). A reason, not an error, like every other refusal here;
                    the import itself would answer 409 a moment later anyway. */
                var Stamp = await ReadFreshStampAsync(dto.LumpSumId, cancellationToken);
                if (Stamp != null)
                    return Ok(new
                    {
                        Valid = false,
                        Message = $"Being itemized by {Stamp.LockedBy} since {Stamp.LockedDate:HH:mm}. Try again shortly."
                    });

                if (!RevisionStages.Contains(LumpSumProject.StageName ?? string.Empty))
                    return Ok(new
                    {
                        Valid = false,
                        Message = $"Itemization is only available at {string.Join(" or ", RevisionStages)}. This Lump Sum Project is at '{LumpSumProject.StageName}'."
                    });

                if (LumpSumProject.Remaining <= 0m)
                    return Ok(new { Valid = false, Message = "This Lump Sum Project has no allocation left to itemize." });

                return Ok(new { Valid = true, Available = LumpSumProject.Remaining });
            }
            catch (Exception ex)
            {
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion

        #region Deletes

        /// <summary>
        /// Deletes an itemized project and RESTORES ITS COST to the parent's LS
        /// component — the inverse of the deduction itemizing made.
        ///
        /// Always a hard delete (Functions/GetProjectDeletionTier.sql rates every itemized
        /// child 'Hard', revised or not), so no row keeps its reserved Project ID.
        /// Blocked on a published project: publishing belongs to the Programs
        /// module, so a published child must be handled there.
        /// </summary>
        [HttpPost]
        [RequiresDeletionObjects]
        public async Task<IActionResult> DeleteItemizedProject([FromBody] ItemizedProjectIdDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                /*  Identified by ProjectPK alone. The old filter also demanded
                    ProjectType == "LS", which is the type of the PARENT, not of an
                    itemized child - a child is an ordinary civil-works project.
                    That filter made every delete answer "not found". */
                var Project = await _db.tProjects
                    .FirstOrDefaultAsync(x => x.ProjectPK == dto.ProjectId, cancellationToken);

                if (Project == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Project '{dto.ProjectId}' was not found.",
                        Title = "Not Found"
                    });
                }

                /*  Resolve the wallet through the PROGRAM.

                    This used to reject when Project.ParentWalletId was null. That
                    link is the legacy itemization pointer and is null on almost
                    every project now that a wallet covers its program, so the gate
                    turned every wallet row action into "not found". */
                /*  RESTORE ON DELETE.

                    "The total Allocation of the deleted itemized Projects shall be
                    added to the LS allocation" - design report section 2.6.8. The
                    parent is found through ParentProjectId; a project that was
                    never itemized simply has none, and deletes without touching
                    any allocation. */
                var LSParent = string.IsNullOrWhiteSpace(Project.ParentProjectId)
                    ? null
                    : await _db.vLumpSumSet.AsNoTracking()
                        .FirstOrDefaultAsync(x => x.ProjectId == Project.ParentProjectId, cancellationToken);

                /*  THIS ENDPOINT DELETES ITEMIZED CHILDREN, AND ONLY THOSE.

                    A project with no resolvable Lump Sum parent used to be deleted
                    here anyway — "deletes without touching any allocation". That
                    is a hole rather than a convenience: the only thing identifying
                    the target is a ProjectPK, so any project in the database could
                    be destroyed through the Lump Sum module by posting its key,
                    and with no parent there is no Lump Sum Project to run the
                    visibility gate against either. Deleting an ordinary project
                    belongs to Projects.

                    No UI path is closed by this. The child table is populated from
                    vLumpSumChildSet, which is scoped by ParentProjectId, so every
                    row it can offer has a parent by construction. */
                if (LSParent == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Project '{dto.ProjectId}' is not itemized from a Lump Sum Project. Delete it from Projects instead.",
                        Title = "Not an Itemized Project"
                    });
                }

                /*  A child is only as visible as its parent. Missing here, this
                    action let a restricted user DELETE children of a Lump Sum
                    Project in another region — the precise failure
                    AssertLumpSumVisibleAsync was written for, recurring in the two
                    actions that resolve their parent indirectly. */
                var Denied = await AssertLumpSumVisibleAsync(LSParent.Id, cancellationToken);
                if (Denied != null) return Denied;

                /*  NO PROGRAM-APPROVAL GATE HERE (rule revised 2026-09-09). Children
                    can be imported into an Approved program, so an import mistake has
                    to stay correctable; and this delete returns the child's cost to
                    the parent, the same movement Replenish makes in the other
                    direction. Only the PARENT's own delete is refused — see
                    DeleteLumpSum below. */

                /*  The parent is known only now, so the lock is taken here rather than at
                    the top: the restore below adds to the parent's LS component, the same
                    row an import deducts from and a replenish raises. Nothing of the
                    parent's has been read for a decision yet — only the child, above. */
                var Busy = await AcquireLumpSumLockAsync(LSParent.Id, cancellationToken);
                if (Busy != null) return Busy;
                // 2026-10-16: then the per-program delete lock (Shared), after the module's own lock --
                // a Delete Program of the same program never runs alongside this delete.
                await _db.AcquireProgramDeletionLockAsync(Project.ProgramFK, exclusive: false, cancellationToken);

                // LSParent is non-null from here — the refusal above guarantees it.
                decimal ReturnedAmount = 0m;
                var ChildRevisionIds = await _db.tProjectRevisions
                    .Where(x => x.ProjectFK == Project.ProjectPK && !x.IsDeleted)
                    .OrderByDescending(x => x.Id)
                    .Select(x => x.Id)
                    .Take(1)
                    .ToListAsync(cancellationToken);

                if (ChildRevisionIds.Count > 0)
                {
                    ReturnedAmount = await _db.tProjectComponentCost
                        .Where(x => x.ProjectRevisionFK == ChildRevisionIds[0] && !x.IsDeleted)
                        .SumAsync(x => (decimal?)x.Total, cancellationToken) ?? 0m;
                }

                /*  2026-10-15: THE TIER COMES FROM THE SINGLE DELETION RULE,
                    Functions/GetProjectDeletionTier.sql (documents/plans/project-deletion-single-rule.md).
                    An itemized child is ALWAYS 'Hard' there — even when revised — so no
                    row keeps holding its reserved Project ID; a published child is
                    'Blocked'. The inline "unrevised and one revision" test that used to
                    live here soft-deleted every revised child instead, and its EF
                    cascade missed work locations, supporting documents and the formal
                    revision tables. The hard cascade is now ExecuteProjectDeletion.sql, run
                    by ProjectHelper.ExecuteProjectDeletionAsync inside this action's transaction. */
                var TierRow = (await _db.DetermineProjectDeletionTierAsync(Project.ProjectPK, Project.ProgramFK, cancellationToken))
                    .FirstOrDefault(x => x.ProjectFK == Project.ProjectPK); // the PK's own row

                if (TierRow == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Project '{dto.ProjectId}' was not found.",
                        Title = "Not Found"
                    });
                }

                if (TierRow.Tier == ProjectHelper.ProjectDeletionTiers.Blocked)
                {
                    /*  PUBLISHING BELONGS TO PROGRAMS (decision 8), so that is
                        where the user is sent. This used to read "Request a
                        revision to cancel it" — the reference's WF-6 wording,
                        pointing at a workflow that left this module with decision
                        7. There is no revision to request, so the instruction was
                        not merely stale but impossible to follow. */
                    return new BadRequestObjectResult(new
                    {
                        Message = "Cannot delete a published project. Cancel it through Programs, which owns publishing.",
                        Title = "Delete Blocked"
                    });
                }

                if (TierRow.Tier != ProjectHelper.ProjectDeletionTiers.Hard)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Project '{dto.ProjectId}' cannot be deleted here ({TierRow.Reason}).",
                        Title = "Delete Blocked"
                    });
                }

                string Tier = TierRow.Tier;
                // The procedure removes the row EF is tracking; stop tracking it first.
                _db.Entry(Project).State = EntityState.Detached;
                await _db.ExecuteProjectDeletionAsync(Project.ProjectPK, Project.ProgramFK, UserId, CurrentDate, cancellationToken);
                /*  Return the allocation to the parent, and say so on the parent.
                    Done after the project rows are gone so a failure deleting the
                    child cannot leave the LS Project credited for a project that
                    still exists. */
                if (ReturnedAmount > 0m)
                {
                    var LSComponent = await _db.tProjectComponentCost
                        .Where(x => x.ProjectRevisionFK == LSParent.RevisionId
                                 && !x.IsDeleted
                                 && _db.tOptionProjectComponentType
                                       .Where(o => o.ComponentId == "LS")
                                       .Select(o => o.ComponentName)
                                       .Contains(x.ComponentType))
                        .OrderBy(x => x.Id)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (LSComponent != null)
                    {
                        /*  BALANCE ONLY. The child hands back what it drew; the allocation the
                            parent was given does not change. See LumpsumHelper's model note. */
                        await _db.MoveLSBalanceAsync(LSComponent, ReturnedAmount, UserId, CurrentDate, cancellationToken);

                        await AddProjectNoteAsync(
                            LSParent.RevisionId,
                            $"Itemized Project Allocation returned (PHP {ReturnedAmount:N2}) from Project {dto.ProjectId}",
                            UserId, CurrentDate, cancellationToken);

                        await _db.SaveChangesAsync(cancellationToken);
                    }
                }

                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    ProjectId = dto.ProjectId,
                    Tier,
                    Message = "Itemized project permanently deleted.",
                    Title = "Delete Complete"
                });
            }
            catch (ProjectHelper.DeletionRefusedException ex)
            {
                await SafeRollbackAsync(transaction, cancellationToken);
                return new BadRequestObjectResult(new { Message = ex.Reason, Title = "Delete Blocked" });
            }
            catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))
            {
                // Lost a race with another change to the same program (deadlock); nothing was written.
                await SafeRollbackAsync(transaction, cancellationToken);
                return new ConflictObjectResult(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" });
            }
            catch (Exception ex)
            {
                await SafeRollbackAsync(transaction, cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        /// <summary>
        /// Deletes a Lump Sum Project. The tier is Functions/GetProjectDeletionTier.sql's,
        /// read first:
        ///   Blocked — it is published, or its program is Approved (refused before anything else).
        ///   Hard    — still on its first stage entry; the rows are removed.
        ///   Soft    — it has progressed with its program; the revisions are flagged and kept for history.
        /// Then it is refused while a project is still itemized from it, so either
        /// non-blocked outcome leaves no orphaned children behind.
        /// </summary>
        [HttpPost]
        [RequiresDeletionObjects]
        public async Task<IActionResult> DeleteLumpSum([FromBody] DeleteLumpSumDTO dto, CancellationToken cancellationToken)
        {
            using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                DateTime CurrentDate = Functions.CurrentDate();
                string UserId = _Session.UserId;

                /*  Before the first read of the parent — see .Locking.cs. The children
                    count below is a decision about the parent, and an import committing
                    between that count and the delete would strand its new children. */
                var Busy = await AcquireLumpSumLockAsync(dto.LumpSumId, cancellationToken);
                if (Busy != null) return Busy;

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

                var Denied = await AssertLumpSumVisibleAsync(LumpSumProject.Id, cancellationToken);
                if (Denied != null) return Denied;

                // 2026-10-16: the per-program delete lock (Shared), after the module's own lock.
                await _db.AcquireProgramDeletionLockAsync(LumpSumProject.ProgramFK, exclusive: false, cancellationToken);

                /*  2026-10-15: THE TIER COMES FROM THE SINGLE DELETION RULE,
                    Functions/GetProjectDeletionTier.sql: 'Hard' only on the parent's first
                    stage entry, 'Soft' once it has progressed with its program, 'Blocked'
                    when published or when the program is Approved. 2026-10-16: the Approved
                    refusal is the tier's too -- this action no longer runs its own
                    AssertProgramNotApprovedAsync -- and is read before the live-children
                    guard so an Approved program is still the first thing reported. The
                    live-children guard below is this module's own precondition; the
                    hard/soft choice is not made here. The hard cascade runs inside this
                    action's transaction (ProjectHelper.ExecuteProjectDeletionAsync). */
                var TierRow = (await _db.DetermineProjectDeletionTierAsync(LumpSumProject.ProjectPK, LumpSumProject.ProgramFK, cancellationToken))
                    .FirstOrDefault(x => x.ProjectFK == LumpSumProject.ProjectPK); // the PK's own row

                if (TierRow == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.LumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                if (TierRow.Tier == ProjectHelper.ProjectDeletionTiers.Blocked)
                {
                    if (TierRow.ProgramApproved && !TierRow.IsPublished)
                    {
                        /*  The tier decided; this only picks the words. On a revision stage
                            the module's own "Program Approved" message names the program
                            and the stage, as CreateLumpSum's does. */
                        var Approval = await ReadProgramApprovalAsync(LumpSumProject.ProgramFK, cancellationToken);
                        return new BadRequestObjectResult(Approval != null
                            ? new
                            {
                                Message = ProgramApprovedMessage("Deleting a Lump Sum Project", Approval),
                                Title = ProgramApprovedTitle
                            }
                            : new
                            {
                                Message = "Cannot delete a Lump Sum Project in an Approved program. Set the program back to Working first.",
                                Title = "Delete Blocked"
                            });
                    }
                    return new BadRequestObjectResult(new
                    {
                        Message = "Cannot delete a published Lump Sum Project. Cancel it through Programs, which owns publishing.",
                        Title = "Delete Blocked"
                    });
                }

                /*  Children by ParentProjectId. Deleting a parent that still has
                    itemized projects would strand them pointing at nothing, and
                    their allocation would have nowhere to return to. */
                int ActiveProjects = await _db.vLumpSumChildSet
                    .AsNoTracking()
                    .CountAsync(x => x.ParentProjectId == LumpSumProject.ProjectId, cancellationToken);

                if (ActiveProjects > 0)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Cannot delete: {ActiveProjects} project(s) are still itemized from this Lump Sum Project. Remove them first.",
                        Title = "Delete Blocked"
                    });
                }

                var Project = await _db.tProjects
                    .FirstOrDefaultAsync(x => x.ProjectPK == LumpSumProject.ProjectPK, cancellationToken);

                if (Project == null)
                {
                    return new BadRequestObjectResult(new
                    {
                        Message = $"Lump Sum Project {dto.LumpSumId} was not found.",
                        Title = "Not Found"
                    });
                }

                string Tier = TierRow.Tier;
                if (Tier == ProjectHelper.ProjectDeletionTiers.Hard)
                {
                    // The procedure removes the row EF is tracking; stop tracking it first.
                    _db.Entry(Project).State = EntityState.Detached;
                    await _db.ExecuteProjectDeletionAsync(Project.ProjectPK, LumpSumProject.ProgramFK, UserId, CurrentDate, cancellationToken);
                }
                else
                {
                    /*  Soft: every revision is flagged, as before. Whether a Lump Sum
                        soft delete should flag only the current-stage revision, as
                        Batch Delete does, is OD-3 of the deletion redesign and is not
                        changed here. 2026-10-16: decided again on locked rows first, so an
                        approval or publish that landed since the read above refuses. */
                    var Locked = await _db.DecideProjectDeletionUnderLockAsync(Project.ProjectPK, LumpSumProject.ProgramFK, cancellationToken);
                    if (Locked.Tier != ProjectHelper.ProjectDeletionTiers.Soft)
                    {
                        throw new ProjectHelper.DeletionRefusedException($"Lump Sum Project {dto.LumpSumId} can no longer be deleted: {Locked.Reason}.");
                    }
                    var Revisions = await _db.tProjectRevisions
                        .Where(x => x.ProjectFK == Project.ProjectPK)
                        .ToListAsync(cancellationToken);

                    // 2026-10-15: one audit row per revision this flags (hard deletes are logged
                    // by ExecuteProjectDeletion.sql), committed with the soft delete.
                    _db.AddSoftDeleteAuditRows(
                        Revisions.Where(x => !x.IsDeleted).Select(x => (Project.ProjectPK, x.Id, (string?)null)),
                        deleted: true, UserId, CurrentDate);

                    foreach (var Revision in Revisions)
                    {
                        Revision.IsDeleted = true;
                        Revision.UpdatedBy = UserId;
                        Revision.UpdatedDate = CurrentDate;
                    }
                    /*  Nothing else needed: vLumpSumSet defines a Lump Sum
                        Project as one with a live revision, so it leaves the list
                        the moment this commits. */
                }

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return Ok(new
                {
                    LumpSumId = dto.LumpSumId,
                    Tier,
                    Message = Tier == "Hard"
                        ? "Lump Sum Project permanently deleted."
                        : "Lump Sum Project deleted and kept for history.",
                    Title = "Delete Complete"
                });
            }
            catch (ProjectHelper.DeletionRefusedException ex)
            {
                await SafeRollbackAsync(transaction, cancellationToken);
                return new BadRequestObjectResult(new { Message = ex.Reason, Title = "Delete Blocked" });
            }
            catch (Exception ex) when (ProgramHelper.IsDeadlock(ex))
            {
                // Lost a race with another change to the same program (deadlock); nothing was written.
                await SafeRollbackAsync(transaction, cancellationToken);
                return new ConflictObjectResult(new { Message = "This program was being changed at the same time. Try again.", Title = "Try Again" });
            }
            catch (Exception ex)
            {
                await SafeRollbackAsync(transaction, cancellationToken);
                return _exceptionHandler.Handle(ex, dto, _Session.UserId.ToString());
            }
        }

        #endregion
    }
}
