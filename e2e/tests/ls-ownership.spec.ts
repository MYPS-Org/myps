// =============================================================================
// ls-ownership.spec.ts — the Lump Sum module owns its projects.
//
// Two rules, both enforced by the server rather than only by the UI:
//
//   1. UACS is INHERITED. An itemized child's UACS is its parent's (2.6.8). The
//      import used to check this and refuse a mismatch, which proved nothing:
//      a child's UACS was never written anywhere, so the check compared against
//      a value that would be discarded and passed trivially whenever the parent
//      had none — which was every parent. Now it is copied down.
//
//   2. A LUMP SUM PARENT IS EDITED ONLY HERE. It is an ordinary tProjects row,
//      so the Project and Modification modules would otherwise create, edit and
//      revise it with none of this module's rules applied.
//
// API-level throughout, deliberately. The UI half of rule 2 cannot be reached on
// this database — /projects returns no rows, so /projects/project-details opens
// for nothing, the same blocker that leaves ls-project-form-identity skipping.
// The refusals below are what actually hold the line, so they are what is
// asserted; the read-only form is a courtesy on top of them.
//
// Tagged LS-OWNERSHIP- and swept by the global teardown.
// =============================================================================

import { test, expect } from '@playwright/test';
import {
  post,
  provisionLumpSum,
  importChild,
  apiLogin,
  type ProvisionedLumpSum,
} from './helpers/lumpSumFixture';

const TAG = 'LS-OWNERSHIP';

/*  THE SWEEPER FINDS TEST DATA BY THIS MARKER, NOT BY TAG.
    lumpSumSweeper.ts matches /\(e2e \d{4}-\d{2}-\d{2}T/ in a project's
    Description; provisionLumpSum writes it, and any UpdateLumpSum that rewrites
    the Description has to write it again or the parent becomes unsweepable.
    One did not, and stranded P00800031LS on myps_db_dev_200 (2026-09-13) — a
    parent holding 200,000,000 of a program's allocation, which the specs that
    assert on allocation arithmetic would then read. */
const RUN_MARKER = `(e2e ${new Date().toISOString().slice(0, 19)})`;

/** A value no other row will collide with, so inheritance is unambiguous. */
const PARENT_UACS = `UACS-${Date.now().toString().slice(-8)}`;

test.describe.configure({ mode: 'serial' });

test.describe('Lump Sum ownership — UACS inheritance and edit confinement', () => {
  let parent: ProvisionedLumpSum;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);
    parent = await provisionLumpSum(page, 200_000_000, TAG);
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // 1. UACS
  // ---------------------------------------------------------------------------

  test('a UACS set on the project is fanned out to the per-year row and read back', async ({ page }) => {
    await apiLogin(page);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const fundingId = before.body.FundingProfiles[0].Id;
    const costId = before.body.ComponentCosts[0].Id;
    const yearId = before.body.ComponentCostPerYear[0].Id;

    /*  UACS IS PROJECT-LEVEL IN, PER-YEAR OUT (2026-09-06). The details form is
        its single writer: `Uacs` on the body is fanned out by the server across
        every per-year row of the revision — tProjectComponentCostPerYear.UACS is
        still the only column it has anywhere. The per-year row below deliberately
        carries NO UACS: the fan-out, not the row, is what must put it there. */
    const saved = await post(page, '/api/Lumpsum/UpdateLumpSum', {
      LumpSumId: parent.lumpSumId,
      ProgramId: parent.programPK,
      CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
      Description: `${TAG} parent ${RUN_MARKER}`,
      Uacs: PARENT_UACS,
      Tier: 2, RegionWide: 1, Agency: 1001, Origin: 13,
      FundingProfiles: [{ Id: fundingId, Source: 'GOP', Agreement: 'DPWH-GAA-2025', Amount: 200_000_000, Percentage: 100, IsDeleted: false }],
      ComponentCosts: [{ Id: costId, CostId: 'c1', ComponentType: 'LS', ComponentId: 'LS', Description: `${TAG} allocation`, Total: 200_000_000, IsDeleted: false }],
      /*  The row's OWN year and amount, not fresh values. The dialog renders both
          read-only and resubmits what it was given — the year follows the
          program's start year and the amount is drawn down by itemization, so
          typing either here would be sending something the UI cannot. */
      ComponentCostPerYear: [{ Id: yearId, ComponentCostId: 'c1', Year: before.body.ComponentCostPerYear[0].Year, Amount: 200_000_000, StartDate: before.body.ComponentCostPerYear[0].StartDate, EndDate: before.body.ComponentCostPerYear[0].EndDate, IsDeleted: false }],
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);

    const after = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    expect(after.body.ComponentCostPerYear[0].UACS).toBe(PARENT_UACS);

    // vLumpSumSet.UACS is a SELECT TOP 1 over those rows, so the project-level
    // display picks it up without any project-level column existing.
    expect(after.body.LumpSumProject.UACS).toBe(PARENT_UACS);
  });

  test('an itemized child inherits the parent UACS, whatever the workbook said', async ({ page }) => {
    await apiLogin(page);

    /*  importChild sends no UACS at all — the child DTO's own value is ignored by
        design now, so the inherited one is the only way the child can have any.
        If this comes back null, nothing is copying it down. */
    const imported = await importChild(page, parent, 5_000_000, `${TAG}-CHILD`);
    expect(imported.status, JSON.stringify(imported.body)).toBe(200);

    const children = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
      Filters: { LumpSumId: parent.lumpSumId }, Navigation: 0, PageSize: 50,
    });
    expect(children.status).toBe(200);

    const rows = children.body.lists as Array<Record<string, unknown>>;
    expect(Array.isArray(rows) ? rows.length : 0).toBeGreaterThan(0);

    for (const child of rows) {
      expect(
        child.UACS,
        `child ${child.ProjectId} should carry its parent's UACS`,
      ).toBe(PARENT_UACS);
    }
  });

  test('a child UACS that differs is no longer a refusal', async ({ page }) => {
    await apiLogin(page);

    /*  This exact workbook used to be rejected with Title "UACS Mismatch". The
        parent's value now simply wins. */
    const imported = await importChild(page, parent, 3_000_000, `${TAG}-DIVERGENT`, {
      uacs: 'DEFINITELY-NOT-THE-PARENTS',
    });

    expect(imported.status, JSON.stringify(imported.body)).toBe(200);
    expect(imported.body.Title).not.toBe('UACS Mismatch');

    const children = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
      Filters: { LumpSumId: parent.lumpSumId }, Navigation: 0, PageSize: 50,
    });
    const rows = children.body.lists as Array<Record<string, unknown>>;
    /*  Found by Description: a child's AlternateId is its PARENT's Project ID
        (business rule, 2026-09-05), so the workbook label survives only in the
        Description importChild writes. */
    const divergent = rows.find((r) => String(r.Description ?? '').startsWith(`${TAG}-DIVERGENT`));
    expect(divergent, 'the divergent row should have been imported').toBeTruthy();
    expect(divergent.AlternateId, 'a child carries its parent\'s Project ID as Alternate ID').toBe(parent.projectId);
    expect(divergent.UACS, 'the workbook value is discarded in favour of the parent').toBe(PARENT_UACS);
  });

  // ---------------------------------------------------------------------------
  // 2. Edit confinement
  // ---------------------------------------------------------------------------

  test('AddProject refuses to create a Lump Sum Project', async ({ page }) => {
    await apiLogin(page);

    /*  A COMPLETE payload, not a stub. AddProjectDTO's [Required] attributes are
        checked by model binding before the action body runs, so a thin payload is
        turned away as "Validation failed" and never reaches the guard — which
        would make this test pass for the wrong reason. Everything here is valid;
        the ONLY thing wrong with it is that it asks for a Lump Sum Project. */
    const refused = await post(page, '/api/Project/AddProject', {
      ProgramId: parent.programPK,
      StageName: 'GAA-R',
      ProjectType: 'LS',
      IslandCode: 'LS',
      Description: `${TAG} should never exist`,
      Category: 16,
      Origin: 13,
      Agency: 1001,
      RegionWide: 1,
      Tier: 2,
      OperatingUnit: 'OI46',
      Region: 'OI237',
      DEO: 'OI46',
      ImplementingOffice: 'OI46',
    });

    expect(refused.status).toBe(400);
    expect(
      refused.body.Title,
      `expected the Lump Sum guard, got: ${JSON.stringify(refused.body)}`,
    ).toBe('Lump Sum Project');
    expect(String(refused.body.Message)).toContain('Lump Sum module');
  });

  test('UpdateProjectDetails refuses a Lump Sum Project, and names where to go', async ({ page }) => {
    await apiLogin(page);

    const details = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const stageName = details.body.LumpSumProject.StageName;

    /*  Complete, for the same reason as AddProject above: CoreController's
        OnActionExecuting validates the model before any action body runs, so a
        stub is turned away as "Validation failed" without reaching the guard. */
    const refused = await post(page, '/api/Project/UpdateProjectDetails', {
      ProjectDetails: {
        ProjectFK: details.body.LumpSumProject.ProjectPK,
        ProjectId: parent.projectId,
        ProgramFK: parent.programPK,
        ProgramId: details.body.LumpSumProject.ProgramId,
        StageName: stageName,
        Description: `${TAG} edited from the wrong module`,
        Region: 'OI237',
        DEO: 'OI46',
        OperatingUnit: 'OI46',
        ImplementingOffice: 'OI46',
        Category: 16,
        Origin: 13,
        Agency: 1001,
        RegionWide: 1,
        Tier: 2,
        CreatedBy: 'e2e',
        CreatedDate: new Date().toISOString(),
        Source: 'e2e',
      },
    });

    expect(refused.status).toBe(400);
    expect(refused.body.Title).toBe('Lump Sum Project');
    expect(String(refused.body.Message)).toContain('Lump Sum module');
    expect(String(refused.body.Message)).toContain(parent.projectId);
  });

  test('the parent is refused a revision, while its children stay ordinary projects', async ({ page }) => {
    await apiLogin(page);

    const refused = await post(page, '/api/Revision/ReviseProject', {
      ProjectId: parent.projectId,
      RevisionHeader: 1,
      RevisionReason: 1,
    });

    /*  Whatever else is wrong with this payload, the refusal must be the Lump Sum
        one — the guard runs before the revision's own validation. */
    expect(refused.status).toBe(400);
    expect(refused.body.Title).toBe('Lump Sum Project');

    /*  THE OTHER HALF, and the reason the guard tests ParentProjectId as well as
        ProjectType. Children carry ProjectType 'LS' too — 18 of the 21 rows that
        have it in the sample data are children. A guard on the type alone would
        lock every itemized project out of the module that owns it. */
    const children = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
      Filters: { LumpSumId: parent.lumpSumId }, Navigation: 0, PageSize: 50,
    });
    const rows = children.body.lists as Array<Record<string, unknown>>;
    expect(rows.length, 'the fixture imported children above').toBeGreaterThan(0);

    for (const child of rows) {
      expect(
        String(child.ProjectId).toUpperCase().endsWith('LS'),
        `child ${child.ProjectId} takes its island code from its Region, not 'LS'`,
      ).toBe(false);
    }
  });
});
