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
  Dropdowns: {
      ComponentTypes: ComponentType[];
  };
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
  Dropdowns:
  {
      //Project Details
      Categories: Category,
      Thrusts: Thrust,
      Origins: Origin,
      Cities: City,
      LDs: LD,
      OperatingUnits: OperatingUnit,
      IOs: IO,
      DEOs: DEO,
      Feasibility: Feasib,
      Agencies: Agency,
      ImplementationModes: ImplementationMode,
      EmergencyModes: EmergencyMode,

      //Component Cost
      ComponentTypes: ComponentType,

      //Funding Profile
      Agreements: Agreement,
      Sources: Source,
  }
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
export interface ComponentType {
	Id: number;
	Name: string;
	Description: string;
}

export interface Category {
	Id: number;
	Name: string;
	Description: string;
}

export interface Thrust {
	Id: number;
	Name: string;
	Description: string;
}

export interface Origin {
	Id: number;
	Name: string;
	Description: string;
}

export interface City {
	Id: number;
	Name: string;
	Description: string;
}

export interface LD {
	Id: number;
	Name: string;
	Description: string;
}

export interface OperatingUnit {
	Id: number;
	Name: string;
	Description: string;
}

export interface IO {
	Id: number;
	Name: string;
	Description: string;
}

export interface DEO {
	Id: number;
	Name: string;
	Description: string;
}

export interface Feasib {
	Id: number;
	Name: string;
	Description: string;
}

export interface Agency {
	Id: number;
	Name: string;
	Description: string;
}

export interface ImplementationMode {
	Id: number;
	Name: string;
	Description: string;
}

export interface EmergencyMode {
	Id: number;
	Name: string;
	Description: string;
}

export interface Agreement {
	Id: number;
	Name: string;
	Description: string;
}

export interface Source {
	Id: number;
	Name: string;
	Description: string;
}

export interface Notes {
	Id: number;
	Description: string;
	CreatedDate: string;
}

export interface Funding {
	Id: number;
	Source: string;
	Agreement: string;
	Percentage: number;
}

//#endregion

// #region Enums
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
