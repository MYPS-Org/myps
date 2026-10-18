// =============================================================================
// project-visibility.spec.ts — the DEO / Region project VIEW gate, per stage.
//
// DPC sees the stages whose DEO is its PlantillaOffice, RPC the stages whose DEO is
// under its region, AUC / DPD Admin everything; everyone else is unchanged. A stage's
// DEO is its latest fully approved modification's snapshot DEO, else the stage
// revision's own DEO. Lump Sum parents are never visible to DPC/RPC. The gate lives
// in Helpers/ProjectHelper.cs ("Project view gate"); plan:
// documents/plans/project-visibility-by-deo-region.md
//
// PREREQUISITE: Main/Resources/Internal/SQLScripts/ProjectVisibility.Fixture.Dev.sql
//   e2edpc (DPC, OI122 Davao City DEO) · e2erpc (RPC, OI246 Region XI)
//   e2eauc (AUC) · e2edpcnoscope (DPC with a Region office)
//
// It reads the database for probes and expected sets, so it SKIPS unless E2E_SQL_SERVER
// and E2E_SQL_DB name the API's database (E2E_SQL_USER / E2E_SQL_PASSWORD for SQL auth).
// Refusals are asserted on the gate's own words; a 403 from the permission filter fails
// loudly instead of passing. The last two cases drive the browser (FE on the same API).
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { post } from './helpers/lumpSumFixture';
import { login } from './helpers/auth';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');
const SQL_SERVER = process.env.E2E_SQL_SERVER;
const SQL_DB = process.env.E2E_SQL_DB;
const SQL_USER = process.env.E2E_SQL_USER;
const SQL_PASSWORD = process.env.E2E_SQL_PASSWORD;

function runSql(query: string): string[] {
  const out = execFileSync(
    'sqlcmd',
    ['-S', SQL_SERVER ?? '', '-d', SQL_DB ?? '', ...(SQL_USER ? ['-U', SQL_USER] : ['-E']),
     '-C', '-W', '-h', '-1', '-Q', `SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ${query}`],
    { encoding: 'utf-8', env: SQL_USER ? { ...process.env, SQLCMDPASSWORD: SQL_PASSWORD ?? '' } : process.env },
  );
  return out.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}
const sqlCount = (query: string) => Number(runSql(query)[0]);
const q = (s: string) => `N'${s.replace(/'/g, "''")}'`;

/** The test oracle: the same stage-DEO rule as ProjectHelper.StageDeoSql. */
const stageDeo = (rev: string) =>
  `COALESCE((SELECT TOP 1 s.DEO FROM dbo.tRevisionDetails rd JOIN dbo.tRevisionProjectSnapshot s ON s.RevisionDetailFK = rd.Id AND s.IsDeleted = 0
     CROSS APPLY dbo.fRevisionApprovalStatus(rd.Id) a WHERE rd.ProjectRevisionFK = ${rev} AND a.IsFullyApproved = 1 ORDER BY rd.Id DESC),
   (SELECT pr.DEO FROM dbo.tProjectRevisions pr WHERE pr.Id = ${rev} AND pr.IsDeleted = 0))`;
const LS_PARENT = (pk: string) => `EXISTS (SELECT 1 FROM dbo.tProjects lp WHERE lp.ProjectPK = ${pk} AND lp.ProjectType = 'LS' AND lp.ParentProjectId IS NULL)`;

const DPC = { user: 'e2edpc', deo: 'OI122' };
const LATER_DEO = 'OI3576'; // Davao City 3rd DEO, same Region XI
const RPC = { user: 'e2erpc', region: 'OI246' };
const AUC = { user: 'e2eauc' };
const NOSCOPE = { user: 'e2edpcnoscope' };
const regionDeos = `(SELECT ParticipantId FROM dbo.vAdminDEO WHERE RegionParticipantId = ${q(RPC.region)})`;

const NOT_FOUND = /does not exist in the system|Project not found/;
const PAGE = { limit: 200, page: 1, Navigation: 0, PreviousFilteredId: 0, NextFilteredId: 0, PageCursorId: 0, sortDirection: 0 };

const loginAs = async (page: Page, userName: string) => {
  const res = await page.request.post(`${API}/api/Auth/Login`, {
    data: { UserName: userName, Password: process.env.E2E_PASSWORD ?? 'AnyPassword' },
  });
  if (res.status() !== 200) throw new Error(`could not sign in as '${userName}' (${res.status()}). Run ProjectVisibility.Fixture.Dev.sql.`);
};

const showProjects = (page: Page) => post(page, '/api/Project/ShowProjects', { Filters: { ProgramId: '', ProjectId: '' }, ...PAGE });
const inProgram = (page: Page, programPK: string, stageName: string, projectId = '') =>
  post(page, '/api/Program/ShowProjectsInProgram', { ProgramId: programPK, StageName: stageName, Filters: { ProjectId: projectId }, ...PAGE });
const details = (page: Page, projectId: string, stageName: string) =>
  post(page, '/api/Project/ShowProjectDetails', { ProjectId: projectId, StageName: stageName });
const stages = (page: Page, projectPK: string) => post(page, '/api/Project/ShowProjectStages', { ProjectId: projectPK });
const stageTargets = (page: Page, projectPK: string) =>
  post(page, '/api/Project/ShowProjectStageTargets', { ProjectId: projectPK, Filters: {}, ...PAGE });

function expectNotFound(res: { status: number; body: any }) {
  expect(res.status, `a 403 means the permission filter refused first: ${JSON.stringify(res.body)}`).not.toBe(403);
  expect(res.status).toBe(400);
  expect(res.body?.Title).toBe('Project Not Found');
  expect(String(res.body?.Message ?? '')).toMatch(NOT_FOUND);
}

type Stage = { stageName: string; projectId: string; revisionId: number; deo: string };
type Probe = { projectPK: string; programPK: string; stages: Stage[] };

function probeStages(projectPK: string): Stage[] {
  return runSql(`
    SELECT ps.StageName + '|' + pr.ProjectId + '|' + CAST(ps.RevisionId AS varchar(12)) + '|' + ISNULL(${stageDeo('ps.RevisionId')}, '')
    FROM dbo.tProjectStages ps JOIN dbo.tProjectRevisions pr ON pr.Id = ps.RevisionId AND pr.IsDeleted = 0
    JOIN dbo.tOptionProgramStage h ON h.Id = ps.StageId
    WHERE ps.ProjectFK = ${q(projectPK)} ORDER BY h.StageHierarchy;`).map((l) => {
    const [stageName, projectId, rev, deo] = l.split('|');
    return { stageName, projectId, revisionId: Number(rev), deo };
  });
}
function probe(where: string): Probe {
  const [projectPK, programPK] = runSql(`
    SELECT TOP 1 p.ProjectPK + '|' + p.ProgramFK FROM dbo.tProjects p
    WHERE NOT ${LS_PARENT('p.ProjectPK')} AND ${where} ORDER BY p.Id DESC;`)[0]?.split('|') ?? [];
  if (!projectPK) throw new Error(`no probe project for: ${where}`);
  return { projectPK, programPK, stages: probeStages(projectPK) };
}
const hasStage = (deoCondition: string) =>
  `EXISTS (SELECT 1 FROM dbo.tProjectStages ps WHERE ps.ProjectFK = p.ProjectPK AND ${stageDeo('ps.RevisionId')} ${deoCondition})`;

test.describe('Project view gate: DEO / Region, per stage', () => {
  test.skip(!SQL_SERVER || !SQL_DB, 'E2E_SQL_SERVER and E2E_SQL_DB must name the database the API under test uses (see file header)');

  // mixed: early stages at OI122, a later one at OI3576 -> DPC sees part, RPC sees all.
  // outside: no stage anywhere in Region XI.
  let mixed: Probe;
  let outside: Probe;
  let lsParentPK: string;
  let lsChildInRegion: Probe;

  test.beforeAll(() => {
    mixed = probe(`${hasStage(`= ${q(DPC.deo)}`)} AND ${hasStage(`= ${q(LATER_DEO)}`)}`);
    outside = probe(`NOT ${hasStage(`IN ${regionDeos}`)} AND ${hasStage('IS NOT NULL')}`);
    lsParentPK = runSql(`SELECT TOP 1 ProjectPK FROM dbo.tProjects WHERE ProjectType = 'LS' AND ParentProjectId IS NULL ORDER BY Id DESC;`)[0];
    lsChildInRegion = probe(`p.ProjectType = 'LS' AND p.ParentProjectId IS NOT NULL AND ${hasStage(`IN ${regionDeos}`)}`);
    expect(mixed.stages.some((s) => s.deo === DPC.deo) && mixed.stages.some((s) => s.deo === LATER_DEO)).toBe(true);
  });

  test('DPC: lists exactly the projects with a stage at its DEO, and no Lump Sum parent', async ({ page }) => {
    await loginAs(page, DPC.user);
    const list = await showProjects(page);
    expect(list.status, JSON.stringify(list.body).slice(0, 300)).toBe(200);
    expect(list.body.total).toBe(sqlCount(`SELECT COUNT(*) FROM dbo.vProjectLatest v JOIN dbo.tProjects p ON p.ProjectPK = v.ProjectPK
      WHERE ${hasStage(`= ${q(DPC.deo)}`)} AND NOT ${LS_PARENT('v.ProjectPK')};`));
    expect((list.body.lists as any[]).some((r) => r.IsLumpSum)).toBe(false);
  });

  test('DPC: per stage — sees the OI122 stages of a project, not its OI3576 stage', async ({ page }) => {
    await loginAs(page, DPC.user);
    const own = mixed.stages.filter((s) => s.deo === DPC.deo);
    const other = mixed.stages.filter((s) => s.deo !== DPC.deo);

    const panel = await stages(page, mixed.projectPK);
    expect(panel.status).toBe(200);
    expect((panel.body.Stages as any[]).map((s) => s.RevisionId).sort()).toEqual(own.map((s) => s.revisionId).sort());

    expect((await details(page, own[0].projectId, own[0].stageName)).status).toBe(200);
    expectNotFound(await details(page, other[0].projectId, other[0].stageName));

    const inOwnStage = await inProgram(page, mixed.programPK, own[0].stageName, own[0].projectId);
    expect((inOwnStage.body.lists as any[]).map((r) => r.ProjectPK)).toContain(mixed.projectPK);
    const inOtherStage = await inProgram(page, mixed.programPK, other[0].stageName, other[0].projectId);
    expect(inOtherStage.status).toBe(200);
    expect((inOtherStage.body.lists as any[]).map((r) => r.ProjectPK)).not.toContain(mixed.projectPK);

    const targets = await stageTargets(page, mixed.projectPK);
    expect(targets.status).toBe(200);
    const ownNames = new Set(own.map((s) => s.stageName));
    expect((targets.body.lists as any[]).every((r) => ownNames.has(r.StageName))).toBe(true);
  });

  test('RPC: sees every stage under its region, nothing outside it, and no Lump Sum parent', async ({ page }) => {
    await loginAs(page, RPC.user);
    const panel = await stages(page, mixed.projectPK);
    expect((panel.body.Stages as any[]).length).toBe(mixed.stages.length);
    for (const s of mixed.stages) expect((await details(page, s.projectId, s.stageName)).status).toBe(200);

    expectNotFound(await stages(page, outside.projectPK));
    expectNotFound(await details(page, outside.stages[0].projectId, outside.stages[0].stageName));

    expectNotFound(await stages(page, lsParentPK));
    expect((await stages(page, lsChildInRegion.projectPK)).status).toBe(200);

    const list = await showProjects(page);
    expect(list.status).toBe(200);
    expect((list.body.lists as any[]).some((r) => r.IsLumpSum)).toBe(false);
  });

  test('AUC: sees and opens everything; a user outside the four groups is unchanged', async ({ page }) => {
    await loginAs(page, AUC.user);
    const all = sqlCount('SELECT COUNT(*) FROM dbo.vProjectLatest;');
    expect((await showProjects(page)).body.total).toBe(all);
    expect((await stages(page, lsParentPK)).status).toBe(200);
    expect((await details(page, outside.stages[0].projectId, outside.stages[0].stageName)).status).toBe(200);

    await loginAs(page, process.env.E2E_USERNAME ?? 'longboanak');
    expect((await showProjects(page)).body.total).toBe(all);
  });

  test('No office scope: a DPC user with a Region office gets 403 from both lists', async ({ page }) => {
    await loginAs(page, NOSCOPE.user);
    for (const res of [await showProjects(page), await inProgram(page, mixed.programPK, mixed.stages[0].stageName)]) {
      expect(res.status).toBe(403);
      expect(res.body.Title).toBe('No Project Access');
      expect(String(res.body.Message)).toMatch(/plantilla office is not set up/);
    }
    expectNotFound(await stages(page, mixed.projectPK));
  });

  test('Nothing else changes: DPC and RPC see the same programs as AUC', async ({ page }) => {
    const total = async (user: string) => { await loginAs(page, user); return (await post(page, '/api/Program/ShowProgram', { Filters: {}, ...PAGE })).body.total; };
    const auc = await total(AUC.user);
    expect(await total(DPC.user)).toBe(auc);
    expect(await total(RPC.user)).toBe(auc);
  });

  test('Modification: an approved snapshot DEO moves the stage (rolled back)', () => {
    const stage = mixed.stages.find((s) => s.deo === DPC.deo)!;
    const rows = runSql(`
      SET XACT_ABORT ON; BEGIN TRAN;
      INSERT dbo.tRevisionDetails (TransactionId, ProjectFK, ProjectRevisionFK, ProgramId, RevisionGroupId, ReasonId, CreatedBy, CreatedDate)
      SELECT N'e2e-pv-probe', pr.ProjectFK, pr.Id, pr.ProgramId, (SELECT TOP 1 Id FROM dbo.tOptionRevisionHeader), (SELECT TOP 1 Id FROM dbo.tOptionRevisionReasons), N'e2e', SYSDATETIME()
      FROM dbo.tProjectRevisions pr WHERE pr.Id = ${stage.revisionId};
      DECLARE @rd int = SCOPE_IDENTITY();
      INSERT dbo.tRevisionProjectSnapshot (RevisionDetailFK, ProjectId, Description, Region, DEO, OperatingUnit, ImplementingOffice, Category, Origin, Agency, RegionWide, Tier)
      SELECT @rd, pr.ProjectId, ISNULL(pr.Description, N''), ISNULL(pr.Region, N''), ${q(LATER_DEO)}, ISNULL(pr.OperatingUnit, N''), ISNULL(pr.ImplementingOffice, N''),
             ISNULL(pr.Category, 0), ISNULL(pr.Origin, 0), ISNULL(pr.Agency, 0), ISNULL(pr.RegionWide, 0), ISNULL(pr.Tier, 0)
      FROM dbo.tProjectRevisions pr WHERE pr.Id = ${stage.revisionId};
      INSERT dbo.tRevisionApprovals (RevisionDetailFK, Level, Status) VALUES (@rd, N'RO', 1), (@rd, N'CO', 1);
      SELECT 'during=' + ${stageDeo(String(stage.revisionId))};
      ROLLBACK;
      SELECT 'after=' + ${stageDeo(String(stage.revisionId))};`);
    expect(rows).toEqual([`during=${LATER_DEO}`, `after=${DPC.deo}`]);
  });

  test('UI: a refused stage explains itself; Lump Sum and Code Tables are hidden', async ({ page }) => {
    const other = mixed.stages.find((s) => s.deo !== DPC.deo)!;
    await login(page, DPC.user, process.env.E2E_PASSWORD ?? 'AnyPassword');

    await expect(page.getByText('Lump Sum', { exact: true })).toBeHidden();
    await expect(page.getByText('Code Tables', { exact: true })).toBeHidden();

    let lumpSumCalled = false;
    // API calls only: Vite's dev server also serves /src/pages/LumpSum/* modules, which are not the module running.
    page.on('request', (r) => { if (/\/api\/lumpsum\//i.test(new URL(r.url()).pathname)) lumpSumCalled = true; });
    await page.goto('/lumpsum');
    await page.waitForTimeout(1500);
    expect(lumpSumCalled, '/lumpsum must not route for a DPC user').toBe(false);

    await page.goto(`/projects/project-details/${other.projectId}:${other.stageName}`);
    await expect(page.getByRole('heading', { name: 'Project Not Available' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Projects' })).toHaveAttribute('href', '/projects');
  });

  test('UI: an AUC user still sees Lump Sum and Code Tables', async ({ page }) => {
    await login(page, AUC.user, process.env.E2E_PASSWORD ?? 'AnyPassword');
    await expect(page.getByText('Lump Sum', { exact: true }).first()).toBeVisible();
    await page.getByText('Settings', { exact: true }).first().click().catch(() => { /* dropdown may already be open */ });
    await expect(page.getByText('Code Tables', { exact: true }).first()).toBeVisible();
  });
});
