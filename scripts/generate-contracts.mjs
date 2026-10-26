// Regenerates packages/contracts from the FastAPI OpenAPI document.
// Usage: pnpm contracts   (requires `uv` and Python deps in services/api)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = execFileSync(
  'uv',
  [
    'run',
    'python',
    '-c',
    'import json; from app.main import app; print(json.dumps(app.openapi(), indent=2, sort_keys=True))',
  ],
  {
    cwd: resolve(root, 'services/api'),
    encoding: 'utf8',
    env: { ...process.env, NUA_ENV: 'development' },
  },
);
writeFileSync(resolve(root, 'packages/contracts/openapi.json'), spec);
execFileSync(
  'pnpm',
  [
    'exec',
    'openapi-typescript',
    'packages/contracts/openapi.json',
    '-o',
    'packages/contracts/src/schema.d.ts',
    // Fields with server defaults are optional in requests, so clients may omit them.
    '--default-non-nullable',
    'false',
  ],
  { cwd: root, stdio: 'inherit' },
);
console.log('contracts regenerated');
