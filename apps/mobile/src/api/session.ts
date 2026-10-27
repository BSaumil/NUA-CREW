import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { CredentialStorageError, secureDelete, secureGet, secureSet } from '@/lib/storage';

const REFRESH_KEY = 'nua.refresh';
const EARLY_MS = 60_000; // refresh a minute before expiry

export type TokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  expires_in: number;
  role: string;
  user_id: string;
};

type Listener = (signedIn: boolean) => void;

/** A request or refresh belonged to an earlier sign-in; its result must be thrown away. */
export class SessionChangedError extends Error {
  constructor() {
    super('The signed-in account changed while this request was running.');
    this.name = 'SessionChangedError';
  }
}

/**
 * Holds the short-lived access token in memory and the rotating refresh token in secure storage.
 *
 * Every sign-in/sign-out starts a new **generation**. Anything that began under one generation —
 * a refresh, a request, a response body still being read — is bound to it and is discarded if the
 * generation has moved on. That is what stops a slow refresh from resurrecting a signed-out
 * account, a stale failure from signing out the next person, and an old request from being replayed
 * with someone else's credentials.
 *
 * Refresh tokens are single-use, so concurrent callers share one refresh per generation (a second
 * parallel refresh would look like theft to the server). Credential writes/deletes run through a
 * queue so they can never interleave.
 */
export class Session {
  private generation = 0;
  private access: string | null = null;
  private accessExpiresAt = 0;
  private inflight: { gen: number; promise: Promise<string | null> } | null = null;
  private listeners = new Set<Listener>();
  private storageQueue: Promise<unknown> = Promise.resolve();
  fetchImpl: typeof fetch = (...a) => fetch(...a);
  now: () => number = () => Date.now();

  /** Identifies the current sign-in. Compare before trusting anything that took time. */
  get gen(): number {
    return this.generation;
  }

  /** True while an account is signed in (in memory). */
  get signedIn(): boolean {
    return this.access !== null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(signedIn: boolean) {
    this.listeners.forEach((l) => l(signedIn));
  }

  /** Run a credential-storage operation after every earlier one has finished. */
  private serial<T>(op: () => Promise<T>): Promise<T> {
    const run = this.storageQueue.then(op, op);
    this.storageQueue = run.catch(() => undefined);
    return run;
  }

  /** Call once at launch. Returns true when a stored session was resumed. */
  async restore(): Promise<boolean> {
    const stored = await this.serial(() => secureGet(REFRESH_KEY));
    if (!stored) return false;
    return (await this.refreshNow()) !== null;
  }

  /** A new person (or the same one again) has signed in. */
  async start(t: TokenResponse): Promise<void> {
    this.generation++;
    this.inflight = null;
    this.restoredPublished = true; // start() announces itself below
    const gen = this.generation;
    this.access = t.access_token;
    this.accessExpiresAt = this.now() + t.expires_in * 1000;
    if (t.refresh_token) {
      const token = t.refresh_token;
      await this.serial(() => secureSet(REFRESH_KEY, token));
    }
    if (gen === this.generation) this.emit(true);
  }

  /** Token plus the generation it belongs to, read consistently. */
  async snapshot(): Promise<{ token: string | null; gen: number }> {
    const gen = this.generation;
    if (this.access && this.now() < this.accessExpiresAt - EARLY_MS)
      return { token: this.access, gen };
    const token = await this.refreshNow();
    // If the account changed while we waited, the token belongs to nobody we are acting for.
    return gen === this.generation ? { token, gen } : { token: null, gen: this.generation };
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.snapshot()).token;
  }

  /** Force a refresh (e.g. after a 401). Resolves null if the sign-in changed or refresh failed. */
  async refreshNow(): Promise<string | null> {
    const gen = this.generation;
    if (this.inflight?.gen !== gen) {
      const promise = this.doRefresh(gen).finally(() => {
        if (this.inflight?.promise === promise) this.inflight = null;
      });
      this.inflight = { gen, promise };
    }
    return this.inflight.promise;
  }

  private async doRefresh(gen: number): Promise<string | null> {
    const refresh = await this.serial(() => secureGet(REFRESH_KEY));
    if (gen !== this.generation) return null;
    if (!refresh) {
      // Nothing stored. If we still believed we were signed in, that belief is wrong: end it.
      // If we were already signed out (e.g. a public request), there is nothing to do.
      if (this.access) await this.clear().catch(() => undefined);
      return null;
    }
    let res: Response;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
      res = await this.fetchImpl(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
        signal: ctl.signal,
      }).finally(() => clearTimeout(timer));
    } catch {
      return null; // offline: keep the stored session so the app still opens
    }

    if (res.status === 401) {
      // Revoked, expired or reused. Only end the session this refresh was made for.
      if (gen === this.generation) await this.clear().catch(() => undefined);
      return null;
    }
    if (!res.ok) return null; // server trouble: keep the session, try again later

    let t: TokenResponse;
    try {
      t = (await res.json()) as TokenResponse;
    } catch {
      return null;
    }
    if (gen !== this.generation) {
      // The person signed out (or someone else signed in) while this was in flight. The server has
      // already rotated the token, so the new one is live: revoke it rather than keep or restore it.
      if (t.refresh_token) this.revoke(t.refresh_token);
      return null;
    }
    // Same session: rotate in place (no new generation, no new "signed in" event).
    this.access = t.access_token;
    this.accessExpiresAt = this.now() + t.expires_in * 1000;
    if (t.refresh_token) {
      const token = t.refresh_token;
      try {
        await this.serial(() => secureSet(REFRESH_KEY, token));
      } catch {
        /* keep the in-memory session; the next launch will need a fresh sign-in */
      }
    }
    if (gen !== this.generation) return null;
    this.emitFirstRestore();
    return t.access_token;
  }

  private restoredPublished = false;
  /** restore() resumes a session without going through start(); announce it exactly once. */
  private emitFirstRestore() {
    if (!this.restoredPublished && this.access) {
      this.restoredPublished = true;
      this.emit(true);
    }
  }

  private revoke(refreshToken: string) {
    this.fetchImpl(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }

  /**
   * Sign out. The in-memory session ends first (so nothing else can use it), then the server is
   * told so the token cannot be reused, then the stored credential is removed. If removal fails
   * the error is thrown AFTER the person is signed out, so the UI can say so truthfully.
   */
  async signOut(): Promise<void> {
    const refresh = await this.serial(() => secureGet(REFRESH_KEY));
    if (refresh) this.revoke(refresh);
    await this.clear();
  }

  async clear(): Promise<void> {
    this.generation++;
    this.inflight = null;
    this.access = null;
    this.accessExpiresAt = 0;
    this.restoredPublished = false;
    this.emit(false);
    try {
      await this.serial(() => secureDelete(REFRESH_KEY));
    } catch (e) {
      throw e instanceof CredentialStorageError ? e : new CredentialStorageError('delete', e);
    }
  }
}

export const session = new Session();
