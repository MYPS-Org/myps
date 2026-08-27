export interface ReportTypeOption {
    Id: string;
    Label: string;
    OutputFormat: string;
}

export interface ProgramStageOption {
    Id: number;
    NameId: number;
    Name: string;
    DisplayName?: string;
}

export interface RegionalOfficeOption {
    Id: string;
    Name: string;
    Code: string;
}

export interface ReportOptions {
    ReportTypes: ReportTypeOption[];
    ProgramYears: number[];
    ProgramStages: ProgramStageOption[];
    RegionalOffices: RegionalOfficeOption[];
}

export interface FilterProgramsQuery {
    YearStart: number;
    ProgramStage: string;
}

export interface FilterProgramItem {
    Id: string;
    Name: string;
}

export interface GenerateReportRequest {
    YearStart?: number;
    ProgramIds?: string[];
    RegionCode?: string;
    PlanningEngineer?: string;
    ApprovedBy?: string;
    ReviewedBy?: string;
}

export interface GenerateReportResponse {
    JobId: string;
    HangfireJobId: string;
    Message: string;
    Title: string;
}

export type ReportJobStatus = 'Queued' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled';

export interface ReportStatusEvent {
    JobId: string;
    Status: ReportJobStatus;
    Message: string;
    DownloadUrl?: string | null;
}
