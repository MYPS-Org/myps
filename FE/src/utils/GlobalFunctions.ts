import type { ProjectDetails } from '../pages/Project/Model';

// Formats a date as local YYYY-MM-DD for <input type="date"> values.
// Using toISOString() here would convert to UTC first, which rolls the date
// back a day in timezones ahead of UTC (e.g. PHT, UTC+8) for date-time
// strings without a timezone offset (parsed as local time per spec).
export const toDateInputValue = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

String.prototype.StringToDate = function (): string {
  const date = new Date(this.toString());
  if (isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

// Unique negative placeholder Id for records staged client-side before the
// backend assigns a real (positive) Id. Negative/zero Id means "unsaved" —
// callers that previously checked `Id === 0` should check `Id <= 0` instead,
// since a session can stage multiple unsaved rows that must stay distinguishable
// (e.g. for FK-style linking between a parent and its not-yet-saved children).
let _tempIdCounter = 0;
export const generateTempId = (): number => {
  _tempIdCounter += 1;
  return -(Date.now() * 1000 + _tempIdCounter);
};

// The backend's "insert vs update" check is strictly `Id == 0` (RevisionController
// RequestRevision/ResubmitRevision) — it doesn't understand the negative temp Ids
// generateTempId() hands out for FE-side staging. Call this on every array right
// before it goes into a submit payload so unsaved rows (Id <= 0) arrive as exactly
// 0; leave the atoms/state that generateTempId() populated untouched.
//
// `fkFields` covers FK columns (e.g. ComponentCostFK, WorkItemFK) that point at
// another row's Id: when a new child references a new, not-yet-saved parent, that
// FK is itself a negative temp Id copied from the parent's staged Id. The backend
// re-derives these FKs server-side by correlating on ComponentId, but it never
// understands a negative number for them either — zero them out the same as Id so
// the payload doesn't carry temp Ids into any field.
export const normalizeTempIds = <T extends { Id: number }>(rows: T[], fkFields: (keyof T)[] = []): T[] =>
  rows.map((row) => {
    const normalized: T = row.Id <= 0 ? { ...row, Id: 0 } : row;
    if (fkFields.length === 0) return normalized;
    return fkFields.reduce((acc, field) => {
      const value = acc[field];
      return typeof value === 'number' && value <= 0 ? ({ ...acc, [field]: 0 } as T) : acc;
    }, normalized);
  });

// ResubmitRevision binds ComponentCosts/ComponentCostPerYear/MajorItemOfWorks/MajorItemLocations/
// FundingProfile to the revision-scoped models (DBHelper.Models.Functions.Revision.*), which all
// have `[Required] string TransactionId`. Rows fetched from ViewReviseProject already carry it
// (the FE types just don't declare the field), but rows a user adds during the resubmit session
// are built from those same FE types and never get one — [ApiController] auto-validation then
// 400s the whole request before ResubmitRevision's body runs. Stamp every row with the current
// TransactionId right before it goes into the resubmit payload so new rows validate the same way
// as fetched ones.
export const stampTransactionId = <T extends { Id: number }>(rows: T[], transactionId: string): (T & { TransactionId: string })[] =>
  rows.map((row) => ({ ...row, TransactionId: transactionId }));

// The resubmit-for-correction flow loads its ProjectDetails from ViewReviseProject, whose
// response omits CreatedBy/CreatedDate/Source. RevisionController's ResubmitRevision DTO
// reuses the same ProjectDetails model as RequestRevision (the "new revision" flow, whose
// ProjectDetails comes from a base-project fetch and already carries these fields), where
// CreatedBy/Source are [Required] for model-binding validation only — the controller always
// stamps its own CreatedBy/CreatedDate server-side and never reads these off the payload.
// Sent empty, [ApiController]'s automatic validation 400s before the action even runs.
// Backfill with harmless placeholders so the resubmit payload validates the same way the
// new-revision payload already does.
export const normalizeProjectDetailsForSubmit = (
  project: ProjectDetails,
  userId?: string
): ProjectDetails => ({
  ...project,
  CreatedBy: project.CreatedBy || userId || '',
  CreatedDate: project.CreatedDate || new Date().toISOString(),
  Source: project.Source || 'Base',
  IsPublished: project.IsPublished ?? true,
});

export const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  // Clear the field if it contains 0
  if (e.target.value === '0') {
    e.target.value = '';
  }
};

export const handleCurrencyFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  // Remove currency formatting and show raw number for easier editing
  const value = e.target.value;
  const numericValue = value.replace(/[₱,\s]/g, '');
  if (numericValue && numericValue !== '0') {
    e.target.value = numericValue;
  } else {
    e.target.value = '';
  }
};

export const handleCurrencyBlur = (
  e: React.FocusEvent<HTMLInputElement>, 
  onValueChange: (value: number) => void
) => {
  // Parse the input value and format it as currency
  const numericValue = parseFloat(e.target.value.replace(/[₱,\s]/g, '')) || 0;
  
  // Update the form data with the numeric value
  onValueChange(numericValue);
  
  // Format and display as currency
  if (numericValue > 0) {
    e.target.value = numericValue.FormatToCurrency();
  } else {
    e.target.value = '';
  }
};

export const handleCurrencyChange = (
    value: string, 
    setDisplayValue: (value: string) => void, 
    handleChange: (field: string, value: number) => void,
    fieldName: string = "Total"
  ) => {
    // Remove non-digits
    let numeric = value.replace(/\D/g, "");

    if (numeric === "") numeric = "0";

    // Format with 2 decimals
    const formatted = (parseInt(numeric, 10) / 100).toFixed(2);

    // Update local display
    setDisplayValue(formatted);

    // Update your formData as number with the specified field name
    handleChange(fieldName, parseFloat(formatted));
  };

Number.prototype.FormatToCurrency = function (): string {
  return this.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

Number.parseNumberInput = (value: string, fallback: number | null = null): number | null => {
  if (value === "") return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Disable Class
export const getDisabledClass = (disabled: boolean): string =>
  disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : '';

// Helper function to format dropdown options
export const formatDropdownOptions = (
  items: any[],
  valueField: any,
  labelField: any,
  keyField?: any
) => {
  if (!items || !Array.isArray(items)) return [];

  return items.map(item => ({
    value: item[valueField],
    label: item[labelField],
    key: keyField ? item[keyField] : item[valueField]
  }));
};

// Keeps the currently-selected item visible even if it fails the availability filter --
// SearchableDropdown resolves its label purely via options.find(value), no fallback, so a
// filtered-out selected value renders as the placeholder instead of its real label.
export const filterKeepingSelected = (
  items: any[] | undefined | null,
  predicate: (item: any) => boolean,
  valueField: any,
  selectedValue: string | number | undefined | null
) => {
  if (!items || !Array.isArray(items)) return [];
  const filtered = items.filter(predicate);
  if (selectedValue === undefined || selectedValue === null || selectedValue === '') return filtered;
  if (filtered.some(item => item[valueField] == selectedValue)) return filtered;
  const selectedItem = items.find(item => item[valueField] == selectedValue);
  return selectedItem ? [...filtered, selectedItem] : filtered;
};

// Same Category-to-Thrust mapping rule already proven correct server-side for save-time
// validation (Helpers/ProjectHelper.cs's ValidateProjectDetailsLookups): PAPKey=-1 is a
// wildcard ("any thrust allowed"), and a Category with zero mapping rows is also treated as
// unrestricted (matches the precedent in Hangfire/Importing/ImportingHelper.cs). Used here to
// filter what the Sub-Category dropdown OFFERS, not just what's accepted on save.
export const isThrustAllowedForCategory = (
  papKey: number,
  categoryId: number | undefined | null,
  map: { CategoryId: number; PAPKey: number }[] | undefined | null
) => {
  if (!categoryId) return false; // no category chosen yet -- dropdown stays disabled in this state
  if (!map) return true; // defensive: don't hide everything if the map didn't load
  const rows = map.filter(m => m.CategoryId === categoryId);
  if (rows.length === 0) return true; // no restriction rows -> unrestricted, matches the save-time rule
  return rows.some(m => m.PAPKey === -1 || m.PAPKey === papKey);
};