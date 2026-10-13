import { httpClient } from '../../services/httpClient';
import type { WatchlistProject } from './components/ProjectQuickDetailModal';

export interface DashboardSummary {
  SelectedYear: number;
  AvailableYears: number[];
  Kpis: {
    TotalBudget: number;
    ActiveProjects: number;
    PublishedProjects: number;
    PublishableProjects: number;
    RevisedProjects: number;
    LsWalletReleased: number;
    LsWalletTotal: number;
    PublicationRate: number;
  };
  AnnualTrend: Array<{ Year: number; InfrastructureBudget: number; LsItemized: number; ProjectCount: number }>;
  BudgetBreakdown: Array<{ Name: string; Budget: number; ProjectCount: number }>;
  Statuses: Array<{ Name: string; Count: number }>;
  Islands: Array<{ Name: string; Budget: number; ProjectCount: number }>;
  Projects: Array<{
    Id: number;
    ProjectPK: string;
    ProjectId: string;
    Description: string;
    ProgramName: string;
    Region: string;
    Island: string;
    Category: string;
    StageName: string;
    ImplementingOffice: string;
    FundingSource: string;
    AllocatedBudget: number;
    IsPublished: boolean;
    IsPublishable: boolean;
    IsRevised: boolean;
    UpdatedAt: string;
  }>;
  LsProjects: Array<{
    Id: number;
    ProjectPK: string;
    ProjectId: string;
    Description: string;
    ProgramName: string;
    StageName: string;
    TotalAllocation: number;
    ItemizedAmount: number;
    RemainingAmount: number;
    ItemizedCount: number;
    Children: Array<{
      Id: number;
      ProjectPK: string;
      ProjectId: string;
      Description: string;
      StageName: string;
      FundingTotal: number;
      ComponentCostTotal: number;
      IsPublished: boolean;
    }>;
  }>;
  Revisions: DashboardRevisionSummary;
}

/** One row of dbo.fRevisionQueue -- the same source the /revision page reads. */
export interface DashboardRevisionItem {
  Id: number;
  TransactionId: string;
  ProjectId: string;
  RevisionType: string;
  RevisionReason: string;
  /** 'For Endorsement' | 'For Approval of Central Office' | 'For Correction' | 'Approved' | 'Disapproved' */
  RevisionStatus: string;
  /** Group holding the revision: 'RPC', 'PS Admin', or the creator's group. */
  CurrentStage: string;
  ImplementingOffice: string;
  ImplementingOfficeId: string;
  ProgramName: string;
  RevisionDate: string;
  Age: number;
}

export interface DashboardRevisionCount {
  Name: string;
  Count: number;
}

export interface DashboardRevisionSummary {
  /** 'For Endorsement' -- awaiting the RO/RPC tier. */
  ForReview: number;
  /** 'For Approval of Central Office' -- awaiting the CO/AUC tier. */
  ForApproval: number;
  ForCorrection: number;
  Approved: number;
  Disapproved: number;
  Total: number;
  ByStatus: DashboardRevisionCount[];
  ByImplementingOffice: DashboardRevisionCount[];
  ByGroup: DashboardRevisionCount[];
  Items: DashboardRevisionItem[];
}

const BENCHMARK_LS_PROJECTS: DashboardSummary['LsProjects'] = [
  {
    Id: 901,
    ProjectPK: 'LS-2027-01',
    ProjectId: 'DPWH-LS-2027-001',
    Description: 'Basic Infrastructure Program (BIP) - Multi-Purpose Community & Evacuation Facilities',
    ProgramName: 'Basic Infrastructure Program (BIP)',
    StageName: 'NEP',
    TotalAllocation: 18500000000,
    ItemizedAmount: 13200000000,
    RemainingAmount: 5300000000,
    ItemizedCount: 4,
    Children: [
      {
        Id: 9011,
        ProjectPK: 'LS-SUB-2027-011',
        ProjectId: 'DPWH-BIP-2027-SUB-01',
        Description: 'Construction of Regional Multi-Purpose Disaster Evacuation Center, Batangas',
        StageName: 'NEP',
        FundingTotal: 3800000000,
        ComponentCostTotal: 3800000000,
        IsPublished: true,
      },
      {
        Id: 9012,
        ProjectPK: 'LS-SUB-2027-012',
        ProjectId: 'DPWH-BIP-2027-SUB-02',
        Description: 'Multi-Purpose Civic Health Center & Community Services Facility, Pampanga',
        StageName: 'NEP',
        FundingTotal: 3200000000,
        ComponentCostTotal: 3200000000,
        IsPublished: true,
      },
      {
        Id: 9013,
        ProjectPK: 'LS-SUB-2027-013',
        ProjectId: 'DPWH-BIP-2027-SUB-03',
        Description: 'Construction of Municipal Training and Livelihood Center, Iloilo',
        StageName: 'NEP-Errata',
        FundingTotal: 3400000000,
        ComponentCostTotal: 3400000000,
        IsPublished: true,
      },
      {
        Id: 9014,
        ProjectPK: 'LS-SUB-2027-014',
        ProjectId: 'DPWH-BIP-2027-SUB-04',
        Description: 'Rehabilitation of Community Multi-Purpose Center, Davao del Sur',
        StageName: 'BP',
        FundingTotal: 2800000000,
        ComponentCostTotal: 2800000000,
        IsPublished: false,
      },
    ],
  },
  {
    Id: 902,
    ProjectPK: 'LS-2027-02',
    ProjectId: 'DPWH-LS-2027-002',
    Description: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Strategic Access Roads',
    ProgramName: 'SIPAG Special Support',
    StageName: 'NEP',
    TotalAllocation: 16000000000,
    ItemizedAmount: 11400000000,
    RemainingAmount: 4600000000,
    ItemizedCount: 3,
    Children: [
      {
        Id: 9021,
        ProjectPK: 'LS-SUB-2027-021',
        ProjectId: 'DPWH-SIP-2027-SUB-01',
        Description: 'Construction of Agricultural Access Road linking Major Produce Markets, Isabela',
        StageName: 'NEP',
        FundingTotal: 4500000000,
        ComponentCostTotal: 4500000000,
        IsPublished: true,
      },
      {
        Id: 9022,
        ProjectPK: 'LS-SUB-2027-022',
        ProjectId: 'DPWH-SIP-2027-SUB-02',
        Description: 'Coastal Community Resiliency Road and Sea Barrier Link, Leyte',
        StageName: 'NEP',
        FundingTotal: 3900000000,
        ComponentCostTotal: 3900000000,
        IsPublished: true,
      },
      {
        Id: 9023,
        ProjectPK: 'LS-SUB-2027-023',
        ProjectId: 'DPWH-SIP-2027-SUB-03',
        Description: 'Tourism Destination Access Road to Highland Eco-Park, Bukidnon',
        StageName: 'BP',
        FundingTotal: 3000000000,
        ComponentCostTotal: 3000000000,
        IsPublished: false,
      },
    ],
  },
];

const BASE_17_REGIONAL_TEMPLATES = [
  // LUZON (8 Regions - Base Sum = 258.50 B)
  { name: 'Region IV-A (CALABARZON)', code: 'R4A', island: 'Luzon', category: 'Highways & Flood Control', baseAmount2027: 60.44, description: 'CALABARZON Regional Capital Infrastructure Package (Highways, Bypass & Flood Control)' },
  { name: 'Region III (Central Luzon)', code: 'R3', island: 'Luzon', category: 'Highways & River Basins', baseAmount2027: 43.79, description: 'Central Luzon Arterial Highway Network, Express Bypass & River Basin Dike Works' },
  { name: 'NCR (National Capital Region)', code: 'NCR', island: 'Luzon', category: 'Flood Control & Drainage', baseAmount2027: 34.96, description: 'Metro Manila Urban Interceptor Pumping Stations, Drainage & Flyover Modernization' },
  { name: 'Region V (Bicol Region)', code: 'R5', island: 'Luzon', category: 'Flood Control & Arterial Roads', baseAmount2027: 34.47, description: 'Bicol River Basin Flood Mitigation, Coastal Protection & Maharlika Highway Rehabilitation' },
  { name: 'Region I (Ilocos Region)', code: 'R1', island: 'Luzon', category: 'Coastal Protection & Roads', baseAmount2027: 25.38, description: 'Ilocos Region Coastal Sea Barrier, Arterial Bypass & Tourism Highway Linkages' },
  { name: 'Region II (Cagayan Valley)', code: 'R2', island: 'Luzon', category: 'River Basin & Roads', baseAmount2027: 25.33, description: 'Cagayan Valley Major River Protection, Flood Control & Trans-Axial Highway Widening' },
  { name: 'MIMAROPA (Region IV-B)', code: 'R4B', island: 'Luzon', category: 'Island Access & Protection', baseAmount2027: 18.36, description: 'MIMAROPA Island Resiliency, Port Linkages, Tourism Access & Disaster Mitigation Roads' },
  { name: 'CAR (Cordillera Admin Region)', code: 'CAR', island: 'Luzon', category: 'Slope Defense & Highways', baseAmount2027: 15.77, description: 'Cordillera High-Altitude Slope Protection, Rockfall Mitigation & Mountain Road Arterials' },

  // MINDANAO (5 Regions - Base Sum = 135.26 B)
  { name: 'Region X (Northern Mindanao)', code: 'R10', island: 'Mindanao', category: 'Coastal Viaducts & Flood Control', baseAmount2027: 45.32, description: 'Northern Mindanao Coastal Highway Viaduct, Flyovers & Cagayan de Oro Flood Mitigation' },
  { name: 'Region XI (Davao Region)', code: 'R11', island: 'Mindanao', category: 'Coastal Expressways & Flood Defense', baseAmount2027: 28.87, description: 'Davao Region Coastal Bypass Road, Flyovers & Davao River Basin Flood Protection' },
  { name: 'Region IX (Zamboanga Peninsula)', code: 'R9', island: 'Mindanao', category: 'Highways & Port Corridors', baseAmount2027: 21.65, description: 'Zamboanga Peninsula Coastal Trans-Axial Highway, Port Access & Flood Mitigation Network' },
  { name: 'Region XIII (Caraga)', code: 'R13', island: 'Mindanao', category: 'Roads & River Defense', baseAmount2027: 21.21, description: 'Caraga Region Agro-Industrial Spine Highway & Agusan River Flood Defense Infrastructure' },
  { name: 'Region XII (SOCCSKSARGEN)', code: 'R12', island: 'Mindanao', category: 'Highways & Logistics', baseAmount2027: 18.21, description: 'SOCCSKSARGEN Arterial Highway Network, Port Logistics Roads & Basin Flood Mitigation' },

  // VISAYAS (4 Regions - Base Sum = 97.21 B)
  { name: 'Region VIII (Eastern Visayas)', code: 'R8', island: 'Visayas', category: 'Flood Control & Highways', baseAmount2027: 31.32, description: 'Eastern Visayas Major River Basin Flood Control, Tide Embankments & Arterial Bypasses' },
  { name: 'Region VII (Central Visayas)', code: 'R7', island: 'Visayas', category: 'Urban Mobility & Drainage', baseAmount2027: 27.59, description: 'Central Visayas Metro Cebu Urban Mobility, Flyovers & River Basin Drainage Modernization' },
  { name: 'Region VI (Western Visayas)', code: 'R6', island: 'Visayas', category: 'Bridge Approaches & Roads', baseAmount2027: 19.34, description: 'Western Visayas Panay Inter-Island Linkway Approach Roads & Flood Resilient Infrastructure' },
  { name: 'NIR (Negros Island Region)', code: 'NIR', island: 'Visayas', category: 'Regional Spine Highway', baseAmount2027: 18.96, description: 'Negros Island Region Trans-Central Administrative Spine Highway & Coastal Link Corridors' },
];

const REGIONAL_TOTAL_BY_YEAR: Record<number, number> = {
  2027: 490.975,
  2026: 542.80,
  2025: 625.30,
  2024: 673.50,
  2023: 608.20,
};

function getBenchmarkSummary(year: number): DashboardSummary {
  const grandTotal = REGIONAL_TOTAL_BY_YEAR[year] ?? 490.975;
  const scale = grandTotal / 490.975;
  const defaultStage = year === 2027 ? 'NEP' : 'GAA';

  const projects = BASE_17_REGIONAL_TEMPLATES.map((item, idx) => {
    const rawBudgetBillion = Math.round(item.baseAmount2027 * scale * 100) / 100;
    const allocatedBudget = Math.round(rawBudgetBillion * 1e9);

    return {
      Id: year * 100 + idx + 1,
      ProjectPK: `PRJ-${item.code}-${year}`,
      ProjectId: `DPWH-${item.code}-${year}-0001`,
      Description: item.description,
      ProgramName: 'National Infrastructure Program',
      Region: item.name,
      Island: item.island,
      Category: item.category,
      StageName: year === 2027 ? (idx % 3 === 0 ? 'NEP' : idx % 3 === 1 ? 'NEP-Errata' : 'BP') : defaultStage,
      ImplementingOffice: `${item.name} Regional Office`,
      FundingSource: 'GAA - Capital Outlays',
      AllocatedBudget: allocatedBudget,
      IsPublished: idx % 4 !== 3,
      IsPublishable: true,
      IsRevised: idx % 5 === 1,
      UpdatedAt: new Date(2026, 7, 28 - (idx % 10)).toISOString(),
    };
  });

  const luzonBudget = projects.filter((p) => p.Island === 'Luzon').reduce((sum, p) => sum + p.AllocatedBudget, 0);
  const mindanaoBudget = projects.filter((p) => p.Island === 'Mindanao').reduce((sum, p) => sum + p.AllocatedBudget, 0);
  const visayasBudget = projects.filter((p) => p.Island === 'Visayas').reduce((sum, p) => sum + p.AllocatedBudget, 0);

  return {
    SelectedYear: year,
    AvailableYears: [2027, 2026, 2025, 2024, 2023],
    Kpis: {
      TotalBudget: Math.round((year === 2027 ? 643.95 : grandTotal * 1.31158) * 1e9),
      ActiveProjects: year === 2027 ? 11395 : 17861,
      PublishedProjects: year === 2027 ? 9685 : 15360,
      PublishableProjects: 1240,
      RevisedProjects: 470,
      LsWalletReleased: 32400000000,
      LsWalletTotal: 48500000000,
      PublicationRate: 85.0,
    },
    AnnualTrend: [
      { Year: 2023, InfrastructureBudget: 798100000000, LsItemized: 62100000000, ProjectCount: 22836 },
      { Year: 2024, InfrastructureBudget: 884200000000, LsItemized: 68400000000, ProjectCount: 25545 },
      { Year: 2025, InfrastructureBudget: 821500000000, LsItemized: 56800000000, ProjectCount: 25301 },
      { Year: 2026, InfrastructureBudget: 712400000000, LsItemized: 41200000000, ProjectCount: 17861 },
      { Year: 2027, InfrastructureBudget: 643950000000, LsItemized: 32400000000, ProjectCount: 11395 },
    ],
    // The presentation-only macro panel owns its cited NEP breakdown.
    // Live mode receives this collection from Dashboard/Summary.
    BudgetBreakdown: [],
    Statuses: [
      { Name: 'NEP', Count: 7120 },
      { Name: 'BP', Count: 2685 },
      { Name: 'NEP-Errata', Count: 1590 },
    ],
    Islands: [
      { Name: 'Luzon', Budget: luzonBudget, ProjectCount: 5999 },
      { Name: 'Mindanao', Budget: mindanaoBudget, ProjectCount: 3139 },
      { Name: 'Visayas', Budget: visayasBudget, ProjectCount: 2257 },
    ],
    Projects: projects,
    LsProjects: BENCHMARK_LS_PROJECTS,
    Revisions: getBenchmarkRevisions(),
  };
}

// Benchmark counterpart of the live fRevisionQueue projection. Mirrors the five
// statuses the live queue emits so the presentation mode exercises the same UI
// paths; never merged into or substituted for live data.
function getBenchmarkRevisions(): DashboardRevisionSummary {
  const items: DashboardRevisionItem[] = [
    ['BP01000001LZ-1', 'Modification', 'For Endorsement', 'RPC', 'Region II', 'OI236', 2],
    ['BP01000002LZ-1', 'Adjustment', 'For Endorsement', 'RPC', 'Region I', 'OI235', 5],
    ['BP01220001LZ-1', 'Mode of Implementation', 'For Endorsement', 'RPC', 'Zambales 1st District Engineering Office', 'OI49', 14],
    ['BP01069001LZ-1', 'Modification', 'For Approval of Central Office', 'PS Admin', 'Ilocos Norte 1st District Engineering Office', 'OI24', 7],
    ['BP01200001MN-1', 'Adjustment', 'For Approval of Central Office', 'PS Admin', 'Zamboanga del Norte 1st District Engineering Office', 'OI108', 3],
    ['BP01000004LZ-1', 'Modification', 'For Correction', 'Admin', 'Region II', 'OI236', 20],
    ['BP01030003LZ-1', 'Termination', 'Approved', 'PS Admin', 'Pangasinan 1st District Engineering Office', 'OI28', 26],
    ['BP01091001LZ-1', 'Modification', 'Disapproved', 'RPC', 'Region II', 'OI236', 31],
  ].map((row, index) => {
    const [transactionId, revisionType, revisionStatus, currentStage, office, officeId, age] = row as
      [string, string, string, string, string, string, number];
    return {
      Id: index + 1,
      TransactionId: transactionId,
      ProjectId: transactionId.split('-')[0],
      RevisionType: revisionType,
      RevisionReason: 'Benchmark sample reason',
      RevisionStatus: revisionStatus,
      CurrentStage: currentStage,
      ImplementingOffice: office,
      ImplementingOfficeId: officeId,
      ProgramName: 'National Infrastructure Program',
      RevisionDate: new Date(Date.now() - age * 86400000).toISOString(),
      Age: age,
    };
  });

  const tally = (source: DashboardRevisionItem[], pick: (item: DashboardRevisionItem) => string) =>
    Object.entries(
      source.reduce<Record<string, number>>((acc, item) => {
        const key = pick(item);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {})
    )
      .map(([Name, Count]) => ({ Name, Count }))
      .sort((a, b) => b.Count - a.Count || a.Name.localeCompare(b.Name));

  const countOf = (status: string) => items.filter((item) => item.RevisionStatus === status).length;
  const pending = items.filter(
    (item) => item.RevisionStatus === 'For Endorsement' || item.RevisionStatus === 'For Approval of Central Office'
  );

  return {
    ForReview: countOf('For Endorsement'),
    ForApproval: countOf('For Approval of Central Office'),
    ForCorrection: countOf('For Correction'),
    Approved: countOf('Approved'),
    Disapproved: countOf('Disapproved'),
    Total: items.length,
    ByStatus: tally(items, (item) => item.RevisionStatus),
    ByImplementingOffice: tally(pending, (item) => item.ImplementingOffice),
    ByGroup: tally(pending, (item) => item.CurrentStage),
    Items: items,
  };
}

function resolveYear(year?: number): number {
  return year !== undefined && Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : 2027;
}

// ---------------------------------------------------------------------------
// Split endpoints — one per dashboard section, replacing the old single
// /Dashboard/Summary call so each section can load (and lazy-load) independently.
// Every real-mode call posts { Year, CategoryId } and the backend scopes its aggregate to
// that fiscal year's programs (and the category, when one is chosen); the year list the
// switcher offers comes back from /Dashboard/Kpis as AvailableYears. Demo Data ignores the
// category: its figures are presentation samples with no real categories behind them. Benchmark mode still supports any year in REGIONAL_TOTAL_BY_YEAR
// for the Demo Data experience. (/Dashboard/Summary itself still exists on the
// backend for the dashboard-live-data-integrity e2e contract, but nothing on the
// frontend calls it anymore.)
//
// LumpSum (added 2026-09-17) is the one exception to "every section has its own
// hook": it's fetched eagerly alongside Kpis/Revisions rather than lazily on
// scroll — see the Tier 1 group in Dashboard.tsx — because the dataset is tiny
// (a handful of Lump Sum Projects) and the KPI tile needs its total immediately.
//
// All of these pass `silent: true`. httpClient's default is a global, page-blocking
// overlay (fixed inset-0 + backdrop-blur) shown for any request carrying a
// preloaderMessage — which is the right treatment for a single foreground action, but
// the exact opposite of what this page wants: every section already renders its own
// skeleton, and a section that loads on scroll must never freeze the sections the user
// is currently reading. With the overlay on, eight independent lazy requests read as one
// long modal wait and the per-section loading states are never actually seen.
// ---------------------------------------------------------------------------

export interface DashboardTrendRow {
  Year: number;
  InfrastructureBudget: number;
  LsItemized: number;
  ProjectCount: number;
}

export interface DashboardRegionRow {
  Region: string;
  Island: string;
  Budget: number;
  ProjectCount: number;
}

export interface DashboardProjectsFilter {
  Search?: string;
  Island?: string;
  Status?: string;
}

export async function fetchDashboardKpis(year: number | undefined, useBenchmark: boolean, categoryId: number | null = null) {
  if (useBenchmark) {
    const summary = getBenchmarkSummary(resolveYear(year));
    return { SelectedYear: summary.SelectedYear, AvailableYears: summary.AvailableYears, Kpis: summary.Kpis };
  }
  const response = await httpClient.post<{ SelectedYear: number; AvailableYears: number[]; Kpis: DashboardSummary['Kpis'] }>(
    '/Dashboard/Kpis',
    { Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

export async function fetchDashboardTrend(year: number | undefined, useBenchmark: boolean, categoryId: number | null = null) {
  if (useBenchmark) {
    return { AnnualTrend: getBenchmarkSummary(resolveYear(year)).AnnualTrend };
  }
  const response = await httpClient.post<{ AnnualTrend: DashboardTrendRow[] }>(
    '/Dashboard/Trend',
    { Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

export async function fetchDashboardBudgetBreakdown(year: number | undefined, useBenchmark: boolean, categoryId: number | null = null) {
  if (useBenchmark) {
    return { BudgetBreakdown: getBenchmarkSummary(resolveYear(year)).BudgetBreakdown };
  }
  const response = await httpClient.post<{ BudgetBreakdown: DashboardSummary['BudgetBreakdown'] }>(
    '/Dashboard/BudgetBreakdown',
    { Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

export async function fetchDashboardStatuses(year: number | undefined, useBenchmark: boolean, categoryId: number | null = null) {
  if (useBenchmark) {
    const summary = getBenchmarkSummary(resolveYear(year));
    return { Statuses: summary.Statuses, Islands: summary.Islands };
  }
  const response = await httpClient.post<{ Statuses: DashboardSummary['Statuses']; Islands: DashboardSummary['Islands'] }>(
    '/Dashboard/Statuses',
    { Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

function getBenchmarkRegionalBreakdown(year: number): DashboardRegionRow[] {
  const summary = getBenchmarkSummary(year);
  const byRegion = new Map<string, { island: string; budget: number; count: number }>();
  for (const project of summary.Projects) {
    const current = byRegion.get(project.Region) ?? { island: project.Island, budget: 0, count: 0 };
    current.budget += project.AllocatedBudget;
    current.count += 1;
    byRegion.set(project.Region, current);
  }
  return Array.from(byRegion.entries())
    .map(([region, data]) => ({ Region: region, Island: data.island, Budget: data.budget, ProjectCount: data.count }))
    .sort((a, b) => b.Budget - a.Budget);
}

export async function fetchDashboardRegionalBreakdown(year: number | undefined, useBenchmark: boolean, categoryId: number | null = null) {
  if (useBenchmark) {
    return { Regions: getBenchmarkRegionalBreakdown(resolveYear(year)) };
  }
  const response = await httpClient.post<{ Regions: DashboardRegionRow[] }>(
    '/Dashboard/RegionalBreakdown',
    { Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

export async function fetchDashboardRevisions(
  year: number | undefined,
  useBenchmark: boolean,
  categoryId: number | null = null
): Promise<DashboardRevisionSummary> {
  if (useBenchmark) {
    return getBenchmarkSummary(resolveYear(year)).Revisions;
  }
  const response = await httpClient.post<DashboardRevisionSummary>(
    '/Dashboard/Revisions',
    // The queue is not fiscal-year scoped; only the category narrows it.
    { CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

export async function fetchDashboardLsProjects(year: number | undefined, useBenchmark: boolean, categoryId: number | null = null) {
  if (useBenchmark) {
    return { LsProjects: getBenchmarkSummary(resolveYear(year)).LsProjects };
  }
  const response = await httpClient.post<{ LsProjects: DashboardSummary['LsProjects'] }>(
    '/Dashboard/LumpSum',
    { Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return response.Data;
}

function mapProjectDtoToWatchlist(project: DashboardSummary['Projects'][number]): WatchlistProject {
  return {
    id: project.Id.toString(),
    projectPK: project.ProjectPK,
    projectId: project.ProjectId,
    description: project.Description,
    programName: project.ProgramName,
    region: project.Region,
    island: project.Island,
    category: project.Category,
    stageName: project.StageName,
    implementingOffice: project.ImplementingOffice,
    fundingSource: project.FundingSource,
    allocatedBudget: project.AllocatedBudget,
    updatedAt: project.UpdatedAt,
    isPublished: project.IsPublished,
    isPublishable: project.IsPublishable,
    isRevised: project.IsRevised,
  };
}

// Mirrors WebAPI/Controllers/Dashboard/DashboardController.cs's PaginateProjects so
// Demo Data paging behaves identically to Live DB paging (search/island/status filter,
// sort by budget descending, page-number-as-cursor).
function paginateBenchmarkProjects(
  projects: WatchlistProject[],
  filters: DashboardProjectsFilter | undefined,
  limit: number,
  page: number,
  navigation: PaginationNavigationValue | undefined
): PaginationResponse<WatchlistProject> {
  let filtered = projects;
  const search = filters?.Search?.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter((project) =>
      project.projectId.toLowerCase().includes(search)
      || project.description.toLowerCase().includes(search)
      || project.region.toLowerCase().includes(search));
  }
  if (filters?.Island) {
    filtered = filtered.filter((project) => project.island === filters.Island);
  }
  if (filters?.Status) {
    filtered = filtered.filter((project) => project.stageName === filters.Status);
  }

  const ordered = [...filtered].sort((a, b) => b.allocatedBudget - a.allocatedBudget);
  const safeLimit = limit < 1 ? 10 : Math.min(limit, 200);
  const total = ordered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);

  let requestedPage: number;
  if (navigation === 0) requestedPage = 1; // First
  else if (navigation === 3) requestedPage = totalPages > 0 ? totalPages : 1; // Last
  else requestedPage = Math.min(Math.max(page < 1 ? 1 : page, 1), Math.max(totalPages, 1));

  const start = (requestedPage - 1) * safeLimit;
  const lists = ordered.slice(start, start + safeLimit);
  const hasPrevious = requestedPage > 1;
  const hasNext = requestedPage < totalPages;

  return {
    lists,
    page: requestedPage,
    limit: safeLimit,
    total,
    totalPages,
    HasPrevious: hasPrevious,
    HasNext: hasNext,
    PreviousFilteredId: hasPrevious ? requestedPage - 1 : null,
    NextFilteredId: hasNext ? requestedPage + 1 : null,
    PageCursorId: requestedPage,
  };
}

export async function fetchDashboardProjects(
  request: PaginatedRequest<DashboardProjectsFilter>,
  year: number | undefined,
  useBenchmark: boolean,
  categoryId: number | null = null
): Promise<{ Data: PaginationResponse<WatchlistProject> }> {
  if (useBenchmark) {
    const projects = getBenchmarkSummary(resolveYear(year)).Projects.map(mapProjectDtoToWatchlist);
    return { Data: paginateBenchmarkProjects(projects, request.Filters, request.limit, request.page, request.Navigation) };
  }
  const response = await httpClient.post<PaginationResponse<DashboardSummary['Projects'][number]>>(
    '/Dashboard/Projects',
    { ...request, Year: resolveYear(year), CategoryId: categoryId },
    { silent: true }
  );
  return { Data: { ...response.Data, lists: response.Data.lists.map(mapProjectDtoToWatchlist) } };
}

export interface DashboardCategoryOption {
  CategoryId: number;
  CategoryName: string;
  /** False for a retired category; still selectable because older projects carry it. */
  IsActive: boolean;
}

/** Every project category, sorted by name, for the header picker (a short, fixed list). */
export async function fetchDashboardCategories(): Promise<DashboardCategoryOption[]> {
  const response = await httpClient.post<{ Categories: DashboardCategoryOption[] }>(
    '/Dashboard/Categories',
    { Query: '' },
    { silent: true }
  );
  return response.Data?.Categories ?? [];
}
