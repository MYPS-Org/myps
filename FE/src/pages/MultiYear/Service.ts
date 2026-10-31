// =============================================================================
// Multi-Year Service.ts — ALL data access for the Multi-Year module, and the only
// file in it that touches httpClient. Every call posts to MultiYearController.
// Errors: httpClient's interceptor already toasts any API refusal that carries a
// Message (see FE/CLAUDE.md), so callers toast only when it stayed silent.
// =============================================================================

import { httpClient } from '../../services/httpClient';
import type { ApiResponse } from '../../services/httpClient';
import type {
  CodeListItem,
  CodeListName,
  MemberFilter,
  MembershipFields,
  MembershipStatus,
  MultiYearCodeLists,
  MultiYearFilterOptions,
  MultiYearProjectDetails,
  PipCandidate,
  PlanningFormOptions,
  PlanningImportResult,
  PlanningProjectFields,
  Portfolio,
  ProposeFormOptions,
  ProposeRequest,
  SavedTotals,
  SavedTotalsDetails,
  UpdateRuns,
  PortfolioDetails,
  PortfolioFilter,
  PortfolioKind,
  PortfolioMember,
  YearAmount,
} from './Model.d';

const BASE = '/MultiYear';

export const fetchFilterOptions = (): Promise<ApiResponse<MultiYearFilterOptions>> =>
  httpClient.post<MultiYearFilterOptions>(`${BASE}/InitMultiYearFilters`, null, { preloaderMessage: 'Loading...' });

export const fetchPortfolios = (filter: PortfolioFilter): Promise<ApiResponse<Portfolio[]>> =>
  httpClient.post<Portfolio[]>(`${BASE}/ShowPortfolios`, filter, { preloaderMessage: 'Loading portfolios...' });

export const fetchPortfolioDetails = (portfolioId: number): Promise<ApiResponse<PortfolioDetails>> =>
  httpClient.post<PortfolioDetails>(`${BASE}/PortfolioDetails`, { PortfolioId: portfolioId }, { preloaderMessage: 'Loading portfolio...' });

/** Module-level so usePagination keeps a stable fetch function. */
export const fetchPortfolioMembers = (
  request: PaginatedRequest<MemberFilter>,
): Promise<ApiResponse<PaginationResponse<PortfolioMember>>> =>
  httpClient.post<PaginationResponse<PortfolioMember>>(`${BASE}/ShowPortfolioMembers`, request, { preloaderMessage: 'Loading projects...' });

export const createPortfolio = (payload: { Kind: PortfolioKind; OwnerParticipantId: string | null; TermStartYear: number }) =>
  httpClient.post<{ PortfolioId: number; Name: string; Message: string }>(`${BASE}/CreatePortfolio`, payload, { preloaderMessage: 'Creating portfolio...' });

export const openNextTerm = (portfolioId: number) =>
  httpClient.post<{ PortfolioId: number; Name: string; Carried: number; LeftBehind: number; Message: string }>(
    `${BASE}/OpenNextTerm`, { PortfolioId: portfolioId }, { preloaderMessage: 'Opening the next term...' });

export const saveBudgetCeilings = (portfolioId: number, ceilings: YearAmount[]) =>
  httpClient.post<{ Details: PortfolioDetails; Message: string }>(
    `${BASE}/SaveBudgetCeilings`, { PortfolioId: portfolioId, Ceilings: ceilings }, { preloaderMessage: 'Saving budget ceilings...' });

export const fetchPlanningFormOptions = (portfolioId: number): Promise<ApiResponse<PlanningFormOptions>> =>
  httpClient.post<PlanningFormOptions>(`${BASE}/InitPlanningProjectForm`, { PortfolioId: portfolioId }, { preloaderMessage: 'Loading form...' });

export const addPlanningProject = (payload: PlanningProjectFields & { PortfolioId: number; Membership: MembershipFields }) =>
  httpClient.post<{ MultiYearProjectId: number; ProjectId: string; MemberId: number; Warnings: string[]; Message: string }>(
    `${BASE}/AddPlanningProject`, payload, { preloaderMessage: 'Adding planning project...' });

export const fetchProjectDetails = (projectId: string): Promise<ApiResponse<MultiYearProjectDetails>> =>
  httpClient.post<MultiYearProjectDetails>(`${BASE}/MultiYearProjectDetails`, { ProjectId: projectId }, { preloaderMessage: 'Loading project...' });

export const updatePlanningProject = (payload: PlanningProjectFields & { MultiYearProjectId: number }) =>
  httpClient.post<{ ProjectId: string; Warnings: string[]; Message: string }>(
    `${BASE}/UpdatePlanningProject`, payload, { preloaderMessage: 'Saving project...' });

export const updateMembership = (payload: MembershipFields & { MemberId: number; StartYear?: number }) =>
  httpClient.post<{ MemberId: number; Message: string }>(`${BASE}/UpdateMembership`, payload, { preloaderMessage: 'Saving...' });

export const setMembershipStatus = (memberId: number, status: MembershipStatus, reason: string) =>
  httpClient.post<{ MemberId: number; Status: MembershipStatus; Message: string }>(
    `${BASE}/SetMembershipStatus`, { MemberId: memberId, Status: status, Reason: reason }, { preloaderMessage: 'Saving status...' });

export const fetchCodeLists = (): Promise<ApiResponse<MultiYearCodeLists>> =>
  httpClient.post<MultiYearCodeLists>(`${BASE}/ShowMultiYearCodeLists`, null, { preloaderMessage: 'Loading...' });

export const saveCodeListItem = (list: CodeListName, item: Omit<CodeListItem, 'InUse'>) =>
  httpClient.post<{ Lists: MultiYearCodeLists; Message: string }>(
    `${BASE}/SaveMultiYearCodeListItem`, { ...item, List: list }, { preloaderMessage: 'Saving...' });

// ---------------------------------------------------------------- Phase 2

export const fetchProposeForm = (memberId: number): Promise<ApiResponse<ProposeFormOptions>> =>
  httpClient.post<ProposeFormOptions>(`${BASE}/InitProposeForm`, { MemberId: memberId }, { preloaderMessage: 'Loading programs...' });

export const proposeToAnnualProgram = (payload: ProposeRequest) =>
  httpClient.post<{ ProjectId: string; ProgramPK: string; ProgramName: string; Status: MembershipStatus; Message: string }>(
    `${BASE}/ProposeToAnnualProgram`, payload, { preloaderMessage: 'Proposing...' });

export const fetchPipCandidates = (portfolioId: number, search: string): Promise<ApiResponse<PipCandidate[]>> =>
  httpClient.post<PipCandidate[]>(`${BASE}/ShowPipCandidates`, { PortfolioId: portfolioId, Search: search }, { preloaderMessage: 'Loading projects...' });

export const addToPip = (portfolioId: number, sourceMemberId: number, mcaScore: number) =>
  httpClient.post<{ MemberId: number; Message: string }>(
    `${BASE}/AddToPip`, { PortfolioId: portfolioId, SourceMemberId: sourceMemberId, McaScore: mcaScore }, { preloaderMessage: 'Adding to PIP...' });

export const setPipCost = (memberId: number, cost: number, reason: string) =>
  httpClient.post<{ MemberId: number; Cost: number; Message: string }>(
    `${BASE}/SetPipCost`, { MemberId: memberId, Cost: cost, Reason: reason }, { preloaderMessage: 'Saving PIP cost...' });

export const fetchUpdateRuns = (): Promise<ApiResponse<UpdateRuns>> =>
  httpClient.post<UpdateRuns>(`${BASE}/ShowUpdateRuns`, null, { preloaderMessage: 'Loading GAA updates...' });

export const runGaaUpdate = (year: number) =>
  httpClient.post<{ RunId: number; Message: string }>(`${BASE}/RunGaaUpdate`, { Year: year }, { preloaderMessage: 'Updating portfolios...' });

export const fetchSavedTotals = (portfolioId: number): Promise<ApiResponse<SavedTotals[]>> =>
  httpClient.post<SavedTotals[]>(`${BASE}/ShowSavedTotals`, { PortfolioId: portfolioId }, { preloaderMessage: 'Loading saved totals...' });

export const fetchSavedTotalsDetails = (snapshotId: number): Promise<ApiResponse<SavedTotalsDetails>> =>
  httpClient.post<SavedTotalsDetails>(`${BASE}/SavedTotalsDetails`, { SnapshotId: snapshotId }, { preloaderMessage: 'Loading...' });

export const saveTotals = (portfolioId: number, note: string) =>
  httpClient.post<{ SnapshotId: number; Message: string }>(`${BASE}/SaveTotals`, { PortfolioId: portfolioId, Note: note }, { preloaderMessage: 'Saving totals...' });

/** The import template, as a file to save. */
export const downloadPlanningTemplate = async (portfolioId: number): Promise<Blob> => {
  const response = await httpClient.post<Blob>(`${BASE}/DownloadPlanningTemplate`, { PortfolioId: portfolioId }, {
    preloaderMessage: 'Preparing the template...',
    responseType: 'blob',
  });
  return response.Data as Blob;
};

export const importPlanningProjects = (portfolioId: number, file: File): Promise<ApiResponse<PlanningImportResult>> => {
  const formData = new FormData();
  formData.append('File', file, file.name);
  formData.append('PortfolioId', String(portfolioId));
  // The instance's JSON Content-Type would make axios stringify the FormData (see LumpSum/Service.ts).
  return httpClient.post<PlanningImportResult>(`${BASE}/ImportPlanningProjects`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    preloaderMessage: 'Importing planning projects...',
  });
};
