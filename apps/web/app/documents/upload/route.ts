import { NextResponse } from 'next/server';
import { API_BASE, getToken, requireCandidate } from '@/lib/api';

export async function POST(request: Request) {
  await requireCandidate();
  const token = await getToken();
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return NextResponse.json({ message: 'Please upload from NUA CREW.' }, { status: 403 });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ message: 'Choose a file.' }, { status: 422 });
  const chunks: ArrayBuffer[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > 4 * 1024 * 1024 + 65536) {
      await reader.cancel();
      return NextResponse.json({ message: 'Choose a file up to 4 MB.' }, { status: 413 });
    }
    chunks.push(new Uint8Array(chunk.value).buffer);
  }
  let form: FormData;
  try {
    form = await new Response(new Blob(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    return NextResponse.json({ message: 'Choose a valid document upload.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
    return NextResponse.json({ message: 'Choose a file up to 4 MB.' }, { status: 422 });
  const value = (key: string) => String(form.get(key) ?? '').trim();
  const metadata = {
    kind: value('kind'),
    title: value('title'),
    filename: file.name,
    content_type: file.type,
    size_bytes: file.size,
    client_key: value('client_key'),
    issuer: value('issuer') || null,
    jurisdiction: value('jurisdiction') || null,
    completed_on: value('completed_on') || null,
    review_due_on: value('review_due_on') || null,
  };
  try {
    const reserved = await fetch(`${API_BASE}/v1/candidate/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const body = await reserved.json();
    if (!reserved.ok)
      return NextResponse.json(
        { message: body.error?.message ?? 'Check the document details.' },
        { status: reserved.status },
      );
    const result = await fetch(`${API_BASE}/v1/candidate/documents/${body.id}/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
      body: await file.arrayBuffer(),
      cache: 'no-store',
      signal: AbortSignal.timeout(60000),
    });
    if (!result.ok) {
      const error = await result.json();
      return NextResponse.json(
        { message: error.error?.message ?? 'The upload failed. Retry safely.' },
        { status: result.status },
      );
    }
    return NextResponse.json({
      message: 'Document saved. It has not been verified as a qualification.',
    });
  } catch {
    return NextResponse.json(
      { message: 'The upload was interrupted. Retry the same file safely.' },
      { status: 503 },
    );
  }
}
