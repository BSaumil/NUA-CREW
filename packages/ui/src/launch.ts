/**
 * Launch readiness: the single source of truth for whether a call to action may lead to a real
 * app page. It is deliberately hard to open by accident.
 *
 * An entry point is OPEN only when BOTH are true:
 *   1. its own flag is exactly "true", and
 *   2. the host it leads to is explicitly configured and acceptable (see `parseBase`).
 * A flag with no host, or a host with no flag, stays closed and sends visitors to the honest
 * launch-status page instead of a dead or protected link. There are no defaults that open anything.
 *
 * Environment contract (set on the marketing site only; changing it needs a redeploy):
 *   NUA_CANDIDATE_SIGNUP_OPEN=true  + NUA_APP_URL   -> "Create Free Employee Account" opens
 *   NUA_EMPLOYER_SIGNUP_OPEN=true   + NUA_HIRE_URL  -> "Register Your Business" opens
 *   NUA_JOB_POSTING_OPEN=true       + NUA_HIRE_URL  -> "Post a Job" opens
 * Open the flags only after the hosted app and API behind them have passed their own checks.
 */

export type EntryId = 'employee' | 'employer' | 'post-job';

export type LaunchEnv = Record<string, string | undefined>;

export interface Entry {
  id: EntryId;
  /** The action, worded the same everywhere it appears. */
  label: string;
  /** One honest line about what it does. */
  blurb: string;
  open: boolean;
  /** Where the button goes: the real app page when open, otherwise the launch-status page. */
  href: string;
  /** Always the launch-status anchor for this entry. */
  statusHref: string;
  /** What is true today, shown whenever the entry is not open. */
  closedNote: string;
}

export interface Launch {
  entries: Record<EntryId, Entry>;
  list: Entry[];
  anyOpen: boolean;
  appBase: string | null;
  hireBase: string | null;
}

/**
 * A host we are willing to send visitors to: https, or http on localhost for a local pilot.
 * Never credentials, a path, a query or another scheme. Returns the origin, or null.
 */
export function parseBase(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const protocolOk = url.protocol === 'https:' || (url.protocol === 'http:' && local);
  if (!protocolOk || url.username || url.password) return null;
  if (url.pathname !== '/' || url.search || url.hash) return null;
  return url.origin;
}

const on = (value: string | undefined) => value === 'true';

export function readLaunch(env: LaunchEnv): Launch {
  const appBase = parseBase(env.NUA_APP_URL);
  const hireBase = parseBase(env.NUA_HIRE_URL);

  const make = (
    id: EntryId,
    label: string,
    blurb: string,
    closedNote: string,
    base: string | null,
    flag: string | undefined,
    path: string,
    statusHref: string,
  ): Entry => {
    const open = on(flag) && base !== null;
    return {
      id,
      label,
      blurb,
      open,
      href: open && base ? `${base}${path}` : statusHref,
      statusHref,
      closedNote,
    };
  };

  const employee = make(
    'employee',
    'Create Free Employee Account',
    'Find work that fits your life. Always free for job seekers.',
    'Pilot registration is not open yet. This takes you to the launch status.',
    appBase,
    env.NUA_CANDIDATE_SIGNUP_OPEN,
    '/register',
    '/apps#job-seekers',
  );
  const employer = make(
    'employer',
    'Register Your Business',
    'Set up your hiring workspace. Business verification comes before you can publish.',
    'Pilot registration is not open yet. This takes you to the launch status.',
    hireBase,
    env.NUA_EMPLOYER_SIGNUP_OPEN,
    '/register',
    '/apps#employers',
  );
  const postJob = make(
    'post-job',
    'Post a Job',
    'A$49 for 14 days. Optional A$30 5-day promotion, A$79 together.',
    'Posting is not open yet and payments are not switched on. This takes you to the launch status.',
    hireBase,
    env.NUA_JOB_POSTING_OPEN,
    '/jobs/new',
    '/apps#post-a-job',
  );

  const list = [employee, employer, postJob];
  return {
    entries: { employee, employer, 'post-job': postJob },
    list,
    anyOpen: list.some((e) => e.open),
    appBase,
    hireBase,
  };
}
