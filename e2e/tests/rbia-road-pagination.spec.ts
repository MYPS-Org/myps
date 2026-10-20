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
// DATA: needs at least MIN_ROADS future roads (three pages of PAGE_SIZE, so a
// "Page 3" button exists). The spec asks the server for the total on the first
// request and skips, with the count, on a database that has fewer — rather than
// failing in a way that looks like a pagination bug.
//
// WIRE READS: captureApiCalls records a call only after its response body has
// been read, which can be AFTER the UI has already rendered that response. So
// every read of `calls` goes through nextCall()/expect.poll — never a bare
// `calls.at(-1)` straight after a UI assertion.
//
// PREREQUISITE — Vite must proxy to the LOCAL API, or this drives a browser
// against a remote database and proves nothing about this fix:
//   cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls, type ApiCallDetails } from './helpers/networkCapture';

const SHOW_ROADS = '/futureInfra/ShowFutureRoads';

/** roadFiltersAtom's limit — one page of the Roads list. */
const PAGE_SIZE = 20;
/** Enough rows for a third page, which the "Page 3" walk and revisit need. */
const MIN_ROADS = PAGE_SIZE * 2 + 1;

// Matches DBHelper.Models.Enums.PaginationNavigation (BE serializes enums as ints).
const Nav = { First: 0, Previous: 1, Next: 2, Last: 3, Page: 4 } as const;

/** Reads the RoadId badge out of each row's first cell — unique per row, unlike a name or classification. */
const roadIds = (page: Page) =>
  page.locator('table tbody tr td:first-child span').allTextContents();

/**
 * Waits for, then returns, the first call recorded at or after index `from` that
 * matches `pred`. Snapshot `from = calls.length` BEFORE the click that sends it.
 */
async function nextCall(
  calls: ApiCallDetails[],
  from: number,
  pred: (c: ApiCallDetails) => boolean,
  what: string,
): Promise<ApiCallDetails> {
  await expect.poll(() => calls.slice(from).some(pred), { message: `waiting for ${what}` }).toBe(true);
  return calls.slice(from).find(pred) as ApiCallDetails;
}

const withNav = (nav: number) => (c: ApiCallDetails) => c.requestBody?.Navigation === nav;

/** Opens the Roads list and returns its first (mount-time) call; skips when the database is too small. */
async function openRoads(page: Page, calls: ApiCallDetails[]): Promise<ApiCallDetails> {
  await page.goto('/infrastructure-management');
  const first = await nextCall(calls, 0, () => true, 'the mount-time ShowFutureRoads call');
  expect(first.status, JSON.stringify(first.responseBody)).toBe(200);
  const total = Number(first.responseBody?.total ?? 0);
  test.skip(total < MIN_ROADS, `needs at least ${MIN_ROADS} future roads for three pages; this database has ${total}`);
  return first;
}

test.describe('RBIA Roads list — pagination', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Next/Previous move between real, distinct pages — not page 1 forever', async ({ page }) => {
    const calls = captureApiCalls(page, [SHOW_ROADS]);
    const page1Call = await openRoads(page, calls);

    // A full first page, and the pager's boundary controls agree we're on it.
    await expect(page.getByRole('heading', { name: 'Roads' })).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(PAGE_SIZE);
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'First page' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    const page1Ids = await roadIds(page);
    expect(page1Ids).toHaveLength(PAGE_SIZE);

    const beforeNext = calls.length;
    await page.getByRole('button', { name: 'Next page' }).click();

    // The pager moved. Before the fix the server echoed page 1 and this stayed on 1.
    await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');

    // And so did the rows — no row from page 1 survives onto page 2.
    await expect.poll(async () => {
      const ids = await roadIds(page);
      return ids.length === PAGE_SIZE && ids.every((id) => !page1Ids.includes(id));
    }).toBe(true);

    // The wire says what the screen shows: a keyset hop using page 1's own cursor,
    // not another bare page number that the BE would silently re-interpret as First.
    const nextReq = await nextCall(calls, beforeNext, withNav(Nav.Next), 'the Next request');
    expect(Number(nextReq.requestBody?.NextFilteredId), JSON.stringify(nextReq.requestBody)).toBe(
      Number(page1Call.responseBody?.NextFilteredId),
    );

    const beforePrevious = calls.length;
    await page.getByRole('button', { name: 'Previous page' }).click();

    // Back on page 1, with the exact same rows it had before.
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect.poll(roadIds.bind(null, page)).toEqual(page1Ids);
    await nextCall(calls, beforePrevious, withNav(Nav.Previous), 'the Previous request');

    test.info().attach('rbia-road-pagination-next-previous', {
      body: JSON.stringify(calls, null, 2),
      contentType: 'application/json',
    });
  });

  test('First/Last jump directly; a re-visited page jumps as a single keyset "Page" request', async ({ page }) => {
    const calls = captureApiCalls(page, [SHOW_ROADS]);
    await openRoads(page, calls);
    await expect(page.locator('table tbody tr')).toHaveCount(PAGE_SIZE);

    // Last is a one-shot jump — the BE derives it from the total count, no cursor needed.
    const beforeLast = calls.length;
    await page.getByRole('button', { name: 'Last page' }).click();
    const lastReq = await nextCall(calls, beforeLast, withNav(Nav.Last), 'the Last request');
    const lastPageNumber = lastReq.responseBody?.page;
    expect(lastPageNumber, 'server-reported last page').toBeGreaterThan(1);
    await expect(page.getByRole('button', { name: `Page ${lastPageNumber}`, exact: true })).toHaveAttribute('aria-current', 'page');

    // On the last page, Next is disabled — the BE's own HasNext, not a page-number guess.
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();

    const beforeFirst = calls.length;
    await page.getByRole('button', { name: 'First page' }).click();
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    await nextCall(calls, beforeFirst, withNav(Nav.First), 'the First request');

    // Visit page 3 for the first time — its cursor isn't cached yet, so usePagination
    // walks there hop-by-hop (Next, Next) rather than sending a single "Page" request.
    // Only the final landing is rendered; intermediate hops are not asserted here.
    const beforeWalk = calls.length;
    await page.getByRole('button', { name: 'Page 3', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Page 3', exact: true })).toHaveAttribute('aria-current', 'page');
    await nextCall(calls, beforeWalk, (c) => c.responseBody?.page === 3, 'the walk landing on page 3');

    const beforeBack = calls.length;
    await page.getByRole('button', { name: 'First page' }).click();
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
    // Wait for page 1's call to be recorded, so it can't land inside the revisit's window below.
    await nextCall(calls, beforeBack, withNav(Nav.First), 'the second First request');

    // Page 3 again: now cached, so this is ONE request, carrying Navigation: Page + its PageCursorId.
    const beforeRevisit = calls.length;
    await page.getByRole('button', { name: 'Page 3', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Page 3', exact: true })).toHaveAttribute('aria-current', 'page');
    const revisit = await nextCall(calls, beforeRevisit, (c) => c.responseBody?.page === 3, 'the revisit landing on page 3');
    const revisitWindow = calls.slice(beforeRevisit);
    expect(revisitWindow, 'a cached page should be a single request, not a walk').toHaveLength(1);
    expect(revisit.requestBody?.Navigation, JSON.stringify(revisit.requestBody)).toBe(Nav.Page);
    expect(revisit.requestBody?.PageCursorId).not.toBeNull();
    expect(revisit.requestBody?.PageCursorId).not.toBeUndefined();

    test.info().attach('rbia-road-pagination-first-last-page', {
      body: JSON.stringify(calls, null, 2),
      contentType: 'application/json',
    });
  });
});
