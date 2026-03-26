import { atom } from 'jotai';
/**
 * Transaction ID
 * Source of Truth: URL Parameter
 */
export const transactionIdAtom = atom<string>('');