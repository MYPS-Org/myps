import { httpClient } from '../../services/httpClient';

export interface DashboardSummary {
  SelectedYear: number;
  AvailableYears: number[];
  Kpis: { TotalBudget: number; ActiveProjects: number; PublishedProjects: number; PublishableProjects: number; RevisedProjects: number; LsWalletReleased: number; LsWalletTotal: number; PublicationRate: number };
  AnnualTrend: Array<{ Year: number; InfrastructureBudget: number; LsItemized: number }>;
  Statuses: Array<{ Name: string; Count: number }>;
  Islands: Array<{ Name: string; Budget: number; ProjectCount: number }>;
  Projects: Array<{ Id: number; ProjectPK: string; ProjectId: string; Description: string; ProgramName: string; Region: string; Island: string; Category: string; StageName: string; ImplementingOffice: string; FundingSource: string; AllocatedBudget: number; IsPublished: boolean; IsPublishable: boolean; IsRevised: boolean; UpdatedAt: string }>;
  LsProjects: Array<{ Id: number; ProjectPK: string; ProjectId: string; Description: string; ProgramName: string; StageName: string; TotalAllocation: number; ItemizedAmount: number; RemainingAmount: number; ItemizedCount: number; Children: Array<{ Id: number; ProjectPK: string; ProjectId: string; Description: string; StageName: string; FundingTotal: number; ComponentCostTotal: number; IsPublished: boolean }> }>;
  Activities: Array<{ Id: string; Type: 'revision' | 'lswallet' | 'project'; Title: string; Description: string; Timestamp: string; User: string }>;
}

export async function fetchDashboardSummary(year?: number): Promise<DashboardSummary> {
  const validYear = year !== undefined && Number.isInteger(year) && year >= 2000 && year <= 2200
    ? year
    : undefined;
  const response = await httpClient.post<DashboardSummary>('/Dashboard/Summary', { Year: validYear }, { preloaderMessage: 'Loading dashboard data' });
  return response.Data;
}
