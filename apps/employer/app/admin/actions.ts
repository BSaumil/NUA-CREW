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
