// =============================================================================
// code-table-retired-major-item.spec.ts — #479 (S04-TC032 / TC033, part of #478).
//
// A Major Item's Infrastructure Type or Type of Work set Inactive in Code Tables used to lock
// the whole project: UpdateProjectDetails checked "is active" on EVERY posted Major Item, and
// the form posts all of them on every save, so any save (even with no changes) answered 400
// "...invalid or inactive", and deleting the row did not help either. The row also showed a
// blank Type of Work / Unit, because the dropdown data held only active rows.
//
// Now: the retired value still shows and saves on the row that has it; it is not offered for a
// new Major Item, and the API refuses it on a new row.
//
// Each test makes its own BP program + project (two Civil Works components, one
// Major Item on CW1; CW2 is left free, since Consultancy cannot hold Major Items), deactivates the code-table row through the same UpdateCodeTable call the
// Code Tables screen makes, and turns it back on in afterEach. Needs the API + Vite on the
// LOCAL database (see e2e/CLAUDE.md): it switches a shared code-table row off for a moment.
// =============================================================================
import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import { login } from './helpers/auth';
import { post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/* eslint-disable @typescript-eslint/no-explicit-any */

const YEAR = new Date().getFullYear();
const INFRA = { code: 'AF', name: 'Accessibility Facility' };
const WORK = { id: 80, name: 'Construction of Accessibility Facility', unit: 'Number of Units' };
const OTHER_WORK = 'Rehabilitation/Major Repair of Accessibility Facility';

/** Clear, then type. fill() appends on the amount fields: their onFocus rewrites the value. */
const retype = async (input: Locator, value: string) => {
  await input.click();
  await input.press('Control+A');
  await input.press('Delete');
  await input.pressSequentially(value, { delay: 60 });
  await input.blur();
};

const addComponent = async (page: Page, type: string, amount: string) => {
  await page.getByRole('button', { name: 'Add Component' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Project Component Cost' });
  await dialog.locator('select').first().selectOption(type);
  await dialog.getByRole('button', { name: 'Add Year' }).click();
  await retype(dialog.getByPlaceholder('₱0.00'), amount);
  await dialog.locator('input[type="date"]').nth(0).fill(`${YEAR}-01-15`);
  await dialog.locator('input[type="date"]').nth(1).fill(`${YEAR}-12-15`);
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();
};

/** Pick the first option of a SearchableDropdown (its options render in a portal). */
const pickFirst = async (page: Page, placeholder: string, searchPlaceholder: string) => {
  await page.getByText(placeholder, { exact: true }).first().click();
  await page.getByPlaceholder(searchPlaceholder).locator('xpath=../..').locator('div.cursor-pointer').first().click();
};

const addFullFunding = async (page: Page, pesos: number) => {
  await page.getByRole('button', { name: 'Add Funding' }).click();
  await pickFirst(page, 'Select Source', 'Search sources...');
  await pickFirst(page, 'Select Agreement', 'Search agreements...');
  const amount = page.getByRole('row').filter({ has: page.getByRole('spinbutton') }).getByPlaceholder('₱0.00');
  await retype(amount, `${pesos}.00`);
  await expect(amount).toHaveValue(new RegExp(`${pesos.toLocaleString('en-PH')}\\.00`));
};

const majorItemDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Project Major Item of Works' });

/** Open "Add Major Item" and choose the component; the dialog's selects are Component,
 *  Infrastructure Type, Type of Work, in that order. */
const openAddMajorItem = async (page: Page, componentId: string) => {
  await page.getByRole('button', { name: 'Add Major Item' }).click();
  const dialog = majorItemDialog(page);
  await dialog.locator('select').nth(0).selectOption(componentId);
  return dialog;
};

/** Click Update Project, confirm, and hand back the UpdateProjectDetails request it sent. */
const updateProject = async (page: Page): Promise<Request> => {
  await page.getByRole('button', { name: 'Update Project' }).first().click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Update Project' });
  const toasts = page.locator('div.fixed.top-4.right-4');
  await expect(confirm.or(toasts.filter({ hasText: /\S/ }))).toBeVisible();
  if (!(await confirm.isVisible())) throw new Error(`Update Project refused: ${(await toasts.allInnerTexts()).join(' | ')}`);
  const sent = page.waitForRequest((r) => r.url().includes('/Project/UpdateProjectDetails'));
  await confirm.click();
  const request = await sent;
  await expect(page.getByText('Project updated successfully.')).toBeVisible({ timeout: 30_000 });
  return request;
};

const codeTableRow = async (page: Page, list: 'InfraTypes' | 'ScopeOfWorks', match: (row: any) => boolean) => {
  const res = await post(page, '/api/CodeTable/GetAllCodeTables', {});
  expect(res.status, `GetAllCodeTables: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
  const row = (res.body?.[list] ?? []).find(match);
  expect(row, `${list} row not found`).toBeTruthy();
  return row;
};

/** Set a code-table row Active/Inactive the way the Code Tables screen does. */
const setActive = async (page: Page, code: 'ProjectInfraType' | 'ProjectScopeOfWork', row: any, isActive: boolean) => {
  const res = await post(page, '/api/CodeTable/UpdateCodeTable', { Code: code, TransactionType: 1, Json: JSON.stringify({ ...row, IsActive: isActive }) });
  expect(res.status, `UpdateCodeTable ${code}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
};

/** Re-send a save the form made, changed by `edit`: the payload is exactly what the browser posts. */
const resend = (page: Page, saved: Request, edit: (body: any) => void) => {
  const body = JSON.parse(saved.postData() ?? '{}');
  edit(body);
  return post(page, '/api/Project/UpdateProjectDetails', body);
};

/** A new Major Item with the given types on CW2, the component that has none yet. */
const withNewMajorItem = (infraTypeFK: string, workTypeFK: number) => (body: any) => {
  const cos = body.ComponentCosts.find((c: any) => c.ComponentId === 'CW2' && !c.IsDeleted);
  body.MajorItemOfWorks.push({
    ...body.MajorItemOfWorks[0],
    Id: 0, ComponentId: 'CW2', ComponentCostFK: cos.Id, ComponentClientId: cos.ClientId,
    InfraTypeFK: infraTypeFK, WorkTypeFK: workTypeFK, IsDeleted: false,
  });
};

const majorItemRow = (page: Page) => page.getByRole('row').filter({ hasText: WORK.name });

test.describe('#479 S04-TC032/TC033: a retired Infra Type / Type of Work keeps showing and saving', () => {
  let program: CrossStageProgram | undefined;
  let projectPK = '';
  let restore: (() => Promise<void>) | undefined;

  test.beforeEach(async ({ page }) => {
    await login(page);
    program = await createProgramAtBP(page, `e2e-retired-lookup-${new Date().toISOString()}`);
    // Update Project refuses a project with no Thrust; PAPKey 1142 is valid through 2026 and Category 1 is unrestricted.
    projectPK = await addOrdinaryProject(page, program, 'e2e #479 retired major item lookups', 'BP', { Thrust: 1142 });
    await page.goto(`/projects/project-details/${projectPK}:BP`);
    await expect(page.getByRole('button', { name: 'Add Component' })).toBeVisible({ timeout: 30_000 });

    await addComponent(page, 'Civil Works', '600000');
    await addComponent(page, 'Civil Works', '400000');
    await addFullFunding(page, 1_000_000);
    const dialog = await openAddMajorItem(page, 'CW1');
    await dialog.locator('select').nth(1).selectOption({ label: INFRA.name });
    await dialog.locator('select').nth(2).selectOption({ label: WORK.name });
    await dialog.getByRole('button', { name: 'Add Item' }).click();
    await expect(dialog).toBeHidden();
    await updateProject(page);
  });

  test.afterEach(async ({ page }) => {
    // Code-table row first: it is shared by everything on this database.
    if (restore) await restore();
    restore = undefined;
    if (!program) return;
    const { ProgramId } = program;
    program = undefined;
    if (projectPK) {
      const deleted = await batchDelete(page, { ProgramId } as CrossStageProgram, projectPK);
      expect(deleted.status, `BatchDelete: ${JSON.stringify(deleted.body).slice(0, 300)}`).toBe(200);
    }
    const res = await post(page, '/api/Program/DeleteProgram', { ProgramId, StageName: 'BP' });
    expect(res.status, `DeleteProgram: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
  });

  test('S04-TC032: Infra Type set Inactive', async ({ page }) => {
    const infra = await codeTableRow(page, 'InfraTypes', (r) => r.InfraCode === INFRA.code);
    await setActive(page, 'ProjectInfraType', infra, false);
    restore = () => setActive(page, 'ProjectInfraType', infra, true);

    await page.reload();
    await expect(majorItemRow(page)).toContainText(INFRA.name, { timeout: 30_000 });
    await expect(majorItemRow(page)).toContainText(WORK.unit);

    // Any save posts every Major Item, the retired one included: it used to answer 400.
    const saved = await updateProject(page);

    const dialog = await openAddMajorItem(page, 'CW2');
    await expect(dialog.locator('select').nth(1).locator('option', { hasText: INFRA.name })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    const refused = await resend(page, saved, withNewMajorItem(INFRA.code, WORK.id));
    expect(refused.status).toBe(400);
    expect(refused.body?.Title).toBe('Invalid Infrastructure Type');

    const deleted = await resend(page, saved, (body) => { body.MajorItemOfWorks[0].IsDeleted = true; });
    expect(deleted.status, JSON.stringify(deleted.body).slice(0, 300)).toBe(200);
  });

  test('S04-TC033: Type of Work set Inactive', async ({ page }) => {
    const work = await codeTableRow(page, 'ScopeOfWorks', (r) => r.Enum === WORK.id);
    await setActive(page, 'ProjectScopeOfWork', work, false);
    restore = () => setActive(page, 'ProjectScopeOfWork', work, true);

    await page.reload();
    await expect(majorItemRow(page)).toContainText(WORK.unit, { timeout: 30_000 });

    const saved = await updateProject(page);

    const dialog = await openAddMajorItem(page, 'CW2');
    await dialog.locator('select').nth(1).selectOption({ label: INFRA.name });
    const workTypes = dialog.locator('select').nth(2);
    await expect(workTypes.locator('option', { hasText: OTHER_WORK })).toHaveCount(1);
    await expect(workTypes.locator('option', { hasText: WORK.name })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    const refused = await resend(page, saved, withNewMajorItem(INFRA.code, WORK.id));
    expect(refused.status).toBe(400);
    expect(refused.body?.Title).toBe('Invalid Work Type');

    const deleted = await resend(page, saved, (body) => { body.MajorItemOfWorks[0].IsDeleted = true; });
    expect(deleted.status, JSON.stringify(deleted.body).slice(0, 300)).toBe(200);
  });
});
