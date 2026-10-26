import type { Href } from 'expo-router';

type Data = Record<string, unknown> | null | undefined;

/** Where a tapped notification (or deep link payload) should go. Pure so it is easy to test. */
export function routeFor(kind: string | undefined, data: Data): Href {
  const str = (k: string) => (typeof data?.[k] === 'string' ? (data[k] as string) : undefined);
  if (kind?.startsWith('application.') && str('application_id')) {
    return { pathname: '/application/[id]', params: { id: str('application_id')! } };
  }
  if (kind === 'job.alert') {
    const first = Array.isArray(data?.job_ids)
      ? (data.job_ids as unknown[]).find((x) => typeof x === 'string')
      : undefined;
    if (typeof first === 'string') return { pathname: '/job/[id]', params: { id: first } };
    return '/(app)/discover';
  }
  return '/(app)/alerts';
}
