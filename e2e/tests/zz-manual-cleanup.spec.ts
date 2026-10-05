// =============================================================================
// zz-manual-cleanup.spec.ts — one-off script, NOT a regression test.
//
// WHAT THIS IS. A throwaway tool used once, on 2026-10-05, to manually delete
// 13 programs left over on myps_db_dev from iterating on
// batch-delete-restore-cross-stage.spec.ts's AddProject payload (every field
// ValidateProjectDetailsLookups checks -- Province, City, LegislativeDistrict,
// ImplementationMode, EmergencyMode, RowAvailable, Feasibility+FeasibilityDate,
// DetailedDesign, a valid Category whose ID range wasn't exhausted, and the
// correct IslandCode -- had to be discovered one rejection at a time, and each
// failed attempt before AddProject finally succeeded still created a Program
// row via AddProgram, which DOES succeed on the first call).
//
// THE "zz" PREFIX is deliberate: Playwright's default file-name sort means
// this never runs before the real specs, and its name makes clear on sight
// that it is not part of the suite's coverage.
//
// WHY THIS IS NOT PICKED UP AS A REAL TEST. It has no assertions -- it is a
// fire-and-log script wearing a `test()` wrapper only because that is the
// simplest way to get an authenticated `page.request` context from Playwright.
// Running it is always a deliberate, manual, one-off action
// (`npx playwright test zz-manual-cleanup.spec.ts`), never part of a normal
// suite run.
//
// WHY THESE 3 SPECIFIC PROGRAMS NEEDED A SECOND PASS.
// `DeleteProgram` (ProgramController.cs) refuses a program that has
// progressed beyond BP ("cannot be deleted because it has progressed beyond
// the BP stage" is one branch; the other, hit on the first attempt below, is
// `ValidateProgramId`'s own "Outdated Program Stage" refusal when the
// StageName argument doesn't match the program's CURRENT stage). 10 of the 13
// leftover programs were still sitting at BP (their AddProject call had
// failed before the test ever reached the UpdateProgramStage advance) and
// deleted cleanly with `StageName: 'BP'`. These 3 had already advanced to NEP
// in an earlier, further-along failed run, so BP was rejected as outdated and
// a second pass with `StageName: 'NEP'` was required.
//
// WHY 4 PROGRAMS WERE LEFT BEHIND ANYWAY (not fixed by this script, and nei-
// ther this script nor any other normal path can fix them). Once a program
// has progressed PAST BP, `DeleteProgram`'s `StagesToCheck` guard refuses it
// unconditionally, regardless of which StageName is supplied -- this is a
// deliberate business rule (a program that has moved past BP is assumed to
// carry real downstream work and must not be deletable), not a bug. The
// operator was informed and explicitly chose to leave these as harmless,
// empty, named-for-cleanup-tracking orphans rather than have them removed by
// a raw SQL DELETE outside the application's own write path:
//
//   DESKTOP-OCATGDI_10052026_162906
//   DESKTOP-OCATGDI_10052026_162946
//   DESKTOP-OCATGDI_10052026_162959
//   DESKTOP-OCATGDI_10052026_163112  (the program from the PASSING run of
//                                      batch-delete-restore-cross-stage.spec.ts
//                                      itself -- its own afterAll cleanup hit
//                                      this exact same guard, since that run's
//                                      program also ends at NEP)
//
// If a future cleanup pass is ever done, it would need to go directly against
// the database (tProgramRevisions / tProgramStages / tProjects /
// tProjectRevisions for that ProgramFK), since no API endpoint in this
// codebase can remove a program once it has passed BP.
//
// This file is kept, rather than deleted after use, as a documented record of
// exactly what was created and why 4 rows are still sitting on myps_db_dev --
// so a future reader hitting those 4 names does not have to re-derive this.
// =============================================================================

import { test } from '@playwright/test';
import { post, apiLogin } from './helpers/lumpSumFixture';

test('one-off cleanup: delete leftover BP-stage e2e programs (2026-10-05)', async ({ page }) => {
  await apiLogin(page);
  const progsAtBP = [
    'DESKTOP-OCATGDI_10052026_162213',
    'DESKTOP-OCATGDI_10052026_162309',
    'DESKTOP-OCATGDI_10052026_162345',
    'DESKTOP-OCATGDI_10052026_162418',
    'DESKTOP-OCATGDI_10052026_162511',
    'DESKTOP-OCATGDI_10052026_162526',
    'DESKTOP-OCATGDI_10052026_162542',
    'DESKTOP-OCATGDI_10052026_162618',
    'DESKTOP-OCATGDI_10052026_162658',
    'DESKTOP-OCATGDI_10052026_162815',
  ];
  for (const p of progsAtBP) {
    const res = await post(page, '/api/Program/DeleteProgram', { ProgramId: p, StageName: 'BP' });
    console.log(p, '(BP) ->', res.status, JSON.stringify(res.body));
  }

  // These 3 had already advanced to NEP by the time their creating run
  // failed, so the BP-stage call above would refuse them as outdated.
  const progsAtNEP = [
    'DESKTOP-OCATGDI_10052026_162906',
    'DESKTOP-OCATGDI_10052026_162946',
    'DESKTOP-OCATGDI_10052026_162959',
  ];
  for (const p of progsAtNEP) {
    const res = await post(page, '/api/Program/DeleteProgram', { ProgramId: p, StageName: 'NEP' });
    // Expected outcome, confirmed live: 400 "cannot be deleted because it has
    // progressed beyond the BP stage" for every one of these. Logged, not
    // asserted on, because that refusal IS the documented, correct behavior
    // this comment block explains above -- not a failure of this script.
    console.log(p, '(NEP, expected to be refused) ->', res.status, JSON.stringify(res.body));
  }
});
