'use server';
import { redirect } from 'next/navigation';
import { api, canWrite, errorMessage, requireEmployer } from '@/lib/api';
const v = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (kind: string, text: string): never =>
  redirect(`/shifts?${kind}=${encodeURIComponent(text)}`);
export async function shiftAction(f: FormData) {
  const { employerId, role } = await requireEmployer();
  if (!canWrite(role)) back('error', 'Only owners and recruiters can change shifts.');
  if (f.get('confirm') !== 'on') back('error', 'Confirm this action first.');
  const client = await api();
  const action = v(f, 'action');
  const shift = { path: { employer_id: employerId, shift_id: v(f, 'shift') } };
  const result =
    action === 'create'
      ? await client.POST('/v1/employers/{employer_id}/shifts', {
          params: { path: { employer_id: employerId } },
          body: {
            job_id: v(f, 'job'),
            local_date: v(f, 'date'),
            local_start: v(f, 'start'),
            local_end: v(f, 'end'),
            time_zone: v(f, 'zone'),
            capacity: Number(v(f, 'capacity')),
            hourly_rate_minor: Math.round(Number(v(f, 'rate')) * 100),
          },
        })
      : action === 'offer'
        ? await client.POST('/v1/employers/{employer_id}/shifts/{shift_id}/offers', {
            params: shift,
            body: { conversation_id: v(f, 'conversation') },
          })
        : action === 'cancel'
          ? await client.POST('/v1/employers/{employer_id}/shifts/{shift_id}/cancel', {
              params: shift,
              body: { reason: v(f, 'reason') },
            })
          : action === 'approved' || action === 'disputed'
            ? await client.POST(
                '/v1/employers/{employer_id}/shift-bookings/{booking_id}/timesheet-review',
                {
                  params: { path: { employer_id: employerId, booking_id: v(f, 'booking') } },
                  body: {
                    decision: action,
                    expected_version: Number(v(f, 'version')),
                    reason: v(f, 'reason'),
                  },
                },
              )
            : null;
  if (!result) return back('error', 'Choose an available action.');
  if (result.error) back('error', errorMessage(result.error));
  back('notice', 'Shift record updated. No wages were processed.');
}

export async function reviewCorrection(f: FormData) {
  const { employerId, role } = await requireEmployer();
  if (!canWrite(role)) back('error', 'Only owners and recruiters can review attendance.');
  if (f.get('confirm') !== 'on') back('error', 'Confirm the attendance review.');
  const decision = v(f, 'decision');
  if (decision !== 'approved' && decision !== 'rejected')
    back('error', 'Choose an available review.');
  const r = await (
    await api()
  ).POST(
    '/v1/employers/{employer_id}/shift-bookings/{booking_id}/attendance-corrections/{event_id}/review',
    {
      params: {
        path: { employer_id: employerId, booking_id: v(f, 'booking'), event_id: v(f, 'event') },
      },
      body: { decision: decision as 'approved' | 'rejected', reason: v(f, 'reason') },
    },
  );
  if (r.error) back('error', errorMessage(r.error));
  back('notice', 'Attendance review recorded. The worker can see your decision.');
}
