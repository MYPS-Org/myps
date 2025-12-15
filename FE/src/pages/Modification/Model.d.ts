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
	ProgramName: string;
	ProjectId: string;
	ProjectComponentId: string;
	ComponentId?: string;
	ConstructionStatusCode?: number;
	ConstructionStatusName: string;
	PackedStatusCode: boolean;
	PackedStatusName: string;
}