import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls, type ApiCallDetails } from './helpers/networkCapture';

// Dashboard/Summary (the old monolithic endpoint) still exists on the backend for
// backward-compatibility, but the frontend now calls eight split endpoints instead — one per
// section — loaded lazily as each section scrolls into view rather than all at once. See
// documents/plans/dashboard-modular-data-loading.md.
const DASHBOARD_ENDPOINTS = [
  'Kpis',
  'Trend',
  'BudgetBreakdown',
  'Statuses',
  'RegionalBreakdown',
  'Projects',
  'Activities',
  'Revisions',
] as const;

function callsFor(apiCalls: ApiCallDetails[], endpoint: (typeof DASHBOARD_ENDPOINTS)[number]) {
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

test.describe('Dashboard — persisted MYPS data (split endpoints, lazy loading)', () => {
  test('loads Tier-1 KPIs eagerly, lazy-loads the rest on scroll, and reconciles figures across endpoints', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/']);

    await openDashboardOnLiveDb(page);

    // Tier 1: KPI cards and the revision tile fetch immediately, unconditionally.
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(() => callsFor(apiCalls, 'Revisions').length, { timeout: 30_000 }).toBeGreaterThan(0);

    const kpisCall = callsFor(apiCalls, 'Kpis').at(-1);
    expect(kpisCall?.status, JSON.stringify(kpisCall?.responseBody)).toBe(200);
    const kpis = kpisCall?.responseBody;
    expect(kpis).toMatchObject({
      SelectedYear: 2027,
      AvailableYears: [2027],
      Kpis: expect.any(Object),
    });

    // Tier 2: the watchlist/activity section is several full-height panels below the fold at a
    // 720px-tall viewport with a 200px lazy-load margin -- it should not have fetched yet.
    expect(callsFor(apiCalls, 'Projects').length).toBe(0);
    expect(callsFor(apiCalls, 'Activities').length).toBe(0);

    // Scroll through the page in increments so every lazy section actually crosses the viewport
    // on the way down (see scrollThroughPage), then confirm every split endpoint has fired.
    await scrollThroughPage(page);
    for (const endpoint of DASHBOARD_ENDPOINTS) {
      await expect.poll(() => callsFor(apiCalls, endpoint).length, { timeout: 15_000 }).toBeGreaterThan(0);
    }

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

    // The dashboard is currently pinned to FY2027 only server-side, so the trend is a single point.
    expect(trend?.AnnualTrend).toHaveLength(1);
    expect(trend?.AnnualTrend[0]).toMatchObject({ Year: 2027, ProjectCount: activeProjects });

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

    // Live DB is pinned to FY2027 only right now, so exactly one year button is offered.
    const yearButton = page.getByRole('button', { name: '2027', exact: true });
    await expect(yearButton).toBeVisible();
    await yearButton.click();

    const beforeRefresh = callsFor(apiCalls, 'Kpis').length;
    await page.getByTitle('Refresh dashboard').click();
    await expect.poll(() => callsFor(apiCalls, 'Kpis').length, { timeout: 30_000 }).toBeGreaterThan(beforeRefresh);
    const refreshedCall = callsFor(apiCalls, 'Kpis').at(-1);
    expect(refreshedCall?.status).toBe(200);
  });

  test('project quick view and KPI detail modals open and close correctly', async ({ page }) => {
    await openDashboardOnLiveDb(page);
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

  test('project stage and activity filters can be applied and cleared', async ({ page }) => {
    await openDashboardOnLiveDb(page);
    // Project Stages lives inside DashboardCharts, above the watchlist -- scroll incrementally
    // (not straight to #watchlist-section) so that section actually mounts on the way down.
    await scrollThroughPage(page);

    const stageSection = page.locator('section').filter({ hasText: 'Project Stages' });
    const stageButtons = stageSection.getByRole('button');
    if (await stageButtons.count()) {
      await stageButtons.first().click();
      await stageButtons.first().click();
    }

    for (const name of ['All', 'Projects', 'Revisions', 'LS Wallet']) {
      await page.getByRole('button', { name, exact: true }).click();
    }
  });

  test('repository entry points navigate to the project list', async ({ page }) => {
    await openDashboardOnLiveDb(page);

    await page.getByRole('button', { name: /Project Repository/i }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goBack();
    await expect(page.getByText('DPWH Executive Command Center')).toBeVisible({ timeout: 30_000 });

    await page.locator('#watchlist-section').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Full Repository/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
  });
});
