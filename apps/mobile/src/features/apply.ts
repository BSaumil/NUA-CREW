import { randomUUID } from 'expo-crypto';
import { ApiFailure } from '@/api/client';

export type ApplyOutcome = 'success' | 'rejected' | 'unknown';

/** Did the server definitely answer "no" (4xx), or might it have processed the request anyway? */
export function outcomeOfError(e: unknown): ApplyOutcome {
  return e instanceof ApiFailure && e.status >= 400 && e.status < 500 ? 'rejected' : 'unknown';
}

/**
 * One application attempt at a time, with a stable idempotency key.
 *
 * If a submit ends ambiguously (timeout, dropped connection, 5xx, account switch) the request may
 * still have reached the server. Retrying the SAME unchanged application must reuse the same key so
 * the server returns the original instead of creating a duplicate. Changing the resume or note is a
 * different application: it gets a fresh key. A definite answer (success or a 4xx) ends the attempt.
 */
export function createApplyGuard(newKey: () => string = randomUUID) {
  const keys = new Map<string, string>();
  let fingerprint = '';
  let busy = false;
  return {
    /** Returns the key to send, or null when a submit is already in flight (rapid double tap). */
    begin(resumeId: string | null, note: string): string | null {
      if (busy) return null;
      busy = true;
      const fp = JSON.stringify([resumeId, note.trim()]);
      fingerprint = fp;
      let key = keys.get(fp);
      if (!key) {
        key = newKey();
        keys.set(fp, key);
      }
      return key;
    },
    end(outcome: ApplyOutcome): void {
      busy = false;
      if (outcome !== 'unknown') keys.delete(fingerprint);
    },
    get busy() {
      return busy;
    },
  };
}
