// =============================================================================
// batch-restrict-allow-publish-skips-published.spec.ts — operator-requested
// verification for the 2026-10-05 Batch Restrict/Allow Publishing fix.
//
// WHAT THIS PROVES, against a REAL running stack (API + DB), end to end:
//
//   Once a project is published to PCMA (tProjects.IsPublished = 1),
//   BatchRestrictPublish and BatchAllowPublish must SKIP it -- never touch
//   its IsPublishable flag -- and report it back as skipped, while still
//   processing the rest of a mixed batch normally. Operator-confirmed
//   behavior (2026-10-05): "skip in the process that projects is already
//   published then do the process for the unpublished ones, then just
//   return a response."
//
// WHY A DIRECT SQL STEP IS USED TO MARK THE FIXTURE PUBLISHED. There is no
// API endpoint in this codebase that sets tProjects.IsPublished = 1 on
// demand for an ordinary project outside of PCMA's own publish workflow
// (deliberately out of scope for this fix -- see the operator's answer in
// this fix's planning conversation: "No — out of scope, only fix the three
// paths already identified"). Flipping the flag directly via sqlcmd, scoped
// to this spec's own throwaway ProjectPK only, is the only way to set up
// this precondition without touching the real publish module. Reverted in
// the same afterAll that deletes the whole throwaway program, so nothing
// is left behind regardless of outcome.
//
// FIXTURE PAYLOAD. Reuses the exact AddProject field set earned field-by-
// field in batch-delete-restore-cross-stage.spec.ts (see that file's header
// for the full discovery story) -- Province/City/LegislativeDistrict under
// Region OI237, Category 1 (Category 16's ID range is exhausted on
// myps_db_dev as of 2026-10-05), IslandCode 'LZ', ProjectType ''.
// =============================================================================

import { test, expect } from '@playwright/test';
import { post, apiLogin, listPrograms } from './helpers/lumpSumFixture';
import { execFileSync } from 'child_process';

const TAG = `e2e-publishguard-${Date.now()}`;

// The direct SQL step must hit the SAME database the API under test
// (E2E_API_URL) is wired to, or the flip lands somewhere else and the skip
// assertions fail for an environment reason. There is no safe default: a
// committed server/credential would silently target a shared server. Set
// these in e2e/.env (gitignored) to the API's MYPSDb connection:
//
//   E2E_SQL_SERVER=localhost
//   E2E_SQL_DB=myps_db_dev
//   E2E_SQL_USER=sa            # omit USER/PASSWORD to use Windows auth (-E)
//   E2E_SQL_PASSWORD=...
//
// Without E2E_SQL_SERVER and E2E_SQL_DB the file skips, loudly.
const SQL_SERVER = process.env.E2E_SQL_SERVER;
const SQL_DB = process.env.E2E_SQL_DB;
const SQL_USER = process.env.E2E_SQL_USER;
const SQL_PASSWORD = process.env.E2E_SQL_PASSWORD;

// No shell: the query, the ProjectPK and the credentials go to sqlcmd as
// argv entries, so quotes and metacharacters in any of them cannot re-parse
// the command. The password travels in SQLCMDPASSWORD (which sqlcmd reads
// natively) rather than on the command line, where every process listing
// would show it.
const SQLCMD_ARGS = [
  '-S', SQL_SERVER ?? '',
  '-d', SQL_DB ?? '',
  ...(SQL_USER ? ['-U', SQL_USER] : ['-E']),
  '-C', '-y', '0', '-Y', '0',
];

function runSql(query: string): string {
  return execFileSync('sqlcmd', [...SQLCMD_ARGS, '-Q', query], {
    encoding: 'utf-8',
    env: SQL_USER ? { ...process.env, SQLCMDPASSWORD: SQL_PASSWORD ?? '' } : process.env,
  });
}

// An UPDATE that matches nothing succeeds silently, which would leave a test
// asserting against a fixture that was never set up (or a revert that never
// happened). Every write goes through here so that case throws instead.
function updateOneProject(setClause: string, projectPK: string): void {
  const out = runSql(
    `SET NOCOUNT OFF; SET QUOTED_IDENTIFIER ON; UPDATE dbo.tProjects SET ${setClause} ` +
    `WHERE ProjectPK = '${projectPK}';`
  );
  if (!/\(1 rows? affected\)/.test(out)) {
    throw new Error(`expected to update exactly 1 tProjects row for ProjectPK '${projectPK}', sqlcmd said: ${out.trim()}`);
  }
}

test.describe('Batch Restrict/Allow Publishing skip already-published projects', () => {
  test.skip(
    !SQL_SERVER || !SQL_DB,
    'E2E_SQL_SERVER and E2E_SQL_DB must name the database the API under test uses (see file header)'
  );

  let programId = '';
  let programPK = '';
  let unpublishedProjectId = '';
  let unpublishedProjectPK = '';
  let publishedProjectId = '';
  let publishedProjectPK = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);

    // Donor lookup + AddProgram field set per batch-delete-restore-cross-stage.spec.ts
    // (that file's header documents why each field is required).
    const programs = await listPrograms(page);
    const donor = programs.find((p: any) => Array.isArray(p.DataSecurityGroup) && p.DataSecurityGroup.length > 0);
    expect(donor, 'need at least one existing program to copy a valid DataSecurityGroup from').toBeTruthy();

    const withoutBlanks = (groups: unknown): unknown[] =>
      (Array.isArray(groups) ? groups : []).filter((g) => String(g ?? '').trim() !== '');

    const addProgram = await post(page, '/api/Program/AddProgram', {
      Stage: 1, // BP
      Status: 3, // Working
      Type: 1, // Regular Infrastructure
      Name: TAG,
      YearStart: new Date().getFullYear(),
      DataSecurityGroup: withoutBlanks(donor.DataSecurityGroup),
      UserGroup: withoutBlanks(donor.UserGroup),
      IsSkipped: false,
    });
    expect(addProgram.status, `AddProgram failed: ${JSON.stringify(addProgram.body)}`).toBe(200);

    const createdProgram = (await listPrograms(page)).find((p: any) => p.Name === TAG);
    expect(createdProgram, 'created program not found in listing').toBeTruthy();
    programId = createdProgram.ProgramId;
    programPK = createdProgram.ProgramPK ?? createdProgram.Id;

    // Two projects in the same program/stage: one stays unpublished (must be
    // affected normally by Restrict/Allow), one gets flipped to published via
    // direct SQL below (must be skipped).
    const makeProject = async (suffix: string) => {
      const add = await post(page, '/api/Project/AddProject', {
        ProgramId: programId,
        StageName: 'BP',
        Description: `${TAG} project ${suffix}`,
        Category: 1,
        IslandCode: 'LZ',
        ProjectType: '',
        Origin: 13,
        Agency: 1001,
        RegionWide: 1,
        Tier: 2,
        OperatingUnit: 'OI46',
        Region: 'OI237',
        Province: '652',
        City: '661',
        LegislativeDistrict: '656',
        DEO: 'OI46',
        ImplementingOffice: 'OI46',
        ImplementationMode: 1,
        EmergencyMode: 0,
        RowAvailable: 0,
        Feasibility: 1,
        FeasibilityDate: new Date().toISOString(),
        DetailedDesign: 0,
      });
      expect(add.status, `AddProject(${suffix}) failed: ${JSON.stringify(add.body)}`).toBe(200);
    };

    await makeProject('unpublished');
    await makeProject('published');

    const rows = (await post(page, '/api/Program/ShowProjectsInProgram', {
      ProgramId: programId,
      StageName: 'BP',
      Filters: {},
      limit: 50,
      page: 1,
      Navigation: 0,
      PreviousFilteredId: 0,
      NextFilteredId: 0,
      PageCursorId: 0,
      sortDirection: 0,
    })).body;
    const projectRows = rows?.lists ?? rows?.Data?.lists ?? [];
    expect(projectRows.length, `expected 2 projects at BP, got: ${JSON.stringify(rows)}`).toBe(2);

    const [first, second] = projectRows;
    unpublishedProjectId = first.ProjectId;
    unpublishedProjectPK = first.ProjectPK;
    publishedProjectId = second.ProjectId;
    publishedProjectPK = second.ProjectPK;
    // No fallback to ProjectId: it is a different key, so the SQL below would
    // match nothing and the failure would surface far from its cause.
    expect(unpublishedProjectPK && publishedProjectPK, `ShowProjectsInProgram rows carry no ProjectPK: ${JSON.stringify(first)}`).toBeTruthy();

    // Mark the second project published, directly, the only way available
    // (see file header). Also forces IsPublishable=1 first, matching this
    // fix's exact bug scenario: a published project whose IsPublishable was
    // true at the moment of publishing must stay true afterward, not get
    // silently recomputed -- the live proof already run manually this
    // session for the SP; this proves the two C# endpoints hold the same
    // invariant.
    updateOneProject('IsPublished = 1, IsPublishable = 1', publishedProjectPK);

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);
    // Revert the direct-SQL flip before the program delete, defensively --
    // DeleteProgram's own guard only cares about BP-stage status, but
    // leaving no trace of the manual flip is the safer default regardless.
    // A failed revert (sqlcmd missing, connection dropped) must not stop the
    // delete, or each failed run strands a program holding a published project.
    let revertError: unknown;
    if (publishedProjectPK) {
      try {
        updateOneProject('IsPublished = 0, IsPublishable = 0', publishedProjectPK);
      } catch (err) {
        revertError = err;
      }
    }
    if (programId) {
      await post(page, '/api/Program/DeleteProgram', { ProgramId: programId, StageName: 'BP' });
    }
    await page.close();
    if (revertError) throw revertError;
  });

  test('BatchRestrictPublish skips the published project, restricts the rest', async ({ page }) => {
    await apiLogin(page);

    const res = await post(page, '/api/Program/BatchRestrictPublish', {
      ProgramId: programId,
      ProjectIds: `${unpublishedProjectId},${publishedProjectId}`,
    });

    expect(res.status, `BatchRestrictPublish failed: ${JSON.stringify(res.body)}`).toBe(200);
    expect(
      res.body?.SkippedAlreadyPublishedProjectIds ?? [],
      'published project should be reported as skipped'
    ).toContain(publishedProjectId);
    expect(res.body?.UpdatedCount, 'exactly the unpublished project should be updated').toBe(1);

    // Live-verify against the DB directly: the published project's
    // IsPublishable must be UNCHANGED (still true, from beforeAll), proving
    // the endpoint never touched it -- not just that the response claimed so.
    const check = runSql(
      `SET NOCOUNT ON; SELECT IsPublishable FROM dbo.tProjects WHERE ProjectPK = '${publishedProjectPK}';`
    );
    expect(check.trim()).toBe('1');

    const unpublishedCheck = runSql(
      `SET NOCOUNT ON; SELECT IsPublishable FROM dbo.tProjects WHERE ProjectPK = '${unpublishedProjectPK}';`
    );
    expect(unpublishedCheck.trim()).toBe('0');
  });

  test('BatchAllowPublish skips the published project', async ({ page }) => {
    await apiLogin(page);

    // Restore the unpublished project's flag to false first (the previous
    // test set it false already; this is just making the precondition
    // explicit and independent of test execution order).
    updateOneProject('IsPublishable = 0', unpublishedProjectPK);

    const res = await post(page, '/api/Program/BatchAllowPublish', {
      ProgramId: programId,
      ProjectIds: `${unpublishedProjectId},${publishedProjectId}`,
    });

    expect(res.status, `BatchAllowPublish failed: ${JSON.stringify(res.body)}`).toBe(200);
    expect(
      res.body?.SkippedAlreadyPublishedProjectIds ?? [],
      'published project should be reported as skipped'
    ).toContain(publishedProjectId);

    // The rest of the batch must still be processed: the unpublished project
    // is handed to pAllowProjectPublishing, so it shows up as restored or as
    // failed-validation (this fixture has no components, so either is valid),
    // and is never reported as skipped.
    const processed = [
      ...(res.body?.RestoredProjectIds ?? []),
      ...(res.body?.NotRestoredProjectIds ?? []),
    ];
    expect(processed, 'unpublished project should have been processed, not skipped').toContain(unpublishedProjectId);
    expect(processed, 'published project must not be processed').not.toContain(publishedProjectId);
    expect(res.body?.SkippedAlreadyPublishedProjectIds ?? []).not.toContain(unpublishedProjectId);

    // The published project's flag must still read whatever it already was
    // (true, from beforeAll) -- untouched by this call either.
    const check = runSql(
      `SET NOCOUNT ON; SELECT IsPublishable FROM dbo.tProjects WHERE ProjectPK = '${publishedProjectPK}';`
    );
    expect(check.trim()).toBe('1');
  });
});
