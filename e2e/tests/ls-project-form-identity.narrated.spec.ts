// =============================================================================
// ls-project-form-identity.narrated.spec.ts — a Lump Sum Project in the ordinary
// Project form.
//
// WHAT IT GUARDS. A Lump Sum Project is an ordinary tProjects row, so it opens
// in /projects/project-details/… like any other. That form used to auto-populate
// IslandCode and ProjectType from the selected Region — which for this record
// destroys the two fields that define it:
//
//   IslandCode 'LS' is the marker isLumpSum reads, and the gate for every
//   location and organizational exemption on that form.
//
//   ProjectType 'LS' is what CK_tProjects_ProjectType permits, and what keeps
//   fProgramStages' guard (ProjectType <> 'LS') excluding the project from the
//   program cost. Overwrite it and the save fails on a raw constraint error;
//   were it to succeed, the project's cost would be counted TWICE.
//
// This was decision 13 of the Lump Sum V2 plan and carried no task for weeks,
// which is how it survived three frontend commits. The guard was J6.
//
// WHAT CHANGED. The ownership work went further than J6: the whole form is now
// read-only for a Lump Sum parent, with a banner saying why. That SUBSUMES J6 —
// Region cannot be changed at all — so the second test asserts the form is dead
// and says so, rather than driving Region and checking the damage was contained.
// J6's narrower guard stays in the code: it costs nothing and still holds if the
// read-only gate is ever bypassed or the form reused.
//
// PREREQUISITE: Vite proxying to the local API —
//   cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { post, provisionLumpSum, lumpSum, type ProvisionedLumpSum } from './helpers/lumpSumFixture';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

/*  THE ROUTE PARAM IS A COMPOSITE: "ProjectId:StageName", split on the colon by
    EditProject. Given only the ProjectId it renders the app shell and an empty
    page — no error, no console warning, nothing to suggest the URL was wrong. */
let detailsPath = '';

/*  Is the control in this labelled row dead? Native inputs report it directly;
    the SearchableDropdowns are divs, and ProjectDetailsForm marks a disabled one
    with cursor-not-allowed. Same probe as ls-module-ui-walkthrough. */
const isFieldDisabled = async (page: Page, label: RegExp): Promise<boolean> => {
  const row = page.locator('label').filter({ hasText: label }).first().locator('xpath=..');

  const native = row.locator('input, select, textarea');
  if ((await native.count()) > 0) return native.first().isDisabled();

  const dropdown = row.locator('div.relative > div').first();
  return ((await dropdown.getAttribute('class')) ?? '').includes('cursor-not-allowed');
};

/** The Lump Sum Project as vLumpSumSet reports it, or null if it has left the view. */
const asLumpSum = async (page: Page, lumpSumId: number) => {
  const res = await post(page, '/api/Lumpsum/ShowLumpSum', {
    Filters: {},
    limit: 200,
    page: 1,
    sortDirection: 0,
  });
  return ((res.body?.lists ?? []) as any[]).find((r) => r.Id === lumpSumId) ?? null;
};

/*  WAS BLOCKED ON THIS DATABASE; NO LONGER.

    /projects/project-details/… used to render the app shell and nothing else
    here — no headings, no labels, no error — because /projects itself reported
    "No records found" on this restore. The page could not be exercised for ANY
    project, Lump Sum or ordinary, so this spec self-skipped and J6 was verified
    by reasoning and tsc rather than by a click.

    The cause was not a missing dataset. ProjectLatest declared Region and
    ImplementingOffice as non-nullable strings, and a Lump Sum parent has
    neither, so EF threw while materialising vProjectLatest and took the whole
    list down with it. Making those two nullable fixed the list and enabled this
    spec — see ls-list-tolerance.spec.ts.

    The check below stays. It is what let the spec turn itself on the day the
    blocker cleared, instead of a static skip nobody would have revisited, and
    it costs one request. */
const projectsHaveData = async (page: Page): Promise<boolean> => {
  const res = await post(page, '/api/Project/showprojects', {
    Filters: {},
    limit: 5,
    page: 1,
    sortDirection: 0,
  }).catch(() => null);
  return ((res?.body?.lists ?? []) as any[]).length > 0;
};

test.describe('a Lump Sum Project in the ordinary Project form', () => {
  test.use({ viewport: { width: 1440, height: 1600 } });

  let parent: ProvisionedLumpSum;
  let enabled = false;

  test.beforeEach(() => {
    test.skip(
      !enabled,
      'the Projects module has no data on this database — /projects reports "No records found", ' +
        'so project-details cannot be opened for any project. Not specific to Lump Sum.',
    );
  });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.request.post(`${API}/api/Auth/Login`, {
      data: {
        UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
        Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
      },
    });
    parent = await provisionLumpSum(page, 3_000_000, 'project-form identity');

    const row = await lumpSum(page, parent.lumpSumId);
    expect(row, 'the provisioned project should be listed').toBeTruthy();
    detailsPath = `/projects/project-details/${parent.projectId}:${row.StageName}`;

    enabled = await projectsHaveData(page);
    if (!enabled) {
      console.warn(
        '[ls-project-form-identity] skipped: the Projects module returns no rows on this ' +
          'database, so /projects/project-details cannot be opened for any project.',
      );
    }

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.request.post(`${API}/api/Auth/Login`, {
      data: {
        UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
        Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
      },
    });
    await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: parent.lumpSumId });
    await page.close();
  });

  test('it opens there at all, and is recognised as a Lump Sum Project', async ({ page }) => {
    await login(page, process.env.E2E_USERNAME ?? 'jimeneznr', process.env.E2E_PASSWORD ?? 'AnyPassword');
    await page.goto(detailsPath);

    await expect(page.getByText('Project Details').first()).toBeVisible({ timeout: 30000 });

    /*  The LS exemptions are the visible proof that IslandCode === 'LS' resolved
        true: for an ordinary project Province, City and Legislative District are
        required and carry an asterisk; for this one they must not. */
    const province = page.locator('label').filter({ hasText: /^Province:$/ }).first();
    await expect(province, 'Province must not be marked required on a Lump Sum Project')
      .toBeVisible();
    await expect(province.locator('span.text-red-500')).toHaveCount(0);
  });

  test('the form is read-only, and says so, so its identity cannot be rewritten', async ({ page }) => {
    await login(page, process.env.E2E_USERNAME ?? 'jimeneznr', process.env.E2E_PASSWORD ?? 'AnyPassword');
    await page.goto(detailsPath);
    await expect(page.getByText('Project Details').first()).toBeVisible({ timeout: 30000 });

    const before = await asLumpSum(page, parent.lumpSumId);
    expect(before, 'the project should be in vLumpSumSet').toBeTruthy();
    expect(before.ProjectType).toBe('LS');

    /*  THE BANNER. A form whose every field is dead and which offers no Save
        looks broken; this is what tells the user it is deliberate and where to
        go instead. Asserting it is the difference between "read-only" and
        "silently inert". */
    await expect(page.getByText('This is a Lump Sum Project')).toBeVisible();
    const link = page.getByRole('link', { name: 'Go to the Lump Sum module' });
    await expect(link).toBeVisible();
    /*  The LIST, not /lumpsum/:id — the detail route takes vLumpSumSet's numeric
        Id, which the Project module cannot resolve from a ProjectId. */
    await expect(link).toHaveAttribute('href', '/lumpsum');

    /*  REGION IS THE ONE THAT MATTERED. Selecting a Region used to auto-populate
        IslandCode and ProjectType from it, destroying the two fields that define
        a Lump Sum Project — decision 13, guarded by J6. The read-only form
        subsumes that guard by making the field unreachable, which is why this
        asserts the field is dead rather than driving it and checking the damage
        was contained. */
    expect(await isFieldDisabled(page, /^\*Region:$/), 'Region must be read-only').toBe(true);

    /*  Region alone would prove nothing: ProjectDetailsForm disables it whenever
        mode === 'edit', for every project. These three are gated on the disabled
        flag ONLY, so on an ordinary project in this same form they are editable
        — they are dead here because this record is a Lump Sum Project. */
    for (const field of [/^\*Description:$/, /^\*Category:$/, /^Alternate ID:$/]) {
      expect(await isFieldDisabled(page, field), `${field} must be read-only`).toBe(true);
    }

    /*  NO WAY TO COMMIT ONE. Fields being disabled is not enough on its own — a
        Save button still present would post whatever state the form holds.

        Matched on the FULL control names. A looser /^(Save|Update)/ also catches
        "Updated0", the transaction-log filter tab at the bottom of this page,
        and reports a save control that was never there. */
    await expect(page.getByRole('button', { name: 'Update Project' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save Project' })).toHaveCount(0);

    /*  Nor a revision, which is the other way out of this form. RevisionController
        refuses a Lump Sum parent; this is the control that would have asked. */
    await expect(page.getByRole('button', { name: /Revise Project/ })).toHaveCount(0);

    /*  The sections below Project Details take the same disabled flag, and each
        keeps its Add control rendered-but-dead. Worth asserting separately: they
        are separate components, and a Lump Sum Project gaining a funding line
        from the Project module would move its allocation with none of the Lump
        Sum module's arithmetic applied. */
    for (const control of ['Add Funding', 'Add Component', 'Add Major Item']) {
      await expect(
        page.getByRole('button', { name: control }),
        `${control} must be disabled on a Lump Sum Project`,
      ).toBeDisabled();
    }

    /*  And the record is untouched by having been opened at all. */
    const after = await asLumpSum(page, parent.lumpSumId);
    expect(after, 'the project must still be a Lump Sum Project').toBeTruthy();
    expect(after.ProjectType, 'ProjectType must still be LS').toBe('LS');
    expect(after.ProjectId, 'the generated ID is immutable and still ends in LS').toMatch(/LS$/);
  });
});
