# Batch Actions in Program Details appeared to do nothing: root cause and fix

**Date:** 2026-09-21 · **Branch:** `fix/program-detail-batch-actions-refresh` · **Commit:** `855a98b2`
**Plan:** `C:\Users\User\.claude\plans\inherited-fluttering-toast.md`

## Symptom

On Program Details, the Batch Actions menu (Batch Delete, Restrict Publishing, Allow Publishing) had worked and no longer did. The reporter's words were "previously working but currently not working as intended".

Every action reported success. The page showed a green message and the projects table did not change: deleted projects stayed listed, and the Publishable column kept its old values. From the operator's side that is indistinguishable from the action having failed.

There turned out to be two independent causes, and the more serious one was found only because the end-to-end test written for the first one kept failing after that first one was fixed.

## Severity, before anything else

**Batch Delete was flagging the wrong rows.** On any project a user could paste in, it marked a revision belonging to a *different* project as deleted, or nothing at all, and answered success either way. On `myps_db_dev_200`, of the 115,350 projects that could be submitted:

| What Batch Delete actually did | Projects |
|---|---|
| Flagged **another project's** revision, in another program | 112,115 |
| Flagged nothing, and still answered 200 | 2,064 |
| Flagged its own revision, by coincidence of numbering | 1,171 |

Against the project list it matched **0 of 109,790 listed rows**, which is why the deleted project never disappeared from the table.

Anyone who used Batch Delete on a real database should be treated as having soft-deleted unrelated projects. The affected rows are `tProjectRevisions` with `IsDeleted = 1`; they are recoverable, because the delete is a flag rather than a removal. The restore path is described at the end.

## What was ruled out first, and how

Four plausible causes were eliminated before anything was changed. Three of them looked strong on the face of it, because this area of the system had recent work in it.

| Hypothesis | How it was tested | Result |
|---|---|---|
| The lookup stopped matching after the 2026-09-10 split-brain fix to `vProgramLatest` / `vProjectLatest`, or after the GAA-R revision overlay of 2026-09-20 | For every program on two databases, compared the rows `fProgramProjects(ProgramPK, currentStage)` lists against the exact predicate the three `Batch*` actions apply to `vProjectLatest` | Zero mismatches on `myps_db_dev_200` and zero on the production copy `myps_db_dpwh`. Every listed project is findable |
| The permission filter refuses the actions | `tApiActions` and `vUserActionPermission` | All four `Batch*` actions are registered and granted to 579 active users on both databases |
| A trigger added by the program-cost work interferes with the bulk update | `sys.triggers` on `tProjects` and `tProjectRevisions` | No trigger exists on either table |
| The publish options vanished because stage progression changed on 2026-09-08 | Read `stageProgression.ts` and the gate in `ProgramDetail.tsx` | Unchanged. GAA-R is still terminal on the main track, and the gate still requires an Approved program at a terminal stage |

The database comparison is the one worth repeating if this recurs. It answers "could the server find what the user pasted" directly, for every program at once, without needing the application running.

## Root cause 1: Batch Delete used a project key where a revision key was required

`BatchDelete` reads the matching projects from `vProjectLatest` and then flags rows in `tProjectRevisions`. It selected the view's `Id` column and passed it as the revision key.

Those are identities of two different tables. `vProjectLatest.Id` is `tProjects.Id`; the revision key is `vProjectLatest.RevisionId`, which is `tProjectRevisions.Id`. They are never equal by construction, and on `myps_db_dev_200` they differ for all 115,350 rows.

Because both tables number from 1 and the revision table runs further (to 274,855 against the project table's 122,399), most project identities land squarely inside the revision range and match an unrelated revision. That is how a delete of `P00727243LZ` came to flag `P00755411LZ`, a project in a different program.

The action then reported success in both failure modes. When it matched nothing, `updatedCount` was zero and the method returned HTTP 200 with "No changes were required because all matching project revisions are already deleted" — a success response, which the interface shows as a green toast. When it matched the wrong row, it reported that row as deleted.

The fix is to select `RevisionId`. Verified against the list the table is built from: the old key matched 0 of 109,790 listed rows, the new key matches 109,788.

## Root cause 2: the table and the header are two different fetches

Before 2026-08-08 the projects table arrived inside the `/Program/ProgramDetails` response, so reloading the program reloaded the table with it. Commit `b11ed1b4` moved the table onto its own paginated endpoint, `ShowProjectsInProgram`, driven by the `usePagination` hook. From then on, reloading the program header did nothing for the table.

The Batch Actions menu passes a refresh callback, and that callback only ever reloaded the header. Nothing re-read the table, so nothing on screen changed.

The same defect had already been found and fixed once, for the Publish Program button, which re-queries the table explicitly and carries a comment saying why. The batch path and the project-restore handler were not given the same treatment, so they kept the old behaviour.

Two details made it read even more like a dead button. The loading flag flips the whole page to a skeleton while the request is in flight, so the menu disappears and comes back with the table unchanged. And both error handlers added their own generic failure message on top of the one the HTTP layer already shows, so a genuine refusal, such as a project ID that does not belong to the program, was reported twice and in the less useful wording of the two.

## Two further defects found in the same code

**Batch Delete never recomputed the program cost.** Since the program-cost work of 2026-09-20, a project counts toward its program's cost through its latest live revision at the current stage, and every other path that changes a project calls the shared recompute helper. Batch Delete did not. Program Details reads the stored cost rather than summing live, so after a batch delete the header kept its pre-delete figure until some unrelated write happened to recompute it.

**The project-restore action could never have succeeded.** Its lookup of deleted revisions was a deferred query, not a materialised list, and it was evaluated three times. Two of those evaluations happened after the update that clears the deleted flag, so they matched nothing. The set of restored projects therefore came back empty, every requested ID was reported as not found, and the guard that decides whether to commit saw zero rows and returned early. The transaction was disposed without a commit, which rolled back the restore the action had just performed. It reported "No Projects Restored" every time, correctly describing the state it had just undone.

This one has never affected a user: the menu entry that reaches it has been commented out in the interface since 2026-08-13. It is fixed because the action is still routable and still granted.

## The fix

- Batch Delete flags the revision key, not the project key.
- Batch Delete opens a transaction, recomputes the program cost after the delete, and commits the two together.
- One helper on Program Details re-queries the projects table, and the batch handler, the restore handler and the existing publish handler all use it. It resets to the first page rather than re-reading the current one, because the current page's cursor may refer to a row that was just deleted.
- The restore action materialises its lookup once, before the update.
- Both duplicate error messages are gone. The diagnostic logging stays.
- A leftover debug line that printed the publish payload to the console was removed.

## Verification

- All 42 API integration tests pass. Four are new: the revision key in Batch Delete, its transaction and cost recompute, the absence of debug output in all four batch actions, and the ordering of the restore lookup against its update.
- The frontend typecheck reports 25 errors with and without this change. All are in the role-based access control pages and none are in the files touched.
- The end-to-end spec `e2e/tests/program-detail-batch-actions.spec.ts` deletes a project through the menu and asserts the row leaves the table with no page reload. It was run against the pre-fix build and fails there, which is what gives it its value. It also asserts that the publish options stay hidden until the program is Approved, and that the table is re-queried after a Restrict Publishing call.
- After a passing run, the flagged revision was checked directly: the target project's own revision was marked deleted, and no other project's was.

The spec does not assert that the Publishable cell changes value. Every Lump Sum parent on this database is already not publishable, so restricting one produces no visible change, and allowing it back cannot be guaranteed either, because that procedure only ever grants, and only to a project that satisfies all seven GAA-R rules. Asserting a cell flip there would test the fixture's data rather than the refresh.

## If Batch Delete has been used on a real database

The delete is a flag, so nothing is gone. Wrongly flagged rows are `tProjectRevisions` with `IsDeleted = 1` whose project the operator did not name. Two ways to find them: the transaction log around the time the action was used, and the arithmetic of the defect itself — for a project the operator did name, the row that was wrongly flagged is the revision whose `Id` equals that project's `tProjects.Id`. Clearing the flag on those rows restores them. This has not been done on any database; `myps_db_dev_200` carries only rows this investigation created and deleted deliberately.

## For whoever meets this next

Two lessons, and the second is the one that generalises.

**A view that exposes both `Id` and `RevisionId` is a trap.** The names do not say which table each belongs to, both are integers, and a wrong pick compiles, runs, returns a plausible row count and reports success. Nothing fails loudly. If a column is going to be used as a foreign key into another table, confirm which table's identity it is before using it.

**A green toast is not evidence.** Every request in this sequence returned 200, including the ones that did the wrong thing and the ones that did nothing. The defect was invisible from the server side and from the logs, and it survived a first round of fixing because the first end-to-end assertion written for it was satisfied by a loading skeleton. What finally exposed it was an assertion that described the state a user would actually see, and that was checked against the broken build to confirm it could fail.
