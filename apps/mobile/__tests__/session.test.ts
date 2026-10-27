import * as SecureStore from 'expo-secure-store';
import { Session, type TokenResponse } from '../src/api/session';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const res = (status: number, body: unknown = {}) =>
  ({ ok: status < 300, status, json: async () => body }) as Response;
const tokens = (n: number, expires_in = 1800): TokenResponse => ({
  access_token: `access-${n}`,
  refresh_token: `refresh-${n}`,
  expires_in,
  role: 'candidate',
  user_id: 'u',
});

let t = 1_000_000;
function make(fetchImpl: jest.Mock) {
  const s = new Session();
  s.fetchImpl = fetchImpl as unknown as typeof fetch;
  s.now = () => t;
  return s;
}
beforeEach(() => {
  store.clear();
  t = 1_000_000;
});

describe('Session', () => {
  it('keeps the access token in memory and the refresh token in secure storage', async () => {
    const f = jest.fn();
    const s = make(f);
    await s.start(tokens(1));
    expect(await s.getAccessToken()).toBe('access-1');
    expect(store.get('nua.refresh')).toBe('refresh-1');
    expect(f).not.toHaveBeenCalled();
  });

  it('refreshes a minute before expiry and stores the rotated refresh token', async () => {
    const f = jest.fn().mockResolvedValue(res(200, tokens(2)));
    const s = make(f);
    await s.start(tokens(1, 1800));
    t += 1800 * 1000 - 30_000; // 30s left: inside the early-refresh window
    expect(await s.getAccessToken()).toBe('access-2');
    expect(store.get('nua.refresh')).toBe('refresh-2');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ refresh_token: 'refresh-1' });
  });

  it('shares one refresh between concurrent callers (refresh tokens are single-use)', async () => {
    let release!: (r: Response) => void;
    const f = jest.fn().mockReturnValue(new Promise<Response>((r) => (release = r)));
    const s = make(f);
    await s.start(tokens(1, 10));
    const calls = Promise.all([s.getAccessToken(), s.getAccessToken(), s.refreshNow()]);
    await new Promise((r) => setTimeout(r, 0));
    release(res(200, tokens(2)));
    expect(await calls).toEqual(['access-2', 'access-2', 'access-2']);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('signs the user out when the server rejects the refresh token', async () => {
    const f = jest.fn().mockResolvedValue(res(401));
    const s = make(f);
    const seen: boolean[] = [];
    s.subscribe((v) => seen.push(v));
    await s.start(tokens(1, 10));
    expect(await s.getAccessToken()).toBeNull();
    expect(store.has('nua.refresh')).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('stays signed in when the network or server is down', async () => {
    const f = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(res(503));
    const s = make(f);
    await s.start(tokens(1, 10));
    expect(await s.getAccessToken()).toBeNull();
    expect(await s.refreshNow()).toBeNull();
    expect(store.get('nua.refresh')).toBe('refresh-1'); // not wiped by a blip
  });

  it('restores a stored session at launch, or reports none', async () => {
    const f = jest.fn().mockResolvedValue(res(200, tokens(5)));
    expect(await make(f).restore()).toBe(false);
    store.set('nua.refresh', 'refresh-4');
    expect(await make(f).restore()).toBe(true);
    expect(store.get('nua.refresh')).toBe('refresh-5');
  });

  it('tells the server on sign-out and forgets everything locally', async () => {
    const f = jest.fn().mockResolvedValue(res(204));
    const s = make(f);
    await s.start(tokens(1));
    await s.signOut();
    expect(f.mock.calls[0][0]).toContain('/v1/auth/logout');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ refresh_token: 'refresh-1' });
    expect(store.size).toBe(0);
    expect(await s.getAccessToken()).toBeNull();
  });
});

it('does not restore a session when a refresh succeeds after sign-out', async () => {
  let release!: (r: Response) => void;
  const f = jest.fn().mockImplementation((url: string) =>
    url.endsWith('/refresh')
      ? new Promise<Response>((r) => {
          release = r;
        })
      : Promise.resolve(res(204)),
  );
  const s = make(f);
  await s.start(tokens(1));
  const pending = s.refreshNow();
  await new Promise((r) => setTimeout(r, 0));
  await s.signOut();
  release(res(200, tokens(2)));
  expect(await pending).toBeNull();
  expect(store.has('nua.refresh')).toBe(false);
  expect(await s.getAccessToken()).toBeNull();
});

it('does not let an old refresh failure clear a newer signed-in account', async () => {
  let release!: (r: Response) => void;
  const s = make(
    jest.fn().mockReturnValue(
      new Promise<Response>((r) => {
        release = r;
      }),
    ),
  );
  await s.start(tokens(1));
  const pending = s.refreshNow();
  await new Promise((r) => setTimeout(r, 0));
  await s.start({ ...tokens(9), user_id: 'another-user' });
  release(res(401));
  expect(await pending).toBeNull();
  expect(await s.getAccessToken()).toBe('access-9');
  expect(store.get('nua.refresh')).toBe('refresh-9');
});

it('rejects a login result that was issued before local sign-out', async () => {
  const s = make(jest.fn());
  const revision = s.generation();
  await s.clear();
  expect(await s.start(tokens(1), revision)).toBe(false);
  expect(store.size).toBe(0);
});

it('does not publish a signed-in session when the Keychain write fails', async () => {
  const write = jest
    .spyOn(SecureStore, 'setItemAsync')
    .mockRejectedValueOnce(new Error('unavailable'));
  const s = make(jest.fn());
  const listener = jest.fn();
  s.subscribe(listener);
  await expect(s.start(tokens(1))).rejects.toThrow('could not save secure sign-in storage');
  expect(listener).not.toHaveBeenCalledWith(true);
  expect(await s.getAccessToken()).toBeNull();
  write.mockRestore();
});

it('serialises a delayed secure-store write before the later deletion', async () => {
  let release!: () => void;
  const write = jest
    .spyOn(SecureStore, 'setItemAsync')
    .mockImplementationOnce(async (key, value) => {
      await new Promise<void>((r) => {
        release = r;
      });
      store.set(key, value);
    });
  const s = make(jest.fn());
  const starting = s.start(tokens(1));
  await new Promise((r) => setTimeout(r, 0));
  const clearing = s.clear();
  release();
  expect(await starting).toBe(false);
  await clearing;
  expect(store.size).toBe(0);
  expect(await s.getAccessToken()).toBeNull();
  write.mockRestore();
});

it('reports a failed secure-store deletion while clearing memory immediately', async () => {
  const s = make(jest.fn());
  await s.start(tokens(1));
  const seen: boolean[] = [];
  s.subscribe((value) => seen.push(value));
  const deletion = jest
    .spyOn(SecureStore, 'deleteItemAsync')
    .mockRejectedValueOnce(new Error('Keychain unavailable'));
  const revision = s.generation();
  await expect(s.clear()).rejects.toThrow('could not clear secure sign-in storage');
  expect(s.generation()).toBeGreaterThan(revision);
  expect(seen).toEqual([false]);
  deletion.mockRestore();
  await s.clear();
  expect(store.size).toBe(0);
});
