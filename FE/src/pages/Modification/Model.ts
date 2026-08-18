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

// Backend type: FileUpload (DBHelper\Models\Extra\FileUpload.cs). Structurally identical to the
// existing global `FileEntity` (FE/src/types/FileEntity.d.ts) — reuse that instead of redeclaring.
export type FileUpload = FileEntity;

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
    CanRevise?: boolean; // Whether the user can submit a revision request
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

// Matches DBHelper.Models.Functions.Revision.RevisionDetail — the shape actually returned by
// the fRevisionDetail() function backing ViewReviseProject. Note there is no RegionStatus/COStatus
// here (that split lives server-side in ApprovalStatus.ROStatus/COStatus and is not returned to the
// client) — use ProjectStatus.RevisionStatus for the collapsed display/gating status instead.
export interface RevisionDetails {
    Id: number;
    TransactionId: string;
    ProjectFK: string;
    ProjectId: string;
    ProgramId: string;
    RevisionType: string;
    RevisionReason: string;
    CategoryName?: string;
    CurrentStage: string;
    IODocApprovalDate?: string;
    IODocPath?: string;
    IsCertified: boolean;
    RevisionCreatedBy: string;
    RevisionDate: string;
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