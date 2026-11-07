'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, COOKIE, errorMessage, requireCandidate, TOKEN_MAX_AGE_S } from '@/lib/api';

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
    body: {
      resume_id: resume || null,
      cover_note: str(form, 'cover_note') || null,
      document_ids: form.getAll('document_ids').map(String),
    },
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

// ---- password reset and email verification ----
const LINK_PROBLEM = 'This link is no longer valid. Please request a new one.';

export async function requestPasswordReset(form: FormData) {
  const { data, error } = await (
    await api()
  ).POST('/v1/auth/password/forgot', { body: { email: str(form, 'email') } });
  if (!data) return back('/forgot-password', 'error', errorMessage(error));
  // Never claim an email was sent when this deployment cannot send one.
  if (!data.email_delivery)
    return back(
      '/forgot-password',
      'error',
      'Password reset by email is not switched on in this environment yet.',
    );
  return back(
    '/forgot-password',
    'notice',
    'If an account exists for that address, we have emailed a link to choose a new password. It works once and expires in 30 minutes.',
  );
}

export async function resetPassword(form: FormData) {
  const token = str(form, 'token');
  const password = String(form.get('new_password') ?? '');
  const here = `/reset-password?token=${encodeURIComponent(token)}`;
  if (password !== String(form.get('confirm_password') ?? ''))
    return back(here, 'error', 'The two passwords do not match.');
  const { error, response } = await (
    await api()
  ).POST('/v1/auth/password/reset', { body: { token, new_password: password } });
  if (error || !response.ok)
    return back(here, 'error', response?.status === 400 ? LINK_PROBLEM : errorMessage(error));
  return back('/login', 'notice', 'Your password has been changed. Log in with your new password.');
}

export async function confirmEmail(form: FormData) {
  const token = str(form, 'token');
  const here = `/verify-email?token=${encodeURIComponent(token)}`;
  const { error } = await (await api()).POST('/v1/auth/email/verify/confirm', { body: { token } });
  if (error) return back(here, 'error', errorMessage(error));
  return back('/login', 'notice', 'Your email address is confirmed.');
}

export async function resendVerification() {
  const { data, error } = await (await api()).POST('/v1/auth/email/verify/request');
  if (!data) return back('/verify-email', 'error', errorMessage(error));
  if (data.status === 'already_verified')
    return back('/verify-email', 'notice', 'Your email address is already confirmed.');
  if (!data.email_delivery)
    return back('/verify-email', 'error', 'Email is not switched on in this environment yet.');
  return back('/verify-email', 'notice', 'We have emailed you a new confirmation link.');
}

// ---- saved searches and job alerts ----
const SEARCH_TYPES = ['full_time', 'part_time', 'casual', 'contract', 'shift'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];

export async function saveSearch(form: FormData) {
  await requireCandidate();
  const q = str(form, 'q');
  const suburb = str(form, 'suburb');
  const type = str(form, 'type');
  const back_to = `/jobs?${new URLSearchParams(
    Object.entries({ q, suburb, type }).filter((e) => e[1]),
  ).toString()}`;
  if (!q && !suburb && !type)
    back(back_to, 'error', 'Choose at least one filter before saving a search.');
  const name = str(form, 'name') || [q, suburb].filter(Boolean).join(' in ') || 'My search';
  const { error } = await (
    await api()
  ).POST('/v1/candidate/saved-searches', {
    body: {
      name: name.slice(0, 200),
      params: {
        q: q || null,
        suburb: suburb || null,
        employment_type: (SEARCH_TYPES as readonly string[]).includes(type)
          ? (type as SearchType)
          : null,
      },
      alerts_enabled: form.get('alerts') === 'on',
    },
  });
  if (error) back(back_to, 'error', errorMessage(error));
  revalidatePath('/saved-searches');
  back('/saved-searches', 'notice', 'Search saved.');
}

export async function setSearchAlerts(form: FormData) {
  await requireCandidate();
  const id = str(form, 'search_id');
  const on = str(form, 'alerts') === 'on';
  const { error } = await (
    await api()
  ).PATCH('/v1/candidate/saved-searches/{search_id}', {
    params: { path: { search_id: id } },
    body: { alerts_enabled: on },
  });
  if (error) back('/saved-searches', 'error', errorMessage(error));
  back('/saved-searches', 'notice', on ? 'Alerts turned on.' : 'Alerts turned off.');
}

export async function deleteSearch(form: FormData) {
  await requireCandidate();
  const { error } = await (
    await api()
  ).DELETE('/v1/candidate/saved-searches/{search_id}', {
    params: { path: { search_id: str(form, 'search_id') } },
  });
  if (error) back('/saved-searches', 'error', errorMessage(error));
  back('/saved-searches', 'notice', 'Search deleted.');
}

// ---- invitations and messages (candidate) ----
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids come from a form, so they are checked before they are put into a redirect path. */
const idOf = (form: FormData, key: string) => {
  const v = str(form, key);
  return UUID.test(v) ? v : null;
};

export async function acceptInvitation(form: FormData) {
  await requireCandidate();
  const id = idOf(form, 'id');
  if (!id) return back('/inbox', 'error', 'That invitation could not be found.');
  const { data, error } = await (
    await api()
  ).POST('/v1/candidate/invitations/{invitation_id}/accept', {
    params: { path: { invitation_id: id } },
    body: { terms_hash: str(form, 'terms_hash') },
  });
  if (!data) return back(`/inbox/invitations/${id}`, 'error', errorMessage(error));
  if (data.conversation_id)
    redirect(
      `/inbox/conversations/${data.conversation_id}?notice=${encodeURIComponent('Accepted. You can now message the employer.')}`,
    );
  back('/inbox', 'notice', 'Accepted.');
}

export async function declineInvitation(form: FormData) {
  await requireCandidate();
  const id = idOf(form, 'id');
  if (!id) return back('/inbox', 'error', 'That invitation could not be found.');
  const { error } = await (
    await api()
  ).POST('/v1/candidate/invitations/{invitation_id}/decline', {
    params: { path: { invitation_id: id } },
  });
  if (error) return back(`/inbox/invitations/${id}`, 'error', errorMessage(error));
  back('/inbox', 'notice', 'Invitation declined. You did not need to give a reason.');
}

export async function setInvitationsEnabled(form: FormData) {
  await requireCandidate();
  const enabled = str(form, 'enabled') === '1';
  const { error } = await (
    await api()
  ).PUT('/v1/candidate/invitation-settings', { body: { enabled } });
  if (error) return back('/inbox', 'error', errorMessage(error));
  back(
    '/inbox',
    'notice',
    enabled
      ? 'Employers can invite you again.'
      : 'New invitations are paused. Existing ones and open conversations are unchanged.',
  );
}

export async function sendCandidateMessage(form: FormData) {
  await requireCandidate();
  const id = idOf(form, 'conversation_id');
  if (!id) return back('/inbox', 'error', 'That conversation could not be found.');
  const { error } = await (
    await api()
  ).POST('/v1/candidate/conversations/{conversation_id}/messages', {
    params: { path: { conversation_id: id } },
    // The key makes a double-submit or a back-button resend create one message, not two.
    body: { body: String(form.get('body') ?? '').trim(), client_key: str(form, 'client_key') },
  });
  if (error) return back(`/inbox/conversations/${id}`, 'error', errorMessage(error));
  redirect(`/inbox/conversations/${id}`);
}

export async function closeConversation(form: FormData) {
  await requireCandidate();
  const id = idOf(form, 'conversation_id');
  if (!id) return back('/inbox', 'error', 'That conversation could not be found.');
  const { error } = await (
    await api()
  ).POST('/v1/candidate/conversations/{conversation_id}/close', {
    params: { path: { conversation_id: id } },
  });
  if (error) return back(`/inbox/conversations/${id}`, 'error', errorMessage(error));
  back(`/inbox/conversations/${id}`, 'notice', 'Conversation ended.');
}

export async function reportConversation(form: FormData) {
  await requireCandidate();
  const id = idOf(form, 'conversation_id');
  if (!id) return back('/inbox', 'error', 'That conversation could not be found.');
  const { error } = await (
    await api()
  ).POST('/v1/candidate/conversations/{conversation_id}/report', {
    params: { path: { conversation_id: id } },
    body: { reason: str(form, 'reason'), message_id: idOf(form, 'message_id') },
  });
  if (error) return back(`/inbox/conversations/${id}`, 'error', errorMessage(error));
  back(
    `/inbox/conversations/${id}`,
    'notice',
    'Thank you. Our team will review this report. Only the reported message is shared with them.',
  );
}

// ---- account settings (candidate): password, devices, deletion ----
export async function changePassword(form: FormData) {
  await requireCandidate();
  const next = String(form.get('new_password') ?? '');
  if (next !== String(form.get('confirm_password') ?? ''))
    back('/account', 'error', 'The new passwords do not match.');
  const { error, response } = await (
    await api()
  ).POST('/v1/account/password', {
    body: { current_password: String(form.get('current_password') ?? ''), new_password: next },
  });
  if (!response.ok) back('/account', 'error', errorMessage(error));
  back('/account', 'notice', 'Password changed. Your other devices have been signed out.');
}

export async function signOutEverywhere() {
  await requireCandidate();
  const { error, response } = await (await api()).POST('/v1/auth/logout-all');
  if (!response.ok) back('/account', 'error', errorMessage(error));
  (await cookies()).delete(COOKIE);
  redirect(
    '/login?notice=' +
      encodeURIComponent(
        'Signed out of all devices. A phone or browser that was already open can keep working for up to 30 minutes.',
      ),
  );
}

export async function deleteAccount(form: FormData) {
  await requireCandidate();
  if (form.get('understand') !== 'on')
    back('/account', 'error', 'Tick the box to confirm you understand this cannot be undone.');
  const { error, response } = await (
    await api()
  ).DELETE('/v1/account', { body: { password: String(form.get('password') ?? '') } });
  if (!response.ok) back('/account', 'error', errorMessage(error));
  (await cookies()).delete(COOKIE);
  redirect('/login?notice=' + encodeURIComponent('Your account and its data have been deleted.'));
}

// ---- work preferences (candidate-private) ----
const WORK_KINDS = ['permanent', 'temporary'] as const;
const WORK_LABEL = { permanent: 'Permanent work', temporary: 'Temporary work' } as const;
const DECIMAL = /^\d+(\.\d{1,2})?$/;

export async function saveWorkPreferences(form: FormData) {
  await requireCandidate();
  const client = await api();
  const saved: string[] = [];
  const stop = (message: string): never =>
    back(
      '/work-preferences',
      'error',
      (saved.length ? `${saved.join(' and ')} saved. ` : 'Nothing was saved. ') + message,
    );
  for (const kind of WORK_KINDS) {
    const enabled = form.get(`${kind}_enabled`) === 'on';
    // A kind that was never set and is still off has nothing to store.
    if (!enabled && str(form, `${kind}_exists`) !== '1') continue;
    const label = WORK_LABEL[kind];
    const decimal = (key: string, what: string) => {
      const v = str(form, `${kind}_${key}`);
      if (v === '') return null;
      if (!DECIMAL.test(v)) return stop(`${label}: ${what} must be a number.`);
      return v;
    };
    const whole = (key: string, what: string) => {
      const v = str(form, `${kind}_${key}`);
      if (v === '') return null;
      if (!/^\d+$/.test(v)) return stop(`${label}: ${what} must be a whole number.`);
      return Number(v);
    };
    const { error } = await client.PUT('/v1/candidate/work-preferences/{kind}', {
      params: { path: { kind } },
      body: {
        enabled,
        engagement_bases: form
          .getAll(`${kind}_engagement`)
          .map(String)
          .filter((v): v is 'employee' | 'contractor' => v === 'employee' || v === 'contractor'),
        hours_patterns: form
          .getAll(`${kind}_hours`)
          .map(String)
          .filter(
            (v): v is 'full_time' | 'part_time' | 'casual' =>
              v === 'full_time' || v === 'part_time' || v === 'casual',
          ),
        min_weekly_hours: decimal('min_weekly', 'The fewest hours a week'),
        max_weekly_hours: decimal('max_weekly', 'The most hours a week'),
        min_hourly_pay: decimal('min_pay', 'The lowest hourly pay'),
        max_travel_km:
          kind === 'temporary' ? whole('travel', 'The furthest you will travel') : null,
        notice_period_days: kind === 'permanent' ? whole('notice', 'The notice period') : null,
        available_from: kind === 'permanent' ? str(form, 'permanent_available_from') || null : null,
      },
    });
    if (error) stop(`${label} was not saved: ${errorMessage(error)}`);
    saved.push(label);
  }
  back(
    '/work-preferences',
    saved.length ? 'notice' : 'error',
    saved.length ? 'Saved to your account.' : 'Choose a kind of work to save.',
  );
}

export async function setKindDiscovery(form: FormData) {
  await requireCandidate();
  const kind = str(form, 'kind');
  if (kind !== 'permanent' && kind !== 'temporary')
    back('/work-preferences', 'error', 'Unknown kind of work.');
  const granted = str(form, 'granted') === '1';
  const { error } = await (
    await api()
  ).PUT('/v1/candidate/consents/discovery/{kind}', {
    params: { path: { kind: kind as 'permanent' | 'temporary' } },
    body: { granted },
  });
  if (error) back('/work-preferences', 'error', errorMessage(error));
  back(
    '/work-preferences',
    'notice',
    granted
      ? 'Employers can now find you for this kind of work.'
      : 'Employers can no longer find you for this kind of work.',
  );
}
