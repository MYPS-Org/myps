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

export type ReportFamily = 'rbp' | 'aip' | 'extract-pcmiow' | 'rbp-summary';

// Matches WebAPI.Controllers.CrystalReport.GenerateRbpRequestDTO
export interface GenerateRbpRequest {
    YearStart?: number;
    ProgramIds?: string[];
    RegionCode?: string;
    PlanningEngineer?: string;
    ApprovedBy?: string;
    ReviewedBy?: string;
}

// Matches WebAPI.Controllers.CrystalReport.GenerateAipRequestDTO
export interface GenerateAipRequest {
    YearStart?: number;
    ProgramIds?: string[];
    RegionCode?: string;
    ReportType?: string;
    ReportTypeTitle?: string;
}

// Matches WebAPI.Controllers.CrystalReport.GenerateRbpSummaryRequestDTO -- note the
// singular ProgramId (not ProgramIds) and PlanningEngr (not PlanningEngineer), both
// genuinely different field names from GenerateRbpRequest, not just casing.
export interface GenerateRbpSummaryRequest {
    YearStart?: number;
    ProgramId?: string;
    RegionCode?: string;
    PlanningEngr?: string;
    ReviewedBy?: string;
    ApprovedBy?: string;
}

// Matches WebAPI.Controllers.CrystalReport.GenerateExtractPcmiowRequestDTO --
// also used as the request shape for the 'extract-pc' report key, since the
// backend's ReportRequestMapper.MapExtract deserializes both report families
// into this same DTO.
export interface GenerateExtractPcmiowRequest {
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

export type GenerateReportRequest =
    | GenerateRbpRequest
    | GenerateAipRequest
    | GenerateRbpSummaryRequest
    | GenerateExtractPcmiowRequest;

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
