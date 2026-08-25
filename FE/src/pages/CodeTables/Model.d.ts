import { ProjectEnums, Dropdowns } from "../Project/Model.d"
import type { CategoryEnum, ThrustEnum, AgencyEnum, TableEnum, InfraTypeEnum, ComponentTypeEnum, ScopeOfWorkEnum, SourceEnum, AgreementEnum } from '../Project/Model.d';

export interface ModificationCategoryReason {
    Id: number;
    Reason: string;
    RevisionGroupId: number;
    ReasonId: number;
    CategoryId: number[];
    IsDeleted: boolean;
    IsActive?: boolean;
}

export interface RevisionFieldPermission {
    ProjectDetails: {
        UACS: boolean,
        MYCAApprovalDate: boolean,
        IslandCode: boolean,
        RevisionNumber: boolean,
        Description: boolean,
        Category: boolean,
        Thrust: boolean,
        Origin: boolean,
        City: boolean,
        Province: boolean,
        LegislativeDistrict: boolean,
        OperatingUnit: boolean,
        ImplementingOffice: boolean,
        DEO: boolean,
        Region: boolean,
        Agency: boolean,
        ImplementationMode: boolean,
        EmergencyMode: boolean,
        Feasibility: boolean,
        FeasibilityDate: boolean,
        DetailedDesign: boolean,
        DetailedDesignDate: boolean,
        RowAvailable: boolean,
        RegionWide: boolean,
        Tier: boolean
    },
    ComponentCosts: {
        ComponentType: boolean,
        ComponentId: boolean,
        Description: boolean,
        Total: boolean
    },
    ComponentCostYear: {
        ParentId: boolean,
        CostYear: boolean,
        Cost: boolean,
        StartDate: boolean,
        EndDate: boolean
    },
    MajorItemOfWorks: {
        ComponentId: boolean,
        YearOfWork: boolean,
        WorkTypeId: boolean,
        InfraType: boolean
    },
    MajorItemLocations: {
        InfraId: boolean,
        DetailedScope: boolean,
        TargetUnitId: boolean,
        TargetUnit: boolean,
        StartX: boolean,
        StartY: boolean,
        EndX: boolean,
        EndY: boolean,
        PhysicalTarget: boolean,
        StartStationLimit: boolean,
        EndStationLimit: boolean,
        From: boolean,
        To: boolean
    },
    FundingProfile: {
        Source: boolean,
        Agreement: boolean,
        Amount: boolean,
        Percentage: boolean
    }
}

export interface RevisionRules {
    Id: number;
    Reason: string;
    RevisionGroupId: number;
    ReasonId: number;
    PCMA_Status: string;
    Package_Status: string;
    Field: string;
}

export interface CodeTableData {
    CodeTable: CodeTable[];
    ProgramStages: ProgramEnums[];
    ProgramStatuses: ProgramEnums[];
    ProgramTypes: ProgramEnums[];
    ProjectCategories: CategoryEnum[];
    ProjectThrusts: ThrustEnum[];
    ProjectAgencies: AgencyEnum[];
    ProjectOrigins: TableEnum[];
    FundingAgreements: AgreementEnum[];
    FundingSources: SourceEnum[];
    ScopeOfWorks: ScopeOfWorkEnum[];
    InfraTypes: InfraTypeEnum[];
    ProjectComponents: ComponentTypeEnum[];
    RevisionCategories: unknown[];
    RevisionDocuments: unknown[];
    RevisionHeaders: unknown[];
    Reasons: unknown[];
    RevisionStatuses: unknown[];
    RevisionRules: RevisionRules[];
}

export interface CodeTable {
    Id: number;
    Name: string;
    Code: string;
}

export interface ProgramEnums {
    Id: number;
    NameId: number;
    Name: string;
    Description: string;
    IsActive?: boolean;
}

export interface AdminAreaRegion {
    Id: number;
    Name: string;
    ParticipantId: string;
    Code: string;
    IslandCode: string;
    Deprecated?: boolean;
}

export interface AdminAreaProvince {
    Id: number;
    Name: string;
    Code: string;
    RegionParticipantId: string;
    Deprecated?: boolean;
}

export interface AdminAreaCity {
    Id: number;
    Name: string;
    Code: string;
    ProvinceCode: string;
    Deprecated?: boolean;
}

export interface AdminAreaDistrict {
    Id: number;
    Name: string;
    Code: string;
    ProvinceCode: string;
    Deprecated?: boolean;
}

export interface AdminAreaDEO {
    Id: number;
    Name: string;
    ParticipantId: string;
    OfficeType: string;
    ProvinceCode?: string;
    RegionParticipantId?: string;
    RegionCode?: string;
    RegionName?: string;
    ParentParticipantId?: string;
    ParentName?: string;
}

export interface AdminAreaData {
    Regions: AdminAreaRegion[];
    Provinces: AdminAreaProvince[];
    Cities: AdminAreaCity[];
    Districts: AdminAreaDistrict[];
    DEOs: AdminAreaDEO[];
}