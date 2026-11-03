'use server';
import { redirect } from 'next/navigation';
import { api, requireCandidate, errorMessage } from '@/lib/api';

export async function deleteDocument(form: FormData) {
  await requireCandidate();
  const id = String(form.get('id') ?? '');
  const { error } = await (
    await api()
  ).DELETE('/v1/candidate/documents/{document_id}', { params: { path: { document_id: id } } });
  redirect(
    '/documents?' +
      (error
        ? 'error=' + encodeURIComponent(errorMessage(error))
        : 'notice=Document%20removed.%20Stored%20bytes%20are%20queued%20for%20deletion.'),
  );
}
