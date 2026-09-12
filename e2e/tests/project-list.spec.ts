// =============================================================================
// project-list.spec.ts — /projects loads, and the rows come from the server.
//
// TWO THINGS THIS USED TO GET WRONG, both worth keeping in mind for any spec
// written against this app:
//
//   1. `page.locator('text=Projects')` is a SUBSTRING match, and this page
//      necessarily contains that word three times — the sidebar link, the
//      breadcrumb, and the card heading, all rendered unconditionally. Under
//      strict mode that is not a flaky selector, it is a permanent failure, and
//      it meant this spec had never actually run past its first assertion.
//
//   2. `expect(apiCalls.length).toBeGreaterThan(0)` counts requests that
//      FINISHED, not requests that SUCCEEDED. A 400 satisfies it. That is how a
//      bug which emptied this entire list — ProjectLatest declaring a Lump Sum
//      Project's absent Region non-nullable, so EF threw while materialising the
//      view — could sit behind a passing spec. The status is asserted below for
//      that reason.
// =============================================================================

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls, type ApiCallDetails } from './helpers/networkCapture';

test.describe('Project list page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load project list and capture network API calls', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Project/showprojects']);

    await page.goto('/projects');

    /*  By ROLE, so each locator resolves to exactly one element. The heading is
        the card's own <h3>, distinct from the breadcrumb span and the nav link
        that share its text. */
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Project' })).toBeVisible();

    await expect.poll(() => apiCalls.length, { timeout: 30_000 }).toBeGreaterThan(0);

    const call = apiCalls.at(-1) as ApiCallDetails;
    expect(call.status, JSON.stringify(call.responseBody)).toBe(200);

    /*  The list is non-empty on any restore of this database, and a Lump Sum
        Project among the rows is the case that used to take the whole page
        down — so "some rows came back" is the assertion that has teeth, not
        "a request happened". */
    const rows = (call.responseBody?.lists ?? []) as any[];
    expect(rows.length, 'projects returned by the server').toBeGreaterThan(0);

    // And the screen shows what the server sent.
    await expect(page.getByText(rows[0].ProjectId, { exact: true }).first()).toBeVisible();

    test.info().attach('project-list-api-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });
  });
});
