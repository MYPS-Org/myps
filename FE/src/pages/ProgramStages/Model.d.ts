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

export interface ProgramStagePagination extends PaginationParams {
    filters?: ProgramStageFilter;
    sortField?: string;
    sortDirection?: 0 | 1;
}