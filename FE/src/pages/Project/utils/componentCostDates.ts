import type { ComponentCostPerYear } from '../Model';

// Date rules for a component's per-year cost row, shared by the Project and Modification
// Component Cost dialogs: the date inputs' min/max, the red "(out of range)" marker and
// the check on Save all come from here, so they cannot drift apart.

type CostRowDates = Pick<ComponentCostPerYear, 'Year' | 'StartDate' | 'EndDate'>;

/** The row's date as YYYY-MM-DD, or '' when it has none. */
const toYmd = (date?: string | null): string => (date ? date.split('T')[0] : '');

/** YYYY-MM-DD → MM/DD/YYYY, as the date inputs show it. */
const toDisplayDate = (ymd: string): string => {
  const [y, m, d] = ymd.split('-');
  return `${m}/${d}/${y}`;
};

/**
 * Earliest and latest Start/End Date (YYYY-MM-DD) a row may have, for the date inputs.
 *
 * The Start Date stays inside the row's Year and not after the End Date. Funds stay valid
 * for two years, so the End Date may run as late as Dec 31 of the year after the row's Year.
 */
export const costRowDateLimits = (cost: CostRowDates) => {
  const start = toYmd(cost.StartDate);
  const end = toYmd(cost.EndDate);
  const yearMin = cost.Year ? `${cost.Year}-01-01` : '';
  const yearMax = cost.Year ? `${cost.Year}-12-31` : '';
  return {
    startMin: yearMin || undefined,
    startMax: (end && (!yearMax || end < yearMax) ? end : yearMax) || undefined,
    endMin: start || yearMin || undefined,
    endMax: cost.Year ? `${cost.Year + 1}-12-31` : undefined,
  };
};

/**
 * What is wrong with the row's Start and End Date, as a message per field (null when fine).
 * Start/End Date are optional (the schedule may not be set yet); only an entered date is checked.
 */
export const costRowDateErrors = (cost: CostRowDates) => {
  const start = toYmd(cost.StartDate);
  const end = toYmd(cost.EndDate);
  const order = start && end && end < start ? 'End Date cannot be before its Start Date.' : null;
  if (!cost.Year) return { start: order, end: order };

  // The year's own bounds, without the Start/End Date caps the input limits add.
  const { startMin: yearMin, endMax } = costRowDateLimits({ Year: cost.Year });
  const yearMax = `${cost.Year}-12-31`;
  return {
    start: start && (start < yearMin! || start > yearMax)
      ? `Start Date must be between ${toDisplayDate(yearMin!)} and ${toDisplayDate(yearMax)}.`
      : order,
    end: end && (end < yearMin! || end > endMax!)
      ? `End Date must be between ${toDisplayDate(yearMin!)} and ${toDisplayDate(endMax!)}.`
      : order,
  };
};

/**
 * Checks a row's Year and dates on Save, returning the toast message for the first problem
 * or null. The dialogs' forms are `noValidate`, so this replaces the browser's own min/max popups.
 */
export const validateCostRowDates = (
  cost: CostRowDates,
  yearRange: { min?: number; max?: number } = {}
): string | null => {
  const year = cost.Year ?? 0;
  // Same fallback the Year input's min/max used before the forms became noValidate.
  const { min: minYear = 2000, max: maxYear = 2100 } = yearRange;
  if (year < minYear || year > maxYear) {
    return `Year must be between ${minYear} and ${maxYear}.`;
  }
  const errors = costRowDateErrors(cost);
  return errors.start ?? errors.end;
};
