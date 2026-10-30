// =============================================================================
// project-group-filter-update.spec.ts — Project Groups list filter (UAT S05-TC001-P002)
// and saving a group's own fields on Project Group Details (S05-TC002 / TC004).
//
// WHAT THIS PINS.
//   - Filter: Name and User Group narrow the list (both must match), the Filter button
//     counts the filters set, a filter that matches nothing shows "No project groups
//     found", and Clear Filter (in the dialog) and Clear Filters (on the toolbar) both
//     bring the whole list back.
//   - Update confirms the save: "Project Group '<Name>' updated successfully." It used to
//     show nothing on success, and the API's message named the group's row number.
//   - The Name is saved trimmed; the field and the Add Projects dialog show the saved name.
//   - Renaming to another live group's name is refused ("Project Group Name already
//     exists.") and the saved name stays.
//
// Reuses the two fixture groups of project-group-bulk-membership.spec.ts (created there,
// or here, when missing) and writes their own Name and Description back, so a run leaves
// only tTransactionLog rows. NO GROUP IS EVER DELETED (Delete Project Group is a soft
// delete). Needs the API + Vite on the LOCAL database (see e2e/CLAUDE.md).
//
// DO NOT ADD login() TO THIS FILE. apiLogin() already signs the browser in.
// =============================================================================

import { test, expect, type Page } from '@playwright/test';

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

// The fixtures of project-group-bulk-membership.spec.ts: same names, same description.
const FIXTURE_GROUP = 'E2E project group bulk membership fixture';
const OTHER_FIXTURE_GROUP = 'E2E project group bulk membership fixture (other)';
const FIXTURE_DESCRIPTION = 'Used by e2e/tests/project-group-bulk-membership.spec.ts. Left empty after every run.';

interface ListedGroup { GroupId: string; Name: string; UserGroupName: string }

const listGroups = async (page: Page, filters: { Name?: string; UserGroupName?: string }) => {
  const res = await post(page, '/api/projectgroup/showprojectgroups', {
    Filters: { Name: '', UserGroupName: '', ...filters },
    limit: 20, page: 1, Navigation: 0,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as { lists: ListedGroup[]; total: number; Dropdowns: { UserGroups: { Id: number }[] } };
};

/** The named fixture group, created when missing (projects in it are left alone). */
const ensureGroup = async (page: Page, name: string): Promise<ListedGroup> => {
  const find = async () => (await listGroups(page, { Name: name })).lists.find((g) => g.Name === name);
  if (!(await find())) {
    const userGroup = (await listGroups(page, {})).Dropdowns.UserGroups[0];
    const res = await post(page, '/api/projectgroup/addprojectgroup', { Name: name, Description: FIXTURE_DESCRIPTION, UserGroup: userGroup.Id });
    expect(res.status, `create fixture group "${name}": ${JSON.stringify(res.body)}`).toBe(200);
  }
  const group = await find();
  expect(group, `fixture group "${name}"`).toBeTruthy();
  return group!;
};

const groupDetails = async (page: Page, groupId: string) => {
  const res = await post(page, '/api/projectgroup/projectgroupdetails', { GroupId: groupId });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.GroupDetails as { Name: string; Description: string; UserGroup: number };
};

const isApi = (action: string) => (r: { url(): string; request(): { method(): string } }) =>
  r.url().toLowerCase().includes(`/projectgroup/${action}`) && r.request().method() === 'POST';

/** The names in the list table (each row's first cell is its name link). */
const listedNames = (page: Page) => page.locator('tbody tr td:first-child button');

const filterDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Filter Project Groups' });

/** Open Filter, set both fields, Apply; resolves once the filtered list has loaded. */
const applyFilter = async (page: Page, name: string, userGroup: string) => {
  await page.getByRole('button', { name: /^Filter/ }).click();
  const dialog = filterDialog(page);
  await expect(dialog.getByText('Leave fields empty to show all results.')).toBeVisible();
  await dialog.getByPlaceholder('Search by group name...').fill(name);
  await dialog.getByPlaceholder('Search by user group name...').fill(userGroup);
  const loaded = page.waitForResponse(isApi('showprojectgroups'));
  await dialog.getByRole('button', { name: 'Apply Filter' }).click();
  const req = (await loaded).request().postDataJSON();
  expect(req.Filters).toMatchObject({ Name: name, UserGroupName: userGroup });
};

test.describe('Project Groups — list filter and Update (S05)', () => {
  test('S05-TC001-P002: Name and User Group narrow the list; Clear Filter and Clear Filters reset it', async ({ page }) => {
    await apiLogin(page);
    const fixture = await ensureGroup(page, FIXTURE_GROUP);
    const other = await ensureGroup(page, OTHER_FIXTURE_GROUP);
    const everything = await listGroups(page, {});
    expect(everything.total, 'more groups than the two fixtures, so a filter visibly narrows').toBeGreaterThan(2);

    await page.goto('/project-groups');
    await expect(listedNames(page).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Clear Filters' })).toHaveCount(0);

    // Name only: both fixtures and nothing else; the Filter button counts one filter.
    await applyFilter(page, 'bulk membership fixture', '');
    await expect.poll(async () => (await listedNames(page).allInnerTexts()).sort()).toEqual([fixture.Name, other.Name].sort());
    await expect(page.getByRole('button', { name: /^Filter\s*1$/ })).toBeVisible();

    // Clear Filters on the toolbar brings the whole list back.
    const cleared = page.waitForResponse(isApi('showprojectgroups'));
    await page.getByRole('button', { name: 'Clear Filters' }).click();
    expect((await cleared).request().postDataJSON().Filters).toMatchObject({ Name: '', UserGroupName: '' });
    await expect.poll(async () => listedNames(page).count()).toBe(Math.min(everything.total, 20));
    await expect(page.getByRole('button', { name: 'Clear Filters' })).toHaveCount(0);

    // Name + User Group: both must match.
    await applyFilter(page, OTHER_FIXTURE_GROUP, other.UserGroupName);
    await expect.poll(async () => listedNames(page).allInnerTexts()).toEqual([other.Name]);
    await expect(page.getByRole('button', { name: /^Filter\s*2$/ })).toBeVisible();
    await applyFilter(page, OTHER_FIXTURE_GROUP, 'zz no such user group');
    await expect(page.getByText('No project groups found')).toBeVisible();

    // Clear Filter in the dialog resets the list too.
    await page.getByRole('button', { name: /^Filter/ }).click();
    const reset = page.waitForResponse(isApi('showprojectgroups'));
    await filterDialog(page).getByRole('button', { name: 'Clear Filter', exact: true }).click();
    expect((await reset).request().postDataJSON().Filters).toMatchObject({ Name: '', UserGroupName: '' });
    await filterDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(async () => listedNames(page).count()).toBe(Math.min(everything.total, 20));
    await expect(page.getByRole('button', { name: 'Clear Filters' })).toHaveCount(0);
  });

  test('S05-TC002/TC004: Update says it saved, keeps the trimmed Name, and refuses a duplicate', async ({ page }) => {
    await apiLogin(page);
    const fixture = await ensureGroup(page, FIXTURE_GROUP);
    await ensureGroup(page, OTHER_FIXTURE_GROUP);
    const before = await groupDetails(page, fixture.GroupId);

    await page.goto(`/project-groups/${fixture.GroupId}`);
    const name = page.locator('label:text-is("Name") + input');
    const description = page.locator('label:text-is("Description") + textarea');
    await expect(name).toHaveValue(FIXTURE_GROUP, { timeout: 60_000 });

    const update = async () => {
      const done = page.waitForResponse(isApi('updateprojectgroupdetails'));
      await page.getByRole('button', { name: 'Update', exact: true }).click();
      return done;
    };

    try {
      // A changed Description is saved, and the save is confirmed by name. The Name typed
      // with spaces around it is saved, and shown, trimmed.
      await name.fill(`  ${FIXTURE_GROUP}  `);
      await description.fill(`${FIXTURE_DESCRIPTION} (S05 Update check)`);
      expect((await update()).status()).toBe(200);
      await expect(page.getByText(`Project Group '${FIXTURE_GROUP}' updated successfully.`)).toBeVisible();
      await expect(name).toHaveValue(FIXTURE_GROUP);
      expect(await groupDetails(page, fixture.GroupId)).toMatchObject({ Name: FIXTURE_GROUP, Description: `${FIXTURE_DESCRIPTION} (S05 Update check)` });

      // The Add Projects dialog names the saved group.
      await page.getByRole('button', { name: 'Add Projects' }).click();
      const addDialog = page.getByRole('dialog').filter({ hasText: 'Add Projects to Group' });
      await expect(addDialog.getByText(`Project Group: ${FIXTURE_GROUP}`)).toBeVisible();
      await addDialog.getByRole('button', { name: 'Cancel' }).click();

      // Another live group's name is refused, and the saved name stays.
      await name.fill(OTHER_FIXTURE_GROUP);
      expect((await update()).status()).toBe(400);
      await expect(page.getByText('Project Group Name already exists.')).toBeVisible();
      expect((await groupDetails(page, fixture.GroupId)).Name).toBe(FIXTURE_GROUP);
    } finally {
      // Write the fixture's own values back.
      const res = await post(page, '/api/projectgroup/updateprojectgroupdetails', {
        GroupDetails: { GroupId: fixture.GroupId, Name: FIXTURE_GROUP, Description: before.Description, UserGroup: before.UserGroup },
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
  });
});
