import { createApi, errorMessage } from '@nua-crew/api-client';
import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { session, SessionChangedError } from './session';

const NULL_BODY = new Set([101, 204, 205, 304]);

/**
 * Read the whole body NOW, then confirm the signed-in account has not changed, then hand back a
 * response that is already fully decoded. Without this, a slow body for an old account could finish
 * decoding after sign-out and be shown to (or cached for) whoever signs in next.
 */
async function sealed(res: Response, gen: number): Promise<Response> {
  const body = await res.arrayBuffer();
  if (session.gen !== gen) throw new SessionChangedError();
  const hasBody = body.byteLength > 0 && !NULL_BODY.has(res.status);
  return new Response(hasBody ? body : null, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/**
 * fetch that adds the bearer token, times out, and — after a 401 — refreshes the SAME sign-in and
 * retries once. Everything is bound to the sign-in generation that started the request: if the
 * account changes mid-flight the result is discarded and the request is never replayed with the
 * new account's credentials.
 */
export async function authFetch(input: Request): Promise<Response> {
  const retry = input.clone();
  const { token, gen } = await session.snapshot();
  const send = async (req: Request, bearer: string | null) => {
    if (bearer) req.headers.set('Authorization', `Bearer ${bearer}`);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await session.fetchImpl(req, { signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const res = await send(input, token);
  if (session.gen !== gen) throw new SessionChangedError();
  if (res.status !== 401 || !token) return sealed(res, gen);

  const fresh = await session.refreshNow();
  if (!fresh || session.gen !== gen) {
    // A different person is now signed in: discard. Otherwise the server rejected our refresh (or
    // the person signed out meanwhile): answer with a bare 401 and never the old body.
    if (session.gen !== gen && session.signedIn) throw new SessionChangedError();
    return new Response(null, { status: 401 }); // the auth gate will route to sign-in
  }
  const again = await send(retry, fresh);
  if (session.gen !== gen) throw new SessionChangedError();
  return sealed(again, gen);
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

/** An error whose message is written for the person using the app and may be shown as-is. */
export class UserMessage extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserMessage';
  }
}

export function messageOf(e: unknown): string {
  if (e instanceof ApiFailure || e instanceof UserMessage) return e.message;
  if (e instanceof SessionChangedError) return 'Your session changed. Please try again.';
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
