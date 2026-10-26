import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createApi, errorMessage } from '@nua-crew/api-client';
import type { Schemas } from '@nua-crew/contracts';

export const COOKIE = 'nua_session';
export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8000';
export const TOKEN_MAX_AGE_S = 30 * 60; // matches the API's access-token lifetime

export type Job = Schemas['JobOut'];

export async function getToken() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function api() {
  return createApi({
    baseUrl: API_BASE,
    token: await getToken(),
    fetch: (req) => fetch(req, { cache: 'no-store' }),
  });
}

export async function getViewer() {
  if (!(await getToken())) return null;
  const { data } = await (await api()).GET('/v1/auth/me');
  return data ?? null;
}

export async function requireCandidate() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role !== 'candidate')
    redirect('/login?error=' + encodeURIComponent('Use a candidate account'));
  return viewer;
}

export function toCard(job: Job) {
  return {
    id: job.id,
    title: job.title,
    employerName: job.employer.name ?? null,
    verification: (job.employer.verification_status ?? null) as
      'verified' | 'pending' | 'unverified' | 'rejected' | null,
    attribution: job.attribution ?? null,
    suburb: job.suburb ?? null,
    state: job.state ?? null,
    employmentType: job.employment_type,
    payMin: job.pay_min ?? null,
    payMax: job.pay_max ?? null,
    payPeriod: job.pay_period ?? null,
    payBasis: job.pay_basis as 'disclosed' | 'estimated' | 'not_disclosed',
    superIncluded: job.super_included ?? null,
    publishedAt: job.published_at ?? null,
  };
}

export { errorMessage };
