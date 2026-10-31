// =============================================================================
// Multi-Year module types. They mirror WebAPI/Controllers/MultiYear (PascalCase,
// enums as ints). See documents/plans/multi-year-phase-1-portfolio-module.md.
// =============================================================================

/** tMultiYearPortfolio.Kind */
export type PortfolioKind = 1 | 2 | 3; // RDIP | UDIP | PIP
/** tMultiYearPortfolio.Status */
export type PortfolioStatus = 1 | 2; // Open | Closed
/** tMultiYearPortfolioMember.Status */
export type MembershipStatus = 1 | 2 | 3 | 4 | 5; // New | Potential | Ongoing | Completed | Cancelled

export interface Owner {
  ParticipantId: string;
  Name: string;
}

export interface MultiYearFilterOptions {
  Regions: Owner[];
  Clusters: Owner[];
  CanSeePip: boolean;
  CurrentYear: number;
  FirstTermStartYear: number;
  LastTermStartYear: number;
}

export interface PortfolioFilter {
  Kind?: PortfolioKind;
  OwnerParticipantId?: string;
  Status?: PortfolioStatus;
  Year?: number;
}

export interface Portfolio {
  Id: number;
  Kind: PortfolioKind;
  KindName: string;
  OwnerParticipantId: string | null;
  OwnerName: string | null;
  TermStartYear: number;
  TermEndYear: number;
  Term: string;
  Status: PortfolioStatus;
  Name: string;
  PreviousPortfolioId: number | null;
  NextPortfolioId: number | null;
  ProjectCount: number;
  PlannedCost: number;
}

export interface PortfolioYear {
  Year: number;
  Planned: number;
  Ceiling: number | null;
}

export interface PortfolioDetails {
  Portfolio: Portfolio;
  Years: PortfolioYear[];
  PlannedBeforeTerm: number;
  PlannedLaterYears: number;
  StatusCounts: { Status: MembershipStatus; Count: number }[];
  IsOpen: boolean;
  TermHasEnded: boolean;
  CanAddProjects: boolean;
}

export interface MemberFilter {
  PortfolioId: number;
  Status?: MembershipStatus;
  Search?: string;
}

export interface YearAmount {
  Year: number;
  Amount: number;
}

export interface PortfolioMember {
  Id: number;
  PortfolioFK: number;
  MultiYearProjectFK: number;
  ProjectId: string;
  Description: string;
  Category: number;
  CategoryName: string | null;
  Region: string | null;
  RegionName: string | null;
  DEO: string | null;
  DEOName: string | null;
  IsOwner: boolean;
  Status: MembershipStatus;
  StartYear: number;
  EndYear: number | null;
  Cost: number;
  Tier: number | null;
  McaScore: number | null;
  HorizonType: string;
  PlannedTotal: number;
  /** JSON from the view: [{"Year":2026,"Amount":100}] */
  YearAmounts: string;
  AllowedStatuses: MembershipStatus[];
  /** PIP: the cost when it entered PIP, never changed. */
  OriginalCost: number | null;
  /** PIP: the RDIP / UDIP it came from; null when the GAA update added it. */
  SourcePortfolioFK: number | null;
  SourcePortfolioName: string | null;
}

export interface CodeListItem {
  Id: number;
  Name: string;
  Description: string | null;
  ValidFromYear: number;
  ValidToYear: number;
  IsActive: boolean;
  /** RdpOutput only */
  OutcomeFK?: number;
  OutcomeId?: number | null;
  InUse?: boolean;
}

export interface RdpPick {
  OutcomeId: number;
  OutputId: number;
}

export interface MembershipFields {
  BasisForImplementationId: number | null;
  NedaProjectStatusId: number | null;
  ReadinessLevelIds: number[];
  RdpOutcomes: RdpPick[];
  Tier: number | null;
  McaScore: number | null;
}

export interface PlanningComponent {
  Description: string;
  InfraTypeFK: string;
  WorkTypeFK: number;
  PhysicalTarget: number | null;
}

export interface PlanningProjectFields {
  Description: string;
  Category: number;
  Thrust: number | null;
  Region: string | null;
  Province: string | null;
  City: string | null;
  LegislativeDistrict: string | null;
  DEO: string | null;
  ImplementingOffice: string | null;
  ReportingRegion: string | null;
  RegionWide: number | null;
  HorizonTypeId: number;
  StartYear: number;
  EndYear: number | null;
  Component: PlanningComponent;
  YearlyCosts: YearAmount[];
}

export interface HorizonType {
  Id: number;
  Name: string;
  Years: number | null;
  Description: string | null;
  IsActive: boolean;
}

export interface PlanningFormOptions {
  Portfolio: Portfolio;
  HorizonTypes: HorizonType[];
  Categories: { CategoryId: number; CategoryName: string | null; IsActive: boolean; ValidUntil: number }[];
  Thrusts: { PAPKey: number; ThrustDescription: string; IsActive: boolean; ValidFromDate: number; ValidToDate: number }[];
  CategoryThrustMap: { CategoryId: number; PAPKey: number }[];
  Regions: { ParticipantId: string; Name: string; IslandCode: string }[];
  Provinces: { Code: string; Name: string; RegionParticipantId: string }[];
  Cities: { Code: string; Name: string; ProvinceCode: string }[];
  LegislativeDistricts: { Code: string; Name: string; ProvinceCode: string }[];
  DEOs: { ParticipantId: string; Name: string; RegionParticipantId: string }[];
  ImplementingOffices: { ParticipantId: string; Name: string; RegionParticipantId: string | null }[];
  RegionWides: { NameId: number; Name: string; IsActive: boolean }[];
  Tiers: { NameId: number; Name: string; IsActive: boolean | null }[];
  InfraTypes: { InfraCode: string; InfraName: string; IsActive: boolean }[];
  ScopesOfWork: { Enum: number; Description: string; Measure: string; InfraType: string[]; IsActive: boolean }[];
  BasisForImplementation: CodeListItem[];
  NedaProjectStatus: CodeListItem[];
  ReadinessLevels: CodeListItem[];
  RdpOutcomes: CodeListItem[];
  RdpOutputs: CodeListItem[];
}

export interface StatusLogEntry {
  FromStatus: MembershipStatus | null;
  ToStatus: MembershipStatus;
  FromStartYear: number | null;
  ToStartYear: number | null;
  FromCost: number | null;
  ToCost: number | null;
  Reason: string | null;
  ChangedBy: string;
  ChangedDate: string;
  /** Made by the portfolio update after a GAA approval. */
  BySystem: boolean;
}

export interface ProjectMembership extends MembershipFields {
  MemberId: number;
  PortfolioId: number;
  PortfolioName: string;
  Kind: PortfolioKind;
  PortfolioStatus: PortfolioStatus;
  IsOwner: boolean;
  Status: MembershipStatus;
  StartYear: number;
  Cost: number;
  OriginalCost: number | null;
  CanEdit: boolean;
  CanEditStartYear: boolean;
  AllowedStatuses: MembershipStatus[];
  /** PIP: the RDIP / UDIP it came from. */
  SourcePortfolioName: string | null;
  CanPropose: boolean;
  CanSetPipCost: boolean;
  StatusLog: StatusLogEntry[];
}

export interface MultiYearProjectRecord {
  Id: number;
  ProjectId: string;
  Description: string;
  Category: number;
  Thrust: number | null;
  Region: string | null;
  Province: string | null;
  City: string | null;
  LegislativeDistrict: string | null;
  DEO: string | null;
  ImplementingOffice: string | null;
  ReportingRegion: string | null;
  RegionWide: number | null;
  IslandCode: string;
  HorizonTypeFK: number;
  StartYear: number;
  EndYear: number | null;
  OriginalCost: number;
  CurrentCost: number;
  CreatedBy: string;
  CreatedDate: string;
}

export interface MultiYearProjectDetails {
  Project: MultiYearProjectRecord;
  HorizonType: string | null;
  HorizonYears: number | null;
  CategoryName: string | null;
  ThrustName: string | null;
  RegionName: string | null;
  Components: {
    Id: number;
    ComponentId: string;
    ComponentType: string;
    Description: string | null;
    InfraTypeFK: string | null;
    InfraTypeName: string | null;
    WorkTypeFK: number | null;
    WorkTypeName: string | null;
    PhysicalTarget: number | null;
    TargetUnit: string | null;
  }[];
  YearlyCosts: { Year: number; Amount: number; Status: 'Planned' | 'Locked'; BeforeStart: boolean }[];
  Memberships: ProjectMembership[];
  /** Every annual program holding the project (its Multi Year ID is this MY id), at its latest stage there. */
  AnnualPrograms: AnnualProgramEntry[];
  Proposals: Proposal[];
  /** Set when the GAA update made this record from an approved GAA project. */
  OriginProgramName: string | null;
  CanEditProject: boolean;
  OwnerPortfolioId: number | null;
  CanEditStartYear: boolean;
}

export interface MultiYearCodeLists {
  BasisForImplementation: CodeListItem[];
  NedaProjectStatus: CodeListItem[];
  ReadinessLevel: CodeListItem[];
  RdpOutcome: CodeListItem[];
  RdpOutput: CodeListItem[];
}

export type CodeListName = keyof MultiYearCodeLists;

// ---------------------------------------------------------------- Phase 2

export interface AnnualProgramEntry {
  ProgramFK: string;
  ProgramName: string;
  Year: number;
  StageName: string;
  ProjectId: string;
  Amount: number;
  /** An approved GAA / GAA-R. */
  Approved: boolean;
  /** Non-Implementable, or Termination with No Disbursements, approved. */
  Withdrawn: boolean;
}

export interface Proposal {
  ProjectId: string;
  ProgramName: string;
  BudgetYear: number;
  Amount: number;
  ProposedBy: string;
  ProposedDate: string;
  /** False once the annual project was deleted: the year is free again. */
  Live: boolean;
}

export interface NamedOption {
  NameId: number;
  Name: string;
}

export interface ProposeFormOptions {
  MemberId: number;
  ProjectId: string;
  Description: string;
  PortfolioName: string;
  Status: MembershipStatus;
  StartYear: number;
  Tier: number | null;
  MissingFields: string[];
  Programs: { ProgramPK: string; Name: string; StartYear: number; PlannedAmount: number | null; AlreadyProposed: boolean }[];
  OperatingUnits: { ParticipantId: string; Name: string }[];
  Origins: NamedOption[];
  Agencies: NamedOption[];
  ImplementationModes: NamedOption[];
  EmergencyModes: NamedOption[];
  RowAvailables: NamedOption[];
  Feasibilities: NamedOption[];
  DetailedDesigns: NamedOption[];
  Tiers: NamedOption[];
}

export interface ProposeRequest {
  MemberId: number;
  ProgramPK: string;
  OperatingUnit: string;
  Origin: number;
  Agency: number;
  ImplementationMode: number | null;
  EmergencyMode: number | null;
  RowAvailable: number | null;
  Feasibility: number | null;
  FeasibilityDate: string | null;
  DetailedDesign: number | null;
  DetailedDesignDate: string | null;
  Tier: number;
}

export interface PipCandidate {
  SourceMemberId: number;
  ProjectId: string;
  Description: string;
  SourcePortfolioName: string;
  Status: MembershipStatus;
  StartYear: number;
  Cost: number;
  McaScore: number | null;
}

export interface UpdateRunCounts {
  StatusMoves?: number;
  StartYearMoves?: number;
  AddedToPip?: number;
  NotAddedNoPip?: string[];
  TotalsSaved?: number;
}

export interface UpdateRuns {
  Years: number[];
  Runs: { Id: number; Year: number; Trigger: string; ProgramName: string | null; Counts: UpdateRunCounts | null; RunBy: string; RunDate: string }[];
}

export interface TotalsYear {
  Year: number;
  Planned: number;
  Proposed: number;
  Approved: number;
  Ceiling?: number | null;
}

export interface SavedTotals {
  SnapshotId: number;
  ReasonLabel: string;
  Note: string | null;
  TakenBy: string;
  TakenDate: string;
  Projects: number;
  Years: TotalsYear[];
}

export interface SavedTotalsDetails {
  SnapshotId: number;
  PortfolioName: string;
  ReasonLabel: string;
  Note: string | null;
  TakenBy: string;
  TakenDate: string;
  Years: TotalsYear[];
  Projects: { ProjectId: string; Description: string; Years: TotalsYear[] }[];
}

export interface PlanningImportResult {
  Added: { Row: number; ProjectId: string; Warnings: string[] }[];
  Errors: { Row: number; Messages: string[] }[];
  Message: string;
}
