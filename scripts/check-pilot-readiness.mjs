import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_GATES = [
  'database-isolation',
  'hiring-journey',
  'document-storage-scan',
  'identity-recovery',
  'android-device',
  'ios-device',
  'accessibility',
  'backup-restore',
  'monitoring-rollback',
  'business-legal-review',
  'owner-pilot-approval',
];
/** An evidence gate, not a switch that enables accounts or payments. */
export function evaluatePilot(manifest, commit) {
  const errors = [];
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.gates))
    return { errors: ['Invalid pilot manifest.'], blocked: REQUIRED_GATES };
  if (manifest.billing !== 'disabled') errors.push('Pilot billing must stay disabled.');
  if (manifest.audience !== 'invitation-only') errors.push('Pilot must be invitation-only.');
  if (!/^[a-f0-9]{40}$/.test(commit ?? ''))
    errors.push('Supply the exact 40-character release commit.');
  const ids = manifest.gates.map((g) => g.id);
  if (new Set(ids).size !== ids.length) errors.push('Duplicate pilot gate.');
  const blocked = [];
  for (const id of REQUIRED_GATES) {
    const gate = manifest.gates.find((g) => g.id === id);
    if (
      !gate ||
      gate.status !== 'passed' ||
      gate.commit !== commit ||
      !gate.evidence?.trim() ||
      !gate.reviewer?.trim() ||
      !gate.checked_at ||
      !Number.isFinite(Date.parse(gate.checked_at))
    )
      blocked.push(id);
  }
  return { errors, blocked };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2] ?? 'docs/pilot/readiness.json';
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const result = evaluatePilot(manifest, process.argv[3]);
  for (const error of result.errors) console.error(error);
  console.log(
    result.blocked.length
      ? `Pilot blocked: ${result.blocked.join(', ')}`
      : 'Pilot evidence complete for the specified commit. Release remains an explicit owner action.',
  );
  process.exitCode = result.errors.length || result.blocked.length ? 1 : 0;
}
