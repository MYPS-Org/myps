// =============================================================================
// firstFundingLine.ts — which funding line is "the first".
//
// ONE DEFINITION, TWO CONSUMERS (2026-09-08). The Funding Profile table protects
// this line while the project is itemized (it is the allocation the children were
// imported against), and the Replenish dialog names it as the line a blank
// top-up copies its Source and Agreement from. Both used to compute it — one
// inline, one not at all — so this is where the rule lives now, and the server
// (ReplenishLumpSum) applies the same one.
//
// THE FIRST LINE IS THE EARLIEST LIVE LINE BY ID. CreateLumpSum writes the first
// line, Replenish appends every later one, and Id is the only creation order the
// table records — so it is read by Id rather than by position, because the array
// is the server's order and nothing here sorts it. Live only: the first line can
// be deleted when the project has no children (the wrong-source repair), and
// treating a deleted line as "first" would copy back the source the user just
// removed. Id > 0 only: a row still unsaved cannot be the first line. With no
// saved live row there is no first line, and callers must say so.
// =============================================================================

import type { LumpSumFundingProfile } from '../Model.d';

/** The earliest live, persisted funding line, or undefined when there is none. */
export const firstFundingLine = (
  profiles: LumpSumFundingProfile[],
): LumpSumFundingProfile | undefined => {
  const live = profiles.filter((p) => !p.IsDeleted && p.Id > 0);
  if (live.length === 0) return undefined;
  return live.reduce((lowest, p) => (p.Id < lowest.Id ? p : lowest), live[0]);
};

/**
 * Whether two source codes name the same source. Case-insensitive, because the
 * server compares them with OrdinalIgnoreCase and the dialog's guard must not
 * refuse what the server would accept.
 */
export const sameSource = (a?: string, b?: string): boolean =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
