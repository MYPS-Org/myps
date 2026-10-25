// =============================================================================
// batch-delete-restore-cross-stage.spec.ts — Batch Delete / Restore across stages
//
// The two business rules the operator confirmed for the PR #238 cherry-pick
// (program-detail batch actions, delete/restore):
//
//   1. Deleting a project's revision at one stage does NOT affect its visibility
//      at another stage of the same program.
//   2. Restoring a deleted project brings it back at the STAGE IT WAS DELETED
//      FROM, not wherever the program currently is.
//
// API-only (no UI click-through), for determinism and speed. The UI half of the
// batch actions is program-detail-batch-actions.spec.ts.
//
// WHY RULE #2 IS OPT-IN. A project only exists on two stages once its program
// has been ADVANCED, and a program past BP can never be deleted (DeleteProgram's
// StagesToCheck guard, a deliberate business rule). So:
//   - The default test runs on ONE permanent, named fixture program
//     (helpers/crossStageFixture.ts), deletes and restores its project at NEP,
//     and leaves it exactly as it found it. It proves rule #1 and a same-stage
//     round trip, and creates no program after the first run.
//   - Proving rule #2 for real means moving the program on AFTER the delete, so
//     the delete stage and the current stage differ. That cannot be undone, so
//     every run strands a program. It runs only with E2E_ALLOW_ORPHANS=1, and
//     its program is named `e2e-crossstage-orphan-<ISO>` so it can be found later.
//
// Before 2026-10-06 this file created a fresh program per run (stranding four on
// myps_db_dev and one on myps_db_dpwh_2025) and "cleaned up"
// in an afterAll that could never succeed: it used the unauthenticated `request`
// fixture against a hard-coded :5015, and DeleteProgram refuses a program past
// BP anyway. It also reused the BP-era ProgramId after the advance, which
// regenerates it, so it passed only when create and advance fell in the same
// second. See crossStageFixture.ts for the ProgramId/ProgramPK rules.
// =============================================================================

import { test, expect } from '@playwright/test';
import { apiLogin, CROSS_STAGE_ORPHAN_PREFIX } from './helpers/lumpSumFixture';
import {
  addOrdinaryProject,
  advanceProgram,
  batchDelete,
  batchRestore,
  createProgramAtBP,
  ensureCrossStageFixture,
  programCost,
  projectsAt,
  reloadProgram,
  STAGE_HGAB,
  STAGE_NEP,
  STAGE_NEPE,
} from './helpers/crossStageFixture';

const ids = (rows: any[]) => rows.map((r) => String(r.ProjectId));

test.describe('Batch Delete / Batch Restore — cross-stage visibility (operator scenario)', () => {
  test.describe.configure({ mode: 'serial' });

  test('a delete at NEP leaves the project listed at BP, and a restore puts it back at NEP', async ({ page }) => {
    await apiLogin(page);
    const { program, projectIdAtBP, projectIdAtNEP } = await ensureCrossStageFixture(page);

    // The fixture's starting state: one project, live on both stages.
    expect(ids(await projectsAt(page, program, 'NEP'))).toEqual([projectIdAtNEP]);
    expect(ids(await projectsAt(page, program, 'BP'))).toEqual([projectIdAtBP]);
    const costBefore = await programCost(page, program);
    if (costBefore === 0) {
      // The fixture project carries no funding, so a restore that skipped the recompute would still
      // read 0 and this round trip cannot catch it. The contract test
      // BatchAddExistingProject_RecomputesProgramCostInsideTransaction pins the call itself.
      test.info().annotations.push({ type: 'note', description: 'fixture program Cost is 0; the Cost round-trip check cannot detect a missing recompute' });
    }

    // Delete AT NEP, the program's current stage.
    const del = await batchDelete(page, program, projectIdAtNEP);
    expect(del.status, `BatchDelete failed: ${JSON.stringify(del.body)}`).toBe(200);
    expect(del.body.Title, `expected a real delete, got: ${JSON.stringify(del.body)}`).toBe('Project Deletion Successful');

    try {
      if (costBefore > 0) {
        // The fixture's only project is gone at NEP, so the recomputed Cost must drop.
        expect(await programCost(page, program), 'program Cost should drop after the delete').toBeLessThan(costBefore);
      }
      expect(ids(await projectsAt(page, program, 'NEP')), 'project must be gone from NEP after deleting it there').toEqual([]);
      // RULE #1: still listed at BP, the stage it was never deleted from.
      expect(
        ids(await projectsAt(page, program, 'BP')),
        'RULE #1 VIOLATED: the project should still be listed at BP after being deleted at NEP',
      ).toEqual([projectIdAtBP]);
    } finally {
      // Always put the fixture back, so a failed assertion above does not leave it
      // for the next run's self-heal (which would hide that this run failed).
      const restore = await batchRestore(page, program, projectIdAtNEP);
      expect(restore.status, `BatchAddExistingProject failed: ${JSON.stringify(restore.body)}`).toBe(200);
      expect(String(restore.body.Message ?? '')).toContain('restored to their original stage');
    }

    // Same-stage round trip: back at NEP, BP unchanged.
    expect(ids(await projectsAt(page, program, 'NEP')), 'restore should list the project at NEP again').toEqual([projectIdAtNEP]);
    expect(ids(await projectsAt(page, program, 'BP'))).toEqual([projectIdAtBP]);
    // RS1: the restore recomputes the stored program Cost, so the header matches its pre-delete figure.
    expect(await programCost(page, program), 'program Cost after delete + restore should equal Cost before the delete').toBe(costBefore);

    // Nothing left to restore: a second restore is refused, not reported as a success.
    const again = await batchRestore(page, program, projectIdAtNEP);
    expect(again.status, `a second restore should be refused: ${JSON.stringify(again.body)}`).toBe(400);
    expect(again.body.Title).toBe('No Projects Restored');

    // The run must not have changed which program the fixture is.
    expect((await reloadProgram(page, program.ProgramPK)).StageName).toBe('NEP');
  });

  test('RULE #2: a restore after the program moved on returns the project at the stage it was deleted from', async ({ page }) => {
    test.skip(
      !process.env.E2E_ALLOW_ORPHANS,
      'Strands one program per run (a program past BP cannot be deleted). Set E2E_ALLOW_ORPHANS=1 to run it.',
    );
    await apiLogin(page);

    const name = `${CROSS_STAGE_ORPHAN_PREFIX}${new Date().toISOString()}`;
    let program = await createProgramAtBP(page, name);
    console.log(`[cross-stage] orphan program created: ProgramPK=${program.ProgramPK} Name=${name}`);

    // Two projects: A is deleted and restored; B keeps the program advanceable
    // (UpdateProgramStage refuses a program with no projects at all).
    const descA = `${name} A`;
    const descB = `${name} B`;
    await addOrdinaryProject(page, program, descA);
    await addOrdinaryProject(page, program, descB);

    program = await advanceProgram(page, program, STAGE_NEP);
    expect(program.StageName).toBe('NEP');
    const atNEP = await projectsAt(page, program, 'NEP');
    const a = atNEP.find((r) => r.Description === descA);
    const b = atNEP.find((r) => r.Description === descB);
    expect(a && b, `both projects should be listed at NEP: ${JSON.stringify(atNEP)}`).toBeTruthy();

    // Delete A at NEP, then move the program on, so delete stage != current stage.
    const del = await batchDelete(page, program, String(a.ProjectId));
    expect(del.status, `BatchDelete failed: ${JSON.stringify(del.body)}`).toBe(200);
    program = await advanceProgram(page, program, STAGE_NEPE);
    expect(program.StageName).toBe('NEP-E');

    const restore = await batchRestore(page, program, String(a.ProjectId));
    expect(restore.status, `BatchAddExistingProject failed: ${JSON.stringify(restore.body)}`).toBe(200);

    // Back at NEP, where it was deleted...
    expect(
      (await projectsAt(page, program, 'NEP')).map((r) => r.Description).sort(),
      'RULE #2 VIOLATED: A should be listed at NEP again, beside B',
    ).toEqual([descA, descB].sort());
    // ...and NOT at the program's current stage. Matched by Description, not
    // ProjectId: after A's NEP revision is deleted, vProjectLatest resolves A to its
    // older BP revision, so an advance could carry A forward under its BP-era id.
    expect(
      (await projectsAt(page, program, 'NEP-E')).map((r) => r.Description),
      'RULE #2 VIOLATED: A should not be listed at NEP-E, the stage the program moved to after the delete',
    ).toEqual([descB]);
  });

  test('a project deleted at NEP stays out of every later stage, not just the next one', async ({ page }) => {
    test.skip(
      !process.env.E2E_ALLOW_ORPHANS,
      'Strands one program per run (a program past BP cannot be deleted). Set E2E_ALLOW_ORPHANS=1 to run it.',
    );
    await apiLogin(page);

    const name = `${CROSS_STAGE_ORPHAN_PREFIX}${new Date().toISOString()}`;
    let program = await createProgramAtBP(page, name);
    console.log(`[cross-stage] orphan program created: ProgramPK=${program.ProgramPK} Name=${name}`);

    const descA = `${name} A`;
    const descB = `${name} B`;
    await addOrdinaryProject(page, program, descA);
    await addOrdinaryProject(page, program, descB);

    program = await advanceProgram(page, program, STAGE_NEP);
    const a = (await projectsAt(page, program, 'NEP')).find((r) => r.Description === descA);
    expect(a, 'A should be listed at NEP').toBeTruthy();

    const del = await batchDelete(page, program, String(a.ProjectId));
    expect(del.status, `BatchDelete failed: ${JSON.stringify(del.body)}`).toBe(200);

    // The first advance after the delete skips A. The second is the one that used to bring it back:
    // A has no NEP-E row, and vProjectLatest still resolves it to its live BP revision.
    program = await advanceProgram(page, program, STAGE_NEPE);
    program = await advanceProgram(page, program, STAGE_HGAB);
    expect(program.StageName).toBe('HGAB');

    const descriptionsAt = async (stage: string) => (await projectsAt(page, program, stage)).map((r) => r.Description);
    expect(await descriptionsAt('NEP-E'), 'A must not be listed at NEP-E').toEqual([descB]);
    expect(await descriptionsAt('HGAB'), 'A must not come back at HGAB, the second advance after its delete').toEqual([descB]);
  });

  test('a program whose every project was deleted at the current stage still advances', async ({ page }) => {
    test.skip(
      !process.env.E2E_ALLOW_ORPHANS,
      'Strands one program per run (a program past BP cannot be deleted). Set E2E_ALLOW_ORPHANS=1 to run it.',
    );
    await apiLogin(page);

    const name = `${CROSS_STAGE_ORPHAN_PREFIX}${new Date().toISOString()}`;
    let program = await createProgramAtBP(page, name);
    console.log(`[cross-stage] orphan program created: ProgramPK=${program.ProgramPK} Name=${name}`);

    const desc = `${name} only`;
    await addOrdinaryProject(page, program, desc);
    program = await advanceProgram(page, program, STAGE_NEP);
    const only = (await projectsAt(page, program, 'NEP')).find((r) => r.Description === desc);
    expect(only, 'the project should be listed at NEP').toBeTruthy();

    const del = await batchDelete(page, program, String(only.ProjectId));
    expect(del.status, `BatchDelete failed: ${JSON.stringify(del.body)}`).toBe(200);

    // Advancement specification AT-STG-007: zero active projects advances with zero copied projects.
    // advanceProgram throws on any non-200, so reaching the next line is the 200.
    program = await advanceProgram(page, program, STAGE_NEPE);
    expect(program.StageName).toBe('NEP-E');
    expect(await projectsAt(page, program, 'NEP-E'), 'nothing is copied to NEP-E').toEqual([]);
  });
});
