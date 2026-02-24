import type { ProgramList } from "../Program/Model";

export interface ProjectPagination extends PaginationParams {
  filters?: ProjectFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
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
  Dropdowns: Dropdowns;
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
	Id?: number;
	ProgramId?: string;
	ProgramName: string;
	ProjectId?: string;
	StageName?: string;
	AlternateId?: string;
	ExternalId?: string;
	MYId?: string;
	UACS?: string;
	MYCAApprovalDate?: string | null;
	IslandCode?: string;
	RevisionId?: number;
	Description?: string;
	Category?: number;
	Thrust?: number;
	Origin?: number;
	Province?: string;
	City?: string;
	LegislativeDistrict?: string;
	OperatingUnit?: string;
	ImplementingOffice?: string;
	DEO?: string;
	Region?: string;
	Agency?: number;
	ImplementationMode?: number;
	EmergencyMode?: number;
	Feasibility?: number;
	FeasibilityDate?: string;
	DetailedDesign?: number;
	DetailedDesignDate?: string;
	RowAvailable?: number;
	RegionWide?: number;
	Tier: number;
	Priority?: number;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
	IsAllowedToProceed?: boolean;
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
	// IsPublished: boolean;
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
}

export interface InfraTypeEnum {
	Id: number;
	InfraId: number;
	InfraCode: string;
	InfraName: string;
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
export interface Dropdowns {
	// Categories: CategoryEnum[];
	// Thrusts: ThrustEnum[];
	// Origins: TableEnum[];
	// Cities: ProjectCityEnum[];
	ComponentTypes: ComponentTypeEnum[];
	// LDs: ProjectLegislativeDistrictEnum[];
	// OperatingUnits: ProjectOperatingUnitEnum[];
	// IOs: ProjectImplementingOfficeEnum[];
	// DEOs: RODEOEnum[];
	// Agencies: AgencyEnum[];
	// ImplementationModes: TableEnum[];
	// EmergencyModes: TableEnum[];
	// Feasibility: TableEnum[];
	// Funding Profile
	Agreements: AgreementEnum[];
	Sources: SourceEnum[];
	// Major Item of Works
	ScopeOfWorks: ScopeOfWorkEnum[];
	InfraTypes: InfraTypeEnum[];
	SupportingDocs: DropdownSupportingDocs[];
	Revisions?: RevisionDropdown;
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
}
export interface CategoryEnum {
	Id: number;
	CategoryId?: string;
	CategoryName?: string;
	Minimum: number;
	Maximum: number;
	ValidUntil: number;
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
}
export interface TableEnum {
	Id: number;
	NameId: number;
	Name: string;
	Description?: string;
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
	Code: string;
	AgencyName: string;
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
}
//#endregion

// #region add Project details Enums
export interface ProjectEnums {
  Programs: ProgramList[];
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

