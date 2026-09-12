// =============================================================================
// importWorkbook.ts — build a filled import workbook the way a user would.
//
// ImportItemizedProjects takes the WORKBOOK, not rows: the file Download
// Template hands out, filled in, posted as multipart. So a fixture that needs
// an itemized child has to make one the same way — fetch the live template
// (its `_SysMeta` provenance marker, sheet names and header row are what the
// server gates on), write rows under the headers, and post the bytes.
//
// NAMES, NOT CODES. The server's validators match the option tables by NAME
// (ImportingHelper.NamesMatch) — the values the template's dropdowns emit —
// and a workbook carrying participant ids or PSGC codes is refused by
// decision. Every default below is therefore a display name, all from Region
// III / Aurora so the child resolves to island code LZ (lumpSumFixture's
// IMPORT_REGION_ISLAND_CODE). Category and Sub-Category are a pair the
// Category -> Sub-Category relation table maps (tOptionProjectCategoryToPAPMap:
// Category 16 -> PAPKey 1082); the old fixture's Sub-Category 1 is NOT mapped
// and would now be refused.
//
// The macros and data validations the template carries are irrelevant to the
// server and may or may not survive SheetJS's round-trip; the `_SysMeta` sheet
// and the header rows do, and those are what matter.
// =============================================================================

import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';

/** Same resolution as lumpSumFixture's: the API directly, never the Vite proxy. */
export const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');
const API = API_URL;

/** One itemized child to put in the workbook. Everything not given takes the Region III defaults. */
export interface ImportChildSpec {
  /**
   * The workbook's placeholder Project ID. It ties the four sheets together during
   * validation and is NOT persisted — a child's AlternateId is its parent's Project
   * ID (business rule, 2026-09-05). To find an imported child afterwards, match on
   * the Description you gave it.
   */
  placeholderId: string;
  description: string;
  /** Component cost = funding amount = what the parent is drawn down by. */
  cost: number;
  /** Must be >= the parent program's StartYear (ValidateComponentDetails / ValidateMajorItemsOfWork). */
  activityYear: number;
  /** Ignored by the server (the parent's UACS is inherited), kept so a spec can prove that. */
  uacs?: string;
  /** Per-column overrides on PROJECT DETAILS, keyed by header text — for deliberately bad cells. */
  projectDetails?: Partial<Record<ProjectDetailsHeader, string | number>>;
  /**
   * COMPONENT DETAILS' two optional date columns, blank by default.
   *
   * They exist here for the warning cases: an unreadable one warns and is stored
   * NULL, and an end before a start warns and is stored as typed. Both are
   * ValidateComponentDetails rules, so they can be provoked without touching the
   * Roads-S major item row, whose own coordinate rules are skipped by design.
   */
  componentDetails?: { plannedStart?: string; plannedEnd?: string };
}

export type ProjectDetailsHeader =
  | '*Tier' | '*Category' | '*Sub-Category' | '*Province' | '*City Municipality'
  | '*Legislative District:' | '*Region' | '*District Engineering Office'
  | '*Implementing Office' | 'Operation Unit' | 'Region Wide' | 'Origin'
  | 'Originating Agency' | 'Implementation Mode' | 'Emergency Mode' | 'ROW Available'
  | 'Feasibility Study' | 'Feasibility Date' | 'Detailed Design' | 'Detailed Design Date' | 'Rank';

/** Region III / Aurora, by name — see the header comment. */
export const IMPORT_DEFAULTS: Record<ProjectDetailsHeader, string | number> = {
  '*Tier': 'Tier 2',
  '*Category': 'OO1: Ensure Safe and Reliable National Road System',
  '*Sub-Category': 'Network Development - Construction of Missing Links/ New Roads',
  '*Province': 'Aurora',
  '*City Municipality': 'Baler (Capital)',
  '*Legislative District:': 'Aurora (Lone District)',
  '*Region': 'Region III',
  '*District Engineering Office': 'Aurora District Engineering Office',
  '*Implementing Office': 'Aurora District Engineering Office',
  'Operation Unit': 'Aurora District Engineering Office',
  'Region Wide': 'Regionwide',
  'Origin': 'DPWH',
  'Originating Agency': 'Congress of the Philippines',
  'Implementation Mode': 'By Contract',
  'Emergency Mode': 'No',
  'ROW Available': 'Yes',
  'Feasibility Study': 'No',
  'Feasibility Date': '',
  'Detailed Design': 'No',
  'Detailed Design Date': '',
  'Rank': '',
};

export const IMPORT_FUNDING = {
  source: 'Government of the Philippines',
  agreement: 'DPWH GENERAL APPROPRIATIONS ACT 2025',
};

export const IMPORT_COMPONENT = {
  type: 'Civil Works',
  id: 'CW1',
  infraType: 'Roads',
  workType: 'Construction of Concrete Road',
  targetUnit: 'Lane Km',
};

/** GET the live template. Fails loudly: every import fixture depends on it. */
const fetchTemplate = async (page: Page): Promise<XLSX.WorkBook> => {
  const res = await page.request.get(`${API}/api/Importing/DownloadTemplate`);
  if (!res.ok()) {
    throw new Error(`DownloadTemplate answered ${res.status()}: ${await res.text()}`);
  }
  return XLSX.read(await res.body(), { type: 'buffer', bookVBA: true });
};

const addRows = (wb: XLSX.WorkBook, sheet: string, rows: (string | number)[][]) => {
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`the template has no "${sheet}" sheet`);
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: 'A2' });
};

/**
 * The four sheets, filled from the specs. Column order follows the header rows
 * ImportWorkbookReader validates — see Hangfire/Importing/ImportWorkbookReader.cs.
 */
export const buildImportWorkbook = async (page: Page, children: ImportChildSpec[]): Promise<Buffer> => {
  const wb = await fetchTemplate(page);

  const d = (c: ImportChildSpec, h: ProjectDetailsHeader) => c.projectDetails?.[h] ?? IMPORT_DEFAULTS[h];

  addRows(wb, 'PROJECT DETAILS', children.map((c) => [
    c.placeholderId, '', '', c.uacs ?? '',
    d(c, '*Tier'), d(c, '*Category'), d(c, '*Sub-Category'), '', c.description,
    d(c, '*Province'), d(c, '*City Municipality'), d(c, '*Legislative District:'), d(c, '*Region'),
    d(c, '*District Engineering Office'), d(c, '*Implementing Office'), d(c, 'Operation Unit'),
    d(c, 'Region Wide'), d(c, 'Origin'), d(c, 'Originating Agency'), d(c, 'Implementation Mode'),
    d(c, 'Emergency Mode'), d(c, 'ROW Available'), d(c, 'Feasibility Study'), d(c, 'Feasibility Date'),
    d(c, 'Detailed Design'), d(c, 'Detailed Design Date'), d(c, 'Rank'),
  ]));

  addRows(wb, 'FUNDING PROFILE', children.map((c) => [
    c.placeholderId, IMPORT_FUNDING.source, IMPORT_FUNDING.agreement, c.cost,
  ]));

  // Columns 6 and 7 are Planned Start / Planned End — blank unless a spec wants them.
  addRows(wb, 'COMPONENT DETAILS', children.map((c) => [
    c.placeholderId, IMPORT_COMPONENT.type, IMPORT_COMPONENT.id, c.description, c.cost,
    c.componentDetails?.plannedStart ?? '', c.componentDetails?.plannedEnd ?? '',
    IMPORT_COMPONENT.infraType, IMPORT_COMPONENT.workType, c.activityYear,
  ]));

  /*  Civil Works is not exempt from the Component -> Major Item rule, so every
      child carries one. Roads items whose Infrastructure ID starts with 'S' take
      Station/Chainage and Length rather than X/Y (ValidateMajorItemsOfWork). */
  addRows(wb, 'MAJOR ITEMS OF WORK', children.map((c) => [
    c.placeholderId, IMPORT_COMPONENT.id, `${c.placeholderId}-${IMPORT_COMPONENT.id}`,
    `S-E2E-${c.placeholderId}`, 'e2e road segment', IMPORT_COMPONENT.targetUnit,
    '', '', '', '', 1, '', '', 0, 1000, 1000, c.activityYear,
  ]));

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsm', bookVBA: true }) as Buffer;
};

/** A workbook with a sheet removed — for proving the server's own file gates. */
export const withoutSheet = (buffer: Buffer, sheet: string): Buffer => {
  const wb = XLSX.read(buffer, { type: 'buffer', bookVBA: true });
  delete wb.Sheets[sheet];
  wb.SheetNames = wb.SheetNames.filter((n) => n !== sheet);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsm', bookVBA: true }) as Buffer;
};

export interface ImportTarget {
  lumpSumId: number;
  programPK: string;
}

/** POST a workbook to ImportItemizedProjects as the dialog would. */
export const postImportWorkbook = async (page: Page, target: ImportTarget, buffer: Buffer, fileName = 'itemized-projects.xlsm') => {
  const res = await page.request.post(`${API}/api/Lumpsum/ImportItemizedProjects`, {
    multipart: {
      File: { name: fileName, mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12', buffer },
      ParentLumpSumId: String(target.lumpSumId),
      ProgramId: target.programPK,
    },
  });
  const text = await res.text();
  try { return { status: res.status(), body: JSON.parse(text) as any }; }
  catch { return { status: res.status(), body: text as any }; }
};
