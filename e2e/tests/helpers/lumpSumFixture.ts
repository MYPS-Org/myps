// =============================================================================
// lumpSumFixture.ts — provision a fresh Lump Sum Project for a spec to spend.
//
// Itemizing CONSUMES a parent: the allocation only goes down, and there is no
// un-itemize. A spec pinned to a hard-coded parent therefore passes once and
// fails every run after — which reads as a regression and is not one. So each
// run makes its own.
//
// Creation is FIXTURE-BUILDING, so it goes through the API. Per e2e/CLAUDE.md,
// page.request.post is for building fixtures and for reading results back —
// never for performing the action under test.
//
// V2 NOTE. This is a rewrite of the V1 fixture, not a port. Every part of its
// contract moved: the actions were renamed (CreateLumpsum -> CreateLumpSum),
// the response keys were renamed (WalletId -> LumpSumId, Wallet ->
// LumpSumProject), and the field spec now requires five fields the old payload
// never sent. The old payload does not 404 — it comes back as a 200-shaped
// refusal ("Select a Sub-Category."), which is a far more confusing failure.
// =============================================================================

import type { APIRequestContext, Page } from '@playwright/test';
import { buildImportWorkbook, postImportWorkbook, type ImportChildSpec } from './importWorkbook';

/*  The stage at which a Lump Sum Project can be itemized or replenished.

    GAA-R only, per the client's revised business rule (2026-09-04). TF-R was
    admitted until then. Anchored so it cannot match a longer stage name that
    merely contains it. Mirrors LumpsumController.RevisionStages. */
const ITEMIZABLE = /^GAA-R$/;

/*  THE ONE PROGRAM THE SUITE IS ALLOWED TO APPROVE (2026-09-09). Approving a
    program at GAA-R runs pRecomputeProjectPublishable over every project in
    it, so the approval specs flip a program of their own — created once by
    approvedProgramFixture.ts, never swept — and no other fixture may pick it,
    or a parent provisioned there would freeze under the other spec's feet. */
export const APPROVAL_FIXTURE_PROGRAM = 'E2E LS approval fixture';
export const APPROVAL_FIXTURE_PROGRAM_GAA = 'E2E LS approval fixture (GAA)';
const FIXTURE_PROGRAMS = new Set([APPROVAL_FIXTURE_PROGRAM, APPROVAL_FIXTURE_PROGRAM_GAA]);

/*  WHERE THE API IS.

    UI specs go through Vite on :8080, which proxies /api to whatever
    FE/.env.development's VITE_API_BASE_URL names — a REMOTE server by default,
    not this machine. An API-contract spec must not depend on that: it addresses
    the API directly, so it needs neither the dev server nor a change to anyone's
    env file. Override with E2E_API_URL. */
const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

export const post = async (page: Page, url: string, data: unknown) => {
  const res = await page.request.post(url.startsWith('http') ? url : `${API}${url}`, { data });
  const text = await res.text();
  try { return { status: res.status(), body: JSON.parse(text) as any }; }
  catch { return { status: res.status(), body: text as any }; }
};

/**
 * Authenticate against the API directly, without the login form.
 *
 * The form login in auth.ts drives the real UI and is what a narrated spec
 * should use. A contract spec has no UI to drive, and requiring one would make
 * the backend untestable until phase 4 — so it posts to AuthController instead.
 * The session cookie lands in the page's request context either way.
 */
export const apiLogin = async (page: Page) => {
  const res = await page.request.post(`${API}/api/Auth/Login`, {
    data: {
      UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
      Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
    },
  });
  if (res.status() !== 200) {
    throw new Error(`API login failed (${res.status()}). Set E2E_USERNAME / E2E_PASSWORD.`);
  }
};

/** One Lump Sum Project as the list reports it. */
export const lumpSum = async (page: Page, id: number) => {
  const res = await post(page, '/api/Lumpsum/ShowLumpSum', {
    Filters: {}, limit: 200, page: 1,
    Navigation: 0, PreviousFilteredId: 0, NextFilteredId: 0, PageCursorId: 0, sortDirection: 0,
  });
  return ((res.body?.lists ?? []) as any[]).find((w) => w.Id === id) ?? null;
};

/**
 * Find a program by its stage. A Lump Sum Project's stage is mirrored from its
 * program and is never accepted from the client, so choosing the program is the
 * only way a spec can put a parent on a particular stage.
 *
 * `onRevisionStage: false` is how the off-stage refusals are driven — see the
 * "refused off the revision stages" test.
 */
/**
 * The first program on (or off) the itemizable stage.
 *
 * Exported because UI specs need it too: a spec that types a program NAME into
 * the form's picker must ask which programs exist rather than hard-coding one.
 * ls-module-ui-walkthrough spent weeks failing on a literal "Trust Funds" after
 * TF-R stopped being itemizable and the sample data moved to GAA-R.
 */
/** The program list as vProgramLatest reports it, on a bare request context (the sweeper has no Page). */
export const listProgramsWith = async (ctx: APIRequestContext): Promise<any[]> => {
  const res = await ctx.post(`${API}/api/program/showprogram`, {
    data: {
      Filters: { Name: '', StartYear: null, StageName: '', Type: '' },
      page: 1, limit: 200, sortDirection: 0,
    },
  });
  if (res.status() !== 200) return [];
  return ((await res.json())?.lists ?? []) as any[];
};

export const listPrograms = (page: Page): Promise<any[]> => listProgramsWith(page.request);

/** One program by its ProgramPK, as vProgramLatest reports it, or null. */
export const programByPK = async (page: Page, programPK: string) =>
  (await listPrograms(page)).find((p) => p.ProgramPK === programPK) ?? null;

/**
 * NOT AN APPROVED GAA-R ONE (2026-09-09). A program Approved AT GAA-R refuses
 * CreateLumpSum (and DeleteLumpSum; nothing else), so a fixture that landed on
 * one would fail to provision, and in a serial file take every later test with
 * it. Only that combination is gated: off the revision stage an
 * Approved program is as good as any other, so the status filter applies to the
 * on-stage pick alone. The rows are vProgramLatest and carry Status, so the
 * check is free. The approval fixture programs are skipped too, for the reason
 * given above. Returns null when nothing qualifies — the callers say why.
 */
export const programOnStage = async (page: Page, onRevisionStage: boolean) => {
  const programs = await listPrograms(page);
  return programs.find(
    (p) => ITEMIZABLE.test(String(p.StageName ?? '')) === onRevisionStage
      && !FIXTURE_PROGRAMS.has(String(p.Name ?? ''))
      && !(onRevisionStage && String(p.Status ?? '') === 'Approved'),
  ) ?? null;
};

export interface ProvisionedLumpSum {
  /** vLumpSumSet.Id — what every Lump Sum-scoped endpoint calls LumpSumId. */
  lumpSumId: number;
  projectId: string;
  allocation: number;
  /** tPrograms.ProgramPK — the import form marks ProgramId [Required] and cross-checks it against the parent. */
  programPK: string;
  /**
   * tPrograms.StartYear. An imported child's Activity Year may not precede it,
   * so importChild dates its rows from here. Falls back to the current year
   * for a pinned LS_PARENT, whose program row is not fetched.
   */
  programStartYear: number;
}

/**
 * Create a Lump Sum Project this run may spend freely.
 *
 * Honours LS_PARENT when set, so a run can still be pointed at a specific parent
 * for debugging; otherwise it makes a new one.
 *
 * THE PAYLOAD IS THE V2 FIELD SPEC. Required: ProgramId, CategoryId,
 * SubCategoryId, OperatingUnit, Description, RegionWide, Agency, Origin, plus
 * the allocation and its funding line. Region, Province, City, Legislative
 * District, DEO and Implementing Office are deliberately OMITTED — the spec
 * makes them optional, and leaving them out is what exercises that.
 *
 * Tier: 2 is sent EXPLICITLY although Tier stopped being required on
 * 2026-09-06 (the form no longer collects it; CreateLumpSum defaults an absent
 * one to 1). Keeping a non-default value here is what lets ls-contract tell
 * "the server honoured what I sent" apart from "the server defaulted".
 *
 * Category 16 is "OO1: Ensure Safe and Reliable National Road System" — a
 * current category, not one of the MFO rows retired in 2017.
 *
 * FundingAgreement is DPWH-GAA-2025. The V1 fixture used DPWH-GAA-2015, which
 * also validates — both codes exist — but funding current work from a 2015
 * appropriation is misleading to leave in a suite.
 */
export const provisionLumpSum = async (
  page: Page,
  allocation: number,
  label: string,
  opts: { onRevisionStage?: boolean; programPK?: string } = {},
): Promise<ProvisionedLumpSum> => {
  const onRevisionStage = opts.onRevisionStage ?? true;
  // LS_PARENT cannot satisfy a stage requirement it knows nothing about, so it
  // is honoured only for the default (revision-stage) case — and never when a
  // spec names the program it must provision inside.
  const pinned = onRevisionStage && !opts.programPK ? Number(process.env.LS_PARENT ?? 0) : 0;
  if (pinned > 0) {
    const existing = await lumpSum(page, pinned);
    if (!existing) throw new Error(`LS_PARENT=${pinned} was not found.`);
    return {
      lumpSumId: existing.Id,
      projectId: existing.ProjectId,
      allocation: Number(existing.OriginalAllocation ?? existing.Remaining),
      programPK: existing.ProgramFK,
      programStartYear: Number(existing.StartYear ?? new Date().getFullYear()),
    };
  }

  /*  A named program wins (the approval specs provision inside their own fixture
      program, which programOnStage deliberately never picks). */
  const program = opts.programPK
    ? await programByPK(page, opts.programPK)
    : await programOnStage(page, onRevisionStage);
  if (!program) {
    throw new Error(
      opts.programPK
        ? `program ${opts.programPK} was not found.`
        : onRevisionStage
          ? 'no GAA-R program that is still Working to create a Lump Sum Project against ' +
            '(an Approved one would refuse CreateLumpSum; set one back to Working).'
          : 'no program off GAA-R to create a Lump Sum Project against.',
    );
  }

  const created = await post(page, '/api/Lumpsum/CreateLumpSum', {
    ProgramId: program.ProgramPK,
    CategoryId: 16,
    SubCategoryId: 1082,
    OperatingUnit: 'OI46',
    Description: `${label} (e2e ${new Date().toISOString().slice(0, 19)})`,
    Tier: 2,
    RegionWide: 1,
    Agency: 1001,
    Origin: 13,
    Allocation: allocation,
    FundingSource: 'GOP',
    FundingAgreement: 'DPWH-GAA-2025',
  });

  if (created.status !== 200) {
    throw new Error(`could not provision a Lump Sum Project: ${JSON.stringify(created.body)}`);
  }

  return {
    lumpSumId: created.body.LumpSumId,
    projectId: created.body.LumpSumProject?.ProjectId,
    allocation,
    programPK: program.ProgramPK,
    programStartYear: Number(program.StartYear ?? new Date().getFullYear()),
  };
};

/** Region III — tOptionAdminAreaRegion.ParticipantId. Its IslandCode is LZ, so
 *  every child imported by this fixture must end up with an LZ-suffixed
 *  ProjectId. The migrated MyMYPS sample sits in this same region. */
export const IMPORT_REGION = 'OI237';
export const IMPORT_REGION_ISLAND_CODE = 'LZ';

/**
 * Import one itemized child under a parent — by WORKBOOK, as the dialog does.
 *
 * The child is written into the live Download Template by importWorkbook.ts,
 * with Region III names so its Project ID ends in IMPORT_REGION_ISLAND_CODE,
 * and posted as multipart. The label is the workbook's placeholder Project ID
 * and the start of the child's Description; it does NOT land in AlternateId,
 * which is the parent's Project ID by rule — find the child by Description.
 *
 * MODE 2 IS GONE. A Lump Sum Project is itemized into NEW projects only, never
 * existing ones, so there is no "attach this project" call to make — a fixture
 * that needs a parent WITH children must import them. This is the only
 * itemization path the module has.
 */
export const importChild = async (
  page: Page,
  parent: ProvisionedLumpSum,
  cost: number,
  label: string,
  child: Partial<ImportChildSpec> = {},
) => {
  const workbook = await buildImportWorkbook(page, [{
    placeholderId: label,
    description: `${label} (e2e ${new Date().toISOString().slice(0, 19)})`,
    cost,
    activityYear: importActivityYear(parent),
    ...child,
  }]);
  return postImportWorkbook(page, parent, workbook);
};

/**
 * The year a child's component and major item are dated: never earlier than
 * the parent program's StartYear (a hard rule in both validators), never
 * earlier than today either.
 */
export const importActivityYear = (parent: ProvisionedLumpSum) =>
  Math.max(parent.programStartYear, new Date().getFullYear());
