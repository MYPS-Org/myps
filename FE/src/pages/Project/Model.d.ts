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
  Id: string;
  ProjectName: string;
  CityMunicipality: string;
  ReportingRegion: string;
  Description: string;
  LegislativeDistrict: string;
  OriginatingRegion: string;
  OperatingUnit: string;
  AlternativeProjCode: string;
  Category: string;
  ImplementingOffice: string;
  ImplementationCode: string;
  Thrust: string;
  DistrictEngOffice: string;
  EmergencyCode: string;
  Origin: string;
  CreatedBy: string;
  CreatedDate: string;
  FeasibilityStudy: boolean;
  DetailedDesign: boolean;
  RowAvailable: boolean;
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
