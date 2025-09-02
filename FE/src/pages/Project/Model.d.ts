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
  ProgramDetails: ProgramList;
  ProjectDetails: ProjectDetails;
  ComponentCosts: ComponentCost[];
  ComponentCostPerYear: ComponentCostYear[];
  MajorItemOfWorks: MajorItemOfWork[];
  MajorItemLocations: MajorItemLocations[];
  ProjectNotes: ProjectNote[];
  FundingProfile: FundingProfile[];
  Dropdowns: Dropdowns;
  Activities: Activity[];
  TransactionLogs: TransactionLog[];
}

export interface AddProject {
  ProjectName: string;
  ProgramName: string;
  Category: string;
  TotalProjectCost: number;
  DataSecurity: string;
  CreatedBy: string;
  CreatedDate: string;
}

export interface ProgramDetails {
	Id: number;
  	ProgramId: string;
	RevisionNumber: number;
	Name: string;
	StageId: number;
	StageName: string;
	UserGroup: number;
	RegionCode: string;
	Status: number;
	Type: number;
	Cost?: number;
	YearStart: number;
	YearEnd: number;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ProjectDetails {
	Id?: number;
	ProgramId?: string;
	ProgramName: string;
	ProjectId?: string;
	AlternateId?: string;
	ExternalId?: string;
	MYId?: string;
	UACS?: number;
	MYCAApprovalDate?: string;
	IslandCode?: string;
	RevisionNumber?: number;
	Description?: string;
	Category?: number;
	Thrust?: number;
	Origin?: number;
	Province?: number;
	City?: number;
	LegislativeDistrict?: number;
	OperatingUnit?: string;
	ImplementingOffice?: string;
	DEO?: string;
	Region?: string;
	Agency?: number;
	ImplementationMode?: number;
	EmergencyMode?: boolean;
	Feasibility?: number;
	FeasibilityDate?: string;
	DetailedDesign?: boolean;
	DetailedDesignDate?: string;
	RowAvailable?: boolean;
	RegionWide?: number;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
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
	IsPublished: boolean;
}

export interface Activity {
  Id: string;
  Description: string;
  Date: string;
}

export interface TransactionLog {
  Id: number;
  TransactionId: string;
  TypeOfTransaction: string;
  AffectedTable: string;
  AffectedColumn: string;
  OldValue: string;
  NewValue: string;
  CreatedBy: string;
  CreatedDate: string;
}

export interface ProjectById {
  ProgramDetails: ProgramDetails,
  ProjectDetails: ProjectDetails,
  ComponentCosts: ProjectComponentCost[],
  ComponentCostPerYear: ProjectComponentCostYear[],
  MajorItemOfWorks: ProjectMajorItemOfWorks[],
  ProjectNotes: Notes,
  FundingProfile: Funding,
  Dropdowns: Dropdowns
}

export interface ScopeOfWorkEnum {
	Id: number;
	Enum: number;
	InfraType: string;
	WorkCategory: string;
	Description: string;
	Measure: number;
	MaxAmount: number;
	MinAmount: number;
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
	RoadSections: RoadSections[];
	Bridges: Bridge[];
	FCS: FCS[];
	OtherInfra: OtherInfra[];
}

// #region Notes
export interface AddNotes {
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

export interface ComponentCostFormType
 {
	ComponentCost: ComponentCost[];
	ComponentCostYear: ComponentCostYear[];
}

// #region fetch data interfaces
export interface ComponentCost {
	Id: number;
	ProjectId: string;
	ReferenceId: string;
	ComponentType: string;
	ComponentId: string;
	Description: string;
	Total: number;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

// Combined interface for UI (ComponentCost with its related ComponentCostYear)
export interface ComponentCostWithYears extends ComponentCost {
	CostPerYear?: ComponentCostYear[];
}

export interface ComponentCostYear {
	Id: number;
	ParentId: string;
	CostYear: number;
	Cost: number;
	StartDate?: string;
	EndDate?: string;
}
export interface MajorItemOfWorksWithDropdown extends MajorItemOfWork {
	DropdownData: ScopeOfWorkEnum[];
	MajorItemLocations: MajorItemLocations[]; // Keep for UI functionality
}
export interface MajorItemOfWork {
	Id: number;
	ProjectId: string;
	ComponentId: string;
	ReferenceId: string;
	YearOfWork: number;
	WorkTypeId: number;
	InfraType: string;
	TargetUnitId: number;
	TargetUnit: string;
	CreatedBy: string;
}
export interface MajorItemLocations {
	Id: number;
	ParentId: string;
	InfraId: string;
	DetailedScope: string;
	TargetUnitId: number;
	TargetUnit: string; // Changed from number to string to match the UI usage
	PhysicalTarget: string;
	StartX: string;
	StartY: string;
	EndX: string;
	EndY: string;
	StartStationLimit: string;
	EndStationLimit: string;
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
export interface FundingProfile {
	Id: number;
	ProjectId: string;
	Source: string;
	Agreement: number;
	Percentage: number;
	Amount: number;
	CreatedBy: string;
	CreatedDate: string;
}

// #region Additional interfaces for dropdowns and enums
export interface Dropdowns {
	Categories: CategoryEnum[];
	Thrusts: ThrustEnum[];
	Origins: OriginEnum[];
	Cities: CityEnum[];
	ComponentTypes: ComponentTypeEnum[];
	LDs: LDEnum[];
	OperatingUnits: OperatingUnitEnum[];
	IOs: IOEnum[];
	DEOs: RODEOEnum[];
	Agencies: AgencyEnum[];
	ImplementationModes: ImplementationModeEnum[];
	EmergencyModes: EmergencyModeEnum[];
	Feasibility: FeasibEnum[];
	// Funding Profile
	Agreements: AgreementEnum[];
	Sources: SourceEnum[];
	// Major Item of Works
	ScopeOfWorks: ScopeOfWorkEnum[];
}
export interface ComponentTypeEnum {
	Description: string;
	Enum: number;
	ExportToPCMA: string;
	Id: number;
	Name: string;
}
export interface CategoryEnum {
	Id: number;
	Enum: number;
	Name: string;
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
export interface OriginEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}
export interface CityEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}
export interface LDEnum {
	Id: number;
	Enum: number;
	Name: string;
}
export interface OperatingUnitEnum {
	Id: number;
	ParticipantId: string;
	OrgName: string;
	OrgType: string;
}
export interface IOEnum {
	Id: number;
	ParticipantId: string;
	OrgName: string;
	OrgType: string;
}
export interface RODEOEnum {
	Id: number;
	DeoCode: string;
	DeoName: string;
	ROCode: string;
	ROName: string;
	Island?: string;
}
export interface FeasibEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}
export interface AgencyEnum {
	Id: number;
	Code: string;
	AgencyName: string;
}
export interface ImplementationModeEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
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
  Thrusts: ProjectThurstEnum[];
  Origins: ProjectOriginEnum[];
  Cities: ProjectCityEnum[];
  Provinces: ProjectProvinceEnum[];
  LDs: ProjectLegislativeDistrictEnum[];
  OperatingUnits: ProjectOperatingUnitEnum[];
  IOs: ProjectImplementingOfficeEnum[];
  DEOs: ProjectRODEOEnum[];
  Agencies: ProjectAgencyLists[];
  ImplementationModes: ProjectImplementModeEnum[];
  EmergencyModes: ProjectEmergencyModeEnum[];
  Feasibility: ProjectLongFeasibilityEnum[];
  RegionWide: ProjectCategoryEnum[];
}

export interface ProjectCategoryEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}

export interface ProjectThurstEnum {
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

export interface ProjectOriginEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}

export interface ProjectCityEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}

export interface ProjectProvinceEnum {
	Id: number;
	ProvinceName: string;
}

export interface ProjectLegislativeDistrictEnum {
	Id: number;
	Enum: number;
	Name: string;
}

export interface ProjectOperatingUnitEnum {
	Id: number;
	ParticipantId: string;
	OrgName: string;
	OrgType: string;
}

export interface ProjectImplementingOfficeEnum {
	Id: number;
	ParticipantId: string;
	OrgName: string;
	OrgType: string;
}

export interface ProjectRODEOEnum {
	Id: number;
	DeoCode: string;
	DeoName: string;
	ROCode: string;
	ROName: string;
	Island?: string;
}

export interface ProjectAgencyLists {
	Id: number;
	Code: string;
	AgencyName: string;
}

export interface ProjectImplementModeEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}

export interface ProjectEmergencyModeEnum {
	Id: number;
	Enum: boolean;
	Name: string;
	Description: string;
}

export interface ProjectLongFeasibilityEnum {
	Id: number;
	Enum: number;
	Name: string;
	Description: string;
}
// #endregion Enums
