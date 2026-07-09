// =============================================================================
// LSWalletDetail.tsx — LS Wallet detail page (orchestrator)
//
// Architecture note on Jotai vs. explicit refetches:
//   Service.ts's syncAtom() pushes a FULL snapshot of { wallets, itemizedProjects }
//   into walletDataAtom after EVERY mutation (replenish, create/delete project,
//   publish, advance stage, etc.). This means wallet-level fields (CurrentStage,
//   Amount, HasStageData) and project-level fields (PublishStatus, CurrentDrawAmount)
//   are ALL reactive through the atom — no explicit refetches needed after mutations.
//
//   Revisions are the single exception: they're not in the atom snapshot (the atom
//   only carries wallets + itemizedProjects). Revision state is managed locally
//   and updated via onSuccess callbacks from the revision dialogs.
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';

import { walletDataAtom } from '../store/walletStore';
import { useWalletBalance } from '../hooks/useWalletBalance';
import * as Service from '../Service';
import type { ItemizedProject, ItemizedProjectRevision } from '../Model.d';
import type { LSWallet } from '../Model.d';
import {
  getWalletActions,
  getItemizedProjectActions,
  resolveWalletDeleteTier,
  resolveProjectDeleteTier,
} from '../utils/walletActions';

import WalletBalanceWidget from '../components/WalletBalanceWidget';
import WalletStatusBadge from '../utils/walletStatusBadge';
import WalletActionButtons from '../components/WalletActionButtons';
import WalletDetailsSection from '../components/WalletDetailsSection';
import FundingProfileSection from '../components/FundingProfileSection';
import WalletComponentSection from '../components/WalletComponentSection';

import ReplenishWalletDialog from '../dialogs/ReplenishWalletDialog';
import CreateItemizedProjectDialog from '../dialogs/CreateItemizedProjectDialog';
import DeleteWalletDialog from '../dialogs/DeleteWalletDialog';
import AdvanceProgramStageDialog from '../dialogs/AdvanceProgramStageDialog';
import EditDrawAmountDialog from '../dialogs/EditDrawAmountDialog';
import PublishItemizedProjectDialog from '../dialogs/PublishItemizedProjectDialog';
import ItemizedProjectRevisionDialog from '../dialogs/ItemizedProjectRevisionDialog';
import DeleteItemizedProjectDialog from '../dialogs/DeleteItemizedProjectDialog';
import ApproveRevisionDialog from '../dialogs/ApproveRevisionDialog';
import RejectRevisionDialog from '../dialogs/RejectRevisionDialog';
import ReturnRevisionForReviewDialog from '../dialogs/ReturnRevisionForReviewDialog';

// ---------------------------------------------------------------------------
// Status code → human label (mirrors ItemizedProjectRevision status codes)
// 0=Pending, 1=Approved, 2=Disapproved, 3=ForReview
// ---------------------------------------------------------------------------
const revisionStatusLabel = (status: 0 | 1 | 2 | 3): string => {
  switch (status) {
    case 0: return 'Pending';
    case 1: return 'Approved';
    case 2: return 'Disapproved';
    case 3: return 'For Review';
  }
};

const revisionStatusClass = (status: 0 | 1 | 2 | 3): string => {
  switch (status) {
    case 1: return 'bg-green-100 text-green-700';
    case 2: return 'bg-red-100 text-red-700';
    case 3: return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LSWalletDetail: React.FC = () => {
  const { walletId: walletIdStr } = useParams<{ walletId: string }>();
  const navigate = useNavigate();
  const walletIdNum = Number(walletIdStr);

  // ---------------------------------------------------------------------------
  // Reactive wallet + project data from Jotai atom.
  // Every mutation that calls syncAtom() pushes a fresh snapshot here,
  // so the UI stays consistent without explicit refetches after mutations.
  // ---------------------------------------------------------------------------
  const { wallets, itemizedProjects: allProjects } = useAtomValue(walletDataAtom);

  const wallet: LSWallet | null =
    wallets.find((w) => w.Id === walletIdNum && !w.IsDeleted) ?? null;

  // Only show active (non-deleted, non-cancelled) projects belonging to this wallet
  const projects = allProjects.filter(
    (p) =>
      p.ParentWalletId === walletIdNum && !p.IsDeleted && !p.IsCancelled
  );

  // Balance is derived reactively from the same atom (re-computes after every syncAtom())
  const balance = useWalletBalance(walletIdNum);

  // ---------------------------------------------------------------------------
  // Revisions — not in Jotai atom; fetched once on mount, then patched locally
  // ---------------------------------------------------------------------------
  const [revisions, setRevisions] = useState<Record<number, ItemizedProjectRevision[]>>({});

  useEffect(() => {
    if (isNaN(walletIdNum)) return;
    let cancelled = false;

    // Fetch projects fresh from Service (bypasses atom to get a clean starting snapshot
    // before we know which ones are published — the atom may not yet be populated on
    // first render in SSR-style hydration scenarios, though in practice it's synchronous)
    Service.fetchItemizedProjectsByWalletId(walletIdNum).then((res) => {
      if (cancelled) return;
      const published = res.Data.filter(
        (p) => !p.IsDeleted && !p.IsCancelled && p.PublishStatus === 'Published'
      );
      if (published.length === 0) return;

      Promise.all(
        published.map((p) =>
          Service.fetchWalletRevisions(p.Id).then((r) => ({ id: p.Id, data: r.Data }))
        )
      ).then((results) => {
        if (!cancelled) {
          setRevisions(Object.fromEntries(results.map((r) => [r.id, r.data])));
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [walletIdNum]);

  // ---------------------------------------------------------------------------
  // Stable no-op for the disabled form sections.
  // The sections' internal useEffects list onChange as a dep, so it must be
  // referentially stable to avoid unnecessary effect re-runs.
  // ---------------------------------------------------------------------------
  const noOp = useCallback(() => {}, []);

  // ---------------------------------------------------------------------------
  // Dialog state — wallet-level (always mounted, toggled via boolean)
  // ---------------------------------------------------------------------------
  const [replenishOpen, setReplenishOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [deleteWalletOpen, setDeleteWalletOpen] = useState(false);
  const [deleteWalletTier, setDeleteWalletTier] = useState<'hard' | 'soft' | 'blocked'>('soft');
  const [advanceStageOpen, setAdvanceStageOpen] = useState(false);

  // Dialog state — project-level (conditionally mounted; null = closed)
  const [editDrawTarget, setEditDrawTarget] = useState<ItemizedProject | null>(null);
  const [publishTarget, setPublishTarget] = useState<ItemizedProject | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<ItemizedProject | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<{
    project: ItemizedProject;
    tier: 'hard' | 'soft' | 'blocked';
  } | null>(null);

  // Dialog state — revision-level (conditionally mounted)
  const [approveTarget, setApproveTarget] = useState<{
    revision: ItemizedProjectRevision;
    stage: 'Region' | 'CO';
  } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    revision: ItemizedProjectRevision;
    stage: 'Region' | 'CO';
  } | null>(null);
  const [returnTarget, setReturnTarget] = useState<{
    revision: ItemizedProjectRevision;
    stage: 'Region' | 'CO';
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Revision state helpers
  // ---------------------------------------------------------------------------

  const addRevision = (revision: ItemizedProjectRevision) => {
    setRevisions((prev) => ({
      ...prev,
      [revision.ItemizedProjectId]: [
        ...(prev[revision.ItemizedProjectId] ?? []),
        revision,
      ],
    }));
  };

  const updateRevision = (updated: ItemizedProjectRevision) => {
    setRevisions((prev) => ({
      ...prev,
      [updated.ItemizedProjectId]: (prev[updated.ItemizedProjectId] ?? []).map(
        (r) => (r.Id === updated.Id ? updated : r)
      ),
    }));
  };

  // ---------------------------------------------------------------------------
  // Not-found / invalid guard — must come after all hooks
  // ---------------------------------------------------------------------------
  if (isNaN(walletIdNum) || !wallet || !balance) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Wallet Not Found</h1>
        <p className="text-gray-600">
          Wallet{walletIdStr ? ` "${walletIdStr}"` : ''} does not exist or has been deleted.
        </p>
        <Link to="/lumpsum" className="text-blue-600 hover:underline text-sm">
          Back to LS Wallets list
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Wallet-level action config
  // ---------------------------------------------------------------------------
  const walletActions = getWalletActions({
    wallet,
    balance,
    itemizedProjects: projects,
    actions: {
      onReplenish: () => setReplenishOpen(true),
      onAddItemizedProject: () => setCreateProjectOpen(true),
      onDelete: () => {
        // Resolve tier here so DeleteWalletDialog receives it as a required prop
        const tier = resolveWalletDeleteTier(wallet, projects);
        setDeleteWalletTier(tier);
        setDeleteWalletOpen(true);
      },
      onAdvanceStage: () => setAdvanceStageOpen(true),
    },
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link to="/lumpsum" className="hover:text-gray-700 hover:underline">
          LS Wallets
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{wallet.ProgramName}</span>
      </nav>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{wallet.ProgramName}</h1>
          <WalletStatusBadge stage={wallet.CurrentStage} />
        </div>
        <span className="text-sm text-gray-500 pt-1">Wallet ID: {wallet.Id}</span>
      </div>

      {/* Balance widget */}
      <WalletBalanceWidget
        total={balance.Total}
        used={balance.Used}
        available={balance.Available}
      />

      {/* Wallet action buttons */}
      <div className="flex justify-end">
        <WalletActionButtons actions={walletActions} />
      </div>

      {/* Read-only wallet detail sections.
          All three sections support disabled={true} which locks inputs.
          The no-op onChange prevents any state mutation from happening inside them. */}
      <div className="space-y-4">
        <WalletDetailsSection wallet={wallet} onChange={noOp} disabled />
        <FundingProfileSection wallet={wallet} onChange={noOp} disabled />
        <WalletComponentSection wallet={wallet} onChange={noOp} disabled />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Itemized Projects table                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Itemized Projects</h2>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">No itemized projects for this wallet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 text-xs uppercase tracking-wide">
                  <th className="pb-3 pr-4">Project ID</th>
                  <th className="pb-3 pr-4">Draw Amount</th>
                  <th className="pb-3 pr-4">Publish Status</th>
                  <th className="pb-3 pr-4">Project Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((project) => {
                  // PublishedDrawAmount is the frozen snapshot used for the Used balance.
                  // Before publish, show CurrentDrawAmount (live, editable).
                  const displayAmount =
                    project.PublishedDrawAmount ?? project.CurrentDrawAmount;
                  const amountLabel =
                    project.PublishedDrawAmount != null ? '(published)' : '(current)';

                  const projectActions = getItemizedProjectActions({
                    project,
                    wallet,
                    actions: {
                      onEditDraw: () => setEditDrawTarget(project),
                      onPublish: () => setPublishTarget(project),
                      onRequestRevision: () => setRevisionTarget(project),
                      onDelete: () => {
                        const tier = resolveProjectDeleteTier(project);
                        setDeleteProjectTarget({ project, tier });
                      },
                    },
                  });

                  return (
                    <tr key={project.ProjectId} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-700">
                        {project.ProjectId}
                      </td>
                      <td className="py-3 pr-4">
                        {formatCurrency(displayAmount)}
                        <span className="ml-1 text-xs text-gray-400">{amountLabel}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            project.PublishStatus === 'Published'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {project.PublishStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600 text-xs">
                        {project.ProjectStatus}
                      </td>
                      <td className="py-3">
                        <WalletActionButtons actions={projectActions} size="xs" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Revision history — one collapsible section per published project    */}
      {/* ------------------------------------------------------------------ */}
      {projects.some((p) => p.PublishStatus === 'Published') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Revision History</h2>

          <div className="space-y-3">
            {projects
              .filter((p) => p.PublishStatus === 'Published')
              .map((project) => {
                const projectRevisions = revisions[project.Id] ?? [];
                return (
                  <details
                    key={project.Id}
                    className="border border-gray-200 rounded-lg"
                  >
                    <summary className="px-4 py-3 cursor-pointer select-none text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                      {project.ProjectId}
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        {projectRevisions.length} revision
                        {projectRevisions.length !== 1 ? 's' : ''}
                      </span>
                    </summary>

                    <div className="px-4 pb-4 pt-1">
                      {projectRevisions.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">
                          No revisions submitted.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                                <th className="pb-2 pr-3">Transaction ID</th>
                                <th className="pb-2 pr-3">Reason</th>
                                <th className="pb-2 pr-3">Requested Cost</th>
                                <th className="pb-2 pr-3">Region</th>
                                <th className="pb-2 pr-3">CO</th>
                                <th className="pb-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {projectRevisions.map((revision) => {
                                // Region is actionable when it's pending reviewer action.
                                // CO is actionable only after Region approves.
                                const regionActionable = revision.RegionStatus === 0;
                                const coActionable =
                                  revision.RegionStatus === 1 && revision.COStatus === 0;

                                return (
                                  <tr key={revision.Id}>
                                    <td className="py-2 pr-3 font-mono text-xs text-gray-700">
                                      {revision.TransactionId}
                                    </td>
                                    <td className="py-2 pr-3 max-w-xs">
                                      <span
                                        className="block truncate text-gray-600"
                                        title={revision.Reason}
                                      >
                                        {revision.Reason}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-3 text-gray-700">
                                      {formatCurrency(revision.RequestedCost)}
                                    </td>
                                    <td className="py-2 pr-3">
                                      <span
                                        className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${revisionStatusClass(revision.RegionStatus)}`}
                                      >
                                        {revisionStatusLabel(revision.RegionStatus)}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-3">
                                      <span
                                        className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${revisionStatusClass(revision.COStatus)}`}
                                      >
                                        {revisionStatusLabel(revision.COStatus)}
                                      </span>
                                    </td>
                                    <td className="py-2">
                                      {regionActionable && (
                                        <div className="flex gap-1 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setApproveTarget({ revision, stage: 'Region' })
                                            }
                                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                          >
                                            Approve (R)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRejectTarget({ revision, stage: 'Region' })
                                            }
                                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                          >
                                            Reject (R)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setReturnTarget({ revision, stage: 'Region' })
                                            }
                                            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                          >
                                            Return (R)
                                          </button>
                                        </div>
                                      )}
                                      {coActionable && (
                                        <div className="flex gap-1 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setApproveTarget({ revision, stage: 'CO' })
                                            }
                                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                          >
                                            Approve (CO)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRejectTarget({ revision, stage: 'CO' })
                                            }
                                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                          >
                                            Reject (CO)
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setReturnTarget({ revision, stage: 'CO' })
                                            }
                                            className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                          >
                                            Return (CO)
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Dialogs                                                             */}
      {/* ================================================================== */}

      {/* Wallet-level dialogs — always mounted, open prop controls visibility */}

      <ReplenishWalletDialog
        open={replenishOpen}
        onClose={() => setReplenishOpen(false)}
        onSuccess={() => setReplenishOpen(false)}
        wallet={wallet}
        currentBalance={balance}
      />

      <CreateItemizedProjectDialog
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onSuccess={() => setCreateProjectOpen(false)}
        wallet={wallet}
        balance={balance}
      />

      {/* On wallet delete (any tier), navigate away — wallet is removed from active view */}
      <DeleteWalletDialog
        open={deleteWalletOpen}
        onClose={() => setDeleteWalletOpen(false)}
        onSuccess={() => navigate('/lumpsum')}
        wallet={wallet}
        tier={deleteWalletTier}
      />

      <AdvanceProgramStageDialog
        open={advanceStageOpen}
        onClose={() => setAdvanceStageOpen(false)}
        onSuccess={() => setAdvanceStageOpen(false)}
        programId={wallet.ProgramId}
        programName={wallet.ProgramName}
        currentStage={wallet.CurrentStage}
      />

      {/* Project-level dialogs — conditionally mounted via target state */}

      {editDrawTarget && (
        <EditDrawAmountDialog
          open
          onClose={() => setEditDrawTarget(null)}
          onSuccess={() => setEditDrawTarget(null)}
          project={editDrawTarget}
          wallet={wallet}
          balance={balance}
        />
      )}

      {/* PublishDialog fires onSuccess internally before the user closes it (the compliance
          check runs on open and auto-publishes if all rules pass). We only patch revision
          state in onSuccess; the dialog stays visible showing the result banner until the
          user clicks Close (which fires onClose). */}
      {publishTarget && (
        <PublishItemizedProjectDialog
          open
          onClose={() => setPublishTarget(null)}
          onSuccess={(project) => {
            setRevisions((prev) => ({ ...prev, [project.Id]: [] }));
          }}
          project={publishTarget}
          wallet={wallet}
        />
      )}

      {revisionTarget && (
        <ItemizedProjectRevisionDialog
          open
          onClose={() => setRevisionTarget(null)}
          onSuccess={(revision) => {
            addRevision(revision);
            setRevisionTarget(null);
          }}
          project={revisionTarget}
          wallet={wallet}
        />
      )}

      {deleteProjectTarget && (
        <DeleteItemizedProjectDialog
          open
          onClose={() => setDeleteProjectTarget(null)}
          onSuccess={() => setDeleteProjectTarget(null)}
          project={deleteProjectTarget.project}
          tier={deleteProjectTarget.tier}
        />
      )}

      {/* Revision-level dialogs */}

      {approveTarget && (
        <ApproveRevisionDialog
          open
          onClose={() => setApproveTarget(null)}
          onSuccess={(updated) => {
            updateRevision(updated);
            setApproveTarget(null);
          }}
          revision={approveTarget.revision}
          stage={approveTarget.stage}
        />
      )}

      {rejectTarget && (
        <RejectRevisionDialog
          open
          onClose={() => setRejectTarget(null)}
          onSuccess={(updated) => {
            updateRevision(updated);
            setRejectTarget(null);
          }}
          revision={rejectTarget.revision}
          stage={rejectTarget.stage}
        />
      )}

      {returnTarget && (
        <ReturnRevisionForReviewDialog
          open
          onClose={() => setReturnTarget(null)}
          onSuccess={(updated) => {
            updateRevision(updated);
            setReturnTarget(null);
          }}
          revision={returnTarget.revision}
          stage={returnTarget.stage}
        />
      )}
    </div>
  );
};

export default LSWalletDetail;
