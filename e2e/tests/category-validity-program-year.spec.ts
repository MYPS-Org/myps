// =============================================================================
// category-validity-program-year.spec.ts — #488 (S04-TC040 / TC041, part of #478).
//
// Category and Sub-Category (Thrust) validity used to be judged against TODAY's year in the
// forms and the saves (only the importer used the program's year). Now the year is the
// project's program StartYear everywhere:
//   Category    : Active, or Valid Until 0 / >= program year (the documented OR rule).
//   Sub-Category: Active, or Valid From <= program year <= Valid To (0 = open on that side).
//
// AddProgram refuses a Year Start before this year, so the spec uses FUTURE program years and
// moves the validity years instead, through the Code Tables call (allowed on in-use rows since
// #482). It uses Category 9 (Inactive on the local myps_db_dev) and Sub-Category 1049 (used by
// no project), puts both back in afterEach, and removes every program and project it creates.
// The years are 3+ years ahead on purpose: the local database holds hand-made ProjectIds for the
// next two program years (BP011.. / BP012..) that its ID counter has not caught up with, so a
// project minted there answers "Project ID Collision Detected" -- a local-data state, not #488.
// Needs the API + Vite on the LOCAL database (see e2e/CLAUDE.md).
// =============================================================================
import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, batchDelete, createProgramAtBP, type CrossStageProgram } from './helpers/crossStageFixture';

/* eslint-disable @typescript-eslint/no-explicit-any */

const THIS_YEAR = new Date().getFullYear();
const CATEGORY = 9;          // Inactive on the local database
const THRUST = 1049;         // used by no project
const OPEN_THRUST = 1142;    // Active, so selectable for any year
const TAG = `e2e-validity-year-${Date.now()}`;
const CATEGORY_YEAR = THIS_YEAR + 6;   // TC040: valid until this program year
const WINDOW_FROM = THIS_YEAR + 3;     // TC041: Sub-Category window
const WINDOW_TO = THIS_YEAR + 4;

const codeTables = async (page: Page) => {
  const res = await post(page, '/api/CodeTable/GetAllCodeTables', {});
  expect(res.status, `GetAllCodeTables: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
  return res.body;
};

const updateCodeTable = async (page: Page, code: string, json: unknown) => {
  const res = await post(page, '/api/CodeTable/UpdateCodeTable', { Code: code, TransactionType: 1, Json: JSON.stringify(json) });
  expect(res.status, `UpdateCodeTable ${code}: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
};

/** CategoryTable.tsx's edit payload. */
const categoryEdit = (c: any, changes: Record<string, unknown>) =>
  ({ Id: c.Id, CategoryName: c.CategoryName, Minimum: c.Minimum, Maximum: c.Maximum, ValidUntil: c.ValidUntil, IsActive: c.IsActive, ...changes });

/** ThrustTable.tsx's edit / toggle payload. */
const thrustEdit = (t: any, changes: Record<string, unknown>) => ({
  Id: t.Id, PAPKey: t.PAPKey, ProgramName: t.ProgramName, SubProgramName: t.SubProgramName, ActivityName: t.ActivityName,
  SequenceNumber: t.SequenceNumber, ThrustDescription: t.ThrustDescription, InfrastructureType: t.InfrastructureType || undefined,
  ValidFromDate: t.ValidFromDate, ValidToDate: t.ValidToDate, IsActive: t.IsActive, ...changes,
});

test.describe('#488 S04-TC040/TC041: Category / Sub-Category validity follows the program year', () => {
  const programs: { program: CrossStageProgram; projects: string[] }[] = [];
  const restores: (() => Promise<void>)[] = [];

  const programFor = async (page: Page, year: number) => {
    // AddProgram builds ProgramPK from a per-second timestamp (<host>_<MMddyyyy>_<HHmmss>): two
    // programs in the same second collide on UQ_tPrograms_ProgramPK. Not #488 -- keep them apart.
    if (programs.length > 0) await page.waitForTimeout(1_100);
    const entry = { program: await createProgramAtBP(page, `${TAG}-${year}-${programs.length}`, year), projects: [] as string[] };
    programs.push(entry);
    return entry;
  };

  /** Expect AddProject to be refused; if a build without the fix creates it, record it for clean-up first. */
  const expectRefused = async (entry: { projects: string[] }, add: Promise<string>, pattern: RegExp) => {
    let created: string | undefined;
    try { created = await add; } catch (e) { expect(String(e)).toMatch(pattern); return; }
    entry.projects.push(created);
    throw new Error(`expected AddProject to be refused (${pattern}), but it created ${created}`);
  };

  test.beforeEach(async ({ page }) => { await login(page); });

  test.afterEach(async ({ page }) => {
    // Code-table rows first: they are shared by everything on this database.
    while (restores.length) await restores.pop()!();
    while (programs.length) {
      const { program, projects } = programs.pop()!;
      for (const pk of projects) {
        const deleted = await batchDelete(page, program, pk);
        expect(deleted.status, `BatchDelete: ${JSON.stringify(deleted.body).slice(0, 300)}`).toBe(200);
      }
      const res = await post(page, '/api/Program/DeleteProgram', { ProgramId: program.ProgramId, StageName: 'BP' });
      expect(res.status, `DeleteProgram: ${JSON.stringify(res.body).slice(0, 300)}`).toBe(200);
    }
  });

  test('S04-TC040: an Inactive Category is accepted for a program year up to its Valid Until, refused for the year after', async ({ page }) => {
    const category = (await codeTables(page)).ProjectCategories.find((c: any) => c.CategoryId === CATEGORY);
    expect(category.IsActive, `Category ${CATEGORY} must start Inactive`).toBe(false);
    await updateCodeTable(page, 'ProjectCategory', categoryEdit(category, { ValidUntil: CATEGORY_YEAR }));
    restores.push(() => updateCodeTable(page, 'ProjectCategory', categoryEdit(category, {})));

    const lastYear = await programFor(page, CATEGORY_YEAR);
    lastYear.projects.push(await addOrdinaryProject(page, lastYear.program, `${TAG} category ${CATEGORY_YEAR}`, 'BP', { Category: CATEGORY, Thrust: OPEN_THRUST }));

    // Judged against today this was accepted: the Category is still valid this year.
    const yearAfter = await programFor(page, CATEGORY_YEAR + 1);
    await expectRefused(yearAfter, addOrdinaryProject(page, yearAfter.program, `${TAG} category ${CATEGORY_YEAR + 1}`, 'BP', { Category: CATEGORY, Thrust: OPEN_THRUST }), /Invalid Category/);
  });

  test('S04-TC041: an Inactive Sub-Category is offered and accepted only for program years inside its window', async ({ page }) => {
    const thrust = (await codeTables(page)).ProjectThrusts.find((t: any) => t.PAPKey === THRUST);
    const from = WINDOW_FROM;
    const to = WINDOW_TO;
    await updateCodeTable(page, 'ProjectThrust', thrustEdit(thrust, { ValidFromDate: from, ValidToDate: to, IsActive: false }));
    restores.push(() => updateCodeTable(page, 'ProjectThrust', thrustEdit(thrust, {})));

    // Server.
    const inside = await programFor(page, from);
    inside.projects.push(await addOrdinaryProject(page, inside.program, `${TAG} thrust ${from}`, 'BP', { Thrust: THRUST }));
    const before = await programFor(page, THIS_YEAR);
    await expectRefused(before, addOrdinaryProject(page, before.program, `${TAG} thrust ${THIS_YEAR}`, 'BP', { Thrust: THRUST }), /Invalid Sub-Category/);
    const after = await programFor(page, to + 1);
    await expectRefused(after, addOrdinaryProject(page, after.program, `${TAG} thrust ${to + 1}`, 'BP', { Thrust: THRUST }), /Invalid Sub-Category/);

    // Form: the Sub-Category list offers what is valid for the project's program year.
    const open = (await codeTables(page)).ProjectThrusts.find((t: any) => t.PAPKey === OPEN_THRUST);
    const offeredFor = async (entry: { program: CrossStageProgram; projects: string[] }, label: string) => {
      const pk = await addOrdinaryProject(page, entry.program, `${TAG} form ${label}`, 'BP', { Thrust: OPEN_THRUST });
      entry.projects.push(pk);
      await page.goto(`/projects/project-details/${pk}:BP`);
      // The Sub-Category field, by its label (its text also appears elsewhere on the page).
      const field = page.locator('label', { hasText: 'Sub-Category:' }).locator('xpath=following-sibling::div[1]');
      await expect(field).toContainText(open.ThrustDescription, { timeout: 30_000 });
      // The page can still be settling (data loads re-render the field): retry until it opens.
      await expect(async () => {
        await field.locator('div.border').first().click();
        await expect(page.getByPlaceholder('Search sub-categories...')).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      const options = page.getByPlaceholder('Search sub-categories...').locator('xpath=../..').locator('div.cursor-pointer');
      await expect(options.first()).toBeVisible();
      // Exact text: another Sub-Category's description (1129) contains 1049's in full.
      const exact = new RegExp(`^\\s*${thrust.ThrustDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
      const count = await options.filter({ hasText: exact }).count();
      await page.keyboard.press('Escape');
      return count;
    };
    expect(await offeredFor(inside, 'inside')).toBeGreaterThan(0);
    expect(await offeredFor(after, 'after')).toBe(0);
  });
});
