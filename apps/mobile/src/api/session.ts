import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { secureDelete, secureGet, secureSet } from '@/lib/storage';

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

/**
 * Holds the short-lived access token in memory and the rotating refresh token in secure storage.
 * Concurrent callers share one refresh request (refresh tokens are single-use, so a second
 * parallel refresh would look like theft and sign the user out).
 */
export class Session {
  private access: string | null = null;
  private accessExpiresAt = 0;
  private inflight: Promise<string | null> | null = null;
  private listeners = new Set<Listener>();
  fetchImpl: typeof fetch = (...a) => fetch(...a);
  now: () => number = () => Date.now();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(signedIn: boolean) {
    this.listeners.forEach((l) => l(signedIn));
  }

  /** Call once at launch. Returns true when a stored session can be resumed. */
  async restore(): Promise<boolean> {
    const stored = await secureGet(REFRESH_KEY);
    if (!stored) return false;
    return (await this.refreshNow()) !== null;
  }

  async start(t: TokenResponse): Promise<void> {
    this.access = t.access_token;
    this.accessExpiresAt = this.now() + t.expires_in * 1000;
    if (t.refresh_token) await secureSet(REFRESH_KEY, t.refresh_token);
    this.emit(true);
  }

  async getAccessToken(): Promise<string | null> {
    if (this.access && this.now() < this.accessExpiresAt - EARLY_MS) return this.access;
    return this.refreshNow();
  }

  /** Force a refresh (used after the server answered 401). */
  async refreshNow(): Promise<string | null> {
    this.inflight ??= this.doRefresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async doRefresh(): Promise<string | null> {
    const refresh = await secureGet(REFRESH_KEY);
    if (!refresh) {
      await this.clear();
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
      if (res.status === 401) {
        await this.clear(); // revoked, expired or reused: the user must sign in again
        return null;
      }
      if (!res.ok) return null; // server trouble: keep the session, try again later
      const t = (await res.json()) as TokenResponse;
      await this.start(t);
      return t.access_token;
    } catch {
      return null; // offline: keep the stored session so the app still opens
    }
  }

  /** Local sign-out. Tell the server first (best effort) so the token cannot be reused. */
  async signOut(): Promise<void> {
    const refresh = await secureGet(REFRESH_KEY);
    if (refresh) {
      this.fetchImpl(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => undefined);
    }
    await this.clear();
  }

  async clear(): Promise<void> {
    this.access = null;
    this.accessExpiresAt = 0;
    await secureDelete(REFRESH_KEY);
    this.emit(false);
  }
}

export const session = new Session();
