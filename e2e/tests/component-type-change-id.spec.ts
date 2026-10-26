// =============================================================================
// component-type-change-id.spec.ts — #467 (S02-TC003), Project Details › Component Cost.
//
// QA added a Consultancy component (ID CoS), then edited its Component Type to Civil
// Works. The dialog showed CW1, but the project kept "CoS": ProjectForm replaced the
// component's year rows by its NEW ComponentId, so the old CoS rows stayed in the form
// and were sent along with the new ones.
//   - Unsaved component: the CoS rows point at a component that no longer exists, and
//     UpdateProject refuses the save ("Unable to locate Component 'CoS'").
//   - Saved component: every year row is sent twice, the stale copy first, and the API
//     applies the first one, so the edit's amount is lost.
//
// Each test makes its own BP program + project through the API and deletes the program
// afterwards. Needs the API + Vite on the LOCAL database (see e2e/CLAUDE.md).
// =============================================================================

import { test, expect, type Locator, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/* eslint-disable @typescript-eslint/no-explicit-any */
const YEAR = new Date().getFullYear();

const projectDetails = async (page: Page, projectPK: string) => {
  const res = await post(page, '/api/Project/ShowProjectDetails', { ProjectId: projectPK, StageName: 'BP' });
  expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
  const data = res.body?.Data ?? res.body;
  return {
    components: (data.ComponentCosts ?? []).filter((c: any) => !c.IsDeleted),
    years: (data.ComponentCostPerYear ?? []).filter((y: any) => !y.IsDeleted),
  };
};

/** Clear, then type. fill() appends on these amount fields: their onFocus rewrites the
 *  value, which drops the select-all fill() relies on. */
const retype = async (input: Locator, value: string) => {
  await input.click();
  await input.press("Control+A");
  await input.press("Delete");
  await input.pressSequentially(value, { delay: 60 });
  await input.blur();
};

const componentDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Project Component Cost' });

/** Add a component with one year row in the Add dialog. */
const addComponent = async (page: Page, type: string, amount: string) => {
  await page.getByRole('button', { name: 'Add Component' }).click();
  const dialog = componentDialog(page);
  await dialog.locator('select').first().selectOption(type);
  await dialog.getByRole('button', { name: 'Add Year' }).click();
  await retype(dialog.getByPlaceholder('₱0.00'), amount);
  await dialog.locator('input[type="date"]').nth(0).fill(`${YEAR}-01-15`);
  await dialog.locator('input[type="date"]').nth(1).fill(`${YEAR}-12-15`);
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();
};

/** The Component Cost table row whose first cell is exactly `componentId` (a text filter
 *  would also match "Total Cost" in header rows: it ignores case). */
const componentRow = (page: Page, componentId: string) =>
  page.getByRole('row').filter({ has: page.getByRole('cell', { name: componentId, exact: true }) });

/** Open the component row's Edit dialog, change its type (and amount), Save. */
const changeComponentType = async (page: Page, fromId: string, toType: string, toId: string, amount?: string) => {
  await componentRow(page, fromId).getByTitle('Edit').click();
  const dialog = componentDialog(page);
  await dialog.locator('select').first().selectOption(toType);
  await expect(dialog.locator('input[readonly]').first()).toHaveValue(toId);
  if (amount) await retype(dialog.getByPlaceholder('₱0.00'), amount);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
};

/** Pick the first option of a SearchableDropdown (its options render in a portal). */
const pickFirst = async (page: Page, placeholder: string, searchPlaceholder: string) => {
  await page.getByText(placeholder, { exact: true }).first().click();
  await page.getByPlaceholder(searchPlaceholder).locator('xpath=../..').locator('div.cursor-pointer').first().click();
};

/** The one funding row's Amount: the only table row with a number (Percentage) field. */
const fundingAmount = (page: Page) => page.getByRole('row')
  .filter({ has: page.getByRole('spinbutton') })
  .getByPlaceholder('₱0.00');

/** The funding Amount field counts every digit as centavos, so ₱1,000,000.00 is typed as
 *  "100000000". Checked on screen, since the percentage is worked out from it. */
const setFunding = async (page: Page, pesos: number) => {
  await retype(fundingAmount(page), String(pesos * 100));
  await expect(fundingAmount(page)).toHaveValue(new RegExp(`${pesos.toLocaleString('en-PH')}\\.00`));
};

/** Update Project refuses a save whose funding does not total 100% of the component
 *  cost; a new project has no funding. */
const addFullFunding = async (page: Page, pesos: number) => {
  await page.getByRole('button', { name: 'Add Funding' }).click();
  await pickFirst(page, 'Select Source', 'Search sources...');
  await pickFirst(page, 'Select Agreement', 'Search agreements...');
  await setFunding(page, pesos);
};

const updateProject = async (page: Page) => {
  await page.getByRole('button', { name: 'Update Project' }).first().click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Update Project' });
  // A failed form check shows a short-lived toast instead of the confirm dialog: report it.
  const toasts = page.locator('div.fixed.top-4.right-4');
  await expect(confirm.or(toasts.filter({ hasText: /\S/ }))).toBeVisible();
  if (!(await confirm.isVisible())) throw new Error(`Update Project refused: ${(await toasts.allInnerTexts()).join(' | ')}`);
  await confirm.click();
  await expect(page.getByText('Project updated successfully.')).toBeVisible({ timeout: 30_000 });
};

test.describe('#467 S02-TC003: an edited Component Type saves the new Component ID', () => {
  let program: CrossStageProgram | undefined;
  let projectPK = '';

  test.beforeEach(async ({ page }) => {
    await login(page);
    program = await createProgramAtBP(page, `e2e-comptype-${new Date().toISOString()}`);
    // Update Project refuses a project with no Thrust; PAPKey 1142 is valid through 2026 and Category 1 is unrestricted.
    projectPK = await addOrdinaryProject(page, program, 'e2e #467 component type change', 'BP', { Thrust: 1142 });
    await page.goto(`/projects/project-details/${projectPK}:BP`);
    await expect(page.getByRole('button', { name: 'Add Component' })).toBeVisible({ timeout: 30_000 });
  });

  test.afterEach(async ({ page }) => {
    if (!program) return;
    const { ProgramId } = program;
    program = undefined;
    // DeleteProgram refuses a program that still has live projects: Batch Delete it first
    // (a project on its first stage entry is removed for good).
    if (projectPK) {
      const deleted = await batchDelete(page, { ProgramId } as CrossStageProgram, projectPK);
      expect(deleted.status, `BatchDelete: ${JSON.stringify(deleted.body).slice(0, 300)}`).toBe(200);
    }
    const res = await post(page, '/api/Program/DeleteProgram', { ProgramId, StageName: 'BP' });
    expect(res.status, `DeleteProgram: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
  });

  test('S02-TC003: Consultancy changed to Civil Works before the first save is saved as CW1', async ({ page }) => {
    await addComponent(page, 'Consultancy', '1000000');
    await addFullFunding(page, 1_000_000);
    await changeComponentType(page, 'CoS', 'Civil Works', 'CW1');
    await updateProject(page);

    const { components, years } = await projectDetails(page, projectPK);
    expect(components.map((c: any) => [c.ComponentId, c.ComponentType])).toEqual([['CW1', 'Civil Works']]);
    expect(years.map((y: any) => [y.ComponentId, y.Amount])).toEqual([['CW1', 1000000]]);
  });

  test('S02-TC003: a saved Consultancy changed to Civil Works keeps one year row, with the edited amount', async ({ page }) => {
    await addComponent(page, 'Consultancy', '1000000');
    await addFullFunding(page, 1_000_000);
    await updateProject(page);
    expect((await projectDetails(page, projectPK)).components.map((c: any) => c.ComponentId)).toEqual(['CoS']);

    await expect(componentRow(page, 'CoS')).toBeVisible({ timeout: 30_000 });
    // Funding first: the funding total is the budget, and a component over it asks a
    // native confirm() that Playwright dismisses.
    await setFunding(page, 2_500_000);
    await changeComponentType(page, 'CoS', 'Civil Works', 'CW1', '2500000');
    await updateProject(page);

    const { components, years } = await projectDetails(page, projectPK);
    expect(components.map((c: any) => [c.ComponentId, c.ComponentType])).toEqual([['CW1', 'Civil Works']]);
    expect(years.map((y: any) => [y.ComponentId, y.Amount])).toEqual([['CW1', 2500000]]);
  });
});
