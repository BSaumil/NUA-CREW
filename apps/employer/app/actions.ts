'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, COOKIE, errorMessage, requireEmployer, TOKEN_MAX_AGE_S } from '@/lib/api';

const back = (path: string, kind: 'error' | 'notice', msg: string) =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

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
  else if (data.role !== 'employer' && data.role !== 'admin')
    back('/login', 'error', 'This is the employer app. Candidates use NUA CREW Jobs.');
  else {
    await startSession(data.access_token);
    redirect(data.role === 'admin' ? '/admin' : '/');
  }
}

export async function register(form: FormData) {
  const { data, error } = await (
    await api()
  ).POST('/v1/auth/register/employer', {
    body: {
      email: str(form, 'email'),
      password: String(form.get('password') ?? ''),
      full_name: str(form, 'full_name'),
      organisation_name: str(form, 'organisation_name'),
      abn: str(form, 'abn') || null,
      location: {
        name: str(form, 'location_name') || 'Main location',
        suburb: str(form, 'suburb'),
        state: str(form, 'state') as never,
        postcode: str(form, 'postcode'),
      },
      accept_terms: form.get('accept_terms') === 'on',
    } as never,
  });
  if (!data) back('/register', 'error', errorMessage(error));
  else {
    await startSession(data.access_token);
    redirect(
      '/?notice=' +
        encodeURIComponent(
          'Registered. Your organisation must be verified before you can publish jobs.',
        ),
    );
  }
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect('/login');
}

function jobBody(form: FormData) {
  const skills = str(form, 'skills')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const num = (k: string) => str(form, k) || null;
  return {
    title: str(form, 'title'),
    description: str(form, 'description'),
    employment_type: str(form, 'employment_type') as never,
    category: str(form, 'category') || null,
    location_id: str(form, 'location_id') || null,
    pay_min: num('pay_min'),
    pay_max: num('pay_max'),
    pay_period: (num('pay_period') ?? undefined) as never,
    super_included:
      ({ included: true, plus: false } as Record<string, boolean>)[str(form, 'super')] ?? null,
    engagement_basis: (str(form, 'engagement_basis') || 'unspecified') as never,
    duration_type: (str(form, 'duration_type') || 'unspecified') as never,
    hours_pattern: (str(form, 'hours_pattern') || 'unspecified') as never,
    min_weekly_hours: num('min_weekly_hours'),
    max_weekly_hours: num('max_weekly_hours'),
    start_date: num('start_date'),
    end_date: num('end_date'),
    skills,
  };
}

export async function createJob(form: FormData) {
  const { employerId } = await requireEmployer();
  const { data, error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/jobs', {
    params: { path: { employer_id: employerId } },
    body: jobBody(form),
  });
  if (!data) back('/jobs/new', 'error', errorMessage(error));
  else redirect(`/jobs/${data.id}?notice=${encodeURIComponent('Draft saved')}`);
}

export async function updateJob(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'job_id');
  const { error } = await (
    await api()
  ).PUT('/v1/employers/{employer_id}/jobs/{job_id}', {
    params: { path: { employer_id: employerId, job_id: id } },
    body: jobBody(form),
  });
  if (error) back(`/jobs/${id}/edit`, 'error', errorMessage(error));
  back(`/jobs/${id}`, 'notice', 'Changes saved');
}

export async function unpublishJob(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'job_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/jobs/{job_id}/unpublish', {
    params: { path: { employer_id: employerId, job_id: id } },
  });
  if (error) back(`/jobs/${id}`, 'error', errorMessage(error));
  back(`/jobs/${id}`, 'notice', 'Job unpublished. It is no longer visible to candidates.');
}

export async function publishJob(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'job_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/jobs/{job_id}/publish', {
    params: { path: { employer_id: employerId, job_id: id } },
  });
  if (error) back(`/jobs/${id}`, 'error', errorMessage(error));
  back(`/jobs/${id}`, 'notice', 'Job published');
}

export async function closeJob(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'job_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/jobs/{job_id}/close', {
    params: { path: { employer_id: employerId, job_id: id } },
  });
  if (error) back(`/jobs/${id}`, 'error', errorMessage(error));
  back(`/jobs/${id}`, 'notice', 'Job closed');
}

export async function changeStatus(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'application_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/applications/{application_id}/status', {
    params: { path: { employer_id: employerId, application_id: id } },
    body: { to_status: str(form, 'to_status') as never, note: str(form, 'note') || null },
  });
  if (error) back(`/applications/${id}`, 'error', errorMessage(error));
  back(`/applications/${id}`, 'notice', 'Status updated. The candidate has been notified.');
}

export async function addNote(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'application_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/applications/{application_id}/notes', {
    params: { path: { employer_id: employerId, application_id: id } },
    body: { note: str(form, 'note') },
  });
  if (error) back(`/applications/${id}`, 'error', errorMessage(error));
  back(`/applications/${id}`, 'notice', 'Private note added');
}

export async function addMember(form: FormData) {
  const { employerId } = await requireEmployer();
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/members', {
    params: { path: { employer_id: employerId } },
    body: { email: str(form, 'email'), role: str(form, 'role') as never },
  });
  if (error) back('/team', 'error', errorMessage(error));
  back('/team', 'notice', 'Team member added');
}

// ---- invitations and messages ----
export async function sendInvitation(form: FormData) {
  const { employerId } = await requireEmployer();
  const ret = str(form, 'return_to') || '/talent';
  const { data, error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/invitations', {
    params: {
      path: { employer_id: employerId },
      header: { 'Idempotency-Key': str(form, 'idempotency_key') || null },
    },
    body: {
      ref: str(form, 'ref'),
      job_id: str(form, 'job_id'),
      kind: (str(form, 'kind') === 'permanent' ? 'permanent' : 'temporary') as never,
      note: str(form, 'note'),
      expires_in_days: Number(str(form, 'expires_in_days')) || null,
    },
  });
  if (!data) back(ret, 'error', errorMessage(error));
  else
    back(
      '/invitations',
      'notice',
      'Invitation created. It is waiting in the candidate\u2019s NUA CREW inbox; they may not see it straight away and can accept or decline.',
    );
}

export async function withdrawInvitation(form: FormData) {
  const { employerId } = await requireEmployer();
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/invitations/{invitation_id}/withdraw', {
    params: { path: { employer_id: employerId, invitation_id: str(form, 'invitation_id') } },
  });
  if (error) back('/invitations', 'error', errorMessage(error));
  back('/invitations', 'notice', 'Invitation withdrawn.');
}

export async function sendMessage(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'conversation_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/conversations/{conversation_id}/messages', {
    params: { path: { employer_id: employerId, conversation_id: id } },
    body: { body: String(form.get('body') ?? ''), client_key: str(form, 'client_key') || null },
  });
  if (error) back(`/messages/${id}`, 'error', errorMessage(error));
  redirect(`/messages/${id}`);
}

export async function reportConversation(form: FormData) {
  const { employerId } = await requireEmployer();
  const id = str(form, 'conversation_id');
  const { error } = await (
    await api()
  ).POST('/v1/employers/{employer_id}/conversations/{conversation_id}/report', {
    params: { path: { employer_id: employerId, conversation_id: id } },
    body: { reason: str(form, 'reason'), message_id: str(form, 'message_id') || null },
  });
  if (error) back(`/messages/${id}`, 'error', errorMessage(error));
  back(`/messages/${id}`, 'notice', 'Report sent to NUA CREW support.');
}
