import { createApplyGuard, outcomeOfError } from '@/features/apply';
import { ApiFailure } from '@/api/client';

const keys = () => {
  let n = 0;
  return () => `key-${++n}`;
};

describe('createApplyGuard', () => {
  it('remembers ambiguous payload A after editing to B and then back to A', () => {
    const g = createApplyGuard(keys());
    const first = g.begin('r1', 'original');
    g.end('unknown');
    const edited = g.begin('r2', 'changed');
    expect(edited).not.toBe(first);
    g.end('rejected');
    expect(g.begin('r1', 'original')).toBe(first);
  });
  it('reuses the key when an unchanged application is retried after an ambiguous failure', () => {
    const g = createApplyGuard(keys());
    const first = g.begin('r1', 'hello');
    g.end('unknown');
    expect(g.begin('r1', ' hello ')).toBe(first);
  });

  it('issues a new key when the resume or note changes', () => {
    const g = createApplyGuard(keys());
    const first = g.begin('r1', 'a');
    g.end('unknown');
    expect(g.begin('r1', 'b')).not.toBe(first);
    g.end('unknown');
    expect(g.begin('r2', 'b')).not.toBe(first);
  });

  it('blocks a rapid second submit while one is in flight', () => {
    const g = createApplyGuard(keys());
    expect(g.begin(null, '')).toBe('key-1');
    expect(g.begin(null, '')).toBeNull();
    expect(g.busy).toBe(true);
  });

  it('forgets the key after a definite answer', () => {
    const g = createApplyGuard(keys());
    g.begin('r1', '');
    g.end('rejected');
    expect(g.begin('r1', '')).toBe('key-2');
    g.end('success');
    expect(g.begin('r1', '')).toBe('key-3');
  });
});

describe('outcomeOfError', () => {
  it('treats 4xx as a definite rejection and everything else as unknown', () => {
    expect(outcomeOfError(new ApiFailure('x', 409))).toBe('rejected');
    expect(outcomeOfError(new ApiFailure('x', 503))).toBe('unknown');
    expect(outcomeOfError(new Error('network'))).toBe('unknown');
  });
});

describe('application attachments and retries', () => {
  it('keeps a retry key across reordering, but changes it when shared files change', () => {
    const guard = createApplyGuard(keys());
    const first = guard.begin('resume', 'hello', ['doc-b', 'doc-a']);
    guard.end('unknown');
    expect(guard.begin('resume', 'hello', ['doc-a', 'doc-b'])).toBe(first);
    guard.end('unknown');
    expect(guard.begin('resume', 'hello', ['doc-a'])).not.toBe(first);
  });
});
