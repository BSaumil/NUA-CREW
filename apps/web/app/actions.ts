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
