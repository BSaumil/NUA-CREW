import { createApplyGuard, outcomeOfError } from '@/features/apply';
import { ApiFailure } from '@/api/client';

const keys = () => {
  let n = 0;
  return () => `key-${++n}`;
};

describe('createApplyGuard', () => {
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
