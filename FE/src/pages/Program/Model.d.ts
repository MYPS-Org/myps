export interface ProgramModel {
	Id: number;
	Stage: number;
	Status: number;
	Type: number;
	Name: string;
	AddedName?: string;
	YearStart: number;
	YearEnd: number;
	UserGroup: number[];
	IsSkipped: boolean;
	SkipReason: string;
	DataSecurityGroup?: string[];
}
export interface ProgramEnums {
	Id: number;
	ParticipantId: string;
	Name?: string;
	GroupName?: string;
	OrgName?: string;
	OrgType?: string;
	ProvinceName?: string;
	RegionName?: string;
	CongressionalDistrictName?: string;
	IslandCode?: string;
	RegionParticipantId: string;
}

export interface ProgramLatest {
	Id: number;
	RevisionId: number;
	StageFKId: number;
	ProgramPK: string;
	ProgramId: string;
	StageId: number;
	StageName: string;
	Name: string;
	Status?: string;
	Type?: string;
	ProgramType?: string;
	DataSecurityGroup: string;
	UserGroup: string;
	NumberOfProjects?: number;
	StartYear: number;
	/** Not returned by the backend today (vProgramLatest has no end-year column); populated client-side where available (e.g. mapToProgramLatest), otherwise undefined. */
	YearEnd?: number;
	/** Not returned by the backend today; kept for Modification/Revision's excess-component cost fallback, which has no live backend wiring yet. */
	Cost?: number;
}

export interface ProgramDetails {
	StageFKId: number;
	ProgramPK: string;
	ProgramId: string;
	StageId: number;
	StageName: string;
	RevisionId: number;
	Name: string;
	Status: number;
	StatusName?: string;
	Cost: number;
	Type: number;
	ProgramType?: string;
	StartYear: number;
	UserGroup: string[];
	DataSecurityGroup: string[];
	IsPublished: boolean;
	IsDeleted: boolean;
	IsSkipped: boolean;
	CreatedBy: string;
	CreatedDate: string;
}

export interface StageList {
	Stages: ProgramDetailsWithStages[];
}

export interface ProgramDetailsWithStages {
	Id: number;
	ProgramId: string;
	ProgramPK: string;
	RevisionNumber: number;
	ProjectCount?: number;
	Name: string;
	StageId: number;
	StageName: string;
	Description?: string;
	IsSkipped: boolean;
	SkipReason: string;
	UserGroup: number;
	RegionCode: string;
	Status: number;
	ProgramType: string;
	Cost?: number;
	StartYear: number;
	YearEnd: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ProgramDetailsEnums{
  Details: ProgramDetails;
  IsActive: boolean;
  Dropdowns: {
    Stages: TableEnums[];
    Statuses: TableEnums[];
    Types: TableEnums[];
    Groups: ProgramEnums[];
	DataSecurity: ProgramEnums[];
  };
}

export interface TableEnum {
	Id: number;
	NameId: number;
	Name: string;
	Description?: string;
}

export interface ProgramFilter {
  Name?: string;
  StartYear?: number | null;
  StageName?: string;
  Type?: string;
}

export interface ProgramProjectFilter {
	ProjectId?: string;
}

/** Request contract for /Program/ShowProjectsInProgram — a program-scoped pagination endpoint,
 * so it carries ProgramId/StageName alongside its own cursor fields (Navigation/PageCursorId)
 * rather than the generic PaginatedRequest<T>/Direction shape used elsewhere. */
export interface ShowProjectsInProgramRequest {
	Filters?: ProgramProjectFilter;
	limit: number;
	page: number;
	Navigation: number;
	PreviousFilteredId: number;
	NextFilteredId: number;
	PageCursorId: number;
	ProgramId: string;
	StageName: string;
}

export interface ProgramProjectsPaginationResponse extends PaginationResponse<ProgramProjects> {
	PageCursorId?: number | null;
}

export interface ProgramProjects {
	Id: number;
	RevisionId: number;
	StageFK: number;
	ProjectPK: string;
	ProgramFK: string;
	ProgramId: string;
	ProjectId: string;
	ProgramName?: string;
	StageName: string;
	Category: number;
	CategoryName?: string;
	Description: string;
	Region: string;
	ThrustName: string;
	OperatingUnitName: string;
	ImplementingOfficeName: string;
	CreatedDate: string;
	LastUpdatedBy?: string;
	LastUpdatedDate?: string;
	RevisionCreatedBy: string;
	RevisionCreatedDate: string;
	Source: string;
	OldSourceId?: number;
	IsPublishable?: boolean;
	IsPublished?: boolean;
}

export interface ProgramList {
	Id: number;
	RevisionId: number;
	ProgramId: string;
	NumberOfProjects?: number;
	TypeName?: string;
	StageName: string;
	StageId?: number;
	Name: string;
	GroupName?: string;
	RegionCode: string;
	Status?: number;
	Type?: string;
	Cost?: number;
	YearStart: number;
	YearEnd: number;
	CreatedBy: string;
	CreatedDate: string | null;
	// IsPublished: boolean;
	IsPublishable: boolean;
}

export type AIPReportType = 'AIP' | 'AIP02' | 'RBP' | 'RBPComponents' | 'RBPTier' | 'RDIP';

/** Matches tOptionProjectCategory (same shape as CategoryEnum in Project model) */
export interface AIPDropdownCategory {
  Id: number;
  CategoryId: number;
  CategoryName: string | null;
  Minimum: number;
  Maximum: number;
  ValidUntil: number;
}

/** Matches tOptionAdminAreaRegion */
export interface AIPDropdownRegion {
  Id: number;
  GdbId: string;
  Name: string;
  ParticipantId: string;
  IslandCode: string;
}

/** Matches vAdminOperatingUnit (same shape as ProjectOperatingUnitEnum in Project model) */
export interface AIPDropdownOperatingUnit {
  Name: string;
  ParticipantId: string;
  OrgType: string;
  RegionParticipantId: string;
  RegionName: string;
}

/** Matches tOptionAdminAreaDistrictEngineeringOffice (same shape as RODEOEnum in Project model) */
export interface AIPDropdownDEO {
  Id: number;
  GdbId?: string;
  Name: string;
  ParticipantId: string;
  ProvinceGdbId: string;
  ProvinceName?: string;
  RegionParticipantId: string;
  RegionName: string;
}

/** Matches vAdminImplementingOffice (same shape as ProjectImplementingOfficeEnum in Project model) */
export interface AIPDropdownImplementingOffice {
  Name: string;
  ParticipantId: string;
  OrgType: string;
  RegionParticipantId: string;
  RegionName: string;
}

/** Matches tOptionAdminAreaCongressionalDistrict (same shape as ProjectLegislativeDistrictEnum in Project model) */
export interface AIPDropdownLegislativeDistrict {
  Id: number;
  GdbId: string;
  Name: string;
  Code?: string;
  ProvinceGdbId: string;
  ProvinceName: string;
}

export interface AIPReportDropdowns {
  Categories: AIPDropdownCategory[];
  Regions: AIPDropdownRegion[];
  OperatingUnits: AIPDropdownOperatingUnit[];
  DEOs: AIPDropdownDEO[];
  ImplementingOffices: AIPDropdownImplementingOffice[];
  LegislativeDistricts: AIPDropdownLegislativeDistrict[];
}

export interface AIPReportParams {
  ReportType: AIPReportType;
  ProgramId: string;
  ProgramName?: string;
  StageName?: string;
  CategoryName?: string;
  RegionName?: string;
  OperatingUnitName?: string;
  DistrictEngineeringOffice?: string;
  ImplementingOfficeName?: string;
  LegislativeDistrictName?: string;
}

export interface ImportFileUpload {
  Name: string;
  Extension: string;
  ContentType: string;
  DataUrl: string;
}

export type ImportJobStatusValue = 'Queued' | 'Processing' | 'Completed' | 'CompletedWithErrors' | 'Failed' | 'Cancelled';

export interface ImportJobStatus {
  JobId: string;
  HangfireJobId?: string;
  Status: ImportJobStatusValue;
  Message?: string;
  ValidCount: number;
  WarningCount: number;
  ErrorCount: number;
  QueuedAt?: string;
  StartedAt?: string | null;
  CompletedAt?: string | null;
  TextFileUrl: string | null;
  ExcelFileUrl: string | null;
}