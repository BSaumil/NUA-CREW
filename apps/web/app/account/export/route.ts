import { api, requireCandidate } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Downloads everything NUA CREW holds about the signed-in person. Never cached or indexed. */
export async function GET() {
  await requireCandidate();
  const { data } = await (await api()).GET('/v1/account/export');
  const headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex',
  };
  if (!data)
    return new Response('We could not prepare your export. Please try again.', {
      status: 502,
      headers,
    });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...headers,
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="nua-crew-my-data.json"',
    },
  });
}
