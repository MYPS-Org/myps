export interface ProgramStage {
    Id: number;
    ProgramId: string;
    StageName: string;
    StartDate: string;
    EndDate: string;
    CreatedBy: string;
    CreatedDate: string;
    UpdatedBy: string;
    UpdatedDate: string;
}

export interface ProjectList {
    Id: number;
    ProgramId: string;
}