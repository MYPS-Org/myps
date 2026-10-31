using Dapper;
using DBHelper.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Helpers.MultiYear
{
    /// <summary>
    /// The annual-program entries of multi-year projects: every live project revision, in an annual
    /// stage (RBP, BP ... GAA-R), whose project's Multi Year ID (tProjects.MYId) is an MY id. That
    /// field is how a planning project is followed through the annual track: an RBP program never
    /// advances, and export, import and the project form carry the Multi Year ID from one program to
    /// the next (documents/plans/multi-year-phase-2-annual-program-linking.md).
    ///
    /// Read only. One row per program stage the project revision sits in; Amount is the revision's
    /// cost for the program's own year (MY-PRJ-08: a year belongs to the program whose start year it
    /// is). Withdrawn: a Non-Implementable (8) or Termination with No Disbursements (9, reason 37)
    /// revision of the project is fully approved (RO and CO, dbo.fRevisionApprovalStatus).
    /// </summary>
    public static class AnnualEntries
    {
        public const int GaaStageId = 6;
        public const int GaaRStageId = 7;
        public const int ApprovedStatus = 1;
        public const int NonImplementableGroup = 8;
        public const int TerminationGroup = 9;
        public const int NoDisbursementReason = 37;

        public sealed class Row
        {
            public string MyId { get; set; } = string.Empty;
            public string ProgramFK { get; set; } = string.Empty;
            public string ProgramName { get; set; } = string.Empty;
            public int Year { get; set; }
            public int StageId { get; set; }
            public string StageName { get; set; } = string.Empty;
            public decimal StageHierarchy { get; set; }
            public int ProgramStatus { get; set; }
            public string ProjectFK { get; set; } = string.Empty;
            public string ProjectId { get; set; } = string.Empty;
            public int RevisionId { get; set; }
            /// <summary>The project's latest stage in this program.</summary>
            public bool IsLatest { get; set; }
            public bool Withdrawn { get; set; }
            public decimal Amount { get; set; }

            /// <summary>An approved GAA or GAA-R stage.</summary>
            public bool IsApprovedGaa => StageId is (GaaStageId or GaaRStageId) && ProgramStatus == ApprovedStatus;
        }

        // RBP (8) and BP (1) ... GAA-R (7). The legacy RDIP / PIP stages and the Trust Fund track are
        // not annual budget entries of a planning project. RECOMPILE: the optional year filters gave
        // one plan for every case, 8.7 s on local myps_db_dev against 53 ms with it. Few projects carry
        // an MY id, so the ids are filtered in memory rather than through OPENJSON (1.4 s).
        private const string Sql = """
            SELECT x.MyId, x.ProgramFK, x.ProgramName, x.[Year], x.StageId, x.StageName, x.StageHierarchy, x.ProgramStatus,
                   x.ProjectFK, x.ProjectId, x.RevisionId, x.IsLatest, x.Withdrawn,
                   ISNULL((SELECT SUM(y.Amount)
                           FROM dbo.tProjectComponentCost c
                           JOIN dbo.tProjectComponentCostPerYear y ON y.ComponentCostFK = c.Id AND y.IsDeleted = 0 AND y.[Year] = x.[Year]
                           WHERE c.ProjectRevisionFK = x.RevisionId AND c.IsDeleted = 0), 0) AS Amount
            FROM (
                SELECT UPPER(LTRIM(RTRIM(prj.MYId))) AS MyId, p.ProgramPK AS ProgramFK, pr.Name AS ProgramName, p.StartYear AS [Year],
                       ps.StageId, ps.StageName, st.StageHierarchy, CAST(pr.Status AS int) AS ProgramStatus,
                       r.ProjectFK, r.ProjectId, r.Id AS RevisionId,
                       CAST(CASE WHEN ROW_NUMBER() OVER (PARTITION BY p.ProgramPK, r.ProjectFK ORDER BY st.StageHierarchy DESC, ps.Id DESC) = 1 THEN 1 ELSE 0 END AS bit) AS IsLatest,
                       CAST(CASE WHEN EXISTS (
                           SELECT 1 FROM dbo.tRevisionDetails rd
                           CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) a
                           WHERE rd.ProjectFK = r.ProjectFK
                             AND (rd.RevisionGroupId = 8 OR (rd.RevisionGroupId = 9 AND rd.ReasonId = 37))
                             AND a.IsFullyApproved = 1) THEN 1 ELSE 0 END AS bit) AS Withdrawn
                FROM dbo.tProjects prj
                JOIN dbo.tProjectRevisions r ON r.ProjectFK = prj.ProjectPK AND r.IsDeleted = 0
                JOIN dbo.tProjectStages s ON s.RevisionId = r.Id
                JOIN dbo.tProgramStages ps ON ps.ProgramFK = s.ProgramFK AND ps.StageId = s.StageId
                JOIN dbo.tProgramRevisions pr ON pr.Id = ps.RevisionId
                JOIN dbo.tPrograms p ON p.ProgramPK = ps.ProgramFK AND p.IsDeleted = 0
                JOIN dbo.tOptionProgramStage st ON st.Id = ps.StageId
                WHERE prj.MYId IS NOT NULL AND LTRIM(RTRIM(prj.MYId)) LIKE N'MY%'
                  AND ps.StageId IN (1, 2, 3, 4, 5, 6, 7, 8)
                  AND (@FromYear IS NULL OR p.StartYear >= @FromYear)
                  AND (@ToYear IS NULL OR p.StartYear <= @ToYear)
            ) x
            OPTION (RECOMPILE);
            """;

        /// <summary>
        /// The entries of <paramref name="myIds"/> (every MY id when null), for programs whose year is
        /// within <paramref name="fromYear"/>..<paramref name="toYear"/> (open when null). Rows whose
        /// Multi Year ID is not a well-formed MY id are left out. Runs on the context's connection and
        /// transaction.
        /// </summary>
        public static async Task<List<Row>> LoadAsync(MYPSDbContext db, IReadOnlyCollection<string>? myIds, int? fromYear, int? toYear, CancellationToken ct)
        {
            if (myIds != null && myIds.Count == 0) return new();
            var wanted = myIds?.Select(id => id.Trim().ToUpperInvariant()).ToHashSet();
            var rows = await db.Database.GetDbConnection().QueryAsync<Row>(new CommandDefinition(
                Sql,
                new { FromYear = fromYear, ToYear = toYear },
                transaction: db.Database.CurrentTransaction?.GetDbTransaction(),
                commandTimeout: 300,
                cancellationToken: ct));
            return rows.Where(r => PipRules.AsMyId(r.MyId) != null && (wanted == null || wanted.Contains(r.MyId)))
                .GroupBy(r => (r.ProgramFK, r.ProjectFK, r.StageId))
                .Select(g => g.First())
                .ToList();
        }
    }
}
