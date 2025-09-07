String.prototype.StringToDate = function (): string {
  const date = new Date(this.toString());
  if (isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  // Clear the field if it contains 0
  if (e.target.value === '0') {
    e.target.value = '';
  }
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