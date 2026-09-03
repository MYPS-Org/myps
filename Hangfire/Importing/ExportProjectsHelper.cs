using DBHelper.Data;
using DBHelper.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Globalization;

namespace Hangfire.Importing
{
    // Builds the same four Import*Excel DTO lists ValidateProjectDetails/etc. (ImportingHelper.cs)
    // consume, but populated from EXISTING DB data for a Program+Stage instead of parsed from an
    // uploaded file — the reverse direction of SaveProjectDetails/SaveComponentCost/etc. Feeding
    // these lists into ImportErrorWorkbookBuilder.Build() produces a workbook in the exact same
    // template as Download Template / the error report, pre-filled with real data, re-importable
    // via Update Project.
    public static class ExportProjectsHelper
    {
        public class ExportProjectsResult
        {
            public List<ImportProjectDetailsExcel> ProjectDetails { get; set; } = new();
            public List<ImportFundingProfileExcel> FundingProfile { get; set; } = new();
            public List<ImportComponentDetailsExcel> ComponentDetails { get; set; } = new();
            public List<ImportMajorItemsOfWorkExcel> MajorItemsOfWork { get; set; } = new();
        }

        // Date format SaveProjectDetails' StringToDate (ImportingHelper.cs) requires exactly —
        // every exported date must round-trip through that parser on re-import. Critically, "/" in
        // a .NET custom format string is NOT a literal slash — it's replaced by whatever culture's
        // date separator is in effect, and StringToDate parses with TryParseExact(...,
        // CultureInfo.InvariantCulture, ...), which expects InvariantCulture's separator ("/").
        // MYCAApprovalDate/FeasibilityDate/DetailedDesignDate (all StringToDate'd on save) must
        // therefore format with CultureInfo.InvariantCulture explicitly, not the request thread's
        // current culture — otherwise a non-"/" server culture silently embeds the wrong separator,
        // StringToDate fails to match it, and the date is silently wiped to NULL on re-import with
        // no error surfaced. ComponentDetails' StartDate/EndDate are the one exception: their save
        // path uses plain DateTime.TryParse (current-culture, lenient) on both ends, so they're
        // self-consistent without an explicit culture and are deliberately left as-is.
        private const string DateFormat = "MM/dd/yyyy";

        // en-PH: the exact culture ValidateFundingProfile/ValidateComponentDetailsCore parse
        // Amount/Cost with (decimal.TryParse(..., NumberStyles.Currency, CultureInfo.GetCultureInfo("en-PH"))).
        // Formatting with the request thread's current culture instead (plain .ToString()) would
        // silently corrupt or fail to re-parse the value on any server/thread not defaulting to
        // that exact culture — decimal separators aren't guaranteed to match.
        private static readonly CultureInfo AmountCulture = CultureInfo.GetCultureInfo("en-PH");

        // Bounded concurrency for the per-project DB calls below — a starting default, not
        // empirically tuned against this SQL Server instance's actual connection-pool limits.
        // Safe to adjust later; deliberately conservative rather than unbounded.
        private const int MaxDegreeOfParallelism = 8;

        // One project's worth of export rows, produced by a single parallel worker — kept
        // separate from ExportProjectsResult so workers never touch a shared mutable list
        // (only the final in-order flatten after the parallel loop writes into `result`).
        private sealed class ProjectExportSlice
        {
            public ImportProjectDetailsExcel? ProjectDetails { get; set; }
            public List<ImportFundingProfileExcel> FundingProfile { get; } = new();
            public List<ImportComponentDetailsExcel> ComponentDetails { get; } = new();
            public List<ImportMajorItemsOfWorkExcel> MajorItemsOfWork { get; } = new();
        }

        public static async Task<ExportProjectsResult> BuildExportData(
            MYPSDbContext db, IServiceScopeFactory serviceScopeFactory, ImportLookupCache cache, string programId, EnumProgramStage stageId, CancellationToken cancellationToken)
        {
            var result = new ExportProjectsResult();

            // Unfiltered by IsActive (unlike cache.InfraTypes/cache.ScopeOfWorks) — a project's
            // exported InfraType/WorkType text must not go blank just because that lookup value
            // was later deactivated, or the row would fail "Incorrect Infrastructure Type"/"Incorrect
            // Work Type" on re-import even though nothing about the project's own data is wrong.
            // Same reasoning as InfraNameToCode in ImportLookupCache.cs.
            var allInfraTypes = await db.tOptionInfraType.AsNoTracking().ToListAsync(cancellationToken);
            var allScopeOfWorks = await db.tOptionScopeOfWork.AsNoTracking().ToListAsync(cancellationToken);

            var programProjects = await db.fProgramProjects
                .FromSqlInterpolated($"SELECT * FROM fProgramProjects({programId}, {(int)stageId})")
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            // ExternalId lives on tProjects only — fProjectDetails doesn't expose it (unlike
            // MYId, which the function already resolves). Batched once for the whole Program+Stage
            // rather than per-project, since it's a plain keyed lookup on a real table.
            var projectPks = programProjects.Select(p => p.ProjectPK).ToList();
            var externalIdsByProjectPK = await db.tProjects.AsNoTracking()
                .Where(x => projectPks.Contains(x.ProjectPK))
                .ToDictionaryAsync(x => x.ProjectPK, x => x.ExternalId, cancellationToken);

            // Each project's 6 DB calls run concurrently, one MYPSDbContext per worker (a single
            // context can't be shared across concurrent operations) — bounded so this doesn't open
            // unbounded simultaneous connections. Results are written into an indexed array, not
            // appended directly, so flattening afterward preserves programProjects' original order
            // regardless of which worker finishes first.
            var slices = new ProjectExportSlice?[programProjects.Count];

            await Parallel.ForEachAsync(
                Enumerable.Range(0, programProjects.Count),
                new ParallelOptions { MaxDegreeOfParallelism = MaxDegreeOfParallelism, CancellationToken = cancellationToken },
                async (i, ct) =>
                {
                    var projectFK = programProjects[i].ProjectPK;

                    // Own DI scope per worker — MYPSDbContext is scoped/pooled (Main/ServiceRegistration.cs),
                    // so a fresh scope hands back a distinct pooled instance, safe for concurrent use
                    // alongside every other worker's own scope. Disposing the scope returns its
                    // context to the pool.
                    using var scope = serviceScopeFactory.CreateScope();
                    var projectDb = scope.ServiceProvider.GetRequiredService<MYPSDbContext>();

                    var details = await projectDb.fProjectDetails
                        .FromSqlInterpolated($"SELECT * FROM fProjectDetails({projectFK}, {(int)stageId})")
                        .AsNoTracking()
                        .FirstOrDefaultAsync(ct);
                    if (details == null) return;

                    // The Excel-facing "Project ID" column is AlternateId when set — falling back to
                    // projectFK (the real tProjects.ProjectPK / tProjectRevisions.ProjectFK, the
                    // permanent identity — NOT details.ProjectId, which is a different, unrelated
                    // field fProjectDetails happens to also expose: confirmed by direct query that it
                    // does not equal ProjectFK, e.g. "P01100005LZ" vs the real "BP01100005LZ") for a
                    // project that was never round-tripped through Excel import before. Safe to do
                    // only because SaveProjectDetails/RunImportAsync (ImportingHelper.cs,
                    // ImportProjectJobService.cs) now recognize ProjectFK as a fallback match for a
                    // no-AlternateId project and self-heal AlternateId on first successful Update —
                    // without that, this fallback would let a re-uploaded Import silently create a
                    // duplicate project instead of being recognized.
                    // "No AlternateId" is stored as an empty string on tProjectRevisions, not NULL —
                    // fProjectDetails passes that through as-is, so this must check IsNullOrEmpty, not
                    // just null (a plain `?? ` here would never trigger and this would stay blank).
                    var alternateId = string.IsNullOrEmpty(details.AlternateId) ? projectFK : details.AlternateId;

                    var componentCosts = await projectDb.fProjectComponentCost
                        .FromSqlInterpolated($"SELECT * FROM fProjectComponentCost({projectFK}, {(int)stageId})")
                        .AsNoTracking()
                        .ToListAsync(ct);
                    var componentCostYears = await projectDb.fProjectComponentCostPerYear
                        .FromSqlInterpolated($"SELECT * FROM fProjectComponentCostPerYear({projectFK}, {(int)stageId})")
                        .AsNoTracking()
                        .ToListAsync(ct);

                    // UACS is entered once on Project Details and fanned out onto every
                    // ComponentCostPerYear row at save time (SaveComponentCostPerYear's Uacs
                    // parameter — see ImportProjectJobService.cs), not stored on Project Details
                    // itself. Every row for this project should carry the same value, so the first
                    // non-blank one found is this project's UACS.
                    var uacs = componentCostYears.Select(x => x.UACS).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
                    externalIdsByProjectPK.TryGetValue(projectFK, out var externalId);

                    var slice = new ProjectExportSlice
                    {
                        ProjectDetails = MapProjectDetails(details, alternateId, externalId, uacs, cache)
                    };

                    var funding = await projectDb.fProjectFundingProfile
                        .FromSqlInterpolated($"SELECT * FROM fProjectFundingProfile({projectFK}, {(int)stageId})")
                        .AsNoTracking()
                        .ToListAsync(ct);
                    foreach (var f in funding)
                        slice.FundingProfile.Add(MapFundingProfile(f, alternateId, cache));

                    var majorWorkItems = await projectDb.fProjectMajorWorkItem
                        .FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkItem({projectFK}, {(int)stageId})")
                        .AsNoTracking()
                        .ToListAsync(ct);
                    var majorWorkLocations = await projectDb.fProjectMajorWorkLocations
                        .FromSqlInterpolated($"SELECT * FROM fProjectMajorWorkLocations({projectFK}, {(int)stageId})")
                        .AsNoTracking()
                        .ToListAsync(ct);

                    // One ComponentDetails row per (Component, Year) — mirrors SaveComponentCostPerYear,
                    // which is exactly what a "Component Details" Excel row represents (the per-year
                    // split, later re-consolidated into one tProjectComponentCost on save). InfraType/
                    // WorkTypeId aren't stored on ComponentCost itself — they live on the Major Work
                    // Items that share this ComponentId (SaveMajorItemsOfWork copies them from the
                    // Component's own classification), so a representative one is used to resolve them.
                    foreach (var cy in componentCostYears)
                    {
                        var cost = componentCosts.FirstOrDefault(c => c.Id == cy.ComponentCostFK);
                        if (cost == null) continue;

                        var repWorkItem = majorWorkItems.FirstOrDefault(w => ImportingHelper.NamesMatch(w.ComponentId, cost.ComponentId));
                        var infraName = repWorkItem != null
                            ? allInfraTypes.FirstOrDefault(it => string.Equals(it.InfraCode, repWorkItem.InfraTypeFK, StringComparison.OrdinalIgnoreCase))?.InfraName
                            : null;
                        var workTypeDescription = repWorkItem != null
                            ? allScopeOfWorks.FirstOrDefault(s => s.Enum == repWorkItem.WorkTypeFK)?.Description
                            : null;

                        slice.ComponentDetails.Add(new ImportComponentDetailsExcel
                        {
                            ProjectId = alternateId,
                            ComponentType = cost.ComponentType,
                            ComponentId = cost.ComponentId,
                            Description = cost.Description,
                            Cost = cy.Amount.ToString(AmountCulture),
                            StartDate = cy.StartDate?.ToString(DateFormat),
                            EndDate = cy.EndDate?.ToString(DateFormat),
                            InfraType = infraName ?? string.Empty,
                            WorkTypeId = workTypeDescription ?? string.Empty,
                            ActiveYear = cy.Year.ToString()
                        });
                    }

                    // One MajorItemsOfWork row per Work Location, joined back to its parent Work Item
                    // for ActivityYear. TargetUnit is already resolved to display text by
                    // fProjectMajorWorkLocations itself — no cache lookup needed there.
                    foreach (var loc in majorWorkLocations)
                    {
                        var workItem = majorWorkItems.FirstOrDefault(w => w.Id == loc.WorkItemFK);
                        if (workItem == null) continue;

                        slice.MajorItemsOfWork.Add(new ImportMajorItemsOfWorkExcel
                        {
                            ProjectId = alternateId,
                            ComponentId = loc.ComponentId,
                            ReferenceId = $"{alternateId}-{loc.ComponentId}",
                            InfrastructureId = loc.InfraId,
                            DetailsScope = loc.DetailedScope,
                            TargetUnit = loc.TargetUnit,
                            StartX = loc.StartX?.ToString(CultureInfo.InvariantCulture),
                            StartY = loc.StartY?.ToString(CultureInfo.InvariantCulture),
                            EndX = loc.EndX?.ToString(CultureInfo.InvariantCulture),
                            EndY = loc.EndY?.ToString(CultureInfo.InvariantCulture),
                            PhysicalTarget = loc.PhysicalTarget?.ToString(CultureInfo.InvariantCulture),
                            StartStation = loc.StartStationLimit,
                            EndStation = loc.EndStationLimit,
                            StartChainage = loc.StartChainage?.ToString(CultureInfo.InvariantCulture),
                            EndChainage = loc.EndChainage?.ToString(CultureInfo.InvariantCulture),
                            Length = loc.Length?.ToString(CultureInfo.InvariantCulture),
                            ActivityYear = workItem.YearOfWork.ToString()
                        });
                    }

                    slices[i] = slice;
                });

            // Flatten in original order — never scrambled by whichever worker finished first.
            foreach (var slice in slices)
            {
                if (slice?.ProjectDetails == null) continue;
                result.ProjectDetails.Add(slice.ProjectDetails);
                result.FundingProfile.AddRange(slice.FundingProfile);
                result.ComponentDetails.AddRange(slice.ComponentDetails);
                result.MajorItemsOfWork.AddRange(slice.MajorItemsOfWork);
            }

            return result;
        }

        // The reverse of ValidateProjectDetails/SaveProjectDetails (ImportingHelper.cs): that
        // method resolves Excel display text -> stored codes/IDs; this resolves the stored
        // codes/IDs back to the same display text, via the same ImportLookupCache lists.
        // Category/Thrust/Origin/Agency/Tier/RegionWide/ImplementationMode/EmergencyMode/
        // Feasibility/DetailedDesign are already resolved to *Name fields by fProjectDetails
        // itself — only the admin-area fields (stored as codes/ParticipantIds) need a cache lookup.
        private static ImportProjectDetailsExcel MapProjectDetails(
            DBHelper.Models.Functions.Project.ProjectDetails details, string alternateId, string? externalId, string? uacs, ImportLookupCache cache)
        {
            var region = cache.Regions.FirstOrDefault(x => x.ParticipantId == details.Region);
            var province = cache.Provinces.FirstOrDefault(x => x.Code == details.Province);
            var city = cache.Cities.FirstOrDefault(x => x.Code == details.City);
            var district = cache.Districts.FirstOrDefault(x => x.Code == details.LegislativeDistrict);
            var deo = cache.DEOs.FirstOrDefault(x => x.ParticipantId == details.DEO);
            var operatingUnit = cache.OperatingUnits.FirstOrDefault(x => x.ParticipantId == details.OperatingUnit);
            var implementingOffice = cache.ImplementingOffices.FirstOrDefault(x => x.ParticipantId == details.ImplementingOffice);

            return new ImportProjectDetailsExcel
            {
                ProjectId = alternateId,
                MYId = details.MYId,
                ExternalId = externalId,
                UACS = uacs,
                MYCAApprovalDate = details.MYCAApprovalDate?.ToString(DateFormat, CultureInfo.InvariantCulture),
                Description = details.Description,
                Province = province?.Name ?? string.Empty,
                City = city?.Name ?? string.Empty,
                LegislativeDistrict = district?.Name ?? string.Empty,
                OperatingUnit = operatingUnit?.Name ?? string.Empty,
                ImplementingOffice = implementingOffice?.Name ?? string.Empty,
                DEO = deo?.Name ?? string.Empty,
                Region = region?.Name ?? string.Empty,
                Category = details.CategoryName ?? string.Empty,
                Thrust = details.ThrustName ?? string.Empty,
                Origin = details.OriginName ?? string.Empty,
                Agency = details.AgencyName ?? string.Empty,
                ImplementationMode = details.ImplementationModeName ?? string.Empty,
                EmergencyMode = details.EmergencyModeName ?? string.Empty,
                Feasibility = details.FeasibilityName ?? string.Empty,
                FeasibilityDate = details.FeasibilityDate?.ToString(DateFormat, CultureInfo.InvariantCulture),
                DetailedDesign = details.DetailedDesignName ?? string.Empty,
                DetailedDesignDate = details.DetailedDesignDate?.ToString(DateFormat, CultureInfo.InvariantCulture),
                RowAvailable = details.RowAvailableName ?? string.Empty,
                RegionWide = details.RegionWideName ?? string.Empty,
                Tier = details.TierName ?? string.Empty,
                Rank = details.Rank?.ToString(CultureInfo.InvariantCulture)
            };
        }

        private static ImportFundingProfileExcel MapFundingProfile(
            DBHelper.Models.Functions.Project.ProjectFundingProfile funding, string alternateId, ImportLookupCache cache)
        {
            var source = cache.FundingSources.FirstOrDefault(x => x.Organization == funding.SourceOrg);
            var agreement = cache.FundingAgreements.FirstOrDefault(x => x.Code == funding.AgreementCode);

            return new ImportFundingProfileExcel
            {
                ProjectId = alternateId,
                Source = source?.Name ?? string.Empty,
                Agreement = agreement?.Name ?? string.Empty,
                Percentage = funding.Percentage,
                Amount = funding.Amount.ToString(AmountCulture)
            };
        }
    }
}
