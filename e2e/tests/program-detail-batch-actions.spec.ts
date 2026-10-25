// =============================================================================
// program-detail-batch-actions.spec.ts — Program Details › Batch Actions act on
// the table the user is looking at.
//
// WHAT THIS PINS. Two independent defects made the menu look dead, and this
// file failed against each of them in turn:
//
//   1. BatchDelete fed vProjectLatest.Id (a tProjects identity) to
//      tProjectRevisions.Id (a revision identity). It matched 0 of 109,790
//      listed rows, so a deleted project never left the table — and on 97% of
//      projects it flagged ANOTHER project's revision instead, answering 200
//      either way. This test found it: it kept failing after defect 2 was fixed.
//   2. Since b11ed1b4 (2026-08-08) the projects table is fetched separately from
//      the program header (usePagination + ShowProjectsInProgram), and
//      BatchActionsDropdown's onRefresh only reloaded the header, so the screen
//      kept the pre-action rows and flags until a full page reload.
//
// See documents/docs/engineering/MYPS_PROGRAM_DETAIL_BATCH_ACTIONS_RCA.md.
//
// So every assertion here is deliberately made WITHOUT reloading the page. A
// spec that navigated again would pass against the broken build.
//
// WHY THE FIXTURE PROGRAM. The publish actions are gated on the program being
// Approved (ProgramDetail.tsx: isActive && isTerminalStage && Status === 1), and
// approving a program at GAA-R runs dbo.pRecomputeProjectPublishable over every
// project it holds, which can DEMOTE real projects. approvedProgramFixture.ts
// exists for exactly this and is the only program the suite may approve — see
// e2e/CLAUDE.md, "The approval fixture program".
//
// DO NOT ADD login() TO THIS FILE. apiLogin() signs the BROWSER in, not just an
// API client — page.request shares the context's cookie jar — so by the time the
// fixtures are built the session already exists. login() then navigates to
// /login, the app redirects an authenticated visitor straight to /dashboard, and
// the fill() on a username box that never renders hangs until the test budget
// runs out. It fails as a 120s timeout with the dashboard in the screenshot,
// which looks nothing like its cause.
//
// WHY THE Publishable CELL IS NOT ASSERTED. Every Lump Sum parent on this
// database is already IsPublishable = 0 (123 of 123), so Restrict Publishing
// cannot produce a VISIBLE change on one — and Allow Publishing could not
// restore it either, because pAllowProjectPublishing only ever GRANTS, and only
// to a project that satisfies all seven GAA-R rules. Asserting a cell flip would
// therefore be asserting the fixture's data, not the refresh. The publish path
// is pinned at the network layer instead: the table must be re-queried after the
// batch call. Batch Delete carries the visible half — a deleted row disappears.
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { captureApiCalls } from './helpers/networkCapture';
import { apiLogin, post, provisionLumpSum, type ProvisionedLumpSum } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, batchRestore, ensureCrossStageFixture, projectsAt } from './helpers/crossStageFixture';
import { withFixtureProgram, type FixtureProgram } from './helpers/approvedProgramFixture';

/** ProgramDetail's route param is `${ProgramPK}:${StageName}` — see Program.tsx's handleViewDetails. */
const detailUrl = (program: FixtureProgram) =>
  `/programs/programdetails/${program.ProgramPK}:${program.StageName}`;

/** The row for one ProjectId in the projects table, by its first cell. */
const projectRow = (page: Page, projectId: string) =>
  page.locator('tbody tr').filter({ has: page.getByRole('button', { name: projectId, exact: true }) });

/**
 * Open the Batch Actions menu and pick one item.
 *
 * `exact`, because the menu item and the dialog button that follows it share
 * their wording ("Restrict Publishing"), as does the confirm button that
 * follows both ("Yes, Restrict Publishing") under a substring match.
 */
const openBatchAction = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'Batch Actions' }).click();
  await page.getByRole('button', { name: item, exact: true }).click();
};

/**
 * The projects table's state for one ProjectId, read in ONE evaluate(): 'loading' while
 * ProgramDetail shows its skeleton, else 'present' / 'absent'. See the first test for why the
 * page must be sampled atomically and never through '.animate-pulse'.
 */
const rowState = (page: Page, projectId: string) =>
  page.evaluate((id) => {
    const rendered = Array.from(document.querySelectorAll('h2')).some((h) => h.textContent?.trim() === 'Projects');
    if (!rendered) return 'loading';
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    return rows.some((r) => r.textContent?.includes(id)) ? 'present' : 'absent';
  }, projectId);

test.describe('Program Details — batch actions', () => {
  test.describe.configure({ mode: 'serial' });

  /*  S01-TC008-P001 (issue #376, comment by ken 2026-10-23): "Batch Restore button MISSING from
      in Actions dropdown button in Program Details Page". Restore only undoes a SOFT delete, so
      this uses the cross-stage fixture program (crossStageFixture.ts): its one project is live
      at BP and NEP, so deleting it at NEP is soft. The delete is set up through the API; the
      restore is driven through the menu. The finally puts the fixture back if the UI did not,
      so batch-delete-restore-cross-stage.spec.ts finds it as it expects. */
  test('S01-TC008-P001: Batch Restore is in the Batch Actions menu and brings a deleted row back without a reload', async ({ page }) => {
    await apiLogin(page);
    const { program, projectIdAtNEP } = await ensureCrossStageFixture(page);

    const del = await batchDelete(page, program, projectIdAtNEP);
    expect(del.status, `BatchDelete (setup) failed: ${JSON.stringify(del.body)}`).toBe(200);

    try {
      await page.goto(`/programs/programdetails/${program.ProgramPK}:${program.StageName}`); // already authenticated
      await expect
        .poll(() => rowState(page, projectIdAtNEP), { timeout: 60_000, message: 'the deleted project is not listed before the restore' })
        .toBe('absent');

      await openBatchAction(page, 'Batch Restore');
      await page.locator('textarea#restoreProjectIds').fill(projectIdAtNEP);
      await page.getByRole('button', { name: 'Restore Projects', exact: true }).click();
      await page.getByRole('button', { name: 'Yes, Restore Projects', exact: true }).click();

      // The toast is the API's own Message, which says how many came back.
      await expect(page.getByText('1 project(s) restored to their original stage.')).toBeVisible();

      // No goto, no reload: the row must come back because the handler re-queried the table.
      await expect
        .poll(() => rowState(page, projectIdAtNEP), { timeout: 60_000, message: 'the restored row is back once the page has re-rendered, with no reload' })
        .toBe('present');
    } finally {
      if ((await projectsAt(page, program, 'NEP')).length === 0) {
        await batchRestore(page, program, projectIdAtNEP);
      }
    }
  });

  test('batch delete removes the row from the table without a reload', async ({ page }) => {
    await apiLogin(page);

    await withFixtureProgram(page, async ({ program }) => {
      /*  AN ORDINARY PROJECT, NOT A LUMP SUM ONE (2026-10-15). Batch Delete now
          refuses Lump Sum parents and children: only the Lump Sum module returns a
          child's allocation to its parent (documents/plans/project-deletion-single-
          rule.md). Added while the program is Working, at its own stage, so it is on
          its first stage entry: dbo.fProjectDeletionTier rates it Hard and the batch
          delete removes it outright — which IS its cleanup. */
      const target = {
        projectId: await addOrdinaryProject(
          page,
          { ProgramPK: program.ProgramPK, ProgramId: program.ProgramId, Name: program.Name, StageName: program.StageName },
          `batch actions delete target ${Date.now()}`,
          program.StageName,
        ),
      };

      await page.goto(detailUrl(program)); // already authenticated — see the header

      const row = projectRow(page, target.projectId);
      await expect(row, 'the provisioned project is listed before the delete').toBeVisible();

      await openBatchAction(page, 'Batch Delete');
      await page.locator('textarea#projectIds').fill(target.projectId);
      await page.getByRole('button', { name: 'Delete Projects', exact: true }).click();

      /*  2026-10-15: the confirm dialog shows the SERVER's preview before asking for DELETE.
          A first-stage project is listed as permanently deleted, and the warning says so. */
      await expect(page.getByText('Permanently deleted (first stage entry) (1)')).toBeVisible();
      await expect(page.getByText('You are about to permanently delete 1 project(s). This cannot be undone.')).toBeVisible();

      /*  The confirm dialog asks for the word, then repeats the action in its own
          words. `exact`, because placeholder matching is case-INSENSITIVE and a
          substring by default, so a bare 'DELETE' also matches the ID textarea
          behind it ("Enter project IDs to delete..."). */
      await page.getByPlaceholder('DELETE', { exact: true }).fill('DELETE');
      await page.getByRole('button', { name: 'Yes, Delete Projects', exact: true }).click();

      /*  THE ASSERTION. No goto, no reload: the row must leave the table on its
          own, because the batch handler re-queried the list.

          WHY ONE evaluate() AND NOT A PAIR OF LOCATOR ASSERTIONS.
          onLoadingChange flips isLoading, and ProgramDetail returns a skeleton
          for the WHOLE page while the request is in flight — so for a second or
          two there is no table at all, however broken the handler is. Two forms
          of this assertion were caught passing against the PRE-FIX build:
            - a bare toBeHidden() on the row, satisfied outright by the skeleton;
            - "heading visible AND row count 0" as two sequential awaits, which
              sample two different instants and straddle the skeleton's edge.
          Both were verified green with the fix reverted, which is how they were
          found. So the page is read ONCE, atomically, and reports `loading`
          explicitly — a state that can never be mistaken for `absent`.

          "Rendered" is the Projects <h2>, which exists only when ProgramDetail
          is past its skeleton. Do NOT test for '.animate-pulse' instead: the
          GLOBAL Preloader carries that class too and stays in the DOM, so the
          page reads as loading for ever and the poll times out whether the build
          is fixed or not — which it duly did, on both. */
      await expect
        .poll(
          () =>
            page.evaluate((projectId) => {
              const rendered = Array.from(document.querySelectorAll('h2')).some(
                (h) => h.textContent?.trim() === 'Projects',
              );
              if (!rendered) return 'loading';
              const rows = Array.from(document.querySelectorAll('tbody tr'));
              return rows.some((r) => r.textContent?.includes(projectId)) ? 'present' : 'absent';
            }, target.projectId),
          {
            timeout: 60_000,
            message: 'the deleted row is gone once the page has re-rendered, with no reload',
          },
        )
        .toBe('absent');
    });
  });

  test('the publish actions appear only once the program is Approved, and re-query the table', async ({ page }) => {
    await apiLogin(page);

    await withFixtureProgram(page, async ({ program, approve }) => {
      const parent = await provisionLumpSum(
        page,
        1_000_000,
        'batch actions publish target',
        { programPK: program.ProgramPK },
      );

      await page.goto(detailUrl(program)); // already authenticated — see the header
      await expect(projectRow(page, parent.projectId)).toBeVisible();

      /*  Working: Batch Delete is offered, the two publish actions are not.
          showPublishActions needs Status === Approved. */
      await page.getByRole('button', { name: 'Batch Actions' }).click();
      await expect(page.getByRole('button', { name: 'Batch Delete', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Restrict Publishing', exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Allow Publishing', exact: true })).toBeHidden();
      await page.keyboard.press('Escape');

      await approve();
      await page.goto(detailUrl(program)); // re-read the program: its Status changed server-side

      const calls = captureApiCalls(page, [
        '/api/Program/BatchRestrictPublish',
        '/api/Program/ShowProjectsInProgram',
      ]);

      await openBatchAction(page, 'Restrict Publishing');
      await page.locator('textarea#projectIds').fill(parent.projectId);
      await page.getByRole('button', { name: 'Restrict Publishing', exact: true }).click();
      await page.getByRole('button', { name: 'Yes, Restrict Publishing', exact: true }).click();

      /*  The server accepted it, and the table was re-queried AFTERWARDS. The
          ordering is the point: before the fix the only ShowProjectsInProgram
          calls were the ones from page load, and none followed the batch call. */
      await expect
        .poll(() => calls.filter((c) => c.url.includes('BatchRestrictPublish')).length, {
          timeout: 30_000,
        })
        .toBe(1);

      const batchCall = calls.find((c) => c.url.includes('BatchRestrictPublish'))!;
      expect(batchCall.status, JSON.stringify(batchCall.responseBody)).toBe(200);

      const batchIndex = calls.indexOf(batchCall);
      await expect
        .poll(
          () =>
            calls
              .slice(batchIndex + 1)
              .filter((c) => c.url.includes('ShowProjectsInProgram') && c.status === 200).length,
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);

      test.info().attach('batch-restrict-api-calls', {
        body: JSON.stringify(calls, null, 2),
        contentType: 'application/json',
      });

      /*  Tidy up while the program is still Approved only in this block —
          withFixtureProgram restores Working in its own finally, and the sweeper
          removes the parent by its (e2e …) marker. */
    });
  });

  /*  PAGE POSITION AFTER A BATCH ACTION (AC9).

      The two tests above run on a one-page table, where "stay on the current
      page" and "go back to page 1" are the same request — so reverting
      refreshProjects to always reset would still pass them. This one needs a
      SECOND page: the table pages at 10 (ProgramDetail's usePagination limit),
      so the fixture program holds 11 projects.

      The page is read from the REQUEST, not the DOM: pagination.refresh() on
      page 2 sends Navigation.Page (4) with page 2, applyFilters sends
      Navigation.First (0) with page 1, and those are the only two outcomes.
      Nav values mirror usePagination.ts. */
  test('flag-only actions keep the current page; a delete returns to page 1', async ({ page }) => {
    test.setTimeout(300_000); // 11 provisions + approval + two batch round-trips

    await apiLogin(page);

    await withFixtureProgram(page, async ({ program, approve, restore }) => {
      /*  Ordinary projects, not Lump Sum parents (2026-10-15): Batch Delete refuses
          Lump Sum rows now, so a parent on page 2 would answer 400 and the table
          would never be re-queried. Each is on its first stage entry, so the
          finally below hard-deletes whatever the test left — the fixture program is
          never swept, and ordinary projects carry no sweeper marker. */
      const PAGE_SIZE = 10;
      const added: string[] = [];
      for (let i = 0; i <= PAGE_SIZE; i++) {
        added.push(await addOrdinaryProject(
          page,
          { ProgramPK: program.ProgramPK, ProgramId: program.ProgramId, Name: program.Name, StageName: program.StageName },
          `batch actions paging ${i} ${Date.now()}`,
          program.StageName,
        ));
      }

      try {
      await approve();
      await page.goto(detailUrl(program));

      /*  Go to page 2 and take whichever project the table put there — the
          list's sort order is the server's business, not this test's. */
      // The pager labels its buttons `Page ${n}` (tailwindui/pagination.tsx), so the
      // accessible name is "Page 2", not "2" — a bare '2' never matches and the click
      // waits out the whole test budget on page 1.
      await page.getByRole('button', { name: 'Page 2', exact: true }).click();
      const firstRowButton = page.locator('tbody tr').first().getByRole('button').first();
      await expect(firstRowButton).toBeVisible();
      const pageTwoProjectId = (await firstRowButton.innerText()).trim();
      expect(pageTwoProjectId, 'page 2 lists a project').not.toBe('');

      const calls = captureApiCalls(page, [
        '/api/Program/BatchRestrictPublish',
        '/api/Program/BatchDelete',
        '/api/Program/ShowProjectsInProgram',
      ]);

      /** The first table query that finished after the named batch call did. */
      const tableQueryAfter = async (batchUrl: string) => {
        let found: (typeof calls)[number] | undefined;
        await expect
          .poll(
            () => {
              const batchIndex = calls.findIndex((c) => c.url.includes(batchUrl));
              if (batchIndex < 0) return false;
              found = calls
                .slice(batchIndex + 1)
                .find((c) => c.url.includes('ShowProjectsInProgram') && c.status === 200);
              return !!found;
            },
            { timeout: 30_000, message: `the table is re-queried after ${batchUrl}` },
          )
          .toBe(true);
        return found!.requestBody;
      };

      // Flag-only action: the user must stay on page 2.
      await openBatchAction(page, 'Restrict Publishing');
      await page.locator('textarea#projectIds').fill(pageTwoProjectId);
      await page.getByRole('button', { name: 'Restrict Publishing', exact: true }).click();
      await page.getByRole('button', { name: 'Yes, Restrict Publishing', exact: true }).click();

      const afterRestrict = await tableQueryAfter('BatchRestrictPublish');
      expect(afterRestrict.page, 'Restrict Publishing re-reads the page the user is on').toBe(2);
      expect(afterRestrict.Navigation, 'by page cursor, not a reset to the first page').toBe(4);

      /*  An Approved program refuses every delete (2026-10-15), so set it back to Working
          before the delete half. Restrict Publishing above needed it Approved; the delete
          below is about paging, not about approval. */
      await restore();

      // Delete changes which rows exist: the cached cursors are stale, so back to page 1.
      await openBatchAction(page, 'Batch Delete');
      await page.locator('textarea#projectIds').fill(pageTwoProjectId);
      await page.getByRole('button', { name: 'Delete Projects', exact: true }).click();
      await page.getByPlaceholder('DELETE', { exact: true }).fill('DELETE');
      await page.getByRole('button', { name: 'Yes, Delete Projects', exact: true }).click();

      const afterDelete = await tableQueryAfter('BatchDelete');
      expect(afterDelete.page, 'Batch Delete returns to page 1').toBe(1);
      expect(afterDelete.Navigation, 'as a fresh first-page query').toBe(0);

      test.info().attach('paging-api-calls', {
        body: JSON.stringify(calls, null, 2),
        contentType: 'application/json',
      });
      } finally {
        // First-stage ordinary projects: Batch Delete removes them outright.
        await post(page, '/api/Program/BatchDelete', { ProgramId: program.ProgramId, ProjectIds: added.join(';') });
      }
    });
  });
});
