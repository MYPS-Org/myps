import type { ProgramList } from "../Program/Model";

export interface ProjectFilter {
  ProgramId?: string;
  ProjectId?: string;
}

export interface ProjectFormPayload {
  IsModify?: boolean;
  IsActive: boolean;
  IsUnlock?: boolean;
  ProgramDetails: ProgramList;
  ProjectDetails: ProjectDetails;
  ComponentCosts: ComponentCost[];
  ComponentCostPerYear: ComponentCostPerYear[];
  MajorItemOfWorks: MajorItemOfWork[];
  MajorItemLocations: MajorItemLocations[];
  ProjectNotes: ProjectNote[];
  Docs: Docs[];
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
	ProjectPK: string;
	ProjectId: string;
	ProjectType: string;
	// Legacy fields kept from the pre-migration model — not in the new aligned shape.
	// TODO: clarify with backend whether these are still needed before removing.
	ProgramId?: string; // drives program-linking in ProjectForm.handleProgramDetailsChange and projectDetailsRules
	ReferenceId?: string; // drives fetchProjectGeoJSON (map) and ComponentCostDialog's ReferenceId prop
	ExternalId?: string; // editable "External ID" field in ProjectDetailsForm
	MYId?: string; // editable "Multi Year ID" field in ProjectDetailsForm
	UACS?: string; // editable "OA Project Code (UACS)" field in ProjectDetailsForm
	RevisionId?: number; // relationship to new RevisionCreatedBy/RevisionCreatedDate unclear
	CreatedBy?: string; // editable "Created By" admin field in ProjectDetailsForm
	UpdatedBy?: string; // relationship to new LastUpdatedBy unclear — no UI currently reads/writes either
	UpdatedDate?: string; // relationship to new LastUpdatedDate unclear — no UI currently reads/writes either
	IsAllowedToProceed?: boolean;
	ProgramName?: string;
	StageName: string; 
	AlternateId?: string;
	Description: string;
	Region: string;
	Province?: string;
	City?: string;
	LegislativeDistrict?: string;
	DEO: string;
	OperatingUnit: string;
	ImplementingOffice: string;
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
	MYCAApprovalDate?: string | null;
	CreatedDate: string;
	LastUpdatedBy?: string;
	LastUpdatedDate?: string;
	RevisionCreatedBy: string;
	RevisionCreatedDate: string;
	Source: string;
}
export interface ProjectLists {
	Id: number;
	ProgramId: string;
	ProgramName: string;
	ProjectId: string;
	RevisionNumber: number;
	Description: string;
	Category?: string;
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
	UpdateBy?: string;
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
  TypeOfTransaction: string;
  AffectedTable: string;
  AffectedColumn: string;
  OldValue: string;
  NewValue: string;
  CreatedBy: string;
  CreatedDate: string;
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

// #region ComponentCost
export interface ComponentCost {
	Id: number;
	ProjectId: string;
	CostId: string;
	ComponentType: string;
	ComponentId: string;
	Description?: string;
	Total: number;
	StageName?: string;
	IsDeleted: boolean;
	RevisedNumber?: number;
	ConstructionStatusCode?: number;
	ConstructionStatusName?: string;
	PackedStatusCode?: boolean;
	PackedStatusName?: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ComponentCostPerYear {
	Id: number;
	ComponentCostId: string;
	StageName?: string;
	Amount?: number;
	Year?: number;
	StartDate?: string | null;
	EndDate?: string | null;
	CreatedBy: string;
	CreatedDate: string;
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
	ProjectId: string;
	ReferenceId: string;
	StageName?: string;
	ComponentId: string;
	YearOfWork: number;
	WorkTypeId: number;
	InfraType: string;
	TargetUnitId: number;
	TargetUnit: string;
	CreatedBy: string;
	IsDeleted: boolean;
}
export interface MajorItemLocations {
	Id: number;
	ParentId: string;
	StageName: string;
	InfraId: string;
	DetailedScope: string;
	TargetUnitId: number;
	TargetUnit: string; // Changed from number to string to match the UI usage
	PhysicalTarget?: number | null;
	Length?: number | null;
	EndChainage: number;
	StartChainage: number;
	StartX: number;
	StartY: number;
	EndX: number | null;
	EndY: number | null;
	StartStationLimit: string;
	EndStationLimit: string;
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
	ProjectId: string;
	FileName: string;
	FileExtension: string;
	FilePath: string;
	Description: string;
	CreatedBy: string;
	CreatedDate?: string;
	IsDeleted?: boolean;
}
export interface FundingProfile {
	Id: number;
	ProjectId: string;
	StageName?: string;
	Source: string;
	Agreement: string;
	Percentage: number;
	Amount: number;
	CreatedBy: string;
	CreatedDate: string;
	IsDeleted: boolean;
}

// #region Additional interfaces for dropdowns and enums
// Shape of the /Project/ShowProjectComponentDropdowns response — dropdown data
// for everything on ProjectForm.tsx that ShowProjectDropdowns does not cover.
export interface Dropdowns {
	// Program Details
	Programs: ProgramList[];
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
	Programs?: ProgramList[];
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
	GdbId?: string;
	Name: string;
	ParticipantId: string;
	ProvinceGdbId?: string;
	ProvinceName?: string;
	RegionParticipantId: string;
	RegionName: string;
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
  Origins: TableEnum[];
  Cities: ProjectCityEnum[];
  Provinces: ProjectProvinceEnum[];
  LDs: ProjectLegislativeDistrictEnum[];
  OperatingUnits: ProjectOperatingUnitEnum[];
  IOs: ProjectImplementingOfficeEnum[];
  DEOs: RODEOEnum[];
  Agencies: AgencyEnum[];
  ImplementationModes: TableEnum[];
  EmergencyModes: TableEnum[];
  RowsAvailable: TableEnum[];
  Feasibility: TableEnum[];
  DetailedDesign: TableEnum[];
  RegionWide: TableEnum[];
}

export interface ProjectCityEnum {
	Id: number;
	GdbId: string;
	Name: string;
	Code: string;
	ProvinceGdbId: string;
	ProvinceName: string;
}

export interface ProjectProvinceEnum {
	Id: number;
	GdbId: string;
	Name: string;
	Code: string;
	RegionId: string;
	RegionName: string;
}

export interface ProjectLegislativeDistrictEnum {
	Id: number;
	GdbId: string;
	Name: string;
	Code: string;
	ProvinceGdbId: string;
	ProvinceName: string;
}

export interface ProjectOperatingUnitEnum {
	Id: number;
	ParticipantId: string;
	Name?: string;
	OrgType?: string;
	ProvinceName?: string;
	RegionName?: string;
	CongressionalDistrictName?: string;
	IslandCode?: string;
	RegionParticipantId: string;
}

export interface ProjectImplementingOfficeEnum {
	Id: number;
	ParticipantId: string;
	Name?: string;
	OrgType?: string;
	ProvinceName?: string;
	RegionName?: string;
	CongressionalDistrictName?: string;
	IslandCode?: string;
	RegionParticipantId: string;
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
	Thrust: string;
	Origin: string;
	City: string;
	LegislativeDistrict: string;
	OperatingUnit: string;
	ImplementingOffice: string;
	DEO: string;
	Region: string;
	Agency: string;
	CreatedBy: string;
	CreatedDate: string;
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
