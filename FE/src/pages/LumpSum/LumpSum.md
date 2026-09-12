# Lump Sum — Developer Reference

27 files, ~6,600 lines, under `FE/src/pages/LumpSum/`.

> **This file was rewritten on 2026-09-04.** Everything before that described a
> different module: an "LS Wallet" backed by `dbo.tLSWallets`, running on mock
> data, with a documented "Mock/API-Swap Seam". None of that exists. The wallet
> tables were dropped, the mock layer was deleted, and the module talks to a real
> API. If you find a claim here contradicted by the code, the code is right —
> please fix this file rather than working around it.

---

## The model, in one paragraph

**There is no wallet.** A Lump Sum Project is an ordinary `tProjects` row that
holds a component of type `'LS'`. That component's **`Total` is the full
allocation** — kept equal to the sum of the parent's funding lines, never falling
— and its single **`tProjectComponentCostPerYear.Amount` is the remaining
balance** (model of 2026-09-06). Itemizing sets a child project's
`ParentProjectId` to the parent's `ProjectId` and deducts the child's cost from
the balance; deleting a child adds it back; Replenish raises both. `vLumpSumSet`
reads `OriginalAllocation` off the `Total` and `Remaining` off the row, so both
are stored and `Total = Remaining + Itemized` is a check the SQL verification
blocks report as DRIFT, not an identity.

Only the **parent's** generated Project ID ends in `LS` — that is a constant, not
a geographic code. A **child** takes its island code from its own Region, so a
child in Region III ends in `LZ`.

---

## Folder structure

```
pages/LumpSum/
├── Model.d.ts                     domain types + the Dto* wire contract
├── Service.ts                     ALL data access. The only file that touches httpClient
│
├── Views/
│   ├── LumpSumList.tsx            the grid, its filter bar, pagination
│   ├── AddLumpSum.tsx             thin wrapper — renders LumpSumForm mode="add"
│   └── LumpSumDetail.tsx          orchestrator: balance, form, children, activity, dialogs
│
├── components/
│   ├── LumpSumForm.tsx            one form, mode-driven, used by both Add and Detail
│   ├── LumpSumProgramDetailsSection.tsx
│   ├── LumpSumDetailsSection.tsx  the project-detail fields
│   ├── LumpSumFundingProfileForm.tsx
│   ├── LumpSumComponentCostForm.tsx
│   ├── LumpSumBalanceWidget.tsx   Total / Itemized / Remaining
│   ├── LumpSumActionButtons.tsx   renders a declarative action array
│   └── CollapsibleSection.tsx
│
├── dialogs/                       6 — Replenish, Import, both Deletes,
│                                  ComponentCost, SaveConfirm
├── hooks/useLumpSumBalance.ts     READS the balance from the atom; never computes it
├── rules/lumpSumFormRules.ts      the required set, in the server's order
├── store/lumpSumStore.ts          Jotai atoms. Start EMPTY
└── utils/
    ├── apiMappers.ts              view rows -> domain types
    ├── transformImportedChildren.ts  parsed workbook -> import DTO
    ├── lumpSumActions.ts          which buttons show, and why they are disabled
    ├── lumpSumStatusBadge.tsx
    └── constants.ts               REVISION_STAGES, LUMPSUM_EXCLUSIVE_COMPONENT_TYPES
```

---

## The thirteen endpoints

All on `LumpsumController`, all reached from a control — nothing is
retained-but-unreachable.

| Action | Service function | Reached from |
|---|---|---|
| `InitFilterLumpSum` | `fetchLumpSumFilterOptions` | the list's filter bar |
| `ShowLumpSum` | `fetchLumpSumList` | the list, paged by keyset (see below) |
| `LumpSumDetails` | `fetchLumpSumById` | detail page, and every write's re-read |
| `LumpSumBalance` | `fetchLumpSumBalance` | the itemized-floor check on save |
| `ShowLumpSumActivity` | `fetchLumpSumActivity` | the Activity panel, on first expand |
| `ShowItemizedProjects` | `fetchItemizedProjects` | the children table |
| `ValidateForItemization` | `validateForItemization` | before the Import dialog opens |
| `CreateLumpSum` | `createLumpSum` | the Add form |
| `UpdateLumpSum` | `updateLumpSum` | the Detail form's Save — answers the full `LumpSumDetails` shape in one request (2026-09-10); a lost answer locks Save until a re-read says what happened |
| `ReplenishLumpSum` | `replenishLumpSum` | **no page since 2026-09-08** — the dialog is local; Save carries the line through `UpdateLumpSum`. Kept as the API-level top-up |
| `DeleteLumpSum` | `deleteLumpSum` | Delete dialog |
| `DeleteItemizedProject` | `deleteItemizedProject` | a child row's Delete |
| `ImportItemizedProjects` | `importItemizedProjects` | Import dialog |

**Not in this module, and not coming back:** publishing (Programs owns it), the
WF-6 revision workflow, stage cascade, edit-draw, and itemizing an *existing*
project. A Lump Sum Project is itemized into **new** projects only, by import.

**The list pages by keyset, through the shared hook.** `ShowLumpSum` has no OFFSET: the
server answers a `Navigation` mode (First / Previous / Next / Last / Page) plus the cursor that
mode needs, and a request carrying neither is treated as First and answered with page 1. Until
2026-09-10 this page held its own page number and sent it bare, so every click on Next was
answered with the same ten rows and the pager, which renders from the server's echoed page,
never moved. `LumpSumList` now uses `usePagination` and `PaginationBar` like every other list;
`fetchLumpSumList` takes a `PaginatedRequest<LumpSumFilter>` and passes it through. Two things
that look incidental are not: `Filters` must always be an object on the wire, because the
controller reads `dto.Filters.ProgramFK` with no null guard, and `applyFilters` must clear the
cursors, or a search would walk from a row outside the new result.

**The Project List hands a Lump Sum Project to this module.** `ShowProjects` marks each
page's Lump Sum Projects (`IsLumpSum`: `tProjects.ProjectType = 'LS'` with no parent, looked
up on `tProjects`, never on `vLumpSumSet`), and `/projects`' View Details becomes **Open Lump
Sum**, routing to `/lumpsum/{Id}` — the row's `Id` is `tProjects.Id`, the same key
`vLumpSumSet` exposes. Itemized children stay ordinary projects. The project form's read-only
Lump Sum view still exists for deep links.

**The import posts the workbook itself** (`multipart/form-data`: `File`,
`ParentLumpSumId`, `ProgramId`), not rows parsed in the browser. The server
reads and validates it with the Importing module's own code, so the Download
Template from the Programs module is the one to fill. `parseImportFile` still
runs client-side, but only for the preview tabs and the Remaining pre-check.
A rejection is `400 { Title, Message, Errors[], ErrorFileName }`; the dialog
renders `Errors[]` and fetches `ErrorFileName` through
`/Importing/DownloadImportFile`. A success may carry `Notices[]` (duplicate
Descriptions), shown as warning toasts, and — since 2026-09-06 — `Warnings[]`
with `WarningCount` and `ReportFileName`: rows that were IMPORTED although a
validator warned on them. `Warnings[]` fills a Warnings tab that keeps the
dialog open; `ReportFileName` is a `.txt` under `Resources/Imports` served by the
same download endpoint, written after the commit so a rolled-back import leaves
none. See `documents/plans/lump-sum-v3.md`.

**Atomic per project, not per workbook** (2026-09-06, replacing V2's "the whole
import succeeds or fails together"). After `ImportStructuralRules.Apply` a project
is either wholly in the write lists or wholly in the error buckets — a Fail on any
sheet cascades to its Project Details row — so `LumpsumController.Import.cs` writes
the error workbook for what failed, refuses with 400 only when
`AcceptedProjectCount == 0`, runs the balance check over the accepted rows, writes
them in one transaction, and answers **200** carrying both halves: `Count`,
`Warnings[]`/`ReportFileName` for what went in, `Errors[]`/`ErrorFileName`/
`RefusedCount` for what was left out, `Title: "Imported with Exceptions"`. The
dialog reuses its Errors tab for the refusals (heading "N project(s) refused and
left out") beside the Warnings tab, and stays open until Done. A refused project
draws nothing from the parent.

**Warn is imported, not refused** (reversing V3's promotion). The validators'
`Warn` rules mean either "this value could not be read" — stored NULL by the
`Save*` writers, which re-`TryParse` everything — or "this value is out of
range" — stored as typed. `LumpsumController.Import.Validation.cs` partitions
error/warning/clean the way `ImportProjectJobService` does, hands the warned rows
to `ImportStructuralRules.Apply` as warn buckets (so the cascade can still demote
them), builds `Warnings[]`, then merges them into the write lists. `Fail` is
untouched: it refuses the row, the cascade takes that project's other sheets with
it, and `HasErrors` is workbook-level. M2 and P10 stay neutralised at their call
sites — M2 because the frontend's `-{n}` suffix would warn on every row, P10
because it is reported as a notice instead.

---

## Rules that are easy to break

**The atom starts empty.** Anything on screen came from the server or it is a
bug. `lumpSumStore` used to be seeded from a mock snapshot, which meant the
module rendered three fabricated projects before any request was made.

**`Service.ts` is the only file that touches `httpClient`.** That rule is the
point, not the file count — it stays one file at this size.

**Never compute the balance on the client.** `dbo.vLumpSumBalance` answers
Total / Itemized / Remaining, recomputed on every read. A client-side mirror
disagreed whenever the local copy of the children was stale. `useLumpSumBalance`
reads; it does not calculate. `null` from it means *not fetched*, never *zero* —
rendering ₱0.00 for an unloaded project reads as a fully-itemized one.

**After a write, re-read.** The allocation figures are computed by a view, so
patching the atom from a request is guesswork. Every mutation in `Service.ts`
re-fetches the project it changed.

**`ProgramId` on the domain type is `tPrograms.ProgramPK`,** the readable
`MP_P_CO-…` key — *not* the GUID-ish `ProgramId` column, and not
`ProgramLatest.ProgramId`. They differ only by an `MP_` prefix, which is why
sending the wrong one ("Program '…' was not found.") went unnoticed until a UI
spec drove the form.

**Stages are data, not a union.** `LumpSumStage` is a `string`. The database has
twelve stages and gains more by configuration; the old five-member union meant
every Trust Fund stage rendered an unstyled badge. Never order stages in the
frontend either — `REVISION_STAGES` is a membership test, not a threshold.

**`CurrentStage` is displayed, never submitted.** It lives in `tProjectStages`
and follows the program. The server ignores it if sent.

**UACS lives on the per-year rows and nowhere else — and the details form is
its single writer (2026-09-06).** `tProjectComponentCostPerYear.UACS` is the
only column it has: there is none on `tProjects`, none on `tProjectRevisions`,
and none on `tProjectComponentCost`. `vLumpSumSet.UACS` is a `SELECT TOP 1` over
those rows. The "OA Project Code (UACS)" box on the details form is where the
code is typed; `detailFields()` sends it as `Uacs`, and the server fans it out:
`CreateLumpSum` writes it onto the one per-year row it derives, and
`UpdateLumpSum` runs `ApplyUacsToPerYearRowsAsync` **after** the children merge
has flushed, so rows inserted by the same payload are covered. On update `Uacs`
is **tri-state**: absent = keep every row, `""` = clear every row to NULL, text
= set every row to the trimmed value. `NormalizeUacs` never lets `''` reach a
row (the views filter `IS NOT NULL` only). **The merge does not read a row's UACS
at all (2026-09-10).** It used to copy the payload's own row value over the
stored one, which made a second writer that nothing guarded: both freezes — the
itemized-parent guard and the Approved-program field guard — read `dto.Uacs` and
nothing else, so a payload that omitted `Uacs` and set the code on a row changed
a frozen parent while every child kept the old code. A new row is now born with
the project's stored code and the fan-out is the only thing that changes one. Consequences for the
frontend: `detailFields()` must send `form.UACS` **as is** — `undefined` on an
untouched null fetch (keep), `''` when the user cleared the box (clear); a
"tidy" to `|| undefined` would make UACS unclearable. `LumpSumComponentCostDialog`
only **displays** the code (`projectUacs`, falling back to the first row that has
one) and passes each row's UACS through untouched; `LumpSumComponentCostForm`
reads it back off the first row that has one. `Uacs` on `LumpSumDetailFieldsDTO`
is no longer vestigial.

### An Approved program closes the project's record, not its money (2026-09-09)

**The rule, as the client stated it.** Once a program's latest revision is `Approved` **and** at
`GAA-R`, exactly **two** actions are refused: **creating** a Lump Sum Project in that program and
**deleting** one. Everything else keeps working — Save, Replenish, Import Itemized Projects,
deleting an itemized child, removing a funding line — because GAA-R is precisely the stage that
work happens at. The project's own **details and component are read-only**, and that part is a
frontend rule.

> The first cut of this gate, earlier the same day, refused every mutator. That was wrong about
> the business, not merely strict: it made an approved Lump Sum Project useless. The narrowing is
> the client's rule; `ls-contract`'s boundary test asserts **both** halves, so a gate creeping
> back onto Save or Replenish fails as loudly as one that stops refusing the delete.

Both halves of the predicate are the Project form's (`ProjectForm.tsx`:
`StageName === 'GAA-R' && Status === Approved`); the stage half is this controller's
`RevisionStages`, so a program Approved at RBP or GAA is **not** gated, and a GAA-R program still
`Working` is not either. It lifts when the program is set back to Working or advances (the new
revision is born Working). Read from `dbo.vProgramLatest` — `Status` there is the status **name**,
never the code — keyed on the project's `ProgramFK`, which both callers already hold. Per request,
no schema change: adding the column to `vLumpSumSet` (its `vProgramLatest` join already exists) is
the fallback if the keyed read ever shows.

**Server.** `ReadProgramApprovalAsync(programFK)` returns a small record or null;
`AssertProgramNotApprovedAsync(programFK, action)` wraps it into the module's refusal shape,
`Title: "Program Approved"`. **Two callers only — `CreateLumpSum` and `DeleteLumpSum`.** Adding a
third means re-reading the rule above: `UpdateLumpSum` is how a Replenish and a funding-line
removal reach the database, so a gate there takes both with it. Each call sits **after**
`AssertLumpSumVisibleAsync` and **before** any stamp, stage or content check; where the mutator
holds the applock it runs under it, which the helper's comment explains along with what not to
copy. `LumpSumDetails` still carries `ProgramApproval: { ProgramName, StageName, Status } | null`
beside `Lock` — the program's own name and stage from `vProgramLatest`, not the project's mirror
of them, so the banner names what the gate actually read.

**Two dead idioms deliberately not copied.** `ProjectController.cs:829` compares the name
column to `"1"`; `:644` compares `EnumProgramStage.GAAR.ToString()` (`"GAAR"`) to a stage name
that reads `"GAA-R"`. Neither fires. The helper compares
`EnumProgramStatus.Approved.ToString()` and the `"GAA-R"` literal, and `ls-contract` proves it
fires — and, with a second fixture program Approved at `GAA`, that it does **not** fire off the
revision stage.

**Page.** The flag rides the payload the page already re-reads on focus/visibility
(`refreshGate`, formerly `refreshLock`), so a program approved while the tab sat in the
background updates the page on return. Two sentences, not one:
`approvedReason()` is the banner's and explains the read-only record;
`approvedDeleteReason()` is Delete Lump Sum Project's, because "read-only" does not explain a
refused delete. `openIfFree` takes a `refuseWhenApproved` flag that **only** Delete passes —
Replenish and Import call it for the lock check alone. `formDisabled` gains `programApproved`
(details and component read-only, exactly as for an itemized parent, **frontend only** by the
same decision); `saveDisabled` does **not**, and neither does the funding table's `disabled`,
because Save and the row Delete are what a top-up and a line removal travel on. The rose banner
suppresses the form's blue itemized note — both would say "details are read-only", and this one
does not lift by deleting children — but **not** the amber lock banner, which is now the thing
that actually holds Save.

**The click-time gate belongs to the action builders.** A greyed button is only as fresh as
the page's last read, so before any dialog opens the page re-reads the parent (`openIfFree`)
and refuses with the current reason. That re-read used to be re-attached by hand at every call
site, which is how the child Delete once lost it; `getLumpSumActions` and
`getItemizedProjectActions` now take the page's `gate` and wrap every `onClick` themselves,
choosing the flags in the same branch that greys the button — `refuseWhenApproved` only for
Delete Lump Sum Project, `refuseWhenDirty` for Import and the child Delete (both re-read the
parent on success and would discard a draft made during the silent round trip, so the unsaved
flag is re-checked **after** the re-read, through a ref). Callers pass bare openers.
`DeleteItemizedProject` is allowed on an Approved program (an import mistake has to stay
correctable) but takes the parent's applock, so its button greys with `lockReason` like the
parent's. The re-read is a full `LumpSumDetails` read whose only value is naming the lock
holder; a conflict response that carries the holder would make it unnecessary (risk analysis M5).

**The Component Cost dialog says why it went read-only.** It can be open when a focus refresh
flips the page's gate; its controls then grey reactively and no click can reach its submit
handler, so a toast there can never fire (the first attempt at this was exactly that, and dead).
`LumpSumForm` derives `formDisabledReason` beside `formDisabled` — lock, then approval, then the
itemized sentence — and threads it to the pencil's tooltip, a notice inside the dialog and the
dialog's Save tooltip. The narrated spec holds the dialog open across the flip on a plain parent.

**Creation.** The Add page's picker calls `/program/showprogram`, which applies **no** status
filter (not `ProjectController.SearchProgram`, which does — but is not on this path). So
`LumpSumProgramDetailsSection` filters with `isProgramApproved()` from `utils/constants.ts`,
the FE's one definition beside `REVISION_STAGES`; `CreateLumpSum` refuses regardless. The filter
runs on one 100-row page, so approved programs consume slots —
`documents/plans/lump-sum-add-page-program-picker.md` carries the options.

**The read-only details are enforced server-side, for Lump Sum Projects** (2026-09-09, the
maintainer's decision on the risk analysis' N1). Gating `UpdateLumpSum` as a whole would take
Replenish and the line removal with it, so the guard is **field-scoped**, the UACS block's own
shape ("A CHANGE IS REFUSED; AN ECHO IS NOT"): after `ValidateRequiredFieldsAsync` and before the
revision is loaded, when `ReadProgramApprovalAsync` is non-null, `FirstChangedDetail` compares
every field `ApplyDetailFields` writes against the `vLumpSumSet` row already in hand, and
`FirstChangedComponentAsync` compares the Component Cost's client-owned fields (its Description
and ComponentId; the per-year Year, Start and End dates; any row added or flagged deleted).
ComponentId joined that list on 2026-09-10: the guard's doc had claimed the single-component rule
fixed it, but that rule constrains the component **type** only and the merge writes ComponentId
unconditionally, so an echo that merely omitted it blanked the stored code on a closed record. The first difference
refuses with `"Program Approved"` and names the field. Funding lines are never compared, nor the
LS `Total` and per-year `Amount`, which `SyncLSToFundingAsync` derives. Three details that make
it honest: the five fields the writer **keeps** when omitted (`CategoryId`, `Tier`, `RegionWide`,
`Origin`, `Agency`) are compared only when sent; `Uacs` is tri-state and compared only when sent,
which is how a UACS change on a *childless* Approved project is refused (the UACS guard covers
itemized parents only); and every other field is written as sent, so an **omitted** value that
differs from a stored one is refused as the erasure it would be — the page re-sends what it
fetched and never trips this, but a partial payload from an API caller does, by decision. The
walkthrough's `Rank: 7` fixture is the kind of row where the contract suite's `echoUpdate`
(which omits `Rank`) would count as a change. It reads the approval rather than calling
`AssertProgramNotApprovedAsync`, so that helper's "two callers" rule holds. The Project module's
child save (R15) is still not gated.

**Known hole, recorded not closed.** An itemized child is an ordinary project, edited in the
Project module by design, and `ProjectController.UpdateProjectDetails`' own approval guard is
dead (above) — so a child can still be saved under an Approved GAA-R program. Under the narrowed
rule that is far less surprising than it was (the parent is not frozen either), but it still
moves the parent's `ItemizedTotal` with no Lump Sum rule applied.
(`AdjustParentAllocationAsync` in `Helpers/LumpsumHelper.cs`, sometimes named as the path by
which such an edit moves the balance, has **no caller** anywhere; the live path is the plain
child save.) The Component Cost dialog's Save is bound to `disabled` — it can be open when the
flag flips.

### Concurrency — the parent is locked while it is itemized

Every mutator of a parent takes a **SQL Server application lock** —
`sp_getapplock`, resource `MYPS:LumpSum:{tProjects.Id}`, `Exclusive`, owned by
the transaction, `@LockTimeout` 5 s — right after `BeginTransactionAsync` and
before the first read of the parent (`LumpsumController.Locking.cs`,
`AcquireLumpSumLockAsync`). Call sites: `ImportItemizedProjects` (which now opens
its transaction *before* reading the parent, so the Remaining it checks and the
UACS it copies are read under the lock), `UpdateLumpSum`, `ReplenishLumpSum`,
`DeleteLumpSum`, and `DeleteItemizedProject` (on the resolved parent). Same order
everywhere — applock, then rows — so they cannot deadlock one another. The
server releases it on commit, rollback or dispose; nothing can go stale. A caller
that cannot get it within 5 s receives **409 `Busy`**, which `httpClient` toasts
like any other server message. The helper throws if called outside a transaction:
with `@LockOwner = 'Transaction'` that would lock nothing.

The **visible stamp** is a courtesy on top: the import writes
`tProjects.LockedBy / LockedDate` (columns that existed unused) in autocommit
before its transaction and clears them in its `finally`, both through
`ExecuteUpdateAsync` — never `SaveChangesAsync`, because after a rollback the
context still tracks the children the import tried to add and a save would insert
them outside the transaction. A stamp older than **10 minutes** is ignored
everywhere (crash leftover). `LumpSumDetails` returns it as `Lock`,
`ValidateForItemization` refuses on it, and the detail page shows a banner and
disables Save / Replenish / Import / Delete with `lockReason()`. Program-module
operations (publish, stage change) do not take the lock; they touch children and
programs, not the parent's cost rows.

**The allocation moves through `Helpers/LumpsumHelper.cs`, and nowhere else**
(2026-09-06). Three helpers, one per kind of movement:

| Helper | Moves | Callers |
|---|---|---|
| `MoveLSBalanceAsync` | the per-year row only | the import (−imported total), a child delete (+returned cost), `AdjustParentAllocationAsync` when a child's cost is edited from Projects |
| `RaiseLSAllocationAsync` | `Total` **and** the row | `ReplenishLumpSum` (API callers only since 2026-09-08), after it appends the funding line |
| `SyncLSToFundingAsync` | derives both: `Total := Σ live funding`, row `:= Total − ItemizedTotal` | `UpdateLumpSum`, after the children merge has flushed — which is how a UI top-up now raises the allocation |

**A top-up raises the allocation, or it is refused (2026-09-10).** Because
`SyncLSToFundingAsync` derives the component from the lines, a payload that
appends a line while the lines total less than the stored allocation writes the
allocation **down** — and the audit note still says "increased by". So
`UpdateLumpSum` refuses a save that appends a funding line and deletes none
unless the new total exceeds the stored `OriginalAllocation`, with Title
`Allocation Mismatch` naming both figures. Removing a line is exempt: that is how
an allocation legitimately falls. The Replenish dialog is given the server's
figure as well as the lines — it still *sizes* the draft against the lines, since
the save posts them, but *checks* against whichever is higher, and shows an amber
notice naming both when they disagree.

**A funding line's share is derived, never typed (2026-09-10).**
`RederiveFundingShares` sets every live line's `Percentage` from its share of
their total, and both writers call it: `ReplenishLumpSum`, which always did, and
`UpdateLumpSum`'s merge, which stored what it was sent. The form's table
re-derives on screen too, but it is unmounted while the Funding Profile section
is collapsed — so a top-up from a collapsed page used to persist 100 and 0. No
balance, view or gate reads `Percentage`; the one thing it must be is consistent
with the amounts beside it.

`SyncLSToFundingAsync` is what makes the component **derived, not typed**:
whatever `Total` or `Amount` the client echoed is overwritten, so the dialog can
display two figures it does not own, and a form save that raced an import can no
longer write a pre-import figure back — the lost-update hazard recorded earlier
that day. The helpers live in `Helpers/` rather than the controller because
`AdjustParentAllocationAsync`, called from the Projects module, is one of the
writers. `ls-contract`'s `expectAllocationInvariant` guards all of them.

Earlier that day the model was the reverse (`Total` was the balance, the row
mirrored it) and before that the row never moved;
`LumpSum.Migrate.BalanceToPerYear.2026-09-06.sql` put existing rows on the
current model and `LumpSum.Repair.PerYearAmount.2026-09-06.sql` is superseded and
inert.

**An itemized parent is frozen in the form** (2026-09-06). `LumpSumForm` derives
`isItemized = mode === 'edit' && itemizedCount > 0` from the count the detail page
already passes, ORs it with the import's `lock` into one `formDisabled`, and hands
that to `LumpSumDetailsSection` and `LumpSumComponentCostForm` — every editable
control in both already honoured a `disabled` prop. A blue banner names the count;
it is suppressed while the import's amber banner is up, so the greyed fields never
carry two explanations. Nothing is stored: the state is computed from the live
child count, so deleting the last child thaws the form on the next render.
**Frontend only, by decision** — `UpdateLumpSum` accepts these fields from an API
caller exactly as before, and `ls-contract` carries a note saying so. Replenish,
Import and both Deletes live in the page's action bar, not this form, and stay
live: an itemized project must still be able to take money, and deleting its
children is what unfreezes it.

**The Funding Profile's Delete is the exception to that freeze** (2026-09-07). A
wrong line cannot be typed over and Replenish only appends, so removing it is the
only repair — and an itemized parent is exactly where a wrong line tends to be
noticed. So the funding table takes `disabled={!!lock}` rather than `formDisabled`
(only an import in progress closes it) plus `protectFirstLine={isItemized}`, and
**Save follows the import lock alone** (`saveDisabled = !!lock`) so the removal can
be persisted. That save carries nothing else: every other control on the form is
still disabled, so the payload is the fetched project plus the deletion. The
protected row is the FIRST funding line — the one `CreateLumpSum` wrote, found by
the smallest live `Id` (`firstFundingLine()`), not by position, since nothing sorts
the array — because it is
the allocation the children were imported against; each later line is a Replenish
top-up and stays removable. With no children nothing is protected and the last line
goes too. **UI only**, like the read-only table: the server's guard is "Below
Committed Draw", which refuses any removal dropping the allocation below the
children's draw.

**The views seek per project, and a hard delete locks its rows first** (2026-09-06, the
deadlock RCA — `documents/docs/engineering/MYPS_LUMPSUM_DEADLOCK_RCA.md`). `vLumpSumSet` and
`vLumpSumChildSet` used to resolve "latest revision" with a window function over every revision in
the database, which the `Id` filter could not push through: one detail read scanned 15,126 pages
of `tProjectRevisions`, taking shared locks on every other project's rows, and met the hard delete
of a *different* project — which removes stages before revisions, the reverse of the read's order —
in a deadlock the read lost every time. Both views are now `CROSS APPLY … TOP 1` per project (36
pages for the same read), backed by `IX_tProjectStages_RevisionId` and `IX_tProjects_ProjectType`,
and the database is expected to run `READ_COMMITTED_SNAPSHOT` (a run-once script,
`LumpSum.Isolation.ReadCommittedSnapshot.sql`; the Baseline warns when it is off). Do not reintroduce
a `ROW_NUMBER` CTE into either view: it looks harmless and it is the scan. A lock-first helper for
the hard deletes was tried and removed the same day: a `SELECT` with `XLOCK` locks the keys of the
index it seeks, which was the foreign-key index and never the clustered key the deletes contend on,
and any order it took inverted against either the readers or `DeleteProgram` — the RCA has the
evidence. `ls-contract` carries a race case — forty reads during five hard deletes — that fails if
the view rewrite and the isolation both regress.

**The Funding Profile table is read-only** (2026-09-06). Source, Agreement and
Amount render as disabled inputs and there is no **Add Funding**:
`CreateLumpSum` writes the first line, Replenish appends the rest, and the LS
component's `Total` is derived from the lines on every save — so typing here
would move the allocation behind Replenish's back, and an amount cut below what
the children draw would put the project under water. **Delete stays**, because a
line recorded against the wrong source can no longer be corrected in place;
`UpdateLumpSum`'s "Below Committed Draw" check is what stops a removal going too
far. **Including the last line** (2026-09-07): the update path used to refuse a
payload leaving none ("Funding Profile Required"), which on the ordinary
single-line project made a wrong line uncorrectable — the codes cannot be typed
over, Replenish only appends above the current allocation, and create writes
exactly one. Zero lines is now legitimate and recoverable: the allocation derives
to 0, the project keeps its LS component and its place in the module, and
Replenish restores it (it asks for Source and Agreement outright with no line to
copy). "Below Committed Draw" still refuses emptying a parent its children draw
from, and while it has children the whole form is read-only anyway. `onEdit` is still wired: the percentage each line carries is derived from
the amounts and reaches form state through it. The server is unchanged — an API
caller may still add or re-value lines, and the allocation follows them.

**Replenish also appends the funding line it always claimed to** (2026-09-06).
`ReplenishLumpSumDTO.Source/Agreement` were declared, documented and never read;
the server raised the component alone, so Σ funding lagged the allocation by every
top-up and the Component Cost dialog's cap (the funded total) sat below the
component. Now the top-up is a new `tProjectFundingProfile` line — source and
agreement from the request, else copied from the **first funding line** (the
earliest live line by Id — `firstFundingLine()`, the same definition the table
uses to protect that line on an itemized parent; rule of 2026-09-08, it was the
largest line before);
a source named without an agreement gets the first line's agreement only if the
first line is under that source, otherwise the agreement must be named; refused if
there is neither — existing lines' amounts untouched, `Percentage` re-derived
across all live lines, then `RaiseLSAllocationAsync`. The invariant `ls-contract`
guards on every mutation: Σ funding = component `Total` = `OriginalAllocation`,
and the per-year `Amount` = `Remaining` = `Total − ItemizedTotal`.
`LumpSum.Repair.FundingGap.2026-09-06.sql` appends the missing line for parents
replenished before this — and since `Total` is now *defined* as Σ funding, that
script is a prerequisite of the model migration, not just a repair. The dialog
offers the two codes as optional selects fed by `getComponentsEnums`.

**Replenish is local until Save** (2026-09-08). The page had two commit points:
Replenish posted to `ReplenishLumpSum` the moment the dialog closed, and Save
committed everything else. Now `ReplenishLumpSumDialog` makes no request. It
resolves the pair the way the server did — blank/blank copies the first funding
line, source-only takes the first line's agreement only if the first line is under
that source, agreement-only takes the agreement's owner from the lookup — and
hands `LumpSumForm` a draft `{ Id: 0, Source, Agreement, Amount: newTotal −
localFundedTotal, Percentage: 0 }` through `onSubmit`. The form owns the dialog
(the lines live in its state; the page only passes `replenishOpen`), appends the
draft, and the table's percentage effect re-derives every share. The refusals in
the dialog are final, not a courtesy: nothing follows them until Save, so a blank
half is refused there rather than minutes later on a save carrying other edits.
"Current Allocation" in the dialog is the LOCAL funded total, so two top-ups stack.

*Derived figures:* the atom stays a read-only mirror of `vLumpSumBalance` (the
2026-09-06 decision). The form reports `{ pendingDelta, isDirty }` through
`onFundingStateChange`; `LumpSumDetail` renders the widget as `Total +
pendingDelta` / `Remaining + pendingDelta` and `LumpSumBalanceWidget` prints
"includes ₱X unsaved" under both. The Component Cost ceiling already reads the
form's `fundedTotal`. A pending row is tinted and badged **Unsaved**
(`data-unsaved-line`, which the walkthrough asserts on); **Discard funding
changes** beside the totals resets the lines from `initialData`.

*Dirty state gates what would destroy it:* Import and Delete-child both re-read
the parent on success and reset the form, so `getLumpSumActions` /
`getItemizedProjectActions` disable them with `UNSAVED_FUNDING_REASON` while
`hasUnsavedFunding` (precedence: busy > dirty > stage > remaining). Replenish and
Delete Lump Sum stay enabled. `beforeunload` covers refresh/close; the page's own
breadcrumb link confirms first. React Router's `useBlocker` is **not** used — the
app runs on `BrowserRouter`, not a data router — so sidebar navigation is not
intercepted. Recorded as the residual of R9.

*Resets are explicit, and this fixed a live regression:* `LumpSumForm`'s
`initialData` effect keyed on object identity, and `e35aecbe`'s lock refresh
re-reads the parent through `patchStore` on every window focus — so every tab
switch wiped every unsaved edit (and, before this change, was also the only reason
a Replenish appeared in the table at all). The effect now keys on
`[mode, initialData?.Id, dataVersion]`, reading the latest data through a ref;
`LumpSumDetail` bumps `dataVersion` after the mount fetch (a list row seeds the
form with no child sets, so the detail fetch must reset it), after an import and
after a child delete — never from `refreshLock`. Save resets itself from
`updateLumpSum`'s returned re-read, which is mandatory: without it the inserted
line keeps `Id: 0` in state and inserts again on the next Save.

*Two guards the review added.* **Replenish waits for the detail fetch.** This page
renders from the atom, and a list row is in the atom without its child sets — so it
renders while the fetch is in flight and after one that failed (the catch is
deliberate: the last known state stays on screen). With no lines the form holds `[]`,
the dialog's current allocation reads ₱0.00, and the draft would carry `newTotal − 0`
— the whole new total as a top-up. So `getLumpSumActions` takes `fundingLinesLoaded`
and disables the button until real lines are in hand. Save was already safe:
`handleUpdate` refuses a payload with no live funding line. **And the Add form's
Funding Agreement list is filtered by the chosen Source**, cleared when that Source
changes, because `CreateLumpSum` now refuses a pair that does not belong together —
an unfiltered list would build a payload the server answers 400 to with nothing on
screen saying which agreements are valid.

*Server:* `UpdateLumpSum` applies to every `Id == 0 && !IsDeleted` line what
`ReplenishLumpSum` applied to a request — the `RevisionStages` gate ("Stage Not
Reached", worded for a new line, in `UpdateLumpSum` where the stage is in hand);
`Amount > 0` and the pair rule in `ValidateRequiredFieldsAsync`'s update branch,
**new lines only** so a legacy row paired before the ownership rule stays saveable;
and the "Lump Sum allocation increased by X to Y (Source / Agreement)" note per
inserted line in `SaveLumpSumChildrenAsync`, "to Y" running up through the payload.
The ownership check is `ValidateFundingPairsAsync`, shared by Replenish, Create
(tightened as a side benefit) and Update. `ReplenishLumpSum` itself is unchanged
and is the API-level top-up; `ls-contract` and `ls-data-security` specify it, and
`ls-contract` gained the mirror case for a top-up arriving through `UpdateLumpSum`.

**Children inherit UACS at import time, and never re-sync.**
`ImportItemizedProjects` copies the parent's UACS onto every per-year row it
writes (Design Report 2.6.8). It used to *validate* equality instead and refuse a
mismatch — which proved nothing, since a child's UACS was never stored, so the
check compared against a value that would be discarded and passed trivially
whenever the parent had none. Changing a parent's UACS afterwards does not reach
children already imported.

**There is exactly one component, and it is not added, deleted or typed**
(2026-09-06). `CreateLumpSum` writes it; `SyncLSToFundingAsync` derives its two
money figures on every save; `ValidateRequiredFieldsAsync` refuses a payload that
leaves anything other than one live component, or one that is not the `LS` type
(`Title: "Single Component"`). So `LumpSumComponentCostForm` has no **Add
Component** button and no row Delete, and `LumpSumComponentCostDialog` is
edit-only: Component Type pinned to Lump Sum, Component ID to `LS`, Year to the
row's own year, **Allocation** and **Remaining** displayed, dates 1 January – 31
December. Only Description is editable (UACS is typed on the details form and
shown here). There is no "Add Year" either. Resolve the type by
`ComponentId === 'LS'` (`LUMPSUM_COMPONENT_ID`), never by the display name.

**And it is the project's OWN component, checked against the revision
(2026-09-10).** `ValidateRequiredFieldsAsync` answers *how many* live components
a payload describes and *what type* the survivor claims to be; it never sees the
revision, so it cannot answer *which row that is*. A payload that flagged the
real row deleted and presented a live `LS`-type row carrying a foreign or
invented Id therefore satisfied it — and the merge, which skips an Id it does not
own and copies `IsDeleted` onto the one it does, soft-deleted the allocation and
committed. Since `vLumpSumSet` admits a project only while it holds a live LS
component, the project left the module: gone from the list, "Not Found" on open,
every itemized child unsaveable. `UpdateLumpSum` now reads the revision's own LS
row and requires the payload's one live component to *be* it, and requires the
payload to leave that component a live per-year row — an existing one, or an
Id-0 row attached to it by `CostId`, so replacing the row stays legal. The
`SyncLSToFundingAsync` return, which says the same thing from the database's
side, is read rather than discarded: false rolls back instead of committing.

**The dialog must not compute `Total` from the per-year Amounts.** It did until
2026-09-06, which was right when `Total` meant "the sum of the years"; under this
model it would write the balance into the allocation on every open. Both figures
are the server's.

**Dates are derived in three places and must agree.** `yearBounds()` in the
dialog, `CreateLumpSum` server-side, and `LumpSum.ComponentMigration.sql` §3 all
produce 1 Jan – 31 Dec of the row's year. The dialog also fills them in for a
stored row that has none, because the fields are read-only and the user could not
otherwise supply what the submit guard demands.

**An `UpdateLumpSum` that omits the dates NULLS them.**
`SaveLumpSumChildrenAsync` assigns whatever arrives. The dialog always sends them,
but any other caller — a spec, a script — silently wipes them and leaves a
component the form then refuses to save.

**Nothing is seeded from the funded total any more.** That rule existed for the
add flow, which is gone: the dialog only ever edits the row `CreateLumpSum`
wrote, and shows the balance the server holds. `maxAmountCost` and
`buildInitialPerYearCost` were removed with it.

**No `showToast` in a `catch` for API errors** — `httpClient`'s interceptor
already raised the server's own message. Client-side validation toasts are the
exception, and `LumpSumForm` raises exactly one, for the first failure in rule
order.

---

## Create and update post different shapes

Because the server does.

**Create** takes one `Allocation` plus one `FundingSource` / `FundingAgreement`,
and writes the LS component and that funding line in one transaction. It does
**not** read the child arrays. A Lump Sum Project created without a funding line
shows its whole allocation against a Max Cost of zero in the project form.

**Update** takes the full replacement child sets and merges them:
`Id === 0` inserts, `Id > 0` updates, `Id > 0 && IsDeleted` soft-deletes, and a
row simply left out is **not touched**. An omission is never a delete.

Per-year rows attach to their cost through `CostId`, a client-side correlation
key. For a persisted cost it is `String(Id)`, so the server's map resolves it
back to the same row either way.

---

## Data security

`AssertLumpSumVisibleAsync` guards every project-scoped action. It is a no-op
unless the session's `ApplyFilter` is set, which on a fresh dev restore is true
of nobody — see `Main/Resources/Internal/SQLScripts/LumpSum.DataSecurity.Dev.sql`
for the fixture that makes it testable, and `e2e/tests/ls-data-security.spec.ts`
for what it proves.

Two known divergences, both carried as skipped tests rather than forgotten:
`InitFilterLumpSum` names programs the user cannot see, and a Central Office user
can *open* a Lump Sum Project but not *list* it.

---

## Cross-module touches

- `Project/dialogs/ComponentCostDialog.tsx` filters `LS` out of its component-type
  dropdown using `LUMPSUM_EXCLUSIVE_COMPONENT_TYPES` from here.
- `Project/filteringLocations` — `useLocationFilters` is reused via an adapter.
- Both `ProjectDetailsForm.tsx` files (Project and Modification) must **not**
  overwrite `IslandCode` / `ProjectType` when the record is a Lump Sum Project.
  That guard is load-bearing: without it the save fails on
  `CK_tProjects_ProjectType`, and if it ever succeeded the project's cost would
  be double-counted in the program total.
- `RouteName: 'AddWallet'` keeps its wallet-era spelling deliberately — it is a
  `dbo.tAppViews` row matched against the session's ViewAccess, not a code
  symbol.

### The details form renders only the required fields

`LumpSumDetailsSection` shows the seven fields the server requires, Alternate ID
(editable), and UACS (read-only — see *UACS lives on the per-year rows*). The
sixteen optional fields are **not rendered** (decided 2026-09-06, reversing the
2026-09-04 "visible but locked" rule from `4f761fc3`).

**Tier is not rendered either, and is no longer required** (2026-09-06). A Lump
Sum Project covers a programme, every migrated parent is Tier 1 and
`tOptionProjectTier` holds only 1 and 2, so the starred select was a choice with
nothing to base it on. `CreateLumpSum` does `dto.Tier ??= 1` before
`ValidateRequiredFieldsAsync`, whose Tier clause is now a range guard on an
explicit value (null passes); `ApplyDetailFields` keeps `dto.Tier ?? revision.Tier`
so an edit never regresses a stored Tier. `lumpSumFormRules.ts` has no Tier rule
(one would block add-mode on an invisible field). The `LumpSum` model, mappers and
`detailFields()` still carry `Tier` — same reasoning as the paragraph below.
`ls-contract` covers the three server properties; `ls-module-ui-walkthrough`
asserts the label is absent and that a form-created project lands as Tier 1.
This is a form default, not the import's case: itemized children still take Tier
from the workbook and an unknown one is refused, never defaulted.

**The optional fields' values still
travel:** the `LumpSum` model, `apiMappers.ts`, the form state and
`detailFields()` in `LumpSumForm.tsx` are unchanged, so a fetched Region or
Rank is sent back on every save. That is load-bearing — `ApplyDetailFields`
assigns Region, Province, City, LD, DEO, Implementing Office, the readiness
fields, Rank and MYCA date with no null-guard, so a payload that stopped carrying
them would null them. Do not trim the model or `detailFields` to match the
section. `ls-module-ui-walkthrough` asserts the hidden labels are absent and that
the UpdateLumpSum payload still carries Rank and the MYCA date.

### This module owns editing

A Lump Sum **parent** is created, edited and deleted here and nowhere else.
`WebAPI/Controllers/Lumpsum/LumpSumGuard.cs` is the single definition; five
routes refuse on it — `ProjectController.AddProject` and `UpdateProjectDetails`,
and `RevisionController.ReviseProject`, `RequestRevision` and `ResubmitRevision`.
The Project form mirrors this by rendering read-only with an explanatory banner,
but the server refusals are what hold the line.

**`ProjectType = 'LS'` alone is NOT the test.** Itemized children carry it too —
the importer copies it down, and 18 of the 21 rows holding it in the sample data
are children. The predicate is `ProjectType = 'LS' AND ParentProjectId IS NULL`.
Children are ordinary projects, edited in the Projects module as normal; this
module only creates and deletes them.

The frontend's `IslandCode === 'LS'` needs no such qualifier: a child takes its
island code from its own Region, so only parents ever read `LS` there.

**A category that runs out of Project IDs is refused by name (2026-09-10).** Both
minting sites — `CreateLumpSum` for the parent, and the itemization import for
each child — call `ProjectHelper.GenerateProjectID`, which since 2026-09-08
translates the allocator's `PROJECTID_RANGE_EXHAUSTED` into a typed
`ProjectIdRangeExhaustedException`. Neither caught it, so an exhausted range read
as "Application Error" with a reference id for a condition only an administrator
can clear. Both now answer 400 with Title `Project ID Range Exhausted`, the same
title `ProjectController.AddProject` uses, and the import **refuses the whole
batch**: the range is not a row error the workbook can fix, and the allocator
advances its sequence *before* it raises, so a path that committed the projects
around the failure would leave the counter past its own maximum once per refused
row. The rollback restores it — verified by observing `tProjectIdSequence`
unchanged across a refused create. The import's refusal carries the same
`Errors` and `ErrorFileName` every batch-level refusal in that method carries,
so an annotated workbook written before the write loop is reachable rather than
orphaned; it names the category by its stored name, and says honestly that
*one of the category's ranges* ran out — the allocator keeps a sequence per
(category, stage, island, year) and the exception carries only the category, so
the row count it gives is an upper bound. Both catches log a Warning with the
category, user and parent: the toast cannot reach the administrator who has to
widen the range, and the exception handler that used to log it is no longer on
the path. The typed catch sits above the generic one, which C# enforces anyway
(CS0160), so the characterization tests assert inside the typed catch's own
text — existence and response shape — and nothing about ordering.

One environmental caveat: the allocator only raises where
`dbo.pReserveProjectIdBlock` carries the `Maximum` check. That version lives in
the maintainer's database and, verbatim, in `MYPS.DatabaseTests`; there is no
deployable script in the repo. On a database still carrying the older
`-- FUTURE:` comment the exception cannot occur and these catches are inert.

**Place the guard before `ValidateProjectId`.** That path reads
`fProjectDetails`, which throws `SqlNullValueException` on a Lump Sum Project —
its Region, Province and DEO are legitimately null. A guard after it never runs.

The Project module's parallel "Itemized Lump Sum" import was **deleted**. It
posted to `/Importing/ImportProject/`, so it set no `ParentProjectId`, deducted
nothing from the allocation and applied no rule from here — the projects it made
never appeared as children while the parent still reported its full allocation.

---

## Testing

| Spec | What it covers |
|---|---|
| `e2e/tests/ls-contract.spec.ts` | the API contract, all 13 actions |
| `e2e/tests/ls-data-security.spec.ts` | row-level visibility, all 13 actions |
| `e2e/tests/ls-data-security-ui.narrated.spec.ts` | how a refusal looks to a person |
| `e2e/tests/ls-module-ui-walkthrough.narrated.spec.ts` | every control, by clicking |
| `e2e/tests/ls-project-form-identity.narrated.spec.ts` | the cross-module identity guard |
| `e2e/tests/ls-program-approved.narrated.spec.ts` | an Approved program: the banner, the refused Delete, the money controls staying live, the flip on focus, a draft that still saves, the Add picker |

A `globalTeardown` sweeper removes anything a run leaves behind, keyed on the
`(e2e <timestamp>)` marker every fixture writes. See `e2e/CLAUDE.md` for how to
run them and for the two ways a permissions spec can pass while proving nothing.
