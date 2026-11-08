import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createApi, errorMessage } from '@nua-crew/api-client';
import { safeReturnTo } from '@nua-crew/ui';

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
    // Server-side only. Set when the API sits behind Vercel Authentication (staging).
    bypassSecret: process.env.API_PROTECTION_BYPASS,
    fetch: (req) => fetch(req, { cache: 'no-store' }),
  });
}

export async function getViewer() {
  if (!(await getToken())) return null;
  const { data } = await (await api()).GET('/v1/auth/me');
  return data ?? null;
}

/** Single-organisation MVP: the first membership is the active workspace. */
/**
 * `returnTo` is where to come back to after signing in. It is run through the allow-list guard, so
 * a crafted value can never send a signed-in person to another site.
 */
export async function requireEmployer(returnTo?: string) {
  const viewer = await getViewer();
  if (!viewer) {
    const next = returnTo ? safeReturnTo(returnTo) : '/';
    redirect(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
  }
  const m = viewer.memberships?.[0];
  if (viewer.role !== 'employer' || !m)
    redirect('/login?error=' + encodeURIComponent('Use an employer account'));
  return { viewer, employerId: m.employer_id, role: m.role };
}

export const canWrite = (role: string) => role === 'owner' || role === 'recruiter';

export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== 'admin')
    redirect('/login?error=' + encodeURIComponent('Operator access required'));
  return viewer;
}

export { errorMessage };
