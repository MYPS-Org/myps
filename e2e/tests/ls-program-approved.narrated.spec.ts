// =============================================================================
// ls-program-approved.narrated.spec.ts — an Approved program on the detail page.
//
// WHAT IT GUARDS. Once a Lump Sum Project's program is Approved at GAA-R the
// rule is NARROW (2026-09-09, the client's): a banner says so, the project's
// details and Component Cost go read-only, and Delete Lump Sum Project is
// refused. Everything else keeps working — Replenish, Import, Save, the
// funding-line Delete, the child Delete — because GAA-R is the stage that work
// happens at. The API side of that boundary is pinned in ls-contract; this spec
// pins what a PERSON sees, the way ls-project-form-identity does for the
// Project form.
//
// AN EARLIER CUT FROZE THE WHOLE PAGE, so wherever a case asserts a refusal it
// also asserts what stays live beside it: the regression to catch is the freeze
// creeping back.
//
// FIVE MOMENTS. Opened on an approved program; the program approved WHILE the
// page is open (picked up by the focus re-read the import lock already uses — a
// stale button is the whole risk) greying the delete alone; a Replenish draft
// caught by that flip, which must still be saveable; the Add page's picker,
// which hides the program because creating one there IS refused; and the
// Component Cost dialog held open across the flip, which must say why it went
// read-only rather than just grey out.
//
// THE FIXTURE PROGRAM IS THE ONLY PROGRAM THIS SUITE APPROVES — see
// approvedProgramFixture.ts. It starts and ends Working.
//
// PREREQUISITE: Vite proxying to the local API —
//   cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import {
  post,
  apiLogin,
  provisionLumpSum,
  importChild,
  type ProvisionedLumpSum,
} from './helpers/lumpSumFixture';
import {
  ensureFixtureProgram,
  setProgramStatus,
  STAGE_GAA,
  type FixtureProgram,
} from './helpers/approvedProgramFixture';
import { APPROVAL_FIXTURE_PROGRAM_GAA } from './helpers/lumpSumFixture';

const USER = process.env.E2E_USERNAME ?? 'jimeneznr';
const PASS = process.env.E2E_PASSWORD ?? 'AnyPassword';
const ALLOCATION = 20_000_000;

/** What a tab switch does: the page re-reads the parent on these two events. */
const simulateReturnToTab = (page: Page) =>
  page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });

const banner = (page: Page) => page.getByText('Program Approved.', { exact: true });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save Lump Sum Project' }).first();

test.describe.configure({ mode: 'serial' });

test.describe('Lump Sum — an Approved program closes the record, not the money', () => {
  test.use({ viewport: { width: 1440, height: 1600 } });

  // Definitely assigned by beforeAll for the tests; afterAll still checks at
  // runtime, since a beforeAll that died early leaves one or both unset.
  let program!: FixtureProgram;
  let parent!: ProvisionedLumpSum;
  /*  A parent with NO children, for the Component Cost dialog case: on an
      itemized parent the pencil is dead already (the itemized freeze), so only a
      plain parent can have that dialog open when the approval lands. */
  let plainParent!: ProvisionedLumpSum;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);
    program = await ensureFixtureProgram(page);
    await setProgramStatus(page, program, 'Working');
    // The Add-page case asserts the GAA sibling is still offered, so it must exist
    // whichever spec runs first.
    await ensureFixtureProgram(page, { name: APPROVAL_FIXTURE_PROGRAM_GAA, stage: STAGE_GAA });
    // Provisioned while Working: creation is one of the two things approval refuses.
    parent = await provisionLumpSum(page, ALLOCATION, 'LS-APPROVED-UI', { programPK: program.ProgramPK });
    const child = await importChild(page, parent, 1_000_000, 'LS-APPROVED-UI child');
    expect(child.status, JSON.stringify(child.body).slice(0, 300)).toBe(200);
    /*  A SECOND funding line, so the table has one the itemized freeze does not
        hold: the FIRST line is protected while children exist, whatever the
        program's status, and asserting on a removable line is how this spec
        tells the approval rule apart from that one. */
    const topUp = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: parent.lumpSumId, NewAmount: ALLOCATION + 4_000_000,
    });
    expect(topUp.status, JSON.stringify(topUp.body).slice(0, 300)).toBe(200);
    plainParent = await provisionLumpSum(page, 3_000_000, 'LS-APPROVED-UI plain', { programPK: program.ProgramPK });
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    /*  Guarded field by field: a beforeAll that died early must not be masked by
        a second error here. The sweeper is the fallback for anything left. */
    const page = await browser.newPage();
    await apiLogin(page);
    try {
      // Working first, or the deletes below are refused by the very gate under test.
      if (program) await setProgramStatus(page, program, 'Working');
    } finally {
      if (parent) {
        const kids = (await post(page, '/api/Lumpsum/ShowItemizedProjects', {
          Filters: { LumpSumId: parent.lumpSumId }, limit: 200, page: 1, sortDirection: 0,
        })).body?.lists ?? [];
        for (const kid of kids) {
          await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: kid.ProjectPK });
        }
        await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: parent.lumpSumId });
      }
      if (plainParent) await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: plainParent.lumpSumId });
      await page.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page, USER, PASS);
  });

  test('opened on an approved program: only Delete is refused, the money controls stay live', async ({ page }) => {
    await setProgramStatus(page, program, 'Approved');
    await page.goto(`/lumpsum/${parent.lumpSumId}`);

    /*  THE BANNER says what is still possible as much as what is not. It
        suppresses the form's blue itemized note (both would say "details are
        read-only") but not the amber import banner, which is about a different
        thing — no import is in flight here, so neither shows. */
    await expect(banner(page)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Approved at GAA-R/).first()).toBeVisible();
    await expect(page.getByText(/Locked by \d+ itemized project/)).toHaveCount(0);
    await expect(page.getByText('Itemization in progress.')).toHaveCount(0);

    /*  THE ONE REFUSED ACTION, and its own sentence — "read-only" would not
        explain a refused delete, so the button does not borrow the banner's. */
    const deleteParent = page.getByRole('button', { name: 'Delete Lump Sum Project' });
    await expect(deleteParent, 'the parent cannot be deleted').toBeDisabled();
    await expect(deleteParent.locator('xpath=..')).toHaveAttribute('title', /cannot be deleted from an Approved program/);

    // Everything the client calls normal work at GAA-R.
    for (const name of ['Replenish', 'Import Itemized Projects']) {
      await expect(page.getByRole('button', { name }), `${name} must stay enabled`).toBeEnabled();
    }
    await expect(saveButton(page), 'Save carries the top-up and the line removal').toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Delete Project' }).first(),
      'an import mistake stays correctable',
    ).toBeEnabled();
    await expect(
      page.getByTitle('Remove this funding line').first(),
      'a wrong funding line stays removable',
    ).toBeEnabled();

    /*  What approval DOES close: the project's own record. The first funding
        line is held by the itemized freeze, not by this rule — asserted so the
        two are not confused. */
    await expect(page.getByPlaceholder('Describe this Lump Sum Project')).toBeDisabled();
    /*  The pencil no longer says "Edit" while dead — it carries the reason, which
        is the banner's sentence and the one thing here that names the details. */
    const pencil = page.locator('button[title*="details are read-only"]').first();
    await expect(pencil, 'the Component Cost pencil is dead and says why').toBeDisabled();
    await expect(page.getByTitle('Edit')).toHaveCount(0);
    await expect(
      page.locator('button[title^="The line this project was created with"]').first(),
      'the founding line is held while children exist',
    ).toBeDisabled();

    // And the record is exactly as it was: the server carries the same fact.
    const details = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    expect(details.body.ProgramApproval?.StageName).toBe('GAA-R');
    expect(Number(details.body.LumpSumProject.ItemizedCount)).toBe(1);
  });

  test('approved while the page is open: the next return to the tab greys the delete alone', async ({ page }) => {
    await setProgramStatus(page, program, 'Working');
    await page.goto(`/lumpsum/${parent.lumpSumId}`);
    const deleteParent = page.getByRole('button', { name: 'Delete Lump Sum Project' });
    await expect(deleteParent).toBeEnabled({ timeout: 30000 });
    await expect(banner(page)).toHaveCount(0);

    // The flip happens elsewhere — the Program page, another user.
    await setProgramStatus(page, program, 'Approved');
    await expect(deleteParent, 'nothing has told the page yet').toBeEnabled();

    // Coming back to the tab is what tells it.
    await simulateReturnToTab(page);
    await expect(banner(page)).toBeVisible({ timeout: 15000 });
    await expect(deleteParent).toBeDisabled();
    // And the flip takes nothing else with it.
    await expect(saveButton(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Replenish' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Import Itemized Projects' })).toBeEnabled();
  });

  test('a Replenish draft caught by the flip can still be saved', async ({ page }) => {
    await setProgramStatus(page, program, 'Working');
    await page.goto(`/lumpsum/${parent.lumpSumId}`);
    await expect(page.getByRole('button', { name: 'Replenish' })).toBeEnabled({ timeout: 30000 });

    const before = Number(
      (await post(page, '/api/Lumpsum/LumpSumBalance', { LumpSumId: parent.lumpSumId })).body.Total,
    );
    const target = before + 5_000_000;

    // A local top-up, unsaved by design.
    await page.getByRole('button', { name: 'Replenish' }).click();
    await page.locator('input[placeholder="0.00"]').fill(String(target));
    await page.getByRole('button', { name: 'Replenish' }).last().click();
    await expect(page.locator('[data-unsaved-line]')).toHaveCount(1);

    await setProgramStatus(page, program, 'Approved');
    await simulateReturnToTab(page);

    /*  THE POINT OF THE REVISED RULE. The draft survives the focus re-read (the
        dataVersion contract) AND can still be committed: an Approved program
        does not strand a top-up half-made. */
    await expect(banner(page)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-unsaved-line]')).toHaveCount(1);
    await expect(saveButton(page)).toBeEnabled();

    await saveButton(page).click();
    await expect(page.getByText(/Save this Lump Sum Project/i)).toBeVisible();
    await page.getByRole('button', { name: 'Save Lump Sum Project' }).last().click();

    await expect(page.locator('[data-unsaved-line]')).toHaveCount(0, { timeout: 30000 });
    await expect
      .poll(
        async () =>
          Number((await post(page, '/api/Lumpsum/LumpSumBalance', { LumpSumId: parent.lumpSumId })).body.Total),
        { timeout: 15000, message: 'the top-up landed on an Approved program' },
      )
      .toBe(target);
  });

  test('the Add page does not offer an approved program, and offers it again once Working', async ({ page }) => {
    /*  The picker's list is /program/showprogram, which applies no status filter
        — so this is the page's own filter under test, not the server's. The
        options render through a portal identified by its z-index, the same way
        ls-module-ui-walkthrough finds them. */
    /*  EXACT names. The sibling fixture "E2E LS approval fixture (GAA)" contains
        this program's name, sits at GAA and is Working — so it is rightly offered
        whatever this one's status is, and a substring match would count it. */
    const exact = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    const openProgramPicker = async () => {
      const field = page.locator('label').filter({ hasText: /^\*Program Name:$/ }).first()
        .locator('xpath=..').locator('div.relative').first();
      await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await field.click();
      const portal = page.locator('div[style*="9999"]');
      await portal.waitFor({ state: 'visible', timeout: 10000 });
      await portal.locator('input').fill(program.Name);
      return {
        approvedOne: portal.locator('div.cursor-pointer').filter({ hasText: exact(program.Name) }),
        gaaSibling: portal.locator('div.cursor-pointer').filter({ hasText: exact(`${program.Name} (GAA)`) }),
      };
    };

    await setProgramStatus(page, program, 'Approved');
    await page.goto('/lumpsum/add');
    await expect(page.getByText('Program Details').first()).toBeVisible({ timeout: 30000 });
    let options = await openProgramPicker();
    await expect(options.approvedOne, 'an approved GAA-R program is not offered').toHaveCount(0);
    // The filter is stage-aware: the GAA sibling is Working and stays on offer.
    await expect(options.gaaSibling, 'a program at GAA is offered').toHaveCount(1);
    await page.keyboard.press('Escape');

    await setProgramStatus(page, program, 'Working');
    await page.reload();
    await expect(page.getByText('Program Details').first()).toBeVisible({ timeout: 30000 });
    options = await openProgramPicker();
    await expect(options.approvedOne, 'a Working program is offered again').toHaveCount(1);
    await page.keyboard.press('Escape');
  });

  test('the Component Cost dialog held open across the flip says why it went read-only', async ({ page }) => {
    /*  The dialog's controls grey reactively when the page's gate flips, and no
        click can reach its submit handler once they have — so the ONLY thing
        that can tell the user what happened is a notice inside the modal. This
        pins that notice, and that the Save behind it is dead. */
    await setProgramStatus(page, program, 'Working');
    await page.goto(`/lumpsum/${plainParent.lumpSumId}`);
    const pencil = page.getByTitle('Edit').first();
    await expect(pencil, 'a plain parent can edit its component').toBeEnabled({ timeout: 30000 });
    await pencil.click();
    const dialogSave = page.getByRole('dialog').getByRole('button', { name: 'Save' });
    await expect(dialogSave).toBeEnabled();
    await expect(page.locator('[data-cost-dialog-notice]')).toHaveCount(0);

    await setProgramStatus(page, program, 'Approved');
    await simulateReturnToTab(page);

    await expect(page.locator('[data-cost-dialog-notice]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-cost-dialog-notice]')).toContainText(/Approved at GAA-R/);
    await expect(dialogSave).toBeDisabled();
    await expect(dialogSave.locator('xpath=..')).toHaveAttribute('title', /Approved at GAA-R/);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    // And the pencil now carries the same sentence instead of a bare "Edit".
    await expect(page.locator('button[title*="Approved at GAA-R"]').first()).toBeDisabled();
  });
});
