import { API_BASE, getToken, requireEmployer } from '@/lib/api';
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { employerId } = await requireEmployer();
  const { id, documentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(documentId))
    return new Response('Not found', { status: 404 });
  const result = await fetch(
    `${API_BASE}/v1/employers/${employerId}/applications/${id}/documents/${documentId}/content`,
    { headers: { Authorization: `Bearer ${await getToken()}` }, cache: 'no-store' },
  );
  if (!result.ok) return new Response('Document unavailable', { status: result.status });
  return new Response(result.body, {
    headers: {
      'Content-Type': result.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': result.headers.get('content-disposition') ?? 'attachment',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  });
}
