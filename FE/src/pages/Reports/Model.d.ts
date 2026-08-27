export type ReportFamily = 'rbp' | 'aip' | 'extract-pcmiow';

export interface ReportTypeOption {
    Id: string;
    Label: string;
    OutputFormat: string;
    Family: ReportFamily;
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

export interface CategoryOption {
    Id: number;
    Name: string;
}

export interface DeoOption {
    Id: string;
    Name: string;
    RegionParticipantId?: string | null;
}

export interface ImplementingOfficeOption {
    Id: string;
    Name: string;
    RegionParticipantId?: string | null;
}

export interface ReportOptions {
    ReportTypes: ReportTypeOption[];
    ProgramYears: number[];
    ProgramStages: ProgramStageOption[];
    RegionalOffices: RegionalOfficeOption[];
    Categories: CategoryOption[];
}

export interface FilterProgramsQuery {
    YearStart: number;
    ProgramStage: string;
}

export interface FilterProgramItem {
    Id: string;
    Name: string;
}

export interface GenerateRbpRequest {
    YearStart?: number;
    ProgramIds?: string[];
    RegionCode?: string;
    PlanningEngineer?: string;
    ApprovedBy?: string;
    ReviewedBy?: string;
}

export interface GenerateAipRequest {
    YearStart?: number;
    ProgramIds?: string[];
    RegionCode?: string;
    ReportType?: string;
    ReportTypeTitle?: string;
}

export interface GenerateExtractRequest {
    ProgramIds?: string[];
    CategoryId?: number;
    RegionCode?: string;
    DeoCode?: string;
    IoCode?: string;
    ProgramLabel?: string;
    CategoryLabel?: string;
    RegionLabel?: string;
    DeoLabel?: string;
    IoLabel?: string;
}

export type GenerateReportRequest = GenerateRbpRequest | GenerateAipRequest | GenerateExtractRequest;

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
