import { api, unwrap } from '@/api/client';

/** What happened, in terms a screen can word honestly. */
export type RecoveryOutcome = 'sent' | 'unavailable' | 'already_verified';

/**
 * Ask for a password-reset email. The API answers the same way whether or not an account exists, so
 * `sent` only ever means "if there is an account, a link was emailed". `unavailable` means this
 * deployment cannot send email at all, and the screen must say that instead of claiming otherwise.
 */
export async function requestPasswordReset(email: string): Promise<'sent' | 'unavailable'> {
  const r = unwrap(await api.POST('/v1/auth/password/forgot', { body: { email: email.trim() } }));
  return r.email_delivery ? 'sent' : 'unavailable';
}

export async function requestEmailVerification(): Promise<RecoveryOutcome> {
  const r = unwrap(await api.POST('/v1/auth/email/verify/request'));
  if (r.status === 'already_verified') return 'already_verified';
  return r.email_delivery ? 'sent' : 'unavailable';
}

export const RESET_SENT =
  'If an account exists for that address, we have emailed a link to choose a new password. It opens in your browser, works once and expires in 30 minutes.';
export const EMAIL_UNAVAILABLE = 'Email is not switched on in this environment yet.';
