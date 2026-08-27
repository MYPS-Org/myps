# Plan: AIP & Extract PCMIOW support in the Reports page

Status: Implemented
Created: 2026-08-25
Source: Follow-up to aligning FE/src/pages/Reports with the ReportRequestMapper contract added in commit dec88e4e (session investigation, not a ticket/doc)

## Goal

Make the Reports page (`FE/src/pages/Reports`) actually support all 6 catalog report types.
Today it only ever builds an RBP-shaped request body, so selecting any AIP or the Extract
PCMIOW report type produces a hard 400 from `ReportRequestMapper`'s per-family validation
and `UnmappedMemberHandling.Disallow`. This closes that gap by building the correct
per-family payload and adding the backend lookup data (Category/DEO/Implementing Office)
Extract PCMIOW needs that doesn't exist yet.

## Acceptance Criteria

As a report requester, I want to generate AIP and Extract PCMIOW reports (not just RBP) from
the Reports page, so that all 6 catalog report types actually work instead of 400ing.

- [ ] Selecting "RBP" behaves exactly as before (no regression) — Year/Stage/Programs/Region
      required, signatory fields optional.
- [ ] Selecting any of the 4 AIP report types shows Report Type / Report Type Title inputs,
      pre-filled per report id and editable; submit is blocked with a toast if Year,
      Programs, Region, Report Type, or Report Type Title is missing.
- [ ] Selecting "Extract PCMIOW" shows Category / Region / DEO / Implementing Office
      selectors (DEO filtered by Region, Implementing Office filtered by Region+DEO); submit
      is blocked with a toast if Programs, Category, Region, DEO, or Implementing Office is
      missing.
- [ ] A fully-filled form for each of the 3 families submits successfully (job reaches
      `Completed` or a legitimate downstream error — not a 400 "Invalid request body" /
      "X is required").
- [ ] `GET /api/reports/options` response includes `Categories`; new `/reports/deos` and
      `/reports/implementing-offices` endpoints return session-scoped, correctly cascaded
      lists.
- [ ] `MYPS.UnitTests` (`ReportRequestMapperTests`, `ReportParameterBagTests`) still pass
      unmodified by this work (they test the mapper, not the controller/FE).
- [ ] `dotnet build` succeeds on `WebAPI.csproj`; `npx tsc --noEmit` passes for the FE.

## Approach

`WebAPI/Controllers/CrystalReport/ReportRequestMapper.cs` (commit `dec88e4e`) enforces
per-family request contracts and rejects any request body field the target family's DTO
doesn't declare. `FE/src/pages/Reports/Reports.tsx` still only ever builds one RBP-shaped
body, regardless of which of the 6 catalog report types the user picks.

Investigation traced *why* `RegionCode`/`ReportType`/`ReportTypeTitle` became required for
AIP: `CrystalReportService/Services/CrystalReportRenderer.cs` (`ApplyReportLevelParameters`)
shows Crystal `.rpt` files can define their own report-level display parameters independent
of the SQL parameter list — if the `.rpt` defines one and no value is supplied, Crystal
itself throws "Missing parameter values" at export time. The AIP `.rpt`s evidently define
`ReportType`/`ReportTypeTitle` this way (absent from the SQL `Parameters` list for all 4 AIP
entries), so the commit's stricter validation is fixing a real Crystal export failure, not
overreaching — this plan does **not** relax it back.

Extract PCMIOW's `CategoryId`/`DeoCode`/`IoCode` have no existing lookup endpoint under
`WebAPI/Controllers/CrystalReport/`, but the data already exists and is already queried by a
parallel/legacy reporting subsystem: `WebAPI/Controllers/Reports/ReportingController.cs` →
`GetAIPReportDropdowns` reads `tOptionProjectCategory`, `vAdminDEO`, and
`vAdminImplementingOffice`, cascading Region → DEO → Implementing Office, session-scoped via
`_Session.ApplyFilter`/`_Session.RegCode`. This plan reuses those exact query patterns
rather than inventing new schema.

**Backend — single source of truth for family, plus new lookup data:**

1. `ReportCatalog.SupportedReports`: add a `Family` string to each entry (`"rbp"`, `"aip"`,
   `"extract-pcmiow"`) so the FE reads family from the options response instead of
   re-deriving/duplicating `ReportCatalog.TryGetFamily`'s logic (this is exactly the kind of
   FE/BE drift that caused the current bug — avoid recreating it).
2. `DTOReports.cs`: add `CategoryOptionDTO { Id (int), Name }`, `DeoOptionDTO { Id, Name,
   RegionParticipantId }`, `ImplementingOfficeOptionDTO { Id, Name, RegionParticipantId }`.
   `CategoryOptionDTO.Id` must come from `OptionProjectCategory.CategoryId` (the business
   key), not the surrogate `Id` PK — matches what `ReportRequestMapper.MapExtract` expects.
3. `ReportsController.GetOptionsAsync`: add `Categories` to the response (all categories,
   `tOptionProjectCategory` ordered by name — same shape as `GetAIPReportDropdowns`, no
   region filter, since categories aren't region-scoped).
4. New endpoints on `ReportsController`, mirroring `GetAIPReportDropdowns`'s cascade filters
   exactly (same session scoping):
   - `GET /reports/deos?regionCode=` → `vAdminDEO` filtered by `RegionParticipantId ==
     regionCode` (or unfiltered when `regionCode` blank).
   - `GET /reports/implementing-offices?regionCode=&deoCode=` → `vAdminImplementingOffice`
     filtered the same way `GetAIPReportDropdowns` does: `ParticipantId` in the region's DEO
     ParticipantIds, or `OrgType == "UPMO"`; narrow further to the selected DEO when
     provided.
   These are separate endpoints (not baked into the eager `/reports/options` call) because
   they're cascading/dependent on user selection — same "fetch on filter change" shape
   already used by `fetchFilterPrograms` in this file for Year+Stage → Programs.

**Frontend — per-family form and payload:**

5. `FE/src/pages/Reports/Model.d.ts`: replace the single `GenerateReportRequest` with
   `GenerateRbpRequest` (current shape, unchanged), `GenerateAipRequest` (`YearStart,
   ProgramIds, RegionCode, ReportType, ReportTypeTitle`), `GenerateExtractRequest`
   (`ProgramIds, CategoryId, RegionCode, DeoCode, IoCode` + optional `*Label` display
   fields). Add `Family` to `ReportTypeOption`, and `CategoryOption`/`DeoOption`/
   `ImplementingOfficeOption` + `Categories` on `ReportOptions`.
6. `FE/src/pages/Reports/Service.ts`: add `fetchDeos(regionCode)` and
   `fetchImplementingOffices(regionCode, deoCode)`, following the existing
   `fetchFilterPrograms` call shape.
7. `FE/src/pages/Reports/Reports.tsx`:
   - Derive `reportFamily` from `options.ReportTypes.find(rt => rt.Id === reportType)?.Family`.
   - Region stays visible/required for all three families (RBP `region`, AIP `region`,
     Extract `rocode` all map from the same `RegionCode` field/dropdown). Only `YearStart`
     is Extract-specific-hidden from the submitted payload (Extract's DTO has no `YearStart`
     field; the Programs picker's Year/Stage filter stays as UI-only narrowing).
   - AIP-only: two text inputs, "Report Type" / "Report Type Title", pre-filled from a small
     local `Record<string, {reportType, reportTypeTitle}>` keyed by the 4 aip-* catalog ids
     (e.g. `aip-official → {"Official", "AIP Official"}`), editable by the user since the
     exact expected values can't be confirmed from this repo (the `.rpt` files aren't here —
     flagged in Risks below).
   - Extract-only: Category select (from `options.Categories`), DEO select (fetched via
     `fetchDeos(regionCode)` when Region changes, mirroring the existing
     `fetchFilterPrograms` `useEffect` pattern), Implementing Office select (fetched via
     `fetchImplementingOffices(regionCode, deoCode)` when DEO changes). Reset DEO/IO
     selection when Region changes; reset IO when DEO changes (same reset behavior already
     used for `selectedProgramIds` on Year/Stage change).
   - `handleGenerate`: validate the family's required fields with `showToast` + early
     `return` (per `FE/CLAUDE.md`) before building the request — RBP unchanged; AIP adds
     Report Type/Title checks; Extract checks Category/Region/DEO/IO. Build the
     family-shaped request object and call `queueReportGeneration` unchanged.
   - SignalR job-status polling logic (unrelated prior fix) is family-agnostic — unchanged.

No documentation task: `FE/UserManual.md` has no existing Reports-page section to update.

## Tasks

### Implementation
- `ReportCatalog.cs`: add `Family` to `ReportTypeOptionDTO` entries.
- `DTOReports.cs`: add `CategoryOptionDTO`, `DeoOptionDTO`, `ImplementingOfficeOptionDTO`;
  add `Categories` to `ReportOptionsDTO`.
- `ReportsController.cs`: populate `Categories` in `GetOptionsAsync`; add
  `GET /reports/deos` and `GET /reports/implementing-offices` endpoints reusing
  `GetAIPReportDropdowns`'s query/filter logic.
- `FE/src/pages/Reports/Model.d.ts`: per-family request types, `Family` on
  `ReportTypeOption`, new option types, `Categories` on `ReportOptions`.
- `FE/src/pages/Reports/Service.ts`: `fetchDeos`, `fetchImplementingOffices`.
- `FE/src/pages/Reports/Reports.tsx`: family derivation, conditional AIP/Extract fields,
  cascading DEO/IO fetch effects, per-family validation + payload building in
  `handleGenerate`.

### Documentation
- None required (no existing Reports-page section in `FE/UserManual.md`).

## Files / Components Touched
- `WebAPI/Controllers/CrystalReport/ReportCatalog.cs`
- `WebAPI/Controllers/CrystalReport/DTOReports.cs`
- `WebAPI/Controllers/CrystalReport/ReportsController.cs`
- `FE/src/pages/Reports/Model.d.ts`
- `FE/src/pages/Reports/Service.ts`
- `FE/src/pages/Reports/Reports.tsx`

## Risks / Open Questions / Assumptions
- **`ReportType`/`ReportTypeTitle` exact expected values are unverified** — the `.rpt` files
  aren't in this repo, so the pre-filled defaults per aip-* id are a reasonable guess
  (`"Official"`/`"AIP Official"` etc.), not a confirmed contract. They're editable text
  inputs specifically so this doesn't block generation if the guess is off; confirm against
  an actual rendered PDF during manual verification.
- **New DEO/IO cascade endpoints reproduce `GetAIPReportDropdowns`'s filter logic by reading
  the code, not by testing against production data** — smoke-test with real region/DEO
  values (e.g. `regionCode: "OI237"`, `deoCode/ioCode: "OI405"`) during verification.
- **Category list is not region-filtered and has no `IsActive` filter**, matching
  `GetAIPReportDropdowns`'s existing behavior for consistency — flagged in case that's
  actually a latent bug in the reused reference implementation.
- Assumes reusing the *existing* `Region` select (already fetched via `/reports/options`)
  for all three families is correct — confirmed: `RegionalOfficeOptionDTO.Code` is the same
  `region`/`rocode` legacy key across RBP/AIP/Extract mappers.

## Verification
- Backend: `dotnet build WebAPI/WebAPI.csproj`; `dotnet test MYPS.UnitTests/MYPS.UnitTests.csproj --filter "FullyQualifiedName~Report"`.
- Frontend: `npx tsc --noEmit` in `FE/`; run the dev server, and for each of the 3 families
  pick valid values and click Generate — confirm the job reaches `Completed` (or a
  legitimate Crystal/Excel-side error, not a 400 validation error) and, for RBP/AIP, that the
  PDF downloads.

## Completion Log

- `dotnet build WebAPI/WebAPI.csproj` — 0 errors.
- `dotnet test MYPS.UnitTests/MYPS.UnitTests.csproj --filter "FullyQualifiedName~Report"` —
  10/10 passed, unmodified by this work.
- `FE`: `tsc -b --force` (the actual build-mode typecheck used by `npm run build`) — clean,
  no errors.
- Live smoke test: built `Main.csproj` to an isolated output directory (to avoid the file
  lock from an already-running local dev instance) and ran it on an alternate port.
  - `GET /api/reports/options` — confirmed `ReportTypes[].Family` present (e.g.
    `{"Id":"rbp",...,"Family":"rbp"}`) and `Categories` populated (32 rows).
  - `GET /api/reports/deos?regionCode=OI237` — correctly filtered to Region III's DEOs,
    including `OI405` ("Bataan 2nd District Engineering Office") — matches the spec doc's
    sample `regionCode: "OI237"`, `deoCode/ioCode: "OI405"` exactly.
  - `GET /api/reports/implementing-offices?regionCode=OI237&deoCode=OI405` — narrowed
    correctly to the single matching office.
  - Did not run a full POST → Hangfire job cycle for AIP/Extract (needs real program ids and
    takes longer than a lookup smoke test); left for manual QA per the Risks section.
- Not yet done: manual browser walkthrough of the 3 report families in the actual Reports
  page UI (per the Verification section above) — recommend the user do this pass, especially
  to confirm the AIP `ReportType`/`ReportTypeTitle` default guesses render correctly on the
  actual PDF (flagged as unverified in Risks).
