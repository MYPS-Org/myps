// =============================================================================
// approvedProgramFixture.ts — a program the suite may approve, and put back.
//
// WHY A PROGRAM OF ITS OWN. An Approved program at GAA-R refuses creating and
// deleting a Lump Sum Project in it (2026-09-09 — the rule is that narrow;
// Replenish, Import, Save and the child Delete all stay allowed), and approving one runs
// dbo.pRecomputeProjectPublishable over every project it holds — which can
// DEMOTE real projects' publishability. So the approval specs never touch a
// program that programOnStage might hand to anyone else: they flip a dedicated
// one, created at GAA and advanced to GAA-R (see below), found by name after
// that. It is never swept; it is one row named unmistakably.
//
// WHY IT MUST ALWAYS END WORKING. A run that aborts while the fixture program is
// Approved leaves its parents unsweepable — DeleteLumpSum is refused under the
// gate — so every helper here restores Working in a finally, and the sweeper
// (lumpSumSweeper.ts) restores it BEFORE it sweeps.
//
// HOW IT REACHES GAA-R. Not by being created there: AddProgram writes
// tProgramStages.StageName from the ENUM name ("GAAR"), and the table's foreign
// key is composite on (StageId, StageName) against the lookup's "GAA-R" — so a
// direct create at any hyphenated stage fails on the FK (a pre-existing defect,
// same "GAAR" vs "GAA-R" class the gate itself avoids). Real programs reach
// GAA-R by ADVANCING, and UpdateProgramStage writes the lookup's name. So the
// fixture is created at GAA, seeded with one Lump Sum parent (the advance
// refuses a program with no projects), advanced, and the seed removed.
//
// HOW STATUS IS FLIPPED. The Program page's own path: read the revision back
// from /Program/ProgramDetails and post it to /Program/UpdateProgramDetails
// with Status changed (1 = Approved, 3 = Working, DBHelper EnumProgramStatus).
// That endpoint matches on ProgramId AND ProgramPK and requires StageName to be
// the latest stage; for a program AddProgram created, ProgramId equals
// ProgramPK, which is why this file creates rather than adopts one.
// =============================================================================

import type { APIRequestContext, Page } from '@playwright/test';
import {
  APPROVAL_FIXTURE_PROGRAM,
  APPROVAL_FIXTURE_PROGRAM_GAA,
  listPrograms,
  listProgramsWith,
  post,
  provisionLumpSum,
} from './lumpSumFixture';
import { API_URL as API } from './importWorkbook';

/** EnumProgramStatus: Approved = 1, Working = 3. Names, so a spec cannot send a code by mistake. */
export type ProgramStatusName = 'Approved' | 'Working';
const STATUS_CODE: Record<ProgramStatusName, number> = { Approved: 1, Working: 3 };

/** EnumProgramStage codes the fixture uses. GAAR = 7 is the revision stage; GAA = 6 is the "approved but not gated" pin. */
export const STAGE_GAAR = 7;
export const STAGE_GAA = 6;

/** The fixture program as vProgramLatest reports it. */
export interface FixtureProgram {
  ProgramPK: string;
  ProgramId: string;
  Name: string;
  StageName: string;
  Status: string;
  StartYear: number;
}

const asFixture = (row: any): FixtureProgram => ({
  ProgramPK: String(row.ProgramPK),
  ProgramId: String(row.ProgramId),
  Name: String(row.Name),
  StageName: String(row.StageName ?? ''),
  Status: String(row.Status ?? ''),
  StartYear: Number(row.StartYear ?? new Date().getFullYear()),
});

/**
 * A donor's group list with its blank members dropped.
 *
 * Migrated programs can carry one: on myps_db_dpwh_2025 four of the 27 GAA-R
 * programs hold `[" ", "OI10"]` in DataSecurityGroup, and the first of them is
 * the donor the lookup below lands on. AddProgram validates every member
 * against vAdminImplementingOffice and refuses the blank
 * ("Security Group ' ' is not valid."), so copying the list verbatim made the
 * fixture uncreatable there — for a reason unrelated to anything a spec tests.
 */
const withoutBlanks = (groups: unknown): unknown[] =>
  (Array.isArray(groups) ? groups : []).filter((g) => String(g ?? '').trim() !== '');

/** The fixture program by name, or null. */
export const findFixtureProgram = async (
  page: Page,
  name: string = APPROVAL_FIXTURE_PROGRAM,
): Promise<FixtureProgram | null> => {
  const row = (await listPrograms(page)).find((p) => String(p.Name ?? '') === name);
  return row ? asFixture(row) : null;
};

/**
 * Find or create the fixture program. Created Working at GAA, copying its
 * security and user groups from any existing GAA-R program so it is visible to
 * the same users; Type 1 (Regular Infrastructure), since AddProgram forces a
 * Trust Fund program onto the TF stage. When GAA-R is wanted (the default) the
 * program is then ADVANCED there — see the header for why it cannot be created
 * there — which needs one project to exist, so a Lump Sum parent is seeded and
 * removed again.
 */
export const ensureFixtureProgram = async (
  page: Page,
  opts: { name?: string; stage?: number } = {},
): Promise<FixtureProgram> => {
  const name = opts.name ?? APPROVAL_FIXTURE_PROGRAM;
  const stage = opts.stage ?? STAGE_GAAR;
  const wanted = stage === STAGE_GAAR ? 'GAA-R' : 'GAA';

  // One listing serves both the find and the donor search.
  const programs = await listPrograms(page);
  const existingRow = programs.find((p) => String(p.Name ?? '') === name);
  let created = existingRow ? asFixture(existingRow) : null;

  if (created && created.StageName === wanted) return created;
  if (created && stage === STAGE_GAA) {
    throw new Error(`the fixture program '${name}' is at '${created.StageName}', not GAA; it cannot be moved back.`);
  }
  /*  Either it does not exist, or an earlier run died between creating it at GAA
      and advancing it — in which case it is reused and advanced below rather than
      silently returned at the wrong stage. */

  if (!created) {
    const donor = programs.find((p) => /^GAA-R$/.test(String(p.StageName ?? '')));
    if (!donor) throw new Error('no GAA-R program to copy security groups from.');

    const added = await post(page, '/api/Program/AddProgram', {
      Stage: STAGE_GAA,
      Status: STATUS_CODE.Working,
      Type: 1,
      Name: name,
      YearStart: new Date().getFullYear(),
      DataSecurityGroup: withoutBlanks(donor.DataSecurityGroup),
      UserGroup: withoutBlanks(donor.UserGroup),
      IsSkipped: false,
    });
    if (added.status !== 200) {
      throw new Error(`could not create the fixture program: ${JSON.stringify(added.body).slice(0, 300)}`);
    }

    created = await findFixtureProgram(page, name);
    if (!created) throw new Error(`the fixture program '${name}' was created but is not listed.`);
    if (stage === STAGE_GAA) return created;
  }

  // Seed, advance, unseed. The seed carries the e2e marker, so the sweeper has it
  // as a fallback if the delete below is refused for any reason.
  const seed = await provisionLumpSum(page, 1_000_000, `${name} seed`, { programPK: created.ProgramPK });
  const advanced = await post(page, '/api/Program/UpdateProgramStage', {
    ProgramPK: created.ProgramPK,
    ProgramId: created.ProgramId,
    Stage: stage,
    Name: name,
  });
  if (advanced.status !== 200) {
    throw new Error(`could not advance the fixture program: ${JSON.stringify(advanced.body).slice(0, 300)}`);
  }
  await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: seed.lumpSumId });

  created = await findFixtureProgram(page, name);
  if (!created || created.StageName !== 'GAA-R') {
    throw new Error(`the fixture program '${name}' did not land on GAA-R (at '${created?.StageName}').`);
  }
  return created;
};

/**
 * Set the fixture program's status through the Program page's own endpoints.
 * Surfaces the server's body on refusal: a database without
 * pRecomputeProjectPublishable fails the Approved flip here, by name.
 */
export const setProgramStatus = async (
  page: Page,
  program: FixtureProgram,
  status: ProgramStatusName,
): Promise<void> => {
  await setProgramStatusWith(page.request, program, status);
};

/** The same flip on a bare request context — the sweeper has no Page. */
export const setProgramStatusWith = async (
  ctx: APIRequestContext,
  program: Pick<FixtureProgram, 'ProgramPK' | 'StageName' | 'Name'>,
  status: ProgramStatusName,
): Promise<void> => {
  const details = await ctx.post(`${API}/api/Program/ProgramDetails`, {
    data: { ProgramId: program.ProgramPK, StageName: program.StageName },
  });
  if (details.status() !== 200) {
    throw new Error(`could not read ${program.Name}: ${(await details.text()).slice(0, 300)}`);
  }
  const d = (await details.json()).Details;

  // Already there: nothing to write, and UpdateProgramDetails would write nothing either.
  if (Number(d.Status) === STATUS_CODE[status]) return;

  const updated = await ctx.post(`${API}/api/Program/UpdateProgramDetails`, {
    data: { ...d, YearStart: d.StartYear, Status: STATUS_CODE[status] },
  });
  if (updated.status() !== 200) {
    throw new Error(
      `could not set ${program.Name} to ${status}: ${(await updated.text()).slice(0, 300)}`,
    );
  }
};

/**
 * Run `fn` against the fixture program, which starts Working and ALWAYS ends
 * Working. `fn` decides when to approve — typically after provisioning, since
 * CreateLumpSum is refused under the gate.
 */
export const withFixtureProgram = async <T>(
  page: Page,
  fn: (ctx: {
    program: FixtureProgram;
    approve: () => Promise<void>;
    restore: () => Promise<void>;
  }) => Promise<T>,
  opts: { name?: string; stage?: number } = {},
): Promise<T> => {
  const program = await ensureFixtureProgram(page, opts);
  await setProgramStatus(page, program, 'Working');
  try {
    return await fn({
      program,
      approve: () => setProgramStatus(page, program, 'Approved'),
      restore: () => setProgramStatus(page, program, 'Working'),
    });
  } finally {
    await setProgramStatus(page, program, 'Working');
  }
};

/**
 * For the sweeper: put every fixture program back to Working before anything is
 * swept, so an aborted run's orphans can be deleted. Quiet on any failure — a
 * teardown must never fail a run for a reason unrelated to what it tested.
 */
export const restoreFixtureProgramsWith = async (ctx: APIRequestContext): Promise<void> => {
  /*  Nothing here may escape: the sweeper awaits this BEFORE it lists orphans,
      and a program endpoint that is down must not stop Lump Sum rows being swept. */
  try {
    const rows = await listProgramsWith(ctx);
    for (const name of [APPROVAL_FIXTURE_PROGRAM, APPROVAL_FIXTURE_PROGRAM_GAA]) {
      const row = rows.find((p) => String(p.Name ?? '') === name);
      if (!row || String(row.Status ?? '') !== 'Approved') continue;
      try {
        await setProgramStatusWith(ctx, asFixture(row), 'Working');
        console.log(`[sweeper] restored '${name}' to Working.`);
      } catch (error) {
        console.warn(`[sweeper] could not restore '${name}': ${error instanceof Error ? error.message : error}`);
      }
    }
  } catch (error) {
    console.warn(`[sweeper] could not list programs to restore: ${error instanceof Error ? error.message : error}`);
  }
};
