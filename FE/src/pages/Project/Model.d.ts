import type { ProgramList, ProgramLatest } from "../Program/Model";

export interface ProjectFilter {
  ProgramId?: string;
  ProjectId?: string;
}

export interface ProjectFormPayload {
  IsModify?: boolean;
  IsActive: boolean;
  IsUnlock?: boolean;
  // Whether the current user has permission to submit a revision request (ShowProjectDetails
  // computes this from vUserActionPermission/vUserViewPermission; ReviseProject also returns it).
  CanRevise?: boolean;
  ProgramDetails: ProgramLatest;
  ProjectDetails: ProjectDetails;
  ComponentCosts: ComponentCost[];
  ComponentCostPerYear: ComponentCostPerYear[];
  MajorItemOfWorks: MajorItemOfWork[];
  MajorItemLocations: MajorItemLocations[];
  ProjectNotes: ProjectNote[];
  Docs: ProjectSupportingDocs[];
  FundingProfile: FundingProfile[];
  /** @deprecated Not returned by ShowProjectDetails. Use getComponentsEnums()/ShowProjectComponentDropdowns instead. Kept optional for the Modification/Revision module. */
  Dropdowns?: Dropdowns;
  Activities: Activity[];
  TransactionLogs: TransactionLog[];
}

export interface RevisionDropdown {
	Headers: OptionRevisionHeader[];
	Reasons: OptionRevisionReasons[];
	Categories: OptionRevisionCategory[];
}

export interface OptionRevisionReasons {
	Id: number;
	Reason: string;
	RevisionGroupId: number;
	ReasonId: number;
    CategoryId?: number[];
	CreatedBy: string;
	CreatedDate?: string;
}

export interface OptionRevisionHeader {
	Id: number;
	RevisionName: string;
	RevisionGroupId: number;
}

export interface OptionRevisionCategory {
	Id: number;
	CategoryName: string;
	CategoryId: number;
	RevisionGroupId: number;
}

export interface ProjectDetails {
	Id: number;
	ProjectFK: string;
	ProjectId: string;
	ProjectType: string;
	ProgramFK: string;
	ProgramId: string;
	ProgramName?: string;
	StageName: string;
	AlternateId?: string;
	MYId?: string;
	Description: string;
	/*  Optional, like Province/City/LegislativeDistrict beside them: a Lump Sum
	    Project covers a programme, not a site, so the server sends null for its
	    whole location chain. Mirrors DBHelper ProjectDetails.cs. */
	Region?: string;
	Province?: string;
	City?: string;
	LegislativeDistrict?: string;
	DEO?: string;
	OperatingUnit: string;
	ImplementingOffice?: string;
	IslandCode?: string;
	Category: number;
	CategoryName?: string;
	Thrust?: number;
	ThrustName?: string;
	Origin: number;
	OriginName?: string;
	Agency: number;
	AgencyName?: string;
	ImplementationMode?: number;
	ImplementationModeName?: string;
	EmergencyMode?: number;
	EmergencyModeName?: string;
	RegionWide: number;
	RegionWideName?: string;
	Feasibility?: number;
	FeasibilityName?: string;
	FeasibilityDate?: string;
	DetailedDesign?: number;
	DetailedDesignName?: string;
	DetailedDesignDate?: string;
	RowAvailable?: number;
	RowAvailableName?: string;
	Tier: number;
	TierName?: string;
	Rank?: number;
	MYCAApprovalDate?: string;
	CreatedBy: string;
	CreatedDate?: string;
	LastUpdatedBy?: string;
	LastUpdatedDate?: string;
	Source: string;
	IsPublished?: boolean;
}
export interface ProjectLists {
	/** tProjects.Id — for a Lump Sum Project, also the key of /lumpsum/:lumpSumId. */
	Id: number;
	/**
	 * Server-computed: a Lump Sum Project (ProjectType 'LS' with no parent), which
	 * the list opens in the Lump Sum module rather than the project form. Itemized
	 * children are ordinary projects and come back false.
	 */
	IsLumpSum?: boolean;
	ProgramId: string;
	ProgramName: string;
	ProjectId: string;
	ProjectPK: string;
	RevisionNumber: number;
	Description: string;
	Category?: string;
	CategoryName?: string;
	Thrust?: string;
	Origin?: string;
	City?: string;
	LegislativeDistrict?: string;
	OperatingUnit?: string;
	ImplementingOffice?: string;
	DEO?: string;
	Region?: string;
	Agency?: string;
	ImplementationMode?: string;
	EmergencyMode?: string;
	Feasibility?: string;
	DetailedDesign?: string;
	RowAvailable?: string;
	StageName: string;
	CreatedBy: string;
	CreatedDate: string;
	RevisionCreatedBy?: string;
	RevisionCreatedDate?: string;
	LastUpdatedDate?: string;
	LastUpdatedBy?: string;
	UpdatedDate?: string;
	IsPublished?: boolean;
	IsPublishable: boolean;
}

export interface Activity {
  Id: string;
  Description: string;
  Date: string;
}

export interface TransactionLog {
  Id: number;
  TransactionId: string;
  ReferenceId?: string;
  TypeOfTransaction?: string;
  AffectedTable: string;
  AffectedColumn: string;
  OldValue: string;
  NewValue: string;
  CreatedBy: string;
  CreatedDate: string | null;
}

export interface ScopeOfWorkEnum {
	Id: number;
	Enum: number;
	InfraType: string[];
	WorkCategory: string;
	Description: string;
	Measure: number;
	MaxAmount: number;
	MinAmount: number;
	IsActive?: boolean;
}

export interface InfraTypeEnum {
	Id: number;
	InfraId: number;
	InfraCode: string;
	InfraName: string;
	IsActive?: boolean;
}

export interface RoadSections {
	Id: number;
	SectionId: string;
	NetworkStatus: number;
	SectionLength: number;
	RegionCode: string;
	DeoCode: string;
	RoadId: string;
	CDOCode: string;
	CDOName: string;
}

export interface Bridge {
	Id: number;
	BridgeId: string;
	BridgeName: string;
	Location: string;
	Length: number;
	Width: number;
	RegionCode: string;
	DeoCode: string;
}

export interface FCS {
	Id: number;
	FCSId: string;
	FCSName: string;
	Location: string;
	Capacity: number;
	RegionCode: string;
	DeoCode: string;
}

export interface OtherInfra {
	Id: number;
	InfraId: string;
	InfraName: string;
	InfraType: string;
	Location: string;
	Description: string;
	RegionCode: string;
	DeoCode: string;
}

export interface InfraData {
	RoadSections?: import('../Rbia/Model.d').FutureRoadSections[];
	Bridges?: import('../Rbia/Model.d').FutureBridge[];
	FCS?: any[];
	OtherInfra?: any[];
}

// #region Notes
export interface AddNotes {
	StageName: string;
	DocumentType: string;
	DocTypeName: string;
	ProjectId: string,
	Description: string,
	File: FileEntity
}
export interface FileEntity {
	Name: string,
	Extension: string,
	ContentType: string,
	DataUrl: string
}

export interface FundingProfile {
	Id: number;
	Source: string;
	ProjectRevisionFK: number;
	ProjectFK: string;
	ProjectId?: string;
	StageName: string;
	SourceOrg: string;
	AgreementCode: string;
	Amount: number;
	Percentage: number;
	IsWalletDraw?: boolean;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsDeleted: boolean;
}
// #region ComponentCost
export interface ComponentCost {
	Id: number;
	Source: string;
	ProjectRevisionFK: number;
	ProjectFK: string;
	ProjectId: string;
	StageName?: string;
	ComponentType: string;
	ComponentName?: string;
	ComponentId: string;
	Description?: string;
	Total?: number;
	ConstructionStatusCode?: number;
	ConstructionStatusName?: string;
	IsPackaged?: string;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsDeleted: boolean;
}

export interface ComponentCostPerYear {
	Id: number;
	Source: string;
	ComponentCostFK: number; // FK -> ComponentCost.Id
	ProjectFK: string;
	ProjectId: string;
	StageName?: string;
	ComponentId: string;
	Amount?: number;
	Year?: number;
	UACS?: string;
	StartDate?: string | null;
	EndDate?: string | null;
	DateOfApproval?: string;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsDeleted: boolean;
}

// #endregion ComponentCost
export interface MajorItemOfWorksWithDropdown extends MajorItemOfWork {
	DropdownData: ScopeOfWorkEnum[];
	MajorItemLocations: MajorItemLocations[]; // Keep for UI functionality
}
export interface MajorItemOfWork {
	Id: number;
	Source: string;
	ComponentCostFK: number; // FK -> ComponentCost.Id
	ProjectFK: string;
	ProjectId?: string;
	StageName: string;
	ComponentId: string;
	YearOfWork: number;
	WorkTypeFK: number;
	InfraTypeFK: string;
	TargetUnitId: number;
	TargetUnit: string;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsDeleted: boolean;
}
export interface MajorItemLocations {
	Id: number;
	WorkItemFK: number;
	Source: string;
	ProjectFK: string;
	ProjectId?: string;
	StageName: string;
	ComponentId: string;
	YearOfWork: number;
	InfraId: string;
	DetailedScope?: string;
	TargetUnitId: number;
	TargetUnit: string;
	StartX?: number;
	StartY?: number;
	EndX?: number;
	EndY?: number;
	PhysicalTarget?: number;
	StartStationLimit?: string;
	EndStationLimit?: string;
	StartChainage?: number;
	EndChainage?: number;
	Length?: number;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsDeleted: boolean;
}
export interface ProjectNote {
	Id: number;
	ProjectId: string;
	FileName: string;
	FileExtension: string;
	FilePath: string;
	Description: string;
	CreatedBy: string;
	CreatedDate: string;
}
export interface ProjectSupportingDocs {
	Id: number;
	DocumentType: string;
	Code: string;
	Name: string;
	DocTypeFK: string;
	DocTypeName: string;
	ProjectId: string;
	StageName?: string;
	FileName: string;
	FileExtension: string;
	FilePath: string;
	Description: string;
	CreatedBy: string;
	CreatedDate?: string;
	IsDeleted?: boolean;
}
// The real persisted-row shape UploadSupportingDocs now returns (ProjectController.cs) --
// used by AddNoteDialog.tsx to build the just-uploaded row from server truth instead of
// fabricating one from client-only data.
export interface UploadedDocData {
	Id: number;
	DocTypeFK: string;
	DocTypeName: string;
	FileName: string;
	FileExtension: string;
	FilePath: string;
	Description: string;
	CreatedBy: string;
	CreatedDate: string;
}

// #region Additional interfaces for dropdowns and enums
// Shape of the /Project/ShowProjectComponentDropdowns response — dropdown data
// for everything on ProjectForm.tsx that ShowProjectDropdowns does not cover.
export interface Dropdowns {
	// Program Details
	Programs: ProgramLatest[];
	// Component Cost
	ComponentTypes: ComponentTypeEnum[];
	// Funding Profile
	Agreements: AgreementEnum[];
	Sources: SourceEnum[];
	// Major Item of Works / Work Location
	ScopeOfWorks: ScopeOfWorkEnum[];
	InfraTypes: InfraTypeEnum[];
	// Notes / Supporting Documents
	SupportingDocs: DropdownSupportingDocs[];
	// Revisions
	Revisions?: RevisionDropdown;
}

// Shape of the /Program/ShowProgram response, adapted for the Program Details
// type-ahead search in ProgramDetailsForm.tsx.
export interface SearchProgram {
	Programs?: ProgramLatest[];
}
export interface DropdownSupportingDocs {
	Id: number;
	Code: string;
	Name: string;
	CreatedBy: string;
	CreatedDate: string;
	ValidUntil: number;
}
export interface ComponentTypeEnum {
	Id: number;
	ComponentId?: string;
	ComponentName?: string;
	ExportToPCMA: boolean;
	IsDeleted: boolean;
	IsActive?: boolean;
}
export interface CategoryEnum {
	Id: number;
	CategoryId?: string;
	CategoryName?: string;
	Minimum: number;
	Maximum: number;
	ValidUntil: number;
	IsActive?: boolean;
	IsCurrentlyValid: boolean;
}
export interface ThrustEnum {
	Id: number;
	PAPKey: number;
	ProgramName: string;
	SubProgramName: string;
	ActivityName: string;
	SequenceNumber: number;
	ValidFromDate: number;
	ValidToDate: number;
	InfrastructureType?: string;
	ThrustDescription: string;
	IsActive?: boolean;
	IsCurrentlyValid: boolean;
}
export interface TableEnum {
	Id: number;
	NameId: number;
	Name: string;
	Description?: string;
	IsActive?: boolean;
}
export interface RODEOEnum {
	Id: number;
	ParticipantId: string;
	Name: string;
	ProvinceCode: string;
	OfficeType: string;
	DEOParticipantId?: string;
	RegionParticipantId?: string;
	RegionCode?: string;
	RegionName?: string;
	ParentParticipantId?: string;
	ParentName?: string;
}
export interface AgencyEnum {
	Id: number;
	NameId: number;
	Name: string;
	Description: null | string;
	IsActive?: boolean;
}
export interface EmergencyModeEnum {
	Id: number;
	Enum: boolean;
	Name: string;
	Description: string;
}
export interface AgreementEnum {
	Id: number;
	SourceOrg: string;
	Code: string;
	Name: string;
	FinancingSourceSegmentCode: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsActive?: boolean;
}
export interface SourceEnum {
	Id: number;
	Organization: string;
	Name: string;
	Nature?: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsActive?: boolean;
}
//#endregion

// #region add Project details Enums
export interface ProjectEnums {
  /** @deprecated Not returned by ShowProjectDropdowns. Use Dropdowns.Programs (ShowProjectComponentDropdowns) instead. Kept optional for the Modification/Revision module. */
  Programs?: ProgramList[];
  Categories: CategoryEnum[];
  Thrusts: ThrustEnum[];
  /**
   * Category -> permitted Sub-Category (PAPKey) restrictions, from ShowProjectDropdowns.
   *
   * ONLY RESTRICTED CATEGORIES APPEAR HERE. The server resolves the three-part
   * "is this Category restricted" rule (no mapping rows / a PAPKey = -1 wildcard, which means
   * every Sub-Category qualifies / a mapping whose PAPKeys resolve to nothing) and omits any
   * Category the rule calls unrestricted. So the only rule this side needs is:
   * no entry for a CategoryId means every Thrust is allowed for it.
   *
   * Optional because the Modification module reuses this type against endpoints that do not
   * return the field.
   */
  ThrustsByCategory?: { CategoryId: number; PAPKeys: number[] }[];
  CategoryThrustMap: { CategoryId: number; PAPKey: number }[];
  Origins: TableEnum[];
  Cities: ProjectCityEnum[];
  Provinces: ProjectProvinceEnum[];
  LegislativeDistricts: ProjectLegislativeDistrictEnum[];
  OperatingUnits: ProjectOperatingUnitEnum[];
  ImplementingOffices: ProjectImplementingOfficeEnum[];
  DEOs: RODEOEnum[];
  Regions: ProjectRegionEnum[];
  Agencies: AgencyEnum[];
  ImplementationModes: TableEnum[];
  EmergencyModes: TableEnum[];
  RowAvailables: TableEnum[];
  Feasibilities: TableEnum[];
  DetailedDesigns: TableEnum[];
  RegionWides: TableEnum[];
  Tiers: TableEnum[];
}

export interface ProjectCityEnum {
	Id: number;
	Name: string;
	Code: string;
	Hierarchy?: string;
	ProvinceCode: string;
	NetworkStatusId?: number;
	Deprecated: boolean;
	CreatedDate: string;
	UpdatedDate?: string;
}

export interface ProjectProvinceEnum {
	Id: number;
	Name: string;
	Code: string;
	Hierarchy?: string;
	NetworkStatusId?: number;
	Deprecated: boolean;
	CreatedDate: string;
	UpdatedDate?: string;
	RegionParticipantId: string;
}

export interface ProjectLegislativeDistrictEnum {
	Id: number;
	Name: string;
	Code: string;
	Hierarchy?: string;
	NetworkStatusId?: number;
	Deprecated: boolean;
	CreatedDate: string;
	UpdatedDate?: string;
	ProvinceCode: string;
}

export interface ProjectRegionEnum {
	Id: number;
	ParticipantId: string;
	Code: string;
	Name: string;
	IslandCode: string;
}

export interface ProjectOperatingUnitEnum {
	Name: string;
	ParticipantId: string;
	OrgType: string;
	RegionParticipantId?: string;
	RegionName?: string;
}

export interface ProjectImplementingOfficeEnum {
	Name: string;
	ParticipantId: string;
	OrgType: string;
	RegionParticipantId?: string;
	RegionName?: string;
}

// #region Project Revisions
export interface ProjectStages {
	Id: number;
	ProjectId: string;
	AlternateId: string;
	RevisionNumber: number;
	StageName: string;
	Description: string;
	Category: string;
	CategoryName: string;
	Thrust: string;
	ThrustName: string;
	Origin: string;
	City: string;
	LegislativeDistrict: string;
	OperatingUnit: string;
	ImplementingOffice: string;
	DEO: string;
	Region: string;
	Agency: string;
	RevisionCreatedBy: string;
	RevisionCreatedDate: string;
	UpdatedBy?: string;
}

export interface ProjectRevisionList {
	Stages: ProjectStages[];
	Dropdowns: {
		CategoryEnum: CategoryEnum[];
		ThrustEnum: ThrustEnum[];
	};
}
// #endregion Project Revisions

// #region Component Targets

/** Matches the anonymous shape returned by /Project/ShowProjectTargetComponents.
 * One entry per distinct component the project has carried across all of its stages —
 * the top-level rows of the Component Targets accordion. */
export interface ProjectTargetComponent {
	/** Bare component id, e.g. "CW1" — the accordion's row label. The project-qualified
	 * "{ProjectId}-{ComponentId}" form lives on ProjectStageTarget, where it varies per stage. */
	ComponentId: string;
	ComponentDescription?: string;
	/** How many Program Stages this component appears in. */
	StageCount: number;
}

export interface ProjectStageTargetFilter {
	ComponentId?: string;
	StageName?: string;
}

/** Request contract for /Project/ShowProjectStageTargets — project-scoped, so it carries
 * ProjectId alongside the cursor fields, same shape as ShowProjectsInProgramRequest. */
export interface ShowProjectStageTargetsRequest {
	Filters?: ProjectStageTargetFilter;
	limit: number;
	page: number;
	Navigation: number;
	PreviousFilteredId: number;
	NextFilteredId: number;
	PageCursorId: number;
	ProjectId: string;
}

/** Matches DBHelper.Models.Functions.Project.ProjectStageTargets (dbo.fProjectStageTargets).
 * One row per project component / work item per Program Stage. */
export interface ProjectStageTarget {
	/** Dense ROW_NUMBER — the keyset pagination key, not a work item id. */
	Id: number;
	WorkItemId: number;
	ProjectPK: string;
	ProjectId?: string;
	/** The project's description at this stage — the panel column that replaced Component ID. */
	ProjectDescription?: string;
	StageId: number;
	/** Stage short code, e.g. "NEP-E". Used for filtering; the panel displays StageDisplayName. */
	StageName?: string;
	/** Stage long form from tOptionProgramStage.DisplayName, e.g. "NEP-Errata" — the panel's Stage Name column. */
	StageDisplayName?: string;
	/** Composed stage label, e.g. "NEP 2026 OO-1". Not displayed; kept for other callers. */
	Source?: string;
	/** 'Base' or 'Revision' — row provenance. Not displayed; available for future use. */
	Provenance?: string;
	ComponentId: string;
	/** "{ProjectId}-{ComponentId}", e.g. "P01000001LZ-CW1". */
	ComponentCode?: string;
	ComponentDescription?: string;
	TypeOfWork?: string;
	/** Sum of the work item's work-location physical targets at this stage. */
	Target?: number | null;
	TargetUnit?: string;
}

export interface ProjectStageTargetsPaginationResponse extends PaginationResponse<ProjectStageTarget> {
	PageCursorId?: number | null;
}

// #endregion Component Targets

// #endregion Enums

// #region Import

// ---------------------------------------------------------------------------
// Backend DTO interfaces (camelCase, flat — matches ImportProjectDTO endpoint)
// Prefixed with "Dto" to avoid name collisions with existing app interfaces.
// ---------------------------------------------------------------------------

export interface DtoProgramDetails {
  programId: string;
  stageName: string;
}

export interface DtoProjectDetails {
  projectId: string;
  externalId?: string | null;
  myId?: string | null;
  uacs?: string | null;
  mycaApprovalDate?: string | null;
  description?: string | null;
  province: string;
  city: string;
  legislativeDistrict: string;
  operatingUnit: string;
  implementingOffice: string;
  deo: string;
  region: string;
  category: string;
  thrust: string;
  origin: string;
  agency: string;
  implementationMode: string;
  emergencyMode: string;
  feasibility: string;
  feasibilityDate: string | null;
  detailedDesign: string;
  detailedDesignDate: string | null;
  rowAvailable: string;
  regionWide: string;
  tier: string;
  rank?: number | null;
  
}

export interface DtoFundingProfile {
  projectId: string;
  source: string;
  agreement: string;
  percentage: number;
  amount: number;
}

export interface DtoComponentCost {
  projectId: string;
  costId: string;
  componentType: string;
  componentId: string;
  description: string;
  total: number;
}

export interface DtoComponentCostPerYear {
  componentCostId: string;
  amount: number;
  year: number;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DtoMajorItemOfWork {
  projectId: string;
  referenceId: string;
  componentId: string;
  yearOfWork: number;
  infraType: string;
  workTypeId: string;
  targetUnitId: string;
  targetUnit: string;
}

export interface DtoMajorItemLocation {
  parentId: string;
  infraId: string;
  detailedScope: string;
  targetUnitId: string;
  targetUnit: string;
  physicalTarget: number;
  length: number;
  startChainage?: string | null;
  endChainage?: string | null;
  startX?: string | null;
  startY?: string | null;
  endX?: string | null;
  endY?: string | null;
  startStationLimit?: string | null;
  endStationLimit?: string | null;
}

/** Flat DTO sent to the backend import endpoint. Mirrors ImportProjectDTO on the server. */
export interface ImportProjectDTO {
  programDetails: DtoProgramDetails;
  projectDetails: DtoProjectDetails[];
  fundingProfile: DtoFundingProfile[];
  componentCosts: DtoComponentCost[];
  componentCostPerYear: DtoComponentCostPerYear[];
  majorItemOfWorks: DtoMajorItemOfWork[];
  majorItemLocations: DtoMajorItemLocation[];
}

// ---------------------------------------------------------------------------
// Raw parsed Excel interfaces (used by parseImportFile → transformer input)
// ---------------------------------------------------------------------------

/**
 * Raw row data parsed directly from the Excel import file.
 * String values are used for name-based lookup fields before the server resolves them to IDs.
 */
export interface ImportedProjectDetails {
  ProjectId: string;
  MYId?: string;
  ExternalId?: string;
  UACS?: string;
  TierName?: string;           // raw text e.g. "Tier II"
  Rank?: number;
  CategoryName?: string;       // raw text e.g. "MFO 2: ..."
  ThrustName?: string;         // Sub-Category raw text
  MYCAApprovalDate?: string;
  Province?: string;
  City?: string;
  LegislativeDistrict?: string;
  Region?: string;
  DEO?: string;
  ImplementingOffice?: string;
  OperatingUnit?: string;
  RegionWideName?: string;     // "Yes" / "No" / "Region Wide"
  OriginName?: string;
  AgencyName?: string;
  ImplementationModeName?: string;
  EmergencyModeName?: string;
  RowAvailableName?: string;
  FeasibilityName?: string;
  FeasibilityDate?: string;
  DetailedDesignName?: string;
  DetailedDesignDate?: string;
  Description?: string;
}

export interface ImportedComponentCost {
  ProjectId: string;
  ComponentType: string;
  ComponentId: string;
  Description?: string;
  Total: number;
  StartDate?: string;
  EndDate?: string;
  InfraTypeName?: string;      // raw text for Infrastructure Type
  WorkTypeName?: string;       // raw text for Type of Work
  ActivityYear?: number;
}

export interface ImportedFundingProfile {
  ProjectId: string;
  Source: string;
  Agreement: string;
  Amount: number;
}

export interface ImportedMajorItem {
  ProjectId: string;
  ComponentId: string;
  ReferenceId: string;
  InfraId?: string;
  DetailedScope?: string;
  TargetUnit?: string;
  StartX?: number;
  StartY?: number;
  EndX?: number;
  EndY?: number;
  PhysicalTarget?: number;
  StartStation?: string;
  EndStation?: string;
  StartChainage?: number;
  EndChainage?: number;
  Length?: number;
  ActivityYear?: number;
}

export interface ImportedProject {
  ProjectDetails: ImportedProjectDetails;
  ComponentCosts: ImportedComponentCost[];
  FundingProfiles: ImportedFundingProfile[];
  MajorItemsOfWork: ImportedMajorItem[];
}

export interface ImportParseResult {
  projects: ImportedProject[];
  errors: string[];
  totalRows: {
    details: number;
    components: number;
    funding: number;
    majorItems: number;
  };
}

/**
 * Alias kept for backward compatibility — use ImportProjectDTO for new code.
 * @deprecated Use ImportProjectDTO directly.
 */
export type ImportProjectPayload = ImportProjectDTO;

/** Top-level batch request sent to the API. */
export interface BatchImportPayload {
  ProgramId: string;
  StageName: string;
  Projects: ImportProjectPayload[];
}
// #endregion Import
