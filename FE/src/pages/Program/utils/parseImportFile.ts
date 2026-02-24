import * as XLSX from 'xlsx';
import type {
  ImportedProject,
  ImportedProjectDetails,
  ImportedComponentCost,
  ImportedFundingProfile,
  ImportedMajorItem,
  ImportParseResult,
} from '../../Project/Model.d';

// ---------------------------------------------------------------------------
// Sheet name constants (must match the .xlsm exactly)
// ---------------------------------------------------------------------------
const SHEET_PROJECT_DETAILS   = 'PROJECT DETAILS';
const SHEET_FUNDING_PROFILE   = 'FUNDING PROFILE';
const SHEET_COMPONENT_DETAILS = 'COMPONENT DETAILS';
const SHEET_MAJOR_ITEMS       = 'MAJOR ITEMS OF WORK';
const SHEET_PROVINCES         = 'Provinces';

// ---------------------------------------------------------------------------
// Helper: convert Excel date serial → "MM/DD/YYYY" string (or return as-is)
// ---------------------------------------------------------------------------
function toDateString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    return value.toLocaleDateString('en-US');
  }
  if (typeof value === 'number') {
    // Excel stores dates as days since 1900-01-01 (with leap-year bug)
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const d = `${String(date.m).padStart(2, '0')}/${String(date.d).padStart(2, '0')}/${date.y}`;
      return d;
    }
  }
  return String(value);
}

// Helper: coerce a value to number or undefined
function toNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

// Helper: coerce to string or undefined
function toStr(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  return String(value).trim();
}

// Helper: skip rows where every value is null / empty string / whitespace-only
function isEmptyRow(r: RawRow): boolean {
  return Object.values(r).every((v) => v == null || String(v).trim() === '');
}

// ---------------------------------------------------------------------------
// Row-type definitions (keyed by header text)
// ---------------------------------------------------------------------------
type RawRow = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Lookup-sheet parsers  (Province / City / LD  name → GdbId)
// ---------------------------------------------------------------------------

/** Provinces sheet: "GdbId" | "Province"  →  uppercase name → GdbId */
function buildProvinceMap(wb: XLSX.WorkBook): Map<string, string> {
  const map = new Map<string, string>();
  if (!wb.SheetNames.includes(SHEET_PROVINCES)) return map;
  const raw = XLSX.utils.sheet_to_json<{ GdbId: string; Province: string }>(wb.Sheets[SHEET_PROVINCES]);
  for (const row of raw) {
    if (row.GdbId && row.Province) {
      map.set(row.Province.trim().toUpperCase(), row.GdbId.trim());
    }
  }
  return map;
}

// ---------------------------------------------------------------------------

function parseProjectDetailsSheet(
  ws: XLSX.WorkSheet,
  provinceMap: Map<string, string>,
): {
  rows: ImportedProjectDetails[];
  errors: string[];
} {
  const errors: string[] = [];
  const raw: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const rows: ImportedProjectDetails[] = [];

  raw.filter((r) => !isEmptyRow(r)).forEach((r, i) => {
    const projectId = toStr(r['Project ID']);
    if (!projectId) {
      errors.push(`PROJECT DETAILS row ${i + 2}: missing Project ID`);
      return;
    }

    // Resolve Province name → GdbId using the lookup sheet
    const provinceRaw  = toStr(r['*Province']);
    const provinceGdbId = provinceRaw
      ? (provinceMap.get(provinceRaw.toUpperCase()) ?? provinceRaw)
      : undefined;

    rows.push({
      ProjectId: projectId,
      MYId: toStr(r['Multi Year ID']),
      AlternateId: toStr(r['Alternate ID']),
      ExternalId: toStr(r['External ID']),
      UACS: toStr(r['OA Project Code (UACS)']),
      TierName: toStr(r['*Tier']),
      CategoryName: toStr(r['*Category']),
      ThrustName: toStr(r['*Sub-Category']),
      MYCAApprovalDate: toDateString(r['MYCA Approval Date']),
      // Province is resolved to GdbId; City / LD / Region are kept as plain names
      // (no GdbId available in the XLSM lookup sheets — backend resolves them)
      Province: provinceGdbId,
      City: toStr(r['*City Municipality']),
      LegislativeDistrict: toStr(r['*Legislative District:']),
      Region: toStr(r['*Region']),
      DEO: toStr(r['*District Engineering Office']),
      ImplementingOffice: toStr(r['*Implementing Office']),
      OperatingUnit: toStr(r['Operation Unit']),
      RegionWideName: toStr(r['Region Wide']),
      OriginName: toStr(r['Origin']),
      AgencyName: toStr(r['Originating Agency']),
      ImplementationModeName: toStr(r['Implementation Mode']),
      EmergencyModeName: toStr(r['Emergency Mode']),
      RowAvailableName: toStr(r['ROW Available']),
      FeasibilityName: toStr(r['Feasibility Study']),
      FeasibilityDate: toDateString(r['Feasibility Date']),
      DetailedDesignName: toStr(r['Detailed Design']),
      DetailedDesignDate: toDateString(r['Detailed Design Date']),
    });
  });

  return { rows, errors };
}

function parseFundingProfileSheet(ws: XLSX.WorkSheet): {
  rows: ImportedFundingProfile[];
  errors: string[];
} {
  const errors: string[] = [];
  const raw: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const rows: ImportedFundingProfile[] = [];

  raw.filter((r) => !isEmptyRow(r)).forEach((r, i) => {
    const projectId = toStr(r['Project ID']);
    if (!projectId) {
      errors.push(`FUNDING PROFILE row ${i + 2}: missing Project ID`);
      return;
    }
    const amount = toNum(r['Amount']);
    if (amount == null) {
      errors.push(`FUNDING PROFILE row ${i + 2} (${projectId}): invalid Amount`);
    }
    rows.push({
      ProjectId: projectId,
      Source: toStr(r['Source(s)']) ?? '',
      Agreement: toStr(r['Agreement(s) ']) ?? toStr(r['Agreement(s)']) ?? '',
      Amount: amount ?? 0,
    });
  });

  return { rows, errors };
}

function parseComponentDetailsSheet(ws: XLSX.WorkSheet): {
  rows: ImportedComponentCost[];
  errors: string[];
} {
  const errors: string[] = [];
  const raw: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const rows: ImportedComponentCost[] = [];

  raw.filter((r) => !isEmptyRow(r)).forEach((r, i) => {
    const projectId = toStr(r['Project ID']);
    if (!projectId) {
      errors.push(`COMPONENT DETAILS row ${i + 2}: missing Project ID`);
      return;
    }
    rows.push({
      ProjectId: projectId,
      ComponentType: toStr(r['Component Type']) ?? '',
      ComponentId: toStr(r['Component ID']) ?? '',
      Description: toStr(r['Description']),
      Total: toNum(r['Cost']) ?? 0,
      StartDate: toDateString(r['Planned Start Date']),
      EndDate: toDateString(r['Planned End Date']),
      InfraTypeName: toStr(r['Infrastructure Type']),
      WorkTypeName: toStr(r['Type of Work']),
      ActivityYear: toNum(r['Activity Year']),
    });
  });

  return { rows, errors };
}

function parseMajorItemsSheet(ws: XLSX.WorkSheet): {
  rows: ImportedMajorItem[];
  errors: string[];
} {
  const errors: string[] = [];
  const raw: RawRow[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const rows: ImportedMajorItem[] = [];

  raw.filter((r) => !isEmptyRow(r)).forEach((r, i) => {
    const projectId = toStr(r['Project ID']);
    if (!projectId) {
      errors.push(`MAJOR ITEMS OF WORK row ${i + 2}: missing Project ID`);
      return;
    }
    rows.push({
      ProjectId: projectId,
      ComponentId: toStr(r['Component ID']) ?? '',
      ReferenceId: toStr(r['Reference ID']) ?? '',
      InfraId: toStr(r['Infrastructure ID']),
      DetailedScope: toStr(r['Detailed Scope']),
      TargetUnit: toStr(r['Target Unit']),
      StartX: toNum(r['Start X']),
      StartY: toNum(r['Start Y ']),   // trailing space in header
      EndX: toNum(r['End X']),
      EndY: toNum(r['End Y']),
      PhysicalTarget: toNum(r['Physical Target']),
      StartStation: toStr(r['Start Station']),
      EndStation: toStr(r['End Station']),
      StartChainage: toNum(r['Start Chainage (m)']),
      EndChainage: toNum(r['End Chainage (m)']),
      Length: toNum(r['Length (meters)']),
      ActivityYear: toNum(r['Activity Year']),
    });
  });

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function parseImportFile(file: File): Promise<ImportParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  const allErrors: string[] = [];

  // Validate sheet presence
  const required = [SHEET_PROJECT_DETAILS, SHEET_FUNDING_PROFILE, SHEET_COMPONENT_DETAILS, SHEET_MAJOR_ITEMS];
  for (const name of required) {
    if (!wb.SheetNames.includes(name)) {
      allErrors.push(`Missing required sheet: "${name}"`);
    }
  }
  if (allErrors.length > 0) {
    return { projects: [], errors: allErrors, totalRows: { details: 0, components: 0, funding: 0, majorItems: 0 } };
  }

  // Build lookup maps from the Excel reference sheets
  const provinceMap = buildProvinceMap(wb);

  // Parse each sheet
  const { rows: detailRows,    errors: e1 } = parseProjectDetailsSheet(wb.Sheets[SHEET_PROJECT_DETAILS], provinceMap);
  const { rows: fundingRows,   errors: e2 } = parseFundingProfileSheet(wb.Sheets[SHEET_FUNDING_PROFILE]);
  const { rows: componentRows, errors: e3 } = parseComponentDetailsSheet(wb.Sheets[SHEET_COMPONENT_DETAILS]);
  const { rows: majorRows,     errors: e4 } = parseMajorItemsSheet(wb.Sheets[SHEET_MAJOR_ITEMS]);

  allErrors.push(...e1, ...e2, ...e3, ...e4);

  // Group everything by ProjectId
  const projectMap = new Map<string, ImportedProject>();

  for (const detail of detailRows) {
    projectMap.set(detail.ProjectId, {
      ProjectDetails: detail,
      ComponentCosts: [],
      FundingProfiles: [],
      MajorItemsOfWork: [],
    });
  }

  // Attach funding rows
  for (const row of fundingRows) {
    const project = projectMap.get(row.ProjectId);
    if (project) {
      project.FundingProfiles.push(row);
    } else {
      allErrors.push(`FUNDING PROFILE: Project ID "${row.ProjectId}" not found in PROJECT DETAILS`);
    }
  }

  // Attach component cost rows
  for (const row of componentRows) {
    const project = projectMap.get(row.ProjectId);
    if (project) {
      project.ComponentCosts.push(row);
    } else {
      allErrors.push(`COMPONENT DETAILS: Project ID "${row.ProjectId}" not found in PROJECT DETAILS`);
    }
  }

  // Attach major item rows
  for (const row of majorRows) {
    const project = projectMap.get(row.ProjectId);
    if (project) {
      project.MajorItemsOfWork.push(row);
    } else {
      allErrors.push(`MAJOR ITEMS OF WORK: Project ID "${row.ProjectId}" not found in PROJECT DETAILS`);
    }
  }

  const parseResult: ImportParseResult = {
    projects: Array.from(projectMap.values()),
    errors: allErrors,
    totalRows: {
      details: detailRows.length,
      components: componentRows.length,
      funding: fundingRows.length,
      majorItems: majorRows.length,
    },
  };

  console.group('[Import Parse Result]');
  console.log('Total rows parsed:', parseResult.totalRows);
  console.log('Projects found:', parseResult.projects.length);
  if (allErrors.length > 0) {
    console.warn('Parse warnings/errors:', allErrors);
  } else {
    console.log('No parse errors.');
  }
  console.log('Full projects JSON:', JSON.stringify(parseResult.projects, null, 2));
  console.groupEnd();

  return parseResult;
}
