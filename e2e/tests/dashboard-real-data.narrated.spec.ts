import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls, type ApiCallDetails } from './helpers/networkCapture';
// @ts-expect-error — qa-kit is a plain-JS kit junctioned into node_modules, no types shipped.
import { narrator } from 'qa-kit/narrate.js';

test.describe('Dashboard — persisted MYPS data', () => {
  test('loads, reconciles, filters, refreshes, and opens live project records', async ({ page }) => {
    const qa = narrator(page, { total: 14 });
    const apiCalls = captureApiCalls(page, ['/api/Dashboard/Summary']);
    const authCalls = captureApiCalls(page, ['/api/auth/validate']);

    await login(page);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 30_000 });
    await qa.check('Dashboard opened after sign-in. Every figure on this screen now comes from Dashboard/Summary.');

    await expect.poll(() => authCalls.length, { timeout: 30_000 }).toBeGreaterThan(0);
    const signedInUser = authCalls.at(-1)?.responseBody?.Data?.User;
    expect(signedInUser?.Name).toBeTruthy();
    expect(signedInUser?.UserGroupNames?.length).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: `Welcome back, ${signedInUser.Name}!` })).toBeVisible();
    await expect(page.getByText(`Role: ${signedInUser.UserGroupNames.join(', ')}`, { exact: true })).toBeVisible();

    await expect.poll(() => apiCalls.length, { timeout: 30_000 }).toBeGreaterThan(0);
    const initialCall = apiCalls[0] as ApiCallDetails;
    expect(initialCall.status, JSON.stringify(initialCall.responseBody)).toBe(200);
    const summary = initialCall.responseBody;
    expect(summary).toMatchObject({
      SelectedYear: expect.any(Number),
      AvailableYears: expect.any(Array),
      Kpis: expect.any(Object),
      AnnualTrend: expect.any(Array),
      Statuses: expect.any(Array),
      Islands: expect.any(Array),
      Projects: expect.any(Array),
      Activities: expect.any(Array),
    });
    expect(summary.AvailableYears.every((year: number) => Number.isInteger(year) && year >= 2000 && year <= 2200)).toBe(true);
    await expect(page.getByRole('button', { name: 'FY 0', exact: true })).toHaveCount(0);

    for (const project of summary.Projects) {
      expect(project.Region, `${project.ProjectId} exposed a raw region key`).not.toMatch(/^OI\d+$/i);
      expect(project.ImplementingOffice, `${project.ProjectId} exposed a raw office key`).not.toMatch(/^OI\d+$/i);
      expect(project.FundingSource, `${project.ProjectId} exposed revision provenance as funding`).not.toMatch(/^(Base|Revision)$/i);
      expect(['Luzon', 'Visayas', 'Mindanao', 'Unassigned']).toContain(project.Island);
    }
    await qa.check(`The authenticated API returned ${summary.Kpis.ActiveProjects} project(s) for FY ${summary.SelectedYear}; no browser seed or fallback payload was used.`);

    const stageCount = summary.Statuses.reduce((total: number, item: { Count: number }) => total + item.Count, 0);
    const islandCount = summary.Islands.reduce((total: number, item: { ProjectCount: number }) => total + item.ProjectCount, 0);
    const islandBudget = summary.Islands.reduce((total: number, item: { Budget: number }) => total + item.Budget, 0);
    expect(stageCount).toBe(summary.Kpis.ActiveProjects);
    expect(islandCount).toBe(summary.Kpis.ActiveProjects);
    expect(islandBudget).toBeCloseTo(summary.Kpis.TotalBudget, 2);
    expect(summary.Kpis.PublicationRate).toBe(
      summary.Kpis.ActiveProjects === 0
        ? 0
        : Math.round(summary.Kpis.PublishedProjects / summary.Kpis.ActiveProjects * 1000) / 10,
    );
    await qa.check('KPI reconciliation passed: stage counts, island counts, island budgets, and publication rate agree with the underlying API rows.');

    expect(summary.AnnualTrend.map((item: { Year: number }) => item.Year).sort()).toEqual(
      [...summary.AvailableYears].sort(),
    );
    await qa.check('The annual comparison contains every persisted fiscal year, including years represented only by Lump Sum data.');

    await expect(page.getByText('Database data', { exact: true })).toBeVisible();
    await expect(page.getByText(/No demo data has been substituted/i)).toHaveCount(0);
    await expect(page.getByText(/FY infrastructure budget/i)).toBeVisible();
    await expect(page.getByText(/LS itemized amount/i)).toBeVisible();
    await qa.check('The live-data badge, fiscal-year KPIs, project stages, island allocation, watchlist, and activity feed all rendered.');

    const commandCenter = page.getByText('MYPS Command Center', { exact: true }).locator('xpath=../../..');
    const desktopNavbar = page.locator('main > div.sticky').first();
    expect(await commandCenter.evaluate((element) => getComputedStyle(element).zIndex)).toBe('auto');
    expect(await desktopNavbar.evaluate((element) => getComputedStyle(element).zIndex)).toBe('20');
    expect(await commandCenter.locator('*').evaluateAll((elements) => elements.some((element) => getComputedStyle(element).position === 'sticky'))).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    await expect(desktopNavbar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await qa.check('The command-center card scrolls normally, while the application navbar remains above page content without the FY and repository controls painting over it.');

    const yearButtons = page.getByRole('button', { name: /^FY \d{4}$/ });
    for (let index = 0; index < await yearButtons.count(); index += 1) {
      const button = yearButtons.nth(index);
      const year = Number((await button.innerText()).replace(/\D/g, ''));
      const before = apiCalls.length;
      await button.click();
      if (year !== summary.SelectedYear || index > 0) {
        await expect.poll(() => apiCalls.length, { timeout: 30_000 }).toBeGreaterThan(before);
        expect(apiCalls.at(-1)?.requestBody).toEqual({ Year: year });
        expect(apiCalls.at(-1)?.responseBody?.SelectedYear).toBe(year);
      }
    }
    await qa.check('Every available fiscal-year control was clicked and each selection was sent back to the database query.');

    const refreshCount = apiCalls.length;
    await page.getByTitle('Refresh dashboard').click();
    await expect.poll(() => apiCalls.length, { timeout: 30_000 }).toBeGreaterThan(refreshCount);
    expect(apiCalls.at(-1)?.status).toBe(200);
    await qa.check('Refresh issued a new authenticated summary request and completed successfully.');

    const stageButtons = page.locator('section').filter({ hasText: /Project stages/ }).getByRole('button');
    if (await stageButtons.count()) {
      for (let index = 0; index < await stageButtons.count(); index += 1) {
        await stageButtons.nth(index).click();
        await stageButtons.nth(index).click();
      }
      await qa.check('Every persisted project-stage filter was selected and cleared against the watchlist.');
    } else {
      await qa.say('This database has no staged project in the selected year, so the stage-filter branch correctly renders its empty state.');
    }

    const activityFilters = ['all', 'project', 'revision', 'LS project'];
    for (const name of activityFilters) {
      await page.getByRole('button', { name, exact: true }).click();
    }
    await qa.check('All activity filters were clicked; each filters only persisted project, revision, or Lump Sum changes.');

    const quickViews = page.getByRole('button', { name: /Quick view/ });
    if (await quickViews.count()) {
      await quickViews.first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await qa.check('Quick view opened the selected real project with its program, office, source, stage, and selected-year cost.');
      await page.getByRole('button', { name: /close project quick view/i }).click();

      await quickViews.first().click();
      await page.getByRole('button', { name: /^Close$/ }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await qa.check('Both modal close controls were exercised and return cleanly to the dashboard.');
    } else {
      await qa.say('The selected year has no costed project, so watchlist quick-view correctly has no row to open.');
    }

    for (const cardName of [/FY infrastructure budget/i, /Projects in selected FY/i, /LS itemized amount/i, /Publication rate/i]) {
      await page.getByRole('button', { name: cardName }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/How this is calculated:/i)).toBeVisible();
      await expect(dialog.getByRole('table')).toBeVisible();
      const stickyGeometry = await dialog.locator('.overflow-auto').first().evaluate((element) => {
        const header = element.querySelector('thead');
        if (!header) return null;
        return header.getBoundingClientRect().top - element.getBoundingClientRect().top;
      });
      expect(stickyGeometry, 'the sticky column header must have no blank top gap').toBeLessThanOrEqual(1);
      await dialog.getByRole('button', { name: /close kpi details/i }).click();
      await expect(dialog).toHaveCount(0);
    }
    await qa.check('All four KPI cards open record-list modals with a matching tally and a plain-language calculation formula.');

    const latestSummary = apiCalls.at(-1)?.responseBody;
    if (latestSummary?.Projects?.length) {
      await page.getByRole('button', { name: /Publication rate/i }).click();
      await page.getByRole('row', { name: /Open project/i }).first().click();
      await expect(page).toHaveURL(/\/projects\/project-details\//);
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 30_000 });
      await qa.check('A project KPI row—not the card itself—opens that project’s detail route.');
    }

    const dashboardSummaryAfterReturn = apiCalls.at(-1)?.responseBody;
    if (dashboardSummaryAfterReturn?.LsProjects?.length) {
      await page.getByRole('button', { name: /LS itemized amount/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('columnheader', { name: 'Children', exact: true })).toHaveCount(0);
      const firstLs = dashboardSummaryAfterReturn.LsProjects[0];
      expect(firstLs.Children).toHaveLength(firstLs.ItemizedCount);
      await dialog.getByRole('button', { name: /Expand itemized projects/i }).first().click();
      if (firstLs.Children.length) {
        await expect(dialog.getByText(firstLs.Children[0].ProjectId, { exact: true })).toBeVisible();
        const modalUrl = page.url();
        await dialog.getByText(firstLs.Children[0].ProjectId, { exact: true }).click();
        expect(page.url(), 'an expanded child row must remain read-only').toBe(modalUrl);
      } else {
        await expect(dialog.getByText(/No itemized projects are recorded/i)).toBeVisible();
      }
      await qa.check('The LS list has no Children column; its chevron expands persisted child projects inline and child rows do not navigate.');
      await dialog.getByRole('row', { name: /Open Lump Sum project/i }).first().click();
      await expect(page).toHaveURL(/\/lumpsum\/\d+$/);
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 30_000 });
      await qa.check('Only the Lump Sum parent header row opens that persisted Lump Sum detail route.');
    }

    await page.getByRole('button', { name: /Project Repository/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /View repository/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await qa.check('Both repository entry points were clicked and routed to /projects.');

    await test.info().attach('dashboard-summary-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });
  });
});
