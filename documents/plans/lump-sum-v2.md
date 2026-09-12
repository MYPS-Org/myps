# Lump Sum V2 — clean rebuild on `dp-deployment`

**Status:** **All tasks complete and verified on the final tree** — S1–S7, J1–J6, D1–D3.
Backend 13 of 13, frontend wired to every one, 27 e2e assertions passing across five specs
(5 deliberate skips). **Not yet integrated:** 47 commits on `feat/lumpsum-v2`, forked from
`dp-deployment` at `70f8c969`, awaiting a merge-or-PR decision. What remains is not tasks
but **six open acceptance criteria and four known gaps**, listed below; two of the gaps are
probably not this module's to fix
**Basis:** [`documents/Lump Sum/Lump-Sum-Module-Implementation-Plan.md`](../Lump%20Sum/Lump-Sum-Module-Implementation-Plan.md) (V1 replay plan; corrected below)
**Authority:** MYPS Operations Guide V7.0 §D.3 · Application Design Report Vol 2 §2.6.8 (pp. 113–116)
**Branch:** `feat/lumpsum-v2`, off `dp-deployment`
**Reference implementation:** `fix/lumpsum-plain-colors-screenshots-lswallets-models` @ `c5ee002d`
**Dev database:** `localhost` / `myps_db_dev`

## Progress

| Commit | What landed |
|---|---|
| `8a937c25` | **Phase 1 — DB.** `LumpSum.Baseline.sql` (one script, replacing the whole `LSWallet.*.sql` chain); 4 views; `ParentProjectId` / `ItemizationType` / `ProjectStatus`; ADR-055 rollups re-pointed; wallet-era objects dropped |
| `14ae13d5` | **Phase 2 — EF.** 4 view models from `sys.columns`; 8 old models deleted; `Projects` entity remapped; wallet-era controller removed |
| `3992b116` | **Phase 3a.** `LumpsumHelper`; 25 DTOs renamed |
| `c92b91ab` | **Phase 3b.** Controller core + `InitFilterLumpSum`, `ShowLumpSum`, `LumpSumDetails`, `LumpSumBalance` |
| `c41e5645` | Sample data from `MyMYPS`; baseline §2b nullability change |
| `aa81f31e` | FK-chain integrity checks for the sample load |
| `83999931` | Missing-FK known gap recorded |
| `20c91003` | Plan realigned with what was actually built |
| `904b9dfe` | **Phase 3c.** `CreateLumpSum` + `UpdateLumpSum` on one storage model |
| `889afb4d` | **S5 permissions**, plus three bugs found by running the write path |
| `e935eb4a` | `ReplenishLumpSum`, and the stage gate re-ordered onto `StageHierarchy` |
| `0fd5ca39` | `ImportItemizedProjects` — the only itemization path V2 ships |
| `608e064d` | The five reachable actions, and a `tProjectMajorWorkItem` row leak in both hard deletes |
| `7f2caea2` | Migrated sample Tier normalised from 0 to 1 |
| `13d300b7` | Replenish and Import confined to `GAA-R`/`TF-R`; both layers stopped ordering stages (**`TF-R` since removed — decision 9, amended 2026-09-04**) |
| `1dda535d` | ProjectId allocator advanced past the sample data — creates were failing database-wide |
| `201d4650` | An itemized child's island code comes from its Region; only the parent ends in `LS` |
| `15760e5a` | **J1a.** `LSWallet/` → `LumpSum/` on disk — 22 files, their identifiers, and the route param |
| `d7b3509b` | **J1b.** The mock layer deleted and every function wired to the 13 real endpoints |
| `9f52c308` | **S7.** The visibility gate reaches `ShowItemizedProjects` and `DeleteItemizedProject`; the latter stops deleting non-children and stops citing WF-6 |
| `63d240b4` | `AssertLumpSumVisibleAsync` proven at runtime for the first time — a restricted-account fixture and a spec over all 13 actions |
| `f08ec628` | **J6.** The Region field stops overwriting a Lump Sum Project's IslandCode and ProjectType |
| `8cfd06e2` | **J4.** The form enforces the server's required set, in the server's order and wording |
| `6c7d0da3`, `321a067b`, `248a5514` | **J5.** A sweeper that survives a failed run, data security through the UI, the narrated walkthrough — which found that create had never worked from the form — and the identity regression |
| `d2eed056` | **D1–D3.** Both module documents rewritten; the e2e coverage table finished |
| `4f761fc3` | Optional fields locked on the Lump Sum form in both modes, Alternate ID excepted; the required markers re-checked |
| `c49102ee` | `SyncAPIPermissions` run; this plan's reason for avoiding it was wrong, and is corrected |
| `679901b9`, `bcc4a22a` | That endpoint's unreachable second implementation written up, then deleted (**not Lump Sum code** — found by running it for this module) |

**Controller actions: 13 of 13 — the backend is COMPLETE.** (Thirteen: the reference's 24 less
the 5 WF-6 actions and `PublishItemizedProject` (decisions 7, 8), `AdvanceProgramStage`
(decision 3), `ItemizeProject` and `ShowItemizableProjects` (decision 11), and
`ScheduleItemizedProjects` and `UpdateDrawAmount` (decision 12). Earlier revisions of this plan
said 18, then 17, then 15.)

Done (13): `InitFilterLumpSum`, `ShowLumpSum`, `LumpSumDetails`, `LumpSumBalance`,
`ShowItemizedProjects`, `ShowLumpSumActivity`, `ValidateForItemization`, `CreateLumpSum`,
`UpdateLumpSum`, `ReplenishLumpSum`, `DeleteLumpSum`, `DeleteItemizedProject`,
`ImportItemizedProjects`.

Implemented and registered actions match EXACTLY — 13 each, none ungranted, no dangling grants.
Every action that exists is one the UI reaches; nothing is retained-but-unreachable — true of
the frontend too since `d7b3509b`, which put a control behind the last two.

> **"Complete" meant every action existed and worked, not that every action was correct.** A
> sweep during J1 found three defects, all in `.Itemization.cs` and all fixed by S7
> (`9f52c308`): `ShowItemizedProjects` and `DeleteItemizedProject` never called
> `AssertLumpSumVisibleAsync`; `DeleteItemizedProject` would delete any project whose
> `ProjectPK` was posted, itemized child or not; and its published refusal carried the WF-6
> wording S4a said not to copy. Worth remembering when the next phase is called complete —
> all three were found by reading the plan's own claims back against the code.

**Remaining work, in the order it should be done:**

Every task is done. What is left is judgement, not work-in-progress.

### Open acceptance criteria, and why each is still open

| Criterion | Why |
|---|---|
| ~~The LS exemptions still apply on the project form~~ | **CLOSED 2026-09-04.** The blocker was not missing data: `ProjectLatest` declared Region and ImplementingOffice non-nullable, so one Lump Sum Project emptied `/projects` for everything. Both are `string?` now, the spec self-enabled, and it asserts the exemptions. See `lump-sum-ownership.md` § *List nullability* |
| An LS Project **opens** in `/projects/project-details/…` | **CLOSED**, same fix. It does not *save* there by design — the ownership work made the form read-only and `UpdateProjectDetails` refuses it, so the criterion's second half no longer describes intended behaviour |
| Itemization refuses all five guardrail cases naming the figures | Partly covered by `ls-contract`; the five were reshaped when itemization became import-only, so the criterion needs restating against what exists |
| Import still succeeds end to end, template included | The dialog and its guards are covered; downloading the template and re-importing it is not |
| `npm run ls` green | There is no `ls` script; the command in this plan was aspirational. Name the five specs, or add the script |
| The active tab round-trips through the URL | **Moot as written** — the detail page has collapsible sections, not tabs. Restate or drop |

### Known gaps, in order of consequence

> Six now, not four — the optional-field lock surfaced two more, both pre-existing and both
> recorded below: three DTO fields that are never written, and a location chain that
> contradicts the field spec. The list-nullability work then added a seventh (gap 5), and
> closed one: the project lists no longer die on a Lump Sum Project.

1. **A Central Office user can open a Lump Sum Project but not list it.** The guard uses
   `fUserVisiblePrograms` (which exempts central users); `ShowLumpSum` filters inline on
   `_Session.RegCode`, NULL for them. **Probably not ours** — the same inline pattern is in
   `ProgramController` and `ProjectController`.
2. **`InitFilterLumpSum` discloses program names** to users who cannot see the programs. No
   figures leak.
3. **`AuthController.Validate` must be granted or a group cannot use the app at all** —
   login succeeds, the session fails to validate, and the user is returned to the login form
   with nothing naming a permission. Not ours, but it will bite whoever builds the next group.
4. **`WebAPI.csproj` excludes `Controllers\Dashboard\**`** from compilation, so
   `/api/Dashboard/Summary` is a 405 while `FE/src/pages/Dashboard/` still calls it. If it is
   ever re-enabled it needs null handling: it groups on `ProjectLatest.Region` /
   `.ImplementingOffice` and calls `Dictionary.TryGetValue` on them, both of which are now
   legitimately null for a Lump Sum Project.
5. **`vLumpSumSet` is one recompile away from being unqueryable on this data volume.** It
   returns 21 rows but ranks all 128,705 `tProjectRevisions` and aggregates 187,749
   `tProjectComponentCost` rows first, because the `ROW_NUMBER()` in its `LatestRevision` CTE
   blocks any predicate from being pushed in. A plan-cache flush on 2026-09-04 recompiled
   `SELECT TOP(1) ... WHERE Id = @p` into a plan demanding an **11 GB memory grant**, and every
   Lump Sum endpoint returned `SqlServerFailure` until `CLEAR PROCEDURE_CACHE` was run. Any DDL
   in this database can trigger it again. Written up in full, with candidate fixes, in
   `lump-sum-ownership.md` § *Noted while verifying*.

6. **The Program import cannot INSERT on a database carrying this branch's baseline.**
   `LumpSum.Baseline.sql` §1 constrains `tProjects.ProjectType` to `NP / AIP / LS / MY`
   (`CK_tProjects_ProjectType`), while the Program importer's `SaveProjectDetails`
   (`Hangfire/Importing/ImportingHelper.cs`, unchanged dev-trunk code) writes the row's **island
   code** (`LZ` / `VS` / `MN`) into `ProjectType`. Found 2026-09-05 while proving the V3
   extraction: a clean workbook reaches the save loop and fails with
   *"The INSERT statement conflicted with the CHECK constraint CK_tProjects_ProjectType"*; the
   job records `Failed`, releases the lock, and writes nothing. Every non-Lump-Sum row on
   `localhost/myps_db_dev` holds the literal text `'NULL'` there, so the importer's value is not
   what the main app writes either. **Decided 2026-09-05: the constraint is dropped** and not
   re-created — a hard-coded code list is the wrong shape; an enum table is the follow-up. The
   importer is not changed. Full record:
   [`MYPS_PROJECTTYPE_CHECK_CONSTRAINT_REMOVED.md`](../docs/engineering/MYPS_PROJECTTYPE_CHECK_CONSTRAINT_REMOVED.md).
   The Lump Sum import is unaffected — it writes `LS`, and an itemized child's island code
   goes into its Project ID suffix and `tProjectRevisions.IslandCode`.

Gaps 1 and 2 are carried as skipped tests in `ls-data-security.spec.ts` and
`ls-data-security-ui.narrated.spec.ts` so they cannot be quietly forgotten.

### How to verify

The narrated Playwright run `CLAUDE.md` requires is now **possible but not yet written** —
that is J5. Two lower rungs are available and both have already caught real defects.

**Rung 1 — drive the API directly.** This is how the write path was proven, and it found
three bugs that all compiled cleanly:

```bash
cd Main && ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5015 \
  dotnet run --no-launch-profile
# login (the controller is AuthController, so the route is /api/Auth/Login) and keep the cookie
curl -s -D - -o /dev/null -X POST http://localhost:5015/api/Auth/Login \
  -H "Content-Type: application/json" \
  -d '{"UserName":"jimeneznr","Password":"AnyPassword"}' | grep -i set-cookie
# then POST to /api/Lumpsum/<Action> with  -H "Cookie: Cookies=..."
```

`jimeneznr` is Admin with `ApplyFilter = false`, so it exercises the happy path but **not**
`AssertLumpSumVisibleAsync` — that gate engages only when `ApplyFilter` is set and still needs
a restricted account to prove.

**Rung 2 — drive the real UI against that API.** Available since `d7b3509b`. This is what
proved J1, and it caught a defect the API drive could not: a stage row read by the wrong key,
which renders as an empty dropdown rather than as an error.

```bash
# the API, as above, then Vite pointed AT IT:
cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort
cd e2e && npx playwright test <spec>
```

**Overriding `VITE_API_BASE_URL` is not optional.** `FE/.env.development` points the `/api`
proxy at a REMOTE host, so a UI run that skips the override drives the local browser against
someone else's database — and passes, misleadingly. Pass it to Vite rather than editing the
tracked `.env.development`.

**`/auth/validate` 401s appear in the console on every page.** They fire before login and are
pre-existing app behaviour, so a spec asserting on console errors must exclude them or it
fails everywhere, for a reason that has nothing to do with what it tests.

Three environment notes that cost time: Windows `sqlcmd` parses a `/tmp/...` path as an option
switch, so run scripts from a Windows path or a bare filename; a `DELETE` on `tProjects`
needs `SET QUOTED_IDENTIFIER ON` because of the filtered index; and `npm run build` has never
passed on this branch — `tsc -b` fails on 21 pre-existing `pages/Rbac` errors that predate it.
Use `npx vite build` to check bundling, and judge typecheck by whether that 21 moves.

### Decisions taken during implementation

These changed the plan as written; each is recorded where it belongs, and collected here so
the shape of the work is not a surprise on review.

1. **The wallet-era `LumpsumController` and `DTOLumpsum` were deleted in phase 2, not phase 3.**
   They referenced the removed EF models and produced 42 build errors. The plan accepted a
   branch that is green only at the end, but leaving it unbuildable across several phases would
   have blocked the very verification this project requires. **The module has no endpoints
   between `14ae13d5` and the completion of phase 3.**
2. **V2 authors the controller fresh; it does not port-then-delete.** `dp-deployment` carried a
   310-line wallet-era read API, not the reference branch's 4,784-line one. So *Removing WF-6*
   and *Removing publish* are largely **"do not author"** rather than "delete" — no revision
   table, EF model or action was ever created here. Task S4a is scoped accordingly.
3. **`CascadeStageToWalletsAsync` and `AdvanceProgramStage` are gone entirely,** along with
   `ActiveRevisionIdAsync`. All three existed only because wallets owned storage of their own:
   a stage, and a revision id needing a separate lookup. A Lump Sum Project is an ordinary
   project, so its stage lives in `tProjectStages` and `vLumpSumSet` already carries
   `RevisionId`.
4. **`CK_tProjects_ProjectType` is added `WITH NOCHECK` where the data requires it.** All 56,289
   `tProjects` rows on the dev restore carry the literal string `'NULL'` in `ProjectType`.
   Failing the baseline on pre-existing import debt would be wrong; silently rewriting 56k rows
   of project data is a data decision, not a schema one. New and updated rows are validated and
   the script prints what it tolerated.
5. **Sample data is migrated rather than seeded** — `LumpSum.SampleData.Dev.sql`, 3 Lump Sum
   Projects and 18 children out of `MyMYPS`, which already stores Lump Sum the way V2 does.
6. **Nullability is a THREE-place change, and `[Required]` beats the CLR type.** Baseline §2b
   widened `Region` / `DEO` / `ImplementingOffice`, which silently changed the **views'**
   inferred nullability after the view models had been generated from `sys.columns`. Fixing the
   view models was not enough: the shared `ProjectRevisions` entity carried `[Required]`
   attributes that override a nullable CLR type, so EF went on treating the properties as
   non-nullable even as `string?`. Any future column widened to NULL has to be chased through
   **the view model, the entity model, and the entity's attributes**.
   `OperatingUnit` keeps its `[Required]` — the field spec still demands it.
7. **Never roll back unconditionally in a `catch`.** The read-back after `CommitAsync` sits
   inside the same `try`, so a failure there arrives with the transaction already committed;
   `RollbackAsync` then throws *"This SqlTransaction has completed"* and **replaces** the real
   exception. The nullability bug above first presented as a transaction error naming no column
   at all. `SafeRollbackAsync` rolls back only a live transaction and swallows rollback
   failures.
8. **Action names collide case-insensitively.** SQL Server's default collation makes
   `ShowLumpsum` and `ShowLumpSum` the same string, so registering the V2 names over the
   wallet-era rows silently skipped three of them as "already present" — and a skipped
   registration is a 403 for everyone. `LumpSum.Permissions.sql` retires the old rows first,
   comparing under `Latin1_General_BIN2`.

## Goal

The Lump Sum module works, but carries structural debt the V1 replay plan deliberately
preserves rather than fixes. V2 is a **debt-paydown rebuild** — same domain, rebuilt
correctly. It adds no new features; it re-specifies the field set, and it **narrows the
module's responsibilities** by removing two workflows that belong to other modules.

Three defects drive it:

1. **Dual storage.** An LS Project is stored twice. `CreateLumpsum`
   ([`LumpsumController.cs:2501`](../../WebAPI/Controllers/Lumpsum/LumpsumController.cs))
   writes the project model and **never** writes `tLSWallets`; `UpdateLumpsum` (`:2918`)
   requires that row and writes the wallet model via `SaveWalletChildrenAsync` (`:4561`).
   Create and update write different models.
2. **`vLSWalletLatest` is unreachable by construction** — `FROM dbo.tLSWallets` inner-joined
   to its revision, so a freshly created LS Project can never appear in it. It survives only
   because 2 of its call sites are live (`:2999`, `:3316`), both cosmetic re-reads.
3. **The module owns workflows that are not its own.** It carries a full revision/approval
   workflow (WF-6) and a **third** parallel publishing implementation with its own 13-rule
   compliance engine — while Programs already owns `pAllowProjectPublishing` /
   `IsPublishable` and `PCMAController` has its own `Publish`. Both come out.

Outcome: one storage model, one vocabulary, one baseline SQL script, a frontend containing
only reachable controls, a module scoped to allocation and itemization, and files that fit in
context.

## Corrections to the V1 replay plan

Verified against HEAD during planning. The V1 doc is materially stale, and V2's shape follows
from these corrections rather than from the doc.

> **The `FE/src/pages/LSWallet/...` links below no longer resolve.** They describe the tree as
> it stood before `15760e5a`, and are kept because the corrections are about what V1 claimed
> versus what was actually there at planning time. Read them as history, not as paths.

| V1 § | Claim | Actual |
|---|---|---|
| §0 | "`tLSWallets` and friends are dead, nothing reads them" | **False.** `UpdateLumpsum` + `SaveWalletChildrenAsync` write five wallet-era tables; `LumpsumDetails` reads three |
| §5.6 | 5 tabs (Overview/Funding/Projects/Approvals/Activity) | **Two** in the strip — Itemized Projects, Activity ([`LSWalletDetail.tsx:786`](../../FE/src/pages/LSWallet/Views/LSWalletDetail.tsx)) |
| §5.6 | "an Approvals tab that works" (`82ea1f25`) | Panel at `:1024` has **no tab entry** — reachable only via a hand-typed `?tab=approvals` |
| §5.6 | "View, Publish, Delete Project remain" | Publish is `show: false` ([`walletActions.ts:272`](../../FE/src/pages/LSWallet/utils/walletActions.ts)) |
| §5.6 | Both itemized entry points in the Projects tab | Itemize-a-Project is `show: false`; `ItemizeProjectDialog.tsx` (293 lines) is imported by nothing. Import **is** visible, via its own button at `:797`, outside the PCMA flag |
| §5.6 | `AdvanceProgramStageDialog` "unmounted, kept as reference" | Not on disk |
| §4.3 | "the confirm freezes `WalletDrawFrozen` from the view's own draw figure" | **False.** `PublishItemizedProject` only sets `IsPublished = true`. The column's sole writer is `ApplyApprovedRevisionAsync` (WF-6), so on a published child `EffectiveDraw` falls back to an unwritten `WalletDrawFrozen` |

## Decisions

Answered by the maintainer during a section-by-section review.

1. **Rename depth — all three layers.** DB, API contract and frontend.
2. **Vocabulary — `LumpSum`**, not `LSProject`. The code word matches the route, the sidebar
   label and the module name.
3. **Storage — collapse onto the project model.** Delete the wallet model outright.
   `tProjectFundingProfile` / `tProjectComponentCost` / `tProjectComponentCostPerYear` are
   exact 1:1 counterparts of the three wallet child tables, so there is somewhere to land.
4. **DB target — fresh database only.** One consolidated baseline; no migration path. The
   9-script run order and the 4-script deny-list are both retired.
5. **File splits — controller partial classes + FE splits.** Partials keep one route and one
   controller name, so `[PermissionFilter]` (`RouteData["controller"] + "Controller"`) is
   undisturbed beyond the rename itself.
6. **Feature surface.** Ship visible: create / view / edit / delete an LS Project,
   **Replenish**, **Import Itemized Projects**, view / delete children, Activity, list +
   filters. **Cut from the frontend:** Edit Draw,
   Mark-as-Scheduled + the Project Status / PCMA Status columns, the PCMA bulk workflow. For
   these, **the endpoint stays live and granted** — each cut is a UI removal only, recoverable
   as a UI rebuild. Publish is **not** in this group: it is deleted at both ends (decision 8).
7. **WF-6 is removed from the module entirely — not just its UI.** The revision workflow does
   not belong to Lump Sum. Its five actions, its table, its EF model, its DTOs, its helpers,
   its permissions script and its FE are all deleted, not retained behind a cut UI. See
   *Removing WF-6* below.
8. **Publishing belongs to the Programs module. Lump Sum only reads published status, and a
   Lump Sum Project is never published.** `PublishItemizedProject` and its private 13-rule
   compliance engine are deleted, not retained. See *Removing publish* below.
9. **e2e — prune, keep the harness, rewrite the survivors.** *(Both halves turned out wrong.
   `dp-deployment` has no LS specs and no harness, so nothing can be pruned — and the harness
   itself is written against V1's contract, so `lumpSumFixture.ts` is a rewrite rather than a
   copy. See task J5.)*
10. **Branch — single V2 branch off `dp-deployment`,** landing in phase order.
11. **A Lump Sum Project is itemized into NEW projects ONLY, never existing ones.** A hard
    business rule from the client, given 2026-09-03. `ItemizeProject` and
    `ShowItemizableProjects` are **removed from the module**, not merely cut from the UI — they
    exist to attach a pre-existing project, which the business does not permit. See
    *Removing Mode 2* below.
12. **`ScheduleItemizedProjects` and `UpdateDrawAmount` are discarded.** Both were
    endpoint-retained-but-unreachable under decision 6; keeping them would have preserved
    machinery pointing at workflows that have left the module. **There are now no
    retained-but-unreachable endpoints at all — every action that exists is one the UI reaches.**

    - **`ScheduleItemizedProjects`** (Proj-9) promoted children from `potential` to
      `scheduled`. The only consumer of `scheduled` was Publish Program, and **publishing left
      this module** (decision 8), so it set a flag nothing reads. `tProjects.ProjectStatus` is
      read only by Lump Sum, so nothing outside notices. **Consequence:** `ProjectStatus` never
      leaves `'potential'`. If the Programs publish path turns out to expect `scheduled`, the
      right owner of that transition is Programs, not this module.
    - **`UpdateDrawAmount`** replaced an itemized child's `IsWalletDraw` funding lines. Its
      published-project refusal directed users to WF-6, which is gone. **Consequence:** an
      imported child's draw is fixed at import — the workbook is the only chance to set it.

    `ItemizedFundingLineDTO`, `WriteDrawLinesAsync` and `ProjectStatusPotential` all stay: the
    import still writes draw lines and still marks children `potential`. Only
    `UpdateDrawAmountDTO` and the `ProjectStatusScheduled` constant became dead.

13. **The project and modification forms must not clobber a Lump Sum Project's identity.**
    Confirmed 2026-09-03. **STILL UNIMPLEMENTED as of `d7b3509b`** — re-verified against HEAD,
    both files still auto-populate unguarded, though each already computes `isLumpSum` a
    hundred lines above. It is now task **J6**; it had none, which is how it survived three
    frontend commits. Both `ProjectDetailsForm.tsx` files — `Project/components/` (`:150`) and
    `Modification/projectmodification/components/` (`:174`) — do this when Region changes:

    ```js
    onChange('IslandCode', selectedRegion?.IslandCode);
    onChange('ProjectType', selectedRegion?.IslandCode);
    ```

    For a Lump Sum Project that overwrites `IslandCode` 'LS' — the marker `isLumpSum` reads —
    with a geographic code, AND sets `ProjectType` to the same, which **violates
    `CK_tProjects_ProjectType`** and fails the save with a raw constraint error. Were it to
    save, `fProgramStages`' RISK-009 guard (`ProjectType <> 'LS'`) would stop excluding the
    project and it would be **double-counted in the program cost**.

    Both forms must skip that auto-populate when the record is a Lump Sum Project. The ID
    itself is already minted and immutable, so a stored `P00900002LS` stays correct — it is the
    RECORD's identity that breaks.

14. **Two wallet-era names are NOT renamed, because they are shared contracts.** Found while
    doing J1; each would break silently if renamed on one side only.

    - **`RouteName: 'AddWallet'`** is a `dbo.tAppViews.RouteName`. `usePermittedRoutes` matches
      it against the session's ViewAccess and `LumpSum.Permissions.sql` grants it by that exact
      string, so renaming it in the frontend alone hides `/lumpsum/add` from every user — the
      same failure as decision 8, arriving as a blank page instead of a 403.
    - **The Dashboard's `LsWalletReleased` / `LsWalletTotal` and `Type = "lswallet"`** are
      written by `DashboardController` (`:340`, `:360`) and read by `Dashboard/Service.ts`.
      They are a wire contract, not module-local naming.

    Both are renameable, but only as a paired frontend-and-backend change with a database
    update behind the first. Neither is in this plan's scope; both are listed under *Known
    gaps* so the inconsistency is recorded rather than rediscovered.

## Branch reality

`dp-deployment` is **478 commits ahead of `main`** and **diverged from the reference branch on
2026-08-20** (`e2116ba6`). It kept the **wallet-era** module (5 SQL scripts: `Schema`,
`Revisions.Schema`, `LSWallet.sql`, `Permissions`, `Seed.Dev`; 39 FE files; 2 controller
files) and took unrelated refactors on top — `ProgramLatest`, `toDateInputValue`,
`projectEnums` → `Code`, exception handling.

The **project model** (`ProjectModel.sql`, itemization, import, WF-6, the 28-spec e2e suite)
exists **only** on the reference branch.

So V2 authors the module fresh on the `dp-deployment` lineage, using the reference branch for
behaviour, and **deletes dp-deployment's wallet-era module** as part of the work. New code
follows dp-deployment's refactors, not the reference branch's pre-refactor idioms.

### Where the branch stands, 2026-09-04

Measured, not assumed — the session's own metadata guessed `main`, which is wrong by 525
commits and would have been an expensive merge to undo:

| | |
|---|---|
| Fork point | `70f8c969` on **`dp-deployment`** |
| This branch | **47 commits** ahead of that point, nothing merged yet |
| `main` | 525 commits behind the fork point — **not** the base, consistent with the 478 figure above |
| Upstream | **`origin/dp-deployment` has moved 11 commits ahead** of where we forked |

**The 11 upstream commits touch none of the files this branch touches** — checked by
intersecting both diffs against the merge base, and the intersection is empty. A merge is
conflict-free at file level. That is not the same as behaviourally safe, and one of the 11
is worth reading before or after integrating:

> `f9068f30 Update project navigation to use projectId instead of projectPK`
> — three files, including `Project/Views/Project.tsx`. It changes which key the Projects
> list navigates with, which is the same `ProjectId`/`ProjectPK` distinction that produced
> two findings here: the create path sending the wrong program key (`321a067b`), and the
> `project-details` route turning out to take a composite `ProjectId:StageName`. It does not
> conflict, and it does not unblock `ls-project-form-identity` — that spec is blocked by
> `/projects` returning no rows, which is a data condition, not a navigation one — but the
> route shape that spec builds should be re-checked once the two lines meet.

The other ten are an import-validation change landed and then reverted (#134, #138), a
CrystalReport service removal, and env-file adjustments.

## The import is no longer self-contained (history, 2026-09-05)

Two attempts, one day apart, to make `ImportItemizedProjects` share the Importing module's rules:

1. **The adapter** ([`lump-sum-import-validation-parity.md`](lump-sum-import-validation-parity.md))
   kept the browser-parsed JSON contract and mapped it back onto the validators' row shapes on
   the server. Implemented, then **reverted**: the JSON had already discarded Target Unit,
   per-row Infrastructure/Work Type, Reference ID and the cells' own text, so a third of the
   shared rules could only be fed fabricated values.
2. **The workbook** ([`lump-sum-v3.md`](lump-sum-v3.md)) — the design that stands. The endpoint
   takes the Download Template file itself (multipart), and the Program importer's sheet readers,
   header check and cross-sheet rules were moved into shared classes under `Hangfire/Importing`
   (`ImportWorkbookReader`, `ImportStructuralRules`, `ImportFileNaming`) that both callers use.
   The four validators are called verbatim; a rejection returns every failing row plus the same
   annotated `.xlsm` the Program import produces, served by `DownloadImportFile`.

**This reverses a decision recorded in `LumpSumImportValidation.cs`'s header**, which argued the
module's import path should stay self-contained rather than "growing ImportingHelper a second,
incompatible caller". That file is deleted, so the argument is recorded here rather than lost: it
was right that the two DTO shapes were incompatible, and wrong that copying the rules was the
cheaper answer — four of roughly a hundred had been ported, and the ninety-six that had not were
the reason an unresolved Tier became `1` and an unresolved Origin became `0` on a real project.
Sharing the *input* — the workbook — is what made the shapes compatible.

Consequences worth knowing:

- **Legislative District is load-bearing on an imported row.** `ValidateProjectDetails` derives
  Province from the LD and checks City, Region and DEO against it, so a row naming a Region but
  no LD — which imported before — is refused. Implementing Office and Operating Unit are
  *derived* from Region/DEO, and the workbook's own values for those two are ignored.
- **Location columns carry names, not codes** (decided 2026-09-05). The old resolvers accepted
  participant ids and PSGC codes; the validators match names only, and a code-filled workbook is
  refused rather than normalised.
- **Warn is fail on this path only.** The Program import keeps its three levels; the Lump Sum
  import refuses a warned row, except M2 (Reference ID convention) and P10 (duplicate
  Description, surfaced as `Notices[]`).
- **`_ImportStatus` is gone**, replaced by `_SysMeta`, checked by the server on the uploaded file
  and by the browser only to explain a wrong file before the preview.

## Naming map

| Layer | Old | New |
|---|---|---|
| View | `vLSProjectSet` | `vLumpSumSet` |
| View | `vLSWalletProjectSet` | `vLumpSumChildSet` |
| View | `vLSWalletBalance` | `vLumpSumBalance` |
| View | `vLSItemizableCandidates` | **dropped** — decision 11 |
| View | `vLSWalletLatest` | **dropped** |
| Tables | `tLSWallets`, `tLSWalletRevisions`, `tLSWalletFundingProfile`, `tLSWalletComponentCost`, `tLSWalletComponentCostPerYear` | **dropped** (decision 3) |
| Actions | `WalletBalance`, `ShowWalletActivity`, `ValidateForItemization`, … | `LumpSumBalance`, `ShowLumpSumActivity`, … |
| FE folder | `FE/src/pages/LSWallet/` | `FE/src/pages/LumpSum/` |
| FE types / atoms | `LSWallet`, `walletDataAtom` | `LumpSum`, `lumpSumDataAtom` |
| Route param | `/lumpsum/:walletId` | `/lumpsum/:lumpSumId` |

`LumpsumController` keeps its name — the route `/api/Lumpsum/...` is already correct.

**All four FE rows landed in `15760e5a` / `d7b3509b`,** with one exception recorded as
decision 14: `RouteName: 'AddWallet'` and the Dashboard's `LsWallet*` KPI fields keep their
wallet-era spelling, because each is a contract shared with the database or the API rather
than a module-local name.

**This map covers renames only.** Nothing belonging to WF-6 or publish appears here — those
are deleted, not renamed, and their full inventories are in *Removing WF-6* and *Removing
publish*. `tLSWalletProjectRevisions`, the five revision actions and `PublishItemizedProject`
have no V2 counterpart to map to.

> **Every renamed action is a new `tApiActions` row. Registration is not a grant** — a newly
> synced action 403s for everyone, admins included, until it appears in `tGroupRoles.ActionIds`.

## Removing WF-6

The revision workflow ("Request Revision → Region review → CO review") does not exist in V2.
Verified by sweep against the reference branch; nothing outside WF-6 itself depends on it.

**Delete outright:**

| Layer | Items |
|---|---|
| Actions | `ShowWalletRevisions`, `SubmitWalletRevision`, `ApproveWalletRevision`, `RejectWalletRevision`, `ReturnWalletRevisionForReview` |
| Helpers | `ReviewRevisionAsync`, `ApplyApprovedRevisionAsync`, `ActiveRevisionIdAsync` |
| DTOs | `ShowWalletRevisionsDTO`, `SubmitWalletRevisionDTO`, `ReviewWalletRevisionDTO` |
| DB | `tLSWalletProjectRevisions` and its 2 indexes; `LSWallet.ProjectRevisions.Schema.sql`; `LSWallet.Approvals.Permissions.sql` |
| EF | `LSWalletProjectRevisions.cs` |
| FE | `ItemizedProjectRevisionDialog`, `ApproveRevisionDialog`, `RejectRevisionDialog`, `ReturnRevisionForReviewDialog`, `store/revisionStore.ts`, `getRevisionActions()`, `REVIEWER_GROUPS`, `fetchWalletRevisions`, `submitRevision`, `approveRevision`/`rejectRevision`/`returnRevisionForReview`, the `ItemizedProjectRevision` type and its mappers |
| e2e | `ls-approvals-tab.narrated`, `ls-approvals-one-window.narrated` |

**Two entanglements found by the sweep — both must be cut, not left dangling:**

1. **`ShowLumpSumActivity` reads the revision table** (reference `:593`) to emit
   `RevisionRequested` / `RevisionRegionReviewed` / `RevisionCOReviewed` events. V2 ships the
   Activity tab, so that union comes out and Activity reports only create/update/publish stamps.
2. **`WalletDrawFrozen` and `EffectiveDraw` die with WF-6.** `ApplyApprovedRevisionAsync` at
   `:3912` is the **only** writer of `WalletDrawFrozen`, and `:3782` is the only consumer of
   `EffectiveDraw`. Both columns come out of `vLumpSumChildSet` along with the retired
   `ParentWalletId`. Safe here precisely because V2 authors the EF models fresh — the V1 warning
   about removing a column from a name-bound view applies to changing a view *under* an existing
   model, which is not this case.

**Import is unaffected.** `ImportItemizedProjects` has zero references to
`tLSWalletProjectRevisions` and never calls a revision action; every "Revision" in its body is
`tProjectRevisions`, the ordinary per-project revision row. `ImportItemizedProjectsDialog.tsx`
has none either.

**Functional consequences — a published child has no correction path inside Lump Sum:**

- `DeleteItemizedProject`'s **Blocked** tier says "published — use WF-6 instead". With WF-6
  gone, a published itemized project cannot be deleted here.
- `UpdateDrawAmount` refuses a published project and points at `submitRevision()`. With WF-6
  gone, its draw cannot be changed here by any route.

**These are reachable.** Publishing moves to the Programs module (decision 8), so a child
*can* become published while Lump Sum holds no way to unwind it — the refusal messages must
stop naming WF-6 and instead say the project is published and must be handled in Programs.
Correcting a published child is Programs' responsibility by the same decision that moved
publishing there; if that turns out to be insufficient in practice, the fix belongs in Programs,
not in a revived Lump Sum revision workflow.

### One remnant survived the sweep — cleared 2026-09-04

The sweep above deleted the actions, helpers, DTOs, table, EF model, FE dialogs and specs, and
`LumpSum.Permissions.sql` §0 retires the five action rows from any database that carried an
earlier registration. A later re-check found the sweep had removed `ShowWalletRevisions`'
**body** and left its scaffolding standing in `LumpsumController.Itemization.cs`:

```csharp
        #region WF-6 revisions

        /// <summary>Revision history for one itemized project, or for a whole wallet.</summary>
        [HttpPost]

        /// <summary>
        /// Deletes a Lump Sum Project. ...
        [HttpPost]
        public async Task<IActionResult> DeleteLumpSum(...)
```

So `DeleteLumpSum` had inherited a second `[HttpPost]`, a doc comment describing an action that
no longer exists, and a home inside a region named for a workflow that had left the module —
while the real `#region Deletes` closed just above it, separating the two delete actions from
each other.

It compiled and it worked, which is why nothing caught it: no distinct compiler warning, no
failing test, and `DeleteLumpSum` routes correctly either way. Only reading the file finds it.
Both `[HttpPost]`s but one are gone, the orphan comment with them, and `DeleteLumpSum` now sits
in `#region Deletes` beside `DeleteItemizedProject`.

**Nothing else is left.** Re-checked at the same time: no `LSWallet%` or `%WalletRevision%`
object in `myps_db_dev`, zero WF-6 rows in `tApiActions`, no revision dialog, store, service
function or type under `FE/src/pages/LumpSum/`, and no `ls-approvals-*` spec. Every other
`WF-6` string in the tree is a comment explaining the removal or the `§0` retire list that
enacts it — both worth keeping.

## Removing Mode 2 — itemization creates, it never attaches

**The client's hard rule: a Lump Sum Project can only be itemized into NEW projects, never
existing ones.** Children are created under the parent by the import; they cannot pre-exist.

Design Report §2.6.8 offers a "Selection of a specific Project" mode — Mode 2 — that attaches
an existing project by setting its `ParentProjectId`. The client's business processes do not
permit that, so it is removed rather than hidden.

**Deleted:**

| Layer | Item |
|---|---|
| Actions | `ItemizeProject`, `ShowItemizableProjects` |
| DB | `vLumpSumItemizableCandidates` — its only consumer was the picker; the baseline now DROPs it |
| EF | `LumpSumItemizableCandidate.cs` and its `DbSet` |
| DTO | `ItemizeProjectDTO` |
| Permissions | both actions retired in `LumpSum.Permissions.sql` §0 — 15 registered, not 17 |

**No rule is lost, and that was checked rather than assumed.** Every guardrail that survives
the business rule already lives in `ImportItemizedProjects`, verified against the reference:

| Rule | Where it lives now |
|---|---|
| Stage gate (`GAA-R`; `TF-R` removed 2026-09-04) | Import ✓, Itemize ✓, Replenish ✓ |
| EAO refusal | Import ✓ |
| Insufficient balance | Import ✓ — *"Import totals X but only Y remains on Z"* |
| UACS equality (§2.6.8) | Import ✓ — by **inheritance**, not by checking; the parent's UACS is copied onto every child. Superseded the batch-wide mismatch refusal (`lump-sum-ownership.md`) |
| Project has no cost | Import ✓ — "Nothing to Itemize" |

The guardrails unique to `ItemizeProject` were **all** artifacts of attaching a pre-existing
row, and every one becomes impossible by construction: *already itemized from X*, *cannot be
itemized from itself*, *belongs to a different program*, *no active revision*, *stage
mismatch*. A child that is created under its parent, in its parent's program, at its parent's
stage, with a revision the import writes, cannot be in any of those states.

**Consequence to accept:** a project planned outside the module can never be brought under a
Lump Sum Project. If that is ever needed, it is a new requirement and a new conversation — not
a flag to flip.

## Removing publish

Publishing is the **Programs module's** responsibility. Lump Sum reads `IsPublished` and
never writes it, and a Lump Sum Project is never published.

This removes a genuine duplication rather than merely trimming scope. Publishing already
lives in two places on the reference branch — Programs owns `pRecomputeProjectPublishable`,
`pAllowProjectPublishing`, `IsPublishable` and the `BatchRestrictPublish` /
`BatchUndoRestrictPublish` pair, and `PCMAController` has its own `Publish` action —
so `LumpsumController.PublishItemizedProject` is a **third**, parallel implementation carrying
its own private R01–R13 compliance engine.

**Delete outright:** the `PublishItemizedProject` action and its `CheckOnly` preview; all
thirteen rules; `PublishItemizedProjectDTO`; `PublishItemizedProjectDialog` and
`PublishSelectedItemizedProjectsDialog`; `checkPublishCompliance` and `publishItemizedProject`;
the publish permission entries; `ls-publish-compliance-parity.narrated`.

**Keep — `IsPublished` stays a read, in every place it is one:** the `ShowLumpSum` filter
(`:410`), the Activity tab's publish event (`:573` — publishing has no timestamp of its own,
so this infers it from `UpdatedDate`), `DeleteItemizedProject`'s Blocked tier (`:2109`),
`DeleteLumpSum` (`:3191`), and the `IsPublished` column on `vLumpSumSet` / `vLumpSumChildSet`.

**The single write to delete** is `Project.IsPublished = true` at `:1451`. The two existing
`IsPublished = false` writes — the LS Project at `:2742` and imported children at `:930` —
stay, and become the enforced invariant.

> The V1 doc's rule numbering is wrong as well: it describes R08 as "not already published",
> R12 as the GAA-R gate and R13 as the overdraw check, whereas the code has R08 as "every Cost
> Per Year record is complete", R12 as the publishing-context gate and R13 as "not already
> published". Moot once the engine is deleted, but it is a further sign the doc drifted.

## Field spec (settled 2026-09-01)

No fields are added or removed — the field **list** is unchanged. What changes is which
fields are **required**. Everything not listed as required is nullable.

> **Amended 2026-09-04 — nullable no longer means editable.** On the Lump Sum form every
> optional field now renders **disabled**, in add mode and edit mode alike (`4f761fc3`), with
> **Alternate ID** the single exception: it is free text used to trace a project to its
> source. (On an itemized child the import writes the parent's Project ID into it — rule
> 2026-09-05.)
>
> **Amended again 2026-09-06 — hidden, not locked.** The sixteen optional fields are no longer
> rendered on the Lump Sum form at all; only the required set, Alternate ID and a read-only UACS
> remain (maintainer decision, after the assessment in the V3 session). The 2026-09-04 lock is
> therefore superseded in the UI.
>
> The values are still submitted either way — first because only the inputs were disabled, now
> because the model, mappers, form state and `detailFields()` were deliberately left untouched —
> since `ApplyDetailFields` assigns these columns with no null-guard and a payload that dropped
> them would erase them. That safety condition is what `ls-module-ui-walkthrough`'s
> "a hidden field keeps its value through a save" test guards.
>
> This makes the table below a statement about what the **server** requires, not about what
> the form lets you type. Two gaps found while implementing it are recorded under *Known
> gaps*: three fields the server never writes at all, and a location chain that contradicts
> "independently optional" below.

| Section | Required | Nullable |
|---|---|---|
| Program Details | `ProgramId`, `CategoryId`, `SubCategoryId`, `OperatingUnit`, `CurrentStage` | — |
| General Information | `Description`, `Tier` | `MyId`, `AlternateId`, `ExternalId`, `Uacs`, `Rank`, `MycaApprovalDate` |
| Location Details | `RegionWide` | `Region`, `Province`, `City`, `LegislativeDistrict`, `Deo` |
| Organizational | `Agency` | `ImplementingOffice` |
| Project Source | `Origin` | — |
| Readiness & Modality | none | `ImplementationMode`, `EmergencyMode`, `Feasibility`, `FeasibilityDate`, `DetailedDesign`, `DetailedDesignDate`, `RowAvailable` |
| Money | `FundingProfiles[]`, `ComponentCosts[]`, `ComponentCostPerYear[]` | — |

**Delta against the behaviour at spec time** (that was `walletFormRules.ts`' edit-mode set —
the file is now `lumpSumFormRules.ts` and J4 is what brings it to the spec below), which
is far stricter than V1 §5.3's claim of "ProgramId, CategoryId and an optional Tier and
nothing else" — another stale-doc item):

- **Newly required:** `SubCategoryId`, `CurrentStage`, `Tier` (was optional 1–5),
  `RegionWide`, `Agency`, `ComponentCostPerYear[]`.

  > **Amended 2026-09-06 — `Tier` left the required set again.** The Lump Sum form no longer
  > collects it: a Lump Sum Project covers a programme, every migrated parent is Tier 1, and
  > `tOptionProjectTier` holds only 1 and 2, so the starred select was a choice with nothing to
  > base it on. `CreateLumpSum` defaults an ABSENT `Tier` to 1; `UpdateLumpSum` keeps the stored
  > value; an explicit out-of-range value is still refused ("Select a Tier between 1 and 5.").
  > The column stays `NOT NULL`. This is a deliberate default for a form field and does not
  > touch V3's rule that no `?? 0` / `?? 1` fallback may reach `tProjectRevisions` from the
  > **import**: itemized children still take Tier from the workbook and an unknown one is
  > refused, not defaulted.
- **Newly nullable:** `Region`, `Province`, `City`, `LegislativeDistrict`, `Deo`,
  `ImplementingOffice`.
- **Unchanged required:** `ProgramId`, `CategoryId`, `OperatingUnit`, `Description`, `Origin`,
  `FundingProfiles[]`, `ComponentCosts[]`.

`ImplementingOffice` becoming nullable is consistent with the model — an LS Project carries
`ImplementingOffice = ''` by design, which is exactly why `fProgramProjects` needs LEFT joins.

> **This needs a schema change, not just validation changes.** `Region`, `DEO` and
> `ImplementingOffice` are `NOT NULL` on `dbo.tProjectRevisions`, so a Lump Sum Project with no
> Region cannot be saved at all — the spec is unimplementable without widening them. Baseline
> §2b does that. It is not a Lump Sum quirk imposed on shared tables: the MyMYPS schema already
> made the same three columns nullable. Widening `NOT NULL` to `NULL` touches no existing row.
> `Tier`, `Agency`, `Origin` and `RegionWide` stay `NOT NULL`, which already agrees with the
> spec marking all four required.

**Each change must land in four places or it will not hold:** the DB baseline + view, the DTO
attributes, `lumpSumFormRules.ts` + the controller's up-front refusals, and the import
template's column list and `_Lookups` validations.

### Resolutions to the three derivation collisions

Three required-set changes collided with derivations the module relies on. All resolved.

1. **`Region` nullable — `IslandCode` reverts to the constant `'LS'`.** A Lump Sum Project sets
   `IslandCode = 'LS'` on the record **and** passes it to `GenerateProjectID`
   ([`LumpsumController.cs:2726`](../../WebAPI/Controllers/Lumpsum/LumpsumController.cs)), so
   the generated ID carries an `LS` segment. This is the straight pre-geographic revert: no
   Region input is needed, and `ProjectDetailsForm.tsx:29`'s `IslandCode === 'LS'` — the gate
   for every LS location/organizational exemption on the project form — **keeps working
   untouched**. No switch to a `ProjectType` check and no FE churn.

   **THE CONSTANT IS THE PARENT'S ONLY** (corrected 2026-09-03, client business rule). An
   itemized CHILD is an ordinary project with a geographic ID: its trailing segment is
   `tOptionAdminAreaRegion.IslandCode` for the Region it sits in — `LZ`, `VS` or `MN`. Only the
   Lump Sum Project itself ends in `LS`, and it does so regardless of its own Region — sample
   parent `P00900040LS` sits in `OI249` (Mindanao) and still ends `LS`.

   So the Region→island-code resolution is removed on the create path (`:2725`/`:2730`/`:2768`)
   only. **The import path keeps it** (`:4033–4057`), and so does
   `ResolvedImportLocations.IslandCode`.

   The migrated MyMYPS sample is the proof the rule was already in force: all 18 children carry
   Region `OI237` (Region III) and IDs ending `LZ`.

   **Region is therefore REQUIRED on an imported row**, and refused by name when absent — a
   child has nowhere else to derive an island code from. That does not contradict the field
   spec, which governs the PARENT's form; the import template is a separate column list, and it
   already marks the column `*Region`.

   > **Deliberate reversal, recorded so it is not lost.** The comment at `:2721` states *"its
   > generated ID follows the same geographic island-code rule as an ordinary project; the
   > stakeholder explicitly rejected an artificial 'LS' suffix."* V2 reverses that on the
   > maintainer's instruction — an `LS` suffix is what the new field spec requires, since Region
   > is nullable and cannot supply a geographic code. **Rewrite that comment**; leaving it would
   > describe the opposite of the code and mislead the next reader.

   Knock-ons: `ls-add-project-save.narrated`'s ID-suffix assertion becomes an `LS`-suffix
   assertion **for the parent only**; a consumer reading a child's suffix still receives
   `LZ`/`VS`/`MN` and must not be changed.

11. **Only the parent ends in `LS`; a child's island code comes from its Region.** The import
   hardcoded the parent's `'LS'` onto every child it created — both in the generated
   `ProjectPK` and in the revision's `IslandCode` column — behind a comment arguing Region was
   optional because "ParentProjectId and ProjectType identify an itemized project; the ID
   suffix never did". True of membership, but it is not what the ID is for: a child is an
   ordinary project and its ID is geographic.

   `cache.Regions` is already `List<OptionAdminAreaRegion>`, so `ResolveImportedLocations` now
   carries `IslandCode` out alongside the Region it resolved — no extra query. A row with no
   Region is refused naming the field.

   The migrated sample is the check: 18 children at Region `OI237` with IDs ending `LZ`, and
   parent `P00900040LS` in `OI249` (Mindanao) still ending `LS`.

10. **Sample data spends ProjectId sequence numbers the allocator does not know about.**
   `ProjectPK` is not an identity column — `GenerateProjectID` composes it as
   `{Suffix}{YearStart-2016:D3}{Sequence:D5}{IslandCode}` and draws `Sequence` from
   `dbo.tProjectIdSequence`, bucketed on `(CategoryId, Suffix, IslandCode, YearStart)`.
   `LumpSum.SampleData.Dev.sql` copies ids verbatim from MyMYPS, so it consumes numbers
   without moving the counter.

   The result is not a near miss. The three parents occupy 16, 23 and 40 in the
   `(16, 'P', 'LS', 2025)` bucket while `CurrentSequence` sat at 15, so the next
   `CreateLumpSum` composed `P00900016LS`, tripped the generator's duplicate guard, and
   **every create in the database failed from then on** — the failing transaction rolls the
   counter back with it, so the bucket never gets past the collision on its own. Worse, the
   18 children occupy sequences up to 52 in a `(16, 'P', 'LZ', 2025)` bucket that had **no
   row at all**, which would have collided on its very first id.

   The script now reconciles both cases after loading and prints a per-bucket verdict, next
   to the identity-seed check it belongs beside. Parsing ids is confined to `#Sample`;
   `tProjects` at large holds legacy keys like
   `MPP_P_CO-PS-634_07172024_134347_BP00936795LZ` that fit no format.

   This is what the ADR-043 duplicate guard is for, and it earned its keep: the failure it
   raised names the allocator, not the sample data, and would otherwise have read as a
   product bug in `CreateLumpSum`.

9. **Replenish and Import are gated on stage MEMBERSHIP, not a threshold.** Both require
   `GAA-R` — the "with Revisions" stage — as a client business rule, confirmed 2026-09-03 and
   **narrowed 2026-09-04**. A top-up or an itemization has to be carried by a revision, so a
   stage where no revision exists cannot host one.

   > **AMENDED 2026-09-04 — GAA-R ONLY; TF-R IS OUT.** This decision originally admitted
   > `TF-R` as well, on the strength of Design Report Proj-1, which lists the Add-a-Project
   > options permitted "For GAA-R and TF-R stages". The client has since narrowed it to the
   > Operations Guide's own wording — E.7.13's *"the instance of the project in the
   > corresponding 'GAA with Revisions' stage"* — and **Trust Fund work is out of scope for
   > itemization**. `RevisionStages` is `{ "GAA-R" }` and `REVISION_STAGES` is `['GAA-R']`.
   >
   > Both are kept as a SET rather than collapsed to a single string comparison: every refusal
   > message joins them, so the rule can widen again without touching the call sites, and
   > nothing hard-codes the stage name twice.
   >
   > `TF-R` remains a real stage a project can sit at — it is simply not itemizable. The badge
   > colour for it in `lumpSumStatusBadge.tsx` stays for that reason.
   >
   > **This dated the sample data too.** The paragraph below says Trust Fund "is what all the
   > migrated sample data is". That was true of the old remote database; the current
   > `myps_db_dev` has **no TF or TF-R programs at all**, and every Lump Sum parent sits at
   > `GAA-R`. `ls-module-ui-walkthrough`'s `create` step typed "Trust Funds" into the program
   > picker and failed for that reason — a stale fixture, not a defect. **Fixed 2026-09-04:**
   > it now resolves a program through `programOnStage()` instead of naming one, so it cannot
   > go stale again the next time the itemizable stage or the sample data moves.

   V2 first shipped Replenish as *"GAA onwards"*, ranked on `StageHierarchy`. That was wrong in
   both directions: it admitted `GAA` itself, and it admitted every stage above `GAA-R`. The
   frontend was wrong differently — it ranked stages against a hand-written five-entry
   `STAGE_ORDER` that omitted `TF` and `TF-R` entirely, so `indexOf` returned `-1` and Replenish
   rendered **disabled on every Trust Fund project**, which is what all the migrated sample data
   is. Two layers, two different orderings, both wrong.

   The fix is that neither layer orders stages at all. `LumpsumController.RevisionStages` and
   `REVISION_STAGES` in the FE's `constants.ts` hold the same set (`GAA-R`, since the amendment
   above), tested by membership. `IsStageAtOrAfterAsync` had exactly one caller and is deleted;
   `STAGE_ORDER` and `REPLENISH_ALLOWED_FROM_STAGE` are deleted with it. The refusal is pinned
   by *"replenish and import are refused off the revision stages"* in `ls-contract.spec.ts`,
   which provisions against a **`GAA`** program — the case the old gate let through.

2. **`CurrentStage` auto-populated, never user-editable.** Stage moves to `tProjectStages` and
   is always resolved from the Program, so it can never be null — "required" is satisfied as a
   storage invariant, not as a form field. Rendered read-only on the form. The program cascade
   stays the single source of truth, so a project can never be out of step with its program,
   and the stage-gated rules (itemization, import and Replenish, all at `GAA-R` since 2026-09-04) keep keying
   off a trustworthy value rather than a hand-entered one.

   > **A project does not start at BP.** It starts at whatever stage its program is currently
   > at, and that can be any stage — Lump Sum Projects included. "Resolved from the Program"
   > means the program's *current* stage, never the first one. Nothing may hard-code `BP` as a
   > starting point. The data agrees emphatically: of the 87 Lump Sum Projects in the MyMYPS
   > database, **none** is at BP — 44 were at `TF-R` and 43 at `GAA-R`, then the two itemizable
   > stages. A Lump Sum Project is created where the work happens.

3. **`ComponentCostPerYear[]` derived at create.** The Add flow stays two sections. On create
   the server writes **one** per-year row for the Program's `StartYear` carrying the full
   allocation, alongside the existing 100% funding line and the equal `LS` component. The row
   is fully editable afterwards in edit mode. Multi-year splits are an edit-mode action.

   > **Superseded 2026-09-04 (`lump-sum-ownership.md`).** The row is **not** editable and
   > there are no multi-year splits. Year, Amount, Start Date and End Date are all derived
   > and read-only, and "Add Year" is gone: with Year pinned to the program's start year and
   > Amount to the allocation, a second row could only duplicate the first and double-count
   > against the cap. Create also now writes the dates (1 Jan – 31 Dec of that year), which
   > it previously left null.

Also open: whether `documents/lumpsum-demo/` (workbook generator, 7 named-refusal fixtures,
`npm run record:demo`) carries over.

## Acceptance criteria

- [x] `LumpSum.Baseline.sql` applies to a fresh database in one run; all three views return
      rows or an honest empty set; `fProgramProjects`, `fProgramStages` and
      `pRecomputeProgramCost` all bind. **(`8a937c25` — run 3x for idempotency, exit 0.)**
- [x] No database object references `tLSWallets`, `tLSWalletRevisions`,
      `tLSWalletFundingProfile`, `tLSWalletComponentCost`, `tLSWalletComponentCostPerYear`
      or `vLSWalletLatest`; none of them exist. **(Asserted by baseline §13.)**
- [x] `MYPSDbContext` registers **no** Lump Sum table and three views; the keyless two use
      `HasNoKey().ToView(...)`. `DBHelper`, `WebAPI` and `Main` build clean. **(`14ae13d5`.)**
      `FE` typechecks and bundles (`d7b3509b`) — at 21 errors, **all** in `pages/Rbac` and
      **all pre-existing on `dp-deployment`**, which this branch has never touched. That 21 is
      the baseline to compare against; `npm run build` has therefore never passed here.
- [x] **Create and update write the same storage.** **PROVEN against the live API** (`904b9dfe`,
      `889afb4d`): create wrote funding 128007 / cost 187873 / per-year 187845; update raised the
      allocation 250M -> 300M in those same three rows; no `tLSWallet*` table exists.
- [x] All **13** V2 actions registered **and granted**, with no ungranted action and no
      dangling grant (`889afb4d`). The non-admin half is now covered too (`63d240b4`): a
      restricted group granted the same 13 actions reaches every one of them, which is what
      distinguishes a working row-level gate from a 403 at the permission filter.
- [x] **No WF-6 remnant survives** — no revision action, table, EF model, DTO, dialog, service
      function or e2e spec; the Activity tab emits no revision events; `WalletDrawFrozen` and
      `EffectiveDraw` are absent from `vLumpSumChildSet` and its model. **Swept 2026-09-03:**
      every remaining `Revision` hit in the module is either `tProjectRevisions` or the
      revision-STAGE gate (`GAA-R`), which is a different thing wearing the same word.
- [x] `AssertLumpSumVisibleAsync` is called by every action, after the lookup and after any
      role gate. **Call sites corrected in `9f52c308`, and PROVEN AT RUNTIME in `63d240b4`** —
      `ls-data-security.spec.ts` drives all thirteen through a genuinely restricted account
      (the first this database has ever had). Twelve behave: eight project-scoped actions
      refuse with the guard's message, the import refuses past its own empty-payload check,
      `ValidateForItemization` refuses 200-shaped, `CreateLumpSum` refuses the **program** in
      its own words, and `ShowLumpSum` filters rather than errors. The entitled user is
      separately proven **not** blocked. Two divergences found and recorded as Known gaps —
      `InitFilterLumpSum` discloses program names, and a Central Office user can open a
      project but not list it.
- [ ] Itemization still refuses all five guardrail cases with messages naming the figures;
      success sets `ParentProjectId`, sets `AlternateId` to the **parent's Project ID** (rule
      2026-09-05; the workbook's placeholder is not kept), deducts the LS component, sets
      `ItemizationType` / `ProjectStatus` and writes both Notes.
- [x] Delete restores the child's cost to the parent in both hard and soft tiers, and is
      blocked on a published child. Restore and both tiers are covered by `ls-contract.spec.ts`
      and were re-confirmed by hand on 2026-09-03. The published-child refusal now names
      **Programs** (`9f52c308`) — it had carried the WF-6 wording S4a said not to copy.
      **And it no longer deletes projects that are not itemized children at all**, which it
      did for any `ProjectPK` lacking a Lump Sum parent, a Lump Sum PARENT included.
- [x] **The required set matches the field spec exactly**, enforced consistently in all four
      places: a save missing any of `ProgramId`, `CategoryId`, `SubCategoryId`,
      `OperatingUnit`, `CurrentStage`, `Description`, `Tier`, `RegionWide`, `Agency`, `Origin`,
      `FundingProfiles[]`, `ComponentCosts[]` or `ComponentCostPerYear[]` is refused with a
      message naming the field; a save omitting `Region`, `Province`, `City`,
      `LegislativeDistrict`, `Deo` or `ImplementingOffice` **succeeds**.
      **(`8cfd06e2`. The client rules now carry the server's eight messages verbatim and in
      its order, so the form and the API cannot disagree about which field to name first.
      `CurrentStage` is excluded on purpose — it is resolved from the program and never
      submitted. Two of the four places needed no change: `Origin`/`Agency` already carried
      unconditional asterisks in the project form, and the import template already marks
      `*Region` and `*Category`, the only two a CHILD needs.)**
- [x] A Lump Sum Project saves with **no Region**; `IslandCode` is `'LS'` and the generated ID
      carries an `LS` segment — **regardless of its Region when it has one** (sample parent
      `P00900040LS` sits in `OI249`, Mindanao). **(`ls-contract.spec.ts` test 1.)**
- [x] An **itemized child** takes its island code from its Region, not from its parent: an
      imported row in Region `OI237` gets an ID ending `LZ`, and a row with no Region is refused
      naming the field. **(`ls-contract.spec.ts` test 7.)**
- [ ] The LS exemptions on the project form still apply — `ProjectDetailsForm.tsx:29`'s
      `IslandCode === 'LS'` resolves true for a Lump Sum Project created with no Region.
- [x] `CurrentStage` is rendered read-only, always resolves from the Program, and is never null.
      **(`d7b3509b` — `LumpSumProgramDetailsSection` renders it read-only from the server's
      `StageName` and never submits it; the server ignores it if sent.)**
- [x] Creating an LS Project writes exactly one `ComponentCostPerYear` row at the Program's
      `StartYear` carrying the full allocation, and that row is editable afterwards.
      **(Confirmed by hand 2026-09-03: a project created at 5,000,000 came back with one LS
      component and one 2025 per-year row at 5,000,000; a subsequent edit added a second
      component and its per-year row without disturbing either.)**
      **Amended 2026-09-04: the row is no longer editable — see the superseding note above.**
- [x] The frontend contains **no feature flags** and no unreachable dialogs. **(`55678179`
      deleted the seven cut dialogs; `d7b3509b` deleted the service functions and types behind
      them. All 13 actions are reachable from a control — `ValidateForItemization` gates the
      import dialog and `ShowLumpSumActivity` backs the Activity panel.)**
- [x] **Lump Sum never writes `IsPublished = true`.** Swept 2026-09-03: the module contains
      exactly **two** `IsPublished` writes, both `= false` (`Writes.cs:174` on create,
      `Import.cs:271` on each imported child), one read used as a filter
      (`Itemization.cs:69`), and on the frontend only reads — the badge and the delete
      dialog's warning. A published child's status is read and displayed, never set here, and
      no compliance-rule engine remains in the module.
- [x] The cut controls are absent from the DOM: no Publish, no Itemize-a-Project, no Edit
      Draw, no Request Revision, no Approvals tab, no PCMA controls. **(Asserted against the
      rendered detail page on 2026-09-03; to be re-asserted from a committed spec in J5.)**
- [~] Replenish is visible and works end to end — confined to `GAA-R` (decision 9, amended) and strictly
      increasing, enforced server-side. Visible with the stage gate (`d7b3509b`), and the
      dialog's client-side check compares against `OriginalAllocation`, the same figure
      `ReplenishLumpSum` compares against. **Driven through the API, not yet through the UI**
      — that is J5, and Replenish has still never been exercised by a click.
- [ ] Import Itemized Projects still succeeds: the template downloads with working dropdowns,
      opens in Excel without a repair prompt, and re-imports through the dialog it came from.
- [x] `/lumpsum/add` is registered **before** `/lumpsum/:lumpSumId`; the sidebar item is
      `ViewAccess`-guarded; `lumpSumDataAtom` starts empty; an unknown id renders **Not Found**.
      **(`15760e5a` / `d7b3509b`.)** Note the sidebar's guard resolves through
      `RouteName: 'AddWallet'`, which decision 14 deliberately leaves unrenamed.
- [ ] The active tab round-trips through the URL. **Now moot as written** — the detail page has
      collapsible sections, not a tab strip, so there is no active tab to round-trip. Either
      restate this as "the Itemized Projects and Activity sections are addressable" or drop it;
      it should not be carried forward as an unticked box that no longer describes the UI.
- [x] A refusal raises **exactly one** toast, carrying the server's own words. **(`8cfd06e2` reports the first failure in rule order rather than one toast per rule; asserted in `ls-module-ui-walkthrough` — an empty form produces exactly one message, and it names the first missing field.)**
- [ ] An LS Project opens and saves in `/projects/project-details/...` and appears in its own
      program's list.
- [ ] `cd e2e && HEADED=1 SLOWMO=250 npx playwright test ls-module-ui-walkthrough` passes and
      `npm run ls` is green end to end.

## Tasks

> **Line references below point at the REFERENCE branch**
> (`fix/lumpsum-plain-colors-screenshots-lswallets-models`), not at this one. `dp-deployment`
> carried only a 310-line wallet-era read API, and that was deleted in phase 2 — so these are
> *"author this behaviour, here is where to read it"*, never *"edit this line"*. Read the
> reference with `git show <ref>:WebAPI/Controllers/Lumpsum/LumpsumController.cs`.

### Senior

- ~~**S1 — DB baseline.**~~ **DONE** (`8a937c25`, §2b added in `c41e5645`). Author `LumpSum.Baseline.sql`, one idempotent script folding in what
  is still live from `ProjectModel` / `Itemization.ToSpec` / `ProjectSet.ProgramName` /
  `ProjectSet.StartYear` / `DerivedAmount.Fixups` / `Program.ProjectsIncludeLumpSum`. Creates
  `tProjects.ParentProjectId` (+ filtered index), `ItemizationType`, `ProjectStatus`; the four
  views — **no revisions table**. Rewrites `fProgramStages` and
  `pRecomputeProgramCost` onto `vLumpSumBalance.Total`, and `fProgramProjects`' two office
  joins to **LEFT** so an LS Project (`ImplementingOffice = ''` by design) appears in its own
  program's list. `LSWallet.DerivedAmount.Fixups.sql` references `tLSWallets` directly in
  three places — those become `vLumpSumSet`. Set `QUOTED_IDENTIFIER ON` in its own batch.
- ~~**S2 — EF layer.**~~ **DONE** (`14ae13d5`). Four view models — `LumpSum`, `LumpSumChild`,
  `LumpSumBalance`, `LumpSumItemizableCandidate` — written from `sys.columns` on the live
  database rather than from the old models, so names and nullability match exactly. No table
  models. Verified by materialising all four through EF, not by compiling.
- ~~**S3a — Derivation rules (from the field spec).**~~ **DONE** (create path in `904b9dfe`;
  the import's Region→island-code resolution restored in `201d4650` after an earlier pass
  had wrongly applied the constant to children too). Both halves are locked by
  `ls-contract.spec.ts` tests 1 and 7.

  On **create**, do not carry across the reference's Region→island-code
  resolution (`:2725`/`:2730`/`:2768`); pass the constant `'LS'`, so `IslandCode` is `'LS'` on
  the record and the parent's ID ends in `LS`.

  On **import**, keep it (`:4033–4057`) and keep `ResolvedImportLocations.IslandCode` — a child
  takes its island code from its Region, and a row without one is refused by name.

  `GenerateProjectID` needs no change either way — it already appends `IslandCode` as the
  trailing segment (`{Prefix}{YearOffset:3}{Sequence:5}{IslandCode}`,
  `Helpers/ProjectHelper.cs`).

  The reference's comment at `:2721` ("the stakeholder explicitly rejected an artificial 'LS'
  suffix") is right about CHILDREN and wrong about the parent. V2 reverses it for the parent
  only — do not copy it onto the create path, and do not delete the behaviour it describes from
  the import path.

  Lump-sum detection is left alone: `ProjectDetailsForm.tsx:29`'s `IslandCode === 'LS'` keeps
  working by construction.

  `CurrentStage` is resolved from `tProjectStages` on every read and never accepted from the
  client — and it follows the program's **current** stage, which can be any stage. Nothing may
  hard-code `BP`.

  `CreateLumpSum` writes one `ComponentCostPerYear` row at the Program's `StartYear` for the
  full allocation.

  When the migrated sample is regenerated or new IDs are minted, check nothing downstream
  expects a geographic `LZ`/`VS`/`MN` segment — each now receives `LS`.
- ~~**S3 — Storage collapse.**~~ **DONE and PROVEN** (`c92b91ab` read side, `904b9dfe` write
  side). `SaveLumpSumChildrenAsync` writes `tProjectFundingProfile` / `tProjectComponentCost` /
  `tProjectComponentCostPerYear` keyed to the Lump Sum Project's own revision, with the
  three-way merge intact (`Id == 0` insert, `Id > 0` update, `Id > 0 && IsDeleted`
  soft-delete, omitted rows untouched — an omission is "not mine to touch", never a delete).

  Demonstrated against the live API, not asserted: create wrote funding `128007`, component
  cost `187873` and cost-per-year `187845`; update raised the allocation 250M → 300M **in those
  same three rows**, and no `tLSWallet*` table exists. The V1 defect — create writing the
  project model while update wrote the wallet model — is closed.
- ~~**S4 — Controller partials.**~~ **DONE** — five files, 3,964 lines, 13 actions.
  `LumpsumController.cs` (core — constants and the shared guards `AssertLumpSumVisibleAsync`,
  `GetLSComponentAsync`, `ResolveComponentTypeAsync`, `StageRank`) and `.Reads.cs`
  (`c92b91ab`) · `.Writes.cs` (`904b9dfe`) · `.Itemization.cs` and `.Import.cs` (`0fd5ca39`,
  `608e064d`).

  The authored set is smaller than this task originally listed: `ItemizeProject`,
  `ShowItemizableProjects` (decision 11), `ScheduleItemizedProjects` and `UpdateDrawAmount`
  (decision 12) were never written. Preserved as required: the 3-tier delete matrix restoring
  cost to the parent on both non-blocked tiers; `AssertLumpSumVisibleAsync` on **every**
  action; `ResolveComponentTypeAsync` accepting code or name; the single
  `ImportLookupCache.LoadAsync` ahead of synchronous resolution (the per-row version fired
  500+ queries for a 50-row workbook). The five `ItemizeProject` guardrails moved to
  `ValidateForItemization` and the import, itemization having become import-only.
- ~~**S4a — Leave WF-6 and publish out (backend).**~~ **DONE**, mostly by not authoring them:
  no revision table, EF model, DTO or action exists on this branch, and `vLumpSumChildSet` was
  built without `WalletDrawFrozen` / `EffectiveDraw` / `ParentWalletId` (`8a937c25`,
  `14ae13d5`). The DTOs omit the three revision types and `PublishItemizedProjectDTO`
  (`3992b116`).

  Each of the three things that had to be got right, was: `ShowLumpSumActivity` emits no
  revision events (it unions nothing — the reference's `tLSWalletProjectRevisions` does not
  exist here); `DeleteItemizedProject` refuses a published child by naming **Programs**;
  every `IsPublished` **read** is kept and the `= true` write was never authored, so no
  compliance-rule engine remains. `UpdateDrawAmount` needed no wording decision — decision 12
  discarded it.
- ~~**S5 — Permissions.**~~ **DONE** (`889afb4d`). **One** script, not two:
  `LumpSum.Permissions.sql`. `LSWallet.Approvals.Permissions.sql` is not carried over — it
  exists solely to grant RPC/AUC the WF-6 reviewer actions, which no longer exist — and with
  publish gone too, one script covers everything.

  It registers and grants all **13** V2 actions (the script was written when the count was
  still 17 — see the Progress note on how 24 became 13), verifying that none is ungranted and
  no grant dangles. It also grants the three **routes**, which is a separate list from the API
  actions: without them the React router never registers the path and `/lumpsum/add` fails
  with "No routes matched location" while every API grant is in place. Three things it must
  keep doing:
  - **Do both halves.** Registration is not a grant; a registered-but-ungranted action 403s for
    everyone, admins included.
  - **Retire the wallet-era rows first, under `Latin1_General_BIN2`.** The default collation is
    case-insensitive, so `ShowLumpsum` and `ShowLumpSum` collide and three new names would be
    skipped as duplicates.
  - **Not rely on `SyncAPIPermissions`** — but ~~because it fails~~ **because of what it does
    when it succeeds.** Corrected 2026-09-03: the old claim that it writes to
    `tPermissionControllers` / `tPermissionActions` and fails with *Invalid object name* is
    **wrong**. Those tables do not exist, but the endpoint never references them — it works
    against `tApiActions`, which does. It was run and it succeeded.

    The real reason to keep §1 is that `ReconcileApiPermissionsAsync` also **deletes** actions
    absent from the assembly and strips their Ids from **every group's** `ActionIds`. Correct
    housekeeping, but it rewrites all groups' grants as a side effect, which belongs in a
    deliberate maintenance step rather than a module's setup. See *Known gaps* for what it
    did when finally run.

  Re-run it after adding any endpoint. **All 13 registered actions now have methods** — the
  note that 12 were registered ahead of their implementations no longer applies.
- ~~**S6 — FE architecture, deliberately scaled back.**~~ **DONE** — settled as a decision
  rather than as work, and `d7b3509b` held to it: `Service.ts` is one file of ~330 lines and
  the only file in the module that touches `httpClient`; the detail view is not split per tab;
  `Model.d.ts` keeps domain types separate from `Dto*` wire types, which earned its keep
  immediately when the wire contract changed under it.

  One file was added that this task did not anticipate: `utils/transformImportedChildren.ts`.
  `ImportItemizedProjectsDTO` is nested per child where `Project/utils/transformImportedProjects`
  produces batch-level flat arrays, and its location fields are numbers where Project's are
  strings — so regrouping that transformer's output row by row was more code than building
  the right shape once. Its grouping rules are deliberately identical, so the same workbook
  imported through either module produces the same component costs and major items.

  The original sizing rationale, kept because it explains the scale-back: the sizes this plan
  prescribed splits for are the REFERENCE branch's. On dp-deployment the files are much smaller —
  `LSWalletDetail.tsx` is 744 lines, not 1,387; `Service.ts` is 708, not 1,120 — and deleting
  the seven cut dialogs and the mock layer removes more still.

  **`Service.ts` stays ONE file** (confirmed 2026-09-03). It remains **the only file that
  touches `httpClient`** — that rule is the point, not the file count. Splitting a ~700-line
  module into per-domain barrels at this size would be structure for its own sake.

  Likewise no tab-per-component split of the detail view. `Model.d.ts` still separates domain
  types from the `Dto*` wire types, because that distinction earns its keep when the wire
  contract changes — as it just did.

- ~~**S7 — Two defects the J1 sweep found in the "complete" backend.**~~ **DONE** (`9f52c308`).
  Both were in the two actions that reach their Lump Sum Project **indirectly** — through a
  filter, or through a child's `ParentProjectId` — which is where a per-action habit fails.

  1. **`AssertLumpSumVisibleAsync` now runs on `ShowItemizedProjects` and
     `DeleteItemizedProject`.** Both resolved the parent and then never looked at it, so a
     restricted user refused the parent by `LumpSumDetails` was handed its whole child set by
     the first, and could **delete** those children through the second.

     **The hole was wider than the plan recorded.** `DeleteItemizedProject` identifies its
     target by `ProjectPK` alone, and a project with no resolvable Lump Sum parent was deleted
     anyway — nothing required it to be an itemized child. Posting the `ProjectPK` of
     `P00900040LS`, a sample **parent** with six children and a 180M allocation, would have
     hard-deleted it, orphaned all six, and bypassed `DeleteLumpSum`'s own refusal to delete a
     parent with live children. It now refuses anything without a Lump Sum parent, which is
     also what makes the gate unbypassable: with no parent there is no project to check
     against. No UI path closes — `vLumpSumChildSet` is scoped by `ParentProjectId`, so every
     row the child table can offer has one.

  2. **The published-child refusal now names Programs**, not the departed WF-6 workflow.

  **Proven:** the parentless refusal, the new wording, and that a real child still deletes
  Hard and returns its cost (Itemized 2,000,000 → 0, Remaining 7,000,000 → 9,000,000). The
  published branch is unreachable from this module by construction, so it was exercised by
  flagging a purpose-made child, reading the message back, and clearing the flag.

  **Not proven — and the blocker is sharper than "needs a restricted account".** See the
  Known gap below: no user on this database can exercise the visibility gate at all.
### Junior

> **THE FRONTEND ON THIS BRANCH WAS A MOCK-BACKED PROTOTYPE.** Established
> 2026-09-03, and it reshaped every J-task below. **Closed by `d7b3509b`** — the
> mock layer is deleted and every function posts to a real endpoint. The note is
> kept because it explains why J1 was an authoring job rather than a rename.
>
> `FE/src/pages/LSWallet/` is 39 files and 10,772 lines, but of its **19 service
> functions only 4 make a real `httpClient` call** — `ShowLumpsum`,
> `LumpsumDetails`, `WalletBalance`, `ShowItemizedProjects`, exactly the four
> reads dp-deployment's 310-line controller had. The other 23 call sites resolve
> from `mockData/walletMockStore.ts` (916 lines) and `walletSeedData.ts` (337).
> `Service.ts`'s own header states the arrangement: *"A comment block shows the
> real httpClient.post call and endpoint. The function body resolves from
> walletMockStore.ts instead… When the real backend is ready, replace the mock
> body with the commented httpClient call."*
>
> `store/walletStore.ts` is **seeded from `getStoreSnapshot()`**, so the atom does
> not start empty — which directly contradicts this plan's own rule that anything
> on screen came from the server or it is a bug.
>
> So phase 4 is not "rename the folder and delete some dialogs". Creating,
> saving, replenishing, deleting and importing have never once reached a server
> from this UI. The work is: **delete the mock layer, and wire every function to
> the 13 real endpoints** — the same authoring job the backend turned out to be.
> A rename applied to a mock-backed module would produce a renamed mock.

- ~~**J1 — FE rename AND un-mock.**~~ **DONE** (`15760e5a` rename, `d7b3509b` un-mock).
  `FE/src/pages/LumpSum/`; `mockData/` deleted; the atom starts empty; every function posts
  to one of the thirteen endpoints, and the ones with none behind them were deleted rather
  than stubbed.

  **Fewer external files than the ~15 estimated — 5.** `useHasRoute.ts` does not exist
  (`usePermittedRoutes.ts` does the job) and the Dashboard's `lswallet` references are a KPI
  type string, not a module path.

  **`RouteName: 'AddWallet'` was deliberately NOT renamed.** It is a
  `dbo.tAppViews.RouteName` matched against the session's ViewAccess, and
  `LumpSum.Permissions.sql` grants it by that exact string. Renaming it frontend-side alone
  hides `/lumpsum/add` from every user — the same "registration is not a grant" failure as
  decision 8, arriving as a blank page rather than a 403. It needs a paired database change,
  which is not in this plan.

  **Three pre-existing bugs surfaced and fixed:** the five-member `WalletStage` union (the
  database has twelve, so every Trust Fund stage rendered an unstyled badge); `Stages[].Name`
  read as `StageName` (blank filter options); and a program picker that excluded GAA-R,
  which under V2's rules guaranteed every new project was born unable to be itemized.

  **Two fields left the Program Details card** — `TypeName` and `ProgramStageName` — having
  no column behind them, and the itemized table lost its Project Status column, which
  `apiMappers` had been hardcoding to `'NotYetStarted'`.
- ~~**J2 — FE deletions.**~~ **DONE** (`55678179`) — 2,062 lines across 11 files. The dialogs
  were the easy half; what came with them was the Transaction Logs section (the WF-6 approvals
  panel, ~174 lines of table with per-revision approve/reject/return buttons), the on-mount
  effect fetching revisions for every published child, and the `revisionStatusLabel`/`Class`
  helpers.

  **Two items on the list below outlived J2 and were finished in `d7b3509b`:** the service
  functions and `Model.d.ts` types behind the deleted dialogs (J2 removed the callers, not the
  callees), and the Project Status column — which `apiMappers` had been hardcoding to
  `'NotYetStarted'` because no column backed it.

  The list is THIS branch's, not the reference's: there is no
  `ItemizeProjectDialog` or `PublishSelectedItemizedProjectsDialog` here, and no
  `SHOW_PUBLISH_TO_PCMA_WORKFLOW` flag — but there IS an `AdvanceProgramStageDialog`, which
  the reference had already removed.

  Delete (**1,547 lines across 7 dialogs**):
  `AdvanceProgramStageDialog` (152, decision 3) · `ItemizedProjectRevisionDialog` (240),
  `ApproveRevisionDialog` (165), `RejectRevisionDialog` (209),
  `ReturnRevisionForReviewDialog` (202) — all decision 7 ·
  `PublishItemizedProjectDialog` (180, decision 8) · `EditDrawAmountDialog` (399, decision 12).

  Also `store/revisionStore.ts` (118), the Approvals panel, the Project Status / PCMA Status
  columns, and every service function and `Model.d.ts` type behind them.

  Kept: `ImportItemizedProjectsDialog`, `WalletComponentCostDialog`, `ReplenishWalletDialog`,
  `DeleteItemizedProjectDialog`, `DeleteWalletDialog`, `SaveWalletConfirmDialog`.

  The server side is already gone, so nothing has to land in step with this — the FE is
  currently calling mocks, not endpoints.
- ~~**J3 — Replenish on.**~~ **DONE** (`show: true` with the revision-stage gate; the dialog
  was rewritten in `d7b3509b`). `REVISION_STAGES` is a UX hint only;
  `LumpsumController.RevisionStages` is what enforces it, and the dialog's
  strictly-increasing check compares against `OriginalAllocation` — the same figure the
  server compares against, confirmed by reading `ReplenishLumpSum` rather than assuming.
- ~~**J4 — Field re-spec wiring.**~~ **DONE** (`8cfd06e2`) — all 8 rules, in the server's order and wording, one toast for the first failure; edit mode validates the same set plus the three child arrays. Two of the four places needed nothing, both checked rather than assumed. Original: Wire the settled required set through all four places named
  in *Field spec*. Newly required: `SubCategoryId`, `CurrentStage`, `Tier`, `RegionWide`,
  `Agency`, `ComponentCostPerYear[]`. Newly nullable: `Region`, `Province`, `City`,
  `LegislativeDistrict`, `Deo`, `ImplementingOffice` — including **removing** the now-wrong
  `!isLumpSum` required markers for `Origin` and `Agency` in `ProjectDetailsForm.tsx`
  (both are required for an LS Project under the new spec) while keeping the location ones.

  **Two of the four places are already done.** The DB baseline widened the three columns
  (§2b) and the controller refuses all eight by name in the order a person fills the form
  (`ValidateRequiredFieldsAsync`). What remains is the frontend half:

  - `lumpSumFormRules.ts` covers **3 of the 8** — `ProgramId`, `CategoryId`, `Tier`. Missing:
    `SubCategoryId`, `OperatingUnit`, `Description`, `RegionWide`, `Agency`, `Origin`. Today a
    save missing one costs a round trip and comes back with the server's own message, so this
    is a polish gap, not a broken path.
  - The required-marker asterisks in `LumpSumDetailsSection.tsx` must match that set.
  - The import template's column list and `_Lookups` validations — the fourth place, and the
    one most easily forgotten because nothing type-checks it.

  `CurrentStage` is **already read-only** and always resolved from the program
  (`LumpSumProgramDetailsSection`, `d7b3509b`); it is never submitted, because the server
  ignores it.
- ~~**J6 — Stop the project and modification forms clobbering a Lump Sum Project's identity.**~~ **DONE** (`f08ec628`) — both files guard the Region auto-populate on `isLumpSum`; Region itself is still written. `handleBoxClick` returns early in edit mode, so this was the whole remaining exposure on an existing project. **Behavioural proof is blocked** — see J5. Original:
  Decision 13, which had no task and so survived three frontend commits. **Re-verified against
  HEAD:** both `Project/components/ProjectDetailsForm.tsx` (`:150`) and
  `Modification/projectmodification/components/ProjectDetailsForm.tsx` (`:174`) still run

  ```js
  onChange('IslandCode', selectedRegion?.IslandCode);
  onChange('ProjectType', selectedRegion?.IslandCode);
  ```

  on every Region change, with no guard — although each file already computes `isLumpSum`
  from `IslandCode === 'LS'` about 120 lines above.

  Skip both lines when `isLumpSum`. This is a **shared-form** change, so it needs a regression
  check that an ordinary project still gets its geographic island code — the guard must
  narrow to Lump Sum Projects and nothing else.

  Worth doing before J5: the failure it prevents is a raw
  `CK_tProjects_ProjectType` violation on save, and if it ever did save, `fProgramStages`'
  RISK-009 guard (`ProjectType <> 'LS'`) would stop excluding the project and it would be
  **double-counted in the program cost**. A walkthrough spec that opens a Lump Sum Project in
  `/projects/project-details/...` and touches Region will hit it.
- ~~**J5 — e2e: port the harness, then author the specs.**~~ **DONE** (`6c7d0da3`, `321a067b`, `248a5514`). A globalTeardown sweeper that survives an aborted run; data security through the UI; the narrated walkthrough, which found that creating from the form had NEVER worked (`ProgramLatest.ProgramId` sent where the server wants `ProgramPK`); and the identity regression, written and self-enabling because `/projects` returns no rows on this database. **27 passed, 5 skipped.** Original:

  The original decision was "prune, keep the harness, rewrite the survivors". Both halves have
  since turned out wrong. `dp-deployment` has **no LS specs and no harness at all**, so nothing
  can be pruned; and the harness itself is written against V1's contract, so it cannot simply
  be copied either.

  **Port unchanged (3 of 4 helpers).** `auth.ts`, `networkCapture.ts` and `rowActions.ts`
  contain no Lump Sum contract — login by form, route interception, and addressing icon buttons
  by accessible name. They move across as-is, with the two configs and the tagged sweeper.

  **`lumpSumFixture.ts` must be rewritten.** Every part of its contract has moved, and it would
  fail in four distinct ways:

  | Reference fixture | V2 |
  |---|---|
  | `POST /api/Lumpsum/CreateLumpsum` | `CreateLumpSum` — **404** |
  | `POST /api/Lumpsum/ShowLumpsum` | `ShowLumpSum` |
  | reads `body.WalletId`, `body.Wallet.ProjectId` | `body.LumpSumId`, `body.LumpSumProject.ProjectId` — otherwise `undefined` |
  | sends Category / Allocation / OperatingUnit / Description / FundingSource / FundingAgreement | **misses five now-required fields**: `SubCategoryId`, `Tier`, `RegionWide`, `Agency`, `Origin` |

  The last is the one to watch: it does not 404, it comes back as a **200-shaped refusal**
  ("Select a Sub-Category."), so the fixture throws `could not provision a Lump Sum Project` and
  every dependent spec fails for a reason that looks nothing like a field-spec change.

  A payload verified working against `localhost/myps_db_dev`:

  ```json
  { "ProgramId": "<a program at GAA-R or TF-R>", "CategoryId": 16, "SubCategoryId": 1,
    "OperatingUnit": "OI46", "Description": "...", "Tier": 2, "RegionWide": 1,
    "Agency": 1001, "Origin": 13, "Allocation": 250000000,
    "FundingSource": "GOP", "FundingAgreement": "DPWH-GAA-2025" }
  ```

  Use **`DPWH-GAA-2025`**, not the reference's `DPWH-GAA-2015`. Both codes exist in
  `tOptionFundingAgreement`, so 2015 validates cleanly — it is simply the wrong year, and a
  fixture that funds 2025 work from a 2015 appropriation is a misleading thing to leave in a
  test suite. No Region, DEO or Implementing Office: the field spec makes them optional, and
  omitting them is what exercises that.

  **`provisionLumpSum`'s rationale survives, its mechanism does not.** A spec that itemizes must
  still provision its own parent — itemization is one-way and there is no un-itemize, so a spec
  pinned to a shared parent passes once and fails every run after, which reads as a regression
  and is not one. But with Mode 2 gone (decision 11), a spec can no longer itemize an existing
  project: **it must import a workbook.** Any "give me a parent with children" fixture needs an
  `ImportItemizedProjects` payload, not an `ItemizeProject` call.

  **Specs to author** — against V2's 13 actions, not the reference's 24. The reference specs for
  removed features are never carried across at all rather than "deleted": `ls-approvals-*`
  (WF-6), `ls-publish-compliance-parity` (publish), `ls-itemize-picker-copy` and
  `ls-itemization*` (Mode 2), `ls-draw-and-delete-fixes` (Edit Draw). `ls-replenish-hidden`
  inverts to `ls-replenish` — Replenish is visible now and has never been exercised through a
  UI at all.

  Add one narrated walkthrough clicking every control V2 ships, plus absence assertions for
  what was removed.

  **Harness rules that must survive the move:** **one worker** — concurrent LS specs deadlock
  SQL Server on `UpdateProjectDetails`, which reads as a product bug and is not one; both
  configs run in sequence rather than merged; everything created is tagged and swept in
  `afterAll`.

  **`afterAll` is not a sweeper, and the existing suites prove it.** Observed twice on
  2026-09-03: a run that fails early enough — the API cold, the first request in a file timing
  out — aborts without reaching `afterAll` and leaves a provisioned Lump Sum Project and its
  child behind. Both had to be deleted by hand. A per-file `afterAll` is a tidy-up for the
  happy path; the suite needs a **tagged sweep that runs independently of any one file's
  outcome**, keyed on the `(e2e <timestamp>)` marker already written into every fixture's
  Description. Worth doing before the spec count grows, because orphans accumulate silently
  and each one shifts the allocation figures a later assertion depends on.

  ~~**What the suite must finally prove that curl has not:** `AssertLumpSumVisibleAsync`.~~
  **DONE** (`63d240b4`) — `ls-data-security.spec.ts` proves it across all 13 actions via the
  `LumpSum.DataSecurity.Dev.sql` fixture. What remains for J5 is the **UI** half: the same two
  accounts driven through the browser, where a restricted user should find the list empty and
  a deep link refused.

### Documentation

- ~~**D1–D3**~~ **DONE** (`d2eed056`). Both module documents were rewritten rather than
  edited, because both described a different module: `LumpSum.md` explained the
  "Mock/API-Swap Seam" and `dbo.tLSWallets`; `UserManual.md` documented Publishing,
  Requesting a Revision and Editing Funding Lines, and told users the module was a demo on
  sample data. `e2e/CLAUDE.md`'s coverage table is finished, with the whole-suite collection
  failure (`qa-kit`) and the sweeper's design recorded.

  Original wording follows.
- **D1** — `FE/src/pages/LumpSum/LumpSum.md`, **rewritten not ported** (the current file is
  the source of the stale claims corrected above).
- **D2** — `FE/src/pages/LumpSum/UserManual.md`.
- **D3** — `e2e/CLAUDE.md` route inventory and Lump Sum coverage table. **Partly done**
  (`7774fcd8`): the inventory no longer points at the deleted `pages/LSWallet/`, and the two
  things that cost time proving J1 are recorded — the `VITE_API_BASE_URL` override a UI spec
  needs, and the pre-existing `/auth/validate` 401s a console assertion has to exclude. The
  **coverage table still reads "No"** for all three Lump Sum routes, and correctly so until
  J5 lands; finish D3 with J5, not before.

## Conventions that must survive the rewrite

From `FE/CLAUDE.md` and the V1 plan's hard-won notes:

- **No `showToast` in a `catch`** — the interceptor already raised the API's own toast; adding
  one produced the double-toast defect across all eight dialogs of the module.
- `maxLength` on every input matching the DTO's `[MaxLength]`; never a bare `<input type="date">`.
- `/lumpsum/add` **before** `/lumpsum/:lumpSumId`, or the literal segment is captured as an id.
- Atoms start **empty** — anything on screen came from the server or it is a bug.
- `importItemizedProjects` transforms via `parseImportFile → transformImportedProjects →
  regroup` before posting. Posting the parse output verbatim is why no import ever succeeded.
- Paging sends the keyset cursor, or every page is page 1.
- The import template is **generated from the parser's own header list**, never a static
  `.xlsx`. Location fields import as **codes**; option-table fields match **by name**.
- `xlsxDataValidation.ts` splices `<dataValidations>` after `<sheetData>` and before
  `<hyperlinks>`/`<pageMargins>` — the only position `CT_Worksheet` allows. Lists are
  range-backed, never inline (inline `formula1` caps at 255 chars).
- Cross-module touches carry over: `ComponentCostDialog` filters `LS` out of the component-type
  dropdown; `useLocationFilters(isLumpSum)`; `ProjectDetailsForm`'s `IslandCode === 'LS'`
  exemptions; the Dashboard KPI card and activity type (renamed).

**Prerequisites, still required before any Lump Sum object:** `AdminAreas.ProvinceCode.sql`
(without it `POST /Project/ShowProjectDropdowns` 400s and every dropdown on the project, lump
sum and modification forms renders "No options found"); `MockPCMA.LocalStub.sql` on a machine
with only `myps_db` restored; and `tOptionProjectComponentType` must hold the `LS` row.

## Files touched

`dp-deployment` carried **5** `LSWallet.*.sql` scripts, 39 FE files and 2 controller files —
not the reference branch's 16 / 45 / 3. Counts below are this branch's.

**Deleted so far** — the 5 `LSWallet.*.sql` scripts · all of
`DBHelper/Models/Table/Lumpsum/` (5 models) · 3 old view models ·
`WebAPI/Controllers/Lumpsum/{LumpsumController,DTOLumpsum}.cs` (the 310-line wallet-era read API).

**Deleted since** — the 7 FE dialogs and `store/revisionStore.ts` under *Removing WF-6* and
*Removing publish* (`55678179`, 2,062 lines) · `mockData/{walletMockStore,walletSeedData}.ts`
and `utils/lumpSumBalance.ts` (`d7b3509b`, 1,314 lines).

**Still to delete** — nothing. `dp-deployment` has no e2e LS specs at all, so J5 is entirely
"author", never "prune".

**Created so far** — `Main/Resources/Internal/SQLScripts/{LumpSum.Baseline,LumpSum.SampleData.Dev,LumpSum.Permissions}.sql` ·
`DBHelper/Models/Views/Lumpsum/{LumpSum,LumpSumChild,LumpSumBalance,LumpSumItemizableCandidate}.cs` ·
`Helpers/LumpsumHelper.cs` ·
`WebAPI/Controllers/Lumpsum/{DTOLumpSum,LumpsumController,LumpsumController.Reads,LumpsumController.Writes}.cs`.

**Created since** — `WebAPI/Controllers/Lumpsum/{LumpsumController.Itemization,LumpsumController.Import,LumpSumImportValidation}.cs` ·
`FE/src/pages/LumpSum/**` (29 files; `utils/transformImportedChildren.ts` is the only one this
plan did not anticipate — see S6) · `e2e/tests/{ls-contract.spec.ts,helpers/lumpSumFixture.ts}`.

**Still to create** — the e2e UI specs in J5.

**Rewritten so far** — `DBHelper/Data/MYPSDbContext.cs` (Lumpsum region) ·
`DBHelper/Models/Table/Project/Projects.cs` (maps `ParentProjectId` / `ItemizationType` /
`ProjectStatus`; `ParentWalletId` and `WalletDrawFrozen` unmapped) ·
`DBHelper/Models/Table/Project/ProjectRevisions.cs` (Region / DEO / ImplementingOffice made
nullable AND their `[Required]` attributes removed — see implementation decision 6) ·
`WebAPI/Controllers/Dashboard/DashboardController.cs` (`vLSWalletProjectSet` → `vLumpSumChildSet`).

**Rewritten since** — `FE/src/utils/appRouteList.ts` · `FE/src/components/Routes.tsx` ·
`FE/src/layouts/AppSidebar.tsx` · `Project/dialogs/ComponentCostDialog.tsx` ·
`Modification/projectmodification/components/ProjectDetailsForm.tsx` (comment only).

**Still to rewrite** — `Project/components/ProjectDetailsForm.tsx` and the Modification twin
(J6) · `lumpSumFormRules.ts` + `LumpSumDetailsSection.tsx` + the import template (J4) ·
`LumpsumController.Itemization.cs` (S7).

**Two entries dropped from this list as wrong:** `FE/src/hooks/useHasRoute.ts` does not exist —
`usePermittedRoutes.ts` does that job — and `useLocationFilters.ts` needed no change, since
the Lump Sum form passes `isLumpSum` through an adapter rather than the hook changing. The
**4 Dashboard files** are also off it: their `lswallet` strings are a wire contract with
`DashboardController`, not module naming (decision 14).

## Verification

Per `CLAUDE.md`, a change is done only when a **watchable narrated Playwright run** has driven
it. A green build, a clean typecheck and a passing API probe are not validation.

### The final run, 2026-09-04

Re-run against the tree as it now stands rather than relied on from earlier in the work — a
green suite only proves the tree it ran on, and this one had gained J4, J5, J6 and the doc
rewrites since the last full pass.

| Check | Result |
|---|---|
| `dotnet build WebAPI` | succeeded, 0 errors |
| `tsc -b` | 21 errors, **all** in `pages/Rbac`, **all** pre-existing on `dp-deployment`; 0 elsewhere |
| `ls-contract`, `ls-data-security`, `ls-data-security-ui`, `ls-module-ui-walkthrough`, `ls-project-form-identity` | **27 passed, 5 skipped**, sweeper reported nothing left behind |

The five skips are deliberate and each carries its reason in the spec: three known gaps
(`InitFilterLumpSum` disclosure, the Central Office list/open divergence, and the Central
Office case as a user meets it) and two blocked by `/projects` returning no rows.

**Reproducing it** needs the API, Vite pointed at that API, and the data-security fixture:

```bash
cd Main && ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5015 \
  dotnet run --no-launch-profile
cd FE   && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort
sqlcmd -S 127.0.0.1 -d myps_db_dev -U sa -P <pw> -C \
  -i Main/Resources/Internal/SQLScripts/LumpSum.DataSecurity.Dev.sql
cd e2e  && npx playwright test ls-contract ls-data-security ls-data-security-ui \
                               ls-module-ui-walkthrough ls-project-form-identity
```

Naming the five is not optional: a bare `npx playwright test` fails to collect, because
`dashboard-real-data.narrated.spec.ts` imports `qa-kit`, which is not in `package.json`.
Pre-existing and unrelated.

1. ~~DB — all three views bind and return rows; the three functions/procs bind; no dropped
   object is referenced anywhere.~~ **Done** (`8a937c25`).
2. ~~Build — solution clean; `FE` typechecks.~~ **Done** — with the standing caveat that
   `FE`'s clean state is 21 pre-existing `pages/Rbac` errors, not zero.
3. ~~Permissions — a non-admin account opens a Lump Sum Project; renamed actions are granted,
   not merely registered.~~ **Done** (`63d240b4`), and it was the longest-standing gap in this
   plan: `AssertLumpSumVisibleAsync` had never engaged once, which is also why S7's missing
   calls went unnoticed. Run `LumpSum.DataSecurity.Dev.sql`, then
   `npx playwright test ls-data-security`. **Still to do here:** the same accounts through the
   UI rather than the API — a restricted user should find the list empty and a deep link
   refused, and that is part of J5.
4. ~~**Storage collapse (the point of V2)** — create an LS Project, edit it, and assert the
   rows landed in the `tProject*` tables, with no `tLSWallet*` table present in the
   database.~~ **Done** (`904b9dfe`, re-confirmed through the frontend's own mappers on
   2026-09-03: a create then an edit that added a funding line and a component cost, whose
   per-year row attached through the client-side `CostId` map).
5. **Narrated run** — `cd e2e && HEADED=1 SLOWMO=250 npx playwright test ls-module-ui-walkthrough`
   clicking **every** control V2 ships: both tabs, every row and header action, both
   collapsibles, each dialog's Cancel and X, the breadcrumb. Real values typed into every
   field, real options chosen, driven past the confirm to the real save, asserting the **API
   response** — and that exactly **one** toast appears, carrying the server's own words.
6. Absence — the cut controls are not rendered.
7. Replenish — a dedicated spec; it has never been exercised through the UI.
8. **Narrowed responsibilities** — grep the module: no revision action, table, model, DTO or
   dialog survives, and every remaining `Revision` hit is `tProjectRevisions`; no
   compliance-rule engine and no `IsPublished = true` write remains. Then publish a child
   **through Programs** and confirm Lump Sum reads its status correctly and refuses to delete
   it with a message naming **Programs**, not WF-6.
9. `npm run ls` green end to end.

## Known gaps — noted, not addressed in V2

### The project tables carry no foreign key constraints

Found on 2026-09-02 while auditing the sample-data migration. Confirmed on
`localhost/myps_db_dev`:

| Table | Primary key | Foreign keys |
|---|---|---|
| `tProjects` | present | **none** |
| `tProjectRevisions` (`ProjectFK`) | present | **none** |
| `tProjectComponentCost` (`ProjectRevisionFK`) | present | **none** |
| `tProjectComponentCostPerYear` (`ComponentCostFK`) | present | **none** |
| `tProjectFundingProfile` (`ProjectRevisionFK`) | present | **none** |
| `tProjectStages` (`ProjectFK`) | present | **none** |
| `tProjectMajorWorkItem` (`ComponentCostFK`) | present | **none** |

Primary keys **do** enforce Id uniqueness — a collision fails loudly. Nothing
enforces that a `ProjectRevisionFK` or `ComponentCostFK` points at a row that
exists, so a bad reference inserts silently and surfaces later as a query that
quietly returns nothing.

**Why this matters more to Lump Sum than to most modules.** The whole allocation
model is a chain of these references: `tProjects.ParentProjectId` → the parent's
`ProjectId`, its revision → its `LS` component cost, and `Remaining` read live off
that component. A broken link anywhere in it does not error; it silently changes a
number that people budget against. `Total = Remaining + SUM(children)` cannot drift
*arithmetically*, but it can be computed over the wrong set.

**Not fixed in V2, deliberately.** Adding these constraints is a schema change well
beyond this module, on shared tables, against a database holding pre-existing dirty
data — all 56,289 `tProjects` rows carry the literal string `'NULL'` in
`ProjectType` (see baseline §1). Any `ALTER TABLE ... ADD CONSTRAINT` would either
fail on existing rows or force data decisions that belong to whoever owns that data,
not to this rebuild.

**What V2 does instead:** `LumpSum.SampleData.Dev.sql` §6 asserts the integrity the
database will not — orphan checks on all four relationships, a cross-database
comparison proving each copied row points where its source points (an orphan check
cannot catch a reference resolving to the *wrong* row), and an identity-seed check.
Treat that as the pattern for any future data load here.

**If it is ever taken on,** it is its own piece of work: audit orphans across the
whole table set first, decide what happens to the rows that fail, then add the
constraints `WITH NOCHECK` before considering trusting them — the same shape as the
`CK_tProjects_ProjectType` compromise in baseline §1.

### Two wallet-era names survive the rename, on purpose

Recorded here so the inconsistency is not rediscovered as a bug. Both are decision 14.

| Name | Where | Why it stays |
|---|---|---|
| `RouteName: 'AddWallet'` | `Routes.tsx`, `appRouteList.ts`, `LumpSum.Permissions.sql` | A `dbo.tAppViews.RouteName` row. `usePermittedRoutes` matches it against the session's ViewAccess, so renaming the frontend alone hides `/lumpsum/add` from every user — a blank page, not a 403 |
| `LsWalletReleased` / `LsWalletTotal`, `Type = "lswallet"` | `DashboardController.cs:340,360` ↔ `Dashboard/Service.ts` | A wire contract between the API and the Dashboard, not module-local naming |

**Renaming either is a paired change**, and the first needs a database update in the same
step: rename the `tAppViews` row in place so its `Id` — and therefore every `ViewIds` grant
pointing at it — survives. Neither is worth doing on its own; both are worth doing if
something else takes that file next.

### ~~`myps_db_dev` cannot exercise row-level visibility at all~~ — CLOSED (`63d240b4`)

Kept because it explains a dead spot that lasted the whole project. `AssertLumpSumVisibleAsync`
had **never executed once**: it returns early when `ApplyFilter` is 0, and 0 of 576 users had
it set. Not for want of the flag — `tGroups` already carried two groups at `ApplyFilter = 1`.
`vUsers` computes it as *"no group of mine is unrestricted"*, and every user, including the one
holding a restricted group, is also in Admin.

`LumpSum.DataSecurity.Dev.sql` creates two restricted accounts differing only in `RegCode`
(`e2elsdenied` = Abra DEO/Cordillera, outside the program's DataSecurityGroup; `e2elsallowed`
= Central Office, exempt structurally), and `ls-data-security.spec.ts` drives all thirteen
actions through them. **Two traps it exists to defuse, both of which yield a green test that
proves nothing:** an account in the restricted group *and* any unrestricted group resolves back
to 0; and a group with no grants 403s at the permission filter before the guard is reached —
which is what happened on the first run, on all 13 actions. Hence the script grants the group
the actions and routes, and the spec asserts on the guard's own words rather than on mere
failure.

**Two divergences it found immediately**, both carried as skipped tests in that spec:

| Divergence | Detail |
|---|---|
| `InitFilterLumpSum` discloses programs the user cannot see | The dropdown is built from `vLumpSumSet` with no visibility predicate, so a restricted user learns the name and budget year of every program holding a Lump Sum Project, and is offered a filter that can only return an empty grid. No figures leak |
| A Central Office user can **open** a project but not **list** it | The guard uses `fUserVisiblePrograms(UserId)`, which exempts central users; `ShowLumpSum` filters inline on `vProgramDataSecurityGroups.ParticipantId = _Session.RegCode`, and for a central user `vUsers.RegCode` resolves to NULL, matching nothing. The same inline pattern is in `ProgramController` and `ProjectController`, so the fix is probably not Lump Sum's alone |

Neither is fixed. The second is the more consequential and the less obviously ours.

### `SyncAPIPermissions` had never been run; it has now

Run 2026-09-03 and it **succeeded**, disproving this plan's long-standing claim that it fails
with *Invalid object name*. What it did:

| | |
|---|---|
| Controllers | 0 added, 0 removed, 14 unchanged |
| Actions | **6 added**, **10 removed**, 119 unchanged |
| Lump Sum | all 13 still registered and granted to every group that had them; 0 dangling grants anywhere |

The 6 added were `[AllowAnonymous]` endpoints on `ImportingController` and `ProjectController`
— discovered by return type, so the attribute does not exempt them from registration. The 10
removed no longer exist in the assembly.

**`DashboardController` was correctly skipped, and that surprised us.** It is a
`CoreController` subclass in source, so its absence from `tApiControllers` looked like proof
the sync had never run. The real cause is `WebAPI.csproj`:

```xml
<Compile Remove="Controllers\Dashboard\**" />
```

The whole directory is excluded from compilation, so the type is not in the assembly, the
route does not exist (`/api/Dashboard/Summary` → 405), and the sync rightly removed its two
stale rows. **A grep-based inventory of "actions in code" is therefore wrong by construction
— it cannot see csproj exclusions.** The FE's `pages/Dashboard/` still calls those endpoints.

**Two hazards found while granting:**

1. **`UpdateUserGroup` is a FULL REPLACE**, not a merge — `ActionIds` becomes exactly what the
   request sends. A caller that posts a partial set silently revokes everything omitted, and
   it also writes `tGroups.ApplyFilter` from the same payload. This is how a group could lose
   its Lump Sum grants without anyone touching Lump Sum.
2. **It refuses ids that are not registered** — *"The following Action IDs do not exist: N.
   Please sync permissions and try again."* So registration really is the prerequisite for
   granting, and the sync is how a newly added route becomes grantable at all.

**The endpoint's unreachable second implementation has since been deleted** (`bcc4a22a`,
−80/+40), with the reasoning preserved in
[`MYPS_SYNCAPIPERMISSIONS_DEAD_REFLECTION_PATH.md`](../docs/engineering/MYPS_SYNCAPIPERMISSIONS_DEAD_REFLECTION_PATH.md)
and in doc comments on both methods. Idempotency — two consecutive runs both reporting
`Added 0 / Removed 0` — is verified now and was not before. **None of this is Lump Sum code**;
it surfaced only because this module was the first thing to run that endpoint.

### Three DTO fields are accepted and never written

Found 2026-09-04 while testing the optional-field lock. `ApplyDetailFields` — shared by create
and update, so this affects both — assigns every detail field **except three**:

| DTO field | Target column | Status |
|---|---|---|
| `MyId` | `revision.MYId` | **never assigned** |
| `ExternalId` | `revision.ExternalId` | **never assigned** |
| `Uacs` | `revision.UACS` | **never assigned** |

They are declared on `LumpSumDetailFieldsDTO`, bound from the request, validated for length,
and silently dropped. A create carrying `Uacs` returns `UACS: null`.

**UACS is the one that matters.** `ImportItemizedProjects` refuses children whose UACS differs
from the parent's — so that check can only ever compare against a UACS that arrived by some
other route, which on this database means the migrated MyMYPS sample. A Lump Sum Project
created through this module has none, and cannot be given one.

Not fixed here: the three fields are now locked in the UI (`4f761fc3`), so nothing can send a
value anyway, and adding the assignments is a behaviour change of its own — it would make UACS
settable and overwritable, which interacts with that import check. Worth deciding deliberately.

> **RESOLVED for UACS — see `documents/plans/lump-sum-ownership.md`.** The premise above was
> half wrong: `revision.UACS` is not merely unassigned, **the column does not exist**. UACS
> lives only on `tProjectComponentCostPerYear.UACS`, and `vLumpSumSet.UACS` is a `SELECT TOP 1`
> over those rows — which is why the project-level box reads back null however it is sent.
>
> UACS is now set where it actually lives: one field at component-cost level in
> `LumpSumComponentCostDialog`, fanned out across the per-year rows on save. The import no
> longer checks equality; it **copies the parent's value down** onto every child, which is what
> 2.6.8 asked for and what the check could never achieve. `LumpSumDetailFieldsDTO.Uacs` stays
> vestigial and should be removed or annotated.
>
> `MyId` and `ExternalId` are untouched and remain open.
>
> **Amended 2026-09-06 — the details form is the single writer; `Uacs` is live.** Storage is
> unchanged (per-year rows only), but the "OA Project Code (UACS)" box on Project Details is now
> editable and the server fans `dto.Uacs` out: `CreateLumpSum` writes it onto the derived
> per-year row, `UpdateLumpSum` runs `ApplyUacsToPerYearRowsAsync` after the children merge has
> flushed. **Tri-state on update:** absent = keep, `""` = clear, text = set (trimmed; `''` never
> reaches a row). The per-year merge now keeps a row's UACS when the row arrives without one.
> `LumpSumComponentCostDialog` displays the code and no longer writes it. Existing children are
> **not** re-synced (decision); the form warns when children exist. The concurrency gap between
> the import's read of the parent and its write is closed by a per-parent `sp_getapplock` taken in
> every mutator's transaction (5 s wait, then 409 Busy) plus a visible `tProjects.LockedBy /
> LockedDate` stamp during import (10-minute TTL) — see `LumpSum.md` *Concurrency*.

### Supplying a Region drags in the whole location chain

Also found 2026-09-04. `CreateLumpSum` with a `Region` and nothing else is refused:

> `{"Message":"Selected Province '' is not valid.","Title":"Invalid Province"}`

The Lump Sum write path calls `ProjectHelper`'s shared location validation, which walks
Region → Province → City and requires each once the previous is present. That contradicts the
*Field spec* above, which makes all six location fields **independently** optional.

Pre-existing, and now largely unreachable from the UI since the form can no longer set a
Region. It still applies to any direct API caller, and to the e2e fixtures — which is how it
was found.

### The published-child delete path is unreachable from this module

`DeleteItemizedProject`'s `IsPublished` refusal cannot be reached from Lump Sum by
construction: Lump Sum never publishes anything (decision 8), so a published child can only
arrive via Programs. Nothing in the plan's verification produces one, which is how S7's wrong
wording in that branch survived to be found by reading rather than by running.

It was exercised once, on 2026-09-03, by setting `IsPublished` on a purpose-made child and
clearing it afterwards. **That is a debugging technique, not a test** — a spec must not
write the flag itself, or it asserts against a state the product cannot produce.
Verification step 8 is the real coverage: publish a child **through Programs**, then attempt
the delete.

## Risks

| Risk | Mitigation |
|---|---|
| Every renamed action 403s for everyone | Registration is not a grant. Rewrite and re-run both permission scripts, resolving ids **by name** — they differ between databases. |
| A WF-6 remnant is left behind | The sweep found two non-obvious ones — the Activity tab's revision union and the `WalletDrawFrozen`/`EffectiveDraw` pair. After removal, grep for `Revision` across the module and confirm every remaining hit is `tProjectRevisions`, the ordinary per-project row. |
| A view column and its EF model land in different commits | Ship them together. EF binds `FromSql` by name; a missing column aborts the whole query. |
| dp-deployment's wallet-era module conflicts with V2 | Delete it explicitly in the first commit rather than merging around it. |
| dp-deployment's 478 commits changed shared idioms | New code follows `ProgramLatest`, `toDateInputValue` and `projectEnums.Code`; the reference branch predates all three. |
| The collapse changes what the Funding tab reads | Land DB, EF, controller and FE reads for the collapse as one reviewable sequence. The branch is only green at the end — honest for a rewrite of this shape. |
| The field re-spec lands in only some of its four places | Treat each field change as a four-point checklist (baseline+view, DTO, form rules + controller refusals, import template). |
| Reverting to an `LS` island code changes the LS Project ID format | The segment goes from geographic (`LZ`/`VS`/`MN`) to the constant `LS`. Find every consumer that parses or matches on it before changing generation; `ls-add-project-save.narrated`'s geographic-suffix assertion becomes an `LS`-suffix assertion. |
| The `:2721` comment is left describing the old rule | It states the stakeholder "explicitly rejected an artificial 'LS' suffix" — the reverse of what V2 does. Rewrite it in the same commit, or the next reader trusts it over the code. |
| A newly-required field has no column or lookup to bind | `SubCategoryId`, `RegionWide` and `Agency` were optional and may be unpopulated on existing lookups; verify each resolves real options before making the form refuse on them. |
| A broken parent/revision/component reference silently mis-states an allocation | The project tables have **no foreign keys** (see *Known gaps*). The database will not catch it, and the figure still adds up — just over the wrong set. Any bulk load or repair here must assert its own integrity, as `LumpSum.SampleData.Dev.sql` §6 does. |
| `QUOTED_IDENTIFIER OFF` (sqlcmd's default) | Every script sets it ON in its own batch; the filtered index on `tProjects` makes SQL Server refuse `UPDATE` otherwise. |
| Toast duplication | No `showToast` in a `catch`. |
| Fixtures pinned to a hard-coded `LS_WALLET` | Use `provisionLumpSum()` — itemization is one-way, so a shared parent drains and the second run "fails" for no product reason. |
| A green spec that proved nothing | Drive real controls, type real values, choose real options, go past the confirm, assert the API response. |
