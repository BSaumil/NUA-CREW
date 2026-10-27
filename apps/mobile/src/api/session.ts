import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { secureDelete, secureGet, secureSet } from '@/lib/storage';

const REFRESH_KEY = 'nua.refresh';
const EARLY_MS = 60_000;

export type TokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires_in: number;
  role: string;
  user_id: string;
};
type Listener = (signedIn: boolean) => void;

export class SessionChangedError extends Error {
  constructor() {
    super('Your session changed. Please try again.');
    this.name = 'SessionChangedError';
  }
}

/** Session generations bind every request to one sign-in. Rotation keeps the generation;
 * signing out or starting another account invalidates all older async work immediately.
 * Secure-store operations are serialised so a delayed write cannot undo a later sign-out.
 */
export class Session {
  private access: string | null = null;
  private accountRole: 'candidate' | 'employer' | null = null;
  private accessExpiresAt = 0;
  private revision = 0;
  private inflight: { revision: number; promise: Promise<string | null> } | null = null;
  private storage: Promise<unknown> = Promise.resolve();
  private listeners = new Set<Listener>();
  fetchImpl: typeof fetch = (...a) => fetch(...a);
  now: () => number = () => Date.now();

  get gen(): number {
    return this.revision;
  }
  get signedIn(): boolean {
    return this.access !== null;
  }

  get role(): 'candidate' | 'employer' | null {
    return this.accountRole;
  }

  generation(): number {
    return this.revision;
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(signedIn: boolean) {
    this.listeners.forEach((l) => l(signedIn));
  }
  private stored<T>(action: () => Promise<T>): Promise<T> {
    const next = this.storage.catch(() => undefined).then(action);
    this.storage = next;
    return next;
  }

  async restore(): Promise<boolean> {
    return (await this.refreshNow()) !== null;
  }

  /** expectedGeneration also protects a sign-in response that arrived after local logout. */
  async start(t: TokenResponse, expectedGeneration = this.revision): Promise<boolean> {
    if (expectedGeneration !== this.revision) return false;
    const revision = ++this.revision;
    this.access = null;
    this.accountRole = null;
    this.accessExpiresAt = 0;
    return this.install(t, revision);
  }

  private async install(t: TokenResponse, revision: number): Promise<boolean> {
    if (
      !t.access_token ||
      !t.refresh_token ||
      (t.role !== 'candidate' && t.role !== 'employer') ||
      !Number.isFinite(t.expires_in) ||
      t.expires_in <= 0
    ) {
      throw new Error('Invalid mobile token response');
    }
    await this.stored(async () => {
      if (revision === this.revision) await secureSet(REFRESH_KEY, t.refresh_token!);
    });
    if (revision !== this.revision) return false;
    // Never publish a credential before durable storage has succeeded.
    this.access = t.access_token;
    this.accountRole = t.role as 'candidate' | 'employer';
    this.accessExpiresAt = this.now() + t.expires_in * 1000;
    this.emit(true);
    return true;
  }

  async getAccessToken(): Promise<string | null> {
    if (this.access && this.now() < this.accessExpiresAt - EARLY_MS) return this.access;
    return this.refreshNow();
  }

  async refreshNow(expectedGeneration = this.revision): Promise<string | null> {
    if (expectedGeneration !== this.revision) return null;
    if (this.inflight?.revision === expectedGeneration) return this.inflight.promise;
    const entry = { revision: expectedGeneration, promise: this.doRefresh(expectedGeneration) };
    this.inflight = entry;
    try {
      return await entry.promise;
    } finally {
      if (this.inflight === entry) this.inflight = null;
    }
  }

  private async doRefresh(revision: number): Promise<string | null> {
    const refresh = await this.stored(() => secureGet(REFRESH_KEY));
    if (revision !== this.revision) return null;
    if (!refresh) {
      if (this.access) await this.clear();
      return null;
    }
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
      const res = await this.fetchImpl(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
        signal: ctl.signal,
      }).finally(() => clearTimeout(timer));
      if (revision !== this.revision && !res.ok) return null;
      if (res.status === 401) {
        await this.clear();
        return null;
      }
      if (!res.ok) return null; // transient failure: keep the stored session
      const t = (await res.json()) as TokenResponse;
      if (revision !== this.revision) {
        if (t.refresh_token) this.revoke(t.refresh_token);
        return null;
      }
      return (await this.install(t, revision)) ? t.access_token : null;
    } catch {
      return null;
    }
  }

  private revoke(refreshToken: string): void {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
    void this.fetchImpl(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: ctl.signal,
    })
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
  }

  async signOut(): Promise<void> {
    // Invalidate requests and hide private screens before any storage or network await.
    this.resetMemory();
    const refresh = await this.stored(async () => {
      const old = await secureGet(REFRESH_KEY);
      await secureDelete(REFRESH_KEY);
      return old;
    });
    if (refresh) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
      void this.fetchImpl(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
        signal: ctl.signal,
      })
        .catch(() => undefined)
        .finally(() => clearTimeout(timer));
    }
  }

  private resetMemory() {
    ++this.revision;
    this.access = null;
    this.accountRole = null;
    this.accessExpiresAt = 0;
    this.emit(false);
  }
  async clear(): Promise<void> {
    this.resetMemory();
    await this.stored(() => secureDelete(REFRESH_KEY));
  }
}
export const session = new Session();
