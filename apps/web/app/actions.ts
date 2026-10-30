'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, COOKIE, errorMessage, TOKEN_MAX_AGE_S } from '@/lib/api';

const back = (path: string, kind: 'error' | 'notice', msg: string) =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const safeNext = (n: string) => (n.startsWith('/') && !n.startsWith('//') ? n : '/jobs');

async function startSession(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_MAX_AGE_S,
  });
}

export async function login(form: FormData) {
  const next = safeNext(str(form, 'next'));
  const { data, error } = await (
    await api()
  ).POST('/v1/auth/login', {
    body: {
      email: str(form, 'email'),
      password: String(form.get('password') ?? ''),
      client: 'web',
    },
  });
  if (!data) back('/login', 'error', errorMessage(error));
  else {
    await startSession(data.access_token);
    redirect(
      data.role === 'candidate'
        ? next
        : '/login?error=' + encodeURIComponent('Use the NUA CREW Hire app for employer accounts'),
    );
  }
}

export async function register(form: FormData) {
  const { data, error } = await (
    await api()
  ).POST('/v1/auth/register/candidate', {
    body: {
      email: str(form, 'email'),
      password: String(form.get('password') ?? ''),
      full_name: str(form, 'full_name'),
      accept_terms: form.get('accept_terms') === 'on',
    } as never,
  });
  if (!data) back('/register', 'error', errorMessage(error));
  else {
    await startSession(data.access_token);
    redirect('/profile?notice=' + encodeURIComponent('Welcome! Tell us about your skills.'));
  }
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect('/');
}

export async function saveProfile(form: FormData) {
  const types = form.getAll('types').map(String);
  const skills = str(form, 'skills')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pay = str(form, 'min_hourly_pay');
  const { error } = await (
    await api()
  ).PUT('/v1/candidate/profile', {
    body: {
      full_name: str(form, 'full_name'),
      headline: str(form, 'headline') || null,
      summary: str(form, 'summary') || null,
      suburb: str(form, 'suburb') || null,
      state: (str(form, 'state') || null) as never,
      postcode: str(form, 'postcode') || null,
      preferred_employment_types: types as never,
      min_hourly_pay: pay || null,
      skills,
    },
  });
  if (error) back('/profile', 'error', errorMessage(error));
  revalidatePath('/profile');
  back('/profile', 'notice', 'Profile saved');
}

export async function setDiscovery(form: FormData) {
  const { error } = await (
    await api()
  ).PUT('/v1/candidate/consents/talent-discovery', {
    body: { granted: form.get('granted') === 'on' },
  });
  if (error) back('/profile', 'error', errorMessage(error));
  back('/profile', 'notice', 'Privacy choice saved');
}

export async function addResume(form: FormData) {
  const { error } = await (
    await api()
  ).POST('/v1/candidate/resumes', {
    body: { title: str(form, 'title'), content_text: str(form, 'content_text') },
  });
  if (error) back('/profile', 'error', errorMessage(error));
  back('/profile', 'notice', 'Resume saved');
}

export async function apply(form: FormData) {
  const jobId = str(form, 'job_id');
  const resume = str(form, 'resume_id');
  const { data, error } = await (
    await api()
  ).POST('/v1/jobs/{job_id}/applications', {
    params: { path: { job_id: jobId } },
    body: { resume_id: resume || null, cover_note: str(form, 'cover_note') || null },
  });
  if (!data) back(`/jobs/${jobId}`, 'error', errorMessage(error));
  else redirect(`/applications/${data.id}?notice=${encodeURIComponent('Application submitted')}`);
}

export async function withdraw(form: FormData) {
  const id = str(form, 'application_id');
  const { error } = await (
    await api()
  ).POST('/v1/candidate/applications/{application_id}/withdraw', {
    params: { path: { application_id: id } },
  });
  if (error) back(`/applications/${id}`, 'error', errorMessage(error));
  back(`/applications/${id}`, 'notice', 'Application withdrawn');
}

type RolePick = { role_code: string; years_experience: number | null; is_primary: boolean };

async function currentRoles(): Promise<RolePick[]> {
  const { data } = await (await api()).GET('/v1/candidate/roles');
  return (data ?? []).map((r) => ({
    role_code: r.role.code,
    years_experience: r.years_experience ?? null,
    is_primary: r.is_primary,
  }));
}

async function putRoles(roles: RolePick[], notice: string) {
  const { error } = await (await api()).PUT('/v1/candidate/roles', { body: { roles } });
  if (error) back('/profile/roles', 'error', errorMessage(error));
  revalidatePath('/profile/roles');
  back('/profile/roles', 'notice', notice);
}

export async function addMyRole(form: FormData) {
  const code = str(form, 'role_code');
  const list = await currentRoles();
  if (list.some((r) => r.role_code === code)) back('/profile/roles', 'notice', 'Already added');
  if (list.length >= 8) back('/profile/roles', 'error', 'You can add up to 8 roles');
  await putRoles(
    [...list, { role_code: code, years_experience: null, is_primary: list.length === 0 }],
    'Role added',
  );
}

export async function removeMyRole(code: string, _form: FormData) {
  const next = (await currentRoles()).filter((r) => r.role_code !== code);
  if (next.length && !next.some((r) => r.is_primary)) next[0] = { ...next[0]!, is_primary: true };
  await putRoles(next, 'Role removed');
}

export async function saveMyRoles(form: FormData) {
  const primary = str(form, 'primary');
  const roles = form.getAll('role_code').map((c) => {
    const code = String(c);
    const years = str(form, `years_${code}`);
    return {
      role_code: code,
      years_experience: years === '' ? null : Number(years),
      is_primary: code === primary,
    };
  });
  await putRoles(roles, 'Roles saved. Your job matches now use them.');
}
