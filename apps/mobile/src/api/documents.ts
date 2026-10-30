import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@nua-crew/contracts';
import { api, authFetch, unwrap, unwrapVoid, ApiFailure } from './client';
import { session, SessionChangedError } from './session';
import { API_URL } from '@/lib/config';

export const documentKey = ['private-documents'] as const;
export type DocumentMetadata = Schemas['DocumentIn'];
export const useDocuments = () =>
  useQuery({
    queryKey: documentKey,
    queryFn: async () => unwrap(await api.GET('/v1/candidate/documents')),
  });
export const useDocumentStatus = () =>
  useQuery({
    queryKey: ['document-status'],
    queryFn: async () => unwrap(await api.GET('/v1/documents/status')),
  });
export function ensureDocumentSession(revision: number) {
  if (revision !== session.generation()) throw new SessionChangedError();
}

export async function uploadDocument(
  metadata: DocumentMetadata,
  bytes: Uint8Array,
  revision: number,
) {
  ensureDocumentSession(revision);
  const reserved = unwrap(await api.POST('/v1/candidate/documents', { body: metadata }));
  ensureDocumentSession(revision);
  const response = await authFetch(
    new Request(`${API_URL}/v1/candidate/documents/${reserved.id}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': metadata.content_type },
      body: new Uint8Array(bytes).buffer,
    }),
  );
  const data = await response.json();
  ensureDocumentSession(revision);
  if (!response.ok)
    throw new ApiFailure(
      data.error?.message ?? 'Document upload failed. Retry safely.',
      response.status,
    );
  return data as Schemas['DocumentOut'];
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      metadata,
      bytes,
      revision,
    }: {
      metadata: DocumentMetadata;
      bytes: Uint8Array;
      revision: number;
    }) => uploadDocument(metadata, bytes, revision),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: documentKey });
    },
  });
}
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrapVoid(
        await api.DELETE('/v1/candidate/documents/{document_id}', {
          params: { path: { document_id: id } },
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: documentKey });
    },
  });
}

export async function downloadPrivateDocument(
  path: string,
  type: string,
  stillActive: () => boolean,
) {
  const revision = session.generation();
  const response = await authFetch(new Request(`${API_URL}${path}`));
  if (!response.ok) throw new ApiFailure('This document is unavailable.', response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  ensureDocumentSession(revision);
  if (!stillActive()) throw new SessionChangedError();
  const { File, Paths } = await import('expo-file-system');
  const { shareAsync } = await import('expo-sharing');
  const { randomUUID } = await import('expo-crypto');
  const suffix = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : 'jpg';
  const file = new File(Paths.cache, `nua-document-${randomUUID()}.${suffix}`);
  let cleanupFailed = false;
  try {
    file.write(bytes);
    ensureDocumentSession(revision);
    if (!stillActive()) throw new SessionChangedError();
    await shareAsync(file.uri, { mimeType: type, dialogTitle: 'Open or share this document' });
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed)
    throw new Error('The temporary copy could not be removed. Clear the app cache on this device.');
}
