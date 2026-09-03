using DBHelper.Models.Table.Project;

namespace Hangfire.Importing
{
    public enum MatchOutcome
    {
        NotFound,
        Found,
        Ambiguous
    }

    // Resolves an Excel "Project ID" cell (a project's real AlternateId — or, for a project that
    // has none yet, its own permanent ProjectFK, per ExportProjectsHelper's own fallback) to the
    // existing project's ProjectFK. Built exactly once per RunImportAsync call
    // (ImportProjectJobService.cs) and shared by every place that previously re-derived this same
    // rule independently: Import/Update's own pre-checks, SaveProjectDetails, and
    // SoftDeleteProjectsByProgramStage (ImportingHelper.cs) — consolidating five separate,
    // independently-drifting copies of the same matching logic into one.
    public sealed class ProjectIdentityResolver
    {
        private readonly IReadOnlyDictionary<string, string> _knownProjectMap;
        private readonly IReadOnlyDictionary<string, string> _projectFKFallbackMap;
        private readonly HashSet<string> _ambiguousIds;

        // Program + the specific target Stage this run is operating against — NOT Program-wide
        // like the two maps above. Keyed by ProjectFK, since that's the stable identity Resolve()
        // returns; a project with no revision yet at this exact stage (e.g. it's only ever existed
        // at an earlier stage) simply has no entry here, which is exactly the "cross-stage reuse"
        // signal SaveProjectDetails needs.
        public IReadOnlyDictionary<string, (ProjectStages Stage, ProjectRevisions Revision)> CurrentStageRevisionByProjectFK { get; }

        public ProjectIdentityResolver(
            IReadOnlyDictionary<string, string> knownProjectMap,
            IReadOnlyDictionary<string, string> projectFKFallbackMap,
            HashSet<string> ambiguousIds,
            IReadOnlyDictionary<string, (ProjectStages Stage, ProjectRevisions Revision)> currentStageRevisionByProjectFK)
        {
            _knownProjectMap = knownProjectMap;
            _projectFKFallbackMap = projectFKFallbackMap;
            _ambiguousIds = ambiguousIds;
            CurrentStageRevisionByProjectFK = currentStageRevisionByProjectFK;
        }

        // Ambiguous is a genuine third outcome, not a variant of NotFound — an id present in
        // _ambiguousIds matches more than one distinct existing project (either two real
        // AlternateIds' worth of data predating the ambiguity guard, or a real AlternateId
        // colliding with a different project's ProjectFK fallback identity) and must never be
        // silently resolved to either one.
        public MatchOutcome Resolve(string projectId, out string? projectFK)
        {
            if (_ambiguousIds.Contains(projectId))
            {
                projectFK = null;
                return MatchOutcome.Ambiguous;
            }

            if (_knownProjectMap.TryGetValue(projectId, out projectFK)) return MatchOutcome.Found;
            if (_projectFKFallbackMap.TryGetValue(projectId, out projectFK)) return MatchOutcome.Found;

            projectFK = null;
            return MatchOutcome.NotFound;
        }
    }
}
