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