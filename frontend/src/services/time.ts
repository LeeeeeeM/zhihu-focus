// APIs send an explicit timezone; display consistently in the reader's timezone.
export function displayTime(value?: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value || '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
