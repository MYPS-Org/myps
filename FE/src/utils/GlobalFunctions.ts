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