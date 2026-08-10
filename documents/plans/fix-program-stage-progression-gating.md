# Plan: Fix Stage-Progression Gating in Program Detail

Status: Implemented
Created: 2026-08-10
Source: User-reported bug — "Proceed to next stage" button not showing on `ProgramDetail.tsx`, investigated live in this session.

## Goal

Replace the hardcoded, DB-Id-dependent thresholds that gate the Program Detail stage-progression buttons (Proceed / Skip / Publish / Add Project / Add Existing Project) with position-based logic derived from the live, sorted stage list — so the UI stays correct regardless of gaps or edits in the admin-editable Program Stage code table.

## Acceptance Criteria

As a program manager, I want the "Proceed to next stage" and "Publish Program" controls to reflect the program's actual position in its stage track, so that I'm never blocked from advancing (or shown a dead-end "Publish" button) just because of gaps or edits in the stage configuration.

- [ ] A program at `StageId=1` (BP) with `IsActive=true` shows "Proceed to NEP".
- [ ] A program at each stage from BP(1) through RDIP(9) shows a correctly-labeled "Proceed to {next stage name}" button (no more "Final Stage" mislabeling at RDIP).
- [ ] A program at RDIP(9) shows "Proceed to PIP" (the real next stage, found positionally despite the missing Id 10).
- [ ] A program at PIP(11) (the last stage in the non-TF track) shows the "Publish Program" button instead of "Proceed" (when `Status===1`), and no longer requires the dead `StageId===10` condition.
- [ ] `BatchActionsDropdown`'s "Restrict Publishing"/"Allow Publishing" menu items appear under the same terminal-stage condition as the Publish button (currently dead due to `stageId===10`).
- [ ] The Skip button continues to appear only at `HGAB-I(5)` and `GAA-R(7)` (business rule unchanged) and its label/target stage is computed positionally (no regression — verified same output as old arithmetic for these two cases).
- [ ] `NextStageDialog` computes the same next/skip stage as `ProgramDetail.tsx` (shared logic, not duplicated arithmetic) and submits the correct target `Stage` NameId.
- [ ] A Trust Fund program (`Type===3`) at `TF(12)` shows "Proceed to TF-R", and at `TF-R(13)` is treated as terminal — using the TF track, not the main track.
- [ ] "Add Project" and "Add Existing Project" buttons use the same terminal-stage flag (`!isTerminalStage`) instead of the old `StageId <= 10` / `StageId < 10` checks.
- [ ] No behavior change to unrelated stage-based logic in this session's scope (AIP report type eligibility in `AIPReportDialog` is explicitly NOT touched — see Risks).

## Approach

`ProgramDetail.tsx` currently computes "next stage" and "skip stage" by doing raw arithmetic on `StageId` (`StageId + 1`, `StageId + 2`) and looking the result up by `Id` in the `Dropdowns.Stages` list, then gates buttons with hardcoded numeric thresholds (`>=4`, `<10`, `===5`, `===7`, `===10`).

Live data pulled from this session proved both mechanisms are broken:
- A brand-new program at `StageId=1` (BP) never sees "Proceed to next stage," because the gate requires `StageId >= 4`. Every program starts at 1, so this excludes the first 3 stages of every program's life.
- The real stage list in this DB (`tOptionProgramStage`, admin-editable via the Program Stage code table) is `1=BP, 2=NEP, 3=NEP-E, 4=HGAB, 5=HGAB-I, 6=GAA, 7=GAA-R, 8=RBP, 9=RDIP, [10 missing], 11=PIP, 12=TF, 13=TF-R`. Because `StageId=10` doesn't exist, `StageId + 1` from RDIP(9) computes 10, finds nothing, and silently mislabels the button "Final Stage" — and the "Publish Program" button (gated on `StageId===10`) is permanently unreachable, as is the identical `stageId === 10` check in `BatchActionsDropdown.tsx:65`.
- This isn't just a wrong number to swap for another — the underlying design (arithmetic on a DB-editable Id column) breaks any time an admin adds/removes/reorders a stage row. The fix needs to stop depending on specific Id values.

Per user decision: replace the hardcoded thresholds with **data-driven, position-based logic** — compute "next stage" / "is this the terminal stage" from where the current stage sits in the live, sorted stage list, not from magic numbers. This self-corrects if stages are ever reconfigured again.

**Track separation:** Trust Fund programs (`Details.Type === 3`) run on a separate stage track (`TF`, `TF-R`) from every other program type (`BP` → ... → `RDIP` → `PIP`). `AddProgramDialog.tsx` already encodes this convention (Type 3 forces the TF naming/flow). The stage list is partitioned by `Name` starting with `"TF"` (matches confirmed live data: only `TF` and `TF-R` start with that prefix) vs. everything else, then sorted by `Id`. "Next stage" = the following item in the program's own track; "terminal stage" = being on the last item of that track (no next item found).

Implementation steps:

1. Add a small shared helper (new file `FE/src/pages/Program/utils/stageProgression.ts`) exporting a single function:
   ```ts
   getStageProgression(stages: TableEnum[], currentStageId: number, programType: number): {
     nextStage: TableEnum | undefined;
     skipStage: TableEnum | undefined;
     isTerminalStage: boolean;
   }
   ```
   Implementation: partition `stages` into the TF track (`Name` starts with `"TF"`) vs. main track based on `programType === 3`, sort the relevant subset by `Id`, find the current stage's index, and return `subset[index+1]` / `subset[index+2]` / `!subset[index+1]`.

2. **`ProgramDetail.tsx`**: in `fetchProgramDetail` (replacing lines 159-165), call the new helper instead of the raw `StageId + 1` / `StageId + 2` lookups. Add an `isTerminalStage` state (alongside existing `nextStageName`/`skipStageName`). Update:
   - Proceed button condition (`:543-550`) → `programEnums.IsActive && !isTerminalStage`.
   - Skip button condition (`:551-557`) → keep the `StageId === 5 || StageId === 7` allowlist (unchanged business rule), just relying on the corrected `skipStageName`.
   - `handlePublishToPCMA` (`:344-347`) and the "Publish Program" button (`:596`) → use `isTerminalStage` instead of `StageId !== 10` / `StageId === 10`.
   - "Add Project" (`:601-605`) and "Add Existing Project" (`:606-610`) → both use `!isTerminalStage` instead of `StageId <= 10` / `StageId < 10` (see Risks for the minor behavior normalization this implies).
   - Pass `isTerminalStage` as a new prop to `BatchActionsDropdown` (replacing its internal `stageId === 10` check).

3. **`NextStageDialog.tsx`**: replace the duplicated `program.StageId + 1` / `+ 2` arithmetic (`:28-31`) with a call to the same `getStageProgression` helper, using `program.Type` (already on `ProgramDetails`) for track selection.

4. **`BatchActionsDropdown.tsx`**: change the `stageId: number` prop to `isTerminalStage: boolean`; replace `:65`'s `stageId === 10` with the passed-in flag.

5. Update `program.md` (`FE/src/pages/Program/program.md`) — the "Stage Progression Buttons" and "Stage Model" tables currently document the old, now-incorrect thresholds; rewrite them to describe the position-based approach.

## Tasks

### Implementation
- Create `FE/src/pages/Program/utils/stageProgression.ts` with `getStageProgression()` and unit-testable pure logic (TF-track vs. main-track partition, positional next/skip/terminal).
- Update `ProgramDetail.tsx`: state (`isTerminalStage`), `fetchProgramDetail` next/skip computation, all four button-gating conditions, `handlePublishToPCMA`, and the prop passed to `BatchActionsDropdown`.
- Update `NextStageDialog.tsx` to use the shared helper instead of inline arithmetic.
- Update `BatchActionsDropdown.tsx` prop signature and its `showPublishActions` check.

### Documentation
- Update `FE/src/pages/Program/program.md`'s "Stage Progression Buttons" and "Stage Model" sections to reflect the position-based logic and the TF/main track split (remove the now-incorrect StageId-range table).

## Files / Components Touched
- `FE/src/pages/Program/utils/stageProgression.ts` (new)
- `FE/src/pages/Program/Views/ProgramDetail.tsx`
- `FE/src/pages/Program/dialogs/NextStageDialog.tsx`
- `FE/src/pages/Program/components/programDetail/BatchActionsDropdown.tsx`
- `FE/src/pages/Program/program.md`

## Risks / Open Questions / Assumptions
- **TF track detection by name prefix**: assumes `Name` values `"TF"`/`"TF-R"` are stable and no other stage is ever named starting with `"TF"`. Confirmed true for current live data; if the admin-editable Program Stage code table changes naming conventions, this heuristic could misclassify. A more robust long-term fix would be an explicit `Track`/`IsTerminal` column on `tOptionProgramStage`, but that's a backend schema change out of scope here.
- **`AddProgramDialog.tsx:123-125`** forces `Stage = 11` (PIP) for Type=3 programs, not `12` (TF) — this looks like a separate, pre-existing bug (new Trust Fund programs may be created directly at PIP instead of TF). Flagged but **not fixed** in this plan; needs separate confirmation since it affects program creation, not the stage-progression display bug reported here.
- **`AIPReportDialog`** (per `program.md:288-294`) has its own hardcoded `stageId` thresholds (`≤4`, `===3`, `≤2`, `≥10`) for report-type eligibility. Since `StageId=10` doesn't exist, its "AIP/AIP02 available at stageId≥10" condition is likely also dead. **Not touched** in this plan — report-type-per-stage is a curated business mapping distinct from the generic terminal-stage question, and changing it needs its own confirmation.
- **Add Project vs. Add Existing Project behavior normalization**: the old code allowed "Add Project" at `StageId<=10` (inclusive of the old terminal) but "Add Existing Project" only at `StageId<10` (exclusive). Both are being normalized to `!isTerminalStage` (exclusive), since the terminal-inclusive case was already unreachable dead code (no stage had Id 10). This also incidentally fixes "Add Project" being invisible for TF-track programs at `TF(12)`, which under the old `<=10` check could never show since 12>10.
- **Backend `UpdateProgramStage`** (`ProgramController.cs:736`) has no allowed-transition validation of its own — it accepts any valid stage NameId regardless of sequence. This plan only fixes what the FE *offers* as buttons; it doesn't add server-side sequencing validation. Flagged as a pre-existing gap, not addressed here (out of scope — user's report was about the missing button, not about needing new backend validation).

## Verification
- Manually load `ProgramDetail` for a program at each of BP(1) through RDIP(9) (via `programdetails/{programId}:{stageName}` route) and confirm the Proceed button appears with the correct next-stage label at every one, including the previously-broken RDIP(9)→PIP(11) transition.
- Confirm the Skip button still appears only at HGAB-I(5) and GAA-R(7) with the same target labels as before (GAA-R and RDIP respectively) — no regression.
- Confirm a program at PIP(11) (or manually move one there) shows "Publish Program" (with `Status===1`) instead of a dead Proceed button, and that `BatchActionsDropdown`'s Restrict/Allow Publishing items appear too.
- Create a new Trust Fund program (`Type=3`) and confirm the TF/TF-R progression buttons work independently of the main track (once the separate `AddProgramDialog` Stage=11-vs-12 issue is either fixed or worked around for testing).
- Run existing FE type-check/build (`npm run build` or repo's standard command) to confirm no TypeScript errors from the prop-signature change on `BatchActionsDropdown`.

## Completion Log
Date: 2026-08-10
- Implementation: Added `getStageProgression()` in `FE/src/pages/Program/utils/stageProgression.ts`, partitioning `Dropdowns.Stages` into a Trust Fund track (`Name` starting with `"TF"`) vs. main track based on `Details.Type === 3`, sorted by `Id`, returning the positional next/skip stage and an `isTerminalStage` flag. Wired it into `ProgramDetail.tsx` (replacing the `StageId + 1`/`+ 2` lookups in `fetchProgramDetail`, and swapping all `StageId >= 4/</=== 5/=== 7/=== 10/<=10` button gates for `!isTerminalStage`/`isTerminalStage` except the still-curated Skip allowlist at `StageId === 5 || StageId === 7`) and into `NextStageDialog.tsx` (replacing its duplicated arithmetic). Corrected `NextStageDialogProps.stages` from the structurally-mismatched `ProgramEnums[]` to the correct `TableEnum[]`. Changed `BatchActionsDropdownProps` from `stageId: number` to `isTerminalStage: boolean` and updated its `showPublishActions` check accordingly.
- Documentation: Rewrote `program.md`'s "Stage Progression Buttons" and "Stage Model" sections to describe the position-based, track-aware logic instead of the old fixed StageId-range table.
Deviations / flags: One post-implementation correction beyond the original plan text: traced the `/Program/updateProgramStage` payload contract (`DTOProgram.cs:99-104`, `ProgramController.cs:742` and `:1027`) and found that `Details.StageId` is persisted server-side as the stage's `NameId` (`StageId = dto.Stage`, validated via `x.NameId == (int)dto.Stage`) — not the `tOptionProgramStage.Id` identity column. `getStageProgression()` and the two lookup/submit sites (`NextStageDialog.tsx`'s payload `Stage`, `ProgramDetail.tsx`'s `handleNextStageSubmit` lookup) were built against `.Id` initially since it matched the plan's original description; switched all three to `.NameId` to match the real backend contract. This was invisible in current seed data because `Id` and `NameId` are numerically identical for every existing row, but `NameId` is the only value guaranteed stable by the backend's semantics. As anticipated in Risks, the `AddProgramDialog.tsx` Type=3→Stage=11 issue and `AIPReportDialog`'s separate stageId thresholds were left untouched (out of scope).
Files changed:
- `FE/src/pages/Program/utils/stageProgression.ts` (new)
- `FE/src/pages/Program/Views/ProgramDetail.tsx`
- `FE/src/pages/Program/dialogs/NextStageDialog.tsx`
- `FE/src/pages/Program/components/programDetail/BatchActionsDropdown.tsx`
- `FE/src/pages/Program/program.md`
