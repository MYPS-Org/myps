import { atom } from 'jotai';

export type ImportJobKind = 'import' | 'update' | 'export';

export interface PendingImportJob {
  jobId: string;
  kind: ImportJobKind;
}

/**
 * Jobs queued from ImportProjectsJobDialog / ActionsDropdown's export action (or any future
 * import trigger) that ImportJobNotifier is watching for a terminal SignalR ImportStatusChanged
 * event. The dialog closes itself right after queuing, so this is the only thing left
 * connecting a running background job to the UI that will eventually report on it. `kind` lets
 * the notifier phrase the toast (and label the result link) correctly per job type — the backend
 * job record itself carries no such distinction.
 */
export const pendingImportJobsAtom = atom<PendingImportJob[]>([]);
