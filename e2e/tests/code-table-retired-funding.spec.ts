// =============================================================================
// code-table-retired-funding.spec.ts — #480 (S04-TC034 / TC035, part of #478).
//
// A Funding Agreement or Funding Source set Inactive in Code Tables blanked the project's
// Funding Profile cell ("Select Agreement"): the dropdown data held active rows only, and the
// dropdown can only label a value it finds there. Sir Alvin on #478: "nawala yung funding
// agreement nya, hindi dapat. Retained yung values even sa display, dapat nawawala lang sa
// dropdown." At the same time the saves only checked that a code exists, so a retired one could
// still be picked for a new line.
//
// Now: the line keeps showing its Agreement / Source and saves; a new line is not offered the
// retired value, and the API refuses it on a new line (Project and Lump Sum).
//
// The project tests make their own BP program + project (one Civil Works component, one funding
// line), deactivate the line's Agreement or Source through the same UpdateCodeTable call the
// Code Tables screen makes, and turn it back on in afterEach. Needs the API + Vite on the LOCAL
// database (see e2e/CLAUDE.md): it switches a shared code-table row off for a moment.
// =============================================================================
import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import { login } from './helpers/auth';
import { post, programOnStage } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/* eslint-disable @typescript-eslint/no-explicit-any */

const YEAR = new Date().getFullYear();

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

/** The options of the SearchableDropdown whose search box is open (they render in a portal). */
const openOptions = (page: Page, searchPlaceholder: string) =>
  page.getByPlaceholder(searchPlaceholder).locator('xpath=../..').locator('div.cursor-pointer');

const pickFirst = async (page: Page, placeholder: string, searchPlaceholder: string) => {
  await page.getByText(placeholder, { exact: true }).first().click();
  await openOptions(page, searchPlaceholder).first().click();
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

/** Set a code-table row Active/Inactive the way the Code Tables screen does. */
const setActive = async (page: Page, code: 'FundingAgreement' | 'FundingSource', row: any, isActive: boolean) => {
  const res = await post(page, '/api/CodeTable/UpdateCodeTable', { Code: code, TransactionType: 1, Json: JSON.stringify({ ...row, IsActive: isActive }) });
  expect(res.status, `UpdateCodeTable ${code}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
};

/** Re-send a save the form made with one more funding line copying the first: exactly what the browser posts. */
const resendWithNewLine = (page: Page, saved: Request) => {
  const body = JSON.parse(saved.postData() ?? '{}');
  body.FundingProfile.push({ ...body.FundingProfile[0], Id: 0, Amount: 1, Percentage: 0 });
  return post(page, '/api/Project/UpdateProjectDetails', body);
};

const fundingLines = async (page: Page, projectPK: string) => {
  const res = await post(page, '/api/Project/ShowProjectDetails', { ProjectId: projectPK, StageName: 'BP' });
  expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
  return ((res.body?.Data ?? res.body).FundingProfile ?? []) as any[];
};

/** The Funding Profile row: the only table row with a number (Percentage) field. */
const fundingRow = (page: Page) => page.getByRole('row').filter({ has: page.getByRole('spinbutton') });

test.describe('#480 S04-TC034/TC035: a retired Funding Agreement / Source keeps showing and saving', () => {
  let program: CrossStageProgram | undefined;
  let projectPK = '';
  let line: { SourceOrg: string; AgreementCode: string };
  let restore: (() => Promise<void>) | undefined;

  test.beforeEach(async ({ page }) => {
    await login(page);
    program = await createProgramAtBP(page, `e2e-retired-funding-${new Date().toISOString()}`);
    // Update Project refuses a project with no Thrust; PAPKey 1142 is valid through 2026 and Category 1 is unrestricted.
    projectPK = await addOrdinaryProject(page, program, 'e2e #480 retired funding lookups', 'BP', { Thrust: 1142 });
    await page.goto(`/projects/project-details/${projectPK}:BP`);
    await expect(page.getByRole('button', { name: 'Add Component' })).toBeVisible({ timeout: 30_000 });

    await addComponent(page, 'Civil Works', '1000000');
    await page.getByRole('button', { name: 'Add Funding' }).click();
    await pickFirst(page, 'Select Source', 'Search sources...');
    await pickFirst(page, 'Select Agreement', 'Search agreements...');
    await retype(fundingRow(page).getByPlaceholder('₱0.00'), '1000000.00');
    const saved = await updateProject(page);
    line = JSON.parse(saved.postData() ?? '{}').FundingProfile[0];
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

  test('S04-TC034/TC035: Funding Agreement set Inactive', async ({ page }) => {
    const agreement = (await codeTables(page)).FundingAgreements.find((a: any) => a.Code === line.AgreementCode);
    const source = (await codeTables(page)).FundingSources.find((s: any) => s.Organization === line.SourceOrg);
    await setActive(page, 'FundingAgreement', agreement, false);
    restore = () => setActive(page, 'FundingAgreement', agreement, true);

    await page.reload();
    // The line still shows its agreement: it used to read "Select Agreement".
    await expect(fundingRow(page)).toContainText(agreement.Name, { timeout: 30_000 });

    const saved = await updateProject(page);
    expect((await fundingLines(page, projectPK)).map((f) => f.AgreementCode)).toEqual([line.AgreementCode]);

    // A new line under the same source is not offered the retired agreement.
    await page.getByRole('button', { name: 'Add Funding' }).click();
    await page.getByText('Select Source', { exact: true }).click();
    await page.getByPlaceholder('Search sources...').fill(source.Name);
    await openOptions(page, 'Search sources...').filter({ hasText: source.Name }).first().click();
    await page.getByText('Select Agreement', { exact: true }).click();
    await expect(openOptions(page, 'Search agreements...').filter({ hasText: agreement.Name })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const refused = await resendWithNewLine(page, saved);
    expect(refused.status, JSON.stringify(refused.body).slice(0, 300)).toBe(400);
    expect(refused.body?.Title).toBe('Invalid Funding Profile Agreement');
  });

  test('S04-TC034/TC035: Funding Source set Inactive', async ({ page }) => {
    const source = (await codeTables(page)).FundingSources.find((s: any) => s.Organization === line.SourceOrg);
    await setActive(page, 'FundingSource', source, false);
    restore = () => setActive(page, 'FundingSource', source, true);

    await page.reload();
    await expect(fundingRow(page)).toContainText(source.Name, { timeout: 30_000 });

    const saved = await updateProject(page);
    expect((await fundingLines(page, projectPK)).map((f) => f.SourceOrg)).toEqual([line.SourceOrg]);

    await page.getByRole('button', { name: 'Add Funding' }).click();
    await page.getByText('Select Source', { exact: true }).click();
    await expect(openOptions(page, 'Search sources...').filter({ hasText: source.Name })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const refused = await resendWithNewLine(page, saved);
    expect(refused.status, JSON.stringify(refused.body).slice(0, 300)).toBe(400);
    expect(refused.body?.Title).toBe('Invalid Funding Profile Source');
  });
});

test.describe('#480 S04-TC035: Lump Sum refuses a retired Funding Agreement on a new line', () => {
  const AGREEMENT = 'DPWH-GAA-2025';
  let restore: (() => Promise<void>) | undefined;
  let leaked: number | undefined;

  test.afterEach(async ({ page }) => {
    if (restore) await restore();
    restore = undefined;
    // Only on a build without the fix: the create went through. Delete it as the same user
    // (the sweeper's user may not hold DeleteLumpSum).
    if (leaked) await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: leaked });
    leaked = undefined;
  });

  test('S04-TC035: CreateLumpSum with an inactive agreement answers 400', async ({ page }) => {
    // A user that holds CreateLumpSum: on the local myps_db_dev only e2eadmin (group 16, Super
    // Admin, from E2E.Admin.Fixture.Dev.sql) does; the default E2E_USERNAME gets 403.
    await login(page, process.env.E2E_LS_USERNAME ?? 'e2eadmin', process.env.E2E_PASSWORD ?? 'AnyPassword');
    const program = await programOnStage(page, true);
    test.skip(!program, 'no GAA-R program that is still Working on this database');

    const agreement = (await codeTables(page)).FundingAgreements.find((a: any) => a.Code === AGREEMENT);
    await setActive(page, 'FundingAgreement', agreement, false);
    restore = () => setActive(page, 'FundingAgreement', agreement, true);

    // Same payload as lumpSumFixture.provisionLumpSum.
    const created = await post(page, '/api/Lumpsum/CreateLumpSum', {
      ProgramId: program.ProgramPK,
      CategoryId: 16,
      SubCategoryId: 1082,
      OperatingUnit: 'OI46',
      Description: `#480 retired agreement (e2e ${new Date().toISOString().slice(0, 19)})`,
      Tier: 2,
      RegionWide: 1,
      Agency: 1001,
      Origin: 13,
      Allocation: 1000000,
      FundingSource: 'GOP',
      FundingAgreement: AGREEMENT,
    });
    if (created.status === 200) leaked = created.body?.LumpSumId;
    expect(created.status, JSON.stringify(created.body).slice(0, 300)).toBe(400);
    expect(JSON.stringify(created.body)).toContain('inactive');
  });
});
