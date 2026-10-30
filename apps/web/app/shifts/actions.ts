'use server';
import { redirect } from 'next/navigation';
import { api, errorMessage, requireCandidate } from '@/lib/api';
const value = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (kind: string, text: string): never =>
  redirect(`/shifts?${kind}=${encodeURIComponent(text)}`);
export async function bookingAction(f: FormData) {
  await requireCandidate();
  if (f.get('confirm') !== 'on') back('error', 'Confirm your decision first.');
  const action = value(f, 'action');
  const client = await api();
  const params = { path: { booking_id: value(f, 'booking_id') } };
  const result =
    action === 'check_in'
      ? await client.POST('/v1/candidate/shift-bookings/{booking_id}/check-in', { params })
      : action === 'check_out'
        ? await client.POST('/v1/candidate/shift-bookings/{booking_id}/check-out', { params })
        : action === 'accept' || action === 'decline' || action === 'cancel'
          ? await client.POST('/v1/candidate/shift-bookings/{booking_id}/respond', {
              params,
              body: { action, reason: value(f, 'reason') || null },
            })
          : null;
  if (!result) return back('error', 'Choose an available shift action.');
  if (result.error) back('error', errorMessage(result.error));
  back('notice', 'Your shift record has been updated.');
}
export async function submitHours(f: FormData) {
  await requireCandidate();
  if (f.get('confirm') !== 'on') back('error', 'Confirm your actual hours first.');
  const { error } = await (
    await api()
  ).PUT('/v1/candidate/shift-bookings/{booking_id}/timesheet', {
    params: { path: { booking_id: value(f, 'booking_id') } },
    body: {
      local_date: value(f, 'date'),
      local_start: value(f, 'start'),
      local_end: value(f, 'end'),
      time_zone: value(f, 'zone'),
      break_minutes: Number(value(f, 'break')),
      note: value(f, 'note') || null,
    },
  });
  if (error) back('error', errorMessage(error));
  back('notice', 'Actual hours submitted for review.');
}

export async function requestCorrection(f: FormData) {
  await requireCandidate();
  if (f.get('confirm') !== 'on') back('error', 'Confirm the correction first.');
  const kind = value(f, 'kind');
  if (kind !== 'check_in' && kind !== 'check_out') back('error', 'Choose check-in or check-out.');
  const r = await (
    await api()
  ).POST('/v1/candidate/shift-bookings/{booking_id}/attendance-corrections', {
    params: { path: { booking_id: value(f, 'booking_id') } },
    body: {
      claim_kind: kind as 'check_in' | 'check_out',
      local_date: value(f, 'date'),
      local_time: value(f, 'time'),
      reason: value(f, 'reason'),
    },
  });
  if (r.error) back('error', errorMessage(r.error));
  back('notice', 'Correction sent for review. Your original record stays in history.');
}
