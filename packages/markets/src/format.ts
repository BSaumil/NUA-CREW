/** Locale and zone are always passed in. Nothing here falls back to a particular country. */
export interface FormatOptions {
  locale: string;
  /** IANA zone. Omit to use the viewer's own device zone. */
  timeZone?: string;
}

const toDate = (value: string | number | Date): Date | null => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function formatDate(value: string | number | Date, opts: FormatOptions): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(opts.locale, { timeZone: opts.timeZone }) : '—';
}

export function formatDateTime(value: string | number | Date, opts: FormatOptions): string {
  const d = toDate(value);
  return d ? d.toLocaleString(opts.locale, { timeZone: opts.timeZone }) : '—';
}
