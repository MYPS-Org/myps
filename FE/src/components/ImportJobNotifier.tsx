import { useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { pendingImportJobsAtom } from '../atoms/importJobs.atom';
import { useSignalR } from '../hooks/useSignalR';
import { signalRService } from '../services/signalrService';
import { useToast } from './toaster/ToasterContext';
import { getImportJobStatus } from '../pages/Program/Service';
import type { ImportJobNotification } from '../pages/Program/Model.d';

const TERMINAL_STATUSES = new Set(['Completed', 'CompletedWithErrors', 'Failed', 'Cancelled']);

const buildMessage = (event: ImportJobNotification): string => {
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
  const pendingJobsRef = useRef<string[]>(pendingJobs);
  const joinedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pendingJobsRef.current = pendingJobs;
  }, [pendingJobs]);

  const resolveJob = useCallback((jobId: string) => {
    setPendingJobs((prev) => prev.filter((id) => id !== jobId));
    joinedRef.current.delete(jobId);
    invoke('LeaveJobGroup', jobId).catch(() => {});
  }, [invoke, setPendingJobs]);

  const notify = useCallback((event: ImportJobNotification) => {
    showToast({
      type: toastTypeForStatus(event.Status),
      message: buildMessage(event),
      action: event.TextFileUrl ? { label: 'View Report', href: event.TextFileUrl } : undefined,
    });
  }, [showToast]);

  // Join the SignalR group for any newly-queued job so this connection starts
  // receiving that job's ImportStatusChanged events.
  useEffect(() => {
    pendingJobs.forEach((jobId) => {
      if (joinedRef.current.has(jobId)) return;
      joinedRef.current.add(jobId);
      invoke('JoinJobGroup', jobId).catch((err) => console.error('Failed to join import job group:', err));
    });
  }, [pendingJobs, invoke]);

  // Listen once; read the latest pending list via ref so we don't churn the
  // subscription every time a job resolves.
  useEffect(() => {
    const handleStatusChanged = (event: ImportJobNotification) => {
      if (!pendingJobsRef.current.includes(event.JobId)) return;
      if (!TERMINAL_STATUSES.has(event.Status)) return;

      notify(event);
      resolveJob(event.JobId);
    };

    on('ImportStatusChanged', handleStatusChanged);
    return () => off('ImportStatusChanged');
  }, [on, off, notify, resolveJob]);

  // A dropped/reconnected SignalR connection loses server-side group membership —
  // rejoin every still-pending job and do one status check in case its terminal
  // event fired while we were disconnected.
  useEffect(() => {
    signalRService.onReconnected(async () => {
      for (const jobId of pendingJobsRef.current) {
        try {
          await invoke('JoinJobGroup', jobId);
          const response = await getImportJobStatus(jobId);
          if (TERMINAL_STATUSES.has(response.Data.Status)) {
            notify(response.Data);
            resolveJob(jobId);
          }
        } catch (err) {
          console.error(`Failed to recheck import job ${jobId} after reconnect:`, err);
        }
      }
    }, 'import');
  }, [invoke, notify, resolveJob]);

  return null;
};
