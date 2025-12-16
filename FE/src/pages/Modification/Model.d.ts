import type { ProjectFormPayload } from "../Project/Model";

export interface ModificationList {
    Id: number;
    ProjectId: number;
    ProjectName: string;
    ModificationType?: string;
    Status: string;
    DateModified: string;
    ModifiedBy: string;
}

export interface ModificationCategory {
    Id: number;
    CodeGroup: number;
    CodeDescription: string;
    SequenceNo?: number;
    ObsoleteFlag?: boolean;
}

export interface ModificationReason {
    Id: number;
    CodeGroup: number;
    CodeDescription: string;
    SequenceNo?: number;
    ObsoleteFlag?: boolean;
}

export interface ModificationModel {
    Id: number;
    ProjectId: number;
    ProjectName: string;
    ModificationType: number;
    Reason: number;
    ProjectDescription: string;
    OperatingUnit: number;
}

export interface RevisionProjectPayload extends ProjectFormPayload{
    ModificationCategory?: string; // Category from database if modification is submitted
    ModificationReason?: string; // Reason from database if modification is submitted
    ModificationReasonId?: number; // ReasonId from database if modification is submitted
    ComponentsStatus: ProjectComponentStatus[];
    ProjectStatus: PackageStatus; // Overall project status from API
    Rules: Rules; // Rules for field validation
}

// #additional region for pcma status
export interface ProjectComponentStatus {
	ProgramName: string;
	ProjectId: string;
	ProjectComponentId: string;
	ComponentId?: string;
	ConstructionStatusCode?: number;
	ConstructionStatusName: string;
	PackedStatusCode: boolean;
	PackedStatusName: string;
}

export interface Rules {
    Id: number;
    Reason: string;
    RevisionGroupId: number;
    ReasonId: number;
    PCMA_Status?: string;
    Package_Status?: string;
    Field: string; // JSON string containing field rules
}

// Parsed structure from Rules.Field JSON
export interface FieldRules {
    ProjectDetailsRules?: Record<string, boolean>;
    ComponentCostRules?: Record<string, boolean>;
    ComponentCostYearRules?: Record<string, boolean>;
    MajorItemOfWorkRules?: Record<string, boolean>;
    MajorItemLocationRules?: Record<string, boolean>;
    FundingProfileRules?: Record<string, boolean>;
}

export interface PackageStatus {
    ConstructionStatus: string;
    PackageStatus: string;
}