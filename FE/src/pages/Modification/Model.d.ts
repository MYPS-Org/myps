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
}

// #additional region for pcma status
export interface ProjectComponentStatus {
    ProjectStatus: PackageStatus;
    Rules: Rules
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
    Id: number,
    Reason: string,
    RevisionGroupId: number,
    ReasonId: number,
    PCMA_Status: string,
    Package_Status: string,
    Field: string,
}

export interface PackageStatus {
    ConstructionStatus: string;
    PackageStatus: string;
}