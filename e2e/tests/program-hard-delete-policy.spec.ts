// =============================================================================
// program-hard-delete-policy.spec.ts — DeleteProgram under feat/program-project-hard-delete-policy
//
// That branch replaced DeleteProgram's stage allow/deny lists and cost guard with
// one rule (dbo.fProgramDeletionEligibility): StageCount(ProgramFK) <= 1 -> the
// program AND every child project are hard-deleted by dbo.pExecuteProgramDeletion;
// > 1 -> refused; any child with IsPublished = 1 -> refused with zero writes.
//
//   (a) active project WITH cost        -> 200; program, project and cost rows gone
//                                          (behaviour flip: the old build refused this)
//   (b) program advanced BP -> NEP      -> 400 "beyond its initial stage"
//   (c) child IsPublished = 1           -> 400, nothing removed
//   (d) program Status = Approved       -> 200 (status is not part of the rule)
//   (e) program created directly at NEP -> 200 (RISK-112: was always refused)
//   (f) child with a tRevisionDetails   -> records what happens; the cascade does
//       row                                not delete tRevisionDetails, which has a
//                                          NO_ACTION FK to tProjectRevisions
//   (g) audit trail                     -> records whether tTransactionLog got a row
//
// Batch Delete under the single deletion rule (dbo.fProjectDeletionTier, 2026-10-15):
//   (h) project on its first stage entry -> hard-deleted, rows and cost gone
//   (i) after BP -> NEP                  -> soft: the NEP revision is flagged, the BP one is not;
//                                           the BP-form PK and the P-form id name the same project,
//                                           for the delete and for the restore
//   (j) a Lump Sum row, a published one  -> refused, each with its reason, nothing written
//
// Fixture data is seeded by SQL and NOTHING is cleaned up through the API: run it
// against a database snapshot and revert. E2E_SQL_SERVER / E2E_SQL_DB must name the
// API's MYPSDb; the file skips without them. The four SQL objects must be deployed.
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { apiLogin, post } from './helpers/lumpSumFixture';
import { addOrdinaryProject, advanceProgram, batchDelete, batchRestore, nepProjectId, STAGE_NEP, type CrossStageProgram } from './helpers/crossStageFixture';
import { listPrograms } from './helpers/lumpSumFixture';

const SQL_SERVER = process.env.E2E_SQL_SERVER;
const SQL_DB = process.env.E2E_SQL_DB;
const SQL_USER = process.env.E2E_SQL_USER;
const SQL_PASSWORD = process.env.E2E_SQL_PASSWORD;

const SQLCMD_ARGS = [
  '-S', SQL_SERVER ?? '',
  '-d', SQL_DB ?? '',
  ...(SQL_USER ? ['-U', SQL_USER] : ['-E']),
  '-C', '-W', '-h', '-1', '-s', '|', '-b',
];

function runSql(query: string): string {
  return execFileSync('sqlcmd', [...SQLCMD_ARGS, '-Q', `SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ${query}`], {
    encoding: 'utf-8',
    env: SQL_USER ? { ...process.env, SQLCMDPASSWORD: SQL_PASSWORD ?? '' } : process.env,
  });
}

const lines = (out: string) => out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const scalar = (q: string) => Number(lines(runSql(q)).at(-1));

function projectsOf(programPK: string): { revisionId: number; projectPK: string; projectId: string }[] {
  return lines(runSql(
    `SELECT r.Id, p.ProjectPK, r.ProjectId FROM dbo.tProjects p JOIN dbo.tProjectRevisions r ON r.ProjectFK = p.ProjectPK ` +
    `WHERE p.ProgramFK = '${programPK}';`
  )).map((l) => { const [id, pk, pid] = l.split('|'); return { revisionId: Number(id), projectPK: pk, projectId: pid }; });
}

function seedCost(revisionId: number): void {
  runSql(
    `INSERT dbo.tProjectComponentCost (ProjectRevisionFK, ComponentType, ComponentId, Description, Total, CreatedBy, CreatedDate, IsDeleted) ` +
    `VALUES (${revisionId}, 'CW', 'CW1', 'e2e program-hard-delete-policy', 1000000, 'e2e', GETDATE(), 0);`
  );
}

function leftovers(programPK: string, revisionIds: number[] = []): Record<string, number> {
  const ids = revisionIds.length ? revisionIds.join(',') : '-1';
  const out = runSql(
    `SELECT 'tPrograms', COUNT(*) FROM dbo.tPrograms WHERE ProgramPK = '${programPK}' ` +
    `UNION ALL SELECT 'tProgramRevisions', COUNT(*) FROM dbo.tProgramRevisions WHERE ProgramFK = '${programPK}' ` +
    `UNION ALL SELECT 'tProgramStages', COUNT(*) FROM dbo.tProgramStages WHERE ProgramFK = '${programPK}' ` +
    `UNION ALL SELECT 'tProjects', COUNT(*) FROM dbo.tProjects WHERE ProgramFK = '${programPK}' ` +
    `UNION ALL SELECT 'tProjectRevisions', COUNT(*) FROM dbo.tProjectRevisions WHERE ProgramFK = '${programPK}' ` +
    `UNION ALL SELECT 'tProjectComponentCost', COUNT(*) FROM dbo.tProjectComponentCost WHERE ProjectRevisionFK IN (${ids});`
  );
  return Object.fromEntries(lines(out).map((l) => { const [k, v] = l.split('|'); return [k, Number(v)]; }));
}

const NONE_LEFT = { tPrograms: 0, tProgramRevisions: 0, tProgramStages: 0, tProjects: 0, tProjectRevisions: 0, tProjectComponentCost: 0 };

const deleteProgram = (page: Page, program: CrossStageProgram) =>
  post(page, '/api/Program/DeleteProgram', { ProgramId: program.ProgramId, StageName: program.StageName });

const withoutBlanks = (xs: unknown[]) => xs.filter((x) => x !== null && x !== undefined && String(x).trim() !== '');

/*  AddProgram keys a program on `${host}_${MMddyyyy}_${HHmmss}`, so two programs created in the
    same second collide on UQ_tPrograms_ProgramPK (a pre-existing AddProgram design, seen in the
    full run of 2026-10-15). This file creates a dozen in a row, so it spaces them out. */
let lastProgramCreatedAt = 0;

/** createProgramAtBP, generalised to any stage (BP = 1, NEP = 2). */
async function createProgram(page: Page, name: string, stage: number): Promise<CrossStageProgram> {
  const wait = lastProgramCreatedAt + 1100 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  lastProgramCreatedAt = Date.now();
  const programs = await listPrograms(page);
  const donor = programs.find((p) => Array.isArray(p.DataSecurityGroup) && withoutBlanks(p.DataSecurityGroup).length > 0);
  if (!donor) throw new Error('no donor program for DataSecurityGroup');
  const added = await post(page, '/api/Program/AddProgram', {
    Stage: stage, Status: 3, Type: 1, Name: name, YearStart: new Date().getFullYear(),
    DataSecurityGroup: withoutBlanks(donor.DataSecurityGroup), UserGroup: withoutBlanks(donor.UserGroup), IsSkipped: false,
  });
  if (added.status !== 200) throw new Error(`AddProgram(stage ${stage}) failed: ${JSON.stringify(added.body).slice(0, 300)}`);
  const row = (await listPrograms(page)).find((p) => String(p.Name ?? '') === name);
  if (!row) throw new Error(`program '${name}' not listed`);
  return { ProgramPK: String(row.ProgramPK), ProgramId: String(row.ProgramId), Name: String(row.Name), StageName: String(row.StageName) };
}

async function programWithProject(page: Page, tag: string, stage = 1) {
  const program = await createProgram(page, `e2e-hdp-${tag}-${new Date().toISOString()}`, stage);
  await addOrdinaryProject(page, program, `e2e-hdp-${tag} project ${Date.now()}`);
  const projects = projectsOf(program.ProgramPK);
  expect(projects.length, `projects under ${program.ProgramPK}`).toBe(1);
  return { program, project: projects[0] };
}

const note = (type: string, v: unknown) => test.info().annotations.push({ type, description: typeof v === 'string' ? v : JSON.stringify(v) });

test.describe('DeleteProgram hard-delete policy (feat/program-project-hard-delete-policy)', () => {
  test.skip(!SQL_SERVER || !SQL_DB, 'E2E_SQL_SERVER and E2E_SQL_DB must name the database the API under test uses');

  test.beforeEach(async ({ page }) => { await apiLogin(page); });

  test('(a) BP program with an active COSTED project is hard-deleted with its cost rows', async ({ page }) => {
    const { program, project } = await programWithProject(page, 'a');
    seedCost(project.revisionId);
    const res = await deleteProgram(page, program);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body?.DeletedProjects).toEqual([project.projectPK]);
    expect(leftovers(program.ProgramPK, [project.revisionId])).toEqual(NONE_LEFT);
  });

  test('(b) a program advanced past its first stage is refused', async ({ page }) => {
    const { program } = await programWithProject(page, 'b');
    const advanced = await advanceProgram(page, program, STAGE_NEP);
    const before = leftovers(advanced.ProgramPK);
    const res = await deleteProgram(page, advanced);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).toBe(400);
    expect(String(res.body?.Message)).toContain('beyond its initial stage');
    expect(leftovers(advanced.ProgramPK)).toEqual(before);
  });

  test('(c) a published child blocks the whole delete with zero writes', async ({ page }) => {
    const { program, project } = await programWithProject(page, 'c');
    seedCost(project.revisionId);
    runSql(`UPDATE dbo.tProjects SET IsPublished = 1 WHERE ProjectPK = '${project.projectPK}';`);
    const before = leftovers(program.ProgramPK, [project.revisionId]);
    const res = await deleteProgram(page, program);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).toBe(400);
    expect(String(res.body?.Message)).toContain('published');
    expect(leftovers(program.ProgramPK, [project.revisionId])).toEqual(before);
  });

  test('(d) an APPROVED single-stage program is hard-deleted (status is not checked)', async ({ page }) => {
    const { program, project } = await programWithProject(page, 'd');
    runSql(`UPDATE dbo.tProgramRevisions SET Status = 1 WHERE ProgramFK = '${program.ProgramPK}';`);
    expect(scalar(`SELECT COUNT(*) FROM dbo.tProgramRevisions WHERE ProgramFK = '${program.ProgramPK}' AND Status = 1;`)).toBe(1);
    const res = await deleteProgram(page, program);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(leftovers(program.ProgramPK, [project.revisionId])).toEqual(NONE_LEFT);
  });

  test('(e) a program created directly at NEP (skip-BP) is deletable', async ({ page }) => {
    // addOrdinaryProject hard-codes StageName 'BP', so the NEP program stays empty;
    // the old build refused NEP regardless of contents, which is the point here.
    const program = await createProgram(page, `e2e-hdp-e-${new Date().toISOString()}`, STAGE_NEP);
    expect(program.StageName).toBe('NEP');
    const res = await deleteProgram(page, program);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(leftovers(program.ProgramPK)).toEqual(NONE_LEFT);
  });

  test('(f) a child with a tRevisionDetails row is hard-deleted with it (the cascade covers the formal-revision tables)', async ({ page }) => {
    const { program, project } = await programWithProject(page, 'f');
    runSql(
      `INSERT dbo.tRevisionDetails (TransactionId, ProjectFK, ProjectRevisionFK, ProgramId, RevisionGroupId, ReasonId, IsCertified, CreatedBy, CreatedDate) ` +
      `VALUES ('e2e-hdp-f', '${project.projectPK}', ${project.revisionId}, '${program.ProgramId}', 10, 1, 0, 'e2e', GETDATE());`
    );
    const res = await deleteProgram(page, program);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    // Before 2026-10-15 this failed on FK_tRevisionDetails_ProjectRevision and rolled back with a
    // generic 400; pExecuteProjectDeletion now removes tRevisionDetails and its children first.
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(leftovers(program.ProgramPK, [project.revisionId])).toEqual(NONE_LEFT);
    expect(scalar(`SELECT COUNT(*) FROM dbo.tRevisionDetails WHERE TransactionId = 'e2e-hdp-f';`)).toBe(0);
  });

  test('(g) a successful delete leaves an audit row in tTransactionLog', async ({ page }) => {
    const { program } = await programWithProject(page, 'g');
    const logBefore = scalar(`SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId IN ('${program.ProgramId}', '${program.ProgramPK}') AND TransactionType = 'Delete';`);
    const res = await deleteProgram(page, program);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const logAfter = scalar(`SELECT COUNT(*) FROM dbo.tTransactionLog WHERE ReferenceId IN ('${program.ProgramId}', '${program.ProgramPK}') AND TransactionType = 'Delete';`);
    note('audit rows', { before: logBefore, after: logAfter });
    // main wrote one TransactionLog row per DeleteProgram; the branch removed it.
    expect(logAfter - logBefore, 'DeleteProgram should write a Delete audit row').toBe(1);
  });

  test('(h) Batch Delete hard-deletes a project on its first stage entry', async ({ page }) => {
    const { program, project } = await programWithProject(page, 'h');
    seedCost(project.revisionId);

    const res = await batchDelete(page, program, project.projectPK);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body?.HardDeletedProjectIds).toEqual([project.projectPK]);
    expect(res.body?.SoftDeletedProjectIds).toEqual([]);

    const left = leftovers(program.ProgramPK, [project.revisionId]);
    expect(left.tProjects).toBe(0);
    expect(left.tProjectRevisions).toBe(0);
    expect(left.tProjectComponentCost).toBe(0);
    expect(left.tPrograms, 'only the project goes; the program stays').toBe(1);
  });

  test('(i) after BP -> NEP, Batch Delete and restore accept the BP-form and P-form id alike, and the delete is soft', async ({ page }) => {
    const { program, project } = await programWithProject(page, 'i');
    const advanced = await advanceProgram(page, program, STAGE_NEP);
    const pForm = nepProjectId(project.projectPK);
    const revisionAt = (stageId: number) => lines(runSql(
      `SELECT r.Id, CAST(r.IsDeleted AS INT) FROM dbo.tProjectRevisions r JOIN dbo.tProjectStages s ON s.RevisionId = r.Id ` +
      `WHERE r.ProjectFK = '${project.projectPK}' AND s.StageId = ${stageId};`
    )).map((l) => l.split('|'));
    expect(revisionAt(STAGE_NEP)[0], 'the advance wrote a NEP revision').toBeDefined();
    expect(scalar(`SELECT COUNT(*) FROM dbo.tProjectRevisions WHERE ProjectFK = '${project.projectPK}' AND ProjectId = '${pForm}';`)).toBe(1);

    const del = await batchDelete(page, advanced, project.projectPK); // the BP-form PK
    note('delete', `${del.status} ${JSON.stringify(del.body)}`);
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    expect(del.body?.SoftDeletedProjectIds).toEqual([project.projectPK]);
    expect(del.body?.HardDeletedProjectIds).toEqual([]);
    expect(revisionAt(STAGE_NEP)[0][1], 'NEP revision flagged').toBe('1');
    expect(revisionAt(1)[0][1], 'BP revision untouched').toBe('0');

    const again = await batchDelete(page, advanced, pForm); // the P-form id: same project, already deleted here
    expect(again.status).toBe(400);
    expect(again.body?.MissingProjectIds).toEqual([pForm]);

    const restore = await batchRestore(page, advanced, pForm);
    note('restore', `${restore.status} ${JSON.stringify(restore.body)}`);
    expect(restore.status, JSON.stringify(restore.body)).toBe(200);
    expect(revisionAt(STAGE_NEP)[0][1], 'NEP revision restored').toBe('0');
  });

  test('(j) Batch Delete refuses a Lump Sum row and a published one, with nothing written', async ({ page }) => {
    const program = await createProgram(page, `e2e-hdp-j-${new Date().toISOString()}`, 1);
    await addOrdinaryProject(page, program, `e2e-hdp-j ls ${Date.now()}`);
    await addOrdinaryProject(page, program, `e2e-hdp-j pub ${Date.now()}`);
    const [ls, pub] = projectsOf(program.ProgramPK);
    runSql(`UPDATE dbo.tProjects SET ProjectType = 'LS' WHERE ProjectPK = '${ls.projectPK}';` +
           `UPDATE dbo.tProjects SET IsPublished = 1 WHERE ProjectPK = '${pub.projectPK}';`);
    const before = leftovers(program.ProgramPK);

    const res = await batchDelete(page, program, `${ls.projectPK};${pub.projectPK}`);
    note('response', `${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).toBe(400);
    const reasons = Object.fromEntries((res.body?.RefusedProjects ?? []).map((r: any) => [r.ProjectId, r.Reason]));
    expect(reasons[ls.projectPK]).toContain('Lump Sum');
    expect(reasons[pub.projectPK]).toBe('published');
    expect(leftovers(program.ProgramPK)).toEqual(before);
  });
});
