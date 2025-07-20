export interface ProjectData {
  Id: string;
  ProgramName: string;
  Category: string;
  TotalProjectCost: number;
  CreatedBy: string;
  CreatedDate: string;
}

export interface ProjectFormPayload {
  projectDetails: ProjectDetails;
  componentCosts: ComponentCost[];
  majorItemsOfWork: MajorItemOfWork[];
  projectNotes: ProjectNote[];
  fundingProfiles: FundingProfile[];
  activities: Activity[];
}

export interface ProjectFilter {
  programName?: string;
  category?: string;
  createdBy?: string;
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
  ProgramName: string;
  ProgramType: string;
  ProgramStage: string;
  UserGroup: string;
  StartYear: number;
  DataSecurity: number;
}

export interface ProjectDetails {
  Id: number;
	ReferenceId: string;
	RevisionNumber: number;
	Name: string;
	Description: string;
	Category: number;
	Thrust: number;
	Origin: number;
	City: number;
	LegislativeDistrict: number;
	OperatingUnit: string;
	ImplementingOffice: string;
	DEO: string;
	Region: string;
	Agency: number;
	ProjectCode?: string;
	ImplementationMode: number;
	EmergencyMode: number;
  Feasibility?: number;
	DetailedDesign?: boolean;
	RowAvailable?: boolean;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}

export interface ComponentCost {
  Id: string;
  Description: string;
  Cost: number;
  MYCAApproval: string;
  UACsPAPCode: string;
  PlannedStartDate: string;
  PlannedEndDate?: string;
}

export interface MajorItemOfWork {
  Id: string;
  ComponentId: string;
  YearOfWork: number;
  TypeOfWork: string;
  TargetUnit: string;
  PhysicalTarget: string;
  DetailedScopeOfWork: string;
  InfraId: string;
}

export interface ProjectNote {
  Id: string;
  Description: string;
  CreatedDate: string;
}

export interface FundingProfile {
  Id: string;
  Source: string;
  Agreement: string;
  Percentage: number;
}

export interface Activity {
  Id: string;
  Description: string;
  Date: string;
}

// #region Enums
export interface ProjectEnums {
  Category: ProjectCategoryEnum[];
  Thurst: ProjectThurstEnum[];
  Origin: ProjectOriginEnum[];
  City: ProjectCityEnum[];
  LD: ProjectLegislativeDistrictEnum[];
  OperatingUnit: ProjectOperatingUnitEnum[];
  IO: ProjectImplementingOfficeEnum[];
  DEO: ProjectDEOEnum[];
  Region: ProjectRegionEnum[];
  Agencies: ProjectAgencyLists[];
  ImplementationModes: ProjectImplementModeEnum[];
  EmergencyModes: ProjectEmergencyModeEnum[];
  Feasibility: ProjectLongFeasibilityEnum[];
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

export interface ProjectDEOEnum {
	Id: number;
	ParticipantId: string;
	OrgName: string;
}

export interface ProjectRegionEnum {
	Id: number;
	DeoCode: string;
	DeoName: string;
	ROCode: string;
	ROName: string;
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