// =============================================================================
// ls-data-security-ui.narrated.spec.ts — row-level visibility, through the UI.
//
// ls-data-security.spec.ts proves the guard at API level, on all 13 actions.
// This proves the half an API check cannot: that a refused project is refused
// in a way a person can understand. A guard that returns 400 and a page that
// then renders a blank grid with no explanation are different outcomes, and
// only one of them is acceptable.
//
// PREREQUISITES — both, or this file is meaningless rather than failing:
//   1. the fixture accounts:
//        sqlcmd ... -i Main/Resources/Internal/SQLScripts/LumpSum.DataSecurity.Dev.sql
//   2. Vite pointed at the LOCAL API, or the browser drives a remote database
//      and passes against someone else's data:
//        cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { post, provisionLumpSum, type ProvisionedLumpSum } from './helpers/lumpSumFixture';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

/**
 * Sign in through the real form, as a person does.
 *
 * auth.ts's login() is the same flow; this repeats it only to give a clearer
 * failure when the fixture accounts are missing, which is the likeliest reason
 * for this file to break and is not obvious from "waitForURL timed out".
 */
const loginAs = async (page: Page, userName: string) => {
  await page.goto('/login');
  await page.fill('input[id="username"]', userName);
  await page.fill('input[id="password"]', process.env.E2E_PASSWORD ?? 'AnyPassword');
  await page.click('button:has-text("Sign In")');

  await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {
    throw new Error(
      `'${userName}' could not sign in. Run LumpSum.DataSecurity.Dev.sql to create the ` +
        `fixture accounts, and check Vite is proxying to ${API}.`,
    );
  });
};

test.describe('Lump Sum data security, through the UI', () => {
  let parent: ProvisionedLumpSum;

  test.beforeAll(async ({ browser }) => {
    /*  Provisioned by an ADMIN over the API — fixture-building, not the action
        under test. The point of the spec is what the RESTRICTED user sees of it. */
    const page = await browser.newPage();
    const res = await page.request.post(`${API}/api/Auth/Login`, {
      data: {
        UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
        Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
      },
    });
    expect(res.status(), 'admin login for fixture setup').toBe(200);

    parent = await provisionLumpSum(page, 4_000_000, 'data-security UI probe');
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.request.post(`${API}/api/Auth/Login`, {
      data: {
        UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
        Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
      },
    });
    await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: parent.lumpSumId });
    await page.close();
    // The globalTeardown sweeper is the backstop if this never runs.
  });

  test('a restricted user sees the module, and none of the projects in it', async ({ page }) => {
    await loginAs(page, 'e2elsdenied');
    await page.goto('/lumpsum');

    /*  THE PAGE MUST STILL RENDER. The user has the route and the actions
        granted — what they lack is any project in their region. An empty grid
        is the correct outcome; a crash or a permission error is not. */
    await expect(page.getByRole('heading', { name: 'Lump Sum Projects' })).toBeVisible();
    await expect(page.getByText('No Lump Sum Projects found.')).toBeVisible();

    // And specifically not the one that exists.
    await expect(page.getByText(parent.projectId)).toHaveCount(0);
  });

  test('a deep link to a project outside their region is refused, not blank', async ({ page }) => {
    await loginAs(page, 'e2elsdenied');
    await page.goto(`/lumpsum/${parent.lumpSumId}`);

    /*  The id is real and the route is granted, so this is the case the guard
        exists for. The page must say the project is not available — the
        Not Found panel — rather than sitting on "Loading…" forever or
        rendering an empty shell as though the project had no data. */
    await expect(page.getByRole('heading', { name: /Not Found/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /Back to Lump Sum Projects/i })).toBeVisible();

    // None of the project's own data may appear on a refused page.
    await expect(page.getByText(parent.projectId)).toHaveCount(0);
  });

  test('an entitled user sees the same project normally', async ({ page }) => {
    /*  The control. Without it, a spec that only ever asserts refusals passes
        just as well against a module that is broken for everyone. */
    await loginAs(page, 'e2elsallowed');
    await page.goto(`/lumpsum/${parent.lumpSumId}`);

    await expect(page.getByText(parent.projectId).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Replenish' })).toBeVisible();
    await expect(page.getByText('Remaining', { exact: true }).first()).toBeVisible();
  });

  test.skip('KNOWN GAP: the entitled Central Office user finds the LIST empty', async ({
    page,
  }) => {
    /*  Recorded at API level in ls-data-security.spec.ts and visible here as the
        user experiences it: e2elsallowed can open any Lump Sum Project by id and
        sees none in the grid, because ShowLumpSum filters inline on
        _Session.RegCode (NULL for a central user) while the guard uses
        fUserVisiblePrograms, which exempts them. Unskip when fixed. */
    await loginAs(page, 'e2elsallowed');
    await page.goto('/lumpsum');

    await expect(page.getByText(parent.projectId)).toBeVisible();
  });
});
