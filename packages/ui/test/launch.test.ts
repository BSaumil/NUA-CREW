import { describe, expect, it } from 'vitest';
import { parseBase, readLaunch } from '../src/launch';
import { RETURN_TO_ALLOWED, safeReturnTo } from '../src/return-to';

const OPEN_ALL = {
  NUA_CANDIDATE_SIGNUP_OPEN: 'true',
  NUA_EMPLOYER_SIGNUP_OPEN: 'true',
  NUA_JOB_POSTING_OPEN: 'true',
  NUA_APP_URL: 'https://app.example.test',
  NUA_HIRE_URL: 'https://hire.example.test',
};

describe('parseBase', () => {
  it('accepts https hosts and local http, normalising to the origin', () => {
    expect(parseBase('https://app.example.test')).toBe('https://app.example.test');
    expect(parseBase('https://app.example.test/')).toBe('https://app.example.test');
    expect(parseBase('http://localhost:3000')).toBe('http://localhost:3000');
    expect(parseBase('http://127.0.0.1:3001/')).toBe('http://127.0.0.1:3001');
  });
  it('refuses anything else', () => {
    for (const bad of [
      undefined,
      '',
      'not a url',
      'http://app.example.test',
      'javascript:alert(1)',
      'ftp://app.example.test',
      'https://user:pass@app.example.test',
      'https://app.example.test/some/path',
      'https://app.example.test/?next=//evil.test',
      'https://app.example.test/#x',
    ]) {
      expect(parseBase(bad), String(bad)).toBeNull();
    }
  });
});

describe('launch readiness', () => {
  it('is closed by default: nothing opens without explicit configuration', () => {
    const l = readLaunch({});
    expect(l.anyOpen).toBe(false);
    for (const e of l.list) {
      expect(e.open).toBe(false);
      expect(e.href.startsWith('/apps#')).toBe(true);
      expect(e.href).toBe(e.statusHref);
    }
  });

  it('a flag alone does not open an entry point (no host configured)', () => {
    const l = readLaunch({
      NUA_CANDIDATE_SIGNUP_OPEN: 'true',
      NUA_EMPLOYER_SIGNUP_OPEN: 'true',
      NUA_JOB_POSTING_OPEN: 'true',
    });
    expect(l.anyOpen).toBe(false);
  });

  it('a host alone does not open an entry point (flag off)', () => {
    const l = readLaunch({
      NUA_APP_URL: 'https://app.example.test',
      NUA_HIRE_URL: 'https://hire.example.test',
    });
    expect(l.anyOpen).toBe(false);
  });

  it('only the exact string "true" counts as on', () => {
    for (const v of ['1', 'TRUE', 'yes', ' true', 'true ', 'on', '']) {
      const l = readLaunch({ ...OPEN_ALL, NUA_CANDIDATE_SIGNUP_OPEN: v });
      expect(l.entries.employee.open, JSON.stringify(v)).toBe(false);
    }
  });

  it('opens each entry point on its own flag and host, to the right app page', () => {
    const l = readLaunch(OPEN_ALL);
    expect(l.entries.employee).toMatchObject({
      open: true,
      href: 'https://app.example.test/register',
    });
    expect(l.entries.employer).toMatchObject({
      open: true,
      href: 'https://hire.example.test/register',
    });
    expect(l.entries['post-job']).toMatchObject({
      open: true,
      href: 'https://hire.example.test/jobs/new',
    });
    expect(l.anyOpen).toBe(true);
  });

  it('opens them independently', () => {
    const l = readLaunch({ ...OPEN_ALL, NUA_EMPLOYER_SIGNUP_OPEN: 'false' });
    expect(l.entries.employee.open).toBe(true);
    expect(l.entries.employer.open).toBe(false);
    expect(l.entries.employer.href).toBe('/apps#employers');
    expect(l.entries['post-job'].open).toBe(true);
  });

  it('refuses an unsafe host even when its flag is on', () => {
    const l = readLaunch({
      ...OPEN_ALL,
      NUA_APP_URL: 'http://app.example.test',
      NUA_HIRE_URL: 'javascript:alert(1)',
    });
    expect(l.anyOpen).toBe(false);
    expect(l.appBase).toBeNull();
    expect(l.hireBase).toBeNull();
  });

  it('keeps the labels, price and honesty wording stable', () => {
    const l = readLaunch({});
    expect(l.list.map((e) => e.label)).toEqual([
      'Create Free Employee Account',
      'Register Your Business',
      'Post a Job',
    ]);
    expect(l.entries['post-job'].blurb).toContain('A$49 for 14 days');
    expect(l.entries['post-job'].blurb).toContain('A$30');
    expect(l.entries['post-job'].blurb).toContain('A$79');
    expect(l.entries['post-job'].closedNote).toMatch(/payments are not switched on/i);
    expect(l.entries.employee.closedNote).toMatch(/not open yet/i);
  });
});

describe('safeReturnTo (open-redirect guard)', () => {
  it('allows the in-app paths on the list', () => {
    for (const p of RETURN_TO_ALLOWED) expect(safeReturnTo(p)).toBe(p);
  });

  it('refuses everything else, falling back', () => {
    for (const bad of [
      undefined,
      null,
      42,
      {},
      [],
      '',
      'jobs/new',
      'https://evil.test',
      'http://evil.test/jobs/new',
      '//evil.test',
      '//evil.test/jobs/new',
      '/\\evil.test',
      '\\\\evil.test',
      '/jobs/new?next=https://evil.test',
      '/jobs/new#x',
      '/jobs/new/../../admin',
      '/%2f%2fevil.test',
      '/jobs/new%0d%0aSet-Cookie:x=1',
      '/admin',
      'javascript:alert(1)',
      '/jobs/new\n',
      ' /jobs/new ',
    ]) {
      expect(safeReturnTo(bad), JSON.stringify(bad)).toBe('/');
    }
  });

  it('uses the caller fallback', () => {
    expect(safeReturnTo('https://evil.test', '/jobs')).toBe('/jobs');
  });
});
