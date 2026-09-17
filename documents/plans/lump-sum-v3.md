# Plan: Lump Sum V3 — itemization import shares the Importing module's template, validators and error workbook

Status: Implemented (2026-09-05; see Completion Log — one pre-existing conflict flagged, not fixed).
**The import work below still describes what ships. The module around it has moved on — see
"The module since this plan" at the end for the current state as of 2026-09-10.**
Created: 2026-09-05
Last brought up to date: 2026-09-10
Source: `documents/plans/lump-sum-v2.md`; `documents/plans/lump-sum-import-validation-parity.md`
(prior attempt, code reverted); the dev-trunk rebase review
(`documents/docs/engineering/MYPS_DEV_TRUNK_REBASE_REVIEW_2026-09-05.md`); a read of both import
pipelines on the rebased tree.

## Context

`ImportItemizedProjects` ([LumpsumController.Import.cs](../../WebAPI/Controllers/Lumpsum/LumpsumController.Import.cs))
is the only itemization path Lump Sum V2 ships (decision 11: a Lump Sum Project is itemized into
NEW projects only). Every accepted row becomes a real `tProjects` row with revision, stage,
funding profile, component costs, per-year rows and major items of work — the same eight entity
families the Program-level importer writes. The two paths validate to different standards:

| | Program importer (`ImportingController` → `ImportProjectJobService`) | Lump Sum import |
|---|---|---|
| Input | the `Download Template` `.xlsm`, uploaded, read server-side by EPPlus | the same workbook, parsed in the **browser** by SheetJS, regrouped by `transformImportedChildren.ts`, posted as JSON |
| File gates | `_SysMeta` marker, 4 sheets present, header row exact-match | browser-only `_ImportStatus` check that **no backend writes** — both dialogs reject their own template today |
| Validation | ~100 rules in `ImportingHelper`'s four validators + 7 structural rules in `FinalizeErrors`, all before any write | 23 checks interleaved with writes; resolvers absorb bad values (`Tier ?? 1`, `Origin ?? 0`, `Agency ?? 0`, `"GOP"` fallback, silent `Amount <= 0` skip) |
| Failure report | annotated `.xlsm` from `ImportErrorWorkbookBuilder.Build`, served by `DownloadImportFile` | first failing row only, HTTP 400 |
| Execution | Hangfire job behind the global `tImportingStatus` mutex, SignalR progress | synchronous, one transaction |

The goal stated by the maintainer: the Lump Sum import must use **the same Download Template
workbook, the same backend data validations, and the same error-workbook output** as the Program
import.

A prior plan (`lump-sum-import-validation-parity.md`) kept the JSON contract and bridged the DTO
shapes with a server-side adapter. It was implemented and **reverted**. Its status line still says
Implemented and `lump-sum-v2.md` carries a section describing that work as landed; both are
corrected by this plan.

### What the JSON contract discards before the server sees it

Verified in `transformImportedChildren.ts` and `DTOLumpSum.cs`:

- `ImportedComponentCostDTO` has no Infrastructure Type / Type of Work; the FE re-derives them into
  `MajorItemOfWorks` keyed by `ComponentId|Year`, so a component with no major item loses them.
- `ImportedMajorItemLocationDTO` has no Target Unit; `ValidateMajorItemsOfWork`'s "Incorrect Target
  Unit" rule would have to be fed a fabricated value.
- Rows sharing `(ProjectId, ComponentId)` are summed into one cost and per-row Description is
  dropped; the duplicate-`(ComponentId, Year)` and group-overflow rules need the original rows.
- `ReferenceId` is re-minted as `{ProjectId}-{ComponentId}-{n}`, so rule M2 can only fail.
- Numbers arrive as doubles (`toNum` returns `undefined` for garbage), so every "Incorrect X" parse
  rule and the exact `decimal(18,5)` scale check run against coerced values, not cell text.
- Sheet presence and column layout have no server-side existence; the browser matches columns by
  name and tolerates two header typos the server's exact-match check refuses.

This is why "same validations" cannot be fully met over the JSON contract, whichever way the
server is written.

### What the rebase changed underneath (2026-09-05)

- New hard rule: Category ↔ Sub-Category relation via `tOptionProjectCategoryToPAPMap`, loaded
  unconditionally by `ImportLookupCache.LoadAsync`, which the Lump Sum import already calls. **No
  script in the repo creates that table** (rebase review, finding 1). The Lump Sum import fails on
  any database without it, today, before this plan.
- Message wording changed ("Incorrect Sub-Category", "Incorrect Originating Agency", …).
- Generated file names now use a private `BuildFileSuffix` in the job service.

## Goal

Make `ImportItemizedProjects` accept the Download Template workbook itself, validate it with
`ImportingHelper`'s four validators and the structural rules **called, not copied**, and report a
rejection as the same annotated `.xlsm` the Program import produces — while keeping every Lump Sum
invariant (parent gate, stage gate, balance, deduction, `ProjectType = "LS"`, `ParentProjectId`,
inherited UACS, Region-derived island code).

## Approaches evaluated

### A — Keep JSON; server-side adapter DTO → `Import*Excel` rows (the reverted design)

| Risk | Severity | Why |
|---|---|---|
| Lossy contract cannot be undone | **High** | Target Unit, per-row Infra/Work type, per-row Description and cell text are gone before the server runs; at least three rules must be fed fabricated values or bypassed — the "quietly mis-validated row" failure mode |
| Two inverse transforms coupled by convention | High | FE collapse and server un-merge must stay inverse forever; a FE grouping change mis-validates silently |
| File gates stay advisory | Medium | Marker is client-supplied; sheet/header layout never checked server-side |
| Codes-to-names back-resolution per column | Medium | An undo step for a transformation the browser performed |
| Already implemented once and reverted | Medium | 9 of 11 verification steps were never run |
| Blast radius on Program importer | Low | One `internal` → `public` |
| Contract / e2e churn | Low | JSON unchanged |

Does **not** meet "same template" in substance: the template is parsed and reshaped before the
server sees it. Viable only as a fallback if a file upload is ruled out.

### B — Upload the workbook; the server reads it with the Program importer's own readers *(recommended)*

The endpoint becomes `multipart/form-data` (`File`, `ParentLumpSumId`, `ProgramId`), stays
synchronous and single-transaction. The job service's private sheet readers, header arrays,
`ValidateSheetHeaders`, `FinalizeErrors` and file-naming helpers **move** into public classes under
`Hangfire/Importing/` and are called by both the job and the Lump Sum controller. Validators run on
real cell text; the error workbook is built from the same rows; the Lump Sum write loop reads the
validators' stamped codes and reuses the `Save*` entity builders.

| Risk | Severity | Mitigation |
|---|---|---|
| Refactor touches the Program importer (readers, headers, `FinalizeErrors`, naming — ~300 lines move) | Medium | Move verbatim in its own commit with no logic edits; run one Program import **and** one Program update on dev before the Lump Sum work builds on it. `FinalizeErrors` is self-contained: the identity gates U1–U3 / I1 live in `RunImportAsync`, not in it. The two Major-Item exemption lists are identical, so unifying them is behaviour-preserving |
| Contract change: FE sends `FormData`; 8 e2e call sites in 3 specs plus the shared fixture post JSON today | Medium | Pattern exists in `Program/Service.ts:startImportProjectJob`; Playwright `request.post` supports `multipart`; add `xlsx` to e2e and a builder that fills the downloaded template |
| Location columns must carry **names**; old code-filled workbooks are refused | Medium | **Decided 2026-09-05: refused, no normalisation.** Download Template dropdowns emit names, and a code-filled workbook is the pre-template artefact the marker is meant to exclude |
| Legislative District becomes load-bearing; Implementing Office / Operating Unit are derived and the sheet's values ignored | Medium | Check the migrated MyMYPS sample (18 children, Region `OI237`); complete the data, do not relax the validator |
| Floating rows and header typos refused instead of silently dropped/tolerated | Low | Intended; state it in the dialog copy |
| Warn → fail promotion blocks workbooks the Program import tolerates | Low | Carve-outs M2 and P10 (below); everything else is a real defect. **Reversed 2026-09-06 — see the amendment under Accepted risks.** |
| Synchronous EPPlus read in a controller | Low | Tens of rows; `[RequestSizeLimit]` on the action |
| Browser preview can disagree with the server | Low | Preview is advisory; server is authoritative |
| Error workbook written to `Resources/Imports` on the same host | Low | Holds today; a split deployment would need shared storage |

Meets all three of "same template, same validations, same error output" literally, and keeps both
callers on **one** reading and structural-rule path so they cannot drift. Failures are loud (build
errors, failing e2e), not silent.

### C — Enqueue the Hangfire job in a "Lump Sum mode"

| Risk | Severity |
|---|---|
| `SaveProjectDetails` writes `ProjectType = IslandCode`, `IsPublishable = false`, no `ParentProjectId`; identity resolver and update mode are load-bearing | **High** — every Lump Sum invariant grafted into the Program path |
| Global `tImportingStatus` mutex serialises a 3-row itemization behind a 5,000-row Program import | High |
| Async job UX for a synchronous business action; failures surface as job status, not HTTP 400 | Medium |
| Every change lands in the Program importer's hot path | High |

Not viable.

### D — Keep porting rules by hand into `LumpSumImportValidation.cs`

Already tried: 4 of ~100 ported; that file's own header argues against a second caller. Not viable.

## Decisions

| # | Decision | Chosen |
|---|---|---|
| 1 | Input contract | **B** — decided 2026-09-05. Older code-filled workbooks are **refused**, not normalised |
| 2 | Validator scope | All four families, called verbatim, plus `FinalizeErrors` moved and shared |
| 3 | Warn handling | ~~Promoted to failure~~ — **amended 2026-09-06: a warned row is imported and reported in `Warnings[]` plus a `.txt` report** — except **M2** (Reference ID convention — non-blocking) and **P10** (duplicate Description — surfaced as `Notices[]`) |
| 4 | Error reporting | `ImportErrorWorkbookBuilder.Build` → `Resources/Imports`, served by the existing `DownloadImportFile`; name via the shared `BuildFileSuffix` |
| 5 | Provenance | `_ImportStatus` removed; `_SysMeta` marker checked server-side on the uploaded file — a real gate now |
| 6 | Execution | Synchronous, one transaction, no Hangfire, no `tImportingStatus` lock |
| 7 | Identity gates U1–U3 / I1 and `IsValidProgramId` (H1) | Not applied — itemization creates new projects under the **parent's** stage |
| 8 | `ProgramId` | Kept in the form and cross-checked against the parent's `ProgramFK` |
| 9 | Stale docs | Parity plan marked superseded; v2 section rewritten as history |

## Acceptance Criteria

As a planning officer itemizing a Lump Sum Project, I want to fill the same template I use for a
Program import and have it checked by the same rules with the same annotated error workbook, so
that one workbook skill covers both imports and a typo can never become a silently wrong project.

**Template and provenance**
- [ ] The workbook from `GET /api/Importing/DownloadTemplate` is accepted by the Lump Sum import
      dialog (preview) and by the endpoint, unchanged.
- [ ] A file without `_SysMeta!A1 = MYPS-IMPORT-WORKBOOK-V1`, a missing sheet, or a header
      mismatch is refused server-side with the Program importer's own messages.
- [ ] The browser's `_ImportStatus` gate is gone from `parseImportFile.ts`; the Program import
      dialog accepts its own template as a side effect.

**Validation**
- [ ] `ValidateProjectDetails`, `ValidateFundingProfile`, `ValidateComponentDetails` (with
      `BuildComponentCostGroupTotals`) and `ValidateMajorItemsOfWork` run on every row, verbatim,
      before `BeginTransactionAsync`.
- [ ] The structural rules run from the shared class, not a copy: duplicate placeholder Project ID,
      Component → Major Item, the four floating-record rules, the cascade.
- [ ] No `?? 0` / `?? 1` default reaches `tProjectRevisions`; an unresolved Tier, Category,
      Sub-Category, Origin, Agency, Regionwide, Implementation/Emergency Mode, ROW Available,
      Feasibility or Detailed Design refuses the row by name.
- [ ] Funding lines write `SourceOrg` / `AgreementCode` **codes** from the validated row; Source
      and Agreement must agree; `Amount <= 0` is an error.
- [ ] ~~Every Warn fails the workbook except M2 and P10~~ — **amended 2026-09-06: every Warn
      imports the row and appears in the 200 response's `Warnings[]` and its report file**; P10
      hits appear in the 200 response's `Notices[]`.
- [ ] Nothing is written unless the whole workbook passes.

**Behaviour**
- [ ] A rejected import returns HTTP 400 `{ Title, Message, Errors[], ErrorFileName }`, and
      `ErrorFileName` downloads via `/api/Importing/DownloadImportFile?fileName=…` as a working
      `.xlsm` with cascading dropdowns, including the Category-dependent Sub-Category list.
- [ ] The dialog's Errors tab shows the server's `Errors[]` and offers the workbook download.
- [ ] The nine batch-level Lump Sum guards (parent found, visibility, `GAA-R` stage, EAO, program,
      program stage, `ProgramId` match, batch total > 0, sufficient balance) still fire, ahead of
      per-row work, with their current wording.
- [ ] A clean workbook still yields children with `ProjectType = "LS"`, `ParentProjectId`,
      `ItemizationType`, `ProjectStatus = potential`, `IsPublishable = true`, the Region-derived
      island code in the Project ID, the parent's UACS on per-year rows, `ComponentType` stored as
      the **name**, and the parent's LS component reduced by the batch total with the note
      "Cost reduced due to itemizations".
- [ ] `dotnet build WebAPI/WebAPI.csproj` at 0 errors; the Program import **and** update still run
      end to end; all Lump Sum e2e specs pass with the workbook-based fixture.

## Approach (B)

```
Browser: SheetJS parse (preview tabs + Remaining pre-check only; advisory)
        │
        ▼  POST multipart { File, ParentLumpSumId, ProgramId }
Lump Sum controller
  ├─ batch guards (parent, visibility, GAA-R, EAO, Program, ProgramStage, ProgramId match)
  ├─ ImportWorkbookReader: marker → sheets → headers → 4 × List<Import*Excel>   (moved from job)
  ├─ ImportLookupCache.LoadAsync; existing descriptions for this ProgramPK
  ├─ 4 validators (Warn = imported + reported since 2026-09-06; M2/P10 carve-outs) → ImportStructuralRules.Apply (moved FinalizeErrors)
  ├─ errors?  → ImportErrorWorkbookBuilder.Build → Resources/Imports/LumpSum_{parent}_{suffix}.xlsm
  │            → 400 { Title, Message, Errors[], ErrorFileName }
  ├─ batch total from validated component rows; "Nothing to Itemize"; balance check
  └─ BeginTransaction → per project: GenerateProjectID(RegionIslandCode) → Projects/Revision/Stage
       (LS fields) → funding via SaveFundingProfile (+IsWalletDraw) → components via
       SaveComponentCost / SaveComponentCostPerYear (consolidating repeated ComponentId rows as
       RunImportAsync does) → SaveMajorItemsOfWork / SaveMajorWorkLocation → deduction + note → Commit
       → 200 { Projects, Count, Itemized, Message, Notices[] }
```

**Reuse, not re-port.** `WebAPI.csproj` already references `Hangfire.csproj`; `Import.cs` already
uses `ImportLookupCache`; both use EPPlus 7.7.2. Nothing in `ImportingHelper` is copied. The only
new logic is the Lump Sum write loop's use of stamped codes, which replaces ~300 lines of resolvers.

**Program and stage are inherited from the parent** (`vLumpSumSet` → `tPrograms` by `ProgramFK`
→ `tProgramStages` by the parent's `StageName`), which is why H1 is not applied.

**Carve-outs at the source.** `IsWarning` is a row-level flag, so: M2 — compare the rule's
`ReferenceId` after normalising it to `"{ProjectId}-{ComponentId}"` on a copy, write the real one;
P10 — pass an empty `existingProjectDescriptions` and run the duplicate scan separately for
`Notices[]`. Both commented at the call site naming the rule and the reason.

## Tasks

### Implementation

**Stage 0 — schema gap from the rebase (unblocks everything, separable)**
1. Add `Main/Resources/Internal/SQLScripts/Importing.CategoryToPAPMap.Schema.sql`, idempotent,
   creating `dbo.tOptionProjectCategoryToPAPMap (Id, CategoryId, PAPKey)` in the style of
   `Importing.Schema.sql`. Without it the Lump Sum import already fails on any database not
   hand-patched.

**Stage 1 — extraction from the Program importer (behaviour-preserving, own commit)**
2. `Hangfire/Importing/ImportWorkbookReader.cs` (new, public static): the four header arrays,
   `RequiredSheets`, `ValidateSheetHeaders`, `ColumnLetter`, `VerifySystemMarker`, and the four
   `Read*` methods, moved verbatim from `ImportProjectJobService.cs`. Promote
   `ImportErrorWorkbookBuilder.SystemMarkerSheetName/Value` to `public const`.
3. `Hangfire/Importing/ImportStructuralRules.cs` (new): `FinalizeErrors` moved verbatim as
   `Apply(...)`; its local exemption list replaced by `ImportingHelper.NonPhysicalComponentTypeIds`
   (identical contents, verified).
4. `Hangfire/Importing/ImportFileNaming.cs` (new): `SanitizeForFileName`, `BuildFileSuffix`
   moved from the job service.
5. `ImportProjectJobService.cs` calls the three new classes; no other change. Re-run a Program
   import and a Program update on dev before continuing.

**Stage 2 — the Lump Sum endpoint**
6. `DTOLumpSum.cs`: `ImportItemizedProjectsFormDTO { IFormFile File; int ParentLumpSumId;
   string ProgramId }`. Delete `ImportItemizedProjectsDTO`, `ImportedItemizedProjectDTO`,
   `ImportedComponentCostDTO`, `ImportedComponentCostPerYearDTO`, `ImportedMajorItemOfWorkDTO`,
   `ImportedMajorItemLocationDTO` after confirming no other reference. Keep
   `ItemizedFundingLineDTO` only if still referenced.
7. `LumpsumController.cs`: inject `IWebHostEnvironment` (as `ImportingController` does).
8. `LumpsumController.Import.cs`: `[HttpPost] [Consumes("multipart/form-data")]
   [RequestSizeLimit(…)]`; batch guards unchanged and first; then reader → cache → validators →
   structural rules → error workbook or write loop, per the Approach diagram. Validation lives in
   a new partial `LumpsumController.Import.Validation.cs` (module convention: partials by concern).
9. No code→name normalisation. Location columns must carry the names the Download Template
   dropdowns emit; a workbook carrying participant ids or PSGC codes is refused by the validators
   as-is (decided 2026-09-05). Record the decision in `Import.cs`'s class doc so the old resolvers'
   code-acceptance is not reintroduced as a "fix".
10. Write loop: read stamped codes (`TierNameId`, `CategoryCategoryId`, `ThrustPAPKey`,
    `OriginNameId`, `AgencyNameId`, `ProvinceCode`, `CityCode`, `LDCode`, `DeoParticipantId`,
    `RegionParticipantId`, `RegionIslandCode`, `ImplementingOfficeParticipantId`,
    `OperatingUnitParticipantId`, …); reuse `SaveFundingProfile` (+`IsWalletDraw = true`,
    `CreatedBy/Date`), `SaveComponentCost`, `SaveComponentCostPerYear` (parent UACS),
    `SaveMajorItemsOfWork`, `SaveMajorWorkLocation`; consolidate repeated `ComponentId` rows into
    one cost with per-year children exactly as `RunImportAsync` does. Delete
    `ResolveImportedLookups`, `ResolveImportedLocations`, `ResolveEnum<T>`, both record types,
    `WriteImportedProjectDetailAsync`'s inline checks, and `LumpSumImportValidation.cs`.
11. Batch total: sum of validated component `Cost` per project (replaces `dto.Projects.Sum`);
    "Nothing to Itemize" and "Insufficient Balance" keep their wording.
12. Error workbook: `ImportErrorWorkbookBuilder.Build(cache, errP, errF, errC, errM,
    Program.StartYear)` → `{ContentRootPath}/Resources/Imports/LumpSum_{parentProjectId}_
    {BuildFileSuffix}.xlsm`; return 400 `{ Title, Message, Errors[], ErrorFileName }`.

**Stage 3 — frontend**
13. `FE/src/pages/Project/utils/parseImportFile.ts`: delete `validateImportStatusSheet` and its
    call; read `_SysMeta!A1` and, if wrong, report *"This workbook was not produced by Download
    Template…"*. Shared with the Program dialog — exercise both.
14. `FE/src/pages/LumpSum/Service.ts`: `importItemizedProjects(file, parentLumpSumId, programId,
    parentProjectId)` posting `FormData` (pattern: `Program/Service.ts:startImportProjectJob`);
    success type gains `Notices[]`; failure body typed with `Errors[]`, `ErrorFileName`.
15. `ImportItemizedProjectsDialog.tsx`: keep the SheetJS preview and Remaining pre-check; hold the
    `File`; `onSubmit(file)`; Errors tab renders server errors separately from parse errors with a
    download link to `/api/Importing/DownloadImportFile?fileName=…`; copy states the preview is
    advisory.
16. `LumpSumDetail.tsx`: `handleImport(file)`; show `Notices[]` with the success toast.
17. Delete `FE/src/pages/LumpSum/utils/transformImportedChildren.ts` and the `DtoImport*` types in
    `LumpSum/Model.d.ts`.

**Stage 4 — e2e**
18. Add `xlsx` (same major as FE, `^0.18.5`) to `e2e/package.json`.
19. `e2e/tests/helpers/importWorkbook.ts` (new): `buildImportWorkbook(page, children[])` — GET
    `/api/Importing/DownloadTemplate`, fill the four sheets with **names** (Region III's Region /
    Province / City / LD / DEO names, Category and Sub-Category names that satisfy the new
    relation rule), write to a buffer with `_SysMeta` intact. `importChild` and the 7 other call
    sites post it via `page.request.post(url, { multipart: { File, ParentLumpSumId, ProgramId } })`.
20. Extend `ls-contract.spec.ts`: one rejected workbook (bad Tier) returns 400 with `Errors[]` and
    a downloadable `ErrorFileName`; nothing written.

### Documentation
21. `documents/plans/lump-sum-import-validation-parity.md`: `Status: Superseded by lump-sum-v3.md
    (implemented 2026-09-05, reverted)`; leave the body as history.
22. `documents/plans/lump-sum-v2.md`: rewrite *"The import is no longer self-contained"* as a
    dated history note pointing here; record the `_ImportStatus` retirement.
23. `LumpsumController.Import.cs` class doc; `FE/src/pages/LumpSum/LumpSum.md` and
    `UserManual.md` import section (same template as Program import; error workbook download);
    `FE/src/pages/Program/program.md` no longer documents `_ImportStatus`.
24. Record in this plan's Completion Log which verification steps ran against a live API.

## Files / Components Touched

| File | Change |
|---|---|
| `Main/Resources/Internal/SQLScripts/Importing.CategoryToPAPMap.Schema.sql` | **new** — stage 0 |
| `Hangfire/Importing/ImportWorkbookReader.cs`, `ImportStructuralRules.cs`, `ImportFileNaming.cs` | **new** — moved code |
| `Hangfire/Services/ImportProjectJobService.cs` | calls the moved code; ~300 lines removed |
| `Hangfire/Importing/ImportErrorWorkbookBuilder.cs` | marker consts `public` |
| `WebAPI/Controllers/Lumpsum/LumpsumController.cs` | `IWebHostEnvironment` |
| `WebAPI/Controllers/Lumpsum/LumpsumController.Import.cs` | multipart action; validate-then-write; resolvers deleted |
| `WebAPI/Controllers/Lumpsum/LumpsumController.Import.Validation.cs` | **new** partial |
| `WebAPI/Controllers/Lumpsum/LumpSumImportValidation.cs` | **deleted** |
| `WebAPI/Controllers/Lumpsum/DTOLumpSum.cs` | form DTO; nested import DTOs deleted |
| `FE/src/pages/Project/utils/parseImportFile.ts` | `_ImportStatus` → `_SysMeta` (shared with Program) |
| `FE/src/pages/LumpSum/Service.ts`, `dialogs/ImportItemizedProjectsDialog.tsx`, `Views/LumpSumDetail.tsx`, `Model.d.ts` | file upload; server errors; notices |
| `FE/src/pages/LumpSum/utils/transformImportedChildren.ts` | **deleted** |
| `e2e/package.json`, `e2e/tests/helpers/importWorkbook.ts` (new), `lumpSumFixture.ts`, 3 specs | workbook-based import |
| `documents/plans/lump-sum-import-validation-parity.md`, `lump-sum-v2.md`, module docs | history and status |

Read-only, unchanged: `ImportingHelper.cs` (validators and `Save*`), `ImportLookupCache.cs`,
`DTOImporting.cs`, `ImportingController.cs`.

## Verification

1. Stage 0: run the schema script on a database lacking the table; `DownloadTemplate` and the
   Lump Sum import stop failing there.
2. Stage 1: `dotnet build WebAPI/WebAPI.csproj` — 0 errors; run one Program **import** and one
   Program **update** with the reference workbook; job results and error workbook unchanged.
3. Template round-trip: download from the Program module, open in **both** dialogs — each parses.
4. Happy path: 3-row template against a `GAA-R` Lump Sum Project on whichever database `MYPSDb`
   currently names — `localhost/myps_db_dev_200` since 2026-09-10, which must be brought up
   first (§6 below);
   assert in SQL the child rows, `ProjectType='LS'`, `ParentProjectId`, island codes `LZ/VS/MN`,
   parent UACS on per-year rows, `ComponentType` names, parent LS component reduced, note present.
5. Each rule family refuses: misspelt Tier; unknown Origin; Source/Agreement mismatch;
   `Amount = 0`; 6-decimal cost; `ActiveYear` below `Program.StartYear`; component with no major
   item; funding row with no project row; Sub-Category not mapped to its Category. Each lands in
   the error workbook; row counts in `tProjects` / `tProjectRevisions` / `tProjectComponentCost`
   and the parent's LS `Total` unchanged.
6. File gates: no `_SysMeta`; a deleted column; a renamed sheet — each refused with the Program
   importer's message.
7. Error workbook: download via `DownloadImportFile`, opens in Excel with no repair prompt,
   cascading dropdowns work (incl. Category → Sub-Category), fix the cells, re-upload, imports.
8. `ProgramId` mismatch refused; Region-without-LD row refused by name; the MyMYPS sample checked.
9. `npx playwright test` — all Lump Sum specs green with the workbook fixture.

## Risks / Open Questions / Assumptions

- **Approach B decided 2026-09-05.** A remains documented above as the fallback only; if it were
  ever revived, tasks 2–5 still apply and tasks 6, 8, 13–19 would be replaced by the adapter
  design in `lump-sum-import-validation-parity.md`, with its lossy-contract risks.
- **Code-filled location columns are refused, not normalised** (decided 2026-09-05). Download
  Template dropdowns emit names; the `_ImportStatus`-era workbooks that carried codes are the
  artefact the marker is meant to exclude. Anyone holding such a workbook re-enters it in a fresh
  template.
- **Legislative District is load-bearing** on an imported row. If the migrated sample's 18
  children carry no LD, the sample needs completing, not the validator relaxing.
- **The Category ↔ Sub-Category rule** now applies to itemized children. The e2e fixture's current
  Category 16 / Thrust 1 pair must be replaced by a mapped pair (by name).
- **Warn promotion** blocks workbooks the Program import tolerates (out-of-range coordinates,
  unparseable optional dates). Deliberate: Lump Sum is all-or-nothing and has no warning channel.
  *(Both premises were retired on 2026-09-06 — see the two amendments below.)*

  > **Amended 2026-09-06 — promotion reversed; the channel now exists.** All 24 promoted warnings
  > are back to warning level (M2 and P10 were already exempt and are unchanged). A warned row is
  > imported, as on the Program path, and reported twice: `Warnings[]` on the 200 response, which
  > opens a Warnings tab that keeps the import dialog open, and `LumpSumImportWarnings_*.txt` under
  > `Resources/Imports`, written after the commit and served by `DownloadImportFile`.
  >
  > **Risks accepted with the reversal.** 14 of the rules mean a value that could not be read,
  > which the `Save*` writers store as NULL — including Physical Target and Length, which those
  > same validators otherwise treat as required — so a typo becomes a blank field rather than a
  > refusal. The other 10 mean a readable but wrong value (coordinates outside the country, end
  > before start, a date on a "NO" flag), stored as typed. `ValidationState.Message` joins Fail and
  > Warn text into one string, so a line cannot mark which fragment warned; a later selective
  > policy would need a separate warnings list on that class. Children are ordinary projects
  > afterwards, so all of it is correctable in Projects — the report is what makes it findable.
  > Failures and the structural cascade are untouched.
  >
  > **Amended the same day — atomic per project, not per workbook.** Found while testing the
  > above: a 4-project workbook with one impossible city refused all four, and the three that
  > carried only warnings were never written, which read as "the warnings still refuse". The
  > all-or-nothing rule was the cause, and the maintainer chose to drop it in favour of the
  > Program importer's behaviour: a project that fails on any sheet is refused whole (the
  > cascade already makes that so) and written to the error workbook; every other project is
  > imported in the one transaction; the response is 200 with both halves (`Errors[]` +
  > `ErrorFileName` + `RefusedCount`, `Warnings[]` + `ReportFileName`), `Title: "Imported with
  > Exceptions"`. Only a workbook with NO acceptable project still answers 400. The balance
  > check runs over the accepted rows only. V2's "the whole import succeeds or fails together"
  > is therefore superseded; `UserManual.md` and `LumpSum.md` say so.
  >
  > **Also 2026-09-06 — the per-year row moves with the component.** Replenish, the import
  > deduction and the child-delete restore wrote `tProjectComponentCost.Total` alone; the LS
  > component's one `tProjectComponentCostPerYear` row kept CreateLumpSum's figure, and 29 of the
  > 44 components on localhost disagreed with their row (the manual had always claimed otherwise).
  > All three now go through `MoveLSAllocationAsync`, which sets a single live row to the new
  > Total (self-healing) or adds the delta to the earliest of several. One-off repair:
  > `LumpSum.Repair.PerYearAmount.2026-09-06.sql`.
  >
  > **And Replenish appends its funding line.** The DTO's `Source`/`Agreement`, the manual and
  > the dialog described a funding line the server never wrote, so Σ funding lagged the
  > allocation after every top-up. Now: new line for the top-up (codes from the request, else
  > the largest live line), percentages re-derived, then the component and per-year move. The
  > maintainer's rule: funding, component Total and per-year Amount all move together, and on
  > an un-itemized parent they are one number. Repair for earlier top-ups:
  > `LumpSum.Repair.FundingGap.2026-09-06.sql`.
  >
  > **Superseding both, later the same day — the balance moved to the per-year row.** The
  > maintainer's model: the component `Total` is the FULL allocation (= Σ funding, never falls)
  > and the per-year `Amount` is the REMAINING balance; `vLumpSumSet` reads `OriginalAllocation`
  > off the Total and `Remaining` off the row, so both are stored and the old identity is now a
  > DRIFT check. Movements go through three helpers in `Helpers/LumpsumHelper.cs` —
  > `MoveLSBalanceAsync` (import, child delete, `AdjustParentAllocationAsync`),
  > `RaiseLSAllocationAsync` (Replenish), `SyncLSToFundingAsync` (`UpdateLumpSum`, which derives
  > both figures and thereby closes the stale-Total hazard). **Add Component Cost and the row
  > Delete are gone from the details page**, and `ValidateRequiredFieldsAsync` refuses any
  > payload leaving other than one live `LS` component (`Title: "Single Component"`). Data:
  > `LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql` (run after the Baseline view and after the
  > FundingGap repair; 32 components on localhost, 0 drift, idempotent);
  > `LumpSum.Repair.PerYearAmount.2026-09-06.sql` is inert and marked superseded.
  >
  > **Code review, 2026-09-06 — two findings fixed, two left open by decision.**
  >
  > Fixed: (1) `ImportItemizedProjects`' catch called `RollbackAsync` directly while work now
  > runs after `CommitAsync` in the same try (the read-back, the warning report, the response),
  > so a failure there rolled back a committed transaction, threw from the catch and returned an
  > unhandled 500 for an import that had actually committed — it now uses `SafeRollbackAsync`
  > like every other Lump Sum mutator. (2) `ReplenishLumpSum` resolved `Source` and `Agreement`
  > independently, so supplying only a Source (what the dialog produces, since choosing a source
  > clears the agreement box) copied the agreement from the largest line overall, possibly under
  > a different source; the two are now completed from the same line, checked against
  > `tOptionFundingAgreement` and refused when the pair does not belong together.
  >
  > **Open — the import's visible stamp is not atomic.** Its check and its write are two
  > autocommit statements, so two imports starting in the same instant can both stamp, and the
  > one the applock then refuses clears the stamp in its `finally` — removing the "being
  > itemized" banner and the disabled buttons while the winner is still running. Cosmetic: the
  > application lock, not the stamp, is what keeps the two writers apart. Fix is one conditional
  > `UPDATE … WHERE LockedBy IS NULL OR LockedDate < @ttl` with a row-count check.
  >
  > **Open — the helpers no-op when the LS component has no live per-year row.**
  > `MoveLSBalanceAsync` returns silently and `SyncLSToFundingAsync` early-returns, so such a
  > project would sit at Remaining 0 with no import, restore, replenish or save able to heal it.
  > Not reachable through the API today: `ValidateRequiredFieldsAsync` already refuses a payload
  > whose per-year rows are all deleted, and an empty array trips the same check. A defensive
  > refusal in the helpers would still be worth adding.
  >
  > **Deadlock RCA and fix, 2026-09-06 (evening) — `documents/plans/lump-sum-deadlock.md`,
  > record in `documents/docs/engineering/MYPS_LUMPSUM_DEADLOCK_RCA.md`.** The intermittent 1205
  > whose victim was always the `vLumpSumSet` read: the view scanned every revision for one row
  > (a `ROW_NUMBER` CTE the `Id` filter could not push through) and met the hard delete of a
  > different project, which locks stages before revisions. Fixed in two layers — both views
  > rewritten to seek per project with two new indexes (15,126 → 36 pages for a detail read), and
  > `READ_COMMITTED_SNAPSHOT` on localhost via a run-once script, recorded as a DBA step for
  > production. A third, a lock-first helper in the hard deletes, was implemented and then removed
  > on the code review's evidence: its `XLOCK` selects locked only the foreign-key index keys, and
  > any order inverted against either the readers or `DeleteProgram`. `ls-contract` gained a race
  > case (40 reads during 5 hard deletes).
  >
  > **Open — from the 2026-09-06 code review, by decision kept out of the deadlock plan** (in the
  > order to pick them up):
  > 1. Import: an Insufficient Balance / Nothing to Itemize 400 hands back an error workbook
  >    holding only the refused rows (`Import.cs` ~:308); the dialog then says to correct and
  >    re-upload it, which would drop every accepted project. Return the full workbook's report,
  >    or no workbook and a "nothing was imported, re-use the original" message.
  > 2. Import dialog: the client-side overdraw gate still sums the whole workbook
  >    (`ImportItemizedProjectsDialog.tsx` :177) and blocks files the server would now partially
  >    accept. Gate on the server's answer, or sum only rows that pass the client's checks.
  > 3. Import dialog copy: `RefusedCount` 0 with a non-empty `Errors[]` (only floating rows
  >    failed) renders "0 projects refused and left out" (:198).
  > 4. UpdateLumpSum: the "Below Committed Draw" guard sums `dto.FundingProfiles`, but the merge
  >    drops lines whose Id belongs to another project and `SyncLSToFundingAsync` derives from the
  >    lines actually live, so a crafted payload can store a negative balance (`Writes.cs` :422 /
  >    :1150). Derive the guard from the post-merge live lines, or refuse foreign Ids.
  > 5. `AdjustParentAllocationAsync` has no caller: a child's cost edited in the Projects module
  >    moves `ItemizedTotal` but not the stored balance, so the parent reports DRIFT until a
  >    repair runs (`LumpsumHelper.cs` :297). Call it from the project-update path for children,
  >    or refuse component-cost edits on itemized children there.
  > 6. The visible import stamp is check-then-set (above) — still open.
  > 7. ~~Funding Profile read-only leaves a single-line project unable to correct a wrong line~~
  >    — **fixed 2026-09-07** on the maintainer's instruction that every line, including the
  >    first, must be deletable: the update path's "Funding Profile Required" guard is gone, so
  >    zero lines derives the allocation to 0 and Replenish restores it. "Below Committed Draw"
  >    still protects a parent with children.
  > 8. Dead SQL in `LumpSum.Repair.PerYearAmount.2026-09-06.sql` behind its `RETURN`; reduce the
  >    file to its header and the `PRINT`.
  > 9. Minor: `e2e/CLAUDE.md`'s expected pass count is stale; `SyncLSToFundingAsync`'s single-row
  >    branch duplicates the general one; the warning report re-implements the Program importer's
  >    text report; the funding-percentage re-derivation exists in two C# copies plus SQL;
  >    `downloadImportWarningReport` duplicates `downloadImportErrorWorkbook`.
  >
  > Verified not reachable on localhost data (0 of 33 parents): the "more than one live
  > component" and "no live per-year row" shapes the review also raised.
  >
  > **Flagged, not in scope:** `DashboardController` sums per-year `Amount` across all projects
  > with no `ProjectType='LS'` exclusion (it would now add each parent's balance into program
  > budgets), and `ExportProjectsHelper` exports `cy.Amount` as a component's Cost, so an LS
  > parent round-tripped through export/import would land its balance in `Total`. Both predate
  > this change; both need an LS exclusion.
- **Error workbook message terseness** ("Incorrect Tier") vs today's project-naming sentences: the
  annotated cell shows which value; a readability regression for the toast alone.
- **`Resources/Imports` writable from the WebAPI process** — true today (same host as Hangfire).
- **Body size**: a filled template is well under 5 MB; cap at 10 MB.
- **Stage 0 is not this branch's defect** but blocks its verification; land it first.

## Completion Log

Date: 2026-09-05

- Implementation: 20 of 20 tasks.
  - *Stage 0.* `Importing.CategoryToPAPMap.Schema.sql` creates the table in the entity's shape
    and, for a hand-made copy without the key column (what `localhost/myps_db_dev` had), adds
    the identity `Id` in place. Applied to localhost; 137 rows kept.
  - *Stage 1.* `ImportWorkbookReader` (marker, sheets, headers, the four readers),
    `ImportStructuralRules.Apply` (`FinalizeErrors` verbatim, exemption list now
    `ImportingHelper.NonPhysicalComponentTypeIds`), `ImportFileNaming`. The job service lost
    418 lines and gained six call sites; its Warn/Error/Valid partitioning is untouched. Marker
    constants are `public`.
  - *Stage 2.* `ImportItemizedProjects` is `[HttpPost] [Consumes(multipart)]
    [RequestSizeLimit(10 MB)]` over `ImportItemizedProjectsFormDTO`. Batch guards first,
    `ProgramId` cross-checked against the parent, then the three file gates, the readers, the
    four validators and structural rules in `LumpsumController.Import.Validation.cs`
    (Warn = fail; M2 and P10 neutralised at source, P10 → `Notices[]`), then the error workbook
    or the write loop. The write loop reads stamped codes and uses `SaveFundingProfile`,
    `SaveComponentCost`, `SaveComponentCostPerYear`, `SaveMajorItemsOfWork`,
    `SaveMajorWorkLocation`, consolidating repeated `ComponentId` rows as the job does.
    `ComponentType` is stored as the lookup's canonical name. Deleted: both resolvers, their
    records, `ResolveEnum<T>`, `LumpSumImportValidation.cs`, the six nested JSON DTOs, and the
    two orphaned `[HttpPost]` blocks in `Itemization.cs`.
  - *Stage 3.* `parseImportFile.ts` checks `_SysMeta!A1` (the `_ImportStatus` gate is gone —
    both dialogs accept their own template). `Service.importItemizedProjects` posts `FormData`;
    `LumpSumImportRejection` / `asImportRejection` / `downloadImportErrorWorkbook` added;
    `httpClient`'s `ErrorResponse` gained `Data` (the raw body) so a catch can read `Errors[]`.
    The dialog holds the `File`, submits it, renders server errors above preview warnings with
    a download button, and states the preview is advisory. `transformImportedChildren.ts` and
    the `DtoImport*` types are deleted.
  - *Stage 4.* `e2e/tests/helpers/importWorkbook.ts` fetches the live template, fills the four
    sheets by name (Region III / Aurora; Category 16 ↔ Sub-Category 1082, a mapped pair) and
    posts multipart. `importChild` builds a workbook; `ProvisionedLumpSum` carries
    `programStartYear` so rows are never dated before the program. Eight call sites in three
    specs rewritten; `ls-contract` gained the rejection-and-error-workbook test and a
    missing-sheet gate test. `xlsx@0.18.5` added to `e2e`.
- Documentation: 4 of 4. Parity plan marked superseded with the reason; v2's history section
  rewritten and a seventh known gap added (below); `Import.cs` class doc (names-not-codes
  decision recorded), `LumpSum.md`, `UserManual.md` import section, `program.md` marker notes.

Deviations / flags:
1. **`ComponentType` canonicalised.** The Program path stores the sheet text as typed; the Lump
   Sum write loop stores `cache.Components` `ComponentName` for the matched type so
   `GetLSComponentAsync` reads it regardless of the cell's casing. Same value on a template-
   filled sheet.
2. **`Percentage`** on funding lines stays the Lump Sum computation (share of the project's
   total) rather than the reader's constant 100 — the module's own rule, unchanged.
3. **Notices are toasts**, one warning toast per notice, rather than a list in the dialog: the
   dialog closes on success.
4. **Stage 1's happy-path proof first failed on a pre-existing conflict, since resolved by
   decision.** `LumpSum.Baseline.sql` constrained `tProjects.ProjectType` to `NP/AIP/LS/MY`; the
   Program importer's unchanged `SaveProjectDetails` writes the island code into it, so a clean
   Program import failed with `CK_tProjects_ProjectType` on any database carrying the baseline.
   The maintainer dropped the constraint (2026-09-05) — a hard-coded code list is the wrong
   shape; an enum table is the follow-up — and the importer was left as is. Record:
   `documents/docs/engineering/MYPS_PROJECTTYPE_CHECK_CONSTRAINT_REMOVED.md`; known gap 6 in
   `lump-sum-v2.md`. With the constraint gone, the Program import **and** update ran to
   `Completed` through the job (below).
5. **Reference ID mismatch is silently tolerated** on the Lump Sum path (M2 neutralised), and
   the e2e builder writes the convention value itself. Making a mismatch a notice is a two-line
   follow-up if wanted.
6. `Main/appsettings.Development.json` was changed by the maintainer during this work to point
   `MYPSDb` at localhost; `PCMADb` still points at `192.168.50.200`. Not part of this change.
7. **Rule added after implementation (2026-09-05): a child's `AlternateId` is the parent Lump
   Sum Project's `ProjectId`**, not the workbook's placeholder Project ID. The placeholder only
   ties the four sheets together during validation and is not persisted. Known consequence,
   accepted: all children of one parent share an AlternateId, which the Program importer's
   identity resolver treats as ambiguous — a Program import cannot match or update an itemized
   child. `ls-contract` and `ls-ownership` assert the rule; `ls-ownership` now finds a child by
   Description rather than by the label it used to expect in AlternateId.

Verification (all on `localhost/myps_db_dev`, API on `localhost:5015`):
- `dotnet build WebAPI/WebAPI.csproj` — **0 errors** (123 warnings, below the 205 baseline: the
  deleted resolvers).
- `dotnet test MYPS.UnitTests` — **16 passed, 0 failed.**
- `npx tsc --noEmit -p tsconfig.app.json` — **21 errors, exactly the Rbac baseline**, none in a
  touched file.
- `GET /api/Importing/DownloadTemplate` — 200, 68 KB (proves the lookup cache, and Stage 0, on
  localhost).
- `npx playwright test ls-contract` — **10 passed**: template round-trip, happy-path import
  through the workbook (children created, parent deducted, island code `LZ`), overdraw refused
  whole, off-stage refused, **bad Tier refused row by row with `Errors[]` and a downloadable
  `LumpSumImportErrors_*.xlsm`, nothing written**, missing sheet refused by the server gate,
  delete restores cost.
- `npx playwright test ls-ownership ls-data-security` — **13 passed, 2 skipped** (the two
  documented known gaps): UACS inheritance through the workbook, a divergent UACS accepted,
  the visibility gate ahead of the file gates, an empty upload refused as "Nothing to Import".
- Program import job, via a temporary spec since deleted: a bad-Tier workbook →
  `CompletedWithErrors`, `ErrorCount 4` (row + three cascaded children), `ImportErrors_*.xlsm`
  downloads; a workbook without COMPONENT DETAILS → `Failed`, "Missing sheets: COMPONENT
  DETAILS". Lock released, no rows left. After the constraint drop (deviation 4): a clean
  workbook → **`ImportProject` `Completed`, `ValidCount 1`**, then **`UpdateProject`
  `Completed`, `ValidCount 1`** on the same file. One verification project
  (`AlternateId V3VERIFY-…`) remains under the GAA-R program on localhost; the Program import
  has no sweeper.
- Not run: the two dialogs in a browser (API-level only; the FE type-checks), the migrated
  MyMYPS sample against the Legislative District rule.

Files changed: `Hangfire/Importing/ImportWorkbookReader.cs`, `ImportStructuralRules.cs`,
`ImportFileNaming.cs` (new); `Hangfire/Importing/ImportErrorWorkbookBuilder.cs`;
`Hangfire/Services/ImportProjectJobService.cs`;
`Main/Resources/Internal/SQLScripts/Importing.CategoryToPAPMap.Schema.sql` (new);
`WebAPI/Controllers/Lumpsum/LumpsumController.cs`, `LumpsumController.Import.cs`,
`LumpsumController.Import.Validation.cs` (new), `LumpsumController.Itemization.cs`,
`DTOLumpSum.cs`; `WebAPI/Controllers/Lumpsum/LumpSumImportValidation.cs` (deleted);
`FE/src/services/httpClient.ts`; `FE/src/pages/Project/utils/parseImportFile.ts`;
`FE/src/pages/LumpSum/Service.ts`, `Model.d.ts`, `Views/LumpSumDetail.tsx`,
`dialogs/ImportItemizedProjectsDialog.tsx`, `LumpSum.md`, `UserManual.md`;
`FE/src/pages/LumpSum/utils/transformImportedChildren.ts` (deleted);
`FE/src/pages/Program/program.md`; `e2e/package.json`, `package-lock.json`,
`e2e/tests/helpers/importWorkbook.ts` (new), `helpers/lumpSumFixture.ts`,
`ls-contract.spec.ts`, `ls-data-security.spec.ts`, `ls-ownership.spec.ts`;
`documents/plans/lump-sum-import-validation-parity.md`, `lump-sum-v2.md`, this file.


---

# The module since this plan (2026-09-05 → 2026-09-10)

This plan covers the itemization import and nothing else. Six further pieces of work landed on
`lumpsum-v3-backup` afterwards, and together they changed how the module saves, what it refuses,
and how two of its screens behave. Nothing below alters the import contract this plan
implemented — the workbook, the shared validators and the error workbook are as described above.
The database the module runs against also changed, which is §6.

## 1. Replenish is local until Save (`c2bb3739`, plan `lump-sum-replenish-local-until-save.md`)

**What changed.** The Replenish dialog no longer posts. It appends a funding line to the form's
local state, and `UpdateLumpSum` carries the top-up when the user presses Save. The
`ReplenishLumpSum` endpoint still exists and still enforces its own rules, but no page calls it.

**Why it is worth knowing here.** The plan for this existed since `14acd625` and had never been
implemented; the root cause analysis that reopened it (`83b78bdd`) found the dialog still posting
immediately. Two rules moved with it and did **not** survive the move intact — the strictly
increasing check now compares against the sum of the form's local lines rather than the server's
allocation, and share percentages are no longer re-derived server-side. Both are open findings in
`lump-sum-review-findings-2026-09-10.md` (5 and 4).

**Related.** A blank Replenish follows the **first** funding line — the earliest live line by Id,
not the largest (`652ba1ce`, `08d7f8b3`). That definition is now written in four places; see the
design notes in the findings document.

## 2. An Approved program freezes its Lump Sum Projects (`a63a27b5`, narrowed by `334de66e`)

**The predicate.** A program is Approved for this purpose when `vProgramLatest.Status` is
`Approved` **and** its `StageName` is `GAA-R`. It is read per request by
`ReadProgramApprovalAsync` (`LumpsumController.cs`); there is no schema change and no cached flag.

**The rule, as the client revised it.** The first implementation refused every mutator. The client
then narrowed it: **Replenish and Itemize stay enabled on an Approved program, and so does Save**,
because deleting a funding line has to remain possible. Only two actions are refused outright —
`CreateLumpSum` and `DeleteLumpSum`. The project's **details and Component Cost are read-only**
while Save stays live for the money.

**Server enforcement** (`c3d178c1`, plan `lump-sum-approved-details-server-enforced.md`). Read-only
on the page was not enough, so `UpdateLumpSum` now refuses a payload that would *change* a detail
field, the UACS, or the Component Cost's client-owned fields, and lets *echoes* and funding-line
changes through. The comparison is field-scoped: `FirstChangedDetail` and
`FirstChangedComponentAsync` name the first field that would move. Derived values (`Total`, the
per-year `Amount`) are never compared, because the save recomputes them.

**What the frontend shows.** A rose "Program Approved" banner on the detail page; Delete greyed
with a reason; the Add page's program picker filters Approved programs out. The gate is owned by
`ActionGate` in `utils/lumpSumActions.ts` and re-read at click time, so a program approved in
another tab is caught before the dialog opens rather than after.

**Known gap, recorded not closed.** An itemized child is still editable through the Project
module: `ProjectController`'s own guard compares a status name to `"1"` and never fires. That is
documented in `FE/src/pages/LumpSum/LumpSum.md` and left as a follow-up.

## 3. The import dialog will not close by accident (`950e1f1e`, `d0222f5b`)

The warning report and the annotated error workbook are fetched by a filename held only in the
dialog's state. Nothing behind it holds either name and neither is re-derivable, so losing the
dialog means importing the workbook again to get the report back.

The dialog now ignores the backdrop and the Escape key — Headless UI routes both through one
handler, which is a deliberate no-op. The X button and the footer button are the only ways out, and
both ask first when a download is still on offer, with the client's wording. The review of that
change found the same loss reachable through a second door, loading another workbook, which clears
the previous run's results; that path now asks in the same words. The drop zone deliberately stays
live behind a result, because the Errors tab tells the user to correct the workbook and choose it
again.

Risk analysis: `lump-sum-import-dialog-close-guard_risk-analysis.md`. The one accepted risk worth
revisiting is that Escape no longer closes an untouched dialog, which breaks a convention most
users have in their fingers.

## 4. The list pages past page 1 (`802bc60d`, plan `lump-sum-list-pagination.md`)

`ShowLumpSum` has no OFFSET — `FilterDataCursor` answers a navigation mode plus the cursor that
mode needs, and a request carrying neither is treated as First. The list sent a bare page number,
so every click on Next was answered with page 1, and the pager, which renders from the echoed page,
never moved. It was the last hand-rolled pager in the app.

It now uses the shared `usePagination` hook and `PaginationBar`, and `fetchLumpSumList` takes a
`PaginatedRequest<LumpSumFilter>`. Two constraints are load-bearing: `Filters` must be an object on
the wire even when empty, because the controller dereferences a field off it with no null guard;
and applying a filter must clear the cursors. The pager's appearance changed with the swap — it
gains First and Last and loses the gap style — which the client has not seen yet.

## 5. Everything the itemized parent already enforced

Unchanged by the above, restated because the import path depends on it: a parent is locked while
itemized (`3dea3a87`), its UACS is locked once a child inherits it (`e35aecbe`), its first funding
line is not removable while children exist (`551f1686`), and a child's Alternate ID is its parent's
Project ID (`13ab4438`, deviation 7 in the Completion Log above).

## 6. The database underneath the module changed (2026-09-10)

Every verification record in this file was taken against `localhost/myps_db_dev`. On 2026-09-10
`Main/appsettings.Development.json` was repointed at **`localhost/myps_db_dev_200`**, restored
that afternoon from the `192.168.50.200` server.

It is a **different lineage**, not a newer copy. It carries that server's reporting and revision
fixes — two of them *newer* than the versions checked in here — and none of the Lump Sum work.
Verified object-by-object on 2026-09-10, it had no Lump Sum columns, views or seek indexes;
stale `fProgramStages` / `pRecomputeProgramCost` / `fProgramProjects`; the wallet-era
`tLSWallets`, `vLSWalletBalance`, `vLSWalletProjectSet` and `FK_tProjects_ParentWallet` still
present; `tProjectRevisions.Region` / `.DEO` / `.ImplementingOffice` still `NOT NULL`, which
alone stops a Lump Sum Project being saved; the wallet-era API action names, so every endpoint
403s; and `READ_COMMITTED_SNAPSHOT` **off again** — the deadlock fix recorded in the risk log
above was applied to the *other* database and did not travel with this restore.

Three consequences for anyone picking this plan up:

1. **One file brings it up.** `Main/Resources/Internal/SQLScripts/Migration.SchemaAndProgrammability.2026-09-10.sql`
   is idempotent and folds in the parts of `LumpSum.Baseline.sql`, `Importing.Schema.sql`,
   `Importing.CategoryToPAPMap.Schema.sql` (this plan's Stage 0) and `LumpSum.Permissions.sql`
   that this database actually needs. `LumpSum.Isolation.ReadCommittedSnapshot.sql` stays
   separate, because its `ALTER` disconnects every other session.
2. **Do not replay the scripts folder from the top.** `Reports.CrystalReportSQLFixes.sql` is
   *older* than the live `sp_RBP` and `a1_usp_AIP2`, whose only trace in this repo is a
   `_backup_pre_*` snapshot of the state before the fix. Running it reverts both silently.
3. **Every Lump Sum data migration is a no-op there.** `LumpSum.ComponentMigration.sql`, the
   `BalanceToPerYear` migration and the three `Repair` scripts all rewrite existing Lump Sum
   rows, and this database has none: 0 projects of type `LS`, 0 live `LS` components, 0 legacy
   `LS1` components. They become relevant only if Lump Sum data is later imported into it.

Nothing has been applied yet. The ordered procedure, the full starting state and the
do-not-run lists are in
[`MYPS_DEV_200_DATABASE_BRINGUP.md`](../docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md).

## 7. Where the module's documentation now lives

| Document | What it holds |
|---|---|
| `FE/src/pages/LumpSum/LumpSum.md` | the module's engineering reference, including the Approved-program section and the keyset-paging note |
| `FE/src/pages/LumpSum/UserManual.md` | what the user sees, per screen |
| `documents/plans/lump-sum-program-approved-gate.md` | the gate's plan and completion log (superseded in part by the narrowed rule) |
| `documents/plans/lump-sum-approved-details-server-enforced.md` | the server-side field guard |
| `documents/plans/lump-sum-list-pagination.md` | the pagination root cause analysis and fix |
| `documents/plans/lump-sum-import-dialog-close-guard_risk-analysis.md` | the dialog guard's risks |
| `documents/plans/lump-sum-program-approved-gate_risk-analysis.md` | the gate's risks |
| `documents/plans/lump-sum-review-findings-2026-09-10.md` | **fourteen open findings from the latest review** |
| `documents/docs/engineering/MYPS_DEV_200_DATABASE_BRINGUP.md` | how to bring `myps_db_dev_200` up, in order, and which scripts must not be run against it |

## Test coverage as it stands

Eight Lump Sum specs now exist: `ls-contract`, `ls-data-security`, `ls-data-security-ui`,
`ls-list-tolerance`, `ls-module-ui-walkthrough`, `ls-ownership`, `ls-program-approved`,
`ls-project-form-identity`.

Last full run, 2026-09-10, on a scratch API build against `localhost/myps_db_dev`: the six suites
run together were **55 passed, 3 known skips, 0 failed**. Unit tests 20 of 20. `tsc` at the Rbac
baseline.

The Approved-program specs need a fixture program that can reach GAA-R, and `AddProgram` cannot
create at a hyphenated stage — it writes the enum name into the stage column and the composite key
rejects it. `approvedProgramFixture.ts` therefore creates at GAA and advances, which needs at least
one project in the program, so it seeds a parent and deletes it afterwards.

## What this plan does **not** cover, and where to look

- The V2 module contract (endpoints, views, the parent/child boundary): `lump-sum-v2.md`.
- The full-branch review still outstanding: `lump-sum-v3-review-remediation.md`.
- The earlier findings pass: `lump-sum-v3-recent-work-review-findings.md`.
- The newest findings, none of them fixed: `lump-sum-review-findings-2026-09-10.md`.
