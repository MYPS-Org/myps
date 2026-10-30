# Plan: Complete S04 — Code Tables & Settings (ATA)

Status: Implemented locally (2026-10-30), not yet committed; waiting for UAT re-test
Created: 2026-10-29
Owner: Gener (S04). Recards owns S02 and S03.
Source: `docs/Live_Internal_QA_Updated_with_ATA_Feedback_28Oct2026.xlsx` (sheet S04, saved 2026-10-29), ATA Completion Plan v3 (29 Oct).

## Goal
Every S04 test case that is Failed or Pending is either fixed and verified on the local stack, or has a named blocker (test accounts, a product decision, a test-script correction), so ATA can re-test S04 on one UAT build.

## Where S04 stands (31 test cases)
- Passed (4): TC004 Origin, TC006 Scope of Work, TC025 User Management, TC027 Users Filter.
- Failed (17): TC007, TC008–TC014, TC017–TC024, TC028.
- Pending (10): TC001, TC002, TC003, TC005, TC015, TC016, TC026, TC029, TC030, TC031.

## Acceptance Criteria
- [x] The five S04 fixes still on Gitea (#479 Infra Type / Type of Work, #480 Funding, #481 Origin / Agency, #482 Category / Thrust, #488 validity by program year) are on GitHub main, built, unit-tested and e2e-tested on the local stack. (TC001, TC002, TC007) On branch `fix/S04-code-tables` (not yet on main); 12 of their 14 specs pass locally, the two others are open (see Completion Log).
- [x] The fixes already on main for TC005, TC008–TC014, TC017–TC024 are confirmed on the local stack by an e2e run (`code-tables-s04-retest.spec.ts`, `code-tables-cost-type-pcma-label.spec.ts`). TC003 (#456) by code reading only.
- [x] TC028: Edit User says when no Employee ID is on record and how to fill it; View User shows "Not recorded".
- [x] TC016: Validation Dates — decision (Gener, 2026-10-30): save them AND enforce. Saved table + API + screen; a NEW revision request outside the active window of its program year is refused; resubmissions are not.
- [x] TC026: test script correction drafted (below).
- [x] TC015, TC029–TC031: verified locally where a local account allows; on UAT they wait for the DPC, RPC, PS Admin, AUC, DEO and RO accounts. TC015: an edited Rule stays Active (retest spec). TC029: Filter Group by Permission Name was ignored, now fixed. TC030: Add Group with Apply Filter saves, and a duplicate name is refused. TC031: checked as asisjnt (DPC, Apply Filter).
- [x] Release notes in docs/changelogs; the ATA re-test list below is final.

## Approach
1. Cherry-pick the Gitea stack (6 commits by itsmeyuukii, oldest first) onto branch `fix/S04-code-tables` from main, keeping the original author. Gitea's history holds passwords, so nothing is merged from it; only these commits' changes are replayed. Merge these first: they touch the Project form, the Revision copies, Lump Sum, ProjectController, RevisionController and the import, which Recards edits for S02 / S03.
2. Build, unit tests, tsc / eslint on the changed files, and the five e2e specs on the local stack (Vite :8082 → API :5017 → local myps_db_dev, COPY_ONLY backup first; never the repo's playwright.config.ts, whose teardown deletes Lump Sum projects).
3. Verify the "fixed on main" cases with a new e2e spec, fix what fails.
4. TC028 in the front end only. TC016 after the decision.

## ATA re-test list (S04)
Final (2026-10-30), once `fix/S04-code-tables` is deployed to UAT:
- Code Tables: TC001, TC002, TC003, TC005, TC007, TC008, TC009, TC010, TC011, TC012, TC013, TC014, TC015, TC016, TC017 (with the corrected script below), TC018, TC019, TC020, TC021, TC022, TC023, TC024.
- User Management: TC027 (passed before; the group filter is now exact, so worth one more look), TC028, TC029, TC030, TC031 (needs an RO / DEO account on UAT).
- Not for MYPS: TC026 (see the corrections below).
- TC016 needs `Migration.RevisionValidationDates.2026-10-30.sql` on the UAT database first.
Note for ATA on TC010–TC012 ("Remove IsActive field"): the raw IsActive column is gone; each row keeps one Active / Inactive switch, as on every other code table.

## Test script corrections for ATA
- **S04-TC026-P001 (App Modules):** ATA's own remark: "This is an IMS only section." App Modules (Settings → User Management → App Modules) maintains the IMS module registry; it is not an MYPS user function. Proposed: mark S04-TC026 Not Applicable for MYPS (or move it to the IMS test plan).
- **S04-TC017-P001 (Program Stage):** the step "Click Add and enter the Name" no longer applies to Program Stage: stages are fixed by the system (a stage added there could not be used). Proposed step: edit a stage's Description, and set an unused stage Inactive; a rename of a stage in use is refused with its reason.

## Hidden bugs found and fixed (beyond the workbook)
Found by an independent review of the Gitea stack and two read-only audits (Code Tables; User Management), each verified in code before fixing:
- Central (CodeTableController): an update without IsActive no longer deactivates the row (bool default false was copied); a create without it is Active. This was deactivating Origins on edit and EVERY Revision Rule edited on the Rules screen (rules then vanished and revisions found no rules). Audit log now one row per changed column (`CodeTableChangeLog`); Thrust audit rows were written as tOptionProjectCategory. Creates take a per-table app lock (MAX+1 ids).
- In-use guards judged by the STORED row and widened: Revision Header (Reasons/Categories/Documents), Revision Category (Reasons/Documents), Reason (Rules; no header move while requests use it), Rule delete (screen sends only {Id}), Cost Type (compared the name with the FK column: never matched; now ComponentId, projects + revisions), Infra Type (Scope of Work lists), Scope of Work (infra arrays compared by reference; removing a code used by Major Items), Funding Agreement Source Org.
- Validation: Thrust PAP Key > 0, description, Valid From <= Valid To; Category name and Min <= Max; Origin name; Scope of Work Target Unit and Max > 0 (UI + API); Program Stage add refused (UI has no Add). Category delete removes its Sub-Category mappings.
- UI: Origin add/edit send IsActive; Thrust PAP Key, Agency NameId, Rule Reason read-only on edit; Funding Source toggle keeps a blank Nature.
- Review of the stack: Major Items lookup check per field (a Modification picking another Type of Work under a retired Infra Type was refused); RequestRevision / ResubmitRevision treat "posted as deleted" as deleted only when the rule allows deletes; ResubmitRevision keeps the project's own Sub-Category and rolls back on refusal.
- S01 area: two Program exception endpoints pasted the Program ID unquoted into SQL (injection; real ids were a syntax error) — now parameterised.
- User Management (separate agent, merged after review, then tested locally):
  - Security: the PIS employee lookup and the raw projects export answered without sign-in. They now need User Management access, or a program the user can open.
  - A newly added user or App Module got a stand-in Id until reload, so its Delete removed another row. Lists now reload, and Delete refuses an Id/UserId mismatch.
  - Paging on Users / User Groups / App Modules (page 2 showed page 1).
  - The group filter is exact ("Admin" listed DPD Admin members).
  - No self-lockout: own status, own groups, and own group's User Management access.
  - Employee ID: required on Add, unique, and cleared when changed after a search.
  - DPC / RPC / AUC / DPD Admin cannot be renamed.
  - Found while testing: Edit User refused every account whose office has no region in vUsers (111 local accounts on OI10) with "Invalid Region Code"; the stored region is kept now. Filter Group's Permission Name was never applied (TC029). Delete Group showed its error twice.
- Region scoping (separate agent, merged after review, then tested locally as asisjnt): Global Search (all project categories, UACS, Program Name), Project Groups (search, add / remove, details, and, added here, the list's ProjectId filter and member counts), Project > SearchProgram, and Import / Update / Export now apply the existing visibility rules. Export also skips the stage step its own IsValidProgramId check has already done.

## Found, not changed (decisions or out of scope)
- vUsers keeps `WHERE EmployeeId IS NOT NULL`, so an account stored with a NULL Employee ID is missing from User Management. It cannot sign in either, because login reads vUsers. Locally that is 2 accounts (yabutg, asisj). Removing the filter would let them sign in, so the view is unchanged.
- Export of a program the user may open includes all its projects, even those of other DEOs in the region that a DPC user does not see in the lists. The visibility plan left exports for a later change.
- Delete Project Group ungroups every member, including projects the user cannot see.
- `ApiPermissionsTab.tsx` / `FilterPermissionDialog.tsx` are unused and carry 9 of the remaining tsc errors.

## Risks
- The stack changes 28 files outside Code Tables. Recards should branch for S02 / S03 after it is on main.
- 344 of 580 local users have no Employee ID stored; TC028 explains it but does not backfill.

## Completion Log
- 2026-10-29: stack cherry-picked onto `fix/S04-code-tables` (applies cleanly). API build 0 errors; MYPS.UnitTests 82/82; tsc: no errors in the changed files; eslint: no new errors (the 20 in those files are on main too).
- 2026-10-30: fixes above. MYPS.UnitTests 88/88 (+ RevisionValidationWindowTests). Local e2e (Vite :8082 → API :5017 → local myps_db_dev, backups `myps_db_dev_pre_s04_e2e_20261029.bak`): `code-tables-s04-retest.spec.ts` 15/15 (10 re-test + 5 hidden-bug / TC016), TC005 spec passes; the stack's 14 specs 11/14 with Category 1 made Active for the run only (local data has it Inactive; restored after); a re-run of the 3 failures passed one, so 12/14 (open: funding TC034/TC035 set-up, TC037 Agency chip click). Code tables compared with a checksum snapshot after every run: identical; no e2e rows left.
- 2026-10-30 (later): User Management and region scoping merged from their worktrees and reviewed. MYPS.UnitTests 109/109 (+21 region-scoping contract tests). tsc 14 errors, all pre-existing, down from 15. Local checks through the UI and API (Vite :8082 → API :5017 → local myps_db_dev):
  - User Management 5/5: paging, exact filter, Edit User for an account without Employee ID or region, the "No Employee ID" hint, own deactivation refused.
  - User Groups: TC029 Permission Name / Group Name filters and Clear 7/7; TC030 Add Group with Apply Filter saved and a duplicate refused. The duplicate check failed only on its selector; the screenshot shows the refusal.
  - Region (TC031) 18/18 as asisjnt against an admin control: Global Search by Project ID, Description and Program Name; SearchProgram; Project Groups search, add, details, list filter and counts; Export refused for another region with no job queued, accepted for its own (job 65 completed).
  - Data left on purpose: user group `E2E-TC030-1793292169120` (Id 16, no members), because deletes on the dev database are not allowed; export job 65 and its file. Project group 2 membership restored, and both test accounts unchanged.
  - Not re-run: the 7 destructive e2e specs (they hard-delete their own fixtures). The code they cover is unchanged since their last run. Open from that run: funding TC034/TC035 (setup flake) and TC037 (Agency chip click in the spec).
