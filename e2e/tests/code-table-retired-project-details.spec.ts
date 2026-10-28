// =============================================================================
// code-table-retired-project-details.spec.ts — #481 (S04-TC036 / TC037, part of #478).
//
// Origin and Agency could not be retired at all while a project used them: Code Tables refused
// every update of an in-use row ("currently in use and cannot be updated or deleted"). And when
// one was inactive anyway, a project that had it showed a blank field and could not be saved:
// the dropdown data held active rows only, and the save required an active value even when it
// had not changed.
//
// Now: an in-use Origin / Agency can be set Inactive (delete and rename stay refused); the
// project keeps showing it and saves; the dropdown does not offer it for a new pick; and the API
// refuses changing a project TO a retired one.
//
// Each test makes its own BP program + project (Origin 13, Agency 1001 via addOrdinaryProject),
// deactivates the code-table row through the same UpdateCodeTable call the Code Tables screen
// makes, and turns it back on in afterEach. Needs the API + Vite on the LOCAL database (see
// e2e/CLAUDE.md): it switches a shared code-table row off for a moment.
// =============================================================================
import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import { login } from './helpers/auth';
import { post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ORIGIN = 13;
const AGENCY = 1001;
const YEAR = new Date().getFullYear();

/** Clear, then type. fill() appends on the amount fields: their onFocus rewrites the value. */
const retype = async (input: Locator, value: string) => {
  await input.click();
  await input.press('Control+A');
  await input.press('Delete');
  await input.pressSequentially(value, { delay: 60 });
  await input.blur();
};

const pickFirst = async (page: Page, placeholder: string, searchPlaceholder: string) => {
  await page.getByText(placeholder, { exact: true }).first().click();
  await page.getByPlaceholder(searchPlaceholder).locator('xpath=../..').locator('div.cursor-pointer').first().click();
};

/** Update Project refuses a project whose funding does not total 100%: one component, one line. */
const addComponentAndFunding = async (page: Page) => {
  await page.getByRole('button', { name: 'Add Component' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Project Component Cost' });
  await dialog.locator('select').first().selectOption('Civil Works');
  await dialog.getByRole('button', { name: 'Add Year' }).click();
  await retype(dialog.getByPlaceholder('₱0.00'), '1000000');
  await dialog.locator('input[type="date"]').nth(0).fill(`${YEAR}-01-15`);
  await dialog.locator('input[type="date"]').nth(1).fill(`${YEAR}-12-15`);
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Add Funding' }).click();
  await pickFirst(page, 'Select Source', 'Search sources...');
  await pickFirst(page, 'Select Agreement', 'Search agreements...');
  await retype(page.getByRole('row').filter({ has: page.getByRole('spinbutton') }).getByPlaceholder('₱0.00'), '1000000.00');
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

const codeTables = async (page: Page) => {
  const res = await post(page, '/api/CodeTable/GetAllCodeTables', {});
  expect(res.status, `GetAllCodeTables: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
  return res.body;
};

/** Set a code-table row Active/Inactive with exactly the payload the Code Tables screen's Active
 *  toggle sends: OriginTable.tsx sends no NameId, AgencyTable.tsx does. */
const setActive = async (page: Page, code: 'ProjectOrigin' | 'ProjectAgency', row: any, isActive: boolean) => {
  const json = code === 'ProjectOrigin'
    ? { Id: row.Id, Name: row.Name, Description: row.Description, IsActive: isActive }
    : { Id: row.Id, NameId: row.NameId, Name: row.Name, Description: row.Description || null, IsActive: isActive };
  const res = await post(page, '/api/CodeTable/UpdateCodeTable', { Code: code, TransactionType: 1, Json: JSON.stringify(json) });
  expect(res.status, `UpdateCodeTable ${code}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
};

const storedDetails = async (page: Page, projectPK: string) => {
  const res = await post(page, '/api/Project/ShowProjectDetails', { ProjectId: projectPK, StageName: 'BP' });
  expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
  return (res.body?.Data ?? res.body).ProjectDetails;
};

test.describe('#481 S04-TC036/TC037: a retired Origin / Agency keeps showing and saving', () => {
  let program: CrossStageProgram | undefined;
  let projectPK = '';
  const restores: (() => Promise<void>)[] = [];

  test.beforeEach(async ({ page }) => {
    await login(page);
    program = await createProgramAtBP(page, `e2e-retired-details-${new Date().toISOString()}`);
    // Update Project refuses a project with no Thrust; PAPKey 1142 is valid through 2026 and Category 1 is unrestricted.
    projectPK = await addOrdinaryProject(page, program, 'e2e #481 retired project details lookups', 'BP', { Thrust: 1142 });
    await page.goto(`/projects/project-details/${projectPK}:BP`);
    await expect(page.getByRole('button', { name: 'Add Component' })).toBeVisible({ timeout: 30_000 });
    await addComponentAndFunding(page);
    await updateProject(page);
  });

  test.afterEach(async ({ page }) => {
    // Code-table rows first: they are shared by everything on this database.
    while (restores.length) await restores.pop()!();
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

  for (const [label, code, list, field, id] of [
    ['Origin', 'ProjectOrigin', 'ProjectOrigins', 'Origin', ORIGIN],
    ['Agency', 'ProjectAgency', 'ProjectAgencies', 'Agency', AGENCY],
  ] as const) {
    test(`S04-TC036: an in-use ${label} can be set Inactive; the project keeps showing and saving it`, async ({ page }) => {
      const row = (await codeTables(page))[list].find((r: any) => r.NameId === id);
      // In use by this project (and others): this used to answer 400 "... In Use".
      await setActive(page, code, row, false);
      restores.push(() => setActive(page, code, row, true));

      await page.reload();
      await expect(page.getByText(row.Name, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

      await updateProject(page);
      expect((await storedDetails(page, projectPK))[field]).toBe(id);
    });
  }

  test('S04-TC037: an inactive Agency is not offered, and changing a project to it is refused', async ({ page }) => {
    const agencies = (await codeTables(page)).ProjectAgencies;
    const current = agencies.find((a: any) => a.NameId === AGENCY);
    const other = agencies.find((a: any) => a.IsActive && a.NameId !== AGENCY);
    await setActive(page, 'ProjectAgency', other, false);
    restores.push(() => setActive(page, 'ProjectAgency', other, true));

    await page.reload();
    await page.getByText(current.Name, { exact: true }).first().click({ timeout: 30_000 });
    const options = page.getByPlaceholder('Search agencies...').locator('xpath=../..').locator('div.cursor-pointer');
    await expect(options.filter({ hasText: current.Name })).toHaveCount(1);
    await expect(options.filter({ hasText: other.Name })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const saved = await updateProject(page);
    const body = JSON.parse(saved.postData() ?? '{}');
    body.ProjectDetails.Agency = other.NameId;
    const refused = await post(page, '/api/Project/UpdateProjectDetails', body);
    expect(refused.status, JSON.stringify(refused.body).slice(0, 300)).toBe(400);
    expect(refused.body?.Title).toBe('Invalid Originating Agency');
    expect(refused.body?.Message).toContain('inactive');
  });
});
