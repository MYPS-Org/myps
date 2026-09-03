// revisionActions.ts

import type { ActionRevisionRules } from '../../../Model';

// WebAPI RevisionController's ActionRules (commit 3bec5ce7, 2026-08-19) is now stage-aware for
// ViewReviseProject: CanApprove/CanForCorrection check ApprovalStatus.ROStatus directly
// (0 = RO's turn, 1 = RO already approved -> CO's turn), matching what ApproveRevision/
// RejectRevision/ForCorrectionRevision actually write (raw 1/2/3 on the RO or CO tier). So
// ActionRules alone already answers "is it this role's turn right now" for Approve/For
// Correction/Disapprove — no separate stage check needed for those three.
//
// ReviseProject (the start-a-brand-new-revision endpoint) is the one exception: its ActionRules
// is still purely role-based (CanApprove/CanForCorrection = isROUser||isCOUser, unconditionally),
// because there's nothing to approve yet. The `!notYetSubmitted` guard below exists specifically
// to suppress Approve/For Correction/Disapprove in that flow.
//
// Do NOT gate on ProjectStatus.RevisionStatus — live-verified (Playwright, 2026-08-19):
// ViewReviseProject's ProjectStatus object doesn't return a RevisionStatus field at all; only
// ConstructionStatus/PackageStatus come back.
//
// RevisionDetails.CurrentStage ('IO' | 'RO' | 'CO' | 'Disapproved' | 'Done', from the SQL function
// fRevisionDetail()) is used for exactly one thing ActionRules doesn't cover: notYetSubmitted —
// RevisionDetails is absent entirely until a revision is actually submitted, which is what tells
// "Submit Revision Request" (brand new) apart from "Re-Submit Revision" (already submitted).
//
// Re-Submit no longer re-derives ownership/for-correction state on the FE (previously via
// currentUserId===createdBy and a CurrentStage==='io'+ForCorrectionsDetails check). Backend commit
// 7c5dcb68 (2026-08-20) moved that logic server-side: CanSubmit is now
// `isRevisionOwner && (isNewRevision || ROStatus==3 || COStatus==3)`, so once a revision has been
// submitted (!notYetSubmitted), CanSubmit=true can only mean "owner, sent back for correction" —
// same trust-ActionRules-alone principle as Approve/For Correction/Disapprove below. The old FE-side
// recheck compared against RevisionDetails.RevisionCreatedBy (from fRevisionDetail(), a different/
// staler source than the RevisionRoot.CreatedBy the backend now uses for CanSubmit), so it could go
// out of sync and hide the button even when CanSubmit was correctly true.
//
// fRevisionDetail() itself hasn't been updated for the new ROStatus==1-means-CO's-turn convention
// (it still reads ROStatus==1 as CurrentStage 'RO'), so don't use CurrentStage to gate Approve/For
// Correction/Disapprove/Re-Submit — ActionRules is the accurate signal for all of those.
const normalizeStage = (stage?: string | null) => stage?.toLowerCase().trim() ?? '';

const STAGE_LABELS: Record<string, string> = {
  ro: 'For Approval',
  co: 'For Approval',
  disapproved: 'Disapproved',
  done: 'Approved',
};

// Human-facing label for the revision's current stage — use this instead of displaying
// RevisionDetails.CurrentStage or ProjectStatus.RevisionStatus verbatim.
export const getRevisionStageLabel = (currentStage?: string | null, forCorrectionsCount?: number): string => {
  if (!currentStage) return 'N/A';
  const stage = normalizeStage(currentStage);
  if (stage === 'io') {
    return (forCorrectionsCount ?? 0) > 0 ? 'For Correction' : 'For Approval';
  }
  return STAGE_LABELS[stage] ?? currentStage;
};

export type RevisionAction = {
  show: boolean | undefined;
  color: 'green' | 'orange' | 'amber' | 'red';
  label: string;
  loading?: boolean;
  onClick: () => void;
};

type Params = {
  isEdit: boolean;
  // Backend-computed role+stage gate (WebAPI RevisionController: ReviseProject/ViewReviseProject
  // ActionRules) — replaces the old FE-side AUC/RPC/DPC usergroup name checks.
  actionRules?: ActionRevisionRules;
  // RevisionDetails.CurrentStage from ViewReviseProject ('IO' | 'RO' | 'CO' | 'Disapproved' | 'Done').
  // Absent means RevisionDetails itself wasn't returned, i.e. this revision hasn't been submitted yet
  // (ReviseProject, the start-a-new-revision endpoint, never returns a RevisionDetails object).
  currentStage?: string | null;

  // Whether the current user is in the RPC (RO) usergroup. RPC's "approve" only forwards the
  // revision to CO for final approval, so it's labeled "Endorse" rather than "Approve" — CO (AUC)
  // still sees "Approve" since their action is the terminal one. Same CanApprove/backend action
  // either way (see isROUser/isCOUser split in RevisionController.cs).
  isRPCUser?: boolean;

  loading: {
    revise?: boolean;
    resubmit?: boolean;
    approve?: boolean;
    review?: boolean;
    reject?: boolean;
    update?: boolean;
  };

  actions: {
    submit: (type: 'new' | 'resubmit' | 'approve') => void;
    update: () => void;
    openApprove: () => void;
    openReview: () => void;
    openReject: () => void;
    openEndorse: () => void;
  };
};

export const getRevisionActions = ({
  isEdit,
  actionRules,
  currentStage,
  isRPCUser,
  loading,
  actions,
}: Params): RevisionAction[] => {
  const notYetSubmitted = !currentStage;

  return [
    {
      show: isEdit && !!actionRules?.CanSubmit && !notYetSubmitted,
      color: 'green',
      label: 'Re-Submit Revision',
      loading: loading.resubmit,
      onClick: () => actions.submit('resubmit'),
    },
    {
      show: isEdit && !!actionRules?.CanSubmit && notYetSubmitted,
      color: 'green',
      label: 'Submit Revision Request',
      loading: loading.revise,
      onClick: () => actions.submit('new'),
    },
    {
      show: isEdit && !!actionRules?.CanApprove && !notYetSubmitted,
      color: 'green',
      label: isRPCUser ? 'Endorse' : 'Approve',
      loading: loading.approve,
      onClick: () => (isRPCUser ? actions.openEndorse() : actions.openApprove()),
    },
    {
      show: isEdit && !!actionRules?.CanForCorrection && !notYetSubmitted,
      color: 'amber',
      label: 'For Correction',
      loading: loading.review,
      onClick: () => actions.openReview(),
    },
    {
      show: isEdit && !!actionRules?.CanApprove && !notYetSubmitted,
      color: 'red',
      label: 'Disapprove',
      loading: loading.reject,
      onClick: () => actions.openReject(),
    },
  ];
};
