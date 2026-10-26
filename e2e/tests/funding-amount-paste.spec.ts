// =============================================================================
// funding-amount-paste.spec.ts — #463, Project Details › Funding Profile Amount.
//
// The Amount field shifted every digit in as a centavo (cash-register style) and
// re-formatted the field on every keystroke, so a pasted "1000000" became ₱10,000.00
// ("treats the last 2 digits as .00"). It now reads what is typed or pasted as pesos,
// the way it is written, keeps the text as typed until the field loses focus, and
// selects the amount on focus so a new one replaces it.
//
// The test makes its own BP program + project through the API and removes both
// afterwards. Nothing is saved: the funding total on screen is the form's own number.
// Needs the API + Vite on the LOCAL database (see e2e/CLAUDE.md).
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/** Pick the first option of a SearchableDropdown (its options render in a portal). */
const pickFirst = async (page: Page, placeholder: string, searchPlaceholder: string) => {
  await page.getByText(placeholder, { exact: true }).first().click();
  await page.getByPlaceholder(searchPlaceholder).locator('xpath=../..').locator('div.cursor-pointer').first().click();
};

/** The funding row's Amount: the only table row with a number (Percentage) field. */
const fundingAmount = (page: Page) => page.getByRole('row')
  .filter({ has: page.getByRole('spinbutton') })
  .getByPlaceholder('₱0.00');

/** Paste through the real clipboard, the way a user does (Ctrl+V into the focused field). */
const paste = async (page: Page, text: string) => {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await fundingAmount(page).click();
  await page.keyboard.press('Control+V');
  await fundingAmount(page).blur();
};

test.describe('#463: a pasted or typed funding Amount is read as written', () => {
  let program: CrossStageProgram | undefined;
  let projectPK = '';

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await login(page);
    program = await createProgramAtBP(page, `e2e-fundpaste-${new Date().toISOString()}`);
    projectPK = await addOrdinaryProject(page, program, 'e2e #463 funding amount paste');
    await page.goto(`/projects/project-details/${projectPK}:BP`);
    await page.getByRole('button', { name: 'Add Funding' }).click({ timeout: 30_000 });
    await pickFirst(page, 'Select Source', 'Search sources...');
    await pickFirst(page, 'Select Agreement', 'Search agreements...');
  });

  test.afterEach(async ({ page }) => {
    if (!program) return;
    const { ProgramId } = program;
    program = undefined;
    // DeleteProgram refuses a program that still has live projects: Batch Delete it first.
    if (projectPK) {
      const deleted = await batchDelete(page, { ProgramId } as CrossStageProgram, projectPK);
      expect(deleted.status, `BatchDelete: ${JSON.stringify(deleted.body).slice(0, 300)}`).toBe(200);
    }
    const res = await post(page, '/api/Program/DeleteProgram', { ProgramId, StageName: 'BP' });
    expect(res.status, `DeleteProgram: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
  });

  test('a pasted whole number is pesos, not centavos', async ({ page }) => {
    await paste(page, '1000000');
    await expect(fundingAmount(page)).toHaveValue('₱1,000,000.00');
    await expect(page.getByText('Total Amount: ₱1,000,000.00')).toBeVisible();
  });

  test('a pasted amount with separators and centavos keeps its centavos', async ({ page }) => {
    await paste(page, '₱1,250,000.50');
    await expect(fundingAmount(page)).toHaveValue('₱1,250,000.50');
    await expect(page.getByText('Total Amount: ₱1,250,000.50')).toBeVisible();
  });

  test('typing reads the same way, and a new amount replaces the old one', async ({ page }) => {
    await fundingAmount(page).click();
    await page.keyboard.type('2500');
    await expect(fundingAmount(page), 'kept as typed while editing').toHaveValue('2500');
    await fundingAmount(page).blur();
    await expect(fundingAmount(page)).toHaveValue('₱2,500.00');

    // Focus selects the amount, so pasting over it replaces it instead of adding to it.
    await paste(page, '750000');
    await expect(fundingAmount(page)).toHaveValue('₱750,000.00');
    await expect(page.getByText('Total Amount: ₱750,000.00')).toBeVisible();
  });
});
