import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls, type ApiCallDetails } from './helpers/networkCapture';

// Dashboard/Summary (the old monolithic endpoint) still exists on the backend for
// backward-compatibility, but the frontend now calls seven split endpoints instead — one per
// section — loaded lazily as each section scrolls into view rather than all at once. See
// documents/plans/dashboard-modular-data-loading.md.
//
// Replaces dashboard-real-data.narrated.spec.ts, which dev-trunk rewrote on 2026-09-13 around
// Live DB being switched off: its live half asserted Dashboard/Summary calls the page no longer
// makes, and its demo half clicked perspective tabs that no longer exist. Its central guarantee
// — Demo Data issues no dashboard query at all — is kept below, and so is its shape: the live
// tests skip against a constant that tracks the FE switch.

/** Must track LIVE_DB_ENABLED in FE/src/pages/Dashboard/Dashboard.tsx. Flip both together. */
const LIVE_DB_ENABLED = true;

const DASHBOARD_ENDPOINTS = [
  'Kpis',
  'Trend',
  'BudgetBreakdown',
  'Statuses',
  'RegionalBreakdown',
  'Projects',
  'Revisions',
] as const;

/** Programs is requested only by a KPI detail, so it is not among the sections above. */
function callsFor(apiCalls: ApiCallDetails[], endpoint: (typeof DASHBOARD_ENDPOINTS)[number] | 'Programs') {
  return apiCalls.filter((call) => call.url.endsWith(`/Dashboard/${endpoint}`));
}

async function openDashboardOnLiveDb(page: import('@playwright/test').Page) {
  await login(page);
  await expect(page.getByText('DPWH Executive Command Center')).toBeVisible({ timeout: 30_000 });
  // Demo Data is the default source (see Dashboard.tsx) -- switch to Live DB so this suite
  // actually exercises persisted MYPS data, matching the spec's purpose.
  await page.getByRole('button', { name: 'Live DB' }).click();
  await expect(page.getByText('Database data', { exact: true })).toBeVisible();
}

// Scrolls in small increments (rather than jumping straight to the bottom) so every section in
// between genuinely crosses the viewport at some point -- an instant scroll straight to a distant
// target can land without ever bringing an intermediate section's IntersectionObserver margin
// into range, since the browser doesn't render every position in between.
async function scrollThroughPage(page: import('@playwright/test').Page) {
  let previousY = -1;
  for (let step = 0; step < 15; step += 1) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(150);
    const currentY = await page.evaluate(() => window.scrollY);
    if (currentY === previousY) break;
    previousY = currentY;
  }
}

test.describe('Dashboard — demo data', () => {
  test('opens on demo data and queries nothing', async ({ page }) => {
    /*  Counted by URL only, never read: this needs no response body, so there is nothing for a
        body-parsing helper to stall on. */
    const dashboardCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/Dashboard/')) dashboardCalls.push(req.url());
    });

    await login(page);
    await expect(page.getByText('DPWH Executive Command Center')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Demo data', { exact: true })).toBeVisible();
    await expect(page.getByText(/Demo data is for demonstration only/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Program Stage' })).toBeVisible();
    await expect(page.getByTestId('dashboard-stage-line')).toHaveText('All budget stages');

    // Demo figures are generated in Service.ts without touching the network. Scroll the whole
    // page first so every lazy section has had its chance to mount and fetch.
    await scrollThroughPage(page);
    await expect(page.getByText('Annual Budget & Lump Sum Itemization Trend')).toBeVisible();
    expect(dashboardCalls, 'Demo Data must not issue any dashboard query').toEqual([]);
    // Demo figures have no real categories, program types or stages behind them, so those
    // filters are off there.
    await expect(page.getByRole('combobox', { name: 'Filter by category' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Filter by program type' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Filter by program stage name' })).toBeDisabled();

    const liveDb = page.getByRole('button', { name: 'Live DB' });
    await expect(liveDb).toBeVisible();
    if (!LIVE_DB_ENABLED) {
      // Switched off: the control stays on screen, refuses, and a forced click reaches nothing.
      await expect(liveDb).toBeDisabled();
      await liveDb.click({ force: true });
      await expect(page.getByText(/Demo data is for demonstration only/i)).toBeVisible();
      expect(dashboardCalls, 'a forced click on the disabled control must not reach the API').toEqual([]);
    } else {
      await expect(liveDb).toBeEnabled();
    }
  });
});

test.describe('Dashboard — persisted MYPS data (split endpoints, lazy loading)', () => {
  test.skip(
    !LIVE_DB_ENABLED,
    'LIVE_DB_ENABLED is false in FE/src/pages/Dashboard/Dashboard.tsx — the dashboard serves ' +
      'demo data only. Flip both flags to restore.',
  );

  test('loads Tier-1 KPIs eagerly, lazy-loads the rest on scroll, and reconciles figures across endpoints', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);

    await openDashboardOnLiveDb(page);

    // Tier 1: KPI cards and the revision tile fetch immediately, unconditionally.
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(() => callsFor(apiCalls, 'Revisions').length, { timeout: 30_000 }).toBeGreaterThan(0);

    const kpisCall = callsFor(apiCalls, 'Kpis').at(-1);
    expect(kpisCall?.status, JSON.stringify(kpisCall?.responseBody)).toBe(200);
    const kpis = kpisCall?.responseBody;
    // The page opens on FY2027; the year list is whatever fiscal years have cost data, newest first.
    expect(kpis).toMatchObject({ SelectedYear: 2027, Kpis: expect.any(Object) });
    const availableYears = kpis.AvailableYears as number[];
    expect(availableYears).toContain(2027);
    expect(availableYears).toEqual([...availableYears].sort((a, b) => b - a));

    // Tier 2: the watchlist section is several full-height panels below the fold at a
    // 720px-tall viewport with a 200px lazy-load margin -- it should not have fetched yet.
    expect(callsFor(apiCalls, 'Projects').length).toBe(0);

    // Scroll through the page in increments so every lazy section actually crosses the viewport
    // on the way down (see scrollThroughPage), then confirm every split endpoint has fired.
    await scrollThroughPage(page);
    for (const endpoint of DASHBOARD_ENDPOINTS) {
      await expect.poll(() => callsFor(apiCalls, endpoint).length, { timeout: 15_000 }).toBeGreaterThan(0);
    }
    // The Live Audit Feed was removed, and its endpoint with it.
    expect(apiCalls.filter((call) => call.url.endsWith('/Dashboard/Activities'))).toHaveLength(0);

    // Reconcile the independently-fetched sections against each other -- same intent as the old
    // single-payload reconciliation, just split across endpoints now.
    const statuses = callsFor(apiCalls, 'Statuses').at(-1)?.responseBody as
      | { Statuses: Array<{ Count: number }>; Islands: Array<{ ProjectCount: number; Budget: number }> }
      | undefined;
    const budgetBreakdown = callsFor(apiCalls, 'BudgetBreakdown').at(-1)?.responseBody as
      | { BudgetBreakdown: Array<{ ProjectCount: number; Budget: number }> }
      | undefined;
    const regionalBreakdown = callsFor(apiCalls, 'RegionalBreakdown').at(-1)?.responseBody as
      | { Regions: Array<{ ProjectCount: number; Budget: number }> }
      | undefined;
    const trend = callsFor(apiCalls, 'Trend').at(-1)?.responseBody as
      | { AnnualTrend: Array<{ Year: number; ProjectCount: number }> }
      | undefined;

    const activeProjects = kpis.Kpis.ActiveProjects as number;
    const totalBudget = kpis.Kpis.TotalBudget as number;

    const stageCount = statuses?.Statuses.reduce((sum, item) => sum + item.Count, 0) ?? 0;
    const islandCount = statuses?.Islands.reduce((sum, item) => sum + item.ProjectCount, 0) ?? 0;
    const islandBudget = statuses?.Islands.reduce((sum, item) => sum + item.Budget, 0) ?? 0;
    const breakdownCount = budgetBreakdown?.BudgetBreakdown.reduce((sum, item) => sum + item.ProjectCount, 0) ?? 0;
    const breakdownBudget = budgetBreakdown?.BudgetBreakdown.reduce((sum, item) => sum + item.Budget, 0) ?? 0;
    const regionCount = regionalBreakdown?.Regions.reduce((sum, item) => sum + item.ProjectCount, 0) ?? 0;
    const regionBudget = regionalBreakdown?.Regions.reduce((sum, item) => sum + item.Budget, 0) ?? 0;

    expect(stageCount).toBe(activeProjects);
    expect(islandCount).toBe(activeProjects);
    expect(breakdownCount).toBe(activeProjects);
    expect(regionCount).toBe(activeProjects);
    expect(islandBudget).toBeCloseTo(totalBudget, 2);
    expect(breakdownBudget).toBeCloseTo(totalBudget, 2);
    expect(regionBudget).toBeCloseTo(totalBudget, 2);

    // A fiscal year is a program year: the switcher offers every year with programs, and the
    // trend plots the years whose programs have budget-stage cost in that year -- so every trend
    // year is an available year, and the selected year's point is the KPI tile's project count.
    for (const row of trend?.AnnualTrend ?? []) {
      expect(availableYears).toContain(row.Year);
    }
    const selectedPoint = trend?.AnnualTrend.find((row) => row.Year === kpis.SelectedYear);
    expect(selectedPoint?.ProjectCount ?? 0).toBe(activeProjects);

    // Project rows must show resolved names, not raw provenance/lookup keys.
    const projectsPage = callsFor(apiCalls, 'Projects').at(-1)?.responseBody as
      | { lists: Array<{ ProjectId: string; Region: string; ImplementingOffice: string; FundingSource: string; Island: string }> }
      | undefined;
    for (const project of projectsPage?.lists ?? []) {
      expect(project.Region, `${project.ProjectId} exposed a raw region key`).not.toMatch(/^OI\d+$/i);
      expect(project.ImplementingOffice, `${project.ProjectId} exposed a raw office key`).not.toMatch(/^OI\d+$/i);
      expect(project.FundingSource, `${project.ProjectId} exposed revision provenance as funding`).not.toMatch(/^(Base|Revision)$/i);
      expect(['Luzon', 'Visayas', 'Mindanao', 'Unassigned']).toContain(project.Island);
    }

    await test.info().attach('dashboard-split-endpoint-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });
  });

  test('fiscal year switcher and refresh trigger the expected requests', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(0);

    // One button per fiscal year with data. Switch to a different one and check the KPI request
    // follows it -- a single switch, to stay inside the fetch budget (see e2e/CLAUDE.md).
    const availableYears = callsFor(apiCalls, 'Kpis').at(-1)?.responseBody?.AvailableYears as number[];
    const otherYear = availableYears.find((year) => year !== 2027);
    test.skip(otherYear === undefined, 'Only FY2027 has cost data in this database.');
    const beforeSwitch = callsFor(apiCalls, 'Kpis').length;
    await page.getByRole('button', { name: String(otherYear), exact: true }).click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeSwitch);
    expect(callsFor(apiCalls, 'Kpis').at(-1)?.responseBody?.SelectedYear).toBe(otherYear);

    const beforeRefresh = callsFor(apiCalls, 'Kpis').length;
    await page.getByTitle('Refresh dashboard').click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeRefresh);
    const refreshedCall = callsFor(apiCalls, 'Kpis').at(-1);
    expect(refreshedCall?.status).toBe(200);
  });

  test('project quick view and KPI detail modals open and close correctly', async ({ page }) => {
    await openDashboardOnLiveDb(page);
    await scrollThroughPage(page);
    await page.locator('#watchlist-section').scrollIntoViewIfNeeded();

    const quickViewButtons = page.getByRole('button', { name: /Quick view/i });
    if (await quickViewButtons.count()) {
      await quickViewButtons.first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /close project quick view/i }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await quickViewButtons.first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }

    for (const cardName of [/FY Infrastructure Budget/i, /Active Portfolio Projects/i, /Lump Sum/i, /Publication Compliance/i]) {
      await page.getByRole('button', { name: cardName }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/Calculation Methodology:/i)).toBeVisible();
      await dialog.getByRole('button', { name: /close kpi details/i }).click();
      await expect(dialog).toHaveCount(0);
    }
  });

  test('a KPI detail lists projects per program, and a project opens its own details page', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(0);
    await page.getByRole('button', { name: /FY Infrastructure Budget/i }).click();
    const dialog = page.getByRole('dialog');

    // One row per program, and the programs add up to the card.
    const programRows = dialog.locator('button[aria-expanded]');
    await expect(programRows.first()).toBeVisible({ timeout: 60_000 });
    type ProgramRow = { ProgramPK: string; Budget: number; ProjectCount: number };
    const programs = (callsFor(apiCalls, 'Programs').at(-1)?.responseBody?.Programs ?? []) as ProgramRow[];
    const kpis = callsFor(apiCalls, 'Kpis').at(-1)?.responseBody?.Kpis;
    expect(programs.reduce((sum, program) => sum + program.Budget, 0)).toBeCloseTo(kpis?.TotalBudget ?? -1, 2);
    expect(programs.reduce((sum, program) => sum + program.ProjectCount, 0)).toBe(kpis?.ActiveProjects);
    await expect(programRows).toHaveCount(programs.length);

    // Expanding the largest program lists its projects with Program Details' columns.
    await programRows.first().click();
    await expect(dialog.locator('tr[aria-label^="Open project "]').first()).toBeVisible({ timeout: 60_000 });
    for (const column of ['SubProgram', 'Operating Unit', 'Publishable', 'Published']) {
      await expect(dialog.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
    const listed = callsFor(apiCalls, 'Projects').at(-1);
    expect(listed?.requestBody?.Filters?.ProgramPK).toBe(programs[0].ProgramPK);

    // A Lump Sum Project opens in the Lump Sum module instead, so pick an ordinary one.
    type ProjectRow = { ProjectId: string; StageName: string; IsLumpSum?: boolean };
    const project = ((listed?.responseBody?.lists ?? []) as ProjectRow[]).find((row) => !row.IsLumpSum);
    test.skip(!project, 'No ordinary project in the largest program');

    const row = dialog.locator(`tr[aria-label="Open project ${project!.ProjectId}"]`);
    expect(await row.locator('td').nth(1).evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe('ellipsis');
    await row.click();
    await expect(page).toHaveURL(
      `/projects/project-details/${encodeURIComponent(project!.ProjectId)}:${encodeURIComponent(project!.StageName)}`,
    );
  });

  test('the category breakdown adds up and applies the Category filter', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    // Project Categories lives inside DashboardCharts, above the watchlist -- scroll incrementally
    // (not straight to #watchlist-section) so that section actually mounts on the way down.
    await scrollThroughPage(page);
    await expect.poll(() => callsFor(apiCalls, 'Statuses').length, { timeout: 30_000 }).toBeGreaterThan(0);

    // The categories partition the year's projects, as the stages do.
    type Share = { CategoryId: number; Name: string; ProjectCount: number };
    const statuses = callsFor(apiCalls, 'Statuses').at(-1)?.responseBody as { Categories: Share[]; Statuses: Array<{ Count: number }> };
    const categoryTotal = statuses.Categories.reduce((sum, item) => sum + item.ProjectCount, 0);
    expect(categoryTotal).toBe(statuses.Statuses.reduce((sum, item) => sum + item.Count, 0));
    test.skip(statuses.Categories.length === 0, 'No categorized projects in the default fiscal year');

    const box = page.locator('section').filter({ hasText: 'Project Categories' });
    await expect(box.getByText(`${categoryTotal.toLocaleString()} Projects`)).toBeVisible();
    const first = statuses.Categories[0];
    const row = box.getByRole('button', { name: new RegExp(first.Name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();

    // Selecting a category applies the header Category filter...
    const before = callsFor(apiCalls, 'Kpis').length;
    await row.click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(before);
    expect(callsFor(apiCalls, 'Kpis').at(-1)?.requestBody?.CategoryId).toBe(first.CategoryId);
    await expect(page.getByText(`Category: ${first.Name}`)).toBeVisible();

    // ...and selecting it again clears it.
    const beforeClear = callsFor(apiCalls, 'Kpis').length;
    await box.getByRole('button', { name: new RegExp(first.Name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeClear);
    expect(callsFor(apiCalls, 'Kpis').at(-1)?.requestBody?.CategoryId ?? null).toBeNull();
  });

  test('the region tables list regions in DPWH hierarchy order', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    // Every section loads as it is scrolled to, the trend and the region map included.
    await scrollThroughPage(page);
    // The busiest fiscal year has regions in every table (the default year may have only a few).
    await expect.poll(() => callsFor(apiCalls, 'Trend').length, { timeout: 30_000 }).toBeGreaterThan(0);
    const trend = (callsFor(apiCalls, 'Trend').at(-1)?.responseBody?.AnnualTrend ?? []) as Array<{ Year: number; ProjectCount: number }>;
    const busiest = [...trend].sort((a, b) => b.ProjectCount - a.ProjectCount)[0]?.Year;
    test.skip(busiest === undefined, 'No fiscal year with projects');
    // The year buttons stay reachable in the pinned header; the region map, already loaded,
    // refetches for the new year.
    await page.locator('[data-pinned="true"]').getByRole('button', { name: String(busiest), exact: true }).click();
    await expect
      .poll(() => callsFor(apiCalls, 'RegionalBreakdown').filter((call) => call.requestBody?.Year === busiest).length, { timeout: 30_000 })
      .toBeGreaterThan(0);

    const regions = (callsFor(apiCalls, 'RegionalBreakdown').filter((call) => call.requestBody?.Year === busiest).at(-1)?.responseBody?.Regions ?? []) as Array<{
      Region: string;
      Island: string;
      Hierarchy?: string | null;
    }>;
    // Visayas has no sub-groups, so its table holds exactly its regions, in hierarchy order.
    const expected = regions
      .filter((region) => region.Island === 'Visayas' && region.Hierarchy)
      .sort((a, b) => a.Hierarchy!.localeCompare(b.Hierarchy!))
      .map((region) => region.Region.split(' (')[0]);
    test.skip(expected.length < 2, 'Fewer than two Visayas regions this fiscal year');

    const table = page.locator('table').filter({ has: page.locator('thead', { hasText: 'Region / Group' }) })
      .filter({ has: page.getByRole('button', { name: expected[0] }) }).first();
    const listed = await table.locator('tbody tr td:first-child').allInnerTexts();
    expect(listed.map((name) => name.trim())).toEqual(expected);
  });

  test('category picker lists every category on focus, narrows as you type, and filters every section', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    const categoryCalls = () => apiCalls.filter((call) => call.url.endsWith('/Dashboard/Categories'));
    await openDashboardOnLiveDb(page);
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(0);

    const combobox = page.getByRole('combobox', { name: 'Filter by category' });
    await expect(combobox).toBeEnabled();

    // Focusing the empty box lists every category, without typing anything. Scoped to the
    // category list: the Program Type and Program Stage Name dropdowns have options too.
    await combobox.click();
    const options = page.getByRole('listbox', { name: 'Project categories' }).getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => categoryCalls().length).toBeGreaterThan(0);
    const allCategories = (categoryCalls().at(-1)?.responseBody?.Categories ?? []) as Array<{ CategoryName: string }>;
    expect(allCategories.length).toBeGreaterThan(8);
    await expect(options).toHaveCount(allCategories.length);

    // Typing narrows the list in the browser: no further request.
    const requestsBeforeTyping = categoryCalls().length;
    await combobox.fill('OO1');
    await expect(options).toHaveCount(allCategories.filter((c) => c.CategoryName.toLowerCase().includes('oo1')).length);
    expect(categoryCalls().length).toBe(requestsBeforeTyping);

    // Choosing one refetches the KPIs for that category...
    const beforeChoose = callsFor(apiCalls, 'Kpis').length;
    await options.first().click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeChoose);
    const chosenCategoryId = callsFor(apiCalls, 'Kpis').at(-1)?.requestBody?.CategoryId;
    expect(typeof chosenCategoryId).toBe('number');

    // ...and clearing it returns to all categories.
    const beforeClear = callsFor(apiCalls, 'Kpis').length;
    await page.getByRole('button', { name: 'Clear category filter' }).click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeClear);
    expect(callsFor(apiCalls, 'Kpis').at(-1)?.requestBody?.CategoryId ?? null).toBeNull();
    await expect(combobox).toHaveValue('');
  });

  test('the filter header stays pinned on screen while scrolling', async ({ page }) => {
    await openDashboardOnLiveDb(page);
    const pinned = page.locator('[data-pinned="true"]');
    await expect(pinned).toHaveCount(0);

    await scrollThroughPage(page);
    // Pinned: still showing the filters, and still within the viewport after a long scroll.
    await expect(pinned).toHaveCount(1);
    await expect(pinned.getByRole('combobox', { name: 'Filter by category' })).toBeVisible();
    await expect(pinned.getByRole('combobox', { name: 'Filter by program type' })).toBeVisible();
    await expect(pinned.getByRole('combobox', { name: 'Filter by program stage name' })).toBeVisible();
    await expect(pinned.getByRole('button', { name: '2027', exact: true })).toBeVisible();
    await expect(pinned).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(pinned).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Program Stage' })).toBeVisible();
    await expect(page.getByText('National Expenditure Program & Portfolio Matrix')).toHaveCount(0);
  });

  test('program type and stage filters narrow every section and name the stage', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(0);

    const typeSelect = page.getByRole('combobox', { name: 'Filter by program type' });
    const stageSelect = page.getByRole('combobox', { name: 'Filter by program stage name' });
    const stageLine = page.getByTestId('dashboard-stage-line');
    await expect(stageLine).toHaveText('All budget stages');

    // Only the nine budget stages are offered, in stage order: a planning stage (RBP, RDIP, PIP)
    // is never counted, so it would always show nothing.
    await expect(stageSelect.locator('option[value="TF-R"]')).toHaveCount(1, { timeout: 15_000 });
    const stageValues = await stageSelect
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(stageValues).toEqual(['', 'BP', 'NEP', 'NEP-E', 'HGAB', 'HGAB-I', 'GAA', 'GAA-R', 'TF', 'TF-R']);
    await expect(typeSelect.locator('option')).toHaveCount(5);

    // Choosing a stage refetches the KPIs for it and names it under the title...
    const beforeStage = callsFor(apiCalls, 'Kpis').length;
    await stageSelect.selectOption('GAA');
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeStage);
    expect(callsFor(apiCalls, 'Kpis').at(-1)?.requestBody?.StageName).toBe('GAA');
    await expect(stageLine).toHaveText('GAA · General Appropriations Act');

    // ...every lazily loaded section asks for the same stage, and the region map's badge names it.
    await scrollThroughPage(page);
    for (const endpoint of ['RegionalBreakdown', 'Statuses', 'Projects'] as const) {
      await expect
        .poll(() => callsFor(apiCalls, endpoint).at(-1)?.requestBody?.StageName, { timeout: 30_000 })
        .toBe('GAA');
    }
    await expect(page.getByText(/^FY \d{4} General Appropriations Act$/)).toBeVisible();

    // A program type travels alongside the stage (the selects stay usable in the pinned header).
    const beforeType = callsFor(apiCalls, 'Kpis').length;
    await typeSelect.selectOption({ label: 'Regular Infrastructure' });
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeType);
    const typed = callsFor(apiCalls, 'Kpis').at(-1)?.requestBody;
    expect(typed?.ProgramType).toBe(1);
    expect(typed?.StageName).toBe('GAA');

    // Resetting both returns to the whole fiscal year.
    const beforeTypeReset = callsFor(apiCalls, 'Kpis').length;
    await typeSelect.selectOption('');
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeTypeReset);
    const beforeReset = callsFor(apiCalls, 'Kpis').length;
    await stageSelect.selectOption('');
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeReset);
    const reset = callsFor(apiCalls, 'Kpis').at(-1)?.requestBody;
    expect(reset?.ProgramType ?? null).toBeNull();
    expect(reset?.StageName ?? null).toBeNull();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(stageLine).toHaveText('All budget stages');
  });

  test('annual budget bars select their fiscal year like the project trajectory', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    await scrollThroughPage(page);
    await expect.poll(() => callsFor(apiCalls, 'Trend').length, { timeout: 30_000 }).toBeGreaterThan(0);

    const trendYears = (callsFor(apiCalls, 'Trend').at(-1)?.responseBody?.AnnualTrend ?? []) as Array<{ Year: number }>;
    const selectedYear = callsFor(apiCalls, 'Kpis').at(-1)?.responseBody?.SelectedYear as number;
    const otherYear = trendYears.map((row) => row.Year).find((year) => year !== selectedYear);
    test.skip(otherYear === undefined, 'The trend has only one fiscal year in this database.');

    const bar = page.getByRole('button', { name: new RegExp(`^FY ${otherYear}: budget`) });
    await bar.scrollIntoViewIfNeeded();
    // Every year's amounts are printed under its bars, without hovering.
    await expect(page.getByTestId(`trend-values-${otherYear}`)).toBeVisible();
    const before = callsFor(apiCalls, 'Kpis').length;
    const trendCallsBefore = callsFor(apiCalls, 'Trend').length;
    await bar.click();
    // The trend does not depend on the year: the chart stays on screen and is not refetched.
    await expect(page.getByTestId('annual-trend-chart')).toBeVisible();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(before);
    expect(callsFor(apiCalls, 'Kpis').at(-1)?.responseBody?.SelectedYear).toBe(otherYear);
    await expect(bar).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('annual-trend-chart')).toBeVisible();
    expect(callsFor(apiCalls, 'Trend').length).toBe(trendCallsBefore);
  });

  test('selecting a year or a category keeps the page in place', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);
    await openDashboardOnLiveDb(page);
    await scrollThroughPage(page);
    await expect.poll(() => callsFor(apiCalls, 'Trend').length, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(() => callsFor(apiCalls, 'Statuses').length, { timeout: 30_000 }).toBeGreaterThan(0);

    const trendYears = (callsFor(apiCalls, 'Trend').at(-1)?.responseBody?.AnnualTrend ?? []) as Array<{ Year: number }>;
    const selectedYear = callsFor(apiCalls, 'Kpis').at(-1)?.responseBody?.SelectedYear as number;
    const otherYear = trendYears.map((row) => row.Year).find((year) => year !== selectedYear);
    test.skip(otherYear === undefined, 'The trend has only one fiscal year in this database.');

    // How far the element strays from where it was clicked, sampled while every section reloads.
    const maxDrift = async (target: import('@playwright/test').Locator, act: () => Promise<void>) => {
      await target.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 260));
      await page.waitForTimeout(500);
      const top = () => target.evaluate((el) => el.getBoundingClientRect().top);
      const start = await top();
      await act();
      let drift = 0;
      for (let i = 0; i < 30; i += 1) {
        drift = Math.max(drift, Math.abs((await top()) - start));
        await page.waitForTimeout(200);
      }
      return drift;
    };

    const chart = page.getByTestId('annual-trend-chart');
    const barDrift = await maxDrift(chart, () =>
      page.getByRole('button', { name: new RegExp(`^FY ${otherYear}: budget`) }).click());
    expect(barDrift).toBeLessThanOrEqual(10);

    const categories = page.locator('section').filter({ hasText: 'Project Categories' }).first();
    const categoryRows = categories.getByRole('button', { pressed: false });
    test.skip((await categoryRows.count()) === 0, 'No categories in this fiscal year');
    const categoryDrift = await maxDrift(categories, () => categoryRows.first().click());
    expect(categoryDrift).toBeLessThanOrEqual(10);
  });

  test('repository entry points navigate to the project list', async ({ page }) => {
    await openDashboardOnLiveDb(page);

    await page.getByRole('button', { name: /Project Repository/i }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goBack();
    await expect(page.getByText('DPWH Executive Command Center')).toBeVisible({ timeout: 30_000 });

    // #watchlist-section sits inside a LazySection and is not in the DOM until reached.
    await scrollThroughPage(page);
    await page.locator('#watchlist-section').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Full Repository/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });
});
