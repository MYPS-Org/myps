# Plan: Fix Stale StageId===10 Gating in Project's ProjectForm.tsx

Status: Implemented
Created: 2026-08-14
Source: User report — "Revise Project" (and related gates) in `FE/src/pages/Project/components/ProjectForm.tsx` not working because "stageId 10 is not GAA-R"

## Context

`documents/plans/fix-program-stage-progression-gating.md` (Implemented, 2026-08-10) already diagnosed this exact class of bug in the **Program** module: the live `tOptionProgramStage` table no longer has an `Id=10` row at all — the current table is `1=BP, 2=NEP, 3=NEP-E, 4=HGAB, 5=HGAB-I, 6=GAA, 7=GAA-R, 8=RBP, 9=RDIP, [10 missing], 11=PIP, 12=TF, 13=TF-R`. That plan fixed `ProgramDetail.tsx`/`NextStageDialog.tsx`/`BatchActionsDropdown.tsx` and explicitly flagged (but left untouched) other `StageId===10` call sites elsewhere in the codebase as "known-broken-but-out-of-scope."

`Project/components/ProjectForm.tsx` is one of those untouched sites. It still has four gates built on the dead `StageId === 10` / `StageId !== 10` comparison:

- `isDisabled` (line 78): `IsActive === false || (StageId === 10 && Status === 1)` — never disables via the stage clause.
- "UnLock Project" button (line 1009): `StageId !== 10` — always true, so this always shows regardless of actual stage.
- "Itemized Lump Sum" button (line 1016): `StageId !== 10` — same, always true for any `...LS` project regardless of stage.
- "Revise Project" dropdown (line 1033): `StageId === 10 && Status === 1` — never true, so this **never shows**, which is the bug you're hitting.

Per the handoff doc for the Revision feature (`revision-frontend-integration-handoff.md`, used in the earlier Modification-module work this session), Formal Revision is specifically framed as "a submitted approval transaction over a published GAA-R Project" — i.e. these four gates were always meant to key off the GAA-R stage specifically, not a generic "terminal stage" concept. The old `StageId===10` was very likely a stale/wrong id copied at some point, not an intentional positional concept (unlike the Program module's now-removed `StageId===10` terminal check, which really did mean "last stage" before that fix).

## Approach

Fix all four gates to compare against `ProgramDetails.StageName === 'GAA-R'` instead of `StageId === 10`.

Why name, not a corrected numeric id (e.g. `StageId === 7`): the Program-module fix's whole point was to stop hardcoding DB-editable `tOptionProgramStage.Id` values, since that table's numbering already shifted once. `ProgramLatest` (the type backing `initialData.ProgramDetails` here) already carries `StageName: string` alongside `StageId` — no new fetch needed. Comparing on the name matches the convention the codebase already uses for this exact same "is this project at GAA-R" question in `LSWallet` (`wallet.CurrentStage === 'GAA-R'`, `p.StageName !== 'GAA-R'`, `FE/src/pages/LSWallet/Service.ts`/`walletActions.ts`/`WalletProgramDetailsSection.tsx`). This is a direct one-line-per-site fix — no new shared helper needed, since (unlike the Program module) nothing here needs "next stage" computation, only a static "is it GAA-R" check.

The four changes:
1. `isDisabled` (line 78): `Number(initialData?.ProgramDetails?.StageId) === 10` → `initialData?.ProgramDetails?.StageName === 'GAA-R'`
2. "UnLock Project" (line 1009): `initialData?.ProgramDetails?.StageId !== 10` → `initialData?.ProgramDetails?.StageName !== 'GAA-R'`
3. "Itemized Lump Sum" (line 1016): same swap as #2
4. "Revise Project" (line 1033): same swap as #1

No other logic changes — `handleLock`/`handleReviseProject` themselves, and everything downstream of the gates, are untouched. (Note: `handleLock` is a pre-existing `alert('...coming soon')` stub unrelated to this fix; `handleReviseProject` is real and opens `RevisionDialog`, so fixing gate #4 is what actually restores the reachable "Revise Project" action.)

## Acceptance Criteria

As a Project-module user, I want the stage-gated buttons in `ProjectForm.tsx` to reflect the project's real current stage, so that "Revise Project" is reachable once a project's Program reaches GAA-R and is published, matching the other three gates' correct visibility at every other stage.

- [ ] A project whose Program is at GAA-R with `Status === 1` shows the "Revise Project" dropdown (currently never shows).
- [ ] The same project has its form fields disabled (`isDisabled === true`) once at GAA-R + `Status === 1` (currently never disables via this clause).
- [ ] A project whose Program is NOT at GAA-R (any other stage) does NOT show "Revise Project", and DOES show "UnLock Project" (when `IsActive && IsUnlock`) and "Itemized Lump Sum" (when ProjectId ends `LS`) — i.e. the inverse gates behave correctly instead of being permanently true.
- [ ] No other button/section in `ProjectForm.tsx` changes behavior.
- [ ] `npx tsc -b` (FE typecheck) passes with no new errors.

## Tasks

### Implementation
- In `FE/src/pages/Project/components/ProjectForm.tsx`, replace the four `StageId === 10` / `StageId !== 10` comparisons (lines 78, 1009, 1016, 1033) with `StageName === 'GAA-R'` / `StageName !== 'GAA-R'` as described above.
- Run the FE typecheck to confirm no regressions.

### Documentation
- Update `FE/src/pages/Project/project.md`'s two stale tables that document the old numeric thresholds (the `isDisabled` row and the "Stage Progression"/button-condition table around "Revise Project (dropdown) | mode=edit, StageId=10, Status=1", "Unlock Project | ... StageId ≠ 10", "Itemized Lump Sum | StageId ≠ 10, ProjectId ends with LS") to describe the `StageName === 'GAA-R'` check instead.

## Files / Components Touched
- `FE/src/pages/Project/components/ProjectForm.tsx`
- `FE/src/pages/Project/project.md`

## Risks / Open Questions / Assumptions
- **Assumption**: these four gates were always meant to mean "specifically at the GAA-R stage," not "at or past GAA-R" or a generic terminal-stage concept. This is well-supported (the Revision handoff doc's own framing, and LSWallet's parallel `StageName === 'GAA-R'` checks for the same "is this published to PCMA" concept) but wasn't explicitly confirmed against live data. If a project can legitimately move past GAA-R (e.g. to RBP/RDIP) while still needing "Revise Project" to remain available, an exact-match check would incorrectly hide it there — recommend spot-checking against a real project at a post-GAA-R stage after this change, as a fast follow-up if that scenario turns out to matter.
- `handleLock` (behind the "UnLock Project" gate) is a pre-existing non-functional `alert(...)` stub — this plan fixes when the button *shows*, not what it *does*. Out of scope.
- Scope is intentionally limited to `ProjectForm.tsx`. The earlier Program-module plan already flagged `AIPReportDialog`'s own separate `stageId` thresholds as a similar-but-distinct, still-unfixed issue — not addressed here.

## Completion Log
Date: 2026-08-14
- Implementation: Replaced all four `StageId === 10` / `StageId !== 10` comparisons in `FE/src/pages/Project/components/ProjectForm.tsx` (lines 78, 1009, 1016, 1033) with `StageName === 'GAA-R'` / `StageName !== 'GAA-R'`, using the `StageName` field already present on `ProgramDetails` — no new data fetching required.
- Documentation: Updated `FE/src/pages/Project/project.md`'s `isDisabled` row and "Toolbar Button Visibility Rules" table to describe the `StageName === 'GAA-R'` check, with a note pointing to both this plan and the earlier Program-module plan that diagnosed the same class of bug.
Deviations / flags: None — implemented exactly as planned.
- `npx tsc -b --force` run before and after, diffed against the pre-session baseline: zero new errors (same 131 pre-existing, out-of-scope errors as the earlier Modification-module work this session).
Files changed: `FE/src/pages/Project/components/ProjectForm.tsx`, `FE/src/pages/Project/project.md`
