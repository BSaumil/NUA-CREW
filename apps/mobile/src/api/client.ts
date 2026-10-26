import { createApi, errorMessage } from '@nua-crew/api-client';
import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { session } from './session';

/** fetch that adds the bearer token, times out, and retries once after a 401 via token refresh. */
export async function authFetch(input: Request): Promise<Response> {
  const retry = input.clone();
  const attempt = async (req: Request, token: string | null) => {
    if (token) req.headers.set('Authorization', `Bearer ${token}`);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await session.fetchImpl(req, { signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  const res = await attempt(input, await session.getAccessToken());
  if (res.status !== 401) return res;
  const fresh = await session.refreshNow();
  if (!fresh) return res; // session is gone; the auth gate will route to sign-in
  return attempt(retry, fresh);
}

export const api = createApi({ baseUrl: API_URL, fetch: authFetch });

export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Unwraps an openapi-fetch result, turning API errors into one readable exception type. */
export function unwrap<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.data !== undefined && r.response.ok) return r.data;
  const code = (r.error as { error?: { code?: string } } | undefined)?.error?.code;
  throw new ApiFailure(errorMessage(r.error), r.response.status, code);
}

export function messageOf(e: unknown): string {
  if (e instanceof ApiFailure) return e.message;
  if (e instanceof Error && e.name === 'AbortError')
    return 'The request timed out. Check your connection.';
  return 'We could not reach NUA CREW. Check your connection and try again.';
}

/** For endpoints that return 204 No Content. */
export function unwrapVoid(r: { error?: unknown; response: Response }): void {
  if (r.response.ok) return;
  const code = (r.error as { error?: { code?: string } } | undefined)?.error?.code;
  throw new ApiFailure(errorMessage(r.error), r.response.status, code);
}
