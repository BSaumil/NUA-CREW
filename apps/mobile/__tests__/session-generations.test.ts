import * as SecureStore from 'expo-secure-store';
import { Session, type TokenResponse } from '../src/api/session';
import { CredentialStorageError } from '../src/lib/storage';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const tokens = (n: number): TokenResponse => ({
  access_token: `access-${n}`,
  refresh_token: `refresh-${n}`,
  expires_in: 1800,
  role: 'candidate',
  user_id: `u${n}`,
});
const res = (status: number, body: unknown = {}) =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

/** A promise we resolve by hand, to hold a request "in flight" across a sign-out. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function make(f: jest.Mock) {
  const s = new Session();
  s.fetchImpl = f as unknown as typeof fetch;
  return s;
}
const calls = (f: jest.Mock, path: string) =>
  f.mock.calls.filter((c) => String(c[0]).includes(path));

beforeEach(() => store.clear());

describe('session generations', () => {
  it('a late refresh success after sign-out never restores the account, and revokes the new token', async () => {
    const gate = deferred<Response>();
    const f = jest.fn((url: string) =>
      url.includes('/refresh') ? gate.promise : Promise.resolve(res(204)),
    );
    const s = make(f as unknown as jest.Mock);
    const seen: boolean[] = [];
    s.subscribe((v) => seen.push(v));
    await s.start(tokens(1));
    const pending = s.refreshNow();
    await new Promise((r) => setTimeout(r, 0)); // refresh request is now in flight
    await s.clear();
    gate.resolve(res(200, tokens(2)));
    expect(await pending).toBeNull();
    expect(s.signedIn).toBe(false);
    expect(store.has('nua.refresh')).toBe(false);
    expect(seen).toEqual([true, false]);
    const revoked = calls(f as unknown as jest.Mock, '/logout').map((c) => JSON.parse(c[1].body));
    expect(revoked).toContainEqual({ refresh_token: 'refresh-2' });
  });

  it('a late refresh failure for the old account does not clear a newly signed-in account', async () => {
    const gate = deferred<Response>();
    const f = jest.fn((url: string) =>
      url.includes('/refresh') ? gate.promise : Promise.resolve(res(204)),
    );
    const s = make(f as unknown as jest.Mock);
    await s.start(tokens(1));
    const pending = s.refreshNow();
    await new Promise((r) => setTimeout(r, 0));
    await s.start(tokens(3)); // someone else signs in
    gate.resolve(res(401));
    expect(await pending).toBeNull();
    expect(s.signedIn).toBe(true);
    expect(store.get('nua.refresh')).toBe('refresh-3');
    expect(await s.getAccessToken()).toBe('access-3');
  });

  it('serialises credential writes so the last sign-in wins', async () => {
    const order: string[] = [];
    const real = SecureStore.setItemAsync as jest.Mock;
    real.mockImplementationOnce(async (k: string, v: string) => {
      await new Promise((r) => setTimeout(r, 20)); // slow first write
      order.push(v);
      store.set(k, v);
    });
    const s = make(jest.fn());
    const a = s.start(tokens(1));
    await new Promise((r) => setTimeout(r, 0)); // ensure first write began before switching
    const b = s.start(tokens(2));
    await Promise.all([a, b]);
    expect(store.get('nua.refresh')).toBe('refresh-2');
    expect(order).toEqual(['refresh-1']);
  });

  it('reports a genuine credential deletion failure, but the person is signed out', async () => {
    const s = make(jest.fn().mockResolvedValue(res(204)));
    await s.start(tokens(1));
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    await expect(s.signOut()).rejects.toBeInstanceOf(CredentialStorageError);
    expect(s.signedIn).toBe(false);
  });
});
