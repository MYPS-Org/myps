// =============================================================================
// ls-module-ui-walkthrough.narrated.spec.ts — every control V2 ships, clicked.
//
// This is the run CLAUDE.md asks for: a change is done when a watchable
// Playwright run has driven it. It creates a Lump Sum Project through the form
// rather than the API, spends its allocation through the dialogs, and deletes
// it through the UI — so a break anywhere in that chain surfaces here rather
// than in a curl transcript.
//
// WHAT IT DELIBERATELY DOES NOT DO. It never posts to a Lump Sum endpoint to
// perform an action under test. page.request is used only to read results back
// and to assert the server agrees with the screen. Provisioning is the thing
// being tested, so it is done by typing.
//
// PREREQUISITE — Vite must proxy to the LOCAL API, or this drives a browser
// against a remote database and passes against someone else's data:
//   cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080
//
// Run it watchable with:  HEADED=1 SLOWMO=250 npx playwright test ls-module-ui
// =============================================================================

import { test, expect, type Page, type Locator } from '@playwright/test';
import { login } from './helpers/auth';
import { post, programOnStage, provisionLumpSum, importChild, importActivityYear } from './helpers/lumpSumFixture';
import { buildImportWorkbook } from './helpers/importWorkbook';
import { captureApiCalls } from './helpers/networkCapture';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

/** Unique per run, and carries the marker the globalTeardown sweeper looks for. */
const RUN_TAG = `walkthrough (e2e ${new Date().toISOString().slice(0, 19)})`;
/** Typed on Project Details in the create test; asserted on the row AND the view. */
const RUN_UACS = `LS-UACS-${Date.now().toString().slice(-8)}`;
const ALLOCATION = 8_000_000;
const REPLENISH_TO = 9_500_000;

/*  THE FORM USES TWO KINDS OF CONTROL, and they need different handling.

    Most fields are SearchableDropdown — a div, not a <select>, so selectOption
    does nothing on them. Regionwide is a genuine <select> (Tier was too, until
    the form stopped collecting it on 2026-09-06). Getting this wrong looks like
    a timeout on a visible element, which is a slow thing to diagnose, so the
    two are separated here by name. */

/** A SearchableDropdown trigger, found via its row's label. */
const fieldFor = (page: Page, label: RegExp): Locator =>
  page.locator('label').filter({ hasText: label }).first()
    .locator('xpath=..')
    .locator('div.relative')
    .first();

/** A native <select>, found the same way. */
const selectFor = (page: Page, label: RegExp): Locator =>
  page.locator('label').filter({ hasText: label }).first()
    .locator('xpath=..')
    .locator('select')
    .first();

/**
 * Open a SearchableDropdown and choose an option.
 *
 * The list renders through a PORTAL on document.body, outside the row that owns
 * it, so the options cannot be scoped to the field. They must still be scoped
 * to the portal: `div.cursor-pointer` alone also matches every collapsible
 * section header on the page, and the first match would be "Program Details".
 * The portal is identified by the z-index it sets on itself.
 */
const pickFrom = async (page: Page, field: Locator, search?: string, optionText?: RegExp | string) => {
  /*  CENTRE the trigger first — scrollIntoViewIfNeeded is not enough. The portal
      is position:fixed at coordinates computed from the trigger's bounding rect
      at open time, so a trigger resting at the bottom edge opens its list below
      the fold. Playwright then reports "element is outside of the viewport" and
      retries until the test times out, having located the option perfectly
      well. Centring leaves room for the list underneath. */
  await field.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await field.click();

  const portal = page.locator('div[style*="9999"]');
  await portal.waitFor({ state: 'visible', timeout: 10000 });

  if (search) await portal.locator('input').fill(search);

  const option = optionText
    ? portal.locator('div.cursor-pointer').filter({ hasText: optionText }).first()
    : portal.locator('div.cursor-pointer').first();

  await option.click();
  await portal.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
};

test.describe('Lump Sum — full UI walkthrough', () => {
  /*  A tall window, because this form is long and the dropdowns render their
      options through a fixed-position portal anchored to the trigger. On the
      default 720px viewport the lower fields open their lists off-screen. */
  test.use({ viewport: { width: 1440, height: 1600 } });

  let projectId = '';
  let lumpSumId = 0;

  test.beforeEach(async ({ page }) => {
    await login(page, process.env.E2E_USERNAME ?? 'jimeneznr', process.env.E2E_PASSWORD ?? 'AnyPassword');
  });

  test('the list page: filters come from the server, and search narrows it', async ({ page }) => {
    await page.goto('/lumpsum');
    await expect(page.getByRole('heading', { name: 'Lump Sum Projects' })).toBeVisible();

    /*  The four dropdowns are fed by InitFilterLumpSum. A blank option would
        mean the response was read with the wrong key — which is exactly the
        defect J1 found, where stage rows were read as StageName instead of
        Name and every option rendered empty.

        Wait for the fetch before asserting: they render with only their "All …"
        placeholder until it resolves, and checking too early fails for a
        reason that has nothing to do with the keys. */
    const selects = page.locator('select');
    await expect(selects).toHaveCount(4);
    await expect
      .poll(async () => selects.first().locator('option').count(), { timeout: 20000 })
      .toBeGreaterThan(1);

    for (let i = 0; i < 4; i += 1) {
      const options = await selects.nth(i).locator('option').allTextContents();
      expect(options.length, `filter ${i} should be populated`).toBeGreaterThan(1);
      expect(options.some((o) => o.trim() === ''), `filter ${i} has a blank option`).toBe(false);
    }

    /*  Free text matches the Description — the only LIKE filter the server
        offers. Scoped to the page card, because the app shell has a Search
        button of its own and an unscoped role query matches both.

        SEARCH FOR SOMETHING THIS RUN CREATED. This used to type the literal
        'Demo pack', the description the three migrated MyMYPS samples carry.
        That is data the database may not have — on myps_db_dev_200 the sample
        script could not run at all — and the step then failed on an empty table
        for a reason that had nothing to do with filtering. Provisioning the row
        it searches for makes the test prove the filter rather than the
        fixture; the label carries RUN_TAG, so the sweeper takes it away. */
    const probe = `${RUN_TAG} filter probe`;
    await provisionLumpSum(page, 1_000_000, probe);

    const card = page.locator('div.max-w-10xl');
    await page.goto('/lumpsum');
    await page.getByPlaceholder('Search by description...').fill(probe);
    await card.getByRole('button', { name: 'Search' }).click();

    /*  Every row that comes back is the one searched for — a filter that
        narrows to nothing, or not at all, both fail here. */
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect
      .poll(async () => (await rows.allTextContents()).filter((t) => !t.includes(probe)).length)
      .toBe(0);

    await card.getByRole('button', { name: 'Clear' }).click();
    await expect(rows.first()).toBeVisible();
  });

  test('the list page: Next shows the next ten rows, not the first ten again', async ({ page }) => {
    /*  THE LIST IS THE LAST HAND-ROLLED PAGER IN THE APP, and it never worked.
        The server pages by KEYSET only (FilterDataCursor): every request must
        carry a Navigation mode and the cursor for it. The list sent a bare
        `page: N` with no mode, so the server defaulted to First, reset the page
        to 1 and answered the same top ten rows every time — with `page: 1`
        echoed, which the pager then rendered. Next did nothing, forever.

        This asserts the screen, the wire and the server all agree. */
    const calls = captureApiCalls(page, ['/api/Lumpsum/ShowLumpSum']);

    /*  Two full pages have to exist, and how many projects this machine holds
        is not something a test may assume. Ask, then top up — the fillers carry
        the sweeper's marker, so globalTeardown removes them.

        TWENTY, not eleven. The assertion below is that page 2 holds TEN rows
        none of which were on page 1, so eleven projects satisfy the top-up and
        then fail the assertion with one row on page 2. It passed only because
        the database happened to hold enough already; on myps_db_dev_200, with
        a single Lump Sum Project, it reported "Expected: 10, Received: 1". */
    const pageOne = async () =>
      post(page, '/api/Lumpsum/ShowLumpSum', { Filters: {}, limit: 10, page: 1, sortDirection: 0 });
    let first = await pageOne();
    const shortfall = Math.max(0, 20 - Number(first.body?.total ?? 0));
    /*  THE FILLERS MUST NOT CARRY RUN_TAG. The last step of this test searches
        for RUN_TAG and asserts the pager disappears — i.e. that the match fits
        one page. Tagging twenty fillers with it makes that search return twenty
        rows and the assertion fails, which is a trap that only springs on a
        database with few Lump Sum Projects: where one already holds twenty,
        shortfall is 0, no filler is made, and it passes.

        provisionLumpSum appends the sweeper's "(e2e <ISO>)" marker to whatever
        label it is given, so these are still swept without it. */
    for (let i = 0; i < shortfall; i += 1) {
      await provisionLumpSum(page, 1_000_000, `pager filler ${i + 1}`);
    }
    if (shortfall > 0) first = await pageOne();   // the cursor moved

    await page.goto('/lumpsum');
    const card = page.locator('div.max-w-10xl');
    /*  Read the ROUTE KEY out of each row's link rather than a cell's text: it
        is unique, and it does not move when a column is added or dropped. */
    const links = card.locator('table tbody a[href^="/lumpsum/"]');
    await expect(links).toHaveCount(10);
    const hrefs = () => links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const page1 = await hrefs();

    await card.getByRole('button', { name: 'Next page' }).click();

    // The pager moved. Before the fix the server echoed page 1 and this stayed on 1.
    await expect(card.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    // And so did the rows — no row from page 1 survives onto page 2.
    await expect
      .poll(async () => (await hrefs()).filter((h) => h && !page1.includes(h)).length)
      .toBe(10);
    const page2 = await hrefs();

    /*  The wire says what the screen shows: a keyset hop from page 1's own
        cursor, not another bare page number. */
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.requestBody?.Navigation, JSON.stringify(lastCall?.requestBody)).toBe(2);
    expect(Number(lastCall?.requestBody?.NextFilteredId)).toBe(Number(first.body.NextFilteredId));

    // And the server, asked the same way, answers the same ten projects.
    const apiPage2 = await post(page, '/api/Lumpsum/ShowLumpSum', {
      Filters: {}, limit: 10, page: 2, Navigation: 2,
      NextFilteredId: first.body.NextFilteredId, sortDirection: 0,
    });
    expect((apiPage2.body?.lists ?? []).map((r: any) => `/lumpsum/${r.Id}`)).toEqual(page2);

    // Back again, and page 1 is the page it was.
    await card.getByRole('button', { name: 'Previous page' }).click();
    await expect(card.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(hrefs).toEqual(page1);

    /*  A search that narrows below one page drops the bar entirely, which is
        the proof that applyFilters cleared the cursors rather than paging on
        inside the old, wider set. */
    await page.getByPlaceholder('Search by description...').fill(RUN_TAG);
    await card.getByRole('button', { name: 'Search' }).click();
    await expect.poll(async () => card.getByRole('button', { name: 'Next page' }).count()).toBe(0);
  });

  test('the empty form is refused with ONE message, naming the first field', async ({ page }) => {
    await page.goto('/lumpsum');
    await page.getByRole('button', { name: 'Add Lump Sum Project' }).click();
    await expect(page).toHaveURL(/\/lumpsum\/add/);

    await page.getByRole('button', { name: 'Create Lump Sum Project' }).click();

    /*  ONE toast, naming the FIRST missing field in the server's own order —
        not one per rule, which is what an empty form used to produce, and not a
        generic "check the form". */
    await expect(page.getByText('Select a Program.')).toBeVisible();
    await expect(
      page.locator('text=/^Select a |^Enter a /'),
      'a refusal raises exactly one toast',
    ).toHaveCount(1);

    /*  Deliberately its own test. The toast renders over the first field, so
        continuing to fill the form in the same test races its exit animation —
        the click lands on the notification, the dropdown never opens, and the
        failure reads as a broken locator rather than an obstructed one. */
  });

  /*  ONE CONTROL PER FIELD, addressed through its label's row. Native inputs and
      selects expose `disabled`; SearchableDropdown is a div, and shows the same
      state as the `cursor-not-allowed` class it puts on its trigger. */
  const isFieldDisabled = async (page: Page, label: RegExp): Promise<boolean> => {
    const row = page.locator('label').filter({ hasText: label }).first().locator('xpath=..');

    const native = row.locator('input, select, textarea');
    if ((await native.count()) > 0) return native.first().isDisabled();

    const dropdown = row.locator('div.relative > div').first();
    return ((await dropdown.getAttribute('class')) ?? '').includes('cursor-not-allowed');
  };

  /*  EDITABLE, HIDDEN and one read-only line — not "required" and "optional",
      because the two no longer line up. Alternate ID is optional and stays
      editable; UACS is optional and stays visible but disabled; the other
      sixteen optional fields are not rendered at all (decided 2026-09-06). */

  /** The 7 required fields in this section, plus the one editable optional. */
  const EDITABLE = [
    /^\*Category:$/,
    /^\*Sub-Category:$/,
    /^\*Description:$/,
    /^\*Operating Unit:$/,
    /^\*Regionwide:$/,
    /^\*Origin:$/,
    /^\*Originating Agency:$/,
    /*  THE EXCEPTION. Free text a planner uses to trace a project back to its
        source — on an itemized child the import writes the PARENT's Project ID
        here (rule 2026-09-05) — so it stays editable although it is optional. */
    /^Alternate ID:$/,
    /*  THE OTHER EXCEPTION (2026-09-06). UACS has no project-level column — it
        lives on the component's per-year rows — but the details form is now its
        SINGLE WRITER: the server fans what is typed here across every per-year
        row. Optional, editable; the Component Cost dialog only displays it. */
    /^OA Project Code \(UACS\):$/,
  ];

  /** The 16 optional fields the form no longer renders, and Tier. None may be present. */
  const HIDDEN = [
    /*  Tier left the required set on 2026-09-06: CreateLumpSum defaults an
        absent one to 1, UpdateLumpSum keeps the stored value, and the form
        stopped asking. Matched with or without the star it used to carry. */
    /^\*?Tier:$/,
    /^Multi Year ID:$/,
    /^External ID:$/,
    /^Rank:$/,
    /^MYCA Approval Date:$/,
    /^Province:$/,
    /^City\/Municipality:$/,
    /^Legislative District:$/,
    /^District Engineering Office:$/,
    /^Region:$/,
    /^Implementing Office:$/,
    /^Implementation Mode:$/,
    /^Emergency Mode:$/,
    /^Feasibility Study:$/,
    /^Detailed Design:$/,
    /^ROW Available:$/,
  ];

  const expectFieldShape = async (page: Page) => {
    for (const label of EDITABLE) {
      expect(await isFieldDisabled(page, label), `${label} must stay editable`).toBe(false);
    }
    for (const label of HIDDEN) {
      await expect(page.getByText(label), `${label} must not be rendered`).toHaveCount(0);
    }
  };

  test('add mode: only the required fields and Alternate ID are editable', async ({ page }) => {
    await page.goto('/lumpsum/add');
    await expect(page.getByRole('button', { name: 'Create Lump Sum Project' })).toBeVisible();
    await expectFieldShape(page);
  });

  test('create: filling the form produces a real project', async ({ page }) => {
    /*  ASK WHICH PROGRAM, DO NOT NAME ONE. This typed the literal "Trust Funds"
        and failed for weeks once TF-R stopped being itemizable (2026-09-04) and
        the sample data moved to GAA-R — this database has no Trust Funds program
        at all. The picker is fed by the same list programOnStage reads, so
        resolving it here cannot drift from what the form can actually offer. */
    const program = await programOnStage(page, true);
    expect(program, 'a program on the itemizable stage to create against').toBeTruthy();
    const programName = String(program.Name);

    await page.goto('/lumpsum/add');
    await expect(page.getByRole('button', { name: 'Create Lump Sum Project' })).toBeVisible();

    /*  Matched as a STRING, not a regex: a program name is data and may contain
        regex metacharacters. Locator.filter accepts either. */
    await pickFrom(page, fieldFor(page, /^\*Program Name:$/), programName, programName);

    /*  Program Details is entirely derived: choosing a program fills Start Year
        and Current Stage, and neither is editable. Current Stage is the
        project's own stage, resolved from tProjectStages — there is no separate
        "program stage" snapshot any more.

        Asserted against the program's OWN StartYear rather than a hard-coded
        2025, for the same reason the name is resolved rather than typed. */
    await expect(page.locator(`input[value="${program.StartYear}"]`).first()).toBeVisible();

    await pickFrom(page, fieldFor(page, /^\*Category:$/), 'OO1', /OO1/);
    await pickFrom(page, fieldFor(page, /^\*Sub-Category:$/));
    await page.getByPlaceholder('Describe this Lump Sum Project').fill(RUN_TAG);

    /*  UACS IS TYPED HERE, on Project Details (2026-09-06). The create payload
        carries no per-year rows, so this box is the only way the code can reach
        the one row the server derives — asserted after the save, below. */
    await page.getByPlaceholder('Enter UACS code...').fill(RUN_UACS);

    /*  Regionwide is a native select; the rest are SearchableDropdowns. Chosen
        by position rather than by name because its option set is data, and any
        valid value satisfies the requirement under test. Tier is NOT set: the
        form no longer has the field, and the create test below checks the
        server filled it in. */
    await selectFor(page, /^\*Regionwide:$/).selectOption({ index: 1 });

    for (const label of [/^\*Operating Unit:$/, /^\*Origin:$/, /^\*Originating Agency:$/]) {
      await pickFrom(page, fieldFor(page, label));
    }

    await page.locator('input[placeholder="0.00"]').fill(String(ALLOCATION));
    await pickFrom(page, fieldFor(page, /^\*Funding Source:$/), 'GOP', /GOP|Government/);
    await pickFrom(page, fieldFor(page, /^\*Funding Agreement:$/), 'DPWH-GAA-2025', /2025/);

    await page.getByRole('button', { name: 'Create Lump Sum Project' }).last().click();

    // The confirm dialog is part of the flow, not decoration.
    await expect(page.getByText(/Create this Lump Sum Project\?/)).toBeVisible();
    await page.getByRole('button', { name: 'Create Lump Sum Project' }).last().click();

    await page.waitForURL(/\/lumpsum\/\d+$/, { timeout: 30000 });
    lumpSumId = Number(page.url().split('/').pop());
    expect(lumpSumId, 'the new project id').toBeGreaterThan(0);

    /*  Read the result back from the server and check the screen agrees. A
        parent's generated ID ends in 'LS' regardless of Region — the constant,
        not a geographic code. */
    const detail = await page.request.post(`${API}/api/Lumpsum/LumpSumDetails`, {
      data: { LumpSumId: lumpSumId },
    });
    const body = await detail.json();
    projectId = body.LumpSumProject.ProjectId;
    expect(projectId).toMatch(/LS$/);
    expect(Number(body.Balance.Total)).toBe(ALLOCATION);

    /*  WHAT THE FORM SAVED, not what it shows back. The form once keyed Category
        on the lookup's surrogate Id and Sub-Category on the thrust row's Id, so
        picking OO1 (Id 15) stored CategoryId 15 = MOOE — and the form, mapping
        15 back through Id, still displayed OO1. The view joins on the business
        keys, so it is the honest witness: OO1 is CategoryId 16, and a
        Sub-Category is a PAPKey (1001+), never a thrust Id (1..164). */
    expect(Number(body.LumpSumProject.Category), 'Category stored as CategoryId, not the row Id').toBe(16);
    expect(String(body.LumpSumProject.CategoryName)).toMatch(/^OO1/);
    expect(Number(body.LumpSumProject.Thrust), 'Sub-Category stored as a PAPKey').toBeGreaterThanOrEqual(1001);

    /*  The form sent no Tier — it has no Tier field since 2026-09-06 — so this
        is the server's default, not something the test typed. 0 would mean the
        old `?? 0` fallback came back; that is the value SampleData step 4b
        exists to clean up. */
    expect(Number(body.LumpSumProject.Tier), 'Tier defaulted to 1 by CreateLumpSum').toBe(1);

    /*  BOTH READS OF UACS. There is no project-level column: LumpSumProject.UACS
        is vLumpSumSet's TOP 1 over the per-year rows, and the row itself is the
        storage. A form-typed code must land on the derived row (CreateLumpSum
        sets it from dto.Uacs) and come back through the view. */
    expect(body.ComponentCostPerYear[0].UACS, 'UACS stored on the derived per-year row').toBe(RUN_UACS);
    expect(body.LumpSumProject.UACS, 'and read back through the view').toBe(RUN_UACS);

    await expect(page.getByText(projectId).first()).toBeVisible();
  });

  test('the detail page shows the server figures and every action V2 ships', async ({ page }) => {
    test.skip(!lumpSumId, 'create must have run');
    await page.goto(`/lumpsum/${lumpSumId}`);

    // Total / Itemized / Remaining, straight from dbo.vLumpSumBalance.
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Itemized', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Remaining', { exact: true }).first()).toBeVisible();

    for (const action of ['Replenish', 'Import Itemized Projects', 'Delete Lump Sum Project']) {
      await expect(page.getByRole('button', { name: action })).toBeVisible();
    }

    /*  THE COMPONENT IS NOT ADDED OR DELETED (2026-09-06). A Lump Sum Project
        holds exactly one component, written by CreateLumpSum and derived from the
        funding lines on every save, so the controls that offered a second one —
        or the removal of the only one — are gone. UpdateLumpSum refuses both, so
        a button here could only ever have produced a rejected save. Its two money
        figures are shown instead: the allocation and what is left of it. */
    await expect(page.getByRole('button', { name: 'Add Component' })).toHaveCount(0);
    await expect(page.getByText('Component Cost').first()).toBeVisible();
    for (const figure of ['Allocation', 'Itemized', 'Remaining']) {
      await expect(page.getByText(figure, { exact: true }).first()).toBeVisible();
    }

    /*  NEITHER IS FUNDING ADDED HERE (2026-09-06). The allocation is derived from
        the funding lines, so the only way to raise it is Replenish — which is why
        the table's Source, Agreement and Amount are read-only and Add Funding is
        gone. Delete stays, so this does not assert its absence. */
    await expect(page.getByRole('button', { name: 'Add Funding' })).toHaveCount(0);

    /*  AND NOTHING IS FROZEN YET. The walkthrough's project has no itemized
        children at this point, so the form is editable and carries no lock
        banner — the counterpart to the frozen state is asserted where a child
        exists. If this ever fails, the freeze is firing on a count of zero.

        A THIRD THING would disable Save here: the program being Approved at
        GAA-R (2026-09-09, ls-program-approved). programOnStage never provisions
        on an Approved program, so if Save is dead on this fresh project, check
        the fixture picked a Working program before suspecting the form. */
    await expect(page.getByText(/Locked by \d+ itemized project/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save Lump Sum Project' }).first()).toBeEnabled();

    /*  ABSENCE MATTERS AS MUCH AS PRESENCE. These left the module with
        decisions 3, 7, 8, 11 and 12 — if any reappears, something was restored
        from the reference branch by mistake. */
    for (const gone of [
      'Advance Stage',
      'Publish',
      'Request Revision',
      'Edit Draw',
      'Approvals',
      'Itemize Project',
      'Mark as Scheduled',
    ]) {
      await expect(page.getByRole('button', { name: gone })).toHaveCount(0);
    }

    // The four collapsible sections the edit form is made of.
    for (const section of ['Program Details', 'Project Details', 'Funding Profile', 'Component Cost']) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
    }
  });

  test('edit mode shows the same fields as add mode', async ({ page }) => {
    test.skip(!lumpSumId, 'create must have run');
    await page.goto(`/lumpsum/${lumpSumId}`);
    await expect(page.getByText('Project Details').first()).toBeVisible({ timeout: 20000 });
    await expectFieldShape(page);
  });

  test('UACS: typed on the form, it reaches the per-year row and the view; the dialog shows it; clearing removes it', async ({ page }) => {
    test.skip(!lumpSumId, 'create must have run');

    /*  The two reads again — storage row and view — after a change made through
        the form, then after a clear. The Component Cost dialog is opened once to
        show it displays the same code and cannot edit it: the form is the single
        writer (2026-09-06). */
    /*  Reads through, not around: a body that came back without the child arrays —
        a refusal, or a read that raced a save — is reported as "unread" so the
        poll below retries, rather than throwing a TypeError that names a property
        instead of the problem. */
    const both = async () => {
      const d = await page.request.post(`${API}/api/Lumpsum/LumpSumDetails`, { data: { LumpSumId: lumpSumId } });
      const b = await d.json();
      if (!Array.isArray(b?.ComponentCostPerYear) || !b?.LumpSumProject) {
        return { row: 'unread', view: 'unread' };
      }
      return { row: b.ComponentCostPerYear[0]?.UACS ?? null, view: b.LumpSumProject.UACS ?? null };
    };

    const saveThroughTheForm = async () => {
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/Lumpsum/UpdateLumpSum') && r.request().method() === 'POST',
          { timeout: 30000 },
        ),
        (async () => {
          await page.getByRole('button', { name: 'Save Lump Sum Project' }).click();
          await expect(page.getByText(/Save this Lump Sum Project/i)).toBeVisible();
          await page.getByRole('button', { name: 'Save Lump Sum Project' }).last().click();
        })(),
      ]);
      expect(response.status(), 'the save was accepted').toBe(200);
    };

    await page.goto(`/lumpsum/${lumpSumId}`);
    await expect(page.getByText('Project Details').first()).toBeVisible({ timeout: 20000 });

    /*  WAIT FOR THE PAGE TO SETTLE BEFORE TYPING. LumpSumDetail fetches twice —
        the project, then its children — and each fetch hands LumpSumForm a new
        initialData, whose effect resets the form state. Anything typed between
        the two is discarded, and the save then sends the fetched value: a real
        race for a fast typist, not a test artefact, and not specific to UACS.
        Recorded in lump-sum-v2.md; here we simply wait it out. */
    await page.waitForLoadState('networkidle');

    const box = page.getByPlaceholder('Enter UACS code...');
    await expect(box, 'the create test typed this').toHaveValue(RUN_UACS);

    // CHANGE it through the form.
    const changed = `${RUN_UACS}-B`;
    await box.fill(changed);
    await expect(box, 'the typed value survived to the save').toHaveValue(changed);
    await saveThroughTheForm();
    await expect.poll(async () => (await both()).row, { timeout: 15000 }).toBe(changed);
    await expect.poll(async () => (await both()).view, { timeout: 15000 }).toBe(changed);

    /*  THE DIALOG DISPLAYS, NEVER EDITS. Open the one component's Edit dialog and
        read its UACS box: same value, disabled. Escape closes a Headless UI dialog. */
    await page.reload();
    await expect(page.getByText('Component Cost').first()).toBeVisible({ timeout: 20000 });
    await page.locator('button[title="Edit"]').first().click();
    const dialogUacs = page.getByRole('dialog').locator('input[value="' + changed + '"]').first();
    await expect(dialogUacs, 'the dialog shows the project UACS').toBeVisible();
    await expect(dialogUacs, 'and cannot edit it').toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // CLEAR it through the form: '' must travel (not undefined) for the server to clear.
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Enter UACS code...').fill('');
    await expect(page.getByPlaceholder('Enter UACS code...')).toHaveValue('');
    await saveThroughTheForm();
    await expect.poll(async () => (await both()).row, { timeout: 15000 }).toBeNull();
    await expect.poll(async () => (await both()).view, { timeout: 15000 }).toBeNull();

    // Put it back for the tests that follow.
    await page.getByPlaceholder('Enter UACS code...').fill(RUN_UACS);
    await expect(page.getByPlaceholder('Enter UACS code...')).toHaveValue(RUN_UACS);
    await saveThroughTheForm();
    await expect.poll(async () => (await both()).row, { timeout: 15000 }).toBe(RUN_UACS);
  });

  test('a hidden field keeps its value through a save', async ({ page }) => {
    /*  THE RISK THIS CHANGE CARRIES. Hiding the inputs (2026-09-06; they were
        merely disabled from 2026-09-04) must not stop the values being SENT:
        ApplyDetailFields assigns each of these with no
        null-guard, so a payload that dropped them would erase them silently on
        the next save.

        Provisioned over the API — fixture-building, not the action under test —
        because the form can no longer set these fields at all.

        RANK AND THE MYCA DATE, and not Region. That exclusion is pre-existing
        server behaviour this change did not introduce: Region drags in
        ProjectHelper's location chain, which then demands a Province and a City
        ("Selected Province '' is not valid."), although the V2 field spec makes
        all six location fields independently optional.

        Not UACS either, but for the opposite reason: it is not hidden. Since
        2026-09-06 it is typed on the form and fanned out by the server; it has
        its own test below. */
    const parent = await post(page, '/api/Lumpsum/ShowLumpSum', {
      Filters: {},
      limit: 1,
      page: 1,
      sortDirection: 0,
    });
    const programPK = (parent.body?.lists ?? [])[0]?.ProgramFK;
    expect(programPK, 'a program to hang the fixture on').toBeTruthy();

    const created = await post(page, '/api/Lumpsum/CreateLumpSum', {
      ProgramId: programPK,
      CategoryId: 16,
      SubCategoryId: 1082,
      OperatingUnit: 'OI46',
      Description: `hidden-field round trip (e2e ${new Date().toISOString().slice(0, 19)})`,
      Tier: 2,
      RegionWide: 1,
      Agency: 1001,
      Origin: 13,
      Rank: 7,
      MycaApprovalDate: '2026-03-15T00:00:00',
      Allocation: 2_000_000,
      FundingSource: 'GOP',
      FundingAgreement: 'DPWH-GAA-2025',
      FundingProfiles: [],
      ComponentCosts: [],
      ComponentCostPerYear: [],
    });
    expect(created.status, `fixture create: ${JSON.stringify(created.body)}`).toBe(200);
    const id = created.body.LumpSumId;

    try {
      const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: id });
      expect(Number(before.body.LumpSumProject.Rank), 'the fixture should carry a Rank').toBe(7);
      expect(before.body.LumpSumProject.MYCAApprovalDate, 'and a MYCA date').not.toBeNull();

      await page.goto(`/lumpsum/${id}`);
      await expect(page.getByText('Project Details').first()).toBeVisible({ timeout: 20000 });

      // Not rendered at all — from here on the values live only in form state.
      await expect(page.getByText(/^Rank:$/)).toHaveCount(0);
      await expect(page.getByText(/^MYCA Approval Date:$/)).toHaveCount(0);

      /*  ASSERT ON THE REQUEST, not on a full save round trip. What this change
          could break is the PAYLOAD — whether a field with no input still contributes
          its value — and the payload is where the answer is unambiguous. Reading
          it back afterwards would also pass or fail on server-side persistence
          quirks that have nothing to do with the form. */
      const [request] = await Promise.all([
        page.waitForRequest(
          (r) => r.url().includes('/Lumpsum/UpdateLumpSum') && r.method() === 'POST',
          { timeout: 30000 },
        ),
        (async () => {
          await page.getByRole('button', { name: 'Save Lump Sum Project' }).click();
          /*  WAIT FOR THE DIALOG between the clicks. Without this the second
              click resolves while only the page's own button exists and simply
              presses it again — the confirm never happens, no request is sent,
              and the failure reads as "the app did not call the API". */
          await expect(page.getByText(/Save this Lump Sum Project/i)).toBeVisible();
          await page.getByRole('button', { name: 'Save Lump Sum Project' }).last().click();
        })(),
      ]);

      const sent = JSON.parse(request.postData() ?? '{}');
      expect(Number(sent.Rank), 'a hidden Rank must still be submitted').toBe(7);
      expect(sent.MycaApprovalDate, 'a hidden MYCA date must still be submitted').toBeTruthy();
      expect(sent.LumpSumId, 'and it is the right project').toBe(id);
    } finally {
      await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: id });
    }
  });

  test('replenish: cancel changes nothing, then a real top-up raises the allocation', async ({
    page,
  }) => {
    test.skip(!lumpSumId, 'create must have run');
    /*  Registered before navigation so the whole page life is watched. Under
        local-until-save this list must stay EMPTY: the dialog makes no request. */
    const replenishCalls = captureApiCalls(page, ['/Lumpsum/ReplenishLumpSum']);
    await page.goto(`/lumpsum/${lumpSumId}`);

    await page.getByRole('button', { name: 'Replenish' }).click();
    await expect(page.getByRole('heading', { name: 'Replenish Lump Sum Project' })).toBeVisible();

    /*  The client mirrors the server's rule — NewAmount is the new TOTAL and
        must exceed the current one — so a decrease is refused without a round
        trip, in the same words. */
    await page.locator('input[placeholder="0.00"]').fill('1000');
    await page.getByRole('button', { name: 'Replenish' }).last().click();
    /*  Matched on "The new total must be…", not on "must be greater than the
        current allocation" — the dialog's own hint text says nearly the same
        thing, and the looser pattern matches both the hint and the toast. */
    await expect(page.getByText(/The new total must be greater than/i)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Replenish Lump Sum Project' })).toHaveCount(0);

    // Cancel must not have changed anything.
    let balance = await page.request.post(`${API}/api/Lumpsum/LumpSumBalance`, {
      data: { LumpSumId: lumpSumId },
    });
    expect(Number((await balance.json()).Total)).toBe(ALLOCATION);

    // Now the real one.
    await page.getByRole('button', { name: 'Replenish' }).click();
    await page.locator('input[placeholder="0.00"]').fill(String(REPLENISH_TO));
    await page.getByRole('button', { name: 'Replenish' }).last().click();

    /*  LOCAL UNTIL SAVE (2026-09-08). The dialog closing is no longer a write
        landing — it is a draft line joining the form. So this step asserts the
        three things that make the change visible without a request: the row is
        in the table marked Unsaved, the balance widget carries the delta and
        says so, and Import (which would re-read the parent and discard the
        draft) is disabled. Then it presses Save and asserts the payload carried
        the draft as an Id-0 line, and only then does the server agree. */
    await expect(page.getByRole('heading', { name: 'Replenish Lump Sum Project' }))
      .toHaveCount(0, { timeout: 30000 });

    await expect(page.locator('[data-unsaved-line]')).toHaveCount(1);
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();
    await expect(page.locator('[data-unsaved-marker]').first()).toContainText('unsaved');
    await expect(page.getByRole('button', { name: 'Import Itemized Projects' })).toBeDisabled();

    // Nothing reached the server: not the endpoint, not the figure.
    expect(replenishCalls.length, 'the dialog must not call ReplenishLumpSum').toBe(0);
    balance = await page.request.post(`${API}/api/Lumpsum/LumpSumBalance`, {
      data: { LumpSumId: lumpSumId },
    });
    expect(Number((await balance.json()).Total), 'unsaved means unsaved').toBe(ALLOCATION);

    // Save carries the draft as the one Id-0 line, for exactly the difference.
    const [request] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes('/Lumpsum/UpdateLumpSum') && r.method() === 'POST',
        { timeout: 30000 },
      ),
      (async () => {
        await page.getByRole('button', { name: 'Save Lump Sum Project' }).click();
        await expect(page.getByText(/Save this Lump Sum Project/i)).toBeVisible();
        await page.getByRole('button', { name: 'Save Lump Sum Project' }).last().click();
      })(),
    ]);
    const sent = JSON.parse(request.postData() ?? '{}');
    const drafts = (sent.FundingProfiles ?? []).filter((f: any) => Number(f.Id) === 0 && !f.IsDeleted);
    expect(drafts.length, 'one new funding line in the save').toBe(1);
    expect(Number(drafts[0].Amount), 'carrying the difference, not the new total').toBe(REPLENISH_TO - ALLOCATION);

    // After the save's own re-read the row has an Id and nothing is marked unsaved.
    await expect(page.locator('[data-unsaved-line]')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('[data-unsaved-marker]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import Itemized Projects' })).toBeEnabled();
    expect(replenishCalls.length, 'still no ReplenishLumpSum call').toBe(0);

    /*  Polled rather than read once: the save returning and the row being
        readable are two different moments, and asserting on the second one
        directly is what makes this independent of how fast the first was. */
    await expect
      .poll(
        async () => {
          const res = await page.request.post(`${API}/api/Lumpsum/LumpSumBalance`, {
            data: { LumpSumId: lumpSumId },
          });
          return Number((await res.json()).Total);
        },
        { timeout: 15000, message: 'the server agrees with the screen' },
      )
      .toBe(REPLENISH_TO);
  });

  test('a save whose answer is lost cannot be pressed again: the draft is inserted once', async ({
    page,
  }) => {
    /*  FINDING 2 OF THE 2026-09-10 REVIEW. The save used to be two requests —
        UpdateLumpSum, then LumpSumDetails to fetch the new Ids — and every
        recovery step in the form sat after the second one: the draft stayed
        in state with Id 0, the confirm dialog stayed OPEN, and pressing it
        again inserted the same line a second time. The server accepts any
        positive new line, so nothing stopped it.

        This test makes the save's answer vanish AFTER the server has committed
        it — route.fetch() lets the request through, route.abort() then fails
        it in the browser — which is the shape of a timeout on a slow database.
        The rule under test: an answer the client did not get is an unknown
        outcome, and an unknown outcome is never resubmitted on a guess. */
    const owner = await provisionLumpSum(page, 5_000_000, 'UI-SAVE-AMBIGUOUS');
    const TOP_UP_TO = 6_500_000;

    const linesOf = async () => {
      const res = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
      return (res.body?.FundingProfiles ?? []).filter((f: any) => !f.IsDeleted);
    };
    const totalOf = async () => {
      const res = await post(page, '/api/Lumpsum/LumpSumBalance', { LumpSumId: owner.lumpSumId });
      return Number(res.body?.Total);
    };
    const linesBefore = (await linesOf()).length;

    await page.goto(`/lumpsum/${owner.lumpSumId}`);
    await page.getByRole('button', { name: 'Replenish' }).click();
    await page.locator('input[placeholder="0.00"]').fill(String(TOP_UP_TO));
    await page.getByRole('button', { name: 'Replenish' }).last().click();
    await expect(page.locator('[data-unsaved-line]')).toHaveCount(1);

    // The server hears the save; the browser never hears the answer.
    let served = 0;
    await page.route('**/Lumpsum/UpdateLumpSum', async (route) => {
      await route.fetch();
      served += 1;
      await route.abort('failed');
    });

    await page.getByRole('button', { name: 'Save Lump Sum Project' }).click();
    await expect(page.getByText(/Save this Lump Sum Project/i)).toBeVisible();
    await page.getByRole('button', { name: 'Save Lump Sum Project' }).last().click();
    await expect.poll(() => served).toBe(1);

    /*  THE COMMIT HAPPENED. That is the premise: the line exists once, and the
        page does not know it. */
    await expect.poll(linesOf).toHaveLength(linesBefore + 1);
    expect(await totalOf(), 'the top-up landed once').toBe(TOP_UP_TO);

    /*  And the page must not offer to send it again. Before the fix the confirm
        dialog stayed open with its button live — the second press was one
        click away. */
    await expect(page.getByText(/Save this Lump Sum Project/i), 'the confirm must close').toHaveCount(0);

    /*  It reloads instead, and the draft is replaced by the persisted line —
        no Unsaved marker, and Save comes back only once that has happened. */
    await page.unroute('**/Lumpsum/UpdateLumpSum');
    await expect(page.locator('[data-unsaved-line]')).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Save Lump Sum Project' })).toBeEnabled();

    // A second Save now carries no new line, and the total does not move.
    await page.getByRole('button', { name: 'Save Lump Sum Project' }).click();
    await expect(page.getByText(/Save this Lump Sum Project/i)).toBeVisible();
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/Lumpsum/UpdateLumpSum') && r.method() === 'POST'),
      page.getByRole('button', { name: 'Save Lump Sum Project' }).last().click(),
    ]);
    const sent = JSON.parse(request.postData() ?? '{}');
    expect((sent.FundingProfiles ?? []).filter((f: any) => Number(f.Id) === 0).length, 'no draft left to send').toBe(0);
    await expect(page.locator('[data-unsaved-line]')).toHaveCount(0);
    await expect.poll(linesOf).toHaveLength(linesBefore + 1);
    expect(await totalOf(), 'still once').toBe(TOP_UP_TO);
  });

  test('import: the dialog opens, states the remaining allocation, and cancels cleanly', async ({
    page,
  }) => {
    test.skip(!lumpSumId, 'create must have run');
    await page.goto(`/lumpsum/${lumpSumId}`);

    /*  Opening it calls ValidateForItemization first, which answers 200-shaped
        either way — so a refusal arrives as a warning toast and the dialog
        simply does not open. Here it should open. */
    await page.getByRole('button', { name: 'Import Itemized Projects' }).click();
    await expect(page.getByRole('heading', { name: 'Import Itemized Projects' })).toBeVisible({
      timeout: 20000,
    });

    // The banner names the project and what is left to spend.
    await expect(page.getByText('Remaining:', { exact: false }).first()).toBeVisible();

    /*  IT DOES NOT CLOSE BY ACCIDENT (2026-09-10). This dialog is the only route
        to the warning report and the error workbook — both are fetched by a
        filename held in its own state — so a stray click on the backdrop of a
        modal this wide used to throw them away silently. Headless UI routes the
        backdrop AND Escape through onClose, which is now a no-op; the X and the
        footer button are the only ways out. This test used to close with
        Escape, which is exactly the reflex the change removes. */
    const heading = page.getByRole('heading', { name: 'Import Itemized Projects' });

    // A click well outside the panel: the backdrop covers the whole viewport.
    await page.mouse.click(5, 5);
    await expect(heading, 'a backdrop click must not close it').toBeVisible();

    await page.keyboard.press('Escape');
    await expect(heading, 'Escape must not close it either').toBeVisible();

    /*  Nothing was imported here, so there is no download to strand and Cancel
        closes straight through — the confirm is asserted where a file exists. */
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(heading).toHaveCount(0);
  });

  test('closing the import dialog with a report waiting warns first, and Cancel keeps it', async ({ page }) => {
    /*  THE DOWNLOAD LIVES AND DIES WITH THIS DIALOG. The warning report is
        fetched by a filename held in the dialog's own state; nothing on the page
        behind it holds that name, and the only way to get another is to import
        the workbook again. So closing while one is on offer asks first.

        Its own parent: this import creates a child and draws the allocation
        down, and the walkthrough's project is the subject of the tests after
        this one. The sweeper removes it — provisionLumpSum marks it. */
    const owner = await provisionLumpSum(page, 8_000_000, 'UI-IMPORT-CLOSE');

    /*  A row that WARNS rather than fails: an unreadable Rank is imported and
        reported (the server stores it blank), which is the cheapest way to a
        real warning report — the same class the contract suite pins. */
    const workbook = await buildImportWorkbook(page, [{
      placeholderId: 'UI-IMPORT-CLOSE-1',
      description: `UI-IMPORT-CLOSE child (e2e ${new Date().toISOString().slice(0, 19)})`,
      cost: 1_000_000,
      activityYear: importActivityYear(owner),
      projectDetails: { Rank: 'abc' },
    }]);

    await page.goto(`/lumpsum/${owner.lumpSumId}`);
    await page.getByRole('button', { name: 'Import Itemized Projects' }).click();
    const heading = page.getByRole('heading', { name: 'Import Itemized Projects' });
    await expect(heading).toBeVisible({ timeout: 20000 });

    await page.locator('input[type="file"]').setInputFiles({
      name: 'itemized-projects.xlsm',
      mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
      buffer: workbook,
    });
    await page.getByRole('button', { name: /^Import/ }).click();

    /*  A warned import KEEPS the dialog open — that is the pre-existing rule this
        one builds on — and offers the report. */
    const download = page.getByRole('button', { name: 'Download warning report' });
    await expect(download, 'the report is on offer').toBeVisible({ timeout: 60000 });

    // Neither reflex closes it, so neither can strand the report.
    await page.mouse.click(5, 5);
    await expect(heading, 'a backdrop click must not close it').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(heading, 'Escape must not close it').toBeVisible();

    // Done asks first, in the client's words.
    await page.getByRole('button', { name: 'Done' }).click();
    const warning = page.locator('[data-close-warning]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('You are closing the import dialog.');
    await expect(warning).toContainText('Download the warning report and error Excel workbook files');

    // Cancel goes back, with the report still there — the whole point.
    await warning.getByRole('button', { name: 'Cancel' }).click();
    await expect(warning).toHaveCount(0);
    await expect(download, 'the report survived the near miss').toBeVisible();
    await expect(heading).toBeVisible();

    /*  THE OTHER DOOR ONTO THE SAME LOSS. The drop zone stays live behind a
        result on purpose — a rejected workbook is meant to be corrected and
        chosen again — so loading a second file discards the first run's report
        exactly as closing would. It asks in the same words. */
    await page.locator('input[type="file"]').setInputFiles({
      name: 'itemized-projects.xlsm',
      mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
      buffer: workbook,
    });
    const replace = page.locator('[data-close-warning]');
    await expect(replace).toBeVisible();
    await expect(replace).toContainText('You are replacing the workbook.');
    await replace.getByRole('button', { name: 'Cancel' }).click();
    await expect(download, 'the report survived the replace too').toBeVisible();

    // And the deliberate way out still works.
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('[data-close-warning]').getByRole('button', { name: 'Close anyway' }).click();
    await expect(heading).toHaveCount(0);
  });

  test('activity is fetched on expand and reports what actually happened', async ({ page }) => {
    test.skip(!lumpSumId, 'create must have run');
    await page.goto(`/lumpsum/${lumpSumId}`);

    await page.getByText('Activity', { exact: true }).click();

    /*  Reconstructed from audit columns, and the panel says so rather than
        implying an event log exists. */
    await expect(page.getByText(/not a full audit trail/i)).toBeVisible();
    await expect(page.getByText(/created at/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('delete: the dialog cancels, then removes the project and returns to the list', async ({
    page,
  }) => {
    test.skip(!lumpSumId, 'create must have run');
    await page.goto(`/lumpsum/${lumpSumId}`);

    await page.getByRole('button', { name: 'Delete Lump Sum Project' }).click();
    await expect(page.getByRole('heading', { name: 'Delete Lump Sum Project' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Still there after cancel.
    let listed = await page.request.post(`${API}/api/Lumpsum/ShowLumpSum`, {
      data: { Filters: {}, limit: 200, page: 1, sortDirection: 0 },
    });
    expect(((await listed.json()).lists ?? []).some((r: any) => r.Id === lumpSumId)).toBe(true);

    await page.getByRole('button', { name: 'Delete Lump Sum Project' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await page.waitForURL(/\/lumpsum$/, { timeout: 30000 });

    listed = await page.request.post(`${API}/api/Lumpsum/ShowLumpSum`, {
      data: { Filters: {}, limit: 200, page: 1, sortDirection: 0 },
    });
    expect(
      ((await listed.json()).lists ?? []).some((r: any) => r.Id === lumpSumId),
      'the project is gone from the server, not just from the screen',
    ).toBe(false);
  });

  test('an itemized parent keeps its later funding lines removable, but not the one it was created with', async ({ page }) => {
    /*  2026-09-07. Being itemized freezes this form — except the Funding
        Profile's Delete. A line recorded against the wrong source cannot be
        typed over (the table is read-only) and Replenish only appends, so
        removing it is the only repair, and an itemized parent is where a wrong
        line tends to be noticed. What stays protected there is the FOUNDING
        line, the allocation the children were imported against; every later line
        is a Replenish top-up and goes. Save follows the import lock alone, so the
        removal can be persisted — it can carry nothing else, every other control
        being disabled. */
    test.setTimeout(180000);
    const parent = await provisionLumpSum(page, 6_000_000, 'UI-FREEZE funding');

    // A second funding line, so there is one of each kind to look at.
    const topUp = await post(page, '/api/Lumpsum/ReplenishLumpSum', { LumpSumId: parent.lumpSumId, NewAmount: 8_000_000 });
    expect(topUp.status, `replenish: ${JSON.stringify(topUp.body).slice(0, 160)}`).toBe(200);

    const child = await importChild(page, parent, 1_000_000, `UI-FREEZE child ${Date.now().toString().slice(-6)}`);
    expect(child.status, `import: ${JSON.stringify(child.body).slice(0, 200)}`).toBe(200);

    await page.goto(`/lumpsum/${parent.lumpSumId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Funding Profile').first()).toBeVisible({ timeout: 30000 });

    // The freeze is on: the banner names the child, and Project Details is locked.
    await expect(page.getByText(/Locked by 1 itemized project/)).toHaveCount(1);
    await expect(page.getByPlaceholder('Describe this Lump Sum Project')).toBeDisabled();

    // Two funding lines: the founding one held, the top-up removable.
    const held = page.getByTitle(/cannot be removed while projects are itemized/);
    const removable = page.getByTitle('Remove this funding line');
    await expect(held, 'the founding line is protected').toHaveCount(1);
    await expect(held).toBeDisabled();
    await expect(removable, "Replenish's line stays removable").toHaveCount(1);
    await expect(removable).toBeEnabled();

    // And Save is available, so the removal could be persisted.
    await expect(page.getByRole('button', { name: 'Save Lump Sum Project' }).first()).toBeEnabled();

    /*  With the child gone the protection lifts and BOTH lines are removable —
        the state is derived from the live count, nothing is stored. */
    const kids = await post(page, '/api/Lumpsum/ShowItemizedProjects', { Filters: { LumpSumId: parent.lumpSumId }, Navigation: 0, PageSize: 100 });
    const born = ((kids.body?.lists ?? []) as any[])[0];
    expect(born, 'the imported child').toBeTruthy();
    const removed = await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: born.ProjectPK });
    expect(removed.status).toBe(200);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Funding Profile').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Locked by \d+ itemized project/), 'thawed').toHaveCount(0);
    await expect(page.getByTitle(/cannot be removed while projects are itemized/), 'nothing is protected now').toHaveCount(0);
    await expect(page.getByTitle('Remove this funding line'), 'both lines removable').toHaveCount(2);
  });

});
