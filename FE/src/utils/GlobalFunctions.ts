String.prototype.StringToDate = function (): string {
  const date = new Date(this.toString());
  if (isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    timeZoneName: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};
