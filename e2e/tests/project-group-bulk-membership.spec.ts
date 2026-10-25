// =============================================================================
// project-group-bulk-membership.spec.ts — Project Group Details: add many
// projects by pasting their IDs, remove many by ticking rows (UAT S05, #452).
// Plan: documents/plans/project-group-bulk-membership.md.
//
// WHAT THIS PINS.
//   - Add is partial success: one request, and each ID comes back in exactly one
//     group (Added / Already in this group / In another group / Not found). It
//     used to be all-or-nothing, so one typo rejected the whole paste.
//   - A project in another group is never moved.
//   - Remove only touches projects in THIS group. The old DeleteProject took a
//     bare ProjectId and unlinked it from whichever group held it.
//   - After add/remove the table refreshes in place: an unsaved Description edit
//     survives. A refresh through fetchProjectGroupDetails would overwrite it.
//   - Update saves while the group has projects. The page used to send the project
//     rows too, and the API refused them (400 on their numeric Category).
//   - A Project ID opens /projects/project-details/<ProjectId>:<StageName>. The bare
//     ProjectId it used to open showed "Project Not Available".
//
// NO GROUP IS EVER DELETED. Delete Project Group is a soft delete
// (tProjectGroups.IsDeleted = 1), and nothing in this suite may run one. So the
// file reuses two fixture groups, finds them by name, creates them only when
// missing, and leaves them EMPTY. Removing a project from a group only nulls
// tProjects.ProjectGroupFK, so a run leaves behind only tTransactionLog rows.
// If a fixture group was soft-deleted by hand, AddProjectGroup refuses its name
// as a duplicate. The setup then fails and names the group.
//
// DO NOT ADD login() TO THIS FILE. apiLogin() already signs the browser in (see
// e2e/CLAUDE.md, "Login flow").
// =============================================================================

import { test, expect, type Page } from '@playwright/test';

/*  Same API addressing and login as helpers/lumpSumFixture.ts. Kept local so this
    file does not load the Lump Sum helpers and their workbook (xlsx) dependency. */
const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

const post = async (page: Page, url: string, data: unknown) => {
  const res = await page.request.post(`${API}${url}`, { data });
  const text = await res.text();
  try { return { status: res.status(), body: JSON.parse(text) as any }; }
  catch { return { status: res.status(), body: text as any }; }
};

/** Signs the browser in too: page.request shares the context's cookie jar. */
const apiLogin = async (page: Page) => {
  const res = await post(page, '/api/Auth/Login', {
    UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
    Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
  });
  if (res.status !== 200) throw new Error(`API login failed (${res.status}). Set E2E_USERNAME / E2E_PASSWORD.`);
};

const FIXTURE_GROUP = 'E2E project group bulk membership fixture';
const OTHER_FIXTURE_GROUP = 'E2E project group bulk membership fixture (other)';
const FIXTURE_DESCRIPTION = 'Used by e2e/tests/project-group-bulk-membership.spec.ts. Left empty after every run.';

interface FixtureGroup { GroupId: string; Name: string }

/** Every live group whose name contains `name`, as the Project Groups list asks for them. */
const listGroups = async (page: Page, filters: { Name?: string; ProjectId?: string }) => {
  const res = await post(page, '/api/projectgroup/showprojectgroups', {
    Filters: { Name: '', UserGroupName: '', ...filters },
    limit: 20, page: 1, Navigation: 0,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as { lists: { GroupId: string; Name: string }[]; Dropdowns: { UserGroups: { Id: number }[] } };
};

const groupProjects = async (page: Page, groupId: string): Promise<string[]> => {
  const res = await post(page, '/api/projectgroup/projectgroupdetails', { GroupId: groupId });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return ((res.body.Projects ?? []) as { ProjectId: string }[]).map((p) => p.ProjectId);
};

/** Unlinks every project from the group (an FK update, not a delete). */
const emptyGroup = async (page: Page, groupId: string) => {
  const ids = await groupProjects(page, groupId);
  if (ids.length === 0) return;
  const res = await post(page, '/api/projectgroup/deleteproject', { GroupId: groupId, ProjectIds: ids });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
};

/** The named fixture group, created on first use, with no projects in it. */
const ensureEmptyGroup = async (page: Page, name: string): Promise<FixtureGroup> => {
  const listed = await listGroups(page, { Name: name });
  let group = listed.lists.find((g) => g.Name === name);
  if (!group) {
    const userGroup = listed.Dropdowns.UserGroups[0];
    expect(userGroup, 'a user group to own the fixture group').toBeTruthy();
    const res = await post(page, '/api/projectgroup/addprojectgroup', {
      Name: name,
      Description: FIXTURE_DESCRIPTION,
      UserGroup: userGroup.Id,
    });
    expect(res.status, `create fixture group "${name}": ${JSON.stringify(res.body)}`).toBe(200);
    group = { GroupId: res.body.NewGroupId, Name: name };
  }
  await emptyGroup(page, group.GroupId);
  return { GroupId: group.GroupId, Name: group.Name };
};

interface ListedProject { ProjectId: string; ProjectPK: string; IsLumpSum?: boolean }

/**
 * `count` projects that are in no group, asked of the server rather than named.
 *
 * Group members are read group by group (about 0.1 s each). The list's ProjectId filter
 * would answer "is this project grouped?" directly, but it takes up to 11 s per call on
 * a 120k-project database, and a few of those used up the whole test budget.
 */
const ungroupedProjects = async (page: Page, count: number): Promise<ListedProject[]> => {
  const groups = await post(page, '/api/projectgroup/showprojectgroups', {
    Filters: { Name: '', UserGroupName: '' }, limit: 200, page: 1, Navigation: 0,
  });
  expect(groups.status, JSON.stringify(groups.body)).toBe(200);
  expect(groups.body.total, 'live project groups; one page of 200 is read').toBeLessThanOrEqual(200);
  const grouped = new Set<string>();
  for (const g of groups.body.lists as { GroupId: string }[]) {
    for (const id of await groupProjects(page, g.GroupId)) grouped.add(id.toLowerCase());
  }

  const res = await post(page, '/api/Project/showprojects', {
    Filters: { ProjectId: '' }, limit: 50, page: 1, Navigation: 0,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const found: ListedProject[] = [];
  for (const row of (res.body.lists ?? []) as ListedProject[]) {
    if (found.length === count) break;
    if (!row.ProjectId || grouped.has(row.ProjectId.toLowerCase()) || found.some((p) => p.ProjectId === row.ProjectId)) continue;
    found.push(row);
  }
  expect(found.length, `ungrouped projects on the first page of the project list`).toBe(count);
  return found;
};

/** The Projects table row for one ProjectId, by its first cell's link button. */
const projectRow = (page: Page, projectId: string) =>
  page.locator('tbody tr').filter({ has: page.getByRole('button', { name: projectId, exact: true }) });

const isApi = (action: string) => (r: { url(): string; request(): { method(): string } }) =>
  r.url().toLowerCase().includes(`/projectgroup/${action}`) && r.request().method() === 'POST';

test.describe('Project Group Details — bulk add / remove', () => {
  test('paste-add reports each ID, then row and checkbox remove empty the table', async ({ page }) => {
    await apiLogin(page);
    const group = await ensureEmptyGroup(page, FIXTURE_GROUP);
    const [a, b, c] = (await ungroupedProjects(page, 3)).map((p) => p.ProjectId);
    const bogus = `ZZE2E${Date.now()}`;

    try {
      await page.goto(`/project-groups/${group.GroupId}`);
      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove selected (0)' })).toBeDisabled();

      // An unsaved edit. A refresh that reloads the whole page would overwrite it.
      const description = page.locator('label:text-is("Description") + textarea');
      const unsaved = `unsaved edit ${Date.now()}`;
      await description.fill(unsaved);

      // ---- Add: mixed separators, a typo, and a case-only duplicate -----------
      await page.getByRole('button', { name: 'Add Projects' }).click();
      const dialog = page.getByRole('dialog');
      const input = dialog.getByLabel('Project IDs');

      await dialog.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(dialog.getByText('Please enter at least one Project ID.')).toBeVisible();

      await input.fill(`${a}, ${bogus}\n${b};${c}\t${a.toLowerCase()}`);
      await expect(dialog.getByTestId('project-id-count')).toHaveText('4 project ID(s)');

      const added = page.waitForResponse(isApi('addproject'));
      await dialog.getByRole('button', { name: 'Add', exact: true }).click();
      expect((await added).status()).toBe(200);

      const result = dialog.getByTestId('add-projects-result');
      await expect(result.getByText('3 project(s) added to group.')).toBeVisible();
      await expect(result.getByText('Added (3)')).toBeVisible();
      await expect(result.getByText('Not found (1)')).toBeVisible();
      await expect(result.getByText(bogus, { exact: true })).toBeVisible();

      // ---- Add more: same dialog, back to input; a repeat is "Already in this group"
      await dialog.getByRole('button', { name: 'Add more' }).click();
      await expect(input).toHaveValue('');
      await input.fill(a);
      await dialog.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(result.getByText('No projects were added.')).toBeVisible();
      await expect(result.getByText('Already in this group (1)')).toBeVisible();

      // ---- Close: the table refreshes in place --------------------------------
      const refreshed = page.waitForResponse(isApi('projectgroupdetails'));
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await refreshed;
      for (const id of [a, b, c]) await expect(projectRow(page, id)).toHaveCount(1);
      await expect(description).toHaveValue(unsaved);

      // ---- Remove one through its row's trash icon -----------------------------
      await page.getByRole('button', { name: `Remove ${c}` }).click();
      const confirm = page.getByRole('dialog');
      await expect(confirm.getByText('Remove projects from group')).toBeVisible();
      await expect(confirm.getByText(`Remove 1 project(s) from ${group.Name}?`, { exact: false })).toBeVisible();
      await expect(confirm.getByPlaceholder('Type DELETE to confirm')).toHaveCount(0);
      await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
      await expect(page.getByText('1 project(s) removed from group.')).toBeVisible();
      await expect(projectRow(page, c)).toHaveCount(0);

      // ---- Select all, untick one (indeterminate), tick it again, remove both --
      const selectAll = page.getByRole('checkbox', { name: 'Select all projects' });
      await selectAll.check();
      await expect(page.getByRole('button', { name: 'Remove selected (2)' })).toBeEnabled();
      await page.getByRole('checkbox', { name: `Select ${a}` }).uncheck();
      expect(await selectAll.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
      await page.getByRole('checkbox', { name: `Select ${a}` }).check();
      expect(await selectAll.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(false);

      await page.getByRole('button', { name: 'Remove selected (2)' }).click();
      await expect(confirm.getByText(`Remove 2 project(s) from ${group.Name}?`, { exact: false })).toBeVisible();
      await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
      await expect(page.getByText('2 project(s) removed from group.')).toBeVisible();
      for (const id of [a, b]) await expect(projectRow(page, id)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Remove selected (0)' })).toBeDisabled();
      await expect(description).toHaveValue(unsaved);

      expect(await groupProjects(page, group.GroupId)).toEqual([]);
    } finally {
      await emptyGroup(page, group.GroupId);
    }
  });

  test('API: a project in another group is never moved or removed from it', async ({ page }) => {
    await apiLogin(page);
    const group = await ensureEmptyGroup(page, FIXTURE_GROUP);
    const other = await ensureEmptyGroup(page, OTHER_FIXTURE_GROUP);
    const [x, y] = await ungroupedProjects(page, 2);
    const bogus = `ZZE2E${Date.now()}`;

    try {
      const intoOther = await post(page, '/api/projectgroup/addproject', { GroupId: other.GroupId, ProjectId: [x.ProjectId] });
      expect(intoOther.status, JSON.stringify(intoOther.body)).toBe(200);
      expect(intoOther.body.AddedProjectIds).toEqual([x.ProjectId]);

      // y is sent by its PK. Where that differs from its ProjectId (a project
      // past BP), the result must still report the ProjectId.
      const add = await post(page, '/api/projectgroup/addproject', {
        GroupId: group.GroupId,
        ProjectId: [x.ProjectId, y.ProjectPK || y.ProjectId, bogus],
      });
      expect(add.status, JSON.stringify(add.body)).toBe(200);
      expect(add.body).toMatchObject({
        Message: '1 project(s) added to group.',
        AddedProjectIds: [y.ProjectId],
        AlreadyInGroupProjectIds: [],
        InOtherGroupProjects: [{ ProjectId: x.ProjectId, GroupName: other.Name }],
        NotFoundProjectIds: [bogus],
      });
      expect(await groupProjects(page, other.GroupId)).toEqual([x.ProjectId]);

      // Update with the group's project rows in the payload, as the page used to send them. Their
      // numeric Category failed the old DTO's Projects list, so Update was a 400 for any group
      // that had projects. The server no longer binds that list.
      const details = (await post(page, '/api/projectgroup/projectgroupdetails', { GroupId: group.GroupId })).body;
      expect(details.Projects.length).toBe(1);
      const update = await post(page, '/api/projectgroup/updateprojectgroupdetails', {
        GroupDetails: details.GroupDetails,
        Projects: details.Projects,
      });
      expect(update.status, JSON.stringify(update.body)).toBe(200);

      const remove = await post(page, '/api/projectgroup/deleteproject', {
        GroupId: group.GroupId,
        ProjectIds: [x.ProjectId, y.ProjectId],
      });
      expect(remove.status, JSON.stringify(remove.body)).toBe(200);
      expect(remove.body).toMatchObject({
        Message: '1 project(s) removed from group.',
        RemovedProjectIds: [y.ProjectId],
        NotInGroupProjectIds: [x.ProjectId],
      });
      expect(await groupProjects(page, other.GroupId)).toEqual([x.ProjectId]);
      expect(await groupProjects(page, group.GroupId)).toEqual([]);

      // Refusals keep their existing words.
      const badGroup = await post(page, '/api/projectgroup/deleteproject', { GroupId: '0', ProjectIds: [y.ProjectId] });
      expect(badGroup.status).toBe(400);
      expect(badGroup.body.Message).toBe('Invalid Project Group ID.');

      const tooMany = Array.from({ length: 501 }, (_, i) => `ZZE2E${i}`);
      const capped = await post(page, '/api/projectgroup/addproject', { GroupId: group.GroupId, ProjectId: tooMany });
      expect(capped.status).toBe(400);
      expect(capped.body.Message).toBe('You can add at most 500 projects at a time.');
    } finally {
      await emptyGroup(page, group.GroupId);
      await emptyGroup(page, other.GroupId);
    }
  });

  test('Update saves while the group has projects, and a Project ID opens that project', async ({ page }) => {
    await apiLogin(page);
    const group = await ensureEmptyGroup(page, FIXTURE_GROUP);
    // An ordinary project: a Lump Sum Project's link opens /lumpsum/<Id> instead, as in the Projects list.
    const p = (await ungroupedProjects(page, 10)).find((x) => !x.IsLumpSum);
    expect(p, 'an ungrouped ordinary (non-Lump Sum) project').toBeTruthy();
    if (!p) return;

    try {
      const added = await post(page, '/api/projectgroup/addproject', { GroupId: group.GroupId, ProjectId: [p.ProjectId] });
      expect(added.body.AddedProjectIds).toEqual([p.ProjectId]);
      const row = ((await post(page, '/api/projectgroup/projectgroupdetails', { GroupId: group.GroupId })).body.Projects as
        { ProjectId: string; StageName: string }[])[0];

      await page.goto(`/project-groups/${group.GroupId}`);
      await expect(projectRow(page, p.ProjectId)).toHaveCount(1);

      // The page used to send its project rows with Update, and the API refused them (400,
      // "Category: Please provide a valid text value."). The fixture's own description is
      // written back, so the run leaves nothing changed.
      const description = page.locator('label:text-is("Description") + textarea');
      await description.fill(FIXTURE_DESCRIPTION);
      const updated = page.waitForResponse(isApi('updateprojectgroupdetails'));
      await page.getByRole('button', { name: 'Update' }).click();
      expect((await updated).status()).toBe(200);
      await expect(page.getByText('Category: Please provide a valid text value.')).toHaveCount(0);

      // The link used to be /projects/project-details/<ProjectId> with no stage, which the
      // details page cannot load ("Project Not Available").
      await page.getByRole('button', { name: p.ProjectId, exact: true }).click();
      const escape = (s: string) => encodeURIComponent(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(page).toHaveURL(new RegExp(`/projects/project-details/${escape(p.ProjectId)}:${escape(row.StageName)}$`));
      await expect(page.getByRole('heading', { name: 'Program Details' })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText('Project Not Available')).toHaveCount(0);
    } finally {
      await emptyGroup(page, group.GroupId);
    }
  });
});
