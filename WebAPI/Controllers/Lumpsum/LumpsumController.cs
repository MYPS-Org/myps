using DBHelper.Data;
using DBHelper.Models.Enums;
using Helpers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebAPI.MicroService;

namespace WebAPI.Controllers.Lumpsum
{
    /// <summary>
    /// Lump Sum module.
    ///
    /// THE MODEL. There is no wallet. A Lump Sum Project is an ordinary
    /// dbo.tProjects row that holds a dbo.tProjectComponentCost of component type
    /// 'LS'. That component's Total is the FULL allocation — always the sum of the
    /// parent's funding lines — and its single tProjectComponentCostPerYear row's
    /// Amount is the REMAINING balance (2026-09-06). Itemizing a project sets its
    /// tProjects.ParentProjectId to the Lump Sum Project's ProjectId and DEDUCTS
    /// the child's cost from that balance; deleting an itemized project ADDS it
    /// back; Replenish raises both. Every movement goes through the helpers in
    /// Helpers/LumpsumHelper.cs, and vLumpSumSet reads Remaining off the row.
    ///
    /// Reads go through four views:
    ///   vLumpSumSet                   one row per Lump Sum Project, with allocation
    ///   vLumpSumChildSet              its itemized children
    ///   vLumpSumBalance               Total / Itemized / Remaining
    ///
    /// There is NO candidates view: a Lump Sum Project is itemized into NEW
    /// projects only, never existing ones, so "projects you could attach" is not
    /// a question the business asks.
    ///
    /// NOT IN THIS MODULE:
    ///   - Publishing. Programs owns pAllowProjectPublishing / IsPublishable and
    ///     PCMA owns its own Publish. This module only READS IsPublished, and a
    ///     Lump Sum Project is never published.
    ///   - WF-6 revision/approval. The workflow does not belong here.
    ///
    /// The class is split across partial files by concern — .Reads, .Writes,
    /// .Itemization, .Import — deliberately as PARTIALS rather than separate
    /// controllers: [PermissionFilter] resolves permissions as
    /// RouteData["controller"] + "Controller", so splitting the route would orphan
    /// every grant.
    /// </summary>
    [ApiController]
    [Route("api/[controller]/[action]")]
    public partial class LumpsumController : CoreController
    {
        /*  IWebHostEnvironment is here for one reason: the itemization import writes its
            error workbook under {ContentRootPath}/Resources/Imports, the folder
            ImportingController.DownloadImportFile already serves from — same host, same
            folder, so the Program import's download link works for a Lump Sum rejection too. */
        private readonly IWebHostEnvironment _env;

        /*  A REFUSAL THAT AN ADMINISTRATOR HAS TO ACT ON LEAVES A RECORD (review,
            2026-09-10). The typed Project-ID-range catches answer the user by name
            instead of going through the exception handler — which was the only
            place the condition was ever logged. They log it here at Warning: the
            category, the user and the parent, which is what the administrator who
            widens the range needs and the toast does not carry. */
        private readonly ILogger<LumpsumController> _logger;

        public LumpsumController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler, IWebHostEnvironment env, ILogger<LumpsumController> logger) : base(db, hub, pcma, exceptionHandler)
        {
            _env = env;
            _logger = logger;
        }

        /*  The only stage at which a Lump Sum Project's allocation may be moved —
            by importing children into it, or by replenishing it. The gate is
            membership in this set, never a "from stage X onwards" threshold.

            GAA-R ONLY (client's revised business rule, 2026-09-04). TF-R and the
            Trust Fund stages were previously admitted on the strength of Design
            Report Proj-1, which lists the Add-a-Project options permitted "For
            GAA-R and TF-R stages". The client has since narrowed it to the
            Operations Guide's own wording — E.7.13's "the instance of the project
            in the corresponding 'GAA with Revisions' stage" — and Trust Fund work
            is out of scope for itemization.

            Kept as an array rather than collapsed to a single string comparison:
            every refusal message joins it, so the set can widen again without
            touching the call sites, and nothing hard-codes the stage name twice.

            REPLENISH SHARES THIS GATE (confirmed as a client business rule,
            2026-09-03). V2 first wrote it as "GAA onwards", which was wrong in
            both directions: it admitted GAA itself, where there is no revision to
            carry the top-up, and it admitted every stage above GAA-R. */
        private static readonly string[] RevisionStages = { "GAA-R" };

        /*  Marks a project as an itemized child, per Proj-1's "Project Type is
            set to 'Itemized'". Its sibling value is 'Additional'. */
        private const string ItemizationTypeItemized = "Itemized";

        /*  Proj-1: a newly itemized project is 'potential'. Proj-9 promoted it to
            'scheduled' — but Proj-9 (ScheduleItemizedProjects) is discarded, because
            the only consumer of 'scheduled' was Publish Program, and publishing left
            this module. ProjectStatus therefore never leaves 'potential' here. */
        private const string ProjectStatusPotential = "potential";

        /*  Design Report 2.6.8 specifies a deduction order for the case where the
            Lump Sum Project carries an Engineering and Administrative Overheads
            component — while stating, in the same breath and twice, that "it
            should not". We do not implement that branch. A Lump Sum Project with
            an EAO component is malformed data, and guessing which bucket to take
            the money from would hide it; ItemizeProject refuses and names the
            record instead. EAO components are identified by ID suffix, the same
            way the AIP report finds them. */
        private const string EAOComponentSuffix = "-EAO";

        #region Shared guards and lookups

        /// <summary>Is this program visible to the session's region?</summary>
        private async Task<bool> IsLumpSumVisible(string programFK, CancellationToken cancellationToken)
        {
            return await _db.fUserVisiblePrograms
                .FromSqlInterpolated($"SELECT * FROM dbo.fUserVisiblePrograms({_Session.UserId})")
                .AnyAsync(x => x.ProgramPK == programFK, cancellationToken);
        }

        /// <summary>
        /// The one row-level visibility gate, returning a ready-to-return refusal
        /// or null.
        ///
        /// Exists because the raw visibility check was applied to 7 of the 17
        /// actions in V1 and missed the rest, including every itemized-project
        /// write — so a user could act on another region's Lump Sum Project simply
        /// by posting its id. One helper, one line per call site, so the next
        /// endpoint added is harder to get wrong.
        ///
        /// Call it AFTER the record is found and BEFORE any mutation, and after
        /// any role gate, so an outsider is told they lack access rather than
        /// learning from a "not found" whether the record exists.
        /// </summary>
        private async Task<IActionResult?> AssertLumpSumVisibleAsync(int? lumpSumId, CancellationToken cancellationToken)
        {
            if (!_Session.ApplyFilter) return null;

            var Denied = new BadRequestObjectResult(new
            {
                Message = "You do not have access to this Lump Sum Project.",
                Title = "Access Denied"
            });

            if (lumpSumId == null || lumpSumId <= 0) return Denied;

            var ProgramFK = await _db.vLumpSumSet
                .AsNoTracking()
                .Where(x => x.Id == lumpSumId)
                .Select(x => x.ProgramFK)
                .FirstOrDefaultAsync(cancellationToken);

            if (string.IsNullOrWhiteSpace(ProgramFK)) return Denied;

            return await IsLumpSumVisible(ProgramFK, cancellationToken) ? null : Denied;
        }

        /// <summary>
        /// The one fact the program-approval gate reads: the program's LATEST
        /// revision, when — and only when — it is Approved at a revision stage.
        /// Null otherwise, including when the program has no revision at all:
        /// "Approved" is a positive fact, and the absence of a row cannot assert it.
        /// </summary>
        private sealed record ProgramApproval(string ProgramName, string StageName, string Status);

        /// <summary>
        /// AN APPROVED PROGRAM CLOSES THE PROJECT'S RECORD, NOT ITS MONEY
        /// (2026-09-09; narrowed the same day from a freeze of the whole module).
        ///
        /// Once a program's latest revision is Approved at GAA-R, exactly two
        /// actions are refused: CREATING a Lump Sum Project in that program, and
        /// DELETING one. Everything the client calls normal work at that stage
        /// stays available — UpdateLumpSum (which is how a Replenish and a
        /// funding-line removal reach the database), ReplenishLumpSum,
        /// ImportItemizedProjects, DeleteItemizedProject and the itemization
        /// pre-flight. The first cut of this gate refused all of them; GAA-R is
        /// precisely the stage Lump Sum work happens at, so that was wrong about
        /// the business, not merely strict.
        ///
        /// The project's own DETAILS are read-only under an approval, but that is
        /// a frontend rule — the same shape as the itemized freeze, and recorded
        /// the same way: UpdateLumpSum still accepts those fields from an API
        /// caller, and the page is what stops offering them.
        ///
        /// The rule's shape is the Project form's
        /// (ProjectForm.tsx: StageName === 'GAA-R' &amp;&amp; Status === Approved) — the
        /// stage half is this controller's own RevisionStages, so a program
        /// Approved at RBP or GAA is NOT gated, and a GAA-R program still Working is
        /// not either. It lifts when the program is set back to Working or advances
        /// (the new revision is born Working).
        ///
        /// vProgramLatest.Status is the status NAME ("Approved" / "Working"), never
        /// the code. Two guards elsewhere are dead for getting that wrong and are
        /// deliberately not copied: ProjectController compares the name column to
        /// "1", and compares EnumProgramStage.GAAR.ToString() ("GAAR") to a stage
        /// name that reads "GAA-R". Both halves here compare against the strings the
        /// view actually holds.
        ///
        /// Keyed on ProgramFK (tPrograms.ProgramPK) because every caller already has
        /// it — the vLumpSumSet row, or the tPrograms row in CreateLumpSum — so this
        /// costs one keyed read of vProgramLatest and re-reads nothing.
        /// </summary>
        private async Task<ProgramApproval?> ReadProgramApprovalAsync(string? programFK, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(programFK)) return null;

            var Latest = await _db.vProgramLatest
                .AsNoTracking()
                .Where(x => x.ProgramPK == programFK)
                .Select(x => new { x.Name, x.StageName, x.Status })
                .FirstOrDefaultAsync(cancellationToken);

            if (Latest == null) return null;

            /*  Null-tolerant on purpose: the view's DDL is not in this repo, and a
                revision with no stage row must read as "not approved", never as a
                500 across every read and write of every project in that program. */
            string Status = Latest.Status?.Trim() ?? string.Empty;
            string StageName = (Latest.StageName ?? string.Empty).Trim();

            bool Approved = string.Equals(
                Status, EnumProgramStatus.Approved.ToString(), StringComparison.OrdinalIgnoreCase);
            bool OnRevisionStage = RevisionStages.Contains(StageName);

            return Approved && OnRevisionStage
                ? new ProgramApproval(Latest.Name ?? string.Empty, StageName, Status)
                : null;
        }

        private const string ProgramApprovedTitle = "Program Approved";

        /// <summary>One sentence for every refusal and every disabled control, so they cannot drift.</summary>
        private static string ProgramApprovedMessage(string action, ProgramApproval approval) =>
            $"{action} is not available while the program is Approved at {string.Join(" or ", RevisionStages)}. "
            + $"'{approval.ProgramName}' is Approved at '{approval.StageName}'.";

        /// <summary>
        /// The program-approval gate, returning a ready-to-return refusal or null.
        ///
        /// ONE CALLER — CreateLumpSum. DeleteLumpSum takes the same refusal from the
        /// single deletion rule (Functions/GetProjectDeletionTier.sql, 2026-10-16) and
        /// only borrows ProgramApprovedMessage for its wording. Adding this to another
        /// action means re-reading the rule above: every other mutator is allowed
        /// on an Approved program by decision, and a gate here would take Replenish
        /// and the funding-line removal with it. UpdateLumpSum READS the approval
        /// (ReadProgramApprovalAsync) for a FIELD-scoped refusal of changed details
        /// and Component Cost; it is a reader, not a third caller, and its echoes
        /// and funding-line changes pass.
        ///
        /// Call it right AFTER AssertLumpSumVisibleAsync and BEFORE any stamp,
        /// stage or content check: a refused request must write nothing and stamp
        /// nothing, and an outsider must still hear "access denied" first. Where a
        /// mutator takes the applock, this runs under it — the lock-order rule
        /// (.Locking.cs) puts the parent read, and so ProgramFK, after the lock —
        /// and returning disposes the `using` transaction, which releases the
        /// transaction-owned lock. Do not copy this ordering into a method whose
        /// lock is session-owned or whose transaction is not `using`-scoped.
        /// </summary>
        private async Task<IActionResult?> AssertProgramNotApprovedAsync(string? programFK, string action, CancellationToken cancellationToken)
        {
            var Approval = await ReadProgramApprovalAsync(programFK, cancellationToken);
            if (Approval == null) return null;

            return new BadRequestObjectResult(new
            {
                Message = ProgramApprovedMessage(action, Approval),
                Title = ProgramApprovedTitle
            });
        }

        /// <summary>
        /// The LS component cost row for a Lump Sum Project's current revision —
        /// the row the allocation lives on, and the only row that moves when a
        /// project is itemized against it or an itemized project is deleted.
        /// </summary>
        /// <remarks>
        /// tProjectComponentCost.ComponentType stores the component's NAME
        /// ("Lump Sum"), not its code, so the code is resolved through
        /// tOptionProjectComponentType rather than hard-coded.
        /// </remarks>
        private async Task<DBHelper.Models.Table.Project.ProjectComponentCost?> GetLSComponentAsync(
            int revisionId, CancellationToken cancellationToken)
        {
            return await _db.tProjectComponentCost
                .Where(x => x.ProjectRevisionFK == revisionId
                         && !x.IsDeleted
                         && _db.tOptionProjectComponentType
                               .Where(o => o.ComponentId == "LS")
                               .Select(o => o.ComponentName)
                               .Contains(x.ComponentType))
                .OrderBy(x => x.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        /// <summary>
        /// Normalizes whatever the client called a component type into the stored
        /// code.
        ///
        /// Accepts the code ('CW') or the display name ('Civil Works'), because
        /// the component dialogs have historically disagreed about which one they
        /// send. Returns null for anything matching neither, so the caller can
        /// reject it by name rather than with a maximum-length complaint.
        /// </summary>
        private async Task<string?> ResolveComponentTypeAsync(string? value, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            string Candidate = value.Trim();

            var Match = await _db.tOptionProjectComponentType
                .AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.ComponentId == Candidate || x.ComponentName == Candidate,
                    cancellationToken);

            return Match?.ComponentId;
        }

        #endregion
    }
}
