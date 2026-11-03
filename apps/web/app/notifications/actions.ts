'use server';
import { redirect } from 'next/navigation';
import { api, requireCandidate, errorMessage } from '@/lib/api';
export async function markRead(form: FormData) {
  await requireCandidate();
  const r = await (
    await api()
  ).POST('/v1/notifications/{notification_id}/read', {
    params: { path: { notification_id: String(form.get('id') ?? '') } },
  });
  redirect(
    '/notifications' + (r.error ? '?error=' + encodeURIComponent(errorMessage(r.error)) : ''),
  );
}
export async function markAllRead() {
  await requireCandidate();
  const r = await (await api()).POST('/v1/notifications/read-all');
  redirect(
    '/notifications' +
      (!r.response.ok
        ? '?error=' + encodeURIComponent('Read status could not be saved. Try again.')
        : ''),
  );
}
