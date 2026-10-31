import type { CodeListItem, MembershipStatus, PortfolioKind, YearAmount } from './Model.d';

export const KIND_NAMES: Record<PortfolioKind, string> = { 1: 'RDIP', 2: 'UDIP', 3: 'PIP' };
export const KIND_DESCRIPTIONS: Record<PortfolioKind, string> = {
  1: 'Regional Development Investment Program — one per region',
  2: 'UPMO Development Investment Program — one per UPMO cluster',
  3: 'Public Investment Program — national',
};

export const STATUS_NAMES: Record<MembershipStatus, string> = {
  1: 'New',
  2: 'Potential',
  3: 'Ongoing',
  4: 'Completed',
  5: 'Cancelled',
};

/**
 * The Multi-Year portfolio update's notice that a GAA / GAA-R approval, a stage advance from GAA or a
 * Non-Implementable / Termination revision approval answers with (MultiYearUpdate, Phase 2), as a toast;
 * null when the response has none. Failed: the update did not finish, the approval itself standing.
 */
export const multiYearUpdateToast = (body: unknown): { type: 'info' | 'warning'; message: string } | null => {
  const notice = (body as { MultiYearUpdate?: { Message?: unknown; Failed?: unknown } | null } | null | undefined)?.MultiYearUpdate;
  if (!notice || typeof notice.Message !== 'string' || !notice.Message.trim()) return null;
  return { type: notice.Failed === true ? 'warning' : 'info', message: notice.Message };
};

export const TERM_YEARS = 6;
export const termLabel = (start: number) => `${start}–${start + TERM_YEARS - 1}`;

export const formatPeso = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The view's YearAmounts JSON, tolerant of a bad value. */
export const parseYearAmounts = (json: string | null | undefined): YearAmount[] => {
  try {
    const rows = JSON.parse(json || '[]');
    return Array.isArray(rows) ? rows.map((r) => ({ Year: Number(r.Year), Amount: Number(r.Amount) })) : [];
  } catch {
    return [];
  }
};

/** A planning code-list value can be picked when it is Active OR valid for the year (0 = open),
 *  the server's rule (MultiYearController.Selectable). */
export const isCodeSelectable = (item: CodeListItem, year: number) =>
  item.IsActive || ((!item.ValidFromYear || item.ValidFromYear <= year) && (!item.ValidToYear || item.ValidToYear >= year));

/** "2026–2030", "From 2026", "Until 2030", "Always". */
export const validityLabel = (item: CodeListItem) => {
  if (!item.ValidFromYear && !item.ValidToYear) return 'Always';
  if (!item.ValidToYear) return `From ${item.ValidFromYear}`;
  if (!item.ValidFromYear) return `Until ${item.ValidToYear}`;
  return `${item.ValidFromYear}–${item.ValidToYear}`;
};
