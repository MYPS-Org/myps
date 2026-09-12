// =============================================================================
// LumpSumDetail.tsx — one Lump Sum Project (orchestrator).
//
// WHERE THE DATA COMES FROM. Everything on this page was fetched: the project
// and its child rows from LumpSumDetails, the balance from the same call, and
// the itemized projects from ShowItemizedProjects. The atom starts empty, so a
// deep link, a refresh and a click through from the list all take the same
// path — there is no seeded state to fall back on.
//
// AFTER A MUTATION, RE-READ. Save, Import and both deletes change figures the
// database computes (Remaining is the live LS component cost), so Service.ts
// re-reads the project rather than patching the atom from the request. A
// locally-adjusted Remaining that disagreed with the view would still look
// authoritative.
//
// REPLENISH IS NOT A MUTATION ANY MORE (2026-09-08). The dialog appends a draft
// line to the form; Save carries it. Until then the form reports a pending
// delta and this page OVERLAYS it on the balance widget, labelled unsaved —
// the atom itself is never touched with a local figure. While anything is
// pending, Import and Delete-child (both of which re-read the parent and would
// reset the form) are disabled, and leaving the page asks first.
//
// RESETS ARE EXPLICIT. The form re-seeds from the atom only when `dataVersion`
// is bumped here: the detail fetch landing, an import, a child delete. The lock
// refresh on window focus re-reads the parent too, and must NOT bump it — that
// is the regression this replaced (every tab switch wiped unsaved edits).
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { useToast } from '../../../components/toaster/ToasterContext';

import { lumpSumDataAtom } from '../store/lumpSumStore';
import { useLumpSumBalance } from '../hooks/useLumpSumBalance';
import * as Service from '../Service';
import type {
  LumpSum,
  LumpSumChild,
  LumpSumActivityEvent,
  LumpSumLock,
  LumpSumProgramApproval,
} from '../Model.d';
import {
  getLumpSumActions,
  getItemizedProjectActions,
  lockReason,
  approvedReason,
  approvedDeleteReason,
  UNSAVED_FUNDING_REASON,
  type ActionGate,
} from '../utils/lumpSumActions';

import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
} from '../../../components/tailwindui/table';

import LumpSumBalanceWidget from '../components/LumpSumBalanceWidget';
import LumpSumStatusBadge from '../utils/lumpSumStatusBadge';
import LumpSumActionButtons from '../components/LumpSumActionButtons';
import CollapsibleSection from '../components/CollapsibleSection';
import LumpSumForm, { type LumpSumFundingState } from '../components/LumpSumForm';

import ImportItemizedProjectsDialog from '../dialogs/ImportItemizedProjectsDialog';
import DeleteLumpSumDialog from '../dialogs/DeleteLumpSumDialog';
import DeleteItemizedProjectDialog from '../dialogs/DeleteItemizedProjectDialog';

/** Every data cell in the Itemized Projects table: centred, and free to wrap inside the nowrap Table wrapper. */
const CELL = 'text-center whitespace-normal break-words align-middle';

/**
 * The two facts a re-read of the parent brings back that gate this page: the
 * import lock and the program's approval. Null and null means "nothing stands
 * in the way as far as the last read knows" — including after a failed
 * background read, which leaves the last known state on screen and lets the
 * server be the one to refuse.
 */
interface Gate {
  lock: LumpSumLock | null;
  approval: LumpSumProgramApproval | null;
}
const OPEN_GATE: Gate = { lock: null, approval: null };

const LumpSumDetail: React.FC = () => {
  const { lumpSumId: lumpSumIdStr } = useParams<{ lumpSumId: string }>();
  const navigate = useNavigate();
  const lumpSumId = Number(lumpSumIdStr);
  const { showToast } = useToast();

  const { lumpSums, children } = useAtomValue(lumpSumDataAtom);

  const lumpSum: LumpSum | null = lumpSums.find((p) => p.Id === lumpSumId) ?? null;
  const balance = useLumpSumBalance(lumpSumId);

  const projects: LumpSumChild[] = lumpSum
    ? children.filter((c) => c.ParentProjectId === lumpSum.ProjectId)
    : [];

  // Tracks the fetch so the not-found panel does not flash while it is in
  // flight — the atom is legitimately empty for one render on a deep link.
  const [isLoading, setIsLoading] = useState(true);

  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activity, setActivity] = useState<LumpSumActivityEvent[] | null>(null);
  const [replenishOpen, setReplenishOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<LumpSumChild | null>(null);

  /*  Bumped when the server data the form shows has been REPLACED — see the
      header. The form re-seeds on each bump and on nothing else. */
  const [dataVersion, setDataVersion] = useState(0);
  const replaceFormData = useCallback(() => setDataVersion((v) => v + 1), []);

  /*  A SAVE WHOSE ANSWER WAS LOST (2026-09-10). The form does not know whether
      it landed, so it hands the question here: a loud re-read, then the same
      reset an import triggers. Until that bump arrives the form keeps Save
      disabled — a draft that may already be persisted is never re-sent on a
      guess. A re-read that fails leaves the form locked with a Reload button. */
  const handleSaveUnverified = useCallback(async () => {
    await Service.fetchLumpSumById(lumpSumId);
    replaceFormData();
  }, [lumpSumId, replaceFormData]);

  const [fundingState, setFundingState] = useState<LumpSumFundingState>({
    pendingDelta: 0,
    isDirty: false,
  });
  const hasUnsavedFunding = fundingState.isDirty;

  /*  HAS THE DETAIL FETCH ACTUALLY LANDED? This page renders from the atom, and
      a list row is in the atom WITHOUT its child sets — so it renders before the
      detail fetch resolves, and after one that failed (the catch below swallows
      the error deliberately, leaving the last known state on screen).

      That matters to Replenish and to nothing else. The dialog derives the
      current allocation from the form's funding lines, and with none fetched the
      form holds []: the allocation reads ₱0.00 and the draft would carry
      `newTotal − 0` — the whole new total as a top-up, roughly doubling the
      allocation on save. So the button waits for real lines rather than
      computing against an absence. Save is already safe: handleUpdate refuses a
      payload with no live funding line. */
  const [detailLoaded, setDetailLoaded] = useState(false);

  useEffect(() => {
    // A non-numeric :lumpSumId has nothing to fetch — clear the flag so the
    // guard below renders instead of leaving "Loading…" on screen forever.
    if (Number.isNaN(lumpSumId)) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setDetailLoaded(false);

    Service.fetchLumpSumById(lumpSumId)
      .then((response) => {
        if (cancelled) return;
        /*  The detail fetch is the one read that legitimately replaces what a
            list row seeded the form with (a list row carries no child sets). */
        replaceFormData();
        setDetailLoaded(true);
        // The children are scoped by the PARENT'S ProjectId, so they can only be
        // fetched once the parent is known.
        return Service.fetchItemizedProjects(lumpSumId, response.Data.ProjectId);
      })
      .catch(() => {
        // httpClient's interceptor already raised the toast; the panel below is
        // the in-page fallback.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lumpSumId, replaceFormData]);

  /*  LEAVING WITH PENDING CHANGES ASKS FIRST. The app runs on BrowserRouter, not
      a data router, so React Router's useBlocker is not available here; what is
      covered is refresh / close / external navigation (beforeunload — the browser's
      generic prompt, which cannot be worded) and this page's own links (a confirm
      on click, below). Navigation through the shell's sidebar is not intercepted. */
  useEffect(() => {
    if (!hasUnsavedFunding) return;
    const handle = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers read returnValue; modern ones only need preventDefault.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [hasUnsavedFunding]);

  const confirmLeave = useCallback(
    (e: React.MouseEvent) => {
      if (!hasUnsavedFunding) return;
      if (!window.confirm('You have unsaved funding changes. Leave without saving them?')) {
        e.preventDefault();
      }
    },
    [hasUnsavedFunding],
  );

  const reloadChildren = useCallback(() => {
    if (lumpSum) void Service.fetchItemizedProjects(lumpSumId, lumpSum.ProjectId);
  }, [lumpSumId, lumpSum]);

  /*  THE LOCK IS NOT A LOAD-TIME FACT (2026-09-08). It was read once by the effect
      above and never again, so an import that ENDED left every mutator greyed until
      a manual reload, and one that STARTED after load surfaced as a bare 409 with
      nothing naming who held it.

      Re-reading the parent IS the refresh: fetchLumpSumById writes through
      patchStore, so lumpSum.Lock feeds both getLumpSumActions and the form
      reactively — no extra state, no new endpoint. Background mode, so a refresh
      over a page the user is already reading raises no preloader and no toast; a
      failure leaves the last known state on screen rather than blanking it. */
  const refreshGate = useCallback(async (): Promise<Gate> => {
    if (Number.isNaN(lumpSumId)) return OPEN_GATE;
    try {
      const response = await Service.fetchLumpSumById(lumpSumId, { background: true });
      return {
        lock: response.Data.Lock ?? null,
        // The program's approval rides the same re-read (2026-09-09): a program
        // Approved while this tab sat in the background greys the page on return.
        approval: response.Data.ProgramApproval ?? null,
      };
    } catch {
      return OPEN_GATE;
    }
  }, [lumpSumId]);

  /*  The UN-GREYING half. The other user's import ends while this tab sits in the
      background; the controls come back when the user returns to it. Both events:
      `focus` covers window switching, `visibilitychange` covers tab switching. */
  useEffect(() => {
    if (Number.isNaN(lumpSumId)) return;

    const handle = () => {
      if (!document.hidden) void refreshGate();
    };

    window.addEventListener('focus', handle);
    document.addEventListener('visibilitychange', handle);
    return () => {
      window.removeEventListener('focus', handle);
      document.removeEventListener('visibilitychange', handle);
    };
  }, [lumpSumId, refreshGate]);

  /*  THE GREYING half. A disabled button is only as fresh as the last read, so the
      gate is re-checked at the moment it matters — as a dialog is opened — rather
      than letting the request find out. One helper; the action BUILDERS wrap every
      onClick in it (see ActionGate in lumpSumActions.ts), choosing the flags in
      the same branch that greys the button, so no caller has to remember.

      Every action keeps the lock check — each of those endpoints takes the
      parent's applock or reads its stamp. `refuseWhenApproved` is the approval,
      which the server refuses for Delete Lump Sum Project alone (rule narrowed
      2026-09-09). `refuseWhenDirty` re-checks unsaved funding AFTER the re-read,
      through a ref: the button's own greying was decided at click time, and a
      draft made during the silent round trip would otherwise be discarded by the
      parent re-read that Import and the child Delete both trigger on success. */
  const hasUnsavedFundingRef = useRef(hasUnsavedFunding);
  hasUnsavedFundingRef.current = hasUnsavedFunding;

  const openIfFree = useCallback<ActionGate>(
    async (open, opts = {}) => {
      const { lock, approval } = await refreshGate();
      if (opts.refuseWhenApproved && approval) {
        showToast({ type: 'warning', message: approvedDeleteReason(approval) });
        return;
      }
      if (lock) {
        showToast({ type: 'warning', message: lockReason(lock) });
        return;
      }
      if (opts.refuseWhenDirty && hasUnsavedFundingRef.current) {
        showToast({ type: 'warning', message: UNSAVED_FUNDING_REASON });
        return;
      }
      await open();
    },
    [refreshGate, showToast],
  );

  /*  Activity is fetched on first expand, not on mount: it is a secondary panel
      and its query walks every child of the project. */
  const handleToggleActivity = useCallback(() => {
    const opening = !isActivityOpen;
    setIsActivityOpen(opening);
    if (!opening || activity !== null || Number.isNaN(lumpSumId)) return;

    Service.fetchLumpSumActivity(lumpSumId)
      .then((response) => setActivity(response.Data.Events ?? []))
      .catch(() => setActivity([]));
  }, [isActivityOpen, activity, lumpSumId]);

  /*  Ask the server whether itemization is allowed before opening the dialog.
      ValidateForItemization answers 200-shaped either way, so a refusal is a
      REASON to show, not an error — and it covers cases the disabled-button
      hint cannot see, such as row-level visibility. */
  /*  The bare opener: the action builder wraps it in the click-time gate. This
      adds the server's own pre-flight — a refusal is cheaper to name here than
      to show the workbook picker and reject the upload. */
  const handleOpenImport = useCallback(async () => {
    try {
      const check = await Service.validateForItemization(lumpSumId);
      if (!check.Data.Valid) {
        showToast({
          type: 'warning',
          message: check.Data.Message ?? 'This Lump Sum Project cannot be itemized right now.',
        });
        return;
      }
      setImportOpen(true);
    } catch {
      // httpClient's interceptor already raised the toast.
    }
  }, [lumpSumId, showToast]);

  if (isLoading && !lumpSum) {
    return <div className="p-6 text-gray-600">Loading Lump Sum Project…</div>;
  }

  if (Number.isNaN(lumpSumId) || !lumpSum) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Lump Sum Project Not Found</h1>
        <p className="text-gray-600">
          Lump Sum Project{lumpSumIdStr ? ` "${lumpSumIdStr}"` : ''} does not exist or is not
          visible to you.
        </p>
        <Link to="/lumpsum" className="text-blue-600 hover:underline text-sm">
          Back to Lump Sum Projects
        </Link>
      </div>
    );
  }

  /*  The dialog posts the workbook itself; what comes back is either the import
      summary or a rejection the dialog renders row by row. A rejection is
      rethrown so the dialog can show it — the interceptor has already toasted
      its Message, so nothing is toasted twice here. */
  const handleImport = async (file: File) => {
    const result = await Service.importItemizedProjects(
      file, lumpSum.Id, lumpSum.ProgramId, lumpSum.ProjectId,
    );
    // The service re-read the parent: the form's child sets are stale by design.
    replaceFormData();

    /*  WARNINGS AND REFUSALS KEEP THE DIALOG OPEN, so it closes itself once the
        user has read them. Closing here would take the lists away with it. */
    const summary = result.Data;
    if (!summary?.Warnings?.length && !summary?.Errors?.length) setImportOpen(false);

    showToast({ type: 'success', message: summary?.Message ?? 'Import complete.' });

    /*  P10 duplicates stay toasts: they are observations about names, nothing was
        dropped or mis-stored. The row warnings go to the dialog's tab and the
        report instead — one toast each would bury them. */
    for (const notice of summary?.Notices ?? []) {
      showToast({ type: 'warning', message: notice });
    }
    return summary;
  };

  const programApproval = lumpSum.ProgramApproval ?? null;

  const actions = getLumpSumActions({
    lumpSum,
    lock: lumpSum.Lock ?? null,
    hasUnsavedFunding,
    fundingLinesLoaded: detailLoaded && lumpSum.FundingProfiles !== undefined,
    programApproval,
    gate: openIfFree,
    actions: {
      onReplenish: () => setReplenishOpen(true),
      onImportItemizedProjects: handleOpenImport,
      onDelete: () => setDeleteOpen(true),
    },
  });

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="overflow-hidden max-w-10xl mx-auto p-6 space-y-6">
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link to="/lumpsum" className="hover:text-gray-700 hover:underline" onClick={confirmLeave}>
          Lump Sum Projects
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{lumpSum.ProjectId}</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {lumpSum.Description || lumpSum.ProjectId}
          </h1>
          <LumpSumStatusBadge stage={lumpSum.CurrentStage} />
        </div>
        <span className="text-sm text-gray-500 pt-1 font-mono">{lumpSum.ProjectId}</span>
      </div>

      {/*  Total / Itemized / Remaining, straight from dbo.vLumpSumBalance — plus
           the form's pending delta on Total and Remaining, applied to whichever
           fallback is in use and labelled by the widget. Itemized never moves:
           nothing pending touches the children. */}
      <LumpSumBalanceWidget
        total={(balance?.Total ?? lumpSum.Allocation) + fundingState.pendingDelta}
        itemized={balance?.Itemized ?? lumpSum.Itemized}
        remaining={(balance?.Remaining ?? lumpSum.Remaining) + fundingState.pendingDelta}
        pendingDelta={fundingState.pendingDelta}
      />

      {/*  THE PROGRAM'S RECORD IS CLOSED, ITS MONEY IS NOT (rule revised
           2026-09-09). This says what is still possible as much as what is not,
           because most of the page keeps working: only the project's details and
           component are read-only and only Delete Lump Sum Project is refused.
           It suppresses the form's itemized banner (both would say "details are
           read-only", and this one does not lift by deleting children) but NOT
           the lock banner below — an import in flight is a separate, equally
           true thing, and now that Save and Replenish stay live under an
           approval the lock is what actually holds them. */}
      {programApproval && (
        <div
          role="status"
          className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <span className="font-semibold">Program Approved.</span> {approvedReason(programApproval)}
        </div>
      )}

      {/*  Someone else's import holds this project. The stamp is a courtesy the
           server reports only while fresh; the buttons below are disabled with
           the same sentence, and a save that raced the import would get 409 Busy
           regardless. */}
      {lumpSum.Lock && (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span className="font-semibold">Itemization in progress.</span> {lockReason(lumpSum.Lock)}
        </div>
      )}

      <div className="flex justify-end">
        <LumpSumActionButtons actions={actions} />
      </div>

      <LumpSumForm
        mode="edit"
        initialData={lumpSum}
        itemizedCount={projects.length}
        lock={lumpSum.Lock ?? null}
        programApproval={programApproval}
        dataVersion={dataVersion}
        replenishOpen={replenishOpen}
        onReplenishClose={() => setReplenishOpen(false)}
        onFundingStateChange={setFundingState}
        onSaveUnverified={handleSaveUnverified}
      />

      <CollapsibleSection
        title={`Itemized Projects (${projects.length})`}
        isOpen={isProjectsOpen}
        onToggle={() => setIsProjectsOpen(!isProjectsOpen)}
      >
        {/*  Every column centred and allowed to wrap. The shared <Table> wrapper
             sets whitespace-nowrap so wide tables scroll rather than fold; the
             cells opt back out (CELL) so a long Description breaks onto a second
             line instead of forcing a horizontal scrollbar. */}
        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">
            No itemized projects yet. Import a workbook to itemize this allocation.
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader justify="center">Project ID</TableHeader>
                <TableHeader justify="center">Description</TableHeader>
                <TableHeader justify="center">Drawn from Parent</TableHeader>
                <TableHeader justify="center">Published</TableHeader>
                <TableHeader justify="center">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.ProjectPK}>
                  <TableCell className={`${CELL} font-mono text-xs`}>
                    {/*  A child is an ordinary project, so it opens in the Project
                         module. The route wants "{ProjectId}:{StageName}"
                         (Routes.tsx: /projects/project-details/:project); a child
                         sits at its parent's stage by construction, so the parent's
                         stage is the fallback when the row does not name one. */}
                    <Link
                      to={`/projects/project-details/${encodeURIComponent(project.ProjectId)}:${encodeURIComponent(project.CurrentStage ?? lumpSum.CurrentStage ?? '')}`}
                      className="text-blue-600 hover:underline"
                      title="Open in the Projects module"
                    >
                      {project.ProjectId}
                    </Link>
                  </TableCell>
                  <TableCell className={`${CELL} text-sm text-gray-700`}>{project.Description}</TableCell>
                  <TableCell className={CELL}>{formatCurrency(project.DrawnFromParent)}</TableCell>
                  <TableCell className={CELL}>
                    {/* A read, never a write — publishing belongs to Programs. */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        project.IsPublished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {project.IsPublished ? 'Published' : 'Not published'}
                    </span>
                  </TableCell>
                  <TableCell className={CELL}>
                    <div className="flex justify-center">
                      <LumpSumActionButtons
                        actions={getItemizedProjectActions({
                          hasUnsavedFunding,
                          /*  The stamp greys it with a named reason; the
                              program's approval does not reach it at all —
                              DeleteItemizedProject is allowed on an Approved
                              program so an import mistake stays correctable. */
                          lock: lumpSum.Lock ?? null,
                          gate: openIfFree,
                          actions: { onDelete: () => setDeleteProjectTarget(project) },
                        })}
                        size="xs"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Activity"
        isOpen={isActivityOpen}
        onToggle={handleToggleActivity}
      >
        {/*  RECONSTRUCTED FROM AUDIT COLUMNS, NOT AN EVENT LOG. Only the latest
             change to any row can appear, because an UpdatedBy/UpdatedDate pair
             records nothing else. Saying so is the honest thing to do. */}
        <p className="text-xs text-gray-500 mb-3">
          Built from creation and last-changed stamps. Only the most recent change to each
          record appears — this is not a full audit trail.
        </p>

        {activity === null ? (
          <p className="text-sm text-gray-500">Loading activity…</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity recorded.</p>
        ) : (
          <ol className="space-y-3">
            {activity.map((event, index) => (
              <li key={`${event.Kind}-${event.At}-${index}`} className="flex gap-3 text-sm">
                <span className="text-gray-400 whitespace-nowrap font-mono text-xs pt-0.5">
                  {new Date(event.At).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-gray-700">
                  {event.Summary}
                  {event.By && <span className="text-gray-400"> — {event.By}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleSection>

      {/* ================================================================== */}
      {/* Dialogs                                                             */}
      {/* ================================================================== */}

      {/*  The Replenish dialog is rendered by LumpSumForm, which owns the lines it
           appends to; this page only opens it (replenishOpen, gated by openIfFree). */}

      <ImportItemizedProjectsDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSubmit={handleImport}
        lumpSum={lumpSum}
      />

      <DeleteLumpSumDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onSuccess={() => navigate('/lumpsum')}
        lumpSum={lumpSum}
      />

      {deleteProjectTarget && (
        <DeleteItemizedProjectDialog
          open
          onClose={() => setDeleteProjectTarget(null)}
          onSuccess={() => {
            setDeleteProjectTarget(null);
            // The service re-read the parent (its Remaining rose): reset the form.
            replaceFormData();
            reloadChildren();
          }}
          project={deleteProjectTarget}
          parent={{ lumpSumId: lumpSum.Id, projectId: lumpSum.ProjectId }}
        />
      )}
    </div>
  );
};

export default LumpSumDetail;
