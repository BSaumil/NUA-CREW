import { authFetch } from '../src/api/client';
import { session } from '../src/api/session';

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : (input as Request).url;
const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(async () => {
  await session.clear();
  session.fetchImpl = (...a) => fetch(...a);
});

describe('authFetch', () => {
  it('adds the bearer token and retries once with a fresh token after a 401', async () => {
    await session.start({
      access_token: 'old',
      refresh_token: 'r1',
      expires_in: 1800,
      role: 'candidate',
      user_id: 'u',
    });
    const seen: string[] = [];
    session.fetchImpl = (async (input: RequestInfo | URL) => {
      const req = input as Request;
      if (urlOf(input).endsWith('/v1/auth/refresh'))
        return res(200, {
          access_token: 'new',
          refresh_token: 'r2',
          expires_in: 1800,
          role: 'candidate',
          user_id: 'u',
        });
      seen.push(req.headers.get('authorization') ?? '');
      return seen.length === 1
        ? res(401, { error: { code: 'invalid_token', message: 'x' } })
        : res(200, { ok: true });
    }) as typeof fetch;
    const r = await authFetch(new Request('http://api.test/v1/candidate/profile'));
    expect(r.status).toBe(200);
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
  });

  it('does not loop when the session cannot be refreshed', async () => {
    await session.start({
      access_token: 'old',
      refresh_token: 'r1',
      expires_in: 1800,
      role: 'candidate',
      user_id: 'u',
    });
    let calls = 0;
    session.fetchImpl = (async (input: RequestInfo | URL) => {
      calls++;
      return urlOf(input).endsWith('/v1/auth/refresh')
        ? res(401)
        : res(401, { error: { code: 'invalid_token', message: 'x' } });
    }) as typeof fetch;
    const r = await authFetch(new Request('http://api.test/v1/jobs'));
    expect(r.status).toBe(401);
    expect(calls).toBe(2); // the request, then one refresh attempt — never more
  });

  it('passes other statuses through untouched', async () => {
    await session.start({
      access_token: 'a',
      refresh_token: 'r1',
      expires_in: 1800,
      role: 'candidate',
      user_id: 'u',
    });
    session.fetchImpl = (async () => res(404)) as typeof fetch;
    expect((await authFetch(new Request('http://api.test/x'))).status).toBe(404);
  });
});

describe('authFetch across account changes', () => {
  it('discards a response that finishes after sign-out and never replays it for a new account', async () => {
    await session.start({
      access_token: 'old',
      refresh_token: 'r1',
      expires_in: 1800,
      role: 'candidate',
      user_id: 'a',
    });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const seen: string[] = [];
    session.fetchImpl = (async (input: RequestInfo | URL) => {
      seen.push((input as Request).headers.get('Authorization') ?? '');
      await gate;
      return res(401, { error: { code: 'invalid_token', message: 'x' } });
    }) as typeof fetch;
    const pending = authFetch(new Request('http://api.test/v1/me'));
    await new Promise((r) => setTimeout(r, 0));
    await session.clear();
    await session.start({
      access_token: 'new',
      refresh_token: 'r9',
      expires_in: 1800,
      role: 'candidate',
      user_id: 'b',
    });
    release();
    await expect(pending).rejects.toMatchObject({ name: 'SessionChangedError' });
    expect(seen).toEqual(['Bearer old']); // the old request was never re-sent with 'new'
  });
});
