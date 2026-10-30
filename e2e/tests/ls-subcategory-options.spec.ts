// =============================================================================
// ls-subcategory-options.spec.ts — what the Add Lump Sum Project form offers as
// a Sub-Category (S07-TC003-P001, 2026-10-30).
//
// QA failed the case with "Sub-Category dropdown are not displaying the right
// values". Three things made that true, and this spec holds each of them:
//
//   1. On an empty form the box showed "PROGRAM OF WORKS/BUDGET COST" as if it
//      were chosen. That Sub-Category row has PAPKey 0, and SearchableDropdown
//      matched the empty value '' to it with == ('' == 0).
//   2. With no Category the list held every Sub-Category. It now waits for a
//      Category, as the Project form does.
//   3. Two pairs (BIP and SIPAG "Coastal Roads to augment Resiliency of Coastal
//      Communities", Roads and Bridges) read the same. Their labels now add the
//      Infrastructure Type.
//
// READ-ONLY. It opens the Add page and the dropdowns and saves nothing, so it is
// safe on any database. The Category assertions tolerate the data: they check
// that labels are distinct and that the PAPKey 0 row is never offered, not a
// count.
//
// PREREQUISITE — Vite must proxy to the LOCAL API (see ls-module-ui-walkthrough).
// =============================================================================

import { test, expect, type Page, type Locator } from '@playwright/test';
import { login } from './helpers/auth';
import { programOnStage } from './helpers/lumpSumFixture';

const NONE_ROW = 'PROGRAM OF WORKS/BUDGET COST';

/** A SearchableDropdown trigger, found via its row's label (as in ls-module-ui-walkthrough). */
const fieldFor = (page: Page, label: RegExp): Locator =>
  page.locator('label').filter({ hasText: label }).first()
    .locator('xpath=..')
    .locator('div.relative')
    .first();

/** The open list renders through a portal on document.body, found by its z-index. */
const portalOf = (page: Page) => page.locator('div[style*="9999"]');

const openList = async (page: Page, field: Locator) => {
  await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await field.click();
  await portalOf(page).waitFor({ state: 'visible', timeout: 10000 });
  return portalOf(page);
};

const pick = async (page: Page, field: Locator, search: string, optionText: RegExp | string) => {
  const portal = await openList(page, field);
  await portal.locator('input').fill(search);
  await portal.locator('div.cursor-pointer').filter({ hasText: optionText }).first().click();
  await portal.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
};

const optionTexts = async (page: Page, field: Locator) => {
  const portal = await openList(page, field);
  const texts = (await portal.locator('div.cursor-pointer').allTextContents()).map((t) => t.trim());
  await field.click();
  await portal.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  return texts;
};

test.describe('Lump Sum — the Sub-Category dropdown (S07-TC003-P001)', () => {
  test.use({ viewport: { width: 1440, height: 1600 } });

  test.beforeEach(async ({ page }) => {
    await login(page, process.env.E2E_USERNAME ?? 'jimeneznr', process.env.E2E_PASSWORD ?? 'AnyPassword');
  });

  test('it waits for a Category, never shows the "none" row, and every option reads differently', async ({ page }) => {
    const program = await programOnStage(page, true);
    expect(program, 'a program on the itemizable stage to open the form against').toBeTruthy();

    await page.goto('/lumpsum/add');
    const sub = fieldFor(page, /^\*Sub-Category:$/);

    // 1 and 2: empty, locked, and not pretending a value is chosen.
    await expect(sub).toContainText('Select a Category first');
    await expect(sub).not.toContainText(NONE_ROW);
    await expect(sub.locator('> div').first()).toHaveClass(/cursor-not-allowed/);

    await pick(page, fieldFor(page, /^\*Program Name:$/), String(program.Name), String(program.Name));

    // A restricted Category: its own Sub-Categories only, each label distinct.
    await pick(page, fieldFor(page, /^\*Category:$/), 'OO1', /^OO1/);
    await expect(sub).toContainText('Select Sub-Category');
    const oo1 = await optionTexts(page, sub);
    expect(oo1.length, 'OO1 offers Sub-Categories').toBeGreaterThan(0);
    expect(new Set(oo1).size, 'every OO1 option reads differently').toBe(oo1.length);
    expect(oo1).not.toContain(NONE_ROW);
    expect(oo1.some((t) => /Coastal Roads/.test(t)), 'no CSSP Sub-Category under OO1').toBe(false);

    // 3: the Category holding the two Coastal Roads pairs.
    await pick(page, fieldFor(page, /^\*Category:$/), 'CSSP', /\(CSSP\)/);
    await expect(sub, 'changing the Category clears the Sub-Category').toContainText('Select Sub-Category');
    const cssp = await optionTexts(page, sub);
    expect(new Set(cssp).size, 'every CSSP option reads differently').toBe(cssp.length);
    expect(cssp).not.toContain(NONE_ROW);
    const coastal = cssp.filter((t) => /Coastal Roads to augment Resiliency of Coastal Communities/.test(t));
    for (const label of coastal) {
      expect(label, 'a shared description carries its Infrastructure Type').toMatch(/\((Roads|Bridges)\)$/);
    }
  });
});
