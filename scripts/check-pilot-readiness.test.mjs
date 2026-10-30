import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePilot, REQUIRED_GATES } from './check-pilot-readiness.mjs';
const commit = 'a'.repeat(40);
const manifest = () => ({
  version: 1,
  billing: 'disabled',
  audience: 'invitation-only',
  gates: REQUIRED_GATES.map((id) => ({
    id,
    status: 'passed',
    commit,
    evidence: 'actions/run + device record',
    reviewer: 'reviewer',
    checked_at: '2026-10-31T00:00:00Z',
  })),
});
test('missing, stale or unsupported evidence blocks a pilot', () => {
  const m = manifest();
  m.gates[0].commit = 'b'.repeat(40);
  m.gates[1].evidence = '';
  m.gates[2].status = 'blocked';
  assert.deepEqual(evaluatePilot(m, commit).blocked, REQUIRED_GATES.slice(0, 3));
});
test('live billing and public registration cannot satisfy the pilot gate', () => {
  const m = manifest();
  m.billing = 'live';
  m.audience = 'public';
  assert.equal(evaluatePilot(m, commit).errors.length, 2);
});
test('exact commit evidence is required for every named gate', () => {
  assert.deepEqual(evaluatePilot(manifest(), commit), { errors: [], blocked: [] });
  assert.ok(evaluatePilot({ version: 1, gates: [] }, '').errors.length);
  assert.equal(
    evaluatePilot({ version: 1, gates: [] }, commit).blocked.length,
    REQUIRED_GATES.length,
  );
});
