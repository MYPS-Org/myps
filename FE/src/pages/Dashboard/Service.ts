import { httpClient } from '../../services/httpClient';

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
  AnnualTrend: Array<{ Year: number; InfrastructureBudget: number; LsItemized: number }>;
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
  Activities: Array<{
    Id: string;
    Type: 'revision' | 'lswallet' | 'project';
    Title: string;
    Description: string;
    Timestamp: string;
    User: string;
  }>;
}

const DEFAULT_LS_PROJECTS: DashboardSummary['LsProjects'] = [
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
      { Year: 2023, InfrastructureBudget: 798100000000, LsItemized: 62100000000 },
      { Year: 2024, InfrastructureBudget: 884200000000, LsItemized: 68400000000 },
      { Year: 2025, InfrastructureBudget: 821500000000, LsItemized: 56800000000 },
      { Year: 2026, InfrastructureBudget: 712400000000, LsItemized: 41200000000 },
      { Year: 2027, InfrastructureBudget: 643950000000, LsItemized: 32400000000 },
    ],
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
    LsProjects: DEFAULT_LS_PROJECTS,
    Activities: [
      {
        Id: 'act-1',
        Type: 'project',
        Title: 'Region IV-A (CALABARZON) ₱60.44B Package milestone updated',
        Description: 'Arterial bypass network entered NEP Stage Schedule.',
        Timestamp: '2026-08-28T14:30:00Z',
        User: 'Engr. J. Santos (DPWH R4A)',
      },
      {
        Id: 'act-2',
        Type: 'revision',
        Title: 'Region V (Bicol Region) ₱34.47B Allocation revised',
        Description: 'Approved Component Cost adjustment for NEP-Errata.',
        Timestamp: '2026-08-26T11:20:00Z',
        User: 'Planning Division (Central)',
      },
    ],
  };
}

export async function fetchDashboardSummary(year?: number, useBenchmark = false): Promise<DashboardSummary> {
  const targetYear = year ?? 2027;

  // If user switched to Benchmark NEP mode
  if (useBenchmark) {
    return getBenchmarkSummary(targetYear);
  }

  // Otherwise, ALWAYS fetch 100% live database data from myps_db_dev
  try {
    const response = await httpClient.post<DashboardSummary>(
      '/Dashboard/Summary',
      { Year: targetYear },
      { preloaderMessage: 'Loading live database data...', silent: true }
    );

    if (response?.Data && response.Data.Kpis) {
      return response.Data;
    }
  } catch (err) {
    console.error('Failed to load live summary from database:', err);
  }

  // Return clean empty structure from DB schema if DB has no data
  return {
    SelectedYear: targetYear,
    AvailableYears: [targetYear],
    Kpis: {
      TotalBudget: 0,
      ActiveProjects: 0,
      PublishedProjects: 0,
      PublishableProjects: 0,
      RevisedProjects: 0,
      LsWalletReleased: 0,
      LsWalletTotal: 0,
      PublicationRate: 0,
    },
    AnnualTrend: [],
    Statuses: [],
    Islands: [],
    Projects: [],
    LsProjects: [],
    Activities: [],
  };
}
