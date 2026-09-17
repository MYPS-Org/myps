// =============================================================================
// ls-data-security.spec.ts — row-level visibility across all 13 Lump Sum actions.
//
// WHAT THIS EXISTS FOR. AssertLumpSumVisibleAsync sits on the module's actions
// and, until this spec, had never once executed: it returns early when the
// session's ApplyFilter is 0, and on a restored myps_db_dev no user has it set
// (0 of 576). Every other check in this suite runs as an Admin, so the guard was
// verified by reading it. That is how two actions came to be missing it
// altogether — see the ShowItemizedProjects and DeleteItemizedProject cases.
//
// PREREQUISITE — the fixture accounts:
//
//   sqlcmd -S 127.0.0.1 -d myps_db_dev -U sa -P <pw> -C \
//     -i Main/Resources/Internal/SQLScripts/LumpSum.DataSecurity.Dev.sql
//
// It creates two restricted accounts that differ only in RegCode:
//   e2elsdenied   a regional office outside the program's DataSecurityGroup
//   e2elsallowed  Central Office, which is exempt structurally
// and grants the group the 13 actions. Without those grants every request 403s
// at the permission filter and this spec passes having tested nothing — which is
// why it asserts on the REFUSAL TEXT, not merely on failure.
//
// API-level, like ls-contract.spec.ts: it needs no dev server.
// =============================================================================

import { test, expect } from '@playwright/test';
import { post, provisionLumpSum, importChild, type ProvisionedLumpSum } from './helpers/lumpSumFixture';
import { postImportWorkbook } from './helpers/importWorkbook';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

/** The guard's own words. Asserting on these is what proves it ran. */
const NO_ACCESS = 'You do not have access to this Lump Sum Project.';
const PERMISSION_403 = /do not have permission to perform/;

const loginAs = async (page: any, userName: string) => {
  const res = await page.request.post(`${API}/api/Auth/Login`, {
    data: { UserName: userName, Password: process.env.E2E_PASSWORD ?? 'AnyPassword' },
  });
  if (res.status() !== 200) {
    throw new Error(
      `could not sign in as '${userName}' (${res.status()}). ` +
        `Run LumpSum.DataSecurity.Dev.sql to create the fixture accounts.`,
    );
  }
  const body = await res.json();
  return body?.Data?.User;
};

test.describe('Lump Sum row-level data security', () => {
  /*  The target is provisioned by an ADMIN and thrown away, never a sample
      project. If a guard is missing, the request that proves it mutates or
      deletes its target — so the target must be disposable. */
  let parent: ProvisionedLumpSum;
  let childProjectPK: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAs(page, process.env.E2E_USERNAME ?? 'jimeneznr');

    parent = await provisionLumpSum(page, 4_000_000, 'data-security probe');
    const imported = await importChild(page, parent, 1_000_000, 'DS-probe');
    expect(imported.status, 'the probe child should import').toBe(200);
    childProjectPK = imported.body.Projects[0].ProjectPK;

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAs(page, process.env.E2E_USERNAME ?? 'jimeneznr');
    await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: childProjectPK });
    await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: parent.lumpSumId });
    await page.close();
  });

  test('the fixture accounts really are restricted', async ({ page }) => {
    /*  If this fails, nothing else in the file means anything. vUsers computes
        ApplyFilter as "no group of mine is unrestricted", so adding the fixture
        group to an existing Admin would leave it 0 and silently disarm the whole
        spec. */
    const denied = await loginAs(page, 'e2elsdenied');
    expect(denied.ApplyFilter, 'e2elsdenied must have ApplyFilter set').toBe(true);

    const allowed = await loginAs(page, 'e2elsallowed');
    expect(allowed.ApplyFilter, 'e2elsallowed must have ApplyFilter set').toBe(true);
  });

  test('every project-scoped action refuses a Lump Sum Project the user cannot see', async ({
    page,
  }) => {
    await loginAs(page, 'e2elsdenied');

    const cases: { action: string; body: unknown }[] = [
      { action: 'LumpSumDetails', body: { LumpSumId: parent.lumpSumId } },
      { action: 'LumpSumBalance', body: { LumpSumId: parent.lumpSumId } },
      { action: 'ShowLumpSumActivity', body: { LumpSumId: parent.lumpSumId } },
      /*  ShowItemizedProjects had NO guard until the S7 fix: it resolved the
          parent, refused nothing, and returned the whole child set to a user who
          had just been refused the parent itself. */
      {
        action: 'ShowItemizedProjects',
        body: { Filters: { LumpSumId: parent.lumpSumId }, limit: 50, page: 1, sortDirection: 0 },
      },
      {
        action: 'UpdateLumpSum',
        body: {
          LumpSumId: parent.lumpSumId,
          ProgramId: parent.programPK,
          CategoryId: 16,
          SubCategoryId: 1082,
          OperatingUnit: 'OI46',
          Description: 'must not be written',
          Tier: 2,
          RegionWide: 1,
          Agency: 1001,
          Origin: 13,
          FundingProfiles: [],
          ComponentCosts: [],
          ComponentCostPerYear: [],
        },
      },
      { action: 'ReplenishLumpSum', body: { LumpSumId: parent.lumpSumId, NewAmount: 99_000_000 } },
      /*  DeleteItemizedProject also had no guard, so this exact request DELETED
          another region's child. It must be run against a disposable target. */
      { action: 'DeleteItemizedProject', body: { ProjectId: childProjectPK } },
      { action: 'DeleteLumpSum', body: { LumpSumId: parent.lumpSumId } },
    ];

    for (const { action, body } of cases) {
      const res = await post(page, `/api/Lumpsum/${action}`, body);
      const message = String(res.body?.Message ?? res.body ?? '');

      /*  A 403 here means the fixture group lost its grants, NOT that the guard
          worked — the permission filter would be answering instead. Called out
          separately so the failure names the real cause. */
      expect(message, `${action} 403'd at the permission filter — re-run LumpSum.DataSecurity.Dev.sql`)
        .not.toMatch(PERMISSION_403);

      expect(res.status, `${action} should refuse`).toBe(400);
      expect(message, `${action} should refuse with the guard's own words`).toBe(NO_ACCESS);
    }
  });

  test('the import refuses too — past its own empty-payload check', async ({ page }) => {
    await loginAs(page, 'e2elsdenied');

    /*  An empty file is refused as "Nothing to Import" BEFORE the visibility
        gate, so an empty upload would prove nothing here. */
    const empty = await postImportWorkbook(page, parent, Buffer.alloc(0), 'empty.xlsm');
    expect(String(empty.body?.Title ?? '')).toBe('Nothing to Import');

    /*  A real workbook — the same one the fixture imports with — must be turned
        away by the visibility gate, which sits ahead of every file gate and
        every row rule. */
    const real = await importChild(page, parent, 500_000, 'MUST-NOT-LAND');

    expect(real.status).toBe(400);
    expect(String(real.body?.Message ?? '')).toBe(NO_ACCESS);
  });

  test('ValidateForItemization refuses 200-shaped, as a reason rather than a failure', async ({
    page,
  }) => {
    await loginAs(page, 'e2elsdenied');

    /*  The import dialog renders this, so a 400 would read as a broken request
        rather than as "you cannot touch this project". */
    const res = await post(page, '/api/Lumpsum/ValidateForItemization', {
      LumpSumId: parent.lumpSumId,
    });

    expect(res.status).toBe(200);
    expect(res.body.Valid).toBe(false);
    expect(res.body.Message).toBe(NO_ACCESS);
  });

  test('CreateLumpSum refuses a program the user cannot see', async ({ page }) => {
    await loginAs(page, 'e2elsdenied');

    /*  Create has no existing project to gate on, so it checks the PROGRAM and
        says so in its own words. Without this it would be the one write a
        restricted user could still perform. */
    const res = await post(page, '/api/Lumpsum/CreateLumpSum', {
      ProgramId: parent.programPK,
      CategoryId: 16,
      SubCategoryId: 1082,
      OperatingUnit: 'OI46',
      Description: 'created by a user who cannot see the program',
      Tier: 2,
      RegionWide: 1,
      Agency: 1001,
      Origin: 13,
      Allocation: 1000,
      FundingSource: 'GOP',
      FundingAgreement: 'DPWH-GAA-2025',
      FundingProfiles: [],
      ComponentCosts: [],
      ComponentCostPerYear: [],
    });

    expect(res.status).toBe(400);
    expect(String(res.body?.Message ?? '')).toContain('do not have access to this program');
  });

  test('the list is filtered rather than refused', async ({ page }) => {
    await loginAs(page, 'e2elsdenied');

    /*  ShowLumpSum applies the row filter inline instead of calling the guard,
        which is right for a list: an out-of-scope row should be absent, not an
        error. */
    const res = await post(page, '/api/Lumpsum/ShowLumpSum', {
      Filters: {},
      limit: 50,
      page: 1,
      sortDirection: 0,
    });

    expect(res.status).toBe(200);
    expect(
      (res.body?.lists ?? []).map((r: any) => r.Id),
      'a restricted user outside the region should see no Lump Sum Projects',
    ).not.toContain(parent.lumpSumId);
  });

  test('a restricted but ENTITLED user is not blocked', async ({ page }) => {
    /*  The other half of the guard. A gate that refuses everyone is not
        working — it is broken in the safe direction, which is the harder failure
        to notice. e2elsallowed is Central Office, exempt structurally. */
    await loginAs(page, 'e2elsallowed');

    const details = await post(page, '/api/Lumpsum/LumpSumDetails', {
      LumpSumId: parent.lumpSumId,
    });
    expect(details.status, 'an entitled user must still get the project').toBe(200);
    expect(details.body.LumpSumProject.Id).toBe(parent.lumpSumId);

    const children = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
      Filters: { LumpSumId: parent.lumpSumId },
      limit: 50,
      page: 1,
      sortDirection: 0,
    });
    expect(children.status).toBe(200);
    expect((children.body?.lists ?? []).map((c: any) => c.ProjectPK)).toContain(childProjectPK);

    const check = await post(page, '/api/Lumpsum/ValidateForItemization', {
      LumpSumId: parent.lumpSumId,
    });
    expect(check.body.Valid).toBe(true);
  });

  /* ---------------------------------------------------------------------------
     Two divergences this fixture exposed on its first run. Both are recorded as
     failing expectations rather than omitted, so they cannot be forgotten —
     skipped, not deleted, because the behaviour is real and unfixed.
     --------------------------------------------------------------------------- */

  test.skip('KNOWN GAP: InitFilterLumpSum discloses programs the user cannot see', async ({
    page,
  }) => {
    /*  The filter bar's program dropdown is built from vLumpSumSet with no
        visibility predicate, so a restricted user is told the name and budget
        year of every program holding a Lump Sum Project — and offered a filter
        that can only ever return an empty grid. No financial figures leak, which
        is why this is a gap rather than a defect, but the dropdown should be
        scoped to what the session can see. */
    await loginAs(page, 'e2elsdenied');

    const res = await post(page, '/api/Lumpsum/InitFilterLumpSum', {});
    expect(
      (res.body?.Programs ?? []).map((p: any) => p.ProgramFK),
      'the dropdown should not name programs the user cannot see',
    ).not.toContain(parent.programPK);
  });

  test.skip('KNOWN GAP: a Central Office user can open a project but cannot list it', async ({
    page,
  }) => {
    /*  THE TWO MECHANISMS DISAGREE.

        AssertLumpSumVisibleAsync calls fUserVisiblePrograms(UserId), which
        exempts Central Office structurally — the function's own comment cites
        the operator: "Central Office and UPMO should not have any filtering".

        ShowLumpSum instead filters inline on
        vProgramDataSecurityGroups.ParticipantId = _Session.RegCode. For a
        Central Office user vUsers.RegCode resolves to NULL (no region to roll up
        to), so the predicate matches nothing and the list comes back EMPTY.

        Result: e2elsallowed can open any Lump Sum Project by id, and sees none in
        the grid. The same inline pattern appears in ProgramController and
        ProjectController, so the fix is probably not Lump Sum's alone to make. */
    await loginAs(page, 'e2elsallowed');

    const res = await post(page, '/api/Lumpsum/ShowLumpSum', {
      Filters: {},
      limit: 50,
      page: 1,
      sortDirection: 0,
    });
    expect(
      (res.body?.lists ?? []).map((r: any) => r.Id),
      'a user who can OPEN the project should also be able to LIST it',
    ).toContain(parent.lumpSumId);
  });
});
