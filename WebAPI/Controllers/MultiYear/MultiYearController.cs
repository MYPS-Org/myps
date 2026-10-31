using DBHelper.Data;
using DBHelper.Models.Enums;
using DBHelper.Models.Table.MultiYear;
using Helpers;
using Helpers.MultiYear;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WebAPI.MicroService;

namespace WebAPI.Controllers.MultiYear
{
    /// <summary>
    /// The Multi-Year module. Phase 1 (documents/plans/multi-year-phase-1-portfolio-module.md):
    /// RDIP, UDIP and PIP portfolios over fixed six-year terms, the lasting record of each multi-year
    /// planning project, its memberships and its planned yearly costs. Phase 2
    /// (documents/plans/multi-year-phase-2-annual-program-linking.md): Propose to RBP / UBP, Add to
    /// PIP, the portfolio update after a GAA approval, the planning-project import and saved totals.
    ///
    /// It reads the shared lookups and, since Phase 2, the annual programs (AnnualEntries); it writes
    /// the tMultiYear* and Multi-Year tOption* tables, and -- only through Propose to RBP -- one new
    /// annual project in an RBP program, the way Add Project and Create Lump Sum write one. The
    /// portfolio update runs from ProgramController and RevisionController after an approval has
    /// committed (Helpers/MultiYear/PortfolioGaaUpdate.cs).
    ///
    /// NOTHING IS DELETED. Portfolios are never deleted (MY-PFL-07); a wrong planning project is
    /// cancelled; a planned year taken off a project is marked Superseded and kept as history; a
    /// code-list value is retired with Active / Valid To.
    ///
    /// EVERY ACTION, in this order: find the record, check the caller can see its portfolio
    /// (MultiYearAccess, 403), check the term is Open for a write, then the rule helpers in
    /// Helpers/MultiYear. Grants are per action ([PermissionFilter] on CoreController); who sees which
    /// portfolio is the group's Project visibility, never its name.
    ///
    /// Split across partials (.Portfolios, .Projects, .CodeLists) rather than controllers because
    /// grants are keyed on the controller name.
    /// </summary>
    [ApiController]
    [Route("api/[controller]/[action]")]
    public partial class MultiYearController : CoreController
    {
        public MultiYearController(MYPSDbContext db, IHubContext<SignalRHub> hub, PCMADbContext pcma, IMYPSExceptionHandler exceptionHandler) : base(db, hub, pcma, exceptionHandler) { }

        private const string PortfolioNotFoundMessage = "This portfolio could not be found. Reload the Portfolios list and open it again.";
        private const string ProjectNotFoundMessage = "This multi-year project could not be found. Reload the portfolio and open it again.";
        private const string MembershipNotFoundMessage = "This project's membership could not be found. Reload the portfolio and open it again.";
        private const string CivilWorksComponentId = "CW1";
        private const string CivilWorksComponentType = "Civil Works";

        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = null };

        #region Shared guards

        private MultiYearAccess.PortfolioVisibility? _visibility;

        /// <summary>The caller's portfolio visibility, read once per request.</summary>
        private async Task<MultiYearAccess.PortfolioVisibility> VisibilityAsync(CancellationToken ct) =>
            _visibility ??= await MultiYearAccess.ResolveAsync(_db, _Session, ct);

        /// <summary>The body of every refusal here: { Message, Title }, as the rest of the API answers.</summary>
        public sealed record RefusalBody(string Message, string Title);

        private ObjectResult Denied(string what) =>
            StatusCode(StatusCodes.Status403Forbidden, new RefusalBody($"You do not have access to {what}.", "Access Denied"));

        private static BadRequestObjectResult Refused(string title, string message) =>
            new(new RefusalBody(message, title));

        /// <summary>The message of a refusal made by <see cref="Refused"/> or <see cref="Denied"/>: the
        /// import reports each row's refusal by it.</summary>
        private static string RefusalMessage(IActionResult refusal) =>
            refusal is ObjectResult { Value: RefusalBody body } ? body.Message : "The row could not be added.";

        private Dictionary<string, string>? _ownerNames;

        /// <summary>Region and PMO cluster office names by ParticipantId (a few dozen rows).</summary>
        private async Task<Dictionary<string, string>> OwnerNamesAsync(CancellationToken ct)
        {
            if (_ownerNames != null) return _ownerNames;
            var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in await _db.tOptionAdminAreaRegion.AsNoTracking().Select(r => new { r.ParticipantId, r.Name }).ToListAsync(ct))
                names[r.ParticipantId] = r.Name;
            foreach (var c in await _db.vAdminPMOCluster.AsNoTracking().Select(c => new { c.ParticipantId, c.Name }).ToListAsync(ct))
                names[c.ParticipantId] = c.Name;
            return _ownerNames = names;
        }

        private async Task<string?> OwnerNameAsync(string? owner, CancellationToken ct) =>
            owner == null ? null : (await OwnerNamesAsync(ct)).TryGetValue(owner, out var name) ? name : owner;

        private async Task<string> PortfolioNameAsync(MultiYearPortfolio p, CancellationToken ct) =>
            PortfolioTermRules.PortfolioName(p.Kind, await OwnerNameAsync(p.OwnerParticipantId, ct), p.TermStartYear);

        /// <summary>
        /// The portfolio when the caller can see it -- and, for a write, when its term is Open.
        /// Otherwise the refusal to return: 400 not found, 403 not visible, 400 term closed.
        /// </summary>
        private async Task<(MultiYearPortfolio? Portfolio, IActionResult? Refusal)> LoadPortfolioAsync(int portfolioId, bool forWrite, CancellationToken ct, bool tracked = false)
        {
            var query = tracked ? _db.tMultiYearPortfolio : _db.tMultiYearPortfolio.AsNoTracking();
            var portfolio = await query.FirstOrDefaultAsync(p => p.Id == portfolioId, ct);
            if (portfolio == null)
                return (null, Refused("Portfolio Not Found", PortfolioNotFoundMessage));
            if (!(await VisibilityAsync(ct)).CanSee(portfolio.Kind, portfolio.OwnerParticipantId))
                return (null, Denied("this portfolio"));
            if (forWrite && PortfolioTermRules.WriteRefusal(portfolio.Status, portfolio.TermStartYear) is string closed)
                return (null, Refused("Term Closed", closed));
            return (portfolio, null);
        }

        /// <summary>
        /// A membership (tracked, for a write) with its portfolio, under the same checks; a write also
        /// needs the membership to be neither completed nor cancelled (MY-PFL-13).
        /// </summary>
        private async Task<(MultiYearPortfolioMember? Member, MultiYearPortfolio? Portfolio, IActionResult? Refusal)> LoadMemberAsync(int memberId, bool forWrite, CancellationToken ct)
        {
            var member = await _db.tMultiYearPortfolioMember.FirstOrDefaultAsync(m => m.Id == memberId, ct);
            if (member == null)
                return (null, null, Refused("Not Found", MembershipNotFoundMessage));
            var (portfolio, refusal) = await LoadPortfolioAsync(member.PortfolioFK, forWrite, ct);
            if (refusal != null)
                return (null, null, refusal);
            return (member, portfolio, null);
        }

        #endregion

        #region Code-list rules shared by add, edit and membership

        /// <summary>A planning code-list value can be picked when it is Active OR valid for the year
        /// (0 = open), the rule the Sub-Category list already uses (#482, #488).</summary>
        private static bool Selectable(MultiYearCodeListItem item, int year) =>
            ProjectHelper.ThrustIsSelectable(item.IsActive, item.ValidFromYear, item.ValidToYear, year);

        internal static List<int> ReadIds(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new();
            try { return JsonSerializer.Deserialize<List<int>>(json, JsonOptions) ?? new(); }
            catch (JsonException) { return new(); }
        }

        internal static List<RdpPickDTO> ReadRdp(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new();
            try { return JsonSerializer.Deserialize<List<RdpPickDTO>>(json, JsonOptions) ?? new(); }
            catch (JsonException) { return new(); }
        }

        private sealed record MembershipFields(int? BasisFK, int? NedaFK, string ReadinessJson, string RdpJson, int? Tier, decimal? McaScore);

        /// <summary>
        /// The membership's planning fields (MY-PFL-14, -15), judged for <paramref name="year"/>. A value
        /// already on <paramref name="previous"/> is kept even once retired; a NEW pick must be
        /// selectable, as the retired-lookup rule does elsewhere (#479-#482).
        /// </summary>
        private async Task<(MembershipFields? Fields, IActionResult? Refusal)> ValidateMembershipFieldsAsync(
            MembershipFieldsDTO dto, MultiYearPortfolioMember? previous, int year, CancellationToken ct)
        {
            if (dto.BasisForImplementationId is int basisId && basisId != previous?.BasisForImplementationFK)
            {
                var basis = await _db.tOptionBasisForImplementation.AsNoTracking().FirstOrDefaultAsync(x => x.Id == basisId, ct);
                if (basis == null || !Selectable(basis, year))
                    return (null, Refused("Invalid Basis for Implementation", "The selected Basis for Implementation is not valid for the project's start year."));
            }
            if (dto.NedaProjectStatusId is int nedaId && nedaId != previous?.NedaProjectStatusFK)
            {
                var neda = await _db.tOptionNedaProjectStatus.AsNoTracking().FirstOrDefaultAsync(x => x.Id == nedaId, ct);
                if (neda == null || !Selectable(neda, year))
                    return (null, Refused("Invalid NEDA Project Status", "The selected NEDA Project Status is not valid for the project's start year."));
            }

            var readiness = (dto.ReadinessLevelIds ?? new()).Distinct().OrderBy(x => x).ToList();
            var keptReadiness = ReadIds(previous?.ReadinessLevelIds).ToHashSet();
            var newReadiness = readiness.Where(id => !keptReadiness.Contains(id)).ToList();
            if (newReadiness.Count > 0)
            {
                var rows = await _db.tOptionReadinessLevel.AsNoTracking().Where(x => newReadiness.Contains(x.Id)).ToListAsync(ct);
                if (rows.Count != newReadiness.Count || rows.Any(r => !Selectable(r, year)))
                    return (null, Refused("Invalid Readiness Level", "A selected Readiness Level is not valid for the project's start year."));
            }

            var rdp = dto.RdpOutcomes ?? new();
            if (rdp.GroupBy(p => p.OutcomeId).Any(g => g.Count() > 1))
                return (null, Refused("Invalid RDP Results Matrix", "Choose one output for each RDP outcome."));
            var keptRdp = ReadRdp(previous?.RdpOutcomes).Select(p => (p.OutcomeId, p.OutputId)).ToHashSet();
            var newRdp = rdp.Where(p => !keptRdp.Contains((p.OutcomeId, p.OutputId))).ToList();
            if (newRdp.Count > 0)
            {
                var outcomeIds = newRdp.Select(p => p.OutcomeId).ToList();
                var outputIds = newRdp.Select(p => p.OutputId).ToList();
                var outcomes = await _db.tOptionRdpOutcome.AsNoTracking().Where(x => outcomeIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
                var outputs = await _db.tOptionRdpOutput.AsNoTracking().Where(x => outputIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
                foreach (var pick in newRdp)
                {
                    if (!outcomes.TryGetValue(pick.OutcomeId, out var outcome) || !Selectable(outcome, year)
                        || !outputs.TryGetValue(pick.OutputId, out var output) || !Selectable(output, year)
                        || output.OutcomeFK != pick.OutcomeId)
                        return (null, Refused("Invalid RDP Results Matrix", "A selected RDP outcome or output is not valid for the project's start year, or the output does not belong to its outcome."));
                }
            }

            if (dto.Tier is int tier && tier != previous?.Tier
                && !await _db.tOptionProjectTier.AsNoTracking().AnyAsync(t => t.NameId == tier, ct))
                return (null, Refused("Invalid Tier", $"Selected Tier '{tier}' is not valid."));
            if (dto.McaScore is decimal mca && (mca < 0 || mca > 100))
                return (null, Refused("Invalid MCA Score", "MCA Score must be between 0 and 100."));

            return (new MembershipFields(
                dto.BasisForImplementationId,
                dto.NedaProjectStatusId,
                JsonSerializer.Serialize(readiness, JsonOptions),
                JsonSerializer.Serialize(rdp.OrderBy(p => p.OutcomeId).ToList(), JsonOptions),
                dto.Tier,
                dto.McaScore is decimal m ? Math.Round(m, 4) : null), null);
        }

        #endregion
    }
}
