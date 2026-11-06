const TYPE_LABEL: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  casual: 'Casual',
  contract: 'Contract',
  shift: 'Shift',
};

type Params = Record<string, unknown>;

/** Plain-language summary of the filters a search was saved with. */
export function describeSearch(params: Params): string {
  const parts: string[] = [];
  if (typeof params['q'] === 'string' && params['q']) parts.push(`“${params['q']}”`);
  if (typeof params['suburb'] === 'string' && params['suburb'])
    parts.push(`in ${params['suburb']}`);
  const t = params['employment_type'];
  if (typeof t === 'string' && TYPE_LABEL[t]) parts.push(TYPE_LABEL[t]!.toLowerCase());
  return parts.length ? parts.join(' · ') : 'All jobs';
}

/** Link that re-runs the saved search on the jobs page (only filters that page understands). */
export function searchHref(params: Params): string {
  const qs = new URLSearchParams();
  if (typeof params['q'] === 'string' && params['q']) qs.set('q', params['q']);
  if (typeof params['suburb'] === 'string' && params['suburb']) qs.set('suburb', params['suburb']);
  if (typeof params['employment_type'] === 'string' && params['employment_type'])
    qs.set('type', params['employment_type']);
  const s = qs.toString();
  return s ? `/jobs?${s}` : '/jobs';
}

/** Filters the web app cannot edit (set from the phone app) are listed, not silently dropped. */
export function extraFilters(params: Params): string[] {
  const known = new Set(['q', 'suburb', 'employment_type']);
  return Object.keys(params).filter((k) => !known.has(k) && params[k] != null);
}
