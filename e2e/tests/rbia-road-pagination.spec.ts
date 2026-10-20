// =============================================================================
// rbia-road-pagination.spec.ts — the RBIA Roads list pager actually moves.
//
// THE BUG: the BE's ShowFutureRoads endpoint pages by KEYSET only
// (Helpers.QueryPaginationExtensions.FilterDataCursor, via EnumPagination<T>):
// every request must carry a Navigation mode (First/Previous/Next/Last/Page)
// plus that mode's cursor, or the DTO default (Navigation.First) silently wins
// and the BE answers page 1 again. useRoadData.ts sent a bare `{ page, limit,
// filters }` with no Navigation field at all, so every click — a page number,
// Next, Last — re-rendered the same first page forever. This is the exact
// defect `ls-module-ui-walkthrough`'s pager test caught for Lump Sum; RBIA's
// Road list had the same unfixed bug in a different hook.
//
// This asserts the screen, the wire, and the server all agree, for both the
// keyset hops (Next/Previous) and the one-shot jumps (First/Last), plus the
// numbered "Page" jump once its cursor has actually been cached.
//
// PREREQUISITE — Vite must proxy to the LOCAL API, or this drives a browser
// against a remote database and proves nothing about this fix:
//   cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort
// =============================================================================

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls, type ApiCallDetails } from './helpers/networkCapture';

const SHOW_ROADS = '/futureInfra/ShowFutureRoads';

/** Reads the RoadId badge out of each row's first cell — unique per row, unlike a name or classification. */
const roadIds = (page: import('@playwright/test').Page) =>
  page.locator('table tbody tr td:first-child span').allTextContents();

test.describe('RBIA Roads list — pagination', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Next/Previous move between real, distinct pages — not page 1 forever', async ({ page }) => {
    const calls = captureApiCalls(page, [SHOW_ROADS]);

    await page.goto('/infrastructure-management');
    await expect(page.getByRole('heading', { name: 'Roads' })).toBeVisible();

    // A full first page, and the pager's boundary controls agree we're on it.
    await expect(page.locator('table tbody tr')).toHaveCount(20);
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'First page' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await expect.poll(() => calls.length).toBeGreaterThan(0);
    const page1Call = calls[0] as ApiCallDetails;
    expect(page1Call.status, JSON.stringify(page1Call.responseBody)).toBe(200);
    const page1Ids = await roadIds(page);
    expect(page1Ids).toHaveLength(20);

    await page.getByRole('button', { name: 'Next page' }).click();

    // The pager moved. Before the fix the server echoed page 1 and this stayed on 1.
    await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');

    // And so did the rows — no row from page 1 survives onto page 2.
    await expect.poll(async () => {
      const ids = await roadIds(page);
      return ids.length === 20 && ids.every((id) => !page1Ids.includes(id));
    }).toBe(true);

    // The wire says what the screen shows: a keyset hop using page 1's own cursor,
    // not another bare page number that the BE would silently re-interpret as First.
    const nextCall = calls.at(-1) as ApiCallDetails;
    expect(nextCall.requestBody?.Navigation, JSON.stringify(nextCall.requestBody)).toBe(2); // Nav.Next
    expect(Number(nextCall.requestBody?.NextFilteredId)).toBe(Number(page1Call.responseBody?.NextFilteredId));

    await page.getByRole('button', { name: 'Previous page' }).click();

    // Back on page 1, with the exact same rows it had before.
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect.poll(roadIds.bind(null, page)).toEqual(page1Ids);
    const prevCall = calls.at(-1) as ApiCallDetails;
    expect(prevCall.requestBody?.Navigation, JSON.stringify(prevCall.requestBody)).toBe(1); // Nav.Previous

    test.info().attach('rbia-road-pagination-next-previous', {
      body: JSON.stringify(calls, null, 2),
      contentType: 'application/json',
    });
  });

  test('First/Last jump directly; a re-visited page jumps as a single keyset "Page" request', async ({ page }) => {
    const calls = captureApiCalls(page, [SHOW_ROADS]);

    await page.goto('/infrastructure-management');
    await expect(page.locator('table tbody tr')).toHaveCount(20);

    const lastPageButton = page.getByRole('button', { name: 'Last page' });
    await lastPageButton.click();

    // Last is a one-shot jump — the BE derives it from the total count, no cursor needed.
    await expect.poll(async () => {
      const current = page.locator('[aria-current="page"]');
      return (await current.textContent())?.trim();
    }).not.toBe('1');
    const lastCall = calls.at(-1) as ApiCallDetails;
    expect(lastCall.requestBody?.Navigation, JSON.stringify(lastCall.requestBody)).toBe(3); // Nav.Last
    const lastPageNumber = lastCall.responseBody?.page;
    expect(lastPageNumber, 'server-reported last page').toBeGreaterThan(1);
    await expect(page.getByRole('button', { name: `Page ${lastPageNumber}`, exact: true })).toHaveAttribute('aria-current', 'page');

    // On the last page, Next is disabled — the BE's own HasNext, not a page-number guess.
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await page.getByRole('button', { name: 'First page' }).click();
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    const firstCall = calls.at(-1) as ApiCallDetails;
    expect(firstCall.requestBody?.Navigation, JSON.stringify(firstCall.requestBody)).toBe(0); // Nav.First

    // Visit page 3 for the first time — its cursor isn't cached yet, so usePagination
    // walks there hop-by-hop (Next, Next) rather than sending a single "Page" request.
    // Only the final landing is rendered; intermediate hops are not asserted here.
    await page.getByRole('button', { name: 'Page 3', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Page 3', exact: true })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'First page' }).click();
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');

    // Page 3 again: now cached, so this is ONE request, carrying Navigation: Page + its PageCursorId.
    const callsBeforeRevisit = calls.length;
    await page.getByRole('button', { name: 'Page 3', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Page 3', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(calls.length - callsBeforeRevisit, 'a cached page should be a single request, not a walk').toBe(1);
    const revisitCall = calls.at(-1) as ApiCallDetails;
    expect(revisitCall.requestBody?.Navigation, JSON.stringify(revisitCall.requestBody)).toBe(4); // Nav.Page
    expect(revisitCall.requestBody?.PageCursorId).not.toBeNull();
    expect(revisitCall.requestBody?.PageCursorId).not.toBeUndefined();

    test.info().attach('rbia-road-pagination-first-last-page', {
      body: JSON.stringify(calls, null, 2),
      contentType: 'application/json',
    });
  });
});
