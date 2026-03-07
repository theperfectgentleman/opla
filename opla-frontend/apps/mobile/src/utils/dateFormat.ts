const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Returns "23-Mar-2024" */
export function fmtDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const day   = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Returns "23-Mar-2024 01:14" */
export function fmtDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const day    = String(d.getDate()).padStart(2, '0');
  const month  = MONTHS[d.getMonth()];
  const year   = d.getFullYear();
  const hour   = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hour}:${minute}`;
}
