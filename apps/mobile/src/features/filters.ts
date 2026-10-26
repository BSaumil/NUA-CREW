/** Job search filters shared by the Discover screen, the filter sheet and saved searches. */
export type Sort = 'relevance' | 'newest' | 'pay' | 'distance';
export type EmploymentType = 'full_time' | 'part_time' | 'casual' | 'contract' | 'shift';

export type JobFilters = {
  q: string;
  suburb: string;
  employment_type: EmploymentType | null;
  min_hourly: number | null;
  posted_within_days: number | null;
  radius_km: number | null;
  /** Approximate device position, already rounded. Only set while "Near me" is on. */
  near: { lat: number; lng: number } | null;
  sort: Sort;
};

export const EMPTY_FILTERS: JobFilters = {
  q: '',
  suburb: '',
  employment_type: null,
  min_hourly: null,
  posted_within_days: null,
  radius_km: null,
  near: null,
  sort: 'relevance',
};

export const TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  casual: 'Casual',
  contract: 'Contract',
  shift: 'Shift',
};

/** ~1.1 km precision: enough for "near me", too coarse to locate a person. */
export const roundCoord = (n: number) => Math.round(n * 100) / 100;

export type JobQuery = {
  q?: string;
  suburb?: string;
  employment_type?: EmploymentType;
  min_hourly?: number;
  posted_within_days?: number;
  radius_km?: number;
  near_lat?: number;
  near_lng?: number;
  sort: Sort;
};

export function toQuery(f: JobFilters): JobQuery {
  const q: JobQuery = { sort: f.near || f.sort !== 'distance' ? f.sort : 'newest' };
  if (f.q.trim()) q.q = f.q.trim();
  if (f.suburb.trim()) q.suburb = f.suburb.trim();
  if (f.employment_type) q.employment_type = f.employment_type;
  if (f.min_hourly) q.min_hourly = f.min_hourly;
  if (f.posted_within_days) q.posted_within_days = f.posted_within_days;
  if (f.near) {
    q.near_lat = f.near.lat;
    q.near_lng = f.near.lng;
    if (f.radius_km) q.radius_km = f.radius_km;
  } else if (q.sort === 'distance') {
    q.sort = 'newest';
  }
  return q;
}

/** Number of filters beyond the keyword box, shown on the Filters button badge. */
export function activeCount(f: JobFilters): number {
  return [
    f.suburb.trim(),
    f.employment_type,
    f.min_hourly,
    f.posted_within_days,
    f.near,
    f.sort !== 'relevance' && f.sort !== 'newest' ? f.sort : null,
  ].filter(Boolean).length;
}

export function hasAnyFilter(f: JobFilters): boolean {
  return activeCount(f) > 0 || f.q.trim().length > 0;
}

/** Saved-search payload: only the server-accepted keys, no sort (alerts always use newest). */
export function toSavedParams(f: JobFilters): Record<string, string | number> {
  const entries = Object.entries(toQuery(f)).filter(([k]) => k !== 'sort');
  return Object.fromEntries(entries) as Record<string, string | number>;
}

export function describe(f: JobFilters): string {
  const parts: string[] = [];
  if (f.q.trim()) parts.push(`“${f.q.trim()}”`);
  if (f.employment_type) parts.push(TYPE_LABEL[f.employment_type]);
  if (f.suburb.trim()) parts.push(f.suburb.trim());
  if (f.near) parts.push(f.radius_km ? `within ${f.radius_km} km` : 'near me');
  if (f.min_hourly) parts.push(`$${f.min_hourly}+/h`);
  return parts.join(' · ') || 'All jobs';
}

/** Rebuild filters from a saved search so tapping an alert reopens the same results. */
export function fromSaved(params: Record<string, unknown>): JobFilters {
  const near =
    typeof params.near_lat === 'number' && typeof params.near_lng === 'number'
      ? { lat: params.near_lat, lng: params.near_lng }
      : null;
  return {
    ...EMPTY_FILTERS,
    q: typeof params.q === 'string' ? params.q : '',
    suburb: typeof params.suburb === 'string' ? params.suburb : '',
    employment_type: (params.employment_type as EmploymentType | undefined) ?? null,
    min_hourly: typeof params.min_hourly === 'number' ? params.min_hourly : null,
    posted_within_days:
      typeof params.posted_within_days === 'number' ? params.posted_within_days : null,
    radius_km: typeof params.radius_km === 'number' ? params.radius_km : null,
    near,
    sort: near ? 'distance' : 'newest',
  };
}
