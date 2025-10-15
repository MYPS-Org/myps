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
    Sequence: number;
    Obsolete?: boolean;
}

export interface ModificationReason {
    Id: number;
    CodeGroup: number;
    CodeDescription: string;
    Sequence: number;
    Obsolete?: boolean;
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