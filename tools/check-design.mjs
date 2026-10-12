import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(readFileSync(resolve(root, 'upstream.lock'), 'utf8').replace(/^\uFEFF/, ''));
for (const [name, record] of Object.entries(lock.local_design_files)) {
  const actual = createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex');
  if (actual !== record.sha256) throw new Error(`Design digest mismatch: ${name}`);
}
console.log(JSON.stringify({ designIntegrity: 'passed', checkedFiles: Object.keys(lock.local_design_files).length, deploymentStatus: lock.status, unresolved: lock.required_unresolved.length }));
