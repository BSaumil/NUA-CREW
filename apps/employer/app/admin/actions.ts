'use server';

import { redirect } from 'next/navigation';
import { api, errorMessage, requireAdmin } from '@/lib/api';
import type { Schemas } from '@nua-crew/contracts';

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const back = (kind: 'error' | 'notice', text: string) =>
  redirect(`/admin?${kind}=${encodeURIComponent(text)}`);

export async function reviewReport(form: FormData) {
  await requireAdmin();
  if (form.get('confirm') !== 'on') back('error', 'Confirm your review decision first.');
  const { error, response } = await (
    await api()
  ).POST('/v1/admin/message-reports/{report_id}/review', {
    params: { path: { report_id: str(form, 'report_id') } },
    body: {
      outcome: str(form, 'outcome') as Schemas['ReviewReportIn']['outcome'],
      reason_code: str(form, 'reason_code') as Schemas['ReviewReportIn']['reason_code'],
    },
  });
  if (!response.ok) back('error', errorMessage(error));
  back('notice', 'Report reviewed. The decision has been recorded.');
}

export async function reviewEmployer(form: FormData) {
  await requireAdmin();
  if (form.get('confirm') !== 'on')
    back('error', 'Confirm that you reviewed the business evidence.');
  const { error, response } = await (
    await api()
  ).POST('/v1/admin/employers/{employer_id}/verification', {
    params: { path: { employer_id: str(form, 'employer_id') } },
    body: {
      status: str(form, 'status') as Schemas['VerifyEmployerIn']['status'],
      evidence: str(form, 'evidence'),
    },
  });
  if (!response.ok) back('error', errorMessage(error));
  back('notice', 'Business review recorded. Verification is not an endorsement.');
}

// ---- award rate verification ----
const INSTRUMENTS = ['MA000003', 'MA000009', 'MA000058', 'MA000119'];
function ratesBack(form: FormData, kind: 'error' | 'notice', text: string) {
  const qs = new URLSearchParams();
  const instrument = str(form, 'instrument_filter');
  const status = str(form, 'status_filter');
  if (INSTRUMENTS.includes(instrument)) qs.set('instrument', instrument);
  if (status === 'verified' || status === 'supplied_unverified') qs.set('status', status);
  qs.set(kind, text);
  redirect(`/admin/rates?${qs.toString()}`);
}
const wholeNumber = (form: FormData, key: string) => {
  const raw = str(form, key);
  const n = Number(raw);
  return raw !== '' && Number.isSafeInteger(n) ? n : null;
};

export async function verifyRate(form: FormData) {
  await requireAdmin();
  if (form.get('confirm') !== 'on')
    ratesBack(form, 'error', 'Confirm that you checked this figure against the official guide.');
  const hourly = wholeNumber(form, 'confirm_hourly_minor');
  if (hourly === null) return ratesBack(form, 'error', 'The checked figure is missing.');
  const { error, response } = await (
    await api()
  ).POST('/v1/admin/awards/rate-versions/{version_id}/verify', {
    params: { path: { version_id: str(form, 'id') } },
    body: { source_note: str(form, 'source_note'), confirm_hourly_minor: hourly },
  });
  if (!response.ok) ratesBack(form, 'error', errorMessage(error));
  ratesBack(form, 'notice', 'Rate marked verified. Your check is recorded against your account.');
}

export async function verifyPenalty(form: FormData) {
  await requireAdmin();
  if (form.get('confirm') !== 'on')
    ratesBack(form, 'error', 'Confirm that you checked this figure against the official guide.');
  const bp = wholeNumber(form, 'confirm_multiplier_bp');
  if (bp === null) return ratesBack(form, 'error', 'The checked figure is missing.');
  const { error, response } = await (
    await api()
  ).POST('/v1/admin/awards/penalty-rules/{rule_id}/verify', {
    params: { path: { rule_id: str(form, 'id') } },
    body: { source_note: str(form, 'source_note'), confirm_multiplier_bp: bp },
  });
  if (!response.ok) ratesBack(form, 'error', errorMessage(error));
  ratesBack(form, 'notice', 'Rule marked verified. Your check is recorded against your account.');
}

export async function revokeRate(form: FormData) {
  await requireAdmin();
  const { error, response } = await (
    await api()
  ).POST('/v1/admin/awards/rate-versions/{version_id}/revoke', {
    params: { path: { version_id: str(form, 'id') } },
    body: { reason: str(form, 'reason') },
  });
  if (!response.ok) ratesBack(form, 'error', errorMessage(error));
  ratesBack(form, 'notice', 'Verification withdrawn. The figures were not changed.');
}

export async function revokePenalty(form: FormData) {
  await requireAdmin();
  const { error, response } = await (
    await api()
  ).POST('/v1/admin/awards/penalty-rules/{rule_id}/revoke', {
    params: { path: { rule_id: str(form, 'id') } },
    body: { reason: str(form, 'reason') },
  });
  if (!response.ok) ratesBack(form, 'error', errorMessage(error));
  ratesBack(form, 'notice', 'Verification withdrawn. The figures were not changed.');
}
