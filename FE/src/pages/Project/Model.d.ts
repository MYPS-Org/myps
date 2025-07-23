export interface ProjectPagination extends PaginationParams {
  filters?: ProjectFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface ProjectFilter {
  ProgramId?: string;
  ReferenceId?: string;
}

export interface ProjectFormPayload {
  ProgramDetails: ProgramDetails;
  ProjectDetails: ProjectDetails;
  ComponentCosts: ComponentCost[];
  ComponentCostPerYear: ComponentCostYear[];
  MajorItemOfWorks: MajorItemOfWork[];
  ProjectNotes: ProjectNote[];
  FundingProfile: FundingProfile[];
  Dropdowns: Dropdowns;
  Activities: Activity[];
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
	ProgramName?: string;
	ReferenceId?: string;
	RevisionNumber?: number;
	Description?: string;
	Category?: number;
	Thrust?: number;
	Origin?: number;
	City?: number;
	LegislativeDistrict?: number;
	OperatingUnit?: string;
	ImplementingOffice?: string;
	DEO?: string;
	Region?: string;
	Agency?: number;
	ProjectCode?: string;
	ImplementationMode?: number;
	EmergencyMode: boolean;
	Feasibility?: number;
	DetailedDesign?: boolean;
	RowAvailable?: boolean;
	CreatedBy?: string;
	CreatedDate?: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}
export interface ProjectLists {
	Id: number;
	ProgramId: string;
	ProgramName: string;
	ReferenceId: string;
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
	ComponentType: string;
	ComponentId: string;
	Description: string;
	Total: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy: string;
	UpdatedDate: string;
}

// Combined interface for UI (ComponentCost with its related ComponentCostYear)
export interface ComponentCostWithYears extends ComponentCost {
	CostPerYear?: ComponentCostYear[];
}

export interface ComponentCostYear {
	Id: number;
	ParentId: number;
	CostYear: number;
	Cost: number;
	ApprovalDate?: string;
	PAPCode: string;
	StartDate: string;
	EndDate: string;
}
export interface MajorItemOfWork {
	Id: number;
	ProjectId: string;
	ComponentId: number;
	YearOfWork: number;
	TypeOfWork: number;
	PhysicalTarget: number;
	Description: string;
	InfraId: string;
	StartStationLimit: number;
	EndStationLimi: number;
	StartFrom: number;
	EndFrom: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy: string;
	UpdatedDate: string;
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
	Source: number;
	Agreement: number;
	Percentage: number;
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
	AgreementId: number;
	SourceId: number;
	Code: string;
	Name: string;
	FinancingSource?: string;
}
export interface SourceEnum {
	Id: number;
	SourceId: number;
	Org: string;
	Name: string;
	Nature?: string;
}
//#endregion

// #region add Project details Enums
export interface ProjectEnums {
  Programs: ProgramDetails[];
  Categories: ProjectCategoryEnum[];
  Thrusts: ProjectThurstEnum[];
  Origins: ProjectOriginEnum[];
  Cities: ProjectCityEnum[];
  LDs: ProjectLegislativeDistrictEnum[];
  OperatingUnits: ProjectOperatingUnitEnum[];
  IOs: ProjectImplementingOfficeEnum[];
  DEOs: ProjectRODEOEnum[];
  Agencies: ProjectAgencyLists[];
  ImplementationModes: ProjectImplementModeEnum[];
  EmergencyModes: ProjectEmergencyModeEnum[];
  Feasibility: ProjectLongFeasibilityEnum[];
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
