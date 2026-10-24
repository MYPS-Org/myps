// =============================================================================
// crossStageFixture.ts — a program with one project on two stages, kept forever.
//
// WHY A PROGRAM OF ITS OWN, NEVER SWEPT. Proving that a Batch Delete at one stage
// leaves another stage alone needs a project that exists on two stages, and the
// only way to get one is to ADVANCE its program (UpdateProgramStage copies every
// live project forward as a new revision). Once a program is past BP nothing can
// delete it: DeleteProgram's StagesToCheck guard refuses it unconditionally, by
// design. A per-run program is therefore a permanent orphan. Before 2026-10-06 the
// spec made one per run, stranding four on myps_db_dev and one on
// myps_db_dpwh_2025. So, like the approval fixture (approvedProgramFixture.ts),
// this program is created once, found by an unmistakable name, and every run
// leaves it exactly as it found it.
//
// TWO IDENTIFIERS, AND THE ENDPOINTS DISAGREE ON WHICH ONE THEY WANT.
//   - ProgramPK never changes.
//   - ProgramId is REGENERATED on every stage advance ("<host>_<MMddyyyy>_<HHmmss>"
//     at the time of the advance; UpdateProgramStage, NewProgramUniqueId). It
//     equals ProgramPK only until the first advance.
//   - BatchDelete, BatchAddExistingProject and UpdateProgramStage look the program
//     up by the CURRENT ProgramId (vProgramLatest.ProgramId).
//   - ShowProjectsInProgram's field is called ProgramId, but it is passed to
//     fProgramProjects' @ProgramPK parameter, so it wants the ProgramPK.
//   The old spec used one variable for both. It passed only when create and advance
//   landed in the same second, so that the regenerated id happened to equal the old.
//
// UpdateProgramStage TAKES THE NAME FROM THE REQUEST. The new program revision is
// written with `Name = dto.Name`, so an advance that omits Name blanks the
// program's name, and a find-by-name never sees it again. That is how program 71
// on myps_db_dpwh_2025 lost its name. Always send it.
// =============================================================================

import type { Page } from '@playwright/test';
import { withoutBlanks } from './approvedProgramFixture';
import { CROSS_STAGE_FIXTURE_PROGRAM, listPrograms, post, programByPK } from './lumpSumFixture';

/** EnumProgramStage codes this fixture uses. */
export const STAGE_BP = 1;
export const STAGE_NEP = 2;
export const STAGE_NEPE = 3;
export const STAGE_HGAB = 4;

export interface CrossStageProgram {
  ProgramPK: string;
  /** The CURRENT ProgramId; re-read after every advance. */
  ProgramId: string;
  Name: string;
  StageName: string;
}

const asProgram = (row: any): CrossStageProgram => ({
  ProgramPK: String(row.ProgramPK),
  ProgramId: String(row.ProgramId),
  Name: String(row.Name ?? ''),
  StageName: String(row.StageName ?? ''),
});

/** The program as vProgramLatest reports it now. Throws rather than returning a stale id. */
export const reloadProgram = async (page: Page, programPK: string): Promise<CrossStageProgram> => {
  const row = await programByPK(page, programPK);
  if (!row) throw new Error(`program ${programPK} is not listed.`);
  return asProgram(row);
};

/** The projects one stage of a program lists, i.e. what the Program Details table shows. */
export const projectsAt = async (page: Page, program: CrossStageProgram, stageName: string): Promise<any[]> => {
  const res = await post(page, '/api/Program/ShowProjectsInProgram', {
    ProgramId: program.ProgramPK, // fProgramProjects' @ProgramPK, despite the field name (see header)
    StageName: stageName,
    Filters: {},
    limit: 50,
    page: 1,
    Navigation: 0,
    PreviousFilteredId: 0,
    NextFilteredId: 0,
    PageCursorId: 0,
    sortDirection: 0,
  });
  if (res.status !== 200) {
    throw new Error(`ShowProjectsInProgram(${stageName}) failed: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return (res.body?.lists ?? res.body?.Data?.lists ?? []) as any[];
};

/** Create a Working, Regular Infrastructure program at BP, copying a donor's groups. */
export const createProgramAtBP = async (page: Page, name: string): Promise<CrossStageProgram> => {
  const programs = await listPrograms(page);
  const donor = programs.find((p) => Array.isArray(p.DataSecurityGroup) && withoutBlanks(p.DataSecurityGroup).length > 0);
  if (!donor) throw new Error('no existing program to copy a valid DataSecurityGroup from.');

  const added = await post(page, '/api/Program/AddProgram', {
    Stage: STAGE_BP,
    Status: 3, // Working
    Type: 1, // Regular Infrastructure
    Name: name,
    YearStart: new Date().getFullYear(),
    DataSecurityGroup: withoutBlanks(donor.DataSecurityGroup),
    UserGroup: withoutBlanks(donor.UserGroup),
    IsSkipped: false,
  });
  if (added.status !== 200) throw new Error(`AddProgram failed: ${JSON.stringify(added.body).slice(0, 300)}`);

  const row = (await listPrograms(page)).find((p) => String(p.Name ?? '') === name);
  if (!row) throw new Error(`program '${name}' was created but is not listed.`);
  return asProgram(row);
};

/*  THE AddProject PAYLOAD BELOW IS COMPLETE ON PURPOSE, AND EVERY FIELD WAS
    EARNED THE HARD WAY (2026-10-05, against myps_db_dev). ValidateProjectDetailsLookups
    (Helpers/ProjectHelper.cs) checks each one against a live lookup table and rejects
    the whole request if any single one is missing or invalid:
      - Province, City, LegislativeDistrict must be real codes under the Region
        ('OI237'): '652' (Aurora), '661' (Baler), '656'. An empty string is rejected,
        not treated as "skip".
      - ImplementationMode, EmergencyMode, RowAvailable, DetailedDesign are validated
        against their own lookups even though the DTO declares them nullable;
        omitting them fails the same check as a wrong value.
      - Feasibility other than its "not applicable" code REQUIRES FeasibilityDate.
      - IslandCode must be the Region's own IslandCode ('LZ' for OI237, from
        tOptionAdminAreaRegion), not the Region code.
      - ProjectType must be an explicit '' for an ordinary project: the controller
        does `ProjectType = dto.ProjectType!`, so an omitted value is a NOT NULL
        violation at the database ("DatabaseSaveFailure"), not a clean 400.
      - Category must still have Project ID range on the target database. Category 16
        is exhausted on myps_db_dev; Category 1 was not. "Project ID Range Exhausted"
        later means the range was consumed, not that the code broke: pick another
        active CategoryId from tOptionProjectCategory.
    An ORDINARY project, not a Lump Sum one: AddProject needs no CreateLumpSum grant. */
export const addOrdinaryProject = async (page: Page, program: CrossStageProgram, description: string, stageName = 'BP'): Promise<string> => {
  const res = await post(page, '/api/Project/AddProject', {
    ProgramId: program.ProgramId,
    StageName: stageName,
    Description: description,
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
  if (res.status !== 200) throw new Error(`AddProject failed: ${JSON.stringify(res.body).slice(0, 300)}`);
  return String(res.body?.ProjectId ?? ''); // AddProject answers with the new ProjectPK
};

/** Advance a program one stage and return it re-read, with its NEW ProgramId. */
export const advanceProgram = async (page: Page, program: CrossStageProgram, stage: number): Promise<CrossStageProgram> => {
  const res = await post(page, '/api/Program/UpdateProgramStage', {
    ProgramId: program.ProgramId,
    ProgramPK: program.ProgramPK,
    Stage: stage,
    Name: program.Name, // written verbatim to the new revision (see header)
  });
  if (res.status !== 200) {
    throw new Error(`UpdateProgramStage(${program.StageName} -> ${stage}) failed: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return reloadProgram(page, program.ProgramPK);
};

/** Restore through the action under test's own endpoint; returns the raw response. */
export const batchRestore = (page: Page, program: CrossStageProgram, projectIds: string) =>
  post(page, '/api/Program/BatchAddExistingProject', { ProgramId: program.ProgramId, ProjectIds: projectIds });

/**
 * The program's STORED Cost (tProgramRevisions.Cost via fProgramDetails), i.e. the figure the
 * Program Details header shows. Batch Delete and Batch Restore must both recompute it.
 */
export const programCost = async (page: Page, program: CrossStageProgram): Promise<number> => {
  const res = await post(page, '/api/Program/ProgramDetails', { ProgramId: program.ProgramPK, StageName: program.StageName });
  if (res.status !== 200) {
    throw new Error(`ProgramDetails(${program.ProgramPK}) failed: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  // The raw response carries Details at the top level (the FE's httpClient is what wraps it in Data).
  const cost = Number(res.body?.Details?.Cost);
  if (!Number.isFinite(cost)) {
    throw new Error(`ProgramDetails(${program.ProgramPK}) has no numeric Details.Cost: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return cost;
};

/** Delete through the action under test's own endpoint; returns the raw response. */
export const batchDelete = (page: Page, program: CrossStageProgram, projectIds: string) =>
  post(page, '/api/Program/BatchDelete', { ProgramId: program.ProgramId, ProjectIds: projectIds });

/** The NEP ProjectId a BP one becomes on the BP -> NEP advance (ReplaceFirst("BP", "P"); GenerateProjec1stSegment). */
export const nepProjectId = (bpProjectId: string): string => bpProjectId.replace(/^BP/, 'P');

export interface CrossStageFixture {
  program: CrossStageProgram;
  /** The project's id on its BP revision. */
  projectIdAtBP: string;
  /** The same project's id on its NEP revision. */
  projectIdAtNEP: string;
}

/**
 * Find or build the fixture: the named program at NEP, with ONE project that is
 * live on both its BP and its NEP revision. Heals what an aborted run can leave:
 *   - created at BP but never advanced (with or without its project): finish it;
 *   - the project deleted at NEP but not restored: restore it.
 * Anything else (a second project, a later stage) is not something this suite
 * produces, so it throws and names the state rather than guessing.
 */
export const ensureCrossStageFixture = async (page: Page): Promise<CrossStageFixture> => {
  const row = (await listPrograms(page)).find((p) => String(p.Name ?? '') === CROSS_STAGE_FIXTURE_PROGRAM);
  let program = row ? asProgram(row) : await createProgramAtBP(page, CROSS_STAGE_FIXTURE_PROGRAM);

  if (program.StageName === 'BP') {
    if ((await projectsAt(page, program, 'BP')).length === 0) {
      await addOrdinaryProject(page, program, `${CROSS_STAGE_FIXTURE_PROGRAM} project`);
    }
    program = await advanceProgram(page, program, STAGE_NEP);
  }
  if (program.StageName !== 'NEP') {
    throw new Error(`the cross-stage fixture program is at '${program.StageName}', not NEP; it cannot be moved back.`);
  }

  const atBP = await projectsAt(page, program, 'BP');
  if (atBP.length !== 1) {
    throw new Error(`the cross-stage fixture should list exactly one project at BP, not ${atBP.length}.`);
  }
  const projectIdAtBP = String(atBP[0].ProjectId);
  const projectIdAtNEP = nepProjectId(projectIdAtBP);

  const atNEP = await projectsAt(page, program, 'NEP');
  if (atNEP.length === 0) {
    // A previous run died between its delete and its restore.
    const healed = await batchRestore(page, program, projectIdAtNEP);
    if (healed.status !== 200) {
      throw new Error(`could not heal the cross-stage fixture (restore of ${projectIdAtNEP}): ${JSON.stringify(healed.body).slice(0, 300)}`);
    }
  } else if (atNEP.length !== 1 || String(atNEP[0].ProjectId) !== projectIdAtNEP) {
    throw new Error(`the cross-stage fixture lists ${JSON.stringify(atNEP.map((p) => p.ProjectId))} at NEP, expected [${projectIdAtNEP}].`);
  }

  return { program, projectIdAtBP, projectIdAtNEP };
};
