// =============================================================================
// Dashboard — demo figures today, live figures when the endpoint is ready
// -----------------------------------------------------------------------------
// LIVE DB IS OFF (2026-09-13, maintainer's call). FE/src/pages/Dashboard/
// Dashboard.tsx exports LIVE_DB_ENABLED = false: the page opens on Demo Data,
// the Live DB control is rendered disabled, and no Dashboard/Summary request is
// issued at all. None of the live code was removed.
//
// WHY. On a production-sized database the endpoint returns every visible project
// uncapped (DashboardController: `Projects = projects`, no Take) — 56,722 rows,
// 33.5 MB and ~14 s per load on myps_db_dev_200, for a watchlist that renders a
// handful. Making it pageable is a backend change and separate work.
//
// SO THIS FILE HAS TWO HALVES:
//   1. The demo path, which is what ships today, asserted properly — including
//      the thing that matters most now, that the page queries NOTHING.
//   2. The live path, kept whole and skipped against the same flag, so it comes
//      back the day the flag does rather than being rewritten from memory.
//
// If you re-enable it, flip LIVE_DB_ENABLED in Dashboard.tsx and set the same
// constant below. Two notes the live half already paid for:
//   - Detect fetches with waitForResponse, never captureApiCalls: that helper
//     awaits response.json() inside its handler and swallows what it throws, and
//     on a 33.5 MB body that looks exactly like "the button did nothing".
//   - Read payloads with page.request, not the `request` fixture — the fixture
//     has its own cookie jar and answers 401.
// =============================================================================

import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { narrator } from './helpers/narrate';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

/** Must track LIVE_DB_ENABLED in FE/src/pages/Dashboard/Dashboard.tsx. */
const LIVE_DB_ENABLED = false;

const isSummary = (url: string) => url.includes('/api/Dashboard/Summary');

/** One Summary fetch, with headroom over the ~14 s seen on a full database. */
const FETCH_TIMEOUT = 60_000;

test.describe('Dashboard — demo data', () => {
  test('opens on demo data, queries nothing, and renders its panels', async ({ page }) => {
    const qa = narrator(page, { total: 6 });

    /*  Counted, never read — see the header. */
    const summaryCalls: number[] = [];
    page.on('response', (res) => {
      if (isSummary(res.url())) summaryCalls.push(res.status());
    });

    await login(page);
    await page.goto('/dashboard');

    await expect(page.getByText('DPWH Executive Command Center')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Demo data', { exact: true })).toBeVisible();
    await expect(page.getByText(/Demo data is for demonstration only/i)).toBeVisible();
    await qa.check('The dashboard opens on demo data and says so, in the badge and in the disclaimer.');

    /*  THE POINT OF THIS SPEC WHILE LIVE DB IS OFF. Demo mode is answered from
        Service.ts's getBenchmarkSummary without touching the network, and a
        regression that quietly restored the live call would put a 33.5 MB query
        behind every dashboard visit. Asserted after the page has settled, not
        at first paint. */
    await expect(page.getByRole('button', { name: /FY Infrastructure Budget/i })).toBeVisible();
    expect(summaryCalls, 'the dashboard must issue no Dashboard/Summary query while Live DB is off').toEqual([]);
    await qa.check('No Dashboard/Summary request was issued — the demo path is served entirely in the browser.');

    /*  The control is present and refuses to be used, rather than removed: the
        live path is deferred, not deleted, and the page says which. */
    const liveDb = page.getByRole('button', { name: 'Live DB' });
    await expect(liveDb).toBeVisible();
    await expect(liveDb).toBeDisabled();
    await qa.check('The Live DB control is shown disabled, so the deferral is visible rather than silent.');

    /*  Clicking it must change nothing — no mode flip, no query. */
    await liveDb.click({ force: true });
    await expect(page.getByText(/Demo data is for demonstration only/i)).toBeVisible();
    expect(summaryCalls, 'a forced click on the disabled control must not reach the API').toEqual([]);
    await qa.check('Forcing a click on it leaves the page on demo data and still issues no query.');

    // -------------------------------------------------------------------------
    // The panels themselves
    // -------------------------------------------------------------------------
    for (const cardName of [
      /FY Infrastructure Budget/i,
      /Active Portfolio Projects/i,
      /Lump Sum \(LS\) Itemized/i,
      /Publication Compliance/i,
    ]) {
      await expect(page.getByRole('button', { name: cardName })).toBeVisible();
    }
    await qa.check('All four headline KPI cards rendered.');

    /*  The activity filters are pills, not a select. The feed is allowed to be
        empty, so the assertion is that each control responds — not that rows
        survive it. */
    for (const label of ['Projects', 'Revisions', 'LS Wallet', 'All']) {
      const pill = page.getByRole('button', { name: label, exact: true });
      if (await pill.count()) await pill.first().click();
    }

    /*  And the three perspectives, which is where most of the page lives. */
    for (const tab of [/FY \d{4} DPWH Budget Allocation/, /Live Database Portfolio & Watchlist/, /Executive Overview & Analytics/]) {
      await page.getByRole('button', { name: tab }).click();
    }
    expect(summaryCalls, 'switching perspectives must not query either').toEqual([]);
    await qa.check('Every activity filter and all three perspective tabs were exercised, still without a query.');
  });
});

/*  THE LIVE PATH — whole, and switched off with the feature.

    Kept as a describe rather than deleted so that re-enabling LIVE_DB_ENABLED
    restores real coverage instead of an empty file. Everything here passed
    against myps_db_dev_200 except what the uncapped payload made impractical,
    which is why the fetch budget below is three and not sixteen. */
test.describe('Dashboard — live database', () => {
  test.skip(
    !LIVE_DB_ENABLED,
    'LIVE_DB_ENABLED is false in FE/src/pages/Dashboard/Dashboard.tsx — the dashboard ' +
      'serves demo data only until Dashboard/Summary is pageable. Flip both flags to restore.',
  );

  test.beforeEach(async ({ request }) => {
    const res = await request.post(`${API}/api/Dashboard/Summary`, { data: {}, failOnStatusCode: false });
    test.skip(
      res.status() === 404 || res.status() === 405,
      `Dashboard/Summary is not routable (${res.status()}). It is served by ` +
        'WebAPI/Controllers/Dashboard/DashboardController.cs — check WebAPI.csproj ' +
        'has not started excluding it again.',
    );
  });

  test('switches to the database, reconciles, filters and refreshes', async ({ page }) => {
    const qa = narrator(page, { total: 8 });

    const summaryCalls: number[] = [];
    page.on('response', (res) => {
      if (isSummary(res.url())) summaryCalls.push(res.status());
    });

    await login(page);
    await page.goto('/dashboard');
    await expect(page.getByText('Demo data', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(summaryCalls.length, 'demo mode must not call Dashboard/Summary').toBe(0);

    const liveLoad = page.waitForResponse((res) => isSummary(res.url()), { timeout: FETCH_TIMEOUT });
    await page.getByRole('button', { name: 'Live DB' }).click();
    expect((await liveLoad).status()).toBe(200);

    /*  page.request, NOT the `request` fixture: the fixture carries its own
        cookie jar and answers 401. This reads the payload once rather than
        pulling 33.5 MB back through the browser. */
    const direct = await page.request.post(`${API}/api/Dashboard/Summary`, { data: {}, timeout: FETCH_TIMEOUT });
    expect(direct.status()).toBe(200);
    const summary = await direct.json();

    expect(summary).toMatchObject({
      SelectedYear: expect.any(Number),
      AvailableYears: expect.any(Array),
      Kpis: expect.any(Object),
      AnnualTrend: expect.any(Array),
      BudgetBreakdown: expect.any(Array),
      Statuses: expect.any(Array),
      Islands: expect.any(Array),
      Projects: expect.any(Array),
      Activities: expect.any(Array),
    });
    expect(
      summary.AvailableYears.every((year: number) => Number.isInteger(year) && year >= 2000 && year <= 2200),
    ).toBe(true);
    await qa.check(
      `The authenticated API returned ${summary.Kpis.ActiveProjects} project(s) for FY ${summary.SelectedYear}.`,
    );

    await expect(page.getByText('Database data', { exact: true })).toBeVisible();
    await expect(page.getByText(/Demo data is for demonstration only/i)).toHaveCount(0);
    await qa.check('The live-data badge replaced the demo badge and the demo disclaimer is gone.');

    for (const project of summary.Projects) {
      expect(project.Region, `${project.ProjectId} exposed a raw region key`).not.toMatch(/^OI\d+$/i);
      expect(project.ImplementingOffice, `${project.ProjectId} exposed a raw office key`).not.toMatch(/^OI\d+$/i);
      expect(project.FundingSource, `${project.ProjectId} exposed revision provenance as funding`)
        .not.toMatch(/^(Base|Revision)$/i);
      expect(['Luzon', 'Visayas', 'Mindanao', 'Unassigned']).toContain(project.Island);
    }
    await qa.check('Every returned project carries resolved names rather than raw lookup keys.');

    const sum = (rows: Array<Record<string, number>>, key: string) =>
      rows.reduce((total, item) => total + item[key], 0);

    expect(sum(summary.Statuses, 'Count')).toBe(summary.Kpis.ActiveProjects);
    expect(sum(summary.Islands, 'ProjectCount')).toBe(summary.Kpis.ActiveProjects);
    expect(sum(summary.Islands, 'Budget')).toBeCloseTo(summary.Kpis.TotalBudget, 2);
    expect(sum(summary.BudgetBreakdown, 'ProjectCount')).toBe(summary.Kpis.ActiveProjects);
    expect(sum(summary.BudgetBreakdown, 'Budget')).toBeCloseTo(summary.Kpis.TotalBudget, 2);
    expect(summary.Kpis.PublicationRate).toBe(
      summary.Kpis.ActiveProjects === 0
        ? 0
        : Math.round((summary.Kpis.PublishedProjects / summary.Kpis.ActiveProjects) * 1000) / 10,
    );
    await qa.check('KPI reconciliation passed: stage counts, island counts, island budgets and publication rate all agree with the underlying rows.');

    expect(summary.AnnualTrend.map((item: { Year: number }) => item.Year).sort()).toEqual(
      [...summary.AvailableYears].sort(),
    );
    await qa.check('The annual comparison contains every persisted fiscal year.');

    /*  ONE year, not all of them: at ~14 s a fetch, sixteen cannot fit the
        120 s budget. Deliberately not the selected one, so a control that does
        nothing cannot pass by coincidence. */
    const otherYear = (summary.AvailableYears as number[]).find((y) => y !== summary.SelectedYear);
    if (otherYear !== undefined) {
      const yearLoad = page.waitForResponse((res) => isSummary(res.url()), { timeout: FETCH_TIMEOUT });
      await page.getByRole('button', { name: String(otherYear), exact: true }).click();
      const yearResponse = await yearLoad;
      expect(yearResponse.status()).toBe(200);
      expect(yearResponse.request().postDataJSON()).toEqual({ Year: otherYear });
      await qa.check(`Selecting FY ${otherYear} sent that year to the database and the answer came back for it.`);
    } else {
      await qa.say('This database holds a single fiscal year, so there is no second year to switch to.');
    }

    const refreshLoad = page.waitForResponse((res) => isSummary(res.url()), { timeout: FETCH_TIMEOUT });
    await page.getByTitle('Refresh dashboard').click();
    expect((await refreshLoad).status()).toBe(200);
    await qa.check('Refresh issued a new authenticated summary request and completed successfully.');

    await page.getByRole('button', { name: 'Demo Data' }).click();
    await expect(page.getByText(/Demo data is for demonstration only/i)).toBeVisible();
    await qa.check('Returning to demo mode restores the disclaimer, so the two sources are never confusable.');
  });
});
