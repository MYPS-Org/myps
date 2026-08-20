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
export const normalizeTempIds = <T extends { Id: number }>(rows: T[]): T[] =>
  rows.map((row) => (row.Id <= 0 ? { ...row, Id: 0 } : row));

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