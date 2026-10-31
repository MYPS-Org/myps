// =============================================================================
// The Multi-Year forms' own checks: the server's rules (Helpers/MultiYear), run
// first so the user hears about a problem before the round trip. The server
// still decides.
// =============================================================================

import type { MembershipFields, PlanningFormOptions, PlanningProjectFields, YearAmount } from './Model.d';

export const EMPTY_MEMBERSHIP: MembershipFields = {
  BasisForImplementationId: null,
  NedaProjectStatusId: null,
  ReadinessLevelIds: [],
  RdpOutcomes: [],
  Tier: null,
  McaScore: null,
};

/** The checks MultiYearCostRules.Check makes: errors refuse, warnings (past the horizon) save. */
export const checkYearlyCosts = (
  rows: YearAmount[],
  startYear: number,
  endYear: number | null,
  horizonYears: number | null,
  horizonName: string,
): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (rows.length === 0) errors.push('Enter at least one planned yearly cost.');
  const seen = new Set<number>();
  rows.forEach((row) => {
    if (seen.has(row.Year)) errors.push(`${row.Year} is entered more than once.`);
    seen.add(row.Year);
    if (!(row.Amount > 0)) errors.push(`The planned cost for ${row.Year} must be more than zero.`);
    if (row.Year < startYear) errors.push(`${row.Year} is before the Start Year (${startYear}).`);
    else if (endYear && row.Year > endYear) errors.push(`${row.Year} is after the End Year (${endYear}).`);
  });
  if (horizonYears) {
    const last = startYear + horizonYears - 1;
    const beyond = [...new Set(rows.map((r) => r.Year).filter((y) => y > last))].sort();
    if (beyond.length) warnings.push(`${beyond.join(', ')} ${beyond.length === 1 ? 'is' : 'are'} beyond the ${horizonName} horizon (${startYear}–${last}).`);
  }
  return { errors: [...new Set(errors)], warnings };
};

/** The planning project form's checks; null when the save may go to the server. */
export const planningFormRefusal = (fields: PlanningProjectFields, options: PlanningFormOptions): string | null => {
  if (!fields.Description.trim()) return 'Enter the project description.';
  if (!fields.Category) return 'Choose the Category.';
  if (!fields.HorizonTypeId) return 'Choose the Horizon.';
  if (!Number.isInteger(fields.StartYear) || fields.StartYear < 1990 || fields.StartYear > 2100) return 'Start Year must be between 1990 and 2100.';
  if (fields.EndYear !== null && (fields.EndYear < fields.StartYear || fields.EndYear > 2100)) return `End Year must be between the Start Year (${fields.StartYear}) and 2100.`;
  if (options.Portfolio.Kind === 2 && !fields.Region) return 'Choose the region.';
  if (!fields.Component.InfraTypeFK) return 'Choose the infrastructure type of the major item of work.';
  if (!fields.Component.WorkTypeFK) return 'Choose the dominant type of work of the major item.';
  if (fields.Component.PhysicalTarget !== null && fields.Component.PhysicalTarget < 0) return 'The physical target cannot be negative.';
  const horizon = options.HorizonTypes.find((h) => h.Id === fields.HorizonTypeId);
  const { errors } = checkYearlyCosts(fields.YearlyCosts, fields.StartYear, fields.EndYear, horizon?.Years ?? null, horizon?.Name ?? '');
  return errors.length ? errors.join(' ') : null;
};
