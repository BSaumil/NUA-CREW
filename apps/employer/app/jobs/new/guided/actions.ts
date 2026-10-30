'use server';

import { redirect } from 'next/navigation';
import { api, errorMessage, requireEmployer } from '@/lib/api';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (path: string, kind: 'error' | 'notice', msg: string) =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

const KEEP = ['venue', 'role', 'inst', 'loc', 'pay_max', 'q', 'dept'] as const;
const carry = (form: FormData, step: number, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams({ step: String(step) });
  for (const k of KEEP) {
    const v = str(form, k);
    if (v) p.set(k, v);
  }
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return `/jobs/new/guided?${p.toString()}`;
};

/** Runs the server-side pay assessment. The employer, not the title, confirms the classification. */
export async function runPayCheck(form: FormData) {
  const { employerId } = await requireEmployer();
  const client = await api();
  const locationId = str(form, 'loc');
  const { data: locations } = await client.GET('/v1/employers/{employer_id}/locations', {
    params: { path: { employer_id: employerId } },
  });
  const location = locations?.find((l) => l.id === locationId);
  if (!location) return back(carry(form, 3), 'error', 'Choose where this job is based.');
  const rate = str(form, 'pay_min');
  if (!rate) return back(carry(form, 3), 'error', 'Enter the hourly rate you plan to pay.');
  const instrument = str(form, 'inst') || 'unknown';
  const { data, error } = await client.POST('/v1/employers/{employer_id}/pay-assessments', {
    params: { path: { employer_id: employerId } },
    body: {
      state: location.state as never,
      role_code: str(form, 'role') || null,
      employer_venue_type: str(form, 'venue') || null,
      instrument: instrument as never,
      coverage_confirmed: form.get('coverage_confirmed') === 'on',
      classification: str(form, 'classification') || null,
      classification_confirmed: form.get('classification_confirmed') === 'on',
      employment: (str(form, 'employment') || 'casual') as never,
      worker_class: (str(form, 'worker_class') || 'adult') as never,
      pay_period: 'hour',
      pay_amount: rate,
      pay_includes_super: false,
      rate_structure: (str(form, 'rate_structure') || 'base_plus_penalties') as never,
      roster: [],
    },
  });
  if (!data) return back(carry(form, 3), 'error', errorMessage(error));
  redirect(carry(form, 4, { a: data.id, pay_min: rate }));
}

/** Creates the draft with the role and the stored pay check attached. Publishing re-checks. */
export async function createGuidedJob(form: FormData) {
  const { employerId } = await requireEmployer();
  const client = await api();
  const assessmentId = str(form, 'a');
  const here = carry(form, 4, { a: assessmentId, pay_min: str(form, 'pay_min') });
  const { data: a } = await client.GET(
    '/v1/employers/{employer_id}/pay-assessments/{assessment_id}',
    {
      params: { path: { employer_id: employerId, assessment_id: assessmentId } },
    },
  );
  if (!a) return back(here, 'error', 'That pay check could not be found. Run it again.');
  if (a.result.status === 'below_minimum')
    return back(here, 'error', 'Raise the rate to at least the award minimum first.');
  if (a.result.needs_acknowledgement) {
    if (form.get('acknowledge') !== 'on')
      return back(here, 'error', 'Confirm that you have reviewed this pay before continuing.');
    const ack = await client.POST(
      '/v1/employers/{employer_id}/pay-assessments/{assessment_id}/acknowledge',
      {
        params: { path: { employer_id: employerId, assessment_id: assessmentId } },
        body: { note: 'Reviewed in the guided job flow' },
      },
    );
    if (ack.error) return back(here, 'error', errorMessage(ack.error));
  }
  const input = a.input as Record<string, string>;
  const skills = str(form, 'skills')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const payMax = str(form, 'pay_max');
  const { data, error } = await client.POST('/v1/employers/{employer_id}/jobs', {
    params: { path: { employer_id: employerId } },
    body: {
      title: str(form, 'title'),
      description: str(form, 'description'),
      employment_type: (input.employment ?? 'casual') as never,
      category: 'Hospitality',
      location_id: str(form, 'loc') || null,
      pay_min: input.pay_amount,
      pay_max: payMax || input.pay_amount,
      pay_period: 'hour',
      super_included: false,
      hours_pattern: (input.employment ?? 'unspecified') as never,
      skills,
      role_code: input.role_code ?? null,
      pay_assessment_id: assessmentId,
    } as never,
  });
  if (!data) return back(here, 'error', errorMessage(error));
  redirect(
    `/jobs/${data.id}?notice=${encodeURIComponent('Draft saved with its pay check. Publish when ready.')}`,
  );
}
