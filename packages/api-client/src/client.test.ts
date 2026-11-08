import { describe, expect, it } from 'vitest';
import { createApi, errorMessage } from './index';

describe('createApi', () => {
  it('sends the bearer token and hits typed paths', async () => {
    let seen: Request | undefined;
    const api = createApi({
      baseUrl: 'http://api.test',
      token: 'tok',
      fetch: (async (req: Request) => {
        seen = req;
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }), {
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const { data } = await api.GET('/v1/jobs', { params: { query: { q: 'coffee' } } });
    expect(data?.total).toBe(0);
    expect(seen?.headers.get('authorization')).toBe('Bearer tok');
    expect(new URL(seen!.url).searchParams.get('q')).toBe('coffee');
  });
});

describe('createApi protection bypass', () => {
  const respond = (seen: { req?: Request }) =>
    (async (req: Request) => {
      seen.req = req;
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

  it('sends the bypass header only when a secret is given', async () => {
    const withSecret: { req?: Request } = {};
    await createApi({
      baseUrl: 'http://api.test',
      bypassSecret: 's3cret',
      fetch: respond(withSecret),
    }).GET('/v1/jobs');
    expect(withSecret.req?.headers.get('x-vercel-protection-bypass')).toBe('s3cret');

    for (const empty of [undefined, null, '']) {
      const without: { req?: Request } = {};
      await createApi({
        baseUrl: 'http://api.test',
        bypassSecret: empty,
        fetch: respond(without),
      }).GET('/v1/jobs');
      expect(without.req?.headers.has('x-vercel-protection-bypass')).toBe(false);
    }
  });

  it('sends the bypass header alongside the bearer token', async () => {
    const seen: { req?: Request } = {};
    await createApi({
      baseUrl: 'http://api.test',
      token: 'tok',
      bypassSecret: 's3cret',
      fetch: respond(seen),
    }).GET('/v1/jobs');
    expect(seen.req?.headers.get('authorization')).toBe('Bearer tok');
    expect(seen.req?.headers.get('x-vercel-protection-bypass')).toBe('s3cret');
  });
});

describe('errorMessage', () => {
  it('reads API and validation error shapes', () => {
    expect(errorMessage({ error: { code: 'x', message: 'Nope' } })).toBe('Nope');
    expect(errorMessage({ detail: [{ loc: ['body', 'email'], msg: 'bad' }] })).toBe('email: bad');
    expect(errorMessage(undefined)).toMatch(/try again/);
  });
});
