import type { OptionRevisionCategory, OptionRevisionHeader, OptionRevisionReasons, ProjectFormPayload } from "../Project/Model";

// Matches DBHelper.Models.Enums.EnumRevisionStatus (BE serializes enums as ints).
// Plain const object (not `enum`) — this project's tsconfig sets erasableSyntaxOnly,
// which disallows real TS enums since they emit non-erasable runtime code.
export const EnumRevisionStatus = {
    Pending: 0,
    Approved: 1,
    Rejected: 2,
    ForCorrection: 3,
} as const;
export type EnumRevisionStatus = typeof EnumRevisionStatus[keyof typeof EnumRevisionStatus];

// Backend type: FileUpload (DBHelper\Models\Extra\FileUpload.cs)
export interface FileUpload {
    Name: string;
    Extension: string;
    ContentType: string;
    DataUrl: string;
}

export interface ApiMessageResult {
    Title: string;
    Message: string;
}

export interface ApiTransactionResult extends ApiMessageResult {
    TransactionId: string;
}

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
    Header: OptionRevisionHeader;
    Category: OptionRevisionCategory;
    Reason: OptionRevisionReasons;
    ProjectStatus: PackageStatus; // Overall project status from API
    Rules: Rules; // Rules for field validation
    ComponentsStatus: ProjectComponentStatus[];
    RevisionDetails?: RevisionDetails;
    ForCorrectionsDetails?: ForCorrectionsDetails[];
    RevisionDocs?: RevisionDoc[];
}

export interface ForCorrectionsDetails {
    Id?: number;
	TransactionId?: string;
	CorrectionReason?: string;
	ForCorrectionDate?: string;
	IsCentralOffice?: boolean;
}

export interface RevisionDoc {
    Id: number;
	TransactionId: string;
	DocumentName: string;
	DocumentPath: string;
	IsApprovedDocument: boolean;
}

// #additional region for pcma status
export interface ProjectComponentStatus {
	ProgramName: string;
	ProjectId: string;
	ProjectComponentId: string;
	ComponentId?: string;
	ConstructionStatusCode?: number;
	ConstructionStatusName?: string;
	PackedStatusCode: boolean;
	PackedStatusName: string;
}

export interface RevisionDetails {
    Id: number;
	TransactionId: string;
	RevisionGroupId: number;
	CategoryId?: number;
	ReasonId: number;
	IODocApprovalDate?: string;
	RegionStatus: number;
	RegionDescription?: string;
	RegionApprover?: string;
	RegionApprovedDate?: string;
	RegionLastUpdatedDate?: string;
	COStatus: number;
	CODocApprovalDate?: string;
	CODescription?: string;
	COApprover?: string;
	COApprovedDate?: string;
	COLastUpdatedDate?: string;
	CreatedBy?: string;
	CreatedDate?: string;
    ConstructionStatus?: string;
    PackageStatus?: string;
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
export interface CRUDRules {
    Message?: string;
    CanAdd: boolean;
    CanDelete: boolean;
}

export interface FieldRuleSection {
    Fields: Record<string, boolean>;
    CRUD: CRUDRules;
}

export interface FieldRules {
    ProjectDetailsRules?: Record<string, boolean>;
    ComponentCostRules?: FieldRuleSection;
    ComponentCostYearRules?: FieldRuleSection;
    MajorItemOfWorkRules?: FieldRuleSection;
    MajorItemLocationRules?: FieldRuleSection;
    FundingProfileRules?: FieldRuleSection;
}

export interface PackageStatus {
    ConstructionStatus: string;
    PackageStatus: string;
    RevisionStatus: string;
}

export interface RevisionLists {
    Id: number;
	TransactionId: string;
	RevisionName: string;
	RevisionGroupId: number;
	CategoryName?: string;
	CategoryId?: number;
	Reason: string;
	ReasonId: number;
	RequestDocument?: string;
	RegionStatus: number;
    RegionStatusName: string;
	RegionApprover?: string;
	RegionApprovedDate?: string;
	COStatus: number;
    COStatusName: string;
	COApprover?: string;
	COApprovedDate?: string;
	ApprovedDocument?: string;
	CreatedBy?: string;
	CreatedDate?: string;
}

// Matches the backend's cursor-pagination convention (see FE/src/types/Pagination.d.ts)
export type RevisionPagination = PaginatedRequest<RevisionFilter>;

export interface RevisionFilter {
  TransactionId?: string | null;
  ProjectId?: string | null;
  RevisionType?: string | null;
  RevisionStatus?: string | null;
  CurrentStage?: string | null;
}