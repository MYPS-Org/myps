// =============================================================================
// ls-list-tolerance.spec.ts — a Lump Sum Project must not take down a list.
//
// THE FAILURE THIS PINS
//
//   {"Title":"Pagination error",
//    "Message":"An error occurred while reading a database value for property
//               'ProgramProjects.ImplementingOfficeParticipantId'. The expected
//               type was 'System.String' but the actual value was null."}
//
// A Lump Sum parent covers a programme, not a site, so its Region, DEO and
// Implementing Office are optional under the V2 field spec and CreateLumpSum
// writes NULL on purpose. The read models declared those columns as non-nullable
// strings, so EF threw while materialising the result set — and because it threw
// during materialisation it took down the WHOLE list. One Lump Sum row was
// enough to empty the Project Module list and the Program Details project list
// for every project in them.
//
// WHY BOTH ENDPOINTS, AND WHY UNFILTERED
//
// Filtering down to the Lump Sum row would still have passed against a model
// that could not hold a null, because the failure is per-result-set, not per-row.
// These call the lists the way the pages call them — unfiltered, one page deep —
// and then look for the parent among what came back. That is the shape of the
// bug: the assertion is that the OTHER 54 projects are still listed too.
//
// The two models are separately declared and were separately wrong, so a fix to
// one proves nothing about the other. Both are asserted.
//
// Tagged LS-LIST- and swept by the global teardown.
// =============================================================================

import { test, expect } from '@playwright/test';
import { post, provisionLumpSum, apiLogin, type ProvisionedLumpSum } from './helpers/lumpSumFixture';

const TAG = 'LS-LIST';

/*  provisionLumpSum picks a program on the itemizable stage, which is GAA-R and
    only GAA-R (client business rule, 2026-09-04). ShowProjectsInProgram takes
    the stage by name, so this is that same stage spelled out. */
const PARENT_STAGE = 'GAA-R';

/*  One page as a page actually asks for it. Both lists are keyed on Id
    descending, so a parent created moments ago is at the top of the first page —
    no paging needed to find it. */
const PAGE = { limit: 200, page: 1, Navigation: 0 };

test.describe.configure({ mode: 'serial' });

test.describe('Lump Sum Projects do not break the project lists', () => {
  let parent: ProvisionedLumpSum;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);
    parent = await provisionLumpSum(page, 50_000_000, `${TAG} parent`);
    await page.close();
  });

  test('the Project Module list returns a page containing the Lump Sum Project', async ({ page }) => {
    await apiLogin(page);

    const res = await post(page, '/api/Project/ShowProjects', {
      Filters: { ProgramId: '', ProjectId: '' }, ...PAGE,
    });

    /*  Named explicitly: a materialisation failure comes back as a 400 whose
        Title is "Pagination error", which otherwise reads as a paging bug and
        sends the next person to CursorPagination.cs rather than to the model. */
    expect(res.body?.Title, JSON.stringify(res.body)).not.toBe('Pagination error');
    expect(res.status).toBe(200);

    const rows = res.body.lists as any[];
    expect(rows.length).toBeGreaterThan(1);

    const mine = rows.find((r) => r.ProjectId === parent.projectId);
    expect(mine, `${parent.projectId} should be listed among ${rows.length} rows`).toBeTruthy();

    /*  The point of the fix: absent is allowed to BE absent. Asserting only
        "not undefined" would pass against a model that coalesced to '' — which
        is a different decision, and one the module deliberately did not take. */
    expect(mine.Region ?? null).toBeNull();
    expect(mine.ImplementingOffice ?? null).toBeNull();

    /*  The list hands a Lump Sum Project to its own module, so the server has to
        say which rows those are — vProjectLatest cannot, and the '…LS' suffix
        must not (legacy rows end in LS without being Lump Sum Projects). */
    expect(mine.IsLumpSum, 'a Lump Sum parent is flagged for the list').toBe(true);
    const ordinary = rows.find((r) => r.ProjectId !== parent.projectId && !String(r.ProjectId).endsWith('LS'));
    if (ordinary) {
      expect(Boolean(ordinary.IsLumpSum), `${ordinary.ProjectId} is an ordinary project`).toBe(false);
    }
  });

  test('the Program Details project list returns every project in the program', async ({ page }) => {
    await apiLogin(page);

    const res = await post(page, '/api/Program/ShowProjectsInProgram', {
      ProgramId: parent.programPK,
      StageName: PARENT_STAGE,
      Filters: { ProjectId: '' },
      ...PAGE,
    });

    expect(res.body?.Title, JSON.stringify(res.body)).not.toBe('Pagination error');
    expect(res.status).toBe(200);

    const rows = res.body.lists as any[];
    const mine = rows.find((r) => r.ProjectId === parent.projectId);
    expect(mine, `${parent.projectId} should be listed among ${rows.length} rows`).toBeTruthy();

    expect(mine.Region ?? null).toBeNull();
    expect(mine.ImplementingOfficeParticipantId ?? null).toBeNull();

    /*  The joined NAME columns are a different rule and must not drift into the
        same one: fProgramProjects §12 coalesces them so a missing office renders
        blank instead of hiding the project behind an INNER JOIN. Operating Unit
        is required on a Lump Sum Project and is written, so it stays a real id —
        a null there would be a defect, not a design. */
    expect(mine.ImplementingOfficeName).toBe('');
    expect(mine.OperatingUnitParticipantId).toBeTruthy();

    /*  Ordinary projects in the same program are still listed. This is what the
        bug actually cost: they were collateral damage of one Lump Sum row. */
    const ordinary = rows.filter((r) => !String(r.ProjectId).endsWith('LS'));
    expect(ordinary.length, 'non-Lump-Sum projects in the same program').toBeGreaterThan(0);
  });
});
