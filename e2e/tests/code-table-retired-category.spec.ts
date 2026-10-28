// =============================================================================
// code-table-retired-category.spec.ts — #482 (S04-TC038 / TC039, part of #478).
//
// Category keeps its documented rule (FE/UserManual.md 5.7.6): a Category can be picked while it
// is Active OR still valid; only one both Inactive and expired is fully retired. What #482 fixes:
//   - the save applied that rule even to an UNCHANGED Category, so a project whose Category was
//     fully retired could not be saved for any reason (the form posts the whole project);
//   - Code Tables refused every update of an in-use Category / Thrust, so neither could be
//     retired (set Inactive, or validity moved) while a project used it.
//
// Each test makes its own BP program + project (Category 1, Thrust 1142 via addOrdinaryProject,
// plus a component and 100% funding so Update Project will save). Code-table rows are changed
// with exactly the payloads the Code Tables screens send, and put back in afterEach. Needs the
// API + Vite on the LOCAL database (see e2e/CLAUDE.md).
//
// TC039 retires Category 1 with sqlcmd, not the API: once off, the API will not switch it back
// on (RISK-072: its 1-20000 range overlaps another active Category, a legacy state on the local
// database), and every active unrestricted Category there overlaps another. It needs
// E2E_SQL_SERVER / E2E_SQL_DB naming the API's database, and skips without them.
// =============================================================================
import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import { execFileSync } from 'child_process';
import { login } from './helpers/auth';
import { post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/* eslint-disable @typescript-eslint/no-explicit-any */

const CATEGORY = 1;          // the project's: expired (2017) but Active, so selectable
const RETIRED_CATEGORY = 9;  // already Inactive AND expired on the local database
const EXPIRED_ACTIVE = 2;    // expired but Active: still selectable under the kept OR rule
const THRUST = 1142;
const YEAR = new Date().getFullYear();

// Same sqlcmd convention as batch-restrict-allow-publish-skips-published.spec.ts: argv only, no
// shell; the password (SQL auth) travels in SQLCMDPASSWORD.
const SQL_SERVER = process.env.E2E_SQL_SERVER;
const SQL_DB = process.env.E2E_SQL_DB;
const SQL_USER = process.env.E2E_SQL_USER;
const runSql = (query: string) => execFileSync('sqlcmd', [
  '-S', SQL_SERVER ?? '', '-d', SQL_DB ?? '', ...(SQL_USER ? ['-U', SQL_USER] : ['-E']), '-C', '-h', '-1', '-W',
  '-Q', `SET NOCOUNT ON; ${query}`,
], { encoding: 'utf-8', env: SQL_USER ? { ...process.env, SQLCMDPASSWORD: process.env.E2E_SQL_PASSWORD ?? '' } : process.env });

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

const updateCodeTable = (page: Page, code: string, json: unknown) =>
  post(page, '/api/CodeTable/UpdateCodeTable', { Code: code, TransactionType: 1, Json: JSON.stringify(json) });

/** ThrustTable.tsx's Active toggle payload. */
const thrustToggle = (t: any, isActive: boolean) => ({
  Id: t.Id, PAPKey: t.PAPKey, ProgramName: t.ProgramName, SubProgramName: t.SubProgramName, ActivityName: t.ActivityName,
  SequenceNumber: t.SequenceNumber, ThrustDescription: t.ThrustDescription, InfrastructureType: t.InfrastructureType || undefined,
  ValidFromDate: t.ValidFromDate, ValidToDate: t.ValidToDate, IsActive: isActive,
});

test.describe('#482 S04-TC038/TC039: a retired Category keeps saving; in-use Category / Thrust can be retired', () => {
  let program: CrossStageProgram | undefined;
  let projectPK = '';
  const restores: (() => Promise<unknown>)[] = [];

  test.beforeEach(async ({ page }) => {
    // A failed set-up must not leave the previous test's ids for afterEach to delete.
    program = undefined;
    projectPK = '';
    await login(page);
    program = await createProgramAtBP(page, `e2e-retired-category-${new Date().toISOString()}`);
    // PAPKey 1142 is valid through 2026 and Category 1 is unrestricted.
    projectPK = await addOrdinaryProject(page, program, 'e2e #482 retired category', 'BP', { Thrust: THRUST });
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

  test('S04-TC039: a project whose Category is now fully retired still saves', async ({ page }) => {
    test.skip(!SQL_SERVER || !SQL_DB, 'set E2E_SQL_SERVER / E2E_SQL_DB to the API database (see the file header)');
    const category = (await codeTables(page)).ProjectCategories.find((c: any) => c.CategoryId === CATEGORY);
    expect(category.IsActive, 'Category 1 must start Active').toBe(true);
    // Category 1 has expired (2017); Inactive on top makes it fully retired. In use by this project.
    runSql(`UPDATE tOptionProjectCategory SET IsActive = 0 WHERE CategoryId = ${CATEGORY}`);
    restores.push(async () => runSql(`UPDATE tOptionProjectCategory SET IsActive = 1 WHERE CategoryId = ${CATEGORY}`));

    await page.reload();
    await expect(page.getByText(category.CategoryName, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    // It used to answer "Selected Category '1' is not valid." on any save.
    await updateProject(page);
  });

  test('S04-TC038: a fully retired Category is refused for a new project; an expired but Active one is not', async ({ page }) => {
    // A Category is only ever new on AddProject: it is part of the Project ID, so Update Project
    // refuses any change to it ("Category Locked").
    await expect(addOrdinaryProject(page, program!, 'e2e #482 retired category (refused)', 'BP', { Category: RETIRED_CATEGORY, Thrust: THRUST }))
      .rejects.toThrow(/Invalid Category/);

    // The documented OR rule is kept: expired (2017) but Active stays selectable.
    const second = await addOrdinaryProject(page, program!, 'e2e #482 expired but active category', 'BP', { Category: EXPIRED_ACTIVE, Thrust: THRUST });
    expect(second).not.toBe('');
    const deleted = await batchDelete(page, program!, second);
    expect(deleted.status, `BatchDelete: ${JSON.stringify(deleted.body).slice(0, 300)}`).toBe(200);
  });

  test('Code Tables: an in-use Thrust can be set Inactive, but not renamed', async ({ page }) => {
    const thrust = (await codeTables(page)).ProjectThrusts.find((t: any) => t.PAPKey === THRUST);
    const off = await updateCodeTable(page, 'ProjectThrust', thrustToggle(thrust, false));
    // In use by this project: this used to answer 400 "Project Thrust In Use".
    expect(off.status, JSON.stringify(off.body).slice(0, 300)).toBe(200);
    restores.push(async () => {
      const on = await updateCodeTable(page, 'ProjectThrust', thrustToggle(thrust, true));
      expect(on.status, `restore Thrust ${THRUST}: ${JSON.stringify(on.body).slice(0, 300)}`).toBe(200);
    });

    const renamed = await updateCodeTable(page, 'ProjectThrust', { ...thrustToggle(thrust, true), ThrustDescription: `${thrust.ThrustDescription} (renamed)` });
    expect(renamed.status, JSON.stringify(renamed.body).slice(0, 300)).toBe(400);
    expect(renamed.body?.Title).toBe('Project Thrust In Use');
  });
});
