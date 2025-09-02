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

export const formatCurrency = (amount: number) => {
  return amount.toLocaleString('en-PH');
};