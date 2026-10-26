import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createApi, errorMessage } from '@nua-crew/api-client';

export const COOKIE = 'nua_employer_session';
export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8000';
export const TOKEN_MAX_AGE_S = 30 * 60;

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

/** Single-organisation MVP: the first membership is the active workspace. */
export async function requireEmployer() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  const m = viewer.memberships?.[0];
  if (viewer.role !== 'employer' || !m)
    redirect('/login?error=' + encodeURIComponent('Use an employer account'));
  return { viewer, employerId: m.employer_id, role: m.role };
}

export const canWrite = (role: string) => role === 'owner' || role === 'recruiter';

export { errorMessage };
