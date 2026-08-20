import { atom } from 'jotai';

/**
 * JobIds queued from ImportProjectsJobDialog (or any future import trigger) that
 * ImportJobNotifier is watching for a terminal SignalR ImportStatusChanged event.
 * The dialog closes itself right after queuing, so this is the only thing left
 * connecting a running background job to the UI that will eventually report on it.
 */
export const pendingImportJobsAtom = atom<string[]>([]);
