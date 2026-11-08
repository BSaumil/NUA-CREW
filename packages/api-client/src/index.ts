import createClient, { type Middleware } from 'openapi-fetch';
import type { paths, Schemas } from '@nua-crew/contracts';

export type { Schemas };

export type ApiOptions = {
  baseUrl: string;
  token?: string | null;
  /**
   * Vercel's "Protection Bypass for Automation" secret, for a server-side caller reaching an API that
   * sits behind Vercel Authentication. Sent as `x-vercel-protection-bypass`. Server code only: never
   * pass a value from a `NEXT_PUBLIC_` variable, a browser, or a mobile app.
   */
  bypassSecret?: string | null;
  /** Custom transport; receives the fully built Request (openapi-fetch calls `fetch(request)`). */
  fetch?: (input: Request) => Promise<Response>;
};

/** Typed client generated from the API's OpenAPI document. Never logs bodies (PII). */
export function createApi({ baseUrl, token, bypassSecret, fetch: f }: ApiOptions) {
  const client = createClient<paths>({ baseUrl, ...(f ? { fetch: f } : {}) });
  if (token) {
    const auth: Middleware = {
      onRequest({ request }) {
        request.headers.set('Authorization', `Bearer ${token}`);
        return request;
      },
    };
    client.use(auth);
  }
  if (bypassSecret) {
    const bypass: Middleware = {
      onRequest({ request }) {
        request.headers.set('x-vercel-protection-bypass', bypassSecret);
        return request;
      },
    };
    client.use(bypass);
  }
  return client;
}

export type ApiError = { code: string; message: string };

/** Normalises the API's `{error:{code,message}}` and FastAPI's 422 `{detail:[...]}` shapes. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const e = error as { error?: ApiError; detail?: { loc?: unknown[]; msg?: string }[] } | undefined;
  if (e?.error?.message) return e.error.message;
  if (Array.isArray(e?.detail) && e.detail.length) {
    return e.detail
      .map((d) => `${(d.loc ?? []).slice(1).join('.') || 'input'}: ${d.msg ?? 'invalid'}`)
      .join('; ');
  }
  return fallback;
}
