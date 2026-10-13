import { useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { pendingImportJobsAtom, type ImportJobKind, type PendingImportJob } from '../atoms/importJobs.atom';
import { useSignalR } from '../hooks/useSignalR';
import { signalRService } from '../services/signalrService';
import { useToast } from './toaster/ToasterContext';
import { getImportJobStatus } from '../pages/Program/Service';
import type { ImportJobNotification } from '../pages/Program/Model.d';

const TERMINAL_STATUSES = new Set(['Completed', 'CompletedWithErrors', 'Failed', 'Cancelled']);

// Export is read-only (no validation rows to report), so its "Completed" case uses the job's own
// Message ("Projects exported: N.") straight from the server rather than the
// valid/warning-count phrasing that only makes sense for Import/Update.
const buildMessage = (event: ImportJobNotification, kind: ImportJobKind): string => {
  if (kind === 'export') {
    switch (event.Status) {
      case 'Completed':
        return event.Message || `Export completed: ${event.ValidCount ?? 0} project(s).`;
      case 'Failed':
        return `Export failed: ${event.Message || 'Unknown error.'}`;
      case 'Cancelled':
        return `Export cancelled: ${event.Message || 'The job was cancelled.'}`;
      default:
        return event.Message || `Export ${event.Status}`;
    }
  }

  switch (event.Status) {
    case 'Completed':
      return `Import completed: ${event.ValidCount ?? 0} valid, ${event.WarningCount ?? 0} warning(s).`;
    case 'CompletedWithErrors':
      return `Import completed with issues: ${event.ValidCount ?? 0} valid, ${event.WarningCount ?? 0} warning(s), ${event.ErrorCount ?? 0} error(s).`;
    case 'Failed':
      return `Import failed: ${event.Message || 'Unknown error.'}`;
    case 'Cancelled':
      return `Import cancelled: ${event.Message || 'The job was cancelled.'}`;
    default:
      return event.Message || `Import ${event.Status}`;
  }
};

const toastTypeForStatus = (status: string): 'success' | 'warning' | 'error' => {
  if (status === 'Completed') return 'success';
  if (status === 'Failed') return 'error';
  return 'warning'; // CompletedWithErrors, Cancelled
};

/**
 * Invisible, app-wide side-effect component. ImportProjectsJobDialog closes itself
 * right after queuing a job — this is what watches the job to completion instead and
 * reports the result as a toast, so an import running in the background isn't silently
 * lost once its dialog is gone.
 */
export const ImportJobNotifier = () => {
  const [pendingJobs, setPendingJobs] = useAtom(pendingImportJobsAtom);
  const { on, off, invoke } = useSignalR('import');
  const { showToast } = useToast();
  const pendingJobsRef = useRef<PendingImportJob[]>(pendingJobs);
  const joinedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pendingJobsRef.current = pendingJobs;
  }, [pendingJobs]);

  const resolveJob = useCallback((jobId: string) => {
    console.log('[ImportJobNotifier] resolving job, leaving group:', jobId);
    setPendingJobs((prev) => prev.filter((job) => job.jobId !== jobId));
    joinedRef.current.delete(jobId);
    invoke('LeaveJobGroup', jobId).catch((err) => console.error('[ImportJobNotifier] Failed to leave job group:', jobId, err));
  }, [invoke, setPendingJobs]);

  const notify = useCallback((event: ImportJobNotification, kind: ImportJobKind) => {
    console.log('[ImportJobNotifier] notifying toast for job:', event.JobId, event);
    // Export's ExcelFileUrl is the exported workbook itself, not an error report — the label has
    // to say so, or a successful export reads like something went wrong.
    const actions = [
      event.TextFileUrl ? { label: 'View Report', href: event.TextFileUrl } : null,
      event.ExcelFileUrl ? { label: kind === 'export' ? 'Download' : 'View Errors', href: event.ExcelFileUrl } : null,
    ].filter((a): a is { label: string; href: string } => a !== null);

    showToast({
      type: toastTypeForStatus(event.Status),
      message: buildMessage(event, kind),
      actions: actions.length > 0 ? actions : undefined,
    });
  }, [showToast]);

  // Best-effort catch-up check for a terminal status the SignalR group
  // broadcast may have already missed or will never deliver (lost message,
  // connection that drops and never reconnects, etc.) — resolves/toasts the
  // job the same way a live ImportStatusChanged event would.
  const checkJobStatus = useCallback(async (jobId: string, kind: ImportJobKind) => {
    try {
      const response = await getImportJobStatus(jobId);
      // Re-check membership on the way back out — a live ImportStatusChanged
      // event (or another in-flight checkJobStatus call, e.g. the periodic
      // poll racing the post-join check) may have already resolved this job
      // while this request was in flight, which would otherwise show a
      // duplicate toast.
      if (TERMINAL_STATUSES.has(response.Data.Status) && pendingJobsRef.current.some((job) => job.jobId === jobId)) {
        notify(response.Data, kind);
        resolveJob(jobId);
      }
    } catch (err) {
      console.error(`[ImportJobNotifier] Failed to check import job ${jobId} status:`, err);
    }
  }, [notify, resolveJob]);

  // Join the SignalR group for any newly-queued job so this connection starts
  // receiving that job's ImportStatusChanged events.
  useEffect(() => {
    pendingJobs.forEach(({ jobId, kind }) => {
      if (joinedRef.current.has(jobId)) return;
      joinedRef.current.add(jobId);
      console.log('[ImportJobNotifier] joining job group:', jobId);
      invoke('JoinJobGroup', jobId)
        .then(() => {
          console.log('[ImportJobNotifier] joined job group:', jobId);
          // A Hangfire worker can finish the job (especially a small/fast
          // export) before this join completes — that broadcast would land
          // in an empty group and be lost for good, so check once for a
          // status we may have already missed.
          return checkJobStatus(jobId, kind);
        })
        .catch((err) => console.error('[ImportJobNotifier] Failed to join import job group:', jobId, err));
    });
  }, [pendingJobs, invoke, checkJobStatus]);

  // Periodic backstop, independent of the SignalR connection's health: a
  // connection can drop and, once withAutomaticReconnect() exhausts its
  // retries, never fire another event again (not even onreconnected/onclose
  // is handled below) — without this, such a job would stay "pending"
  // forever even though the backend finished it long ago.
  useEffect(() => {
    const interval = setInterval(() => {
      pendingJobsRef.current.forEach(({ jobId, kind }) => checkJobStatus(jobId, kind));
    }, 10000);
    return () => clearInterval(interval);
  }, [checkJobStatus]);

  // Listen once; read the latest pending list via ref so we don't churn the
  // subscription every time a job resolves.
  useEffect(() => {
    const handleStatusChanged = (event: ImportJobNotification) => {
      console.log('[ImportJobNotifier] ImportStatusChanged received:', event);

      const trackedJob = pendingJobsRef.current.find((job) => job.jobId === event.JobId);
      if (!trackedJob) {
        console.log('[ImportJobNotifier] ignoring — job not tracked:', event.JobId, pendingJobsRef.current);
        return;
      }
      if (!TERMINAL_STATUSES.has(event.Status)) {
        console.log('[ImportJobNotifier] ignoring — non-terminal status:', event.Status);
        return;
      }

      notify(event, trackedJob.kind);
      resolveJob(event.JobId);
    };

    console.log('[ImportJobNotifier] subscribing to ImportStatusChanged');
    on('ImportStatusChanged', handleStatusChanged);
    return () => {
      console.log('[ImportJobNotifier] unsubscribing from ImportStatusChanged');
      off('ImportStatusChanged');
    };
  }, [on, off, notify, resolveJob]);

  // A dropped/reconnected SignalR connection loses server-side group membership —
  // rejoin every still-pending job and do one status check in case its terminal
  // event fired while we were disconnected.
  useEffect(() => {
    signalRService.onReconnected(async () => {
      console.log('[ImportJobNotifier] SignalR reconnected, rechecking pending jobs:', pendingJobsRef.current);
      for (const { jobId, kind } of pendingJobsRef.current) {
        try {
          await invoke('JoinJobGroup', jobId);
          await checkJobStatus(jobId, kind);
        } catch (err) {
          console.error(`[ImportJobNotifier] Failed to recheck import job ${jobId} after reconnect:`, err);
        }
      }
    }, 'import');
  }, [invoke, checkJobStatus]);

  return null;
};
